import crypto from 'node:crypto';
import config from '../config/index.js';

/**
 * Generate a Cloudinary signature for direct browser uploads.
 * Handles general uploads (/uploads/sign) and project uploads (/projects/:projectId/uploads/sign).
 */
export async function signUpload(req, res) {
  const { cloudName, apiKey, apiSecret } = config.cloudinary;

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(503).json({ error: 'Server-side Cloudinary credentials are not configured' });
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
    if (!cloudName || !apiKey || !apiSecret || !publicId) return false;

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

    const typesToTry = [resourceType, 'image', 'raw', 'video'];
    const uniqueTypes = [...new Set(typesToTry)];

    for (const t of uniqueTypes) {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${t}/destroy`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (data.result === 'ok') return true;
    }

    return false;
  } catch (err) {
    console.warn('[Cloudinary] Failed to destroy asset server-side:', err.message);
    return false;
  }
}
