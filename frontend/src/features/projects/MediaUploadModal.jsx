import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Image,
  Video,
  FileText,
  AlertCircle,
  Loader2,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { uploadRoleMedia } from '../../services/cloudinary';

const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

const ACCEPTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
];

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function MediaUploadModal({
  isOpen,
  onClose,
  projectId,
  role,
  onUploaded,
}) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPreviewUrl('');
      setTitle('');
      setDescription('');
      setTagsInput('');
      setError('');
      setUploading(false);
      setUploadProgress(0);
    }
  }, [isOpen]);

  // Clean up object URL when file changes
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const roleId = role?._id || role?.id;
  const roleName = role?.name || 'Workspace';

  const validateAndSetFile = (selectedFile) => {
    setError('');
    if (!selectedFile) return;

    const isImage =
      ACCEPTED_IMAGE_TYPES.includes(selectedFile.type) ||
      selectedFile.name.match(/\.(png|jpe?g|webp|gif|svg)$/i);
    const isVideo =
      ACCEPTED_VIDEO_TYPES.includes(selectedFile.type) ||
      selectedFile.name.match(/\.(mp4|webm|mov)$/i);

    if (!isImage && !isVideo) {
      setError('Please select a valid image (PNG, JPG, WEBP, GIF, SVG) or video (MP4, WEBM, MOV).');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setError(`File is too large (${formatBytes(selectedFile.size)}). Maximum supported size is 100MB.`);
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setFile(selectedFile);
    setPreviewUrl(objectUrl);

    // Auto-prefill title if currently empty
    if (!title.trim()) {
      const defaultTitle = selectedFile.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .trim();
      setTitle(defaultTitle.charAt(0).toUpperCase() + defaultTitle.slice(1));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleClearFile = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select an image or video file to upload.');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a title for this media resource.');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress(15);

    try {
      // 1. Upload media to Cloudinary (backend signed)
      setUploadProgress(35);
      const uploadResult = await uploadRoleMedia(file, {
        projectId,
        roleId,
        title: title.trim(),
      });

      setUploadProgress(75);

      // 2. Parse tags
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      // 3. Post resource metadata to backend
      const res = await fetch(`/api/projects/${projectId}/workspaces/${encodeURIComponent(roleId)}/resources`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          fileName: file.name,
          fileUrl: uploadResult.url,
          publicId: uploadResult.publicId || '',
          resourceType: uploadResult.resourceType || (file.type.startsWith('video/') ? 'video' : 'image'),
          format: uploadResult.format || file.name.split('.').pop()?.toLowerCase(),
          width: uploadResult.width,
          height: uploadResult.height,
          duration: uploadResult.duration,
          fileSize: file.size,
          tags,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save resource record in database');
      }

      setUploadProgress(100);
      if (onUploaded) {
        onUploaded(data.resource);
      }
      onClose();
    } catch (err) {
      console.error('Media upload error:', err);
      setError(err.message || 'Media upload failed. Please verify network and try again.');
    } finally {
      setUploading(false);
    }
  };

  const isVideo =
    file &&
    (file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov)$/i));

  return (
    <div className="rw-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="rw-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="rw-modal-header">
          <div className="rw-modal-header-info">
            <span className="rw-modal-pretitle">{roleName} Workspace</span>
            <h2 className="rw-modal-title">Upload Media Asset</h2>
          </div>
          <button
            type="button"
            className="rw-modal-close-btn"
            onClick={onClose}
            disabled={uploading}
            aria-label="Close upload modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="rw-modal-body">
          {error && (
            <div className="rw-modal-alert error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Drop Zone / Preview */}
          {!file ? (
            <div
              className={`rw-dropzone ${isDragging ? 'is-dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,video/webm,video/quicktime,.mov"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <div className="rw-dropzone-icon">
                <Upload size={28} />
              </div>
              <div className="rw-dropzone-text">
                <p className="rw-dropzone-primary">
                  <b>Click to upload</b> or drag and drop
                </p>
                <p className="rw-dropzone-secondary">
                  PNG, JPG, WEBP, GIF, SVG, MP4, WEBM, MOV (up to 100MB)
                </p>
              </div>
            </div>
          ) : (
            <div className="rw-preview-box">
              <div className="rw-preview-media">
                {isVideo ? (
                  <video src={previewUrl} controls className="rw-preview-video" />
                ) : (
                  <img src={previewUrl} alt="Preview" className="rw-preview-image" />
                )}
              </div>
              <div className="rw-preview-meta">
                <div className="rw-preview-file-info">
                  <span className="rw-preview-badge">
                    {isVideo ? <Video size={12} /> : <Image size={12} />}
                    {file.name.split('.').pop()?.toUpperCase()}
                  </span>
                  <span className="rw-preview-filename" title={file.name}>
                    {file.name}
                  </span>
                  <span className="rw-preview-size">{formatBytes(file.size)}</span>
                </div>
                <div className="rw-preview-actions">
                  <button
                    type="button"
                    className="rw-btn-text-danger"
                    onClick={handleClearFile}
                    disabled={uploading}
                  >
                    <Trash2 size={14} />
                    <span>Change File</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Title Field */}
          <div className="rw-form-group">
            <label htmlFor="media-title">
              Resource Title <span className="rw-required">*</span>
            </label>
            <input
              id="media-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dashboard Navigation Wireframe"
              className="rw-input"
              disabled={uploading}
              required
            />
          </div>

          {/* Description Field */}
          <div className="rw-form-group">
            <label htmlFor="media-desc">Description (Optional)</label>
            <textarea
              id="media-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add technical context, Jira ticket reference, or review notes..."
              className="rw-textarea"
              disabled={uploading}
            />
          </div>

          {/* Tags Field */}
          <div className="rw-form-group">
            <label htmlFor="media-tags">Tags (Optional)</label>
            <input
              id="media-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. ui, mockup, v2, mobile (comma separated)"
              className="rw-input"
              disabled={uploading}
            />
          </div>

          {/* Upload Progress Bar */}
          {uploading && (
            <div className="rw-upload-progress">
              <div className="rw-progress-bar-bg">
                <div
                  className="rw-progress-bar-fill"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="rw-progress-info">
                <span>Uploading asset to Cloudinary...</span>
                <span>{uploadProgress}%</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="rw-modal-footer">
            <button
              type="button"
              className="rw-btn-secondary"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rw-btn-primary"
              disabled={!file || !title.trim() || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 size={15} className="spin-animation" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload size={15} />
                  <span>Upload Asset</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
