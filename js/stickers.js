/* Main-menu star sticker collection. Every star earned becomes a sticker on the menu;
   stars earned since the last menu visit pop up big and fly onto the pile. */
(function () {
  'use strict';

  const CC = window.CC;
  const Save = CC.Save;

  const MAX_ANIMATED = 12; // a larger backlog places the older ones instantly
  const FLIGHT_MS = 1400;
  const LAND_AT = 0.8; // fraction of the flight where the sticker hits the board
  const GOLDEN_ANGLE = 2.39996323;

  // ---- Sticker artwork: one shared SVG symbol, reused by every sticker ----

  (function injectSymbol() {
    const cx = 50;
    const cy = 52;
    const pts = [];
    for (let j = 0; j < 10; j++) {
      const a = (-90 + j * 36) * (Math.PI / 180);
      const r = j % 2 === 0 ? 40 : 17;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    const f = (n) => n.toFixed(2);
    const star = 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L') + ' Z';
    // Ten facets from the centre give the star its bevelled, embossed look.
    const facets = pts
      .map((p, j) => {
        const q = pts[(j + 1) % 10];
        const fill = j % 2 === 0 ? '#ffd966' : '#f4ab22';
        return `<path d="M${cx} ${cy} L${f(p[0])} ${f(p[1])} L${f(q[0])} ${f(q[1])} Z" fill="${fill}"/>`;
      })
      .join('');

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="stk-glow" cx="42%" cy="36%" r="62%">
            <stop offset="0" stop-color="#fff" stop-opacity="0.6"/>
            <stop offset="0.55" stop-color="#fff" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="stk-rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f0b52e"/>
            <stop offset="1" stop-color="#c97c06"/>
          </linearGradient>
          <clipPath id="stk-clip"><path d="${star}"/></clipPath>
          <symbol id="sticker-star" viewBox="0 0 100 100">
            <path d="${star}" fill="#fff" stroke="rgba(90,60,10,0.14)" stroke-width="15.5" stroke-linejoin="round"/>
            <path d="${star}" fill="#fff" stroke="#fff" stroke-width="13" stroke-linejoin="round"/>
            <g clip-path="url(#stk-clip)">${facets}</g>
            <path d="${star}" fill="url(#stk-glow)"/>
            <path d="${star}" fill="none" stroke="url(#stk-rim)" stroke-width="1.8" stroke-linejoin="round"/>
            <ellipse cx="38" cy="33" rx="17" ry="7" transform="rotate(-34 38 33)" fill="#fff" opacity="0.55" clip-path="url(#stk-clip)"/>
            <path d="M71 18 L72.6 23.4 L78 25 L72.6 26.6 L71 32 L69.4 26.6 L64 25 L69.4 23.4 Z" fill="#fff"/>
          </symbol>
        </defs>
      </svg>`;
    document.body.insertAdjacentHTML('afterbegin', svg);
  })();

  // ---- Layout ----

  const board = document.getElementById('sticker-board');
  const layer = CC.el('div', 'sticker-layer');
  const empty = CC.el('div', 'sticker-empty');
  empty.innerHTML =
    '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 12 L60 38.2 L88 40 L66.2 57.4 L73.5 84.4 L50 69 L26.5 84.4 L33.8 57.4 L12 40 L40 38.2 Z"/></svg>' +
    '<span>Stars you earn will stick here</span>';
  const count = CC.el('div', 'sticker-count');
  board.append(layer, empty, count);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let geometry = null;
  let placed = 0;
  let timers = [];
  let flights = [];

  // The pile is laid out for a fixed capacity so stuck stickers never shuffle around
  // as new ones arrive; it only re-flows (smaller, denser) when a capacity is outgrown.
  function capacityFor(n) {
    let cap = 15;
    while (cap < n) cap *= 2;
    return cap;
  }

  function computeGeometry(total) {
    const cap = capacityFor(total);
    const height = cap <= 15 ? 150 : cap <= 30 ? 170 : cap <= 60 ? 200 : 230;
    board.style.height = height + 'px';
    const width = board.clientWidth || 400;
    const size = CC.clamp(Math.sqrt((width * height * 0.9) / cap) * 1.3, 18, 64);
    return { cap, width, height, size };
  }

  function spot(i, g) {
    const rng = CC.makeRng(i * 7919 + 17);
    const rho = Math.sqrt((i + 0.6) / g.cap);
    const theta = i * GOLDEN_ANGLE + (rng() - 0.5) * 0.5;
    const rx = g.width / 2 - g.size / 2 - 2;
    const ry = g.height / 2 - g.size / 2 - 2;
    return {
      x: g.width / 2 + rho * rx * Math.cos(theta) + (rng() - 0.5) * g.size * 0.2,
      y: g.height / 2 + rho * ry * Math.sin(theta) + (rng() - 0.5) * g.size * 0.2,
      rot: (rng() - 0.5) * 56,
    };
  }

  function makeSticker(i) {
    const s = spot(i, geometry);
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    node.setAttribute('class', 'sticker');
    node.setAttribute('viewBox', '0 0 100 100');
    node.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#sticker-star');
    node.appendChild(use);
    node.style.width = geometry.size + 'px';
    node.style.height = geometry.size + 'px';
    node.style.left = s.x - geometry.size / 2 + 'px';
    node.style.top = s.y - geometry.size / 2 + 'px';
    node.style.setProperty('--rot', s.rot + 'deg');
    node._spot = s;
    return node;
  }

  function updateLabels() {
    empty.hidden = placed > 0;
    count.hidden = placed === 0;
    count.innerHTML = `${CC.ICONS.star}<span>${placed}</span>`;
    board.setAttribute('aria-label', `${placed} star sticker${placed === 1 ? '' : 's'} collected`);
  }

  function renderStatic(n, total) {
    geometry = computeGeometry(total);
    layer.textContent = '';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) frag.appendChild(makeSticker(i));
    layer.appendChild(frag);
    placed = n;
    updateLabels();
  }

  // ---- The pop-up-and-stick animation ----

  function fly(i) {
    const node = makeSticker(i);
    node.classList.add('flying');
    layer.appendChild(node);

    const rect = board.getBoundingClientRect();
    const s = node._spot;
    const dx = window.innerWidth / 2 - (rect.left + s.x);
    const dy = window.innerHeight * 0.42 - (rect.top + s.y);
    // Present it big in the middle of the screen, then slap it onto its spot.
    const big = CC.clamp(150 / geometry.size, 2.4, 5);
    const at = (x, y, scale, rot) => `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`;
    const anim = node.animate(
      [
        { offset: 0, opacity: 0, transform: at(dx, dy, big * 0.2, s.rot - 120), easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
        { offset: 0.2, opacity: 1, transform: at(dx, dy, big, s.rot - 8) },
        { offset: 0.42, opacity: 1, transform: at(dx, dy, big * 0.96, s.rot), easing: 'cubic-bezier(0.55, 0, 0.75, 0.3)' },
        { offset: LAND_AT, opacity: 1, transform: at(0, 0, 1.3, s.rot), easing: 'ease-out' },
        { offset: 0.9, opacity: 1, transform: at(0, 0, 0.86, s.rot), easing: 'ease-out' },
        { offset: 1, opacity: 1, transform: at(0, 0, 1, s.rot) },
      ],
      { duration: FLIGHT_MS }
    );
    flights.push(anim);
    CC.Audio.sfx('star');

    timers.push(
      setTimeout(() => {
        node.classList.remove('flying');
        placed = Math.max(placed, i + 1);
        updateLabels();
        count.classList.remove('bump');
        void count.offsetWidth;
        count.classList.add('bump');
        CC.Audio.sfx('stick');
        const r = board.getBoundingClientRect();
        CC.Effects.burst(r.left + s.x, r.top + s.y, 14);
      }, FLIGHT_MS * LAND_AT)
    );
    anim.onfinish = () => {
      flights = flights.filter((a) => a !== anim);
    };
  }

  function finish() {
    timers.forEach(clearTimeout);
    timers = [];
    flights.forEach((a) => a.cancel());
    flights = [];
    const total = Math.min(Save.totalStars(), Save.progress.menuStarsShown || 0);
    if (placed !== total || CC.$$('.sticker.flying', layer).length) renderStatic(total, total);
  }

  CC.Stickers = {
    // Called whenever the main menu is shown. `delay` lets the menu's own entrance play first.
    show(delay) {
      finish();
      const total = Save.totalStars();
      const shown = Math.min(Save.progress.menuStarsShown || 0, total);
      const animateFrom = reduceMotion.matches ? total : Math.max(shown, total - MAX_ANIMATED);
      renderStatic(animateFrom, total);
      if (Save.progress.menuStarsShown !== total) {
        Save.progress.menuStarsShown = total;
        Save.saveProgress();
      }
      const fresh = total - animateFrom;
      if (!fresh) return;

      const gap = Math.max(170, 430 - fresh * 25);
      timers.push(
        setTimeout(() => {
          const earned = total - shown;
          CC.toast(`+${earned} star${earned === 1 ? '' : 's'}!`, 'good');
        }, delay)
      );
      for (let k = 0; k < fresh; k++) {
        timers.push(setTimeout(() => fly(animateFrom + k), delay + k * gap));
      }
    },

    finish,

    relayout() {
      finish();
      renderStatic(placed, Save.totalStars());
    },
  };
})();
