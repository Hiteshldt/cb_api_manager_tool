/* Carbelim API Engine · Admin UI */
'use strict';

// ── State ────────────────────────────────────────────────────────────────────
const S = {
  key: sessionStorage.getItem('cbkey') || '',
  sources: [], transforms: [], endpoints: [],
};
const BASE = location.origin;

// ── API ──────────────────────────────────────────────────────────────────────
const api = {
  h: (x = {}) => ({ 'Content-Type': 'application/json', 'x-admin-key': S.key, ...x }),
  async req(method, path, body) {
    const r = await fetch(BASE + path, {
      method, headers: this.h(),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    return d;
  },
  get:  p     => api.req('GET', p),
  post: (p,b) => api.req('POST', p, b),
  put:  (p,b) => api.req('PUT', p, b),
  del:  p     => api.req('DELETE', p),
};

// ── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, err = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : '');
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ── HTML helpers ─────────────────────────────────────────────────────────────
const h = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function jsonHL(obj) {
  if (obj === null || obj === undefined) return '<span class="jx">null</span>';
  return JSON.stringify(obj, null, 2)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, m => {
      if (/^"/.test(m)) return /:$/.test(m) ? `<span class="jk">${m}</span>` : `<span class="js">${m}</span>`;
      if (/true|false/.test(m)) return `<span class="jb">${m}</span>`;
      if (/null/.test(m))       return `<span class="jx">${m}</span>`;
      return `<span class="jn">${m}</span>`;
    });
}
function setJSON(el, data) { el.innerHTML = jsonHL(data); }

// ── Skeleton / Loading helpers ────────────────────────────────────────────────

// Skeleton table rows — widths is an array of CSS widths per column
function skTable(tbodyId, widths, rowCount = 4) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = Array.from({ length: rowCount }, () =>
    `<tr class="sk-tr">${widths.map(w =>
      `<td><div class="sk sk-12" style="width:${w}"></div></td>`
    ).join('')}</tr>`
  ).join('');
}

// Skeleton lines for dark log / JSON viewers
function skLines(elId, count = 10) {
  const el = document.getElementById(elId);
  if (!el) return;
  const pcts = [80, 65, 90, 55, 75, 70, 85, 60, 72, 68, 88, 50, 78, 63, 82];
  el.innerHTML = Array.from({ length: count }, (_, i) =>
    `<div class="sk sk-dark sk-8" style="width:${pcts[i % pcts.length]}%;margin-bottom:8px"></div>`
  ).join('');
}

// Skeleton for dashboard stat numbers
function skStats() {
  ['s-sources', 's-transforms', 's-endpoints', 's-active'].forEach(id => {
    document.getElementById(id).innerHTML =
      '<div class="sk sk-28" style="width:40px"></div>';
  });
}

// Button loading state — saves original HTML, shows spinner
function btnLoad(btn, label) {
  btn._prev = btn.innerHTML;
  btn.classList.add('btn-loading');
  btn.innerHTML = h(label ?? btn.textContent.trim()) + '<span class="spin"></span>';
}
function btnDone(btn) {
  btn.classList.remove('btn-loading');
  if (btn._prev !== undefined) { btn.innerHTML = btn._prev; delete btn._prev; }
}

// ── Modals ───────────────────────────────────────────────────────────────────
const openM  = id => document.getElementById(id).classList.add('open');
const closeM = id => document.getElementById(id).classList.remove('open');

document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeM(b.dataset.close)));
document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); }));

// ── Router ───────────────────────────────────────────────────────────────────
const titles = { dashboard: 'Dashboard', sources: 'Sources', transformations: 'Transformations', endpoints: 'Output Endpoints', logs: 'Logs' };

async function go(page) {
  if (!titles[page]) page = 'dashboard';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  document.querySelector(`.nav-link[data-page="${page}"]`)?.classList.add('active');
  document.getElementById('page-title').textContent = titles[page];
  location.hash = page;
  try {
    await { dashboard: loadDash, sources: loadSources, transformations: loadTransforms, endpoints: loadEndpoints, logs: loadLogs }[page]?.();
  } catch (e) {
    if (e.message?.includes('401') || e.message?.includes('Unauthorized')) logout();
    else toast(e.message, true);
  }
}

