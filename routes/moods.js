const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);
router.get('/history', (req, res) => {
  const userId = req.session.userId;
  const total = db.prepare('SELECT COUNT(*) AS count FROM messages WHERE sender_id=? AND mood_enabled=1').get(userId).count;
  const counts = db.prepare(`SELECT mood,COUNT(*) AS count FROM messages WHERE sender_id=? AND mood_enabled=1 GROUP BY mood`).all(userId);
  const recent = db.prepare(`SELECT id,body,mood,created_at FROM messages WHERE sender_id=? ORDER BY id DESC LIMIT 20`).all(userId);
  const weekly = db.prepare(`SELECT date(created_at) AS day,mood,COUNT(*) AS count FROM messages WHERE sender_id=? AND mood_enabled=1 AND date(created_at)>=date('now','-6 days') GROUP BY day,mood ORDER BY day`).all(userId);
  res.json({ total, counts, recent, weekly });
});
module.exports = router;
