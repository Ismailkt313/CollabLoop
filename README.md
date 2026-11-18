# CollabLoop

CollabLoop is a modern, feature-based collaboration platform designed for dynamic project teams. It unites real-time discussions, role-specific asset galleries, document management, and fine-grained team permission settings within a modular monolith architecture.

---

## Architecture Overview

- **Frontend**: React 19, Vite 6, Lucide Icons, Marked (Markdown), Mammoth (Word docx parsing). Built with Rollup code-splitting for fast load times under 500 kB per vendor chunk.
- **Backend**: Node.js, Express 4, Mongoose 8, Socket.IO 4.
- **Database**: MongoDB (Local Community Server for development, MongoDB Atlas Replica Set for production).
- **Authentication**: JWT stored in `httpOnly`, `SameSite=lax`, `Secure` cookies with `sha256-bcrypt` password hashing (12 rounds).
- **Media & Documents**: Project-isolated metadata in MongoDB with optional Cloudinary cloud storage for assets.
- **Real-Time Communication**: Centralized WebSocket architecture (Socket.IO) with room-based project isolation and membership verification.

---

## Local Development Setup

### Prerequisites
- Node.js 20+ and npm 10+
- MongoDB Community Server running locally on port 27017

### 1. Installation
Clone the repository and install all dependencies:
```bash
npm install
npm --prefix server install
npm --prefix frontend install
```

### 2. Environment Configuration
Create local `.env` files from templates:
```bash
cp server/.env.example server/.env
cp frontend/.env.example frontend/.env
```

Review `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/collabloop
JWT_SECRET=your-random-local-development-secret-key
CLIENT_ORIGIN=http://localhost:2345
COOKIE_SECURE=false
```

### 3. Running Locally
Run the server and frontend in separate terminals:
```bash
# Terminal 1: Backend API (port 5000)
npm run dev:server

# Terminal 2: Frontend Client (port 2345)
npm run dev
```

Visit [http://localhost:2345](http://localhost:2345) to create an account and start collaborating.

---

## Production Deployment Guide

### 1. Production Environment Variables
Set the following environment variables in your production environment (e.g., Docker, AWS ECS, Render, Railway, Kubernetes):

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/collabloop?retryWrites=true&w=majority&appName=CollabLoop
JWT_SECRET=<64-char-hex-secret-generated-via-openssl>
CLIENT_ORIGIN=https://collabloop.yourdomain.com
COOKIE_SECURE=true
COOKIE_SAMESITE=lax

# Cloudinary (Backend only - never expose API secret to clients)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# SMTP Email Configuration (for password reset and invitations)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your_smtp_key
MAIL_FROM=CollabLoop <no-reply@yourdomain.com>
```

> **Security Rule**: Generate the `JWT_SECRET` with high entropy:
> ```bash
> openssl rand -hex 32
> ```

---

### 2. MongoDB Atlas Migration Guide

1. **Create an Atlas Cluster**:
   - Provision a M10+ cluster on AWS, GCP, or Azure with automated backup enabled.
   - Configure **Database Access**: Create a dedicated database user with `readWrite` access to the `collabloop` database.
   - Configure **Network Access**: Add your application server's static IP or VPC peering. (Avoid `0.0.0.0/0` in production).

2. **Migrate Local Data (if applicable)**:
   ```bash
   # Dump local database
   mongodump --db=collabloop --out=./backup-collabloop

   # Restore into MongoDB Atlas
   mongorestore --uri="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/collabloop" ./backup-collabloop/collabloop
   ```

3. **Verify Indexes**:
   All indexes (user uniqueness, project membership compound index `{ projectId: 1, userId: 1 }`, message timeline index `{ projectId: 1, channelId: 1, createdAt: -1 }`) will build automatically upon server boot.

---

### 3. Database Backup & Disaster Recovery

#### Automated Backups
Enable continuous cloud backups via MongoDB Atlas with 7-day point-in-time recovery and snapshot scheduling.

#### Manual Snapshot Backup (`mongodump`)
```bash
mongodump --uri="$MONGODB_URI" --gzip --archive="./backups/collabloop-$(date +%Y%m%d_%H%M%S).gz"
```

#### Snapshot Restore (`mongorestore`)
```bash
mongorestore --uri="$MONGODB_URI" --gzip --archive="./backups/collabloop-snapshot.gz" --drop
```

---

### 4. Reverse Proxy & HTTPS Configuration (Nginx Example)

```nginx
server {
    listen 80;
    server_name collabloop.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name collabloop.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/collabloop.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/collabloop.yourdomain.com/privkey.pem;

    # Static frontend assets
    location / {
        root /var/www/collabloop/frontend/dist;
        try_files $uri $uri/ /index.html;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # API Endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Socket.IO WebSockets
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

---

### 5. Health Monitoring & Container Readiness

The API provides a health check endpoint at `GET /api/health`:

- **HTTP 200 OK**: Both Express server and MongoDB are fully operational.
  ```json
  {
    "status": "healthy",
    "database": "connected",
    "uptime": 1420,
    "timestamp": "2026-11-18T13:30:00.000Z",
    "environment": "production"
  }
  ```
- **HTTP 503 Service Unavailable**: Database connection has dropped. Load balancers and container orchestrators should remove the instance from routing.
  ```json
  {
    "status": "unhealthy",
    "database": "disconnected",
    "uptime": 1420,
    "timestamp": "2026-11-18T13:30:00.000Z",
    "environment": "production"
  }
  ```

---

### 6. Socket.IO Horizontal Scaling

When scaling CollabLoop beyond a single Node.js instance, configure the `@socket.io/redis-adapter` to distribute messages across instances:

1. Install adapter: `npm --prefix server install @socket.io/redis-adapter redis`
2. Configure Redis connection in `server/src/sockets/handlers.js`:
   ```javascript
   import { createAdapter } from '@socket.io/redis-adapter';
   import { createClient } from 'redis';

   const pubClient = createClient({ url: process.env.REDIS_URL });
   const subClient = pubClient.duplicate();
   await Promise.all([pubClient.connect(), subClient.connect()]);
   io.adapter(createAdapter(pubClient, subClient));
   ```

---

## Verification & Testing Suites

To verify application integrity, execute the automated test suites:

```bash
# 1. Frontend bundle build (verifies chunk sizes under 500 kB limit)
npm --prefix frontend run build

# 2. Phase 7: Production readiness, security headers, rate limiting, and config validation
node --env-file=server/.env scratch/test_phase7_production.mjs

# 3. Phase 6: Project settings, permissions, role updates, and lifecycle audit
node --env-file=server/.env C:/Users/muham/.gemini/antigravity/brain/2afefb43-48dc-4686-b079-ac0ea185137f/scratch/test_phase6.mjs

# 4. Phase 5: Cross-project isolation, real-time chat, and media galleries
node --env-file=server/.env C:/Users/muham/.gemini/antigravity/brain/2afefb43-48dc-4686-b079-ac0ea185137f/scratch/test_phase5_integration.mjs
```
