/* Screen navigation, main menu, level map, and the modal dialogs
   (how to play, settings, pause, level complete). */
(function () {
  'use strict';

  const CC = window.CC;
  const Save = CC.Save;
  const $ = CC.$;

  const ICONS = {
    speaker:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    muted:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    lock:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
    star:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" fill="currentColor"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  CC.ICONS = ICONS;

  // ---- Screens ----

  let current = 'menu';

  function showScreen(name) {
    if (name === current) return;
    const prev = current;
    current = name;
    CC.$$('.screen').forEach((s) => {
      const on = s.id === 'screen-' + name;
      s.classList.toggle('active', on);
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    document.body.dataset.screen = name;
    if (prev === 'game') CC.Game.deactivate();
    if (prev === 'menu') CC.Stickers.finish();
    if (name === 'game') {
      CC.Audio.playLevel(CC.Game.level);
      setTimeout(() => current === 'game' && CC.Game.activate(), 380);
    } else {
      CC.Audio.playMenu();
    }
    if (name === 'menu') renderMenu();
    if (name === 'levels') renderLevelMap();
  }

  function playLevel(level) {
    closeAllModals();
    CC.Game.load(level);
    if (current === 'game') {
      CC.Audio.playLevel(level);
      CC.Game.activate();
    } else {
      showScreen('game');
    }
  }

  // ---- Modals ----

  const openModals = [];

  function openModal(id) {
    const node = document.getElementById(id);
    if (!node || openModals.includes(node)) return;
    node.hidden = false;
    void node.offsetWidth;
    node.classList.add('open');
    openModals.push(node);
    const focusable = node.querySelector('[data-autofocus]') || node.querySelector('button');
    if (focusable) focusable.focus({ preventScroll: true });
  }

  function closeModal(id) {
    const node = typeof id === 'string' ? document.getElementById(id) : id;
    const i = openModals.indexOf(node);
    if (i < 0) return;
    openModals.splice(i, 1);
    node.classList.remove('open');
    setTimeout(() => {
      if (!node.classList.contains('open')) node.hidden = true;
    }, 300);
    if (current === 'game' && !openModals.length) CC.Game.resume();
  }

  function closeAllModals() {
    openModals.slice().forEach((m) => {
      openModals.splice(openModals.indexOf(m), 1);
      m.classList.remove('open');
      m.hidden = true;
    });
  }

  function isOpen(id) {
    return openModals.some((m) => m.id === id);
  }

  CC.$$('[data-close]').forEach((btn) =>
    btn.addEventListener('click', () => closeModal(btn.closest('.modal')))
  );
  CC.$$('.modal').forEach((m) =>
    m.addEventListener('pointerdown', (e) => {
      if (e.target === m && m.dataset.dismiss !== 'no') closeModal(m);
    })
  );

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const top = openModals[openModals.length - 1];
    if (top) {
      if (top.dataset.dismiss !== 'no') closeModal(top);
    } else if (current === 'game') {
      openPause();
    }
  });

  // ---- Main menu ----

  function renderMenu(stickerDelay) {
    const next = Save.nextLevel();
    const started = next > 1 || Save.progress.inProgress[1];
    $('#start-sub').textContent = started ? `Continue · Level ${next}` : 'Level 1';
    CC.Stickers.show(stickerDelay == null ? 550 : stickerDelay);
  }

  $('#btn-start').addEventListener('click', () => playLevel(Save.nextLevel()));
  $('#btn-levels').addEventListener('click', () => showScreen('levels'));
  $('#btn-howto').addEventListener('click', () => openModal('modal-howto'));
  $('#btn-menu-settings').addEventListener('click', openSettings);
  $('#btn-levels-back').addEventListener('click', () => showScreen('menu'));

  // ---- Level map ----

  const map = $('#level-map');
  const NODE_SPACING = 118;
  const CHAPTER = 5;

  function renderLevelMap() {
    const next = Save.nextLevel();
    const count = Math.max(30, Math.ceil((next + 10) / CHAPTER) * CHAPTER);
    const width = Math.min(map.clientWidth || 480, 520);
    const top = 110;
    const points = [];
    for (let i = 0; i < count; i++) {
      const x = width / 2 + Math.sin(i * 0.95) * width * 0.3;
      const extra = Math.floor(i / CHAPTER) * 56; // room for chapter banners
      points.push([x, top + i * NODE_SPACING + extra]);
    }
    const height = points[points.length - 1][1] + 110;

    map.textContent = '';
    map.style.height = height + 'px';

    // Winding path through the nodes (smooth cubic segments).
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'map-path');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const pathFor = (upto) => {
      let d = `M ${points[0][0]} ${points[0][1]}`;
      for (let i = 1; i < upto; i++) {
        const [x0, y0] = points[i - 1];
        const [x1, y1] = points[i];
        const my = (y0 + y1) / 2;
        d += ` C ${x0} ${my}, ${x1} ${my}, ${x1} ${y1}`;
      }
      return d;
    };
    const base = document.createElementNS(svgNS, 'path');
    base.setAttribute('d', pathFor(points.length));
    base.setAttribute('class', 'path-base');
    svg.appendChild(base);
    const done = document.createElementNS(svgNS, 'path');
    done.setAttribute('d', pathFor(Math.min(next, points.length)));
    done.setAttribute('class', 'path-done');
    svg.appendChild(done);

    // Light decorative flourishes scattered beside the path.
    const rng = CC.makeRng(1234);
    for (let i = 0; i < count; i++) {
      const [x, y] = points[i];
      const side = x > width / 2 ? -1 : 1;
      const fx = CC.clamp(x + side * (70 + rng() * 60), 16, width - 16);
      const fy = y + (rng() - 0.5) * 60;
      const deco = document.createElementNS(svgNS, 'text');
      deco.setAttribute('x', fx);
      deco.setAttribute('y', fy);
      deco.setAttribute('class', 'deco');
      deco.textContent = rng.pick(['✦', '✧', '•', '❋', '✿', '·']);
      svg.appendChild(deco);
    }
    map.appendChild(svg);

    for (let i = 0; i < count; i++) {
      const level = i + 1;
      if (i % CHAPTER === 0) {
        const banner = CC.el('div', 'chapter', `Chapter ${i / CHAPTER + 1}`);
        banner.style.transform = `translate(-50%, ${points[i][1] - 78}px)`;
        banner.style.left = width / 2 + 'px';
        if (level > next) banner.classList.add('locked');
        map.appendChild(banner);
      }
      const node = CC.el('button', 'level-node');
      node.style.left = points[i][0] + 'px';
      node.style.top = points[i][1] + 'px';
      node.style.animationDelay = Math.min(i, 14) * 30 + 'ms';
      const record = Save.progress.completed[level];
      if (record) {
        node.classList.add('done');
        node.innerHTML =
          `<span class="num">${level}</span><span class="badge">${ICONS.check}</span>` +
          `<span class="mini-stars">${[1, 2, 3]
            .map((s) => `<i class="${s <= record.stars ? 'on' : ''}">${ICONS.star}</i>`)
            .join('')}</span>`;
        node.setAttribute('aria-label', `Level ${level}, completed, ${record.stars} stars. Replay`);
        node.addEventListener('click', () => playLevel(level));
      } else if (level === next) {
        node.classList.add('current');
        node.innerHTML = `<span class="num">${level}</span><span class="play-tag">Play</span>`;
        node.setAttribute('aria-label', `Level ${level}, play`);
        node.addEventListener('click', () => playLevel(level));
      } else {
        node.classList.add('locked');
        node.disabled = true;
        node.innerHTML = `<span class="num">${level}</span><span class="badge">${ICONS.lock}</span>`;
        node.setAttribute('aria-label', `Level ${level}, locked`);
      }
      map.appendChild(node);
    }

    $('#levels-stars').innerHTML = `${ICONS.star}<span>${Save.totalStars()}</span>`;

    // Bring the next playable level into view.
    requestAnimationFrame(() => {
      const scroller = $('#level-scroll');
      const target = points[Math.min(next, count) - 1][1] - scroller.clientHeight / 2;
      scroller.scrollTop = Math.max(0, target);
    });
  }

  // ---- Pause ----

  function openPause() {
    if (current !== 'game' || isOpen('modal-pause') || isOpen('modal-complete')) return;
    CC.Game.pause();
    $('#pause-level').textContent = 'Level ' + CC.Game.level;
    openModal('modal-pause');
  }

  $('#btn-pause').addEventListener('click', openPause);
  $('#btn-resume').addEventListener('click', () => closeModal('modal-pause'));
  $('#btn-restart').addEventListener('click', () => {
    closeAllModals();
    CC.Game.restart();
  });
  $('#btn-pause-levels').addEventListener('click', () => {
    closeAllModals();
    showScreen('levels');
  });
  $('#btn-pause-menu').addEventListener('click', () => {
    closeAllModals();
    showScreen('menu');
  });
  $('#btn-pause-settings').addEventListener('click', openSettings);

  // ---- Level complete ----

  function showComplete(result) {
    $('#complete-title').textContent = `Level ${result.level} complete!`;
    $('#stat-time').textContent = CC.formatTime(result.time);
    $('#stat-hints').textContent = `${result.hints} of 2`;
    $('#stat-words').textContent = result.words;
    const starsHost = $('#complete-stars');
    starsHost.innerHTML = [1, 2, 3].map(() => `<span class="big-star">${ICONS.star}</span>`).join('');
    const starNodes = CC.$$('.big-star', starsHost);
    openModal('modal-complete');
    CC.Audio.sfx('complete');
    CC.Effects.celebrate();
    starNodes.forEach((node, i) => {
      setTimeout(() => {
        node.classList.add(i < result.stars ? 'earned' : 'empty');
        if (i < result.stars) CC.Audio.sfx('star');
      }, 600 + i * 450);
    });
    showBrew(result.brew);
    $('#complete-note').textContent =
      result.stars === 3 ? 'Solved without hints — perfect!' : 'Solve it without hints for 3 stars.';
  }

  // Coffee brewing bar: fills by this level's share, and pours a cup when it tops out.
  let brewTimers = [];
  function showBrew(brew) {
    const box = $('#complete-brew');
    const fill = $('#brew-fill');
    const label = $('#brew-label');
    const note = $('#brew-note');
    brewTimers.forEach(clearTimeout);
    brewTimers = [];
    box.hidden = !brew;
    if (!brew) return;

    box.classList.remove('poured', 'double');
    label.textContent = 'Brewing your next coffee';
    note.hidden = false;
    fill.style.transition = 'none';
    fill.style.transform = `scaleX(${brew.before})`;
    void fill.offsetWidth;
    fill.style.transition = '';

    brewTimers.push(
      setTimeout(() => {
        fill.style.transform = `scaleX(${brew.cups ? 1 : brew.after})`;
      }, 1900)
    );
    if (!brew.cups) return;
    brewTimers.push(
      setTimeout(() => {
        box.classList.add('poured');
        if (brew.cups > 1) box.classList.add('double');
        label.textContent = brew.cups > 1 ? 'Double shot! +2 coffee cups' : '+1 coffee cup';
        note.hidden = true;
        CC.Audio.sfx('coffee');
      }, 2900)
    );
  }

  $('#btn-next').addEventListener('click', () => playLevel(Save.nextLevel()));
  $('#btn-complete-levels').addEventListener('click', () => {
    closeAllModals();
    showScreen('levels');
  });

  // ---- Settings ----

  const volume = $('#set-volume');
  const volumeValue = $('#set-volume-value');
  const muteButtons = CC.$$('.mute-btn');

  function syncAudioUi() {
    const muted = CC.Audio.muted;
    volume.value = muted ? 0 : Math.round(Save.settings.volume * 100);
    volumeValue.textContent = volume.value + '%';
    volume.style.setProperty('--fill', volume.value + '%');
    muteButtons.forEach((btn) => {
      btn.innerHTML = muted ? ICONS.muted : ICONS.speaker;
      btn.classList.toggle('is-muted', muted);
      btn.setAttribute('aria-label', muted ? 'Unmute music' : 'Mute music');
      btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    });
  }

  volume.addEventListener('input', () => CC.Audio.setVolume(volume.value / 100));
  muteButtons.forEach((btn) => btn.addEventListener('click', () => CC.Audio.toggleMute()));
  CC.Audio.onChange(syncAudioUi);

  function bindToggle(id, key, after) {
    const input = document.getElementById(id);
    input.checked = !!Save.settings[key];
    input.addEventListener('change', () => {
      Save.settings[key] = input.checked;
      Save.saveSettings();
      if (after) after();
    });
  }

  function applyContrast() {
    document.body.classList.toggle('high-contrast', !!Save.settings.highContrast);
  }

  bindToggle('set-sfx', 'sfx', () => CC.Audio.sfx('tap'));
  bindToggle('set-contrast', 'highContrast', applyContrast);
  bindToggle('set-wordlist', 'showWordList', () => {
    CC.Game.applyWordListSetting();
    CC.Game.relayout();
  });

  const scale = $('#set-scale');
  const scaleValue = $('#set-scale-value');
  function syncScale() {
    scale.value = Math.round(Save.settings.letterScale * 100);
    scaleValue.textContent = scale.value + '%';
    scale.style.setProperty('--fill', ((scale.value - scale.min) / (scale.max - scale.min)) * 100 + '%');
    document.documentElement.style.setProperty('--ui-scale', Math.max(1, Save.settings.letterScale * 0.9));
  }
  scale.addEventListener('input', () => {
    Save.settings.letterScale = scale.value / 100;
    Save.saveSettings();
    syncScale();
    CC.Game.relayout();
  });

  $('#music-note').hidden = CC.Audio.hasTracks();

  const resetBtn = $('#btn-reset');
  let resetArmed = false;
  resetBtn.addEventListener('click', () => {
    if (!resetArmed) {
      resetArmed = true;
      resetBtn.textContent = 'Tap again to erase all progress';
      resetBtn.classList.add('armed');
      setTimeout(() => {
        resetArmed = false;
        resetBtn.textContent = 'Reset progress';
        resetBtn.classList.remove('armed');
      }, 4000);
      return;
    }
    resetArmed = false;
    Save.resetAll();
    resetBtn.textContent = 'Progress erased';
    resetBtn.classList.remove('armed');
    closeAllModals();
    showScreen('menu');
    renderMenu();
  });

  function openSettings() {
    if (current === 'game') CC.Game.pause();
    openModal('modal-settings');
  }
  $('#btn-corner-settings').addEventListener('click', openSettings);

  // Soft click sound on every button press.
  document.addEventListener('click', (e) => {
    if (e.target.closest('button:not(.hint-btn):not(.mute-btn):not(.coffee-btn)')) CC.Audio.sfx('tap');
  });

  window.addEventListener('resize', () => {
    if (current === 'levels') renderLevelMap();
    if (current === 'menu') CC.Stickers.relayout();
  });

  CC.Screens = {
    init() {
      applyContrast();
      syncAudioUi();
      syncScale();
      renderMenu(1400);
      document.body.dataset.screen = 'menu';
      CC.Audio.playMenu();
    },
    show: showScreen,
    showComplete,
    isGameScreen: () => current === 'game' && !openModals.length,
  };
})();
