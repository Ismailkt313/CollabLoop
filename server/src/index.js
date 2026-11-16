import 'dotenv/config';

import express from 'express';
import http from 'node:http';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import config from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { registerSocketHandlers } from './sockets/handlers.js';

/* ------------------------------------------------------------------ */
/*  Validate required environment variables                           */
/* ------------------------------------------------------------------ */

if (!config.jwtSecret) {
  throw new Error('JWT_SECRET is required in server/.env');
}
 
/* ------------------------------------------------------------------ */
/*  Express application                                               */
/* ------------------------------------------------------------------ */

const app = express();
const server = http.createServer(app);

/* ---- Middleware -------------------------------------------------- */

app.use(helmet());
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

/* ---- Routes ----------------------------------------------------- */

app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    database:
      mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  }),
);

app.use('/api', routes);


app.use(errorHandler);



registerSocketHandlers(server, config);


await mongoose.connect(config.mongodbUri);
console.log('Connected to local MongoDB');

server.listen(config.port, '0.0.0.0', () =>
  console.log(`CollabLoop API listening on ${config.port}`),
);
