import { Resource, Document } from '../models/index.js';

/**
 * GET /projects/:projectId/resources
 * List all resources in a project (newest first).
 */
export async function listResources(req, res) {
  const resources = await Resource.find({
    projectId: req.params.projectId,
  }).sort({ createdAt: -1 });

  res.json({ resources });
}

/**
 * POST /projects/:projectId/resources
 * Upload a new resource to a project.
 */
export async function createResource(req, res) {
  if (!req.body.fileUrl) {
    return res.status(400).json({ error: 'fileUrl is required' });
  }

  const resource = await Resource.create({
    ...req.body,
    projectId: req.params.projectId,
    uploadedBy: req.user.id,
  });

  res.status(201).json({ resource });
}

/**
 * GET /projects/:projectId/documents
 * List all documents in a project (newest first).
 */
export async function listDocuments(req, res) {
  const documents = await Document.find({
    projectId: req.params.projectId,
  }).sort({ createdAt: -1 });

  res.json({ documents });
}

/**
 * POST /projects/:projectId/documents
 * Create a new document in a project.
 */
export async function createDocument(req, res) {
  const document = await Document.create({
    ...req.body,
    projectId: req.params.projectId,
    uploadedBy: req.user.id,
  });

  res.status(201).json({ document });
}
