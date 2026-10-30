const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);
function isMember(conversationId, userId) {
  return !!db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(conversationId, userId);
}
router.get('/:conversationId', (req, res) => {
  const id = Number(req.params.conversationId);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid conversation.' });
  if (!isMember(id, req.session.userId)) return res.status(403).json({ error: 'You cannot access this conversation.' });
  const messages = db.prepare(`SELECT m.id,m.conversation_id,m.sender_id,m.body,m.mood,m.mood_enabled,m.created_at,u.username AS sender_username FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=? ORDER BY m.id ASC LIMIT 500`).all(id);
  res.json({ messages });
});
module.exports = router;
