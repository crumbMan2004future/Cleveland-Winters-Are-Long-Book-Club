/* ─────────────────────────────────────────────────────────────
   Club settings — the only file you need to edit.
   ───────────────────────────────────────────────────────────── */
window.CLUB_CONFIG = {
  // Paste your Google Apps Script web app URL here (see README).
  // Leave it empty to run in demo mode: everything is saved only in your own browser.
  apiUrl: '',

  clubName: 'Lake Effect Book Club',
  intro: 'A Cleveland book club for the long winter. One book a month, picked by shaking the snow globe.',

  // Demo mode only. Once the Sheet is connected, the passphrase lives in the Apps Script.
  demoPassphrase: 'lakeeffect',

  // Used to pre-fill the next gathering date when a new book is picked.
  daysBetweenGatherings: 35,

  // From the "favorite genres" survey answers: [genre, how many of us named it].
  genres: [
    ['Nonfiction', 3],
    ['Sci-fi', 3],
    ['Fantasy', 2],
    ['Sports & sports-adjacent', 2],
    ['Historical nonfiction', 1],
    ['Historical fiction', 1],
    ['Classics', 1],
    ['Literary fiction', 1],
    ['Dystopian', 1],
    ['Mystery', 1],
    ['True crime', 1],
    ['Medical economics', 1],
    ['Leadership', 1],
    ['Books that change how you think', 1]
  ]
};
