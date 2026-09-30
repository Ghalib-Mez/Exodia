'use strict';

/* Cinematic storm FX for the Tempest Launcher.
 * back canvas  — fog blobs, rising embers, lightning bolt + screen flash
 * front canvas — rain streaks (in front of the glass UI, very subtle)
 * One RAF loop drives both. Pauses when the window is hidden and
 * renders nothing when the OS prefers reduced motion. */

(() => {
  const back = document.getElementById('storm-back');
  const front = document.getElementById('storm-front');
  if (!back || !front) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const bctx = back.getContext('2d');
  const fctx = front.getContext('2d');

  let W = 0, H = 0;
  let mx = 0.5, my = 0.5; // normalized mouse for parallax

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    for (const [c, ctx] of [[back, bctx], [front, fctx]]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    initDrops(); initFog(); initEmbers();
  }

  /* ------------------------------ rain ------------------------------- */
  let drops = [];
  function newDrop(anyY) {
    const depth = Math.random(); // 0 = far, 1 = near
    return {
      x: Math.random() * (W + 240) - 120,
      y: anyY ? Math.random() * H : -30 - Math.random() * 60,
      len: 9 + depth * 24,
      speed: 420 + depth * 720,
      drift: 60 + depth * 90,
      alpha: 0.05 + depth * 0.15,
      w: depth > 0.75 ? 1.5 : 1,
    };
  }
  function initDrops() {
    drops = Array.from({ length: Math.round(W / 4) }, () => newDrop(true));
  }

  /* ------------------------------ fog -------------------------------- */
  let fog = [];
  function initFog() {
    fog = Array.from({ length: 7 }, () => ({
      x: Math.random() * W,
      y: H * (0.2 + Math.random() * 0.75),
      r: 240 + Math.random() * 440,
      vx: (Math.random() * 2 - 1) * 9,
      vy: (Math.random() * 2 - 1) * 3.5,
      hue: 218 + Math.random() * 26,
      alpha: 0.045 + Math.random() * 0.05,
    }));
  }

  /* ----------------------------- embers ------------------------------ */
  let embers = [];
  function newEmber(anyY) {
    return {
      x: Math.random() * W,
      y: anyY ? Math.random() * H : H + 12,
      r: 0.8 + Math.random() * 1.8,
      vy: -(14 + Math.random() * 32),
      vx: (Math.random() * 2 - 1) * 14,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.22 + Math.random() * 0.42,
    };
  }
  function initEmbers() {
    embers = Array.from({ length: 26 }, () => newEmber(true));
  }

  /* ---------------------------- lightning ---------------------------- */
  let flash = 0;                        // 0..1 whole-screen glow
  let bolt = null;                      // { pts, t, life }
  let nextBolt = 3 + Math.random() * 6; // seconds until first bolt

  function makeBolt() {
    const pts = [];
    let x = W * (0.15 + Math.random() * 0.7);
    let y = -20;
    const endY = H * (0.45 + Math.random() * 0.4);
    while (y < endY) {
      pts.push([x, y]);
      y += 14 + Math.random() * 30;
      x += (Math.random() * 2 - 1) * 44;
    }
    pts.push([x, y]);
    return { pts, t: 0, life: 0.32 + Math.random() * 0.26 };
  }

  /* ------------------------------ loop ------------------------------- */
  let rafId = 0;
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const px = (mx - 0.5) * 18, py = (my - 0.5) * 10; // parallax shift

    /* ----- back canvas ----- */
    bctx.clearRect(0, 0, W, H);

    // fog
    for (const f of fog) {
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x < -f.r) f.x = W + f.r; else if (f.x > W + f.r) f.x = -f.r;
      if (f.y < -f.r) f.y = H + f.r; else if (f.y > H + f.r) f.y = -f.r;
      const g = bctx.createRadialGradient(f.x + px, f.y + py, 0, f.x + px, f.y + py, f.r);
      g.addColorStop(0, `hsla(${f.hue}, 32%, 56%, ${f.alpha})`);
      g.addColorStop(1, 'hsla(220, 32%, 56%, 0)');
      bctx.fillStyle = g;
      bctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }

    // embers
    for (const e of embers) {
      e.phase += dt * 2;
      e.x += (e.vx + Math.sin(e.phase) * 9) * dt;
      e.y += e.vy * dt;
      if (e.y < -12) Object.assign(e, newEmber(false));
      const tw = 0.6 + 0.4 * Math.sin(e.phase * 1.7);
      bctx.beginPath();
      bctx.fillStyle = `rgba(255, 176, 66, ${e.alpha * tw})`;
      bctx.arc(e.x + px * 0.4, e.y + py * 0.4, e.r, 0, Math.PI * 2);
      bctx.fill();
    }

    // lightning
    nextBolt -= dt;
    if (nextBolt <= 0) {
      bolt = makeBolt();
      flash = 0.5 + Math.random() * 0.4;
      nextBolt = 5 + Math.random() * 11;
    }
    if (bolt) {
      bolt.t += dt;
      const k = 1 - bolt.t / bolt.life;
      if (k <= 0) {
        bolt = null;
      } else {
        const fl = k * (0.55 + 0.45 * Math.sin(bolt.t * 90)); // flicker
        bctx.save();
        bctx.beginPath();
        bolt.pts.forEach(([x, y], i) => (i ? bctx.lineTo(x, y) : bctx.moveTo(x, y)));
        bctx.shadowColor = 'rgba(160, 200, 255, 0.9)';
        bctx.shadowBlur = 20;
        bctx.lineJoin = 'round';
        bctx.strokeStyle = `rgba(190, 215, 255, ${fl * 0.85})`;
        bctx.lineWidth = 2.4;
        bctx.stroke();
        bctx.shadowBlur = 0;
        bctx.strokeStyle = `rgba(255, 255, 255, ${fl})`;
        bctx.lineWidth = 0.9;
        bctx.stroke();
        bctx.restore();
      }
    }
    if (flash > 0.004) {
      flash *= Math.pow(0.02, dt); // fast decay
      const g = bctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(190, 215, 255, ${flash * 0.3})`);
      g.addColorStop(1, `rgba(190, 215, 255, ${flash * 0.08})`);
      bctx.fillStyle = g;
      bctx.fillRect(0, 0, W, H);
    }

    /* ----- front canvas: rain ----- */
    fctx.clearRect(0, 0, W, H);
    fctx.lineCap = 'round';
    for (const d of drops) {
      d.y += d.speed * dt;
      d.x += d.drift * dt;
      if (d.y > H + 30) Object.assign(d, newDrop(false));
      fctx.strokeStyle = `rgba(173, 195, 230, ${d.alpha})`;
      fctx.lineWidth = d.w;
      fctx.beginPath();
      fctx.moveTo(d.x, d.y);
      fctx.lineTo(d.x - d.drift * (d.len / d.speed), d.y - d.len);
      fctx.stroke();
    }

    rafId = requestAnimationFrame(frame);
  }

  function start() {
    cancelAnimationFrame(rafId);
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => {
    mx = e.clientX / Math.max(1, W);
    my = e.clientY / Math.max(1, H);
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(rafId);
    else start();
  });

  resize();
  start();
})();
