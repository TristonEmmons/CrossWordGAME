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
    holoStar:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" fill="url(#holo-grad)" stroke="#fff" stroke-width="0.9" stroke-linejoin="round"/></svg>',
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
    if (name === 'stats') renderStats();
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
    renderDailyButton();
    CC.MenuScene.refresh();
    // A rank earned outside a level finish (e.g. a save from before that rank existed)
    // is celebrated here instead, once.
    const promoted = CC.Ranks.checkPromotion();
    renderRankChip(promoted);
    CC.Stickers.show(stickerDelay == null ? 550 : stickerDelay);
    mascotGreet(stickerDelay == null ? 700 : 1500, promoted && `Promoted to ${promoted.name}!`);
  }

  // ---- Mascot: says hello when the menu opens, hops and chats when clicked ----

  const mascot = $('#mascot');
  const bubble = $('#mascot-bubble');
  let bubbleTimer = 0;
  let lastLine = '';

  const MASCOT_LINES = [
    'Fresh words, brewed daily!',
    'I spy with my little eye… letters!',
    'Take your time. I’ll stay warm.',
    'Psst! Some words hide backwards.',
    'Every grid hides a secret or two.',
    'Another cup? Don’t mind if I do!',
    'You’re a natural word-finder!',
    'Sip, search, smile. Repeat.',
  ];

  function greeting() {
    const h = new Date().getHours();
    const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const next = Save.nextLevel();
    if (!Save.progress.daily[CC.todayKey()]) return `${part}! Today’s paper just arrived. Only 5 words!`;
    const weather = CC.MenuScene && CC.MenuScene.weather;
    if (weather === 'rain') return `${part}! Rainy out there. Perfect puzzle weather.`;
    if (weather === 'snow') return `${part}! It’s snowing! Stay warm with a puzzle.`;
    return next > 1 ? `${part}! Level ${next} is ready for you.` : `${part}! Ready to find some words?`;
  }

  function say(text, ms) {
    clearTimeout(bubbleTimer);
    bubble.textContent = text;
    bubble.hidden = false;
    bubble.classList.remove('pop');
    void bubble.offsetWidth;
    bubble.classList.add('pop');
    bubbleTimer = setTimeout(() => {
      bubble.hidden = true;
    }, ms || 4200);
  }

  function mascotGreet(delay, text) {
    clearTimeout(bubbleTimer);
    bubble.hidden = true;
    bubbleTimer = setTimeout(() => say(text || greeting(), text ? 6000 : 0), delay);
  }

  mascot.addEventListener('click', () => {
    mascot.classList.remove('hop');
    void mascot.offsetWidth;
    mascot.classList.add('hop');
    CC.Audio.sfx('coffee');
    let line;
    do {
      line = MASCOT_LINES[Math.floor(Math.random() * MASCOT_LINES.length)];
    } while (line === lastLine);
    lastLine = line;
    say(line);
  });

  $('#btn-start').addEventListener('click', () => playLevel(Save.nextLevel()));

  // ---- Coffee rank ----

  function renderRankChip(promoted) {
    const rank = CC.Ranks.current();
    const chip = $('#rank-chip');
    $('#rank-chip-badge').innerHTML = CC.Ranks.badgeHtml(rank);
    CC.Ranks.paint(chip, rank);
    $('#rank-chip-number').textContent = `Rank ${rank.number} of ${CC.Ranks.total}`;
    $('#rank-chip-name').textContent = rank.name;
    // A thin ring around the badge fills toward the next rank.
    const { next, fraction, levelsToGo } = CC.Ranks.progress();
    $('#rank-chip-ring').style.setProperty('--p', next ? fraction : 1);
    chip.setAttribute('aria-label', `Your rank: ${rank.name}, ${rank.number} of ${CC.Ranks.total}. ${nextRankLine(next, levelsToGo)} Open stats`);
    chip.title = nextRankLine(next, levelsToGo);
    chip.dataset.rank = rank.id;
    chip.dataset.tier = CC.Ranks.tierAttr(rank);
    mascot.dataset.tier = CC.Ranks.tierAttr(rank);
    chip.classList.toggle('promoted', !!promoted);
    if (promoted) rankUpFanfare(promoted, $('#rank-chip-badge'), 1100);
    // The mascot's rank extras (e.g. French Roast's beret).
    $('#mascot-extra').innerHTML = CC.Ranks.mascotHtml(rank);
  }

  // The rank-up presentation, shared by the level-complete card and the menu chip.
  // Every promotion gets a fanfare and a burst in the rank's own colors from `node`;
  // milestone ranks get a longer fanfare and a second shower of gold stars.
  function rankUpFanfare(rank, node, delay) {
    return setTimeout(() => {
      if (!node.isConnected || !node.offsetParent) return;
      const r = node.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      CC.Audio.sfx(rank.fanfare || (rank.milestone ? 'milestone' : 'rankUp'));
      CC.Effects.burst(x, y, rank.milestone ? 56 : 30, [rank.color, rank.accent, rank.trim || '#ffc145', '#fffaf1']);
      if (rank.milestone) setTimeout(() => CC.Effects.burst(x, y, 30, 'gold'), 260);
    }, delay);
  }

  // The "Promoted!" line on the level-complete card. A milestone rank runs as a special
  // edition: an "Extra! Extra!" kicker, a stamp with the milestone, and the rank's motto.
  function promotionHtml(rank) {
    const kicker = rank.milestone
      ? `${rank.kicker || 'Extra! Extra!'} <i class="promo-stamp">${rank.milestone}</i>`
      : rank.kicker || 'Promoted!';
    const motto = rank.milestone ? `<em class="promo-motto">“${rank.description}”</em>` : '';
    const cheer = rank.cheer ? `<span class="promo-cheer">${rank.cheer}</span>` : '';
    return `<span class="rank-badge">${CC.Ranks.badgeHtml(rank)}</span><span class="promo-text"><small>${kicker}</small><b>${rank.name}</b>${cheer}${motto}</span>`;
  }

  $('#rank-chip').addEventListener('click', () => showScreen('stats'));

  document.addEventListener('click', (e) => {
    const cup = e.target.closest('.shelf-cup');
    if (!cup) return;
    const wrap = cup.closest('.rank-shelf-wrap');
    const pick = CC.Ranks.all[Number(cup.dataset.rank) - 1];
    wrap.innerHTML = shelfHtml(CC.Ranks.current(), pick);
    wrap.querySelector(`.shelf-cup[data-rank="${pick.number}"]`).focus();
    CC.Audio.sfx('tap');
  });

  // "3 more levels to Espresso." (or the top-rank line), used wherever progress is shown.
  function nextRankLine(next, levelsToGo) {
    if (!next) return 'You’ve reached the top rank.';
    if (levelsToGo == null) return 'Next rank coming soon.';
    return `${levelsToGo} more level${levelsToGo === 1 ? '' : 's'} to ${next.name}.`;
  }

  // One line about a rank on the trophy shelf: what it is and how you get (or got) it.
  function shelfDetail(r, current) {
    const done = CC.Ranks.levelsCompleted();
    let when;
    if (r.number === 1) when = 'Where every solver starts.';
    else if (r.number <= current.number) when = `Earned by finishing level ${r.levels}.`;
    else when = `Unlocks at level ${r.levels} · ${r.levels - done} more to go.`;
    return `<b>${r.name}</b> <em>“${r.description}”</em> <span>${when}</span>`;
  }

  // The trophy shelf: every rank's badge, earned ones in colour and the rest as
  // silhouettes. Tapping one shows its details below the shelf.
  function shelfHtml(current, show) {
    const cups = CC.Ranks.all
      .map((r) => {
        const state = r.number < current.number ? 'past' : r.number === current.number ? 'now' : 'ahead';
        const label = r.number <= current.number ? `${r.name}, earned` : `Rank ${r.number}, ${r.name}, locked`;
        return `<li><button class="shelf-cup ${state}${r === show ? ' picked' : ''}" data-rank="${r.number}" style="${CC.Ranks.styleAttr(r)}" aria-label="${label}" aria-pressed="${r === show}"><span class="rank-badge">${CC.Ranks.badgeHtml(r)}</span><i>${r.number}</i></button></li>`;
      })
      .join('');
    return `<ol class="rank-shelf" aria-label="Coffee ranks">${cups}</ol><p class="shelf-detail" aria-live="polite">${shelfDetail(show, current)}</p>`;
  }

  // Rank panel for the stats page: badge, name, motto, progress, and the trophy shelf.
  function rankPanelHtml() {
    const { current, next, fraction, levelsToGo } = CC.Ranks.progress();
    const nextLine = next ? nextRankLine(next, levelsToGo) : 'You’ve reached the top. Every level still counts in your stats.';
    return `
      <section class="sp-rank" data-rank="${current.id}" data-tier="${CC.Ranks.tierAttr(current)}" style="${CC.Ranks.styleAttr(current)}">
        <div class="rank-seal">${CC.Ranks.badgeHtml(current)}</div>
        <div class="rank-info">
          <span class="rank-kicker">Your rank · ${current.number} of ${CC.Ranks.total}${current.tier ? ` · <em class="rank-tier">${CC.Ranks.tierLabel(current)}</em>` : ''}</span>
          <h4>${current.name}</h4>
          <p class="rank-motto">“${current.description}”</p>
          <div class="rank-bar"><span style="transform:scaleX(${fraction})"></span></div>
          <p class="rank-next">${nextLine}</p>
          <div class="rank-shelf-wrap">${shelfHtml(current, next && next.ready ? next : current)}</div>
        </div>
      </section>`;
  }

  // ---- Today's Paper ----

  function renderDailyButton() {
    const done = Save.progress.daily[CC.todayKey()];
    const streak = Save.dailyStreak();
    const btn = $('#btn-daily');
    btn.classList.toggle('done', !!done);
    $('#daily-sub').textContent = done
      ? 'Solved today · new one tomorrow'
      : Save.progress.inProgress[CC.dailyLevelId()]
        ? 'Easy · 5 words · keep going'
        : 'Easy · 5 words';
    const badge = $('#daily-badge');
    badge.hidden = streak < 2;
    badge.textContent = `${streak}-day streak`;
  }

  $('#btn-daily').addEventListener('click', () => playLevel(CC.dailyLevelId()));
  $('#btn-levels').addEventListener('click', () => showScreen('levels'));
  $('#btn-howto').addEventListener('click', () => openModal('modal-howto'));
  $('#btn-menu-settings').addEventListener('click', openSettings);
  $('#btn-levels-back').addEventListener('click', () => showScreen('menu'));

  // ---- Level map ----

  const map = $('#level-map');

  const mapJump = $('#map-jump');
  const mapScroll = $('#level-scroll');
  let mapNextY = 0;
  let mapNext = 1;

  function renderLevelMap() {
    const next = Save.nextLevel();
    const nextY = CC.LevelMap.render(map, {
      next,
      completed: Save.progress.completed,
      icons: ICONS,
      onPlay: playLevel,
    });
    mapNextY = nextY;
    mapNext = next;
    $('#levels-stars').innerHTML = `${ICONS.star}<span>${Save.totalStars()}</span>`;

    // Bring the next playable level into view.
    requestAnimationFrame(() => {
      mapScroll.scrollTop = Math.max(0, nextY - mapScroll.clientHeight / 2);
      syncMapJump();
    });
  }

  // "Back to Level N" appears once the next level is well out of view.
  function syncMapJump() {
    const mid = mapScroll.scrollTop + mapScroll.clientHeight / 2;
    const away = Math.abs(mid - mapNextY) > mapScroll.clientHeight * 0.6;
    mapJump.hidden = !away;
    if (away) mapJump.textContent = `${mid > mapNextY ? '↑' : '↓'} Back to Level ${mapNext}`;
  }

  mapScroll.addEventListener('scroll', syncMapJump, { passive: true });
  mapJump.addEventListener('click', () => {
    mapScroll.scrollTo({ top: Math.max(0, mapNextY - mapScroll.clientHeight / 2), behavior: 'smooth' });
  });

  // ---- Stats: the paper's "Sports & Stats" page ----

  $('#btn-stats').addEventListener('click', () => showScreen('stats'));
  $('#btn-stats-back').addEventListener('click', () => showScreen('menu'));

  const fmtNum = (n) => Number(n || 0).toLocaleString('en-US');

  function hoursAndMinutes(ms) {
    const mins = Math.round((ms || 0) / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    return `${h} hr ${mins % 60} min`;
  }

  function statsHeadline(st, levels) {
    if (!st.wordsFound) return 'Solver Prepares for First Big Hunt';
    if (levels === 0) return `Promising Newcomer Finds ${fmtNum(st.wordsFound)} Words`;
    if (st.wordsFound >= 1000) return `Legend Passes ${fmtNum(st.wordsFound)} Words; Pencils Everywhere Salute`;
    if (st.bonusFound >= 10) return `Eagle-Eyed Solver Spots ${st.bonusFound} Secret Words`;
    return `Local Solver Finds ${fmtNum(st.wordsFound)} Words, Shows No Sign of Stopping`;
  }

  function renderStats() {
    const p = Save.progress;
    const st = p.stats;
    const done = Object.entries(p.completed);
    const levels = done.length;
    const stars = Save.totalStars();
    const perfect = done.filter(([, c]) => c.hints === 0).length;
    const fourStar = done.filter(([, c]) => c.stars >= 4).length;
    const fastest = done.filter(([, c]) => c.bestTime > 0).sort((a, b) => a[1].bestTime - b[1].bestTime)[0];
    const papers = Object.keys(p.daily).length;
    const streak = Save.dailyStreak();
    const best = Math.max(st.bestStreak || 0, streak);

    // Last 28 days of Today's Paper, oldest first, ending today.
    const days = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = CC.todayKey(d);
      days.push(
        `<span class="cal-day${p.daily[key] ? ' solved' : ''}${i === 0 ? ' today' : ''}" title="${d.toDateString()}">${d.getDate()}</span>`
      );
    }

    const tile = (value, label, cls) => `<div class="stat-tile ${cls || ''}"><b>${value}</b><span>${label}</span></div>`;
    const row = (label, value) => `<div class="stat-row"><dt>${label}</dt><dd>${value}</dd></div>`;

    $('#stats-page').innerHTML = `
      <header class="sp-head">
        <span class="sp-paper">The Crazy WordSearch Times</span>
        <span class="sp-section">Sports &amp; Stats</span>
        <span class="sp-date">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
      </header>
      <h3 class="sp-headline">${statsHeadline(st, levels)}</h3>
      ${rankPanelHtml()}
      <div class="stat-tiles">
        ${tile(fmtNum(st.wordsFound), 'Words found', 't-coral')}
        ${tile(fmtNum(levels), levels === 1 ? 'Level finished' : 'Levels finished', 't-teal')}
        ${tile(`${ICONS.star}${fmtNum(stars)}`, 'Stars earned', 't-sun')}
      </div>
      <div class="sp-columns">
        <section class="sp-box">
          <h4>Records</h4>
          <dl>
            ${row('Bonus words spotted', fmtNum(st.bonusFound))}
            ${row('Perfect levels (no hints)', fmtNum(perfect))}
            ${row('4-star levels', fmtNum(fourStar))}
            ${row('Fastest level', fastest ? `Level ${fastest[0]} · ${CC.formatTime(fastest[1].bestTime)}` : '—')}
            ${row('Time spent puzzling', hoursAndMinutes(st.playMs))}
            ${row('Hints used', fmtNum(st.hintsUsed))}
            ${row('Coffees drunk', fmtNum(st.coffeeUsed))}
            ${row('Coffee cups in hand', fmtNum(p.coffee))}
          </dl>
        </section>
        <section class="sp-box">
          <h4>Today’s Paper</h4>
          <div class="daily-nums">
            <div><b>${streak}</b><span>day streak</span></div>
            <div><b>${best}</b><span>best streak</span></div>
            <div><b>${papers}</b><span>papers solved</span></div>
          </div>
          <div class="cal-grid" aria-label="Papers solved in the last four weeks">${days.join('')}</div>
          <p class="cal-key"><span class="cal-day solved">✓</span> solved · last 4 weeks</p>
        </section>
      </div>
      <div class="sp-mascot">
        <img src="assets/img/mascot.png" alt="" width="96" height="96">
        <p>${
          st.wordsFound
            ? `${fmtNum(st.wordsFound)} words found! That’s a lot of looking. Proud of you!`
            : 'Your stats will fill up as you play. Let’s find some words!'
        }</p>
      </div>`;
  }

  // ---- Pause ----

  function openPause() {
    if (current !== 'game' || isOpen('modal-pause') || isOpen('modal-complete')) return;
    CC.Game.pause();
    $('#pause-level').textContent = CC.isDaily(CC.Game.level) ? 'Today’s Paper' : 'Level ' + CC.Game.level;
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

  let completeTimers = [];

  function showComplete(result) {
    completeTimers.forEach(clearTimeout);
    completeTimers = [];
    $('#complete-note').classList.remove('bonus-note');
    const daily = result.daily;
    $('#complete-title').textContent = daily ? 'Today’s paper solved!' : `Level ${result.level} complete!`;
    $('#btn-next').textContent = daily ? 'Main Menu' : 'Next Level';
    $('#stat-time').textContent = CC.formatTime(result.time);
    $('#stat-hints').textContent = `${result.hints} of 2`;
    $('#stat-bonus').textContent = result.bonusTotal ? `${result.bonusFound} of ${result.bonusTotal}` : '—';
    $('#stat-bonus').parentElement.classList.toggle('all-bonus', !!result.bonusTotal && result.bonusFound === result.bonusTotal);
    const starsHost = $('#complete-stars');
    starsHost.classList.remove('four');
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
    showRankProgress(result);
    const promo = $('#complete-promotion');
    promo.hidden = !result.promotion;
    if (result.promotion) {
      const r = result.promotion;
      CC.Ranks.paint(promo, r);
      promo.classList.toggle('milestone', !!r.milestone);
      promo.dataset.tier = CC.Ranks.tierAttr(r);
      promo.innerHTML = promotionHtml(r);
      // Fires as the line pops in (its CSS animation starts at 2.2s).
      completeTimers.push(rankUpFanfare(r, promo.querySelector('.rank-badge'), 2500));
    }
    const note = $('#complete-note');
    note.textContent = result.stars >= 3 ? 'Solved without hints — perfect!' : 'Solve it without hints for 3 stars.';
    if (daily) {
      const streak = daily.streak > 1 ? ` ${daily.streak}-day streak!` : '';
      note.textContent = (daily.firstTime ? 'Today’s coffee is on the house: +1 cup.' : 'Come back tomorrow for a new paper.') + streak;
    }

    // The 4th star is never mentioned up front: it just appears after the other three.
    if (result.stars >= 4) {
      completeTimers.push(
        setTimeout(() => {
          const bonusStar = CC.el('span', 'big-star bonus-star');
          bonusStar.innerHTML = ICONS.holoStar;
          starsHost.classList.add('four');
          starsHost.appendChild(bonusStar);
          CC.Audio.sfx('bonus');
          setTimeout(() => {
            const r = bonusStar.getBoundingClientRect();
            CC.Effects.burst(r.left + r.width / 2, r.top + r.height / 2, 34, 'gold');
          }, 350);
          note.textContent = 'Bonus star! Your hidden-word find earned a 4th star.';
          note.classList.add('bonus-note');
        }, 2400)
      );
    }
  }

  // Coffee brewing bar: fills by this level's share, and pours a cup when it tops out.
  let brewTimers = [];
  // On a first clear that didn't promote: how far this level moved you toward the next
  // rank. The bar grows from where it was before the level to where it is now.
  function showRankProgress(result) {
    const row = $('#complete-rank');
    const now = CC.Ranks.progress();
    row.hidden = !!(result.daily || result.promotion || !result.firstClear || !now.next || now.levelsToGo == null);
    if (row.hidden) return;
    const before = CC.Ranks.progress(CC.Ranks.levelsCompleted() - 1);
    CC.Ranks.paint(row, now.next);
    row.innerHTML = `<span class="rank-badge">${CC.Ranks.badgeHtml(now.current)}</span>
      <span class="rp-text"><small>${nextRankLine(now.next, now.levelsToGo)}</small>
        <span class="rp-bar"><span style="transform:scaleX(${before.fraction})"></span></span></span>
      <span class="rank-badge rp-next">${CC.Ranks.badgeHtml(now.next)}</span>`;
    const fill = row.querySelector('.rp-bar span');
    completeTimers.push(setTimeout(() => (fill.style.transform = `scaleX(${now.fraction})`), 1400));
  }

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

  $('#btn-next').addEventListener('click', () => {
    if (CC.isDaily(CC.Game.level)) {
      closeAllModals();
      showScreen('menu');
    } else {
      playLevel(Save.nextLevel());
    }
  });
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

  // ---- Backup: save progress to a file, or load it back ----

  const backupNote = $('#backup-note');
  $('#btn-backup-save').addEventListener('click', () => {
    const blob = new Blob([Save.exportBackup()], { type: 'application/json' });
    const a = document.createElement('a');
    const day = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = `crazy-wordsearch-backup-${day}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    backupNote.textContent = 'Backup saved to your Downloads folder.';
  });
  const backupFile = $('#backup-file');
  $('#btn-backup-load').addEventListener('click', () => backupFile.click());
  backupFile.addEventListener('change', () => {
    const file = backupFile.files && backupFile.files[0];
    backupFile.value = '';
    if (!file) return;
    file.text().then((text) => {
      if (!Save.importBackup(text)) {
        backupNote.textContent = "That file isn't a Crazy WordSearch backup. Pick the .json file you saved.";
        return;
      }
      backupNote.textContent = 'Backup restored! Reloading…';
      setTimeout(() => location.reload(), 700);
    });
  });

  function openSettings() {
    if (current === 'game') CC.Game.pause();
    openModal('modal-settings');
  }
  $('#btn-corner-settings').addEventListener('click', openSettings);

  // ---- Full screen ----

  const fsBtn = $('#btn-fullscreen');
  const FS_ICONS = {
    enter:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    exit:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const root = document.documentElement;
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;

  function syncFullscreenUi() {
    const on = !!fsElement();
    fsBtn.innerHTML = on ? FS_ICONS.exit : FS_ICONS.enter;
    fsBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
    fsBtn.title = on ? 'Exit full screen' : 'Full screen';
  }

  function toggleFullscreen() {
    try {
      if (fsElement()) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        const p = (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
        if (p && p.catch) p.catch(() => CC.toast("Full screen isn't available here"));
      }
    } catch (e) {
      CC.toast("Full screen isn't available here");
    }
  }

  if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
    fsBtn.hidden = false;
    fsBtn.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', syncFullscreenUi);
    document.addEventListener('webkitfullscreenchange', syncFullscreenUi);
    syncFullscreenUi();
  }

  // Soft click sound on every button press.
  document.addEventListener('click', (e) => {
    if (e.target.closest('button:not(.hint-btn):not(.mute-btn):not(.coffee-btn):not(.mascot)')) CC.Audio.sfx('tap');
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

  // ---- Hidden developer key: Page Up = instant rank-up ----
  // Outside a level, marks every level up to the next rank's unlock level as finished
  // (3 stars, no hints), then returns to the main menu, where the usual promotion plays.
  // Not mentioned anywhere in the game.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'PageUp' || e.repeat || current === 'game' || openModals.length) return;
    e.preventDefault();
    const { next } = CC.Ranks.progress();
    if (!next || !next.ready) {
      CC.toast(`Already ${CC.Ranks.current().name}: top rank`);
      return;
    }
    const P = Save.progress;
    for (let level = Save.nextLevel(); level <= next.levels; level++) {
      if (P.completed[level]) continue;
      CC.loadLevel(level); // draws the level's words like a real play, so later levels stay fresh
      P.completed[level] = { stars: 3, bestTime: 60000, hints: 0 };
      delete P.inProgress[level];
    }
    Save.saveProgress();
    if (current === 'menu') renderMenu(0);
    else showScreen('menu');
  });
})();
