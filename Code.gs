/**
 * ❄ Lake Effect Book Club — Google Sheets backend
 * ────────────────────────────────────────────────
 * 1. Change ADMIN_PASSPHRASE below (do this here in the Apps Script editor,
 *    not in the copy on GitHub).
 * 2. Choose "setup" in the function menu at the top and press Run.
 *    Approve the permissions Google asks for.
 * 3. Deploy → New deployment → gear icon → Web app
 *      Execute as: Me
 *      Who has access: Anyone
 *    Copy the Web app URL into js/config.js on the site.
 *
 * If you edit this file later: Deploy → Manage deployments → pencil icon →
 * Version: New version → Deploy. That keeps the same URL.
 *
 * The weighted draw happens here, so the weights never reach anyone's browser.
 */

const ADMIN_PASSPHRASE = 'change-me';

// How heavy each tier's flake is in the globe. Keep in sync with js/store.js.
const WEIGHTS = { t1: 10, t2: 6, t3: 3, new: 4, mention: 0.5 };

const HEADERS = {
  Books:    ['id', 'title', 'author', 'tier', 'weight', 'status', 'source', 'genres', 'pitch', 'suggestedBy', 'why', 'addedAt'],
  Months:   ['id', 'bookId', 'label', 'meetingDate', 'status', 'groupRating', 'verdict', 'startedAt', 'closedAt'],
  Notes:    ['id', 'monthId', 'bookId', 'name', 'text', 'progress', 'rating', 'spoiler', 'hidden', 'createdAt'],
  Settings: ['key', 'value']
};
const PUBLIC_BOOK_FIELDS = ['id', 'title', 'author', 'status', 'source', 'genres', 'pitch', 'suggestedBy', 'why', 'addedAt'];
const PROGRESS = ['start', 'q1', 'half', 'q3', 'done', 'dnf'];

const PUBLIC = { state: state_, draw: draw_ };
const PUBLIC_WRITE = { addNote: addNote_, addSuggestion: addSuggestion_ };
const ADMIN = {
  verify: function () { return true; },
  adminState: adminState_, updateBook: updateBook_, startMonth: startMonth_, cancelMonth: cancelMonth_,
  updateMonth: updateMonth_, closeMonth: closeMonth_, hideNote: hideNote_, setSetting: setSetting_, seed: seed_
};

/* ───────── entry points ───────── */
function doGet(e) { return respond_((e && e.parameter) || {}); }
function doPost(e) {
  let body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'Could not read that request.' }); }
  return respond_(body);
}
function setup() {
  Object.keys(HEADERS).forEach(function (name) { table_(name); });
  Logger.log('Tabs are ready. Next: Deploy → New deployment → Web app.');
}

