const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);
router.put('/', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const bio = String(req.body.bio || '').trim();
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) return res.status(400).json({ error: 'Username must be 3–24 characters (letters, numbers or underscores).' });
    if (bio.length > 240) return res.status(400).json({ error: 'Bio must be 240 characters or fewer.' });
    const conflict = db.prepare('SELECT id FROM users WHERE username=? COLLATE NOCASE AND id != ?').get(username, req.session.userId);
    if (conflict) return res.status(409).json({ error: 'That username is already taken.' });
    db.prepare('UPDATE users SET username=?,bio=? WHERE id=?').run(username, bio, req.session.userId);
    res.json({ user: db.prepare('SELECT id,username,email,bio FROM users WHERE id=?').get(req.session.userId) });
  } catch (error) { next(error); }
});
router.put('/password', async (req, res, next) => {
  try {
    const current = String(req.body.currentPassword || '');
    const nextPassword = String(req.body.newPassword || '');
    if (nextPassword.length < 8 || nextPassword.length > 72) return res.status(400).json({ error: 'New password must be 8–72 characters.' });
    const user = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.session.userId);
    if (!await bcrypt.compare(current, user.password_hash)) return res.status(400).json({ error: 'Current password is incorrect.' });
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await bcrypt.hash(nextPassword, 12), req.session.userId);
    res.json({ message: 'Password updated.' });
  } catch (error) { next(error); }
});
module.exports = router;
