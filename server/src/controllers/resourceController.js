import config from '../config/index.js';
import { Resource, Document } from '../models/index.js';
import { destroyCloudinaryAsset } from './uploadController.js';
import { getIO } from '../sockets/handlers.js';
import {
  ALLOWED_IMAGE_EXTS,
  ALLOWED_VIDEO_EXTS,
  ALLOWED_DOC_EXTS,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  MAX_DOC_SIZE,
  resolveAndValidateRole,
} from '../middleware/uploadValidation.js';

// ── Resource Controllers ───────────────────────────────────────────────────

/**
 * GET /projects/:projectId/resources
 * List all project resources (optionally filtered by roleId query).
 */
export async function listResources(req, res, next) {
  try {
    const filter = { projectId: req.params.projectId };
    if (req.query.roleId) {
      const resolvedRole = await resolveAndValidateRole(req.query.roleId);
      filter.roleId = resolvedRole ? resolvedRole._id : req.query.roleId;
    }

    const resources = await Resource.find(filter)
      .populate('uploadedBy', 'name username avatar')
      .sort({ createdAt: -1 });

    res.json({ resources });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /projects/:projectId/workspaces/:roleId/resources
 * List all resources specific to a project role.
 */
export async function listRoleResources(req, res, next) {
  try {
    const { projectId, roleId } = req.params;
    const resolvedRole = await resolveAndValidateRole(roleId);
    const targetRoleId = resolvedRole ? resolvedRole._id : roleId;

    const resources = await Resource.find({ projectId, roleId: targetRoleId })
      .populate('uploadedBy', 'name username avatar')
      .sort({ createdAt: -1 });

    res.json({ resources });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /projects/:projectId/resources
 * Upload / create a new resource.
 */
export async function createResource(req, res, next) {
  try {
    const fileUrl = req.body.secureUrl || req.body.fileUrl;
    if (!fileUrl) {
      return res.status(400).json({ error: 'fileUrl is required' });
    }

    const allowedRoles = ['owner', 'admin', 'contributor', 'member'];
    if (!allowedRoles.includes(req.membership?.projectRole)) {
      return res.status(403).json({ error: 'You do not have permission to add resources to this project' });
    }

    const tags = Array.isArray(req.body.tags)
      ? req.body.tags
      : typeof req.body.tags === 'string'
      ? req.body.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const publicId = req.body.cloudinaryPublicId || req.body.publicId || '';

    const resource = await Resource.create({
      ...req.body,
      fileUrl,
      publicId,
      cloudinaryPublicId: publicId,
      tags,
      projectId: req.params.projectId,
      roleId: req.body.roleId || req.params.roleId || null,
      uploadedBy: req.user.id,
    });

    await resource.populate('uploadedBy', 'name username avatar');

    const io = getIO();
    if (io) {
      io.to(`project:${req.params.projectId}`).emit('resource:created', {
        projectId: req.params.projectId,
        roleId: resource.roleId,
        resource,
        actorId: req.user.id,
      });
    }

    res.status(201).json({ resource });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /projects/:projectId/workspaces/:roleId/resources
 * Create a new resource specifically inside a role workspace (from signed uploads).
 */
export async function createRoleResource(req, res, next) {
  try {
    const fileUrl = req.body.secureUrl || req.body.fileUrl;
    if (!fileUrl) {
      return res.status(400).json({ error: 'fileUrl is required' });
    }

    const { projectId, roleId } = req.params;

    // 1. Validate role
    const role = await resolveAndValidateRole(roleId);
    if (!role) {
      return res.status(404).json({ error: `Contributor role '${roleId}' was not found` });
    }

    // 2. Validate membership & permissions
    const allowedRoles = ['owner', 'admin', 'contributor', 'member'];
    if (!allowedRoles.includes(req.membership?.projectRole)) {
      return res.status(403).json({ error: 'You do not have permission to add resources to this workspace' });
    }

    // 3. Validate resource type & format
    const resourceType = req.body.resourceType === 'video' ? 'video' : 'image';
    const ext = String(req.body.format || (req.body.fileName || '').split('.').pop() || '').toLowerCase();

    if (resourceType === 'image' && ext && !ALLOWED_IMAGE_EXTS.has(ext)) {
      return res.status(400).json({ error: `Invalid image format '${ext}'. Allowed: PNG, JPG, JPEG, WEBP, GIF, SVG.` });
    }
    if (resourceType === 'video' && ext && !ALLOWED_VIDEO_EXTS.has(ext)) {
      return res.status(400).json({ error: `Invalid video format '${ext}'. Allowed: MP4, WEBM, MOV.` });
    }

    // 4. Validate file size limits
    const fileSize = Number(req.body.fileSize || 0);
    if (resourceType === 'image' && fileSize > MAX_IMAGE_SIZE) {
      return res.status(400).json({ error: 'Image exceeds maximum allowed size of 20MB' });
    }
    if (resourceType === 'video' && fileSize > MAX_VIDEO_SIZE) {
      return res.status(400).json({ error: 'Video exceeds maximum allowed size of 100MB' });
    }

    const tags = Array.isArray(req.body.tags)
      ? req.body.tags
      : typeof req.body.tags === 'string'
      ? req.body.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const publicId = req.body.cloudinaryPublicId || req.body.publicId || '';

    const resource = await Resource.create({
      projectId,
      roleId: role._id,
      uploadedBy: req.user.id,
      title: String(req.body.title || req.body.fileName || 'Untitled Resource').trim(),
      description: String(req.body.description || '').trim(),
      fileName: String(req.body.fileName || '').trim(),
      fileUrl,
      publicId,
      cloudinaryPublicId: publicId,
      resourceType,
      format: ext,
      fileSize,
      width: req.body.width ? Number(req.body.width) : undefined,
      height: req.body.height ? Number(req.body.height) : undefined,
      duration: req.body.duration ? Number(req.body.duration) : undefined,
      tags,
    });

    await resource.populate('uploadedBy', 'name username avatar');

    const io = getIO();
    if (io) {
      io.to(`project:${projectId}`).emit('resource:created', {
        projectId,
        roleId: role._id,
        resource,
        actorId: req.user.id,
      });
    }

    res.status(201).json({ resource });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /projects/:projectId/resources/:resourceId
 * DELETE /projects/:projectId/workspaces/:roleId/resources/:resourceId
 * Delete a resource from MongoDB and remove its Cloudinary asset.
 * Allowed for uploader or project Owner/Admin.
 */
export async function deleteResource(req, res, next) {
  try {
    const { projectId, resourceId } = req.params;
    const resource = await Resource.findOne({ _id: resourceId, projectId });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Permission check
    const isUploader = resource.uploadedBy.toString() === req.user.id.toString();
    const isManager = ['owner', 'admin'].includes(req.membership?.projectRole);

    if (!isUploader && !isManager) {
      return res.status(403).json({ error: 'You do not have permission to delete this resource' });
    }

    // Server-side Cloudinary asset destruction
    const assetPublicId = resource.cloudinaryPublicId || resource.publicId;
    if (assetPublicId) {
      const destroyed = await destroyCloudinaryAsset(assetPublicId, resource.resourceType || 'image');
      if (!destroyed && config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
        return res.status(502).json({ error: 'Failed to delete asset from Cloudinary storage' });
      }
    }

    await Resource.findByIdAndDelete(resource._id);

    const io = getIO();
    if (io) {
      io.to(`project:${projectId}`).emit('resource:deleted', {
        projectId,
        roleId: resource.roleId,
        resourceId: resource._id,
        actorId: req.user.id,
      });
    }

    res.json({ ok: true, deletedId: resource._id });
  } catch (err) {
    next(err);
  }
}

// ── Document Controllers ───────────────────────────────────────────────────

/**
 * GET /projects/:projectId/documents
 * List all project documents (optionally filtered by roleId query).
 */
export async function listDocuments(req, res, next) {
  try {
    const filter = { projectId: req.params.projectId };
    if (req.query.roleId) {
      const resolvedRole = await resolveAndValidateRole(req.query.roleId);
      filter.roleId = resolvedRole ? resolvedRole._id : req.query.roleId;
    }

    const documents = await Document.find(filter)
      .populate('uploadedBy', 'name username avatar')
      .sort({ createdAt: -1 });

    res.json({ documents });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /projects/:projectId/workspaces/:roleId/documents
 * List all documents specific to a project role.
 */
export async function listRoleDocuments(req, res, next) {
  try {
    const { projectId, roleId } = req.params;
    const resolvedRole = await resolveAndValidateRole(roleId);
    const targetRoleId = resolvedRole ? resolvedRole._id : roleId;

    const documents = await Document.find({ projectId, roleId: targetRoleId })
      .populate('uploadedBy', 'name username avatar')
      .sort({ createdAt: -1 });

    res.json({ documents });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /projects/:projectId/documents
 * Create a new document in a project.
 */
export async function createDocument(req, res, next) {
  try {
    if (!req.body.title?.trim()) {
      return res.status(400).json({ error: 'Document title is required' });
    }

    const allowedRoles = ['owner', 'admin', 'contributor', 'member'];
    if (!allowedRoles.includes(req.membership?.projectRole)) {
      return res.status(403).json({ error: 'You do not have permission to add documents to this project' });
    }

    const tags = Array.isArray(req.body.tags)
      ? req.body.tags
      : typeof req.body.tags === 'string'
      ? req.body.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const fileUrl = req.body.secureUrl || req.body.fileUrl || '';
    const publicId = req.body.cloudinaryPublicId || req.body.publicId || '';

    const document = await Document.create({
      ...req.body,
      fileUrl,
      publicId,
      cloudinaryPublicId: publicId,
      tags,
      projectId: req.params.projectId,
      roleId: req.body.roleId || req.params.roleId || null,
      uploadedBy: req.user.id,
    });

    await document.populate('uploadedBy', 'name username avatar');

    const io = getIO();
    if (io) {
      io.to(`project:${req.params.projectId}`).emit('document:created', {
        projectId: req.params.projectId,
        roleId: document.roleId,
        document,
        actorId: req.user.id,
      });
    }

    res.status(201).json({ document });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /projects/:projectId/workspaces/:roleId/documents
 * Create a new document specifically inside a role workspace (from signed uploads).
 */
export async function createRoleDocument(req, res, next) {
  try {
    if (!req.body.title?.trim()) {
      return res.status(400).json({ error: 'Document title is required' });
    }

    const { projectId, roleId } = req.params;

    // 1. Validate role
    const role = await resolveAndValidateRole(roleId);
    if (!role) {
      return res.status(404).json({ error: `Contributor role '${roleId}' was not found` });
    }

    // 2. Validate membership & permissions
    const allowedRoles = ['owner', 'admin', 'contributor', 'member'];
    if (!allowedRoles.includes(req.membership?.projectRole)) {
      return res.status(403).json({ error: 'You do not have permission to add documents to this workspace' });
    }

    // 3. Validate format & size
    const format = String(req.body.format || (req.body.fileName || '').split('.').pop() || 'markdown').toLowerCase();
    if (!ALLOWED_DOC_EXTS.has(format)) {
      return res.status(400).json({ error: `Invalid document format '${format}'. Allowed: PDF, DOCX, MD, TXT.` });
    }

    const fileSize = Number(req.body.fileSize || 0);
    if (fileSize > MAX_DOC_SIZE) {
      return res.status(400).json({ error: 'Document exceeds maximum allowed size of 50MB' });
    }

    const tags = Array.isArray(req.body.tags)
      ? req.body.tags
      : typeof req.body.tags === 'string'
      ? req.body.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const fileUrl = req.body.secureUrl || req.body.fileUrl || '';
    const publicId = req.body.cloudinaryPublicId || req.body.publicId || '';

    const document = await Document.create({
      projectId,
      roleId: role._id,
      uploadedBy: req.user.id,
      title: String(req.body.title).trim(),
      description: String(req.body.description || '').trim(),
      fileName: String(req.body.fileName || '').trim(),
      format,
      content: req.body.content || '',
      html: req.body.html || '',
      fileUrl,
      publicId,
      cloudinaryPublicId: publicId,
      fileSize,
      tags,
    });

    await document.populate('uploadedBy', 'name username avatar');

    const io = getIO();
    if (io) {
      io.to(`project:${projectId}`).emit('document:created', {
        projectId,
        roleId: role._id,
        document,
        actorId: req.user.id,
      });
    }

    res.status(201).json({ document });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /projects/:projectId/documents/:documentId
 * DELETE /projects/:projectId/workspaces/:roleId/documents/:documentId
 * Delete a document from MongoDB and remove its Cloudinary file.
 * Allowed for uploader or project Owner/Admin.
 */
export async function deleteDocument(req, res, next) {
  try {
    const { projectId, documentId } = req.params;
    const document = await Document.findOne({ _id: documentId, projectId });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Permission check
    const isUploader = document.uploadedBy.toString() === req.user.id.toString();
    const isManager = ['owner', 'admin'].includes(req.membership?.projectRole);

    if (!isUploader && !isManager) {
      return res.status(403).json({ error: 'You do not have permission to delete this document' });
    }

    // Server-side Cloudinary asset destruction
    const assetPublicId = document.cloudinaryPublicId || document.publicId;
    if (assetPublicId) {
      const cType = document.format === 'pdf' ? 'image' : 'raw';
      const destroyed = await destroyCloudinaryAsset(assetPublicId, cType);
      if (!destroyed && config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
        return res.status(502).json({ error: 'Failed to delete asset from Cloudinary storage' });
      }
    }

    await Document.findByIdAndDelete(document._id);

    const io = getIO();
    if (io) {
      io.to(`project:${projectId}`).emit('document:deleted', {
        projectId,
        roleId: document.roleId,
        documentId: document._id,
        actorId: req.user.id,
      });
    }

    res.json({ ok: true, deletedId: document._id });
  } catch (err) {
    next(err);
  }
}
