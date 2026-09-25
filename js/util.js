/* Shared helpers: DOM shortcuts, seeded randomness, small math utilities. */
(function () {
  'use strict';

  const CC = (window.CC = window.CC || {});

  CC.$ = (sel, root) => (root || document).querySelector(sel);
  CC.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  CC.el = function (tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  CC.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Mulberry32: tiny, fast, good-enough seeded PRNG. Returns floats in [0, 1).
  CC.makeRng = function (seed) {
    let a = seed >>> 0;
    const rng = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.shuffle = function (arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    };
    return rng;
  };

  CC.randomSeed = () => (Math.random() * 4294967296) >>> 0;

  // Local date as YYYY-MM-DD, so daily things change at the player's own midnight.
  CC.todayKey = function (date) {
    const d = date || new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  CC.formatTime = function (ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  };

  // The eight straight-line directions as [dRow, dCol].
  CC.DIRS = {
    E: [0, 1],
    S: [1, 0],
    W: [0, -1],
    N: [-1, 0],
    SE: [1, 1],
    NE: [-1, 1],
    SW: [1, -1],
    NW: [-1, -1],
  };

  // Cells along a straight line from start to end (inclusive), or null if not straight.
  CC.lineCells = function (r0, c0, r1, c1) {
    const dr = Math.sign(r1 - r0);
    const dc = Math.sign(c1 - c0);
    const len = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
    if (r0 !== r1 && c0 !== c1 && Math.abs(r1 - r0) !== Math.abs(c1 - c0)) return null;
    const cells = [];
    for (let i = 0; i <= len; i++) cells.push([r0 + dr * i, c0 + dc * i]);
    return cells;
  };
})();
