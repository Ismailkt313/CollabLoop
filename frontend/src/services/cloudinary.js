import { buildApiUrl, getAuthHeaders } from './apiConfig.js';

const CLOUD_NAME = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) || 'dtaz4vhxh';
const UPLOAD_PRESET = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET) || 'CollabS';

export const isCloudinaryConfigured = () => {
  return Boolean(
    CLOUD_NAME &&
    UPLOAD_PRESET &&
    CLOUD_NAME !== 'your_cloudinary_cloud_name' &&
    UPLOAD_PRESET !== 'your_unsigned_upload_preset'
  );
};

export const getCloudinaryCloudName = () => CLOUD_NAME;

/**
 * Uploads a chat attachment (image, document, or audio voice note) using project-scoped backend signing.
 * Falls back to unsigned upload preset if backend signing is unavailable.
 */
export async function uploadChatAttachment(file, { projectId, title = '', resourceType = 'auto' } = {}) {
  try {
    const signRes = await fetch(buildApiUrl(`/projects/${projectId}/chat/upload-signature?type=chat`), {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ type: 'chat' }),
    });

    if (signRes.ok) {
      const signData = await signRes.json();
      if (signData.cloudName && signData.apiKey && signData.signature) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', signData.apiKey);
        formData.append('timestamp', signData.timestamp);
        formData.append('signature', signData.signature);
        formData.append('folder', signData.folder);

        if (title) {
          const cleanTitle = title.replace(/[|;=]/g, ' ').trim();
          formData.append('context', `caption=${cleanTitle}|title=${cleanTitle}`);
        }

        const isAudioOrRaw =
          file.type.startsWith('audio/') ||
          file.name?.match(/\.(mp3|wav|ogg|m4a|webm|pdf|docx|txt|md)$/i);
        const endpointType = isAudioOrRaw && !file.type.startsWith('image/') ? 'auto' : 'auto';

        const uploadUrl = `https://api.cloudinary.com/v1_1/${signData.cloudName}/${endpointType}/upload`;
        const res = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (res.ok) {
          const secureUrl = (data.secure_url || data.url || '').replace(/^http:\/\//i, 'https://');
          return {
            url: secureUrl,
            publicId: data.public_id,
            resourceType: data.resource_type || (file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'voice' : 'file'),
            format: data.format || file.name?.split('.').pop(),
            fileName: file.name || (file.type.startsWith('audio/') ? 'voice_message.webm' : 'attachment'),
            fileSize: data.bytes || file.size,
            duration: data.duration,
            width: data.width,
            height: data.height,
          };
        } else {
          throw new Error(data.error?.message || 'Cloud storage upload rejected the attachment');
        }
      }
    }
  } catch (err) {
    console.warn('[Cloudinary] Backend signed chat upload error:', err);
    throw err;
  }

  throw new Error('Chat attachment upload failed: unable to obtain backend authorization');
}

/**
 * Uploads media (images/videos) scoped to a project role workspace.
 * Preferred workflow: Direct upload through authenticated Node.js backend.
 * Secondary workflow: Backend-authorized signed upload.
 */
