require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../database/db');
(async () => {
  const passwordHash = await bcrypt.hash('DemoPass123!', 12);
  const users = [
    { username: 'alex', email: 'alex@example.com', bio: 'Design student. Always happy to chat.' },
    { username: 'sam', email: 'sam@example.com', bio: 'Computer science student.' }
  ];
  const ids = [];
  for (const user of users) {
    let row = db.prepare('SELECT id FROM users WHERE email=?').get(user.email);
    if (!row) {
      const result = db.prepare('INSERT INTO users (username,email,password_hash,bio) VALUES (?,?,?,?)').run(user.username, user.email, passwordHash, user.bio);
      row = { id: Number(result.lastInsertRowid) };
    }
    db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(row.id);
    ids.push(row.id);
  }
  const existing = db.prepare(`SELECT c.id FROM conversations c JOIN conversation_members a ON a.conversation_id=c.id AND a.user_id=? JOIN conversation_members b ON b.conversation_id=c.id AND b.user_id=? WHERE (SELECT COUNT(*) FROM conversation_members x WHERE x.conversation_id=c.id)=2`).get(ids[0], ids[1]);
  if (!existing) {
    const create = db.transaction(() => {
      const result = db.prepare('INSERT INTO conversations DEFAULT VALUES').run();
      const id = Number(result.lastInsertRowid);
      db.prepare('INSERT INTO conversation_members (conversation_id,user_id) VALUES (?,?)').run(id, ids[0]);
      db.prepare('INSERT INTO conversation_members (conversation_id,user_id) VALUES (?,?)').run(id, ids[1]);
      const addMessage = db.prepare('INSERT INTO messages (conversation_id,sender_id,body,mood,mood_enabled) VALUES (?,?,?,?,1)');
      addMessage.run(id, ids[0], 'Hey Sam, hope you are having a great day!', 'Happy');
      addMessage.run(id, ids[1], 'Thanks! I have a busy deadline today.', 'Stressed');
    });
    create();
  }
  console.log('Demo accounts ready: alex@example.com and sam@example.com');
  console.log('Password for both accounts: DemoPass123!');
  console.log('Change these demo passwords after first login if you keep the data.');
})();
