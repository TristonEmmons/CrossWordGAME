/* Music (shuffled menu playlist, looping per-level track, crossfades, mute/volume)
   and small synthesized sound effects. */
(function () {
  'use strict';

  const CC = window.CC;
  const settings = CC.Save.settings;
  const FADE_MS = 1200;
  const MUSIC_DIR = 'assets/music/';

  const tracks = (window.MUSIC_TRACKS || []).slice();
  const slots = [new Audio(), new Audio()];
  slots.forEach((a) => {
    a.preload = 'auto';
    a.volume = 0;
  });

  let active = 0; // index of the slot that is (or is becoming) audible
  let mode = null; // 'menu' | 'level'
  let currentTrack = -1;
  let lastMenuTrack = -1;
  let fadeFrame = 0;
  let needsUnlock = false;
  let lastVolume = settings.volume > 0 ? settings.volume : 0.5;
  const listeners = [];

  function effectiveVolume() {
    return settings.muted ? 0 : settings.volume;
  }

  function notify() {
    listeners.forEach((fn) => fn());
  }

  function tryPlay(audio) {
    const p = audio.play();
    if (p && p.catch) {
      p.catch(() => {
        // Browsers block autoplay until the first click/tap/keypress.
        needsUnlock = true;
      });
    }
  }

  function unlock() {
    if (!needsUnlock) return;
    needsUnlock = false;
    const audio = slots[active];
    if (audio.src && audio.paused) tryPlay(audio);
  }
  ['pointerdown', 'keydown'].forEach((evt) => window.addEventListener(evt, unlock, true));

  // Fade the active slot in to the target volume and every other slot out.
  function runFade() {
    cancelAnimationFrame(fadeFrame);
    const start = performance.now();
    const from = slots.map((a) => a.volume);
    const step = (now) => {
      const t = Math.min(1, (now - start) / FADE_MS);
      const target = effectiveVolume();
      slots.forEach((a, i) => {
        const to = i === active ? target : 0;
        a.volume = CC.clamp(from[i] + (to - from[i]) * t, 0, 1);
      });
      if (t < 1) {
        fadeFrame = requestAnimationFrame(step);
      } else {
        slots.forEach((a, i) => {
          if (i !== active) a.pause();
        });
      }
    };
    fadeFrame = requestAnimationFrame(step);
  }

  function switchTo(trackIndex, loop) {
    if (!tracks.length) return;
    currentTrack = trackIndex;
    active = 1 - active;
    const audio = slots[active];
    audio.src = MUSIC_DIR + tracks[trackIndex];
    audio.loop = loop;
    audio.volume = 0;
    audio.currentTime = 0;
    tryPlay(audio);
    runFade();
  }

  // Random track, skipping the last menu track and whatever is playing right now
  // (e.g. the level song you just left) when there are enough tracks to choose from.
  function randomMenuTrack() {
    if (tracks.length <= 1) return 0;
    const avoid = new Set([lastMenuTrack]);
    if (tracks.length > 2) avoid.add(currentTrack);
    const options = tracks.map((_, i) => i).filter((i) => !avoid.has(i));
    const idx = options[Math.floor(Math.random() * options.length)];
    lastMenuTrack = idx;
    return idx;
  }

  slots.forEach((audio, i) => {
    audio.addEventListener('ended', () => {
      if (i === active && mode === 'menu') switchTo(randomMenuTrack(), false);
    });
    audio.addEventListener('error', () => {
      // A missing/unplayable file shouldn't stall the menu playlist.
      if (i === active && mode === 'menu' && tracks.length > 1) {
        setTimeout(() => mode === 'menu' && switchTo(randomMenuTrack(), false), 500);
      }
    });
  });

  // ---- Sound effects (Web Audio synth, no files needed) ----
  let ctx = null;
  function audioCtx() {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, startOffset, duration, type, gain) {
    const ac = audioCtx();
    if (!ac) return;
    const t0 = ac.currentTime + startOffset;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.18, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  // A tone that slides between two pitches (for the coffee "sip").
  function glide(f0, f1, startOffset, duration, gain) {
    const ac = audioCtx();
    if (!ac) return;
    const t0 = ac.currentTime + startOffset;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(f1, t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  const SFX = {
    bonus() {
      // A quick sparkling run up a pentatonic scale, landing on a bell-like chord.
      [784, 880, 1047, 1175, 1319, 1568, 1760, 2093].forEach((f, i) => tone(f, i * 0.045, 0.25, 'sine', 0.07));
      [1047, 1319, 1568, 2093].forEach((f) => tone(f, 0.4, 1.3, 'triangle', 0.06));
      tone(3136, 0.42, 0.9, 'sine', 0.03);
    },
    coffee() {
      // Three little bubbly sips.
      glide(300, 520, 0, 0.12, 0.12);
      glide(340, 600, 0.11, 0.12, 0.1);
      glide(380, 700, 0.22, 0.14, 0.09);
    },
    found() {
      [523.25, 659.25, 783.99].forEach((f, i) => tone(f, i * 0.07, 0.35, 'triangle', 0.16));
    },
    invalid() {
      tone(196, 0, 0.18, 'sine', 0.12);
      tone(174.6, 0.09, 0.22, 'sine', 0.1);
    },
    hint() {
      [880, 1174.66, 1567.98].forEach((f, i) => tone(f, i * 0.05, 0.4, 'sine', 0.08));
    },
    tap() {
      tone(660, 0, 0.08, 'triangle', 0.06);
    },
    complete() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, 0.6, 'triangle', 0.16));
      tone(1318.5, 0.5, 0.9, 'sine', 0.1);
    },
    stick() {
      tone(240, 0, 0.09, 'triangle', 0.14);
      tone(120, 0.01, 0.12, 'sine', 0.12);
    },
    star() {
      tone(1046.5, 0, 0.3, 'sine', 0.1);
      tone(1568, 0.05, 0.35, 'sine', 0.07);
    },
  };

  CC.Audio = {
    hasTracks: () => tracks.length > 0,

    playMenu() {
      if (mode === 'menu') return;
      mode = 'menu';
      if (tracks.length) switchTo(randomMenuTrack(), false);
    },

    playLevel(level) {
      if (!tracks.length) {
        mode = 'level';
        return;
      }
      const map = CC.Save.progress.levelTracks;
      if (map[level] == null || map[level] >= tracks.length) {
        // Rotate through the list so consecutive levels never share a song.
        map[level] = (level - 1) % tracks.length;
        CC.Save.saveProgress();
      }
      if (mode === 'level' && currentTrack === map[level]) return;
      // The menu happens to be playing this level's song: keep it going, just loop it.
      if (currentTrack === map[level] && !slots[active].paused) {
        mode = 'level';
        slots[active].loop = true;
        return;
      }
      mode = 'level';
      switchTo(map[level], true);
    },

    get volume() {
      return settings.volume;
    },
    get muted() {
      return settings.muted || settings.volume === 0;
    },

    setVolume(v) {
      settings.volume = CC.clamp(v, 0, 1);
      if (settings.volume > 0) {
        lastVolume = settings.volume;
        settings.muted = false;
      }
      CC.Save.saveSettings();
      runFade();
      notify();
    },

    toggleMute() {
      if (this.muted) {
        settings.muted = false;
        // Restore the previous level instead of jumping to full volume.
        if (settings.volume === 0) settings.volume = lastVolume || 0.5;
      } else {
        settings.muted = true;
      }
      CC.Save.saveSettings();
      runFade();
      notify();
    },

    onChange(fn) {
      listeners.push(fn);
    },

    sfx(name) {
      if (!settings.sfx || !SFX[name]) return;
      try {
        SFX[name]();
      } catch (e) {
        /* audio is decoration; never let it break the game */
      }
    },
  };
})();
