// ============================================================
//  RED EMPRENDEDORES MYC — Main App
// ============================================================

const COLORS = ['#f59e0b','#2dd4bf','#f472b6','#60a5fa','#a78bfa','#34d399','#fb923c','#e879f9','#b8272c','#1a7a7a','#7c3aed','#059669'];
const SECTORS = ['Tecnología','Marketing','Finanzas','Legal','Diseño','Innovación','Consultoría','SAP','Desarrollo Software','Recursos Humanos','Educación','Salud','Agricultura','Comercio'];
const STATUS_LABELS = { idea:'💡 Idea', evaluacion:'🔍 Evaluación', desarrollo:'🚀 En Desarrollo', pausa:'⏸ En Pausa', finalizado:'✅ Finalizado' };
const STATUS_CSS = { idea:'s-idea', evaluacion:'s-evaluacion', desarrollo:'s-desarrollo', pausa:'s-pausa', finalizado:'s-finalizado' };
const TIPO_LABELS = { reunion:'Reunión', llamada:'Llamada', mensaje:'Mensaje', email:'Email', evento:'Evento', networking:'Networking', seguimiento:'Seguimiento', cumpleanos:'Cumpleaños', contacto:'Contacto pendiente', oportunidad:'Oportunidad' };
const TIPO_CSS = { reunion:'t-reunion', llamada:'t-reunion', mensaje:'t-seguimiento', email:'t-seguimiento', evento:'t-evento', networking:'t-evento', seguimiento:'t-seguimiento', cumpleanos:'t-cumpleanos', contacto:'t-contacto', oportunidad:'t-oportunidad' };

let currentPage = 'dashboard';
let currentUser = null;
let msgPartner = null;
let profilesCache = [];
let msgPollInterval = null;

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
function colorFor(name) {
  if (!name) return '#888';
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtDateShort(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-PE', { day:'2-digit', month:'short' });
}
function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' });
}
function parseSectors(s) { try { return JSON.parse(s || '[]'); } catch { return []; } }
function parseServices(s) { return (s || '').split(';').map(x => x.trim()).filter(Boolean); }

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  setTimeout(() => { el.className = 'toast'; }, 3500);
}

// ============================================================
//  AUTH
// ============================================================
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  try {
    const data = await API.login(email, pass);
    API.setToken(data.token);
    API.setUser(data.user);
    initApp(data.user);
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

async function doRegister() {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const ciudad = document.getElementById('reg-ciudad').value.trim();
  const profesion = document.getElementById('reg-profesion').value.trim();
  const errEl = document.getElementById('reg-error');
  errEl.style.display = 'none';
  if (!nombre || !email || !pass) { errEl.textContent = 'Nombre, email y contraseña son obligatorios'; errEl.style.display='block'; return; }
  if (pass.length < 6) { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres'; errEl.style.display='block'; return; }
  try {
    const data = await API.register({ nombre, email, password: pass, ciudad, profesion });
    API.setToken(data.token);
    API.setUser(data.user);
    initApp(data.user);
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

function quickLogin(email, pass) {
  document.getElementById('login-email').value = email;
  document.getElementById('login-pass').value = pass;
  doLogin();
}
function showRegisterForm() { document.getElementById('login-form').style.display='none'; document.getElementById('register-form').style.display='block'; }
function showLoginForm() { document.getElementById('register-form').style.display='none'; document.getElementById('login-form').style.display='block'; }
function doLogout() { API.clearToken(); currentUser=null; clearInterval(msgPollInterval); location.reload(); }

// ============================================================
//  APP INIT
// ============================================================
function initApp(user) {
  currentUser = user;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('user-name-sidebar').textContent = user.nombre || user.email;
  document.getElementById('user-avatar-sidebar').textContent = getInitials(user.nombre || user.email);
  document.getElementById('user-avatar-sidebar').style.background = colorFor(user.nombre);
  document.getElementById('user-role-sidebar').textContent = { admin:'Administrador', manager:'Manager', emprendedor:'Emprendedor' }[user.role] || user.role;
  if (['manager', 'admin'].includes(user.role)) {
    document.getElementById('mgr-section').style.display = '';
    document.getElementById('mgr-btn').style.display = '';
  }
  setupNavigation();
  loadPage('dashboard');
  startMsgPoll();
}

function setupNavigation() {
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + page).classList.add('active');
      const titles = { dashboard:'Dashboard', directorio:'Directorio de Emprendedores', 'mi-perfil':'Mi Perfil', oportunidades:'Ideas & Proyectos', agenda:'Agenda y Recordatorios', mensajes:'Mensajes', contactos:'Mis Contactos', manager:'Panel del Manager' };
      document.getElementById('page-title').textContent = titles[page] || page;
      currentPage = page;
      loadPage(page);
      if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');
    });
  });
}

function loadPage(page) {
  const fns = { dashboard: loadDashboard, directorio: loadDirectorio, 'mi-perfil': loadMiPerfil, oportunidades: loadOportunidades, agenda: loadAgenda, mensajes: loadMensajes, contactos: loadContactos, manager: loadManager };
  if (fns[page]) fns[page]();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function handleGlobalSearch(val) {
  if (val.length > 1) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-page="directorio"]').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-directorio').classList.add('active');
    document.getElementById('page-title').textContent = 'Directorio de Emprendedores';
    currentPage = 'directorio';
    loadDirectorio(val);
  }
}