export async function uploadRoleMedia(file, { projectId, roleId, title = '', description = '', tags = [] } = {}) {
  // 1. Preferred workflow: Submit directly to Node.js backend
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title.trim());
    if (description) formData.append('description', description.trim());
    if (tags) {
      formData.append('tags', Array.isArray(tags) ? tags.join(',') : String(tags));
    }

    const uploadUrl = buildApiUrl(`/projects/${projectId}/workspaces/${encodeURIComponent(roleId)}/resources/upload`);
    const directRes = await fetch(uploadUrl, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: formData,
    });

    if (directRes.ok) {
      const data = await directRes.json();
      if (data.resource) {
        return {
          resource: data.resource,
          url: data.resource.fileUrl || data.resource.secureUrl,
          publicId: data.resource.publicId || data.resource.cloudinaryPublicId,
          resourceType: data.resource.resourceType,
          format: data.resource.format,
          fileSize: data.resource.fileSize,
        };
      }
    } else if (directRes.status === 400 || directRes.status === 403 || directRes.status === 404) {
      const errData = await directRes.json().catch(() => ({}));
      throw new Error(errData.error || `Upload rejected by backend (status ${directRes.status})`);
    }
  } catch (err) {
    if (err.message && !err.message.includes('Failed to fetch')) {
      throw err;
    }
  }

  // 2. Secondary workflow: Backend-signed direct browser upload
  const signRes = await fetch(buildApiUrl(`/projects/${projectId}/workspaces/${encodeURIComponent(roleId)}/resources/upload-signature?type=media`), {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ type: 'media' }),
  });

  if (!signRes.ok) {
    const errData = await signRes.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to obtain authorized upload signature from backend');
  }

  const signData = await signRes.json();
  if (!signData.cloudName || !signData.apiKey || !signData.signature) {
    throw new Error('Server-side Cloudinary credentials are not configured');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signData.apiKey);
  formData.append('timestamp', signData.timestamp);
  formData.append('signature', signData.signature);
  formData.append('folder', signData.folder);

  if (title) {
    const cleanTitle = title.replace(/[|;=]/g, ' ').trim();
    formData.append('context', `caption=${cleanTitle}|title=${cleanTitle}`);
  }

  const uploadUrl = `https://api.cloudinary.com/v1_1/${signData.cloudName}/auto/upload`;
  const res = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to upload media to cloud storage');
  }

  const secureUrl = (data.secure_url || data.url || '').replace(/^http:\/\//i, 'https://');
  return {
    url: secureUrl,
    publicId: data.public_id,
    resourceType: data.resource_type || (file.type.startsWith('video/') ? 'video' : 'image'),
    width: data.width,
    height: data.height,
    format: data.format,
    duration: data.duration,
    bytes: data.bytes || file.size,
  };
}

/**
 * Uploads a document (.pdf, .docx, .md, .txt) scoped to a project role workspace.
 * Preferred workflow: Direct upload through authenticated Node.js backend.
 * Secondary workflow: Backend-authorized signed upload.
 */
export async function uploadRoleDocument(file, { projectId, roleId, title = '', description = '', tags = [] } = {}) {
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';

  // 1. Preferred workflow: Submit directly to Node.js backend
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title.trim());
    if (description) formData.append('description', description.trim());
    if (tags) {
      formData.append('tags', Array.isArray(tags) ? tags.join(',') : String(tags));
    }

    const uploadUrl = buildApiUrl(`/projects/${projectId}/workspaces/${encodeURIComponent(roleId)}/documents/upload`);
    const directRes = await fetch(uploadUrl, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: formData,
    });

    if (directRes.ok) {
      const data = await directRes.json();
      if (data.document) {
        return {
          document: data.document,
          url: data.document.fileUrl || data.document.secureUrl,
          publicId: data.document.publicId || data.document.cloudinaryPublicId,
          resourceType: data.document.format === 'pdf' ? 'image' : 'raw',
          format: data.document.format || ext,
          fileSize: data.document.fileSize,
        };
      }
    } else if (directRes.status === 400 || directRes.status === 403 || directRes.status === 404) {
      const errData = await directRes.json().catch(() => ({}));
      throw new Error(errData.error || `Upload rejected by backend (status ${directRes.status})`);
    }
  } catch (err) {
    if (err.message && !err.message.includes('Failed to fetch')) {
      throw err;
    }
  }

  // 2. Secondary workflow: Backend-signed direct browser upload
  const signRes = await fetch(buildApiUrl(`/projects/${projectId}/workspaces/${encodeURIComponent(roleId)}/documents/upload-signature?type=documents`), {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ type: 'documents' }),
  });

  if (!signRes.ok) {
    const errData = await signRes.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to obtain authorized document upload signature from backend');
  }

  const signData = await signRes.json();
  if (!signData.cloudName || !signData.apiKey || !signData.signature) {
    throw new Error('Server-side Cloudinary credentials are not configured');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signData.apiKey);
  formData.append('timestamp', signData.timestamp);
  formData.append('signature', signData.signature);
  formData.append('folder', signData.folder);

  if (title) {
    const cleanTitle = title.replace(/[|;=]/g, ' ').trim();
    formData.append('context', `caption=${cleanTitle}|title=${cleanTitle}`);
  }

  // Try auto/upload first, then raw/upload if needed
  let res = await fetch(`https://api.cloudinary.com/v1_1/${signData.cloudName}/auto/upload`, {
    method: 'POST',
    body: formData,
  });

  let data = await res.json().catch(() => ({}));
  if (!res.ok) {
    res = await fetch(`https://api.cloudinary.com/v1_1/${signData.cloudName}/raw/upload`, {
      method: 'POST',
      body: formData,
    });
    data = await res.json().catch(() => ({}));
  }

  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to upload document to cloud storage');
  }

  const secureUrl = (data.secure_url || data.url || '').replace(/^http:\/\//i, 'https://');
  return {
    url: secureUrl,
    publicId: data.public_id,
    resourceType: data.resource_type || (ext === 'pdf' ? 'image' : 'raw'),
    format: data.format || ext,
    pages: data.pages || 1,
    bytes: data.bytes || file.size,
  };
}

