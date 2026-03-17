const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const passport = require('passport');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config({ path: path.join(__dirname, '.env') });

// Configure passport (local email/password auth)
require('./auth/passport');

const app = express();
const server = http.createServer(app);

// Socket.io for real-time notifications
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (origin.includes('localhost:') || origin.includes('127.0.0.1:') || origin.includes('.app.github.dev')) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  }
});

// Make io globally accessible for controllers
global.io = io;

io.on('connection', (socket) => {
  // Join user's personal room for notifications
  socket.on('join', (userId) => {
    if (userId) socket.join(userId);
  });
});

app.set('trust proxy', 1);

const isCodespace = !!process.env.CODESPACES;
const uploadsBase = process.env.UPLOADS_BASE || (isCodespace
  ? '/tmp/rocket-league-central-uploads'
  : path.join(__dirname, '../uploads'));

// Create uploads dirs (use absolute paths matching multer config in controllers)
['videos', 'thumbnails', 'avatars'].forEach(sub => {
  const dir = path.join(uploadsBase, sub);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.includes('localhost:') || origin.includes('127.0.0.1:')) {
      return callback(null, true);
    }
    if (origin.includes('.app.github.dev')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
// Log API requests for debugging
app.use('/api', (req, res, next) => {
  console.log(`[API] ${req.method} ${req.originalUrl} from ${req.headers.origin || 'same-origin'}`);
  next();
});
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(uploadsBase));

// Session (persisted in MongoDB)
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017/rocket-league-central',
    collectionName: 'sessions'
  }),
  cookie: {
    secure: isCodespace,
    sameSite: isCodespace ? 'none' : 'lax',
    maxAge: 24*60*60*1000
  }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
const authRoutes = require('./routes/auth');
const clipRoutes = require('./routes/clips');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const playlistRoutes = require('./routes/playlists');
const contestRoutes = require('./routes/contests');
const { apiLimiter } = require('./middleware/rateLimiter');

app.use('/api', apiLimiter);
app.use('/auth', authRoutes);
app.use('/api/clips', clipRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/contests', contestRoutes);

// Serve frontend
app.get(['/', '/Home.html', '/trending.html', '/upload.html', '/profile.html', '/dashboard.html', '/search.html', '/watch.html', '/login.html', '/leaderboards.html', '/admin.html', '/highlights.html', '/playlists.html', '/contests.html', '/forgot-password.html', '/reset-password.html'], (req, res) => {
  const page = req.path === '/' ? 'Home.html' : req.path.slice(1);
  const filePath = path.join(__dirname, '../frontend', page);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.sendFile(path.join(__dirname, '../frontend/Home.html'));
});

// 404 handler for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/rocket-league-central')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err.message));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

