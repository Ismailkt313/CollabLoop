import React, { useEffect } from 'react';
import { X, Users, Shield, Clock, Mail, CheckCircle2 } from 'lucide-react';

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

export default function RoleContributorsModal({
  isOpen,
  onClose,
  role,
  projectName,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !role) return null;

  const contributors = role.contributors || [];
  const pendingInvitations = role.pendingInvitations || [];

  return (
    <div
      className="rc-modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rc-modal-title"
    >
      <div className="rc-modal-card">
        {/* Header */}
        <header className="rc-modal-header">
          <div className="rc-modal-title-group">
            <span className="rc-role-badge">
              <Users size={17} />
            </span>
            <div>
              <h2 id="rc-modal-title" className="rc-modal-title">
                {role.name}
              </h2>
              <p className="rc-modal-subtitle">
                Contributors assigned to this role in <b>{projectName}</b>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={17} />
          </button>
        </header>

        {/* Content list */}
        <div className="rc-modal-body">
          {/* Active Contributors */}
          <div className="rc-section">
            <div className="rc-section-heading">
              <span className="rc-section-label">Active Contributors</span>
              <span className="rc-count-badge">{contributors.length}</span>
            </div>

            {contributors.length > 0 ? (
              <div className="rc-member-list">
                {contributors.map((contrib) => {
                  const u = contrib.user || {};
                  const isOwner = contrib.projectRole === 'owner';
                  const isAdmin = contrib.projectRole === 'admin';

                  return (
                    <div key={contrib._id || u._id} className="rc-member-card">
                      <div className="rc-avatar-box">
                        {u.avatar ? (
                          <img
                            src={u.avatar}
                            alt={u.name || u.username}
                            className="rc-avatar-img"
                          />
                        ) : (
                          <span className="rc-avatar-fallback">
                            {initials(u.name || u.username)}
                          </span>
                        )}
                      </div>

                      <div className="rc-member-info">
                        <div className="rc-member-name-row">
                          <span className="rc-member-name">{u.name || 'Team Member'}</span>
                          <span className="rc-member-username">@{u.username}</span>
                        </div>

                        <div className="rc-member-meta-row">
                          <span
                            className={`rc-role-pill ${
                              isOwner ? 'pill-owner' : isAdmin ? 'pill-admin' : 'pill-member'
                            }`}
                          >
                            <Shield size={10} />
                            <span>{titleCase(contrib.projectRole || 'member')}</span>
                          </span>

                          <span className="rc-function-pill">
                            {contrib.teamFunction || role.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rc-empty-notice">
                <span>No active contributors assigned to this role yet.</span>
              </div>
            )}
          </div>

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <div className="rc-section" style={{ marginTop: '16px' }}>
              <div className="rc-section-heading">
                <span className="rc-section-label">Pending Invitations</span>
                <span className="rc-count-badge pending-badge">
                  {pendingInvitations.length}
                </span>
              </div>

              <div className="rc-member-list">
                {pendingInvitations.map((inv) => {
                  const u = inv.user || {};
                  return (
                    <div key={inv._id || u._id} className="rc-member-card is-pending">
                      <div className="rc-avatar-box">
                        {u.avatar ? (
                          <img
                            src={u.avatar}
                            alt={u.name || u.username}
                            className="rc-avatar-img"
                          />
                        ) : (
                          <span className="rc-avatar-fallback">
                            {initials(u.name || u.username)}
                          </span>
                        )}
                      </div>

                      <div className="rc-member-info">
                        <div className="rc-member-name-row">
                          <span className="rc-member-name">{u.name || 'Invited User'}</span>
                          <span className="rc-member-username">@{u.username}</span>
                        </div>

                        <div className="rc-member-meta-row">
                          <span className="rc-status-pill pending">
                            <Clock size={10} />
                            <span>Invitation Pending</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="rc-modal-footer">
          <button
            type="button"
            className="dashboard-button secondary"
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
