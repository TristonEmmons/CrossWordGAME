/* Level select as a cartoon adventure map: a winding road through themed chapter
   worlds (five levels each), with landmarks, wooden signposts, coin-style level
   buttons, and the coffee-cup mascot standing at the next level to play. */
(function () {
  'use strict';

  const CC = window.CC;
  const INK = '#2b2a33';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const CHAPTER = 5;
  const NODE_GAP = 132; // vertical distance between level buttons
  const SIGN_ROOM = 150; // space above each chapter's first level for its signpost

  // Each chapter's world. Cycles when the levels outrun the list.
  const WORLDS = [
    { name: 'Coffee Corner', sky: '#f7e6cf', hill: '#efd4b0', art: ['cafe', 'cup', 'beans', 'bush'] },
    { name: 'Newsstand Avenue', sky: '#e2ecf3', hill: '#cddce8', art: ['kiosk', 'lamp', 'papers', 'bush'] },
    { name: 'Library Hill', sky: '#e5efd9', hill: '#cfe2bd', art: ['books', 'tree', 'owl', 'tree'] },
    { name: 'Crossword Park', sky: '#dcefd2', hill: '#bfdfae', art: ['bench', 'tree', 'pond', 'flowers'] },
    { name: 'Seaside Boardwalk', sky: '#dcf0f4', hill: '#f3e2bd', art: ['lighthouse', 'umbrella', 'waves', 'shell'] },
    { name: 'Mountain Pass', sky: '#e7e3f4', hill: '#d3cde9', art: ['mountain', 'pine', 'mountain', 'pine'] },
    { name: 'Autumn Orchard', sky: '#f9e3cf', hill: '#f1c9a3', art: ['orangeTree', 'pumpkin', 'orangeTree', 'leaves'] },
    { name: 'Starry Night', sky: '#343c6b', hill: '#262d55', art: ['moon', 'starCluster', 'owl', 'starCluster'], dark: true },
  ];

  const s = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

  // Cartoon landmarks, drawn on a 120x120 canvas, feet at the bottom.
  const ART = {
    cafe: `<svg viewBox="0 0 120 120"><rect x="18" y="44" width="84" height="66" rx="4" fill="#fff4e4" ${s}/>
      <path d="M12 44 L22 26 H98 L108 44 Z" fill="#ff6b5b" ${s}/><path d="M34 26 L30 44 M50 26 L48 44 M70 26 L72 44 M86 26 L90 44" ${s} stroke-width="2.4"/>
      <path d="M12 44 q8 8 16 0 q8 8 16 0 q8 8 16 0 q8 8 16 0 q8 8 16 0 q8 8 16 0" fill="#fff" ${s} stroke-width="2.4"/>
      <rect x="28" y="64" width="30" height="24" rx="3" fill="#bfe3ea" ${s}/><rect x="68" y="64" width="22" height="46" rx="3" fill="#b37a4c" ${s}/>
      <circle cx="84" cy="88" r="2" fill="${INK}"/><rect x="40" y="10" width="40" height="16" rx="4" fill="#ffc145" ${s}/>
      <text x="60" y="22.5" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="11" fill="${INK}">CAFÉ</text></svg>`,
    cup: `<svg viewBox="-10 -14 84 84"><g fill="none" stroke="#b9a58c" stroke-width="3" stroke-linecap="round"><path d="M24 17 C21 12 27 9 24 3"/><path d="M31 16 C28 11 34 7 31 0"/><path d="M38 17 C35 12 41 9 38 3"/></g><use href="#coffee-cup"/></svg>`,
    beans: `<svg viewBox="0 0 120 120"><g ${s} stroke-width="2.6"><ellipse cx="40" cy="98" rx="14" ry="10" fill="#7a4a28" transform="rotate(-20 40 98)"/><ellipse cx="66" cy="102" rx="14" ry="10" fill="#8f5a32" transform="rotate(15 66 102)"/><ellipse cx="54" cy="84" rx="14" ry="10" fill="#6b3f1f" transform="rotate(-5 54 84)"/></g>
      <g stroke="#e9c9a0" stroke-width="2.4" fill="none" stroke-linecap="round"><path d="M34 94 q6 4 12 8"/><path d="M60 98 q6 2 12 8"/><path d="M47 81 q7 2 14 6"/></g></svg>`,
    bush: `<svg viewBox="0 0 120 120"><path d="M20 108 C10 108 10 88 24 86 C24 70 44 66 50 78 C56 62 80 64 80 80 C94 76 104 92 96 108 Z" fill="#7cc47a" ${s}/><circle cx="44" cy="92" r="3" fill="#ff6b5b"/><circle cx="70" cy="86" r="3" fill="#ff6b5b"/><circle cx="82" cy="98" r="3" fill="#ffc145"/></svg>`,
    kiosk: `<svg viewBox="0 0 120 120"><rect x="22" y="48" width="76" height="62" rx="4" fill="#1fa3a3" ${s}/><path d="M14 48 L26 28 H94 L106 48 Z" fill="#ffc145" ${s}/>
      <rect x="34" y="56" width="52" height="24" rx="3" fill="#fffaf1" ${s}/><g ${s} stroke-width="2"><path d="M40 63 H80 M40 69 H72 M40 75 H76"/></g>
      <rect x="30" y="86" width="60" height="16" rx="2" fill="#fff" ${s}/><text x="60" y="42" text-anchor="middle" font-family="Abril Fatface, Georgia, serif" font-size="14" fill="${INK}">NEWS</text></svg>`,
    lamp: `<svg viewBox="0 0 120 120"><circle cx="60" cy="30" r="20" fill="#fff3b0" opacity="0.6"/><rect x="56" y="36" width="8" height="70" fill="#4a4d63" ${s}/><path d="M46 36 H74 L68 18 H52 Z" fill="#ffd35e" ${s}/><path d="M50 18 H70 L60 10 Z" fill="#4a4d63" ${s}/><rect x="46" y="104" width="28" height="8" rx="2" fill="#4a4d63" ${s}/></svg>`,
    papers: `<svg viewBox="0 0 120 120"><g ${s}><rect x="26" y="90" width="68" height="16" rx="2" fill="#fffaf1"/><rect x="30" y="76" width="64" height="15" rx="2" fill="#f4ecd8" transform="rotate(-3 62 83)"/><rect x="28" y="62" width="66" height="15" rx="2" fill="#fffaf1" transform="rotate(2 60 70)"/></g><path d="M36 69 H84 M34 83 H82 M34 97 H86" stroke="${INK}" stroke-opacity="0.35" stroke-width="2"/><path d="M60 62 V106" stroke="#ff6b5b" stroke-width="3"/></svg>`,
    books: `<svg viewBox="0 0 120 120"><g ${s}><rect x="22" y="92" width="76" height="16" rx="3" fill="#ff6b5b"/><rect x="28" y="76" width="66" height="16" rx="3" fill="#1fa3a3"/><rect x="24" y="60" width="70" height="16" rx="3" fill="#ffc145"/><rect x="34" y="44" width="58" height="16" rx="3" fill="#8fb8ff"/></g><g stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.8"><path d="M30 100 H90 M36 84 H86 M32 68 H86 M42 52 H84"/></g></svg>`,
    tree: `<svg viewBox="0 0 120 120"><rect x="54" y="72" width="12" height="38" rx="3" fill="#a06a3e" ${s}/><circle cx="60" cy="50" r="30" fill="#6fbf73" ${s}/><circle cx="46" cy="44" r="7" fill="#fff" opacity="0.35"/><circle cx="70" cy="58" r="3.5" fill="#ff6b5b"/><circle cx="52" cy="62" r="3.5" fill="#ff6b5b"/></svg>`,
    owl: `<svg viewBox="0 0 120 120"><path d="M40 108 V60 C40 40 80 40 80 60 V108 Z" fill="#b8865a" ${s}/><path d="M40 54 L36 40 L50 48 M80 54 L84 40 L70 48" fill="#b8865a" ${s}/>
      <circle cx="51" cy="64" r="9" fill="#fff" ${s}/><circle cx="69" cy="64" r="9" fill="#fff" ${s}/><circle cx="52" cy="65" r="4" fill="${INK}"/><circle cx="68" cy="65" r="4" fill="${INK}"/>
      <path d="M56 74 L60 80 L64 74 Z" fill="#ffc145" ${s} stroke-width="2"/><path d="M48 90 q12 8 24 0" fill="none" ${s} stroke-width="2.4"/><rect x="30" y="106" width="60" height="6" rx="3" fill="#8a5a35" ${s}/></svg>`,
    bench: `<svg viewBox="0 0 120 120"><g ${s}><rect x="18" y="62" width="84" height="10" rx="3" fill="#c98a52"/><rect x="18" y="76" width="84" height="10" rx="3" fill="#c98a52"/><rect x="24" y="86" width="8" height="22" fill="#4a4d63"/><rect x="88" y="86" width="8" height="22" fill="#4a4d63"/></g></svg>`,
    pond: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="94" rx="48" ry="16" fill="#8fd3e0" ${s}/><path d="M34 92 q6 -4 12 0 M64 98 q6 -4 12 0" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <g ${s} stroke-width="2.4"><path d="M86 84 C84 70 90 60 92 56" fill="none"/><ellipse cx="92" cy="54" rx="4" ry="8" fill="#a06a3e"/><path d="M26 86 C26 74 22 66 20 62" fill="none"/></g><ellipse cx="44" cy="90" rx="8" ry="3.5" fill="#6fbf73" ${s} stroke-width="2"/></svg>`,
    flowers: `<svg viewBox="0 0 120 120"><g ${s} stroke-width="2.4"><path d="M40 108 V80 M60 108 V72 M80 108 V84" fill="none"/></g>
      <g ${s} stroke-width="2.4"><circle cx="40" cy="76" r="8" fill="#ff9aa8"/><circle cx="60" cy="68" r="9" fill="#ffc145"/><circle cx="80" cy="80" r="8" fill="#8fb8ff"/></g><circle cx="40" cy="76" r="3" fill="#fff"/><circle cx="60" cy="68" r="3.5" fill="#fff"/><circle cx="80" cy="80" r="3" fill="#fff"/></svg>`,
    lighthouse: `<svg viewBox="0 0 120 120"><path d="M46 110 L50 40 H70 L74 110 Z" fill="#fff" ${s}/><path d="M48.6 64 H71.4 L72.4 82 H47.6 Z M47 94 H73 L73.8 110 H46.2 Z" fill="#ff6b5b"/>
      <path d="M46 110 L50 40 H70 L74 110 Z" fill="none" ${s}/><rect x="46" y="28" width="28" height="12" rx="2" fill="#ffd35e" ${s}/><path d="M44 28 L60 14 L76 28 Z" fill="#ff6b5b" ${s}/>
      <path d="M74 32 L104 22 M74 36 L104 44" stroke="#ffd35e" stroke-width="4" stroke-linecap="round" opacity="0.8"/></svg>`,
    umbrella: `<svg viewBox="0 0 120 120"><path d="M60 40 V108" ${s}/><path d="M18 50 Q60 0 102 50 Q92 42 81 50 Q70 42 60 50 Q50 42 39 50 Q28 42 18 50 Z" fill="#ffc145" ${s}/>
      <path d="M39 50 Q48 20 60 16 Q72 20 81 50" fill="none" ${s} stroke-width="2.4"/><path d="M39 50 Q44 30 60 16 L60 50 Q50 42 39 50" fill="#ff6b5b" opacity="0.9"/><ellipse cx="60" cy="110" rx="26" ry="5" fill="#f3d9a4" ${s} stroke-width="2.4"/></svg>`,
    waves: `<svg viewBox="0 0 120 120"><path d="M8 96 q13 -14 26 0 t26 0 t26 0 t26 0 V114 H8 Z" fill="#8fd3e0" ${s}/><path d="M16 104 q10 -8 20 0 M58 106 q10 -8 20 0" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>`,
    shell: `<svg viewBox="0 0 120 120"><path d="M34 104 C34 70 86 70 86 104 Z" fill="#ffb3c1" ${s}/><path d="M60 104 V76 M47 104 L42 82 M73 104 L78 82" ${s} stroke-width="2.2"/><rect x="50" y="102" width="20" height="8" rx="3" fill="#ffb3c1" ${s} stroke-width="2.4"/></svg>`,
    mountain: `<svg viewBox="0 0 120 120"><path d="M4 110 L44 34 L64 66 L78 48 L116 110 Z" fill="#9a93c7" ${s}/><path d="M34 53 L44 34 L55 52 L49 48 L44 55 L39 49 Z" fill="#fff" ${s} stroke-width="2.2"/><path d="M72 56 L78 48 L85 58 L80 56 L77 60 Z" fill="#fff" ${s} stroke-width="2"/></svg>`,
    pine: `<svg viewBox="0 0 120 120"><rect x="55" y="92" width="10" height="18" fill="#a06a3e" ${s}/><path d="M60 14 L84 50 H72 L90 74 H74 L94 96 H26 L46 74 H30 L48 50 H36 Z" fill="#4fa36a" ${s}/><path d="M56 30 L48 44" stroke="#fff" stroke-width="2.4" opacity="0.5" stroke-linecap="round"/></svg>`,
    orangeTree: `<svg viewBox="0 0 120 120"><rect x="54" y="70" width="12" height="40" rx="3" fill="#a06a3e" ${s}/><circle cx="60" cy="48" r="32" fill="#f39a4b" ${s}/><circle cx="44" cy="40" r="7" fill="#ffc98f" opacity="0.7"/><circle cx="72" cy="56" r="4" fill="#c9462e"/><circle cx="50" cy="60" r="4" fill="#c9462e"/><circle cx="66" cy="34" r="4" fill="#c9462e"/></svg>`,
    pumpkin: `<svg viewBox="0 0 120 120"><path d="M60 64 C64 58 70 54 74 54" fill="none" ${s}/><ellipse cx="60" cy="90" rx="34" ry="22" fill="#f58a3a" ${s}/><path d="M48 70 C40 82 40 100 48 110 M72 70 C80 82 80 100 72 110 M60 68 V112" fill="none" ${s} stroke-width="2.4"/><path d="M40 82 q4 -6 10 -6" stroke="#fff" stroke-width="2.6" fill="none" opacity="0.6" stroke-linecap="round"/></svg>`,
    leaves: `<svg viewBox="0 0 120 120"><g ${s} stroke-width="2.4"><path d="M36 100 q10 -20 26 -12 q-12 18 -26 12 Z" fill="#f39a4b"/><path d="M62 106 q12 -16 26 -6 q-14 14 -26 6 Z" fill="#e8662f"/><path d="M52 84 q4 -18 22 -16 q-6 18 -22 16 Z" fill="#ffc145"/></g></svg>`,
    moon: `<svg viewBox="0 0 120 120"><circle cx="60" cy="50" r="34" fill="#fff5c7" opacity="0.25"/><path d="M72 22 A28 28 0 1 0 84 70 A22 22 0 1 1 72 22 Z" fill="#ffe27a" ${s}/><circle cx="58" cy="58" r="3" fill="${INK}"/><path d="M60 68 q6 4 12 0" fill="none" ${s} stroke-width="2.4"/></svg>`,
    starCluster: `<svg viewBox="0 0 120 120"><g fill="#ffe27a" ${s} stroke-width="2.2"><path d="M40 30 L44 40 L55 41 L47 48 L49 59 L40 53 L31 59 L33 48 L25 41 L36 40 Z"/><path d="M84 58 L87 65 L95 66 L89 71 L91 79 L84 75 L77 79 L79 71 L73 66 L81 65 Z"/></g><g fill="#fff"><circle cx="70" cy="30" r="2.5"/><circle cx="34" cy="84" r="2"/><circle cx="92" cy="96" r="2.5"/></g></svg>`,
  };

  const CLOUD = `<svg viewBox="0 0 120 60"><path d="M20 50 C6 50 6 30 22 30 C22 14 46 10 52 24 C58 8 86 10 86 28 C102 26 110 50 94 50 Z" fill="#fff" stroke="${INK}" stroke-opacity="0.18" stroke-width="3" stroke-linejoin="round"/></svg>`;

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
    return el;
  }

  function place(el, x, y, w, h) {
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    if (w != null) el.style.width = Math.round(w) + 'px';
    if (h != null) el.style.height = Math.round(h) + 'px';
  }

  // Stars arched above a finished level's button.
  function starArc(stars, icons) {
    const slot = (on, cls) => `<i class="${on ? 'on' : ''} ${cls}">${icons.star}</i>`;
    let html = slot(stars >= 1, 's1') + slot(stars >= 2, 's2') + slot(stars >= 3, 's3');
    if (stars >= 4) html += `<i class="on holo s4">${icons.holoStar}</i>`;
    return `<span class="node-stars">${html}</span>`;
  }

  CC.LevelMap = {
    // Draws the whole map into `host`. Returns the y of the next level so the caller can scroll to it.
    render(host, { next, completed, icons, onPlay }) {
      const count = Math.max(30, Math.ceil((next + 10) / CHAPTER) * CHAPTER);
      const width = Math.max(320, host.clientWidth || 480);
      const narrow = width < 560;
      const cx = width / 2;
      const amp = Math.min(narrow ? width * 0.26 : width * 0.2, 190);
      const artSize = narrow ? 76 : 118;

      // Road points: one per level, with room above each chapter for its signpost.
      const pts = [];
      let y = 40;
      for (let i = 0; i < count; i++) {
        if (i % CHAPTER === 0) y += SIGN_ROOM;
        pts.push([cx + Math.sin(i * 0.95 + 0.4) * amp, y]);
        y += NODE_GAP;
      }
      const height = y + 190; // room for the cloud bank at the end

      host.textContent = '';
      host.style.height = height + 'px';
      host.classList.toggle('narrow', narrow);

      // ---- Chapter worlds (scenery bands) ----
      const chapters = count / CHAPTER;
      for (let c = 0; c < chapters; c++) {
        const world = WORLDS[c % WORLDS.length];
        const firstLevel = c * CHAPTER + 1;
        const top = c === 0 ? 0 : pts[c * CHAPTER][1] - SIGN_ROOM - 40;
        const bottom = c === chapters - 1 ? height : pts[(c + 1) * CHAPTER][1] - SIGN_ROOM - 40;
        const band = CC.el('div', 'world' + (world.dark ? ' dark' : '') + (firstLevel > next ? ' locked' : ''));
        place(band, 0, top, width, bottom - top + 60);
        band.style.zIndex = String(c + 1);

        // Sky + rolling hills along the top edge, drawn in this world's colours.
        const h = bottom - top + 60;
        const bg = svgEl('svg', { class: 'world-bg', width, height: h, viewBox: `0 0 ${width} ${h}`, preserveAspectRatio: 'none' });
        const rng = CC.makeRng(c * 97 + 11);
        let hills = `M0 ${h} L0 40`;
        const bumps = Math.max(3, Math.round(width / 260));
        for (let b = 0; b < bumps; b++) {
          const x0 = (b / bumps) * width;
          const x1 = ((b + 1) / bumps) * width;
          hills += ` Q${(x0 + x1) / 2} ${-10 + rng() * 30} ${x1} ${30 + rng() * 20}`;
        }
        hills += ` L${width} ${h} Z`;
        bg.appendChild(svgEl('path', { d: hills, fill: world.sky }));
        // A second, darker hill line lower down for depth.
        let back = `M0 ${h} L0 ${h * 0.55}`;
        for (let b = 0; b < bumps + 1; b++) {
          const x0 = (b / (bumps + 1)) * width;
          const x1 = ((b + 1) / (bumps + 1)) * width;
          back += ` Q${(x0 + x1) / 2} ${h * 0.45 + rng() * 40} ${x1} ${h * 0.55 + rng() * 30}`;
        }
        back += ` L${width} ${h} Z`;
        bg.appendChild(svgEl('path', { d: back, fill: world.hill, opacity: '0.55' }));
        bg.appendChild(svgEl('path', { d: hills.split(' L' + width)[0], fill: 'none', stroke: INK, 'stroke-opacity': '0.12', 'stroke-width': '3' }));
        band.appendChild(bg);

        // Clouds (light worlds) drifting in the sky.
        if (!world.dark) {
          for (let k = 0; k < 2; k++) {
            const cloud = CC.el('div', 'map-cloud');
            cloud.innerHTML = CLOUD;
            const cw = (narrow ? 70 : 110) * (0.8 + rng() * 0.5);
            place(cloud, rng() * (width - cw), 60 + rng() * (h - 200), cw, cw / 2);
            cloud.style.animationDelay = -rng() * 20 + 's';
            band.appendChild(cloud);
          }
        } else {
          for (let k = 0; k < 40; k++) {
            const star = CC.el('span', 'night-star');
            place(star, rng() * width, 30 + rng() * (h - 60));
            star.style.animationDelay = -rng() * 3 + 's';
            band.appendChild(star);
          }
        }

        // Landmarks: beside every level, on the side away from the road.
        for (let k = 0; k < CHAPTER; k++) {
          const i = c * CHAPTER + k;
          const [px, py] = pts[i];
          const side = px >= cx ? -1 : 1;
          const size = artSize * (k % 2 ? 0.72 : 1);
          const ax = cx + side * (amp * (narrow ? 0.95 : 1.05)) - size / 2 + (rng() - 0.5) * 20;
          if (ax < 4 || ax + size > width - 4) continue;
          const art = CC.el('div', 'landmark');
          art.innerHTML = ART[world.art[k % world.art.length]];
          place(art, ax, py - size * 0.75 - top, size, size);
          band.appendChild(art);
          // Extra scenery out at the edges on wide screens.
          if (!narrow && width > 900) {
            const edge = CC.el('div', 'landmark far');
            edge.innerHTML = ART[world.art[(k + 2) % world.art.length]];
            const ex = side < 0 ? 30 + rng() * (cx - amp * 1.9 - 150) : width - 150 - rng() * (cx - amp * 1.9 - 150);
            if (ex > 10 && ex < width - 130) {
              place(edge, ex, py - 40 - top + (rng() - 0.5) * 40, 110, 110);
              band.appendChild(edge);
            }
          }
        }

        host.appendChild(band);

        // Wooden signpost naming the chapter (above the road, so it isn't painted over).
        const sign = CC.el('div', 'signpost' + (firstLevel > next ? ' locked' : ''));
        sign.innerHTML = `<span class="sign-board"><small>Chapter ${c + 1}</small>${world.name}</span><span class="sign-post"></span>`;
        place(sign, cx, pts[c * CHAPTER][1] - SIGN_ROOM + 6);
        host.appendChild(sign);
      }

      // ---- The road ----
      const road = svgEl('svg', { class: 'map-road', width, height, viewBox: `0 0 ${width} ${height}` });
      const pathTo = (n) => {
        let d = `M ${cx} 0 C ${cx} 60, ${pts[0][0]} ${pts[0][1] - 90}, ${pts[0][0]} ${pts[0][1]}`;
        for (let i = 1; i < n; i++) {
          const [x0, y0] = pts[i - 1];
          const [x1, y1] = pts[i];
          const my = (y0 + y1) / 2;
          d += ` C ${x0} ${my}, ${x1} ${my}, ${x1} ${y1}`;
        }
        return d;
      };
      const full = pathTo(count);
      road.appendChild(svgEl('path', { d: full, class: 'road-edge' }));
      road.appendChild(svgEl('path', { d: full, class: 'road-top' }));
      road.appendChild(svgEl('path', { d: pathTo(Math.min(next, count)), class: 'road-done' }));
      road.appendChild(svgEl('path', { d: full, class: 'road-dash' }));
      host.appendChild(road);

      // ---- Level buttons ----
      for (let i = 0; i < count; i++) {
        const level = i + 1;
        const [x, py] = pts[i];
        const record = completed[level];
        const node = CC.el('button', 'map-node');
        place(node, x, py);
        if (record) {
          node.classList.add('done');
          node.innerHTML = `${starArc(record.stars, icons)}<span class="coin"><span class="num">${level}</span></span>`;
          node.setAttribute('aria-label', `Level ${level}, completed, ${record.stars} stars. Replay`);
          node.addEventListener('click', () => onPlay(level));
        } else if (level === next) {
          node.classList.add('current');
          node.innerHTML = `<span class="coin"><span class="num">${level}</span></span><span class="play-tag">Play</span>`;
          node.setAttribute('aria-label', `Level ${level}, play`);
          node.addEventListener('click', () => onPlay(level));
        } else {
          node.classList.add('locked');
          node.disabled = true;
          node.innerHTML = `<span class="coin"><span class="num">${level}</span></span><span class="lock">${icons.lock}</span>`;
          node.setAttribute('aria-label', `Level ${level}, locked`);
        }
        host.appendChild(node);
      }

      // ---- Cloud bank where the map runs out ----
      const end = CC.el('div', 'map-end');
      end.innerHTML = `<span>More levels ahead…</span>`;
      // A row of overlapping puffs makes one fluffy edge; solid white below it.
      const puffs = [];
      const step = narrow ? 11 : 7;
      for (let p = -2, k = 0; p <= 102; p += step, k++) {
        const r = (narrow ? 34 : 50) + (k % 3) * 12;
        puffs.push(`radial-gradient(circle at ${p}% ${k % 2 ? 44 : 52}%, #fff ${r}px, transparent ${r + 1}px)`);
      }
      end.style.background = puffs.join(',') + ', linear-gradient(transparent 50%, #fff 50%)';
      place(end, 0, pts[count - 1][1] + 70, width, height - pts[count - 1][1] - 70);
      host.appendChild(end);

      // ---- Mascot waiting at the next level ----
      const cur = pts[Math.min(next, count) - 1];
      const buddy = CC.el('button', 'map-mascot');
      buddy.setAttribute('aria-label', `Play level ${next}`);
      buddy.innerHTML = `<img src="assets/img/mascot.png" alt="" draggable="false"><span class="map-bubble">Level ${next}! Let’s go!</span>`;
      const side = cur[0] >= cx ? -1 : 1;
      const msize = narrow ? 74 : 96;
      buddy.classList.toggle('left', side < 0);
      place(buddy, cur[0] + side * (narrow ? 64 : 84) - msize / 2, cur[1] - msize * 0.85, msize, msize);
      buddy.addEventListener('click', () => onPlay(next));
      host.appendChild(buddy);

      return cur[1];
    },
  };
})();
