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

  CC.levelConfig = function (level) {
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
    return {
      level,
      gridSize: tier.grid,
      minWords: words[0],
      maxWords: words[1],
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

  function drawWords(config, rng) {
    const library = window.WORD_LIBRARY || {};
    const count = rng.int(config.minWords, config.maxWords);
    const chosen = [];
    const pools = {};
    for (let len = config.minLen; len <= config.maxLen; len++) {
      const bucket = (library[len] || []).map((w) => w.toUpperCase());
      const fresh = bucket.filter((w) => !CC.Save.isUsed(w));
      // If a bucket is ever exhausted, fall back to reusing words rather than failing.
      pools[len] = rng.shuffle(fresh.length ? fresh : bucket.slice());
    }
    const lengths = Object.keys(pools).map(Number).filter((l) => pools[l].length);

    let guard = 0;
    while (chosen.length < count && guard++ < 5000) {
      const len = rng.pick(lengths);
      const word = pools[len].pop();
      if (!word) continue;
      if (overlapsExisting(word, chosen)) continue;
      chosen.push(word);
    }
    return chosen;
  }

  // Returns a ready-to-play puzzle for the level. The first time a level loads its words
  // are drawn from the library (never repeating across levels) and remembered, so the
  // same level always rebuilds the same board.
  CC.loadLevel = function (level) {
    const config = CC.levelConfig(level);
    const progress = CC.Save.progress;
    let record = progress.levels[level];

    if (!record) {
      const seed = CC.randomSeed();
      const words = drawWords(config, CC.makeRng(seed));
      record = { seed, words };
      progress.levels[level] = record;
      CC.Save.markUsed(words);
      CC.Save.saveProgress();
    }

    const puzzle = CC.generatePuzzle(record.words, config, record.seed);
    puzzle.level = level;
    puzzle.config = config;
    return puzzle;
  };
})();