function respond_(p) {
  try {
    const action = String(p.action || 'state');
    if (PUBLIC[action]) return json_({ ok: true, data: PUBLIC[action](p) });
    if (PUBLIC_WRITE[action]) return json_({ ok: true, data: locked_(function () { return PUBLIC_WRITE[action](p); }) });
    if (ADMIN[action]) {
      if (ADMIN_PASSPHRASE === 'change-me') throw new Error('Set ADMIN_PASSPHRASE in the Apps Script first, then redeploy.');
      if (String(p.pass || '') !== ADMIN_PASSPHRASE) throw new Error('That passphrase didn’t work.');
      return json_({ ok: true, data: locked_(function () { return ADMIN[action](p); }) });
    }
    throw new Error('Unknown action: ' + action);
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function locked_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ───────── sheet I/O ───────── */
function table_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setNumberFormat('@');
    sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  const values = sh.getRange(1, 1, sh.getLastRow(), Math.max(1, sh.getLastColumn())).getDisplayValues();
  const headers = values[0].map(function (h) { return String(h).trim(); });
  HEADERS[name].forEach(function (h) {
    if (headers.indexOf(h) === -1) { headers.push(h); sh.getRange(1, headers.length).setValue(h).setFontWeight('bold'); }
  });
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (r.every(function (c) { return c === ''; })) continue;
    const o = { _row: i + 1 };
    headers.forEach(function (h, j) { if (h) o[h] = r[j] == null ? '' : r[j]; });
    rows.push(o);
  }
  return { sh: sh, headers: headers, rows: rows };
}
function cell_(v) {
  const s = v == null ? '' : String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s; // never let text become a formula
}
function writeRows_(t, startRow, objs) {
  const vals = objs.map(function (o) { return t.headers.map(function (h) { return h ? cell_(o[h]) : ''; }); });
  const need = startRow + objs.length - 1;
  if (need > t.sh.getMaxRows()) t.sh.insertRowsAfter(t.sh.getMaxRows(), need - t.sh.getMaxRows() + 50);
  t.sh.getRange(startRow, 1, objs.length, t.headers.length).setNumberFormat('@').setValues(vals);
}
function insert_(t, obj) { const row = t.sh.getLastRow() + 1; writeRows_(t, row, [obj]); obj._row = row; t.rows.push(obj); return obj; }
function insertMany_(t, objs) { if (objs.length) writeRows_(t, t.sh.getLastRow() + 1, objs); }
function save_(t, obj) { writeRows_(t, obj._row, [obj]); return obj; }
function find_(t, id, what) {
  const hit = t.rows.filter(function (r) { return r.id === id; })[0];
  if (!hit) throw new Error('That ' + what + ' no longer exists.');
  return hit;
}
function clean_(o) { const c = {}; Object.keys(o).forEach(function (k) { if (k !== '_row') c[k] = o[k]; }); return c; }

/* ───────── helpers ───────── */
function now_() { return new Date().toISOString(); }
function uid_(p) { return p + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function clip_(s, n) { return String(s == null ? '' : s).trim().slice(0, n); }
function truthy_(v) { return v === true || v === 'true' || v === 'TRUE'; }
function norm_(s) { return String(s || '').toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]/g, ''); }
function byTitle_(a, b) { return norm_(a.title) < norm_(b.title) ? -1 : 1; }
function publicBook_(b) { const o = {}; PUBLIC_BOOK_FIELDS.forEach(function (k) { o[k] = b[k] == null ? '' : b[k]; }); return o; }
function settings_() {
  const s = { includeMentions: 'true' };
  table_('Settings').rows.forEach(function (r) { if (r.key) s[r.key] = r.value; });
  return s;
}
function eligible_(b, s) {
  return b.status === 'pool' && Number(b.weight) > 0 && (b.source !== 'mention' || truthy_(s.includeMentions));
}
function rating_(v) {
  if (v === '' || v == null) return '';
  const r = Math.round(Number(v) * 2) / 2;
  if (!(r >= 0.5 && r <= 5)) throw new Error('Ratings go from 0.5 to 5.');
  return String(r);
}
function defaultLabel_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM yyyy'); }

/* ───────── public actions ───────── */
function state_() {
  return {
    books: table_('Books').rows.filter(function (b) { return b.status !== 'removed'; }).map(publicBook_).sort(byTitle_),
    months: table_('Months').rows.map(clean_),
    notes: table_('Notes').rows.filter(function (n) { return !truthy_(n.hidden); })
      .map(function (n) { const c = clean_(n); delete c.hidden; return c; }),
    settings: { includeMentions: truthy_(settings_().includeMentions) }
  };
}

function draw_() {
  const s = settings_();
  const pool = table_('Books').rows.filter(function (b) { return eligible_(b, s); });
  if (!pool.length) throw new Error('The Snowbank is empty. Add a few books first.');
  const total = pool.reduce(function (sum, b) { return sum + Number(b.weight); }, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) { r -= Number(pool[i].weight); if (r < 0) return publicBook_(pool[i]); }
  return publicBook_(pool[pool.length - 1]);
}

