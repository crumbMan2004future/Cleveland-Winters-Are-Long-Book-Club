/* ~*~ notes.js : the Reading Notes guestbook ~*~
   Notes are written in a Google Form and read back from the
   form's response sheet (published to the web as CSV).       */
(function () {
  'use strict';
  var cfg = document.getElementById('notesConfig');
  var area = document.getElementById('notesArea');
  if (!cfg || !area) return;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function isLink(s) { return /^https?:\/\//i.test(s); }

  /* ---------- links from index.html ---------- */
  var formLink = (cfg.getAttribute('data-form') || '').trim();
  var csvLink = (cfg.getAttribute('data-csv') || '').trim();
  if (isLink(csvLink) && /\/pubhtml/.test(csvLink)) csvLink = csvLink.replace('/pubhtml', '/pub');            // forgive the HTML version of the link
  if (isLink(csvLink) && /\/pub\b/.test(csvLink) && !/output=csv/.test(csvLink)) csvLink += (csvLink.indexOf('?') > -1 ? '&' : '?') + 'output=csv';

  /* ---------- books, newest first ---------- */
  function parseDay(s) { var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function parseRating(s) {
    s = String(s || '').trim(); if (!s) return null;
    var m = /^([\d.]+)\s*\/\s*([\d.]+)$/.exec(s);
    var r = m ? parseFloat(m[1]) / parseFloat(m[2]) * 5 : parseFloat(s);
    return isNaN(r) ? null : Math.max(0, Math.min(5, Math.round(r * 2) / 2));
  }
  var books = Array.prototype.map.call(document.querySelectorAll('#bookHistory li'), function (li) {
    return {
      title: li.textContent.trim(), start: parseDay(li.getAttribute('data-start')),
      author: (li.getAttribute('data-author') || '').trim(),
      rating: parseRating(li.getAttribute('data-rating')),
      verdict: (li.getAttribute('data-verdict') || '').trim(), notes: []
    };
  }).filter(function (b) { return b.title && b.start; }).sort(function (a, b) { return b.start - a.start; });
  books.forEach(function (b, i) { b.end = i > 0 ? books[i - 1].start : null; });
  if (!books.length) books = [{ title: 'this month\u2019s book', start: new Date(0), notes: [], rating: null }];
  $('notesBookTitle').textContent = books[0].title;

  /* ---------- the form ---------- */
  var formBox = $('noteForm');
  if (!isLink(formLink)) {
    formBox.innerHTML = '<p class="center">&#128679; The webmaster is still setting up the note form. Check back soon!! &#128679;</p>';
  } else if (/forms\.gle\//.test(formLink) || !/\/viewform/.test(formLink)) {
    formBox.innerHTML = '<p class="center"><a class="big-link" href="' + esc(formLink) + '" target="_blank" rel="noopener">&#9997;&#65039; CLICK HERE TO LEAVE A NOTE!!! &#9997;&#65039;</a></p>';
  } else {
    var src = formLink.replace(/[?&]usp=[^&]*/, '').replace(/&$/, '');
    src += (src.indexOf('?') > -1 ? '&' : '?') + 'embedded=true';
    formBox.innerHTML = '<iframe id="formFrame" title="Leave a reading note" src="' + esc(src) + '" loading="lazy">Loading&hellip;</iframe>';
    $('formFallback').innerHTML = 'Form not showing up? <a href="' + esc(formLink) + '" target="_blank" rel="noopener">Open it in a new window</a>.';
    var loads = 0;
    $('formFrame').addEventListener('load', function () {
      loads++;
      if (loads > 1) { // the form reloads itself after someone submits
        $('noteThanks').hidden = false;
        fastPoll();
      }
    });
  }

  /* ---------- CSV ---------- */
  function parseCSV(t) {
    var rows = [], row = [], f = '', q = false;
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (q) {
        if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim(); }); });
  }
  function parseStamp(s) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s || '');
    if (m) return new Date(+m[3], +m[1] - 1, +m[2], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    var d = new Date(s); return isNaN(d) ? null : d;
  }
  function col(headers, words) {
    for (var i = 0; i < headers.length; i++) for (var j = 0; j < words.length; j++) if (headers[i].indexOf(words[j]) > -1) return i;
    return -1;
  }

  /* ---------- render ---------- */
  function entry(n) {
    var date = n.date ? n.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
    var thoughts = esc(n.text);
    return '<div class="gb-entry">' +
      '<table class="gb"><tr><th>Name:</th><td><b>' + esc(n.name || 'Anonymous') + '</b></td></tr>' +
      (date ? '<tr><th>Date:</th><td>' + esc(date) + '</td></tr>' : '') +
      (n.far ? '<tr><th>How far:</th><td>' + esc(n.far) + '</td></tr>' : '') +
      '<tr><th>Thoughts:</th><td>' + (n.spoiler
        ? '<div class="spoiler"><div class="spoiler-text">' + thoughts + '</div><button type="button" class="bevel spoiler-btn">&#9888;&#65039; SPOILER!! Click to read</button></div>'
        : '<div class="gb-text">' + thoughts + '</div>') + '</td></tr></table></div>';
  }
  function render() {
    var current = books[0];
    $('notesCount').innerHTML = current.notes.length
      ? '<b>' + current.notes.length + '</b> note' + (current.notes.length === 1 ? '' : 's') + ' so far!!'
      : '';
    $('notesList').innerHTML = current.notes.length
      ? current.notes.map(entry).join('<hr class="gb-hr">')
      : '<p class="center"><i>No notes yet! Be the FIRST to sign in!!</i></p>';
    renderHall('ok');
  }
  function month(d) { return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
  function stars(r) {
    var row = '\u2605\u2605\u2605\u2605\u2605';
    return '<span class="stars" role="img" aria-label="' + r + ' out of 5 stars"><span class="stars-base">' + row +
      '</span><span class="stars-fill" style="width:' + (r / 5 * 100) + '%">' + row + '</span></span>';
  }
  var SPINES = ['#7a1f1f', '#1f4e7a', '#2e6b2e', '#6b2e6b', '#8a5a00', '#004d4d', '#4d4d00', '#5a2a00'];
  function renderHall(notesState) {
    var list = $('hallList'); if (!list) return;
    var done = books.filter(function (b, i) { return (i > 0 || b.rating != null) && b.start.getTime() > 0; });
    if (!done.length) {
      list.innerHTML = '<p class="center"><i>Nothing in the Hall of Fame yet! When we finish <b>' + esc(books[0].title) +
        '</b>, it will show up right here with our rating and everybody\u2019s notes.</i></p>';
      return;
    }
    list.innerHTML = done.map(function (b, i) {
      var when = month(b.start), endM = b.end ? month(b.end) : '';
      var notesHtml = notesState === 'ok'
        ? (b.notes.length ? b.notes.map(entry).join('<hr class="gb-hr">') : '<p><i>Nobody left notes on this one.</i></p>')
        : notesState === 'error' ? '<p><i>Couldn\u2019t load the notes right now. Try refreshing!</i></p>'
        : notesState === 'off' ? '' : '<p><i>Loading notes&hellip;</i></p>';
      var label = notesState === 'ok' ? 'Read the ' + b.notes.length + ' note' + (b.notes.length === 1 ? '' : 's') : 'Read the notes';
      return '<div class="trophy">' +
        '<div class="spine" style="background:' + SPINES[i % SPINES.length] + '" aria-hidden="true"><span>' + esc(b.title) + '</span></div>' +
        '<div class="trophy-body">' +
        '<p class="trophy-title">' + esc(b.title) + '</p>' +
        (b.author ? '<p class="trophy-author">by ' + esc(b.author) + '</p>' : '') +
        '<p class="trophy-when">Read: ' + esc(when) + (endM && endM !== when ? ' to ' + esc(endM) : '') + '</p>' +
        '<p class="trophy-rating"><b>Group rating:</b> ' + (b.rating != null ? stars(b.rating) + ' <b>' + b.rating + '</b> out of 5' : '<i>not voted yet!</i>') + '</p>' +
        (b.verdict ? '<p class="verdict">&ldquo;' + esc(b.verdict) + '&rdquo; <span>~ the club</span></p>' : '') +
        (notesState === 'off' ? '' : '<details class="past"><summary>' + label + '</summary>' + notesHtml + '</details>') +
        '</div></div>';
    }).join('');
  }
  function load() {
    if (!isLink(csvLink)) { $('notesList').innerHTML = '<p class="center"><i>Reading notes are coming soon!!</i></p>'; renderHall('off'); return; }
    fetch(csvLink + (csvLink.indexOf('?') > -1 ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (text) {
        if (/^\s*</.test(text)) throw new Error('not csv');
        var rows = parseCSV(text);
        books.forEach(function (b) { b.notes = []; });
        if (rows.length > 1) {
          var h = rows[0].map(function (x) { return x.toLowerCase(); });
          var cT = col(h, ['timestamp', 'time', 'date']), cN = col(h, ['name']), cX = col(h, ['thought', 'note', 'comment']),
              cF = col(h, ['far', 'progress', 'where']), cS = col(h, ['spoil']);
          if (cX < 0) cX = h.length > 2 ? 2 : h.length - 1;
          rows.slice(1).forEach(function (r) {
            var text = (r[cX] || '').trim(); if (!text) return;
            var n = { date: cT > -1 ? parseStamp(r[cT]) : null, name: cN > -1 ? (r[cN] || '').trim() : '', text: text,
                      far: cF > -1 ? (r[cF] || '').trim() : '', spoiler: cS > -1 && /yes|spoil/i.test(r[cS] || '') };
            var home = books.filter(function (b) { return !n.date || b.start <= n.date; })[0] || books[books.length - 1];
            home.notes.push(n);
          });
          books.forEach(function (b) { b.notes.sort(function (a, c) { return (c.date || 0) - (a.date || 0); }); });
        }
        render();
      })
      .catch(function () {
        $('notesList').innerHTML = '<p class="center"><i>Couldn\u2019t load the notes right now. Try refreshing the page!</i></p>';
        renderHall('error');
      });
  }

  var fastTimer = null;
  function fastPoll() { // Google takes a few minutes to publish new notes
    clearInterval(fastTimer);
    var n = 0;
    fastTimer = setInterval(function () { load(); if (++n >= 8) clearInterval(fastTimer); }, 60000);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.spoiler-btn'); if (!b) return;
    b.parentNode.classList.add('open'); b.remove();
  });
  renderHall('loading');
  load();
  setInterval(function () { if (document.visibilityState === 'visible') load(); }, 180000);
})();
