const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please try again later.' } });
const publicUser = row => ({ id: row.id, username: row.username, email: row.email, bio: row.bio || '' });

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) return res.status(400).json({ error: 'Username must be 3–24 characters (letters, numbers or underscores).' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Password must be 8–72 characters.' });
    if (db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email)) return res.status(409).json({ error: 'That username or email is already registered.' });
    const hash = await bcrypt.hash(password, 12);
    const result = db.prepare('INSERT INTO users (username,email,password_hash) VALUES (?,?,?)').run(username, email, hash);
    db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(result.lastInsertRowid);
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.userId = Number(result.lastInsertRowid);
      req.session.save(saveErr => saveErr ? next(saveErr) : res.status(201).json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId)) }));
    });
  } catch (error) { next(error); }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const login = String(req.body.login || '').trim();
    const password = String(req.body.password || '');
    const user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE OR username = ? COLLATE NOCASE').get(login, login);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid username/email or password.' });
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.userId = user.id;
      req.session.save(saveErr => saveErr ? next(saveErr) : res.json({ user: publicUser(user) }));
    });
  } catch (error) { next(error); }
});

router.post('/logout', requireAuth, (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('smartchat.sid');
    res.json({ message: 'Logged out successfully.' });
  });
});
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id,username,email,bio FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Session user no longer exists.' });
  res.json({ user });
});
module.exports = router;
