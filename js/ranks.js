/* Coffee ranks: the player's progression title, earned by completing numbered levels.
   All rank data lives in RANKS below; everything else asks CC.Ranks. To add a rank,
   fill in its entry (set `ready: true`, `levels`, `description`, `badge`). */
(function () {
  'use strict';

  const CC = window.CC;
  const Save = CC.Save;

  // Badge artwork: each rank's cup, drawn on a 64x64 canvas.
  const BADGES = {
    // A plain white diner mug of everyday coffee, with a curl of steam.
    houseBlend: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M26 15 C23 11 29 8 26 3" fill="none" stroke="#b9a58c" stroke-width="3" stroke-linecap="round"/>
      <path d="M35 16 C32 12 38 9 35 4" fill="none" stroke="#b9a58c" stroke-width="3" stroke-linecap="round"/>
      <path d="M46 29 C57 28 57 45 44 44" fill="none" stroke="#2b2a33" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M46 29 C54 29 54 42 44 42" fill="none" stroke="#fffaf1" stroke-width="3" stroke-linecap="round"/>
      <path d="M14 22 H48 V46 A8 8 0 0 1 40 54 H22 A8 8 0 0 1 14 46 Z" fill="#fffaf1" stroke="#2b2a33" stroke-width="3" stroke-linejoin="round"/>
      <path d="M14 30 H48" stroke="#ff6b5b" stroke-width="3"/>
      <ellipse cx="31" cy="22" rx="17" ry="4.5" fill="#6b3f1f" stroke="#2b2a33" stroke-width="3"/>
      <ellipse cx="28" cy="21.3" rx="6" ry="1.4" fill="#9a6036"/>
      <path d="M19 36 V46" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity="0.9"/>
    </svg>`,
  };

  // The full ladder. `levels` is how many numbered levels must be completed to reach
  // a rank. Ranks marked `ready: false` are planned but not in the game yet: they show
  // as locked and can't be earned until they're filled in.
  const RANKS = [
    {
      id: 'house-blend',
      number: 1,
      name: 'House Blend',
      description: 'Fresh off the press.',
      levels: 0,
      badge: 'houseBlend',
      color: '#c98a52',
      ready: true,
    },
    { id: 'french-roast', number: 2, name: 'French Roast', ready: false },
    { id: 'espresso', number: 3, name: 'Espresso', ready: false },
    { id: 'cappuccino', number: 4, name: 'Cappuccino', ready: false },
    { id: 'cafe-mocha', number: 5, name: 'Café Mocha', ready: false },
    { id: 'vienna-roast', number: 6, name: 'Vienna Roast', ready: false },
    { id: 'kona-reserve', number: 7, name: 'Kona Reserve', ready: false },
    { id: 'geisha-reserve', number: 8, name: 'Geisha Reserve', ready: false },
    { id: 'black-label', number: 9, name: 'Black Label', ready: false },
    { id: 'daily-legend', number: 10, name: 'The Daily Legend', ready: false },
  ];

  const playable = () => RANKS.filter((r) => r.ready);

  // Numbered levels completed in a row from level 1 (the same count that unlocks levels).
  function levelsCompleted() {
    return Save.nextLevel() - 1;
  }

  // Highest ready rank whose level requirement is met.
  function rankFor(levels) {
    let current = RANKS[0];
    playable().forEach((r) => {
      if (levels >= r.levels && r.number > current.number) current = r;
    });
    return current;
  }

  function badgeHtml(rank) {
    return BADGES[rank.badge] || BADGES.houseBlend;
  }

  CC.Ranks = {
    all: RANKS,
    total: RANKS.length,
    badgeHtml,

    current() {
      return rankFor(levelsCompleted());
    },

    // The next rank up, and how far along the player is. `ready` is false while the
    // next rank hasn't been added to the game yet.
    progress() {
      const done = levelsCompleted();
      const cur = rankFor(done);
      const next = RANKS[cur.number] || null; // RANKS is ordered, number = index + 1
      if (!next) return { current: cur, next: null, fraction: 1, levelsToGo: 0 };
      if (!next.ready) return { current: cur, next, fraction: 0, levelsToGo: null };
      const span = Math.max(1, next.levels - cur.levels);
      return {
        current: cur,
        next,
        fraction: CC.clamp((done - cur.levels) / span, 0, 1),
        levelsToGo: Math.max(0, next.levels - done),
      };
    },

    // Call after progress changes. Returns the new rank if the player just moved up,
    // otherwise null. The highest rank reached is saved so promotions fire only once.
    checkPromotion() {
      const cur = this.current();
      const seen = Save.progress.rank || 1;
      if (cur.number <= seen) return null;
      Save.progress.rank = cur.number;
      Save.saveProgress();
      return cur;
    },
  };

  // New and older saves start at (or catch up to) their rank without a promotion fanfare.
  if (!Save.progress.rank) {
    Save.progress.rank = CC.Ranks.current().number;
    Save.saveProgress();
  }
})();