document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => go(n.dataset.page)));
window.addEventListener('hashchange', () => go(location.hash.slice(1)));

// ── Auth ─────────────────────────────────────────────────────────────────────
function showLogin() {
  document.getElementById('login-page').style.cssText = 'display:flex';
  document.getElementById('app').classList.remove('visible');
}
function showApp() {
  document.getElementById('login-page').style.cssText = 'display:none';
  document.getElementById('app').classList.add('visible');
  document.getElementById('origin-display').textContent = location.origin;
}
function logout() {
  sessionStorage.removeItem('cbkey');
  S.key = '';
  showLogin();
}

document.getElementById('login-btn').addEventListener('click', async () => {
  const k = document.getElementById('login-key').value.trim();
  if (!k) return;
  const btn = document.getElementById('login-btn');
  btnLoad(btn, 'Signing in');
  S.key = k;
  try {
    await api.get('/admin/stats');
    sessionStorage.setItem('cbkey', k);
    document.getElementById('login-err').textContent = '';
    btnDone(btn);
    showApp();
    go(location.hash.slice(1) || 'dashboard');
  } catch {
    btnDone(btn);
    document.getElementById('login-err').textContent = 'Invalid admin key.';
  }
});
document.getElementById('login-key').addEventListener('keydown', e => e.key === 'Enter' && document.getElementById('login-btn').click());
document.getElementById('logout-btn').addEventListener('click', logout);

// ── DASHBOARD ────────────────────────────────────────────────────────────────
async function loadDash() {
  // Show skeletons immediately
  skStats();
  document.getElementById('dash-sources').innerHTML =
    ['72%', '55%', '80%'].map(w =>
      `<div class="src-row">
        <div class="sk sk-12" style="width:${w}"></div>
        <div class="sk sk-12" style="width:30px"></div>
      </div>`
    ).join('');
  skLines('dash-logs', 12);

  const [stats, srcs, logs] = await Promise.all([
    api.get('/admin/stats'),
    api.get('/admin/sources'),
    api.get('/admin/logs?lines=25'),
  ]);

  document.getElementById('s-sources').textContent    = stats.sources;
  document.getElementById('s-transforms').textContent = stats.transformations;
  document.getElementById('s-endpoints').textContent  = stats.endpoints;
  document.getElementById('s-active').textContent     = stats.activeSources;

  const dsr = document.getElementById('dash-sources');
  dsr.innerHTML = srcs.length
    ? srcs.map(s => `<div class="src-row"><span>${h(s.name)}</span><span class="pill ${s.enabled ? 'pill-green' : 'pill-gray'}">${s.enabled ? 'active' : 'off'}</span></div>`).join('')
    : '<div style="color:var(--subtle);font-size:12px;padding:4px 0">No sources yet</div>';

  renderLogs(document.getElementById('dash-logs'), logs.logs.slice(-20));
}

// ── SOURCES ──────────────────────────────────────────────────────────────────
async function loadSources() {
  skTable('sources-tbody', ['58%', '22%', '65%', '28px', '90px']);
  S.sources = await api.get('/admin/sources');
  const tb = document.getElementById('sources-tbody');
  if (!S.sources.length) {
    tb.innerHTML = '<tr><td colspan="5" class="empty-row"><span class="ei">🔌</span><p>No sources. Add one to start.</p></td></tr>';
    return;
  }
  tb.innerHTML = S.sources.map(s => `
    <tr>
      <td><strong>${h(s.name)}</strong><div class="meta">${h(s.id)}</div></td>
      <td><span class="type-tag ${s.type === 'websocket' ? 'type-ws' : 'type-rest'}">${s.type}</span></td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--muted)" title="${h(s.url)}">${h(s.url)}</td>
      <td><label class="toggle"><input type="checkbox" ${s.enabled ? 'checked' : ''} data-action="toggle-source" data-id="${s.id}" /><span class="toggle-slider"></span></label></td>
      <td><div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-action="view-raw" data-id="${s.id}" data-name="${h(s.name)}">Raw</button>
        <button class="btn btn-ghost btn-sm" data-action="edit-source" data-id="${s.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-action="del-source" data-id="${s.id}" data-name="${h(s.name)}">Delete</button>
      </div></td>
    </tr>`).join('');
}

