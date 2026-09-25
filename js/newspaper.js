/* The newspaper page the puzzle is printed on: paper and desk textures, the masthead's
   dateline, and cartoon news columns that fill whatever margin the grid leaves free.
   Purely decorative; nothing here affects play. */
(function () {
  'use strict';

  const CC = window.CC;
  const INK = '#2b2a33';

  const area = document.getElementById('board-area');
  const wrap = document.getElementById('board-wrap');
  const panel = document.getElementById('puzzle-panel');
  const masthead = document.getElementById('masthead');
  const colLeft = document.getElementById('paper-col-left');
  const colRight = document.getElementById('paper-col-right');
  const strip = document.getElementById('paper-strip');
  const pencil = document.getElementById('paper-pencil');
  const coffeeBtn = document.getElementById('coffee-btn');

  // ---- Textures, drawn once on a canvas and reused as CSS backgrounds ----

  function tile(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), CC.makeRng(w * 7 + h));
    return `url(${c.toDataURL()})`;
  }

  // Newsprint: fine specks and a few paper fibres.
  const grain = tile(180, 180, (g, rng) => {
    for (let i = 0; i < 1500; i++) {
      const dark = rng() < 0.75;
      g.fillStyle = dark ? `rgba(70,50,25,${0.03 + rng() * 0.06})` : `rgba(255,255,255,${0.25 + rng() * 0.35})`;
      g.beginPath();
      g.arc(rng() * 180, rng() * 180, 0.3 + rng() * 0.8, 0, Math.PI * 2);
      g.fill();
    }
    g.lineCap = 'round';
    g.lineWidth = 0.7;
    for (let i = 0; i < 36; i++) {
      const x = rng() * 180;
      const y = rng() * 180;
      const a = rng() * Math.PI;
      const len = 5 + rng() * 11;
      g.strokeStyle = `rgba(95,70,40,${0.05 + rng() * 0.05})`;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(
        x + (Math.cos(a) * len) / 2 + (rng() - 0.5) * 4,
        y + (Math.sin(a) * len) / 2 + (rng() - 0.5) * 4,
        x + Math.cos(a) * len,
        y + Math.sin(a) * len
      );
      g.stroke();
    }
  });

  // Cartoon desk: two wooden planks with wavy grain lines and the odd knot.
  const WOOD_W = 960;
  const wood = tile(WOOD_W, 360, (g, rng) => {
    const plank = 120;
    for (let p = 0; p < 3; p++) {
      const y0 = p * plank;
      g.fillStyle = ['#e9d3ab', '#e5cda3', '#e8d1a8'][p];
      g.fillRect(0, y0, WOOD_W, plank);
      g.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const y = y0 + 10 + i * 15 + rng() * 6;
        g.strokeStyle = `rgba(150,100,50,${0.08 + rng() * 0.08})`;
        g.lineWidth = 1.1 + rng() * 1.2;
        g.beginPath();
        g.moveTo(-10, y);
        for (let x = 0; x <= WOOD_W + 10; x += 80) {
          g.quadraticCurveTo(x + 40, y + (rng() - 0.5) * 8, x + 80, y + (rng() - 0.5) * 3);
        }
        g.stroke();
      }
      // One knot, on two of the three planks, at scattered spots.
      if (p !== 1) {
        const kx = 120 + rng() * (WOOD_W - 240) + p * 180;
        const ky = y0 + 40 + rng() * 40;
        g.strokeStyle = 'rgba(140,90,45,0.2)';
        g.lineWidth = 2;
        for (let r = 0; r < 3; r++) {
          g.beginPath();
          g.ellipse(kx % WOOD_W, ky, 8 + r * 7, 3 + r * 3, 0, 0, Math.PI * 2);
          g.stroke();
        }
      }
      // Plank seam: dark groove with a light edge under it, and a few nail heads.
      g.fillStyle = 'rgba(110,70,35,0.32)';
      g.fillRect(0, y0 + plank - 3, WOOD_W, 2);
      g.fillStyle = 'rgba(255,245,225,0.5)';
      g.fillRect(0, y0 + plank - 1, WOOD_W, 1);
      // Short end-joints so planks read as boards, not stripes.
      const joint = 200 + rng() * (WOOD_W - 400);
      g.fillStyle = 'rgba(110,70,35,0.28)';
      g.fillRect(joint, y0, 2, plank - 3);
    }
  });

  // Halftone corner: a dot screen whose dots shrink away from the corner, like cheap
  // newspaper printing. `cornerX`/`cornerY` (0 or 1) pick which corner the dots grow from.
  const halftone = (cornerX, cornerY) =>
    tile(340 + cornerX, 340 + cornerY, (g) => {
      const size = 340;
      const step = 7;
      g.fillStyle = 'rgba(43,42,51,0.13)';
      for (let y = step / 2; y < size; y += step) {
        for (let x = step / 2; x < size; x += step) {
          const d = Math.hypot(cornerX * size - x, cornerY * size - y) / size;
          const r = 2.3 * (1 - d * 1.15);
          if (r <= 0.25) continue;
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
        }
      }
    });

  document.documentElement.style.setProperty('--paper-grain', grain);
  document.documentElement.style.setProperty('--halftone-tr', halftone(1, 0));
  document.documentElement.style.setProperty('--halftone-bl', halftone(0, 1));
  document.documentElement.style.setProperty('--desk-wood', wood);

  // Stand-in "body text": rounded grey bars, justified, with short last lines and
  // indents at paragraph breaks. One SVG tile per column width, repeated downward.
  const LINE_STEP = 11;
  function textLines(width, seed) {
    const rng = CC.makeRng(seed);
    const rows = [];
    const count = 24;
    let untilBreak = 3 + Math.floor(rng() * 5);
    let indent = 0;
    for (let i = 0; i < count; i++) {
      let frac = 0.94 + rng() * 0.06;
      let next = 0;
      if (untilBreak-- <= 0) {
        frac = 0.3 + rng() * 0.35;
        untilBreak = 4 + Math.floor(rng() * 5);
        next = 12;
      }
      const w = Math.max(12, (width - indent) * frac);
      rows.push(`<rect x="${indent}" y="${i * LINE_STEP + 3}" width="${w.toFixed(1)}" height="4.5" rx="2.25"/>`);
      indent = next;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${count * LINE_STEP}"><g fill="${INK}" fill-opacity="0.2">${rows.join('')}</g></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  // ---- Copy ----

  const STORIES = [
    ['Local News', 'Words Go Missing in Grid; Residents Baffled'],
    ['Science', 'Experts Confirm the Letter E Is Simply Everywhere'],
    ['City Hall', 'Backwards Words Spark Heated Debate'],
    ['Business', 'Coffee Prices Hold Steady at One Cup'],
    ['People', 'Area Solver Finds Word, Celebrates Loudly'],
    ['Mystery', 'Letter Q Still Waiting on Its Missing U'],
    ['Supplies', 'Pencil Shortage Blamed on Keen Puzzlers'],
    ['Trends', 'Diagonals Called “Sneaky” by Local Panel'],
    ['Education', 'Dictionary Sales Soar Amid Puzzle Craze'],
    ['Pets', 'Cat Naps on Newspaper, Halts All Progress'],
    ['Opinion', 'Why Every Grid Deserves a Second Look'],
    ['Sports', 'Speed Solver Sets Blistering New Pace'],
    ['Weather Desk', 'Heavy Vowel Showers Expected by Noon'],
    ['Arts', 'Critics Rave Over Beautifully Hidden Word'],
    ['Health', 'Doctors Recommend Two Puzzles a Day'],
    ['Travel', 'Tourists Flock to See World’s Longest Word'],
  ];
  const BYLINES = [
    'By Ann Agram',
    'By Al Phabet',
    'By Penny Pencil',
    'By Justin Case',
    'By Cross Wordsworth',
    'By Page Turner',
    'By Ink Blotts',
    'By Vera Bose',
    'By Syl Labell',
  ];
  const WEATHER = [
    ['sun', 'Sunny, with a 90% chance of words.'],
    ['cloud', 'Partly cloudy. Scattered vowels.'],
    ['rain', 'Light drizzle of consonants.'],
    ['sun', 'Clear skies. Perfect finding weather.'],
    ['cloud', 'Overcast, with sudden bursts of insight.'],
    ['rain', 'Showers of S’s and T’s by afternoon.'],
  ];
  const CLASSIFIEDS = [
    ['Wanted', 'Sharp eyes. Inquire at the grid.'],
    ['For sale', 'One gently used vowel. Best offer.'],
    ['Lost', 'The letter Q’s U. Reward if found.'],
    ['Seeking', 'Diagonal thinker for long walks.'],
    ['Free', 'Assorted consonants. You pick up.'],
    ['Help wanted', 'Proofreader. Must love dots.'],
    ['Found', 'One word, spelled backwards. Claim at desk.'],
    ['Swap', 'Two Z’s for one E. Serious offers only.'],
  ];
  const QUOTES = [
    ['I found it backwards. I’ll never read the same way again.', 'Area grandpa'],
    ['Four letters, hiding in plain sight. Classic.', 'Retired puzzle champion'],
    ['I only needed one coffee. Maybe two.', 'Local solver'],
    ['Diagonal words? In this economy?', 'Concerned reader'],
    ['My pencil is exhausted, and frankly so am I.', 'Weekend solver'],
    ['You don’t find the word. The word finds you.', 'Puzzle philosopher'],
  ];
  const ADS = [
    ['New!', 'Pencils', 'Sharp! Yellow! Pointy!', '2 for 1¢'],
    ['Sale', 'Erasers', 'Undo any mistake.', 'Only 3¢'],
    ['Hot!', 'Coffee', 'Fresh brewed daily.', '1 cup'],
    ['Wow', 'Magnifiers', 'See every letter!', 'Just 5¢'],
    ['New!', 'Reading Glasses', 'For the small print.', '10¢'],
  ];
  const PHOTOS = [
    ['magnifier', 'The investigation continues.'],
    ['bulb', 'Hints: brilliant, but use sparingly.'],
    ['trophy', 'Solver of the Week trophy, still up for grabs.'],
    ['coffee', 'Local fuel supply, fully stocked.'],
  ];

  // ---- Cartoon illustrations (thick ink outlines, flat fills) ----

  const stroke = `stroke="${INK}" stroke-linecap="round" stroke-linejoin="round"`;
  const ART = {
    magnifier: (() => {
      const letters = 'RATSPOEMLDIWNGE';
      let bg = '';
      for (let i = 0; i < 15; i++) {
        bg += `<text x="${14 + (i % 5) * 23}" y="${20 + Math.floor(i / 5) * 24}">${letters[i]}</text>`;
      }
      return `<svg viewBox="0 0 120 80">
        <g font-family="Abril Fatface, Georgia, serif" font-size="14" fill="${INK}" opacity="0.3" text-anchor="middle">${bg}</g>
        <line x1="85" y1="54" x2="106" y2="73" ${stroke} stroke-width="12"/>
        <line x1="85" y1="54" x2="106" y2="73" stroke="#ff6b5b" stroke-width="6" stroke-linecap="round"/>
        <circle cx="66" cy="37" r="24" fill="#fffaf0" fill-opacity="0.92" ${stroke} stroke-width="4"/>
        <text x="66" y="49" text-anchor="middle" font-family="Abril Fatface, Georgia, serif" font-size="32" fill="${INK}">W</text>
        <path d="M51 27 A17 17 0 0 1 64 19" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
      </svg>`;
    })(),
    bulb: `<svg viewBox="0 0 120 80">
        <g ${stroke} stroke-width="3">
          <path d="M60 3 V-1 M28 14 L24 10 M92 14 L96 10 M20 34 H14 M100 34 H106 M30 52 L25 56 M90 52 L95 56" transform="translate(0 2)"/>
        </g>
        <path d="M47 51 C40 45 38 39 38 33 A22 22 0 1 1 82 33 C82 39 80 45 73 51 L73 57 L47 57 Z" fill="#ffc145" ${stroke} stroke-width="3.5"/>
        <path d="M46 36 A15 15 0 0 1 52 20" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity="0.8"/>
        <circle cx="53" cy="34" r="2.8" fill="${INK}"/>
        <circle cx="67" cy="34" r="2.8" fill="${INK}"/>
        <path d="M53 41 Q60 47 67 41" fill="none" ${stroke} stroke-width="2.5"/>
        <circle cx="48" cy="40" r="3" fill="#ff6b5b" opacity="0.45"/>
        <circle cx="72" cy="40" r="3" fill="#ff6b5b" opacity="0.45"/>
        <rect x="47" y="57" width="26" height="12" rx="3" fill="#cfc9bc" ${stroke} stroke-width="3"/>
        <path d="M48 63 H72" ${stroke} stroke-width="2"/>
        <path d="M53 69 H67 L64 75 H56 Z" fill="${INK}"/>
      </svg>`,
    trophy: `<svg viewBox="0 0 120 80">
        <path d="M40 18 H29 A9 9 0 0 0 41 38" fill="none" ${stroke} stroke-width="3.5"/>
        <path d="M80 18 H91 A9 9 0 0 1 79 38" fill="none" ${stroke} stroke-width="3.5"/>
        <path d="M40 12 H80 V30 A20 20 0 0 1 40 30 Z" fill="#ffc145" ${stroke} stroke-width="3.5"/>
        <path d="M46 18 V29 A14 14 0 0 0 52 41" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.75"/>
        <path d="M60 20 L62.6 25.4 L68.5 26.2 L64.2 30.2 L65.3 36 L60 33.2 L54.7 36 L55.8 30.2 L51.5 26.2 L57.4 25.4 Z" fill="#fff" ${stroke} stroke-width="1.5"/>
        <rect x="55" y="49" width="10" height="10" fill="#ffc145" ${stroke} stroke-width="3"/>
        <rect x="43" y="59" width="34" height="11" rx="2.5" fill="#1fa3a3" ${stroke} stroke-width="3"/>
        <path d="M22 16 L23.5 20.5 L28 22 L23.5 23.5 L22 28 L20.5 23.5 L16 22 L20.5 20.5 Z M98 44 L99.2 47.8 L103 49 L99.2 50.2 L98 54 L96.8 50.2 L93 49 L96.8 47.8 Z" fill="${INK}"/>
      </svg>`,
    coffee: `<svg viewBox="-8 -6 80 72">
        <g fill="none" stroke="#b9a58c" stroke-width="3" stroke-linecap="round">
          <path d="M24 17 C21 12 27 9 24 3"/><path d="M31 16 C28 11 34 7 31 0"/><path d="M38 17 C35 12 41 9 38 3"/>
        </g>
        <use href="#coffee-cup"/>
      </svg>`,
  };

  const WEATHER_ART = {
    sun: `<svg viewBox="0 0 48 40"><g ${stroke} stroke-width="2.5"><path d="M24 3 V7 M24 33 V37 M7 20 H11 M37 20 H41 M12 8 L15 11 M36 8 L33 11 M12 32 L15 29 M36 32 L33 29"/></g><circle cx="24" cy="20" r="9" fill="#ffc145" ${stroke} stroke-width="2.5"/></svg>`,
    cloud: `<svg viewBox="0 0 48 40"><g ${stroke} stroke-width="2.3"><path d="M13 4 V7 M3 14 H6 M5 6 L7.5 8.5 M21 6 L18.5 8.5"/></g><circle cx="13" cy="15" r="6.5" fill="#ffc145" ${stroke} stroke-width="2.3"/><path d="M15 34 H38 A7 7 0 0 0 38 20 A10 10 0 0 0 19 18 A8 8 0 0 0 15 34 Z" fill="#fff" ${stroke} stroke-width="2.5"/></svg>`,
    rain: `<svg viewBox="0 0 48 40"><path d="M11 25 H36 A7 7 0 0 0 36 11 A10 10 0 0 0 17 9 A8 8 0 0 0 11 25 Z" fill="#fff" ${stroke} stroke-width="2.5"/><g stroke="#1fa3a3" stroke-width="3" stroke-linecap="round"><path d="M16 30 L14 36 M25 30 L23 36 M34 30 L32 36"/></g></svg>`,
  };

  // ---- Column building ----

  let level = 1;
  let lastKey = '';
  let found = 0;
  let total = 0;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function pickN(list, n, r) {
    return r.shuffle(list.slice()).slice(0, n);
  }

  function breakingText() {
    if (!total) return '';
    if (found === 0) return `Hunt Begins for ${total} Hidden Words`;
    if (found >= total) return 'All Words Found! Solver Hailed as Hero';
    if (total - found === 1) return 'One Word Left! Tension Mounts';
    if (found === Math.ceil(total / 2)) return `Halfway There: ${found} of ${total} Found`;
    return `${found} of ${total} Words Found So Far`;
  }

  function block(className, html, priority) {
    const el = CC.el('div', className);
    el.innerHTML = html;
    if (priority != null) el.dataset.drop = priority; // lower numbers are dropped first
    return el;
  }

  // A run of stand-in body text, `lines` lines tall.
  function textBlock(width, seed, lines, dropcap) {
    const el = CC.el('div', 'np-text');
    el.style.backgroundImage = textLines(Math.max(40, Math.floor(width)), seed);
    el.style.height = lines * LINE_STEP + 'px';
    if (dropcap) el.appendChild(CC.el('span', 'np-dropcap', dropcap));
    return el;
  }

  function quoteBlock(r, priority) {
    const [quote, who] = r.pick(QUOTES);
    return block('np-quote', `<p>${esc(quote)}</p><span>— ${esc(who)}</span>`, priority);
  }

  function adBlock(r, priority) {
    const [badge, name, pitch, price] = r.pick(ADS);
    return block(
      'np-ad',
      `<span class="np-ad-badge">${esc(badge)}</span><span class="np-ad-name">${esc(name)}</span>` +
        `<span class="np-ad-pitch">${esc(pitch)}</span><span class="np-ad-price">${esc(price)}</span>`,
      priority
    );
  }

  function briefBlock(pick, width, seed) {
    const el = block('np-brief', `<span class="np-kicker">In Brief · ${esc(pick[0])}</span><h4 class="np-headline small">${esc(pick[1])}</h4>`);
    el.appendChild(textBlock(width, seed, 4));
    return el;
  }

  function story(r, pick) {
    const [kicker, headline] = pick;
    return `<span class="np-kicker">${esc(kicker)}</span>
      <h4 class="np-headline">${esc(headline)}</h4>
      <span class="np-byline">${esc(r.pick(BYLINES))}</span>`;
  }

  function breakingBlock() {
    return block('np-breaking', `<span class="np-tag">Breaking</span><span class="np-breaking-text">${esc(breakingText())}</span>`);
  }

  function weatherBlock(r, priority) {
    const [kind, text] = r.pick(WEATHER);
    return block(
      'np-weather',
      `${WEATHER_ART[kind]}<div><span class="np-label">Weather</span><span class="np-desc">${esc(text)}</span></div>`,
      priority
    );
  }

  function fillColumn(col, side, width) {
    const r = CC.makeRng(level * 131 + (side === 'left' ? 7 : 19));
    const stories = pickN(STORIES, STORIES.length, CC.makeRng(level * 977 + 3));
    const inner = width - 16; // minus padding and column rule
    col.textContent = '';
    col.classList.toggle('slim', width < 140);
    col.classList.toggle('narrow', width < 190);
    col.classList.toggle('wide', width >= 250);

    // The last block in each column stays last; briefs are slotted in above it.
    let closer;
    if (side === 'left') {
      col.appendChild(block('np-story', story(r, stories[0])));
      col.appendChild(textBlock(inner, level * 11 + 1, 7, stories[0][1][0]));
      const [art, caption] = r.pick(PHOTOS);
      col.appendChild(
        block('np-photo', `<div class="np-frame">${ART[art]}</div><span class="np-caption">Pictured: ${esc(caption)}</span>`, 3)
      );
      col.appendChild(textBlock(inner, level * 11 + 2, 6));
      col.appendChild(quoteBlock(r, 1));
      closer = block('np-cont', `Continued on A${(level % 9) + 2}`, 2);
    } else {
      col.appendChild(breakingBlock());
      col.appendChild(weatherBlock(r, 4));
      col.appendChild(block('np-story', story(r, stories[1]), 3));
      col.appendChild(textBlock(inner, level * 11 + 3, 6));
      col.appendChild(adBlock(r, 1));
      const ads = pickN(CLASSIFIEDS, 2, r)
        .map(([k, v]) => `<p><b>${esc(k)}:</b> ${esc(v)}</p>`)
        .join('');
      closer = block('np-classifieds', `<span class="np-classifieds-head">Classifieds</span>${ads}`, 2);
    }
    col.appendChild(closer);
    fit(col);

    // Tall column: add short news briefs until it's nearly full.
    let next = side === 'left' ? 2 : 3;
    while (spare(col) > 150 && next < stories.length) {
      col.insertBefore(briefBlock(stories[next], inner, level * 17 + next), closer.isConnected ? closer : null);
      next += 2;
    }
    // Whatever small gap is left, the last text run absorbs.
    const texts = col.querySelectorAll('.np-text');
    const last = texts[texts.length - 1];
    if (last && spare(col) > 0) last.style.height = last.offsetHeight + Math.floor(spare(col) / LINE_STEP) * LINE_STEP + 'px';
    fit(col);
  }

  // Free height left at the bottom of a column.
  function spare(col) {
    const last = col.lastElementChild;
    if (!last) return col.clientHeight;
    return col.clientHeight - (last.offsetTop + last.offsetHeight);
  }

  // Drop optional blocks (lowest priority first), then shorten text, until the column fits.
  function fit(col) {
    const optional = Array.from(col.querySelectorAll('[data-drop]')).sort((a, b) => a.dataset.drop - b.dataset.drop);
    while (col.scrollHeight > col.clientHeight + 1 && optional.length) optional.shift().remove();
    const texts = Array.from(col.querySelectorAll('.np-text')).reverse();
    for (const t of texts) {
      while (col.scrollHeight > col.clientHeight + 1 && t.offsetHeight > 3 * LINE_STEP) {
        t.style.height = t.offsetHeight - LINE_STEP + 'px';
      }
    }
    // Not even room for a few lines of text: the column isn't worth showing.
    if (col.scrollHeight > col.clientHeight + 1) col.hidden = true;
  }

  function fillStrip(width) {
    const r = CC.makeRng(level * 53 + 5);
    strip.textContent = '';
    strip.appendChild(breakingBlock());
    if (width >= 340) strip.appendChild(weatherBlock(r));
  }

  // ---- Placement around the printed puzzle ----

  const EDGE = 16; // gap between the paper's edge and a column
  const GUTTER = 20; // gap between a column and the puzzle
  const MIN_COL = 86;
  const MAX_COL = 300;
  const CUP_ROOM = 110; // the coffee cup's corner, bottom left
  const PENCIL_ROOM = 70;

  function place(el, x, y, w, h) {
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    el.style.width = Math.round(w) + 'px';
    el.style.height = Math.round(h) + 'px';
  }

  function layout() {
    const areaW = area.clientWidth;
    const areaH = area.clientHeight;
    if (!areaW || !areaH) return;
    // Layout offsets (not bounding boxes) so the spin-in animation doesn't skew them.
    const px = wrap.offsetLeft + panel.offsetLeft - wrap.scrollLeft;
    const py = wrap.offsetTop + panel.offsetTop - wrap.scrollTop;
    const pw = panel.offsetWidth; // its 5px hard shadow sits inside the gutter
    const ph = panel.offsetHeight + 5;
    const top = masthead.offsetTop + masthead.offsetHeight + 14;

    const leftSpace = px - EDGE - GUTTER;
    const rightSpace = areaW - (px + pw) - EDGE - GUTTER;
    const leftH = areaH - CUP_ROOM - top;
    const rightH = areaH - EDGE - PENCIL_ROOM - top;
    const showLeft = leftSpace >= MIN_COL && leftH >= 170;
    const showRight = rightSpace >= MIN_COL && rightH >= 170;

    const key = [level, areaW, areaH, px, py, pw, ph].join(',');
    if (key === lastKey) return;
    lastKey = key;

    colLeft.hidden = !showLeft;
    if (showLeft) {
      const w = Math.min(leftSpace, MAX_COL);
      place(colLeft, EDGE + (leftSpace - w) / 2, top, w, leftH);
      fillColumn(colLeft, 'left', w);
    }
    colRight.hidden = !showRight;
    // The pencil needs a roomy column to lie across; an SVG element, so no .hidden property.
    pencil.toggleAttribute('hidden', !(showRight && Math.min(rightSpace, MAX_COL) >= 150));
    if (showRight) {
      const w = Math.min(rightSpace, MAX_COL);
      const x = px + pw + GUTTER + (rightSpace - w) / 2;
      place(colRight, x, top, w, rightH);
      fillColumn(colRight, 'right', w);
      pencil.style.left = Math.round(x + w / 2 - 80) + 'px';
      pencil.style.top = Math.round(areaH - PENCIL_ROOM + 8) + 'px';
    }

    // Narrow screens: a strip under the puzzle, beside the coffee cup.
    const stripY = py + ph + 12;
    const stripX = CUP_ROOM;
    const stripW = areaW - stripX - 44;
    const stripH = areaH - EDGE - stripY;
    const showStrip = !showLeft && !showRight && stripW >= 160 && stripH >= 58;
    strip.hidden = !showStrip;
    if (showStrip) {
      place(strip, stripX, stripY, stripW, Math.min(stripH, 120));
      fillStrip(stripW);
    }
  }

  function formatDate(d) {
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  CC.Newspaper = {
    // A fresh edition for a level: new dateline and stories, and the paper spins in.
    newIssue(levelNumber, wordTotal) {
      level = levelNumber;
      total = wordTotal;
      found = 0;
      lastKey = '';
      document.getElementById('paper-date').textContent = formatDate(new Date());
      document.getElementById('paper-edition').textContent = `Level ${levelNumber} Edition`;
      document.getElementById('paper-vol').textContent = `No. ${levelNumber}`;
      panel.dataset.label = `Word Search · No. ${levelNumber}`;
      area.classList.remove('spin-in');
      coffeeBtn.classList.remove('drop-in');
      void area.offsetWidth;
      area.classList.add('spin-in');
      coffeeBtn.classList.add('drop-in');
    },

    layout,

    // Live progress for the BREAKING box.
    progress(foundCount, wordTotal) {
      const changed = foundCount !== found;
      found = foundCount;
      total = wordTotal;
      CC.$$('.np-breaking-text', area).forEach((el) => {
        el.textContent = breakingText();
        if (!changed) return;
        const box = el.parentElement;
        box.classList.remove('flash');
        void box.offsetWidth;
        box.classList.add('flash');
      });
    },
  };

  // Once the paper has landed, drop the animation so it stops holding its own layer.
  area.addEventListener('animationend', (e) => {
    if (e.target === area && e.animationName === 'paper-spin') area.classList.remove('spin-in');
  });
  coffeeBtn.addEventListener('animationend', (e) => {
    if (e.animationName === 'cup-drop') coffeeBtn.classList.remove('drop-in');
  });

  // Headline fonts arriving late change text heights, so refit once they're in.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      lastKey = '';
      layout();
    });
  }
})();
