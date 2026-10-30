require('dotenv').config();
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const session = require('express-session');
const SQLiteStoreFactory = require('connect-sqlite3');
const helmet = require('helmet');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const profileRoutes = require('./routes/profile');
const settingsRoutes = require('./routes/settings');
const moodRoutes = require('./routes/moods');
const { registerChat } = require('./socket/chat');
require('./database/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const SQLiteStore = SQLiteStoreFactory(session);
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('Set SESSION_SECRET to a random value of at least 32 characters in production.');
}
if (isProduction) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'], connectSrc: ["'self'", 'ws:', 'wss:'], imgSrc: ["'self'", 'data:'] } } }));
app.use(express.json({ limit: '20kb' }));
const sessionMiddleware = session({
  name: 'smartchat.sid',
  secret: process.env.SESSION_SECRET || 'development-only-change-this-session-secret-before-deployment',
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore({
  db: 'sessions.sqlite',
  dir: process.env.SESSION_DB_DIR ||
       path.resolve(process.cwd(), 'database')
}),
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: 1000 * 60 * 60 * 24 * 7 }
});
app.use(sessionMiddleware);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/moods', moodRoutes);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use((req, res) => res.status(404).json({ error: 'Resource not found.' }));
app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});
registerChat(io, sessionMiddleware);
const port = Number(process.env.PORT) || 3000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Smart Chat App running on port ${port}`);
});
