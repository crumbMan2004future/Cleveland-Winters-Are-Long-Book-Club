/* =============================================================
   PIZZA PAGES  (c) 1989 Lake Effect Educational Software
   Read a classic for 5 minutes, pass the pop quiz, earn a slice.
   ============================================================= */
(function () {
  'use strict';

  var LIB = window.PIZZA_LIBRARY || [];
  var TEST = location.hash === '#pizzatest';      // 15-second test mode, nothing is saved
  var REQUIRED = TEST ? 15 : 300;                  // seconds of real reading per slice
  var RETRY_EXTRA = TEST ? 5 : 60;
  var SAVE_KEY = 'pizzapages-v1';
  var screen = document.getElementById('screen');
  var certWrap = document.getElementById('certWrap');
  if (!screen) return;

  /* ---------------- save file ---------------- */
  function blank() { return { slices: 0, pizzas: 0, seconds: 0, sessions: 0, read: {}, name: '' }; }
  var save = blank();
  try { var raw = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); for (var k in raw) save[k] = raw[k]; } catch (e) { /* fresh */ }
  function persist() { if (TEST) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

  /* ---------------- sound ---------------- */
  var B = window.Beep || { play: function () {}, toggle: function () { return true; }, muted: true };
  var SND = {
    blip: [[880, 0, 0.05]],
    page: [[660, 0, 0.04], [990, 0.04, 0.05]],
    tick: [[1200, 0, 0.02, 'square', 0.03]],
    error: [[140, 0, 0.18, 'sawtooth', 0.06]],
    ding: [[1568, 0, 0.3, 'triangle', 0.12], [2093, 0.12, 0.5, 'triangle', 0.1]],
    right: [[784, 0, 0.08], [1047, 0.08, 0.14]],
    wrong: [[300, 0, 0.12], [220, 0.12, 0.22]],
    fanfare: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.3], [784, 0.56, 0.1], [1047, 0.66, 0.6]],
    sad: [[392, 0, 0.2], [370, 0.22, 0.2], [349, 0.44, 0.2], [330, 0.66, 0.6]]
  };
  function sfx(name) { B.play(SND[name]); }

  /* ---------------- helpers ---------------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(s) { return esc(s).replace(/_([^_]+)_/g, '<em>$1</em>'); }
  function wc(s) { return (String(s).match(/\S+/g) || []).length; }
  function clock(sec) { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function rand(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function isHeading(line) { return line.length < 70 && /[A-Z]/.test(line) && line === line.toUpperCase(); }

  /* ---------------- pixel pizzas ---------------- */
  var PEP = [[11, 10], [20, 9], [16, 16], [9, 19], [22, 19], [14, 23], [20, 24]];
  function nearPep(x, y) { return PEP.some(function (p) { return (x - p[0]) * (x - p[0]) + (y - p[1]) * (y - p[1]) <= 4.5; }); }
  function canvas(px) {
    var c = document.createElement('canvas'); c.width = 32; c.height = 32; c.className = 'pix';
    c.style.width = px + 'px'; c.style.height = px + 'px'; c.setAttribute('aria-hidden', 'true'); return c;
  }
  // mode 'slices': val = slices earned (0-8). mode 'bake': val = stage (0-5).
  function drawPie(c, mode, val) {
    var g = c.getContext('2d'); g.clearRect(0, 0, 32, 32);
    for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
      var dx = x + 0.5 - 16, dy = y + 0.5 - 16, r = Math.sqrt(dx * dx + dy * dy), col = null;
      if (r > 14.6) continue;
      if (mode === 'slices') {
        var a = Math.atan2(dy, dx) + Math.PI / 2; if (a < 0) a += Math.PI * 2;
        var f = a / (Math.PI / 4), idx = Math.floor(f) % 8, frac = f - Math.floor(f);
        var line = (frac < 0.07 || frac > 0.93) && r > 1.5;
        if (idx < val) col = line ? '#8a4a12' : r > 12.6 ? '#c87a2a' : r > 11.4 ? '#d8341c' : nearPep(x, y) ? '#b0201a' : '#ffcc33';
        else if (r > 13.6 || line) col = '#1c6b31';
      } else {
        if (r > 12.6) col = val >= 5 ? '#b8661c' : val >= 3 ? '#d9a35a' : '#efe0b0';
        else {
          col = '#f5e8c0';
          if (val >= 1) col = '#d8341c';
          if (val === 2 && (x * 7 + y * 13) % 5 === 0) col = '#ffdd55';
          if (val >= 3) col = r > 11.4 ? '#d8341c' : ((x * 3 + y * 5) % 7 === 0 ? '#ffe680' : '#ffcc33');
          if (val >= 4 && nearPep(x, y)) col = '#b0201a';
          if (val >= 5 && (x * 11 + y * 7) % 17 === 0 && !nearPep(x, y) && r < 11) col = '#e09a2a';
        }
      }
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
    return c;
  }
  function drawSlice(c) {
    var g = c.getContext('2d'); g.clearRect(0, 0, 32, 32);
    for (var y = 3; y < 30; y++) for (var x = 0; x < 32; x++) {
      var half = (29 - y) / 26 * 13;
      if (Math.abs(x + 0.5 - 16) > half) continue;
      var col = y < 7 ? '#c87a2a' : y < 8 ? '#d8341c' : '#ffcc33';
      if ([[12, 12], [19, 13], [15, 19], [17, 24]].some(function (p) { return (x - p[0]) * (x - p[0]) + (y - p[1]) * (y - p[1]) <= 3; })) col = '#b0201a';
      g.fillStyle = col; g.fillRect(x, y, 1, 1);
    }
    return c;
  }

  /* ---------------- pages ---------------- */
  function paginate(piece) {
    var limit = piece.kind === 'poem' ? 95 : 120;
    var units = [];
    piece.text.trim().split(/\n\s*\n/).forEach(function (b) {
      b = b.trim(); if (!b) return;
      if (piece.kind === 'prose' && wc(b) > limit * 1.25) {
        var sents = b.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [b], cur = '';
        sents.forEach(function (s) { if (cur && wc(cur + s) > limit) { units.push(cur.trim()); cur = ''; } cur += s; });
        if (cur.trim()) units.push(cur.trim());
      } else units.push(b);
    });
    var pages = [], page = [], n = 0;
    units.forEach(function (u) {
      var w = wc(u);
      if (page.length && n + w > limit) { pages.push(page); page = []; n = 0; }
      page.push(u); n += w;
    });
    if (page.length) pages.push(page);
    return pages.map(function (blocks) { return { blocks: blocks, words: blocks.reduce(function (s, b) { return s + wc(b); }, 0) }; });
  }
  function minTime(piece, page) { return TEST ? 1 : Math.max(4, page.words / (piece.kind === 'poem' ? 5 : 6.5)); }   // ~390 wpm ceiling
  function pageCap(piece, page) { return TEST ? 60 : page.words * (piece.kind === 'poem' ? 1.1 : 0.8) + 25; }       // stops a parked page from counting forever

  function pickPiece(exclude) {
    var pool = LIB.filter(function (p) { return exclude.indexOf(p.id) === -1; });
    if (!pool.length) pool = LIB.slice();
    var least = Math.min.apply(null, pool.map(function (p) { return save.read[p.id] || 0; }));
    return rand(pool.filter(function (p) { return (save.read[p.id] || 0) === least; }));
  }

  /* ---------------- game state ---------------- */
  var state = 'title', sess = null, loop = null, last = 0, ovenStage = -1;
  function cur() { return sess.reads[sess.reads.length - 1]; }

  function render(html) { screen.innerHTML = html; }

  /* ===== TITLE ===== */
  function title() {
    state = 'title'; stopLoop();
    render('<div class="gs gs-center">' +
      '<p class="px logo">PIZZA<br>PAGES</p>' +
      '<div id="pieSlot"></div>' +
      '<p class="px yellow" style="font-size:11px;margin:0">READ 5 MINUTES = 1 SLICE</p>' +
      '<p style="margin:0">SLICES ' + save.slices + '/8 &nbsp; WHOLE PIZZAS ' + save.pizzas + ' &nbsp; MINUTES READ ' + Math.floor(save.seconds / 60) + '</p>' +
      '<div class="row"><button class="gbtn big hot press" data-act="start">PRESS START</button><button class="gbtn" data-act="howto">HOW TO PLAY</button></div>' +
      '<div class="row">' + (save.pizzas ? '<button class="gbtn" data-act="cert">MY CERTIFICATE</button>' : '') +
      '<button class="gbtn" data-act="mute">SOUND: ' + (B.muted ? 'OFF' : 'ON') + '</button></div>' +
      (TEST ? '<p class="red" style="margin:0">TEST MODE: 15 SECONDS, NO REAL PIZZA</p>' : '<p class="dim" style="margin:0">&copy; 1989 LAKE EFFECT EDUCATIONAL SOFTWARE</p>') +
      '</div>');
    document.getElementById('pieSlot').appendChild(drawPie(canvas(110), 'slices', save.slices));
  }

  function howto() {
    state = 'howto';
    render('<div class="gs gs-center"><p class="px yellow" style="font-size:14px">HOW TO PLAY</p><div class="howto">' +
      '<p>1. The computer picks a <span class="white">classic book</span> for you.</p>' +
      '<p>2. <span class="white">READ IT.</span> Turn pages with NEXT or the arrow keys.</p>' +
      '<p>3. Your pizza bakes while you read. <span class="white">5 minutes</span> and it\'s done!</p>' +
      '<p>4. No cheating!! Flip pages too fast and NEXT makes you wait. Park on one page too long and the oven cools off. Leave this window and the timer stops.</p>' +
      '<p>5. Pass the <span class="white">POP QUIZ</span> (2 of 3) to earn your slice.</p>' +
      '<p>6. 8 slices = <span class="yellow">1 WHOLE PIZZA</span> and a certificate!</p>' +
      '</div><button class="gbtn hot" data-act="title">&#9664; BACK</button></div>');
  }

  /* ===== PICK A BOOK (slot machine) ===== */
  function start() {
    sess = { credited: 0, required: REQUIRED, reads: [], done: false };
    screen.scrollIntoView({ block: 'center', behavior: 'smooth' });
    pick(true);
  }
  function pick(first) {
    state = 'pick'; stopLoop();
    var piece = pickPiece(sess.reads.map(function (r) { return r.piece.id; }));
    render('<div class="gs gs-center"><p class="px cyan" style="font-size:12px">' + (first ? 'CHOOSING YOUR BOOK...' : 'TIME LEFT! NEXT BOOK...') + '</p>' +
      '<p class="white" id="slot" style="font-size:38px;min-height:2.4em;display:flex;align-items:center">???</p><div id="assign"></div></div>');
    var slot = document.getElementById('slot');
    var titles = shuffle(LIB.map(function (p) { return p.title; })), i = 0, delay = 60;
    (function spin() {
      if (state !== 'pick') return;
      if (delay < 330) {
        slot.textContent = titles[i++ % titles.length]; sfx('tick');
        delay *= 1.16; setTimeout(spin, delay); return;
      }
      slot.textContent = piece.title; sfx('ding');
      document.getElementById('assign').innerHTML =
        '<p class="px yellow" style="font-size:12px;margin:0 0 6px">YOUR ASSIGNMENT:</p>' +
        '<p style="margin:0">by ' + esc(piece.author) + ' (' + esc(piece.year) + ')</p>' +
        '<p class="dim" style="margin:0 0 12px">' + esc(piece.part) + '</p>' +
        '<button class="gbtn big hot" data-act="begin" data-id="' + piece.id + '">' + (first ? 'BEGIN READING' : 'KEEP READING') + ' &#9654;</button>';
      var b = screen.querySelector('[data-act="begin"]'); if (b) b.focus();
    })();
  }

  /* ===== READING ===== */
  function begin(id) {
    var piece = LIB.filter(function (p) { return p.id === id; })[0];
    sess.reads.push({ piece: piece, pages: paginate(piece), idx: 0, times: [] });
    state = 'read'; ovenStage = -1;
    render('<div class="gs">' +
      '<div class="rbar"><span class="ttl">' + esc(piece.title) + ' <span class="dim">by ' + esc(piece.author) + '</span></span>' +
      '<span class="oven" title="Your pizza is baking"><span id="ovenSlot"></span><span class="timer" id="timer"></span></span></div>' +
      '<div class="rtext' + (piece.kind === 'poem' ? ' poem' : '') + '" id="rtext" tabindex="0" aria-live="polite"></div>' +
      '<div class="status" id="status"></div>' +
      '<div class="rfoot"><button class="gbtn" data-act="back">&#9664; BACK</button><span class="pg" id="pg"></span>' +
      '<button class="gbtn hot" data-act="next" id="nextBtn">NEXT &#9654;</button></div></div>');
    document.getElementById('ovenSlot').appendChild(canvas(40));
    showPage();
    startLoop();
  }
  function showPage() {
    var r = cur(), page = r.pages[r.idx];
    document.getElementById('rtext').innerHTML = page.blocks.map(function (b) {
      var lines = b.split('\n');
      if (isHeading(lines[0])) {
        var head = '<p class="chap">' + fmt(lines[0]) + '</p>';
        return lines.length > 1 ? head + '<p>' + fmt(lines.slice(1).join('\n')) + '</p>' : head;
      }
      return '<p>' + fmt(b) + '</p>';
    }).join('');
    document.getElementById('rtext').scrollTop = 0;
    document.getElementById('pg').textContent = 'PAGE ' + (r.idx + 1) + '/' + r.pages.length;
    screen.querySelector('[data-act="back"]').disabled = r.idx === 0;
    updateRead();
  }
  function updateRead() {
    if (state !== 'read') return;
    var r = cur(), page = r.pages[r.idx], spent = r.times[r.idx] || 0;
    var wait = Math.ceil(minTime(r.piece, page) - spent);
    var lastPage = r.idx === r.pages.length - 1;
    var nb = document.getElementById('nextBtn');
    nb.disabled = wait > 0;
    nb.innerHTML = (lastPage ? 'FINISH' : 'NEXT') + ' &#9654;' + (wait > 0 ? ' (' + wait + ')' : '');
    document.getElementById('timer').textContent = clock(sess.required - sess.credited);
    var stage = Math.min(5, Math.floor(sess.credited / sess.required * 6));
    if (stage !== ovenStage) { ovenStage = stage; drawPie(screen.querySelector('#ovenSlot canvas'), 'bake', stage); }
  }
  function setStatus(msg) { var s = document.getElementById('status'); if (s && s.textContent !== msg) s.textContent = msg; }

  function startLoop() { stopLoop(); last = performance.now(); loop = setInterval(tick, 250); }
  function stopLoop() { if (loop) clearInterval(loop); loop = null; }
  function tick() {
    var now = performance.now(), dt = Math.min(1, (now - last) / 1000); last = now;
    if (state !== 'read') return;
    if (document.visibilityState !== 'visible' || !document.hasFocus()) { setStatus('PAUSED. COME BACK TO THIS WINDOW!'); return; }
    var r = cur(), page = r.pages[r.idx];
    r.times[r.idx] = (r.times[r.idx] || 0) + dt;
    if (r.times[r.idx] <= pageCap(r.piece, page)) { sess.credited += dt; setStatus(''); }
    else setStatus('THE OVEN IS COOLING... TURN THE PAGE!');
    updateRead();
    if (sess.credited >= sess.required) ding();
  }
  function next() {
    if (state !== 'read') return;
    var r = cur(), page = r.pages[r.idx], wait = Math.ceil(minTime(r.piece, page) - (r.times[r.idx] || 0));
    if (wait > 0) { sfx('error'); setStatus('WHOA, SPEED READER! WAIT ' + wait + ' MORE SEC.'); return; }
    if (r.idx < r.pages.length - 1) { r.idx++; sfx('page'); showPage(); return; }
    save.read[r.piece.id] = (save.read[r.piece.id] || 0) + 1; persist();
    pick(false); // finished the piece with time left: on to another book
  }
  function back() {
    if (state !== 'read') return;
    var r = cur(); if (r.idx > 0) { r.idx--; sfx('page'); showPage(); }
  }

  /* ===== DING + QUIZ ===== */
  function ding() {
    state = 'ding'; stopLoop(); sfx('ding');
    render('<div class="gs gs-center"><div id="bigPie"></div><p class="px yellow" style="font-size:22px;margin:0">DING!</p>' +
      '<p class="white" style="margin:0">Your pizza is out of the oven...</p>' +
      '<p style="margin:0 0 8px">...but first, a <span class="yellow">POP QUIZ!</span> Get 2 of 3 right to earn your slice.</p>' +
      '<button class="gbtn big hot" data-act="quiz">TAKE THE QUIZ</button></div>');
    document.getElementById('bigPie').appendChild(drawPie(canvas(130), 'bake', 5));
  }

  var STOP = ('about above after again against almost along already also although always among another because before being below between beyond both could during each either enough every first from further having hence here herself himself however itself might more most much myself neither never nothing often other otherwise ought ourselves perhaps quite rather same seemed seems shall should since some such than that their theirs them themselves then there therefore these they thing things this those though through thus till under unless until upon very what whatever when where whether which while whom whose will with within without would your yours yourself ' +
    'thee thou thy thine hath doth dost shalt wilt art twas unto whilst amongst every said says replied cried returned made make think know knew come came going gone like little great well just only even still back again ever away').split(/\s+/);
  var FALLBACK = ['window', 'garden', 'thunder', 'candle', 'letter', 'mountain', 'silver', 'morning', 'shadow', 'stranger', 'harbor', 'blanket', 'kitchen', 'promise', 'whisper'];

  function quizUnits() {
    var units = [];
    sess.reads.forEach(function (r) {
      r.pages.forEach(function (p, i) {
        if ((r.times[i] || 0) < minTime(r.piece, p) * 0.5) return; // only pages you actually spent time on
        p.blocks.forEach(function (b) {
          var lines = b.split('\n').filter(function (l) { return l.trim() && !isHeading(l.trim()) && !/^\(.*\)$/.test(l.trim()); });
          var chunks = r.piece.kind === 'poem' ? [] : (lines.join(' ').match(/[^.!?]+[.!?]+["')\]]*/g) || [lines.join(' ')]);
          if (r.piece.kind === 'poem') for (var j = 0; j < lines.length; j += 2) chunks.push(lines.slice(j, j + 2).join(' / '));
          chunks.forEach(function (c) {
            c = c.replace(/_/g, '').trim();
            var n = wc(c);
            if (n >= 6 && n <= 45) units.push({ text: c, title: r.piece.title, key: r.piece.id + i });
          });
        });
      });
    });
    return units;
  }
  function words(text) { return text.match(/[A-Za-z][A-Za-z'-]*[A-Za-z]/g) || []; }
  function candidates(text) {
    var all = words(text);
    return all.filter(function (w, i) { return i > 0 && w.length >= 5 && w.indexOf("'") === -1 && w.indexOf('-') === -1 && STOP.indexOf(w.toLowerCase()) === -1; });
  }
  function buildQuiz() {
    var units = shuffle(quizUnits()).filter(function (u) { return candidates(u.text).length; });
    var pool = [];
    sess.reads.forEach(function (r) { pool = pool.concat(candidates(r.piece.text.replace(/_/g, ''))); });
    var chosen = [], keys = {};
    units.forEach(function (u) { if (chosen.length < 3 && !keys[u.key]) { keys[u.key] = 1; chosen.push(u); } });
    units.forEach(function (u) { if (chosen.length < 3 && chosen.indexOf(u) === -1) chosen.push(u); });
    return chosen.map(function (u) {
      var cands = candidates(u.text).sort(function (a, b) { return b.length - a.length; });
      var target = rand(cands.slice(0, Math.max(1, Math.ceil(cands.length / 2))));
      var proper = /^[A-Z]/.test(target);
      var inUnit = words(u.text).map(function (w) { return w.toLowerCase(); });
      var seen = {}; seen[target.toLowerCase()] = 1;
      var opts = shuffle(pool).filter(function (w) {
        var lw = w.toLowerCase();
        if (seen[lw] || inUnit.indexOf(lw) !== -1 || /^[A-Z]/.test(w) !== proper || Math.abs(w.length - target.length) > 3) return false;
        seen[lw] = 1; return true;
      }).slice(0, 3);
      shuffle(FALLBACK).forEach(function (w) { if (opts.length < 3 && !seen[w] && inUnit.indexOf(w) === -1) { seen[w] = 1; opts.push(proper ? w[0].toUpperCase() + w.slice(1) : w); } });
      var show = function (w) { return proper ? w : w.toLowerCase(); };
      var idx = u.text.search(new RegExp('\\b' + target + '\\b'));
      if (idx < 0) idx = u.text.indexOf(target);
      var masked = esc(u.text.slice(0, idx)) + '<span class="blank">______</span>' + esc(u.text.slice(idx + target.length));
      return { masked: masked, title: u.title, answer: show(target), options: shuffle([show(target)].concat(opts.map(show))) };
    });
  }

  function quiz() {
    var qs = buildQuiz();
    if (qs.length < 3) { award(); return; } // not enough text to quiz on (shouldn't happen)
    state = 'quiz';
    var score = 0, n = 0;
    function ask() {
      var q = qs[n];
      render('<div class="gs gs-center"><p class="px yellow" style="font-size:13px;margin:0">POP QUIZ! QUESTION ' + (n + 1) + ' OF 3</p>' +
        '<p class="dim" style="margin:6px 0 0">Fill in the missing word. From <span class="cyan">' + esc(q.title) + '</span>:</p>' +
        '<p class="quiz-q">"' + q.masked + '"</p><div class="opts">' +
        q.options.map(function (o) { return '<button class="gbtn" data-ans="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div></div>');
      var first = screen.querySelector('[data-ans]'); if (first) first.focus();
    }
    screen.onclick = function (e) {
      var b = e.target.closest('[data-ans]'); if (!b || state !== 'quiz' || b.disabled) return;
      var q = qs[n], ok = b.getAttribute('data-ans') === q.answer;
      Array.prototype.forEach.call(screen.querySelectorAll('[data-ans]'), function (x) {
        x.disabled = true; if (x.getAttribute('data-ans') === q.answer) x.classList.add('right');
      });
      if (!ok) b.classList.add('wrong');
      sfx(ok ? 'right' : 'wrong'); if (ok) score++;
      setTimeout(function () {
        n++;
        if (n < 3) ask();
        else { screen.onclick = null; if (score >= 2) award(score); else burnt(score); }
      }, 1100);
    };
    ask();
  }

  /* ===== RESULTS ===== */
  function award(score) {
    state = 'result'; sfx('fanfare');
    var titles = sess.reads.map(function (r) { return r.piece.title; });
    var c = cur(); save.read[c.piece.id] = (save.read[c.piece.id] || 0) + 1;
    save.seconds += Math.round(sess.credited); save.sessions++;
    save.slices++;
    var whole = false;
    if (save.slices >= 8) { save.slices = 0; save.pizzas++; whole = true; }
    persist();
    render('<div class="gs gs-center"><div id="winSlice"></div>' +
      '<p class="px yellow" style="font-size:20px;margin:0">' + (whole ? 'WHOLE PIZZA!!!' : '+1 SLICE!') + '</p>' +
      (score != null ? '<p class="white" style="margin:0">Quiz score: ' + score + ' of 3</p>' : '') +
      '<p style="margin:0">You read: <span class="white">' + titles.map(esc).join(' and ') + '</span></p>' +
      '<div id="winPie"></div>' +
      '<p style="margin:0">' + (whole ? 'That\'s 8 slices! You have earned WHOLE PIZZA #' + save.pizzas + '!'
        : save.slices + ' of 8 slices. ' + (8 - save.slices) + ' more for a WHOLE PIZZA!') + '</p>' +
      '<div class="row">' + (whole ? '<button class="gbtn hot" data-act="cert">PRINT MY CERTIFICATE</button>' : '') +
      '<button class="gbtn hot" data-act="start">READ AGAIN</button><button class="gbtn" data-act="title">TITLE SCREEN</button></div></div>');
    document.getElementById('winSlice').appendChild(drawSlice(canvas(90)));
    document.getElementById('winPie').appendChild(drawPie(canvas(70), 'slices', whole ? 8 : save.slices));
  }
  function burnt(score) {
    state = 'result'; sfx('sad');
    render('<div class="gs gs-center"><p class="px red" style="font-size:20px;margin:0">BURNT PIZZA!</p>' +
      '<p class="white" style="margin:0">Quiz score: ' + score + ' of 3. You need 2.</p>' +
      '<p style="margin:0 0 8px">Read for 1 more minute, then try a brand new quiz.</p>' +
      '<div class="row"><button class="gbtn big hot" data-act="retry">KEEP READING</button><button class="gbtn" data-act="title">GIVE UP</button></div></div>');
  }
  function retry() {
    sess.required = sess.credited + RETRY_EXTRA;
    var r = cur(), piece = r.piece;
    sess.reads.pop();
    begin(piece.id);
    var nr = cur(); nr.idx = r.idx; nr.times = r.times; showPage();
  }

  /* ===== CERTIFICATE ===== */
  function certificate() {
    var today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    certWrap.innerHTML = '<div class="cert" role="dialog" aria-label="Certificate">' +
      '<p style="margin:0;letter-spacing:3px">~ LAKE EFFECT BOOK CLUB ~</p>' +
      '<h3>Certificate of Reading Excellence</h3><p style="margin:0">This certifies that</p>' +
      '<input class="who" id="certName" aria-label="Your name" placeholder="Type your name" value="' + esc(save.name || '') + '">' +
      '<p>has read the great books of literature for at least <b>' + (save.pizzas * 40) + ' whole minutes</b><br>and has earned</p>' +
      '<p style="font:bold 30px \'Comic Sans MS\',\'Comic Neue\',cursive;color:#cc0000;margin:6px 0">' + save.pizzas + ' WHOLE PIZZA' + (save.pizzas === 1 ? '' : 'S') + '! &#127829;</p>' +
      '<p class="tiny">Redeemable for bragging rights at the next meeting.</p>' +
      '<p class="sig">Mrs. Kowalski</p><p class="tiny" style="margin:0">Webmaster, ' + today + '</p>' +
      '<div class="seal">GOLD<br>STAR<br>READER</div>' +
      '<div class="cert-actions"><button class="bevel" data-cert="print">PRINT</button><button class="bevel" data-cert="close">CLOSE</button></div></div>';
    certWrap.hidden = false;
    document.getElementById('certName').focus();
  }
  certWrap.addEventListener('input', function (e) { if (e.target.id === 'certName') { save.name = e.target.value.slice(0, 40); persist(); } });
  certWrap.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cert]'); if (!b && e.target !== certWrap) return;
    if (b && b.getAttribute('data-cert') === 'print') { window.print(); return; }
    certWrap.hidden = true; certWrap.innerHTML = '';
  });

  /* ---------------- input ---------------- */
  screen.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    var act = b.getAttribute('data-act');
    if (act !== 'mute') sfx('blip');
    if (act === 'start') start();
    else if (act === 'howto') howto();
    else if (act === 'title') title();
    else if (act === 'begin') begin(b.getAttribute('data-id'));
    else if (act === 'next') next();
    else if (act === 'back') back();
    else if (act === 'quiz') quiz();
    else if (act === 'retry') retry();
    else if (act === 'cert') certificate();
    else if (act === 'mute') { B.toggle(); title(); }
  });
  document.addEventListener('keydown', function (e) {
    if (!certWrap.hidden && e.key === 'Escape') { certWrap.hidden = true; return; }
    if (state !== 'read' || /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
  });
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  title();
})();
