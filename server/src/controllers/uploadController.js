import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import config from '../config/index.js';
import { Resource, Document } from '../models/index.js';
import {
  ALLOWED_IMAGE_EXTS,
  ALLOWED_IMAGE_MIMES,
  ALLOWED_VIDEO_EXTS,
  ALLOWED_VIDEO_MIMES,
  ALLOWED_DOC_EXTS,
  ALLOWED_DOC_MIMES,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  MAX_DOC_SIZE,
  validateBufferMagicBytes,
  resolveAndValidateRole,
} from '../middleware/uploadValidation.js';

// Configure official Cloudinary Node.js SDK
if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
}

// Multer memory storage (streaming upload to Cloudinary)
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max payload
  },
});

/**
 * Uploads a Buffer directly to Cloudinary using upload_stream.
 * @param {Buffer} buffer
 * @param {import('cloudinary').UploadApiOptions} options
 * @returns {Promise<import('cloudinary').UploadApiResponse>}
 */
export function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

/**
 * Direct Backend Upload: Role Media (Images & Videos)
 * POST /projects/:projectId/workspaces/:roleId/resources/upload
 */
export async function uploadDirectRoleResource(req, res, next) {
  try {
    const { projectId, roleId } = req.params;

    // 1. Validate role
    const role = await resolveAndValidateRole(roleId);
    if (!role) {
      return res.status(404).json({ error: `Contributor role '${roleId}' was not found` });
    }

    // 2. Validate membership & permissions
    const allowedRoles = ['owner', 'admin', 'contributor', 'member'];
    if (!allowedRoles.includes(req.membership?.projectRole)) {
      return res.status(403).json({ error: 'You do not have permission to upload assets in this project' });
    }

    // 3. Check file presence
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ error: 'No media file provided for upload' });
    }

    const ext = (file.originalname || '').split('.').pop()?.toLowerCase() || '';
    const isImage = ALLOWED_IMAGE_EXTS.has(ext) && (ALLOWED_IMAGE_MIMES.has(file.mimetype) || file.mimetype.startsWith('image/'));
    const isVideo = ALLOWED_VIDEO_EXTS.has(ext) && (ALLOWED_VIDEO_MIMES.has(file.mimetype) || file.mimetype.startsWith('video/'));

    if (!isImage && !isVideo) {
      return res.status(400).json({
        error: `Unsupported file type '${ext}'. Allowed media formats: PNG, JPG, JPEG, WEBP, GIF, SVG, MP4, WEBM, MOV.`,
      });
    }

    // 4. Validate file size
    if (isImage && file.size > MAX_IMAGE_SIZE) {
      return res.status(400).json({
        error: `Image exceeds maximum allowed size of 20MB (received ${(file.size / (1024 * 1024)).toFixed(1)}MB)`,
      });
    }
    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      return res.status(400).json({
        error: `Video exceeds maximum allowed size of 100MB (received ${(file.size / (1024 * 1024)).toFixed(1)}MB)`,
      });
    }

    // 5. Validate file content (magic bytes)
    if (!validateBufferMagicBytes(file.buffer, ext)) {
      return res.status(400).json({ error: 'File content does not match the stated file extension' });
    }

    // 6. Ensure Cloudinary credentials exist
    if (!config.cloudinary.cloudName || !config.cloudinary.apiKey || !config.cloudinary.apiSecret) {
      return res.status(503).json({ error: 'Server-side Cloudinary credentials are not configured' });
    }

    // 7. Upload to Cloudinary using Node.js SDK
    const folder = `collabloop/projects/${projectId}/roles/${role._id}/media`;
    const uploadResult = await uploadBufferToCloudinary(file.buffer, {
      folder,
      resource_type: isVideo ? 'video' : 'image',
    });

    const secureUrl = (uploadResult.secure_url || uploadResult.url || '').replace(/^http:\/\//i, 'https://');

    // 8. Parse tags & title
    const tags = Array.isArray(req.body.tags)
      ? req.body.tags
      : typeof req.body.tags === 'string'
      ? req.body.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const title = String(req.body.title || file.originalname || 'Untitled Resource').trim();

    // 9. Store metadata in MongoDB
    const resource = await Resource.create({
      projectId,
      roleId: role._id,
      uploadedBy: req.user.id,
      title,
      description: String(req.body.description || '').trim(),
      fileName: file.originalname,
      fileUrl: secureUrl,
      publicId: uploadResult.public_id,
      cloudinaryPublicId: uploadResult.public_id,
      resourceType: uploadResult.resource_type || (isVideo ? 'video' : 'image'),
      format: uploadResult.format || ext,
      fileSize: uploadResult.bytes || file.size,
      width: uploadResult.width,
      height: uploadResult.height,
      duration: uploadResult.duration,
      tags,
    });

    await resource.populate('uploadedBy', 'name username avatar');
    res.status(201).json({ resource });
  } catch (err) {
    next(err);
  }
}

