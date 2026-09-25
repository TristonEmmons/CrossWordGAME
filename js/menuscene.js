/* Main-menu backdrop: the view from a table on a café patio, looking out past the
   railing at a busy street. Shops and the city across the road, cars, a taxi, a bus and
   the paper's delivery van driving both ways, people strolling, a traffic light, birds,
   and the café's own awning and string lights overhead. It follows the player's clock
   (morning, day, evening, night) and sits behind a frosted-glass pane so the menu
   stays easy to read. Everything moves with CSS, and only while the menu is showing.
   The frosting is done by blurring the scene's pieces (see build), not the screen. */
(function () {
  'use strict';

  const CC = window.CC;
  const INK = '#2b2a33';
  const W = 1600;
  const H = 900;
  const o = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
  const thin = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

  // Colours for each time of day. The still layer is drawn as an image, which can't see
  // the page's CSS, so its colours are written straight into it from here.
  const PALETTES = {
    morning: { sky1: '#ffc9a0', sky2: '#fff1dc', city: '#e8cdb8', citywin: 'rgba(255,255,255,0.5)', road: '#6b6770', walk: '#e9dfd2', sun: '#ffd07a', win: '#dcecf5', tint: '#ffbe78', tintOp: 0.08 },
    day: { sky1: '#9fd8f0', sky2: '#e6f6fb', city: '#c7d7e2', citywin: 'rgba(255,255,255,0.5)', road: '#6b6770', walk: '#e9dfd2', sun: '#ffe08a', win: '#dcecf5', tint: '#ffffff', tintOp: 0 },
    evening: { sky1: '#f08a6b', sky2: '#ffd29a', city: '#b98f9a', citywin: '#ffd86b', road: '#5c5663', walk: '#e9dfd2', sun: '#ffb35e', win: '#f3d6b8', tint: '#783c6e', tintOp: 0.14 },
    night: { sky1: '#1f2550', sky2: '#3d4378', city: '#2c3160', citywin: '#ffd86b', road: '#3a3844', walk: '#8f8aa0', sun: '#fdf1c0', win: '#5a6090', tint: '#14183c', tintOp: 0.38 },
  };

  // Writes a palette's colours in place of the still layer's colour classes.
  function paintStill(markup, P) {
    const fills = {
      'ms-sky1': `stop-color="${P.sky1}"`,
      'ms-sky2': `stop-color="${P.sky2}"`,
      'ms-sun': `fill="${P.sun}"`,
      'ms-moonbite': `fill="${P.sky1}"`,
      'ms-city': `fill="${P.city}" stroke="#2b2a33" stroke-opacity="0.15" stroke-width="3"`,
      'ms-citywin': `fill="${P.citywin}"`,
      'ms-win': `fill="${P.win}"`,
      'ms-road': `fill="${P.road}"`,
      'ms-walk': `fill="${P.walk}"`,
      'ms-tint': `fill="${P.tint}" fill-opacity="${P.tintOp}"`,
      'ms-lampglow': `opacity="0.45"`,
    };
    return markup.replace(/class="(ms-[a-z0-9]+)"/g, (m, name) => fills[name] || m);
  }

  function timeOfDay(date) {
    const h = date.getHours();
    if (h >= 5 && h < 10) return 'morning';
    if (h >= 10 && h < 17) return 'day';
    if (h >= 17 && h < 20) return 'evening';
    return 'night';
  }

  // ---- Cars (drawn facing right, wheels on y = 0) ----

  function wheel(x, r) {
    return `<g transform="translate(${x} -${r - 4})"><g class="ms-wheel">
      <circle r="${r}" fill="${INK}"/><circle r="${r * 0.48}" fill="#d9d4cc"/>
      <path d="M0 -${r * 0.48} V${r * 0.48} M-${r * 0.48} 0 H${r * 0.48}" stroke="${INK}" stroke-width="3"/></g></g>`;
  }

  const beam = (x, y) =>
    `<path class="ms-beam" d="M${x} ${y - 4} L${x + 150} ${y - 26} L${x + 150} ${y + 22} Z" fill="#fff3b0"/>`;

  const CARS = {
    sedan: (color) => `${beam(196, -32)}
      <path d="M8 -22 Q8 -40 30 -42 L62 -44 Q82 -76 112 -76 L140 -76 Q164 -76 178 -46 L190 -44 Q200 -42 200 -24 L200 -14 Q200 -8 194 -8 L14 -8 Q8 -8 8 -14 Z" fill="${color}" ${o}/>
      <path d="M72 -46 Q88 -68 110 -68 L120 -68 L120 -46 Z M128 -68 L140 -68 Q156 -68 168 -46 L128 -46 Z" fill="#cfe8f2" ${thin}/>
      <path d="M124 -40 H134" ${thin}/><rect x="190" y="-38" width="10" height="8" rx="2" class="ms-headlamp" fill="#fff3b0" ${thin}/>
      <rect x="6" y="-36" width="8" height="8" rx="2" fill="#e0474f" ${thin}/>
      ${wheel(52, 18)}${wheel(158, 18)}`,
    taxi: (color) => `${CARS.sedan(color)}
      <rect x="96" y="-94" width="44" height="18" rx="4" fill="#fff" ${thin}/>
      <text x="118" y="-81" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="12" fill="${INK}">TAXI</text>
      <path d="M20 -26 H190" stroke="${INK}" stroke-width="5" stroke-dasharray="10 10" opacity="0.7"/>`,
    coupe: (color) => `${beam(160, -30)}
      <path d="M8 -20 Q6 -44 40 -50 Q60 -86 100 -86 Q140 -86 152 -50 Q170 -46 168 -20 L168 -14 Q168 -8 162 -8 L14 -8 Q8 -8 8 -14 Z" fill="${color}" ${o}/>
      <path d="M52 -50 Q68 -76 96 -76 Q124 -76 136 -50 Z" fill="#cfe8f2" ${thin}/><path d="M96 -76 V-50" ${thin}/>
      <circle cx="158" cy="-34" r="6" class="ms-headlamp" fill="#fff3b0" ${thin}/>
      ${wheel(44, 17)}${wheel(132, 17)}`,
    bus: (color) => `${beam(376, -34)}
      <rect x="6" y="-128" width="370" height="118" rx="18" fill="${color}" ${o}/>
      <rect x="6" y="-58" width="370" height="16" fill="#fffaf1" ${thin}/>
      ${[0, 1, 2, 3, 4].map((k) => `<rect x="${28 + k * 62}" y="-112" width="50" height="40" rx="6" fill="#cfe8f2" ${thin}/>`).join('')}
      <rect x="336" y="-112" width="30" height="72" rx="5" fill="#cfe8f2" ${thin}/>
      <rect x="120" y="-148" width="150" height="22" rx="5" fill="${INK}"/>
      <text x="195" y="-132" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="14" fill="#ffd35e">5 · DOWNTOWN</text>
      <rect x="362" y="-40" width="12" height="10" rx="2" class="ms-headlamp" fill="#fff3b0" ${thin}/>
      ${wheel(74, 22)}${wheel(306, 22)}`,
    van: (color) => `${beam(252, -30)}
      <rect x="6" y="-116" width="170" height="104" rx="8" fill="#fffaf1" ${o}/>
      <path d="M176 -84 H214 Q236 -84 248 -52 L252 -24 Q252 -12 242 -12 H176 Z" fill="${color}" ${o}/>
      <path d="M186 -76 H212 Q226 -76 234 -52 H186 Z" fill="#cfe8f2" ${thin}/>
      <text x="91" y="-90" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="15" fill="${INK}">THE CRAZY</text>
      <text x="91" y="-72" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="15" fill="${INK}">WORDSEARCH</text>
      <text x="91" y="-54" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="15" fill="${INK}">TIMES</text>
      <path d="M26 -40 H156" stroke="${color}" stroke-width="8"/>
      <rect x="242" y="-38" width="10" height="8" rx="2" class="ms-headlamp" fill="#fff3b0" ${thin}/>
      ${wheel(56, 19)}${wheel(210, 19)}`,
  };

  // lane: 'near' (moving right, bigger) or 'far' (moving left, smaller)
  function car(kind, color, lane, duration, delay) {
    const near = lane === 'near';
    const place = near ? `translate(0 772) scale(1.1)` : `translate(0 676) scale(-0.82 0.82)`;
    return `<g class="ms-car ${near ? 'right' : 'left'}" style="--d:${duration}s;--delay:${delay}s">
      <g transform="${place}"><g class="ms-bounce ms-blur ms-shaded">${CARS[kind](color)}</g></g></g>`;
  }

  // ---- People strolling on the far sidewalk ----

  function person(coat, dir, duration, delay, extra) {
    return `<g class="ms-walker ${dir}" style="--d:${duration}s;--delay:${delay}s"><g transform="translate(0 602) scale(${dir === "left" ? -1 : 1} 1)"><g class="ms-step ms-blur ms-shaded">
      <path class="ms-leg a" d="M-6 -40 L-10 0" ${o} fill="none"/><path class="ms-leg b" d="M6 -40 L10 0" ${o} fill="none"/>
      <rect x="-18" y="-96" width="36" height="60" rx="14" fill="${coat}" ${o}/>
      <circle cx="0" cy="-114" r="17" fill="#f4c9a4" ${o}/>
      ${extra || ''}</g></g></g>`;
  }

  // ---- The shops across the street ----

  const SHOPS = [
    { name: 'NEWS', wall: '#e9a07a', stripe: '#1fa3a3', goods: 'papers' },
    { name: 'BOOKS', wall: '#8fb8a8', stripe: '#ff6b5b', goods: 'books' },
    { name: 'BAKERY', wall: '#f3d27a', stripe: '#b86b3a', goods: 'bread' },
    { name: 'FLOWERS', wall: '#d7b3e0', stripe: '#6fbf73', goods: 'flowers' },
    { name: 'DINER', wall: '#8fb8dc', stripe: '#e0474f', goods: 'stools' },
  ];

  const GOODS = {
    papers: (x) => [0, 1, 2].map((k) => `<rect x="${x + 16 + k * 50}" y="${532 - k * 6}" width="40" height="${24 + k * 6}" fill="#fffaf1" ${thin}/>`).join(''),
    books: (x) => ['#ff6b5b', '#1fa3a3', '#ffc145', '#8fb8ff', '#6fbf73', '#ff9aa8'].map((c, k) => `<rect x="${x + 16 + k * 24}" y="${516 + (k % 2) * 8}" width="18" height="${44 - (k % 2) * 8}" fill="${c}" ${thin}/>`).join(''),
    bread: (x) => [0, 1, 2].map((k) => `<ellipse cx="${x + 40 + k * 50}" cy="546" rx="22" ry="13" fill="#d99a5b" ${thin}/><path d="M${x + 30 + k * 50} 542 l6 -4 M${x + 40 + k * 50} 542 l6 -4" ${thin}/>`).join(''),
    flowers: (x) => [0, 1, 2, 3].map((k) => `<path d="M${x + 32 + k * 40} 560 V530" ${thin}/><circle cx="${x + 32 + k * 40}" cy="526" r="11" fill="${['#ff9aa8', '#ffc145', '#8fb8ff', '#ff6b5b'][k]}" ${thin}/>`).join(''),
    stools: (x) => `<rect x="${x + 12}" y="530" width="150" height="14" fill="#fffaf1" ${thin}/>` + [0, 1, 2].map((k) => `<circle cx="${x + 38 + k * 50}" cy="552" r="9" fill="#e0474f" ${thin}/>`).join(''),
  };

  function shop(s, i) {
    const x = i * 320;
    const top = 244 + (i % 2) * 22;
    const wins = [0, 1].map((r) => [0, 1, 2].map((k) => `<rect class="ms-win" x="${x + 44 + k * 84}" y="${top + 28 + r * 58}" width="52" height="40" rx="3" ${thin}/>`).join('')).join('');
    let awning = '';
    for (let k = 0; k < 7; k++) awning += `<rect x="${x + 22 + k * 40}" y="448" width="40" height="26" fill="${k % 2 ? '#fffaf1' : s.stripe}"/>`;
    let scallops = '';
    for (let k = 0; k < 7; k++) scallops += `<path d="M${x + 22 + k * 40} 474 a20 12 0 0 0 40 0" fill="${k % 2 ? '#fffaf1' : s.stripe}" ${thin}/>`;
    return `<g>
      <rect x="${x + 6}" y="${top}" width="308" height="${580 - top}" fill="${s.wall}" ${o}/>
      <rect x="${x}" y="${top - 12}" width="320" height="16" fill="${INK}" opacity="0.85"/>
      ${wins}
      <rect x="${x + 28}" y="486" width="180" height="94" fill="#cfe6ef" ${thin}/>
      ${GOODS[s.goods](x + 28)}
      <path d="M${x + 44} 494 l30 -2 M${x + 44} 504 l14 -1" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.8"/>
      <rect x="${x + 226}" y="490" width="62" height="90" rx="4" fill="#9c6232" ${thin}/>
      <circle cx="${x + 276}" cy="538" r="4" fill="#ffd35e"/>
      <rect x="${x + 22}" y="448" width="280" height="26" fill="none" ${thin}/>
      ${awning}${scallops}
      <rect x="${x + 70}" y="410" width="180" height="32" rx="6" fill="#fffaf1" ${thin}/>
      <text x="${x + 160}" y="434" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="22" fill="${INK}">${s.name}</text>
    </g>`;
  }

  function build(tod) {
    const rng = CC.makeRng(20251);
    const night = tod === 'night';
    const glow = tod === 'night' || tod === 'evening';

    // City skyline behind the shops.
    let skyline = '';
    let cityLights = '';
    for (let x = -20; x < W; ) {
      const bw = 70 + rng() * 90;
      const bh = 120 + rng() * 170;
      skyline += `<rect class="ms-city" x="${x}" y="${330 - bh}" width="${bw}" height="${bh + 20}"/>`;
      for (let wy = 330 - bh + 16; wy < 316; wy += 26) {
        for (let wx = x + 12; wx < x + bw - 14; wx += 22) {
          if (rng() < (night ? 0.45 : 0.18)) cityLights += `<rect class="ms-citywin" x="${wx}" y="${wy}" width="9" height="12"/>`;
        }
      }
      x += bw + 6;
    }

    // Lit shop windows (above the night tint).
    let lit = '';
    if (glow) {
      SHOPS.forEach((s, i) => {
        const x = i * 320;
        const top = 244 + (i % 2) * 22;
        for (let r = 0; r < 2; r++) {
          for (let k = 0; k < 3; k++) {
            if (rng() < 0.6) lit += `<rect x="${x + 44 + k * 84}" y="${top + 28 + r * 58}" width="52" height="40" rx="3" fill="#ffd86b" opacity="0.85"/>`;
          }
        }
        lit += `<rect x="${x + 28}" y="486" width="180" height="94" fill="#ffe7a3" opacity="0.45"/>`;
      });
    }

    // Street lamps and trees on the far sidewalk.
    const lamps = [150, 740, 1330];
    const lampPosts = lamps.map((x) => `<rect x="${x - 5}" y="470" width="10" height="130" fill="#4a4d63" ${thin}/><path d="M${x - 22} 470 H${x + 22} L${x + 14} 448 H${x - 14} Z" fill="#ffd35e" ${thin}/>`).join('');
    const lampGlow = glow ? lamps.map((x) => `<circle class="ms-lampglow" cx="${x}" cy="462" r="46" fill="#ffe89a"/>`).join('') : '';
    const trees = [460, 1060].map((x) => `<rect x="${x - 7}" y="520" width="14" height="80" fill="#9c6232" ${thin}/><circle cx="${x}" cy="500" r="42" fill="#6fbf73" ${o}/><circle cx="${x - 14}" cy="488" r="9" fill="#fff" opacity="0.3"/>`).join('');

    // Traffic light on the corner.
    const tl = `<rect x="1003" y="468" width="10" height="132" fill="#4a4d63" ${thin}/><rect x="990" y="400" width="36" height="84" rx="8" fill="${INK}"/>`;
    const tlLights = `<circle class="ms-tl r" cx="1008" cy="418" r="9"/><circle class="ms-tl y" cx="1008" cy="442" r="9"/><circle class="ms-tl g" cx="1008" cy="466" r="9"/>`;

    // The café's awning overhead, with a string of lights.
    let awning = '';
    for (let k = 0; k * 90 < W + 90; k++) {
      const fill = k % 2 ? '#fbf1e1' : '#e2574c';
      awning += `<rect x="${k * 90}" y="-10" width="90" height="72" fill="${fill}"/><path d="M${k * 90} 62 a45 22 0 0 0 90 0 Z" fill="${fill}" ${o}/>`;
    }
    const bulbs = [];
    for (let seg = 0; seg < 4; seg++) {
      for (let t = 0.1; t < 1; t += 0.2) {
        const x = seg * 400 + t * 400;
        const y = 104 + 4 * t * (1 - t) * 60;
        bulbs.push(`<path d="M${x} ${y - 10} v6" ${thin}/><circle class="ms-bulb" cx="${x}" cy="${y}" r="8" style="animation-delay:${-(seg * 5 + t * 10) * 0.37}s"/>`);
      }
    }
    const wire = `<path d="M0 104 Q200 164 400 104 T800 104 T1200 104 T1600 104" fill="none" stroke="${INK}" stroke-width="3"/>`;

    // Railing, patio floor, our table (coffee and the paper) and a potted plant.
    let rails = '';
    for (let x = 10; x < W; x += 42) rails += `<rect x="${x}" y="800" width="7" height="60" fill="#3b3440"/>`;

    const svg = (cls, body) =>
      `<svg class="ms-svg ${cls} tod-${tod}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${body}</svg>`;
    const P = PALETTES[tod];

    // Two layers. The still one (sky, city, shops, street, railing, table, awning) is
    // blurred once, as an image. The moving one (traffic, people, birds, lights, steam,
    // and the plant the traffic passes behind) blurs each piece separately, which is far
    // cheaper than blurring the whole screen every frame.
    const stillBody = `
      <defs><linearGradient id="ms-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="ms-sky1"/><stop offset="1" class="ms-sky2"/></linearGradient>
        <filter id="ms-frost" x="-2%" y="-2%" width="104%" height="104%"><feGaussianBlur stdDeviation="5"/><feColorMatrix type="saturate" values="1.1"/></filter></defs>
      <rect x="-40" y="-40" width="${W + 80}" height="${H + 80}" fill="${P.sky2}"/>
      <g filter="url(#ms-frost)">
      <rect x="-40" y="-40" width="${W + 80}" height="${H + 80}" fill="url(#ms-sky)"/>
      <circle class="ms-sun" cx="1240" cy="200" r="58" ${o}/>
      ${night ? `<circle cx="1262" cy="186" r="50" class="ms-moonbite"/>` : ''}
      ${[0, 1, 2].map((k) => `<path transform="translate(${160 + k * 520} ${150 + k * 40}) scale(${1.2 - k * 0.2})" d="M20 50 C6 50 6 30 22 30 C22 14 46 10 52 24 C58 8 86 10 86 28 C102 26 110 50 94 50 Z" fill="#fff" opacity="0.9" stroke="${INK}" stroke-opacity="0.15" stroke-width="3"/>`).join('')}
      ${skyline}${cityLights}
      ${SHOPS.map(shop).join('')}
      <rect y="580" width="${W}" height="36" class="ms-walk"/><path d="M0 616 H${W}" stroke="${INK}" stroke-width="4"/>
      ${lampPosts}${trees}${tl}
      <rect y="616" width="${W}" height="160" class="ms-road"/>
      <path d="M0 694 H${W}" stroke="#fffaf1" stroke-width="6" stroke-dasharray="46 40" opacity="0.8"/>
      <rect y="776" width="${W}" height="28" class="ms-walk"/><path d="M0 776 H${W}" stroke="${INK}" stroke-width="4"/>
      <rect y="794" width="${W}" height="10" fill="#3b3440"/>${rails}<rect y="854" width="${W}" height="10" fill="#3b3440"/>
      <rect y="864" width="${W}" height="40" fill="#d8c3a5"/><path d="M0 880 H${W}" stroke="${INK}" stroke-opacity="0.15" stroke-width="3"/>
      <ellipse cx="250" cy="892" rx="250" ry="56" fill="#fbf4e8" ${o}/>
      <ellipse cx="190" cy="866" rx="46" ry="12" fill="#fffaf1" ${thin}/>
      <path d="M160 818 H220 L214 856 Q212 866 202 866 H178 Q168 866 166 856 Z" fill="#ff6b5b" ${o}/>
      <path d="M218 828 C236 826 236 848 214 848" fill="none" ${thin}/>
      <ellipse cx="190" cy="818" rx="30" ry="6" fill="#6b3f1f" ${thin}/>
      <path d="M280 850 L400 838 L412 874 L292 886 Z" fill="#fffaf1" ${thin}/>
      <path d="M296 856 L392 846 M298 866 L360 860 M300 876 L380 868" stroke="${INK}" stroke-opacity="0.4" stroke-width="3"/>
      ${awning}
      <rect x="-40" y="-40" width="${W + 80}" height="${H + 80}" class="ms-tint"/>
      ${lampGlow}${lit}${wire}
      </g>`;
    // Drawn once as an image (blur and all), so the browser never has to redo it.
    const stillSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">${paintStill(stillBody, P)}</svg>`;
    const still = `<img class="ms-still" alt="" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(stillSvg)}">`;

    const moving = svg('ms-moving', `
      ${[0, 1].map((k) => `<g class="ms-bird" style="--d:${26 + k * 9}s;--delay:${-k * 13}s"><g class="ms-blur"><path transform="translate(0 ${190 + k * 40})" class="ms-wingbeat" d="M0 10 Q8 0 16 9 Q24 0 32 10" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g></g>`).join('')}
      ${person('#ff6b5b', 'right', 34, -4, `<rect x="10" y="-80" width="22" height="16" fill="#fffaf1" ${thin}/>`)}
      ${person('#1fa3a3', 'left', 42, -20)}
      ${person('#ffc145', 'right', 38, -30, `<path d="M-16 -128 H16 L10 -142 H-10 Z" fill="${INK}"/>`)}
      ${car('bus', '#1fa3a3', 'far', 26, -3)}
      ${car('sedan', '#8fb8ff', 'far', 14, -9)}
      ${car('coupe', '#ff9aa8', 'far', 17, -15)}
      ${car('van', '#ff6b5b', 'near', 15, -2)}
      ${car('taxi', '#ffc145', 'near', 11, -7)}
      ${car('sedan', '#6fbf73', 'near', 13, -12)}
      <g class="ms-blur ms-shaded">
        <path d="M1380 700 C1360 640 1420 610 1440 680 C1450 600 1520 610 1500 690 C1540 650 1580 690 1540 730 Z" fill="#6fbf73" ${o}/>
        <path d="M1390 730 H1560 L1540 900 H1410 Z" fill="#d97a4a" ${o}/><rect x="1380" y="720" width="190" height="24" rx="6" fill="#e58f5e" ${o}/>
      </g>
      <g class="ms-blur"><path class="ms-steam" d="M180 806 C174 796 186 790 180 778" fill="none" stroke="#b9a58c" stroke-width="4" stroke-linecap="round"/></g>
      <g class="ms-blur"><path class="ms-steam two" d="M198 806 C192 796 204 790 198 778" fill="none" stroke="#b9a58c" stroke-width="4" stroke-linecap="round"/></g>
      <g class="ms-blur">${tlLights}</g>
      ${bulbs.map((b) => `<g class="ms-blur">${b}</g>`).join('')}`);

    return still + moving;
  }

  const host = document.getElementById('menu-scene');
  let shown = null;

  CC.MenuScene = {
    // (Re)draws the scene if the time of day has changed since it was last drawn.
    refresh(date) {
      if (!host) return;
      const tod = timeOfDay(date || new Date());
      if (tod === shown) return;
      shown = tod;
      host.querySelector('.ms-view').innerHTML = build(tod);
    },
  };

  CC.MenuScene.refresh();
})();
