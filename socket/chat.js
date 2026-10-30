const db = require('../database/db');
const { detectMood } = require('../services/moodDetection');

function registerChat(io, sessionMiddleware) {
  io.engine.use(sessionMiddleware);
  io.use((socket, next) => {
    const userId = socket.request.session?.userId;
    if (!userId) return next(new Error('Authentication required'));
    socket.userId = Number(userId);
    next();
  });
  const onlineCounts = new Map();
  io.on('connection', socket => {
    const userId = socket.userId;
    onlineCounts.set(userId, (onlineCounts.get(userId) || 0) + 1);
    socket.join(`user:${userId}`);
    for (const onlineUserId of onlineCounts.keys()) socket.emit('presence', { userId: onlineUserId, online: true });
    io.emit('presence', { userId, online: true });

    socket.on('join_conversation', ({ conversationId } = {}, ack = () => {}) => {
      const id = Number(conversationId);
      const member = Number.isSafeInteger(id) && db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(id, userId);
      if (!member) return ack({ ok: false, error: 'Conversation access denied.' });
      socket.join(`conversation:${id}`);
      ack({ ok: true });
    });

    socket.on('send_message', ({ conversationId, body } = {}, ack = () => {}) => {
      try {
        const id = Number(conversationId);
        const messageBody = typeof body === 'string' ? body.trim() : '';
        if (!Number.isSafeInteger(id) || id < 1) return ack({ ok: false, error: 'Invalid conversation.' });
        if (!messageBody || messageBody.length > 4000) return ack({ ok: false, error: 'Message must contain 1–4000 characters.' });
        const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(id, userId);
        if (!member) return ack({ ok: false, error: 'Conversation access denied.' });
        const setting = db.prepare('SELECT mood_detection_enabled FROM user_settings WHERE user_id=?').get(userId);
        const enabled = !!setting?.mood_detection_enabled;
        const mood = enabled ? detectMood(messageBody) : 'Unavailable';
        const result = db.prepare('INSERT INTO messages (conversation_id,sender_id,body,mood,mood_enabled) VALUES (?,?,?,?,?)').run(id, userId, messageBody, mood, enabled ? 1 : 0);
        db.prepare("UPDATE conversations SET updated_at=datetime('now') WHERE id=?").run(id);
        const message = db.prepare('SELECT m.id,m.conversation_id,m.sender_id,m.body,m.mood,m.mood_enabled,m.created_at,u.username AS sender_username FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?').get(result.lastInsertRowid);
        io.to(`conversation:${id}`).emit('new_message', message);
        // Also deliver to recipient sockets even if they have not opened this chat yet.
        const members = db.prepare('SELECT user_id FROM conversation_members WHERE conversation_id=?').all(id);
        for (const memberRow of members) io.to(`user:${memberRow.user_id}`).emit('conversation_update', { conversationId: id, message });
        ack({ ok: true, message });
      } catch (error) { console.error('send_message error:', error); ack({ ok: false, error: 'Message could not be sent.' }); }
    });

    socket.on('disconnect', () => {
      const count = (onlineCounts.get(userId) || 1) - 1;
      if (count <= 0) { onlineCounts.delete(userId); io.emit('presence', { userId, online: false }); }
      else onlineCounts.set(userId, count);
    });
  });
}
module.exports = { registerChat };
