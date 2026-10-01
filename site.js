/* ~*~ site.js : all the bells and whistles ~*~ */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; }
  }

  /* ---------- 8-bit sound (shared with the game) ---------- */
  var ctx = null;
  function audio() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, start, dur, type, vol) {
    var a = audio(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    var t = a.currentTime + (start || 0);
    g.gain.setValueAtTime(vol || 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  window.Beep = {
    muted: store('pp-muted') === '1',
    play: function (notes) { // [[freq, startSec, durSec], ...]
      if (this.muted) return;
      notes.forEach(function (n) { tone(n[0], n[1], n[2], n[3], n[4]); });
    },
    toggle: function () { this.muted = !this.muted; store('pp-muted', this.muted ? '1' : '0'); return this.muted; }
  };

  /* ---------- WordArt wave ---------- */
  var wa = $('wordart');
  if (wa) {
    var text = wa.textContent; wa.textContent = '';
    wa.setAttribute('aria-label', text);
    Array.prototype.forEach.call(text, function (c, i) {
      var s = document.createElement('span');
      s.setAttribute('aria-hidden', 'true');
      if (c === ' ') { s.className = 'sp'; } else {
        s.className = 'ch'; s.textContent = c;
        s.style.transform = 'translateY(' + (Math.sin(i / 2.2) * 10).toFixed(1) + 'px) rotate(' + (Math.cos(i / 2.2) * -6).toFixed(1) + 'deg)';
      }
      wa.appendChild(s);
    });
  }

  /* ---------- falling snow ---------- */
  if (!reduce) {
    var sf = $('snowfall'), chars = ['*', '\u2744', '*', '\u2745', '*'];
    for (var i = 0; i < 34; i++) {
      var f = document.createElement('span');
      f.className = 'flake';
      f.textContent = chars[i % chars.length];
      f.style.left = (Math.random() * 100) + 'vw';
      f.style.fontSize = (10 + Math.random() * 16) + 'px';
      f.style.opacity = (0.5 + Math.random() * 0.5).toFixed(2);
      f.style.animationDuration = (9 + Math.random() * 12) + 's';
      f.style.animationDelay = (-Math.random() * 20) + 's';
      sf.appendChild(f);
    }
  } else {
    Array.prototype.forEach.call(document.querySelectorAll('marquee'), function (m) { if (m.stop) m.stop(); });
  }

  /* ---------- sparkle cursor trail ---------- */
  if (!reduce && window.matchMedia('(pointer: fine)').matches) {
    var last = 0, colors = ['#ff0', '#f0f', '#0ff', '#fff', '#f90'];
    document.addEventListener('mousemove', function (e) {
      var now = Date.now(); if (now - last < 45) return; last = now;
      var s = document.createElement('span');
      s.className = 'sparkle'; s.textContent = Math.random() < 0.5 ? '*' : '+';
      s.style.left = (e.clientX + 6) + 'px'; s.style.top = (e.clientY + 4) + 'px';
      s.style.color = colors[Math.floor(Math.random() * colors.length)];
      document.body.appendChild(s);
      setTimeout(function () { s.remove(); }, 800);
    });
  }

  /* ---------- visit counter (this computer) ---------- */
  var visits = (parseInt(store('lebc-visits'), 10) || 0) + 1;
  store('lebc-visits', String(visits));
  var od = $('odometer');
  if (od) {
    od.innerHTML = '';
    String(visits).padStart(6, '0').split('').forEach(function (d) {
      var s = document.createElement('span'); s.textContent = d; od.appendChild(s);
    });
    od.setAttribute('aria-label', visits + ' visits');
  }

  /* ---------- meeting countdown ---------- */
  var t = $('meetingTime'), cd = $('countdown');
  if (t && cd) {
    var when = new Date(t.getAttribute('datetime'));
    if (isNaN(when)) { cd.hidden = true; } else {
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var day = new Date(when); day.setHours(0, 0, 0, 0);
      var n = Math.round((day - today) / 864e5);
      if (n > 1) cd.innerHTML = 'Only <span class="blink">' + n + '</span> DAYS until we meet!!!';
      else if (n === 1) cd.textContent = 'We meet TOMORROW!!! Finish that chapter!';
      else if (n === 0) cd.textContent = 'TODAY IS THE DAY!!! See you there!';
      else cd.textContent = 'This meeting already happened! (Webmaster, please update me!)';
    }
  }

  /* ---------- member stickers ---------- */
  var list = $('memberList');
  if (list) {
    var stickers = ['\u2B50', '\uD83C\uDF4E', '\uD83D\uDCDA', '\u270F\uFE0F', '\uD83C\uDF55', '\u2744\uFE0F', '\uD83E\uDD89', '\uD83C\uDF1F'];
    var items = list.querySelectorAll('li');
    Array.prototype.forEach.call(items, function (li, i) {
      var s = document.createElement('span');
      s.className = 'sticker'; s.setAttribute('aria-hidden', 'true');
      s.textContent = stickers[i % stickers.length];
      li.insertBefore(s, li.firstChild);
    });
    var mc = $('memberCount');
    if (mc) mc.innerHTML = 'We have <b>' + items.length + '</b> wonderful members!!';
  }

  /* ---------- "MIDI" player: Fur Elise in glorious square waves ---------- */
  var tune = [[76,1],[75,1],[76,1],[75,1],[76,1],[71,1],[74,1],[72,1],[69,3],[60,1],[64,1],[69,1],[71,3],[64,1],[68,1],[71,1],[72,3],
              [64,1],[76,1],[75,1],[76,1],[75,1],[76,1],[71,1],[74,1],[72,1],[69,3],[60,1],[64,1],[69,1],[71,3],[64,1],[72,1],[71,1],[69,4]];
  var midiBtn = $('midiBtn'), playing = false, loopTimer = null;
  function playTune() {
    var a = audio(); if (!a) return;
    var beat = 0.2, at = 0;
    tune.forEach(function (n) {
      tone(440 * Math.pow(2, (n[0] - 69) / 12), at, n[1] * beat * 0.95, 'triangle', 0.08);
      at += n[1] * beat;
    });
    loopTimer = setTimeout(function () { if (playing) playTune(); }, at * 1000 + 600);
  }
  if (midiBtn) midiBtn.addEventListener('click', function () {
    playing = !playing;
    midiBtn.innerHTML = playing ? '&#9632; STOP' : '&#9654; PLAY';
    if (playing) playTune(); else { clearTimeout(loopTimer); if (ctx) { ctx.close(); ctx = null; } }
  });

  /* ---------- webring + last updated ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-webring]'), function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); alert('Sorry!!! This WebRing is still UNDER CONSTRUCTION. Please check back soon!'); });
  });
  var lu = $('lastUpdated');
  if (lu) {
    var d = new Date(document.lastModified);
    lu.textContent = isNaN(d) ? 'recently' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
})();
