import { Resource, Document } from '../models/index.js';
import { destroyCloudinaryAsset } from './uploadController.js';

// ── Resource Controllers ───────────────────────────────────────────────────

/**
 * GET /projects/:projectId/resources
 * List all project resources (optionally filtered by roleId query).
 */
export async function listResources(req, res, next) {
  try {
    const filter = { projectId: req.params.projectId };
    if (req.query.roleId) {
      filter.roleId = req.query.roleId;
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
    const resources = await Resource.find({ projectId, roleId })
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
    if (!req.body.fileUrl) {
      return res.status(400).json({ error: 'fileUrl is required' });
    }

    const tags = Array.isArray(req.body.tags)
      ? req.body.tags
      : typeof req.body.tags === 'string'
      ? req.body.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const resource = await Resource.create({
      ...req.body,
      tags,
      projectId: req.params.projectId,
      roleId: req.body.roleId || req.params.roleId || null,
      uploadedBy: req.user.id,
    });

    await resource.populate('uploadedBy', 'name username avatar');
    res.status(201).json({ resource });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /projects/:projectId/workspaces/:roleId/resources
 * Create a new resource specifically inside a role workspace.
 */
export async function createRoleResource(req, res, next) {
  try {
    if (!req.body.fileUrl) {
      return res.status(400).json({ error: 'fileUrl is required' });
    }

    const { projectId, roleId } = req.params;
    const tags = Array.isArray(req.body.tags)
      ? req.body.tags
      : typeof req.body.tags === 'string'
      ? req.body.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const resource = await Resource.create({
      projectId,
      roleId,
      uploadedBy: req.user.id,
      title: String(req.body.title || req.body.fileName || 'Untitled Resource').trim(),
      description: String(req.body.description || '').trim(),
      fileName: String(req.body.fileName || '').trim(),
      fileUrl: req.body.fileUrl,
      publicId: req.body.publicId || '',
      resourceType: req.body.resourceType || 'image',
      format: req.body.format || '',
      fileSize: Number(req.body.fileSize || 0),
      width: req.body.width ? Number(req.body.width) : undefined,
      height: req.body.height ? Number(req.body.height) : undefined,
      duration: req.body.duration ? Number(req.body.duration) : undefined,
      tags,
    });

    await resource.populate('uploadedBy', 'name username avatar');
    res.status(201).json({ resource });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /projects/:projectId/resources/:resourceId
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
    if (resource.publicId) {
      await destroyCloudinaryAsset(resource.publicId, resource.resourceType || 'image');
    }

    await Resource.findByIdAndDelete(resource._id);
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
      filter.roleId = req.query.roleId;
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
    const documents = await Document.find({ projectId, roleId })
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

    const tags = Array.isArray(req.body.tags)
      ? req.body.tags
      : typeof req.body.tags === 'string'
      ? req.body.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const document = await Document.create({
      ...req.body,
      tags,
      projectId: req.params.projectId,
      roleId: req.body.roleId || req.params.roleId || null,
      uploadedBy: req.user.id,
    });

    await document.populate('uploadedBy', 'name username avatar');
    res.status(201).json({ document });
  } catch (err) {
    next(err);
  }
}

export async function createRoleDocument(req, res, next) {
  try {
    if (!req.body.title?.trim()) {
      return res.status(400).json({ error: 'Document title is required' });
    }

    const { projectId, roleId } = req.params;
    const tags = Array.isArray(req.body.tags)
      ? req.body.tags
      : typeof req.body.tags === 'string'
      ? req.body.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const document = await Document.create({
      projectId,
      roleId,
      uploadedBy: req.user.id,
      title: String(req.body.title).trim(),
      description: String(req.body.description || '').trim(),
      fileName: String(req.body.fileName || '').trim(),
      format: req.body.format || 'markdown',
      content: req.body.content || '',
      html: req.body.html || '',
      fileUrl: req.body.fileUrl || '',
      publicId: req.body.publicId || '',
      fileSize: Number(req.body.fileSize || 0),
      tags,
    });

    await document.populate('uploadedBy', 'name username avatar');
    res.status(201).json({ document });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /projects/:projectId/documents/:documentId
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
    if (document.publicId) {
      const cType = document.format === 'pdf' ? 'image' : 'raw';
      await destroyCloudinaryAsset(document.publicId, cType);
    }

    await Document.findByIdAndDelete(document._id);
    res.json({ ok: true, deletedId: document._id });
  } catch (err) {
    next(err);
  }
}
