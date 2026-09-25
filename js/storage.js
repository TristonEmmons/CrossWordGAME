/* Save data: level progress, used words, in-progress boards and settings, all in localStorage. */
(function () {
  'use strict';

  const CC = window.CC;
  const PROGRESS_KEY = 'crazyCrossword.progress.v1';
  const SETTINGS_KEY = 'crazyCrossword.settings.v1';

  const DEFAULT_SETTINGS = {
    volume: 0.6, // 0..1
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
      // coffee cups in hand; each one finds a random word. +1 per level finished the first time
      coffee: 3,
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

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Private mode or storage full: the game still works, it just won't remember.
    }
  }

  const progress = Object.assign(emptyProgress(), read(PROGRESS_KEY) || {});
  const settings = Object.assign({}, DEFAULT_SETTINGS, read(SETTINGS_KEY) || {});
  let usedSet = new Set(progress.usedWords);

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
      progress.completed[level] = {
        stars: prev ? Math.max(prev.stars, stars) : stars,
        bestTime: prev ? Math.min(prev.bestTime, time) : time,
        hints: prev ? Math.min(prev.hints, hints) : hints,
      };
      delete progress.inProgress[level];
      this.saveProgress();
      return !prev;
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
