import crypto from 'node:crypto';

/**
 * POST /projects/:projectId/uploads/sign
 * Generate a Cloudinary signature for direct browser uploads.
 */
export async function signUpload(req, res) {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return res.status(503).json({ error: 'Server-side Cloudinary credentials are not configured' });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `collabloop/${req.params.projectId}`;
  const params = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash('sha1')
    .update(params + CLOUDINARY_API_SECRET)
    .digest('hex');

  res.json({
    cloudName: CLOUDINARY_CLOUD_NAME,
    apiKey: CLOUDINARY_API_KEY,
    timestamp,
    folder,
    signature,
  });
}