// ============================================================
//  DASHBOARD
// ============================================================
async function loadDashboard() {
  const el = document.getElementById('page-dashboard');
  el.innerHTML = '<div class="loading">Cargando dashboard...</div>';
  try {
    const d = await API.getDashboard();
    const bdayRows = (d.upcoming_bdays || []).map(b => {
      const dt = new Date('2000-' + b.fecha_nacimiento.slice(5));
      const dd = dt.toLocaleDateString('es-PE', { day:'2-digit' });
      const mm = dt.toLocaleDateString('es-PE', { month:'short' });
      return `<div class="agenda-item">
        <div class="agenda-date"><div class="dd">${dd}</div><div class="mm">${mm}</div></div>
        <div class="agenda-info"><strong>🎂 ${b.nombre}</strong></div>
        <span class="tipo-badge t-cumpleanos">Cumpleaños</span>
      </div>`;
    }).join('') || '<p style="color:var(--muted);font-size:13px">No hay cumpleaños próximos en 30 días.</p>';

    const remRows = (d.upcoming_reminders || []).map(r => `
      <div class="agenda-item">
        <div class="agenda-date"><div class="dd">${new Date(r.fecha+'T00:00:00').getDate()}</div><div class="mm">${new Date(r.fecha+'T00:00:00').toLocaleString('es', {month:'short'})}</div></div>
        <div class="agenda-info"><strong>${r.titulo}</strong><span>${r.descripcion||''}</span></div>
        <span class="tipo-badge ${TIPO_CSS[r.tipo]||'t-seguimiento'}">${TIPO_LABELS[r.tipo]||r.tipo}</span>
      </div>`).join('') || '<p style="color:var(--muted);font-size:13px">No hay recordatorios próximos.</p>';

    const sectorRows = (d.sectors || []).map(s => `<span class="tag tag-sector">${s.sector} <strong>(${s.count})</strong></span>`).join('');

    if (d.upcoming_reminders?.length) document.getElementById('agenda-badge').textContent = d.upcoming_reminders.length, document.getElementById('agenda-badge').style.display = '';
    if (d.unread_msgs) document.getElementById('msg-badge').textContent = d.unread_msgs, document.getElementById('msg-badge').style.display = '';
    if (d.pending > 0 && ['manager','admin'].includes(currentUser.role)) { document.getElementById('mgr-badge').textContent = d.pending; document.getElementById('mgr-badge').style.display = ''; }

    el.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-top"><div class="kpi-icon" style="background:#edf4ff">👥</div><span class="kpi-badge kpi-blue">Registrados</span></div><div class="kpi-n">${d.total}</div><div class="kpi-label">Emprendedores activos</div></div>
        <div class="kpi"><div class="kpi-top"><div class="kpi-icon" style="background:#fef9eb">💡</div><span class="kpi-badge kpi-yellow">Activos</span></div><div class="kpi-n">${d.opps}</div><div class="kpi-label">Ideas & proyectos</div></div>
        <div class="kpi"><div class="kpi-top"><div class="kpi-icon" style="background:#f0fdf4">🤝</div><span class="kpi-badge kpi-green">Total</span></div><div class="kpi-n">${d.interactions}</div><div class="kpi-label">Interacciones registradas</div></div>
        <div class="kpi"><div class="kpi-top"><div class="kpi-icon" style="background:#fef2f2">💬</div><span class="kpi-badge kpi-red">Sin leer</span></div><div class="kpi-n">${d.unread_msgs}</div><div class="kpi-label">Mensajes pendientes</div></div>
      </div>
      <div class="dash-2col">
        <div>
          <div class="card" style="margin-bottom:14px">
            <div class="card-title">🎂 Cumpleaños próximos (30 días) <a onclick="loadPage('agenda')">Ver agenda →</a></div>
            ${bdayRows}
          </div>
          <div class="card">
            <div class="card-title">📅 Recordatorios próximos <a onclick="loadPage('agenda')">Ver todos →</a></div>
            ${remRows}
          </div>
        </div>
        <div class="card">
          <div class="card-title">Sectores activos en la red</div>
          <div style="margin-bottom:18px">${sectorRows || '<p style="color:var(--muted);font-size:13px">Sin datos aún.</p>'}</div>
          ${['manager','admin'].includes(currentUser?.role) && d.pending > 0 ? `
          <div class="status-banner banner-warn">
            ⚠️ Hay <strong>${d.pending} perfil${d.pending>1?'es':''} pendiente${d.pending>1?'s':''}</strong> de aprobación.
            <a style="margin-left:8px" onclick="document.querySelector('[data-page=manager]').click()">Revisar →</a>
          </div>` : ''}
          <div class="card-title" style="margin-top:14px">Accesos rápidos</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            <button class="btn-navy btn-sm" onclick="document.querySelector('[data-page=directorio]').click()">👥 Directorio</button>
            <button class="btn-teal btn-sm" onclick="document.querySelector('[data-page=oportunidades]').click()">💡 Ideas</button>
            <button class="btn-sm" style="background:var(--gold);color:#fff" onclick="document.querySelector('[data-page=agenda]').click()">📅 Agenda</button>
            <button class="btn-sm" style="background:#6b7280;color:#fff" onclick="document.querySelector('[data-page=mensajes]').click()">💬 Mensajes</button>
          </div>
        </div>
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

// ============================================================
//  DIRECTORIO
// ============================================================
async function loadDirectorio(searchVal = '') {
  const el = document.getElementById('page-directorio');
  const filtersHtml = `
    <div class="filters" id="dir-filters">
      <input type="text" id="dir-q" placeholder="🔍 Nombre, servicio, habilidad..." value="${searchVal}" oninput="filterDirectorio()" style="min-width:230px">
      <select id="dir-sector" onchange="filterDirectorio()"><option value="">Todos los sectores</option>${SECTORS.map(s=>`<option>${s}</option>`).join('')}</select>
      <select id="dir-nivel" onchange="filterDirectorio()"><option value="">Nivel de experiencia</option><option>Junior (1-3 años)</option><option>Mid (3-7 años)</option><option>Senior (7+ años)</option><option>Experto</option></select>
      <select id="dir-disp" onchange="filterDirectorio()"><option value="">Disponibilidad</option><option>Tiempo completo</option><option>Tiempo parcial</option><option>Por proyectos</option></select>
    </div>
    <div id="members-grid" class="members-grid"><div class="loading">Cargando directorio...</div></div>`;
  el.innerHTML = filtersHtml;
  try {
    const profiles = await API.getProfiles(searchVal ? { q: searchVal } : {});
    profilesCache = profiles;
    renderMembers(profiles);
  } catch (e) {
    document.getElementById('members-grid').innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

async function filterDirectorio() {
  const q = document.getElementById('dir-q')?.value || '';
  const sector = document.getElementById('dir-sector')?.value || '';
  const nivel = document.getElementById('dir-nivel')?.value || '';
  const disp = document.getElementById('dir-disp')?.value || '';
  try {
    const params = {};
    if (q) params.q = q;
    if (sector) params.sector = sector;
    if (nivel) params.nivel = nivel;
    if (disp) params.disponibilidad = disp;
    const profiles = await API.getProfiles(params);
    profilesCache = profiles;
    renderMembers(profiles);
  } catch {}
}

function renderMembers(list) {
  const grid = document.getElementById('members-grid');
  if (!grid) return;
  if (!list.length) { grid.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div><p>No se encontraron emprendedores con esos filtros.</p></div>'; return; }
  grid.innerHTML = list.map(p => {
    const sects = parseSectors(p.sectores).slice(0, 3).map(s => `<span class="tag tag-sector">${s}</span>`).join('');
    return `<div class="member-card" onclick="openProfileModal(${p.id})">
      <div class="mc-header">
        <div class="mc-avatar" style="background:${colorFor(p.nombre)}">${getInitials(p.nombre)}</div>
        <div><div class="mc-name">${p.nombre}</div><div class="mc-role">${p.profesion||'—'}${p.especialidad?' · '+p.especialidad:''}</div></div>
      </div>
      <div>${sects}</div>
      <div class="mc-meta">
        ${p.ciudad ? `<span>📍 ${p.ciudad}</span>` : ''}
        ${p.disponibilidad ? `<span>⏱ ${p.disponibilidad}</span>` : ''}
        ${p.anios_experiencia ? `<span>💼 ${p.anios_experiencia} años</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function openProfileModal(profileId) {
  const overlay = document.getElementById('profile-modal');
  const content = document.getElementById('profile-modal-content');
  content.innerHTML = '<div class="loading" style="padding:40px">Cargando perfil...</div>';
  overlay.classList.add('open');
  overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('open'); };
  try {
    const p = await API.getProfile(profileId);
    const sects = parseSectors(p.sectores);
    const svcs = parseServices(p.servicios);
    const isMe = currentUser.id === p.user_id;
    content.innerHTML = `
      <div class="modal-hero">
        <div class="mc-avatar" style="background:${colorFor(p.nombre)};width:62px;height:62px;font-size:22px;font-weight:700;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid rgba(255,255,255,0.2);flex-shrink:0">${getInitials(p.nombre)}</div>
        <div>
          <h2 style="font-size:20px;font-weight:700">${p.nombre}</h2>
          <p style="color:rgba(255,255,255,0.6);font-size:13px">${p.profesion||''}${p.especialidad?' · '+p.especialidad:''}</p>
          <div style="margin-top:8px">${sects.map(s=>`<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;margin:2px;background:rgba(255,255,255,0.12);color:#fff">${s}</span>`).join('')}</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('profile-modal').classList.remove('open')">✕</button>
      </div>
      <div class="modal-body">
        <div class="info-grid3">
          <div class="info-block"><label>Ciudad</label><p>${p.ciudad||'—'}</p></div>
          <div class="info-block"><label>Experiencia</label><p>${p.anios_experiencia||0} años · ${p.nivel_experiencia||'—'}</p></div>
          <div class="info-block"><label>Disponibilidad</label><p>${p.disponibilidad||'—'}</p></div>
          <div class="info-block"><label>Emprendimiento</label><p>${p.nombre_emprendimiento||'—'}</p></div>
          <div class="info-block"><label>Tipo empresa</label><p>${p.tipo_empresa||'—'}</p></div>
          <div class="info-block"><label>Estado</label><p>${p.estado_emprendimiento||'—'}</p></div>
        </div>
        ${svcs.length ? `<div class="modal-section">Servicios y potencial productivo</div><div>${svcs.map(s=>`<div class="service-pill">✦ ${s}</div>`).join('')}</div>` : ''}
        ${p.habilidades_tecnicas ? `<div class="modal-section">Habilidades técnicas</div><p style="font-size:13px">${p.habilidades_tecnicas}</p>` : ''}
        ${p.certificaciones ? `<div class="modal-section">Certificaciones</div><p style="font-size:13px">${p.certificaciones}</p>` : ''}
        ${p.bio ? `<div class="modal-section">Sobre este emprendedor</div><p style="font-size:13px;color:var(--muted);line-height:1.7">${p.bio}</p>` : ''}
        ${p.interes_colaborar ? `<div style="margin-top:12px"><span class="tag tag-green">🤝 ${p.interes_colaborar}</span></div>` : ''}
        ${!isMe ? `
        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
          <button class="btn-navy" onclick="openMsgWithUser(${p.user_id},'${p.nombre}')">💬 Enviar mensaje</button>
          <button class="btn-teal" onclick="addContactFromProfile(${p.user_id})">🤝 Agregar contacto</button>
          <button class="btn-sm" style="background:var(--gold);color:#fff" onclick="document.getElementById('profile-modal').classList.remove('open');document.querySelector('[data-page=agenda]').click()">📅 Agendar reunión</button>
        </div>` : `<div style="margin-top:14px"><a onclick="document.getElementById('profile-modal').classList.remove('open');document.querySelector('[data-page=mi-perfil]').click()">✏️ Editar mi perfil →</a></div>`}
      </div>`;
  } catch (e) {
    content.innerHTML = `<div style="padding:30px;text-align:center;color:var(--muted)">${e.message}</div>`;
  }
}

async function addContactFromProfile(userId) {
  try {
    await API.addContact({ contacto_id: userId, etiqueta: 'Contacto', notas: '' });
    toast('Contacto agregado correctamente', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

// ============================================================
//  MI PERFIL
// ============================================================
async function loadMiPerfil() {
  const el = document.getElementById('page-mi-perfil');
  el.innerHTML = '<div class="loading">Cargando tu perfil...</div>';
  let profile = {};
  try { profile = await API.getMyProfile(); } catch {}

  const statusBanner = profile.status === 'pendiente'
    ? `<div class="status-banner banner-warn">⏳ Tu perfil está pendiente de aprobación por un manager. Aún no es visible en el directorio.</div>`
    : profile.status === 'aprobado'
    ? `<div class="status-banner banner-success">✅ Tu perfil está aprobado y visible en el directorio.</div>`
    : profile.status === 'rechazado'
    ? `<div class="status-banner banner-warn" style="background:#fef2f2;border-color:#fecaca;color:#991b1b">❌ Tu perfil fue rechazado. Actualiza la información y reenvíalo.</div>`
    : `<div class="status-banner banner-info">ℹ️ Completa tu perfil y envíalo para que aparezca en el directorio.</div>`;

  const sects = parseSectors(profile.sectores);
  const chipHtml = SECTORS.map(s => `<div class="chip${sects.includes(s)?' sel':''}" onclick="this.classList.toggle('sel')" data-sector="${s}">${s}</div>`).join('');

  el.innerHTML = `
    ${statusBanner}
    <div style="max-width:800px">
      <div class="form-block">
        <div class="form-block-title"><div class="form-block-icon" style="background:#edf4ff">👤</div>Datos Personales</div>
        <div class="form-row2">
          <div class="form-group"><label>Nombre completo *</label><input id="p-nombre" type="text" value="${profile.nombre||''}" placeholder="Tu nombre completo"></div>
          <div class="form-group"><label>Fecha de nacimiento</label><input id="p-bday" type="date" value="${profile.fecha_nacimiento||''}"></div>
        </div>
        <div class="form-row3">
          <div class="form-group"><label>Ciudad / País</label><input id="p-ciudad" type="text" value="${profile.ciudad||''}" placeholder="Lima, Perú"></div>
          <div class="form-group"><label>Teléfono</label><input id="p-tel" type="tel" value="${profile.telefono||''}" placeholder="+51 999 000 000"></div>
          <div class="form-group"><label>Email</label><input id="p-email" type="email" value="${profile.email||currentUser.email||''}" disabled style="opacity:.6"></div>
        </div>
        <div class="form-row2">
          <div class="form-group"><label>LinkedIn</label><input id="p-linkedin" type="url" value="${profile.linkedin||''}" placeholder="linkedin.com/in/tuperfil"></div>
          <div class="form-group"><label>Otras redes</label><input id="p-redes" type="text" value="${profile.redes||''}" placeholder="@usuario"></div>
        </div>
      </div>
      <div class="form-block">
        <div class="form-block-title"><div class="form-block-icon" style="background:#fef9eb">💼</div>Información Profesional</div>
        <div class="form-row2">
          <div class="form-group"><label>Profesión *</label><input id="p-prof" type="text" value="${profile.profesion||''}" placeholder="Ej: Ingeniero, Médico..."></div>
          <div class="form-group"><label>Especialidad</label><input id="p-esp" type="text" value="${profile.especialidad||''}" placeholder="Ej: SAP FI, Marketing Digital..."></div>
        </div>
        <div class="form-row3">
          <div class="form-group"><label>Años de experiencia</label><input id="p-exp" type="number" min="0" value="${profile.anios_experiencia||0}"></div>
          <div class="form-group"><label>Nivel</label>
            <select id="p-nivel"><option>Seleccionar</option><option>Junior (1-3 años)</option><option>Mid (3-7 años)</option><option>Senior (7+ años)</option><option>Experto</option></select></div>
          <div class="form-group"><label>Disponibilidad</label>
            <select id="p-disp"><option>Seleccionar</option><option>Tiempo completo</option><option>Tiempo parcial</option><option>Por proyectos</option></select></div>
        </div>
        <div class="form-group"><label>Sectores en los que trabajas</label><div class="chip-group" id="sector-chips">${chipHtml}</div></div>
      </div>
      <div class="form-block">
        <div class="form-block-title"><div class="form-block-icon" style="background:#f0fdf4">⚡</div>Potencial Productivo</div>
        <div class="form-group"><label>Servicios que ofreces (separados por ;)</label><textarea id="p-svcs" placeholder="Ej: Consultoría SAP; Implementación ERP; Capacitaciones">${profile.servicios||''}</textarea></div>
        <div class="form-row2">
          <div class="form-group"><label>Habilidades técnicas</label><input id="p-htec" type="text" value="${profile.habilidades_tecnicas||''}" placeholder="Ej: Python, Excel, SAP..."></div>
          <div class="form-group"><label>Habilidades blandas</label><input id="p-hbland" type="text" value="${profile.habilidades_blandas||''}" placeholder="Ej: Liderazgo, Negociación..."></div>
        </div>
        <div class="form-row2">
          <div class="form-group"><label>Certificaciones</label><input id="p-cert" type="text" value="${profile.certificaciones||''}" placeholder="Ej: PMP, AWS, CPA..."></div>
          <div class="form-group"><label>Interés en colaborar</label>
            <select id="p-colab"><option>Sí, activamente</option><option>Sí, en proyectos puntuales</option><option>Por ahora no</option></select></div>
        </div>
      </div>
      <div class="form-block">
        <div class="form-block-title"><div class="form-block-icon" style="background:#fef2f2">🏢</div>Información Empresarial</div>
        <div class="form-row2">
          <div class="form-group"><label>Nombre del emprendimiento</label><input id="p-emp" type="text" value="${profile.nombre_emprendimiento||''}" placeholder="Nombre de tu empresa"></div>
          <div class="form-group"><label>Tipo de empresa</label>
            <select id="p-tipo"><option>Seleccionar</option><option>Persona natural</option><option>MYPE</option><option>Startup</option><option>Empresa consolidada</option><option>ONG</option></select></div>
        </div>
        <div class="form-row2">
          <div class="form-group"><label>Tamaño</label>
            <select id="p-tam"><option>Seleccionar</option><option>Solo (1 persona)</option><option>Micro (2-5)</option><option>Pequeña (6-20)</option><option>Mediana (21-100)</option></select></div>
          <div class="form-group"><label>Estado del emprendimiento</label>
            <select id="p-est"><option>Seleccionar</option><option>Idea</option><option>En marcha</option><option>Consolidado</option></select></div>
        </div>
        <div class="form-group"><label>Presentación personal / Sobre ti</label><textarea id="p-bio" rows="4" placeholder="Cuéntale a la red MYC quién eres, qué te apasiona...">${profile.bio||''}</textarea></div>
      </div>
      <div class="form-actions">
        <button class="btn-primary" onclick="saveProfile()">💾 Guardar y enviar para revisión</button>
        <button class="btn-sec" onclick="loadMiPerfil()">↩ Cancelar</button>
      </div>
      <div id="profile-msg" style="margin-top:12px"></div>
    </div>`;

  // Set select values
  const setSelect = (id, val) => { const s = document.getElementById(id); if(s && val) { for(let o of s.options) if(o.value === val || o.text === val) { s.value = o.value; break; } } };
  setSelect('p-nivel', profile.nivel_experiencia);
  setSelect('p-disp', profile.disponibilidad);
  setSelect('p-colab', profile.interes_colaborar);
  setSelect('p-tipo', profile.tipo_empresa);
  setSelect('p-tam', profile.tamano_negocio);
  setSelect('p-est', profile.estado_emprendimiento);
}

async function saveProfile() {
  const nombre = document.getElementById('p-nombre').value.trim();
  if (!nombre) { toast('El nombre es obligatorio', 'error'); return; }
  const sectores = Array.from(document.querySelectorAll('#sector-chips .chip.sel')).map(c => c.dataset.sector);
  const data = {
    nombre, fecha_nacimiento: document.getElementById('p-bday').value,
    ciudad: document.getElementById('p-ciudad').value, telefono: document.getElementById('p-tel').value,
    linkedin: document.getElementById('p-linkedin').value, redes: document.getElementById('p-redes').value,
    profesion: document.getElementById('p-prof').value, especialidad: document.getElementById('p-esp').value,
    anios_experiencia: document.getElementById('p-exp').value,
    nivel_experiencia: document.getElementById('p-nivel').value,
    disponibilidad: document.getElementById('p-disp').value,
    sectores, servicios: document.getElementById('p-svcs').value,
    habilidades_tecnicas: document.getElementById('p-htec').value,
    habilidades_blandas: document.getElementById('p-hbland').value,
    certificaciones: document.getElementById('p-cert').value,
    interes_colaborar: document.getElementById('p-colab').value,
    nombre_emprendimiento: document.getElementById('p-emp').value,
    tipo_empresa: document.getElementById('p-tipo').value,
    tamano_negocio: document.getElementById('p-tam').value,
    estado_emprendimiento: document.getElementById('p-est').value,
    bio: document.getElementById('p-bio').value,
  };
  try {
    await API.saveProfile(data);
    toast('✅ Perfil guardado. Pendiente de aprobación.', 'success');
    loadMiPerfil();
  } catch (e) { toast(e.message, 'error'); }
}

// ============================================================
//  OPORTUNIDADES
// ============================================================
async function loadOportunidades() {
  const el = document.getElementById('page-oportunidades');
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">
      <div class="filters" style="margin-bottom:0">
        <select id="opp-filter" onchange="filterOpps()"><option value="">Todos los estados</option><option value="idea">💡 Idea</option><option value="evaluacion">🔍 Evaluación</option><option value="desarrollo">🚀 En Desarrollo</option><option value="pausa">⏸ En Pausa</option><option value="finalizado">✅ Finalizado</option></select>
      </div>
      <button class="btn-primary" onclick="showNewOppModal()">+ Nueva idea / proyecto</button>
    </div>
    <div id="opps-grid" class="opps-grid"><div class="loading">Cargando...</div></div>`;
  await renderOpps();
}

async function renderOpps(filter = '') {
  const grid = document.getElementById('opps-grid');
  if (!grid) return;
  try {
    let list = await API.getOpps();
    if (filter) list = list.filter(o => o.estado === filter);
    if (!list.length) { grid.innerHTML = '<div class="empty"><div class="empty-icon">💡</div><p>No hay ideas registradas aún. ¡Sé el primero!</p></div>'; return; }
    grid.innerHTML = list.map(o => {
      const mCount = o.total_miembros || 0;
      const cls = STATUS_CSS[o.estado] || 's-idea';
      const lbl = STATUS_LABELS[o.estado] || o.estado;
      return `<div class="opp-card" onclick="openOppModal(${o.id})">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <span class="tag tag-sector" style="margin:0">${o.categoria||'General'}</span>
          <span class="status-badge ${cls}">${lbl}</span>
        </div>
        <h3>${o.nombre}</h3>
        <p>${(o.descripcion||'').slice(0, 120)}${(o.descripcion||'').length > 120 ? '...' : ''}</p>
        <div class="opp-footer">
          <span style="font-size:12px;color:var(--muted)">👥 ${mCount} miembro${mCount !== 1 ? 's' : ''}</span>
          <span style="font-size:11px;color:var(--muted)">${fmtDateShort(o.created_at?.slice(0,10))}</span>
        </div>
      </div>`;
    }).join('');
  } catch (e) { grid.innerHTML = `<div class="empty"><p>${e.message}</p></div>`; }
}

function filterOpps() { const f = document.getElementById('opp-filter')?.value||''; renderOpps(f); }

async function openOppModal(id) {
  const overlay = document.getElementById('opp-modal');
  const content = document.getElementById('opp-modal-content');
  content.innerHTML = '<div class="loading" style="padding:40px">Cargando...</div>';
  overlay.classList.add('open');
  overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('open'); };
  try {
    const o = await API.getOpp(id);
    const cls = STATUS_CSS[o.estado] || 's-idea';
    const lbl = STATUS_LABELS[o.estado] || o.estado;
    const isCreator = o.creator_uid === currentUser.id || ['manager','admin'].includes(currentUser.role);
    const isMember = (o.miembros || []).some(m => m.id === currentUser.id);
    const updates = (o.updates || []).map(u => `<div style="background:var(--bg);border-radius:9px;padding:10px 13px;margin-bottom:8px"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">${u.autor} · ${fmtDate(u.created_at?.slice(0,10))}</div><p style="font-size:13px">${u.contenido}</p></div>`).join('') || '<p style="font-size:13px;color:var(--muted)">Sin actualizaciones aún.</p>';
    const members = (o.miembros || []).map(m => `<span style="display:inline-flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--border);border-radius:20px;padding:4px 12px;font-size:12px;margin:3px"><span style="width:22px;height:22px;border-radius:50%;background:${colorFor(m.nombre)};display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff">${getInitials(m.nombre)}</span>${m.nombre}</span>`).join('');

    content.innerHTML = `
      <div class="modal-hero">
        <div style="font-size:30px">💡</div>
        <div>
          <h2 style="font-size:20px;font-weight:700">${o.nombre}</h2>
          <div style="margin-top:6px"><span class="status-badge ${cls}" style="border:1px solid rgba(255,255,255,0.3)">${lbl}</span> <span style="color:rgba(255,255,255,0.6);font-size:12px;margin-left:8px">${o.categoria||''}</span></div>
        </div>
        <button class="modal-close" onclick="document.getElementById('opp-modal').classList.remove('open')">✕</button>
      </div>
      <div class="modal-body">
        <p style="font-size:14px;line-height:1.7;margin-bottom:16px">${o.descripcion||''}</p>
        <div class="modal-section">Miembros (${(o.miembros||[]).length})</div>
        <div style="margin-bottom:14px">${members||'<p style="font-size:13px;color:var(--muted)">Sin miembros aún.</p>'}</div>
        ${isCreator ? `
        <div class="modal-section">Editar estado</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
          ${['idea','evaluacion','desarrollo','pausa','finalizado'].map(s=>`<button class="btn-sm" style="background:${o.estado===s?'var(--navy)':'var(--bg)'};color:${o.estado===s?'#fff':'var(--text)'};border:1px solid var(--border)" onclick="changeOppStatus(${o.id},'${s}',this)">${STATUS_LABELS[s]}</button>`).join('')}
        </div>` : ''}
        <div class="modal-section">Actualizaciones</div>
        <div style="margin-bottom:14px">${updates}</div>
        <div style="display:flex;gap:8px">
          <input id="opp-update-input" type="text" placeholder="Escribe un avance o nota..." style="flex:1;padding:9px 13px;border-radius:8px;border:1px solid var(--border);font-family:'Sora',sans-serif;font-size:13px;outline:none">
          <button class="btn-navy" onclick="postOppUpdate(${o.id})">Publicar</button>
        </div>
        ${!isMember ? `<div style="margin-top:12px"><button class="btn-teal" onclick="joinOpp(${o.id})">🙋 Unirme a este proyecto</button></div>` : ''}
      </div>`;
  } catch (e) { content.innerHTML = `<div style="padding:30px;text-align:center;color:var(--muted)">${e.message}</div>`; }
}

async function changeOppStatus(id, estado, btn) {
  try {
    const o = await API.getOpp(id);
    await API.updateOpp(id, { ...o, estado });
    toast('Estado actualizado', 'success');
    openOppModal(id);
    renderOpps();
  } catch (e) { toast(e.message, 'error'); }
}

async function postOppUpdate(id) {
  const input = document.getElementById('opp-update-input');
  const contenido = input?.value?.trim();
  if (!contenido) return;
  try {
    await API.addOppUpdate(id, contenido);
    toast('Actualización publicada', 'success');
    openOppModal(id);
  } catch (e) { toast(e.message, 'error'); }
}

async function joinOpp(id) {
  try {
    await API.joinOpp(id);
    toast('¡Te uniste al proyecto!', 'success');
    openOppModal(id);
    renderOpps();
  } catch (e) { toast(e.message, 'error'); }
}

function showNewOppModal() {
  const overlay = document.getElementById('opp-modal');
  const content = document.getElementById('opp-modal-content');
  overlay.classList.add('open');
  overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('open'); };
  content.innerHTML = `
    <div class="modal-hero"><div style="font-size:28px">💡</div><div><h2 style="font-size:19px;font-weight:700">Nueva idea / proyecto</h2><p style="color:rgba(255,255,255,0.6);font-size:13px">Compártela con la red MYC</p></div><button class="modal-close" onclick="document.getElementById('opp-modal').classList.remove('open')">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Nombre *</label><input id="new-opp-nombre" type="text" placeholder="Ej: App de microfinanzas comunitaria"></div>
      <div class="form-group"><label>Descripción</label><textarea id="new-opp-desc" placeholder="¿En qué consiste? ¿Qué problema resuelve?"></textarea></div>
      <div class="form-row2">
        <div class="form-group"><label>Categoría</label><select id="new-opp-cat"><option>Tecnología</option><option>Marketing</option><option>Finanzas</option><option>Educación</option><option>Salud</option><option>Comercio</option><option>Agricultura</option><option>Social</option></select></div>
        <div class="form-group"><label>Estado inicial</label><select id="new-opp-estado"><option value="idea">💡 Idea</option><option value="evaluacion">🔍 Evaluación</option></select></div>
      </div>
      <div class="form-actions">
        <button class="btn-primary" onclick="createOpp()">Publicar idea</button>
        <button class="btn-sec" onclick="document.getElementById('opp-modal').classList.remove('open')">Cancelar</button>
      </div>
    </div>`;
}

async function createOpp() {
  const nombre = document.getElementById('new-opp-nombre')?.value?.trim();
  if (!nombre) { toast('El nombre es obligatorio', 'error'); return; }
  try {
    await API.createOpp({ nombre, descripcion: document.getElementById('new-opp-desc')?.value, categoria: document.getElementById('new-opp-cat')?.value, estado: document.getElementById('new-opp-estado')?.value });
    document.getElementById('opp-modal').classList.remove('open');
    toast('¡Idea publicada!', 'success');
    renderOpps();
  } catch (e) { toast(e.message, 'error'); }
}

// ============================================================
//  AGENDA
// ============================================================
async function loadAgenda() {
  const el = document.getElementById('page-agenda');
  el.innerHTML = '<div class="loading">Cargando agenda...</div>';
  try {
    const [reminders, interactions] = await Promise.all([API.getReminders(), API.getInteractions()]);
    const remHtml = reminders.length ? reminders.map(r => `
      <div class="agenda-item ${r.completado ? 'done-item' : ''}" id="rem-${r.id}">
        <div class="agenda-date"><div class="dd">${new Date(r.fecha+'T00:00:00').getDate()}</div><div class="mm">${new Date(r.fecha+'T00:00:00').toLocaleString('es',{month:'short'})}</div></div>
        <div class="agenda-info"><strong>${r.titulo}</strong><span>${r.descripcion||''}</span></div>
        <span class="tipo-badge ${TIPO_CSS[r.tipo]||'t-seguimiento'}">${TIPO_LABELS[r.tipo]||r.tipo}</span>
        ${!r.completado ? `<button class="btn-sm" style="background:var(--bg);border:1px solid var(--border);margin-left:6px" onclick="doneReminder(${r.id})">✓</button>` : ''}
        <button class="btn-sm btn-reject" style="margin-left:4px" onclick="deleteReminder(${r.id})">🗑</button>
      </div>`).join('') : '<div class="empty"><div class="empty-icon">📅</div><p>No tienes recordatorios. ¡Agrega uno!</p></div>';

    const intHtml = interactions.length ? interactions.map(i => `
      <div class="agenda-item">
        <div class="agenda-date"><div class="dd">${new Date(i.fecha+'T00:00:00').getDate()}</div><div class="mm">${new Date(i.fecha+'T00:00:00').toLocaleString('es',{month:'short'})}</div></div>
        <div class="agenda-info"><strong>${i.tipo.charAt(0).toUpperCase()+i.tipo.slice(1)}${i.contacto_nombre?' con '+i.contacto_nombre:''}</strong><span>${i.resumen||''}</span>${i.proxima_accion?`<div style="font-size:11px;color:var(--teal);margin-top:2px">→ ${i.proxima_accion}</div>`:''}</div>
        <button class="btn-sm btn-reject" onclick="deleteInteraction(${i.id})">🗑</button>
      </div>`).join('') : '<div class="empty"><p>Sin interacciones registradas.</p></div>';

    const profilesForSelect = await API.getProfiles().catch(() => []);
    const profileOptions = profilesForSelect.map(p => `<option value="${p.user_id}">${p.nombre}</option>`).join('');

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
        <div>
          <div class="card" style="margin-bottom:16px">
            <div class="card-title">📅 Mis recordatorios</div>
            ${remHtml}
          </div>
          <div class="card">
            <div class="card-title">📝 Historial de interacciones</div>
            ${intHtml}
          </div>
        </div>
        <div>
          <div class="card" style="margin-bottom:16px">
            <div class="card-title">+ Nuevo recordatorio</div>
            <div class="form-group"><label>Tipo</label>
              <select id="rem-tipo"><option value="reunion">Reunión</option><option value="seguimiento">Seguimiento</option><option value="contacto">Contacto pendiente</option><option value="oportunidad">Oportunidad de negocio</option><option value="cumpleanos">Cumpleaños</option><option value="evento">Evento</option></select></div>
            <div class="form-group"><label>Título *</label><input id="rem-titulo" type="text" placeholder="Ej: Llamar a Juan, Reunión de red..."></div>
            <div class="form-group"><label>Descripción</label><input id="rem-desc" type="text" placeholder="Detalles adicionales..."></div>
            <div class="form-group"><label>Fecha *</label><input id="rem-fecha" type="date"></div>
            <button class="btn-primary" onclick="saveReminder()">+ Agregar recordatorio</button>
          </div>
          <div class="card">
            <div class="card-title">+ Registrar interacción</div>
            <div class="form-group"><label>Tipo *</label>
              <select id="int-tipo"><option value="reunion">Reunión</option><option value="llamada">Llamada</option><option value="mensaje">Mensaje</option><option value="email">Email</option><option value="evento">Evento</option><option value="networking">Networking</option></select></div>
            <div class="form-group"><label>Contacto</label>
              <select id="int-contacto"><option value="">Sin especificar</option>${profileOptions}</select></div>
            <div class="form-group"><label>Fecha *</label><input id="int-fecha" type="date"></div>
            <div class="form-group"><label>Resumen</label><textarea id="int-resumen" placeholder="¿De qué se trató?" style="min-height:60px"></textarea></div>
            <div class="form-group"><label>Acuerdos</label><input id="int-acuerdos" type="text" placeholder="¿A qué se llegó?"></div>
            <div class="form-group"><label>Próxima acción</label><input id="int-proxima" type="text" placeholder="Ej: Enviar propuesta en 2 semanas"></div>
            <button class="btn-primary" onclick="saveInteraction()">Registrar interacción</button>
          </div>
        </div>
      </div>`;

    document.getElementById('rem-fecha').value = new Date().toISOString().slice(0,10);
    document.getElementById('int-fecha').value = new Date().toISOString().slice(0,10);
  } catch (e) {
    el.innerHTML = `<div class="empty"><p>${e.message}</p></div>`;
  }
}

async function saveReminder() {
  const tipo = document.getElementById('rem-tipo').value;
  const titulo = document.getElementById('rem-titulo').value.trim();
  const fecha = document.getElementById('rem-fecha').value;
  if (!titulo || !fecha) { toast('Título y fecha son obligatorios', 'error'); return; }
  try {
    await API.saveReminder({ tipo, titulo, descripcion: document.getElementById('rem-desc').value, fecha });
    toast('Recordatorio agregado', 'success');
    loadAgenda();
  } catch (e) { toast(e.message, 'error'); }
}

async function doneReminder(id) {
  try { await API.doneReminder(id); loadAgenda(); toast('¡Marcado como completado!', 'success'); } catch (e) { toast(e.message, 'error'); }
}

async function deleteReminder(id) {
  if (!confirm('¿Eliminar este recordatorio?')) return;
  try { await API.deleteReminder(id); loadAgenda(); } catch (e) { toast(e.message, 'error'); }
}

async function saveInteraction() {
  const tipo = document.getElementById('int-tipo').value;
  const fecha = document.getElementById('int-fecha').value;
  if (!fecha) { toast('La fecha es obligatoria', 'error'); return; }
  try {
    await API.saveInteraction({ tipo, contacto_id: document.getElementById('int-contacto').value||null, fecha, resumen: document.getElementById('int-resumen').value, acuerdos: document.getElementById('int-acuerdos').value, proxima_accion: document.getElementById('int-proxima').value });
    toast('Interacción registrada', 'success');
    loadAgenda();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteInteraction(id) {
  if (!confirm('¿Eliminar esta interacción?')) return;
  try { await API.deleteInteraction(id); loadAgenda(); } catch (e) { toast(e.message, 'error'); }
}

// ============================================================
//  MENSAJES
// ============================================================
async function loadMensajes() {
  const el = document.getElementById('page-mensajes');
  try {
    const convs = await API.getConversations();
    const profiles = await API.getProfiles();
    const convHtml = convs.map(c => `
      <div class="msg-partner ${msgPartner===c.partner_id?'active':''}" onclick="openChat(${c.partner_id},'${c.nombre}')">
        <div class="mc-avatar" style="background:${colorFor(c.nombre)};width:36px;height:36px;font-size:13px">${getInitials(c.nombre)}</div>
        <div class="msg-partner-info"><strong>${c.nombre}</strong><span>Toca para abrir</span></div>
        ${c.unread > 0 ? `<span class="msg-unread">${c.unread}</span>` : ''}
      </div>`).join('') || '<div style="padding:20px;font-size:13px;color:var(--muted)">No tienes conversaciones.</div>';

    const newChatOptions = profiles.filter(p => p.user_id !== currentUser.id).map(p => `<option value="${p.user_id}">${p.nombre}</option>`).join('');

    el.innerHTML = `
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px;align-items:center">
        <span style="font-size:13px;color:var(--muted)">Nuevo mensaje a:</span>
        <select id="new-msg-target" style="padding:8px 13px;border-radius:8px;border:1px solid var(--border);font-family:'Sora',sans-serif;font-size:13px"><option value="">Seleccionar...</option>${newChatOptions}</select>
        <button class="btn-navy" onclick="startNewChat()">💬 Iniciar chat</button>
      </div>
      <div class="msg-layout">
        <div class="msg-list">${convHtml}</div>
        <div class="msg-chat" id="msg-chat-area"><div class="msg-no-chat">Selecciona una conversación para comenzar</div></div>
      </div>`;
    if (msgPartner) openChat(msgPartner, '');
  } catch (e) {
    el.innerHTML = `<div class="empty"><p>${e.message}</p></div>`;
  }
}

async function openChat(partnerId, partnerName) {
  msgPartner = partnerId;
  const chatArea = document.getElementById('msg-chat-area');
  if (!chatArea) return;
  chatArea.innerHTML = '<div class="loading">Cargando mensajes...</div>';
  document.querySelectorAll('.msg-partner').forEach(p => p.classList.remove('active'));
  try {
    const msgs = await API.getMessages(partnerId);
    const name = partnerName || (msgs[0] ? (msgs[0].from_id !== currentUser.id ? msgs[0].from_nombre : '') : '');
    chatArea.innerHTML = `
      <div class="msg-chat-header">${name || 'Conversación'}</div>
      <div class="msg-chat-body" id="msg-body">
        ${msgs.map(m => `
          <div>
            <div class="msg-bubble ${m.from_id === currentUser.id ? 'mine' : 'theirs'}">${m.contenido}</div>
            <div class="msg-time" style="text-align:${m.from_id === currentUser.id ? 'right' : 'left'}">${fmtTime(m.created_at)}</div>
          </div>`).join('') || '<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px">Sé el primero en escribir 👋</div>'}
      </div>
      <div class="msg-input-row">
        <input id="msg-input" type="text" placeholder="Escribe un mensaje..." onkeydown="if(event.key==='Enter')sendMsg(${partnerId})">
        <button class="btn-navy" onclick="sendMsg(${partnerId})">Enviar</button>
      </div>`;
    const body = document.getElementById('msg-body');
    if (body) body.scrollTop = body.scrollHeight;
  } catch (e) { chatArea.innerHTML = `<div class="msg-no-chat">${e.message}</div>`; }
}

async function sendMsg(partnerId) {
  const input = document.getElementById('msg-input');
  const text = input?.value?.trim();
  if (!text) return;
  input.value = '';
  try {
    await API.sendMessage(partnerId, text);
    openChat(partnerId, '');
  } catch (e) { toast(e.message, 'error'); }
}

function startNewChat() {
  const target = document.getElementById('new-msg-target')?.value;
  if (!target) { toast('Selecciona un destinatario', 'error'); return; }
  openChat(parseInt(target), '');
}

function openMsgWithUser(userId) {
  document.getElementById('profile-modal').classList.remove('open');
  document.querySelector('[data-page="mensajes"]').click();
  setTimeout(() => openChat(userId, ''), 300);
}

function startMsgPoll() {
  msgPollInterval = setInterval(async () => {
    if (currentPage === 'mensajes') return;
    try {
      const convs = await API.getConversations();
      const total = convs.reduce((s, c) => s + (c.unread || 0), 0);
      const badge = document.getElementById('msg-badge');
      if (total > 0) { badge.textContent = total; badge.style.display = ''; }
      else badge.style.display = 'none';
    } catch {}
  }, 30000);
}

// ============================================================
//  CONTACTOS
// ============================================================
async function loadContactos() {
  const el = document.getElementById('page-contactos');
  el.innerHTML = '<div class="loading">Cargando contactos...</div>';
  try {
    const [contacts, profiles] = await Promise.all([API.getContacts(), API.getProfiles()]);
    const contactIds = new Set(contacts.map(c => c.contacto_id));
    const nonContacts = profiles.filter(p => p.user_id !== currentUser.id && !contactIds.has(p.user_id));
    const contactHtml = contacts.length ? `<div class="contact-cards-grid">` + contacts.map(c => `
      <div class="contact-card">
        <div class="mc-avatar" style="background:${colorFor(c.nombre)};width:42px;height:42px;font-size:15px">${getInitials(c.nombre)}</div>
        <div style="flex:1">
          <strong style="font-size:13px">${c.nombre}</strong>
          <div style="font-size:12px;color:var(--muted)">${c.profesion||''}</div>
          ${c.etiqueta ? `<span class="tag tag-skill" style="margin-top:4px">${c.etiqueta}</span>` : ''}
          ${c.estrategico ? '<span class="tag tag-red" style="margin-top:4px">⭐ Estratégico</span>' : ''}
        </div>
        <div style="display:flex;gap:6px;flex-direction:column">
          <button class="btn-sm btn-navy" onclick="openProfileModal(${c.id})">Ver</button>
          <button class="btn-sm btn-reject" onclick="deleteContact(${c.id})">🗑</button>
        </div>
      </div>`).join('') + '</div>'
      : '<div class="empty"><div class="empty-icon">🤝</div><p>No tienes contactos aún. Agrega emprendedores de la red.</p></div>';

    const suggestHtml = nonContacts.length ? `<div class="card" style="margin-top:18px"><div class="card-title">💡 Emprendedores sugeridos</div><div class="contact-cards-grid">` + nonContacts.slice(0, 6).map(p => `
      <div class="contact-card">
        <div class="mc-avatar" style="background:${colorFor(p.nombre)};width:40px;height:40px;font-size:14px">${getInitials(p.nombre)}</div>
        <div style="flex:1"><strong style="font-size:13px">${p.nombre}</strong><div style="font-size:12px;color:var(--muted)">${p.profesion||''}</div></div>
        <button class="btn-sm btn-approve" onclick="quickAddContact(${p.user_id},this)">+ Agregar</button>
      </div>`).join('') + '</div></div>' : '';

    el.innerHTML = `<div class="card"><div class="card-title">Mis contactos (${contacts.length})</div>${contactHtml}</div>${suggestHtml}`;
  } catch (e) {
    el.innerHTML = `<div class="empty"><p>${e.message}</p></div>`;
  }
}

async function quickAddContact(userId, btn) {
  try {
    await API.addContact({ contacto_id: userId });
    btn.textContent = '✓ Agregado';
    btn.disabled = true;
    toast('Contacto agregado', 'success');
    setTimeout(() => loadContactos(), 1000);
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteContact(id) {
  if (!confirm('¿Quitar este contacto?')) return;
  try { await API.deleteContact(id); loadContactos(); } catch (e) { toast(e.message, 'error'); }
}

// ============================================================
//  MANAGER
// ============================================================
async function loadManager() {
  const el = document.getElementById('page-manager');
  el.innerHTML = '<div class="loading">Cargando panel...</div>';
  try {
    const pending = await API.getPendingProfiles();
    const pendHtml = pending.length ? pending.map(p => `
      <div class="manager-card" id="mgr-p-${p.id}">
        <div class="mc-avatar" style="background:${colorFor(p.nombre)};width:44px;height:44px;font-size:16px">${getInitials(p.nombre)}</div>
        <div class="manager-info">
          <h4>${p.nombre}</h4>
          <p>${p.profesion||'—'} · ${p.ciudad||'—'} · ${p.email}</p>
          <div style="margin-top:6px">
            ${parseSectors(p.sectores).map(s=>`<span class="tag tag-sector">${s}</span>`).join('')}
            ${p.disponibilidad ? `<span class="tag tag-skill">${p.disponibilidad}</span>` : ''}
          </div>
          ${p.bio ? `<p style="font-size:12px;color:var(--muted);margin-top:6px">${p.bio.slice(0,100)}...</p>` : ''}
        </div>
        <div class="manager-actions">
          <button class="btn-sm btn-approve" onclick="approveProfile(${p.id})">✓ Aprobar</button>
          <button class="btn-sm btn-reject" onclick="rejectProfile(${p.id})">✗ Rechazar</button>
          <button class="btn-sm" style="background:var(--bg);border:1px solid var(--border)" onclick="openProfileModal(${p.id})">Ver perfil</button>
        </div>
      </div>`).join('')
      : '<div class="empty"><div class="empty-icon">✅</div><p>No hay perfiles pendientes de aprobación.</p></div>';

    el.innerHTML = `
      <div style="background:#fef9eb;border:1px solid #fed7aa;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#92400e;max-width:800px">
        ⚠️ Solo managers y administradores pueden acceder a este panel. Los perfiles aprobados aparecen automáticamente en el directorio.
      </div>
      <div style="max-width:800px">
        <div class="card">
          <div class="card-title">⏳ Perfiles pendientes de aprobación (${pending.length})</div>
          <div id="pending-profiles">${pendHtml}</div>
        </div>
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty"><p>${e.message}</p></div>`;
  }
}

async function approveProfile(id) {
  try {
    await API.approveProfile(id);
    toast('✅ Perfil aprobado y publicado en el directorio', 'success');
    loadManager();
    loadDashboard();
  } catch (e) { toast(e.message, 'error'); }
}

async function rejectProfile(id) {
  if (!confirm('¿Estás seguro de rechazar este perfil? El usuario podrá corregirlo y reenviar.')) return;
  try {
    await API.rejectProfile(id);
    toast('Perfil rechazado', 'error');
    loadManager();
  } catch (e) { toast(e.message, 'error'); }
}

// ============================================================
//  BOOT
// ============================================================
(async function boot() {
  const token = API.getToken();
  const user = API.getUser();
  if (token && user) {
    try {
      const me = await API.me();
      initApp({ ...user, ...me });
    } catch {
      API.clearToken();
    }
  }
})();

// Enter key para login
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (document.getElementById('login-form')?.style.display !== 'none' && document.getElementById('login-screen')?.style.display !== 'none') doLogin();
    else if (document.getElementById('register-form')?.style.display !== 'none' && document.getElementById('login-screen')?.style.display !== 'none') doRegister();
  }
});
