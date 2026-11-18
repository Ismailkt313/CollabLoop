import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Plus, Check, Shield, Briefcase } from 'lucide-react';

export default function RoleDropdown({
  roles = [],
  selectedRoleId,
  onSelectRole,
  onOpenCreateRole,
  disabled = false,
  error = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedRole = useMemo(() => {
    return roles.find((r) => (r._id || r.id) === selectedRoleId) || null;
  }, [roles, selectedRoleId]);

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [roles, search]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input on open
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (role) => {
    onSelectRole(role);
    setIsOpen(false);
    setSearch('');
  };

  const handleCreateNew = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    setSearch('');
    onOpenCreateRole();
  };

  return (
    <div className="role-dropdown-container" ref={dropdownRef}>
      <button
        type="button"
        className={`role-dropdown-trigger ${isOpen ? 'is-active' : ''} ${error ? 'has-error' : ''}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="role-trigger-label">
          {selectedRole ? (
            <>
              {selectedRole.imageUrl ? (
                <img
                  src={selectedRole.imageUrl}
                  alt=""
                  className="role-trigger-img"
                  loading="lazy"
                />
              ) : (
                <span className="role-trigger-badge">
                  <Shield size={13} />
                </span>
              )}
              <span className="role-trigger-name">{selectedRole.name}</span>
            </>
          ) : (
            <>
              <Briefcase size={14} className="role-placeholder-icon" />
              <span className="role-trigger-placeholder">Select project role...</span>
            </>
          )}
        </div>
        <ChevronDown size={14} className={`role-chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="role-dropdown-panel" role="listbox">
          <div className="role-dropdown-search-wrap">
            <Search size={14} className="search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="role-dropdown-search-input"
              placeholder="Filter roles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="role-dropdown-list">
            {filteredRoles.length > 0 ? (
              filteredRoles.map((role) => {
                const isSelected = (role._id || role.id) === selectedRoleId;
                return (
                  <div
                    key={role._id || role.id}
                    className={`role-option-item ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(role)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="role-option-mark">
                      {role.imageUrl ? (
                        <img src={role.imageUrl} alt="" className="role-option-img" />
                      ) : (
                        <span className="role-option-badge">
                          <Shield size={13} />
                        </span>
                      )}
                    </div>
                    <div className="role-option-copy">
                      <span className="role-option-name">{role.name}</span>
                      {role.description && (
                        <span className="role-option-desc">{role.description}</span>
                      )}
                    </div>
                    {isSelected && <Check size={14} className="role-check-icon" />}
                  </div>
                );
              })
            ) : (
              <div className="role-dropdown-empty">
                <span>No matching roles found</span>
              </div>
            )}
          </div>

          <div className="role-dropdown-footer">
            <button
              type="button"
              className="role-create-action-btn"
              onClick={handleCreateNew}
            >
              <Plus size={14} />
              <span>Create New Role</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