document.getElementById('sources-tbody').addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.action !== 'toggle-source') return;
  try { await api.put(`/admin/sources/${el.dataset.id}`, { enabled: el.checked }); toast('Updated'); }
  catch (err) { toast(err.message, true); el.checked = !el.checked; }
});

document.getElementById('sources-tbody').addEventListener('click', async e => {
  const btn = e.target.closest('[data-action]'); if (!btn) return;
  const { action, id, name } = btn.dataset;
  if (action === 'view-raw')    await viewRaw(id, name);
  if (action === 'edit-source') editSource(id);
  if (action === 'del-source') {
    if (!confirm(`Delete "${name}"?`)) return;
    await api.del(`/admin/sources/${id}`); toast('Deleted'); loadSources();
  }
});

async function viewRaw(id, name) {
  document.getElementById('raw-meta').textContent = name;
  skLines('raw-view', 10);
  openM('m-raw');
  try {
    const d = await api.get(`/admin/sources/${id}/latest`);
    setJSON(document.getElementById('raw-view'), d.data ?? d);
    document.getElementById('raw-meta').textContent = `${name} · received ${d.receivedAt ?? '—'}`;
  } catch (err) { document.getElementById('raw-view').textContent = err.message; }
}

// Source form
function resetSourceForm(s = {}) {
  document.getElementById('s-id').value        = s.id || '';
  document.getElementById('s-name').value      = s.name || '';
  document.getElementById('s-type').value      = s.type || 'websocket';
  document.getElementById('s-url').value       = s.url || '';
  document.getElementById('s-poll').value      = s.pollIntervalSeconds || 30;
  document.getElementById('s-auth-type').value = s.authType || 'none';
  document.getElementById('s-auth-header').value = s.authConfig?.headerName || '';
  document.getElementById('s-auth-val').value    = s.authConfig?.apiKey || s.authConfig?.token || '';
  document.getElementById('s-auth-user').value   = s.authConfig?.username || '';
  document.getElementById('s-auth-pass').value   = s.authConfig?.password || '';
  document.getElementById('s-enabled').checked  = s.enabled !== false;
  const sub = s.wsSubscribeMessage;
  document.getElementById('s-subscribe').value = sub
    ? (typeof sub === 'string' ? sub : JSON.stringify(sub, null, 2))
    : '';
  document.getElementById('m-source-title').textContent = s.id ? 'Edit Source' : 'Add Source';
  updateSourceUI();
}

function updateSourceUI() {
  const type = document.getElementById('s-type').value;
  const auth = document.getElementById('s-auth-type').value;
  document.getElementById('s-poll-fg').style.display      = type === 'rest'      ? '' : 'none';
  document.getElementById('s-subscribe-fg').style.display = type === 'websocket' ? '' : 'none';
  document.getElementById('s-header-fg').style.display    = auth === 'api_key'   ? '' : 'none';
  document.getElementById('s-val-fg').style.display       = (auth === 'api_key' || auth === 'bearer') ? '' : 'none';
  document.getElementById('s-basic-fg').style.display     = auth === 'basic'     ? '' : 'none';
  document.getElementById('s-val-label').textContent      = auth === 'bearer' ? 'Token' : 'API Key';
}

document.getElementById('s-type').addEventListener('change', updateSourceUI);
document.getElementById('s-auth-type').addEventListener('change', updateSourceUI);
document.getElementById('btn-add-source').addEventListener('click', () => { resetSourceForm(); openM('m-source'); });
function editSource(id) { resetSourceForm(S.sources.find(s => s.id === id) || {}); openM('m-source'); }

