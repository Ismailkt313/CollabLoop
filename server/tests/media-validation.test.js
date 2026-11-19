import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_IMAGE_EXTS,
  ALLOWED_IMAGE_MIMES,
  ALLOWED_VIDEO_EXTS,
  ALLOWED_VIDEO_MIMES,
  ALLOWED_DOC_EXTS,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  MAX_DOC_SIZE,
  validateBufferMagicBytes,
} from '../src/middleware/uploadValidation.js';

describe('Cloudinary & Media Responsibility Separation Tests', () => {
  describe('File Type & Extension Validation', () => {
    it('accepts valid image extensions and MIME types', () => {
      const validExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];
      for (const ext of validExts) {
        assert.ok(ALLOWED_IMAGE_EXTS.has(ext), `Expected ${ext} to be allowed`);
      }
      assert.ok(ALLOWED_IMAGE_MIMES.has('image/png'));
      assert.ok(ALLOWED_IMAGE_MIMES.has('image/jpeg'));
      assert.ok(ALLOWED_IMAGE_MIMES.has('image/webp'));
    });

    it('rejects forbidden executable and script extensions', () => {
      const forbiddenExts = ['exe', 'sh', 'bat', 'php', 'js', 'py', 'cmd'];
      for (const ext of forbiddenExts) {
        assert.strictEqual(ALLOWED_IMAGE_EXTS.has(ext), false);
        assert.strictEqual(ALLOWED_VIDEO_EXTS.has(ext), false);
        assert.strictEqual(ALLOWED_DOC_EXTS.has(ext), false);
      }
    });

    it('accepts valid video formats', () => {
      const validVideos = ['mp4', 'webm', 'mov'];
      for (const ext of validVideos) {
        assert.ok(ALLOWED_VIDEO_EXTS.has(ext), `Expected ${ext} video to be allowed`);
      }
      assert.ok(ALLOWED_VIDEO_MIMES.has('video/mp4'));
      assert.ok(ALLOWED_VIDEO_MIMES.has('video/webm'));
    });

    it('accepts valid document formats', () => {
      const validDocs = ['pdf', 'docx', 'md', 'markdown', 'txt'];
      for (const ext of validDocs) {
        assert.ok(ALLOWED_DOC_EXTS.has(ext), `Expected ${ext} document to be allowed`);
      }
    });
  });

  describe('File Size Limits', () => {
    it('enforces maximum size boundaries for images, videos, and documents', () => {
      assert.strictEqual(MAX_IMAGE_SIZE, 20 * 1024 * 1024, 'Image size limit should be 20MB');
      assert.strictEqual(MAX_VIDEO_SIZE, 100 * 1024 * 1024, 'Video size limit should be 100MB');
      assert.strictEqual(MAX_DOC_SIZE, 50 * 1024 * 1024, 'Document size limit should be 50MB');

      const oversizedImage = 25 * 1024 * 1024;
      assert.ok(oversizedImage > MAX_IMAGE_SIZE, 'Oversized image should exceed limit');

      const oversizedVideo = 105 * 1024 * 1024;
      assert.ok(oversizedVideo > MAX_VIDEO_SIZE, 'Oversized video should exceed limit');

      const oversizedDoc = 55 * 1024 * 1024;
      assert.ok(oversizedDoc > MAX_DOC_SIZE, 'Oversized doc should exceed limit');
    });
  });

  describe('Content Magic Bytes Inspection', () => {
    it('correctly verifies genuine PNG header bytes', () => {
      const genuinePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      assert.strictEqual(validateBufferMagicBytes(genuinePng, 'png'), true);

      const fakePng = Buffer.from([0x47, 0x49, 0x46, 0x38]); // actually GIF
      assert.strictEqual(validateBufferMagicBytes(fakePng, 'png'), false);
    });

    it('correctly verifies genuine JPEG header bytes', () => {
      const genuineJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      assert.strictEqual(validateBufferMagicBytes(genuineJpg, 'jpg'), true);
      assert.strictEqual(validateBufferMagicBytes(genuineJpg, 'jpeg'), true);

      const fakeJpg = Buffer.from([0x25, 0x50, 0x44, 0x46]); // actually PDF
      assert.strictEqual(validateBufferMagicBytes(fakeJpg, 'jpg'), false);
    });

    it('correctly verifies genuine PDF header bytes', () => {
      const genuinePdf = Buffer.from('%PDF-1.4 header');
      assert.strictEqual(validateBufferMagicBytes(genuinePdf, 'pdf'), true);

      const fakePdf = Buffer.from('hello world');
      assert.strictEqual(validateBufferMagicBytes(fakePdf, 'pdf'), false);
    });

    it('correctly verifies genuine WebP header bytes', () => {
      // RIFF....WEBP
      const genuineWebp = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);
      assert.strictEqual(validateBufferMagicBytes(genuineWebp, 'webp'), true);

      const fakeWebp = Buffer.from('not a webp file');
      assert.strictEqual(validateBufferMagicBytes(fakeWebp, 'webp'), false);
    });
  });

  describe('Resource & Document Model Virtual Aliases', () => {
    it('Resource schema exports virtual aliases for secureUrl and cloudinaryPublicId', async () => {
      const { default: Resource } = await import('../src/models/Resource.js');
      const doc = new Resource({
        projectId: '507f1f77bcf86cd799439011',
        uploadedBy: '507f1f77bcf86cd799439012',
        fileUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        publicId: 'sample',
      });

      assert.strictEqual(doc.secureUrl, 'https://res.cloudinary.com/demo/image/upload/sample.jpg');
      assert.strictEqual(doc.cloudinaryPublicId, 'sample');

      // Test setter
      doc.secureUrl = 'https://res.cloudinary.com/demo/image/upload/v2/sample2.jpg';
      assert.strictEqual(doc.fileUrl, 'https://res.cloudinary.com/demo/image/upload/v2/sample2.jpg');
    });

    it('Document schema exports virtual aliases for secureUrl and cloudinaryPublicId', async () => {
      const { default: Document } = await import('../src/models/Document.js');
      const doc = new Document({
        projectId: '507f1f77bcf86cd799439011',
        uploadedBy: '507f1f77bcf86cd799439012',
        title: 'Architecture Guide',
        fileUrl: 'https://res.cloudinary.com/demo/raw/upload/guide.pdf',
        publicId: 'guide',
      });

      assert.strictEqual(doc.secureUrl, 'https://res.cloudinary.com/demo/raw/upload/guide.pdf');
      assert.strictEqual(doc.cloudinaryPublicId, 'guide');
    });
  });

  describe('Client Resource-List Removal Verification', () => {
    it('cloudinary.js client listing functions are disabled stubs and make no network requests', async () => {
      const { fetchAllCloudinaryMedia, fetchCloudinaryDeletedIds, markCloudinaryAssetAsDeleted } =
        await import('../../frontend/src/services/cloudinary.js');

      const deletedIds = await fetchCloudinaryDeletedIds();
      assert.ok(deletedIds instanceof Set);
      assert.strictEqual(deletedIds.size, 0);

      const deleteRes = await markCloudinaryAssetAsDeleted('test-id');
      assert.strictEqual(deleteRes, true);

      const allMedia = await fetchAllCloudinaryMedia();
      assert.strictEqual(allMedia.success, true);
      assert.deepStrictEqual(allMedia.items, []);
      assert.strictEqual(allMedia.requiresSetting, false);
    });

    it('cloudSync.js fetchCloudinaryRawDocs returns empty array with zero network calls', async () => {
      const { fetchCloudinaryRawDocs } = await import('../../frontend/src/services/cloudSync.js');
      const rawDocs = await fetchCloudinaryRawDocs();
      assert.deepStrictEqual(rawDocs, []);
    });
  });
});
