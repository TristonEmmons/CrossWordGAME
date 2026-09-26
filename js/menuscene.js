/* Main-menu backdrop: the view from a table on a café patio, looking past the railing at
   a busy street, all behind a pane of frosted glass.

   - Depth: the scene is built in layers (sky and skyline, the street, the patio) that
     drift apart as the mouse moves, so it feels like looking out from your seat.
   - Traffic: cars, a taxi, a bus and the paper's delivery van really drive. They keep
     their distance, stop at the red light, queue up, and pull away on green. While
     they wait, people cross at the crosswalk, walking toward you.
   - Time and weather: the scene follows the player's clock (morning, day, evening,
     night) and the day's weather (mostly clear; some days rain, with umbrellas, a wet
     street and droplets on the glass; in winter, sometimes snow).
   - Speed: the still scenery is drawn once per layer as an image with the blur baked
     in; only the small moving pieces are drawn each frame, and only while the menu is
     showing. */
(function () {
  'use strict';

  const CC = window.CC;
  const INK = '#2b2a33';
  const W = 1600;
  const H = 900;
  const o = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
  const thin = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------------------------
  // Time of day, weather and colours
  // ---------------------------------------------------------------------------------

  function timeOfDay(date) {
    const h = date.getHours();
    if (h >= 5 && h < 10) return 'morning';
    if (h >= 10 && h < 17) return 'day';
    if (h >= 17 && h < 20) return 'evening';
    return 'night';
  }

  // The same weather all day for everyone: mostly clear, some rain, and snow in winter.
  function weatherFor(date) {
    const key = CC.todayKey(date);
    let seed = 7;
    for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    const roll = CC.makeRng(seed)();
    const winter = [11, 0, 1].includes(date.getMonth());
    if (winter && roll < 0.3) return 'snow';
    if (roll > 0.8) return 'rain';
    return 'clear';
  }

  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const ch = (p, s) => (p >> s) & 255;
    const c = (s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
    return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
  }

  const PALETTES = {
    morning: { sky1: '#ffc39a', sky2: '#fff1dc', far: '#f3dccb', city: '#e6c9b3', cityWin: '#fff6ea', road: '#6d6873', walk: '#ece2d4', edge: '#cbbfae', sunX: 250, sunY: 250, sunR: 62, sun: '#ffd07a', win: '#dcecf5', tint: '#ffbe78', tintOp: 0.07, lit: false },
    day: { sky1: '#8fd0ee', sky2: '#e4f5fb', far: '#d7e4ed', city: '#bccfdc', cityWin: '#eef6fb', road: '#67636e', walk: '#e9dfd2', edge: '#c9bdab', sunX: 1250, sunY: 150, sunR: 58, sun: '#ffe08a', win: '#dcecf5', tint: '#ffffff', tintOp: 0, lit: false },
    evening: { sky1: '#e9786a', sky2: '#ffcf94', far: '#e0aba3', city: '#b3868f', cityWin: '#ffd86b', road: '#5a5461', walk: '#e3d3c6', edge: '#bda99b', sunX: 1345, sunY: 300, sunR: 70, sun: '#ffb35e', win: '#f1cfae', tint: '#783c6e', tintOp: 0.14, lit: true },
    night: { sky1: '#1b2150', sky2: '#3b4177', far: '#262b57', city: '#2e3462', cityWin: '#ffd86b', road: '#34323f', walk: '#8b869c', edge: '#6c6880', sunX: 1250, sunY: 150, sunR: 48, sun: '#fdf1c0', win: '#4e5486', tint: '#14183c', tintOp: 0.36, lit: true, moon: true },
  };

  function palette(tod, weather) {
    const P = Object.assign({}, PALETTES[tod]);
    if (weather === 'rain') {
      P.sky1 = mix(P.sky1, '#7f8a97', 0.6);
      P.sky2 = mix(P.sky2, '#bcc4cc', 0.55);
      P.far = mix(P.far, '#9aa3ad', 0.4);
      P.road = mix(P.road, '#2c2a33', 0.25);
      P.walk = mix(P.walk, '#9d9aa4', 0.35);
      P.hideSun = true;
    } else if (weather === 'snow') {
      P.sky1 = mix(P.sky1, '#c3cfdb', 0.55);
      P.sky2 = mix(P.sky2, '#f1f4f8', 0.6);
      P.walk = mix(P.walk, '#f6f8fb', 0.75);
      P.edge = mix(P.edge, '#dfe5ec', 0.6);
      P.road = mix(P.road, '#8d8a96', 0.2);
      P.hideSun = true;
    }
    return P;
  }

  // ---------------------------------------------------------------------------------
  // Pieces
  // ---------------------------------------------------------------------------------

  const cloud = (x, y, s, fill, op) =>
    `<path transform="translate(${x} ${y}) scale(${s})" d="M20 50 C6 50 6 30 22 30 C22 14 46 10 52 24 C58 8 86 10 86 28 C102 26 110 50 94 50 Z" fill="${fill}" fill-opacity="${op}" stroke="${INK}" stroke-opacity="0.12" stroke-width="3"/>`;

  // -- Cars: drawn facing right, wheels resting on y = 0 --

  function wheel(x, r) {
    return `<g transform="translate(${x} -${r - 4})"><g class="ms-wheel">
      <circle r="${r}" fill="${INK}"/><circle r="${r * 0.5}" fill="#d9d4cc"/><circle r="${r * 0.16}" fill="${INK}"/>
      <path d="M0 -${r * 0.5} V${r * 0.5} M-${r * 0.5} 0 H${r * 0.5}" stroke="${INK}" stroke-width="2.4"/></g></g>`;
  }
  const shadow = (w) => `<ellipse cx="${w / 2}" cy="4" rx="${w * 0.5}" ry="8" fill="#000" fill-opacity="0.2"/>`;
  const glass = '#cfe8f2';

  const CARS = {
    sedan: { w: 200, lamp: [196, -34], tail: [10, -32], draw: (c) => `${shadow(200)}
      <path d="M8 -22 Q8 -40 30 -42 L62 -44 Q82 -76 112 -76 L140 -76 Q164 -76 178 -46 L190 -44 Q200 -42 200 -24 L200 -14 Q200 -8 194 -8 L14 -8 Q8 -8 8 -14 Z" fill="${c}" ${o}/>
      <path d="M72 -46 Q88 -68 110 -68 L120 -68 L120 -46 Z M128 -68 L140 -68 Q156 -68 168 -46 L128 -46 Z" fill="${glass}" ${thin}/>
      <path d="M124 -44 V-12 M70 -30 H80 M140 -30 H150" ${thin}/><path d="M166 -52 l8 -2 l0 6 z" fill="${c}" ${thin}/>
      <rect x="190" y="-38" width="10" height="8" rx="2" fill="#fff3b0" ${thin}/><rect fill="#c9363f" x="6" y="-36" width="8" height="9" rx="2" ${thin}/>
      ${wheel(52, 18)}${wheel(158, 18)}` },
    taxi: { w: 200, lamp: [196, -34], tail: [10, -32], draw: (c) => `${CARS.sedan.draw(c)}
      <rect x="96" y="-94" width="44" height="18" rx="4" fill="#fff" ${thin}/>
      <text x="118" y="-81" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="12" fill="${INK}">TAXI</text>
      <path d="M20 -24 H190" stroke="${INK}" stroke-width="5" stroke-dasharray="10 10" stroke-opacity="0.7"/>` },
    coupe: { w: 168, lamp: [160, -34], tail: [10, -30], draw: (c) => `${shadow(168)}
      <path d="M8 -20 Q6 -44 40 -50 Q60 -86 100 -86 Q140 -86 152 -50 Q170 -46 168 -20 L168 -14 Q168 -8 162 -8 L14 -8 Q8 -8 8 -14 Z" fill="${c}" ${o}/>
      <path d="M52 -50 Q68 -76 96 -76 Q124 -76 136 -50 Z" fill="${glass}" ${thin}/><path d="M96 -76 V-50 M96 -46 V-14" ${thin}/>
      <circle cx="158" cy="-34" r="6" fill="#fff3b0" ${thin}/><rect fill="#c9363f" x="6" y="-34" width="8" height="8" rx="2" ${thin}/>
      ${wheel(44, 17)}${wheel(132, 17)}` },
    hatch: { w: 160, lamp: [156, -34], tail: [10, -35], draw: (c) => `${shadow(160)}
      <path d="M8 -16 Q8 -70 40 -76 L100 -78 Q122 -78 134 -52 L150 -46 Q160 -42 160 -24 L160 -14 Q160 -8 154 -8 L14 -8 Q8 -8 8 -14 Z" fill="${c}" ${o}/>
      <path d="M22 -50 Q24 -68 42 -70 L78 -70 L78 -50 Z M86 -70 L100 -70 Q116 -70 124 -50 L86 -50 Z" fill="${glass}" ${thin}/><path d="M82 -48 V-14" ${thin}/>
      <rect x="150" y="-38" width="10" height="8" rx="2" fill="#fff3b0" ${thin}/><rect fill="#c9363f" x="6" y="-40" width="8" height="10" rx="2" ${thin}/>
      ${wheel(42, 16)}${wheel(124, 16)}` },
    bus: { w: 380, lamp: [372, -35], tail: [13, -34], draw: (c) => `${shadow(380)}
      <rect x="6" y="-130" width="372" height="120" rx="18" fill="${c}" ${o}/>
      <rect x="6" y="-58" width="372" height="16" fill="#fffaf1" ${thin}/>
      ${[0, 1, 2, 3, 4].map((k) => `<rect x="${28 + k * 62}" y="-114" width="50" height="42" rx="6" fill="${glass}" ${thin}/>`).join('')}
      <rect x="336" y="-114" width="32" height="74" rx="5" fill="${glass}" ${thin}/><path d="M352 -114 V-40" ${thin}/>
      <rect x="120" y="-150" width="150" height="22" rx="5" fill="${INK}"/>
      <text x="195" y="-134" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="14" fill="#ffd35e">5 · DOWNTOWN</text>
      <rect x="364" y="-40" width="12" height="10" rx="2" fill="#fff3b0" ${thin}/><rect fill="#c9363f" x="8" y="-40" width="10" height="12" rx="2" ${thin}/>
      ${wheel(74, 22)}${wheel(306, 22)}` },
    van: { w: 252, lamp: [248, -34], tail: [12, -38], draw: (c) => `${shadow(252)}
      <rect x="6" y="-118" width="170" height="106" rx="8" fill="#fffaf1" ${o}/>
      <path d="M176 -86 H214 Q236 -86 248 -52 L252 -24 Q252 -12 242 -12 H176 Z" fill="${c}" ${o}/>
      <path d="M186 -78 H212 Q226 -78 234 -52 H186 Z" fill="${glass}" ${thin}/>
      <text x="91" y="-92" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="15" fill="${INK}">THE CRAZY</text>
      <text x="91" y="-74" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="15" fill="${INK}">WORDSEARCH</text>
      <text x="91" y="-56" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="15" fill="${INK}">TIMES</text>
      <path d="M26 -40 H156" stroke="${c}" stroke-width="8"/>
      <rect x="242" y="-38" width="10" height="8" rx="2" fill="#fff3b0" ${thin}/><rect fill="#c9363f" x="8" y="-44" width="8" height="12" rx="2" ${thin}/>
      ${wheel(56, 19)}${wheel(210, 19)}` },
  };
  // Each car is drawn once, blurred (and dimmed after dark), as a small image, so moving
  // it is just sliding a picture. Headlight beams and brake lights are drawn live on top.
  const carImages = new Map();
  function carImage(kind, color, tod) {
    const key = `${kind}|${color}|${tod}`;
    if (!carImages.has(key)) {
      const spec = CARS[kind];
      const dim = tod === 'night' ? 0.7 : tod === 'evening' ? 0.9 : 1;
      const shade = dim < 1 ? `<feComponentTransfer><feFuncR type="linear" slope="${dim}"/><feFuncG type="linear" slope="${dim}"/><feFuncB type="linear" slope="${dim + 0.05}"/></feComponentTransfer>` : '';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -170 ${spec.w + 24} 196"><defs><filter id="b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4"/>${shade}</filter></defs><g filter="url(#b)">${spec.draw(color)}</g></svg>`;
      carImages.set(key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    }
    return carImages.get(key);
  }

  const CAR_POOL = ['sedan', 'sedan', 'hatch', 'coupe', 'taxi', 'bus', 'van', 'hatch', 'sedan'];
  const CAR_COLORS = ['#8fb8ff', '#ff9aa8', '#6fbf73', '#ff6b5b', '#c9a3d6', '#f3d27a', '#5a6178', '#fffaf1', '#1fa3a3'];

  // -- People --

  const SKIN = ['#f4c9a4', '#e0a77e', '#b97a52', '#8a5a3a'];
  const HAIR = ['#3b2a20', '#8a5a35', '#d9b36a', '#2b2a33', '#b0b0b0'];
  const UMBRELLAS = ['#ff6b5b', '#1fa3a3', '#ffc145', '#8fb8ff'];

  // Side view, walking right (flip to walk left).
  function strollerSvg(coat, skin, hair, extra, umbrella) {
    return `<ellipse cx="0" cy="2" rx="20" ry="5" fill="#000" fill-opacity="0.15"/>
      <path class="ms-leg a" d="M-6 -40 L-10 0" ${o} fill="none"/><path class="ms-leg b" d="M6 -40 L10 0" ${o} fill="none"/>
      <path class="ms-arm" d="M0 -84 L-12 -52" ${o} fill="none"/>
      <rect x="-18" y="-96" width="36" height="60" rx="14" fill="${coat}" ${o}/>
      <circle cx="0" cy="-114" r="17" fill="${skin}" ${o}/>
      <path d="M-17 -118 Q-14 -136 2 -134 Q16 -132 17 -118 Q8 -126 -4 -124 Z" fill="${hair}"/>
      <circle cx="9" cy="-114" r="2" fill="${INK}"/>
      ${extra || ''}
      ${umbrella ? `<path d="M10 -88 V-150" ${thin}/><path d="M-36 -148 Q10 -196 56 -148 Z" fill="${umbrella}" ${o}/>` : ''}`;
  }

  // Front view, walking toward us (used for people crossing the street).
  function crosserSvg(coat, skin, hair, umbrella) {
    return `<ellipse cx="0" cy="2" rx="24" ry="6" fill="#000" fill-opacity="0.15"/>
      <rect class="ms-fleg a" x="-12" y="-44" width="10" height="44" rx="4" fill="#3b3440"/>
      <rect class="ms-fleg b" x="2" y="-44" width="10" height="44" rx="4" fill="#3b3440"/>
      <path d="M-20 -84 L-28 -54 M20 -84 L28 -54" ${o} fill="none"/>
      <rect x="-20" y="-100" width="40" height="62" rx="15" fill="${coat}" ${o}/>
      <circle cy="-118" r="17" fill="${skin}" ${o}/>
      <path d="M-17 -120 Q-16 -138 0 -138 Q16 -138 17 -120 Q10 -130 0 -130 Q-10 -130 -17 -120 Z" fill="${hair}"/>
      <circle cx="-6" cy="-117" r="2" fill="${INK}"/><circle cx="6" cy="-117" r="2" fill="${INK}"/>
      <path d="M-5 -109 Q0 -105 5 -109" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
      ${umbrella ? `<path d="M22 -60 V-156" ${thin}/><path d="M-30 -152 Q22 -200 74 -152 Z" fill="${umbrella}" ${o}/>` : ''}`;
  }

  // -- The shops across the street --

  const SHOPS = [
    { name: 'NEWS', wall: '#e9a07a', stripe: '#1fa3a3', goods: 'papers', roof: 'antenna' },
    { name: 'BOOKS', wall: '#8fb8a8', stripe: '#ff6b5b', goods: 'books', roof: 'tower' },
    { name: 'BAKERY', wall: '#f3d27a', stripe: '#b86b3a', goods: 'bread', roof: 'chimney' },
    { name: 'FLOWERS', wall: '#d7b3e0', stripe: '#6fbf73', goods: 'flowers', roof: 'garden' },
    { name: 'DINER', wall: '#8fb8dc', stripe: '#e0474f', goods: 'stools', roof: 'sign' },
  ];

  const GOODS = {
    papers: (x) => [0, 1, 2].map((k) => `<rect x="${x + 16 + k * 50}" y="${532 - k * 6}" width="40" height="${26 + k * 6}" fill="#fffaf1" ${thin}/><path d="M${x + 22 + k * 50} ${540 - k * 6} h28" stroke="${INK}" stroke-width="3"/>`).join(''),
    books: (x) => ['#ff6b5b', '#1fa3a3', '#ffc145', '#8fb8ff', '#6fbf73', '#ff9aa8'].map((c, k) => `<rect x="${x + 16 + k * 24}" y="${516 + (k % 2) * 8}" width="18" height="${46 - (k % 2) * 8}" fill="${c}" ${thin}/>`).join(''),
    bread: (x) => [0, 1, 2].map((k) => `<ellipse cx="${x + 40 + k * 50}" cy="548" rx="22" ry="13" fill="#d99a5b" ${thin}/><path d="M${x + 30 + k * 50} 544 l6 -4 M${x + 40 + k * 50} 544 l6 -4" ${thin}/>`).join('') + `<path d="M${x + 10} 520 H${x + 170}" stroke="${INK}" stroke-width="3"/>`,
    flowers: (x) => [0, 1, 2, 3].map((k) => `<path d="M${x + 32 + k * 40} 562 V530" ${thin}/><circle cx="${x + 32 + k * 40}" cy="526" r="12" fill="${['#ff9aa8', '#ffc145', '#8fb8ff', '#ff6b5b'][k]}" ${thin}/><rect x="${x + 22 + k * 40}" y="556" width="20" height="18" fill="#d97a4a" ${thin}/>`).join(''),
    stools: (x) => `<rect x="${x + 12}" y="532" width="150" height="14" fill="#fffaf1" ${thin}/>` + [0, 1, 2].map((k) => `<path d="M${x + 38 + k * 50} 556 V574" ${thin}/><circle cx="${x + 38 + k * 50}" cy="554" r="9" fill="#e0474f" ${thin}/>`).join(''),
  };

  function roofProp(kind, x, top) {
    if (kind === 'tower')
      return `<g><path d="M${x + 190} ${top - 14} l6 -30 M${x + 250} ${top - 14} l-6 -30" ${thin}/><rect x="${x + 184}" y="${top - 94}" width="72" height="54" rx="6" fill="#b37a4c" ${o}/><path d="M${x + 178} ${top - 94} L${x + 220} ${top - 124} L${x + 262} ${top - 94} Z" fill="#8a5a35" ${o}/><path d="M${x + 190} ${top - 78} H${x + 250} M${x + 190} ${top - 60} H${x + 250}" stroke="${INK}" stroke-opacity="0.35" stroke-width="3"/></g>`;
    if (kind === 'chimney')
      return `<rect x="${x + 230}" y="${top - 56}" width="30" height="44" fill="#c9624a" ${o}/><rect x="${x + 224}" y="${top - 64}" width="42" height="12" fill="#a24b37" ${thin}/>`;
    if (kind === 'antenna')
      return `<path d="M${x + 70} ${top - 12} V${top - 80} M${x + 50} ${top - 64} H${x + 90} M${x + 56} ${top - 50} H${x + 84}" ${thin} fill="none"/>`;
    if (kind === 'garden')
      return [0, 1, 2].map((k) => `<circle cx="${x + 60 + k * 90}" cy="${top - 24}" r="20" fill="#6fbf73" ${thin}/>`).join('');
    // A little rooftop billboard for the paper.
    return `<path d="M${x + 110} ${top - 12} V${top - 34} M${x + 210} ${top - 12} V${top - 34}" ${thin}/><rect x="${x + 70}" y="${top - 96}" width="180" height="64" rx="4" fill="#fffaf1" ${o}/>
      ${['#ff6b5b', '#ffc145', '#1fa3a3', '#ff6b5b', '#ffc145'].map((c, k) => `<rect x="${x + 84 + k * 31}" y="${top - 86}" width="26" height="26" rx="4" fill="${c}" ${thin}/>`).join('')}
      <path d="M${x + 84} ${top - 48} H${x + 236}" stroke="${INK}" stroke-width="5"/>`;
  }

  function shop(s, i, snow) {
    const x = i * 320;
    const top = 244 + (i % 2) * 22;
    let wins = '';
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < 3; k++) {
        const wx = x + 44 + k * 84;
        const wy = top + 30 + r * 60;
        wins += `<rect x="${wx - 5}" y="${wy - 5}" width="62" height="54" rx="3" fill="#fffaf1" ${thin}/><rect class="ms-win" x="${wx}" y="${wy}" width="52" height="44" rx="2"/>`;
        if ((i + k + r) % 3 === 0) wins += `<path d="M${wx} ${wy} L${wx + 18} ${wy} L${wx} ${wy + 36} Z M${wx + 52} ${wy} L${wx + 34} ${wy} L${wx + 52} ${wy + 36} Z" fill="${s.stripe}" fill-opacity="0.75"/>`;
        wins += `<path d="M${wx + 26} ${wy} V${wy + 44} M${wx} ${wy + 20} H${wx + 52}" stroke="#fffaf1" stroke-width="3"/>`;
        wins += `<rect x="${wx - 9}" y="${wy + 46}" width="70" height="7" rx="2" fill="#fffaf1" ${thin}/>`;
        if (r === 1 && (k + i) % 2 === 0) wins += `<rect x="${wx - 4}" y="${wy + 52}" width="60" height="12" fill="#b86b3a" ${thin}/>${[0, 1, 2].map((f) => `<circle cx="${wx + 8 + f * 18}" cy="${wy + 50}" r="6" fill="${['#ff9aa8', '#ffc145', '#ff6b5b'][f]}" ${thin}/>`).join('')}`;
      }
    }
    let awning = '';
    let scallops = '';
    for (let k = 0; k < 7; k++) {
      const fill = k % 2 ? '#fffaf1' : s.stripe;
      awning += `<rect x="${x + 22 + k * 40}" y="448" width="40" height="26" fill="${fill}"/>`;
      scallops += `<path d="M${x + 22 + k * 40} 474 a20 12 0 0 0 40 0" fill="${fill}" ${thin}/>`;
    }
    let dentils = '';
    for (let dx = x + 6; dx < x + 314; dx += 18) dentils += `<rect x="${dx}" y="${top + 6}" width="10" height="7" fill="#000" fill-opacity="0.14"/>`;
    const snowCaps = snow
      ? `<rect x="${x - 2}" y="${top - 22}" width="324" height="12" rx="6" fill="#fff" ${thin}/><path d="M${x + 18} 448 q140 -18 288 0 v-6 q-144 -16 -288 0 Z" fill="#fff" ${thin}/>`
      : '';
    return `<g>
      ${roofProp(s.roof, x, top)}
      <rect x="${x + 6}" y="${top}" width="308" height="${580 - top}" fill="${s.wall}" ${o}/>
      <rect x="${x + 296}" y="${top + 2}" width="16" height="${576 - top}" fill="#000" fill-opacity="0.08"/>
      <rect x="${x}" y="${top - 14}" width="320" height="18" fill="${INK}" fill-opacity="0.85"/>${dentils}
      ${wins}
      <rect x="${x + 28}" y="486" width="180" height="94" fill="#cfe6ef" ${thin}/>
      ${GOODS[s.goods](x + 28)}
      <path d="M${x + 44} 494 l30 -2 M${x + 44} 504 l14 -1 M${x + 150} 496 l24 -2" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-opacity="0.8"/>
      <rect x="${x + 226}" y="490" width="62" height="90" rx="4" fill="#9c6232" ${thin}/>
      <rect x="${x + 236}" y="500" width="42" height="34" rx="3" fill="#cfe6ef" ${thin}/>
      <rect x="${x + 240}" y="516" width="34" height="12" rx="2" fill="#ff6b5b"/>
      <circle cx="${x + 278}" cy="546" r="4" fill="#ffd35e"/>
      <rect x="${x + 218}" y="578" width="78" height="6" fill="#cbbfae" ${thin}/>
      <rect x="${x + 22}" y="474" width="280" height="12" fill="#000" fill-opacity="0.13"/>
      ${awning}<rect x="${x + 22}" y="448" width="280" height="26" fill="none" ${thin}/>${scallops}
      <rect x="${x + 70}" y="410" width="180" height="32" rx="6" fill="#fffaf1" ${thin}/>
      <text x="${x + 160}" y="434" text-anchor="middle" font-family="Fredoka, Verdana, sans-serif" font-weight="700" font-size="22" fill="${INK}">${s.name}</text>
      ${snowCaps}
    </g>`;
  }

  // -- Street furniture on the far sidewalk --

  const LAMPS = [150, 740, 1330];
  const TREES = [460, 1000];
  const LIGHT_X = 1080; // traffic light pole
  const CROSS_A = 1112; // crosswalk, left and right edges
  const CROSS_B = 1212;

  function furniture(snow) {
    const lamps = LAMPS.map((x) => `<rect x="${x - 6}" y="466" width="12" height="134" fill="#4a4d63" ${thin}/><rect x="${x - 12}" y="592" width="24" height="10" rx="3" fill="#4a4d63" ${thin}/><path d="M${x - 22} 468 H${x + 22} L${x + 14} 444 H${x - 14} Z" fill="#ffd35e" ${thin}/><path d="M${x - 8} 444 L${x} 434 L${x + 8} 444" fill="#4a4d63" ${thin}/>`).join('');
    const trees = TREES.map((x) => `<rect x="${x - 26}" y="592" width="52" height="10" rx="3" fill="#8b7d6b" ${thin}/><rect x="${x - 7}" y="520" width="14" height="80" fill="#9c6232" ${thin}/><circle cx="${x}" cy="498" r="44" fill="#6fbf73" ${o}/><circle cx="${x - 22}" cy="516" r="22" fill="#5fae63" ${thin}/><circle cx="${x - 14}" cy="484" r="9" fill="#fff" fill-opacity="0.3"/>${snow ? `<path d="M${x - 40} 480 Q${x} 440 ${x + 40} 480 Q${x} 466 ${x - 40} 480 Z" fill="#fff" ${thin}/>` : ''}`).join('');
    const bike = `<g transform="translate(96 600)"><circle cx="-18" cy="-16" r="16" fill="none" ${thin}/><circle cx="26" cy="-16" r="16" fill="none" ${thin}/><path d="M-18 -16 L0 -40 L20 -40 L26 -16 M0 -40 L6 -16 L-18 -16 M20 -40 L24 -48 M-4 -46 H8" fill="none" stroke="#e0474f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    const newsbox = `<g transform="translate(600 600)"><rect x="-22" y="-58" width="44" height="54" rx="4" fill="#3f6fd1" ${o}/><rect x="-16" y="-50" width="32" height="18" fill="#fffaf1" ${thin}/><text x="0" y="-37" text-anchor="middle" font-family="Georgia, serif" font-size="9" font-weight="700" fill="${INK}">TIMES</text><rect x="-18" y="-4" width="8" height="8" fill="${INK}"/><rect x="10" y="-4" width="8" height="8" fill="${INK}"/></g>`;
    const hydrant = `<g transform="translate(880 600)"><rect x="-12" y="-40" width="24" height="38" rx="6" fill="#e0474f" ${o}/><path d="M-16 -40 H16 L12 -48 H-12 Z" fill="#e0474f" ${thin}/><rect x="-20" y="-28" width="40" height="10" rx="4" fill="#e0474f" ${thin}/></g>`;
    const bench = `<g transform="translate(1440 600)"><rect x="-60" y="-40" width="120" height="10" rx="3" fill="#c98a52" ${thin}/><rect x="-60" y="-58" width="120" height="10" rx="3" fill="#c98a52" ${thin}/><path d="M-50 -30 V-2 M50 -30 V-2" stroke="#4a4d63" stroke-width="6" stroke-linecap="round"/></g>`;
    const pole = `<rect x="${LIGHT_X - 5}" y="470" width="10" height="130" fill="#4a4d63" ${thin}/><rect x="${LIGHT_X - 18}" y="400" width="36" height="86" rx="8" fill="${INK}"/>`;
    return lamps + trees + bike + newsbox + hydrant + bench + pole;
  }

  // The café's string lights: 5 bulbs on each of 4 swags under the awning.
  const BULBS = [];
  for (let seg = 0; seg < 4; seg++) {
    for (let t = 0.1; t < 1; t += 0.2) BULBS.push([seg * 400 + t * 400, 104 + 4 * t * (1 - t) * 60, seg * 5 + t * 10]);
  }

  // ---------------------------------------------------------------------------------
  // Still layers (each baked into an image with the frost blur applied)
  // ---------------------------------------------------------------------------------

  function bake(body, P, blur) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">
      <defs><filter id="f" x="-3%" y="-3%" width="106%" height="106%"><feGaussianBlur stdDeviation="${blur}"/><feColorMatrix type="saturate" values="1.08"/></filter></defs>
      <g filter="url(#f)">${body}<rect x="-60" y="-60" width="${W + 120}" height="${H + 120}" fill="${P.tint}" fill-opacity="${P.tintOp}"/></g></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function backLayer(P, weather, rng) {
    let stars = '';
    if (P.moon && weather === 'clear') for (let k = 0; k < 60; k++) stars += `<circle cx="${rng() * W}" cy="${rng() * 300}" r="${1 + rng() * 1.6}" fill="#fff6c8"/>`;
    const sun = P.hideSun ? '' : P.moon
      ? `<circle cx="${P.sunX}" cy="${P.sunY}" r="${P.sunR * 1.9}" fill="#fff5c7" fill-opacity="0.12"/><circle cx="${P.sunX}" cy="${P.sunY}" r="${P.sunR}" fill="${P.sun}" ${o}/><circle cx="${P.sunX + 20}" cy="${P.sunY - 12}" r="${P.sunR * 0.86}" fill="${P.sky1}"/>`
      : `<circle cx="${P.sunX}" cy="${P.sunY}" r="${P.sunR * 2.2}" fill="#fff3c4" fill-opacity="0.45"/><circle cx="${P.sunX}" cy="${P.sunY}" r="${P.sunR}" fill="${P.sun}" ${o}/>`;
    let clouds = '';
    if (weather === 'clear' && !P.moon) clouds = cloud(140, 130, 1.3, '#fff', 0.92) + cloud(640, 170, 1, '#fff', 0.9) + cloud(1010, 110, 1.15, '#fff', 0.9);
    else if (weather !== 'clear') for (let k = 0; k < 7; k++) clouds += cloud(k * 240 - 60 + rng() * 60, 90 + rng() * 120, 2 + rng(), weather === 'rain' ? '#9aa3ad' : '#e8edf2', 0.85);
    let far = '';
    for (let x = -30; x < W; ) {
      const bw = 90 + rng() * 120;
      const bh = 200 + rng() * 170;
      far += `<rect x="${x}" y="${360 - bh}" width="${bw}" height="${bh}" fill="${P.far}"/>`;
      x += bw - 10;
    }
    let near = '';
    let lights = '';
    for (let x = -20; x < W; ) {
      const bw = 70 + rng() * 90;
      const bh = 110 + rng() * 150;
      near += `<rect x="${x}" y="${340 - bh}" width="${bw}" height="${bh + 20}" fill="${P.city}" stroke="${INK}" stroke-opacity="0.15" stroke-width="3"/>`;
      for (let wy = 340 - bh + 16; wy < 326; wy += 24) {
        for (let wx = x + 12; wx < x + bw - 14; wx += 20) {
          if (rng() < (P.lit ? 0.42 : 0.2)) lights += `<rect x="${wx}" y="${wy}" width="9" height="12" fill="${P.cityWin}" fill-opacity="${P.lit ? 0.95 : 0.55}"/>`;
        }
      }
      x += bw + 6;
    }
    return `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky1}"/><stop offset="1" stop-color="${P.sky2}"/></linearGradient></defs>
      <rect x="-60" y="-60" width="${W + 120}" height="${H + 120}" fill="url(#sky)"/>${stars}${sun}${clouds}${far}${near}${lights}`;
  }

  function midLayer(P, weather, rng) {
    const snow = weather === 'snow';
    const wet = weather === 'rain';
    let paving = '';
    for (let x = 30; x < W; x += 64) paving += `<path d="M${x} 582 l-8 34" stroke="${INK}" stroke-opacity="0.1" stroke-width="2"/>`;
    let nearPaving = '';
    for (let x = 20; x < W; x += 80) nearPaving += `<path d="M${x} 778 l10 26" stroke="${INK}" stroke-opacity="0.1" stroke-width="2"/>`;
    let zebra = '';
    for (let y = 624; y < 770; y += 20) zebra += `<rect x="${CROSS_A}" y="${y}" width="${CROSS_B - CROSS_A}" height="10" fill="#fffaf1" fill-opacity="0.9"/>`;
    let dashes = '';
    for (let x = 0; x < W; x += 86) if (x + 46 < CROSS_A - 20 || x > CROSS_B + 20) dashes += `<rect x="${x}" y="691" width="46" height="6" fill="#fffaf1" fill-opacity="0.8"/>`;
    let puddles = '';
    if (wet) for (let k = 0; k < 9; k++) puddles += `<ellipse cx="${rng() * W}" cy="${636 + rng() * 130}" rx="${40 + rng() * 60}" ry="${4 + rng() * 4}" fill="#fff" fill-opacity="0.16"/>`;
    // After dark: lit shop windows, glowing storefronts, lamp light pooling on the pavement.
    let lit = '';
    if (P.lit) {
      SHOPS.forEach((s, i) => {
        const x = i * 320;
        const top = 244 + (i % 2) * 22;
        for (let r = 0; r < 2; r++) {
          for (let k = 0; k < 3; k++) {
            if (rng() < 0.6) lit += `<rect x="${x + 44 + k * 84}" y="${top + 30 + r * 60}" width="52" height="44" rx="2" fill="#ffd86b" fill-opacity="0.85"/>`;
          }
        }
        lit += `<rect x="${x + 28}" y="486" width="180" height="94" fill="#ffe7a3" fill-opacity="0.5"/><ellipse cx="${x + 118}" cy="604" rx="110" ry="12" fill="#ffe7a3" fill-opacity="0.35"/>`;
        if (wet) lit += `<rect x="${x + 50}" y="630" width="130" height="60" fill="#ffe7a3" fill-opacity="0.12"/>`;
      });
      LAMPS.forEach((x) => {
        lit += `<circle cx="${x}" cy="458" r="54" fill="#ffe89a" fill-opacity="0.4"/><ellipse cx="${x}" cy="606" rx="70" ry="12" fill="#ffe89a" fill-opacity="0.35"/>`;
      });
    }
    // (The layer is drawn as an image, which can't see the page's CSS: colour the windows here.)
    const shops = SHOPS.map((s, i) => shop(s, i, snow)).join('').replace(/class="ms-win"/g, `fill="${P.win}"`);
    return `${shops}
      <rect y="580" width="${W}" height="36" fill="${P.walk}"/>${paving}
      <rect y="612" width="${W}" height="8" fill="${P.edge}"/><path d="M0 620 H${W}" stroke="${INK}" stroke-width="4"/>
      ${furniture(snow)}
      <rect y="620" width="${W}" height="156" fill="${P.road}"/>
      <rect y="620" width="${W}" height="22" fill="#000" fill-opacity="0.08"/>
      ${zebra}${dashes}
      <rect x="${CROSS_A - 16}" y="698" width="6" height="74" fill="#fffaf1" fill-opacity="0.85"/><rect x="${CROSS_B + 10}" y="624" width="6" height="66" fill="#fffaf1" fill-opacity="0.85"/>
      <ellipse cx="420" cy="742" rx="34" ry="8" fill="#4a4852" stroke="${INK}" stroke-opacity="0.5" stroke-width="3"/>
      ${puddles}
      <rect y="772" width="${W}" height="8" fill="${P.edge}"/><path d="M0 772 H${W}" stroke="${INK}" stroke-width="4"/>
      <rect y="780" width="${W}" height="30" fill="${P.walk}"/>${nearPaving}
      ${lit}`;
  }

  function frontLayer(P, weather) {
    const snow = weather === 'snow';
    let rails = '';
    for (let x = 10; x < W; x += 42) rails += `<rect x="${x}" y="806" width="7" height="58" fill="#3b3440"/><circle cx="${x + 3.5}" cy="836" r="5" fill="none" stroke="#3b3440" stroke-width="3"/>`;
    const planters = [520, 900].map((x) => `<rect x="${x}" y="772" width="150" height="34" rx="4" fill="#b86b3a" ${o}/>${[0, 1, 2, 3, 4].map((k) => `<circle cx="${x + 18 + k * 29}" cy="768" r="13" fill="${['#ff9aa8', '#6fbf73', '#ffc145', '#6fbf73', '#ff6b5b'][k]}" ${thin}/>`).join('')}`).join('');
    let awning = '';
    for (let k = 0; k * 90 < W + 90; k++) {
      const fill = k % 2 ? '#fbf1e1' : '#e2574c';
      awning += `<rect x="${k * 90}" y="-60" width="90" height="122" fill="${fill}"/><path d="M${k * 90} 62 a45 22 0 0 0 90 0 Z" fill="${fill}" ${o}/>`;
    }
    const chalk = `<g transform="translate(1235 900)">
      <path d="M-62 0 L-44 -150 H44 L62 0" fill="none" stroke="#8a5a35" stroke-width="10" stroke-linecap="round"/>
      <rect x="-52" y="-148" width="104" height="120" rx="6" fill="#2f3a36" stroke="#8a5a35" stroke-width="8"/>
      <text x="0" y="-120" text-anchor="middle" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#fff">TODAY’S</text>
      <text x="0" y="-102" text-anchor="middle" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#ffd35e">SPECIAL</text>
      <path d="M-36 -88 H36 M-30 -74 H30 M-34 -60 H22" stroke="#fff" stroke-opacity="0.7" stroke-width="3" stroke-linecap="round"/>
      <path d="M-14 -46 q14 -10 28 0" fill="none" stroke="#ff9aa8" stroke-width="3" stroke-linecap="round"/></g>`;
    const table = `<ellipse cx="250" cy="892" rx="250" ry="56" fill="#fbf4e8" ${o}/><ellipse cx="250" cy="880" rx="230" ry="44" fill="none" stroke="${INK}" stroke-opacity="0.1" stroke-width="3"/>
      <ellipse cx="190" cy="868" rx="48" ry="12" fill="#fffaf1" ${thin}/>
      <path d="M160 820 H220 L214 858 Q212 868 202 868 H178 Q168 868 166 858 Z" fill="#ff6b5b" ${o}/>
      <path d="M218 830 C236 828 236 850 214 850" fill="none" ${thin}/>
      <ellipse cx="190" cy="820" rx="30" ry="6" fill="#6b3f1f" ${thin}/>
      <path d="M280 852 L400 840 L412 876 L292 888 Z" fill="#fffaf1" ${thin}/>
      <path d="M296 858 L392 848" stroke="${INK}" stroke-width="4"/><path d="M298 868 L360 862 M300 878 L380 870" stroke="${INK}" stroke-opacity="0.4" stroke-width="3"/>
      <rect x="430" y="846" width="26" height="36" rx="4" fill="#fffaf1" ${thin}/><path d="M436 846 V834 H450 V846" fill="none" ${thin}/>`;
    const plant = `<path d="M1380 700 C1360 640 1420 610 1440 680 C1450 600 1520 610 1500 690 C1540 650 1580 690 1540 730 Z" fill="#6fbf73" ${o}/>
      <path d="M1400 690 C1420 660 1440 700 1430 720 M1500 680 C1520 660 1530 700 1510 716" fill="none" stroke="#4f9a55" stroke-width="4"/>
      <path d="M1390 730 H1560 L1540 900 H1410 Z" fill="#d97a4a" ${o}/><rect x="1380" y="720" width="190" height="24" rx="6" fill="#e58f5e" ${o}/>`;
    const snowFront = snow ? `<rect y="796" width="${W}" height="10" rx="5" fill="#fff"/><path d="M0 70 Q800 96 ${W} 70 L${W} 60 L0 60 Z" fill="#fff" ${thin}/><path d="M1384 716 H1566 Q1560 704 1476 706 Q1392 704 1384 716 Z" fill="#fff" ${thin}/>` : '';
    return `${planters}
      <rect y="798" width="${W}" height="10" fill="#3b3440"/>${rails}<rect y="858" width="${W}" height="8" fill="#3b3440"/>
      <rect y="864" width="${W}" height="60" fill="#d8c3a5"/><path d="M0 880 H${W}" stroke="${INK}" stroke-opacity="0.15" stroke-width="3"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => `<path d="M${k * 220} 866 l-30 40" stroke="${INK}" stroke-opacity="0.12" stroke-width="3"/>`).join('')}
      ${table}${chalk}${plant}
      ${awning}
      <path d="M0 104 Q200 164 400 104 T800 104 T1200 104 T1600 104" fill="none" stroke="${INK}" stroke-width="3"/>
      ${BULBS.map(([x, y]) => `<path d="M${x} ${y - 10} v6" ${thin}/><circle cx="${x}" cy="${y}" r="8" fill="${P.lit ? '#ffe27a' : '#fff3b0'}" stroke="${INK}" stroke-width="2.5"/>`).join('')}
      ${snowFront}`;
  }

  // ---------------------------------------------------------------------------------
  // Moving layers
  // ---------------------------------------------------------------------------------

  function midMoving(P, weather, rng) {
    const umbrella = weather === 'rain';
    const pick = (list) => list[Math.floor(rng() * list.length)];
    const walker = (coat, dir, d, delay, extra) =>
      `<g class="ms-walker ${dir}" style="--d:${d}s;--delay:${delay}s"><g transform="translate(0 606) scale(${dir === 'left' ? -1 : 1} 1)"><g class="ms-step ms-blur ms-shaded">${strollerSvg(coat, pick(SKIN), pick(HAIR), extra, umbrella ? pick(UMBRELLAS) : '')}</g></g></g>`;
    return `
      <defs><linearGradient id="ms-beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff3b0" stop-opacity="0.9"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/></linearGradient>
        <radialGradient id="ms-brake"><stop offset="0" stop-color="#ff5a4a" stop-opacity="0.95"/><stop offset="1" stop-color="#ff5a4a" stop-opacity="0"/></radialGradient></defs>
      ${[0, 1, 2].map((k) => `<g class="ms-bird" style="--d:${24 + k * 8}s;--delay:${-k * 11}s"><g class="ms-blur"><path transform="translate(0 ${180 + k * 36})" class="ms-wingbeat" d="M0 10 Q8 0 16 9 Q24 0 32 10" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g></g>`).join('')}
      ${walker('#ff6b5b', 'right', 34, -4, `<rect x="10" y="-80" width="22" height="16" fill="#fffaf1" ${thin}/>`)}
      ${walker('#1fa3a3', 'left', 42, -20)}
      ${walker('#ffc145', 'right', 38, -30, `<path d="M-16 -128 H16 L10 -142 H-10 Z" fill="${INK}"/>`)}
      ${walker('#8fb8ff', 'left', 47, -8)}
      <g class="ms-lane far"></g>
      <g class="ms-crossers"></g>
      <g class="ms-lane near"></g>
      <g class="ms-blur ms-signal phase-green"><circle class="r" cx="${LIGHT_X}" cy="418" r="9"/><circle class="y" cx="${LIGHT_X}" cy="443" r="9"/><circle class="g" cx="${LIGHT_X}" cy="468" r="9"/></g>`;
  }

  function frontMoving(P, weather, rng) {
    // After dark the string lights glow (soft gradients, nothing to redraw each frame).
    const glows = P.lit
      ? `<defs><radialGradient id="ms-bulbglow"><stop offset="0" stop-color="#ffe27a" stop-opacity="0.9"/><stop offset="0.35" stop-color="#ffd35e" stop-opacity="0.45"/><stop offset="1" stop-color="#ffd35e" stop-opacity="0"/></radialGradient></defs>` +
        BULBS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="26" fill="url(#ms-bulbglow)"/>`).join('')
      : '';
    const steam = (x, cls) => `<path class="ms-steam${cls}" d="M${x} 808 C${x - 6} 798 ${x + 6} 792 ${x} 780" fill="none" stroke="#b9a58c" stroke-opacity="0.55" stroke-width="7" stroke-linecap="round"/>`;
    return `${steam(180, '')}${steam(198, ' two')}${glows}`;
  }

  // Rain or snow: tiled sheets that slide down. Moving a whole sheet is done by the
  // graphics card without redrawing anything, so falling weather is nearly free.
  function weatherSheets(weather, rng) {
    if (weather === 'clear') return '';
    const tile = (size, body) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${body}</svg>`)}")`;
    const sheet = (cls, size, body, extra) => `<div class="ms-sheet ${cls}" style="--tile:${size}px;background-image:${tile(size, body).replace(/"/g, "'")};${extra || ''}"></div>`;
    let near = '';
    let far = '';
    if (weather === 'rain') {
      for (let k = 0; k < 7; k++) near += `<path d="M${20 + rng() * 240} ${20 + rng() * 220} l-9 34" stroke="#fff" stroke-opacity="0.6" stroke-width="2.6" stroke-linecap="round"/>`;
      for (let k = 0; k < 10; k++) far += `<path d="M${10 + rng() * 180} ${10 + rng() * 170} l-5 20" stroke="#fff" stroke-opacity="0.45" stroke-width="1.8" stroke-linecap="round"/>`;
      return sheet('rain far', 200, far) + sheet('rain near', 280, near);
    }
    for (let k = 0; k < 7; k++) near += `<circle cx="${20 + rng() * 260}" cy="${20 + rng() * 260}" r="${3 + rng() * 3}" fill="#fff" fill-opacity="0.95"/>`;
    for (let k = 0; k < 12; k++) far += `<circle cx="${10 + rng() * 180}" cy="${10 + rng() * 180}" r="${1.6 + rng() * 1.8}" fill="#fff" fill-opacity="0.85"/>`;
    return `<div class="ms-sway">${sheet('snow far', 200, far)}</div><div class="ms-sway slow">${sheet('snow near', 300, near)}</div>`;
  }

  // Droplets and frost on the glass itself (in focus, in front of everything).
  function glassLayer(weather, tod, rng) {
    let out = '';
    const drop = (x, y, r) =>
      `<g transform="translate(${x} ${y})"><circle r="${r}" fill="#fff" fill-opacity="0.16" stroke="${INK}" stroke-opacity="0.12" stroke-width="1.5"/><path d="M${-r * 0.6} ${r * 0.5} A${r * 0.8} ${r * 0.8} 0 0 0 ${r * 0.6} ${r * 0.5}" fill="none" stroke="${INK}" stroke-opacity="0.18" stroke-width="1.5"/><circle cx="${-r * 0.35}" cy="${-r * 0.35}" r="${r * 0.28}" fill="#fff" fill-opacity="0.8"/></g>`;
    if (weather === 'rain') {
      for (let k = 0; k < 110; k++) out += drop(rng() * W, rng() * H, 2.5 + rng() * 6);
      for (let k = 0; k < 6; k++) {
        const x = 60 + rng() * (W - 120);
        out += `<g class="ms-drip" style="--d:${9 + rng() * 8}s;--delay:${-rng() * 12}s"><rect x="${x - 2}" y="-60" width="4" height="56" rx="2" fill="#fff" fill-opacity="0.18"/>${drop(x, 0, 6)}</g>`;
      }
    } else if (weather === 'snow') {
      // Frost creeping in from the bottom corners of a cold window.
      out += `<defs><radialGradient id="frostL" cx="0" cy="1" r="1"><stop offset="0" stop-color="#fff" stop-opacity="0.85"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
        <radialGradient id="frostR" cx="1" cy="1" r="1"><stop offset="0" stop-color="#fff" stop-opacity="0.85"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
        <rect x="0" y="${H - 360}" width="420" height="360" fill="url(#frostL)"/><rect x="${W - 420}" y="${H - 360}" width="420" height="360" fill="url(#frostR)"/>`;
    } else if (tod === 'morning') {
      // A little condensation along the bottom of a cool morning window.
      for (let k = 0; k < 40; k++) out += drop(rng() * W, H - rng() * 140, 1.5 + rng() * 3.5);
    }
    return `<svg class="ms-glass" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${out}</svg>`;
  }

  // ---------------------------------------------------------------------------------
  // Traffic: cars drive, keep their distance, and obey the light
  // ---------------------------------------------------------------------------------

  // Light cycle for the cars (seconds). People cross while it's red.
  const PHASES = [['green', 11], ['yellow', 2.6], ['red', 8.5]];
  const CYCLE = PHASES.reduce((t, p) => t + p[1], 0);
  const ACCEL = 150;
  const BRAKE = 420;
  const GAP = 26;

  // Positions run along each lane's direction of travel: `r` is the car's rear, its front
  // is r + len. The near lane drives right, the far lane left.
  const LANES = {
    near: { y: 776, s: 1.08, dir: 1, stop: CROSS_A - 20 },
    far: { y: 686, s: 0.8, dir: -1, stop: W - (CROSS_B + 20) },
  };

  let traffic = null;

  function newCar(laneName, rng, r) {
    const lane = LANES[laneName];
    const kind = CAR_POOL[Math.floor(rng() * CAR_POOL.length)];
    const color = kind === 'taxi' ? '#ffc145' : kind === 'van' ? '#ff6b5b' : kind === 'bus' ? (rng() < 0.5 ? '#1fa3a3' : '#e0474f') : CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
    const spec = CARS[kind];
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    el.setAttribute('class', 'ms-car');
    const [lx, ly] = spec.lamp;
    const [tx, ty] = spec.tail;
    el.innerHTML = `<path class="ms-beam" d="M${lx} ${ly - 4} L${lx + 190} ${ly - 30} L${lx + 190} ${ly + 26} Z" fill="url(#ms-beam)"/>
      <image href="${carImage(kind, color, shown.tod)}" x="-12" y="-170" width="${spec.w + 24}" height="196"/>
      <circle class="ms-brake" cx="${tx}" cy="${ty}" r="16" fill="url(#ms-brake)"/>`;
    const cruise = (kind === 'bus' ? 150 : 190 + rng() * 80) * (laneName === 'far' ? 0.8 : 1);
    return { el, lane: laneName, len: spec.w * lane.s, r, v: cruise * 0.8, cruise, braking: false, parked: false };
  }

  function placeCar(car) {
    const lane = LANES[car.lane];
    const x = lane.dir > 0 ? car.r : W - car.r;
    car.el.setAttribute('transform', `translate(${x.toFixed(1)} ${lane.y}) scale(${lane.dir * lane.s} ${lane.s})`);
  }

  function setupTraffic(root, rng) {
    traffic = { root, rng, cars: { near: [], far: [] }, crossers: [], time: rng() * CYCLE, phase: 'green' };
    Object.keys(LANES).forEach((name) => {
      const group = root.querySelector(`.ms-lane.${name}`);
      let r = W + 60;
      for (let k = 0; k < 4; k++) {
        const car = newCar(name, rng, 0);
        r -= car.len + 120 + rng() * 360;
        car.r = r;
        group.appendChild(car.el);
        traffic.cars[name].push(car);
        placeCar(car);
      }
    });
  }

  function phaseAt(t) {
    let acc = 0;
    for (const [name, len] of PHASES) {
      acc += len;
      if (t % CYCLE < acc) return name;
    }
    return 'green';
  }

  function stepTraffic(dt) {
    const T = traffic;
    T.time += dt;
    const phase = phaseAt(T.time);
    if (phase !== T.phase) {
      T.phase = phase;
      T.root.querySelector('.ms-signal').setAttribute('class', `ms-blur ms-signal phase-${phase}`);
      if (phase === 'red') spawnCrossers();
    }
    const stopping = phase !== 'green';

    Object.keys(LANES).forEach((name) => {
      const lane = LANES[name];
      const cars = T.cars[name].sort((a, b) => b.r - a.r); // front of the queue first
      cars.forEach((car, i) => {
        const front = car.r + car.len;
        let limit = car.cruise;
        // Keep a safe distance behind the car ahead.
        const leader = cars[i - 1];
        if (leader) limit = Math.min(limit, Math.sqrt(2 * BRAKE * Math.max(0, leader.r - front - GAP)) + leader.v * 0.6);
        // Stop at the line on red, and on yellow if there's room to stop comfortably.
        const toLine = lane.stop - front;
        if (stopping && toLine > -4) {
          const canStop = toLine > (car.v * car.v) / (2 * BRAKE) - 6;
          if (phase === 'red' || canStop) limit = Math.min(limit, Math.sqrt(2 * BRAKE * Math.max(0, toLine - 2)));
        }
        const before = car.v;
        car.v = Math.max(0, Math.min(car.v + ACCEL * dt, limit));
        car.r += car.v * dt;
        const braking = car.v < before - 1;
        const parked = car.v < 6;
        if (braking !== car.braking || parked !== car.parked) {
          car.braking = braking;
          car.parked = parked;
          car.el.setAttribute('class', `ms-car${braking || parked ? ' braking' : ''}${parked ? ' parked' : ''}`);
        }
        // Off the far end: rejoin at the back of the lane as a different vehicle.
        if (car.r > W + 80) {
          const last = cars.reduce((m, c) => Math.min(m, c.r), Infinity);
          const fresh = newCar(name, T.rng, 0);
          fresh.r = Math.min(-fresh.len - 40, last - fresh.len - 140 - T.rng() * 420);
          fresh.v = fresh.cruise;
          car.el.replaceWith(fresh.el);
          cars[i] = fresh;
          placeCar(fresh);
          return;
        }
        placeCar(car);
      });
    });

    // People crossing toward us while the cars wait.
    T.crossers = T.crossers.filter((p) => {
      p.t += dt;
      if (p.t < 0) return true;
      const k = Math.min(1, p.t / p.dur);
      const y = 612 + k * 250;
      const s = 0.95 + k * 0.4;
      p.el.setAttribute('transform', `translate(${p.x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})`);
      p.el.setAttribute('opacity', k > 0.8 ? ((1 - k) / 0.2).toFixed(2) : '1');
      if (k >= 1) {
        p.el.remove();
        return false;
      }
      return true;
    });
  }

  function spawnCrossers() {
    const T = traffic;
    const group = T.root.querySelector('.ms-crossers');
    const count = 1 + (T.rng() < 0.55 ? 1 : 0);
    const rain = shown && shown.weather === 'rain';
    for (let k = 0; k < count; k++) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const pick = (list) => list[Math.floor(T.rng() * list.length)];
      el.innerHTML = `<g class="ms-cross ms-blur ms-shaded">${crosserSvg(pick(['#ff6b5b', '#1fa3a3', '#ffc145', '#8fb8ff', '#c9a3d6', '#6fbf73']), pick(SKIN), pick(HAIR), rain ? pick(UMBRELLAS) : '')}</g>`;
      el.setAttribute('opacity', '0');
      group.appendChild(el);
      T.crossers.push({ el, x: CROSS_A + 26 + T.rng() * (CROSS_B - CROSS_A - 52), t: -(0.4 + k * 1.3 + T.rng() * 0.6), dur: 6.2 + T.rng() * 1.2 });
    }
  }

  // ---------------------------------------------------------------------------------
  // Parallax and the frame loop
  // ---------------------------------------------------------------------------------

  const view = { px: 0, py: 0, tx: 0, ty: 0, lastMouse: -1e9 };
  let frame = 0;
  let last = 0;

  // Slow machines: if the scene can't hold ~42 fps once the menu has settled, switch to a
  // lighter version (no parallax, flat layers, still weather) and remember that.
  const LITE_KEY = 'crazyCrossword.menuLite';
  let lite = false;
  try {
    lite = localStorage.getItem(LITE_KEY) === '1';
  } catch (e) {
    lite = false;
  }
  const timing = { frames: 0, elapsed: 0, checked: lite };

  function goLite() {
    lite = true;
    host.classList.add('ms-lite');
    host.style.removeProperty('--px');
    host.style.removeProperty('--py');
    try {
      localStorage.setItem(LITE_KEY, '1');
    } catch (e) {
      /* private mode: just stay light for this visit */
    }
  }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    view.tx = (e.clientX / window.innerWidth - 0.5) * -28;
    view.ty = (e.clientY / window.innerHeight - 0.5) * -14;
    view.lastMouse = performance.now();
  }, { passive: true });

  function onMenu() {
    return document.body.dataset.screen === 'menu' && !document.hidden;
  }

  function tick(now) {
    frame = 0;
    if (!onMenu() || !traffic) return;
    const raw = (now - last) / 1000 || 0;
    const dt = Math.min(0.05, raw);
    last = now;
    stepTraffic(dt);
    if (!timing.checked && raw < 0.5) {
      timing.frames++;
      // Skip the busy first couple of seconds (fonts, stickers flying in), then time 150 frames.
      if (timing.frames > 100) timing.elapsed += raw;
      if (timing.frames === 250) {
        timing.checked = true;
        if (150 / timing.elapsed < 42) goLite();
      }
    }
    if (lite) {
      frame = requestAnimationFrame(tick);
      return;
    }
    // With no mouse (phones, tablets), a slow idle drift keeps the depth alive.
    if (now - view.lastMouse > 4000) {
      view.tx = Math.sin(now / 5200) * 10;
      view.ty = Math.cos(now / 7100) * 4;
    }
    view.px += (view.tx - view.px) * Math.min(1, dt * 3);
    view.py += (view.ty - view.py) * Math.min(1, dt * 3);
    host.style.setProperty('--px', view.px.toFixed(2) + 'px');
    host.style.setProperty('--py', view.py.toFixed(2) + 'px');
    frame = requestAnimationFrame(tick);
  }

  function start() {
    if (reduceMotion || frame || !traffic) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) start();
  });

  // ---------------------------------------------------------------------------------
  // Building it
  // ---------------------------------------------------------------------------------

  const host = document.getElementById('menu-scene');
  let shown = null;
  if (host && lite) host.classList.add('ms-lite');

  function build(tod, weather, date) {
    const P = palette(tod, weather);
    const rng = CC.makeRng(20251 + date.getDate());
    const lit = P.lit ? ' lit' : '';
    const svg = (cls, body) =>
      `<svg class="ms-layer ${cls} tod-${tod}${lit}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${body}</svg>`;
    host.style.background = P.sky2;
    host.querySelector('.ms-view').innerHTML = `
      <img class="ms-layer ms-back" alt="" src="${bake(backLayer(P, weather, rng), P, 6)}">
      <img class="ms-layer ms-mid" alt="" src="${bake(midLayer(P, weather, rng), P, 4.5)}">
      ${svg('ms-mid ms-moving', midMoving(P, weather, rng))}
      <img class="ms-layer ms-front" alt="" src="${bake(frontLayer(P, weather), Object.assign({}, P, { tintOp: P.tintOp * 0.7 }), 5)}">
      ${svg('ms-front ms-moving', frontMoving(P, weather, rng))}
      ${weatherSheets(weather, rng)}`;
    host.querySelector('.ms-glass-host').innerHTML = glassLayer(weather, tod, rng);
    setupTraffic(host.querySelector('.ms-mid.ms-moving'), rng);
    // Settle the traffic into a natural spread before anyone sees it.
    for (let k = 0; k < 240; k++) stepTraffic(1 / 20);
  }

  CC.MenuScene = {
    // (Re)draws the scene if the time of day or the weather has changed, and makes sure
    // it's moving. Called whenever the main menu is shown.
    refresh(date) {
      if (!host) return;
      const d = date || new Date();
      const tod = timeOfDay(d);
      const weather = weatherFor(d);
      if (!shown || shown.tod !== tod || shown.weather !== weather) {
        shown = { tod, weather };
        build(tod, weather, d);
      }
      start();
    },
    get weather() {
      return shown ? shown.weather : weatherFor(new Date());
    },
    // For tests: the live traffic state (read-only use).
    get traffic() {
      return traffic;
    },
  };

  CC.MenuScene.refresh();
})();
