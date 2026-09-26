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

  function bakeSmall(viewBox, art, tod, blur) {
    const dim = tod === 'night' ? 0.7 : tod === 'evening' ? 0.9 : 1;
    const shadeFx = dim < 1 ? `<feComponentTransfer><feFuncR type="linear" slope="${dim}"/><feFuncG type="linear" slope="${dim}"/><feFuncB type="linear" slope="${dim + 0.05}"/></feComponentTransfer>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><defs><filter id="b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${blur}"/>${shadeFx}</filter></defs><g filter="url(#b)">${art}</g></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

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
      <defs><radialGradient id="ms-headglow"><stop offset="0" stop-color="#fff6c8" stop-opacity="1"/><stop offset="0.3" stop-color="#fff3b0" stop-opacity="0.6"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/></radialGradient>
        <radialGradient id="ms-pool"><stop offset="0" stop-color="#fff3b0" stop-opacity="0.55"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/></radialGradient>
        <radialGradient id="ms-brake"><stop offset="0" stop-color="#ff5a4a" stop-opacity="0.95"/><stop offset="1" stop-color="#ff5a4a" stop-opacity="0"/></radialGradient>
        <radialGradient id="ms-puff"><stop offset="0" stop-color="#e9e6ee" stop-opacity="0.85"/><stop offset="1" stop-color="#e9e6ee" stop-opacity="0"/></radialGradient></defs>
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
    // For tests: the live traffic state (read-only use).
    get traffic() {
      return traffic;
    },
  };

  CC.MenuScene.refresh();
})();
