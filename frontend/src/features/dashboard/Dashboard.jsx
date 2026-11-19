import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUpRight, Bell, Check, ChevronDown, FolderKanban, Loader2, LogOut, Plus, Search, Users, X } from 'lucide-react';
import CreateProjectModal from '../projects/CreateProjectModal';
import NotificationToast from '../../components/NotificationToast';
import { buildApiUrl, getAuthHeaders } from '../../services/apiConfig';
import projectSocket from '../../services/projectSocket';

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
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
const titleCase = value => value ? value[0].toUpperCase() + value.slice(1) : 'Member';

function ProjectCover({ project }) {
  return (
    <div className={`project-tile-cover ${project.thumbnail ? 'has-thumbnail' : ''}`}>
      {project.thumbnail ? <img src={project.thumbnail} alt="" loading="lazy" /> : (
        <div className="project-cover-fallback" aria-hidden="true">
          <span className="cover-orbit cover-orbit-one" />
          <span className="cover-orbit cover-orbit-two" />
          <span className="cover-initial">{initials(project.name).slice(0, 1)}</span>
          <FolderKanban className="cover-folder-icon" size={21} />
        </div>
      )}
      <span className="project-open-indicator" aria-hidden="true"><ArrowUpRight size={15} /></span>
    </div>
  );
}

function MemberStack({ members = [] }) {
  if (!members.length) return null;
  return (
    <div className="project-member-stack" aria-label={`${members.length} team ${members.length === 1 ? 'member' : 'members'}`}>
      <div className="project-member-avatars">
        {members.slice(0, 4).map(member => {
          const person = member.userId || member;
          return person.avatar
            ? <img className="member-avatar" key={member._id || person.id || person.username} src={person.avatar} alt={person.name || person.username} title={person.name || `@${person.username}`} />
            : <span className="member-avatar member-avatar-fallback" key={member._id || person.id || person.username} title={person.name || `@${person.username}`}>{initials(person.name || person.username)}</span>;
        })}
      </div>
      <span>{members.length} {members.length === 1 ? 'member' : 'members'}</span>
    </div>
  );
}

function ProjectCard({ project, onOpen }) {
  return (
    <button className="project-tile" type="button" onClick={() => onOpen(project)} aria-label={`Open ${project.name} project`}>
      <ProjectCover project={project} />
      <div className="project-tile-content">
        <div className="project-tile-title-row"><h3>{project.name}</h3><ArrowUpRight size={15} className="project-tile-arrow" aria-hidden="true" /></div>
        <p className="project-tile-description">{project.description || 'No description yet.'}</p>
        <div className="project-tile-meta">
          <span className="project-category">{project.category || 'General'}</span>
          <span className={`project-role role-${String(project.projectRole || 'member').toLowerCase()}`}>{titleCase(project.projectRole)}</span>
        </div>
        <div className="project-tile-footer"><MemberStack members={project.teamMembers || []} /></div>
      </div>
    </button>
  );
}

