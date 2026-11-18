/**
 * @module config
 * @description Centralized configuration object for the CollabLoop server.
 * All environment variables are read here and exported as a single frozen object.
 */

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const config = Object.freeze({
  /** @type {string} Node environment */
  nodeEnv,

  /** @type {boolean} Whether running in production */
  isProduction,

  /** @type {number} Server port */
  port: Number(process.env.PORT || 5000),

  /** @type {string} MongoDB connection URI */
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/collabloop',

  /** @type {string} JWT signing secret */
  jwtSecret: process.env.JWT_SECRET,

  /** @type {string} Allowed client origin for CORS (single URL or comma-separated) */
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:2345',

  /** @type {boolean} Whether cookies should use the Secure flag */
  cookieSecure: process.env.COOKIE_SECURE === 'true' || (isProduction && process.env.COOKIE_SECURE !== 'false'),

  /** @type {string} Cookie SameSite policy ('lax', 'strict', 'none') */
  cookieSameSite: process.env.COOKIE_SAMESITE || (isProduction ? 'lax' : 'lax'),

  /** @type {{ host?: string, port: number, secure: boolean, user?: string, pass?: string, from?: string }} SMTP email configuration */
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM,
  },

  /** @type {{ cloudName?: string, apiKey?: string, apiSecret?: string }} Cloudinary credentials */
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECET,
  },
});

/**
 * Validate runtime configuration before starting server.
 * Ensures critical secrets and database settings meet security standards.
 * @throws {Error} If mandatory environment variables are missing or insecure in production.
 */
export function validateConfig() {
  if (!config.jwtSecret) {
    throw new Error('FATAL: JWT_SECRET environment variable is missing.');
  }

  if (config.isProduction) {
    const weakSecrets = [
      'replace-with-a-long-random-local-secret',
      'secret',
      'changeme',
      'jwtsecret',
      'supersecret',
      'password',
    ];

    if (config.jwtSecret.length < 32) {
      throw new Error(
        'FATAL: In production, JWT_SECRET must be at least 32 characters long for cryptographic security.'
      );
    }

    if (weakSecrets.includes(config.jwtSecret.toLowerCase())) {
      throw new Error(
        'FATAL: Default/weak JWT_SECRET detected. Set a cryptographically random secret in production.'
      );
    }

    if (config.mongodbUri.includes('127.0.0.1') || config.mongodbUri.includes('localhost')) {
      console.warn(
        '[SECURITY WARNING] Production NODE_ENV is active but MONGODB_URI points to localhost. Ensure a secured replica set / MongoDB Atlas URI is used for production.'
      );
    }
  }

  // Cloudinary credentials completeness check
  const { cloudName, apiKey, apiSecret } = config.cloudinary;
  const hasCloudinary = Boolean(cloudName || apiKey || apiSecret);
  if (hasCloudinary && (!cloudName || !apiKey || !apiSecret)) {
    console.warn(
      '[CONFIG WARNING] Incomplete Cloudinary configuration. Ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are all set.'
    );
  }
}

export default config;