document.getElementById('btn-save-source').addEventListener('click', async () => {
  const id   = document.getElementById('s-id').value;
  const auth = document.getElementById('s-auth-type').value;
  const cfg  = {};
  if (auth === 'api_key') { cfg.headerName = document.getElementById('s-auth-header').value; cfg.apiKey = document.getElementById('s-auth-val').value; }
  else if (auth === 'bearer') { cfg.token = document.getElementById('s-auth-val').value; }
  else if (auth === 'basic')  { cfg.username = document.getElementById('s-auth-user').value; cfg.password = document.getElementById('s-auth-pass').value; }
  const type = document.getElementById('s-type').value;
  let wsSubscribeMessage = null;
  if (type === 'websocket') {
    const raw = document.getElementById('s-subscribe').value.trim();
    if (raw) {
      try { wsSubscribeMessage = JSON.parse(raw); }
      catch { wsSubscribeMessage = raw; }
    }
  }
  const payload = {
    name: document.getElementById('s-name').value.trim(),
    type,
    url:  document.getElementById('s-url').value.trim(),
    pollIntervalSeconds: +document.getElementById('s-poll').value || 30,
    authType: auth, authConfig: cfg,
    wsSubscribeMessage,
    enabled: document.getElementById('s-enabled').checked,
  };
  if (!payload.name || !payload.url) return toast('Name and URL required', true);
  const btn = document.getElementById('btn-save-source');
  btnLoad(btn, 'Saving');
  try {
    id ? await api.put(`/admin/sources/${id}`, payload) : await api.post('/admin/sources', payload);
    btnDone(btn);
    toast(id ? 'Source updated' : 'Source created');
    closeM('m-source'); loadSources();
  } catch (err) { btnDone(btn); toast(err.message, true); }
});

// ── TRANSFORMATIONS ──────────────────────────────────────────────────────────
async function loadTransforms() {
  skTable('transformations-tbody', ['55%', '35%', '60px', '28px', '90px']);
  [S.transforms, S.sources] = await Promise.all([
    api.get('/admin/transformations'),
    api.get('/admin/sources'),
  ]);
  const tb = document.getElementById('transformations-tbody');
  if (!S.transforms.length) {
    tb.innerHTML = '<tr><td colspan="5" class="empty-row"><span class="ei">⚙️</span><p>No transformations yet.</p></td></tr>';
    return;
  }
  tb.innerHTML = S.transforms.map(t => {
    const sn = S.sources.find(s => s.id === t.sourceId)?.name || t.sourceId;
    return `<tr>
      <td><strong>${h(t.name)}</strong><div class="meta">${h(t.id)}</div></td>
      <td style="font-size:12px">${h(sn)}</td>
      <td style="font-size:12px;color:var(--muted)">
        ${(t.mappings||[]).length ? `<span title="Field mappings">${(t.mappings||[]).length}M</span> ` : ''}
        ${(t.staticFields||[]).length ? `<span title="Static fields">${(t.staticFields||[]).length}S</span> ` : ''}
        ${(t.computedFields||[]).length ? `<span title="Computed fields" style="color:#7e22ce">${(t.computedFields||[]).length}C</span>` : ''}
        ${!(t.mappings||[]).length && !(t.staticFields||[]).length && !(t.computedFields||[]).length ? '—' : ''}
      </td>
      <td><label class="toggle"><input type="checkbox" ${t.enabled !== false ? 'checked' : ''} data-action="toggle-t" data-id="${t.id}" /><span class="toggle-slider"></span></label></td>
      <td><div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-action="edit-t" data-id="${t.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-action="del-t" data-id="${t.id}" data-name="${h(t.name)}">Delete</button>
      </div></td>
    </tr>`;
  }).join('');
}

document.getElementById('transformations-tbody').addEventListener('change', async e => {
  const el = e.target; if (el.dataset.action !== 'toggle-t') return;
  try { await api.put(`/admin/transformations/${el.dataset.id}`, { enabled: el.checked }); toast('Updated'); }
  catch (err) { toast(err.message, true); el.checked = !el.checked; }
});

