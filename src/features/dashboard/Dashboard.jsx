import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUpRight, Bell, Check, ChevronDown, FolderKanban, LogOut, Plus, Search, Users, X } from 'lucide-react';

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
const INITIAL_FORM = { name: '', description: '', category: 'General', thumbnail: '' };
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

function CreateProjectModal({ form, setForm, onClose, onCreate, busy, error }) {
  return (
    <div className="create-project-overlay" onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}>
      <section className="create-project-modal" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
        <header className="create-modal-heading">
          <div><span className="create-modal-icon"><Plus size={18} /></span><h2 id="create-project-title">Create a project</h2><p>Set up a shared space for your team.</p></div>
          <button className="icon-button modal-close" type="button" onClick={onClose} disabled={busy} aria-label="Close dialog"><X size={18} /></button>
        </header>
        <form className="create-project-form" onSubmit={onCreate}>
          <label className="dashboard-form-field">Project name <span className="required-mark">*</span>
            <input autoFocus maxLength={100} required value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Mobile app redesign" />
          </label>
          <label className="dashboard-form-field">Description <span className="field-optional">Optional</span>
            <textarea rows={3} maxLength={500} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="What is this project about?" />
          </label>
          <label className="dashboard-form-field">Category
            <select value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))}>
              {['General', 'Product', 'Engineering', 'Design', 'Marketing', 'Research', 'Other'].map(category => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="dashboard-form-field">Cover image URL <span className="field-optional">Optional</span>
            <input type="url" value={form.thumbnail} onChange={event => setForm(current => ({ ...current, thumbnail: event.target.value }))} placeholder="https://…" />
          </label>
          {error && <div className="dashboard-error" role="alert">{error}</div>}
          <div className="create-modal-actions"><button className="dashboard-button secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="dashboard-button primary" type="submit" disabled={busy || !form.name.trim()}>{busy ? 'Creating…' : <><Plus size={16} /> Create project</>}</button></div>
        </form>
      </section>
    </div>
  );
}

export default function Dashboard({ user, onLogout, onOpenProject }) {
  const [projects, setProjects] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';

  const refresh = async () => {
    setError('');
    try {
      const [projectData, invitationData] = await Promise.all([api('/projects'), api('/invitations')]);
      const projectList = await Promise.all(projectData.projects.map(async project => {
        try {
          const { members } = await api(`/projects/${project._id}/members`);
          return { ...project, teamMembers: members };
        } catch { return { ...project, teamMembers: [] }; }
      }));
      setProjects(projectList);
      setInvitations(invitationData.invitations);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const filteredProjects = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return projects;
    return projects.filter(project => `${project.name} ${project.description || ''} ${project.category || ''}`.toLowerCase().includes(search));
  }, [projects, query]);

  async function createProject(event) {
    event.preventDefault();
    setBusy(true);
    setActionError('');
    try {
      const { project } = await api('/projects', { method: 'POST', body: JSON.stringify({ ...form, thumbnail: form.thumbnail.trim() || undefined }) });
      setShowCreate(false);
      setForm(INITIAL_FORM);
      onOpenProject(project);
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function respond(invitationId, status) {
    setActionError('');
    try {
      await api(`/invitations/${invitationId}/respond`, { method: 'POST', body: JSON.stringify({ status }) });
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
            <div className="invitation-project-mark"><FolderKanban size={19} /></div><div className="invitation-details"><h3>{invitation.projectId?.name || 'Project invitation'}</h3><p>Invited by <b>{invitation.invitedBy?.name || `@${invitation.invitedBy?.username || 'teammate'}`}</b></p><div><span>{invitation.projectId?.category || 'General'}</span></div></div>
            <div className="invitation-actions"><button className="dashboard-button secondary" type="button" onClick={() => respond(invitation._id, 'rejected')}>Decline</button><button className="dashboard-button primary accept-button" type="button" onClick={() => respond(invitation._id, 'accepted')}><Check size={15} /> Accept</button></div>
          </article>)}</div>
        </section>}

        <section className="dashboard-section projects-section">
          <div className="dashboard-section-heading"><div><h2>My Projects</h2><p>Projects you own and teams you’ve joined.</p></div><span className="section-count">{loading ? '—' : projects.length}</span></div>
          {loading ? <div className="project-loading-grid" aria-label="Loading projects"><span /><span /><span /></div> : filteredProjects.length > 0 ? <div className="my-projects-grid">{filteredProjects.map(project => <ProjectCard key={project._id} project={project} onOpen={onOpenProject} />)}</div> : query ? <div className="dashboard-no-results"><Search size={19} /><p>No projects match “{query}”.</p><button type="button" onClick={() => setQuery('')}>Clear search</button></div> : <div className="projects-empty-state"><div className="empty-illustration"><span /><span /><FolderKanban size={29} /></div><h3>No projects yet</h3><p>Start a project or join a team to collaborate.</p><button className="dashboard-button primary" type="button" onClick={() => setShowCreate(true)}><Plus size={16} /> Create your first project</button></div>}
        </section>
      </div>

      {showCreate && <CreateProjectModal form={form} setForm={setForm} onClose={() => { if (!busy) setShowCreate(false); }} onCreate={createProject} busy={busy} error={actionError} />}
    </main>
  );
}
