# Crazy WordSearch

A browser word-search game. Words are hidden in a big letter grid. Drag from the first letter to the last to find each one.

## Play

Open `index.html` in any modern browser. It needs no build step and no server, so you can just double-click the file. You can also serve the folder (`python3 -m http.server`) or put it on any static host.

Progress, settings and the list of words already used are saved in the browser's `localStorage`.

## Music

Four tracks ship in `assets/music/`: Crossword Calm, Coffee Shop Loop, Puzzle Playtime and Velvet Stains. Music starts on the first click or key press, since browsers block sound until then.

- **Menu screens** shuffle through all tracks. The shuffle never plays the same song twice in a row, or the song you just heard in a level.
- **Levels** each loop one track, rotating through the list so back-to-back levels sound different. The assignment is remembered per level.
- Switching between the menus and a level crossfades. If both use the same song, it keeps playing without restarting.

To add more songs, drop the files into `assets/music/` and add their names to `assets/music/tracks.js`.

## Project layout

| Path | What it does |
| --- | --- |
| `index.html` | Screens, modals and script order |
| `css/style.css` | All styling, animations, high-contrast theme |
| `js/util.js` | DOM helpers, seeded RNG, direction vectors |
| `js/storage.js` | Save data and settings (`localStorage`) |
| `js/levels.js` | Difficulty curve and word drawing from the library |
| `js/generator.js` | Backtracking grid generator, filler weighting, duplicate removal |
| `js/board.js` | Grid rendering, drag selection, hints, timer, streaks |
| `js/audio.js` | Music playlist/looping/crossfade, mute and volume, synthesized sound effects |
| `js/effects.js` | Canvas confetti and toasts |
| `js/ranks.js` | Coffee ranks: the 10-rank ladder, badge art, and rank-up checks |
| `js/stickers.js` | Main-menu star sticker pile and its fly-in animation |
| `js/newspaper.js` | The newspaper page around the puzzle: paper and desk textures, masthead dateline, and the news columns that fill the margins |
| `js/levelmap.js` | The world map: chapter worlds, landmarks, signposts, the road, level coins and the mascot |
| `js/screens.js` | Menu, level select screen, stats page, pause, settings, level complete |
| `data/word-library.json` | 5,000-word library in buckets by length (3–12 letters) |
| `data/word-library.js` | The same data as a script, so the game works from `file://` |
| `assets/img/` | The coffee-cup mascot, plus its favicon and app-icon sizes |
| `tools/` | Scripts that rebuild the word library and cut the mascot out of its background (`cut_mascot.py`) |

## Ranks

Players climb a ladder of 10 coffee ranks by completing numbered levels. The current rank shows on the main menu and the Stats page. A promotion appears on the level-complete card, or on the menu when a save already qualifies. Some ranks also give the menu mascot a small extra.

| Rank | Name | Reached after | Motto | Mascot extra |
| --- | --- | --- | --- | --- |
| 1 | House Blend | start | Fresh off the press. | none |
| 2 | French Roast | 5 levels | Bold enough for the morning edition. | a black beret |
| 3 | Espresso | 10 levels | Small cup. Serious solver. | + a gold coffee-bean pin on the beret |
| 4 | Cappuccino | 15 levels | A seasoned solver with good taste. | + a folded morning paper by the saucer |

All rank data lives in `RANKS` in `js/ranks.js`, with badge art in `BADGES` and mascot extras in `MASCOT_EXTRAS`. Ranks 5–10 are listed there but not yet playable. Ranks are earned strictly in order: the lookup climbs the ladder and stops at the first rank that isn't built or earned.

## Today's Paper

A small daily puzzle on the main menu: a 15×15 grid with 5 easy words (3–6 letters, across and down only) and one hidden bonus word. Everyone gets the same paper all day, since it's generated from the date, and a new one arrives at local midnight. The first solve each day earns a coffee cup and extends the daily streak. It doesn't affect level progress or stars.

## Difficulty

| Levels | Grid | Words | Length | Directions |
| --- | --- | --- | --- | --- |
| 1–5 | 20×20 | 8–10 | 3–6 | across, down |
| 6–10 | 23×23 | 10–13 | 4–7 | + backwards |
| 11–15 | 26×26 | 13–16 | 5–8 | + diagonals (down-right, up-right) |
| 16–20 | 29×29 | 16–20 | 6–9 | same |
| 21–25 | 32×32 | 20–24 | 7–10 | all 8 directions |
| 26+ | 35×35 | 24–30, rising slowly | 7–12 | all 8 directions |

Change the curve in `TIERS` in `js/levels.js`.

**Word selection.** The first time a level loads, its words are drawn at random from the library. Words used by earlier levels are skipped. The level's word list and random seed are saved, so replaying a level rebuilds the same board.

**Stars.** You get 3 stars with no hints, 2 with one hint and 1 with two. The time is shown on the level-complete card, but it doesn't change the stars.

## Editing the word library

Edit `data/word-library.json` directly, then regenerate the script copy:

```sh
python3 tools/json_to_js.py
```

To rebuild the library from scratch, see the docstring in `tools/build_word_library.py`. It uses word-frequency data from `wordfreq`, the ENABLE dictionary and a profanity filter. The script also contains a hand-picked exclusion list.

The 3-letter bucket stops at 456 words. English runs out of common 3-letter words before 500, and the rest would be abbreviations and oddities.