document.getElementById('transformations-tbody').addEventListener('click', async e => {
  const btn = e.target.closest('[data-action]'); if (!btn) return;
  const { action, id, name } = btn.dataset;
  if (action === 'edit-t') { openTransformModal(S.transforms.find(t => t.id === id)); openM('m-transform'); }
  if (action === 'del-t') {
    if (!confirm(`Delete "${name}"?`)) return;
    await api.del(`/admin/transformations/${id}`); toast('Deleted'); loadTransforms();
  }
});

function buildSourceSelect(elId, selectedId = '') {
  const el = document.getElementById(elId);
  el.innerHTML = S.sources.length
    ? S.sources.map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${h(s.name)}</option>`).join('')
    : '<option value="">— no sources —</option>';
}

function openTransformModal(t = {}) {
  document.getElementById('t-id').value    = t.id || '';
  document.getElementById('t-name').value  = t.name || '';
  document.getElementById('t-enabled').checked = t.enabled !== false;
  document.getElementById('t-sample').value = '';
  document.getElementById('preview-section').style.display = 'none';
  document.getElementById('m-transform-title').textContent = t.id ? 'Edit Transformation' : 'Add Transformation';
  buildSourceSelect('t-source', t.sourceId);
  renderMapRows(t.mappings || []);
  renderStaticRows(t.staticFields || []);
  renderComputedRows(t.computedFields || []);
}

function renderMapRows(rows) {
  const l = document.getElementById('map-list');
  l.innerHTML = '';
  rows.forEach(r => addMapRow(r.sourcePath, r.targetPath));
}
function addMapRow(src = '', tgt = '') {
  const row = document.createElement('div');
  row.className = 'map-row';
  row.innerHTML = `<input class="map-src" value="${h(src)}" placeholder="read from (e.g. d1)" /><div class="map-arrow">→</div><input class="map-tgt" value="${h(tgt)}" placeholder="output as (e.g. pm25)" /><button class="map-rm" onclick="this.closest('.map-row').remove()">✕</button>`;
  document.getElementById('map-list').appendChild(row);
}
function renderStaticRows(rows) {
  const l = document.getElementById('static-list');
  l.innerHTML = '';
  rows.forEach(r => addStaticRow(r.targetPath, r.value));
}
function addStaticRow(path = '', val = '') {
  // Display typed values naturally: numbers/booleans/null as their literal,
  // strings as plain text (no wrapping quotes).
  const display = (typeof val === 'string') ? val : (val === null ? 'null' : JSON.stringify(val));
  const row = document.createElement('div');
  row.className = 'map-row';
  row.innerHTML = `<input class="st-path" value="${h(String(path))}" placeholder="target.path" /><div class="map-arrow">=</div><input class="st-val" value="${h(display)}" placeholder="value  e.g.  hello  or  42  or  true" /><button class="map-rm" onclick="this.closest('.map-row').remove()">✕</button>`;
  document.getElementById('static-list').appendChild(row);
}
// Auto-cast static field values: numbers, booleans, null, JSON objects/arrays,
// or plain strings.  "hello" (with quotes) → string hello.  42 → number 42.
function parseStaticValue(raw) {
  try { return JSON.parse(raw); } catch { return raw; }
}
const getMappings     = () => [...document.querySelectorAll('#map-list .map-row')].map(r => ({ sourcePath: r.querySelector('.map-src').value.trim(), targetPath: r.querySelector('.map-tgt').value.trim() })).filter(m => m.sourcePath && m.targetPath);
const getStaticFields = () => [...document.querySelectorAll('#static-list .map-row')].map(r => ({ targetPath: r.querySelector('.st-path').value.trim(), value: parseStaticValue(r.querySelector('.st-val').value) })).filter(f => f.targetPath);

document.getElementById('btn-add-map').addEventListener('click', () => addMapRow());
document.getElementById('btn-add-static').addEventListener('click', () => addStaticRow());

// ── Computed rows ─────────────────────────────────────────────────────────────
function renderComputedRows(rows) {
  document.getElementById('computed-list').innerHTML = '';
  (rows || []).forEach(r => addComputedRow(r.targetPath, r.expression));
}
function addComputedRow(path = '', expr = '') {
  const row = document.createElement('div');
  row.className = 'comp-row';
  row.innerHTML =
    `<input class="comp-path" value="${h(path)}" placeholder="output.field" />`+
    `<div class="map-arrow">=</div>`+
    `<input class="comp-expr" value="${h(expr)}" placeholder="d1 * 2.5 + d2 / 10" />`+
    `<button class="map-rm" onclick="this.closest('.comp-row').remove()">✕</button>`;
  document.getElementById('computed-list').appendChild(row);
}
const getComputedFields = () =>
  [...document.querySelectorAll('#computed-list .comp-row')]
    .map(r => ({
      targetPath: r.querySelector('.comp-path').value.trim(),
      expression: r.querySelector('.comp-expr').value.trim(),
    }))
    .filter(f => f.targetPath && f.expression);

document.getElementById('btn-add-computed').addEventListener('click', () => addComputedRow());

document.getElementById('btn-add-transformation').addEventListener('click', async () => {
  const btn = document.getElementById('btn-add-transformation');
  btnLoad(btn, '+ Add Transformation');
  try {
    S.sources = await api.get('/admin/sources');
    btnDone(btn);
    openTransformModal();
    openM('m-transform');
  } catch (err) { btnDone(btn); toast(err.message, true); }
});

document.getElementById('btn-preview').addEventListener('click', async () => {
  const raw = document.getElementById('t-sample').value.trim();
  if (!raw) return toast('Paste sample JSON first', true);
  let sample; try { sample = JSON.parse(raw); } catch { return toast('Invalid JSON', true); }
  const btn = document.getElementById('btn-preview');
  btnLoad(btn, 'Preview');
  try {
    const result = await api.post('/admin/transformations/preview', { sampleData: sample, mappings: getMappings(), staticFields: getStaticFields(), computedFields: getComputedFields() });
    btnDone(btn);
    document.getElementById('preview-section').style.display = '';
    setJSON(document.getElementById('preview-out'), result);
  } catch (err) { btnDone(btn); toast(err.message, true); }
});

document.getElementById('btn-load-latest').addEventListener('click', async () => {
  const sid = document.getElementById('t-source').value;
  if (!sid) return toast('Select a source first', true);
  const btn = document.getElementById('btn-load-latest');
  btnLoad(btn, 'Load latest from source');
  try {
    const d = await api.get(`/admin/sources/${sid}/latest`);
    document.getElementById('t-sample').value = JSON.stringify(d.data ?? d, null, 2);
    btnDone(btn);
    toast('Loaded');
  } catch (err) { btnDone(btn); toast(err.message || 'No data yet', true); }
});

document.getElementById('btn-save-transform').addEventListener('click', async () => {
  const id = document.getElementById('t-id').value;
  const payload = {
    name:           document.getElementById('t-name').value.trim(),
    sourceId:       document.getElementById('t-source').value,
    mappings:       getMappings(),
    staticFields:   getStaticFields(),
    computedFields: getComputedFields(),
    enabled:        document.getElementById('t-enabled').checked,
  };
  if (!payload.name || !payload.sourceId) return toast('Name and source required', true);
  const btn = document.getElementById('btn-save-transform');
  btnLoad(btn, 'Saving');
  try {
    id ? await api.put(`/admin/transformations/${id}`, payload) : await api.post('/admin/transformations', payload);
    btnDone(btn);
    toast(id ? 'Updated' : 'Created');
    closeM('m-transform'); loadTransforms();
  } catch (err) { btnDone(btn); toast(err.message, true); }
});

// ── ENDPOINTS ────────────────────────────────────────────────────────────────
async function loadEndpoints() {
  skTable('endpoints-tbody', ['58%', '42%', '32px', '42%', '28px', '120px']);
  [S.endpoints, S.sources, S.transforms] = await Promise.all([
    api.get('/admin/endpoints'),
    api.get('/admin/sources'),
    api.get('/admin/transformations'),
  ]);
  const tb = document.getElementById('endpoints-tbody');
  if (!S.endpoints.length) {
    tb.innerHTML = '<tr><td colspan="6" class="empty-row"><span class="ei">🚀</span><p>No endpoints yet.</p></td></tr>';
    return;
  }
  tb.innerHTML = S.endpoints.map(ep => {
    const tn = S.transforms.find(t => t.id === ep.transformationId)?.name || ep.transformationId;
    return `<tr>
      <td><strong>${h(ep.name)}</strong><div class="meta">${h(ep.id)}</div></td>
      <td><span style="font-family:monospace;font-size:11.5px;color:var(--green-d)">${h(ep.path)}</span></td>
      <td>${ep.authRequired ? '<span class="pill pill-amber">Key</span>' : '<span class="pill pill-gray">Public</span>'}</td>
      <td style="font-size:12px">${h(tn)}</td>
      <td><label class="toggle"><input type="checkbox" ${ep.enabled !== false ? 'checked' : ''} data-action="toggle-ep" data-id="${ep.id}" /><span class="toggle-slider"></span></label></td>
      <td><div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-action="view-out" data-id="${ep.id}">Output</button>
        <button class="btn btn-ghost btn-sm" data-action="edit-ep" data-id="${ep.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-action="del-ep" data-id="${ep.id}" data-name="${h(ep.name)}">Delete</button>
      </div></td>
    </tr>`;
  }).join('');
}

document.getElementById('endpoints-tbody').addEventListener('change', async e => {
  const el = e.target; if (el.dataset.action !== 'toggle-ep') return;
  try { await api.put(`/admin/endpoints/${el.dataset.id}`, { enabled: el.checked }); toast('Updated'); }
  catch (err) { toast(err.message, true); el.checked = !el.checked; }
});

document.getElementById('endpoints-tbody').addEventListener('click', async e => {
  const btn = e.target.closest('[data-action]'); if (!btn) return;
  const { action, id, name } = btn.dataset;
  if (action === 'view-out') viewOutput(id);
  if (action === 'edit-ep') { openEndpointModal(S.endpoints.find(ep => ep.id === id)); openM('m-endpoint'); }
  if (action === 'del-ep') {
    if (!confirm(`Delete "${name}"?`)) return;
    await api.del(`/admin/endpoints/${id}`); toast('Deleted'); loadEndpoints();
  }
});

async function viewOutput(id) {
  const ep = S.endpoints.find(e => e.id === id); if (!ep) return;
  const url = `${BASE}${ep.path}`;
  const urlRow = document.getElementById('output-url-row');
  urlRow.innerHTML = `<span>${h(url)}</span><button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${h(url)}').then(()=>toast('Copied'))">Copy</button>`;
  if (ep.authRequired && ep.apiKey) {
    urlRow.insertAdjacentHTML('afterend', `<div class="meta" style="margin-bottom:10px">x-api-key: <code>${h(ep.apiKey)}</code></div>`);
  }
  document.getElementById('output-meta').textContent = '';
  skLines('output-view', 10);
  openM('m-output');
  try {
    const d = await api.get(`/admin/endpoints/${id}/latest`);
    setJSON(document.getElementById('output-view'), d.data ?? d);
    document.getElementById('output-meta').textContent = `Transformed at: ${d.transformedAt ?? '—'}`;
  } catch (err) { document.getElementById('output-view').textContent = err.message; }
}

