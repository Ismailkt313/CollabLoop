import React, { useState, useRef } from 'react';
import { Upload, X, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { uploadSignedMedia } from '../../services/cloudinary';

export default function ProjectThumbnailUpload({ value, onChange, onError, disabled }) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(value || '');
  const fileInputRef = useRef(null);

  // Sync if external value changes
  React.useEffect(() => {
    if (value !== undefined) {
      setPreviewUrl(value);
    }
  }, [value]);

  const handleFile = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onError?.('Please select a valid image file (PNG, JPG, WebP, SVG).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      onError?.('Image size must be under 8MB.');
      return;
    }

    // Show instant local preview
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setIsUploading(true);

    try {
      const res = await uploadSignedMedia(file, { folder: 'collabloop/thumbnails' });
      if (res?.url) {
        setPreviewUrl(res.url);
        onChange?.(res.url, res.publicId);
      } else {
        throw new Error('Image upload failed to return a URL.');
      }
    } catch (err) {
      console.error('Thumbnail upload failed:', err);
      onError?.(err.message || 'Failed to upload image. Please try again.');
      // Keep preview or reset if failed
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    setPreviewUrl('');
    onChange?.('', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="thumbnail-upload-container">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        disabled={disabled || isUploading}
      />

      {previewUrl ? (
        <div className="thumbnail-preview-card">
          <div className="thumbnail-image-wrapper">
            <img src={previewUrl} alt="Project preview" className="thumbnail-preview-img" />
            {isUploading && (
              <div className="thumbnail-upload-overlay">
                <RefreshCw size={20} className="spin-icon" />
                <span>Uploading...</span>
              </div>
            )}
          </div>
          <div className="thumbnail-preview-actions">
            <button
              type="button"
              className="dashboard-button secondary btn-compact"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
            >
              Replace image
            </button>
            <button
              type="button"
              className="dashboard-button secondary btn-compact btn-danger"
              onClick={handleRemove}
              disabled={disabled || isUploading}
              aria-label="Remove image"
            >
              <X size={14} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`thumbnail-dropzone ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
          aria-label="Upload project thumbnail"
        >
          <div className="dropzone-icon-box">
            <ImageIcon size={20} />
          </div>
          <div className="dropzone-text">
            <span className="dropzone-primary-text">
              <span className="text-highlight">Click to upload</span> or drag and drop
            </span>
            <span className="dropzone-sub-text">PNG, JPG, WebP, or SVG (max 8MB)</span>
          </div>
        </div>
      )}
    </div>
  );
}
