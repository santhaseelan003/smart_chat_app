(() => {
  const $ = selector => document.querySelector(selector);
  const state = { user: null, users: [], currentUser: null, conversationId: null, messages: [], socket: null, online: new Set(), settings: { moodDetectionEnabled: true }, toastTimer: null };
  const moodOrder = ['Happy', 'Sad', 'Angry', 'Stressed', 'Neutral'];
  const moodColors = { Happy: '#62b78c', Sad: '#8299df', Angry: '#d98278', Stressed: '#d7ad62', Neutral: '#aab3c0' };

  async function api(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }
  const post = (url, body) => api(url, { method: 'POST', body: JSON.stringify(body) });
  const put = (url, body) => api(url, { method: 'PUT', body: JSON.stringify(body) });
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }
  function setAuthMode(mode) {
    document.querySelectorAll('[data-auth-tab]').forEach(button => button.classList.toggle('active', button.dataset.authTab === mode));
    $('#login-form').classList.toggle('hidden', mode !== 'login');
    $('#register-form').classList.toggle('hidden', mode !== 'register');
  }
  function initials(name) { return (name || 'U').trim().slice(0, 1).toUpperCase(); }
  function formatTime(value) {
    if (!value) return '';
    const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' + formatTime(value);
  }
  function showView(view) {
    if (view === 'chat' && !state.currentUser) view = 'dashboard';
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active-view'));
    const target = $(`#view-${view}`); if (target) target.classList.add('active-view');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.toggle('active', el.dataset.view === view || (view === 'chat' && el.dataset.view === 'dashboard')));
    const titles = { dashboard: 'Overview', chat: 'Messages', moods: 'Mood history', profile: 'My profile', settings: 'Settings' };
    $('#page-title').textContent = titles[view] || 'Overview';
    if (view === 'moods') loadMoodHistory();
    if (view === 'profile') fillProfile();
    if (view === 'settings') loadSettings();
  }
  function showApp(user) {
    state.user = user;
    $('#auth-screen').classList.add('hidden'); $('#app-shell').classList.remove('hidden');
    $('#sidebar-name').textContent = user.username; $('#sidebar-email').textContent = user.email;
    $('#sidebar-avatar').textContent = initials(user.username); $('#top-avatar').textContent = initials(user.username);
    $('#welcome-name').textContent = user.username;
    connectSocket(); loadUsers(); loadMoodSnapshot();
    showView('dashboard');
  }
  function showAuth() {
    $('#app-shell').classList.add('hidden'); $('#auth-screen').classList.remove('hidden');
    if (state.socket) state.socket.disconnect(); state.socket = null; state.user = null;
  }
  async function loadUsers(query = '') {
    try {
      const { users } = await api(`/api/users?q=${encodeURIComponent(query)}`);
      state.users = users;
      $('#people-count').textContent = `${users.length} ${users.length === 1 ? 'person' : 'people'}`;
      renderUsers(); renderChatList();
    } catch (error) { toast(error.message); }
  }
  function renderUsers() {
    const list = $('#user-list');
    if (!state.users.length) { list.innerHTML = '<div class="empty-state">No people found. Try another search.</div>'; return; }
    list.innerHTML = state.users.map(user => `
      <div class="user-row" data-user-id="${user.id}" role="button" tabindex="0">
        <div class="avatar">${escapeHtml(initials(user.username))}</div>
        <div class="user-details"><strong>${escapeHtml(user.username)}</strong><small>${escapeHtml(user.bio || 'Available to chat')}</small></div>
        <div class="user-last"><span class="status-dot ${state.online.has(user.id) ? 'online' : ''}"></span>${state.online.has(user.id) ? 'Online' : (user.last_message ? escapeHtml(user.last_message) : 'Start a chat')}</div>
      </div>`).join('');
    list.querySelectorAll('[data-user-id]').forEach(row => {
      const open = () => startConversation(Number(row.dataset.userId));
      row.addEventListener('click', open); row.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
    });
  }
  function renderChatList(query = '') {
    const list = $('#chat-list');
    const users = state.users.filter(user => user.conversation_id && user.username.toLowerCase().includes(query.toLowerCase()));
    if (!users.length) { list.innerHTML = '<div class="empty-state">No conversations yet.<br>Find someone to say hello.</div>'; return; }
    list.innerHTML = users.map(user => `<div class="chat-list-item ${state.currentUser?.id === user.id ? 'selected' : ''}" data-user-id="${user.id}"><div class="avatar">${escapeHtml(initials(user.username))}</div><div class="user-details"><strong>${escapeHtml(user.username)}</strong><small>${escapeHtml(user.last_message || 'No messages yet')}</small></div></div>`).join('');
    list.querySelectorAll('[data-user-id]').forEach(row => row.addEventListener('click', () => startConversation(Number(row.dataset.userId))));
  }
  async function startConversation(userId) {
    const user = state.users.find(item => item.id === userId);
    if (!user) return;
    try {
      const { conversationId } = await post(`/api/users/${userId}/conversation`, {});
      state.currentUser = user; state.conversationId = conversationId; user.conversation_id = conversationId; state.messages = [];
      $('#chat-empty').classList.add('hidden'); $('#active-chat').classList.remove('hidden');
      $('#chat-avatar').textContent = initials(user.username); $('#chat-person-name').textContent = user.username;
      updateChatStatus(); showView('chat'); renderChatList($('#chat-search').value);
      $('#message-list').innerHTML = '<div class="empty-state">Loading messages...</div>';
      const result = await api(`/api/messages/${conversationId}`);
      if (state.conversationId !== conversationId) return;
      state.messages = result.messages; renderMessages();
      if (state.socket?.connected) state.socket.emit('join_conversation', { conversationId }, response => { if (!response?.ok) toast(response?.error || 'Could not join conversation.'); });
      $('#message-input').focus();
    } catch (error) { toast(error.message); }
  }
  function updateChatStatus() {
    if (!state.currentUser) return;
    const online = state.online.has(state.currentUser.id);
    $('#chat-person-status').textContent = online ? 'Online' : 'Offline';
    $('#chat-person-status').style.color = online ? '#35a77d' : '';
  }
  function renderMessages() {
    const list = $('#message-list');
    if (!state.messages.length) { list.innerHTML = '<div class="empty-state">No messages yet. Start the conversation.</div>'; return; }
    list.innerHTML = state.messages.map(message => {
      const mine = message.sender_id === state.user.id;
      const mood = message.mood_enabled ? `<span class="mood-tag mood-${escapeHtml(message.mood)}">${escapeHtml(message.mood)}</span>` : '<span class="mood-tag">Not analyzed</span>';
      return `<article class="message ${mine ? 'mine' : ''}" data-message-id="${message.id}"><div class="message-bubble">${escapeHtml(message.body)}</div><div class="message-meta">${mine ? '' : `<span>${escapeHtml(message.sender_username)}</span>`}<span>${formatTime(message.created_at)}</span>${mood}</div></article>`;
    }).join('');
    list.scrollTop = list.scrollHeight;
  }
  function appendMessage(message) {
    if (state.messages.some(item => item.id === message.id)) return;
    state.messages.push(message); renderMessages();
  }
  function connectSocket() {
    if (state.socket) state.socket.disconnect();
    state.socket = io();
    state.socket.on('connect', () => {
      if (state.conversationId) state.socket.emit('join_conversation', { conversationId: state.conversationId });
    });
    state.socket.on('presence', ({ userId, online }) => {
      if (online) state.online.add(userId); else state.online.delete(userId);
      renderUsers(); renderChatList($('#chat-search').value); updateChatStatus();
    });
    state.socket.on('new_message', message => {
      if (message.conversation_id === state.conversationId) appendMessage(message);
      const sender = state.users.find(user => user.id === message.sender_id);
      if (sender) { sender.last_message = message.body; renderUsers(); renderChatList($('#chat-search').value); }
    });
    state.socket.on('conversation_update', ({ conversationId, message }) => {
      const otherId = message.sender_id === state.user.id ? state.users.find(u => u.conversation_id === conversationId)?.id : message.sender_id;
      const user = state.users.find(u => u.id === otherId);
      if (user) { user.last_message = message.body; user.conversation_id = conversationId; renderUsers(); renderChatList($('#chat-search').value); }
      if (conversationId === state.conversationId) appendMessage(message);
    });
    state.socket.on('connect_error', error => { if (error.message === 'Authentication required') toast('Your session expired. Please sign in again.'); });
  }
  async function loadMoodSnapshot() {
    try {
      const data = await api('/api/moods/history');
      $('#snapshot-total').textContent = data.total.count;
      const counts = Object.fromEntries(data.counts.map(item => [item.mood, item.count]));
      $('#snapshot-moods').innerHTML = moodOrder.map(mood => {
        const count = counts[mood] || 0; const percent = data.total.count ? count / data.total.count * 100 : 0;
        return `<div class="mini-mood"><span>${mood}</span><div class="mini-track"><span style="width:${percent}%;background:${moodColors[mood]}"></span></div><b>${count}</b></div>`;
      }).join('');
    } catch (_) { $('#snapshot-total').textContent = '0'; }
  }
  async function loadMoodHistory() {
    try {
      const data = await api('/api/moods/history');
      const counts = Object.fromEntries(data.counts.map(item => [item.mood, item.count]));
      $('#mood-stats').innerHTML = `<div class="stat-card total"><span>Total analyzed</span><strong>${data.total.count}</strong></div>` + moodOrder.map(mood => `<div class="stat-card"><span>${mood}</span><strong>${counts[mood] || 0}</strong></div>`).join('');
      const days = Array.from({ length: 7 }, (_, index) => { const d = new Date(); d.setDate(d.getDate() - (6 - index)); return d.toISOString().slice(0, 10); });
      const values = Object.fromEntries(data.weekly.map(item => [`${item.day}|${item.mood}`, item.count]));
      $('#weekly-chart').innerHTML = days.map(day => {
        const total = moodOrder.reduce((sum, mood) => sum + (values[`${day}|${mood}`] || 0), 0);
        const bars = moodOrder.map(mood => { const value = values[`${day}|${mood}`] || 0; return `<span style="height:${total ? value / total * 100 : 0}%;background:${moodColors[mood]}" title="${mood}: ${value}"></span>`; }).join('');
        const label = new Date(`${day}T12:00:00`).toLocaleDateString([], { weekday: 'short' });
        return `<div class="chart-day"><div class="chart-stack">${bars}</div><small>${label}</small></div>`;
      }).join('');
      $('#chart-legend').innerHTML = moodOrder.map(mood => `<span class="legend-item"><i class="legend-dot" style="background:${moodColors[mood]}"></i>${mood}</span>`).join('');
      $('#mood-recent').innerHTML = data.recent.length ? data.recent.map(item => `<div class="history-row"><div><p>${escapeHtml(item.body)}</p><small>${formatDate(item.created_at)}</small></div><span class="mood-tag ${item.mood_enabled ? `mood-${escapeHtml(item.mood)}` : ''}">${item.mood_enabled ? escapeHtml(item.mood) : 'Not analyzed'}</span></div>`).join('') : '<div class="empty-state">Your analyzed messages will appear here.</div>';
    } catch (error) { toast(error.message); }
  }
  function fillProfile() {
    $('#profile-username').value = state.user.username; $('#profile-email').value = state.user.email;
    $('#profile-bio').value = state.user.bio || ''; $('#profile-avatar').textContent = initials(state.user.username);
  }
  async function loadSettings() {
    try { const { settings } = await api('/api/settings'); state.settings = settings; $('#mood-toggle').checked = settings.moodDetectionEnabled; }
    catch (error) { toast(error.message); }
  }

  document.querySelectorAll('[data-auth-tab]').forEach(button => button.addEventListener('click', () => setAuthMode(button.dataset.authTab)));
  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault(); $('#login-error').textContent = '';
    try { const result = await post('/api/auth/login', { login: $('#login-id').value, password: $('#login-password').value }); showApp(result.user); }
    catch (error) { $('#login-error').textContent = error.message; }
  });
  $('#register-form').addEventListener('submit', async event => {
    event.preventDefault(); $('#register-error').textContent = '';
    try { const result = await post('/api/auth/register', { username: $('#register-username').value, email: $('#register-email').value, password: $('#register-password').value }); showApp(result.user); }
    catch (error) { $('#register-error').textContent = error.message; }
  });
  $('#logout-btn').addEventListener('click', async () => {
    try { await post('/api/auth/logout', {}); showAuth(); setAuthMode('login'); toast('You have been logged out.'); }
    catch (error) { toast(error.message); }
  });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  $('#user-search').addEventListener('input', event => loadUsers(event.target.value));
  $('#new-chat-btn').addEventListener('click', () => { showView('dashboard'); $('#user-search').focus(); });
  $('#chat-new-btn').addEventListener('click', () => { showView('dashboard'); $('#user-search').focus(); });
  $('#chat-empty-new').addEventListener('click', () => { showView('dashboard'); $('#user-search').focus(); });
  $('#chat-search').addEventListener('input', event => renderChatList(event.target.value));
  $('#message-form').addEventListener('submit', event => {
    event.preventDefault(); const body = $('#message-input').value.trim();
    if (!body || !state.conversationId) return;
    if (!state.socket?.connected) return toast('Reconnecting. Please try sending again.');
    state.socket.emit('send_message', { conversationId: state.conversationId, body }, response => {
      if (!response?.ok) return toast(response?.error || 'Message could not be sent.');
      appendMessage(response.message); $('#message-input').value = ''; $('#message-input').style.height = 'auto';
      const user = state.users.find(item => item.id === state.currentUser.id); if (user) user.last_message = body;
      renderChatList($('#chat-search').value); renderUsers(); loadMoodSnapshot();
    });
  });
  $('#message-input').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('#message-form').requestSubmit(); } });
  $('#message-input').addEventListener('input', event => { event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 110)}px`; });
  $('#profile-form').addEventListener('submit', async event => {
    event.preventDefault(); $('#profile-feedback').textContent = '';
    try {
      const { user } = await put('/api/profile', { username: $('#profile-username').value, bio: $('#profile-bio').value });
      state.user = user; $('#sidebar-name').textContent = user.username; $('#sidebar-avatar').textContent = initials(user.username); $('#top-avatar').textContent = initials(user.username); $('#welcome-name').textContent = user.username; $('#profile-avatar').textContent = initials(user.username);
      $('#profile-feedback').textContent = 'Profile updated successfully.'; toast('Profile saved.');
    } catch (error) { $('#profile-feedback').textContent = error.message; }
  });
  $('#password-form').addEventListener('submit', async event => {
    event.preventDefault(); $('#password-feedback').textContent = '';
    try { const result = await put('/api/profile/password', { currentPassword: $('#current-password').value, newPassword: $('#new-password').value }); $('#password-feedback').textContent = result.message; $('#password-form').reset(); }
    catch (error) { $('#password-feedback').textContent = error.message; }
  });
  $('#mood-toggle').addEventListener('change', async event => {
    const checkbox = event.target; checkbox.disabled = true;
    try { const { settings } = await put('/api/settings', { moodDetectionEnabled: checkbox.checked }); state.settings = settings; $('#settings-feedback').textContent = `Mood detection ${settings.moodDetectionEnabled ? 'enabled' : 'disabled'}.`; toast('Privacy setting saved.'); }
    catch (error) { checkbox.checked = !checkbox.checked; $('#settings-feedback').textContent = error.message; }
    finally { checkbox.disabled = false; }
  });

  (async function init() {
    try { const { user } = await api('/api/auth/me'); showApp(user); }
    catch (_) { showAuth(); }
  })();
})();
