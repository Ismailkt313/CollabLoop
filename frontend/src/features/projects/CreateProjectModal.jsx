import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Users, FolderPlus, AlertCircle, RefreshCw } from 'lucide-react';
import ProjectThumbnailUpload from './ProjectThumbnailUpload';
import ContributorSearchInput from './ContributorSearchInput';
import RoleDropdown from './RoleDropdown';
import CreateRoleModal from './CreateRoleModal';
import { buildApiUrl } from '../../services/apiConfig';
import './CreateProjectModal.css';

const api = async (path, options = {}) => {
  const response = await fetch(buildApiUrl(path), {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
};

const CATEGORIES = [
  'General',
  'Product',
  'Engineering',
  'Design',
  'Marketing',
  'Research',
  'Other',
];

export default function CreateProjectModal({
  isOpen,
  onClose,
  onProjectCreated,
  currentUser,
}) {
  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [contributors, setContributors] = useState([]);

  // Platform Roles State
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  // Nested Create Role Modal State
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [activeContributorKeyForNewRole, setActiveContributorKeyForNewRole] = useState(null);

  // Submitting & Error State
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Fetch platform contributor roles
  const fetchRoles = useCallback(async () => {
    try {
      setRolesLoading(true);
      const data = await api('/roles');
      if (Array.isArray(data.roles)) {
        setRoles(data.roles);
      }
    } catch (err) {
      console.error('Failed to fetch contributor roles:', err);
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setCategory('General');
      setDescription('');
      setThumbnail('');
      setContributors([]);
      setError('');
      setFieldErrors({});
      setBusy(false);
      fetchRoles();
    }
  }, [isOpen, fetchRoles]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !busy && !isCreateRoleOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, busy, isCreateRoleOpen, onClose]);

  if (!isOpen) return null;

  // Contributor row management
  const handleAddContributor = () => {
    const newKey = `contrib_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setContributors((prev) => [
      ...prev,
      {
        key: newKey,
        user: null,
        roleId: '',
      },
    ]);
    setError('');
  };

  const handleRemoveContributor = (key) => {
    setContributors((prev) => prev.filter((c) => c.key !== key));
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleUpdateContributorUser = (key, user) => {
    setContributors((prev) =>
      prev.map((c) => (c.key === key ? { ...c, user } : c))
    );
    setFieldErrors((prev) => {
      const copy = { ...prev };
      if (copy[key]) {
        delete copy[key].user;
        if (Object.keys(copy[key]).length === 0) delete copy[key];
      }
      return copy;
    });
    setError('');
  };

  const handleUpdateContributorRole = (key, role) => {
    const roleId = role._id || role.id;
    setContributors((prev) =>
      prev.map((c) => (c.key === key ? { ...c, roleId } : c))
    );
    setFieldErrors((prev) => {
      const copy = { ...prev };
      if (copy[key]) {
        delete copy[key].role;
        if (Object.keys(copy[key]).length === 0) delete copy[key];
      }
      return copy;
    });
    setError('');
  };

  // Open Create Role modal from a contributor row
  const handleOpenCreateRole = (contributorKey) => {
    setActiveContributorKeyForNewRole(contributorKey);
    setIsCreateRoleOpen(true);
  };

  // When a new role is successfully created in the nested modal
  const handleRoleCreated = (newRole) => {
    setRoles((prev) => {
      const exists = prev.some((r) => (r._id || r.id) === (newRole._id || newRole.id));
      if (exists) return prev;
      return [...prev, newRole].sort((a, b) => a.name.localeCompare(b.name));
    });

    // Auto-select this newly created role on the active contributor row
    if (activeContributorKeyForNewRole) {
      handleUpdateContributorRole(activeContributorKeyForNewRole, newRole);
    }
  };

  // Validate and submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Project name is required.');
      return;
    }

    if (trimmedName.length > 100) {
      setError('Project name cannot exceed 100 characters.');
      return;
    }

    // Validate contributors if any are present
    const errorsMap = {};
    let hasContributorErrors = false;
    const seenUserIds = new Set();

    contributors.forEach((contrib, idx) => {
      const rowErrors = {};
      if (!contrib.user) {
        rowErrors.user = true;
        hasContributorErrors = true;
      } else {
        const uid = (contrib.user._id || contrib.user.id).toString();
        if (currentUser && uid === (currentUser._id || currentUser.id)?.toString()) {
          rowErrors.user = 'Cannot invite yourself';
          hasContributorErrors = true;
        } else if (seenUserIds.has(uid)) {
          rowErrors.user = 'Duplicate contributor';
          hasContributorErrors = true;
        } else {
          seenUserIds.add(uid);
        }
      }

      if (!contrib.roleId) {
        rowErrors.role = true;
        hasContributorErrors = true;
      }

      if (Object.keys(rowErrors).length > 0) {
        errorsMap[contrib.key] = rowErrors;
      }
    });

    if (hasContributorErrors) {
      setFieldErrors(errorsMap);
      setError('Please resolve the highlighted contributor fields or remove incomplete rows.');
      return;
    }

    setBusy(true);

    try {
      const payload = {
        name: trimmedName,
        category: category || 'General',
        description: description.trim(),
        thumbnail: thumbnail.trim() || undefined,
        contributors: contributors
          .filter((c) => c.user && c.roleId)
          .map((c) => ({
            userId: c.user._id || c.user.id,
            contributorRoleId: c.roleId,
          })),
      };

      const result = await api('/projects', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onProjectCreated?.(result.project, result.invitationsSent || 0);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create project. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const currentUserId = currentUser?._id || currentUser?.id;
  const selectedUserIds = contributors
    .map((c) => c.user?._id || c.user?.id)
    .filter(Boolean);

  return (
    <>
      <div
        className="cpm-overlay"
        onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cpm-title"
      >
        <section className="cpm-modal">
          <header className="cpm-header">
            <div className="cpm-header-info">
              <span className="cpm-header-icon">
                <FolderPlus size={20} />
              </span>
              <div>
                <h2 id="cpm-title" className="cpm-header-title">Create a Project</h2>
                <p className="cpm-header-subtitle">
                  Set up your project workspace and invite initial team contributors.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="icon-button modal-close cpm-close-btn"
              onClick={onClose}
              disabled={busy}
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </header>

          <form className="cpm-body" onSubmit={handleSubmit}>
            {/* Section 1: Project Details */}
            <div className="cpm-section">
              <div className="cpm-section-head">
                <div className="cpm-section-title-wrap">
                  <h3 className="cpm-section-title">Project Details</h3>
                  <p className="cpm-section-subtitle">Basic workspace metadata and branding</p>
                </div>
              </div>

              <div className="cpm-grid-2">
                <label className="cpm-field">
                  <div className="field-label-row">
                    <span>Project name <span className="required-mark">*</span></span>
                    <span className="field-counter">{name.length}/100</span>
                  </div>
                  <input
                    autoFocus
                    required
                    maxLength={100}
                    className="cpm-input"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError('');
                    }}
                    placeholder="e.g. Design System 2.0, Cloud Engine"
                    disabled={busy}
                  />
                </label>

                <label className="cpm-field">
                  <span className="field-label-text">Category</span>
                  <select
                    className="cpm-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={busy}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="cpm-field">
                <div className="field-label-row">
                  <span>Description <span className="field-optional">Optional</span></span>
                  <span className="field-counter">{description.length}/500</span>
                </div>
                <textarea
                  rows={2}
                  maxLength={500}
                  className="cpm-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this project about? Goals, team mission, key milestones..."
                  disabled={busy}
                />
              </label>

              <div className="cpm-field">
                <span className="field-label-text">
                  Project thumbnail / logo <span className="field-optional">Optional</span>
                </span>
                <ProjectThumbnailUpload
                  value={thumbnail}
                  onChange={(url) => setThumbnail(url)}
                  onError={(msg) => setError(msg)}
                  disabled={busy}
                />
              </div>
            </div>

            {/* Section 2: Project Contributors */}
            <div className="cpm-section">
              <div className="cpm-section-head">
                <div className="cpm-section-title-wrap">
                  <h3 className="cpm-section-title">Project Contributors</h3>
                  <p className="cpm-section-subtitle">
                    Invite registered team members and assign their project-specific roles
                  </p>
                </div>

                <button
                  type="button"
                  className="dashboard-button secondary btn-compact"
                  onClick={handleAddContributor}
                  disabled={busy}
                >
                  <Plus size={14} /> Add Contributor
                </button>
              </div>

              <div className="contributors-list-wrapper">
                {contributors.length === 0 ? (
                  <div className="contributors-empty-hint">
                    <Users size={16} />
                    <span>
                      No contributors added yet. You can invite team members now or later from the project workspace.
                    </span>
                    <button
                      type="button"
                      className="dashboard-button secondary btn-compact"
                      onClick={handleAddContributor}
                      disabled={busy}
                    >
                      <Plus size={13} /> Add Contributor
                    </button>
                  </div>
                ) : (
                  contributors.map((contrib, idx) => {
                    const rowError = fieldErrors[contrib.key] || {};
                    const excluded = selectedUserIds.filter(
                      (id) => id !== (contrib.user?._id || contrib.user?.id)
                    );

                    return (
                      <div
                        key={contrib.key}
                        className={`contributor-entry-row ${
                          rowError.user || rowError.role ? 'has-error' : ''
                        }`}
                      >
                        <ContributorSearchInput
                          selectedUser={contrib.user}
                          onSelectUser={(u) => handleUpdateContributorUser(contrib.key, u)}
                          onClearUser={() => handleUpdateContributorUser(contrib.key, null)}
                          excludedUserIds={excluded}
                          currentUserId={currentUserId}
                          disabled={busy}
                          error={Boolean(rowError.user)}
                        />

                        <RoleDropdown
                          roles={roles}
                          selectedRoleId={contrib.roleId}
                          onSelectRole={(r) => handleUpdateContributorRole(contrib.key, r)}
                          onOpenCreateRole={() => handleOpenCreateRole(contrib.key)}
                          disabled={busy || rolesLoading}
                          error={Boolean(rowError.role)}
                        />

                        <button
                          type="button"
                          className="contributor-remove-btn"
                          onClick={() => handleRemoveContributor(contrib.key)}
                          disabled={busy}
                          title="Remove contributor"
                          aria-label={`Remove contributor ${idx + 1}`}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Error Message Alert */}
            {error && (
              <div className="dashboard-error" role="alert">
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{error}</span>
                <button
                  type="button"
                  onClick={() => setError('')}
                  aria-label="Dismiss error"
                  style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer' }}
                >
                  <X size={13} />
                </button>
              </div>
            )}

            <div style={{ display: 'none' }}>
              {/* Invisible submit button to allow form submission via Enter key */}
              <button type="submit" />
            </div>
          </form>

          <footer className="cpm-footer">
            <div className="cpm-footer-left">
              {contributors.length > 0 && (
                <span>
                  {contributors.length} {contributors.length === 1 ? 'invitation' : 'invitations'} queued
                </span>
              )}
            </div>

            <div className="cpm-footer-actions">
              <button
                type="button"
                className="dashboard-button secondary"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dashboard-button primary"
                onClick={handleSubmit}
                disabled={busy || !name.trim()}
              >
                {busy ? (
                  <>
                    <RefreshCw size={15} className="spin-icon" /> Creating project...
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Create Project
                  </>
                )}
              </button>
            </div>
          </footer>
        </section>
      </div>

      {/* Nested Modal for Creating Platform Contributor Role */}
      <CreateRoleModal
        isOpen={isCreateRoleOpen}
        onClose={() => {
          setIsCreateRoleOpen(false);
          setActiveContributorKeyForNewRole(null);
        }}
        onRoleCreated={handleRoleCreated}
      />
    </>
  );
}
