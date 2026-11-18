import React from 'react';
import {
  ArrowRight,
  Server,
  Layout,
  Layers,
  Palette,
  CheckCircle2,
  Terminal,
  Kanban,
  Shield,
  FileText,
  Users,
  Clock,
} from 'lucide-react';

const ROLE_THEMES = {
  'backend developer': {
    accent: '#2997ff',
    border: 'rgba(41, 151, 255, 0.45)',
    gradient: 'linear-gradient(135deg, rgba(41, 151, 255, 0.22) 0%, rgba(18, 18, 20, 0.95) 100%)',
    icon: Server,
    tag: 'ENGINEERING',
  },
  'frontend developer': {
    accent: '#8b6cff',
    border: 'rgba(139, 108, 255, 0.45)',
    gradient: 'linear-gradient(135deg, rgba(139, 108, 255, 0.22) 0%, rgba(18, 18, 20, 0.95) 100%)',
    icon: Layout,
    tag: 'INTERFACE',
  },
  'full stack developer': {
    accent: '#06b6d4',
    border: 'rgba(6, 182, 212, 0.45)',
    gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.22) 0%, rgba(18, 18, 20, 0.95) 100%)',
    icon: Layers,
    tag: 'FULL STACK',
  },
  'ui/ux designer': {
    accent: '#ec4899',
    border: 'rgba(236, 72, 153, 0.45)',
    gradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.22) 0%, rgba(18, 18, 20, 0.95) 100%)',
    icon: Palette,
    tag: 'DESIGN',
  },
  'qa engineer': {
    accent: '#10b981',
    border: 'rgba(16, 185, 129, 0.45)',
    gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(18, 18, 20, 0.95) 100%)',
    icon: CheckCircle2,
    tag: 'QUALITY',
  },
  'devops engineer': {
    accent: '#f59e0b',
    border: 'rgba(245, 158, 11, 0.45)',
    gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(18, 18, 20, 0.95) 100%)',
    icon: Terminal,
    tag: 'INFRASTRUCTURE',
  },
  'project manager': {
    accent: '#a855f7',
    border: 'rgba(168, 85, 247, 0.45)',
    gradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.22) 0%, rgba(18, 18, 20, 0.95) 100%)',
    icon: Kanban,
    tag: 'MANAGEMENT',
  },
};

const FALLBACK_PALETTE = [
  { accent: '#2997ff', border: 'rgba(41, 151, 255, 0.45)', tag: 'WORKSPACE' },
  { accent: '#8b6cff', border: 'rgba(139, 108, 255, 0.45)', tag: 'WORKSPACE' },
  { accent: '#06b6d4', border: 'rgba(6, 182, 212, 0.45)', tag: 'WORKSPACE' },
  { accent: '#10b981', border: 'rgba(16, 185, 129, 0.45)', tag: 'WORKSPACE' },
  { accent: '#f59e0b', border: 'rgba(245, 158, 11, 0.45)', tag: 'WORKSPACE' },
  { accent: '#ec4899', border: 'rgba(236, 72, 153, 0.45)', tag: 'WORKSPACE' },
];

