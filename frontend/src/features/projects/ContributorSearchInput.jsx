import React, { useState, useEffect, useRef } from 'react';
import { Search, X, User, Check, RefreshCw, Mail } from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '../../services/apiConfig';

const api = async (path) => {
  const res = await fetch(buildApiUrl(path), {
    credentials: 'include',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
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

export default function ContributorSearchInput({
  selectedUser,
  onSelectUser,
  onClearUser,
  excludedUserIds = [],
  currentUserId,
  disabled = false,
  error = false,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchError, setSearchError] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setSearchError('');

    const timer = setTimeout(async () => {
      try {
        const data = await api(`/users/search?q=${encodeURIComponent(term)}`);
        // Filter out current user and already added users
        const filtered = (data.users || []).filter((u) => {
          const uid = (u._id || u.id).toString();
          if (currentUserId && uid === currentUserId.toString()) return false;
          if (excludedUserIds.includes(uid)) return false;
          return true;
        });
        setResults(filtered);
        setIsOpen(true);
      } catch (err) {
        setSearchError(err.message || 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query, currentUserId, excludedUserIds]);

  const handleSelect = (user) => {
    onSelectUser(user);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const handleClear = () => {
    onClearUser();
    setQuery('');
    setResults([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="contributor-search-container" ref={containerRef}>
      {selectedUser ? (
        <div className="selected-contributor-chip">
          <div className="chip-avatar-box">
            {selectedUser.avatar ? (
              <img src={selectedUser.avatar} alt={selectedUser.name} className="chip-avatar-img" />
            ) : (
              <span className="chip-avatar-fallback">
                {initials(selectedUser.name || selectedUser.username)}
              </span>
            )}
          </div>
          <div className="chip-identity">
            <span className="chip-name">{selectedUser.name}</span>
            <span className="chip-handle">@{selectedUser.username}</span>
          </div>
          {!disabled && (
            <button
              type="button"
              className="chip-remove-btn"
              onClick={handleClear}
              aria-label={`Change or remove ${selectedUser.name}`}
              title="Change user"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <div className={`search-input-wrapper ${error ? 'has-error' : ''}`}>
          <Search size={14} className="search-field-icon" />
          <input
            ref={inputRef}
            type="text"
            className="contributor-search-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!isOpen && e.target.value.trim().length >= 2) setIsOpen(true);
            }}
            onFocus={() => {
              if (query.trim().length >= 2 && results.length > 0) setIsOpen(true);
            }}
            placeholder="Search by @username or email..."
            disabled={disabled}
            autoComplete="off"
          />
          {loading && <RefreshCw size={13} className="spin-icon search-loading-icon" />}
          {query && !loading && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setQuery('');
                setResults([]);
              }}
              aria-label="Clear query"
            >
              <X size={13} />
            </button>
          )}

          {isOpen && (
            <div className="contributor-search-dropdown" role="listbox">
              {loading ? (
                <div className="search-status-item">
                  <RefreshCw size={14} className="spin-icon" />
                  <span>Searching users...</span>
                </div>
              ) : results.length > 0 ? (
                results.map((user) => (
                  <div
                    key={user._id || user.id}
                    className="user-search-result-item"
                    onClick={() => handleSelect(user)}
                    role="option"
                    aria-selected={false}
                  >
                    <div className="result-avatar-box">
                      {user.avatar ? (
                        <img src={user.avatar} alt="" className="result-avatar-img" />
                      ) : (
                        <span className="result-avatar-fallback">
                          {initials(user.name || user.username)}
                        </span>
                      )}
                    </div>
                    <div className="result-user-info">
                      <div className="result-name-row">
                        <span className="result-name">{user.name}</span>
                        <span className="result-username">@{user.username}</span>
                      </div>
                      {user.email && (
                        <div className="result-email-row">
                          <Mail size={11} className="email-icon" />
                          <span className="result-email">{user.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="search-status-item no-matches">
                  {query.trim().length < 2
                    ? 'Type at least 2 characters...'
                    : 'No registered users found matching query'}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
