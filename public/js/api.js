const API = {
  base: '/api',
  getToken() { return localStorage.getItem('myc_token'); },
  setToken(t) { localStorage.setItem('myc_token', t); },
  clearToken() { localStorage.removeItem('myc_token'); localStorage.removeItem('myc_user'); },
  setUser(u) { localStorage.setItem('myc_user', JSON.stringify(u)); },
  getUser() { try { return JSON.parse(localStorage.getItem('myc_user')); } catch { return null; } },

  async req(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    const token = this.getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(this.base + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error del servidor');
    return data;
  },

  get(path) { return this.req('GET', path); },
  post(path, body) { return this.req('POST', path, body); },
  put(path, body) { return this.req('PUT', path, body); },
  delete(path) { return this.req('DELETE', path); },

  // Auth
  login(email, password) { return this.post('/auth/login', { email, password }); },
  register(data) { return this.post('/auth/register', data); },
  me() { return this.get('/auth/me'); },

  // Profiles
  getProfiles(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.get('/profiles' + (qs ? '?' + qs : ''));
  },
  getProfile(id) { return this.get('/profiles/' + id); },
  getMyProfile() { return this.get('/profiles/mine'); },
  getPendingProfiles() { return this.get('/profiles/pending'); },
  saveProfile(data) { return this.post('/profiles', data); },
  approveProfile(id) { return this.put('/profiles/' + id + '/approve'); },
  rejectProfile(id) { return this.put('/profiles/' + id + '/reject'); },

  // Opportunities
  getOpps() { return this.get('/opportunities'); },
  getOpp(id) { return this.get('/opportunities/' + id); },
  createOpp(data) { return this.post('/opportunities', data); },
  updateOpp(id, data) { return this.put('/opportunities/' + id, data); },
  deleteOpp(id) { return this.delete('/opportunities/' + id); },
  joinOpp(id) { return this.post('/opportunities/' + id + '/join'); },
  addOppUpdate(id, contenido) { return this.post('/opportunities/' + id + '/updates', { contenido }); },

  // Network
  getDashboard() { return this.get('/dashboard'); },
  getInteractions() { return this.get('/interactions'); },
  saveInteraction(data) { return this.post('/interactions', data); },
  deleteInteraction(id) { return this.delete('/interactions/' + id); },
  getReminders() { return this.get('/reminders'); },
  saveReminder(data) { return this.post('/reminders', data); },
  doneReminder(id) { return this.put('/reminders/' + id + '/done'); },
  deleteReminder(id) { return this.delete('/reminders/' + id); },
  getContacts() { return this.get('/contacts'); },
  addContact(data) { return this.post('/contacts', data); },
  updateContact(id, data) { return this.put('/contacts/' + id, data); },
  deleteContact(id) { return this.delete('/contacts/' + id); },
  getConversations() { return this.get('/messages'); },
  getMessages(partnerId) { return this.get('/messages/' + partnerId); },
  sendMessage(to_id, contenido) { return this.post('/messages', { to_id, contenido }); },
};
