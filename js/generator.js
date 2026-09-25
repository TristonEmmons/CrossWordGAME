/* Word-search grid generator: backtracking word placement plus frequency-weighted filler. */
(function () {
  'use strict';

  const CC = window.CC;

  // Filler letters weighted toward common English letters so the board reads like
  // language rather than noise. Rare letters (J, Q, X, Z) still appear, just seldom.
  const FILLER_WEIGHTS = {
    E: 12.0, A: 9.0, R: 7.5, S: 7.5, T: 8.0, I: 7.5, O: 7.5, N: 7.0, L: 5.0, H: 3.5,
    D: 4.0, C: 3.5, U: 3.3, M: 2.8, P: 2.6, G: 2.4, B: 2.0, Y: 1.8, F: 1.8, W: 1.6,
    K: 1.0, V: 1.0, X: 0.25, J: 0.2, Q: 0.15, Z: 0.2,
  };
  const FILLER_TABLE = (function () {
    const table = [];
    let acc = 0;
    Object.keys(FILLER_WEIGHTS).forEach((letter) => {
      acc += FILLER_WEIGHTS[letter];
      table.push([acc, letter]);
    });
    return { table, total: acc };
  })();

  function fillerLetter(rng) {
    const x = rng() * FILLER_TABLE.total;
    for (let i = 0; i < FILLER_TABLE.table.length; i++) {
      if (x < FILLER_TABLE.table[i][0]) return FILLER_TABLE.table[i][1];
    }
    return 'E';
  }

  const STEP_BUDGET = 40000; // total placement attempts before starting over
  const TRIES_PER_WORD = 80; // candidate spots tried for a word before backtracking

  function attempt(words, size, dirNames, rng) {
    const grid = Array.from({ length: size }, () => new Array(size).fill(null));
    // For each cell, the directions of words passing through it (to forbid collinear overlaps).
    const cellDirs = Array.from({ length: size }, () => Array.from({ length: size }, () => []));
    const placements = new Array(words.length);
    let steps = 0;

    function candidates(word) {
      const list = [];
      dirNames.forEach((dirName) => {
        const [dr, dc] = CC.DIRS[dirName];
        const axis = dr === 0 ? 'H' : dc === 0 ? 'V' : dr === dc ? 'D1' : 'D2';
        const len = word.length;
        for (let r = 0; r < size; r++) {
          const rEnd = r + dr * (len - 1);
          if (rEnd < 0 || rEnd >= size) continue;
          for (let c = 0; c < size; c++) {
            const cEnd = c + dc * (len - 1);
            if (cEnd < 0 || cEnd >= size) continue;
            let overlap = 0;
            let ok = true;
            for (let i = 0; i < len; i++) {
              const cell = grid[r + dr * i][c + dc * i];
              if (cell === null) continue;
              if (cell !== word[i] || cellDirs[r + dr * i][c + dc * i].includes(axis)) {
                ok = false;
                break;
              }
              overlap++;
            }
            if (ok && overlap < len) list.push({ r, c, dr, dc, axis, overlap });
          }
        }
      });
      rng.shuffle(list);
      // Favour crossings a little so it feels crossword-like, without always forcing them.
      list.sort((a, b) => (b.overlap > 0) - (a.overlap > 0) || 0);
      if (rng() < 0.5) rng.shuffle(list);
      return list;
    }

    function apply(word, p, index) {
      const written = [];
      for (let i = 0; i < word.length; i++) {
        const r = p.r + p.dr * i;
        const c = p.c + p.dc * i;
        if (grid[r][c] === null) {
          grid[r][c] = word[i];
          written.push([r, c]);
        }
        cellDirs[r][c].push(p.axis);
      }
      placements[index] = { p, written };
    }

    function undo(word, index) {
      const { p, written } = placements[index];
      written.forEach(([r, c]) => {
        grid[r][c] = null;
      });
      for (let i = 0; i < word.length; i++) {
        const dirs = cellDirs[p.r + p.dr * i][p.c + p.dc * i];
        dirs.splice(dirs.lastIndexOf(p.axis), 1);
      }
      placements[index] = undefined;
    }

    function place(index) {
      if (index === words.length) return true;
      const word = words[index];
      const options = candidates(word);
      const limit = Math.min(options.length, TRIES_PER_WORD);
      for (let i = 0; i < limit; i++) {
        if (++steps > STEP_BUDGET) return false;
        apply(word, options[i], index);
        if (place(index + 1)) return true;
        undo(word, index);
      }
      return false;
    }

    if (!place(0)) return null;
    return { grid, placements: placements.map((pl) => pl.p) };
  }

  // Every straight-line occurrence of `word` in the grid, as arrays of cell keys.
  function findOccurrences(grid, word) {
    const size = grid.length;
    const found = [];
    const seen = new Set();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] !== word[0]) continue;
        Object.values(CC.DIRS).forEach(([dr, dc]) => {
          const rEnd = r + dr * (word.length - 1);
          const cEnd = c + dc * (word.length - 1);
          if (rEnd < 0 || rEnd >= size || cEnd < 0 || cEnd >= size) return;
          for (let i = 1; i < word.length; i++) {
            if (grid[r + dr * i][c + dc * i] !== word[i]) return;
          }
          const cells = [];
          for (let i = 0; i < word.length; i++) cells.push((r + dr * i) * size + (c + dc * i));
          const key = cells.slice().sort((a, b) => a - b).join(',');
          if (!seen.has(key)) {
            seen.add(key);
            found.push({ cells, key });
          }
        });
      }
    }
    return found;
  }

  // Fill empty cells, then re-roll filler until no word can be found anywhere except
  // at its real placement (so every drag that spells a word is the word).
  function fillAndDisambiguate(grid, placedKeys, words, locked, rng) {
    const size = grid.length;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === null) grid[r][c] = fillerLetter(rng);
      }
    }
    for (let pass = 0; pass < 200; pass++) {
      let changed = false;
      words.forEach((word, i) => {
        findOccurrences(grid, word).forEach((occ) => {
          if (occ.key === placedKeys[i]) return;
          const free = occ.cells.filter((k) => !locked.has(k));
          if (!free.length) return;
          const k = rng.pick(free);
          const r = Math.floor(k / size);
          const c = k % size;
          let letter = fillerLetter(rng);
          while (letter === grid[r][c]) letter = fillerLetter(rng);
          grid[r][c] = letter;
          changed = true;
        });
      });
      if (!changed) break;
    }
  }

  CC.generatePuzzle = function (inputWords, config, seed) {
    const size = config.gridSize;
    let words = inputWords.map((w) => w.toUpperCase()).filter((w) => w.length <= size);
    // Longest first: they are the hardest to fit, so place them while the board is empty.
    words.sort((a, b) => b.length - a.length);

    let result = null;
    for (let tryNo = 0; tryNo < 25 && !result; tryNo++) {
      result = attempt(words, size, config.dirs, CC.makeRng(seed + tryNo * 7919));
      // Extremely unlikely on these board sizes, but never hang: drop the longest word and retry.
      if (!result && tryNo % 5 === 4) words = words.slice(1);
    }
    if (!result) throw new Error('Could not build puzzle');

    const rng = CC.makeRng(seed ^ 0x9e3779b9);
    const locked = new Set();
    const placedKeys = [];
    const placements = {};
    words.forEach((word, i) => {
      const p = result.placements[i];
      const cells = [];
      for (let k = 0; k < word.length; k++) {
        const r = p.r + p.dr * k;
        const c = p.c + p.dc * k;
        cells.push([r, c]);
        locked.add(r * size + c);
      }
      placedKeys.push(cells.map(([r, c]) => r * size + c).sort((a, b) => a - b).join(','));
      placements[word] = { start: cells[0], end: cells[cells.length - 1], cells };
    });

    fillAndDisambiguate(result.grid, placedKeys, words, locked, rng);

    return {
      size,
      grid: result.grid,
      words: words.slice().sort(),
      placements,
    };
  };

  CC._findOccurrences = findOccurrences;
})();
