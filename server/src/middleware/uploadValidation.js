import mongoose from 'mongoose';
import { ContributorRole } from '../models/index.js';

export const ALLOWED_IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);
export const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

export const ALLOWED_VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'quicktime']);
export const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

export const ALLOWED_DOC_EXTS = new Set(['pdf', 'docx', 'md', 'markdown', 'txt']);
export const ALLOWED_DOC_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/plain',
  'application/octet-stream',
]);

export const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_DOC_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Validates buffer magic numbers to prevent MIME spoofing.
 * @param {Buffer} buffer
 * @param {string} ext
 * @returns {boolean}
 */
export function validateBufferMagicBytes(buffer, ext) {
  if (!buffer || buffer.length < 4) return true; // Cannot determine for empty/tiny text files

  const cleanExt = ext.toLowerCase();

  // PNG: 89 50 4E 47
  if (cleanExt === 'png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }

  // JPEG: FF D8 FF
  if (cleanExt === 'jpg' || cleanExt === 'jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // GIF: 47 49 46 38 ("GIF8")
  if (cleanExt === 'gif') {
    return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
  }

  // PDF: 25 50 44 46 ("%PDF")
  if (cleanExt === 'pdf') {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  // DOCX / ZIP: 50 4B 03 04 ("PK..")
  if (cleanExt === 'docx') {
    return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  }

  // WebP: RIFF ... WEBP
  if (cleanExt === 'webp') {
    return (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer.length >= 12 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    );
  }

  return true;
}

/**
 * Validates that the requested roleId exists and is valid.
 * @param {string} roleId
 * @returns {Promise<import('mongoose').Document|null>}
 */
export async function resolveAndValidateRole(roleId) {
  if (!roleId) return null;

  if (mongoose.isValidObjectId(roleId)) {
    const role = await ContributorRole.findById(roleId);
    if (role) return role;
  }

  return ContributorRole.findOne({ normalizedName: String(roleId).toLowerCase().trim() });
}

/**
 * Middleware: Enforces upload permission on project membership.
 */
export function requireUploadPermission(req, res, next) {
  const allowedRoles = ['owner', 'admin', 'contributor', 'member'];
  const userRole = req.membership?.projectRole;

  if (!userRole || !allowedRoles.includes(userRole)) {
    return res.status(403).json({ error: 'You do not have permission to upload assets to this project' });
  }

  next();
}

/**
 * Middleware: Validates role existence for role workspace routes.
 */
export async function requireValidRole(req, res, next) {
  try {
    const roleId = req.params.roleId || req.body.roleId;
    if (!roleId) {
      return res.status(400).json({ error: 'Role ID is required' });
    }

    const role = await resolveAndValidateRole(roleId);
    if (!role) {
      return res.status(404).json({ error: `Contributor role '${roleId}' was not found` });
    }

    req.contributorRole = role;
    next();
  } catch (err) {
    next(err);
  }
}