function buildTransformSelect(elId, selectedId = '') {
  const el = document.getElementById(elId);
  el.innerHTML = S.transforms.length
    ? S.transforms.map(t => `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${h(t.name)}</option>`).join('')
    : '<option value="">— no transformations —</option>';
}

function openEndpointModal(ep = {}) {
  document.getElementById('e-id').value      = ep.id || '';
  document.getElementById('e-name').value    = ep.name || '';
  document.getElementById('e-path').value    = ep.path || '/output/';
  document.getElementById('e-auth').checked  = ep.authRequired !== false;
  document.getElementById('e-apikey').value  = ep.apiKey || '';
  document.getElementById('e-enabled').checked = ep.enabled !== false;
  document.getElementById('m-endpoint-title').textContent = ep.id ? 'Edit Endpoint' : 'Add Endpoint';
  buildSourceSelect('e-source', ep.sourceId);
  buildTransformSelect('e-transform', ep.transformationId);
  updateEpAuthUI();
}

function updateEpAuthUI() { document.getElementById('e-key-fg').style.display = document.getElementById('e-auth').checked ? '' : 'none'; }
document.getElementById('e-auth').addEventListener('change', updateEpAuthUI);

document.getElementById('btn-add-endpoint').addEventListener('click', async () => {
  const btn = document.getElementById('btn-add-endpoint');
  btnLoad(btn, '+ Add Endpoint');
  try {
    [S.sources, S.transforms] = await Promise.all([api.get('/admin/sources'), api.get('/admin/transformations')]);
    btnDone(btn);
    openEndpointModal();
    openM('m-endpoint');
  } catch (err) { btnDone(btn); toast(err.message, true); }
});

