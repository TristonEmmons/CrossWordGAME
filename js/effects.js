/* Canvas confetti/particle bursts and small toast messages. */
(function () {
  'use strict';

  const CC = window.CC;
  const COLORS = ['#ff6b5b', '#1fa3a3', '#ffc145', '#ffffff'];

  const canvas = document.getElementById('fx-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let frame = 0;
  let lastTime = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  function tick(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles = particles.filter((p) => p.life > 0);
    particles.forEach((p) => {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      const alpha = Math.min(1, p.life / 0.5);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    ctx.globalAlpha = 1;

    if (particles.length) {
      frame = requestAnimationFrame(tick);
    } else {
      frame = 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function start() {
    if (!frame) {
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  CC.Effects = {
    // Small burst at a point (e.g. the centre of a found word).
    burst(x, y, count) {
      const n = count || 26;
      for (let i = 0; i < n; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 120 + Math.random() * 260;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 80,
          gravity: 420,
          drag: 0.97,
          size: 5 + Math.random() * 5,
          color: COLORS[i % COLORS.length],
          shape: Math.random() < 0.5 ? 'rect' : 'dot',
          rot: Math.random() * 6,
          spin: (Math.random() - 0.5) * 12,
          life: 0.8 + Math.random() * 0.5,
        });
      }
      start();
    },

    // Big celebration: confetti cannons from both lower corners plus a top shower.
    celebrate() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cannon = (x, dir) => {
        for (let i = 0; i < 110; i++) {
          const angle = -Math.PI / 2 + dir * (0.25 + Math.random() * 0.55);
          const speed = 600 + Math.random() * 650;
          particles.push({
            x,
            y: h + 10,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            gravity: 700,
            drag: 0.985,
            size: 7 + Math.random() * 7,
            color: COLORS[i % COLORS.length],
            shape: Math.random() < 0.7 ? 'rect' : 'dot',
            rot: Math.random() * 6,
            spin: (Math.random() - 0.5) * 14,
            life: 2.2 + Math.random() * 1.4,
          });
        }
      };
      cannon(0, 1);
      cannon(w, -1);
      for (let i = 0; i < 90; i++) {
        particles.push({
          x: Math.random() * w,
          y: -20 - Math.random() * 200,
          vx: (Math.random() - 0.5) * 80,
          vy: 80 + Math.random() * 120,
          gravity: 120,
          drag: 0.99,
          size: 6 + Math.random() * 6,
          color: COLORS[i % COLORS.length],
          shape: 'rect',
          rot: Math.random() * 6,
          spin: (Math.random() - 0.5) * 10,
          life: 3 + Math.random() * 1.5,
        });
      }
      start();
    },

    clear() {
      particles = [];
    },
  };

  // ---- Toasts ----
  const toastHost = document.getElementById('toasts');
  let lastToastText = '';
  let lastToastAt = 0;

  CC.toast = function (text, kind) {
    const now = performance.now();
    if (text === lastToastText && now - lastToastAt < 1500) return;
    lastToastText = text;
    lastToastAt = now;
    const node = CC.el('div', 'toast' + (kind ? ' toast-' + kind : ''), text);
    toastHost.appendChild(node);
    // Keep at most three on screen.
    while (toastHost.children.length > 3) toastHost.firstChild.remove();
    setTimeout(() => node.classList.add('leaving'), 1700);
    setTimeout(() => node.remove(), 2100);
  };
})();