/**
 * Direct Backend Upload: Role Document (.pdf, .docx, .md, .txt)
 * POST /projects/:projectId/workspaces/:roleId/documents/upload
 */
export async function uploadDirectRoleDocument(req, res, next) {
  try {
    const { projectId, roleId } = req.params;

    // 1. Validate role
    const role = await resolveAndValidateRole(roleId);
    if (!role) {
      return res.status(404).json({ error: `Contributor role '${roleId}' was not found` });
    }

    // 2. Validate membership & permissions
    const allowedRoles = ['owner', 'admin', 'contributor', 'member'];
    if (!allowedRoles.includes(req.membership?.projectRole)) {
      return res.status(403).json({ error: 'You do not have permission to upload documents in this project' });
    }

    // 3. Check file presence
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ error: 'No document file provided for upload' });
    }

    const ext = (file.originalname || '').split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_DOC_EXTS.has(ext)) {
      return res.status(400).json({
        error: `Unsupported document format '${ext}'. Allowed document formats: PDF, DOCX, MD, TXT.`,
      });
    }

    // 4. Validate file size
    if (file.size > MAX_DOC_SIZE) {
      return res.status(400).json({
        error: `Document exceeds maximum allowed size of 50MB (received ${(file.size / (1024 * 1024)).toFixed(1)}MB)`,
      });
    }

    // 5. Validate file content (magic bytes)
    if (!validateBufferMagicBytes(file.buffer, ext)) {
      return res.status(400).json({ error: 'File content does not match the stated document extension' });
    }

    // 6. Ensure Cloudinary credentials exist
    if (!config.cloudinary.cloudName || !config.cloudinary.apiKey || !config.cloudinary.apiSecret) {
      return res.status(503).json({ error: 'Server-side Cloudinary credentials are not configured' });
    }

    // 7. Upload to Cloudinary using Node.js SDK
    const folder = `collabloop/projects/${projectId}/roles/${role._id}/documents`;
    const resourceType = ext === 'pdf' ? 'image' : 'raw';
    const uploadResult = await uploadBufferToCloudinary(file.buffer, {
      folder,
      resource_type: resourceType,
    });

    const secureUrl = (uploadResult.secure_url || uploadResult.url || '').replace(/^http:\/\//i, 'https://');

    // 8. Parse tags & title
    const tags = Array.isArray(req.body.tags)
      ? req.body.tags
      : typeof req.body.tags === 'string'
      ? req.body.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const title = String(req.body.title || file.originalname.replace(/\.[^/.]+$/, '') || 'Untitled Document').trim();

    // 9. Store metadata in MongoDB
    const document = await Document.create({
      projectId,
      roleId: role._id,
      uploadedBy: req.user.id,
      title,
      description: String(req.body.description || '').trim(),
      fileName: file.originalname,
      format: ext,
      content: String(req.body.content || '').trim(),
      html: String(req.body.html || '').trim(),
      fileUrl: secureUrl,
      publicId: uploadResult.public_id,
      cloudinaryPublicId: uploadResult.public_id,
      fileSize: uploadResult.bytes || file.size,
      tags,
    });

    await document.populate('uploadedBy', 'name username avatar');
    res.status(201).json({ document });
  } catch (err) {
    next(err);
  }
}

