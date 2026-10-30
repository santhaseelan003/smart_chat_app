const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const configuredPath = process.env.DATABASE_FILE || './database/chat.sqlite';
const dbPath = path.resolve(process.cwd(), configuredPath);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

module.exports = db;
