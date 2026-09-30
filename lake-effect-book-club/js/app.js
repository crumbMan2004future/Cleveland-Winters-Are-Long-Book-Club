(function () {
  'use strict';

  const CFG = window.CLUB_CONFIG || {};
  const store = window.createStore(CFG);
  const U = window.lebcUtil;
  const PROGRESS = window.PROGRESS;
  const TIER_LABELS = window.TIER_LABELS;
  const PASS_KEY = 'lebc-organizer';
  const NAME_KEY = 'lebc-name';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const S = {
    data: null, adminData: null, pass: null,
    filter: 'All', draw: null, spinning: false, rating: 0, adminTab: 'month'
  };

  /* ───────── tiny helpers ───────── */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const store_ = (kind) => ({
    get(k) { try { return window[kind].getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window[kind].setItem(k, v); } catch (e) { /* ignore */ } },
    del(k) { try { window[kind].removeItem(k); } catch (e) { /* ignore */ } }
  });
  const session = store_('sessionStorage');
  const local = store_('localStorage');
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const splitGenres = (g) => String(g || '').split(',').map((s) => s.trim()).filter(Boolean);
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ───────── dates ───────── */
  function parseDay(s) {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
    return isNaN(d) ? null : d;
  }
  function daysUntil(s) {
    const d = parseDay(s); if (!d) return null;
    const t = new Date(); t.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 864e5);
  }
  const fmtDay = (s) => { const d = parseDay(s); return d ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''; };
  const isoDay = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function defaultMeeting() { const d = new Date(); d.setDate(d.getDate() + (Number(CFG.daysBetweenGatherings) || 35)); return isoDay(d); }
  function defaultLabel() { const d = new Date(); if (d.getDate() > 20) d.setMonth(d.getMonth() + 1, 1); return U.monthLabel(d); }
  function ago(iso) {
    const t = Date.parse(iso); if (isNaN(t)) return '';
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return plural(Math.floor(s / 3600), 'hour ago', 'hours ago');
    const d = Math.floor(s / 86400);
    if (d === 1) return 'yesterday';
    if (d < 14) return d + ' days ago';
    return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function meetingLine(m) {
    if (!m || !m.meetingDate) return 'Next gathering date to be announced.';
    const n = daysUntil(m.meetingDate); const day = fmtDay(m.meetingDate);
    if (n == null) return 'Next gathering: ' + m.meetingDate + '.';
    if (n > 1) return 'We meet ' + day + ', ' + n + ' days from now.';
    if (n === 1) return 'We meet tomorrow, ' + day + '.';
    if (n === 0) return 'We meet tonight.';
    return 'We met ' + day + '.';
  }

  /* ───────── data helpers ───────── */
  const current = () => S.data && S.data.months.find((m) => m.status === 'current');
  const bookById = (id) => (S.data && S.data.books.find((b) => b.id === id)) || (S.adminData && S.adminData.books.find((b) => b.id === id)) || null;
  const notesFor = (monthId) => S.data.notes.filter((n) => n.monthId === monthId).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  const poolBooks = () => S.data.books.filter((b) => b.status === 'pool' && b.source !== 'mention');
  const candidates = () => S.data.books.filter((b) => b.status === 'pool' && (b.source !== 'mention' || S.data.settings.includeMentions));
  function avgRating(notes) {
    const r = notes.map((n) => Number(n.rating)).filter(Boolean);
    return r.length ? { avg: r.reduce((a, b) => a + b, 0) / r.length, n: r.length } : null;
  }
  const fmtRating = (r) => String(Number(r)).replace(/\.0$/, '');

  /* ───────── visual bits ───────── */
  const PALETTES = [
    ['#16344c', '#e6eef3', '#ffb547'],
    ['#3e6680', '#f2f6f8', '#ffd690'],
    ['#0e2233', '#d5e3ec', '#7fb2d4'],
    ['#6a3b2e', '#f4e9e1', '#ffb547'],
    ['#28443e', '#e5efea', '#a8d0b4'],
    ['#3b3a57', '#eceaf5', '#e9a6a0'],
    ['#d5e3ec', '#16344c', '#3e6680'],
    ['#8a5a1e', '#fbf1e0', '#ffe7b8']
  ];
  function cover(b, size) {
    const t = String(b.title || 'Untitled');
    const h = hash(t + '|' + (b.author || ''));
    const p = PALETTES[h % PALETTES.length];
    const v = (h >>> 5) % 4;
    const len = t.length > 42 ? ' is-xlong' : t.length > 22 ? ' is-long' : '';
    const author = size !== 'sm' && b.author ? '<span class="cover-author">' + esc(b.author) + '</span>' : '';
    return '<span class="cover cover--' + size + ' v' + v + len + '" style="--bg:' + p[0] + ';--fg:' + p[1] + ';--ac:' + p[2] + '" aria-hidden="true">' +
      '<span class="cover-title">' + esc(t) + '</span>' + author + '</span>';
  }
  const FLAKE = '<svg class="i-flake" aria-hidden="true"><use href="#i-flake"/></svg>';
  function flakes(r) {
    const v = Math.max(0, Math.min(5, Number(r) || 0));
    const row = FLAKE.repeat(5);
    return '<span class="flakes" role="img" aria-label="' + fmtRating(v) + ' out of 5"><span class="flakes-row">' + row +
      '</span><span class="flakes-row flakes-fill" style="width:' + (v / 5 * 100) + '%">' + row + '</span></span>';
  }

  /* ───────── toast ───────── */
  let toastTimer;
  function toast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast is-on' + (isErr ? ' is-err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, isErr ? 6500 : 3200);
  }

  /* ═══════════ RENDER ═══════════ */
  function renderAll() {
    renderNow(); renderNotes(); renderBank(); renderShelf(); renderFreeze();
    renderDraw(); renderDrawer();
  }

  function renderNow() {
    const el = $('#nowPanel');
    const m = current();
    el.classList.toggle('is-empty', !m);
    if (!m) {
      const last = S.data.months.filter((x) => x.status === 'closed').sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1))[0];
      const lb = last && bookById(last.bookId);
      el.innerHTML = '<div class="now-empty">' +
        '<p class="now-kicker">Between books</p>' +
        '<p class="now-empty-text">Nothing on the nightstand yet. Shake the globe to see what we might read next.</p>' +
        (lb ? '<p class="now-meet">Last up: <a class="now-link" href="#freeze">' + esc(lb.title) + '</a></p>' : '') +
        '</div>';
      return;
    }
    const b = bookById(m.bookId) || { title: 'Unknown book', author: '' };
    const count = S.data.notes.filter((n) => n.monthId === m.id).length;
    el.innerHTML = cover(b, 'md') +
      '<div class="now-body">' +
      '<p class="now-kicker">Now reading for ' + esc(m.label) + '</p>' +
      '<h2 class="now-title">' + esc(b.title) + '</h2>' +
      (b.author ? '<p class="now-author">' + esc(b.author) + '</p>' : '') +
      '<p class="now-meet">' + esc(meetingLine(m)) + '</p>' +
      '<a class="now-link" href="#notes">' + (count ? 'Read the ' + plural(count, 'note', 'notes') + ' so far' : 'Leave the first note') + '</a>' +
      '</div>';
  }

  const PROG_PCT = { start: 6, q1: 25, half: 50, q3: 75, done: 100, dnf: 45 };
  function noteHTML(n) {
    const spoiler = U.truthy(n.spoiler);
    const pct = PROG_PCT[n.progress];
    const meta = [n.progress ? PROGRESS[n.progress] : '', ago(n.createdAt)].filter(Boolean).join(', ');
    const gaugeCls = n.progress === 'done' ? ' is-done' : n.progress === 'dnf' ? ' is-dnf' : '';
    return '<article class="note' + (spoiler ? ' is-spoiler' : '') + '" data-id="' + esc(n.id) + '">' +
      (pct ? '<span class="gauge' + gaugeCls + '" title="' + esc(PROGRESS[n.progress]) + '"><i style="height:' + pct + '%"></i></span>' : '') +
      '<div class="note-text">' + esc(n.text) + '</div>' +
      (spoiler ? '<button class="spoiler-cover" type="button" data-act="reveal">Spoiler. Tap to read it.</button>' : '') +
      '<footer class="note-foot"><span class="note-who"><strong>' + esc(n.name || 'Anonymous') + '</strong><span>' + esc(meta) + '</span></span>' +
      (n.rating ? flakes(n.rating) : '') +
      (S.pass ? '<button class="linkish note-hide" type="button" data-act="hide-note" data-id="' + esc(n.id) + '">Hide</button>' : '') +
      '</footer></article>';
  }

  function renderNotes() {
    const m = current();
    $('#notes').hidden = !m;
    $('#navNotes').hidden = !m;
    if (!m) return;
    const b = bookById(m.bookId) || { title: 'this month’s book' };
    $('#notesHeading').textContent = 'Notes on ' + b.title;
    const list = notesFor(m.id);
    $('#feed').innerHTML = list.length ? list.map(noteHTML).join('') : '<p class="feed-empty">No notes yet. The first one sets the tone.</p>';
  }

  function renderBank() {
    const pool = poolBooks();
    const counts = {};
    pool.forEach((b) => splitGenres(b.genres).forEach((g) => { counts[g] = (counts[g] || 0) + 1; }));
    const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b)).slice(0, 12);
    if (S.filter !== 'All' && !counts[S.filter]) S.filter = 'All';
    $('#genreChips').innerHTML = ['All'].concat(top).map((g) =>
      '<button type="button" class="chip" data-genre="' + esc(g) + '" aria-pressed="' + (S.filter === g) + '">' + esc(g) +
      ' <span>' + (g === 'All' ? pool.length : counts[g]) + '</span></button>').join('');
    const shown = S.filter === 'All' ? pool : pool.filter((b) => splitGenres(b.genres).includes(S.filter));
    $('#bankList').innerHTML = shown.length ? shown.map(bankItem).join('')
      : '<li class="bank-empty">The Snowbank is empty. Suggest the first book.</li>';

    const all = new Set(Object.keys(counts));
    (CFG.genres || []).forEach((g) => all.add(g[0]));
    $('#genreOptions').innerHTML = Array.from(all).sort().map((g) => '<option value="' + esc(g) + '">').join('');
  }
  function bankItem(b) {
    const added = Date.parse(b.addedAt);
    const fresh = b.source === 'suggestion' && !isNaN(added) && Date.now() - added < 35 * 864e5;
    const who = b.suggestedBy ? 'Suggested by ' + esc(b.suggestedBy) : (b.source === 'suggestion' ? 'Suggested anonymously' : '');
    return '<li class="bank-item">' + cover(b, 'sm') +
      '<div><h3 class="bank-title">' + esc(b.title) + (fresh ? ' <span class="fresh">new</span>' : '') + '</h3>' +
      (b.author ? '<p class="bank-author">' + esc(b.author) + '</p>' : '') +
      (b.pitch ? '<p class="bank-pitch">' + esc(b.pitch) + '</p>' : '') +
      (b.why ? '<p class="bank-why">“' + esc(b.why) + '”</p>' : '') +
      '<p class="bank-meta">' + (b.genres ? '<span>' + esc(splitGenres(b.genres).join(', ')) + '</span>' : '') + (who ? '<span>' + who + '</span>' : '') + '</p>' +
      '</div></li>';
  }

  function renderShelf() {
    const list = S.data.books.filter((b) => b.source === 'mention');
    $('#stuck').hidden = !list.length;
    if (!list.length) return;
    $('#stuckIntro').textContent = 'The books members said left a mark on them.' +
      (S.data.settings.includeMentions ? ' They’re swirling around in the globe too.' : '');
    $('#shelf').innerHTML = list.map((b) => {
      const h = hash(b.title);
      const p = PALETTES[h % PALETTES.length];
      return '<button type="button" class="spine" data-id="' + esc(b.id) + '" aria-pressed="false" style="--bg:' + p[0] + ';--fg:' + p[1] +
        ';--h:' + (150 + (h % 6) * 11) + 'px;--w:' + (34 + ((h >>> 4) % 4) * 6) + 'px"><span>' + esc(b.title) + '</span></button>';
    }).join('');
  }

  function renderTastes() {
    $('#tasteList').innerHTML = (CFG.genres || []).map((g) =>
      '<li><span>' + esc(g[0]) + '</span><span class="taste-count" role="img" aria-label="' + plural(g[1], 'member', 'members') + '">' +
      FLAKE.repeat(Math.max(1, Math.min(8, g[1]))) + '</span></li>').join('');
  }

  function renderFreeze() {
    const closed = S.data.months.filter((m) => m.status === 'closed').sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1));
    const el = $('#timeline');
    if (!closed.length) {
      el.innerHTML = '<li class="freeze-empty">Nothing on ice yet. After the first gathering, the organizer gives the book a group rating and it lands here with all its notes.</li>';
      return;
    }
    el.innerHTML = closed.map((m) => {
      const b = bookById(m.bookId) || { title: 'Unknown book', author: '' };
      const notes = notesFor(m.id);
      const avg = avgRating(notes);
      return '<li class="frozen"><p class="frozen-when">' + esc(m.label) + '</p>' +
        '<div class="frozen-card">' + cover(b, 'sm') +
        '<div class="frozen-body"><h3>' + esc(b.title) + '</h3>' +
        (b.author ? '<p class="frozen-author">' + esc(b.author) + '</p>' : '') +
        '<div class="frozen-rating">' + (m.groupRating
          ? flakes(m.groupRating) + '<span>Group rating: ' + esc(fmtRating(m.groupRating)) + ' out of 5</span>'
          : '<span class="muted">No group rating yet</span>') + '</div>' +
        (m.verdict ? '<blockquote class="verdict">' + esc(m.verdict) + '</blockquote>' : '') +
        (avg ? '<p class="frozen-avg">Ratings left while reading averaged ' + avg.avg.toFixed(1) + ' across ' + plural(avg.n, 'note', 'notes') + '.</p>' : '') +
        (notes.length
          ? '<details class="frozen-notes"><summary>Read the ' + plural(notes.length, 'note', 'notes') + '</summary><div class="feed">' + notes.map(noteHTML).join('') + '</div></details>'
          : '<p class="frozen-avg">No notes were left for this one.</p>') +
        '</div></div></li>';
    }).join('');
  }

  /* ═══════════ SNOW GLOBE ═══════════ */
  // Skyline inside the globe, drawn on a 400×400 grid.
  function cityscape() {
    const r = rng(1796); // the year Cleveland was founded
    const front = '#0d2638', back = '#1c4661', lit = '#ffcf80', cool = '#bcd6e8', snow = '#eef4f8';
    let win = '';
    function windows(x1, y1, x2, y2) {
      for (let y = y1 + 5; y < Math.min(y2, 335); y += 7) {
        for (let x = x1 + 3; x < x2 - 3; x += 5) {
          const q = r();
          if (q < 0.2) win += '<rect x="' + x + '" y="' + y + '" width="2" height="3" fill="' + lit + '" opacity="' + (0.55 + r() * 0.45).toFixed(2) + '"/>';
          else if (q < 0.26) win += '<rect x="' + x + '" y="' + y + '" width="2" height="3" fill="' + cool + '" opacity=".5"/>';
        }
      }
    }
    const blocks = [[104, 300, 24], [124, 282, 18], [244, 256, 22], [264, 276, 28], [340, 302, 22]];
    let shapes = '', caps = '';
    blocks.forEach(([x, y, w]) => {
      shapes += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (345 - y) + '"/>';
      caps += '<rect x="' + (x - 1) + '" y="' + (y - 2) + '" width="' + (w + 2) + '" height="3" rx="1.5"/>';
      windows(x, y, x + w, 345);
    });
    // Terminal Tower
    shapes += '<path d="M142 345V238h5v-20h5v-20h3v-10l5-10 5 10v10h3v20h5v20h5v107z"/><rect x="159.4" y="164" width="1.2" height="16"/>';
    caps += '<rect x="141" y="236" width="38" height="3" rx="1.5"/><rect x="146" y="216" width="28" height="3" rx="1.5"/><rect x="151" y="196" width="18" height="3" rx="1.5"/>';
    windows(142, 238, 178, 345); windows(147, 218, 173, 238); windows(152, 198, 168, 218);
    // 200 Public Square
    shapes += '<path d="M182 345V226l12-8 12 8v119z"/>';
    windows(182, 226, 206, 345);
    // Key Tower
    shapes += '<path d="M212 345V196h3v-8l11-20 11 20v8h3v149z"/><rect x="225.4" y="148" width="1.2" height="22"/>';
    caps += '<rect x="211" y="194" width="30" height="3" rx="1.5"/>';
    windows(212, 196, 240, 345);
    // Lighthouse on the breakwall
    const lighthouse =
      '<rect x="0" y="322" width="112" height="30" fill="#2a5470"/>' +
      '<rect x="36" y="316" width="62" height="10" fill="' + front + '"/>' +
      '<circle cx="64" cy="271" r="16" fill="' + lit + '" opacity=".22"/>' +
      '<path d="M56 318l3-38h10l3 38z" fill="' + front + '"/>' +
      '<rect x="55" y="277" width="18" height="3" fill="' + front + '"/>' +
      '<rect x="58" y="266" width="12" height="11" fill="' + lit + '"/>' +
      '<path d="M56 266l8-9 8 9z" fill="' + front + '"/>' +
      '<path d="M56 266l8-9 8 9z" fill="' + snow + '" opacity=".85" transform="translate(0 -1) scale(1 .45)" transform-origin="64 257"/>';
    // Rock Hall-style glass pyramid
    const pyramid = '<path d="M294 345l30-50 30 50z" fill="#2c5f7e"/><path d="M324 295v50M309 320h30M301 334h46" stroke="#4d86a8" stroke-width="1" fill="none"/>';
    const backLayer = [[96, 292, 30], [128, 272, 22], [150, 252, 18], [200, 244, 14], [246, 240, 18], [266, 262, 26], [300, 286, 36], [352, 292, 26]]
      .map(([x, y, w]) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (345 - y) + '"/>').join('');
    let stars = '';
    for (let i = 0; i < 26; i++) {
      const x = 60 + r() * 280, y = 40 + r() * 150;
      stars += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (0.5 + r() * 0.8).toFixed(2) + '" fill="#fff" opacity="' + (0.2 + r() * 0.4).toFixed(2) + '"/>';
    }
    return '<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><radialGradient id="glow" cx="50%" cy="100%" r="60%"><stop offset="0" stop-color="#ffb547" stop-opacity=".28"/><stop offset="1" stop-color="#ffb547" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="drift" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f8fb"/><stop offset="1" stop-color="#bcd1df"/></linearGradient></defs>' +
      stars +
      '<rect x="0" y="200" width="400" height="200" fill="url(#glow)"/>' +
      '<g fill="' + back + '">' + backLayer + '</g>' +
      lighthouse + pyramid +
      '<g fill="' + front + '">' + shapes + '</g>' + win +
      '<g fill="' + snow + '" opacity=".9">' + caps + '</g>' +
      '<ellipse cx="200" cy="392" rx="250" ry="66" fill="url(#drift)"/>' +
      '<ellipse cx="120" cy="400" rx="150" ry="52" fill="#fff" opacity=".35"/>' +
      '</svg>';
  }

  const G = { parts: [], w: 0, h: 0, ctx: null, energy: 0, running: false };
  function surfaceY(x) { // top of the snow drift, matching the ellipse in cityscape()
    const s = G.w / 400;
    const X = x / s;
    const k = Math.max(0, 1 - Math.pow((X - 200) / 250, 2));
    return (392 - 66 * Math.sqrt(k)) * s;
  }
  function spawn() {
    const cx = G.w / 2, cy = G.h / 2, R = G.w / 2 - 6;
    let x, y;
    do { x = Math.random() * G.w; y = Math.random() * G.h * 0.8; } while (Math.hypot(x - cx, y - cy) > R);
    return { x, y, r: 0.8 + Math.random() * 1.8, vx: 0, vy: 0.1 + Math.random() * 0.3, off: Math.random() * 4, ph: Math.random() * 6.28, rest: false };
  }
  function sizeGlobe() {
    const cv = $('#globeCanvas');
    const rect = cv.getBoundingClientRect();
    if (!rect.width) return;
    const old = G.w;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    G.w = rect.width; G.h = rect.height;
    cv.width = Math.round(G.w * dpr); cv.height = Math.round(G.h * dpr);
    G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (old && old !== G.w) { const k = G.w / old; G.parts.forEach((p) => { p.x *= k; p.y *= k; }); }
    drawFlakes();
  }
  function drawFlakes() {
    const c = G.ctx; if (!c) return;
    c.clearRect(0, 0, G.w, G.h);
    c.fillStyle = 'rgba(255,255,255,.92)';
    c.beginPath();
    for (const p of G.parts) { c.moveTo(p.x + p.r, p.y); c.arc(p.x, p.y, p.r, 0, 6.2832); }
    c.fill();
  }
  function tick(t) {
    const cx = G.w / 2, cy = G.h / 2, R = G.w / 2 - 3;
    G.energy *= 0.968;
    let moving = 0;
    for (const p of G.parts) {
      if (p.rest) continue;
      moving++;
      if (G.energy > 0.02) {
        const dx = p.x - cx, dy = p.y - cy;
        p.vx += (-dy * 0.0028 + (Math.random() - 0.5) * 1.1) * G.energy;
        p.vy += (dx * 0.0028 + (Math.random() - 0.5) * 1.1) * G.energy;
      }
      p.vy += 0.006;
      p.vx *= 0.96; p.vy *= 0.96;
      const vmax = 0.42 + 6 * G.energy;
      if (p.vy > vmax) p.vy = vmax;
      p.x += p.vx + Math.sin(t / 900 + p.ph) * 0.12;
      p.y += p.vy;
      const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
      if (d > R - p.r) { const k = (R - p.r) / d; p.x = cx + dx * k; p.y = cy + dy * k; p.vx *= -0.4; p.vy *= -0.4; }
      const gy = surfaceY(p.x) - p.off;
      if (p.y >= gy && G.energy < 0.2) { p.y = gy; p.vx = 0; p.vy = 0; p.rest = true; }
    }
    drawFlakes();
    if (moving || G.energy > 0.01) requestAnimationFrame(tick); else G.running = false;
  }
  function run() { if (!G.running && !reduceMotion) { G.running = true; requestAnimationFrame(tick); } }
  function burst(power) {
    if (reduceMotion) return;
    G.energy = Math.max(G.energy, power);
    for (const p of G.parts) { p.rest = false; p.vx += (Math.random() - 0.5) * 9 * power; p.vy -= (Math.random() * 6 + 2) * power; }
    run();
  }
  function setupGlobe() {
    $('#globeCity').innerHTML = cityscape();
    G.ctx = $('#globeCanvas').getContext('2d');
    sizeGlobe();
    const n = G.w < 340 ? 120 : 170;
    for (let i = 0; i < n; i++) G.parts.push(spawn());
    if (reduceMotion) { G.parts.forEach((p) => { p.y = surfaceY(p.x) - p.off; p.rest = true; }); drawFlakes(); }
    else run();
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(sizeGlobe, 120); });
  }

  async function shake() {
    if (S.spinning || !S.data) return;
    const pool = candidates();
    if (!pool.length) { toast('The Snowbank is empty. Suggest a book first.', true); return; }
    S.spinning = true;
    const btn = $('#shakeBtn'); btn.disabled = true; btn.textContent = 'Shaking…';
    const wrap = $('#globeWrap'), title = $('#globeTitle');
    $('#drawResult').hidden = true;

    let result = null, error = null;
    const req = store.call('draw').then((r) => { result = r; }, (e) => { error = e; });
    if (!reduceMotion) { wrap.classList.remove('is-shaking'); void wrap.offsetWidth; wrap.classList.add('is-shaking'); burst(1); }

    const order = shuffle(pool.map((b) => b.title));
    const start = performance.now();
    const DUR = reduceMotion ? 400 : 2700;
    let i = 0;
    for (;;) {
      const el = performance.now() - start;
      if (el >= DUR && (result || error)) break;
      title.className = 'globe-title is-cycling';
      title.textContent = reduceMotion ? 'Picking…' : order[i++ % order.length];
      const k = Math.min(1, el / DUR);
      await sleep(el < DUR ? 45 + 280 * k * k * k : 180);
      if (!reduceMotion && el > 1500 && el < DUR - 500 && Math.random() < 0.2) burst(0.3);
    }
    await req;
    wrap.classList.remove('is-shaking');
    S.spinning = false; btn.disabled = false; btn.textContent = 'Shake it again';
    if (error) { title.className = 'globe-title'; title.textContent = ''; toast(error.message, true); return; }
    S.draw = result;
    title.className = 'globe-title is-landed';
    title.textContent = result.title;
    renderDraw();
  }

  function renderDraw() {
    const el = $('#drawResult');
    const b = S.draw;
    if (!b) { el.hidden = true; return; }
    const cur = current();
    const curBook = cur && bookById(cur.bookId);
    let admin = '<p class="draw-note">Just a practice shake. Only the organizer can make a pick official.</p>';
    if (S.pass) {
      admin = '<form class="official" data-form="official" data-id="' + esc(b.id) + '">' +
        '<div class="official-row">' +
        '<label class="field field--dark"><span>Month</span><input name="label" maxlength="60" required value="' + esc(defaultLabel()) + '"></label>' +
        '<label class="field field--dark"><span>Next gathering</span><input type="date" name="meetingDate" value="' + defaultMeeting() + '"></label>' +
        '</div>' +
        (cur ? '<p class="draw-note">This moves ' + esc(curBook ? curBook.title : 'the current book') + ' into the Deep Freeze. You can still rate it there.</p>' : '') +
        '<button class="btn btn-sodium" type="submit">Make it our pick</button></form>';
    }
    el.innerHTML = cover(b, 'sm') + '<div>' +
      '<p class="draw-kicker">The globe picked</p>' +
      '<h3 class="draw-title">' + esc(b.title) + '</h3>' +
      (b.author ? '<p class="draw-author">' + esc(b.author) + '</p>' : '') +
      (b.pitch || b.why ? '<p class="draw-pitch">' + esc(b.pitch || b.why) + '</p>' : '') +
      (b.suggestedBy ? '<p class="draw-who">Suggested by ' + esc(b.suggestedBy) + '</p>' : '') +
      admin + '</div>';
    el.hidden = false;
  }

  /* ═══════════ FORMS ═══════════ */
  function buildRatePicker() {
    const el = $('#ratePicker');
    el.innerHTML = [1, 2, 3, 4, 5].map((n) =>
      '<button type="button" data-rate="' + n + '" aria-label="' + plural(n, 'flake', 'flakes') + '" aria-pressed="false">' +
      '<svg aria-hidden="true"><use href="#i-flake"/></svg></button>').join('');
  }
  function setRating(n) {
    S.rating = n;
    $$('#ratePicker button').forEach((b) => {
      const v = Number(b.dataset.rate);
      b.classList.toggle('is-on', v <= n);
      b.setAttribute('aria-pressed', String(v === n));
    });
  }

  async function onNote(f) {
    const m = current(); if (!m) return;
    const els = f.elements;
    const text = els.text.value.trim();
    if (!text) { els.text.focus(); toast('Write something first.', true); return; }
    const btn = f.querySelector('[type="submit"]'); btn.disabled = true;
    try {
      const name = els.name.value.trim();
      const n = await store.call('addNote', {
        monthId: m.id, text, name, progress: els.progress.value, spoiler: els.spoiler.checked, rating: S.rating || ''
      });
      if (name) local.set(NAME_KEY, name);
      S.data.notes.push(n);
      els.text.value = ''; els.spoiler.checked = false; setRating(0);
      renderNotes(); renderNow();
      toast('Note posted.');
    } catch (e) { toast(e.message, true); } finally { btn.disabled = false; }
  }

  async function onSuggest(f) {
    const els = f.elements;
    const data = {
      title: els.title.value.trim(), author: els.author.value.trim(), genres: els.genres.value.trim(),
      why: els.why.value.trim(), suggestedBy: els.suggestedBy.value.trim()
    };
    if (!data.title) { els.title.focus(); toast('Every book needs a title.', true); return; }
    const btn = f.querySelector('[type="submit"]'); btn.disabled = true;
    try {
      const b = await store.call('addSuggestion', data);
      const i = S.data.books.findIndex((x) => x.id === b.id);
      if (i > -1) S.data.books[i] = b; else S.data.books.push(b);
      S.data.books.sort(U.byTitle);
      if (data.suggestedBy) local.set(NAME_KEY, data.suggestedBy);
      ['title', 'author', 'genres', 'why'].forEach((k) => { els[k].value = ''; });
      S.filter = 'All';
      renderBank(); renderShelf();
      toast('Added ' + b.title + ' to the Snowbank.');
      if (S.pass) reloadAdmin();
    } catch (e) { toast(e.message, true); } finally { btn.disabled = false; }
  }

  /* ═══════════ ORGANIZER ═══════════ */
  async function refresh() {
    try {
      S.data = await store.call('state');
      renderAll();
    } catch (e) {
      $('#nowPanel').classList.add('is-empty');
      $('#nowPanel').innerHTML = '<div class="now-empty"><p class="now-kicker">Can’t reach the club sheet</p>' +
        '<p class="now-empty-text">' + esc(e.message) + ' Check the web app URL in js/config.js and that the deployment is shared with “Anyone”.</p>' +
        '<button class="btn btn-line btn-small" type="button" data-act="retry">Try again</button></div>';
      $('#bankList').innerHTML = '<li class="bank-empty">The Snowbank couldn’t load.</li>';
    }
  }
  async function reloadAdmin() {
    if (!S.pass) return;
    try { S.adminData = await store.call('adminState', { pass: S.pass }); renderDrawer(); }
    catch (e) { toast(e.message, true); }
  }
  async function reloadAll() {
    const res = await Promise.all([store.call('state'), S.pass ? store.call('adminState', { pass: S.pass }) : null]);
    S.data = res[0]; S.adminData = res[1];
    renderAll();
  }
  async function adm(action, payload, okMsg) {
    try {
      const r = await store.call(action, Object.assign({ pass: S.pass }, payload || {}));
      await reloadAll();
      if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg);
      return r;
    } catch (e) { toast(e.message, true); throw e; }
  }
  async function login(pass, quiet) {
    await store.call('verify', { pass });
    S.pass = pass;
    session.set(PASS_KEY, pass);
    S.adminData = await store.call('adminState', { pass });
    renderAll();
    if (!quiet) toast('Signed in as organizer.');
  }
  function signOut() {
    S.pass = null; S.adminData = null; session.del(PASS_KEY);
    renderAll(); toast('Signed out.');
  }

  function openDrawer() {
    $('#drawer').hidden = false; $('#scrim').hidden = false;
    document.body.classList.add('drawer-open');
    renderDrawer();
    setTimeout(() => { const f = $('#drawerBody input, #drawerBody select, #drawerBody button'); if (f) f.focus(); }, 40);
  }
  function closeDrawer() {
    $('#drawer').hidden = true; $('#scrim').hidden = true;
    document.body.classList.remove('drawer-open');
    $('#organizerBtn').focus();
  }

  function renderDrawer() {
    if ($('#drawer').hidden) return;
    const body = $('#drawerBody');
    if (!S.pass) {
      body.innerHTML = '<form class="login" data-form="login">' +
        '<p>Sign in to make picks official, close out months, and look after the Snowbank.</p>' +
        '<label class="field"><span>Passphrase</span><input type="password" name="pass" autocomplete="current-password" required></label>' +
        '<button class="btn btn-sodium" type="submit">Sign in</button>' +
        (store.mode === 'demo' ? '<p class="hint">Demo mode passphrase: <code>' + esc(CFG.demoPassphrase || 'lakeeffect') + '</code></p>' : '') +
        '</form>';
      return;
    }
    if (!S.adminData) { body.innerHTML = '<p class="hint">Loading…</p>'; return; }
    const tabs = [['month', 'This month'], ['pool', 'Snowbank & odds'], ['freeze', 'Deep Freeze'], ['notes', 'Notes'], ['setup', 'Setup']];
    const scroll = body.scrollTop;
    body.innerHTML = '<div class="tabs" role="tablist">' + tabs.map((t) =>
      '<button type="button" role="tab" class="tab" data-tab="' + t[0] + '" aria-selected="' + (S.adminTab === t[0]) + '">' + t[1] + '</button>').join('') +
      '</div><div role="tabpanel">' + TABS[S.adminTab]() + '</div>';
    body.scrollTop = scroll;
  }

  const TABS = {
    month() {
      const A = S.adminData;
      const m = A.months.find((x) => x.status === 'current');
      if (!m) {
        const pool = A.books.filter((b) => b.status === 'pool').sort(U.byTitle);
        return '<div class="adm-card"><h3>No book this month</h3>' +
          '<p>Shake the globe and use “Make it our pick”, or choose a book directly.</p>' +
          '<form data-form="start">' +
          '<label class="field"><span>Book</span><select name="bookId">' + pool.map((b) =>
            '<option value="' + esc(b.id) + '">' + esc(b.title) + (b.author ? ', ' + esc(b.author) : '') + '</option>').join('') + '</select></label>' +
          '<label class="field"><span>Month</span><input name="label" maxlength="60" required value="' + esc(defaultLabel()) + '"></label>' +
          '<label class="field"><span>Next gathering</span><input type="date" name="meetingDate" value="' + defaultMeeting() + '"></label>' +
          '<button class="btn btn-sodium" type="submit">Start the month</button></form></div>';
      }
      const b = A.books.find((x) => x.id === m.bookId) || { title: 'Unknown book' };
      const notes = A.notes.filter((n) => n.monthId === m.id);
      const avg = avgRating(notes.filter((n) => !U.truthy(n.hidden)));
      return '<div class="adm-card"><h3>' + esc(b.title) + '</h3>' +
        '<form data-form="month-edit" data-id="' + esc(m.id) + '">' +
        '<label class="field"><span>Month</span><input name="label" maxlength="60" value="' + esc(m.label) + '"></label>' +
        '<label class="field"><span>Next gathering</span><input type="date" name="meetingDate" value="' + esc(m.meetingDate) + '"></label>' +
        '<button class="btn btn-line btn-small" type="submit">Save changes</button></form></div>' +
        '<div class="adm-card"><h3>Close out the month</h3>' +
        '<p>Once you’ve met, give it the group’s rating. The book and its ' + plural(notes.length, 'note', 'notes') + ' move to the Deep Freeze.' +
        (avg ? ' Ratings left while reading average <strong>' + avg.avg.toFixed(1) + '</strong> from ' + plural(avg.n, 'note', 'notes') + '.' : '') + '</p>' +
        '<form data-form="close" data-id="' + esc(m.id) + '">' +
        '<label class="field"><span>Group rating, 0.5 to 5</span><input type="number" name="groupRating" min="0.5" max="5" step="0.5" required value="' + (avg ? Math.round(avg.avg * 2) / 2 : '') + '"></label>' +
        '<label class="field"><span>The verdict <em>one line, optional</em></span><textarea name="verdict" rows="2" maxlength="600" placeholder="Slow start, devastating finish."></textarea></label>' +
        '<button class="btn btn-sodium" type="submit">Close out and move to the Deep Freeze</button></form></div>' +
        (notes.length ? '' : '<div class="adm-card"><h3>Picked the wrong book?</h3><p>Nobody has left a note yet, so you can undo this pick and put the book back in the Snowbank.</p>' +
          '<button class="btn btn-line btn-small" type="button" data-act="cancel-month" data-id="' + esc(m.id) + '">Undo this pick</button></div>');
    },

    pool() {
      const A = S.adminData;
      const inc = A.settings.includeMentions;
      const settings = { includeMentions: inc };
      const rows = A.books.filter((b) => b.status === 'pool' || b.status === 'removed');
      const total = rows.filter((b) => U.eligible(b, settings)).reduce((s, b) => s + Number(b.weight), 0);
      rows.sort((a, b) => (Number(U.eligible(b, settings)) - Number(U.eligible(a, settings))) || (Number(b.weight) - Number(a.weight)) || U.byTitle(a, b));
      return '<p class="adm-lede">Only you can see this. Odds are each book’s chance on a single shake. Changing the tier resets the weight to that tier’s default; you can then fine-tune the weight.</p>' +
        '<label class="check"><input type="checkbox" data-act="toggle-mentions"' + (inc ? ' checked' : '') + '><span>Put the “books that stuck with us” in the globe too</span></label>' +
        '<div class="table-wrap"><table class="odds"><thead><tr><th>Book</th><th>Tier</th><th>Weight</th><th>Odds</th><th>In globe</th></tr></thead><tbody>' +
        rows.map((b) => {
          const on = U.eligible(b, settings);
          const odds = on && total ? Number(b.weight) / total * 100 : 0;
          const known = TIER_LABELS[b.tier] != null;
          return '<tr class="' + (on ? '' : 'is-off') + '" data-id="' + esc(b.id) + '">' +
            '<td><strong>' + esc(b.title) + '</strong>' + (b.author ? '<span>' + esc(b.author) + '</span>' : '') + '</td>' +
            '<td><select data-edit="tier" aria-label="Tier for ' + esc(b.title) + '">' + (known ? '' : '<option value="" selected>Custom</option>') +
            Object.keys(TIER_LABELS).map((k) => '<option value="' + k + '"' + (b.tier === k ? ' selected' : '') + '>' + esc(TIER_LABELS[k]) + '</option>').join('') + '</select></td>' +
            '<td><input type="number" min="0" max="1000" step="0.5" value="' + esc(b.weight) + '" data-edit="weight" aria-label="Weight for ' + esc(b.title) + '"></td>' +
            '<td class="num">' + (on ? odds.toFixed(1) + '%' : 'none') + '</td>' +
            '<td><input type="checkbox" data-edit="status"' + (b.status === 'pool' ? ' checked' : '') + ' aria-label="' + esc(b.title) + ' is in the globe"></td></tr>';
        }).join('') + '</tbody></table></div>';
    },

    freeze() {
      const A = S.adminData;
      const closed = A.months.filter((m) => m.status === 'closed').sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1));
      if (!closed.length) return '<p class="adm-lede">Nothing in the Deep Freeze yet. Close out a month to add one.</p>';
      return '<p class="adm-lede">Fix a rating or verdict after the fact.</p>' + closed.map((m) => {
        const b = A.books.find((x) => x.id === m.bookId) || { title: 'Unknown book' };
        return '<div class="adm-card"><h3>' + esc(b.title) + '</h3>' +
          '<form data-form="freeze-edit" data-id="' + esc(m.id) + '">' +
          '<div class="field-row"><label class="field"><span>Month</span><input name="label" maxlength="60" value="' + esc(m.label) + '"></label>' +
          '<label class="field"><span>Group rating</span><input type="number" name="groupRating" min="0.5" max="5" step="0.5" value="' + esc(m.groupRating) + '"></label></div>' +
          '<label class="field"><span>Verdict</span><textarea name="verdict" rows="2" maxlength="600">' + esc(m.verdict) + '</textarea></label>' +
          '<button class="btn btn-line btn-small" type="submit">Save changes</button></form></div>';
      }).join('');
    },

    notes() {
      const A = S.adminData;
      const list = A.notes.slice().sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)).slice(0, 150);
      if (!list.length) return '<p class="adm-lede">No notes yet.</p>';
      return '<p class="adm-lede">Hidden notes disappear from the site but stay in the Sheet.</p><ul class="admin-notes">' + list.map((n) => {
        const b = A.books.find((x) => x.id === n.bookId);
        const hidden = U.truthy(n.hidden);
        const snippet = n.text.length > 160 ? n.text.slice(0, 160) + '…' : n.text;
        return '<li class="' + (hidden ? 'is-hidden' : '') + '"><div><small>' + esc(n.name || 'Anonymous') + ' on ' + esc(b ? b.title : 'unknown book') + ', ' + esc(ago(n.createdAt)) + '</small>' + esc(snippet) + '</div>' +
          '<button class="btn btn-line btn-small" type="button" data-act="toggle-note" data-id="' + esc(n.id) + '" data-hidden="' + (hidden ? 'false' : 'true') + '">' + (hidden ? 'Show' : 'Hide') + '</button></li>';
      }).join('') + '</ul>';
    },

    setup() {
      const A = S.adminData;
      const seedN = (window.SEED_BOOKS || []).length;
      let out = '<div class="adm-card"><h3>Where everything is saved</h3><p>' + (store.mode === 'live'
        ? 'In your Google Sheet. You can fix typos or change weights right in its Books tab too; reload the site to see changes.'
        : 'Demo mode: only in this browser. Add your Apps Script web app URL to js/config.js so the whole club shares one Snowbank.') + '</p></div>';
      if (!A.books.length) {
        out += seedN
          ? '<div class="adm-card"><h3>Load the starting list</h3><p>Adds the ' + seedN + ' books from the survey to the Snowbank, tiers and all.</p><button class="btn btn-sodium" type="button" data-act="seed">Load ' + seedN + ' books</button></div>'
          : '<div class="adm-card"><p>The Snowbank is empty and js/seed.js isn’t on the site. Add books with the suggestion form.</p></div>';
      }
      out += '<div class="adm-card"><h3>Back up</h3><p>Download every book, weight, month and note as a JSON file.</p><button class="btn btn-line btn-small" type="button" data-act="export">Download backup</button></div>';
      if (store.mode === 'demo') out += '<div class="adm-card"><h3>Reset the demo</h3><p>Clears demo months and notes and reloads the starting list.</p><button class="btn btn-line btn-small" type="button" data-act="reset-demo">Reset demo data</button></div>';
      out += '<button class="btn btn-line btn-small" type="button" data-act="signout">Sign out</button>';
      return out;
    }
  };

  /* ═══════════ EVENTS ═══════════ */
  function bindEvents() {
    $('#shakeBtn').addEventListener('click', shake);
    $('#globe').addEventListener('click', shake);
    $('#organizerBtn').addEventListener('click', openDrawer);
    $('#drawerClose').addEventListener('click', closeDrawer);
    $('#scrim').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer(); });

    $('#ratePicker').addEventListener('click', (e) => {
      const b = e.target.closest('[data-rate]'); if (!b) return;
      const n = Number(b.dataset.rate);
      setRating(S.rating === n ? 0 : n);
    });

    $('#genreChips').addEventListener('click', (e) => {
      const c = e.target.closest('[data-genre]'); if (!c) return;
      S.filter = c.dataset.genre; renderBank();
    });

    $('#shelf').addEventListener('click', (e) => {
      const s = e.target.closest('.spine'); if (!s) return;
      const b = bookById(s.dataset.id); if (!b) return;
      $$('#shelf .spine').forEach((x) => x.setAttribute('aria-pressed', String(x === s)));
      $('#shelfDetail').innerHTML = '<strong>' + esc(b.title) + '</strong>' + (b.author ? ' by ' + esc(b.author) : '') + '. ' +
        esc(b.pitch || '') + (b.why ? ' <em>' + esc(b.why) + '</em>' : '');
    });

    document.addEventListener('submit', async (e) => {
      const f = e.target;
      if (f.id === 'noteForm') { e.preventDefault(); return onNote(f); }
      if (f.id === 'suggestForm') { e.preventDefault(); return onSuggest(f); }
      const kind = f.dataset.form; if (!kind) return;
      e.preventDefault();
      const v = Object.fromEntries(new FormData(f));
      const btn = f.querySelector('[type="submit"]'); if (btn) btn.disabled = true;
      try {
        if (kind === 'login') {
          try { await login(v.pass); } catch (err) { toast(err.message, true); }
        } else if (kind === 'official') {
          const b = S.draw;
          await adm('startMonth', { bookId: f.dataset.id, label: v.label, meetingDate: v.meetingDate },
            () => (b ? b.title : 'That book') + ' is our ' + v.label + ' pick.');
          S.draw = null; renderDraw();
          $('#globeTitle').textContent = '';
          $('#shakeBtn').textContent = 'Shake the globe';
          window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        } else if (kind === 'start') {
          await adm('startMonth', v, 'Month started.');
        } else if (kind === 'month-edit') {
          await adm('updateMonth', { id: f.dataset.id, patch: v }, 'Changes saved.');
        } else if (kind === 'close') {
          await adm('closeMonth', { id: f.dataset.id, groupRating: v.groupRating, verdict: v.verdict }, 'Moved to the Deep Freeze.');
        } else if (kind === 'freeze-edit') {
          await adm('updateMonth', { id: f.dataset.id, patch: v }, 'Changes saved.');
        }
      } catch (err) { /* toast already shown */ } finally { if (btn && document.contains(btn)) btn.disabled = false; }
    });

    document.addEventListener('click', async (e) => {
      const tab = e.target.closest('[data-tab]');
      if (tab) { S.adminTab = tab.dataset.tab; renderDrawer(); return; }
      const a = e.target.closest('[data-act]'); if (!a) return;
      const act = a.dataset.act;
      if (act === 'reveal') { a.closest('.note').classList.add('is-revealed'); return; }
      if (act === 'retry') { refresh(); return; }
      if (act === 'signout') { signOut(); return; }
      if (act === 'toggle-mentions') return; // handled on change
      try {
        if (act === 'hide-note') await adm('hideNote', { id: a.dataset.id, hidden: true }, 'Note hidden.');
        else if (act === 'toggle-note') await adm('hideNote', { id: a.dataset.id, hidden: a.dataset.hidden === 'true' }, a.dataset.hidden === 'true' ? 'Note hidden.' : 'Note shown.');
        else if (act === 'cancel-month') {
          if (confirm('Undo this pick and put the book back in the Snowbank?')) await adm('cancelMonth', { id: a.dataset.id }, 'Pick undone. The book is back in the Snowbank.');
        } else if (act === 'seed') {
          a.disabled = true;
          await adm('seed', { books: window.SEED_BOOKS || [] }, (n) => 'Loaded ' + n + ' books into the Snowbank.');
        } else if (act === 'reset-demo') {
          if (confirm('Reset the demo data?')) { await adm('resetDemo', {}, 'Demo reset.'); S.draw = null; renderDraw(); }
        } else if (act === 'export') {
          const blob = new Blob([JSON.stringify(S.adminData, null, 2)], { type: 'application/json' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'book-club-backup-' + isoDay(new Date()) + '.json';
          document.body.appendChild(link); link.click(); link.remove();
          setTimeout(() => URL.revokeObjectURL(link.href), 2000);
        }
      } catch (err) { /* toast already shown */ }
    });

    document.addEventListener('change', async (e) => {
      const t = e.target;
      try {
        if (t.dataset.act === 'toggle-mentions') {
          await adm('setSetting', { key: 'includeMentions', value: t.checked ? 'true' : 'false' }, 'Saved.');
          return;
        }
        const edit = t.dataset.edit; if (!edit) return;
        const id = t.closest('tr').dataset.id;
        let patch;
        if (edit === 'tier') { if (!t.value) return; patch = { tier: t.value }; }
        else if (edit === 'weight') patch = { weight: t.value };
        else if (edit === 'status') patch = { status: t.checked ? 'pool' : 'removed' };
        t.disabled = true;
        await adm('updateBook', { id, patch }, 'Saved.');
      } catch (err) { if (S.adminData) renderDrawer(); }
    });
  }

  /* ═══════════ INIT ═══════════ */
  async function init() {
    const name = CFG.clubName || 'Lake Effect Book Club';
    $$('[data-club-name]').forEach((el) => { el.textContent = name; });
    document.title = name;
    $('#clubIntro').textContent = CFG.intro || '';
    if (store.mode === 'demo') {
      const bar = $('#demoBar');
      bar.innerHTML = 'Demo mode: everything is saved in this browser only. Connect your Google Sheet (see the README) so the club shares one site. Organizer passphrase: <code>' + esc(CFG.demoPassphrase || 'lakeeffect') + '</code>';
      bar.hidden = false;
    }
    const sel = $('#noteForm select[name="progress"]');
    Object.keys(PROGRESS).forEach((k) => { sel.insertAdjacentHTML('beforeend', '<option value="' + k + '">' + esc(PROGRESS[k]) + '</option>'); });
    const saved = local.get(NAME_KEY);
    if (saved) { $('#noteForm').elements.name.value = saved; $('#suggestForm').elements.suggestedBy.value = saved; }

    buildRatePicker();
    renderTastes();
    setupGlobe();
    bindEvents();
    await refresh();

    const pass = session.get(PASS_KEY);
    if (pass && S.data) { try { await login(pass, true); } catch (e) { session.del(PASS_KEY); } }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