function addNote_(p) {
  const text = clip_(p.text, 4000);
  if (!text) throw new Error('Write something first.');
  const month = find_(table_('Months'), p.monthId, 'month');
  const r = p.rating ? Math.max(1, Math.min(5, Math.round(Number(p.rating)))) : '';
  const note = {
    id: uid_('n_'), monthId: month.id, bookId: month.bookId,
    name: clip_(p.name, 60) || 'Anonymous', text: text,
    progress: PROGRESS.indexOf(p.progress) > -1 ? p.progress : '',
    rating: r ? String(r) : '', spoiler: truthy_(p.spoiler) ? 'true' : 'false',
    hidden: 'false', createdAt: now_()
  };
  insert_(table_('Notes'), note);
  const c = clean_(note); delete c.hidden; return c;
}

function addSuggestion_(p) {
  const title = clip_(p.title, 200);
  if (!title) throw new Error('Every book needs a title.');
  const t = table_('Books');
  const existing = t.rows.filter(function (b) { return norm_(b.title) === norm_(title); })[0];
  if (existing) {
    if (existing.status === 'read') throw new Error('We already read ' + existing.title + '. It’s in the Deep Freeze.');
    if (existing.status === 'current') throw new Error(existing.title + ' is this month’s book.');
    if (existing.status === 'pool' && existing.source !== 'mention') throw new Error(existing.title + ' is already in the Snowbank.');
  }
  const fields = {
    tier: 'new', status: 'pool', source: 'suggestion',
    author: clip_(p.author, 120) || (existing ? existing.author : ''),
    genres: clip_(p.genres, 120) || (existing ? existing.genres : ''),
    suggestedBy: clip_(p.suggestedBy, 60), why: clip_(p.why, 600), addedAt: now_()
  };
  let book;
  if (existing) { // a "stuck with us" mention or a removed book comes back as a real suggestion
    fields.weight = String(Math.max(Number(existing.weight) || 0, WEIGHTS.new));
    book = Object.assign(existing, fields);
    save_(t, book);
  } else {
    book = Object.assign({ id: uid_('b_'), title: title, weight: String(WEIGHTS.new), pitch: '' }, fields);
    insert_(t, book);
  }
  return publicBook_(book);
}

/* ───────── organizer actions ───────── */
function adminState_() {
  return {
    books: table_('Books').rows.map(clean_),
    months: table_('Months').rows.map(clean_),
    notes: table_('Notes').rows.map(clean_),
    settings: { includeMentions: truthy_(settings_().includeMentions) },
    weights: WEIGHTS
  };
}

function updateBook_(p) {
  const t = table_('Books');
  const b = find_(t, p.id, 'book');
  const patch = p.patch || {};
  ['title', 'author', 'genres', 'pitch', 'why', 'suggestedBy'].forEach(function (k) {
    if (patch[k] != null) b[k] = clip_(patch[k], k === 'pitch' || k === 'why' ? 600 : 200);
  });
  if (patch.tier != null) {
    if (WEIGHTS[patch.tier] == null) throw new Error('Unknown tier.');
    b.tier = patch.tier;
    if (patch.weight == null) b.weight = String(WEIGHTS[patch.tier]);
  }
  if (patch.weight != null) {
    const w = Number(patch.weight);
    if (!(w >= 0 && w <= 1000)) throw new Error('Weight should be a number from 0 to 1000.');
    b.weight = String(w);
  }
  if (patch.status != null) {
    if (['pool', 'removed'].indexOf(patch.status) === -1) throw new Error('Unknown status.');
    if (['pool', 'removed'].indexOf(b.status) === -1) throw new Error('That book has already been picked.');
    b.status = patch.status;
  }
  save_(t, b);
  return clean_(b);
}

