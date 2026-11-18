import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  FileText,
  FileCode,
  File,
  AlertCircle,
  Loader2,
  Trash2,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { uploadRoleDocument } from '../../services/cloudinary';
import { parseDocFile } from '../../services/docParser';

const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'md', 'markdown', 'txt'];
const MAX_DOC_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function DocumentUploadModal({
  isOpen,
  onClose,
  projectId,
  role,
  onUploaded,
}) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [parsedPreview, setParsedPreview] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setTitle('');
      setDescription('');
      setTagsInput('');
      setParsedPreview(null);
      setError('');
      setUploading(false);
      setUploadProgress(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const roleId = role?._id || role?.id;
  const roleName = role?.name || 'Workspace';

  const validateAndSetFile = async (selectedFile) => {
    setError('');
    if (!selectedFile) return;

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError('Please select a supported document (.pdf, .docx, .md, .txt).');
      return;
    }

    if (selectedFile.size > MAX_DOC_SIZE_BYTES) {
      setError(`File is too large (${formatBytes(selectedFile.size)}). Maximum supported size is 50MB.`);
      return;
    }

    setFile(selectedFile);

    // Auto-prefill title
    if (!title.trim()) {
      const defaultTitle = selectedFile.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .trim();
      setTitle(defaultTitle.charAt(0).toUpperCase() + defaultTitle.slice(1));
    }

    // Parse document client-side for live preview
    setParsing(true);
    try {
      const parsed = await parseDocFile(selectedFile);
      setParsedPreview(parsed);
    } catch (parseErr) {
      console.warn('Local parsing preview notice:', parseErr);
      setParsedPreview(null);
    } finally {
      setParsing(false);
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
    setFile(null);
    setParsedPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a document file to upload.');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a document title.');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress(15);

    try {
      // 1. Upload to Cloudinary (backend signed)
      setUploadProgress(35);
      const uploadResult = await uploadRoleDocument(file, {
        projectId,
        roleId,
        title: title.trim(),
      });

      setUploadProgress(75);

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const ext = file.name.split('.').pop()?.toLowerCase();
      let format = ext;
      if (ext === 'docx') format = 'docx';
      else if (ext === 'md' || ext === 'markdown') format = 'markdown';
      else if (ext === 'txt') format = 'text';
      else if (ext === 'pdf') format = 'pdf';

      // 2. Post document metadata to backend
      const res = await fetch(`/api/projects/${projectId}/workspaces/${encodeURIComponent(roleId)}/documents`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          fileName: file.name,
          fileUrl: uploadResult.url,
          publicId: uploadResult.publicId || '',
          format,
          content: parsedPreview?.html || parsedPreview?.rawContent || '',
          fileSize: file.size,
          pageCount: uploadResult.pages || 1,
          tags,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save document in database');
      }

      setUploadProgress(100);
      if (onUploaded) {
        onUploaded(data.document);
      }
      onClose();
    } catch (err) {
      console.error('Document upload error:', err);
      setError(err.message || 'Document upload failed. Please verify connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  const ext = file ? file.name.split('.').pop()?.toLowerCase() : '';

  return (
    <div className="rw-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="rw-modal-card rw-modal-doc" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="rw-modal-header">
          <div className="rw-modal-header-info">
            <span className="rw-modal-pretitle">{roleName} Workspace</span>
            <h2 className="rw-modal-title">Upload Project Document</h2>
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
                accept=".pdf,.docx,.md,.markdown,.txt"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <div className="rw-dropzone-icon">
                <FileText size={28} />
              </div>
              <div className="rw-dropzone-text">
                <p className="rw-dropzone-primary">
                  <b>Click to choose document</b> or drag and drop
                </p>
                <p className="rw-dropzone-secondary">
                  PDF (.pdf), Word (.docx), Markdown (.md), Plain text (.txt) up to 50MB
                </p>
              </div>
            </div>
          ) : (
            <div className="rw-doc-preview-wrapper">
              <div className="rw-preview-meta">
                <div className="rw-preview-file-info">
                  <span className={`rw-doc-format-badge badge-${ext}`}>
                    {ext.toUpperCase()}
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

              {/* Live Parsed Preview Excerpt */}
              {parsing ? (
                <div className="rw-doc-parsing-state">
                  <Loader2 size={16} className="spin-animation" />
                  <span>Parsing document structure...</span>
                </div>
              ) : parsedPreview?.html ? (
                <div className="rw-doc-parsed-excerpt">
                  <div className="rw-parsed-header">
                    <Eye size={13} />
                    <span>Live Document Preview (Extracted)</span>
                  </div>
                  <div
                    className="rw-parsed-content"
                    dangerouslySetInnerHTML={{ __html: parsedPreview.html }}
                  />
                </div>
              ) : ext === 'pdf' ? (
                <div className="rw-doc-pdf-ready-notice">
                  <FileText size={20} />
                  <div>
                    <b>PDF ready for upload</b>
                    <p>Will be indexed with native PDF viewer and full-screen inspection.</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Title Field */}
          <div className="rw-form-group">
            <label htmlFor="doc-title">
              Document Title <span className="rw-required">*</span>
            </label>
            <input
              id="doc-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. API Specification v1.0 or System Architecture"
              className="rw-input"
              disabled={uploading}
              required
            />
          </div>

          {/* Description Field */}
          <div className="rw-form-group">
            <label htmlFor="doc-desc">Description (Optional)</label>
            <textarea
              id="doc-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summarize document purpose, key requirements, or implementation notes..."
              className="rw-textarea"
              disabled={uploading}
            />
          </div>

          {/* Tags Field */}
          <div className="rw-form-group">
            <label htmlFor="doc-tags">Tags (Optional)</label>
            <input
              id="doc-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. prd, architecture, spec, backend (comma separated)"
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
                <span>Saving document...</span>
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
                  <span>Upload Document</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
