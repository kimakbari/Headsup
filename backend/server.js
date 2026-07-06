require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const cookieParser = require('cookie-parser');

const authRoutes    = require('./routes/auth');
const memberRoutes  = require('./routes/members');
const teamRoutes    = require('./routes/teams');
const projectRoutes = require('./routes/projects');
const taskRoutes    = require('./routes/tasks');
const uploadRoutes  = require('./routes/uploads');
const { authenticate } = require('./middleware/auth');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);                         // public
app.use('/api/members',  authenticate, memberRoutes);         // protected
app.use('/api/teams',    authenticate, teamRoutes);           // protected
app.use('/api/projects', authenticate, projectRoutes);        // protected
app.use('/api/tasks',    authenticate, taskRoutes);           // protected
app.use('/api/uploads',  authenticate, uploadRoutes);         // protected

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀  Heads up backend → http://localhost:${PORT}`);
  console.log(`    Frontend expected at: ${process.env.FRONTEND_URL || 'http://localhost:5173'}\n`);
});