export default function Dashboard({ user, onLogout, onOpenProject }) {
  const [projects, setProjects] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewArchived, setViewArchived] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [respondingInvites, setRespondingInvites] = useState({});
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';

  const refresh = async (silent = false) => {
    setError('');
    if (!silent) setLoading(true);
    try {
      const [projectData, invitationData] = await Promise.all([
        api(viewArchived ? '/projects?archived=true' : '/projects'),
        api('/invitations')
      ]);
      setProjects(projectData.projects || []);
      setInvitations(invitationData.invitations || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [viewArchived]);

  // Real-time synchronization via Socket.IO
  useEffect(() => {
    const myId = String(user?._id || user?.id);

    const onInvitationReceived = ({ invitation, actorId }) => {
      if (String(actorId) === myId) return;
      if (!invitation) return;
      setInvitations((prev) => {
        const invId = invitation._id || invitation.id;
        if (prev.some((i) => (i._id || i.id) === invId)) return prev;
        return [invitation, ...prev];
      });
      setToast({
        type: 'info',
        message: `New invitation to join "${invitation.projectId?.name || 'a project'}"!`,
      });
    };

    const onInvitationCancelled = ({ invitationId }) => {
      setInvitations((prev) => prev.filter((i) => (i._id || i.id) !== invitationId));
    };

    const onProjectJoined = ({ project, actorId }) => {
      if (String(actorId) === myId) return;
      if (!viewArchived && project) {
        const pId = project._id || project.id;
        setProjects((prev) => {
          if (prev.some((p) => (p._id || p.id) === pId)) return prev;
          return [project, ...prev];
        });
        setToast({
          type: 'success',
          message: `You joined "${project.name}"!`,
        });
      }
    };

    const onProjectUpdated = ({ project }) => {
      if (!project) return;
      const pId = project._id || project.id;
      setProjects((prev) =>
        prev.map((p) => ((p._id || p.id) === pId ? { ...p, ...project } : p))
      );
    };

    const onProjectArchived = ({ projectId: archivedId }) => {
      if (!viewArchived) {
        setProjects((prev) => prev.filter((p) => (p._id || p.id) !== archivedId));
      }
    };

    const onProjectUnarchived = ({ projectId: unarchivedId, project }) => {
      if (viewArchived) {
        setProjects((prev) => prev.filter((p) => (p._id || p.id) !== unarchivedId));
      } else if (project) {
        setProjects((prev) => [project, ...prev.filter((p) => (p._id || p.id) !== unarchivedId)]);
      }
    };

    const onProjectDeleted = ({ projectId: deletedId }) => {
      setProjects((prev) => prev.filter((p) => (p._id || p.id) !== deletedId));
    };

    const onMemberRemoved = ({ projectId: pid, userId: uid }) => {
      if (String(uid) === myId) {
        setProjects((prev) => prev.filter((p) => (p._id || p.id) !== pid));
        setToast({
          type: 'info',
          message: 'Your membership in a project was updated.',
        });
      }
    };

    projectSocket.on('invitation:received', onInvitationReceived);
    projectSocket.on('invitation:cancelled', onInvitationCancelled);
    projectSocket.on('project:joined', onProjectJoined);
    projectSocket.on('project:updated', onProjectUpdated);
    projectSocket.on('project:archived', onProjectArchived);
    projectSocket.on('project:unarchived', onProjectUnarchived);
    projectSocket.on('project:deleted', onProjectDeleted);
    projectSocket.on('member:removed', onMemberRemoved);

    return () => {
      projectSocket.off('invitation:received', onInvitationReceived);
      projectSocket.off('invitation:cancelled', onInvitationCancelled);
      projectSocket.off('project:joined', onProjectJoined);
      projectSocket.off('project:updated', onProjectUpdated);
      projectSocket.off('project:archived', onProjectArchived);
      projectSocket.off('project:unarchived', onProjectUnarchived);
      projectSocket.off('project:deleted', onProjectDeleted);
      projectSocket.off('member:removed', onMemberRemoved);
    };
  }, [user, viewArchived]);

  const filteredProjects = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return projects;
    return projects.filter(project => `${project.name} ${project.description || ''} ${project.category || ''}`.toLowerCase().includes(search));
  }, [projects, query]);

  // Real-data workspace metrics
  const totalUniqueMembers = useMemo(() => {
    const memberIds = new Set();
    projects.forEach((p) => {
      (p.teamMembers || []).forEach((m) => {
        const id = m.userId?._id || m.userId?.id || m.userId || m._id;
        if (id) memberIds.add(String(id));
      });
    });
    return Math.max(memberIds.size, 1);
  }, [projects]);

  // Optimistic Project Creation: Prepend project instantly without full reload
  const handleProjectCreated = (createdProject, invitationsCount) => {
    setShowCreate(false);
    if (!viewArchived && createdProject) {
      const newProj = {
        ...createdProject,
        teamMembers: createdProject.teamMembers || [
          {
            userId: user,
            projectRole: 'owner',
            teamFunction: 'Project Owner',
            status: 'active',
          }
        ],
        memberCount: createdProject.memberCount || 1,
      };
      setProjects((prev) => [newProj, ...prev.filter((p) => (p._id || p.id) !== (newProj._id || newProj.id))]);
    }
    setToast({
      type: 'success',
      message: `Project "${createdProject.name}" created successfully!${
        invitationsCount > 0 ? ` ${invitationsCount} contributor invitation${invitationsCount === 1 ? '' : 's'} dispatched.` : ''
      }`
    });
  };

  // Optimistic Invitation Response with error rollback
  async function respond(invitationId, status) {
    setActionError('');
    const targetInv = invitations.find((i) => (i._id || i.id) === invitationId);
    setRespondingInvites((prev) => ({ ...prev, [invitationId]: status }));

    // Optimistically remove from pending invitations list
    setInvitations((prev) => prev.filter((i) => (i._id || i.id) !== invitationId));

    try {
      const res = await api(`/invitations/${invitationId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });

      if (status === 'accepted' && !viewArchived && targetInv?.projectId) {
        const projectObj = {
          _id: targetInv.projectId._id,
          name: targetInv.projectId.name,
          thumbnail: targetInv.projectId.thumbnail,
          category: targetInv.projectId.category,
          description: targetInv.projectId.description,
          projectRole: 'member',
          teamFunction: targetInv.contributorRoleId?.name || 'Member',
          teamMembers: res?.member ? [res.member] : [],
          memberCount: 1,
        };
        setProjects((prev) => [projectObj, ...prev.filter((p) => (p._id || p.id) !== projectObj._id)]);
      }

      setToast({
        type: 'success',
        message: status === 'accepted' ? 'Project invitation accepted! Welcome to the team.' : 'Project invitation declined.'
      });
    } catch (requestError) {
      // Rollback on failure
      if (targetInv) {
        setInvitations((prev) => [targetInv, ...prev]);
      }
      setActionError(requestError.message || 'Failed to respond to invitation.');
    } finally {
      setRespondingInvites((prev) => {
        const next = { ...prev };
        delete next[invitationId];
        return next;
      });
    }
  }

  function openInvitations() {
    document.getElementById('pending-invitations')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <main className="dashboard-home">
      <header className="dashboard-header">
        <a className="dashboard-brand" href="/" onClick={event => event.preventDefault()} aria-label="CollabLoop home">
          <img src="/collabloop-monogram.png" alt="" /><span>CollabLoop</span>
        </a>
        <div className="dashboard-header-actions">
          <label className={`dashboard-search ${searchOpen ? 'is-open' : ''}`}>
            <Search size={17} aria-hidden="true" />
            <input aria-label="Search projects" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search projects" />
            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button>}
          </label>
          <button className="dashboard-mobile-search icon-button" type="button" onClick={() => setSearchOpen(open => !open)} aria-label={searchOpen ? 'Close project search' : 'Search projects'}><Search size={18} /></button>
          <button className="dashboard-invitation-shortcut icon-button" type="button" onClick={openInvitations} aria-label={`${invitations.length} pending invitations`} title="Pending invitations">
            <Bell size={18} />{invitations.length > 0 && <span className="notification-count">{invitations.length > 9 ? '9+' : invitations.length}</span>}
          </button>
          <div className="profile-control">
            <button className="profile-trigger" type="button" onClick={() => setProfileOpen(open => !open)} aria-expanded={profileOpen}>
              <span className="profile-avatar">{initials(user?.name)}</span><span className="profile-copy"><b>{user?.name}</b><small>@{user?.username}</small></span><ChevronDown size={15} className={profileOpen ? 'profile-chevron open' : 'profile-chevron'} />
            </button>
            {profileOpen && <div className="profile-menu"><div className="profile-menu-identity"><b>{user?.name}</b><span>@{user?.username}</span>{user?.email && <small>{user.email}</small>}</div><button type="button" onClick={onLogout}><LogOut size={15} /> Log out</button></div>}
          </div>
        </div>
      </header>
      {searchOpen && <div className="dashboard-mobile-search-row"><Search size={16} /><input autoFocus aria-label="Search projects" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search projects" /><button type="button" onClick={() => { setQuery(''); setSearchOpen(false); }} aria-label="Close search"><X size={17} /></button></div>}

      <div className="dashboard-content">
        <section className="dashboard-welcome">
          <div><p className="dashboard-eyebrow">YOUR WORKSPACE</p><h1>Good to see you, {firstName}.</h1><p className="dashboard-welcome-subtitle">One place for every team and project.</p></div>
          <button className="dashboard-button primary welcome-create" type="button" onClick={() => { setActionError(''); setShowCreate(true); }}><Plus size={17} /> Create Project</button>
        </section>

        {/* Workspace Quick Metric Summary Strip */}
        <section className="dashboard-metrics-bar" aria-label="Workspace overview">
          <div className="metric-card">
            <span className="metric-number">{projects.length}</span>
            <span className="metric-title">{viewArchived ? 'Archived' : 'Active'} Projects</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-card">
            <span className="metric-number">{totalUniqueMembers}</span>
            <span className="metric-title">Team Collaborators</span>
          </div>
          <div className="metric-divider" />
          <div
            className={`metric-card ${invitations.length > 0 ? 'is-actionable' : ''}`}
            onClick={invitations.length > 0 ? openInvitations : undefined}
            role={invitations.length > 0 ? 'button' : undefined}
            tabIndex={invitations.length > 0 ? 0 : undefined}
          >
            <span className="metric-number metric-highlight">{invitations.length}</span>
            <span className="metric-title">Pending Invitations</span>
          </div>
        </section>

        {error && <div className="dashboard-error page-error" role="alert">{error}<button type="button" onClick={refresh}>Try again</button></div>}
        {actionError && !showCreate && <div className="dashboard-error page-error" role="alert">{actionError}<button type="button" onClick={() => setActionError('')} aria-label="Dismiss error"><X size={15} /></button></div>}

        {invitations.length > 0 && <section className="dashboard-section invitations-section" id="pending-invitations">
          <div className="dashboard-section-heading"><div><h2>Pending invitations</h2><p>Project teams have invited you to collaborate.</p></div><span className="section-count">{invitations.length}</span></div>
          <div className="invitation-list">{invitations.map(invitation => <article className="invitation-card" key={invitation._id}>
            <div className="invitation-project-mark"><FolderKanban size={19} /></div>
            <div className="invitation-details">
              <h3>{invitation.projectId?.name || 'Project invitation'}</h3>
              <p>Invited by <b>{invitation.invitedBy?.name || `@${invitation.invitedBy?.username || 'teammate'}`}</b></p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{invitation.projectId?.category || 'General'}</span>
                {invitation.contributorRoleId?.name && (
                  <span style={{ color: 'var(--color-brand, #800020)', fontSize: '10.5px', fontWeight: 600 }}>
                    Role: <b>{invitation.contributorRoleId.name}</b>
                  </span>
                )}
              </div>
            </div>
            <div className="invitation-actions">
              <button
                className="dashboard-button secondary"
                type="button"
                disabled={Boolean(respondingInvites[invitation._id])}
                onClick={() => respond(invitation._id, 'rejected')}
              >
                {respondingInvites[invitation._id] === 'rejected' ? (
                  <><Loader2 size={13} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Declining…</>
                ) : (
                  'Decline'
                )}
              </button>
              <button
                className="dashboard-button primary accept-button"
                type="button"
                disabled={Boolean(respondingInvites[invitation._id])}
                onClick={() => respond(invitation._id, 'accepted')}
              >
                {respondingInvites[invitation._id] === 'accepted' ? (
                  <><Loader2 size={13} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Accepting…</>
                ) : (
                  <><Check size={15} /> Accept</>
                )}
              </button>
            </div>
          </article>)}</div>
        </section>}

        <section className="dashboard-section projects-section">
          <div className="dashboard-section-heading">
            <div>
              <h2>{viewArchived ? 'Archived Projects' : 'My Projects'}</h2>
              <p>{viewArchived ? 'Preserved projects that have been archived.' : 'Projects you own and teams you’ve joined.'}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="dashboard-button secondary btn-compact"
                onClick={() => setViewArchived((prev) => !prev)}
                title={viewArchived ? 'Switch to active projects' : 'View archived projects'}
              >
                <span>{viewArchived ? 'View Active Projects' : 'Archived Projects'}</span>
              </button>
              <span className="section-count">{loading ? '—' : projects.length}</span>
            </div>
          </div>
          {loading ? <div className="project-loading-grid" aria-label="Loading projects"><span /><span /><span /></div> : filteredProjects.length > 0 ? <div className="my-projects-grid">{filteredProjects.map(project => <ProjectCard key={project._id} project={project} onOpen={onOpenProject} />)}</div> : query ? <div className="dashboard-no-results"><Search size={19} /><p>No projects match “{query}”.</p><button type="button" onClick={() => setQuery('')}>Clear search</button></div> : <div className="projects-empty-state"><div className="empty-illustration"><span /><span /><FolderKanban size={29} /></div><h3>No projects yet</h3><p>Start a project or join a team to collaborate.</p><button className="dashboard-button primary" type="button" onClick={() => setShowCreate(true)}><Plus size={16} /> Create your first project</button></div>}
        </section>
      </div>

      <CreateProjectModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onProjectCreated={handleProjectCreated}
        currentUser={user}
      />

      <NotificationToast
        toast={toast}
        onClose={() => setToast(null)}
      />
    </main>
  );
}
