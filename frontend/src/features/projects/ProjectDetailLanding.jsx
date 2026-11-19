import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  Search,
  Users,
  Shield,
  FolderKanban,
  Settings,
  Layers,
  Plus,
  RefreshCw,
  LogOut,
  ChevronDown,
  X,
  FileText,
  AlertCircle,
} from 'lucide-react';
import DynamicRoleCard from './DynamicRoleCard';
import RoleContributorsModal from './RoleContributorsModal';
import RoleWorkspace from './RoleWorkspace';
import CreateProjectModal from './CreateProjectModal';
import ProjectChatWidget from '../chat/ProjectChatWidget';
import ProjectSettingsModal from './ProjectSettingsModal';
import { parseProjectRoute, pushProjectUrl } from '../../utils/navigation';
import { buildApiUrl, getAuthHeaders } from '../../services/apiConfig';
import './ProjectDetail.css';

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

export default function ProjectDetailLanding({
  project: initialProject,
  user,
  initialRoleId = null,
  onBackToDashboard,
  onLogout,
}) {
  const [projectData, setProjectData] = useState(null);
  const [roles, setRoles] = useState([]);
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalRoles: 0,
    totalResources: 0,
    totalDocuments: 0,
  });
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected role for deep dive workspace (restored from URL or initialRoleId on refresh / direct visit)
  const [activeRoleWorkspace, setActiveRoleWorkspace] = useState(() => {
    const route = parseProjectRoute();
    const targetRoleId = initialRoleId || route.roleId;
    if (!targetRoleId) return null;
    return { _id: targetRoleId, id: targetRoleId };
  });

  // Contributor details modal
  const [inspectingRole, setInspectingRole] = useState(null);

  // Profile Menu
  const [profileOpen, setProfileOpen] = useState(false);

  // Settings modal
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const projectId = initialProject?._id || initialProject?.id;

  const fetchWorkspaces = useCallback(async () => {
    if (!projectId) return;
    setError('');
    try {
      setLoading(true);
      const data = await api(`/projects/${projectId}/workspaces`);
      setProjectData(data.project);
      setRoles(data.roles || []);
      setStats(data.stats || {});
      setMembership(data.membership || null);

      // If active workspace was initialized from URL as a placeholder ({ _id }),
      // enrich it with the full role definition loaded from the server
      const { roleId: currentRoleId } = parseProjectRoute();
      if (currentRoleId && data.roles && data.roles.length > 0) {
        const found = data.roles.find(
          (r) =>
            String(r._id) === String(currentRoleId) ||
            String(r.id) === String(currentRoleId) ||
            (r.normalizedName && r.normalizedName.toLowerCase() === String(currentRoleId).toLowerCase()) ||
            (r.name && r.name.toLowerCase() === decodeURIComponent(String(currentRoleId)).toLowerCase())
        );
        if (found) {
          setActiveRoleWorkspace(found);
        }
      }
    } catch (err) {
      console.error('Error fetching project workspaces:', err);
      setError(err.message || 'Failed to load project details.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Synchronize active role workspace on browser back/forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const { roleId } = parseProjectRoute();
      if (!roleId) {
        setActiveRoleWorkspace(null);
      } else {
        const found = roles.find(
          (r) =>
            String(r._id) === String(roleId) ||
            String(r.id) === String(roleId) ||
            (r.normalizedName && r.normalizedName.toLowerCase() === String(roleId).toLowerCase()) ||
            (r.name && r.name.toLowerCase() === decodeURIComponent(String(roleId)).toLowerCase())
        );
        setActiveRoleWorkspace(found || { _id: roleId, id: roleId });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [roles]);

  // If activeRoleWorkspace was initialized from URL with only an ID placeholder,
  // enrich it once full roles are populated
  useEffect(() => {
    if (activeRoleWorkspace && roles.length > 0) {
      const activeId = activeRoleWorkspace._id || activeRoleWorkspace.id;
      const found = roles.find(
        (r) =>
          String(r._id) === String(activeId) ||
          String(r.id) === String(activeId) ||
          (r.normalizedName && r.normalizedName.toLowerCase() === String(activeId).toLowerCase()) ||
          (r.name && r.name.toLowerCase() === decodeURIComponent(String(activeId)).toLowerCase())
      );
      if (found && (!activeRoleWorkspace.name || activeRoleWorkspace.name === activeId)) {
        setActiveRoleWorkspace(found);
      }
    }
  }, [roles, activeRoleWorkspace]);

  const handleOpenRoleWorkspace = useCallback(
    (role) => {
      setActiveRoleWorkspace(role);
      const roleId = role._id || role.id || role.normalizedName || role.name;
      pushProjectUrl(projectId, roleId);
    },
    [projectId]
  );

  const handleBackToLanding = useCallback(() => {
    setActiveRoleWorkspace(null);
    pushProjectUrl(projectId, null);
    fetchWorkspaces();
  }, [projectId, fetchWorkspaces]);

  const currentProject = projectData || initialProject;

  // Filter roles dynamically by search query
  const filteredRoles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [roles, searchQuery]);

  const isOwnerOrAdmin =
    membership?.projectRole === 'owner' ||
    membership?.projectRole === 'admin' ||
    currentProject?.ownerId?._id === user?._id ||
    currentProject?.ownerId?.id === user?.id;

  // If a role is opened, show the dedicated RoleWorkspace view!
  if (activeRoleWorkspace) {
    return (
      <RoleWorkspace
        project={currentProject}
        role={activeRoleWorkspace}
        user={user}
        membership={membership}
        onBackToLanding={handleBackToLanding}
      />
    );
  }

  return (
    <main className="project-detail-landing">
      {/* ── Top Header Navigation ────────────────────────────────────────── */}
      <header className="pdl-header">
        <div className="pdl-header-left">
          {/* Back to Projects Button */}
          <button
            type="button"
            className="pdl-back-btn"
            onClick={onBackToDashboard}
            aria-label="Back to projects dashboard"
          >
            <ChevronLeft size={16} />
            <span>Projects</span>
          </button>

          <div className="pdl-breadcrumb-divider" aria-hidden="true">/</div>

          {/* Project Title & Mark */}
          <div className="pdl-header-brand">
            <span className="pdl-brand-icon">
              <FolderKanban size={17} />
            </span>
            <h1 className="pdl-header-title">{currentProject?.name}</h1>
          </div>
        </div>

        <div className="pdl-header-right">
          {/* Team Members Count Indicator */}
          <div className="pdl-team-indicator" title="Total active members in project">
            <Users size={14} />
            <span>
              {stats.totalMembers || 1} {stats.totalMembers === 1 ? 'member' : 'members'}
            </span>
          </div>

          {/* User Profile Control */}
          <div className="profile-control">
            <button
              className="profile-trigger"
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              aria-expanded={profileOpen}
            >
              <span className="profile-avatar">{initials(user?.name)}</span>
              <span className="profile-copy">
                <b>{user?.name}</b>
                <small>@{user?.username}</small>
              </span>
              <ChevronDown
                size={14}
                className={profileOpen ? 'profile-chevron open' : 'profile-chevron'}
              />
            </button>

            {profileOpen && (
              <div className="profile-menu">
                <div className="profile-menu-identity">
                  <b>{user?.name}</b>
                  <span>@{user?.username}</span>
                  {user?.email && <small>{user.email}</small>}
                </div>
                <button type="button" onClick={onLogout}>
                  <LogOut size={14} /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content Area ───────────────────────────────────────────── */}
      <div className="pdl-content">
        {/* Project Information Hero Card */}
        <section className="pdl-info-card">
          <div className="pdl-info-main">
            {/* Project Cover / Identity */}
            <div className={`pdl-project-cover ${currentProject?.thumbnail ? 'has-img' : ''}`}>
              {currentProject?.thumbnail ? (
                <img src={currentProject.thumbnail} alt="" className="pdl-cover-img" />
              ) : (
                <div className="pdl-cover-fallback">
                  <span className="pdl-orbit pdl-orbit-1" />
                  <span className="pdl-orbit pdl-orbit-2" />
                  <span className="pdl-initial">{initials(currentProject?.name)}</span>
                </div>
              )}
            </div>

            {/* Project Details */}
            <div className="pdl-project-meta">
              <div className="pdl-badge-row">
                <span className="pdl-category-pill">{currentProject?.category || 'General'}</span>
                {isOwnerOrAdmin && (
                  <span className="pdl-owner-pill">
                    <Shield size={11} />
                    <span>Project Owner</span>
                  </span>
                )}
              </div>

              <h2 className="pdl-project-name">{currentProject?.name}</h2>

              <p className="pdl-project-description">
                {currentProject?.description || 'No project description provided yet.'}
              </p>

              {/* Owner and Stats row */}
              <div className="pdl-info-footer">
                <div className="pdl-owner-tag">
                  <span className="pdl-label">Owner:</span>
                  <span className="pdl-owner-val">
                    {currentProject?.ownerId?.name || `@${currentProject?.ownerId?.username || 'admin'}`}
                  </span>
                </div>

                <div className="pdl-stats-chips">
                  <span className="pdl-stat-chip">
                    <b>{stats.totalMembers || 1}</b> {stats.totalMembers === 1 ? 'member' : 'members'}
                  </span>
                  <span className="pdl-stat-chip">
                    <b>{stats.totalRoles || roles.length}</b> {roles.length === 1 ? 'role' : 'roles'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Project Settings action */}
          {isOwnerOrAdmin && (
            <div className="pdl-info-actions">
              <button
                type="button"
                className="dashboard-button secondary btn-compact"
                onClick={() => setIsSettingsModalOpen(true)}
                title="Project Settings"
              >
                <Settings size={14} />
                <span>Project Settings</span>
              </button>
            </div>
          )}
        </section>

        {/* ── Project Workspaces Section ─────────────────────────────────── */}
        <section className="pdl-workspaces-section">
          {/* Section Heading & Search */}
          <div className="pdl-section-head">
            <div className="pdl-heading-text">
              <div className="pdl-title-row">
                <h2>Project Workspaces</h2>
                <span className="pdl-roles-count-badge">
                  {loading ? '—' : `${roles.length} ${roles.length === 1 ? 'role' : 'roles'}`}
                </span>
              </div>
              <p>Explore your team's roles and shared workspaces.</p>
            </div>

            {/* Optional Role Search Field */}
            {roles.length > 0 && (
              <div className="pdl-search-box">
                <Search size={15} className="pdl-search-icon" />
                <input
                  type="text"
                  placeholder="Filter project roles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pdl-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="pdl-search-clear"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear filter"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Dynamic Role Cards Grid */}
          {loading ? (
            <div className="pdl-loading-grid" aria-label="Loading project roles">
              <span />
              <span />
            </div>
          ) : error ? (
            <div className="dashboard-error page-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={fetchWorkspaces}>
                Retry
              </button>
            </div>
          ) : filteredRoles.length > 0 ? (
            <div className="pdl-cards-grid">
              {filteredRoles.map((role, idx) => (
                <DynamicRoleCard
                  key={role._id || idx}
                  role={role}
                  index={idx}
                  onOpenWorkspace={handleOpenRoleWorkspace}
                  onViewContributors={(r) => setInspectingRole(r)}
                />
              ))}
            </div>
          ) : searchQuery ? (
            <div className="pdl-empty-state">
              <Search size={24} />
              <h3>No matching roles found</h3>
              <p>No project workspaces match “{searchQuery}”.</p>
              <button
                type="button"
                className="dashboard-button secondary btn-compact"
                onClick={() => setSearchQuery('')}
              >
                Clear filter
              </button>
            </div>
          ) : (
            <div className="pdl-empty-state">
              <div className="pdl-empty-icon">
                <Layers size={28} />
              </div>
              <h3>No role workspaces configured yet</h3>
              <p>
                When project contributors are assigned roles such as Backend Developer, Frontend Developer,
                or UI/UX Designer, their dedicated workspaces will automatically appear here.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Role Contributors Details Modal */}
      <RoleContributorsModal
        isOpen={Boolean(inspectingRole)}
        onClose={() => setInspectingRole(null)}
        role={inspectingRole}
        projectName={currentProject?.name}
      />

      {/* Centralized Project Chat Floating Widget ("Ask Doubts") */}
      <ProjectChatWidget
        project={currentProject}
        user={user}
        membership={membership}
      />

      {/* Project Settings & Management Modal */}
      <ProjectSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        project={currentProject}
        user={user}
        membership={membership}
        onProjectUpdated={(updatedProject) => {
          setProjectData(updatedProject);
          fetchWorkspaces();
        }}
        onProjectDeleted={() => {
          onBackToDashboard();
        }}
        onRefreshWorkspaces={fetchWorkspaces}
      />
    </main>
  );
}
