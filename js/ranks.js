/* Coffee ranks: the player's progression title, earned by completing numbered levels.
   All rank data lives in RANKS below; everything else asks CC.Ranks. To add a rank,
   fill in its entry (`ready: true`, `levels`, `description`, `badge`, `color`,
   `accent`, and optionally `trim`, `tier`, `mascot` and `milestone`) and add its artwork to BADGES / MASCOT_EXTRAS. */
(function () {
  'use strict';

  const CC = window.CC;
  const Save = CC.Save;

  // Badge artwork: each rank's cup, drawn on a 64x64 canvas.
  const BADGES = {
    // A plain white diner mug of everyday coffee, with a curl of steam.
    houseBlend: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M26 15 C23 11 29 8 26 3" fill="none" stroke="#b9a58c" stroke-width="3" stroke-linecap="round"/>
      <path d="M35 16 C32 12 38 9 35 4" fill="none" stroke="#b9a58c" stroke-width="3" stroke-linecap="round"/>
      <path d="M46 29 C57 28 57 45 44 44" fill="none" stroke="#2b2a33" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M46 29 C54 29 54 42 44 42" fill="none" stroke="#fffaf1" stroke-width="3" stroke-linecap="round"/>
      <path d="M14 22 H48 V46 A8 8 0 0 1 40 54 H22 A8 8 0 0 1 14 46 Z" fill="#fffaf1" stroke="#2b2a33" stroke-width="3" stroke-linejoin="round"/>
      <path d="M14 30 H48" stroke="#ff6b5b" stroke-width="3"/>
      <ellipse cx="31" cy="22" rx="17" ry="4.5" fill="#6b3f1f" stroke="#2b2a33" stroke-width="3"/>
      <ellipse cx="28" cy="21.3" rx="6" ry="1.4" fill="#9a6036"/>
      <path d="M19 36 V46" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity="0.9"/>
    </svg>`,

    // French Roast: a darker, bolder mug in roasted brown with a gold rim, near-black
    // coffee and heavier steam. One step fancier than the diner mug.
    frenchRoast: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M24 15 C20 10 28 7 24 1" fill="none" stroke="#8a7560" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M32 15 C28 10 36 7 32 1" fill="none" stroke="#8a7560" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M40 15 C36 10 44 7 40 1" fill="none" stroke="#8a7560" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M46 29 C57 28 57 45 44 44" fill="none" stroke="#2b2a33" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M46 29 C54 29 54 42 44 42" fill="none" stroke="#5a3320" stroke-width="3" stroke-linecap="round"/>
      <path d="M14 22 H48 V46 A8 8 0 0 1 40 54 H22 A8 8 0 0 1 14 46 Z" fill="#5a3320" stroke="#2b2a33" stroke-width="3" stroke-linejoin="round"/>
      <path d="M14 31 H48" stroke="#e0b44c" stroke-width="3"/>
      <path d="M14 35.5 H48" stroke="#e0b44c" stroke-width="1.4"/>
      <ellipse cx="31" cy="22" rx="17" ry="4.5" fill="#24140b" stroke="#e0b44c" stroke-width="3"/>
      <ellipse cx="28" cy="21.3" rx="6" ry="1.4" fill="#4a2a17"/>
      <path d="M19 40 V47" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity="0.45"/>
    </svg>`,

    // Espresso: a small demitasse on a saucer with a golden crema top and speed streaks
    // off the left side. Compact, sharp and quick.
    espresso: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M3 30 H11 M1 37 H10 M4 44 H11" stroke="#2b2a33" stroke-width="3" stroke-linecap="round"/>
      <path d="M31 19 C28 15 34 12 31 7" fill="none" stroke="#8a7560" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M44 30 C53 29 53 42 42 41" fill="none" stroke="#2b2a33" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M44 30 C50 30 50 39 42 39" fill="none" stroke="#fffaf1" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="31" cy="52" rx="23" ry="5" fill="#fffaf1" stroke="#2b2a33" stroke-width="3"/>
      <path d="M17 25 H45 V40 A9 9 0 0 1 36 49 H26 A9 9 0 0 1 17 40 Z" fill="#fffaf1" stroke="#2b2a33" stroke-width="3" stroke-linejoin="round"/>
      <path d="M17 31 H45" stroke="#1f130c" stroke-width="3"/>
      <ellipse cx="31" cy="25" rx="14" ry="4" fill="#d8a35a" stroke="#2b2a33" stroke-width="3"/>
      <path d="M24 24.6 C28 23.4 33 26.4 38 24.4" fill="none" stroke="#f3d39a" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M21 35 V41" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.9"/>
    </svg>`,

    // Cappuccino: a wide cup of milky coffee with a latte-art heart (like the mascot's) and a dusting of
    // cocoa, set on a saucer beside a folded copy of the morning paper.
    cappuccino: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <g transform="rotate(-8 50 36)">
        <path d="M40 17 H60 V51 H40 Z" fill="#fffaf1" stroke="#2b2a33" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M43 21.5 H57" stroke="#2b2a33" stroke-width="2.6"/>
        <path d="M43 26 H57 M43 29.5 H57" stroke="#9c9489" stroke-width="1.4"/>
      </g>
      <ellipse cx="29" cy="53" rx="25" ry="5.5" fill="#fffaf1" stroke="#2b2a33" stroke-width="3"/>
      <path d="M48 32 C58 31 58 45 46 44" fill="none" stroke="#2b2a33" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M48 32 C55 32 55 42 46 42" fill="none" stroke="#fffaf1" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M8 27 H50 L47 42 A9 9 0 0 1 38 50 H20 A9 9 0 0 1 11 42 Z" fill="#fffaf1" stroke="#2b2a33" stroke-width="3" stroke-linejoin="round"/>
      <path d="M9.5 33 H48.8" stroke="#b07a4f" stroke-width="2.6"/>
      <ellipse cx="29" cy="27" rx="21" ry="5.5" fill="#f1dfc4" stroke="#2b2a33" stroke-width="3"/>
      <ellipse cx="29" cy="27" rx="16" ry="3.8" fill="#b98755"/>
      <path d="M29 30 C23 27.6 21.5 24.6 24.6 24.2 C26.8 24 28.4 25.2 29 26.2 C29.6 25.2 31.2 24 33.4 24.2 C36.5 24.6 35 27.6 29 30 Z" fill="#fbf3e6"/>
      <circle cx="14" cy="25.5" r="0.9" fill="#7a4a28"/><circle cx="43" cy="26" r="0.9" fill="#7a4a28"/><circle cx="41" cy="29" r="0.8" fill="#7a4a28"/>
      <path d="M14 36 V42" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.9"/>
    </svg>`,

    // Café Mocha: a tall glass mug of chocolatey coffee under a swirl of whipped cream,
    // drizzled with chocolate and topped with shavings. The richest cup so far.
    cafeMocha: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M46 30 C57 29 57 46 44 45" fill="none" stroke="#2b2a33" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M46 30 C54 30 54 43 44 43" fill="none" stroke="#fffaf1" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M16 24 H47 L44 53 A5 5 0 0 1 39 57 H24 A5 5 0 0 1 19 53 Z" fill="#fffaf1" stroke="#2b2a33" stroke-width="3" stroke-linejoin="round"/>
      <path d="M17.6 34 H45.4 L44 53 A4 4 0 0 1 39.5 55 H23.5 A4 4 0 0 1 19 53 Z" fill="#4a2618"/>
      <path d="M17.2 30 H45.8 L45.4 34 H17.6 Z" fill="#d9b48a"/>
      <path d="M24 44 C27 46 33 42 39 45" fill="none" stroke="#7a4a28" stroke-width="2" stroke-linecap="round"/>
      <path d="M21 36 V50" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>
      <path d="M14 25 C12 18 20 15 23 17 C23 10 33 8 36 13 C40 9 50 12 48 19 C53 20 52 26 48 26 H16 C13 26 12 25 14 25 Z" fill="#fffaf1" stroke="#2b2a33" stroke-width="3" stroke-linejoin="round"/>
      <path d="M22 21 C26 18 30 23 34 19 C37 16 41 20 44 18" fill="none" stroke="#4a2618" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M34 11 L36 7 M31 12 L30 8 M38 13 L41 10" stroke="#4a2618" stroke-width="2.2" stroke-linecap="round"/>
    </svg>`,

    // Vienna Roast: a gold-rimmed porcelain cup on a silver tray with a glass of water,
    // the way Vienna's coffee houses serve it, beside a newspaper on a wooden holder.
    viennaRoast: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M44 6 V36" stroke="#8a5a3b" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M44 8 H60 V30 H44 Z" fill="#fffaf1" stroke="#2b2a33" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M47 12.5 H57" stroke="#2b2a33" stroke-width="2.4"/>
      <path d="M47 17 H57 M47 20.5 H57 M47 24 H54" stroke="#9c9489" stroke-width="1.3"/>
      <path d="M4 50 H56 L53 55 H7 Z" fill="#dfe2e6" stroke="#2b2a33" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M44 34 H53 L52 49 H45 Z" fill="#e8f3f6" stroke="#2b2a33" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M45.4 40 H51.6" stroke="#9fc9d6" stroke-width="2"/>
      <ellipse cx="23" cy="48" rx="16" ry="3.6" fill="#fffaf1" stroke="#2b2a33" stroke-width="2.6"/>
      <path d="M35 30 C43 29 43 41 33 40" fill="none" stroke="#2b2a33" stroke-width="3" stroke-linecap="round"/>
      <path d="M35 30 C40 30 40 38 33 38" fill="none" stroke="#fffaf1" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M9 26 H37 L35 38 A8 8 0 0 1 27 45 H19 A8 8 0 0 1 11 38 Z" fill="#fffaf1" stroke="#2b2a33" stroke-width="3" stroke-linejoin="round"/>
      <path d="M10.5 31 H35.7" stroke="#e0b44c" stroke-width="2"/>
      <path d="M14 35 C17 37 20 33 23 35 C26 37 29 33 32 35" fill="none" stroke="#6b1f2a" stroke-width="1.4" stroke-linecap="round"/>
      <ellipse cx="23" cy="26" rx="14" ry="3.6" fill="#3a1f12" stroke="#e0b44c" stroke-width="2.6"/>
      <ellipse cx="20" cy="25.5" rx="4.5" ry="1" fill="#6b3f1f"/>
      <path d="M21 20 C18 16 24 13 21 9" fill="none" stroke="#8a7560" stroke-width="2.6" stroke-linecap="round"/>
    </svg>`,

    // Kona Reserve: a black cup with gold bands on a gold saucer, beside a sprig of ripe
    // coffee cherries from Kona's volcanic slopes, over a "Reserve" ribbon.
    konaReserve: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M4 30 C6 22 10 17 15 14" fill="none" stroke="#3f6b3a" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M8 20 C3 19 2 14 5 12 C8 14 9 17 8 20 Z" fill="#5f8f4e" stroke="#2b2a33" stroke-width="1.4"/>
      <path d="M13 15 C12 10 16 7 19 8 C19 12 16 15 13 15 Z" fill="#5f8f4e" stroke="#2b2a33" stroke-width="1.4"/>
      <circle cx="6" cy="27" r="2.6" fill="#c8323b" stroke="#2b2a33" stroke-width="1.3"/>
      <circle cx="10" cy="25" r="2.6" fill="#e0474f" stroke="#2b2a33" stroke-width="1.3"/>
      <circle cx="8.5" cy="30.5" r="2.4" fill="#a8252e" stroke="#2b2a33" stroke-width="1.3"/>
      <ellipse cx="34" cy="46" rx="21" ry="4.6" fill="#e0b44c" stroke="#2b2a33" stroke-width="2.8"/>
      <path d="M48 24 C58 23 58 38 46 37" fill="none" stroke="#2b2a33" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M48 24 C55 24 55 35 46 35" fill="none" stroke="#e0b44c" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M18 19 H50 L48 34 A9 9 0 0 1 39 43 H29 A9 9 0 0 1 20 34 Z" fill="#1f1d24" stroke="#2b2a33" stroke-width="3" stroke-linejoin="round"/>
      <path d="M19.3 25 H49.2" stroke="#e0b44c" stroke-width="2.4"/>
      <path d="M19.8 28.5 H48.7" stroke="#e0b44c" stroke-width="1"/>
      <path d="M24 31 V37" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.35"/>
      <ellipse cx="34" cy="19" rx="16" ry="4" fill="#3a1f12" stroke="#e0b44c" stroke-width="2.6"/>
      <path d="M30 13 C27 9 33 7 30 3 M38 13 C35 9 41 7 38 3" fill="none" stroke="#8a7560" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M4 50 L10 51 L8 55 L12 60 L3 58 Z M60 50 L54 51 L56 55 L52 60 L61 58 Z" fill="#8a1f2a" stroke="#2b2a33" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M9 50 C20 54 44 54 55 50 L56 58 C44 62 20 62 8 58 Z" fill="#b8323d" stroke="#2b2a33" stroke-width="2" stroke-linejoin="round"/>
      <text x="32" y="58.6" text-anchor="middle" font-family="Georgia, serif" font-size="6" font-weight="700" letter-spacing="0.9" fill="#fff1bf">RESERVE</text>
    </svg>`,

    // Geisha Reserve: a slender glass pour-over carafe with a wooden collar and leather
    // tie, brewed coffee glowing in the bottom, and a sprig of jasmine (Panama's Geisha
    // coffee is famous for its jasmine notes), under a small gold star.
    geishaReserve: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M22 5 H42 L34 24 L35 26 L46 50 A6 6 0 0 1 41 58 H23 A6 6 0 0 1 18 50 L29 26 L30 24 Z" fill="#eef6f8" stroke="#2b2a33" stroke-width="3" stroke-linejoin="round"/>
      <path d="M22 44 H42 L46 50 A6 6 0 0 1 41 56 H23 A6 6 0 0 1 18 50 Z" fill="#6b3a1f"/>
      <path d="M21.5 44 H42.5" stroke="#9a5a2e" stroke-width="1.6"/>
      <path d="M27 20 L37 20 L34.6 27 H29.4 Z" fill="#b9854f" stroke="#2b2a33" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M29.4 23.5 H34.6" stroke="#7a4a28" stroke-width="1.6"/>
      <path d="M37 22 C41 22 42 26 40 29" fill="none" stroke="#2b2a33" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="40" cy="30" r="1.8" fill="#6b3a1f" stroke="#2b2a33" stroke-width="1.2"/>
      <path d="M25 10 L27 16" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
      <path d="M23 32 L21 37" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
      <path d="M50 58 C51 50 53 44 57 40" fill="none" stroke="#3f6b3a" stroke-width="2" stroke-linecap="round"/>
      <path d="M52 49 C56 49 58 46 57 43 C54 44 52 46 52 49 Z" fill="#5f8f4e" stroke="#2b2a33" stroke-width="1.2"/>
      <g fill="#fffdf6" stroke="#2b2a33" stroke-width="1.2">
        <path d="M57 36 l1.6 -3 l1.6 3 l3 1.2 l-3 1.4 l-1.6 3 l-1.6 -3 l-3 -1.4 Z"/>
        <path d="M49 44 l1.2 -2.3 l1.2 2.3 l2.3 0.9 l-2.3 1.1 l-1.2 2.3 l-1.2 -2.3 l-2.3 -1.1 Z"/>
      </g>
      <circle cx="58.6" cy="37.3" r="1" fill="#e0b44c"/>
      <circle cx="50.2" cy="44.9" r="0.8" fill="#e0b44c"/>
      <path d="M10 8 l1.4 3.6 l3.8 0.2 l-3 2.4 l1 3.7 l-3.2 -2.1 l-3.2 2.1 l1 -3.7 l-3 -2.4 l3.8 -0.2 Z" fill="#e0b44c" stroke="#2b2a33" stroke-width="1.3" stroke-linejoin="round"/>
    </svg>`,
  };

  // Small extras worn by the menu mascot. A rank lists the extras it wears in `mascot`;
  // each is SVG content on the mascot picture's own 512x512 canvas, so it lines up with
  // the cup and bobs and hops along with it.
  const MASCOT_EXTRAS = {
    // A black beret tipped over the cup's left rim, leaving the heart and steam visible.
    beret: `
      <g transform="rotate(-14 170 160)">
        <ellipse cx="178" cy="174" rx="64" ry="13" fill="#1e1b22"/>
        <path d="M68 150 C66 118 132 102 184 104 C246 106 284 126 276 150 C268 172 212 180 170 178 C120 176 70 172 68 150 Z" fill="#2b2a33" stroke="#1e1b22" stroke-width="6" stroke-linejoin="round"/>
        <path d="M98 132 C124 118 156 114 188 115" fill="none" stroke="#5b5866" stroke-width="7" stroke-linecap="round"/>
        <path d="M180 106 C178 94 184 86 193 85" fill="none" stroke="#2b2a33" stroke-width="9" stroke-linecap="round"/>
      </g>`,

    // A gold coffee-bean pin on the front of the beret.
    beanPin: `
      <g transform="rotate(-14 170 160) rotate(-30 118 150)">
        <ellipse cx="118" cy="150" rx="15" ry="21" fill="#e0b44c" stroke="#1e1b22" stroke-width="5"/>
        <path d="M118 131 C109 142 127 158 118 169" fill="none" stroke="#1e1b22" stroke-width="4.5" stroke-linecap="round"/>
        <ellipse cx="112" cy="141" rx="3.5" ry="6" fill="#fff4cf" opacity="0.9"/>
      </g>`,

    // A folded morning paper propped against the saucer on the right.
    paper: `
      <g transform="translate(-22 -14) rotate(10 430 400)">
        <path d="M384 334 H474 V458 H384 Z" fill="#f4ecdc" stroke="#2b2a33" stroke-width="7" stroke-linejoin="round"/>
        <path d="M384 334 L396 322 H486 V446 L474 458" fill="#e6dcc8" stroke="#2b2a33" stroke-width="7" stroke-linejoin="round"/>
        <path d="M396 356 H462" stroke="#2b2a33" stroke-width="9" stroke-linecap="round"/>
        <path d="M394 372 H464" stroke="#2b2a33" stroke-width="3"/>
        <rect x="396" y="384" width="28" height="26" fill="#c9bda8" stroke="#2b2a33" stroke-width="3"/>
        <path d="M432 388 H462 M432 398 H462 M432 408 H462 M396 422 H462 M396 432 H462 M396 442 H448" stroke="#8e8577" stroke-width="4" stroke-linecap="round"/>
      </g>`,

    // A rolled chocolate wafer leaning out of the coffee on the right.
    wafer: `
      <g transform="rotate(32 350 150)">
        <rect x="334" y="58" width="32" height="150" rx="9" fill="#5a2e19" stroke="#2b2a33" stroke-width="6"/>
        <path d="M336 84 L364 72 M336 110 L364 98 M336 136 L364 124 M336 162 L364 150" stroke="#a8683c" stroke-width="6" stroke-linecap="round"/>
        <ellipse cx="350" cy="62" rx="13" ry="6" fill="#3a1d10" stroke="#2b2a33" stroke-width="4"/>
        <ellipse cx="350" cy="62" rx="6" ry="2.6" fill="#d9b48a"/>
      </g>`,

    // A gold monocle on a fine chain over the cup's right eye.
    monocle: `
      <path d="M338 330 C352 366 344 398 372 418 C388 430 398 424 404 412" fill="none" stroke="#c9962c" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="2 7"/>
      <circle cx="310" cy="306" r="34" fill="rgba(220, 238, 245, 0.28)" stroke="#2b2a33" stroke-width="10"/>
      <circle cx="310" cy="306" r="34" fill="none" stroke="#e0b44c" stroke-width="6"/>
      <path d="M288 290 C294 282 302 279 310 279" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.85"/>`,

    // Gilding: a thin gold line painted around the cup's rim.
    gildedRim: `
      <ellipse cx="243" cy="190" rx="171" ry="42" fill="none" stroke="#2b2a33" stroke-width="11" opacity="0.25"/>
      <ellipse cx="243" cy="190" rx="171" ry="42" fill="none" stroke="#e0b44c" stroke-width="7"/>
      <path d="M130 158 C170 150 210 148 246 148" fill="none" stroke="#fff4cf" stroke-width="3.5" stroke-linecap="round"/>`,

    // A sprig of white jasmine tucked into the beret, beside the bean pin.
    jasmine: `
      <g transform="rotate(-14 170 160)">
        <path d="M150 150 C164 132 184 124 206 124" fill="none" stroke="#3f6b3a" stroke-width="5" stroke-linecap="round"/>
        <path d="M176 130 C182 116 196 112 204 116 C198 128 188 132 176 130 Z" fill="#5f8f4e" stroke="#1e1b22" stroke-width="3"/>
        <g fill="#fffdf6" stroke="#1e1b22" stroke-width="3.5" stroke-linejoin="round">
          <path d="M210 104 l7 -14 l7 14 l14 5 l-14 6 l-7 14 l-7 -14 l-14 -6 Z"/>
          <path d="M160 124 l5 -10 l5 10 l10 4 l-10 4 l-5 10 l-5 -10 l-10 -4 Z"/>
        </g>
        <circle cx="217" cy="109" r="4" fill="#e0b44c"/>
        <circle cx="165" cy="128" r="3" fill="#e0b44c"/>
      </g>`,
  };

  // The full ladder. `levels` is how many numbered levels must be completed to reach
  // a rank. Ranks marked `ready: false` are planned but not in the game yet: they show
  // as locked and can't be earned until they're filled in.
  const RANKS = [
    {
      id: 'house-blend',
      number: 1,
      name: 'House Blend',
      description: 'Fresh off the press.',
      levels: 0,
      badge: 'houseBlend',
      color: '#c98a52',
      accent: '#e8b98a',
      mascot: [],
      ready: true,
    },
    {
      id: 'french-roast',
      number: 2,
      name: 'French Roast',
      description: 'Bold enough for the morning edition.',
      levels: 5,
      badge: 'frenchRoast',
      color: '#5a3320',
      accent: '#e0b44c',
      mascot: ['beret'],
      ready: true,
    },
    {
      id: 'espresso',
      number: 3,
      name: 'Espresso',
      description: 'Small cup. Serious solver.',
      levels: 10,
      badge: 'espresso',
      color: '#1f130c',
      accent: '#d8a35a',
      trim: '#e0b44c',
      mascot: ['beret', 'beanPin'],
      ready: true,
    },
    {
      id: 'cappuccino',
      number: 4,
      name: 'Cappuccino',
      description: 'A seasoned solver with good taste.',
      levels: 15,
      badge: 'cappuccino',
      color: '#8a5a3b',
      accent: '#f1dfc4',
      trim: '#e0b44c',
      mascot: ['beret', 'beanPin', 'paper'],
      ready: true,
    },
    {
      id: 'cafe-mocha',
      number: 5,
      name: 'Café Mocha',
      description: 'Halfway to becoming a legend.',
      levels: 20,
      badge: 'cafeMocha',
      color: '#4a2618',
      accent: '#d9b48a',
      trim: '#e0b44c',
      mascot: ['beret', 'beanPin', 'paper', 'wafer'],
      // A milestone rank gets the bigger rank-up: an "Extra!" headline, its motto, a
      // gold shimmer and a longer fanfare.
      milestone: 'Halfway there',
      ready: true,
    },
    {
      id: 'vienna-roast',
      number: 6,
      name: 'Vienna Roast',
      description: 'A refined puzzle solver.',
      levels: 25,
      badge: 'viennaRoast',
      color: '#6b1f2a',
      accent: '#f3e6c8',
      trim: '#e0b44c',
      mascot: ['beret', 'beanPin', 'paper', 'wafer', 'monocle'],
      ready: true,
    },
    {
      id: 'kona-reserve',
      number: 7,
      name: 'Kona Reserve',
      description: 'Premium puzzle-solving territory.',
      levels: 30,
      badge: 'konaReserve',
      color: '#1f1d24',
      accent: '#e0b44c',
      trim: '#fff1bf',
      // The reserve tier: gold-foil edging on the menu chip and the stats rank panel.
      tier: 'reserve',
      mascot: ['gildedRim', 'beret', 'beanPin', 'paper', 'wafer', 'monocle'],
      ready: true,
    },
    {
      id: 'geisha-reserve',
      number: 8,
      name: 'Geisha Reserve',
      description: 'Reserved for the truly dedicated.',
      levels: 35,
      badge: 'geishaReserve',
      color: '#0f4d3f',
      accent: '#e0b44c',
      trim: '#fff1bf',
      // The elite tier: the reserve gold foil plus a double gold rule, a ✦ rarity mark by
      // the rank name, and a soft gold glow around the menu mascot.
      tier: 'elite',
      milestone: 'Elite rank',
      mascot: ['gildedRim', 'beret', 'beanPin', 'jasmine', 'paper', 'wafer', 'monocle'],
      ready: true,
    },
    { id: 'black-label', number: 9, name: 'Black Label', ready: false },
    { id: 'daily-legend', number: 10, name: 'The Daily Legend', ready: false },
  ];

  // Numbered levels completed in a row from level 1 (the same count that unlocks levels).
  function levelsCompleted() {
    return Save.nextLevel() - 1;
  }

  // Climbs the ladder in order and stops at the first rank that isn't in the game yet or
  // isn't earned, so a rank can never be passed over.
  function rankFor(levels) {
    let current = RANKS[0];
    for (const r of RANKS.slice(1)) {
      if (!r.ready || levels < r.levels) break;
      current = r;
    }
    return current;
  }

  function badgeHtml(rank) {
    return BADGES[rank.badge] || BADGES.houseBlend;
  }

  // What the menu mascot wears at this rank, as one SVG ('' for nothing).
  function mascotHtml(rank) {
    const parts = (rank.mascot || []).map((k) => MASCOT_EXTRAS[k] || '').join('');
    return parts ? `<svg viewBox="0 0 512 512" aria-hidden="true">${parts}</svg>` : '';
  }

  // A rank's colors as CSS custom properties, for the badge ring and anything themed by rank.
  function colors(rank) {
    return {
      '--rank-color': rank.color,
      '--rank-accent': rank.accent || '#e8b98a',
      '--rank-trim': rank.trim || 'transparent',
    };
  }

  // Sets a rank's colors on an element.
  function paint(node, rank) {
    Object.entries(colors(rank)).forEach(([k, v]) => node.style.setProperty(k, v));
  }

  // The same colors as an inline `style` value, for HTML built as a string.
  function styleAttr(rank) {
    return Object.entries(colors(rank)).map(([k, v]) => `${k}:${v}`).join(';');
  }

  CC.Ranks = {
    all: RANKS,
    total: RANKS.length,
    badgeHtml,
    mascotHtml,
    paint,
    styleAttr,

    current() {
      return rankFor(levelsCompleted());
    },

    // The next rank up, and how far along the player is. `ready` is false while the
    // next rank hasn't been added to the game yet.
    progress() {
      const done = levelsCompleted();
      const cur = rankFor(done);
      const next = RANKS[cur.number] || null; // RANKS is ordered, number = index + 1
      if (!next) return { current: cur, next: null, fraction: 1, levelsToGo: 0 };
      if (!next.ready) return { current: cur, next, fraction: 0, levelsToGo: null };
      const span = Math.max(1, next.levels - cur.levels);
      return {
        current: cur,
        next,
        fraction: CC.clamp((done - cur.levels) / span, 0, 1),
        levelsToGo: Math.max(0, next.levels - done),
      };
    },

    // Call after progress changes. Returns the new rank if the player just moved up,
    // otherwise null. The highest rank reached is saved (every save starts at 1), so each
    // promotion fires once, including for older saves that already qualify.
    checkPromotion() {
      const cur = this.current();
      const seen = Save.progress.rank || 1;
      if (cur.number <= seen) return null;
      Save.progress.rank = cur.number;
      Save.saveProgress();
      return cur;
    },
  };
})();
