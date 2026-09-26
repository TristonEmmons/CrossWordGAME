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

  // -- Vehicles --
  // Each is drawn facing right with its wheels resting on y = 0, and read unmistakably
  // front-first: a driver in profile looking ahead, a raked windshield, round headlights
  // at the front and red lights at the back. The wheels aren't part of the drawing: they
  // are separate so they can roll. `v` is the variant: the driver's looks, and whether
  // lettering should be pre-mirrored (for the left-driving lane, which is drawn flipped).

  const GLASS_IN = '#3f4a57';
  const CHROME = '#dcd7cf';

  const txt = (v, x, y, size, fill, str, extra) =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-family="${extra && extra.serif ? 'Georgia, serif' : 'Fredoka, Verdana, sans-serif'}" font-weight="700" font-size="${size}" fill="${fill}"${v.mt ? ` transform="translate(${2 * x} 0) scale(-1 1)"` : ''}>${str}</text>`;

  // A head-and-shoulders seen through a side window, facing right.
  const person = (v, x, y, s) =>
    `<g transform="translate(${x} ${y}) scale(${s || 1})">
      <path d="M-15 22 Q-15 7 0 7 Q15 7 15 22 Z" fill="${v.shirt}"/>
      <circle r="10.5" fill="${v.skin}"/><path d="M9 -2 L15 2 L9 4 Z" fill="${v.skin}"/>
      <path d="M-10.5 0 Q-11 -13 0 -13.5 Q10 -13.5 10.5 -5 Q3 -8 -3 -4 Q-6 -1 -10.5 0 Z" fill="${v.hair}"/>
      <circle cx="4.5" cy="-2" r="1.7" fill="${INK}"/></g>`;

  // A side window: dark interior, whoever sits there (clipped to the glass), then a glass
  // tint, a reflection and the frame.
  let clipN = 0;
  const pane = (d, inside, glint) => {
    const id = `w${clipN++}`;
    return `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${GLASS_IN}"/>
      <g clip-path="url(#${id})">${inside || ''}<path d="${d}" fill="#cfe8f2" fill-opacity="0.34"/>${glint ? `<path d="${glint}" stroke="#fff" stroke-opacity="0.6" stroke-width="3.5" stroke-linecap="round"/>` : ''}</g>
      <path d="${d}" fill="none" ${thin}/>`;
  };

  const shadowUnder = (w) => `<ellipse cx="${w / 2}" cy="4" rx="${w * 0.52}" ry="8" fill="#000" fill-opacity="0.22"/>`;
  const arch = (x, r) => `<path d="M${x - r - 6} -12 A${r + 6} ${r + 6} 0 0 1 ${x + r + 6} -12 Z" fill="${INK}" fill-opacity="0.88"/>`;
  const lamp = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="4.5" ry="6.5" fill="#fff6c8" stroke="${INK}" stroke-width="2.5"/><circle cx="${x - 1}" cy="${y - 2}" r="1.6" fill="#fff"/>`;
  const tail = (x, y, h) => `<rect x="${x}" y="${y}" width="8" height="${h || 11}" rx="2" fill="#e0474f" stroke="${INK}" stroke-width="2.5"/>`;
  const bumper = (x, y, w) => `<rect x="${x}" y="${y}" width="${w || 18}" height="9" rx="4" fill="${CHROME}" ${thin}/>`;
  const shade = (d) => `<path d="${d}" fill="#000" fill-opacity="0.13"/>`;
  const shine = (d) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round"/>`;
  const seam = (d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-opacity="0.45" stroke-width="2.5" stroke-linecap="round"/>`;
  const handle = (x, y) => `<rect x="${x}" y="${y}" width="14" height="4" rx="2" fill="#000" fill-opacity="0.3"/>`;
  const mirror = (x, y, c) => `<path d="M${x} ${y} q10 -5 13 3 q-6 4 -13 -3 Z" fill="${c}" ${thin}/>`;

  const VEHICLES = {
    sedan: {
      w: 212, wheels: [[56, 19], [168, 19]], lamp: [207, -37], tail: [7, -36], pipe: [10, -10], cruise: 230,
      draw: (c, v) => {
        const body = 'M16 -12 C8 -12 5 -18 5 -26 L6 -36 C7 -44 12 -48 22 -49 L54 -51 C64 -70 80 -84 104 -86 L134 -86 C152 -86 162 -76 176 -54 L198 -50 C208 -48 212 -40 212 -30 L212 -20 C212 -14 208 -12 202 -12 Z';
        return `${shadowUnder(212)}<path d="${body}" fill="${c}" ${o}/>
          ${shade('M5 -28 H212 V-20 C212 -14 208 -12 202 -12 H16 C8 -12 5 -18 5 -24 Z')}
          ${shine('M24 -46 H196')}${shine('M94 -82 H128')}
          ${pane('M62 -52 C70 -68 82 -78 100 -79 L106 -79 L106 -52 Z', v.back ? person(v.back, 86, -63, 0.9) : '', 'M72 -56 L82 -72')}
          ${pane('M114 -79 L132 -79 C146 -79 154 -70 164 -52 L114 -52 Z', person(v, 138, -64), 'M146 -56 L156 -68')}
          ${seam('M108 -50 V-16 M166 -48 C168 -36 168 -24 164 -16')}${handle(84, -42)}${handle(138, -42)}
          ${mirror(164, -56, c)}${lamp(207, -37)}${tail(3, -42)}${bumper(196, -24)}${bumper(2, -24)}
          ${arch(56, 19)}${arch(168, 19)}`;
      },
    },
    taxi: {
      w: 212, wheels: [[56, 19], [168, 19]], lamp: [207, -37], tail: [7, -36], pipe: [10, -10], cruise: 240,
      draw: (c, v) => `${VEHICLES.sedan.draw(c, v)}
        <path d="M24 -40 H196" stroke="${INK}" stroke-width="6" stroke-dasharray="8 8"/>
        <rect x="100" y="-102" width="48" height="18" rx="5" fill="#fffaf1" ${thin}/>${txt(v, 124, -88.5, 12, INK, 'TAXI')}`,
    },
    hatch: {
      w: 176, wheels: [[44, 17], [142, 17]], lamp: [172, -38], tail: [7, -44], pipe: [10, -10], cruise: 220,
      draw: (c, v) => `${shadowUnder(176)}
        <path d="M14 -12 C7 -12 4 -18 4 -26 L6 -62 C8 -76 18 -86 34 -87 L100 -88 C116 -88 126 -78 136 -58 L158 -52 C170 -48 176 -40 176 -30 L176 -20 C176 -14 172 -12 166 -12 Z" fill="${c}" ${o}/>
        ${shade('M4 -28 H176 V-20 C176 -14 172 -12 166 -12 H14 C7 -12 4 -18 4 -24 Z')}${shine('M14 -48 H162')}${shine('M40 -84 H96')}
        ${pane('M16 -56 L18 -72 C20 -78 26 -80 34 -80 L64 -80 L64 -56 Z', v.back ? person(v.back, 44, -66, 0.9) : '', 'M24 -60 L32 -74')}
        ${pane('M72 -80 L98 -80 C108 -80 116 -72 124 -56 L72 -56 Z', person(v, 98, -66), 'M106 -60 L114 -72')}
        ${seam('M68 -54 V-16 M128 -52 C130 -40 130 -26 126 -16')}${handle(50, -44)}${handle(106, -44)}
        ${mirror(124, -60, c)}${lamp(172, -38)}${tail(3, -50, 13)}${bumper(160, -24)}${bumper(2, -24)}
        ${arch(44, 17)}${arch(142, 17)}`,
    },
    beetle: {
      w: 180, wheels: [[42, 18], [142, 18]], lamp: [165, -44], tail: [8, -40], pipe: [8, -12], cruise: 200,
      draw: (c, v) => `${shadowUnder(180)}
        <path d="M14 -14 C6 -14 2 -22 5 -32 C12 -58 36 -92 92 -94 C146 -94 168 -62 176 -38 C179 -26 176 -14 168 -14 Z" fill="${c}" ${o}/>
        ${shade('M3 -28 H178 C178 -18 175 -14 168 -14 H14 C6 -14 2 -20 3 -28 Z')}
        ${shine('M40 -80 C60 -90 110 -92 140 -78')}
        ${pane('M36 -60 C46 -80 68 -86 88 -86 L88 -60 Z', v.back ? person(v.back, 66, -70, 0.85) : '', 'M48 -64 L58 -78')}
        ${pane('M96 -86 C116 -86 134 -76 144 -60 L96 -60 Z', person(v, 118, -70), 'M124 -64 L132 -74')}
        ${seam('M92 -58 V-18')}${handle(100, -50)}
        <path d="M18 -14 C18 -42 66 -42 66 -14 Z" fill="${c}" ${thin}/><path d="M118 -14 C118 -42 166 -42 166 -14 Z" fill="${c}" ${thin}/>
        ${shade('M18 -14 C18 -42 66 -42 66 -14 Z')}${shade('M118 -14 C118 -42 166 -42 166 -14 Z')}
        <rect x="64" y="-22" width="56" height="7" rx="3" fill="${CHROME}" ${thin}/>
        <circle cx="165" cy="-44" r="7.5" fill="#fff6c8" stroke="${INK}" stroke-width="2.5"/><circle cx="163" cy="-46" r="2" fill="#fff"/>
        <ellipse cx="8" cy="-40" rx="4" ry="6" fill="#e0474f" stroke="${INK}" stroke-width="2.5"/>
        <path d="M170 -18 h14 M-4 -18 h14" stroke="${CHROME}" stroke-width="5" stroke-linecap="round"/>
        ${arch(42, 18)}${arch(142, 18)}`,
    },
    pickup: {
      w: 236, wheels: [[54, 19], [190, 19]], lamp: [231, -38], tail: [8, -42], pipe: [12, -10], cruise: 210,
      draw: (c, v) => {
        const sack = (x) => `<path d="M${x} -56 C${x - 4} -76 ${x + 8} -86 ${x + 22} -86 C${x + 36} -86 ${x + 44} -76 ${x + 40} -56 Z" fill="#c8a877" ${thin}/>
          <path d="M${x + 14} -84 q8 4 16 0" fill="none" ${thin}/><circle cx="${x + 20}" cy="-68" r="6" fill="#8a5a35"/>`;
        return `${shadowUnder(236)}
          ${sack(18)}${sack(52)}${sack(86)}
          <path d="M6 -14 V-50 C6 -54 9 -56 13 -56 H122 V-14 Z" fill="${c}" ${o}/>
          <path d="M122 -14 V-56 L128 -88 H172 C182 -88 188 -80 194 -58 L218 -54 C230 -51 236 -43 236 -32 V-20 C236 -14 232 -12 226 -12 H122 Z" fill="${c}" ${o}/>
          ${shade('M6 -28 H236 V-20 C236 -14 232 -12 226 -12 H10 C7 -12 6 -14 6 -18 Z')}${shine('M12 -50 H118')}${shine('M132 -50 H214')}
          ${pane('M134 -82 H168 C176 -82 180 -76 184 -60 H134 Z', person(v, 160, -68), 'M168 -64 L174 -74')}
          ${seam('M14 -48 V-18 M122 -54 V-16 M188 -52 C190 -40 190 -26 186 -16')}${handle(160, -46)}
          ${mirror(184, -62, c)}${lamp(231, -38)}${tail(4, -48, 13)}${bumper(220, -24)}${bumper(0, -24)}
          ${arch(54, 19)}${arch(190, 19)}`;
      },
    },
    van: {
      w: 258, wheels: [[60, 20], [214, 20]], lamp: [253, -40], tail: [8, -54], pipe: [12, -10], cruise: 200,
      draw: (c, v) => `${shadowUnder(258)}
        <path d="M6 -14 V-114 C6 -120 10 -124 16 -124 H178 V-14 Z" fill="#fffaf1" ${o}/>
        <path d="M178 -14 V-92 H214 C230 -92 240 -80 248 -56 L252 -44 C256 -38 258 -30 258 -24 V-20 C258 -14 254 -12 248 -12 H178 Z" fill="${c}" ${o}/>
        <rect x="6" y="-46" width="172" height="12" fill="${c}"/>
        ${shade('M6 -28 H258 V-20 C258 -14 254 -12 248 -12 H6 Z')}${shine('M16 -118 H170')}
        ${txt(v, 92, -100, 13, INK, 'The Crazy WordSearch', { serif: true })}
        <path d="M22 -94 H162" stroke="${INK}" stroke-width="2"/>
        ${txt(v, 92, -64, 30, INK, 'TIMES', { serif: true })}
        ${txt(v, 92, -36.5, 9, '#fffaf1', 'DAILY DELIVERY')}
        ${pane('M188 -84 H212 C224 -84 230 -76 236 -58 H188 Z', person(v, 214, -68), 'M218 -62 L226 -74')}
        ${seam('M178 -90 V-16 M236 -54 C238 -40 238 -26 234 -16')}${handle(206, -48)}
        ${mirror(234, -62, c)}${lamp(253, -40)}${tail(4, -60, 14)}${bumper(242, -24)}${bumper(0, -24)}
        ${arch(60, 20)}${arch(214, 20)}`,
    },
    bus: {
      w: 400, wheels: [[84, 23], [322, 23]], lamp: [395, -34], tail: [9, -48], pipe: [14, -10], cruise: 150,
      draw: (c, v) => {
        let windows = '';
        for (let k = 0; k < 5; k++) {
          const x = 26 + k * 58;
          const d = `M${x} -130 H${x + 48} V-86 H${x} Z`;
          const rider = v.riders[k] ? person(v.riders[k], x + 24, -104, 0.9) : '';
          windows += pane(d, rider, `M${x + 8} -92 L${x + 18} -124`);
        }
        return `${shadowUnder(400)}
          <path d="M6 -14 V-132 C6 -142 14 -148 24 -148 H372 C386 -148 394 -138 396 -124 L400 -40 C400 -26 396 -14 384 -14 Z" fill="${c}" ${o}/>
          <rect x="6" y="-62" width="392" height="14" fill="#fffaf1"/>
          ${shade('M6 -40 H400 C400 -26 396 -14 384 -14 H6 Z')}${shine('M24 -142 H370')}
          ${windows}
          ${pane('M352 -134 H378 C388 -134 392 -126 394 -116 L396 -72 H352 Z', person(v, 372, -98), 'M380 -80 L388 -124')}
          <rect x="300" y="-130" width="40" height="112" rx="3" fill="${GLASS_IN}" ${thin}/><path d="M320 -130 V-18" ${thin}/>
          <path d="M300 -130 H340 V-18 H300 Z" fill="#cfe8f2" fill-opacity="0.3"/>
          <rect x="118" y="-168" width="176" height="22" rx="5" fill="${INK}"/>${txt(v, 206, -152, 14, '#ffd35e', '5 · DOWNTOWN')}
          <ellipse cx="395" cy="-34" rx="4.5" ry="7" fill="#fff6c8" stroke="${INK}" stroke-width="2.5"/>
          ${tail(5, -56, 16)}${bumper(384, -24)}${bumper(0, -24)}
          ${arch(84, 23)}${arch(322, 23)}`;
      },
    },
    espresso: {
      w: 276, wheels: [[62, 21], [226, 21]], lamp: [271, -40], tail: [8, -56], pipe: [12, -10], cruise: 180,
      draw: (c, v) => {
        let awning = '';
        for (let k = 0; k < 7; k++) awning += `<rect x="${30 + k * 20}" y="-126" width="20" height="12" fill="${k % 2 ? '#fffaf1' : c}"/><path d="M${30 + k * 20} -114 a10 6 0 0 0 20 0" fill="${k % 2 ? '#fffaf1' : c}" ${thin}/>`;
        const barista = `<g transform="translate(100 -84)"><path d="M-17 30 Q-17 8 0 8 Q17 8 17 30 Z" fill="#fffaf1"/><path d="M-8 12 H8 L6 30 H-6 Z" fill="${c}"/>
          <circle r="11" fill="${v.skin}"/><path d="M-11 -1 Q-11 -14 0 -14 Q11 -14 11 -1 Q4 -8 -4 -6 Z" fill="${v.hair}"/><circle cx="-4" cy="-1" r="1.6" fill="${INK}"/><circle cx="4" cy="-1" r="1.6" fill="${INK}"/><path d="M-4 5 Q0 8 4 5" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/></g>`;
        return `${shadowUnder(276)}
          <ellipse cx="100" cy="-140" rx="34" ry="7" fill="#fffaf1" ${thin}/>
          <path d="M78 -172 H122 L118 -148 Q116 -142 108 -142 H92 Q84 -142 82 -148 Z" fill="${c}" ${o}/>
          <path d="M122 -166 C136 -166 136 -150 118 -152" fill="none" ${thin}/><ellipse cx="100" cy="-172" rx="22" ry="5" fill="#6b3f1f" ${thin}/>
          <path d="M92 -180 C88 -188 96 -192 92 -200 M106 -180 C102 -188 110 -192 106 -200" fill="none" stroke="#b9a58c" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M6 -14 V-128 C6 -134 10 -138 16 -138 H196 V-14 Z" fill="#fbf1e1" ${o}/>
          <path d="M196 -14 V-96 H228 C244 -96 254 -84 262 -60 L268 -48 C272 -42 276 -34 276 -26 V-20 C276 -14 272 -12 266 -12 H196 Z" fill="${c}" ${o}/>
          <rect x="6" y="-44" width="190" height="14" fill="${c}"/>
          ${shade('M6 -28 H276 V-20 C276 -14 272 -12 266 -12 H6 Z')}
          ${pane('M34 -112 H166 V-66 H34 Z', barista, '')}
          <rect x="28" y="-68" width="144" height="7" rx="2" fill="${CHROME}" ${thin}/>
          <path d="M44 -68 v-8 h10 v8 M64 -68 v-8 h10 v8" fill="#fffaf1" ${thin}/>
          ${awning}
          ${txt(v, 100, -49, 13, INK, 'ESPRESSO BAR')}
          ${pane('M206 -88 H228 C240 -88 246 -80 252 -62 H206 Z', person(v, 230, -72), 'M234 -66 L242 -78')}
          ${seam('M252 -58 C254 -44 254 -28 250 -16')}${handle(222, -50)}
          ${mirror(250, -66, c)}${lamp(271, -40)}${tail(4, -62, 14)}${bumper(260, -24)}${bumper(0, -24)}
          ${arch(62, 21)}${arch(226, 21)}`;
      },
    },
    scooter: {
      w: 122, wheels: [[24, 13], [100, 13]], lamp: [112, -84], tail: [6, -36], pipe: [10, -12], cruise: 270,
      draw: (c, v) => `${shadowUnder(122)}
        <path d="M44 -104 q-18 2 -30 -6" fill="none" stroke="#e0474f" stroke-width="6" stroke-linecap="round"/>
        <path d="M6 -24 C4 -48 26 -58 52 -52 L58 -26 Q40 -18 6 -24 Z" fill="${c}" ${o}/>
        <path d="M30 -22 H80 L86 -34 H42 Z" fill="${c}" ${thin}/>
        <path d="M80 -26 L96 -82 L106 -82 L100 -26 Z" fill="${c}" ${o}/>
        <path d="M88 -16 C92 -30 110 -30 114 -16 Z" fill="${c}" ${thin}/>
        <path d="M16 -56 H56 Q61 -56 58 -48 H14 Z" fill="${INK}"/>
        <path d="M44 -58 L78 -52 L84 -28" fill="none" stroke="#3f5a85" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="36" y="-104" width="24" height="50" rx="10" fill="${v.shirt}" ${thin}/>
        <path d="M54 -94 L96 -86" fill="none" stroke="${v.shirt}" stroke-width="9" stroke-linecap="round"/>
        <path d="M92 -88 H112" ${thin}/>
        <circle cx="50" cy="-118" r="14" fill="${v.helmet}" ${thin}/>
        <path d="M52 -122 H66 Q66 -110 56 -110 Z" fill="#cfe8f2" ${thin}/>
        <circle cx="112" cy="-84" r="5.5" fill="#fff6c8" stroke="${INK}" stroke-width="2.5"/>
        ${tail(3, -40, 9)}`,
    },
  };
  const CAR_POOL = ['sedan', 'sedan', 'sedan', 'hatch', 'hatch', 'beetle', 'beetle', 'taxi', 'taxi', 'pickup', 'van', 'bus', 'espresso', 'scooter', 'scooter'];
  const CAR_COLORS = ['#8fb8ff', '#ff9aa8', '#6fbf73', '#ff6b5b', '#c9a3d6', '#f3d27a', '#5a6178', '#fffaf1', '#1fa3a3', '#ffb35e'];
  const FIXED_COLORS = { taxi: ['#ffc145'], van: ['#ff6b5b'], bus: ['#1fa3a3', '#e0474f'], espresso: ['#e2574c', '#1fa3a3'] };

  // Each vehicle is drawn once per look (kind, colour, driver, time of day, direction),
  // blurred and dimmed for the hour, as a small image; the wheels likewise, per size.
  const carImages = new Map();
  function vehicleImage(kind, color, v, tod, mirrored, key) {
    const k = `${kind}|${color}|${key}|${tod}|${mirrored ? 'm' : ''}`;
    if (!carImages.has(k)) {
      const spec = VEHICLES[kind];
      clipN = 0;
      const art = spec.draw(color, Object.assign({}, v, { mt: mirrored }));
      carImages.set(k, bakeSmall(`-14 -210 ${spec.w + 28} 236`, art, tod, 3));
    }
    return carImages.get(k);
  }

  function wheelImage(r, tod) {
    const k = `wheel|${r}|${tod}`;
    if (!carImages.has(k)) {
      let bolts = '';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        bolts += `<circle cx="${(Math.cos(a) * r * 0.3).toFixed(1)}" cy="${(Math.sin(a) * r * 0.3).toFixed(1)}" r="${(r * 0.08).toFixed(1)}" fill="${INK}"/>`;
      }
      const art = `<circle r="${r}" fill="${INK}"/><circle r="${r * 0.82}" fill="none" stroke="#4a4852" stroke-width="2"/>
        <circle r="${r * 0.56}" fill="${CHROME}" stroke="${INK}" stroke-width="2"/><path d="M${-r * 0.5} 0 A${r * 0.5} ${r * 0.5} 0 0 1 0 ${-r * 0.5}" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M0 ${-r * 0.54} V${-r * 0.18}" stroke="${INK}" stroke-width="3"/>${bolts}<circle r="${r * 0.12}" fill="${INK}"/>`;
      carImages.set(k, bakeSmall(`${-r - 8} ${-r - 8} ${2 * r + 16} ${2 * r + 16}`, art, tod, 1.8));
    }
    return carImages.get(k);
  }

  // The frost blur, plus dimming after dark.
  function frostFilter(tod, blur) {
    const dim = tod === 'night' ? 0.7 : tod === 'evening' ? 0.9 : 1;
    const shadeFx = dim < 1 ? `<feComponentTransfer><feFuncR type="linear" slope="${dim}"/><feFuncG type="linear" slope="${dim}"/><feFuncB type="linear" slope="${dim + 0.05}"/></feComponentTransfer>` : '';
    return `<filter id="b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${blur}"/>${shadeFx}</filter>`;
  }

  function bakeSmall(viewBox, art, tod, blur) {
    const [, , vw, vh] = viewBox.split(' ').map(Number);
    const res = pixelScale(1, 2);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(vw * res)}" height="${Math.round(vh * res)}" viewBox="${viewBox}"><defs>${frostFilter(tod, blur)}</defs><g filter="url(#b)">${art}</g></svg>`;
    return svgUrl(svg, vw * res, vh * res);
  }

  // Baked pictures start as SVG (with their blur filter) and are then flattened once into
  // plain bitmaps. Browsers can redraw a blur filter every time a picture moves or turns;
  // a bitmap is just copied, which keeps swinging limbs and rolling wheels cheap.
  const SIZES = new Map(); // SVG data URL -> [width, height] to flatten it at
  const RASTERS = new Map(); // SVG data URL -> Promise of a bitmap URL

  function svgUrl(svg, w, h) {
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    SIZES.set(url, [Math.max(1, Math.round(w)), Math.max(1, Math.round(h))]);
    return url;
  }

  // How many bitmap pixels per scene unit: enough for the screen, never more than needed
  // (everything here is blurred, so a little softness is invisible).
  function pixelScale(min, max) {
    const bw = window.innerWidth + 80;
    const bh = window.innerHeight + 56;
    const shown = Math.max(bw / W, bh / H) * Math.min(window.devicePixelRatio || 1, 2);
    return Math.max(min, Math.min(max, shown));
  }

  function raster(url) {
    if (!RASTERS.has(url)) {
      const [w, h] = SIZES.get(url);
      RASTERS.set(url, new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : url));
          } catch (e) {
            resolve(url); // some browsers won't flatten SVG: keep the SVG
          }
        };
        img.onerror = () => resolve(url);
        img.src = url;
      }));
    }
    return RASTERS.get(url);
  }

  // Swaps every baked picture under `root` for its bitmap once that's ready.
  function flatten(root) {
    root.querySelectorAll('[data-src]').forEach((el) => {
      const url = el.getAttribute('data-src');
      if (!SIZES.has(url)) return;
      raster(url).then((flat) => {
        if (flat !== url) el.style.backgroundImage = cssUrl(flat);
      });
    });
    root.querySelectorAll('img, image').forEach((el) => {
      const isImg = el instanceof HTMLImageElement;
      const url = el.getAttribute(isImg ? 'src' : 'href');
      if (!url || !SIZES.has(url)) return;
      raster(url).then((flat) => {
        if (flat !== url) el.setAttribute(isImg ? 'src' : 'href', flat);
      });
    });
  }

  // The big layers change with the time of day and weather; free the old bitmaps.
  function forgetLayer(url) {
    const job = RASTERS.get(url);
    if (job) job.then((flat) => flat !== url && URL.revokeObjectURL(flat));
    RASTERS.delete(url);
    SIZES.delete(url);
  }

  // -- People --
  // Cartoon people drawn in parts: legs, arms and a body (torso, head, hair, face and
  // accessories). Each part is baked once into a small blurred image. The limbs then
  // swing with CSS, so the walk costs almost nothing to animate. Side view for people
  // strolling the far sidewalk, front view for people crossing toward us.

  const SKIN = ['#f6d1b1', '#e8b48c', '#c68b62', '#9a6a48', '#6f4a33'];
  const UMBRELLAS = ['#ff6b5b', '#1fa3a3', '#ffc145', '#8fb8ff', '#c9a3d6'];
  const dark = (c, t) => mix(c, '#2b2a33', t == null ? 0.24 : t);
  const limb = (d, color, w) =>
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${(w || 9) + 5}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${w || 9}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const hand = (x, y, skin) => `<circle cx="${x}" cy="${y}" r="5.4" fill="${skin}" ${thin}/>`;

  // Curly hair: overlapping puffs, outlined once as a whole.
  const puffs = (pts, r, color) =>
    pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r + 1.5}" fill="${INK}"/>`).join('') +
    pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r - 1}" fill="${color}"/>`).join('');

  // ---- Side view (facing right; feet on y = 0, hip at 0,-50, shoulder at 0,-96) ----

  function sideHead(p) {
    const h = p.hair;
    const hx = 3;
    const hy = -117;
    let back = '';
    let front = '';
    switch (p.hairStyle) {
      case 'bob':
        front = `<path d="M-14 -103 Q-19 -135 3 -135.5 Q20 -135 20.5 -120 Q12 -127.5 3 -126 Q-3 -123 -4 -114 L-3 -101 Q-9 -98 -14 -103 Z" fill="${h}" ${thin}/>`;
        break;
      case 'ponytail':
        back = `<path d="M-11 -125 Q-29 -124 -28 -100 Q-22 -104 -17 -102 Q-21 -112 -11 -115 Z" fill="${h}" ${thin}/>`;
        front = `<path d="M-13 -112 Q-16 -135 3 -135.5 Q18 -135.5 20.5 -121 Q12 -127 5 -125.5 Q0 -123 -3 -117 Q-6 -113 -8 -108 Q-12 -107 -13 -112 Z" fill="${h}" ${thin}/>`;
        break;
      case 'bun':
        back = `<circle cx="-7" cy="-134" r="8" fill="${h}" ${thin}/>`;
        front = `<path d="M-13 -112 Q-16 -135 3 -135.5 Q18 -135.5 20.5 -121 Q12 -127 5 -125.5 Q0 -123 -3 -117 Q-6 -113 -8 -108 Q-12 -107 -13 -112 Z" fill="${h}" ${thin}/>`;
        break;
      case 'curly':
        front = puffs([[-11, -110], [-12, -121], [-7, -130], [2, -135], [11, -133], [17, -126]], 7.5, h);
        break;
      case 'bald':
        front = `<path d="M-12 -123 Q-16 -110 -7 -103 L-4 -107 Q-9 -114 -7 -123 Z" fill="${h}" ${thin}/>`;
        break;
      default:
        front = `<path d="M-13 -112 Q-16 -135 3 -135.5 Q18 -135.5 20.5 -121 Q12 -127 5 -125.5 Q0 -123 -3 -117 Q-6 -113 -8 -108 Q-12 -107 -13 -112 Z" fill="${h}" ${thin}/>`;
    }
    const beard = p.beard ? `<path d="M3 -110 Q7 -99 15 -101 Q20 -104 19 -111 Q15 -106 9 -107 Q5 -107 3 -110 Z" fill="${h}" ${thin}/>` : '';
    const face = `<circle cx="11" cy="-118.5" r="2" fill="${INK}"/><path d="M8 -124.5 Q11 -126 14 -124.5" fill="none" stroke="${dark(h, 0.35)}" stroke-width="2" stroke-linecap="round"/>
      <path d="M18 -118 Q23 -115 18.5 -111.5" fill="${p.skin}" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
      ${p.beard ? '' : `<path d="M11 -108.5 Q14.5 -106 17.5 -108.5" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`}
      <circle cx="9" cy="-111.5" r="3.4" fill="#ff8a8a" fill-opacity="0.45"/>`;
    const ear = `<ellipse cx="-1" cy="-116" rx="3.6" ry="4.8" fill="${p.skin}" ${thin}/><path d="M-1 -118 q2 2 0 4" fill="none" stroke="${INK}" stroke-opacity="0.5" stroke-width="1.5"/>`;
    const glasses = p.glasses ? `<circle cx="12" cy="-118.5" r="5" fill="#fff" fill-opacity="0.25" stroke="${INK}" stroke-width="2.2"/><path d="M7 -119 L0 -118" stroke="${INK}" stroke-width="2"/>` : '';
    let hat = '';
    if (p.hat === 'beanie') {
      hat = `<path d="M-14 -124 Q-14 -148 3 -148 Q20 -148 20 -124 Z" fill="${p.hatColor}" ${thin}/><rect x="-15" y="-128" width="36" height="7" rx="3.5" fill="${dark(p.hatColor, 0.15)}" ${thin}/><circle cx="3" cy="-150" r="5.5" fill="#fffaf1" ${thin}/>`;
    } else if (p.hat === 'cap') {
      hat = `<path d="M-13 -121 Q-13 -140 3 -140 Q18 -140 19 -123 Z" fill="${p.hatColor}" ${thin}/><path d="M17 -124 L33 -121 Q34 -117 19 -118 Z" fill="${dark(p.hatColor, 0.15)}" ${thin}/>`;
    } else if (p.hat === 'fedora') {
      hat = `<ellipse cx="3" cy="-127" rx="24" ry="4.5" fill="${p.hatColor}" ${thin}/><path d="M-10 -127 L-8 -142 Q3 -147 14 -142 L16 -127 Z" fill="${p.hatColor}" ${thin}/><rect x="-9" y="-133" width="25" height="5" fill="${INK}" fill-opacity="0.75"/>`;
    }
    const head = `<circle cx="${hx}" cy="${hy}" r="15.5" fill="${p.skin}" ${thin}/>`;
    const art = `${back}${head}${ear}${face}${beard}${front}${glasses}${hat}`;
    // Kids get a bigger head for their size.
    return p.kid ? `<g transform="translate(3 -103) scale(1.2) translate(-3 103)">${art}</g>` : art;
  }

  function sideTorso(p) {
    const c = p.topColor;
    const bottomHem = { coat: -36, jacket: -45, sweater: -45, dress: -30 }[p.top];
    let torso;
    let details = '';
    if (p.top === 'dress') {
      torso = `<path d="M-11 -101 Q-3 -105 7 -103 Q15 -101 15 -92 L13 -70 L22 -33 Q22 -29 18 -29 H-17 Q-22 -29 -21 -33 L-12 -70 L-14 -93 Q-14 -99 -11 -101 Z" fill="${c}" ${thin}/>`;
      details = `<path d="M-12.5 -70 H13.5" stroke="${dark(c, 0.3)}" stroke-width="3.5"/><path d="M-6 -40 l4 8 M6 -42 l4 9" stroke="#fff" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>`;
    } else {
      const y = bottomHem;
      torso = `<path d="M-11 -101 Q-3 -105 7 -103 Q16 -101 16 -92 L${p.top === 'coat' ? 19 : 17} ${y - 5} Q${p.top === 'coat' ? 19 : 17} ${y} ${p.top === 'coat' ? 13 : 12} ${y} H-11 Q-17 ${y} -16 ${y - 5} L-15 -93 Q-15 -99 -11 -101 Z" fill="${c}" ${thin}/>`;
      if (p.top === 'coat') {
        details = `<path d="M8 -102 L12 -86 L15 -38" fill="none" stroke="${dark(c, 0.35)}" stroke-width="2.5"/>
          ${[-80, -66, -52].map((by, k) => `<circle cx="${13.5 + k * 0.6}" cy="${by}" r="1.9" fill="${INK}"/>`).join('')}
          <path d="M-15.5 -64 H17.5" stroke="${dark(c, 0.3)}" stroke-width="4"/><path d="M-4 -55 h11" stroke="${dark(c, 0.35)}" stroke-width="2.5" stroke-linecap="round"/>`;
      } else if (p.top === 'jacket') {
        details = `<path d="M13 -101 L15.5 -47" stroke="${dark(c, 0.4)}" stroke-width="2.5"/><path d="M-15 -50 H17" stroke="${dark(c, 0.25)}" stroke-width="5"/>
          <path d="M5 -103 Q10 -96 15 -100" fill="none" stroke="${dark(c, 0.35)}" stroke-width="2.5"/>`;
      } else {
        details = `<path d="M-15 -50 H17" stroke="${dark(c, 0.2)}" stroke-width="6"/><path d="M-12 -50 v4 M-6 -50 v4 M0 -50 v4 M6 -50 v4 M12 -50 v4" stroke="${dark(c, 0.35)}" stroke-width="1.5"/>
          <path d="M-7 -103 Q3 -99 13 -102" fill="none" stroke="${dark(c, 0.3)}" stroke-width="5" stroke-linecap="round"/>`;
      }
    }
    return { torso, details };
  }

  function sideParts(p) {
    const { torso, details } = sideTorso(p);
    const legW = p.top === 'dress' || p.bottom === 'tights' ? 9 : 12;
    const leg = (back) => {
      const c = back ? dark(p.legColor) : p.legColor;
      const s = back ? dark(p.shoe) : p.shoe;
      return `<rect x="${-legW / 2}" y="-58" width="${legW}" height="52" rx="${legW / 2 - 1}" fill="${c}" ${thin}/>
        <path d="M-6.5 -10.5 H4 Q13 -10.5 14.5 -4 Q15.5 1 10 1 H-6.5 Q-8.5 1 -8.5 -4.5 Q-8.5 -10.5 -6.5 -10.5 Z" fill="${s}" ${thin}/>
        <path d="M-7 -2 H13" stroke="#fff" stroke-opacity="0.45" stroke-width="2"/>`;
    };
    const armSwing = (back, holding) => {
      const c = back ? dark(p.topColor) : p.topColor;
      const skin = back ? dark(p.skin, 0.12) : p.skin;
      let item = '';
      if (!back && holding === 'paper') item = `<g transform="rotate(-24 0 -60)"><rect x="-6" y="-66" width="24" height="10" rx="4" fill="#fffaf1" ${thin}/><path d="M-1 -61 h14" stroke="${INK}" stroke-opacity="0.5" stroke-width="2"/></g>`;
      if (!back && holding === 'shopping') item = `<path d="M-6 -58 Q-6 -66 1 -66 Q8 -66 8 -58" fill="none" stroke="${INK}" stroke-width="2.4"/>
        <path d="M10 -64 L24 -90" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M10 -64 L24 -90" stroke="#d99a5b" stroke-width="6" stroke-linecap="round"/><path d="M15 -73 l4 2 M19 -81 l4 2" stroke="#8a5a35" stroke-width="1.6"/>
        <path d="M-11 -59 H13 L11 -30 Q11 -27 8 -27 H-6 Q-9 -27 -9 -30 Z" fill="${p.bagColor}" ${thin}/><path d="M-5 -45 h10" stroke="#fff" stroke-opacity="0.55" stroke-width="3" stroke-linecap="round"/>`;
      return `${item && holding === 'shopping' ? item : ''}<rect x="-5.5" y="-101" width="11" height="40" rx="5.5" fill="${c}" ${thin}/>${hand(0, -59, skin)}${item && holding !== 'shopping' ? item : ''}`;
    };
    const skin = p.skin;
    const c = p.topColor;
    let frontArm;
    let armMode = 'swing';
    switch (p.hold) {
      case 'cup':
        armMode = 'still';
        frontArm = `${limb('M0 -95 L-1 -73 L13 -83', c)}
          <path d="M8 -103 H22 L20 -83 H10 Z" fill="#fffaf1" ${thin}/><rect x="9.2" y="-96" width="11.6" height="6" fill="#b86b3a"/><rect x="6.5" y="-107" width="17" height="5" rx="2.5" fill="#fffaf1" ${thin}/>
          ${hand(15, -86, skin)}`;
        break;
      case 'umbrella':
        armMode = 'still';
        // Held out in front of the chest, the pole rising just ahead of the face.
        frontArm = `<path d="M25 -84 V-226" stroke="${INK}" stroke-width="3.5"/><path d="M25 -86 v6 q0 6 -6 6" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M-24 -190 Q25 -246 74 -190 Q66 -197 58 -190 Q50 -197 42 -190 Q33 -197 25 -190 Q17 -197 9 -190 Q1 -197 -8 -190 Q-16 -197 -24 -190 Z" fill="${p.umbrella}" ${o}/>
          <path d="M25 -232 Q6 -214 -8 -190 M25 -232 Q44 -214 58 -190 M25 -232 V-190" fill="none" stroke="${INK}" stroke-opacity="0.35" stroke-width="2.5"/>
          <path d="M25 -232 v-7" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M-8 -200 Q9 -222 24 -226" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="4" stroke-linecap="round"/>
          ${limb('M0 -95 L8 -80 L22 -92', c)}${hand(24, -94, skin)}`;
        break;
      case 'leash':
        armMode = 'still';
        frontArm = `<path d="M11 -64 Q40 -30 72 -27" fill="none" stroke="#e0474f" stroke-width="2.6" stroke-linecap="round"/>
          ${limb('M0 -95 L4 -74 L10 -67', c)}${hand(11, -64, skin)}`;
        break;
      case 'balloon':
        armMode = 'still';
        frontArm = `<path d="M17 -90 Q30 -120 20 -150 Q12 -176 26 -196" fill="none" stroke="${INK}" stroke-width="1.8"/>
          <path d="M26 -196 l-3 5 h6 Z" fill="#e0474f" ${thin}/><ellipse cx="26" cy="-214" rx="15" ry="18" fill="#e0474f" ${thin}/>
          <path d="M18 -222 Q20 -228 26 -229" fill="none" stroke="#fff" stroke-opacity="0.75" stroke-width="3.5" stroke-linecap="round"/>
          ${limb('M0 -95 L6 -78 L15 -86', c)}${hand(16, -88, skin)}`;
        break;
      case 'phone':
        armMode = 'still';
        frontArm = `${limb('M0 -95 L-1 -74 L10 -92', c)}<rect x="6" y="-106" width="9" height="15" rx="2" fill="${INK}"/><rect x="7.5" y="-104" width="6" height="10" fill="#9fd8f0"/>${hand(11, -93, skin)}`;
        break;
      default:
        frontArm = armSwing(false, p.hold);
    }
    // Things carried on the body.
    let behind = '';
    let over = '';
    if (p.bag === 'backpack') {
      behind = `<rect x="-29" y="-99" width="18" height="38" rx="6" fill="${p.bagColor}" ${thin}/><rect x="-27" y="-80" width="12" height="12" rx="3" fill="${dark(p.bagColor, 0.2)}" ${thin}/>`;
      over = `<path d="M-12 -99 Q-2 -102 3 -92 L4 -72" fill="none" stroke="${dark(p.bagColor, 0.3)}" stroke-width="4" stroke-linecap="round"/>`;
    } else if (p.bag === 'shoulder') {
      over = `<path d="M-3 -102 L-14 -64" stroke="${dark(p.bagColor, 0.35)}" stroke-width="3.5" stroke-linecap="round"/><path d="M-22 -68 H-4 Q-2 -68 -2 -65 L-3 -52 Q-3 -49 -6 -49 H-20 Q-23 -49 -23 -52 L-24 -65 Q-24 -68 -22 -68 Z" fill="${p.bagColor}" ${thin}/><path d="M-22 -62 h18" stroke="${INK}" stroke-opacity="0.35" stroke-width="2"/>`;
    }
    const scarf = p.scarf
      ? `<path d="M-6 -99 Q-16 -97 -23 -86 L-17 -83 Q-13 -92 -4 -94 Z" fill="${p.scarf}" ${thin}/><rect x="-8" y="-106" width="21" height="9" rx="4.5" fill="${p.scarf}" ${thin}/><path d="M-3 -106 v9 M3 -106 v9" stroke="${dark(p.scarf, 0.3)}" stroke-width="1.6"/>`
      : '';
    const neck = `<rect x="-2" y="-106" width="9" height="8" fill="${p.skin}" ${thin}/>`;
    return {
      armMode,
      backArm: armSwing(true),
      backLeg: leg(true),
      frontLeg: leg(false),
      body: `<ellipse cx="0" cy="1" rx="22" ry="5" fill="#000" fill-opacity="0.16"/>${behind}${neck}${torso}${details}${scarf}${sideHead(p)}${over}`,
      frontArm,
    };
  }

  // ---- Front view (walking toward us; feet on y = 0) ----

  function frontHead(p) {
    const h = p.hair;
    let back = '';
    let front = '';
    const short = `<path d="M-17 -118 Q-18 -139.5 0 -139.5 Q18 -139.5 17 -118 Q14 -128 6 -129 Q-1 -126 -8 -129 Q-14 -127.5 -17 -118 Z" fill="${h}" ${thin}/>`;
    switch (p.hairStyle) {
      case 'bob':
        front = `<path d="M-19.5 -102 Q-22 -140 0 -140.5 Q22 -140 19.5 -102 Q15.5 -101 14.5 -107 L14.5 -121 Q9 -129.5 0 -129.5 Q-9 -129.5 -14.5 -121 L-14.5 -107 Q-15.5 -101 -19.5 -102 Z" fill="${h}" ${thin}/>`;
        break;
      case 'ponytail':
        back = `<path d="M-14 -116 Q-26 -106 -22 -90 Q-18 -100 -12 -104 Z M14 -116 Q26 -106 22 -90 Q18 -100 12 -104 Z" fill="${h}" ${thin}/>`;
        front = short;
        break;
      case 'bun':
        back = `<circle cx="0" cy="-143" r="8.5" fill="${h}" ${thin}/>`;
        front = short;
        break;
      case 'curly':
        front = puffs([[-15, -110], [-16, -122], [-10, -132], [0, -137], [10, -132], [16, -122], [15, -110]], 7.5, h);
        break;
      case 'bald':
        front = `<path d="M-16 -124 Q-19 -112 -15 -107 L-13 -118 Z M16 -124 Q19 -112 15 -107 L13 -118 Z" fill="${h}" ${thin}/>`;
        break;
      default:
        front = short;
    }
    const beard = p.beard ? `<path d="M-12.5 -112 Q-12 -99 0 -98 Q12 -99 12.5 -112 Q9 -104 0 -105 Q-9 -104 -12.5 -112 Z" fill="${h}" ${thin}/><path d="M-4 -107.5 Q0 -106 4 -107.5" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>` : '';
    const face = `<circle cx="-6" cy="-119" r="2.1" fill="${INK}"/><circle cx="6" cy="-119" r="2.1" fill="${INK}"/>
      <path d="M-9.5 -125 q3.5 -2 7 0 M2.5 -125 q3.5 -2 7 0" fill="none" stroke="${dark(h, 0.35)}" stroke-width="2" stroke-linecap="round"/>
      <path d="M0 -116 q2 2.5 -0.5 4" fill="none" stroke="${INK}" stroke-opacity="0.55" stroke-width="1.8" stroke-linecap="round"/>
      ${p.beard ? '' : `<path d="M-5 -109.5 Q0 -105.5 5 -109.5" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`}
      <circle cx="-10.5" cy="-112.5" r="3.4" fill="#ff8a8a" fill-opacity="0.45"/><circle cx="10.5" cy="-112.5" r="3.4" fill="#ff8a8a" fill-opacity="0.45"/>`;
    const ears = `<ellipse cx="-16.5" cy="-117" rx="3.4" ry="4.6" fill="${p.skin}" ${thin}/><ellipse cx="16.5" cy="-117" rx="3.4" ry="4.6" fill="${p.skin}" ${thin}/>`;
    const glasses = p.glasses ? `<circle cx="-6.5" cy="-119" r="5" fill="#fff" fill-opacity="0.25" stroke="${INK}" stroke-width="2.2"/><circle cx="6.5" cy="-119" r="5" fill="#fff" fill-opacity="0.25" stroke="${INK}" stroke-width="2.2"/><path d="M-1.5 -119 h3" stroke="${INK}" stroke-width="2"/>` : '';
    let hat = '';
    if (p.hat === 'beanie') {
      hat = `<path d="M-18.5 -126 Q-18.5 -152 0 -152 Q18.5 -152 18.5 -126 Z" fill="${p.hatColor}" ${thin}/><rect x="-19.5" y="-130" width="39" height="7" rx="3.5" fill="${dark(p.hatColor, 0.15)}" ${thin}/><circle cx="0" cy="-154" r="6" fill="#fffaf1" ${thin}/>`;
    } else if (p.hat === 'cap') {
      hat = `<path d="M-17.5 -127 Q-17.5 -148 0 -148 Q17.5 -148 17.5 -127 Z" fill="${p.hatColor}" ${thin}/><ellipse cx="0" cy="-127" rx="19" ry="4" fill="${dark(p.hatColor, 0.15)}" ${thin}/><circle cx="0" cy="-148" r="2.5" fill="${dark(p.hatColor, 0.2)}"/>`;
    } else if (p.hat === 'fedora') {
      hat = `<ellipse cx="0" cy="-129" rx="26" ry="5" fill="${p.hatColor}" ${thin}/><path d="M-14 -129 L-12 -145 Q0 -150 12 -145 L14 -129 Z" fill="${p.hatColor}" ${thin}/><rect x="-13" y="-135" width="26" height="5" fill="${INK}" fill-opacity="0.75"/>`;
    }
    return `${back}${ears}<circle cx="0" cy="-118" r="16.5" fill="${p.skin}" ${thin}/>${face}${beard}${front}${glasses}${hat}`;
  }

  function frontParts(p) {
    const c = p.topColor;
    const legW = p.top === 'dress' || p.bottom === 'tights' ? 9 : 11;
    const leg = (x) => `<rect x="${x - legW / 2}" y="-58" width="${legW}" height="52" rx="4" fill="${p.legColor}" ${thin}/>
      <ellipse cx="${x}" cy="-4.5" rx="8.5" ry="5.5" fill="${p.shoe}" ${thin}/><path d="M${x - 5} -7 q5 -3 10 0" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="2"/>`;
    let torso;
    if (p.top === 'dress') {
      torso = `<path d="M-14 -102 Q-21 -100 -21 -91 L-17 -70 L-28 -32 Q-28 -29 -24 -29 H24 Q28 -29 28 -32 L17 -70 L21 -91 Q21 -100 14 -102 Z" fill="${c}" ${thin}/><path d="M-17 -70 H17" stroke="${dark(c, 0.3)}" stroke-width="3.5"/>`;
    } else {
      const y = { coat: -36, jacket: -45, sweater: -45 }[p.top];
      torso = `<path d="M-15 -102 Q-23 -100 -23 -91 L-25 ${y - 5} Q-25 ${y} -20 ${y} H20 Q25 ${y} 25 ${y - 5} L23 -91 Q23 -100 15 -102 Z" fill="${c}" ${thin}/>`;
      if (p.top === 'coat') torso += `<path d="M-8 -102 L0 -88 L8 -102 Z" fill="#fffaf1" ${thin}/><path d="M0 -88 V-37" stroke="${dark(c, 0.35)}" stroke-width="2.5"/>${[-78, -64, -50].map((by) => `<circle cx="4" cy="${by}" r="1.9" fill="${INK}"/>`).join('')}<path d="M-24 -64 H24" stroke="${dark(c, 0.3)}" stroke-width="4"/>`;
      else if (p.top === 'jacket') torso += `<path d="M0 -101 V-46" stroke="${dark(c, 0.4)}" stroke-width="2.5"/><path d="M-24 -50 H24" stroke="${dark(c, 0.25)}" stroke-width="5"/><path d="M-9 -102 L0 -94 L9 -102" fill="none" stroke="${dark(c, 0.35)}" stroke-width="2.5"/>`;
      else torso += `<path d="M-24 -50 H24" stroke="${dark(c, 0.2)}" stroke-width="6"/><path d="M-8 -102 Q0 -97 8 -102" fill="none" stroke="${dark(c, 0.3)}" stroke-width="5" stroke-linecap="round"/>`;
    }
    const scarf = p.scarf ? `<rect x="-12" y="-107" width="24" height="10" rx="5" fill="${p.scarf}" ${thin}/><path d="M4 -99 L9 -78 L1 -78 L-1 -99 Z" fill="${p.scarf}" ${thin}/>` : '';
    const bag = p.bag === 'shoulder' ? `<path d="M-14 -101 L14 -62" stroke="${dark(p.bagColor, 0.35)}" stroke-width="3.5" stroke-linecap="round"/><rect x="8" y="-66" width="18" height="16" rx="3" fill="${p.bagColor}" ${thin}/>` : '';
    const straps = p.bag === 'backpack' ? `<path d="M-14 -101 L-12 -68 M14 -101 L12 -68" stroke="${dark(p.bagColor, 0.3)}" stroke-width="4" stroke-linecap="round"/>` : '';
    const arm = (side, still) => {
      const x = side * 20;
      if (still === 'umbrella') {
        return `<path d="M${x + 4} -114 V-228" stroke="${INK}" stroke-width="3.5"/>
          <path d="M${x - 46} -192 Q${x + 4} -250 ${x + 54} -192 Q${x + 46} -199 ${x + 38} -192 Q${x + 29} -199 ${x + 21} -192 Q${x + 12} -199 ${x + 4} -192 Q${x - 4} -199 ${x - 13} -192 Q${x - 21} -199 ${x - 29} -192 Q${x - 38} -199 ${x - 46} -192 Z" fill="${p.umbrella}" ${o}/>
          <path d="M${x + 4} -234 Q${x - 14} -216 ${x - 29} -192 M${x + 4} -234 Q${x + 22} -216 ${x + 38} -192 M${x + 4} -234 V-192" fill="none" stroke="${INK}" stroke-opacity="0.35" stroke-width="2.5"/>
          <path d="M${x + 4} -234 v-7" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
          ${limb(`M${x - side * 3} -96 L${x + side * 2} -110 L${x + 4} -120`, c)}${hand(x + 4, -122, p.skin)}`;
      }
      let item = '';
      if (still === 'cup') item = `<path d="M${x - 6} -64 H${x + 6} L${x + 4.5} -48 H${x - 4.5} Z" fill="#fffaf1" ${thin}/><rect x="${x - 5}" y="-59" width="10" height="5" fill="#b86b3a"/><rect x="${x - 7.5}" y="-67" width="15" height="4.5" rx="2" fill="#fffaf1" ${thin}/>`;
      if (still === 'shopping') item = `<path d="M${x - 11} -58 H${x + 11} L${x + 9} -30 H${x - 9} Z" fill="${p.bagColor}" ${thin}/><path d="M${x - 5} -58 Q${x - 5} -64 ${x} -64 Q${x + 5} -64 ${x + 5} -58" fill="none" stroke="${INK}" stroke-width="2.2"/>`;
      return `<rect x="${x - 5}" y="-100" width="10" height="41" rx="5" fill="${c}" ${thin}/>${item}${hand(x, -58, p.skin)}`;
    };
    const rightHold = p.hold === 'umbrella' ? 'umbrella' : p.hold === 'cup' ? 'cup' : '';
    const leftHold = p.hold === 'shopping' ? 'shopping' : '';
    return {
      legL: leg(-7),
      legR: leg(7),
      body: `<ellipse cx="0" cy="1" rx="26" ry="6" fill="#000" fill-opacity="0.16"/><rect x="-4" y="-106" width="8" height="8" fill="${p.skin}" ${thin}/>${torso}${scarf}${straps}${frontHead(p)}${bag}`,
      armL: arm(-1, leftHold),
      armR: arm(1, rightHold),
      rightStill: rightHold === 'umbrella',
    };
  }

  // ---- A small dog (side view, facing right) ----

  function dogParts(c) {
    const leg = (x, back) => `<rect x="${x - 3.5}" y="-20" width="7" height="20" rx="3.5" fill="${back ? dark(c, 0.25) : c}" ${thin}/><ellipse cx="${x + 1.5}" cy="-1" rx="5" ry="2.6" fill="${back ? dark(c, 0.25) : c}" ${thin}/>`;
    return {
      legsA: leg(9, false) + leg(-11, true),
      legsB: leg(5, true) + leg(-15, false),
      tail: `<path d="M-19 -27 Q-31 -32 -29 -45" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M-19 -27 Q-31 -32 -29 -45" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`,
      body: `<ellipse cx="0" cy="1" rx="24" ry="4" fill="#000" fill-opacity="0.16"/>
        <ellipse cx="-1" cy="-23" rx="21" ry="10.5" fill="${c}" ${thin}/><ellipse cx="-6" cy="-26" rx="7" ry="4" fill="#fff" fill-opacity="0.35"/>
        <path d="M10 -28 Q16 -38 20 -34" fill="${c}"/>
        <circle cx="21" cy="-34" r="10" fill="${c}" ${thin}/><ellipse cx="30" cy="-30.5" rx="7.5" ry="5.2" fill="${c}" ${thin}/>
        <circle cx="36.5" cy="-32" r="2.5" fill="${INK}"/><circle cx="23.5" cy="-36.5" r="1.9" fill="${INK}"/>
        <path d="M30 -26.5 q3 2.5 6 0" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/><path d="M33 -25.5 q1 4 3 3" fill="#ff8a8a"/>
        <path d="M15 -42 Q9 -42 10 -28 Q15 -29 17.5 -36 Z" fill="${dark(c, 0.3)}" ${thin}/>
        <path d="M12.5 -30 Q15 -24 19 -24" fill="none" stroke="#e0474f" stroke-width="4" stroke-linecap="round"/><circle cx="16" cy="-23" r="2" fill="#ffd35e"/>`,
    };
  }

  // ---- Who's out today ----

  const STROLLERS = [
    { dir: 'right', d: 40, delay: -4, skin: SKIN[0], hair: '#8a5a35', hairStyle: 'bob', top: 'coat', topColor: '#ff6b5b', bottom: 'tights', legColor: '#3b3440', shoe: '#2b2a33', hold: 'cup', bag: 'shoulder', bagColor: '#b86b3a' },
    { dir: 'left', d: 46, delay: -22, skin: SKIN[3], hair: '#2b2a33', hairStyle: 'short', beard: true, top: 'jacket', topColor: '#1fa3a3', bottom: 'jeans', legColor: '#3f5a85', shoe: '#8a5a35', hold: 'leash', dog: '#d9a066' },
    { dir: 'right', d: 54, delay: -33, skin: SKIN[1], hair: '#d7d4cf', hairStyle: 'bald', glasses: true, hat: 'fedora', hatColor: '#5a6178', top: 'coat', topColor: '#9a7552', bottom: 'trousers', legColor: '#4a4852', shoe: '#2b2a33', hold: 'paper' },
    { dir: 'left', d: 43, delay: -8, skin: SKIN[4], hair: '#1f1a1a', hairStyle: 'curly', top: 'sweater', topColor: '#ffc145', bottom: 'jeans', legColor: '#3f5a85', shoe: '#fffaf1', hold: 'shopping', bag: 'backpack', bagColor: '#8fb8ff' },
    {
      dir: 'right', d: 50, delay: -16, skin: SKIN[2], hair: '#3b2a20', hairStyle: 'ponytail', top: 'jacket', topColor: '#c9a3d6', bottom: 'jeans', legColor: '#3f5a85', shoe: '#e0474f', hold: 'swing',
      kid: { kid: true, skin: SKIN[2], hair: '#3b2a20', hairStyle: 'bun', top: 'dress', topColor: '#6fbf73', bottom: 'tights', legColor: '#fffaf1', shoe: '#e0474f', hold: 'balloon' },
    },
  ];

  const CROSSERS = [
    { skin: SKIN[1], hair: '#3b2a20', hairStyle: 'short', top: 'jacket', topColor: '#8fb8ff', bottom: 'jeans', legColor: '#3f5a85', shoe: '#fffaf1', hold: 'cup' },
    { skin: SKIN[0], hair: '#d9b36a', hairStyle: 'ponytail', top: 'coat', topColor: '#ff9aa8', bottom: 'tights', legColor: '#3b3440', shoe: '#2b2a33', hold: 'swing', bag: 'shoulder', bagColor: '#fffaf1' },
    { skin: SKIN[3], hair: '#2b2a33', hairStyle: 'curly', glasses: true, top: 'sweater', topColor: '#6fbf73', bottom: 'trousers', legColor: '#4a4852', shoe: '#8a5a35', hold: 'shopping', bagColor: '#ffc145' },
    { skin: SKIN[2], hair: '#1f1a1a', hairStyle: 'short', beard: true, hat: 'cap', hatColor: '#e0474f', top: 'jacket', topColor: '#5a6178', bottom: 'jeans', legColor: '#3f5a85', shoe: '#fffaf1', hold: 'swing', bag: 'backpack', bagColor: '#ffc145' },
    { skin: SKIN[4], hair: '#2b2a33', hairStyle: 'bob', top: 'dress', topColor: '#c9a3d6', bottom: 'tights', legColor: '#2b2a33', shoe: '#e0474f', hold: 'swing' },
    { skin: SKIN[1], hair: '#b0b0b0', hairStyle: 'bun', glasses: true, top: 'coat', topColor: '#1fa3a3', bottom: 'trousers', legColor: '#5a5468', shoe: '#2b2a33', hold: 'swing', bag: 'shoulder', bagColor: '#b86b3a' },
  ];

  // Dress everyone for the day's weather.
  function dressFor(p, weather, k) {
    const q = Object.assign({}, p);
    if (weather === 'rain') {
      if (['swing', 'cup', 'paper', 'shopping', 'phone'].includes(q.hold)) {
        q.hold = 'umbrella';
        q.umbrella = UMBRELLAS[k % UMBRELLAS.length];
      } else if (q.hold === 'leash' && !q.hat) {
        q.hat = 'cap';
        q.hatColor = '#ffc145';
      }
    } else if (weather === 'snow') {
      if (q.hat !== 'fedora') {
        q.hat = 'beanie';
        q.hatColor = ['#e0474f', '#1fa3a3', '#ffc145', '#8fb8ff', '#fffaf1'][k % 5];
      }
      q.scarf = ['#ffc145', '#e0474f', '#6fbf73', '#fffaf1', '#c9a3d6'][(k + 2) % 5];
      if (q.top === 'sweater' || q.top === 'jacket') q.top = 'coat';
    }
    if (q.kid) q.kid = dressFor(q.kid, weather === 'rain' ? 'clear' : weather, k + 1);
    return q;
  }

  // One baked image per part; parts share a frame so they line up.
  const SIDE_BOX = { x: -64, y: -256, w: 164, h: 264 };
  const FRONT_BOX = { x: -80, y: -258, w: 170, h: 266 };
  const DOG_BOX = { x: -40, y: -52, w: 86, h: 58 };
  const PEOPLE_BLUR = 2.2;

  function partImage(key, box, art, tod) {
    const k = `p|${key}|${tod}`;
    if (!carImages.has(k)) carImages.set(k, bakeSmall(`${box.x} ${box.y} ${box.w} ${box.h}`, art, tod, PEOPLE_BLUR));
    return carImages.get(k);
  }

  function part(href, box, cls, pivot) {
    const origin = pivot ? ` style="transform-origin:${(((pivot[0] - box.x) / box.w) * 100).toFixed(2)}% ${(((pivot[1] - box.y) / box.h) * 100).toFixed(2)}%"` : '';
    return `<image${cls ? ` class="${cls}"` : ''} href="${href}" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"${origin}/>`;
  }

  // ---- Walk cycles as flipbooks ----
  // A walker's whole stride is drawn once as a strip of FRAMES poses. On screen the strip
  // just steps along inside a small window while the walker slides down the street, so
  // the browser never has to redraw anyone: both moves are plain layer shifts.
  const FRAMES = 12;
  const TAU = Math.PI * 2;

  function sidePose(s, phi) {
    const leg = 24 * Math.cos(TAU * phi);
    const arm = -20 * Math.cos(TAU * phi);
    // The hip dips when the legs are apart, so both feet stay on the ground.
    const drop = 50 * (1 - Math.cos((leg * Math.PI) / 180));
    return `<g transform="translate(0 ${drop.toFixed(2)})">
      <g transform="rotate(${(-arm).toFixed(2)} 0 -96)">${s.backArm}</g>
      <g transform="rotate(${(-leg).toFixed(2)} 0 -50)">${s.backLeg}</g>
      <g transform="rotate(${leg.toFixed(2)} 0 -50)">${s.frontLeg}</g>
      ${s.body}
      ${s.armMode === 'swing' ? `<g transform="rotate(${arm.toFixed(2)} 0 -96)">${s.frontArm}</g>` : s.frontArm}</g>`;
  }

  function dogPose(d, phi) {
    const skew = 26 * Math.cos(TAU * phi);
    const legs = (a, art) => `<g transform="translate(0 -18) skewX(${a.toFixed(2)}) translate(0 18)">${art}</g>`;
    const bob = -1.5 * Math.abs(Math.sin(TAU * phi));
    return `<g transform="translate(0 ${bob.toFixed(2)})">
      <g transform="rotate(${(16 * Math.sin(TAU * 2 * phi)).toFixed(2)} -19 -27)">${d.tail}</g>
      ${legs(-skew, d.legsB)}${legs(skew, d.legsA)}${d.body}</g>`;
  }

  // One strip image: FRAMES copies of the box side by side, each in the next pose.
  function flipbook(key, box, tod, pose) {
    const k = `book|${key}|${tod}`;
    if (!carImages.has(k)) {
      const res = pixelScale(1, 1.25);
      let frames = '';
      for (let f = 0; f < FRAMES; f++) frames += `<g transform="translate(${f * box.w - box.x} ${-box.y})">${pose(f / FRAMES)}</g>`;
      const w = box.w * FRAMES;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * res)}" height="${Math.round(box.h * res)}" viewBox="0 0 ${w} ${box.h}"><defs>${frostFilter(tod, PEOPLE_BLUR)}</defs><g filter="url(#b)">${frames}</g></svg>`;
      carImages.set(k, svgUrl(svg, w * res, box.h * res));
    }
    return carImages.get(k);
  }

  // A flipbook placed at (x, y) in the walker's own units (feet at 0,0), scaled by `sc`:
  // a one-frame window with the strip as its background, stepping from pose to pose.
  // (Classic sprite animation: no oversized images or layers, so it draws the same in
  // every browser.)
  function sprite(url, box, x, y, sc, cycle) {
    return `<div class="ms-sprite" data-src="${url}" style="left:${(x + box.x * sc).toFixed(1)}px;top:${(y + box.y * sc).toFixed(1)}px;width:${(box.w * sc).toFixed(1)}px;height:${(box.h * sc).toFixed(1)}px;background-image:${cssUrl(url)};animation-duration:${cycle}s"></div>`;
  }

  const cssUrl = (url) => `url('${url.replace(/'/g, '%27')}')`;

  function frontFigure(p, key, tod) {
    const f = frontParts(p);
    const img = (name, art) => partImage(`front|${key}|${name}`, FRONT_BOX, art, tod);
    return `${part(img('ll', f.legL), FRONT_BOX, 'ms-limb ms-lift-l', [-7, -50])}
      ${part(img('lr', f.legR), FRONT_BOX, 'ms-limb ms-lift-r', [7, -50])}
      ${part(img('bo', f.body), FRONT_BOX)}
      ${part(img('al', f.armL), FRONT_BOX, 'ms-limb ms-farm-l', [-20, -96])}
      ${part(img('ar', f.armR), FRONT_BOX, f.rightStill ? '' : 'ms-limb ms-farm-r', [20, -96])}`;
  }

  // The strollers on the far sidewalk. Each is its own small element on the "stage" (a
  // layer laid out in scene units), so sliding along the street is done by the graphics
  // card and only the swinging limbs are redrawn. A stride is ~80 units, so each
  // person's step rhythm matches how fast they cover ground (a crossing takes --d s).
  function strollersHtml(weather, tod) {
    return STROLLERS.map((base, k) => {
      const p = dressFor(base, weather, k);
      const key = `${k}|${weather}`;
      const gait = (80 * p.d) / 2520;
      const parts = sideParts(p);
      let html = sprite(flipbook(`side|${key}`, SIDE_BOX, tod, (phi) => sidePose(parts, phi)), SIDE_BOX, 0, 0, 1, gait.toFixed(2));
      if (p.kid) {
        const kidParts = sideParts(p.kid);
        html = sprite(flipbook(`side|${key}|kid`, SIDE_BOX, tod, (phi) => sidePose(kidParts, phi)), SIDE_BOX, -46, 0, 0.64, (gait * 0.7).toFixed(2)) + html;
      }
      if (p.dog) {
        const dog = dogParts(p.dog);
        html += sprite(flipbook(`dog|${p.dog}`, DOG_BOX, tod, (phi) => dogPose(dog, phi)), DOG_BOX, 60, 0, 1, (gait * 0.5).toFixed(2));
      }
      return `<div class="ms-walker ${p.dir}" style="--d:${p.d}s;--delay:${p.delay}s"><div class="ms-walker-body" style="top:606px${p.dir === 'left' ? ';transform:scaleX(-1)' : ''}">${html}</div></div>`;
    }).join('');
  }

  // Lays the stage out exactly like the scene's SVG layers (viewBox W x H, sliced to
  // cover, anchored bottom-centre), so walkers line up with the street.
  function layoutStage() {
    const stage = host && host.querySelector('.ms-stage');
    if (!stage) return;
    const bw = stage.parentElement.clientWidth;
    const bh = stage.parentElement.clientHeight;
    if (!bw || !bh) return;
    const sc = Math.max(bw / W, bh / H);
    stage.style.transform = `translate(${((bw - W * sc) / 2).toFixed(1)}px, ${(bh - H * sc).toFixed(1)}px) scale(${sc.toFixed(4)})`;
  }

  function crosserSvg(k, weather, tod) {
    const p = dressFor(CROSSERS[k % CROSSERS.length], weather, k + 3);
    return `<g class="ms-gait" style="--gait:0.95s">${frontFigure(p, `${k % CROSSERS.length}|${weather}`, tod)}</g>`;
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
    const res = pixelScale(0.75, 1.5) * 0.8;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * res)}" height="${Math.round(H * res)}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">
      <defs><filter id="f" x="-3%" y="-3%" width="106%" height="106%"><feGaussianBlur stdDeviation="${blur}"/><feColorMatrix type="saturate" values="1.08"/></filter></defs>
      <g filter="url(#f)">${body}<rect x="-60" y="-60" width="${W + 120}" height="${H + 120}" fill="${P.tint}" fill-opacity="${P.tintOp}"/></g></svg>`;
    return svgUrl(svg, W * res, H * res);
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
    return `
      <defs><radialGradient id="ms-headglow"><stop offset="0" stop-color="#fff6c8" stop-opacity="1"/><stop offset="0.3" stop-color="#fff3b0" stop-opacity="0.6"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/></radialGradient>
        <radialGradient id="ms-pool"><stop offset="0" stop-color="#fff3b0" stop-opacity="0.55"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/></radialGradient>
        <radialGradient id="ms-brake"><stop offset="0" stop-color="#ff5a4a" stop-opacity="0.95"/><stop offset="1" stop-color="#ff5a4a" stop-opacity="0"/></radialGradient>
        <radialGradient id="ms-puff"><stop offset="0" stop-color="#e9e6ee" stop-opacity="0.85"/><stop offset="1" stop-color="#e9e6ee" stop-opacity="0"/></radialGradient></defs>
      ${[0, 1, 2].map((k) => `<g class="ms-bird" style="--d:${24 + k * 8}s;--delay:${-k * 11}s"><g class="ms-blur"><path transform="translate(0 ${180 + k * 36})" class="ms-wingbeat" d="M0 10 Q8 0 16 9 Q24 0 32 10" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g></g>`).join('')}
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

  // A few ready-made driver looks, so each car doesn't need its own drawing.
  const DRIVERS = [
    { skin: '#f4c9a4', hair: '#3b2a20', shirt: '#1fa3a3', helmet: '#ff6b5b' },
    { skin: '#e0a77e', hair: '#2b2a33', shirt: '#ff6b5b', helmet: '#fffaf1' },
    { skin: '#b97a52', hair: '#2b2a33', shirt: '#ffc145', helmet: '#1fa3a3' },
    { skin: '#8a5a3a', hair: '#1f1a1a', shirt: '#8fb8ff', helmet: '#ffc145' },
    { skin: '#f4c9a4', hair: '#d9b36a', shirt: '#c9a3d6', helmet: '#6fbf73' },
    { skin: '#e0a77e', hair: '#b0b0b0', shirt: '#6fbf73', helmet: '#c9a3d6' },
  ];

  function newCar(laneName, rng, r) {
    const lane = LANES[laneName];
    const kind = CAR_POOL[Math.floor(rng() * CAR_POOL.length)];
    const colors = FIXED_COLORS[kind] || CAR_COLORS;
    const color = colors[Math.floor(rng() * colors.length)];
    const spec = VEHICLES[kind];
    const d = Math.floor(rng() * DRIVERS.length);
    const variant = Object.assign({}, DRIVERS[d]);
    let key = `d${d}`;
    if (kind === 'bus') {
      // Passengers in some of the bus windows (a fixed pattern per bus colour keeps the cache small).
      variant.riders = [1, 0, 1, 1, 0].map((on, k) => (on ? DRIVERS[(d + k + 1) % DRIVERS.length] : null));
    } else if (kind !== 'scooter' && rng() < 0.35) {
      variant.back = DRIVERS[(d + 3) % DRIVERS.length];
      key += 'p';
    }
    const tod = shown.tod;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    el.setAttribute('class', 'ms-car parked');
    const [lx, ly] = spec.lamp;
    const [tx, ty] = spec.tail;
    const lit = PALETTES[tod].lit;
    el.innerHTML = `${lit ? `<ellipse cx="${lx + 44}" cy="2" rx="52" ry="8" fill="url(#ms-pool)"/>` : ''}
      <g class="ms-body"><image href="${vehicleImage(kind, color, variant, tod, laneName === 'far', key)}" x="-14" y="-210" width="${spec.w + 28}" height="236"/></g>
      ${spec.wheels.map(([wx, wr]) => `<g transform="translate(${wx} ${-wr + 4})"><image class="ms-wheel" href="${wheelImage(wr, tod)}" x="${-wr - 8}" y="${-wr - 8}" width="${2 * wr + 16}" height="${2 * wr + 16}"/></g>`).join('')}
      ${lit ? `<circle cx="${lx}" cy="${ly}" r="20" fill="url(#ms-headglow)"/>` : ''}
      <circle class="ms-brake" cx="${tx}" cy="${ty}" r="16" fill="url(#ms-brake)"/>`;
    const cruise = (spec.cruise + rng() * 40) * (laneName === 'far' ? 0.8 : 1);
    return {
      el,
      body: el.querySelector('.ms-body'),
      wheels: [...el.querySelectorAll('.ms-wheel')],
      wheelR: spec.wheels[0][1],
      pipe: spec.pipe,
      w: spec.w,
      lane: laneName,
      len: spec.w * lane.s,
      r,
      v: 0,
      cruise,
      braking: false,
      parked: true,
      tilt: 0,
      spin: rng() * 6,
      phase: rng() * 6,
    };
  }

  function placeCar(car) {
    const lane = LANES[car.lane];
    const x = lane.dir > 0 ? car.r : W - car.r;
    car.el.setAttribute('transform', `translate(${x.toFixed(1)} ${lane.y}) scale(${lane.dir * lane.s} ${lane.s})`);
    // Body: a little suspension bounce while moving, nose down when braking, up when pulling away.
    const bob = car.v > 20 ? Math.sin(car.phase) * 0.9 : 0;
    car.body.setAttribute('transform', `translate(0 ${bob.toFixed(2)}) rotate(${car.tilt.toFixed(2)} ${car.w / 2} -10)`);
    // Wheels roll with the distance travelled.
    const deg = ((car.spin * 180) / Math.PI) % 360;
    car.wheels.forEach((wheel) => wheel.setAttribute('transform', `rotate(${deg.toFixed(1)})`));
  }

  // A puff of exhaust from the tailpipe as a car pulls away (drawn in the street's own
  // coordinates, so it stays put while the car drives off).
  function puff(car, group) {
    const lane = LANES[car.lane];
    const px = lane.dir > 0 ? car.r + car.pipe[0] * lane.s : W - car.r - car.pipe[0] * lane.s;
    const py = lane.y + car.pipe[1] * lane.s;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'ms-puffs');
    g.style.setProperty('--dx', `${-lane.dir * 26}px`);
    g.innerHTML = [0, 1, 2].map((k) => `<circle class="ms-puff" cx="${(px - lane.dir * k * 6).toFixed(1)}" cy="${py.toFixed(1)}" r="${(9 + k * 3) * lane.s}" fill="url(#ms-puff)" style="animation-delay:${k * 0.12}s"/>`).join('');
    group.appendChild(g);
    setTimeout(() => g.remove(), 1600);
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
        if (car.parked && !parked && T.ready) puff(car, T.root.querySelector(`.ms-lane.${name}`));
        if (braking !== car.braking || parked !== car.parked) {
          car.braking = braking;
          car.parked = parked;
          car.el.setAttribute('class', `ms-car${braking || parked ? ' braking' : ''}${parked ? ' parked' : ''}`);
        }
        // Nose dips when braking, lifts when pulling away; wheels roll; suspension bobs.
        const pulling = car.v > before + 0.5 && car.v < car.cruise * 0.75;
        const tiltTo = braking ? 2 : pulling ? -1.2 : 0;
        car.tilt += (tiltTo - car.tilt) * Math.min(1, dt * 8);
        car.spin += (car.v * dt) / (car.wheelR * lane.s);
        car.phase += dt * 16;
        // Off the far end: rejoin at the back of the lane as a different vehicle.
        if (car.r > W + 80) {
          const last = cars.reduce((m, c) => Math.min(m, c.r), Infinity);
          const fresh = newCar(name, T.rng, 0);
          fresh.r = Math.min(-fresh.len - 40, last - fresh.len - 140 - T.rng() * 420);
          fresh.v = fresh.cruise;
          fresh.parked = false;
          fresh.el.setAttribute('class', 'ms-car');
          car.el.replaceWith(fresh.el);
          flatten(fresh.el);
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
    for (let k = 0; k < count; k++) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      el.innerHTML = crosserSvg(Math.floor(T.rng() * CROSSERS.length), shown.weather, shown.tod);
      el.setAttribute('opacity', '0');
      group.appendChild(el);
      flatten(el);
      // Two people take opposite sides of the crosswalk and set off a couple of seconds apart.
      const side = count === 1 ? T.rng() : k === 0 ? 0.15 : 0.85;
      T.crossers.push({ el, x: CROSS_A + 26 + side * (CROSS_B - CROSS_A - 52), t: -(0.4 + k * 2.4 + T.rng() * 0.5), dur: 6.2 + T.rng() * 1.2 });
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

  window.addEventListener('resize', () => layoutStage());

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
    host.querySelectorAll('.ms-view > img').forEach((img) => forgetLayer(img.getAttribute('data-svg') || ''));
    host.querySelector('.ms-view').innerHTML = `
      <img class="ms-layer ms-back" alt="" src="${bake(backLayer(P, weather, rng), P, 6)}">
      <img class="ms-layer ms-mid" alt="" src="${bake(midLayer(P, weather, rng), P, 4.5)}">
      <div class="ms-layer ms-mid ms-stage-host"><div class="ms-stage">${strollersHtml(weather, tod)}</div></div>
      ${svg('ms-mid ms-moving', midMoving(P, weather, rng))}
      <img class="ms-layer ms-front" alt="" src="${bake(frontLayer(P, weather), Object.assign({}, P, { tintOp: P.tintOp * 0.7 }), 5)}">
      ${svg('ms-front ms-moving', frontMoving(P, weather, rng))}
      ${weatherSheets(weather, rng)}`;
    host.querySelector('.ms-glass-host').innerHTML = glassLayer(weather, tod, rng);
    host.querySelectorAll('.ms-view > img').forEach((img) => img.setAttribute('data-svg', img.getAttribute('src')));
    layoutStage();
    setupTraffic(host.querySelector('.ms-mid.ms-moving'), rng);
    flatten(host);
    // Settle the traffic into a natural spread before anyone sees it.
    for (let k = 0; k < 240; k++) stepTraffic(1 / 20);
    traffic.ready = true;
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
    // For tests: one vehicle drawn sharp (no blur), wheels included, as SVG markup.
    sketch(kind, color, mirrored) {
      const spec = VEHICLES[kind];
      const v = Object.assign({ mt: !!mirrored, riders: [DRIVERS[1], null, DRIVERS[2], DRIVERS[3], null], back: DRIVERS[4] }, DRIVERS[0]);
      const wheels = spec.wheels.map(([x, r]) => `<g transform="translate(${x} ${-r + 4})"><circle r="${r}" fill="${INK}"/><circle r="${r * 0.56}" fill="${CHROME}" stroke="${INK}" stroke-width="2"/></g>`).join('');
      const flip = mirrored ? ` transform="translate(${spec.w} 0) scale(-1 1)"` : '';
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -210 ${spec.w + 28} 236" width="${(spec.w + 28) * 0.9}" height="${236 * 0.9}"><g${flip}>${spec.draw(color, v)}${wheels}</g></svg>`;
    },
    kinds: () => Object.keys(VEHICLES),
    // For tests: every person drawn sharp in a mid-stride pose, for one weather.
    sketchPeople(weather) {
      const pose = (art, deg, px, py) => `<g transform="rotate(${deg} ${px} ${py})">${art}</g>`;
      const side = STROLLERS.map((base, k) => {
        const p = dressFor(base, weather, k);
        const draw = (q, x, sc) => {
          const t = sideParts(q);
          return `<g transform="translate(${x} 0) scale(${sc})">${pose(t.backArm, 18, 0, -96)}${pose(t.backLeg, -20, 0, -50)}${pose(t.frontLeg, 20, 0, -50)}${t.body}${t.armMode === 'swing' ? pose(t.frontArm, -18, 0, -96) : t.frontArm}</g>`;
        };
        const dog = p.dog ? (() => { const d = dogParts(p.dog); return `<g transform="translate(60 0)">${d.tail}${d.legsB}${d.legsA}${d.body}</g>`; })() : '';
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-110 -256 250 264" width="250" height="264">${p.kid ? draw(p.kid, -46, 0.64) : ''}${draw(p, 0, 1)}${dog}</svg>`;
      });
      const front = CROSSERS.map((base, k) => {
        const f = frontParts(dressFor(base, weather, k + 3));
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-80 -258 170 266" width="170" height="266">${f.legL}<g transform="translate(0 -6)">${f.legR}</g>${f.body}${f.armL}${f.armR}</svg>`;
      });
      return side.concat(front);
    },
    // For tests: the live traffic state (read-only use).
    get traffic() {
      return traffic;
    },
  };

  CC.MenuScene.refresh();
})();