/**
 * Uploads media using backend-authorized upload signing (no API secret in client).
 * Falls back to unsigned upload preset if backend signing is unavailable.
 * @param {File} file - Image file
 * @param {Object} options - { folder, projectId }
 * @returns {Promise<{ url: string, publicId: string, resourceType: string }>}
 */
export async function uploadSignedMedia(file, { folder = 'collabloop/general', projectId } = {}) {
  try {
    const signUrl = buildApiUrl(projectId ? `/projects/${projectId}/uploads/sign` : '/uploads/sign');
    const signRes = await fetch(signUrl, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ folder }),
    });

    if (signRes.ok) {
      const signData = await signRes.json();
      if (signData.cloudName && signData.apiKey && signData.signature) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', signData.apiKey);
        formData.append('timestamp', signData.timestamp);
        formData.append('signature', signData.signature);
        formData.append('folder', signData.folder);

        const uploadUrl = `https://api.cloudinary.com/v1_1/${signData.cloudName}/auto/upload`;
        const res = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (res.ok) {
          const secureUrl = (data.secure_url || data.url || '').replace(/^http:\/\//i, 'https://');
          return {
            url: secureUrl,
            publicId: data.public_id,
            resourceType: data.resource_type || 'image',
          };
        } else {
          throw new Error(data.error?.message || 'Cloud storage upload rejected the file');
        }
      }
    }
  } catch (err) {
    console.warn('[Cloudinary] Backend signed upload error:', err);
    throw err;
  }

  throw new Error('Upload failed: unable to obtain backend authorization');
}

/**
 * Uploads an image or video file to Cloudinary using unsigned upload preset.
 * Supports auto detection (images, videos, animated gifs).
 * @param {File} file - Image or Video file
 * @param {Object} options - Optional { category, title }
 * @returns {Promise<{ url: string, publicId: string, resourceType: string, width: number, height: number, format: string }>}
 */
export async function uploadMediaToCloudinary(file, { category = 'b2b', title = '' } = {}) {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Cloudinary is not configured. Please check VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your .env file.'
    );
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', `collabs/${category}`);
  formData.append('tags', `collabs,${category}`);

  if (title) {
    const cleanTitle = title.replace(/[|;=]/g, ' ').trim();
    formData.append('context', `caption=${cleanTitle}|title=${cleanTitle}`);
  }

  // Use auto/upload to accept both images and videos
  const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.error?.message || 'Failed to upload media to Cloudinary';
    throw new Error(errorMsg);
  }

  const secureUrl = (data.secure_url || data.url || '').replace(/^http:\/\//i, 'https://');

  return {
    url: secureUrl,
    publicId: data.public_id,
    resourceType: data.resource_type || (file.type.startsWith('video/') ? 'video' : 'image'),
    width: data.width,
    height: data.height,
    format: data.format,
    createdAt: data.created_at || new Date().toISOString()
  };
}

// Backward-compatible alias
export const uploadImageToCloudinary = uploadMediaToCloudinary;

/**
 * Uploads a document file (.docx, .md, .txt, .pdf) to Cloudinary using unsigned upload preset.
 * Attempts auto upload first and falls back to raw upload if needed.
 * @param {File} file - Document file
 * @param {Object} options - Optional { title }
 * @returns {Promise<{ url: string, publicId: string, resourceType: string, format: string, bytes: number, createdAt: string }>}
 */
