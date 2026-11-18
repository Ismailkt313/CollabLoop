import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  FileCode,
  Calendar,
  User,
  Tag,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { marked } from 'marked';
import PdfReaderView from '../../components/PdfReaderView';
import { parseDocFile } from '../../services/docParser';

function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function DocumentViewerModal({
  doc,
  isOpen,
  onClose,
  onDelete,
  canDelete = false,
}) {
  const [loading, setLoading] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !doc) {
      setRenderedHtml('');
      setError('');
      setLoading(false);
      return;
    }

    const fmt = (doc.format || '').toLowerCase();

    // 1. If PDF, PdfReaderView handles rendering
    if (fmt === 'pdf' || doc.fileUrl?.match(/\.pdf(\?.*)?$/i)) {
      return;
    }

    // 2. If already has content HTML / markdown
    if (doc.content) {
      if (fmt === 'markdown' || fmt === 'md') {
        try {
          setRenderedHtml(marked.parse(doc.content));
        } catch {
          setRenderedHtml(`<pre>${doc.content}</pre>`);
        }
      } else if (fmt === 'text' || fmt === 'txt') {
        setRenderedHtml(`<div class="doc-text-body">${doc.content.replace(/\n/g, '<br/>')}</div>`);
      } else {
        // Assume HTML or raw content
        setRenderedHtml(doc.content);
      }
      return;
    }

    // 3. Otherwise, if fileUrl exists, fetch and parse locally
    if (doc.fileUrl) {
      setLoading(true);
      setError('');
      fetch(doc.fileUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch document (${res.status})`);
          return res.blob();
        })
        .then(async (blob) => {
          const fakeFile = new File([blob], doc.fileName || doc.title, {
            type: blob.type,
          });
          const parsed = await parseDocFile(fakeFile);
          setRenderedHtml(parsed.html || `<pre>${parsed.rawContent}</pre>`);
        })
        .catch((err) => {
          console.warn('Document fetch/parsing error:', err);
          setError('Could not load parsed document preview. You can still download or open the original file.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, doc]);

  if (!isOpen || !doc) return null;

  const fmt = (doc.format || 'doc').toLowerCase();
  const isPdf = fmt === 'pdf' || doc.fileUrl?.match(/\.pdf(\?.*)?$/i);
  const uploader = doc.uploadedBy || {};
  const formattedDate = doc.createdAt
    ? new Date(doc.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <div className="rw-modal-overlay rw-viewer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="rw-viewer-container" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="rw-viewer-header">
          <div className="rw-viewer-meta">
            <span className={`rw-doc-format-badge badge-${fmt}`}>
              {fmt.toUpperCase()}
            </span>
            <div className="rw-viewer-titles">
              <h2 className="rw-viewer-title">{doc.title}</h2>
              <span className="rw-viewer-sub">
                {uploader.name || `@${uploader.username}` || 'Team member'} · {formattedDate}
                {doc.fileSize ? ` · ${formatBytes(doc.fileSize)}` : ''}
              </span>
            </div>
          </div>

          <div className="rw-viewer-actions">
            {doc.fileUrl && (
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noreferrer"
                download={doc.fileName || `${doc.title}.${fmt}`}
                className="rw-viewer-btn"
                title="Download Document"
              >
                <Download size={15} />
                <span>Download</span>
              </a>
            )}

            {doc.fileUrl && (
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="rw-viewer-btn"
                title="Open original file in new tab"
              >
                <ExternalLink size={15} />
                <span>Open Raw</span>
              </a>
            )}

            {canDelete && onDelete && (
              <button
                type="button"
                className="rw-viewer-btn rw-btn-delete"
                onClick={() => onDelete(doc)}
                title="Delete Document"
              >
                <span>Delete</span>
              </button>
            )}

            <button
              type="button"
              className="rw-viewer-close-btn"
              onClick={onClose}
              aria-label="Close document viewer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Viewer Main Body */}
        <div className="rw-viewer-body">
          {isPdf ? (
            <div className="rw-pdf-container">
              <PdfReaderView
                doc={{
                  title: doc.title,
                  fileName: doc.fileName || doc.title,
                  fileUrl: doc.fileUrl,
                  publicId: doc.publicId,
                  pageCount: doc.pageCount,
                }}
                onDownload={() => {
                  if (doc.fileUrl) window.open(doc.fileUrl, '_blank');
                }}
              />
            </div>
          ) : loading ? (
            <div className="rw-viewer-loading">
              <Loader2 size={32} className="spin-animation" />
              <p>Rendering document content...</p>
            </div>
          ) : error ? (
            <div className="rw-viewer-error-box">
              <AlertCircle size={28} />
              <p>{error}</p>
              {doc.fileUrl && (
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rw-btn-primary"
                >
                  <Download size={15} />
                  <span>Download Original File</span>
                </a>
              )}
            </div>
          ) : (
            <div className="rw-doc-rendered-pane">
              {doc.description && (
                <div className="rw-doc-meta-callout">
                  <p>{doc.description}</p>
                </div>
              )}
              <div
                className="rw-doc-html-content"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            </div>
          )}
        </div>

        {/* Footer info bar */}
        {doc.tags && doc.tags.length > 0 && (
          <div className="rw-viewer-footer">
            <div className="rw-viewer-tags">
              <Tag size={13} />
              {doc.tags.map((tag, idx) => (
                <span key={idx} className="rw-chip-tag">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
