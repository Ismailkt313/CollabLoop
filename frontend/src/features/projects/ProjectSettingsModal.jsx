import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Settings,
  Users,
  Briefcase,
  Mail,
  Shield,
  Archive,
  Trash2,
  Search,
  Check,
  AlertCircle,
  RefreshCw,
  Plus,
  ChevronDown,
  UserCheck,
  UserX,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Layers,
} from 'lucide-react';
import ProjectThumbnailUpload from './ProjectThumbnailUpload';
import ContributorSearchInput from './ContributorSearchInput';
import RoleDropdown from './RoleDropdown';
import CreateRoleModal from './CreateRoleModal';
import './ProjectSettings.css';

const api = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
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

const CATEGORY_OPTIONS = [
  'General',
  'Web Application',
  'Mobile App',
  'AI / Machine Learning',
  'E-Commerce',
  'API & Backend Services',
  'Design System & UI',
  'DevOps & Infrastructure',
  'Enterprise Software',
];

export default function ProjectSettingsModal({
  isOpen,
  onClose,
  project,
  user,
  membership,
  onProjectUpdated,
  onProjectDeleted,
  onRefreshWorkspaces,
}) {
  const [activeTab, setActiveTab] = useState('general');
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message }

  const projectId = project?._id || project?.id;
  const isOwner = membership?.projectRole === 'owner';
  const isAdmin = membership?.projectRole === 'admin';
  const isManager = isOwner || isAdmin;

  // ── Tab 1: General State ──────────────────────────────────────────────────
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [category, setCategory] = useState(project?.category || 'General');
  const [thumbnail, setThumbnail] = useState(project?.thumbnail || '');
  const [thumbnailPublicId, setThumbnailPublicId] = useState(project?.thumbnailPublicId || '');
  const [savingGeneral, setSavingGeneral] = useState(false);

  // ── Tab 2: Members State ──────────────────────────────────────────────────
  const [members, setMembers] = useState([]);
  const [_loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [roleChangeModalMember, setRoleChangeModalMember] = useState(null);
  const [permChangeModalMember, setPermChangeModalMember] = useState(null);
  const [targetPermRole, setTargetPermRole] = useState('member');
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);

  // ── Tab 3: Roles State ────────────────────────────────────────────────────
  const [configuredRoles, setConfiguredRoles] = useState([]);
  const [globalRoles, setGlobalRoles] = useState([]);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [roleSearchQuery, setRoleSearchQuery] = useState('');

  // ── Tab 4: Invitations State ──────────────────────────────────────────────
  const [invitations, setInvitations] = useState([]);
  const [_loadingInvitations, setLoadingInvitations] = useState(false);
  const [invitationFilter, setInvitationFilter] = useState('all'); // 'all' | 'pending' | 'accepted' | 'rejected'
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [newInviteUser, setNewInviteUser] = useState(null);
  const [newInviteRoleId, setNewInviteRoleId] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);

  // ── Tab 6: Lifecycle State ────────────────────────────────────────────────
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [unarchiveModalOpen, setUnarchiveModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deletingProject, setDeletingProject] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Sync project info when project prop updates
  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDescription(project.description || '');
      setCategory(project.category || 'General');
      setThumbnail(project.thumbnail || '');
      setThumbnailPublicId(project.thumbnailPublicId || '');
    }
  }, [project]);

  // Load Global Contributor Roles
  const loadGlobalRoles = useCallback(async () => {
    try {
      const data = await api('/roles');
      setGlobalRoles(data.roles || []);
    } catch (err) {
      console.warn('Could not load global roles:', err);
    }
  }, []);

  // Load Members
  const loadMembers = useCallback(async () => {
    if (!projectId) return;
    setLoadingMembers(true);
    try {
      const data = await api(`/projects/${projectId}/members`);
      setMembers(data.members || []);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to load project members' });
    } finally {
      setLoadingMembers(false);
    }
  }, [projectId]);

  // Load Workspaces for Contributor Roles Tab
  const loadWorkspaces = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await api(`/projects/${projectId}/workspaces`);
      setConfiguredRoles(data.roles || []);
    } catch (err) {
      console.warn('Could not load workspace roles:', err);
    }
  }, [projectId]);

  // Load Invitations
  const loadInvitations = useCallback(async () => {
    if (!projectId) return;
    setLoadingInvitations(true);
    try {
      const data = await api(`/projects/${projectId}/invitations`);
      setInvitations(data.invitations || []);
    } catch (err) {
      console.warn('Could not load invitations:', err);
    } finally {
      setLoadingInvitations(false);
    }
  }, [projectId]);

  // Load data based on active tab
  useEffect(() => {
    if (!isOpen) return;
    loadGlobalRoles();
    if (activeTab === 'members') loadMembers();
    if (activeTab === 'roles') {
      loadWorkspaces();
      loadMembers();
    }
    if (activeTab === 'invitations') loadInvitations();
  }, [isOpen, activeTab, loadGlobalRoles, loadMembers, loadWorkspaces, loadInvitations]);

  // ── Handlers: Tab 1 General ───────────────────────────────────────────────
  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setToast({ type: 'error', message: 'Project name is required' });
      return;
    }
    setSavingGeneral(true);
    try {
      const data = await api(`/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          category,
          thumbnail,
          thumbnailPublicId,
        }),
      });
      setToast({ type: 'success', message: 'Project information updated successfully!' });
      onProjectUpdated?.(data.project);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to save project settings' });
    } finally {
      setSavingGeneral(false);
    }
  };

  // ── Handlers: Tab 2 Team Members ──────────────────────────────────────────
  const handleUpdatePermission = async (memberId, newRole) => {
    try {
      await api(`/projects/${projectId}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ projectRole: newRole }),
      });
      setToast({ type: 'success', message: `Permission updated to ${newRole}` });
      setPermChangeModalMember(null);
      setTransferConfirmOpen(false);
      loadMembers();
      onRefreshWorkspaces?.();
      // If ownership was transferred, update parent project data
      if (newRole === 'owner') {
        const updatedProj = await api(`/projects/${projectId}`);
        onProjectUpdated?.(updatedProj.project);
      }
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to update permission' });
    }
  };

  const handleUpdateContributorRole = async (memberId, roleId) => {
    try {
      await api(`/projects/${projectId}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ contributorRoleId: roleId }),
      });
      setToast({ type: 'success', message: 'Contributor role updated successfully!' });
      setRoleChangeModalMember(null);
      loadMembers();
      loadWorkspaces();
      onRefreshWorkspaces?.();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to change contributor role' });
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      await api(`/projects/${projectId}/members/${memberToRemove._id}`, {
        method: 'DELETE',
      });
      setToast({ type: 'success', message: `${memberToRemove.userId?.name || 'Member'} was removed from the project.` });
      setMemberToRemove(null);
      loadMembers();
      loadWorkspaces();
      onRefreshWorkspaces?.();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to remove member' });
    }
  };

  // ── Handlers: Tab 4 Invitations ───────────────────────────────────────────
  const handleSendInvitation = async (e) => {
    e.preventDefault();
    if (!newInviteUser) {
      setToast({ type: 'error', message: 'Please select a registered user to invite' });
      return;
    }
    if (!newInviteRoleId) {
      setToast({ type: 'error', message: 'Please select a contributor role' });
      return;
    }
    setSendingInvite(true);
    try {
      await api(`/projects/${projectId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({
          userId: newInviteUser._id,
          contributorRoleId: newInviteRoleId,
        }),
      });
      setToast({ type: 'success', message: `Invitation sent to @${newInviteUser.username}` });
      setInviteModalOpen(false);
      setNewInviteUser(null);
      setNewInviteRoleId('');
      loadInvitations();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to send invitation' });
    } finally {
      setSendingInvite(false);
    }
  };

  const handleCancelInvitation = async (invId) => {
    try {
      await api(`/projects/${projectId}/invitations/${invId}`, {
        method: 'DELETE',
      });
      setToast({ type: 'success', message: 'Invitation cancelled.' });
      loadInvitations();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to cancel invitation' });
    }
  };

  const handleResendInvitation = async (invId) => {
    try {
      await api(`/projects/${projectId}/invitations/${invId}/resend`, {
        method: 'POST',
      });
      setToast({ type: 'success', message: 'Invitation resent successfully.' });
      loadInvitations();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to resend invitation' });
    }
  };

  // ── Handlers: Tab 6 Project Lifecycle ─────────────────────────────────────
  const handleArchiveProject = async () => {
    try {
      const data = await api(`/projects/${projectId}/archive`, { method: 'POST' });
      setToast({ type: 'success', message: 'Project archived successfully.' });
      setArchiveModalOpen(false);
      onProjectUpdated?.(data.project);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to archive project' });
    }
  };

  const handleUnarchiveProject = async () => {
    try {
      const data = await api(`/projects/${projectId}/unarchive`, { method: 'POST' });
      setToast({ type: 'success', message: 'Project restored to active state.' });
      setUnarchiveModalOpen(false);
      onProjectUpdated?.(data.project);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to restore project' });
    }
  };

  const handleDeleteProject = async (e) => {
    e.preventDefault();
    if (deleteConfirmInput !== project.name) {
      setToast({ type: 'error', message: 'Project name does not match confirmation.' });
      return;
    }
    setDeletingProject(true);
    try {
      await api(`/projects/${projectId}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmName: deleteConfirmInput }),
      });
      setDeleteModalOpen(false);
      onClose();
      onProjectDeleted?.();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to delete project' });
      setDeletingProject(false);
    }
  };

  // Filtered members list
  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const u = m.userId || {};
      const roleName = m.contributorRoleId?.name || m.teamFunction || '';
      return (
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        roleName.toLowerCase().includes(q)
      );
    });
  }, [members, memberSearch]);

  // Filtered invitations list
  const filteredInvitations = useMemo(() => {
    if (invitationFilter === 'all') return invitations;
    return invitations.filter((inv) => inv.status === invitationFilter);
  }, [invitations, invitationFilter]);

  // Filtered roles list
  const filteredRoles = useMemo(() => {
    const q = roleSearchQuery.trim().toLowerCase();
    if (!q) return configuredRoles;
    return configuredRoles.filter((r) => r.name.toLowerCase().includes(q));
  }, [configuredRoles, roleSearchQuery]);

  if (!isOpen) return null;

  return (
    <div className="ps-overlay" role="dialog" aria-modal="true">
      <div className="ps-modal-shell">
        {/* Modal Top Bar */}
        <header className="ps-topbar">
          <div className="ps-topbar-title">
            <span className="ps-topbar-icon">
              <Settings size={18} />
            </span>
            <div>
              <h2>Project Settings</h2>
              <p>{project?.name} · Configuration & Management</p>
            </div>
          </div>

          <button
            type="button"
            className="ps-close-btn"
            onClick={onClose}
            aria-label="Close project settings"
          >
            <X size={18} />
          </button>
        </header>

        {/* Toast Alert */}
        {toast && (
          <div className={`ps-toast ps-toast-${toast.type}`}>
            {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Modal Body: Sidebar + Main Content */}
        <div className="ps-body">
          {/* Sidebar Navigation */}
          <nav className="ps-sidebar" aria-label="Settings sections">
            {[
              { id: 'general', label: 'General', icon: Settings },
              { id: 'members', label: 'Team Members', icon: Users, badge: members.length },
              { id: 'roles', label: 'Contributor Roles', icon: Briefcase, badge: configuredRoles.length },
              { id: 'invitations', label: 'Invitations', icon: Mail, badge: invitations.filter((i) => i.status === 'pending').length },
              { id: 'permissions', label: 'Permissions', icon: Shield },
              { id: 'lifecycle', label: 'Project Lifecycle', icon: Archive, danger: true },
            ].map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`ps-nav-item ${isActive ? 'is-active' : ''} ${tab.danger ? 'is-danger-tab' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <TabIcon size={16} />
                  <span className="ps-nav-label">{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="ps-nav-badge">{tab.badge}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Main Settings Content Area */}
          <main className="ps-main-viewport">
            {/* ── 1. General Settings ─────────────────────────────────────── */}
            {activeTab === 'general' && (
              <form onSubmit={handleSaveGeneral} className="ps-section-pane">
                <div className="ps-pane-header">
                  <h3>General Project Details</h3>
                  <p>Update your project title, category, description, and visual identity badge.</p>
                </div>

                <div className="ps-form-group">
                  <label htmlFor="ps-proj-name" className="ps-form-label">
                    Project Name <span className="ps-required">*</span>
                  </label>
                  <input
                    id="ps-proj-name"
                    type="text"
                    className="ps-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    required
                    disabled={!isManager}
                  />
                </div>

                <div className="ps-form-group">
                  <label htmlFor="ps-proj-cat" className="ps-form-label">
                    Category
                  </label>
                  <select
                    id="ps-proj-cat"
                    className="ps-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={!isManager}
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="ps-form-group">
                  <label htmlFor="ps-proj-desc" className="ps-form-label">
                    Project Description
                  </label>
                  <textarea
                    id="ps-proj-desc"
                    className="ps-textarea"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the goals, tech stack, and deliverable scope of this project..."
                    disabled={!isManager}
                  />
                </div>

                <div className="ps-form-group">
                  <label className="ps-form-label">Project Thumbnail / Brand Mark</label>
                  <p className="ps-form-hint">
                    PNG, JPG, or WebP up to 8MB. Hosted securely on Cloudinary.
                  </p>
                  <ProjectThumbnailUpload
                    value={thumbnail}
                    onChange={(url, pId) => {
                      setThumbnail(url);
                      setThumbnailPublicId(pId || '');
                    }}
                    onError={(msg) => setToast({ type: 'error', message: msg })}
                    disabled={!isManager}
                  />
                </div>

                {isManager && (
                  <div className="ps-form-actions">
                    <button
                      type="submit"
                      className="dashboard-button primary"
                      disabled={savingGeneral}
                    >
                      {savingGeneral ? (
                        <>
                          <RefreshCw size={14} className="spin-animation" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <span>Save Changes</span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="dashboard-button secondary"
                      onClick={() => {
                        setName(project?.name || '');
                        setDescription(project?.description || '');
                        setCategory(project?.category || 'General');
                        setThumbnail(project?.thumbnail || '');
                      }}
                      disabled={savingGeneral}
                    >
                      Reset
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* ── 2. Team Members Settings ────────────────────────────────── */}
            {activeTab === 'members' && (
              <div className="ps-section-pane">
                <div className="ps-pane-header ps-pane-header-actions">
                  <div>
                    <h3>Team Members ({members.length})</h3>
                    <p>Manage project permission roles and contributor functions for active team members.</p>
                  </div>
                  <button
                    type="button"
                    className="dashboard-button secondary btn-compact"
                    onClick={() => {
                      setActiveTab('invitations');
                      setInviteModalOpen(true);
                    }}
                  >
                    <Plus size={14} />
                    <span>Invite Contributor</span>
                  </button>
                </div>

                {/* Member Search Filter */}
                <div className="ps-search-box">
                  <Search size={15} className="ps-search-icon" />
                  <input
                    type="text"
                    className="ps-search-input"
                    placeholder="Filter by name, username, email, or role..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                  />
                  {memberSearch && (
                    <button
                      type="button"
                      className="ps-search-clear"
                      onClick={() => setMemberSearch('')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Members List Table / Cards */}
                <div className="ps-table-container">
                  <table className="ps-table">
                    <thead>
                      <tr>
                        <th>Contributor</th>
                        <th>Project Permission</th>
                        <th>Contributor Function</th>
                        <th>Joined</th>
                        {isManager && <th className="ps-text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map((m) => {
                        const u = m.userId || {};
                        const isThisMemberOwner = m.projectRole === 'owner';
                        const isThisMemberAdmin = m.projectRole === 'admin';
                        const isMe = String(u._id || u.id) === String(user?._id || user?.id);

                        return (
                          <tr key={m._id}>
                            <td>
                              <div className="ps-user-cell">
                                <div className="ps-user-avatar">
                                  {u.avatar ? (
                                    <img src={u.avatar} alt="" />
                                  ) : (
                                    <span>{initials(u.name || u.username)}</span>
                                  )}
                                </div>
                                <div className="ps-user-meta">
                                  <span className="ps-user-name">
                                    {u.name || 'Anonymous User'} {isMe && <span className="ps-me-tag">(You)</span>}
                                  </span>
                                  <span className="ps-user-handle">@{u.username}</span>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span className={`ps-perm-badge ${m.projectRole}`}>
                                {isThisMemberOwner && <Shield size={11} />}
                                <span>{m.projectRole === 'owner' ? 'Owner' : m.projectRole === 'admin' ? 'Admin' : 'Member'}</span>
                              </span>
                            </td>

                            <td>
                              <span className="ps-role-chip">
                                {m.contributorRoleId?.imageUrl && (
                                  <img src={m.contributorRoleId.imageUrl} alt="" className="ps-role-chip-img" />
                                )}
                                <span>{m.contributorRoleId?.name || m.teamFunction || 'Contributor'}</span>
                              </span>
                            </td>

                            <td className="ps-text-muted">
                              {new Date(m.joinedAt || m.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </td>

                            {isManager && (
                              <td className="ps-text-right">
                                <div className="ps-action-btn-group">
                                  {/* Change Role Button */}
                                  <button
                                    type="button"
                                    className="ps-inline-btn"
                                    onClick={() => setRoleChangeModalMember(m)}
                                    title="Change contributor role"
                                  >
                                    <span>Role</span>
                                  </button>

                                  {/* Change Permission Button (Owner Only) */}
                                  {isOwner && !isMe && (
                                    <button
                                      type="button"
                                      className="ps-inline-btn"
                                      onClick={() => {
                                        setPermChangeModalMember(m);
                                        setTargetPermRole(m.projectRole);
                                      }}
                                      title="Change project permissions"
                                    >
                                      <span>Permission</span>
                                    </button>
                                  )}

                                  {/* Remove Member Button */}
                                  {!isThisMemberOwner && (!isThisMemberAdmin || isOwner) && !isMe && (
                                    <button
                                      type="button"
                                      className="ps-inline-btn ps-btn-danger"
                                      onClick={() => setMemberToRemove(m)}
                                      title="Remove from project"
                                    >
                                      <UserX size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredMembers.length === 0 && (
                    <div className="ps-empty-pane">
                      <p>No project members match "{memberSearch}".</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── 3. Contributor Roles Settings ───────────────────────────── */}
            {activeTab === 'roles' && (
              <div className="ps-section-pane">
                <div className="ps-pane-header ps-pane-header-actions">
                  <div>
                    <h3>Configured Roles ({configuredRoles.length})</h3>
                    <p>
                      Roles actively assigned to team members and invitations in this project.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="dashboard-button secondary btn-compact"
                    onClick={() => setCreateRoleOpen(true)}
                  >
                    <Plus size={14} />
                    <span>Create Platform Role</span>
                  </button>
                </div>

                <div className="ps-search-box">
                  <Search size={15} className="ps-search-icon" />
                  <input
                    type="text"
                    className="ps-search-input"
                    placeholder="Search configured roles..."
                    value={roleSearchQuery}
                    onChange={(e) => setRoleSearchQuery(e.target.value)}
                  />
                </div>

                <div className="ps-roles-grid">
                  {filteredRoles.map((role) => (
                    <div key={role._id} className="ps-role-card">
                      <div className="ps-role-card-header">
                        <div className="ps-role-avatar-wrap">
                          {role.imageUrl ? (
                            <img src={role.imageUrl} alt="" className="ps-role-avatar-img" />
                          ) : (
                            <Briefcase size={20} className="ps-role-avatar-fallback" />
                          )}
                        </div>
                        <div className="ps-role-meta">
                          <h4 className="ps-role-name">{role.name}</h4>
                          <span className="ps-role-counts">
                            <b>{role.activeCount || 0}</b> active · <b>{role.pendingCount || 0}</b> pending
                          </span>
                        </div>
                      </div>

                      <p className="ps-role-desc">
                        {role.description || `Specialized workspace deliverables for ${role.name}.`}
                      </p>

                      <div className="ps-role-assigned-users">
                        <span className="ps-assigned-label">Assigned:</span>
                        <div className="ps-avatar-stack">
                          {role.contributors?.slice(0, 5).map((c, i) => (
                            <span
                              key={c._id || i}
                              className="ps-stack-avatar"
                              title={c.user?.name || `@${c.user?.username}`}
                            >
                              {c.user?.avatar ? (
                                <img src={c.user.avatar} alt="" />
                              ) : (
                                <span>{initials(c.user?.name || c.user?.username)}</span>
                              )}
                            </span>
                          ))}
                          {role.contributors?.length === 0 && (
                            <span className="ps-no-contributors">No active members</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredRoles.length === 0 && (
                    <div className="ps-empty-pane">
                      <p>No project roles match "{roleSearchQuery}".</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── 4. Invitations Settings ─────────────────────────────────── */}
            {activeTab === 'invitations' && (
              <div className="ps-section-pane">
                <div className="ps-pane-header ps-pane-header-actions">
                  <div>
                    <h3>Project Invitations</h3>
                    <p>Track sent invitations and invite new team members to this project.</p>
                  </div>
                  {isManager && (
                    <button
                      type="button"
                      className="dashboard-button primary btn-compact"
                      onClick={() => setInviteModalOpen(true)}
                    >
                      <Plus size={14} />
                      <span>+ Invite Contributor</span>
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="ps-filter-pills">
                  {[
                    { id: 'all', label: 'All Invitations' },
                    { id: 'pending', label: 'Pending' },
                    { id: 'accepted', label: 'Accepted' },
                    { id: 'rejected', label: 'Rejected' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`ps-filter-pill ${invitationFilter === f.id ? 'is-active' : ''}`}
                      onClick={() => setInvitationFilter(f.id)}
                    >
                      <span>{f.label}</span>
                    </button>
                  ))}
                </div>

                {/* Invitations Table */}
                <div className="ps-table-container">
                  <table className="ps-table">
                    <thead>
                      <tr>
                        <th>Invited User</th>
                        <th>Assigned Role</th>
                        <th>Invited By</th>
                        <th>Date Sent</th>
                        <th>Status</th>
                        {isManager && <th className="ps-text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvitations.map((inv) => {
                        const u = inv.invitedUser || {};
                        const sender = inv.invitedBy || {};
                        const isPending = inv.status === 'pending';

                        return (
                          <tr key={inv._id}>
                            <td>
                              <div className="ps-user-cell">
                                <div className="ps-user-avatar">
                                  {u.avatar ? (
                                    <img src={u.avatar} alt="" />
                                  ) : (
                                    <span>{initials(u.name || u.username)}</span>
                                  )}
                                </div>
                                <div className="ps-user-meta">
                                  <span className="ps-user-name">{u.name || 'User'}</span>
                                  <span className="ps-user-handle">@{u.username}</span>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span className="ps-role-chip">
                                {inv.contributorRoleId?.imageUrl && (
                                  <img src={inv.contributorRoleId.imageUrl} alt="" className="ps-role-chip-img" />
                                )}
                                <span>{inv.contributorRoleId?.name || 'Contributor'}</span>
                              </span>
                            </td>

                            <td className="ps-text-muted">
                              @{sender.username || 'owner'}
                            </td>

                            <td className="ps-text-muted">
                              {new Date(inv.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </td>

                            <td>
                              <span className={`ps-status-badge ${inv.status}`}>
                                {inv.status}
                              </span>
                            </td>

                            {isManager && (
                              <td className="ps-text-right">
                                {isPending ? (
                                  <div className="ps-action-btn-group">
                                    <button
                                      type="button"
                                      className="ps-inline-btn"
                                      onClick={() => handleResendInvitation(inv._id)}
                                      title="Resend invitation"
                                    >
                                      Resend
                                    </button>
                                    <button
                                      type="button"
                                      className="ps-inline-btn ps-btn-danger"
                                      onClick={() => handleCancelInvitation(inv._id)}
                                      title="Cancel invitation"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <span className="ps-text-muted">—</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredInvitations.length === 0 && (
                    <div className="ps-empty-pane">
                      <p>No invitations found under "{invitationFilter}".</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── 5. Permissions Settings ─────────────────────────────────── */}
            {activeTab === 'permissions' && (
              <div className="ps-section-pane">
                <div className="ps-pane-header">
                  <h3>Project Permission Hierarchy</h3>
                  <p>
                    CollabLoop separates global platform identity from project-specific permissions and specialized contributor functions.
                  </p>
                </div>

                <div className="ps-perm-hierarchy-card">
                  <div className="ps-hierarchy-level">
                    <span className="ps-level-badge">1. Platform User</span>
                    <p>Centralized authentication identity with unique username and email.</p>
                  </div>
                  <div className="ps-hierarchy-arrow">↓</div>
                  <div className="ps-hierarchy-level">
                    <span className="ps-level-badge">2. Project Permission</span>
                    <p>Owner, Admin, or Member controlling settings and administrative actions.</p>
                  </div>
                  <div className="ps-hierarchy-arrow">↓</div>
                  <div className="ps-hierarchy-level">
                    <span className="ps-level-badge">3. Contributor Function</span>
                    <p>Assigned functional role (e.g. Backend Developer, UI/UX Designer) generating dynamic workspaces.</p>
                  </div>
                </div>

                <div className="ps-perm-matrix">
                  <table className="ps-table">
                    <thead>
                      <tr>
                        <th>Capability</th>
                        <th className="ps-text-center">Owner</th>
                        <th className="ps-text-center">Admin</th>
                        <th className="ps-text-center">Member</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>View project & participate in discussions</td>
                        <td className="ps-text-center"><Check size={16} className="ps-check-ok" /></td>
                        <td className="ps-text-center"><Check size={16} className="ps-check-ok" /></td>
                        <td className="ps-text-center"><Check size={16} className="ps-check-ok" /></td>
                      </tr>
                      <tr>
                        <td>Upload role resources and documents</td>
                        <td className="ps-text-center"><Check size={16} className="ps-check-ok" /></td>
                        <td className="ps-text-center"><Check size={16} className="ps-check-ok" /></td>
                        <td className="ps-text-center"><Check size={16} className="ps-check-ok" /></td>
                      </tr>
                      <tr>
                        <td>Edit general project info (name, thumbnail)</td>
                        <td className="ps-text-center"><Check size={16} className="ps-check-ok" /></td>
                        <td className="ps-text-center"><Check size={16} className="ps-check-ok" /></td>
                        <td className="ps-text-center"><X size={16} className="ps-check-no" /></td>
                      </tr>
                      <tr>
                        <td>Manage channels (#general, custom channels)</td>
                        <td className="ps-text-center"><Check size={16} className="ps-check-ok" /></td>
                        <td className="ps-text-center"><Check size={16} className="ps-check-ok" /></td>
                        <td className="ps-text-center"><X size={16} className="ps-check-no" /></td>
                      </tr>
                      <tr>
                        <td>Invite contributors and change roles</td>
                        <td className="ps-text-center"><Check size={16} className="ps-check-ok" /></td>
                        <td className="ps-text-center"><Check size={16} className="ps-check-ok" /></td>
                        <td className="ps-text-center"><X size={16} className="ps-check-no" /></td>
                      </tr>
                      <tr>
                        <td>Promote / Demote Admins</td>
                        <td className="ps-text-center"><Check size={16} className="ps-check-ok" /></td>
                        <td className="ps-text-center"><X size={16} className="ps-check-no" /></td>
                        <td className="ps-text-center"><X size={16} className="ps-check-no" /></td>
                      </tr>
                      <tr>
                        <td>Transfer Project Ownership</td>
                        <td className="ps-text-center"><Check size={16} className="ps-check-ok" /></td>
                        <td className="ps-text-center"><X size={16} className="ps-check-no" /></td>
                        <td className="ps-text-center"><X size={16} className="ps-check-no" /></td>
                      </tr>
                      <tr>
                        <td>Archive or Permanently Delete Project</td>
                        <td className="ps-text-center"><Check size={16} className="ps-check-ok" /></td>
                        <td className="ps-text-center"><X size={16} className="ps-check-no" /></td>
                        <td className="ps-text-center"><X size={16} className="ps-check-no" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── 6. Project Lifecycle Settings ───────────────────────────── */}
            {activeTab === 'lifecycle' && (
              <div className="ps-section-pane">
                <div className="ps-pane-header">
                  <h3>Project Lifecycle Management</h3>
                  <p>Control archival and permanent deletion. These actions are restricted to the Project Owner.</p>
                </div>

                {/* Archive Panel */}
                <div className="ps-danger-card">
                  <div className="ps-danger-info">
                    <h4>Archive this project</h4>
                    <p>
                      Archiving hides the project from normal dashboard views and pauses active collaboration while safely preserving all historical messages, media assets, documents, and membership data in MongoDB.
                    </p>
                  </div>
                  <div>
                    {project?.isArchived ? (
                      <button
                        type="button"
                        className="dashboard-button secondary"
                        onClick={() => setUnarchiveModalOpen(true)}
                        disabled={!isOwner}
                      >
                        <RefreshCw size={14} />
                        <span>Restore Project</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="dashboard-button secondary"
                        onClick={() => setArchiveModalOpen(true)}
                        disabled={!isOwner}
                      >
                        <Archive size={14} />
                        <span>Archive Project</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Delete Panel */}
                <div className="ps-danger-card is-destructive">
                  <div className="ps-danger-info">
                    <h4>Permanently delete this project</h4>
                    <p>
                      Once deleted, all project memberships, channels, messages, role documents, and resources will be permanently erased. Global contributor roles and individual user accounts will not be affected.
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="dashboard-button danger"
                      onClick={() => {
                        setDeleteConfirmInput('');
                        setDeleteModalOpen(true);
                      }}
                      disabled={!isOwner}
                    >
                      <Trash2 size={14} />
                      <span>Delete Project</span>
                    </button>
                  </div>
                </div>

                {!isOwner && (
                  <div className="ps-notice-box">
                    <Shield size={16} />
                    <span>Only the Project Owner can archive or permanently delete this project.</span>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ── SUB-MODAL: Change Contributor Function / Role ──────────────────── */}
      {roleChangeModalMember && (
        <div className="ps-nested-overlay" role="dialog">
          <div className="ps-nested-modal">
            <div className="ps-nested-header">
              <h4>Change Contributor Role</h4>
              <button type="button" onClick={() => setRoleChangeModalMember(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="ps-nested-body">
              <p className="ps-nested-desc">
                Select a contributor role for <b>{roleChangeModalMember.userId?.name}</b> (@{roleChangeModalMember.userId?.username}). This will update their assigned dynamic workspace card.
              </p>
              <RoleDropdown
                roles={globalRoles}
                selectedRoleId={roleChangeModalMember.contributorRoleId?._id || roleChangeModalMember.contributorRoleId}
                onSelectRole={(r) => handleUpdateContributorRole(roleChangeModalMember._id, r._id)}
                onOpenCreateRole={() => setCreateRoleOpen(true)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-MODAL: Change Permission / Ownership Transfer ─────────────── */}
      {permChangeModalMember && (
        <div className="ps-nested-overlay" role="dialog">
          <div className="ps-nested-modal">
            <div className="ps-nested-header">
              <h4>Change Project Permission</h4>
              <button type="button" onClick={() => setPermChangeModalMember(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="ps-nested-body">
              <p className="ps-nested-desc">
                Update permissions for <b>{permChangeModalMember.userId?.name}</b> (@{permChangeModalMember.userId?.username}).
              </p>

              <div className="ps-radio-options">
                <label className={`ps-radio-option ${targetPermRole === 'member' ? 'is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="permRole"
                    value="member"
                    checked={targetPermRole === 'member'}
                    onChange={() => setTargetPermRole('member')}
                  />
                  <div>
                    <b>Member</b>
                    <p>Standard contributor access to role workspaces, media, and chat.</p>
                  </div>
                </label>

                <label className={`ps-radio-option ${targetPermRole === 'admin' ? 'is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="permRole"
                    value="admin"
                    checked={targetPermRole === 'admin'}
                    onChange={() => setTargetPermRole('admin')}
                  />
                  <div>
                    <b>Admin</b>
                    <p>Can invite members, manage channels, and edit general project details.</p>
                  </div>
                </label>

                <label className={`ps-radio-option is-owner-opt ${targetPermRole === 'owner' ? 'is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="permRole"
                    value="owner"
                    checked={targetPermRole === 'owner'}
                    onChange={() => setTargetPermRole('owner')}
                  />
                  <div>
                    <b>Transfer Ownership</b>
                    <p>Make this member the Project Owner. You will step down to Administrator.</p>
                  </div>
                </label>
              </div>

              <div className="ps-nested-actions">
                <button
                  type="button"
                  className="dashboard-button primary"
                  onClick={() => {
                    if (targetPermRole === 'owner') {
                      setTransferConfirmOpen(true);
                    } else {
                      handleUpdatePermission(permChangeModalMember._id, targetPermRole);
                    }
                  }}
                >
                  Save Permission
                </button>
                <button
                  type="button"
                  className="dashboard-button secondary"
                  onClick={() => setPermChangeModalMember(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-MODAL: Transfer Ownership Confirmation ─────────────────────── */}
      {transferConfirmOpen && (
        <div className="ps-nested-overlay" role="dialog">
          <div className="ps-nested-modal ps-modal-warning">
            <div className="ps-nested-header">
              <div className="ps-warn-title">
                <AlertTriangle size={20} className="ps-warn-icon" />
                <h4>Transfer Project Ownership?</h4>
              </div>
              <button type="button" onClick={() => setTransferConfirmOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="ps-nested-body">
              <p>
                Are you sure you want to transfer ownership of <b>{project?.name}</b> to <b>{permChangeModalMember?.userId?.name}</b>?
              </p>
              <p className="ps-text-muted">
                You will become an Administrator. Only the new owner will have permission to transfer ownership or delete this project.
              </p>
              <div className="ps-nested-actions">
                <button
                  type="button"
                  className="dashboard-button primary"
                  onClick={() => handleUpdatePermission(permChangeModalMember._id, 'owner')}
                >
                  Confirm Transfer
                </button>
                <button
                  type="button"
                  className="dashboard-button secondary"
                  onClick={() => setTransferConfirmOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-MODAL: Remove Member Confirmation ──────────────────────────── */}
      {memberToRemove && (
        <div className="ps-nested-overlay" role="dialog">
          <div className="ps-nested-modal ps-modal-warning">
            <div className="ps-nested-header">
              <div className="ps-warn-title">
                <UserX size={20} className="ps-danger-icon" />
                <h4>Remove Team Member</h4>
              </div>
              <button type="button" onClick={() => setMemberToRemove(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="ps-nested-body">
              <p>
                Remove <b>{memberToRemove.userId?.name}</b> (@{memberToRemove.userId?.username}) from <b>{project?.name}</b>?
              </p>
              <p className="ps-text-muted">
                Their active membership and real-time room access will be immediately revoked. Their historical discussions and media contributions will remain safely preserved in the project.
              </p>
              <div className="ps-nested-actions">
                <button
                  type="button"
                  className="dashboard-button danger"
                  onClick={handleRemoveMember}
                >
                  Remove Member
                </button>
                <button
                  type="button"
                  className="dashboard-button secondary"
                  onClick={() => setMemberToRemove(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-MODAL: Invite Contributor ──────────────────────────────────── */}
      {inviteModalOpen && (
        <div className="ps-nested-overlay" role="dialog">
          <div className="ps-nested-modal">
            <div className="ps-nested-header">
              <h4>Invite Contributor</h4>
              <button type="button" onClick={() => setInviteModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSendInvitation} className="ps-nested-body">
              <div className="ps-form-group">
                <label className="ps-form-label">Search Registered User</label>
                <ContributorSearchInput
                  selectedUser={newInviteUser}
                  onSelectUser={(u) => setNewInviteUser(u)}
                  onClearUser={() => setNewInviteUser(null)}
                  excludedUserIds={members.map((m) => m.userId?._id || m.userId?.id)}
                  currentUserId={user?._id || user?.id}
                />
              </div>

              <div className="ps-form-group">
                <label className="ps-form-label">Assign Contributor Role</label>
                <RoleDropdown
                  roles={globalRoles}
                  selectedRoleId={newInviteRoleId}
                  onSelectRole={(r) => setNewInviteRoleId(r._id)}
                  onOpenCreateRole={() => setCreateRoleOpen(true)}
                />
              </div>

              <div className="ps-nested-actions">
                <button
                  type="submit"
                  className="dashboard-button primary"
                  disabled={sendingInvite || !newInviteUser || !newInviteRoleId}
                >
                  {sendingInvite ? 'Sending...' : 'Send Invitation'}
                </button>
                <button
                  type="button"
                  className="dashboard-button secondary"
                  onClick={() => setInviteModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SUB-MODAL: Archive Confirmation ────────────────────────────────── */}
      {archiveModalOpen && (
        <div className="ps-nested-overlay" role="dialog">
          <div className="ps-nested-modal ps-modal-warning">
            <div className="ps-nested-header">
              <div className="ps-warn-title">
                <Archive size={20} className="ps-warn-icon" />
                <h4>Archive Project?</h4>
              </div>
              <button type="button" onClick={() => setArchiveModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="ps-nested-body">
              <p>
                Are you sure you want to archive <b>{project?.name}</b>?
              </p>
              <p className="ps-text-muted">
                The project will be hidden from the active dashboard. You can restore it at any time from this settings panel.
              </p>
              <div className="ps-nested-actions">
                <button
                  type="button"
                  className="dashboard-button primary"
                  onClick={handleArchiveProject}
                >
                  Confirm Archive
                </button>
                <button
                  type="button"
                  className="dashboard-button secondary"
                  onClick={() => setArchiveModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-MODAL: Unarchive Confirmation ──────────────────────────────── */}
      {unarchiveModalOpen && (
        <div className="ps-nested-overlay" role="dialog">
          <div className="ps-nested-modal">
            <div className="ps-nested-header">
              <h4>Restore Project</h4>
              <button type="button" onClick={() => setUnarchiveModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="ps-nested-body">
              <p>
                Restore <b>{project?.name}</b> to the active projects dashboard?
              </p>
              <div className="ps-nested-actions">
                <button
                  type="button"
                  className="dashboard-button primary"
                  onClick={handleUnarchiveProject}
                >
                  Restore Project
                </button>
                <button
                  type="button"
                  className="dashboard-button secondary"
                  onClick={() => setUnarchiveModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-MODAL: Delete Project Confirmation ─────────────────────────── */}
      {deleteModalOpen && (
        <div className="ps-nested-overlay" role="dialog">
          <div className="ps-nested-modal ps-modal-danger">
            <div className="ps-nested-header">
              <div className="ps-warn-title">
                <Trash2 size={20} className="ps-danger-icon" />
                <h4>Permanently Delete Project</h4>
              </div>
              <button type="button" onClick={() => setDeleteModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleDeleteProject} className="ps-nested-body">
              <p>
                This action <b>cannot</b> be undone. This will permanently delete <b>{project?.name}</b>, including all channels, messages, media assets, documents, and membership records.
              </p>
              <p className="ps-confirm-prompt">
                Please type <code className="ps-code-match">{project?.name}</code> to confirm:
              </p>
              <input
                type="text"
                className="ps-input ps-input-danger"
                placeholder={project?.name}
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                autoFocus
              />
              <div className="ps-nested-actions">
                <button
                  type="submit"
                  className="dashboard-button danger"
                  disabled={deleteConfirmInput !== project?.name || deletingProject}
                >
                  {deletingProject ? 'Deleting Project...' : 'I understand, delete this project'}
                </button>
                <button
                  type="button"
                  className="dashboard-button secondary"
                  onClick={() => setDeleteModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SUB-MODAL: Create New Platform Role ────────────────────────────── */}
      <CreateRoleModal
        isOpen={createRoleOpen}
        onClose={() => setCreateRoleOpen(false)}
        onRoleCreated={(newRole) => {
          loadGlobalRoles();
          loadWorkspaces();
          setToast({ type: 'success', message: `Role "${newRole.name}" created!` });
        }}
      />
    </div>
  );
}
