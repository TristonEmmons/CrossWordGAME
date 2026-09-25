/* Coffee ranks: the player's progression title, earned by completing numbered levels.
   All rank data lives in RANKS below; everything else asks CC.Ranks. To add a rank,
   fill in its entry (`ready: true`, `levels`, `description`, `badge`, `color`,
   `accent`, and optionally `trim` and `mascot`) and add its artwork to BADGES / MASCOT_EXTRAS. */
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

    // French Roast: a darker, bolder mug in roasted brown with a gold rim, near-black
    // coffee and heavier steam. One step fancier than the diner mug.
    frenchRoast: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M24 15 C20 10 28 7 24 1" fill="none" stroke="#8a7560" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M32 15 C28 10 36 7 32 1" fill="none" stroke="#8a7560" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M40 15 C36 10 44 7 40 1" fill="none" stroke="#8a7560" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M46 29 C57 28 57 45 44 44" fill="none" stroke="#2b2a33" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M46 29 C54 29 54 42 44 42" fill="none" stroke="#5a3320" stroke-width="3" stroke-linecap="round"/>
      <path d="M14 22 H48 V46 A8 8 0 0 1 40 54 H22 A8 8 0 0 1 14 46 Z" fill="#5a3320" stroke="#2b2a33" stroke-width="3" stroke-linejoin="round"/>
      <path d="M14 31 H48" stroke="#e0b44c" stroke-width="3"/>
      <path d="M14 35.5 H48" stroke="#e0b44c" stroke-width="1.4"/>
      <ellipse cx="31" cy="22" rx="17" ry="4.5" fill="#24140b" stroke="#e0b44c" stroke-width="3"/>
      <ellipse cx="28" cy="21.3" rx="6" ry="1.4" fill="#4a2a17"/>
      <path d="M19 40 V47" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity="0.45"/>
    </svg>`,

    // Espresso: a small demitasse on a saucer with a golden crema top and speed streaks
    // off the left side. Compact, sharp and quick.
    espresso: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M3 30 H11 M1 37 H10 M4 44 H11" stroke="#2b2a33" stroke-width="3" stroke-linecap="round"/>
      <path d="M31 19 C28 15 34 12 31 7" fill="none" stroke="#8a7560" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M44 30 C53 29 53 42 42 41" fill="none" stroke="#2b2a33" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M44 30 C50 30 50 39 42 39" fill="none" stroke="#fffaf1" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="31" cy="52" rx="23" ry="5" fill="#fffaf1" stroke="#2b2a33" stroke-width="3"/>
      <path d="M17 25 H45 V40 A9 9 0 0 1 36 49 H26 A9 9 0 0 1 17 40 Z" fill="#fffaf1" stroke="#2b2a33" stroke-width="3" stroke-linejoin="round"/>
      <path d="M17 31 H45" stroke="#1f130c" stroke-width="3"/>
      <ellipse cx="31" cy="25" rx="14" ry="4" fill="#d8a35a" stroke="#2b2a33" stroke-width="3"/>
      <path d="M24 24.6 C28 23.4 33 26.4 38 24.4" fill="none" stroke="#f3d39a" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M21 35 V41" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.9"/>
    </svg>`,
  };

  // Small extras worn by the menu mascot. A rank lists the extras it wears in `mascot`;
  // each is SVG content on the mascot picture's own 512x512 canvas, so it lines up with
  // the cup and bobs and hops along with it.
  const MASCOT_EXTRAS = {
    // A black beret tipped over the cup's left rim, leaving the heart and steam visible.
    beret: `
      <g transform="rotate(-14 170 160)">
        <ellipse cx="178" cy="174" rx="64" ry="13" fill="#1e1b22"/>
        <path d="M68 150 C66 118 132 102 184 104 C246 106 284 126 276 150 C268 172 212 180 170 178 C120 176 70 172 68 150 Z" fill="#2b2a33" stroke="#1e1b22" stroke-width="6" stroke-linejoin="round"/>
        <path d="M98 132 C124 118 156 114 188 115" fill="none" stroke="#5b5866" stroke-width="7" stroke-linecap="round"/>
        <path d="M180 106 C178 94 184 86 193 85" fill="none" stroke="#2b2a33" stroke-width="9" stroke-linecap="round"/>
      </g>`,

    // A gold coffee-bean pin on the front of the beret.
    beanPin: `
      <g transform="rotate(-14 170 160) rotate(-30 118 150)">
        <ellipse cx="118" cy="150" rx="15" ry="21" fill="#e0b44c" stroke="#1e1b22" stroke-width="5"/>
        <path d="M118 131 C109 142 127 158 118 169" fill="none" stroke="#1e1b22" stroke-width="4.5" stroke-linecap="round"/>
        <ellipse cx="112" cy="141" rx="3.5" ry="6" fill="#fff4cf" opacity="0.9"/>
      </g>`,
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
      accent: '#e8b98a',
      mascot: [],
      ready: true,
    },
    {
      id: 'french-roast',
      number: 2,
      name: 'French Roast',
      description: 'Bold enough for the morning edition.',
      levels: 5,
      badge: 'frenchRoast',
      color: '#5a3320',
      accent: '#e0b44c',
      mascot: ['beret'],
      ready: true,
    },
    {
      id: 'espresso',
      number: 3,
      name: 'Espresso',
      description: 'Small cup. Serious solver.',
      levels: 10,
      badge: 'espresso',
      color: '#1f130c',
      accent: '#d8a35a',
      trim: '#e0b44c',
      mascot: ['beret', 'beanPin'],
      ready: true,
    },
    { id: 'cappuccino', number: 4, name: 'Cappuccino', ready: false },
    { id: 'cafe-mocha', number: 5, name: 'Café Mocha', ready: false },
    { id: 'vienna-roast', number: 6, name: 'Vienna Roast', ready: false },
    { id: 'kona-reserve', number: 7, name: 'Kona Reserve', ready: false },
    { id: 'geisha-reserve', number: 8, name: 'Geisha Reserve', ready: false },
    { id: 'black-label', number: 9, name: 'Black Label', ready: false },
    { id: 'daily-legend', number: 10, name: 'The Daily Legend', ready: false },
  ];

  // Numbered levels completed in a row from level 1 (the same count that unlocks levels).
  function levelsCompleted() {
    return Save.nextLevel() - 1;
  }

  // Climbs the ladder in order and stops at the first rank that isn't in the game yet or
  // isn't earned, so a rank can never be passed over.
  function rankFor(levels) {
    let current = RANKS[0];
    for (const r of RANKS.slice(1)) {
      if (!r.ready || levels < r.levels) break;
      current = r;
    }
    return current;
  }

  function badgeHtml(rank) {
    return BADGES[rank.badge] || BADGES.houseBlend;
  }

  // What the menu mascot wears at this rank, as one SVG ('' for nothing).
  function mascotHtml(rank) {
    const parts = (rank.mascot || []).map((k) => MASCOT_EXTRAS[k] || '').join('');
    return parts ? `<svg viewBox="0 0 512 512" aria-hidden="true">${parts}</svg>` : '';
  }

  // A rank's colors as CSS custom properties, for the badge ring and anything themed by rank.
  function colors(rank) {
    return {
      '--rank-color': rank.color,
      '--rank-accent': rank.accent || '#e8b98a',
      '--rank-trim': rank.trim || 'transparent',
    };
  }

  // Sets a rank's colors on an element.
  function paint(node, rank) {
    Object.entries(colors(rank)).forEach(([k, v]) => node.style.setProperty(k, v));
  }

  // The same colors as an inline `style` value, for HTML built as a string.
  function styleAttr(rank) {
    return Object.entries(colors(rank)).map(([k, v]) => `${k}:${v}`).join(';');
  }

  CC.Ranks = {
    all: RANKS,
    total: RANKS.length,
    badgeHtml,
    mascotHtml,
    paint,
    styleAttr,

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
    // otherwise null. The highest rank reached is saved (every save starts at 1), so each
    // promotion fires once, including for older saves that already qualify.
    checkPromotion() {
      const cur = this.current();
      const seen = Save.progress.rank || 1;
      if (cur.number <= seen) return null;
      Save.progress.rank = cur.number;
      Save.saveProgress();
      return cur;
    },
  };
})();
