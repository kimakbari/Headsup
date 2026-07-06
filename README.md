# Heads up — Task Tracker

A warm, friendly task tracker built with React, Node.js, and PostgreSQL.

---

## Prerequisites

- **Node.js** v18 or later
- **PostgreSQL** v14 or later (running locally or via a cloud service)

---

## Setup

### 1. Database

Create a PostgreSQL database for Heads up:

```sql
CREATE DATABASE kaputi;
```

### 2. Backend

```bash
cd backend

# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env
# Open .env and set your DB_PASSWORD and DB_USER at minimum.
# Change JWT_SECRET to a long random string for production.

# Create tables
npm run db:setup

# Create the admin account
npm run db:seed

# Start the backend (development)
npm run dev

# Or for production
npm start
```

The backend runs on **http://localhost:3001** by default.

**Default admin credentials** (set in `.env`):
- Username: `admin`
- Password: `admin123`

⚠️ Change the password after your first login by editing `.env` and re-running `npm run db:seed`, or by building a password-change UI.

### 3. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend runs on **http://localhost:5173**.  
API requests are proxied to the backend automatically via Vite's dev server.

---

## Environment Variables (backend)

| Variable              | Default         | Description                                 |
|-----------------------|-----------------|---------------------------------------------|
| `DB_HOST`             | `localhost`     | PostgreSQL host                             |
| `DB_PORT`             | `5432`          | PostgreSQL port                             |
| `DB_NAME`             | `kaputi`        | Database name                               |
| `DB_USER`             | `postgres`      | Database user                               |
| `DB_PASSWORD`         | *(required)*    | Database password                           |
| `JWT_SECRET`          | *(change this)* | Secret key for signing JWTs                 |
| `PORT`                | `3001`          | Backend port                                |
| `FRONTEND_URL`        | `http://localhost:5173` | Allowed CORS origin                |
| `ADMIN_USERNAME`      | `admin`         | Admin account username (used by `db:seed`)  |
| `ADMIN_PASSWORD`      | `admin123`      | Admin account password (used by `db:seed`)  |
| `ADMIN_DISPLAY_NAME`  | `Admin`         | Admin display name                          |

---

## Project Structure

```
heads-up/
├── backend/
│   ├── server.js          — Express entry point
│   ├── .env.example       — Environment variable template
│   ├── db/
│   │   ├── index.js       — PostgreSQL connection pool
│   │   ├── schema.sql     — Table definitions
│   │   ├── setup.js       — Runs schema.sql
│   │   └── seed.js        — Creates admin account
│   ├── middleware/
│   │   └── auth.js        — JWT auth, admin guard, permission helper
│   ├── routes/
│   │   ├── auth.js        — Login / logout / me
│   │   ├── members.js     — Member CRUD
│   │   ├── teams.js       — Team CRUD
│   │   ├── projects.js    — Project CRUD + home data
│   │   ├── tasks.js       — Task CRUD + subtasks + notifications
│   │   └── uploads.js     — File attachments (multer)
│   └── uploads/           — Uploaded files stored here
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── App.jsx             — Router + protected routes
        ├── index.css           — Design tokens + animations
        ├── utils.js            — Status/priority helpers, date utils
        ├── api/index.js        — Axios instance
        ├── context/
        │   └── AuthContext.jsx — Auth state + login/logout
        ├── components/
        │   ├── Layout.jsx
        │   ├── Topbar.jsx      — Sticky nav bar + notifications
        │   ├── HamburgerMenu.jsx
        │   ├── ProgressRing.jsx
        │   └── Toast.jsx
        └── pages/
            ├── Login.jsx
            ├── Home.jsx         — Admin: All Projects with rings
            ├── MyTasks.jsx      — Member: tasks assigned to me
            ├── Teams.jsx
            ├── TeamProjects.jsx
            ├── Board.jsx        — Kanban + Create/Edit Task modal
            ├── TaskDetail.jsx   — Two-column detail + activity
            ├── Members.jsx
            ├── MemberForm.jsx
            ├── TeamForm.jsx
            └── ProjectForm.jsx
```

---

## API Overview

| Method | Path                              | Auth      | Description                        |
|--------|-----------------------------------|-----------|------------------------------------|
| POST   | `/api/auth/login`                 | Public    | Login, returns JWT cookie          |
| POST   | `/api/auth/logout`                | Public    | Clear cookie                       |
| GET    | `/api/auth/me`                    | Protected | Current user                       |
| GET    | `/api/members`                    | Protected | List non-admin members             |
| POST   | `/api/members`                    | Admin     | Create member                      |
| PUT    | `/api/members/:id`                | Admin     | Update member                      |
| DELETE | `/api/members/:id`                | Admin     | Delete member                      |
| GET    | `/api/teams`                      | Protected | Teams (filtered by membership)     |
| POST   | `/api/teams`                      | Admin     | Create team                        |
| PUT    | `/api/teams/:id`                  | Admin     | Update team                        |
| DELETE | `/api/teams/:id`                  | Admin     | Delete team                        |
| GET    | `/api/projects`                   | Protected | Projects (filtered by permission)  |
| GET    | `/api/projects?teamId=xxx`        | Protected | Projects for a team                |
| GET    | `/api/projects/home`              | Protected | Admin home data                    |
| POST   | `/api/projects`                   | Admin     | Create project                     |
| DELETE | `/api/projects/:id`               | Admin     | Delete project                     |
| GET    | `/api/tasks?projectId=xxx`        | Protected | Tasks for a board                  |
| GET    | `/api/tasks/my`                   | Protected | Tasks assigned to me               |
| GET    | `/api/tasks/:id`                  | Protected | Task detail                        |
| POST   | `/api/tasks`                      | Protected | Create task (requires create perm) |
| PUT    | `/api/tasks/:id`                  | Protected | Edit task (requires edit perm)     |
| DELETE | `/api/tasks/:id`                  | Protected | Delete task (requires delete perm) |
| PUT    | `/api/tasks/:id/status`           | Protected | Move to status (requires edit)     |
| POST   | `/api/tasks/:id/subtasks`         | Protected | Add subtask inline                 |
| PUT    | `/api/tasks/:id/subtasks/:subId`  | Protected | Toggle subtask done                |
| GET    | `/api/tasks/notifications/upcoming` | Protected | Upcoming deadline tasks          |
| POST   | `/api/uploads/:taskId`            | Protected | Attach a file (max 10 MB)          |

---

## Notes

- **File uploads** are stored locally in `backend/uploads/`. For production, consider an S3 bucket.
- **JWT cookies** are `httpOnly` and `SameSite: lax`. Set `NODE_ENV=production` to also make them `Secure`.
- **Progress** is calculated server-side: task → subtask completion (weighted or even); project → average task progress (excluding cancelled); home page → average project progress per team.
- The admin account's password is set only by `db:seed`. Running seed again won't overwrite it (uses `ON CONFLICT DO NOTHING`). To reset: `UPDATE members SET password_hash = ... WHERE is_admin = TRUE`.
