import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Shield, RefreshCw, Upload, Image as ImageIcon } from 'lucide-react';
import { uploadSignedMedia } from '../../services/cloudinary';
import { buildApiUrl } from '../../services/apiConfig';

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

export default function CreateRoleModal({ isOpen, onClose, onRoleCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [cloudinaryPublicId, setCloudinaryPublicId] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setImageUrl('');
      setCloudinaryPublicId('');
      setImagePreview('');
      setError('');
      setBusy(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !busy && !isUploadingImage) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, busy, isUploadingImage, onClose]);

  if (!isOpen) return null;

  const handleImageFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Role image must be under 5MB.');
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);
    setIsUploadingImage(true);
    setError('');

    try {
      const res = await uploadSignedMedia(file, { folder: 'collabloop/roles' });
      if (res?.url) {
        setImageUrl(res.url);
        setImagePreview(res.url);
        setCloudinaryPublicId(res.publicId || '');
      } else {
        throw new Error('Image upload failed.');
      }
    } catch (err) {
      console.error('Role image upload error:', err);
      setError(err.message || 'Failed to upload role image.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    setCloudinaryPublicId('');
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Role name is required.');
      return;
    }
    if (trimmedName.length < 2 || trimmedName.length > 60) {
      setError('Role name must be between 2 and 60 characters.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const res = await api('/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim(),
          imageUrl: imageUrl || imagePreview || '',
          cloudinaryPublicId: cloudinaryPublicId || '',
        }),
      });

      if (res.role) {
        onRoleCreated(res.role);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to create role.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="role-modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-role-title"
    >
      <div className="role-modal-card">
        <header className="role-modal-header">
          <div className="role-modal-header-info">
            <span className="role-modal-badge">
              <Shield size={16} />
            </span>
            <div>
              <h3 id="create-role-title">Create Contributor Role</h3>
              <p>Add a reusable platform role for team contributors.</p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="role-modal-form">
          <label className="dashboard-form-field">
            <div className="field-label-row">
              <span>Role name <span className="required-mark">*</span></span>
              <span className="field-counter">{name.length}/60</span>
            </div>
            <input
              autoFocus
              required
              maxLength={60}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="e.g. Lead Mobile Engineer, UX Copywriter"
              disabled={busy}
            />
          </label>

          <label className="dashboard-form-field">
            <div className="field-label-row">
              <span>Description <span className="field-optional">Optional</span></span>
              <span className="field-counter">{description.length}/300</span>
            </div>
            <textarea
              rows={2}
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Primary team responsibilities and scope of this role..."
              disabled={busy}
            />
          </label>

          <div className="dashboard-form-field">
            <span className="field-label-text">
              Role badge / image <span className="field-optional">Optional</span>
            </span>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])}
              disabled={busy || isUploadingImage}
            />

            {imagePreview ? (
              <div className="role-image-preview-row">
                <div className="role-avatar-preview">
                  <img src={imagePreview} alt="Role badge" />
                  {isUploadingImage && (
                    <div className="role-avatar-uploading">
                      <RefreshCw size={14} className="spin-icon" />
                    </div>
                  )}
                </div>
                <div className="role-image-btn-group">
                  <button
                    type="button"
                    className="dashboard-button secondary btn-compact"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy || isUploadingImage}
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    className="dashboard-button secondary btn-compact btn-danger"
                    onClick={handleRemoveImage}
                    disabled={busy || isUploadingImage}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="role-image-picker-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy || isUploadingImage}
              >
                <ImageIcon size={16} />
                <span>Upload role icon or badge</span>
              </button>
            )}
          </div>

          {error && (
            <div className="dashboard-error role-error" role="alert">
              <span>{error}</span>
            </div>
          )}

          <div className="role-modal-actions">
            <button
              type="button"
              className="dashboard-button secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="dashboard-button primary"
              disabled={busy || isUploadingImage || !name.trim()}
            >
              {busy ? (
                <>
                  <RefreshCw size={14} className="spin-icon" /> Creating...
                </>
              ) : (
                <>
                  <Plus size={15} /> Save Role
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