function startMonth_(p) {
  const books = table_('Books'), months = table_('Months');
  const b = find_(books, p.bookId, 'book');
  if (b.status !== 'pool') throw new Error(b.title + ' isn’t in the Snowbank right now.');
  months.rows.filter(function (m) { return m.status === 'current'; }).forEach(function (m) {
    m.status = 'closed'; m.closedAt = now_(); save_(months, m);
    const old = books.rows.filter(function (x) { return x.id === m.bookId; })[0];
    if (old) { old.status = 'read'; save_(books, old); }
  });
  const m = {
    id: uid_('m_'), bookId: b.id, label: clip_(p.label, 60) || defaultLabel_(),
    meetingDate: clip_(p.meetingDate, 30), status: 'current', groupRating: '', verdict: '',
    startedAt: now_(), closedAt: ''
  };
  insert_(months, m);
  b.status = 'current'; save_(books, b);
  return clean_(m);
}

function cancelMonth_(p) {
  const months = table_('Months');
  const m = find_(months, p.id, 'month');
  if (m.status !== 'current') throw new Error('Only the current month can be undone.');
  if (table_('Notes').rows.some(function (n) { return n.monthId === m.id; })) {
    throw new Error('People have already left notes on this one. Close it out instead.');
  }
  const books = table_('Books');
  const b = books.rows.filter(function (x) { return x.id === m.bookId; })[0];
  if (b) { b.status = 'pool'; save_(books, b); }
  months.sh.deleteRow(m._row);
  return true;
}

function updateMonth_(p) {
  const t = table_('Months');
  const m = find_(t, p.id, 'month');
  const patch = p.patch || {};
  if (patch.label != null) m.label = clip_(patch.label, 60);
  if (patch.meetingDate != null) m.meetingDate = clip_(patch.meetingDate, 30);
  if (patch.verdict != null) m.verdict = clip_(patch.verdict, 600);
  if (patch.groupRating != null) m.groupRating = rating_(patch.groupRating);
  save_(t, m);
  return clean_(m);
}

function closeMonth_(p) {
  const t = table_('Months');
  const m = find_(t, p.id, 'month');
  m.groupRating = rating_(p.groupRating);
  m.verdict = clip_(p.verdict, 600);
  if (m.status !== 'closed') { m.status = 'closed'; m.closedAt = now_(); }
  save_(t, m);
  const books = table_('Books');
  const b = books.rows.filter(function (x) { return x.id === m.bookId; })[0];
  if (b && b.status !== 'read') { b.status = 'read'; save_(books, b); }
  return clean_(m);
}

function hideNote_(p) {
  const t = table_('Notes');
  const n = find_(t, p.id, 'note');
  n.hidden = truthy_(p.hidden) ? 'true' : 'false';
  save_(t, n);
  return clean_(n);
}

function setSetting_(p) {
  if (['includeMentions'].indexOf(p.key) === -1) throw new Error('Unknown setting.');
  const t = table_('Settings');
  const row = t.rows.filter(function (r) { return r.key === p.key; })[0];
  if (row) { row.value = String(p.value); save_(t, row); }
  else insert_(t, { key: p.key, value: String(p.value) });
  return true;
}

function seed_(p) {
  const t = table_('Books');
  if (t.rows.length) throw new Error('The Books tab already has books in it.');
  const list = Array.isArray(p.books) ? p.books.slice(0, 500) : [];
  const objs = list.map(function (b) {
    const tier = WEIGHTS[b.tier] != null ? b.tier : 'new';
    const w = Number(b.weight);
    return {
      id: uid_('b_'), title: clip_(b.title, 200), author: clip_(b.author, 120), tier: tier,
      weight: String(w >= 0 ? w : WEIGHTS[tier]), status: 'pool',
      source: ['seed', 'mention', 'suggestion'].indexOf(b.source) > -1 ? b.source : 'seed',
      genres: clip_(b.genres, 120), pitch: clip_(b.pitch, 600),
      suggestedBy: clip_(b.suggestedBy, 60), why: clip_(b.why, 600), addedAt: now_()
    };
  }).filter(function (b) { return b.title; });
  insertMany_(t, objs);
  return objs.length;
}
