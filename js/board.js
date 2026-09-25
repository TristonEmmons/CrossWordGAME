/* Game board: grid rendering, drag-to-select, found words, hints, timer, streaks,
   and the hidden "see all" reveal. */
(function () {
  'use strict';

  const CC = window.CC;
  const Save = CC.Save;

  const HINTS_PER_LEVEL = 2;
  const HINT_BOX = 5;
  const STREAK_WINDOW_MS = 15000;
  const REVEAL_MS = 5000;
  const FOUND_TINTS = 4; // number of capsule colour variants in CSS
  const COFFEE_CLEARANCE = 96; // px kept free in the board box's corner for the coffee button
  const PRINT_AFTER_SPIN_MS = 820; // matches the newspaper's spin-in animation
  const PANEL_SHADOW = 5; // the printed panel's hard shadow, beyond its padding and border

  const wrap = document.getElementById('board-wrap');
  const panel = document.getElementById('puzzle-panel');
  const board = document.getElementById('board');
  const grid = document.getElementById('grid');
  const layer = document.getElementById('board-layer');
  const wordList = document.getElementById('word-list');
  const countLabel = document.getElementById('word-count');
  const progressFill = document.getElementById('progress-fill');
  const timerLabel = document.getElementById('timer');
  const levelLabel = document.getElementById('game-level');
  const hintButtons = CC.$$('.hint-btn');

  // ---- State for the loaded level ----
  let puzzle = null;
  let size = 0;
  let cells = []; // DOM nodes, index r * size + c
  let found = new Map(); // listed word -> { cells, capsule }
  let bonusFound = new Map(); // hidden bonus word -> { cells, capsule }
  let hints = []; // { word, row, col, node }
  let wordItems = new Map(); // word -> <li>
  let cellSize = 32;
  let active = false; // board is on screen and playable
  let paused = false;
  let elapsed = 0;
  let clockStart = 0;
  let clockTimer = 0;
  let lastFoundAt = 0;
  let streak = 0;
  let foundColor = 0;

  // ---- Layout ----

  // Keeps the coffee button's bottom-left corner clear: either leave room at both sides
  // (board centred) or at the bottom (board pinned to the top), whichever keeps letters bigger.
  function computeCellSize() {
    // clientWidth/Height are layout sizes, so the newspaper's spin-in transform can't skew them.
    const style = getComputedStyle(wrap);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const ps = getComputedStyle(panel);
    const chrome =
      parseFloat(ps.paddingLeft) + parseFloat(ps.paddingRight) + parseFloat(ps.borderLeftWidth) * 2 + PANEL_SHADOW;
    const w = wrap.clientWidth - padX - chrome;
    const h = wrap.clientHeight - padY - chrome;
    const beside = Math.min(w - 2 * COFFEE_CLEARANCE, h);
    const below = Math.min(w, h - COFFEE_CLEARANCE);
    wrap.classList.toggle('pin-top', below > beside);
    const fit = Math.floor(Math.max(beside, below) / size);
    const base = CC.clamp(fit, 14, 64);
    return Math.max(12, Math.round(base * Save.settings.letterScale));
  }

  function layout() {
    if (!puzzle) return;
    cellSize = computeCellSize();
    board.style.setProperty('--cell', cellSize + 'px');
    board.style.setProperty('--n', size);
    found.forEach((f) => placeCapsule(f.capsule, f.cells));
    hints.forEach(placeHintBox);
    if (selection.capsule && selection.cells.length) placeCapsule(selection.capsule, selection.cells);
    if (selection.anchorNode) placeCapsule(selection.anchorNode, [selection.anchor]);
    CC.Newspaper.layout();
  }

  new ResizeObserver(() => active && layout()).observe(wrap);

  function cellCenter(r, c) {
    return [(c + 0.5) * cellSize, (r + 0.5) * cellSize];
  }

  // Positions a rounded "capsule" highlight so it covers a straight run of cells.
  function placeCapsule(node, run) {
    const [r0, c0] = run[0];
    const [r1, c1] = run[run.length - 1];
    const [x0, y0] = cellCenter(r0, c0);
    const [x1, y1] = cellCenter(r1, c1);
    const thickness = cellSize * 0.82;
    const length = Math.hypot(x1 - x0, y1 - y0) + thickness;
    const angle = Math.atan2(y1 - y0, x1 - x0);
    node.style.width = length + 'px';
    node.style.height = thickness + 'px';
    node.style.borderRadius = thickness / 2 + 'px';
    node.style.transform =
      `translate(${(x0 + x1) / 2 - length / 2}px, ${(y0 + y1) / 2 - thickness / 2}px) rotate(${angle}rad)`;
  }

  function placeHintBox(h) {
    h.node.style.width = HINT_BOX * cellSize + 'px';
    h.node.style.height = HINT_BOX * cellSize + 'px';
    h.node.style.transform = `translate(${h.col * cellSize}px, ${h.row * cellSize}px)`;
  }

  // ---- Building a level ----

  function build() {
    grid.textContent = '';
    layer.textContent = '';
    wordList.textContent = '';
    cells = [];
    found = new Map();
    bonusFound = new Map();
    hints = [];
    wordItems = new Map();
    foundColor = 0;
    selection.capsule = null;
    selection.anchor = null;
    selection.anchorNode = null;

    const frag = document.createDocumentFragment();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const node = CC.el('div', 'cell enter', puzzle.grid[r][c]);
        // Letters "print" onto the paper in a diagonal wave once it has spun in and landed
        // (the spin is cheap while the page is static). Capped so big boards settle quickly.
        node.style.animationDelay = PRINT_AFTER_SPIN_MS + Math.min(900, (r + c) * 14) + 'ms';
        cells.push(node);
        frag.appendChild(node);
      }
    }
    grid.appendChild(frag);
    setTimeout(() => {
      cells.forEach((n) => {
        n.classList.remove('enter');
        n.style.animationDelay = '';
      });
    }, PRINT_AFTER_SPIN_MS + 1400);

    puzzle.words.forEach((word) => {
      const li = CC.el('li', 'word', word);
      wordItems.set(word, li);
      wordList.appendChild(li);
    });

    levelLabel.textContent = puzzle.daily ? 'Today’s Paper' : 'Level ' + puzzle.level;
    selection.capsule = CC.el('div', 'capsule selecting');
    selection.capsule.hidden = true;
    layer.appendChild(selection.capsule);
  }

  function saveState() {
    if (!puzzle) return;
    Save.progress.inProgress[puzzle.level] = {
      found: Array.from(found.entries()).map(([word, f]) => ({ word, cells: f.cells, coffee: f.byCoffee })),
      bonus: Array.from(bonusFound.entries()).map(([word, f]) => ({ word, cells: f.cells })),
      hints: hints.map((h) => ({ word: h.word, row: h.row, col: h.col })),
      used: hintsUsed(),
      elapsed: currentElapsed(),
    };
    Save.saveProgress();
  }

  function restore() {
    const saved = Save.progress.inProgress[puzzle.level];
    elapsed = 0;
    usedHintCount = 0;
    if (!saved) return;
    elapsed = saved.elapsed || 0;
    (saved.found || []).forEach((f) => {
      if (puzzle.placements[f.word] && !found.has(f.word)) markFound(f.word, f.cells, false, f.coffee);
    });
    (saved.bonus || []).forEach((f) => {
      if (puzzle.placements[f.word] && !bonusFound.has(f.word)) markBonus(f.word, f.cells, false);
    });
    (saved.hints || []).forEach((h) => {
      if (!found.has(h.word)) addHintBox(h.word, h.row, h.col, false);
    });
    usedHintCount = saved.used != null ? saved.used : (saved.hints || []).length;
  }

  // ---- Timer ----

  function currentElapsed() {
    return elapsed + (clockStart ? performance.now() - clockStart : 0);
  }

  function startClock() {
    if (clockStart || !active || paused || document.hidden) return;
    clockStart = performance.now();
    clockTimer = setInterval(renderClock, 500);
  }

  function stopClock() {
    if (!clockStart) return;
    elapsed += performance.now() - clockStart;
    clockStart = 0;
    clearInterval(clockTimer);
    renderClock();
  }

  function renderClock() {
    timerLabel.textContent = CC.formatTime(currentElapsed());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopClock();
      if (active) saveState();
    } else {
      startClock();
    }
  });

  // ---- Found words ----

  function updateCounter() {
    const total = puzzle.words.length;
    countLabel.textContent = `${found.size} / ${total} words found`;
    progressFill.style.transform = `scaleX(${found.size / total})`;
    CC.Newspaper.progress(found.size, total);
  }

  // `byCoffee` marks words handed over by a coffee cup: they get a latte-coloured
  // highlight and don't count toward streaks.
  function markFound(word, run, animate, byCoffee) {
    const tint = byCoffee ? 'coffee' : `tint-${foundColor++ % FOUND_TINTS}`;
    const capsule = CC.el('div', `capsule found ${tint}`);
    if (animate) capsule.classList.add('landing');
    layer.insertBefore(capsule, selection.capsule);
    placeCapsule(capsule, run);
    found.set(word, { cells: run, capsule, byCoffee: !!byCoffee });

    run.forEach(([r, c], i) => {
      const node = cells[r * size + c];
      node.classList.add('found');
      if (animate) {
        node.style.animationDelay = i * 40 + 'ms';
        node.classList.remove('pop');
        void node.offsetWidth; // restart the animation if the cell was popped before
        node.classList.add('pop');
      }
    });

    const li = wordItems.get(word);
    if (li) li.classList.add('found');

    // A hint box has done its job once its word is found.
    hints.filter((h) => h.word === word).forEach((h) => h.node.classList.add('done'));

    updateCounter();
    if (!animate) return;

    CC.Audio.sfx('found');
    const rect = board.getBoundingClientRect();
    const mid = run[Math.floor(run.length / 2)];
    const [mx, my] = cellCenter(mid[0], mid[1]);
    CC.Effects.burst(rect.left + mx, rect.top + my, 24);
    if (li) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    if (!byCoffee) {
      const now = performance.now();
      streak = now - lastFoundAt < STREAK_WINDOW_MS ? streak + 1 : 1;
      lastFoundAt = now;
    }

    const total = puzzle.words.length;
    const remaining = total - found.size;
    if (remaining === 0) {
      saveState();
      finish();
      return;
    }
    if (byCoffee) CC.toast(`Coffee found ${word}`, 'coffee');
    else if (streak === 2) CC.toast('Nice streak!', 'good');
    else if (streak === 3) CC.toast('On a roll!', 'good');
    else if (streak >= 4) CC.toast(`Unstoppable! ×${streak}`, 'good');
    else if (found.size === Math.ceil(total / 2)) CC.toast('Halfway there!');
    else if (remaining === 1) CC.toast('Just one more!');
    saveState();
  }

  // ---- Bonus words: hidden extras that aren't on the list ----

  function markBonus(word, run, animate) {
    const capsule = CC.el('div', 'capsule bonus');
    if (animate) capsule.classList.add('landing');
    layer.insertBefore(capsule, selection.capsule);
    placeCapsule(capsule, run);
    bonusFound.set(word, { cells: run, capsule });

    run.forEach(([r, c], i) => {
      const node = cells[r * size + c];
      node.classList.add('bonus-found');
      if (animate) {
        node.style.animationDelay = i * 60 + 'ms';
        node.classList.remove('pop', 'bonus-pop');
        void node.offsetWidth;
        node.classList.add('bonus-pop');
      }
    });

    // It joins the word list, set apart as a gold bonus entry.
    const li = CC.el('li', 'word bonus', word);
    if (animate) li.classList.add('arriving');
    wordList.appendChild(li);

    if (!animate) return;
    CC.Audio.sfx('bonus');
    const rect = board.getBoundingClientRect();
    run.forEach(([r, c], i) => {
      if (i % 2) return;
      const [x, y] = cellCenter(r, c);
      setTimeout(() => CC.Effects.burst(rect.left + x, rect.top + y, 14, 'gold'), i * 60);
    });
    CC.toast(`Bonus word! ${word}`, 'bonus');
    li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    saveState();
  }

  // ---- Drag selection ----

  const selection = {
    pointerId: null,
    start: null, // [r, c]
    cells: [],
    pending: null, // latest pointer position awaiting the next animation frame
    frame: 0,
    capsule: null,
    anchor: null, // [r, c] of a tapped first letter, waiting for a second tap
    anchorNode: null,
    flash: 0, // bumps with each wrong guess so a stale fade-out can't hide a new selection
  };

  // Tap-to-select: tap the first letter, then the last. Easier than dragging on a trackpad.
  function setAnchor(cell) {
    clearAnchor();
    selection.anchor = cell;
    const node = CC.el('div', 'capsule anchor');
    layer.insertBefore(node, selection.capsule);
    placeCapsule(node, [cell]);
    selection.anchorNode = node;
    CC.Audio.sfx('tap');
  }

  function clearAnchor() {
    if (selection.anchorNode) selection.anchorNode.remove();
    selection.anchor = null;
    selection.anchorNode = null;
  }

  function pointToCell(clientX, clientY) {
    const rect = board.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return { x, y, r: Math.floor(y / cellSize), c: Math.floor(x / cellSize) };
  }

  // Snap the drag to the nearest of the 8 directions. Working from the pointer's
  // exact position (not just the cell under it) means a wobbly hand still yields
  // a clean straight line.
  function runFromDrag(x, y) {
    const [r0, c0] = selection.start;
    const [sx, sy] = cellCenter(r0, c0);
    const vx = (x - sx) / cellSize;
    const vy = (y - sy) / cellSize;
    if (Math.hypot(vx, vy) < 0.5) return [[r0, c0]];

    const octant = Math.round(Math.atan2(vy, vx) / (Math.PI / 4));
    const dc = Math.round(Math.cos((octant * Math.PI) / 4));
    const dr = Math.round(Math.sin((octant * Math.PI) / 4));
    let steps = dr && dc ? Math.round((Math.abs(vx) + Math.abs(vy)) / 2) : Math.round(Math.abs(dr ? vy : vx));
    // Stop at the board edge rather than breaking the line.
    while (steps > 0) {
      const r = r0 + dr * steps;
      const c = c0 + dc * steps;
      if (r >= 0 && r < size && c >= 0 && c < size) break;
      steps--;
    }
    const run = [];
    for (let i = 0; i <= steps; i++) run.push([r0 + dr * i, c0 + dc * i]);
    return run;
  }

  function setSelectedCells(run) {
    const next = new Set(run.map(([r, c]) => r * size + c));
    selection.cells.forEach(([r, c]) => {
      if (!next.has(r * size + c)) cells[r * size + c].classList.remove('sel');
    });
    run.forEach(([r, c]) => cells[r * size + c].classList.add('sel'));
    selection.cells = run;
    placeCapsule(selection.capsule, run);
  }

  function clearSelection() {
    selection.cells.forEach(([r, c]) => cells[r * size + c].classList.remove('sel'));
    selection.cells = [];
    selection.start = null;
    selection.pointerId = null;
    selection.pending = null;
    cancelAnimationFrame(selection.frame);
    selection.frame = 0;
  }

  function onPointerDown(e) {
    if (!active || paused || selection.pointerId !== null) return;
    if (e.button !== undefined && e.button !== 0) return;
    const p = pointToCell(e.clientX, e.clientY);
    if (p.r < 0 || p.r >= size || p.c < 0 || p.c >= size) return;
    e.preventDefault();
    board.setPointerCapture(e.pointerId);
    selection.pointerId = e.pointerId;
    selection.start = [p.r, p.c];
    const capsule = selection.capsule;
    selection.flash++;
    capsule.classList.remove('invalid', 'fading');
    capsule.hidden = false;
    setSelectedCells([[p.r, p.c]]);
  }

  function onPointerMove(e) {
    if (e.pointerId !== selection.pointerId) return;
    e.preventDefault();
    selection.pending = [e.clientX, e.clientY];
    if (!selection.frame) {
      selection.frame = requestAnimationFrame(() => {
        selection.frame = 0;
        if (!selection.pending || !selection.start) return;
        const p = pointToCell(selection.pending[0], selection.pending[1]);
        setSelectedCells(runFromDrag(p.x, p.y));
      });
    }
  }

  function onPointerUp(e) {
    if (e.pointerId !== selection.pointerId) return;
    if (selection.pending && selection.start) {
      const p = pointToCell(selection.pending[0], selection.pending[1]);
      setSelectedCells(runFromDrag(p.x, p.y));
    }
    const run = selection.cells.slice();
    clearSelection();
    if (run.length === 1) {
      const [r, c] = run[0];
      const anchor = selection.anchor;
      if (!anchor) {
        setAnchor([r, c]);
      } else if (anchor[0] === r && anchor[1] === c) {
        clearAnchor(); // tapping the same letter again cancels
      } else {
        // Second tap: the line from the first tap to here, snapped straight.
        selection.start = anchor;
        const [x, y] = cellCenter(r, c);
        const line = runFromDrag(x, y);
        selection.start = null;
        clearAnchor();
        selection.capsule.hidden = false;
        placeCapsule(selection.capsule, line);
        evaluate(line);
        return;
      }
      selection.capsule.hidden = true;
      return;
    }
    clearAnchor();
    evaluate(run);
  }

  function onPointerCancel(e) {
    if (e.pointerId !== selection.pointerId) return;
    clearSelection();
    selection.capsule.hidden = true;
  }

  board.addEventListener('pointerdown', onPointerDown);
  board.addEventListener('pointermove', onPointerMove);
  board.addEventListener('pointerup', onPointerUp);
  board.addEventListener('pointercancel', onPointerCancel);
  board.addEventListener('lostpointercapture', onPointerCancel);
  board.addEventListener('contextmenu', (e) => e.preventDefault());

  function differsByOne(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++diff > 1) return false;
    return diff === 1;
  }

  function evaluate(run) {
    const capsule = selection.capsule;
    if (run.length < 2) {
      capsule.hidden = true;
      return;
    }
    const text = run.map(([r, c]) => puzzle.grid[r][c]).join('');
    const reversed = text.split('').reverse().join('');
    const word = puzzle.words.find((w) => w === text || w === reversed);
    const bonus = puzzle.bonus.find((w) => w === text || w === reversed);

    if (word && !found.has(word)) {
      capsule.hidden = true;
      // Store the run start-to-end in reading order of the word.
      markFound(word, text === word ? run : run.slice().reverse(), true);
      return;
    }
    if (bonus && !bonusFound.has(bonus)) {
      capsule.hidden = true;
      markBonus(bonus, text === bonus ? run : run.slice().reverse(), true);
      return;
    }

    const flash = ++selection.flash;
    capsule.classList.remove('fading');
    capsule.classList.add('invalid');
    run.forEach(([r, c]) => {
      const node = cells[r * size + c];
      node.style.animationDelay = '0ms';
      node.classList.remove('shake');
      void node.offsetWidth;
      node.classList.add('shake');
    });
    setTimeout(() => {
      if (flash === selection.flash && selection.pointerId === null) capsule.classList.add('fading');
    }, 260);
    setTimeout(() => {
      if (flash !== selection.flash) return;
      if (selection.pointerId === null) capsule.hidden = true;
      capsule.classList.remove('invalid', 'fading');
    }, 650);

    if (word || bonus) {
      CC.toast('Already found that one');
      return;
    }
    CC.Audio.sfx('invalid');
    streak = 0;
    const unfound = puzzle.words.filter((w) => !found.has(w));
    // Near misses: one wrong letter, stopped short, or dragged one letter too far.
    const close = unfound.some((w) =>
      [text, reversed].some(
        (s) =>
          differsByOne(w, s) ||
          (s.length >= 3 && w.length > s.length && w.startsWith(s)) ||
          (s.length === w.length + 1 && s.startsWith(w))
      )
    );
    if (close) CC.toast('So close!');
  }

  // ---- Hints ----

  let usedHintCount = 0;

  function hintsUsed() {
    return usedHintCount;
  }

  function renderHintButtons() {
    hintButtons.forEach((btn, i) => {
      const spent = i < usedHintCount;
      btn.disabled = spent;
      btn.classList.toggle('spent', spent);
      btn.setAttribute('aria-label', spent ? 'Hint used' : 'Use a hint');
    });
  }

  function addHintBox(word, row, col, animate) {
    const node = CC.el('div', 'hint-box' + (animate ? ' appearing' : ''));
    layer.insertBefore(node, layer.firstChild);
    const h = { word, row, col, node };
    hints.push(h);
    placeHintBox(h);
    return h;
  }

  function useHint() {
    if (!active || paused || usedHintCount >= HINTS_PER_LEVEL) return;
    const unfound = puzzle.words.filter((w) => !found.has(w));
    if (!unfound.length) return;
    // Prefer a word no active hint already points at.
    const pointed = new Set(hints.filter((h) => !found.has(h.word)).map((h) => h.word));
    const pool = unfound.filter((w) => !pointed.has(w));
    const word = CC.makeRng(CC.randomSeed()).pick(pool.length ? pool : unfound);
    const [r, c] = puzzle.placements[word].start;
    // Place the 5x5 box so the first letter lands at a random spot inside it.
    const row = CC.clamp(r - Math.floor(Math.random() * HINT_BOX), 0, size - HINT_BOX);
    const col = CC.clamp(c - Math.floor(Math.random() * HINT_BOX), 0, size - HINT_BOX);
    const h = addHintBox(word, row, col, true);
    usedHintCount++;
    renderHintButtons();
    CC.Audio.sfx('hint');
    h.node.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    saveState();
  }

  hintButtons.forEach((btn) => btn.addEventListener('click', useHint));

  // ---- Coffee: spend a cup to have one random word found ----

  const coffeeBtn = document.getElementById('coffee-btn');
  const coffeeCount = document.getElementById('coffee-count');
  let coffeeBusy = false;

  function renderCoffee() {
    const cups = Save.progress.coffee;
    coffeeCount.textContent = cups;
    coffeeBtn.classList.toggle('empty', cups <= 0);
    coffeeBtn.setAttribute(
      'aria-label',
      cups > 0 ? `Drink a coffee to find a random word. ${cups} cup${cups === 1 ? '' : 's'} left` : 'Out of coffee'
    );
  }

  function useCoffee() {
    if (!active || paused || coffeeBusy || !puzzle) return;
    if (Save.progress.coffee <= 0) {
      CC.toast('Out of coffee. Finish new levels to brew more.');
      coffeeBtn.classList.remove('nope');
      void coffeeBtn.offsetWidth;
      coffeeBtn.classList.add('nope');
      return;
    }
    if (!puzzle.words.some((w) => !found.has(w))) return;

    coffeeBusy = true;
    Save.progress.coffee--;
    Save.saveProgress();
    renderCoffee();
    coffeeCount.classList.remove('bump');
    void coffeeCount.offsetWidth;
    coffeeCount.classList.add('bump');
    coffeeBtn.classList.remove('sipping');
    void coffeeBtn.offsetWidth;
    coffeeBtn.classList.add('sipping');
    CC.Audio.sfx('coffee');

    // Pick after the sip so a word found by hand in the meantime isn't wasted.
    setTimeout(() => {
      coffeeBusy = false;
      const unfound = puzzle.words.filter((w) => !found.has(w));
      if (!unfound.length || !active) {
        Save.progress.coffee++;
        Save.saveProgress();
        renderCoffee();
        return;
      }
      const word = unfound[Math.floor(Math.random() * unfound.length)];
      markFound(word, puzzle.placements[word].cells, true, true);
      const f = found.get(word);
      if (f) f.capsule.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }, 450);
  }

  coffeeBtn.addEventListener('click', useCoffee);

  // Mouse hover makes the cup hop off its saucer; leaving drops it back down.
  coffeeBtn.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    coffeeBtn.classList.remove('landing');
    coffeeBtn.classList.add('lifted');
  });
  coffeeBtn.addEventListener('pointerleave', () => {
    if (!coffeeBtn.classList.contains('lifted')) return;
    coffeeBtn.classList.remove('lifted');
    coffeeBtn.classList.add('landing');
  });
  coffeeBtn.addEventListener('animationend', (e) => {
    if (e.animationName === 'cup-land') coffeeBtn.classList.remove('landing');
  });

  // ---- Level complete ----

  function finish() {
    stopClock();
    active = false;
    const time = elapsed;
    const hintCount = usedHintCount;
    // No hints = 3 stars; no hints plus any bonus word = a surprise 4th star.
    const stars = hintCount === 0 ? (bonusFound.size > 0 ? 4 : 3) : Math.max(1, 3 - hintCount);
    let brew = null;
    let daily = null;
    if (puzzle.daily) {
      // The daily paper has its own reward (a cup on the first solve) and streak.
      daily = Save.recordDaily(puzzle.level.slice('daily-'.length), stars, time, hintCount);
      renderCoffee();
    } else {
      const firstTime = Save.recordCompletion(puzzle.level, stars, time, hintCount);
      // Only new levels brew coffee, so replaying easy levels can't farm cups.
      brew = firstTime ? Save.brewCoffee(hintCount) : null;
    }
    setTimeout(() => {
      CC.Screens.showComplete({
        level: puzzle.level,
        daily,
        time,
        hints: hintCount,
        stars,
        words: puzzle.words.length,
        bonusFound: bonusFound.size,
        bonusTotal: puzzle.bonus.length,
        brew,
      });
    }, 700);
  }

  // ---- Hidden developer codes (gameplay only), each typed within 1.5s ----
  //   seeall: highlight every word for 5 seconds
  //   addcup: +10 coffee cups

  const SECRET_WINDOW_MS = 1500;
  const SECRETS = {
    seeall: () => reveal(),
    addcup: () => addCups(10),
  };
  let keyTrail = []; // recent { key, time }
  let revealTimer = 0;

  document.addEventListener('keydown', (e) => {
    if (!puzzle || !CC.Screens.isGameScreen()) {
      keyTrail = [];
      return;
    }
    const key = (e.key || '').toLowerCase();
    if (key.length !== 1) return;
    const now = performance.now();
    keyTrail.push({ key, time: now });
    if (keyTrail.length > 12) keyTrail.shift();
    const typed = keyTrail.map((k) => k.key).join('');
    Object.keys(SECRETS).forEach((code) => {
      if (!typed.endsWith(code)) return;
      const first = keyTrail[keyTrail.length - code.length];
      if (now - first.time > SECRET_WINDOW_MS) return;
      keyTrail = [];
      SECRETS[code]();
    });
  });

  function addCups(n) {
    Save.progress.coffee += n;
    Save.saveProgress();
    renderCoffee();
    coffeeCount.classList.remove('bump');
    void coffeeCount.offsetWidth;
    coffeeCount.classList.add('bump');
    CC.Audio.sfx('coffee');
  }

  function reveal() {
    clearTimeout(revealTimer);
    CC.$$('.capsule.reveal', layer).forEach((n) => n.remove());
    puzzle.words.concat(puzzle.bonus).forEach((word) => {
      const node = CC.el('div', 'capsule reveal' + (puzzle.bonus.includes(word) ? ' reveal-bonus' : ''));
      layer.appendChild(node);
      placeCapsule(node, puzzle.placements[word].cells);
    });
    revealTimer = setTimeout(() => {
      CC.$$('.capsule.reveal', layer).forEach((n) => {
        n.classList.add('fading');
        setTimeout(() => n.remove(), 400);
      });
    }, REVEAL_MS);
  }

  // ---- Public API ----

  CC.Game = {
    load(level) {
      clearTimeout(revealTimer);
      stopClock();
      puzzle = CC.loadLevel(level);
      size = puzzle.size;
      CC.Newspaper.newIssue(level, puzzle.words.length);
      paused = false;
      streak = 0;
      lastFoundAt = 0;
      build();
      layout();
      restore();
      renderHintButtons();
      renderCoffee();
      updateCounter();
      renderClock();
      applyWordListSetting();
      wrap.scrollTop = 0;
      wrap.scrollLeft = 0;
    },

    // Called once the game screen is visible.
    activate() {
      active = true;
      paused = false;
      layout();
      startClock();
    },

    deactivate() {
      if (!puzzle) return;
      if (active) saveState();
      active = false;
      stopClock();
      clearSelection();
    },

    pause() {
      if (!active) return;
      paused = true;
      stopClock();
      clearSelection();
      if (selection.capsule) selection.capsule.hidden = true;
      saveState();
    },

    resume() {
      if (!active) return;
      paused = false;
      startClock();
    },

    restart() {
      if (!puzzle) return;
      delete Save.progress.inProgress[puzzle.level];
      Save.saveProgress();
      const level = puzzle.level;
      this.load(level);
      this.activate();
    },

    get level() {
      return puzzle ? puzzle.level : null;
    },

    relayout: layout,
  };

  function applyWordListSetting() {
    document.body.classList.toggle('hide-word-list', !Save.settings.showWordList);
  }
  CC.Game.applyWordListSetting = applyWordListSetting;
})();
