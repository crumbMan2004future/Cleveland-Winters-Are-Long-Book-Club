/* ─────────────────────────────────────────────────────────────
   Data layer.
   - Live mode: talks to the Google Apps Script web app (see apps-script/Code.gs).
   - Demo mode: same actions, stored only in this browser.
   Both expose store.call(action, params) → Promise.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // How heavy each tier's flake is in the globe. Keep in sync with WEIGHTS in Code.gs.
  const TIER_WEIGHTS = { t1: 10, t2: 6, t3: 3, new: 4, mention: 0.5 };
  const TIER_LABELS = {
    t1: 'Tier 1',
    t2: 'Tier 2',
    t3: 'Tier 3',
    new: 'New suggestion',
    mention: 'Stuck-with-us mention'
  };
  const PROGRESS = {
    start: 'Just started',
    q1: 'About a quarter in',
    half: 'Halfway',
    q3: 'Three-quarters in',
    done: 'Finished',
    dnf: 'Bailed out'
  };
  const PUBLIC_FIELDS = ['id', 'title', 'author', 'status', 'source', 'genres', 'pitch', 'suggestedBy', 'why', 'addedAt'];

  window.TIER_WEIGHTS = TIER_WEIGHTS;
  window.TIER_LABELS = TIER_LABELS;
  window.PROGRESS = PROGRESS;

  /* ---------- shared helpers ---------- */
  const uid = (p) => p + Math.random().toString(36).slice(2, 12);
  const now = () => new Date().toISOString();
  const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
  const truthy = (v) => v === true || v === 'true' || v === 'TRUE';
  const norm = (s) => String(s || '').toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]/g, '');
  const pick = (o, keys) => keys.reduce((a, k) => { a[k] = o[k] == null ? '' : o[k]; return a; }, {});
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const byTitle = (a, b) => (norm(a.title) < norm(b.title) ? -1 : 1);
  const fail = (msg) => { throw new Error(msg); };

  function rating(v) {
    if (v === '' || v == null) return '';
    const r = Math.round(Number(v) * 2) / 2;
    if (!(r >= 0.5 && r <= 5)) fail('Ratings go from 0.5 to 5.');
    return String(r);
  }

  function weightedPick(items) {
    const total = items.reduce((s, b) => s + Number(b.weight), 0);
    let r = Math.random() * total;
    for (const b of items) { r -= Number(b.weight); if (r < 0) return b; }
    return items[items.length - 1];
  }

  function eligible(b, settings) {
    return b.status === 'pool' && Number(b.weight) > 0 &&
      (b.source !== 'mention' || truthy(settings.includeMentions));
  }

  function monthLabel(d) {
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  function seedBook(b) {
    const tier = TIER_WEIGHTS[b.tier] != null ? b.tier : 'new';
    const w = Number(b.weight);
    return {
      id: uid('b_'),
      title: clip(b.title, 200),
      author: clip(b.author, 120),
      tier,
      weight: String(w >= 0 ? w : TIER_WEIGHTS[tier]),
      status: 'pool',
      source: ['seed', 'mention', 'suggestion'].includes(b.source) ? b.source : 'seed',
      genres: clip(b.genres, 120),
      pitch: clip(b.pitch, 600),
      suggestedBy: clip(b.suggestedBy, 60),
      why: clip(b.why, 600),
      addedAt: now()
    };
  }

  /* ---------- live: Google Apps Script ---------- */
  function SheetStore(url) {
    const unwrap = async (res) => {
      if (!res.ok) throw new Error('The club sheet answered with an error (' + res.status + ').');
      let body;
      try { body = await res.json(); } catch (e) {
        throw new Error('The club sheet sent back something unexpected. Check the web app URL in js/config.js.');
      }
      if (!body.ok) throw new Error(body.error || 'Something went wrong.');
      return body.data;
    };
    const reads = new Set(['state', 'draw']);
    return {
      mode: 'live',
      call(action, params = {}) {
        if (reads.has(action)) {
          const qs = new URLSearchParams({ action, _: Date.now() });
          return fetch(url + (url.includes('?') ? '&' : '?') + qs).then(unwrap);
        }
        // Plain-text body keeps this a "simple" request, which Apps Script accepts cross-origin.
        return fetch(url, { method: 'POST', body: JSON.stringify(Object.assign({ action }, params)) }).then(unwrap);
      }
    };
  }

  /* ---------- demo: this browser only ---------- */
  function LocalStore(passphrase) {
    const KEY = 'lebc-demo-v1';
    let db = null;

    function fresh() {
      return {
        books: (window.SEED_BOOKS || []).map(seedBook),
        months: [],
        notes: [],
        settings: { includeMentions: 'true' }
      };
    }
    function load() {
      if (db) return db;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) db = JSON.parse(raw);
      } catch (e) { /* storage blocked: fall back to memory */ }
      if (!db) { db = fresh(); save(); }
      return db;
    }
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* memory only */ }
    }
    const find = (list, id, what) => list.find((x) => x.id === id) || fail('That ' + what + ' no longer exists.');
    const publicBook = (b) => pick(b, PUBLIC_FIELDS);

    const PUBLIC = {
      state() {
        const d = load();
        return {
          books: d.books.filter((b) => b.status !== 'removed').map(publicBook).sort(byTitle),
          months: d.months,
          notes: d.notes.filter((n) => !truthy(n.hidden)).map((n) => { const c = Object.assign({}, n); delete c.hidden; return c; }),
          settings: { includeMentions: truthy(d.settings.includeMentions) }
        };
      },
      draw() {
        const d = load();
        const pool = d.books.filter((b) => eligible(b, d.settings));
        if (!pool.length) fail('The Snowbank is empty. Add a few books first.');
        return publicBook(weightedPick(pool));
      },
      addNote(p) {
        const d = load();
        const text = clip(p.text, 4000) || fail('Write something first.');
        const month = find(d.months, p.monthId, 'month');
        const r = p.rating ? Math.max(1, Math.min(5, Math.round(Number(p.rating)))) : '';
        const note = {
          id: uid('n_'), monthId: month.id, bookId: month.bookId,
          name: clip(p.name, 60) || 'Anonymous',
          text,
          progress: PROGRESS[p.progress] ? p.progress : '',
          rating: r ? String(r) : '',
          spoiler: truthy(p.spoiler) ? 'true' : 'false',
          hidden: 'false',
          createdAt: now()
        };
        d.notes.push(note); save();
        const c = Object.assign({}, note); delete c.hidden; return c;
      },
      addSuggestion(p) {
        const d = load();
        const title = clip(p.title, 200) || fail('Every book needs a title.');
        const existing = d.books.find((b) => norm(b.title) === norm(title));
        if (existing) {
          if (existing.status === 'read') fail('We already read ' + existing.title + '. It\u2019s in the Deep Freeze.');
          if (existing.status === 'current') fail(existing.title + ' is this month\u2019s book.');
          if (existing.status === 'pool' && existing.source !== 'mention') fail(existing.title + ' is already in the Snowbank.');
        }
        const fields = {
          tier: 'new', status: 'pool', source: 'suggestion',
          author: clip(p.author, 120) || (existing ? existing.author : ''),
          genres: clip(p.genres, 120) || (existing ? existing.genres : ''),
          suggestedBy: clip(p.suggestedBy, 60),
          why: clip(p.why, 600),
          addedAt: now()
        };
        let book;
        if (existing) {
          fields.weight = String(Math.max(Number(existing.weight) || 0, TIER_WEIGHTS.new));
          book = Object.assign(existing, fields);
        } else {
          book = Object.assign({ id: uid('b_'), title, weight: String(TIER_WEIGHTS.new), pitch: '' }, fields);
          d.books.push(book);
        }
        save();
        return publicBook(book);
      }
    };

    const ADMIN = {
      verify: () => true,
      adminState() {
        const d = load();
        return { books: d.books, months: d.months, notes: d.notes, settings: { includeMentions: truthy(d.settings.includeMentions) }, weights: TIER_WEIGHTS };
      },
      updateBook(p) {
        const d = load();
        const b = find(d.books, p.id, 'book');
        const patch = p.patch || {};
        ['title', 'author', 'genres', 'pitch', 'why', 'suggestedBy'].forEach((k) => {
          if (patch[k] != null) b[k] = clip(patch[k], k === 'pitch' || k === 'why' ? 600 : 200);
        });
        if (patch.tier != null) {
          if (TIER_WEIGHTS[patch.tier] == null) fail('Unknown tier.');
          b.tier = patch.tier;
          if (patch.weight == null) b.weight = String(TIER_WEIGHTS[patch.tier]);
        }
        if (patch.weight != null) {
          const w = Number(patch.weight);
          if (!(w >= 0 && w <= 1000)) fail('Weight should be a number from 0 to 1000.');
          b.weight = String(w);
        }
        if (patch.status != null) {
          if (!['pool', 'removed'].includes(patch.status)) fail('Unknown status.');
          if (!['pool', 'removed'].includes(b.status)) fail('That book has already been picked.');
          b.status = patch.status;
        }
        save(); return b;
      },
      startMonth(p) {
        const d = load();
        const b = find(d.books, p.bookId, 'book');
        if (b.status !== 'pool') fail(b.title + ' isn\u2019t in the Snowbank right now.');
        d.months.filter((m) => m.status === 'current').forEach((m) => {
          m.status = 'closed'; m.closedAt = now();
          const old = d.books.find((x) => x.id === m.bookId);
          if (old) old.status = 'read';
        });
        const m = {
          id: uid('m_'), bookId: b.id,
          label: clip(p.label, 60) || monthLabel(new Date()),
          meetingDate: clip(p.meetingDate, 30),
          status: 'current', groupRating: '', verdict: '',
          startedAt: now(), closedAt: ''
        };
        d.months.push(m);
        b.status = 'current';
        save(); return m;
      },
      cancelMonth(p) {
        const d = load();
        const m = find(d.months, p.id, 'month');
        if (m.status !== 'current') fail('Only the current month can be undone.');
        if (d.notes.some((n) => n.monthId === m.id)) fail('People have already left notes on this one. Close it out instead.');
        const b = d.books.find((x) => x.id === m.bookId);
        if (b) b.status = 'pool';
        d.months = d.months.filter((x) => x.id !== m.id);
        save(); return true;
      },
      updateMonth(p) {
        const d = load();
        const m = find(d.months, p.id, 'month');
        const patch = p.patch || {};
        if (patch.label != null) m.label = clip(patch.label, 60);
        if (patch.meetingDate != null) m.meetingDate = clip(patch.meetingDate, 30);
        if (patch.verdict != null) m.verdict = clip(patch.verdict, 600);
        if (patch.groupRating != null) m.groupRating = rating(patch.groupRating);
        save(); return m;
      },
      closeMonth(p) {
        const d = load();
        const m = find(d.months, p.id, 'month');
        m.groupRating = rating(p.groupRating);
        m.verdict = clip(p.verdict, 600);
        if (m.status !== 'closed') { m.status = 'closed'; m.closedAt = now(); }
        const b = d.books.find((x) => x.id === m.bookId);
        if (b) b.status = 'read';
        save(); return m;
      },
      hideNote(p) {
        const d = load();
        const n = find(d.notes, p.id, 'note');
        n.hidden = truthy(p.hidden) ? 'true' : 'false';
        save(); return n;
      },
      setSetting(p) {
        const d = load();
        if (!['includeMentions'].includes(p.key)) fail('Unknown setting.');
        d.settings[p.key] = String(p.value);
        save(); return true;
      },
      seed(p) {
        const d = load();
        if (d.books.length) fail('There are already books in the Snowbank.');
        d.books = (p.books || []).map(seedBook).filter((b) => b.title);
        save(); return d.books.length;
      },
      resetDemo() {
        db = fresh(); save(); return true;
      }
    };

    return {
      mode: 'demo',
      call(action, params = {}) {
        return new Promise((resolve, reject) => {
          try {
            if (PUBLIC[action]) return resolve(clone(PUBLIC[action](params)));
            if (ADMIN[action]) {
              if (String(params.pass || '') !== String(passphrase)) fail('That passphrase didn\u2019t work.');
              return resolve(clone(ADMIN[action](params)));
            }
            fail('Unknown action: ' + action);
          } catch (e) { reject(e); }
        });
      }
    };
  }

  window.createStore = function (cfg) {
    const url = String((cfg && cfg.apiUrl) || '').trim();
    return url ? SheetStore(url) : LocalStore((cfg && cfg.demoPassphrase) || 'lakeeffect');
  };
  window.lebcUtil = { truthy, norm, byTitle, eligible, monthLabel };
})();
