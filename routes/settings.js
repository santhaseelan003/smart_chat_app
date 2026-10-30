const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);
router.get('/', (req, res) => {
  const settings = db.prepare('SELECT mood_detection_enabled FROM user_settings WHERE user_id=?').get(req.session.userId);
  res.json({ settings: { moodDetectionEnabled: !!settings?.mood_detection_enabled } });
});
router.put('/', (req, res) => {
  if (typeof req.body.moodDetectionEnabled !== 'boolean') return res.status(400).json({ error: 'moodDetectionEnabled must be true or false.' });
  db.prepare(`INSERT INTO user_settings (user_id,mood_detection_enabled) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET mood_detection_enabled=excluded.mood_detection_enabled,updated_at=datetime('now')`).run(req.session.userId, req.body.moodDetectionEnabled ? 1 : 0);
  res.json({ settings: { moodDetectionEnabled: req.body.moodDetectionEnabled } });
});
module.exports = router;