/**
 * Generate a Cloudinary signature for direct browser uploads.
 * Handles general uploads (/uploads/sign) and project uploads (/projects/:projectId/uploads/sign).
 */
export async function signUpload(req, res) {
  const { cloudName, apiKey, apiSecret } = config.cloudinary;

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(503).json({ error: 'Server-side Cloudinary credentials are not configured' });
  }

  // If roleId is specified, validate that role exists
  if (req.params?.roleId) {
    const role = await resolveAndValidateRole(req.params.roleId);
    if (!role) {
      return res.status(404).json({ error: `Contributor role '${req.params.roleId}' was not found` });
    }
  }

  // Validate upload permission on project membership if in a project route
  if (req.membership) {
    const allowedRoles = ['owner', 'admin', 'contributor', 'member'];
    if (!allowedRoles.includes(req.membership.projectRole)) {
      return res.status(403).json({ error: 'You do not have permission to upload assets in this project' });
    }
  }

  const timestamp = Math.floor(Date.now() / 1000);
  let folder = 'collabloop/general';

  if (req.params?.projectId && req.params?.roleId) {
    const type = req.query?.type || req.body?.type || 'media';
    folder = `collabloop/projects/${req.params.projectId}/roles/${req.params.roleId}/${type}`;
  } else if (req.params?.projectId) {
    const type = req.query?.type || req.body?.type;
    folder = type
      ? `collabloop/projects/${req.params.projectId}/${type}`
      : `collabloop/projects/${req.params.projectId}`;
  } else if (req.body?.folder) {
    folder = String(req.body.folder).replace(/[^a-zA-Z0-9_\-\/]/g, '');
  }

  const params = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash('sha1')
    .update(params + apiSecret)
    .digest('hex');

  res.json({
    cloudName,
    apiKey,
    timestamp,
    folder,
    signature,
  });
}

/**
 * Server-side deletion of Cloudinary assets using authenticated credentials.
 * @param {string} publicId
 * @param {'image'|'video'|'raw'} resourceType
 * @returns {Promise<boolean>}
 */
export async function destroyCloudinaryAsset(publicId, resourceType = 'image') {
  try {
    const { cloudName, apiKey, apiSecret } = config.cloudinary;
    if (!cloudName || !apiKey || !apiSecret) {
      // Offline / dev mode without credentials
      return true;
    }
    if (!publicId) return true;

    // Use official Cloudinary SDK if configured
    const typesToTry = [resourceType, 'image', 'raw', 'video'];
    const uniqueTypes = [...new Set(typesToTry)];

    for (const t of uniqueTypes) {
      try {
        const result = await cloudinary.uploader.destroy(publicId, {
          resource_type: t,
          invalidate: true,
        });
        if (result?.result === 'ok' || result?.result === 'not found') {
          return true;
        }
      } catch (sdkErr) {
        // Fallback to manual signed REST destroy if SDK throws
        const timestamp = Math.floor(Date.now() / 1000);
        const params = `public_id=${publicId}&timestamp=${timestamp}`;
        const signature = crypto
          .createHash('sha1')
          .update(params + apiSecret)
          .digest('hex');

        const formData = new URLSearchParams();
        formData.append('public_id', publicId);
        formData.append('timestamp', String(timestamp));
        formData.append('api_key', apiKey);
        formData.append('signature', signature);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${t}/destroy`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (data.result === 'ok' || data.result === 'not found') return true;
      }
    }

    return false;
  } catch (err) {
    console.warn('[Cloudinary] Failed to destroy asset server-side:', err.message);
    return false;
  }
}
