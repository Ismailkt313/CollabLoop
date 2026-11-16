# CollabLoop

CollabLoop is being restructured as a feature-based modular monolith: a React/Vite client and an Express/Mongoose API in this repository, with MongoDB Community Server as the sole application database. Existing gallery, workflow, and document components are retained while the new centralized account, project, membership, invitations, resource/document APIs and Socket.IO foundation are introduced.

## Local development

Requirements: Node.js 20+, npm, and MongoDB Community Server installed locally. Atlas/Firebase are not used. Start MongoDB using your operating system's service manager (for example `sudo systemctl start mongod` on Linux, or `brew services start mongodb-community` on macOS). The API intentionally exits with the MongoDB connection error when the local service is unavailable; it never uses an in-memory fallback.

1. Install client and server dependencies: `npm ci && npm --prefix server install`.
2. Create backend configuration: `cp server/.env.example server/.env`.
3. Set a long random `JWT_SECRET` in `server/.env`. Set Cloudinary credentials there only if using signed uploads. Never put API secrets in `VITE_` variables. `server/.env` is gitignored.
4. Ensure local MongoDB is running at `mongodb://127.0.0.1:27017/collabloop` (override via server `.env` if necessary).
5. In terminal one run `npm run dev:server`; in terminal two run `npm run dev`. Vite proxies `/api` and Socket.IO to port 5000.
6. Visit `http://localhost:2345`. Create an account or sign in. Passwords are bcrypt hashed; session JWTs are delivered in HTTP-only cookies.

Production: set `COOKIE_SECURE=true`, a strong secret, a trusted `CLIENT_ORIGIN` and backend-only Cloudinary credentials, then run `npm run build` and `npm --prefix server start` behind HTTPS. Restrict CORS to your exact client origin. To enable password recovery, configure the backend-only `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM` values in `server/.env`; without these, the API reports that recovery email is not configured.

## Current architecture/API

Backend feature routes and models live under `server/src`; each project request checks an active membership on the server. Models include User, Project, ProjectMember, Invitation, Channel, Message, Resource and Document, with unique account/membership/channel indexes. Socket.IO authenticates the session and joins project/channel rooms only after membership verification. Signed Cloudinary upload parameters are issued only to project members. Frontend features live under `src/features` and use the same-site `/api` proxy.

Available endpoints include `/api/auth/{register,login,logout,me}`, `/api/users/{search,me}`, `/api/projects`, project members/channels/messages/resources/documents, `/api/invitations`, and project upload signing. Check `GET /api/health` for API/database status. Registration accepts full name, username, email, password and confirmation; passwords require at least 10 characters.

## Existing data and assets

Legacy browser-local gallery/docs and global Cloudinary-tag records have no reliable project owner. They are deliberately not automatically imported into a newly created project: doing so could leak assets across teams. Existing Cloudinary assets are not deleted. An administrator should explicitly assign each legacy item to its intended project and import only its metadata (URL, public ID, type, title, category) using the project resource API after membership exists. Legacy message stores are likewise not copied into project channels without an explicit project/channel assignment. The existing legacy components/services are retained for compatibility/reference, but the authenticated project shell is now the main navigation.

## Validation

Run `npm run build`, `npm run lint`, `npm --prefix server run check`. Backend integration checks require a running local MongoDB instance. No hosted database fallback is configured.
