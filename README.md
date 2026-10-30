# Smart Chat App with Mood Detection

A responsive, real-time messaging application built with HTML, CSS, JavaScript, Node.js, Express, Socket.IO, SQLite and bcrypt. Mood detection is an optional, explainable keyword-based estimate; it is not a psychological or medical assessment.

## Requirements

- Node.js 20 or newer (Node.js 22 LTS recommended)
- npm

## Installation

```bash
cd smart-chat-app
npm install
```

Copy the environment template and set a session secret:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
```

**Windows Command Prompt**

```cmd
copy .env.example .env
```

Edit `.env` and replace `SESSION_SECRET` with a long random value (at least 32 characters). The development fallback allows a quick local start, but always set your own secret before sharing or deploying the app.

## Run the application

```bash
npm start
```

Open <http://localhost:3000> in your browser. The SQLite database and session database are created automatically under `database/` on first start.

For development with automatic restart:

```bash
npm run dev
```

## Demo accounts

Seed two demo accounts and a sample conversation:

```bash
npm run seed
```

Both accounts use the password `DemoPass123!`:

| Username | Email |
|---|---|
| alex | alex@example.com |
| sam | sam@example.com |

Sign in as each account in two separate browser sessions (for example, a normal window and a private window) to test live chat. Change demo passwords if you intend to keep using the seeded database.

## Features

- Account registration and login with bcrypt password hashes.
- Session-based authentication; session records persist in SQLite.
- User directory and search.
- One-to-one conversations with membership checks.
- Socket.IO messaging, online/offline presence and persistent message history.
- Per-outgoing-message mood classification, stored with the message.
- Private mood history, mood totals, recent classifications and a seven-day distribution chart.
- Profile editing and password changes.
- Per-user mood detection privacy setting. Disabled messages are still delivered and saved with mood `Unavailable` and `mood_enabled = 0`.

## Mood detection approach

`services/moodDetection.js` contains the classifier. It normalizes message text, checks for curated emotion-related keywords, scores the four non-neutral categories and returns the highest-scoring category. If no keyword is found, it returns `Neutral`. For a tie, it uses a fixed priority (Angry, Stressed, Sad, Happy) so results are deterministic. The logic is intentionally lightweight and can misread sarcasm, context, slang, negation and mixed emotions. It must not be used to infer a person's mental-health status.

When a user disables mood detection, the server skips the classifier entirely and stores `Unavailable`. The preference affects only messages sent by that user; each sender controls analysis of their own messages.

## API overview

All endpoints except registration, login and health require an authenticated session.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/auth/me` | Current user |
| GET | `/api/users?q=` | Search/list users |
| POST | `/api/users/:id/conversation` | Find or create a one-to-one conversation |
| GET | `/api/messages/:conversationId` | Load conversation history |
| PUT | `/api/profile` | Update username and bio |
| PUT | `/api/profile/password` | Change password |
| GET | `/api/settings` | Read privacy settings |
| PUT | `/api/settings` | Update mood detection preference |
| GET | `/api/moods/history` | Current user's mood history |

### Socket.IO events

Client to server:

- `join_conversation` — join a conversation room after server-side membership validation.
- `send_message` — validate, classify (if enabled), persist and broadcast a message.

Server to client:

- `new_message` — a message in an open conversation.
- `conversation_update` — update a member's conversation preview.
- `presence` — online/offline status.

## Database tables

- `users` — account credentials and profile.
- `conversations` — conversation records.
- `conversation_members` — conversation membership and authorization.
- `messages` — message text, sender, mood, mood-enabled flag and timestamp.
- `user_settings` — per-user mood detection preference.

SQLite foreign-key enforcement is enabled. Password hashes are never returned by API routes.

## Security and deployment notes

- Use HTTPS in production and set `COOKIE_SECURE=true`.
- Set `NODE_ENV=production` and a strong `SESSION_SECRET` (32+ characters).
- The session cookie is HTTP-only and SameSite=Lax.
- Login and registration are rate-limited.
- The server checks conversation membership when loading history, joining a room and sending a message.
- Never commit `.env`, database files or demo credentials to a public repository.
- The default SQLite session store is suitable for a small college project, not a horizontally scaled production deployment.

## Tests

Run the built-in mood-classifier tests:

```bash
npm test
```

Manual integration test checklist:

1. Run `npm run seed`, then start the app.
2. Sign in as Alex in one browser and Sam in a second browser/private window.
3. Open each other's conversation and send messages in both directions.
4. Confirm the receiver sees messages without refreshing.
5. Refresh either browser and confirm message history remains.
6. Send sample texts for Happy, Sad, Angry, Stressed and Neutral.
7. Turn mood detection off for one account; send a message and confirm it appears as `Not analyzed` while delivery still works.
8. Open Mood history in each account and confirm it shows only that account's sent-message history.
9. Change profile details and password; test the new credentials.
10. Attempt to request another conversation's message endpoint while signed in as a non-member; the server should return HTTP 403.

## Project structure

```text
smart-chat-app/
├── database/
│   ├── db.js
│   └── schema.sql
├── middleware/
│   └── auth.js
├── public/
│   ├── css/style.css
│   ├── js/app.js
│   └── index.html
├── routes/
│   ├── auth.js
│   ├── messages.js
│   ├── moods.js
│   ├── profile.js
│   ├── settings.js
│   └── users.js
├── scripts/seed.js
├── services/moodDetection.js
├── socket/chat.js
├── test/moodDetection.test.js
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js
```
