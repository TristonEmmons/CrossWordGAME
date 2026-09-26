/* Difficulty curve and per-level word selection from the shared word library. */
(function () {
  'use strict';

  const CC = window.CC;

  // Each tier: first level it applies to, grid size, word count range, word length range,
  // and the placement directions allowed. Backwards words arrive at level 6 and
  // diagonals at level 11, so the first levels are gentle "read it normally" puzzles.
  const TIERS = [
    { from: 1, grid: 20, words: [8, 10], len: [3, 6], dirs: ['E', 'S'] },
    { from: 6, grid: 23, words: [10, 13], len: [4, 7], dirs: ['E', 'S', 'W', 'N'] },
    { from: 11, grid: 26, words: [13, 16], len: [5, 8], dirs: ['E', 'S', 'W', 'N', 'SE', 'NE'] },
    { from: 16, grid: 29, words: [16, 20], len: [6, 9], dirs: ['E', 'S', 'W', 'N', 'SE', 'NE'] },
    { from: 21, grid: 32, words: [20, 24], len: [7, 10], dirs: Object.keys(CC.DIRS) },
    { from: 26, grid: 35, words: [24, 30], len: [7, 12], dirs: Object.keys(CC.DIRS) },
  ];

  // Phones get smaller boards so the letters stay big enough to read and tap. Each tier
  // has a phone board size and a cap on the word count; the words come from the same
  // level (the first few of its list), so it's the same puzzle, just a smaller page.
  const PHONE = {
    1: { grid: 12, maxWords: 9 },
    6: { grid: 13, maxWords: 10 },
    11: { grid: 14, maxWords: 11 },
    16: { grid: 15, maxWords: 11 },
    21: { grid: 15, maxWords: 11 },
    26: { grid: 16, maxWords: 12 },
  };

  // True on phones: the screen's short side is under 600px. Based on the device rather
  // than the window, so resizing a computer's window never swaps the board mid-game.
  // Returns false (computers, tablets), 'phone', or 'small' (short phones like an
  // iPhone SE, which get boards two squares smaller again).
  CC.compactBoards = function () {
    const s = window.screen || {};
    const w = s.width || window.innerWidth;
    const h = s.height || window.innerHeight;
    if (Math.min(w, h) >= 600) return false;
    return Math.max(w, h) < 700 ? 'small' : 'phone';
  };

  CC.levelConfig = function (level, compact) {
    let tier = TIERS[0];
    TIERS.forEach((t) => {
      if (level >= t.from) tier = t;
    });
    let words = tier.words.slice();
    if (tier.from === 26) {
      // "24–30+": keep nudging the word count up slowly past level 26.
      const extra = Math.min(8, Math.floor((level - 26) / 4));
      words = [words[0] + extra, words[1] + extra];
    }
    const phone = compact ? PHONE[tier.from] : null;
    const small = compact === 'small';
    return {
      level,
      compact: !!phone,
      gridSize: phone ? phone.grid - (small ? 2 : 0) : tier.grid,
      minWords: words[0],
      maxWords: words[1],
      // How many of the level's words a phone board shows.
      showWords: phone ? phone.maxWords - (small ? 1 : 0) : Infinity,
      minLen: tier.len[0],
      maxLen: tier.len[1],
      dirs: tier.dirs,
    };
  };

  // True if either word (or its reverse) hides inside the other, which would make
  // one of them findable in two places on the board.
  function overlapsExisting(word, chosen) {
    const rev = word.split('').reverse().join('');
    return chosen.some((w) => w.includes(word) || w.includes(rev) || word.includes(w) || rev.includes(w));
  }

  // Draws `count` unused library words in the level's length range. Words that overlap
  // anything in `avoid` (or each other) are skipped so every word has one home on the board.
  function drawWords(config, rng, count, avoid, ignoreUsed) {
    const library = window.WORD_LIBRARY || {};
    const taken = (avoid || []).slice();
    const chosen = [];
    const pools = {};
    for (let len = config.minLen; len <= config.maxLen; len++) {
      const bucket = (library[len] || []).map((w) => w.toUpperCase());
      const fresh = ignoreUsed ? bucket : bucket.filter((w) => !CC.Save.isUsed(w));
      // If a bucket is ever exhausted, fall back to reusing words rather than failing.
      pools[len] = rng.shuffle(fresh.length ? fresh : bucket.slice());
    }
    const lengths = Object.keys(pools).map(Number).filter((l) => pools[l].length);

    let guard = 0;
    while (chosen.length < count && guard++ < 5000) {
      const len = rng.pick(lengths);
      const word = pools[len].pop();
      if (!word) continue;
      if (overlapsExisting(word, taken)) continue;
      chosen.push(word);
      taken.push(word);
    }
    return chosen;
  }

  const MIN_BONUS = 1;
  const MAX_BONUS = 3;

  function drawBonus(config, rng, listed) {
    return drawWords(config, rng, rng.int(MIN_BONUS, MAX_BONUS), listed);
  }

  // ---- Today's Paper: one small, easy puzzle per calendar day ----

  const DAILY = { gridSize: 15, minWords: 5, maxWords: 5, minLen: 3, maxLen: 6, dirs: ['E', 'S'] };
  const DAILY_PREFIX = 'daily-';

  CC.dailyLevelId = (dateKey) => DAILY_PREFIX + (dateKey || CC.todayKey());
  CC.isDaily = (level) => typeof level === 'string' && level.indexOf(DAILY_PREFIX) === 0;
  // A stable number for a daily puzzle (for seeds, music and newspaper copy).
  CC.dailyNumber = (level) => Number(String(level).slice(DAILY_PREFIX.length).replace(/-/g, '')) || 1;

  // Everyone gets the same paper on the same day: the words come only from the date,
  // not from which words this player has already seen.
  function loadDaily(level) {
    const seed = CC.dailyNumber(level) * 2654435761 >>> 0;
    const rng = CC.makeRng(seed);
    const words = drawWords(DAILY, rng, DAILY.minWords, [], true);
    const bonus = drawWords(DAILY, rng, 1, words, true);
    const puzzle = CC.generatePuzzle(words, DAILY, seed, bonus);
    puzzle.level = level;
    puzzle.config = DAILY;
    puzzle.daily = true;
    return puzzle;
  }

  // Returns a ready-to-play puzzle for the level. The first time a level loads its words
  // are drawn from the library (never repeating across levels) and remembered, so the
  // same level always rebuilds the same board.
  CC.loadLevel = function (level) {
    if (CC.isDaily(level)) return loadDaily(level);
    const compact = CC.compactBoards();
    const config = CC.levelConfig(level, compact);
    const progress = CC.Save.progress;
    let record = progress.levels[level];

    if (!record) {
      const seed = CC.randomSeed();
      const rng = CC.makeRng(seed);
      const words = drawWords(config, rng, rng.int(config.minWords, config.maxWords));
      const bonus = drawBonus(config, rng, words);
      record = { seed, words, bonus };
      progress.levels[level] = record;
      CC.Save.markUsed(words.concat(bonus));
      CC.Save.saveProgress();
    } else if (!record.bonus) {
      // Level saved before bonus words existed. Adding them changes the board, so only
      // do it when there's no half-finished game on it; otherwise it goes without.
      record.bonus = progress.inProgress[level] ? [] : drawBonus(config, CC.makeRng(record.seed ^ 0x5bd1e995), record.words);
      CC.Save.markUsed(record.bonus);
      CC.Save.saveProgress();
    }

    const words = record.words.slice(0, config.showWords);
    const puzzle = CC.generatePuzzle(words, config, record.seed, record.bonus);
    puzzle.level = level;
    puzzle.config = config;
    return puzzle;
  };
})();