document.getElementById('btn-save-endpoint').addEventListener('click', async () => {
  const id = document.getElementById('e-id').value;
  const authRequired = document.getElementById('e-auth').checked;
  let apiKey = document.getElementById('e-apikey').value.trim();
  if (authRequired && !apiKey && !id) apiKey = 'cbkey_' + Math.random().toString(36).slice(2,10);
  const payload = {
    name: document.getElementById('e-name').value.trim(),
    path: document.getElementById('e-path').value.trim(),
    sourceId: document.getElementById('e-source').value,
    transformationId: document.getElementById('e-transform').value,
    authRequired, apiKey,
    enabled: document.getElementById('e-enabled').checked,
  };
  if (!payload.name || !payload.path || !payload.sourceId || !payload.transformationId) return toast('All fields required', true);
  if (!payload.path.startsWith('/')) return toast('Path must start with /', true);
  const reserved = ['/admin', '/public', '/logo'];
  if (reserved.some(r => payload.path.startsWith(r))) return toast(`Path cannot start with ${reserved.join(', ')}`, true);
  const btn = document.getElementById('btn-save-endpoint');
  btnLoad(btn, 'Saving');
  try {
    const result = id ? await api.put(`/admin/endpoints/${id}`, payload) : await api.post('/admin/endpoints', payload);
    btnDone(btn);
    toast(id ? 'Updated' : `Created · key: ${result.apiKey || 'none'}`);
    closeM('m-endpoint'); loadEndpoints();
  } catch (err) { btnDone(btn); toast(err.message, true); }
});

