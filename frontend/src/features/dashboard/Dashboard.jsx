import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUpRight, Bell, Check, ChevronDown, FolderKanban, LogOut, Plus, Search, Users, X } from 'lucide-react';
import CreateProjectModal from '../projects/CreateProjectModal';
import NotificationToast from '../../components/NotificationToast';

const api = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
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
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';

  const refresh = async () => {
    setError('');
    try {
      const [projectData, invitationData] = await Promise.all([
        api(viewArchived ? '/projects?archived=true' : '/projects'),
        api('/invitations')
      ]);
      const projectList = await Promise.all(projectData.projects.map(async project => {
        try {
          const { members } = await api(`/projects/${project._id}/members`);
          return { ...project, teamMembers: members };
        } catch { return { ...project, teamMembers: [] }; }
      }));
      setProjects(projectList);
      setInvitations(invitationData.invitations || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [viewArchived]);

  const filteredProjects = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return projects;
    return projects.filter(project => `${project.name} ${project.description || ''} ${project.category || ''}`.toLowerCase().includes(search));
  }, [projects, query]);

  const handleProjectCreated = async (createdProject, invitationsCount) => {
    setShowCreate(false);
    await refresh();
    setToast({
      type: 'success',
      message: `Project "${createdProject.name}" created successfully!${
        invitationsCount > 0 ? ` ${invitationsCount} contributor invitation${invitationsCount === 1 ? '' : 's'} sent.` : ''
      }`
    });
  };

  async function respond(invitationId, status) {
    setActionError('');
    try {
      await api(`/invitations/${invitationId}/respond`, { method: 'POST', body: JSON.stringify({ status }) });
      setToast({
        type: 'success',
        message: status === 'accepted' ? 'Project invitation accepted!' : 'Project invitation declined.'
      });
      await refresh();
    } catch (requestError) { setActionError(requestError.message); }
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
                  <span style={{ color: '#c4b5fd', fontSize: '10px' }}>
                    Role: <b>{invitation.contributorRoleId.name}</b>
                  </span>
                )}
              </div>
            </div>
            <div className="invitation-actions"><button className="dashboard-button secondary" type="button" onClick={() => respond(invitation._id, 'rejected')}>Decline</button><button className="dashboard-button primary accept-button" type="button" onClick={() => respond(invitation._id, 'accepted')}><Check size={15} /> Accept</button></div>
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
