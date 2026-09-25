/* Save data: level progress, used words, in-progress boards and settings, all in localStorage. */
(function () {
  'use strict';

  const CC = window.CC;
  // Storage keys keep the game's original name so saved progress carries over.
  const PROGRESS_KEY = 'crazyCrossword.progress.v1';
  const SETTINGS_KEY = 'crazyCrossword.settings.v1';

  const DEFAULT_SETTINGS = {
    volume: 0.5, // 0..1
    muted: false,
    sfx: true,
    letterScale: 1, // multiplier on the auto-fit cell size
    highContrast: false,
    showWordList: true,
  };

  function emptyProgress() {
    return {
      // level number -> { stars, bestTime, hints }
      completed: {},
      // every word ever drawn into a level; never drawn again
      usedWords: [],
      // level number -> { seed, words } so replaying rebuilds the same puzzle
      levels: {},
      // level number -> { found: [], hints: [{ word, row, col }], elapsed }
      inProgress: {},
      // level number -> music track index
      levelTracks: {},
      // stars already stuck on the main menu; any beyond this animate in on the next visit
      menuStarsShown: 0,
      // one entry per star earned, in order: 'gold', or 'shiny' for a level's 4th star
      stickerLog: [],
      // coffee cups in hand; each one finds a random word
      coffee: 3,
      // progress (0..1) toward brewing the next cup; see brewCoffee()
      coffeeBrew: 0,
      // Today's Paper results: 'YYYY-MM-DD' -> { stars, time, hints }
      daily: {},
      // Lifetime counters for the stats page (see initStats for older saves)
      stats: null,
      // highest coffee rank reached (see js/ranks.js)
      rank: 1,
    };
  }

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  let frozen = false; // set while a restored backup reloads the page, so nothing overwrites it

  function write(key, value) {
    if (frozen) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Private mode or storage full: the game still works, it just won't remember.
    }
  }

  // How much of a cup one newly finished level brews, by hints used in it:
  // no hints -> a cup every 2 levels, 1 hint -> every 3, 2 hints -> every 4.
  const BREW_PER_LEVEL = [1 / 2, 1 / 3, 1 / 4];
  const DOUBLE_SHOT_CHANCE = 1 / 12; // a finished brew occasionally pours two cups

  const progress = Object.assign(emptyProgress(), read(PROGRESS_KEY) || {});
  const settings = Object.assign({}, DEFAULT_SETTINGS, read(SETTINGS_KEY) || {});
  let usedSet = new Set(progress.usedWords);

  // Rebuild the sticker log for saves made before it existed (or if it drifted).
  (function syncStickerLog() {
    const levels = Object.values(progress.completed);
    const total = levels.reduce((sum, c) => sum + c.stars, 0);
    if (Array.isArray(progress.stickerLog) && progress.stickerLog.length === total) return;
    const shiny = levels.filter((c) => c.stars >= 4).length;
    progress.stickerLog = new Array(total - shiny).fill('gold').concat(new Array(shiny).fill('shiny'));
  })();

  // Yesterday's unfinished paper can't be finished any more; drop its leftovers.
  (function tidyOldDailies() {
    const today = 'daily-' + CC.todayKey();
    [progress.inProgress, progress.levelTracks].forEach((map) => {
      Object.keys(map || {}).forEach((k) => {
        if (k.indexOf('daily-') === 0 && k !== today) delete map[k];
      });
    });
  })();

  // Saves from before the stats page get their counters estimated from what was saved.
  (function initStats() {
    if (progress.stats) return;
    const done = Object.keys(progress.completed);
    let words = 0;
    done.forEach((l) => {
      const rec = progress.levels[l];
      words += rec && rec.words ? rec.words.length : 0;
    });
    Object.values(progress.inProgress).forEach((p) => (words += (p.found || []).length));
    words += Object.keys(progress.daily).length * 5;
    const levels = Object.values(progress.completed);
    progress.stats = {
      wordsFound: words,
      bonusFound: levels.filter((c) => c.stars >= 4).length,
      hintsUsed: levels.reduce((sum, c) => sum + (c.hints || 0), 0),
      coffeeUsed: 0,
      playMs: levels.reduce((sum, c) => sum + (c.bestTime || 0), 0),
      bestStreak: 0,
    };
  })();

  CC.Save = {
    progress,
    settings,

    saveProgress() {
      progress.usedWords = Array.from(usedSet);
      write(PROGRESS_KEY, progress);
    },

    saveSettings() {
      write(SETTINGS_KEY, settings);
    },

    isUsed(word) {
      return usedSet.has(word);
    },

    markUsed(words) {
      words.forEach((w) => usedSet.add(w));
    },

    isCompleted(level) {
      return !!progress.completed[level];
    },

    // The lowest level not yet completed. Levels unlock strictly in order.
    nextLevel() {
      let n = 1;
      while (progress.completed[n]) n++;
      return n;
    },

    isUnlocked(level) {
      return level <= this.nextLevel();
    },

    // Returns true the first time a level is completed.
    recordCompletion(level, stars, time, hints) {
      const prev = progress.completed[level];
      const prevStars = prev ? prev.stars : 0;
      for (let s = prevStars + 1; s <= stars; s++) progress.stickerLog.push(s >= 4 ? 'shiny' : 'gold');
      progress.completed[level] = {
        stars: prev ? Math.max(prev.stars, stars) : stars,
        bestTime: prev ? Math.min(prev.bestTime, time) : time,
        hints: prev ? Math.min(prev.hints, hints) : hints,
      };
      delete progress.inProgress[level];
      this.saveProgress();
      return !prev;
    },

    // Brews coffee for a level finished for the first time. Returns how many cups were
    // poured (0, 1 or 2) and the brew level before and after, for the progress bar.
    brewCoffee(hints) {
      const before = progress.coffeeBrew || 0;
      let after = before + BREW_PER_LEVEL[Math.min(Math.max(hints, 0), BREW_PER_LEVEL.length - 1)];
      let cups = 0;
      if (after >= 1 - 1e-9) {
        after = Math.max(0, after - 1);
        if (after < 1e-9) after = 0;
        cups = Math.random() < DOUBLE_SHOT_CHANCE ? 2 : 1;
      }
      progress.coffeeBrew = after;
      progress.coffee += cups;
      this.saveProgress();
      return { cups, before, after };
    },

    // Backup file contents: everything needed to carry progress to another browser.
    exportBackup() {
      this.saveProgress();
      return JSON.stringify(
        // 'crazy-crossword' is the backup file's fixed tag (the game's original name).
        { game: 'crazy-crossword', version: 1, savedAt: new Date().toISOString(), progress, settings },
        null,
        1
      );
    },

    // Restores a backup made by exportBackup(). Returns false if the file isn't one.
    importBackup(text) {
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return false;
      }
      if (!data || data.game !== 'crazy-crossword' || !data.progress || typeof data.progress.completed !== 'object') {
        return false;
      }
      write(PROGRESS_KEY, data.progress);
      if (data.settings) write(SETTINGS_KEY, data.settings);
      frozen = true;
      return true;
    },

    // Records a solved daily paper. The first solve of the day pours a coffee cup.
    recordDaily(dateKey, stars, time, hints) {
      const prev = progress.daily[dateKey];
      progress.daily[dateKey] = prev
        ? { stars: Math.max(prev.stars, stars), time: Math.min(prev.time, time), hints: Math.min(prev.hints, hints) }
        : { stars, time, hints };
      delete progress.inProgress['daily-' + dateKey];
      if (!prev) progress.coffee += 1;
      const streak = this.dailyStreak();
      progress.stats.bestStreak = Math.max(progress.stats.bestStreak || 0, streak);
      this.saveProgress();
      return { firstTime: !prev, streak };
    },

    // Days in a row with the paper solved, counting back from today (or from
    // yesterday, if today's isn't done yet, so the streak isn't lost by breakfast).
    dailyStreak() {
      const d = new Date();
      if (!progress.daily[CC.todayKey(d)]) d.setDate(d.getDate() - 1);
      let streak = 0;
      while (progress.daily[CC.todayKey(d)]) {
        streak++;
        d.setDate(d.getDate() - 1);
      }
      return streak;
    },

    // Adds to a lifetime stats counter (saved with the next progress save).
    bump(key, amount) {
      progress.stats[key] = (progress.stats[key] || 0) + (amount == null ? 1 : amount);
    },

    totalStars() {
      return Object.values(progress.completed).reduce((sum, c) => sum + c.stars, 0);
    },

    resetAll() {
      const fresh = emptyProgress();
      Object.keys(progress).forEach((k) => delete progress[k]);
      Object.assign(progress, fresh);
      usedSet = new Set();
      this.saveProgress();
    },
  };
})();
