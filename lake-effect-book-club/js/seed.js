/* ─────────────────────────────────────────────────────────────
   The starting Snowbank.
   Heads up: this file shows which tier each book is in. Once you've
   loaded it into your Google Sheet (Organizer → Setup → Load the
   starting list), you can delete this file from your repo and the
   weighting stays between you and the Sheet.
   ───────────────────────────────────────────────────────────── */
(function () {
  const W = window.TIER_WEIGHTS;
  const B = (tier, title, author, genres, pitch, extra) =>
    Object.assign({ tier, weight: W[tier], title, author, genres, pitch, source: tier === 'mention' ? 'mention' : 'seed' }, extra || {});

  window.SEED_BOOKS = [
    // ── Tier 1 ─────────────────────────────────────────
    B('t1', 'Sapiens', 'Yuval Noah Harari', 'Nonfiction, History',
      'A brisk, opinionated history of our species, from foragers to farmers to empires to whatever comes next.'),
    B('t1', 'Ballad of the Whiskey Robber', 'Julian Rubinstein', 'True crime, Sports',
      'A pelt smuggler from Transylvania plays goalie for a Budapest hockey team and robs banks on the side, fortified by whiskey. All true.'),
    B('t1', 'Ghost Town', 'Tom Perrotta', 'Fiction',
      'From Tom Perrotta, the sharp-eyed chronicler of suburbia behind Election and The Leftovers.'),
    // Stoner was picked by two members (one first, one second), so it carries both weights.
    B('t1', 'Stoner', 'John Williams', 'Literary fiction, Classics',
      'The quiet life of a Missouri farm boy turned English professor. One of the great rediscovered American novels.',
      { weight: W.t1 + W.t2 }),
    B('t1', 'Dungeon Crawler Carl', 'Matt Dinniman', 'Sci-fi, Fantasy',
      'Aliens demolish Earth and turn the survivors into contestants in an intergalactic dungeon game show. Carl has boxer shorts, his ex\u2019s show cat, and a grudge.'),
    B('t1', 'East of Eden', 'John Steinbeck', 'Classics, Literary fiction',
      'Steinbeck\u2019s sprawling Salinas Valley saga of two families, two sets of brothers, and the choice between good and evil.'),
    B('t1', 'Ancillary Justice', 'Ann Leckie', 'Sci-fi',
      'A warship\u2019s AI, stuck in a single human body, chases revenge across a galactic empire. Won the Hugo, Nebula and Clarke awards.'),

    // ── Tier 2 ─────────────────────────────────────────
    B('t2', 'Endurance', 'Alfred Lansing', 'Adventure, History',
      'The Antarctic ice crushes Shackleton\u2019s ship and 28 men have to get themselves home. Possibly the ultimate winter read.'),
    B('t2', 'Billion Dollar Whale', 'Tom Wright & Bradley Hope', 'True crime, Business',
      'How a young Malaysian financier helped siphon billions from a national investment fund, partying with Hollywood along the way.'),
    B('t2', 'The End of Everything', 'M. John Harrison', 'Fiction',
      'From M. John Harrison, the British master of the strange and unsettling.'),
    B('t2', 'Piranesi', 'Susanna Clarke', 'Fantasy, Literary fiction',
      'A man lives alone in an endless house of statues and tides, keeping meticulous journals. Short, strange and beautiful.'),
    B('t2', 'Dark Matter', 'Blake Crouch', 'Sci-fi, Thriller',
      'A Chicago physics professor is abducted and wakes up inside a life he didn\u2019t choose. A fast multiverse thriller.'),
    B('t2', 'Thinking, Fast and Slow', 'Daniel Kahneman', 'Psychology, Nonfiction',
      'A Nobel laureate on the two systems that drive how we think, and the predictable ways they fool us.'),

    // ── Tier 3 ─────────────────────────────────────────
    B('t3', 'The Ra Expeditions', 'Thor Heyerdahl', 'Adventure, History',
      'The Kon-Tiki explorer tries to cross the Atlantic on a papyrus-reed boat to show how far ancient sailors could have gone.'),
    B('t3', 'Words for My Comrades', 'Dean Van Nguyen', 'Music, Politics',
      'A political history of Tupac Shakur, from his Black Panther roots to the politics in his lyrics.'),
    B('t3', 'Darkness at Noon', 'Arthur Koestler', 'Classics, Dystopian',
      'An old revolutionary, imprisoned by the regime he helped build, faces his interrogators. A landmark political novel.'),
    B('t3', 'Neuromancer', 'William Gibson', 'Sci-fi, Classics',
      'The novel that invented cyberpunk: a burned-out hacker, one last job, and an AI with plans of its own.'),
    B('t3', 'The Wide Wide Sea', 'Hampton Sides', 'History, Adventure',
      'Captain Cook\u2019s third and final Pacific voyage, and how it came apart in Hawai\u02bbi.'),
    B('t3', 'Red Rising', 'Pierce Brown', 'Sci-fi, Dystopian',
      'On a caste-ruled Mars, a young miner infiltrates the ruling class to bring it down.'),

    // ── Books that stuck with us (from the survey) ─────
    B('mention', 'The Lord of the Rings', 'J.R.R. Tolkien', 'Fantasy, Classics',
      'The one that started it all.', { why: 'Named by two members.' }),
    B('mention', 'Dispatches', 'Michael Herr', 'Nonfiction, War',
      'A hallucinatory first-hand account of the Vietnam War.'),
    B('mention', 'An Alternative History of Cleveland', '', 'History, Cleveland', 'A hometown pick.'),
    B('mention', 'Noise', 'Daniel Kahneman, Olivier Sibony & Cass Sunstein', 'Psychology, Nonfiction',
      'Why human judgments vary so wildly, and what to do about it.'),
    B('mention', 'Meet Me in the Bathroom', 'Lizzy Goodman', 'Music, Nonfiction',
      'An oral history of the 2000s New York rock scene.'),
    B('mention', 'Blood Meridian', 'Cormac McCarthy', 'Literary fiction, Western',
      'McCarthy\u2019s brutal, biblical Western.'),
    B('mention', 'The Tiger', 'John Vaillant', 'Nonfiction, Adventure',
      'A man-eating Amur tiger in the Russian Far East. A true story.'),
    B('mention', 'A Feast of Snakes', 'Harry Crews', 'Literary fiction, Southern Gothic',
      'Southern Gothic at its most feral.'),
    B('mention', 'The Hitchhiker\u2019s Guide to the Galaxy', 'Douglas Adams', 'Sci-fi, Humor',
      'Don\u2019t panic.'),
    B('mention', 'A Farewell to Arms', 'Ernest Hemingway', 'Classics',
      'Love and war on the Italian front.'),
    B('mention', 'The Road', 'Cormac McCarthy', 'Literary fiction, Dystopian',
      'A father and son cross a burned-out America.'),
    B('mention', 'Dune', 'Frank Herbert', 'Sci-fi, Classics', 'Desert planet, spice, prophecy, politics.'),
    B('mention', 'Hyperion', 'Dan Simmons', 'Sci-fi', 'Seven pilgrims trade their stories on the way to meet a monster.'),
    B('mention', 'The Social Transformation of American Medicine', 'Paul Starr', 'History, Medicine',
      'How American medicine became a profession, and an industry.'),
    B('mention', 'Grant', 'Ron Chernow', 'History, Biography', 'The general and president, in full.'),
    B('mention', 'To the Edge of the World', '', '', ''),
    B('mention', 'Lonesome Dove', 'Larry McMurtry', 'Western, Classics', 'Two old Texas Rangers drive cattle to Montana.'),
    B('mention', 'Nexus', 'Ramez Naam', 'Sci-fi', 'A drug that links human minds, and everyone who wants it.',
      { why: 'One member would happily reread the whole series.' }),
    B('mention', 'The Manager\u2019s Path', 'Camille Fournier', 'Leadership', 'A field guide to leading people who build things.'),
    B('mention', 'Dragonlance Chronicles', 'Margaret Weis & Tracy Hickman', 'Fantasy', 'Dragons return to Krynn.')
  ];
})();
