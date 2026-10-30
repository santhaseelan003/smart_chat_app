const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);
router.get('/', (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 40);
  const users = db.prepare(`SELECT u.id,u.username,u.bio,
    (SELECT c.id FROM conversations c JOIN conversation_members a ON a.conversation_id=c.id AND a.user_id=? JOIN conversation_members b ON b.conversation_id=c.id AND b.user_id=u.id WHERE (SELECT COUNT(*) FROM conversation_members x WHERE x.conversation_id=c.id)=2 LIMIT 1) AS conversation_id,
    (SELECT m.body FROM messages m JOIN conversation_members cm ON cm.conversation_id=m.conversation_id WHERE cm.user_id=? AND m.conversation_id IN (SELECT conversation_id FROM conversation_members WHERE user_id=u.id) ORDER BY m.id DESC LIMIT 1) AS last_message,
    (SELECT m.created_at FROM messages m WHERE m.conversation_id IN (SELECT conversation_id FROM conversation_members WHERE user_id=? AND conversation_id IN (SELECT conversation_id FROM conversation_members WHERE user_id=u.id)) ORDER BY m.id DESC LIMIT 1) AS last_message_at
    FROM users u WHERE u.id != ? AND (u.username LIKE ? OR u.bio LIKE ?) ORDER BY COALESCE(last_message_at,'') DESC,u.username COLLATE NOCASE`).all(req.session.userId, req.session.userId, req.session.userId, req.session.userId, `%${q}%`, `%${q}%`);
  res.json({ users });
});
router.post('/:id/conversation', (req, res) => {
  const otherId = Number(req.params.id);
  if (!Number.isSafeInteger(otherId) || otherId <= 0 || otherId === req.session.userId) return res.status(400).json({ error: 'Invalid user.' });
  if (!db.prepare('SELECT id FROM users WHERE id=?').get(otherId)) return res.status(404).json({ error: 'User not found.' });
  const existing = db.prepare(`SELECT c.id FROM conversations c JOIN conversation_members a ON a.conversation_id=c.id AND a.user_id=? JOIN conversation_members b ON b.conversation_id=c.id AND b.user_id=? WHERE (SELECT COUNT(*) FROM conversation_members x WHERE x.conversation_id=c.id)=2 LIMIT 1`).get(req.session.userId, otherId);
  if (existing) return res.json({ conversationId: existing.id });
  const create = db.transaction(() => {
    const result = db.prepare('INSERT INTO conversations DEFAULT VALUES').run();
    const id = Number(result.lastInsertRowid);
    const add = db.prepare('INSERT INTO conversation_members (conversation_id,user_id) VALUES (?,?)');
    add.run(id, req.session.userId); add.run(id, otherId);
    return id;
  });
  res.status(201).json({ conversationId: create() });
});
module.exports = router;
