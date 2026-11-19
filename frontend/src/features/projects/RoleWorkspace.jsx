import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  Users,
  LayoutGrid,
  FileText,
  FolderKanban,
  ExternalLink,
  Shield,
  Layers,
  Clock,
  Sparkles,
  ArrowUpRight,
  Hash,
  Download,
  Plus,
  Search,
  Trash2,
  Eye,
  Video,
  Image,
  AlertCircle,
  Loader2,
  FileCode,
  Tag,
  Maximize2,
} from 'lucide-react';
import RoleContributorsModal from './RoleContributorsModal';
import MediaUploadModal from './MediaUploadModal';
import DocumentUploadModal from './DocumentUploadModal';
import DocumentViewerModal from './DocumentViewerModal';
import FullscreenLightbox from '../../components/FullscreenLightbox';
import { buildApiUrl, getAuthHeaders } from '../../services/apiConfig';

const api = async (path, options = {}) => {
  const { headers: customHeaders, ...restOptions } = options;
  const response = await fetch(buildApiUrl(path), {
    credentials: 'include',
    ...restOptions,
    headers: getAuthHeaders({ 'Content-Type': 'application/json', ...(customHeaders || {}) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
};

const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?';

const titleCase = (val = '') =>
  val ? val[0].toUpperCase() + val.slice(1).toLowerCase() : 'Member';

function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function RoleWorkspace({
  project,
  role,
  user,
  membership: initialMembership,
  onBackToLanding,
}) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [workspaceData, setWorkspaceData] = useState(null);
  const [resources, setResources] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [channels, setChannels] = useState([]);
  const [contributors, setContributors] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [membership, setMembership] = useState(initialMembership || null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [isContributorsModalOpen, setIsContributorsModalOpen] = useState(false);
  const [isMediaUploadOpen, setIsMediaUploadOpen] = useState(false);
  const [isDocUploadOpen, setIsDocUploadOpen] = useState(false);
  const [activeViewingDoc, setActiveViewingDoc] = useState(null);
  const [activeLightboxItem, setActiveLightboxItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // { type, item }
  const [deleting, setDeleting] = useState(false);

  // Search filters
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');
  const [docSearchQuery, setDocSearchQuery] = useState('');

  // Discussions channel
  const [selectedChannel, setSelectedChannel] = useState(null);

  const activeRole = workspaceData?.role || role || {};
  const roleId = role?._id || role?.id;
  const projectId = project?._id || project?.id;
  const currentUserId = user?._id || user?.id;

  const isOwnerOrAdmin =
    membership?.projectRole === 'owner' ||
    membership?.projectRole === 'admin' ||
    project?.ownerId?._id === currentUserId ||
    project?.ownerId?.id === currentUserId ||
    project?.ownerId === currentUserId;

  const canDeleteItem = useCallback(
    (item) => {
      if (isOwnerOrAdmin) return true;
      const uploaderId = item?.uploadedBy?._id || item?.uploadedBy?.id || item?.uploadedBy;
      return String(uploaderId) === String(currentUserId);
    },
    [isOwnerOrAdmin, currentUserId]
  );

  const loadWorkspace = useCallback(async () => {
    if (!roleId || !projectId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api(`/projects/${projectId}/workspaces/${encodeURIComponent(roleId)}`);
      setWorkspaceData(data);
      setResources(data.resources || []);
      setDocuments(data.documents || []);
      setChannels(data.channels || []);
      setContributors(data.contributors || []);
      setPendingInvitations(data.pendingInvitations || []);
      if (data.membership) setMembership(data.membership);

      if (data.channels && data.channels.length > 0) {
        const roleNormalized = (data.role?.name || role?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const match =
          data.channels.find(
            (c) => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === roleNormalized
          ) || data.channels[0];
        setSelectedChannel(match);
      }
    } catch (err) {
      setError(err.message || 'Failed to load role workspace data.');
    } finally {
      setLoading(false);
    }
  }, [projectId, roleId, role?.name]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  // Handlers for Upload additions
  const handleMediaUploaded = (newResource) => {
    setResources((prev) => [newResource, ...prev]);
  };

  const handleDocumentUploaded = (newDoc) => {
    setDocuments((prev) => [newDoc, ...prev]);
  };

  // Delete Action
  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    const { type, item } = confirmDelete;
    setDeleting(true);

    try {
      if (type === 'resource') {
        await api(`/projects/${projectId}/workspaces/${encodeURIComponent(roleId)}/resources/${item._id}`, {
          method: 'DELETE',
        });
        setResources((prev) => prev.filter((r) => r._id !== item._id));
        if (activeLightboxItem?._id === item._id) {
          setActiveLightboxItem(null);
        }
      } else if (type === 'document') {
        await api(`/projects/${projectId}/workspaces/${encodeURIComponent(roleId)}/documents/${item._id}`, {
          method: 'DELETE',
        });
        setDocuments((prev) => prev.filter((d) => d._id !== item._id));
        if (activeViewingDoc?._id === item._id) {
          setActiveViewingDoc(null);
        }
      }
      setConfirmDelete(null);
    } catch (err) {
      alert(err.message || `Failed to delete ${type}`);
    } finally {
      setDeleting(false);
    }
  };

  // Filtered Media List
  const filteredResources = useMemo(() => {
    const q = mediaSearchQuery.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter(
      (r) =>
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.fileName && r.fileName.toLowerCase().includes(q)) ||
        (Array.isArray(r.tags) && r.tags.some((t) => t.toLowerCase().includes(q)))
    );
  }, [resources, mediaSearchQuery]);

  // Filtered Documents List
  const filteredDocuments = useMemo(() => {
    const q = docSearchQuery.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) =>
        (d.title && d.title.toLowerCase().includes(q)) ||
        (d.description && d.description.toLowerCase().includes(q)) ||
        (d.fileName && d.fileName.toLowerCase().includes(q)) ||
        (d.format && d.format.toLowerCase().includes(q)) ||
        (Array.isArray(d.tags) && d.tags.some((t) => t.toLowerCase().includes(q)))
    );
  }, [documents, docSearchQuery]);

  // Transform resources for FullscreenLightbox
  const lightboxReferences = useMemo(() => {
    return resources.map((r) => ({
      id: r._id,
      imageUrl: r.fileUrl,
      title: r.title || r.fileName || 'Media Asset',
      description: r.description,
      resourceType: r.resourceType || (r.fileUrl?.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image'),
      tags: r.tags || [],
      sourceUrl: r.fileUrl,
      createdAt: r.createdAt,
      uploaderName: r.uploadedBy?.name || (r.uploadedBy?.username ? `@${r.uploadedBy.username}` : 'Contributor'),
    }));
  }, [resources]);

  const currentLightboxRef = useMemo(() => {
    if (!activeLightboxItem) return null;
    return lightboxReferences.find((r) => r.id === activeLightboxItem._id) || null;
  }, [activeLightboxItem, lightboxReferences]);

  return (
    <main className="role-workspace-page">
      {/* Top Header */}
      <header className="rw-header">
        <div className="rw-header-left">
          <button
            type="button"
            className="rw-back-btn"
            onClick={onBackToLanding}
            aria-label="Back to project workspaces"
          >
            <ChevronLeft size={16} />
            <span>Project Workspaces</span>
          </button>

          <div className="rw-breadcrumbs">
            <span className="crumb-slash">/</span>
            <span className="crumb-project">{project.name}</span>
            <span className="crumb-slash">/</span>
            <span className="crumb-role">{activeRole.name || 'Role Workspace'}</span>
          </div>
        </div>

        <div className="rw-header-right">
          {/* Contributor Stack Button */}
          <button
            type="button"
            className="rw-team-trigger"
            onClick={() => setIsContributorsModalOpen(true)}
            title="View assigned team members"
          >
            <div className="rw-team-avatars">
              {contributors.slice(0, 3).map((contrib, i) => {
                const u = contrib.user || {};
                return (
                  <span
                    key={contrib._id || i}
                    className="rw-team-avatar"
                    title={u.name || `@${u.username}`}
                  >
                    {u.avatar ? (
                      <img src={u.avatar} alt="" />
                    ) : (
                      <span>{initials(u.name || u.username)}</span>
                    )}
                  </span>
                );
              })}
            </div>
            <span className="rw-team-count">
              {contributors.length} {contributors.length === 1 ? 'member' : 'members'}
            </span>
          </button>
        </div>
      </header>

      {/* Role Hero Banner */}
      <section className="rw-hero">
        <div className="rw-hero-content">
          <div className="rw-hero-badge">
            {activeRole.imageUrl ? (
              <img src={activeRole.imageUrl} alt="" className="rw-hero-badge-img" />
            ) : (
              <span className="rw-hero-fallback-icon">
                <Layers size={22} />
              </span>
            )}
          </div>
          <div className="rw-hero-text">
            <div className="rw-hero-pretitle">
              <span>{project.name} · Role Workspace</span>
            </div>
            <h1 className="rw-hero-title">{activeRole.name || 'Role Workspace'}</h1>
            <p className="rw-hero-description">
              {activeRole.description ||
                `Shared workspace dedicated to ${activeRole.name || 'role'} deliverables, design reviews, technical specifications, and team discussions.`}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="rw-nav-tabs" aria-label="Role workspace tabs">
          {[
            { id: 'Overview', label: 'Overview', icon: FolderKanban },
            { id: 'Gallery', label: 'Gallery', icon: LayoutGrid, count: resources.length },
            { id: 'Documents', label: 'Documents', icon: FileText, count: documents.length },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`rw-tab-btn ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <TabIcon size={14} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="rw-tab-count">{tab.count}</span>
                )}
              </button>
            );
          })}
        </nav>
      </section>

      {/* Tab Content Area */}
      <div className="rw-main-content">
        {loading ? (
          <div className="rw-loading-state">
            <span className="rw-loading-shimmer" />
            <p>Loading {activeRole.name || 'role'} workspace...</p>
          </div>
        ) : error ? (
          <div className="dashboard-error page-error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button type="button" onClick={loadWorkspace}>
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* ── TAB 1: OVERVIEW ────────────────────────────────────────── */}
            {activeTab === 'Overview' && (
              <div className="rw-overview-grid">
                {/* Left: Role Scope & Stats */}
                <div className="rw-overview-left">
                  <div className="rw-panel">
                    <div className="rw-panel-heading">
                      <h3>Workspace Mission & Scope</h3>
                    </div>
                    <p className="rw-panel-desc">
                      {activeRole.description ||
                        `Collaborative workspace for all ${activeRole.name || 'role'} assignments in ${project.name}. Team members can share specifications, review design mocks, verify code workflows, and collaborate on deliverables.`}
                    </p>

                    <div className="rw-quick-stats-row">
                      <div className="rw-quick-stat-box">
                        <span className="rw-stat-num">{contributors.length}</span>
                        <span className="rw-stat-label">Active Contributors</span>
                      </div>
                      <div className="rw-quick-stat-box">
                        <span className="rw-stat-num">{resources.length}</span>
                        <span className="rw-stat-label">Shared Media</span>
                      </div>
                      <div className="rw-quick-stat-box">
                        <span className="rw-stat-num">{documents.length}</span>
                        <span className="rw-stat-label">Project Docs</span>
                      </div>
                      <div className="rw-quick-stat-box">
                        <span className="rw-stat-num">{resources.length + documents.length}</span>
                        <span className="rw-stat-label">Total Files</span>
                      </div>
                    </div>
                  </div>

                  {/* Shortcuts to Sections */}
                  <div className="rw-shortcuts-grid">
                    <div
                      className="rw-shortcut-card"
                      onClick={() => setActiveTab('Gallery')}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="rw-shortcut-icon">
                        <LayoutGrid size={18} />
                      </div>
                      <div className="rw-shortcut-info">
                        <h4>Media Gallery</h4>
                        <p>{resources.length} files uploaded</p>
                      </div>
                      <ArrowUpRight size={16} className="rw-shortcut-arrow" />
                    </div>

                    <div
                      className="rw-shortcut-card"
                      onClick={() => setActiveTab('Documents')}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="rw-shortcut-icon">
                        <FileText size={18} />
                      </div>
                      <div className="rw-shortcut-info">
                        <h4>Document Library</h4>
                        <p>{documents.length} documents uploaded</p>
                      </div>
                      <ArrowUpRight size={16} className="rw-shortcut-arrow" />
                    </div>
                  </div>

                  {/* Recent Media Preview Strip (if available) */}
                  {resources.length > 0 && (
                    <div className="rw-panel rw-recent-panel">
                      <div className="rw-panel-heading space-between">
                        <h3>Recent Media</h3>
                        <button
                          type="button"
                          className="rw-link-btn"
                          onClick={() => setActiveTab('Gallery')}
                        >
                          View All ({resources.length})
                        </button>
                      </div>
                      <div className="rw-recent-media-row">
                        {resources.slice(0, 4).map((res) => (
                          <div
                            key={res._id}
                            className="rw-recent-thumb-card"
                            onClick={() => setActiveLightboxItem(res)}
                            role="button"
                            tabIndex={0}
                            title={res.title || res.fileName}
                          >
                            {res.resourceType === 'video' || res.fileUrl.match(/\.(mp4|webm|mov)$/i) ? (
                              <div className="rw-thumb-video-box">
                                <video src={res.fileUrl} preload="metadata" />
                                <span className="rw-video-pill">
                                  <Video size={10} />
                                </span>
                              </div>
                            ) : (
                              <img src={res.fileUrl} alt={res.title} loading="lazy" />
                            )}
                            <span className="rw-thumb-caption">{res.title || res.fileName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Assigned Contributors Card */}
                <div className="rw-overview-right">
                  <div className="rw-panel">
                    <div className="rw-panel-heading space-between">
                      <h3>Team Contributors</h3>
                      <button
                        type="button"
                        className="rw-link-btn"
                        onClick={() => setIsContributorsModalOpen(true)}
                      >
                        View All
                      </button>
                    </div>

                    <div className="rw-contributors-compact-list">
                      {contributors.length > 0 ? (
                        contributors.map((contrib) => {
                          const u = contrib.user || {};
                          return (
                            <div key={contrib._id || u._id} className="rw-contrib-compact-item">
                              <div className="rw-contrib-avatar">
                                {u.avatar ? (
                                  <img src={u.avatar} alt={u.name} />
                                ) : (
                                  <span>{initials(u.name || u.username)}</span>
                                )}
                              </div>
                              <div className="rw-contrib-info">
                                <span className="rw-contrib-name">{u.name || 'Member'}</span>
                                <span className="rw-contrib-meta">
                                  @{u.username} · {titleCase(contrib.projectRole || 'member')}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rw-empty-inline">
                          <Users size={18} />
                          <p>No active contributors currently assigned to this role.</p>
                        </div>
                      )}

                      {pendingInvitations.length > 0 && (
                        <div className="rw-pending-summary-chip">
                          <Clock size={12} />
                          <span>
                            {pendingInvitations.length} pending invitation
                            {pendingInvitations.length === 1 ? '' : 's'} awaiting acceptance
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: GALLERY ─────────────────────────────────────────── */}
            {activeTab === 'Gallery' && (
              <div className="rw-gallery-section">
                {/* Gallery Toolbar */}
                <div className="rw-toolbar">
                  <div className="rw-toolbar-left">
                    <h2 className="rw-section-heading">Media Gallery</h2>
                    <span className="rw-badge-counter">
                      {resources.length} {resources.length === 1 ? 'asset' : 'assets'}
                    </span>
                  </div>

                  <div className="rw-toolbar-right">
                    {/* Search Field */}
                    {resources.length > 0 && (
                      <div className="rw-search-input-wrap">
                        <Search size={14} className="rw-search-icon" />
                        <input
                          type="text"
                          value={mediaSearchQuery}
                          onChange={(e) => setMediaSearchQuery(e.target.value)}
                          placeholder="Search media by title or tags..."
                          className="rw-search-input"
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      className="rw-btn-primary"
                      onClick={() => setIsMediaUploadOpen(true)}
                    >
                      <Plus size={15} />
                      <span>Upload Media</span>
                    </button>
                  </div>
                </div>

                {/* Gallery Media Grid */}
                {filteredResources.length > 0 ? (
                  <div className="rw-media-grid">
                    {filteredResources.map((res) => {
                      const isVid =
                        res.resourceType === 'video' ||
                        Boolean(res.fileUrl && res.fileUrl.match(/\.(mp4|webm|mov)$/i));
                      const uploader = res.uploadedBy || {};
                      const canDelete = canDeleteItem(res);
                      const formattedDate = res.createdAt
                        ? new Date(res.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '';

                      return (
                        <article key={res._id} className="rw-media-card">
                          <div
                            className="rw-media-preview-box"
                            onClick={() => setActiveLightboxItem(res)}
                            role="button"
                            tabIndex={0}
                          >
                            {isVid ? (
                              <div className="rw-media-video-wrapper">
                                <video src={res.fileUrl} preload="metadata" />
                                <div className="rw-video-pill-badge">
                                  <Video size={12} />
                                  <span>Video</span>
                                </div>
                              </div>
                            ) : (
                              <img
                                src={res.fileUrl}
                                alt={res.title || res.fileName}
                                loading="lazy"
                              />
                            )}

                            <div className="rw-media-card-hover-overlay">
                              <span className="rw-overlay-zoom-pill">
                                <Maximize2 size={13} />
                                <span>Preview</span>
                              </span>
                            </div>
                          </div>

                          <div className="rw-media-card-info">
                            <div className="rw-media-card-title-row">
                              <h4 className="rw-media-card-title" title={res.title || res.fileName}>
                                {res.title || res.fileName || 'Untitled Asset'}
                              </h4>
                              <div className="rw-media-card-quick-actions">
                                <a
                                  href={res.fileUrl}
                                  download={res.fileName || res.title}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rw-card-icon-action"
                                  title="Download asset"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Download size={13} />
                                </a>

                                {canDelete && (
                                  <button
                                    type="button"
                                    className="rw-card-icon-action rw-action-danger"
                                    title="Delete asset"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDelete({ type: 'resource', item: res });
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {res.description && (
                              <p className="rw-media-card-desc">{res.description}</p>
                            )}

                            {/* Tags Chips */}
                            {res.tags && res.tags.length > 0 && (
                              <div className="rw-card-tags">
                                {res.tags.slice(0, 3).map((tag, idx) => (
                                  <span key={idx} className="rw-card-tag-pill">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Footer: Uploader & Date */}
                            <div className="rw-media-card-footer">
                              <div className="rw-uploader-badge">
                                {uploader.avatar ? (
                                  <img src={uploader.avatar} alt="" className="rw-avatar-mini" />
                                ) : (
                                  <span className="rw-avatar-mini rw-avatar-fallback">
                                    {initials(uploader.name || uploader.username)}
                                  </span>
                                )}
                                <span className="rw-uploader-name">
                                  {uploader.name || `@${uploader.username}` || 'Member'}
                                </span>
                              </div>
                              <span className="rw-card-date">{formattedDate}</span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : resources.length > 0 ? (
                  <div className="rw-empty-state">
                    <p>No media files matched your search "{mediaSearchQuery}".</p>
                    <button
                      type="button"
                      className="rw-btn-secondary"
                      onClick={() => setMediaSearchQuery('')}
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  <div className="rw-empty-state">
                    <div className="rw-empty-icon-box">
                      <LayoutGrid size={32} />
                    </div>
                    <h3>No media assets yet</h3>
                    <p>
                      Upload UI mocks, diagrams, API screenshots, or video walkthroughs for {activeRole.name || 'this role'}.
                    </p>
                    <button
                      type="button"
                      className="rw-btn-primary"
                      onClick={() => setIsMediaUploadOpen(true)}
                    >
                      <Plus size={15} />
                      <span>Upload First Media Asset</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 3: DOCUMENTS ──────────────────────────────────────── */}
            {activeTab === 'Documents' && (
              <div className="rw-documents-section">
                {/* Documents Toolbar */}
                <div className="rw-toolbar">
                  <div className="rw-toolbar-left">
                    <h2 className="rw-section-heading">Project Documents</h2>
                    <span className="rw-badge-counter">
                      {documents.length} {documents.length === 1 ? 'doc' : 'docs'}
                    </span>
                  </div>

                  <div className="rw-toolbar-right">
                    {/* Search Field */}
                    {documents.length > 0 && (
                      <div className="rw-search-input-wrap">
                        <Search size={14} className="rw-search-icon" />
                        <input
                          type="text"
                          value={docSearchQuery}
                          onChange={(e) => setDocSearchQuery(e.target.value)}
                          placeholder="Search documents by title, format, or tags..."
                          className="rw-search-input"
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      className="rw-btn-primary"
                      onClick={() => setIsDocUploadOpen(true)}
                    >
                      <Plus size={15} />
                      <span>Upload Document</span>
                    </button>
                  </div>
                </div>

                {/* Documents Grid / Cards */}
                {filteredDocuments.length > 0 ? (
                  <div className="rw-docs-grid">
                    {filteredDocuments.map((doc) => {
                      const fmt = (doc.format || 'doc').toLowerCase();
                      const uploader = doc.uploadedBy || {};
                      const canDelete = canDeleteItem(doc);
                      const formattedDate = doc.createdAt
                        ? new Date(doc.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '';

                      return (
                        <article key={doc._id} className="rw-doc-card">
                          <div className="rw-doc-card-top">
                            <span className={`rw-doc-format-badge badge-${fmt}`}>
                              {fmt.toUpperCase()}
                            </span>
                            <div className="rw-doc-card-actions">
                              <button
                                type="button"
                                className="rw-btn-view-doc"
                                onClick={() => setActiveViewingDoc(doc)}
                                title="Open interactive viewer"
                              >
                                <Eye size={13} />
                                <span>View</span>
                              </button>

                              {doc.fileUrl && (
                                <a
                                  href={doc.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  download={doc.fileName || `${doc.title}.${fmt}`}
                                  className="rw-card-icon-action"
                                  title="Download file"
                                >
                                  <Download size={13} />
                                </a>
                              )}

                              {canDelete && (
                                <button
                                  type="button"
                                  className="rw-card-icon-action rw-action-danger"
                                  title="Delete document"
                                  onClick={() =>
                                    setConfirmDelete({ type: 'document', item: doc })
                                  }
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>

                          <div
                            className="rw-doc-card-body"
                            onClick={() => setActiveViewingDoc(doc)}
                            role="button"
                            tabIndex={0}
                          >
                            <h4 className="rw-doc-card-title">{doc.title}</h4>
                            {doc.description && (
                              <p className="rw-doc-card-desc">{doc.description}</p>
                            )}
                          </div>

                          {/* Tags Chips */}
                          {doc.tags && doc.tags.length > 0 && (
                            <div className="rw-card-tags">
                              {doc.tags.slice(0, 3).map((tag, idx) => (
                                <span key={idx} className="rw-card-tag-pill">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Footer */}
                          <div className="rw-doc-card-footer">
                            <div className="rw-uploader-badge">
                              {uploader.avatar ? (
                                <img src={uploader.avatar} alt="" className="rw-avatar-mini" />
                              ) : (
                                <span className="rw-avatar-mini rw-avatar-fallback">
                                  {initials(uploader.name || uploader.username)}
                                </span>
                              )}
                              <span className="rw-uploader-name">
                                {uploader.name || `@${uploader.username}` || 'Member'}
                              </span>
                            </div>
                            <div className="rw-doc-meta-right">
                              {doc.fileSize ? (
                                <span className="rw-doc-filesize">{formatBytes(doc.fileSize)}</span>
                              ) : null}
                              <span className="rw-card-date">{formattedDate}</span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : documents.length > 0 ? (
                  <div className="rw-empty-state">
                    <p>No documents matched your search "{docSearchQuery}".</p>
                    <button
                      type="button"
                      className="rw-btn-secondary"
                      onClick={() => setDocSearchQuery('')}
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  <div className="rw-empty-state">
                    <div className="rw-empty-icon-box">
                      <FileText size={32} />
                    </div>
                    <h3>No documents yet</h3>
                    <p>
                      Upload specifications, PRDs, architectural guides, or markdown notes for {activeRole.name || 'this role'}.
                    </p>
                    <button
                      type="button"
                      className="rw-btn-primary"
                      onClick={() => setIsDocUploadOpen(true)}
                    >
                      <Plus size={15} />
                      <span>Upload First Document</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}

      {/* Media Upload Modal */}
      <MediaUploadModal
        isOpen={isMediaUploadOpen}
        onClose={() => setIsMediaUploadOpen(false)}
        projectId={projectId}
        role={role}
        onUploaded={handleMediaUploaded}
      />

      {/* Document Upload Modal */}
      <DocumentUploadModal
        isOpen={isDocUploadOpen}
        onClose={() => setIsDocUploadOpen(false)}
        projectId={projectId}
        role={role}
        onUploaded={handleDocumentUploaded}
      />

      {/* Document Interactive Viewer Modal */}
      <DocumentViewerModal
        doc={activeViewingDoc}
        isOpen={Boolean(activeViewingDoc)}
        onClose={() => setActiveViewingDoc(null)}
        canDelete={activeViewingDoc ? canDeleteItem(activeViewingDoc) : false}
        onDelete={(docToDelete) => {
          setConfirmDelete({ type: 'document', item: docToDelete });
        }}
      />

      {/* Fullscreen Lightbox for Media */}
      {activeLightboxItem && currentLightboxRef && (
        <FullscreenLightbox
          reference={currentLightboxRef}
          allCategoryReferences={lightboxReferences}
          onClose={() => setActiveLightboxItem(null)}
          onSelectReference={(ref) => {
            const found = resources.find((r) => r._id === ref.id);
            if (found) setActiveLightboxItem(found);
          }}
          onDelete={
            canDeleteItem(activeLightboxItem)
              ? (id) => {
                  const found = resources.find((r) => r._id === id);
                  if (found) setConfirmDelete({ type: 'resource', item: found });
                }
              : null
          }
        />
      )}

      {/* Contributor List Modal */}
      <RoleContributorsModal
        isOpen={isContributorsModalOpen}
        onClose={() => setIsContributorsModalOpen(false)}
        role={role}
        projectName={project.name}
      />

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          className="rw-modal-overlay"
          onClick={() => !deleting && setConfirmDelete(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="rw-modal-card rw-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="rw-confirm-header">
              <div className="rw-confirm-icon-wrap">
                <Trash2 size={20} />
              </div>
              <h3>Delete {confirmDelete.type === 'resource' ? 'Media Asset' : 'Document'}?</h3>
            </div>
            <p className="rw-confirm-text">
              Are you sure you want to permanently remove "
              <b>{confirmDelete.item.title || confirmDelete.item.fileName}</b>"?
              This action cannot be undone and will delete the file from Cloudinary and the project library.
            </p>
            <div className="rw-modal-footer">
              <button
                type="button"
                className="rw-btn-secondary"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rw-btn-danger"
                onClick={handleDeleteConfirmed}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 size={14} className="spin-animation" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Permanently</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
