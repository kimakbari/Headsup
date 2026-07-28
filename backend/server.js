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
const notificationRoutes = require('./routes/notifications');
const { authenticate } = require('./middleware/auth');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://89.44.241.66:5173',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
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
app.use('/api/notifications', authenticate, notificationRoutes); // protected

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀  Heads up backend → http://localhost:${PORT}`);
  console.log(`    Frontend expected at: ${process.env.FRONTEND_URL || 'http://localhost:5173'}\n`);
});