function getRoleTheme(roleName = '') {
  const normalized = roleName.trim().toLowerCase();
  if (ROLE_THEMES[normalized]) {
    return ROLE_THEMES[normalized];
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % FALLBACK_PALETTE.length;
  const picked = FALLBACK_PALETTE[index];
  return {
    ...picked,
    gradient: `linear-gradient(135deg, ${picked.border} 0%, rgba(18, 18, 20, 0.95) 100%)`,
    icon: Shield,
    tag: 'TEAM ROLE',
  };
}

const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?';

export default function DynamicRoleCard({
  role,
  index = 0,
  onOpenWorkspace,
  onViewContributors,
}) {
  const theme = getRoleTheme(role.name);
  const Icon = theme.icon;

  const activeContributors = role.contributors || [];
  const pendingInvitations = role.pendingInvitations || [];
  const activeCount = role.activeCount !== undefined ? role.activeCount : activeContributors.length;
  const pendingCount = role.pendingCount !== undefined ? role.pendingCount : pendingInvitations.length;

  const numberIndex = index < 9 ? `0${index + 1}` : `${index + 1}`;

  return (
    <article
      className="dynamic-role-card"
      style={{
        '--role-accent': theme.accent,
        '--role-border-hover': theme.border,
      }}
      onClick={() => onOpenWorkspace(role)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onOpenWorkspace(role);
        }
      }}
      aria-label={`Open ${role.name} workspace`}
    >
      {/* Visual Header / Cover */}
      <div className="drc-cover-wrap">
        {role.imageUrl ? (
          <img
            src={role.imageUrl}
            alt={role.name}
            className="drc-cover-img"
            loading="lazy"
          />
        ) : (
          <div className="drc-cover-fallback" style={{ background: theme.gradient }}>
            <span className="drc-fallback-orbit drc-orbit-one" />
            <span className="drc-fallback-orbit drc-orbit-two" />
            <div className="drc-fallback-center-badge">
              <span className="drc-initial">{role.name.slice(0, 1).toUpperCase()}</span>
            </div>
            <div className="drc-fallback-watermark-icon">
              <Icon size={70} strokeWidth={1.2} />
            </div>
          </div>
        )}

        <div className="drc-overlay-gradient" />

        {/* Floating Top Indicators */}
        <div className="drc-floating-tag">
          <span>{theme.tag}</span>
        </div>

        <div className="drc-floating-badge">
          <span>{numberIndex}</span>
        </div>
      </div>

      {/* Information Section */}
      <div className="drc-card-content">
        <div className="drc-card-header">
          <div className="drc-icon-box" style={{ color: theme.accent }}>
            <Icon size={16} />
          </div>
          <div className="drc-text-group">
            <h3 className="drc-title">{role.name}</h3>
            <span className="drc-tagline">{theme.tagline || role.name}</span>
          </div>
        </div>

        <p className="drc-description">
          {role.description || `Dedicated workspace for ${role.name} collaboration, documentation, and shared project assets.`}
        </p>

        {/* Contributors info and avatar stack */}
        <div
          className="drc-contributors-bar"
          onClick={(e) => {
            e.stopPropagation();
            onViewContributors(role);
          }}
          title="Click to view assigned team contributors"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onViewContributors(role);
            }
          }}
        >
          {activeCount > 0 ? (
            <div className="drc-avatar-stack">
              {activeContributors.slice(0, 4).map((contrib, i) => {
                const u = contrib.user || {};
                return (
                  <div
                    key={contrib._id || u._id || i}
                    className="drc-stack-avatar-box"
                    title={u.name || `@${u.username}`}
                  >
                    {u.avatar ? (
                      <img src={u.avatar} alt="" className="drc-stack-avatar-img" />
                    ) : (
                      <span className="drc-stack-avatar-fallback">
                        {initials(u.name || u.username)}
                      </span>
                    )}
                  </div>
                );
              })}
              {activeCount > 4 && (
                <div className="drc-stack-avatar-box drc-stack-more">
                  <span>+{activeCount - 4}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="drc-no-active-avatar">
              <Users size={13} />
            </div>
          )}

          <div className="drc-contributor-count-text">
            {activeCount > 0 ? (
              <span>
                <b>{activeCount}</b> {activeCount === 1 ? 'contributor' : 'contributors'}
                {pendingCount > 0 && <small className="drc-pending-note"> · {pendingCount} pending</small>}
              </span>
            ) : pendingCount > 0 ? (
              <span className="drc-pending-only">
                <Clock size={11} /> 0 active · <b>{pendingCount}</b> pending {pendingCount === 1 ? 'invite' : 'invites'}
              </span>
            ) : (
              <span className="drc-unassigned-note">No active contributors yet</span>
            )}
          </div>
        </div>

        {/* Footer row */}
        <div className="drc-footer-row">
          <div className="drc-footer-meta">
            {role.resourceCount !== undefined && role.resourceCount > 0 ? (
              <span className="drc-count-pill">
                <FileText size={11} />
                <span>{role.resourceCount} {role.resourceCount === 1 ? 'asset' : 'assets'}</span>
              </span>
            ) : (
              <span className="drc-count-pill muted">
                <span>Role Workspace</span>
              </span>
            )}
          </div>

          <div className="drc-enter-action" style={{ color: theme.accent }}>
            <span>Open Workspace</span>
            <ArrowRight size={13} className="action-arrow" />
          </div>
        </div>
      </div>
    </article>
  );
}