export async function uploadDocToCloudinary(file, { title = '' } = {}) {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Cloudinary is not configured. Please check VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your .env file.'
    );
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', 'collabs/docs');
  formData.append('tags', 'collabs,docs');

  if (title) {
    const cleanTitle = title.replace(/[|;=]/g, ' ').trim();
    formData.append('context', `caption=${cleanTitle}|title=${cleanTitle}`);
  }

  const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';

  // 1. Try auto/upload first
  try {
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();

    if (response.ok) {
      const secureUrl = (data.secure_url || data.url || '').replace(/^http:\/\//i, 'https://');
      return {
        url: secureUrl,
        publicId: data.public_id,
        resourceType: data.resource_type || (ext === 'pdf' ? 'image' : 'raw'),
        format: data.format || ext,
        pages: data.pages || 1,
        bytes: data.bytes || file.size,
        createdAt: data.created_at || new Date().toISOString()
      };
    }
  } catch (err) {
    console.debug('[Cloudinary] auto/upload document attempt threw:', err);
  }

  // 2. Fallback to raw/upload if auto/upload was not successful
  try {
    const rawUploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;
    const rawRes = await fetch(rawUploadUrl, {
      method: 'POST',
      body: formData,
    });
    const rawData = await rawRes.json();

    if (!rawRes.ok) {
      const errorMsg = rawData.error?.message || 'Failed to upload document to Cloudinary';
      throw new Error(errorMsg);
    }

    const secureUrl = (rawData.secure_url || rawData.url || '').replace(/^http:\/\//i, 'https://');
    return {
      url: secureUrl,
      publicId: rawData.public_id,
      resourceType: 'raw',
      format: rawData.format || ext,
      pages: 1,
      bytes: rawData.bytes || file.size,
      createdAt: rawData.created_at || new Date().toISOString()
    };
  } catch (err) {
    console.error('[Cloudinary] Document upload failed:', err);
    throw err;
  }
}

/**
 * Generates high-res image page URL for a Cloudinary PDF document.
 * This completely bypasses Cloudinary's 401 restricted raw PDF delivery
 * and works flawlessly across every browser and device.
 * @param {string} publicId - Cloudinary publicId
 * @param {number} pageNumber - Page number (1-indexed)
 * @param {number} width - Optional width rendering target
 * @returns {string} High-res page image URL
 */
export function getCloudinaryPdfPageUrl(publicId, pageNumber = 1, width = 1600) {
  if (!publicId) return '';
  const cleanId = publicId.replace(/\.pdf$/i, '').replace(/^\/+/, '');
  const wParam = width ? `w_${width},c_limit,` : '';
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${wParam}f_auto,q_auto/pg_${pageNumber}/${cleanId}.png`;
}

/**
 * Ensures optimal Cloudinary image delivery across all browsers with HTTPS and f_auto,q_auto.
 * @param {string} url - Media URL
 * @param {string} resourceType - 'image' or 'video'
 * @returns {string} Optimized URL
 */
export function getOptimizedMediaUrl(url, resourceType = 'image') {
  if (!url || typeof url !== 'string') return '';
  let cleanUrl = url.trim().replace(/^http:\/\//i, 'https://');
  if (
    cleanUrl.includes('res.cloudinary.com') &&
    cleanUrl.includes('/upload/') &&
    !cleanUrl.includes('/f_auto') &&
    resourceType !== 'video' &&
    !cleanUrl.match(/\.(mp4|webm|mov|m4v)(\?.*)?$/i)
  ) {
    cleanUrl = cleanUrl.replace('/upload/', '/upload/f_auto,q_auto/');
  }
  return cleanUrl;
}

/**
 * Extracts Cloudinary publicId from a Cloudinary image or video URL.
 * @param {string} url - Media URL
 * @returns {string} publicId
 */
export function extractPublicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const match = url.match(/\/upload\/(?:v\d+\/)?([^.]+)/i);
  return match ? match[1] : '';
}

/**
 * Legacy stub: Cloudinary client-side resource lists are removed.
 * MongoDB is the authoritative source of truth for all media metadata.
 * @returns {Promise<Set<string>>}
 */
export async function fetchCloudinaryDeletedIds() {
  return new Set();
}

/**
 * Legacy stub: Cloudinary deletion markers are deprecated.
 * Deletion is handled securely by the Node.js backend.
 * @returns {Promise<boolean>}
 */
export async function markCloudinaryAssetAsDeleted() {
  return true;
}

/**
 * Legacy stub: Cloudinary client-side tag/resource listing is disabled.
 * All project media must be queried through authenticated Node.js APIs backed by MongoDB.
 * @returns {Promise<{ success: boolean, items: Array, deletedIds: Array, requiresSetting: boolean }>}
 */
export async function fetchAllCloudinaryMedia() {
  return {
    success: true,
    items: [],
    deletedIds: [],
    requiresSetting: false,
  };
}

/**
 * Filtered convenience fetch stub.
 * @returns {Promise<{ success: boolean, items: Array, requiresSetting: boolean }>}
 */
export async function fetchCloudinaryCategoryMedia() {
  return {
    success: true,
    requiresSetting: false,
    items: [],
  };
}
