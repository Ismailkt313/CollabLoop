/**
 * @module config
 * @description Centralized configuration object for the CollabLoop server.
 * All environment variables are read here and exported as a single frozen object.
 */

const config = Object.freeze({
  /** @type {number} Server port */
  port: Number(process.env.PORT || 5000),

  /** @type {string} MongoDB connection URI */
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/collabloop',

  /** @type {string} JWT signing secret */
  jwtSecret: process.env.JWT_SECRET,

  /** @type {string} Allowed client origin for CORS */
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:2345',

  /** @type {boolean} Whether cookies should use the Secure flag */
  cookieSecure: process.env.COOKIE_SECURE === 'true',

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
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
});

export default config;
