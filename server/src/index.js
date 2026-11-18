import 'dotenv/config';

import express from 'express';
import http from 'node:http';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';

import config, { validateConfig } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { registerSocketHandlers } from './sockets/handlers.js';

/* ------------------------------------------------------------------ */
/*  Validate runtime configuration                                     */
/* ------------------------------------------------------------------ */

validateConfig();

/* ------------------------------------------------------------------ */
/*  Express application & HTTP server                                 */
/* ------------------------------------------------------------------ */

const app = express();
const server = http.createServer(app);

/* ---- Rate Limiters ----------------------------------------------- */

// General API rate limiter (protects against volumetric abuse)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Stricter rate limiter for sensitive authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 25, // 25 attempts per 15 minutes per IP
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

/* ---- Security & Parser Middleware -------------------------------- */

app.use(helmet());

// Multi-origin CORS support
const allowedOrigins = config.clientOrigin.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy violation: Origin '${origin}' is not permitted.`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

/* ---- Health & Readiness Check ------------------------------------ */

app.get('/api/health', (_req, res) => {
  const isDbReady = mongoose.connection.readyState === 1;
  const statusPayload = {
    status: isDbReady ? 'healthy' : 'unhealthy',
    database: isDbReady ? 'connected' : 'disconnected',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  };

  if (!isDbReady) {
    return res.status(503).json(statusPayload);
  }
  return res.status(200).json(statusPayload);
});

/* ---- API Routes with Rate Limiting -------------------------------- */

// Apply auth rate limiting to sensitive routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// General limiter on other API routes
app.use('/api', generalLimiter);

// Main API routes
app.use('/api', routes);

/* ---- Error Handling ---------------------------------------------- */

app.use(errorHandler);

/* ---- Realtime Socket.IO Handlers --------------------------------- */

registerSocketHandlers(server, config);

/* ------------------------------------------------------------------ */
/*  Database Lifecycle & Server Startup                               */
/* ------------------------------------------------------------------ */

// Listen to Mongoose connection lifecycle events
mongoose.connection.on('error', (err) => {
  console.error('[DATABASE ERROR] Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[DATABASE WARNING] Mongoose disconnected from MongoDB.');
});

mongoose.connection.on('reconnected', () => {
  console.log('[DATABASE INFO] Mongoose reconnected to MongoDB.');
});

async function startServer() {
  try {
    console.log(`[BOOT] Connecting to MongoDB: ${config.mongodbUri.replace(/:([^:@]{3,})@/, ':****@')}`);
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('[BOOT] Connected to MongoDB successfully.');

    server.listen(config.port, '0.0.0.0', () => {
      console.log(`[BOOT] CollabLoop API listening on port ${config.port} (env: ${config.nodeEnv})`);
    });
  } catch (err) {
    console.error('[BOOT FATAL] Failed to connect to MongoDB. Server halted.', err);
    process.exit(1);
  }
}

// Graceful shutdown handling
const shutdown = (signal) => {
  console.log(`[SHUTDOWN] Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log('[SHUTDOWN] HTTP server closed.');
    try {
      await mongoose.connection.close(false);
      console.log('[SHUTDOWN] MongoDB connection closed.');
      process.exit(0);
    } catch (err) {
      console.error('[SHUTDOWN ERROR] Error while closing MongoDB connection:', err);
      process.exit(1);
    }
  });

  // Force shutdown if cleanup takes longer than 10 seconds
  setTimeout(() => {
    console.error('[SHUTDOWN TIMEOUT] Graceful shutdown timed out, force terminating.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();