// ── LOGS ─────────────────────────────────────────────────────────────────────
async function loadLogs() {
  const type = document.getElementById('log-type').value;
  const el   = document.getElementById('logs-view');
  skLines('logs-view', 16);
  try {
    const { logs } = await api.get(`/admin/logs?type=${type}&lines=200`);
    renderLogs(el, logs);
  } catch (err) { el.textContent = err.message; }
}

function renderLogs(el, lines) {
  if (!lines?.length) { el.innerHTML = '<span class="jx">No entries.</span>'; return; }
  el.innerHTML = lines.map(l => {
    const cls = l.includes('[ERROR]') ? 'e' : l.includes('[WARN]') ? 'w' : 'i';
    return `<div class="log-line ${cls}">${h(l)}</div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

document.getElementById('btn-refresh-logs').addEventListener('click', async () => {
  const btn = document.getElementById('btn-refresh-logs');
  btnLoad(btn, 'Refresh');
  try { await loadLogs(); } finally { btnDone(btn); }
});
document.getElementById('log-type').addEventListener('change', loadLogs);

// ── Init ─────────────────────────────────────────────────────────────────────
function init() {
  if (S.key) {
    api.get('/admin/stats')
      .then(() => { showApp(); go(location.hash.slice(1) || 'dashboard'); })
      .catch(() => { sessionStorage.removeItem('cbkey'); S.key = ''; showLogin(); });
  } else {
    showLogin();
  }
}
init();
