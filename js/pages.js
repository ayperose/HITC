// HITC inner pages: About, Contact and Careers.
// Portions adapted from third-party code under the MIT licence with the Commons Clause: see /licenses.txt
// Vanilla ports of: Rotating Text, Fold Text, Tear Ticket and Halftone Reveal. Every piece moves only transform
// and opacity (Halftone Reveal draws on a canvas), shows its final state under prefers-reduced-motion, and none
// keeps a frame loop running when idle.

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const say = (el, text) => { if (el) el.textContent = text; };

/* ---------- Rotating Text: one word slides up and out as the next slides in (upstream's "slide"
   effect, rotationInterval 2000 ms, spring in). The box keeps the longest word's width instead of animating
   width. Under reduced motion the full sentence stays. ---------- */
function rotatingText(el, { interval = 2200 } = {}) {
  const words = $$('.rot__word', el);
  if (words.length < 2 || reduce) return;
  let i = 0, timer = 0, seen = true;
  words.forEach((w, n) => w.classList.add(n ? 'is-next' : 'is-in'));
  const next = () => {
    const cur = words[i];
    i = (i + 1) % words.length;
    const nw = words[i];
    cur.classList.replace('is-in', 'is-out');
    nw.classList.remove('is-out');
    nw.classList.add('is-next');
    nw.getBoundingClientRect();
    nw.classList.replace('is-next', 'is-in');
    setTimeout(() => { cur.classList.replace('is-out', 'is-next'); }, 600);
  };
  const run = () => { clearInterval(timer); if (seen && !document.hidden) timer = setInterval(next, interval); };
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; run(); }).observe(el);
  document.addEventListener('visibilitychange', run);
}

/* ---------- Fold Text: the letters unfold from a top hinge once, on load (upstream's paper fold:
   92 deg, 0.65 s, 0.045 s stagger, power3.out). The sentence stays readable to screen readers. ---------- */
function foldText(el, { duration = 650, stagger = 45, angle = 92 } = {}) {
  if (reduce || !el.animate) return;
  const text = el.textContent.trim().replace(/\s+/g, ' ');
  el.setAttribute('aria-label', text);
  el.textContent = '';
  let n = 0;
  text.split(' ').forEach((word, wi) => {
    if (wi) el.append(' ');
    const w = document.createElement('span');
    w.className = 'fold__word';
    w.setAttribute('aria-hidden', 'true');
    for (const ch of word) {
      const c = document.createElement('span');
      c.className = 'fold__char';
      c.textContent = ch;
      w.appendChild(c);
      c.animate([{ transform: `rotateX(${angle}deg)`, opacity: 0 }, { transform: 'rotateX(0deg)', opacity: 1 }], { duration, delay: 120 + n * stagger, easing: 'cubic-bezier(.215,.61,.355,1)', fill: 'backwards' });
      n += 1;
    }
    el.appendChild(w);
  });
}

/* ---------- Tear Ticket: every tab along the flyer's foot is a small ticket stub (upstream's vertical
   orientation, tearAngle 30, resistance 0.45). Pulling a tab turns it about its far top corner; the paper bridges
   between the perforation holes snap one by one, nearest the pull first, with fibres stretched across the gap;
   then the tab follows the pointer and drops away when let go. The flyer swings on its pin as the paper gives.
   A torn tab copies the email; a plain click on a tab opens it. Under reduced motion a 28 px pull tears at once.
   The maths runs in the flyer's own (rotated) frame, so it holds at any resting angle. ---------- */
const EMAIL = 'careers@hitc.ph';
function tearTabs(board, { holes = 4, hole = 3, stretch = 12, tearAngle = 30, resistance = 0.45, gravity = 2400 } = {}) {
  const flyer = $('.flyer', board), strip = flyer && $('.flyer__tabs', flyer);
  if (!strip) return;
  const pin = $('.flyer__pin', flyer), fibres = $('.flyer__fibres', strip), hint = $('.board__hint span', board);
  const NS = 'http://www.w3.org/2000/svg';
  const limit = (tearAngle * Math.PI) / 180;
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const live = new Set();
  let raf = 0, last = 0, sw = 0, swv = 0, pull = 0, copied = false;
  if (hint && !fine && board.querySelector('[data-touch]')) hint.textContent = board.querySelector('[data-touch]').dataset.touch;

  // the flyer's angle and the pin's place on screen, to turn screen points into strip coordinates
  const frame = () => {
    const a = ((parseFloat(getComputedStyle(flyer).getPropertyValue('--tilt')) || 0) + sw) * Math.PI / 180;
    const r = pin.getBoundingClientRect();
    return { a, px: r.left + r.width / 2, py: r.top + r.height / 2, ox: pin.offsetLeft + pin.offsetWidth / 2 - strip.offsetLeft, oy: pin.offsetTop + pin.offsetHeight / 2 - strip.offsetTop };
  };
  const local = (e) => {
    const f = frame(), dx = e.clientX - f.px, dy = e.clientY - f.py, c = Math.cos(-f.a), s = Math.sin(-f.a);
    return { x: f.ox + dx * c - dy * s, y: f.oy + dx * s + dy * c };
  };

  // a torn tab is the email in the visitor's hand: copy it, and say so
  const taken = () => {
    if (copied) return;
    const miss = () => say(hint, `our email is ${EMAIL}`);
    try { navigator.clipboard.writeText(EMAIL).then(() => { copied = true; say(hint, `${EMAIL} is copied, paste it into your email`); }, miss); } catch { miss(); }
  };
  const lip = (t) => {
    const el = document.createElement('i');
    el.className = 'flyer__lip';
    el.style.left = `${t.x0}px`;
    el.style.width = `${t.w}px`;
    const pts = ['0 0', '100% 0'];
    for (let k = 10; k >= 0; k--) pts.push(`${k * 10}% ${(30 + Math.random() * 70).toFixed(0)}%`);
    el.style.clipPath = `polygon(${pts.join(',')})`;
    strip.appendChild(el);
  };
  const gone = (t) => {
    t.el.style.visibility = 'hidden';
    t.el.style.pointerEvents = 'none';
    t.used = true;
    lip(t);
    t.paths.forEach((p) => p.remove());
    t.paths = [];
  };

  const paint = (t, now) => {
    const ang = t.theta * t.sign, c = Math.cos(ang), s = Math.sin(ang);
    t.el.style.transform = `translate(${t.sx.toFixed(2)}px,${t.sy.toFixed(2)}px) rotate(${ang.toFixed(4)}rad)`;
    t.el.style.opacity = t.fade.toFixed(3);
    let busy = false;
    const hx = t.x0 + t.hx;
    t.bridges.forEach((b, i) => {
      const near = t.paths[i * 2], far = t.paths[i * 2 + 1];
      const ox = t.x0 + b, dx = b - t.hx;
      const tx = hx + dx * c + t.sx, ty = dx * s + t.sy;
      const gx = tx - ox, gy = ty, gap = Math.hypot(gx, gy);
      const on = t.phase !== 'idle';
      if (!t.snapped[i]) {
        if (!on || gap < 0.35) { near.style.opacity = far.style.opacity = '0'; return; }
        const k = clamp(gap / stretch, 0, 1), sag = gap * 0.18, w = (1.7 - 1.15 * k).toFixed(2);
        near.setAttribute('d', `M${(ox - 1.6).toFixed(2)},0Q${(ox - 1.6 + sag + gx / 2).toFixed(2)},${(gy / 2).toFixed(2)} ${(tx - 1.6).toFixed(2)},${ty.toFixed(2)}`);
        far.setAttribute('d', `M${(ox + 1.6).toFixed(2)},0Q${(ox + 1.6 + gx / 2 - sag).toFixed(2)},${(gy / 2).toFixed(2)} ${(tx + 1.6).toFixed(2)},${ty.toFixed(2)}`);
        near.style.strokeWidth = far.style.strokeWidth = w;
        near.style.opacity = far.style.opacity = '1';
        t.span[i] = gap;
        return;
      }
      const u = (now - t.snapAt[i]) / 170;
      if (u >= 1) { near.style.opacity = far.style.opacity = '0'; return; }
      busy = true;
      const left = (1 - u) * (1 - u), len = (t.span[i] || stretch) * 0.5 * left;
      const ux = gap > 0.01 ? gx / gap : 0, uy = gap > 0.01 ? gy / gap : 1;
      near.setAttribute('d', `M${ox.toFixed(2)},0L${(ox + ux * len).toFixed(2)},${(uy * len).toFixed(2)}`);
      far.setAttribute('d', `M${tx.toFixed(2)},${ty.toFixed(2)}L${(tx - ux * len).toFixed(2)},${(ty - uy * len).toFixed(2)}`);
      near.style.strokeWidth = far.style.strokeWidth = '0.9';
      near.style.opacity = far.style.opacity = left.toFixed(2);
    });
    return busy;
  };

  const step = (now) => {
    const dt = clamp((now - last) / 1000, 0.001, 0.034);
    last = now;
    pull = 0;
    for (const t of live) {
      if (t.hx === null && !(t.phase === 'held' && hinge(t))) {
        if (t.phase !== 'held') { t.phase = 'idle'; t.paths.forEach((p) => p.remove()); t.paths = []; live.delete(t); }
        continue;
      }
      if (t.phase === 'held') {
        const intact = t.bridges.filter((_, i) => !t.snapped[i]).length;
        const follow = 0.92 * (1 - resistance * (intact / t.bridges.length));
        const a = Math.atan2(t.point.y, t.point.x - (t.x0 + t.hx));
        const want = clamp(wrapA(a - t.a0) * t.sign * follow, 0, limit + 0.1);
        t.theta += (want - t.theta) * (1 - Math.exp(-dt / 0.035));
        const px = clamp((t.point.x - t.start.x) * 0.05, -3, 3), py = clamp((t.point.y - t.start.y) * 0.05, -2, 5);
        t.sx += (px - t.sx) * (1 - Math.exp(-dt / 0.05));
        t.sy += (py - t.sy) * (1 - Math.exp(-dt / 0.05));
        const slack = Math.hypot(t.sx, t.sy), reach = Math.hypot(t.point.x - t.start.x, t.point.y - t.start.y);
        // a tab is tall and narrow, so its far corner barely turns: once most of the perforation has gone and the
        // pull keeps up, the tear runs on through the rest, one bridge at a time; a long pull always tears it
        const runs = intact <= t.bridges.length / 2 && (t.theta > limit * 0.4 || reach > 60) && now - (t.lastSnap || 0) > 45;
        let left = 0, ran = false;
        t.bridges.map((b, i) => [Math.abs(b - t.hx), i]).sort((p, q) => q[0] - p[0]).forEach(([d, i]) => {
          if (t.snapped[i]) return;
          const runOn = runs && !ran;
          if (2 * d * Math.sin(t.theta / 2) + slack > stretch || t.theta >= limit || reach > 150 || runOn) {
            if (runOn) ran = true;
            t.snapped[i] = true;
            t.snapAt[i] = t.lastSnap = now;
            swv -= (t.lever * 26) / t.bridges.length;
          } else left += 1;
        });
        if (!left) { t.phase = 'free'; swv -= t.lever * 10; }
        else pull += t.lever * (t.theta / limit) * 2.2;
      } else if (t.phase === 'free') {
        const c = Math.cos(t.theta * t.sign), s = Math.sin(t.theta * t.sign);
        const gx = t.grab.x - (t.x0 + t.hx), gy = t.grab.y;
        const wx = t.point.x - (t.x0 + t.hx) - (gx * c - gy * s), wy = t.point.y - (gx * s + gy * c);
        t.sx += (wx - t.sx) * (1 - Math.exp(-dt / 0.045));
        t.sy += (wy - t.sy) * (1 - Math.exp(-dt / 0.045));
        const hang = limit * 0.55 + clamp(t.pvx * 0.0009 * t.sign, -0.3, 0.3);
        t.theta += (hang - t.theta) * (1 - Math.exp(-dt / 0.12));
      } else if (t.phase === 'drop') {
        t.age += dt;
        t.vy += gravity * dt;
        t.sx += t.vx * dt;
        t.sy += t.vy * dt;
        t.theta += t.spin * dt;
        if (t.age > 0.16) t.fade = clamp(1 - (t.age - 0.16) / 0.36, 0, 1);
        if (t.fade <= 0) { gone(t); live.delete(t); continue; }
      } else if (t.phase === 'return') {
        t.thetaV += (-300 * t.theta - 24 * t.thetaV) * dt;
        t.theta += t.thetaV * dt;
        t.sx += -t.sx * (1 - Math.exp(-dt / 0.07));
        t.sy += -t.sy * (1 - Math.exp(-dt / 0.07));
        if (Math.abs(t.theta) < 0.0008 && Math.abs(t.thetaV) < 0.01 && Math.hypot(t.sx, t.sy) < 0.05) {
          Object.assign(t, { theta: 0, thetaV: 0, sx: 0, sy: 0, phase: 'idle' });
        }
      }
      const busy = paint(t, now);
      if (t.phase === 'idle' && !busy) {
        t.el.style.transform = t.el.style.zIndex = '';
        t.paths.forEach((p) => p.remove());
        t.paths = [];
        live.delete(t);
      }
    }
    // the flyer swings on its pin: pulled toward the tab while the paper holds, kicked back as it gives
    if (reduce) pull = swv = 0;
    swv += (-70 * (sw - pull) - 7 * swv) * dt;
    sw += swv * dt;
    const moving = Math.abs(sw) > 0.004 || Math.abs(swv) > 0.02;
    flyer.style.setProperty('--swing', `${(moving ? sw : 0).toFixed(3)}deg`);
    raf = live.size || moving ? requestAnimationFrame(step) : 0;
    if (!raf) { sw = 0; swv = 0; }
  };
  const run = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } };

  // where the grab sits on the tab as it is turned now, and the angle the pull starts from
  const hold = (t) => {
    const ang = -t.theta * t.sign, c = Math.cos(ang), s = Math.sin(ang), hx = t.x0 + t.hx;
    const ux = t.point.x - t.sx - hx, uy = t.point.y - t.sy;
    t.grab = { x: hx + ux * c - uy * s, y: ux * s + uy * c };
    t.a0 = Math.atan2(t.grab.y, t.grab.x - hx) - (t.theta * t.sign) / 0.92;
  };
  // the tab turns about whichever top corner the pull opens it from hardest: straight down, the far corner
  // (the near side gives first); pulled sideways, the corner on the side it is pulled toward
  const hinge = (t) => {
    const fx = t.point.x - t.start.x, fy = t.point.y - t.start.y;
    if (Math.hypot(fx, fy) < 4) return false;
    const gx = t.start.x - t.x0, gy = t.start.y;
    const right = -((gx - t.w) * fy - gy * fx), left = gx * fy - gy * fx;
    const r = right > left;
    Object.assign(t, { hx: r ? t.w : 0, sign: r ? -1 : 1, point: t.start });
    t.el.style.transformOrigin = `${t.hx}px 0px`;
    hold(t);
    t.point = { x: t.start.x + fx, y: t.start.y + fy };
    return true;
  };

  const tabs = $$('.flyer__tab', strip).map((el) => ({ el, used: false, phase: 'idle', id: null, paths: [], theta: 0, hx: null }));
  tabs.forEach((t) => {
    const { el } = t;
    el.addEventListener('dragstart', (e) => e.preventDefault());
    el.addEventListener('click', (e) => { if (t.dragged) e.preventDefault(); });
    el.addEventListener('pointerdown', (e) => {
      if (t.used || e.button !== 0 || t.id !== null || t.phase === 'drop') return;
      try { el.setPointerCapture(e.pointerId); } catch {}
      const p = local(e);
      t.id = e.pointerId;
      t.dragged = false;
      Object.assign(t, { start: p, point: p, pt: performance.now(), pvx: 0, pvy: 0 });
      const w = el.offsetWidth, x0 = el.offsetLeft;
      if (!t.bridges || w !== t.w || x0 !== t.x0) { // the perforation; bridges already snapped stay snapped
        const bridge = Math.max(2, (w - holes * hole) / (holes + 1));
        Object.assign(t, {
          w, x0, snapped: [], snapAt: [], span: [],
          bridges: Array.from({ length: holes + 1 }, (_, i) => i * (bridge + hole) + bridge / 2),
          lever: ((x0 + w / 2) / strip.offsetWidth - 0.5) * 2,
        });
      }
      if (!t.paths.length) t.paths = t.bridges.flatMap(() => [0, 1].map(() => fibres.appendChild(document.createElementNS(NS, 'path'))));
      if (t.theta < 0.01) Object.assign(t, { hx: null, theta: 0, thetaV: 0, sx: 0, sy: 0, fade: 1, age: 0 }); // hinge chosen once the pull has a direction
      else hold(t);
      t.phase = 'held';
      el.style.zIndex = '2'; // over its neighbours while it moves
      board.dataset.grabbing = '';
      live.add(t);
      run();
    });
    el.addEventListener('pointermove', (e) => {
      if (t.id !== e.pointerId) return;
      const p = local(e), now = performance.now(), dt = Math.max(0.004, (now - t.pt) / 1000);
      t.pvx += ((p.x - t.point.x) / dt - t.pvx) * 0.35;
      t.pvy += ((p.y - t.point.y) / dt - t.pvy) * 0.35;
      t.pt = now;
      t.point = p;
      const moved = Math.hypot(p.x - t.start.x, p.y - t.start.y);
      if (moved > 6) t.dragged = true;
      if (reduce && moved > 28) { // tear at once
        t.id = null;
        delete board.dataset.grabbing;
        live.delete(t);
        gone(t);
        t.el.style.transform = '';
        taken();
      }
    });
    const up = (e) => {
      if (t.id !== e.pointerId) return;
      t.id = null;
      try { if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); } catch {}
      delete board.dataset.grabbing;
      if (t.phase === 'free') {
        const still = performance.now() - t.pt > 80;
        t.vx = still ? 0 : clamp(t.pvx, -1600, 1600);
        t.vy = still ? 0 : clamp(t.pvy, -1600, 1200);
        t.spin = clamp(t.vx * 0.004, -6, 6) + 1.2 * t.sign;
        t.age = 0;
        t.phase = 'drop';
        taken();
      } else if (t.phase === 'held') t.phase = 'return';
      run();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  });
}

/* ---------- Halftone Reveal: the photo is printed as a halftone, navy dots on paper; the pointer (or a tap)
   brings the colour photo through, and the dots close over it again. Upstream draws this in a WebGL shader;
   here it is canvas 2D: the dots are drawn once per size, and frames run only while a reveal is fading.
   Under reduced motion the colour photo simply shows. ---------- */
function halftone(fig, { cell = 5.5, radius = 72, fade = 0.045, ink = '22,36,79', paper = '253,253,251' } = {}) {
  const frame = $('.ht__frame', fig), img = frame && $('img', frame);
  if (reduce || !img) return;
  const view = document.createElement('canvas');
  view.setAttribute('aria-hidden', 'true');
  const dots = document.createElement('canvas'), mask = document.createElement('canvas');
  const v = view.getContext('2d'), d = dots.getContext('2d'), m = mask.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0, idle = 0, last = null;
  const draw = () => {
    v.globalCompositeOperation = 'copy';
    v.drawImage(dots, 0, 0);
    v.globalCompositeOperation = 'destination-out';
    v.drawImage(mask, 0, 0);
    v.globalCompositeOperation = 'source-over';
  };
  const build = () => {
    const r = frame.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.round(r.width * dpr); H = Math.round(r.height * dpr);
    if (!W || !H || !img.naturalWidth) return;
    for (const c of [view, dots, mask]) { c.width = W; c.height = H; }
    // one sample per dot, from the part of the photo that object-fit: cover shows
    const c = Math.max(4, Math.min(cell, r.width / 90)) * dpr, cols = Math.ceil(W / c) + 1, rows = Math.ceil(H / c) + 1; // finer dots on small screens
    const s = document.createElement('canvas');
    s.width = cols; s.height = rows;
    const sx = s.getContext('2d', { willReadFrequently: true });
    sx.imageSmoothingQuality = 'high';
    const k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const sw = (cols * c) / k, sh = (rows * c) / k;
    sx.drawImage(img, (img.naturalWidth - W / k) / 2, (img.naturalHeight - H / k) / 2, sw, sh, 0, 0, cols, rows);
    const px = sx.getImageData(0, 0, cols, rows).data;
    d.fillStyle = `rgb(${paper})`;
    d.fillRect(0, 0, W, H);
    d.fillStyle = `rgb(${ink})`;
    d.beginPath();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const lum = Math.pow((0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255, 0.62); // lifts the dim office light
        const dark = clamp((1 - lum) * 1.12 - 0.03, 0, 1);
        const rad = c * 0.6 * Math.sqrt(dark);
        if (rad < 0.35) continue;
        const cx = (x + 0.5 + (y % 2) * 0.5) * c, cy = (y + 0.5) * c; // every other row offset: a 45 degree screen
        d.moveTo(cx + rad, cy);
        d.arc(cx, cy, rad, 0, Math.PI * 2);
      }
    }
    d.fill();
    draw();
    if (!view.isConnected) frame.appendChild(view);
  };
  const loop = () => {
    m.globalCompositeOperation = 'destination-out';
    m.fillStyle = `rgba(0,0,0,${fade})`;
    m.fillRect(0, 0, W, H);
    m.globalCompositeOperation = 'source-over';
    idle += 1;
    if (idle > 110) { m.clearRect(0, 0, W, H); raf = 0; } else raf = requestAnimationFrame(loop);
    draw();
  };
  const kick = () => { idle = 0; if (!raf) raf = requestAnimationFrame(loop); };
  const stamp = (x, y, r, a) => {
    const g = m.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(0.5, `rgba(0,0,0,${a * 0.8})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = g;
    m.beginPath();
    m.arc(x, y, r, 0, Math.PI * 2);
    m.fill();
  };
  const at = (e) => { const r = frame.getBoundingClientRect(); return [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr]; };
  frame.addEventListener('pointermove', (e) => {
    if (!W) return;
    const [x, y] = at(e), r = radius * dpr;
    if (last) {
      const dx = x - last[0], dy = y - last[1], n = Math.min(24, Math.ceil(Math.hypot(dx, dy) / (r * 0.25)));
      for (let i = 1; i <= n; i++) stamp(last[0] + (dx * i) / n, last[1] + (dy * i) / n, r, 0.55);
    } else stamp(x, y, r, 0.55);
    last = [x, y];
    kick();
  });
  frame.addEventListener('pointerleave', () => { last = null; });
  frame.addEventListener('pointerdown', (e) => {
    if (!W) return;
    const [x, y] = at(e);
    stamp(x, y, radius * dpr * 1.9, 1);
    last = null;
    kick();
  });
  let queued = 0;
  new ResizeObserver(() => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; build(); }); }).observe(frame);
  if (img.complete && img.naturalWidth) build(); else img.addEventListener('load', build, { once: true });
  const hint = $('.ht__hint', fig.parentElement);
  if (hint && !fine && hint.dataset.touch) hint.textContent = hint.dataset.touch;
}

/* ═════════════════ the pages ═════════════════ */

// About: the years fill in as they are scrolled past, transform only.
function years() {
  const items = $$('.year');
  if (!items.length || reduce) return;
  let raf = 0;
  const update = () => {
    raf = 0;
    const h = innerHeight;
    items.forEach((y) => {
      const r = y.getBoundingClientRect();
      const p = clamp((h * 0.92 - r.top) / (h * 0.45), 0, 1);
      y.style.setProperty('--p', p.toFixed(3));
    });
  };
  update();
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  addEventListener('resize', update);
}

// Contact: open or closed right now, on Tuguegarao time.
function openNow() {
  const el = $('[data-open]');
  if (!el) return;
  const HOURS = { Mon: [8, 17], Tue: [8, 17], Wed: [8, 17], Thu: [8, 17], Fri: [8, 17], Sat: [8, 12], Sun: null };
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const NAMES = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
  const fmt = (h) => (h === 12 ? '12 noon' : h > 12 ? `${h - 12} PM` : `${h} AM`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  const day = parts.weekday, hour = Number(parts.hour) + Number(parts.minute) / 60;
  const today = HOURS[day];
  const text = $('.open__text', el);
  if (today && hour >= today[0] && hour < today[1]) {
    el.classList.add('is-open');
    text.textContent = `Open now, until ${fmt(today[1])}`;
  } else if (today && hour < today[0]) {
    text.textContent = `Closed now. Opens today at ${fmt(today[0])}`;
  } else {
    let i = DAYS.indexOf(day), k = 0;
    do { i = (i + 1) % 7; k += 1; } while (!HOURS[DAYS[i]]);
    text.textContent = `Closed now. Opens ${k === 1 ? 'tomorrow' : NAMES[DAYS[i]]} at ${fmt(HOURS[DAYS[i]][0])}`;
  }
  const row = $(`[data-day~="${day}"]`);
  if (row) row.classList.add('is-today');
}

// Contact: the map and every directions link read the pin from ONE place, data-geo on the .visit section
// (the HITC Building's spot at 154 Tuliao St). Change the pin there and nothing else.
function map() {
  const el = $('[data-geo]');
  if (!el) return;
  const geo = el.dataset.geo.replace(/\s+/g, '');
  const frame = $('[data-map]', el);
  // the map (Google's embed, about 450 KB) loads only once it nears the screen, not with the page
  const load = () => { frame.src = `https://www.google.com/maps?q=${geo}&z=17&output=embed`; };
  if (frame && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '600px 0px' });
    io.observe(frame);
  } else if (frame) load();
  $$('[data-directions]').forEach((a) => { a.href = `https://www.google.com/maps/dir/?api=1&destination=${geo}`; });
}

/* ---------- the message forms: #home-form (index.html) and #contact-form (contact.html) ----------
   For now both open the visitor's own email app (mailto) with the message written out to info@hitc.ph.
   Switching to Web3Forms is one edit plus the hidden input: put the access key in WEB3FORMS_KEY below, and add
   <input type="hidden" name="access_key" value="THE KEY"> inside each form. An empty key means mailto.
   (The CSP in vite.config.js already allows https://api.web3forms.com.) ---------- */
const WEB3FORMS_KEY = '';
const MAIL_TO = 'info@hitc.ph';

function mailForms() {
  $$('form.mailform').forEach((form) => {
    const note = $('[data-form-note]', form), btn = $('button[type="submit"]', form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = (n) => (form.elements.namedItem(n)?.value || '').trim();
      const subject = 'Website inquiry' + (f('product') ? ': ' + f('product') : '');
      const body = `Name: ${f('name')}\nEmail: ${f('email')}\nSchool or institution: ${f('school') || 'not given'}\nTopic: ${f('product') || 'not chosen'}\n\n${f('message')}`;
      if (!WEB3FORMS_KEY) {
        location.href = `mailto:${MAIL_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        say(note, `Your email app should open with the message ready to send. If it doesn't, email us at ${MAIL_TO}.`);
        return;
      }
      // Web3Forms: dormant while WEB3FORMS_KEY is empty
      const data = Object.fromEntries(new FormData(form));
      data.access_key ||= WEB3FORMS_KEY;
      data.subject = subject;
      data.from_name = 'HITC Website';
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
        const out = await res.json();
        if (!out.success) throw new Error(out.message);
        form.reset();
        say(note, 'Message sent. The HITC team will reply to the email address you gave.');
      } catch {
        say(note, `The message didn't send. Please email us at ${MAIL_TO}.`);
      }
      btn.disabled = false;
      btn.textContent = label;
    });
  });
}

// the phone menu closes on Escape and on a click outside it
function phoneMenu() {
  const m = $('#mnav');
  if (!m) return;
  document.addEventListener('click', (e) => { if (m.open && !m.contains(e.target)) m.open = false; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && m.open) { m.open = false; $('summary', m).focus(); } });
}

// a link like contact.html?topic=books#message picks that topic in the form
function presetTopic() {
  const TOPICS = { books: 'Books and printing', careers: 'Careers', campus: 'Campus Connect' };
  const want = TOPICS[new URLSearchParams(location.search).get('topic')];
  const select = $('#cf-product');
  if (want && select) select.value = want;
}

phoneMenu();
mailForms();
presetTopic();
$$('[data-halftone]').forEach((el) => halftone(el));
$$('.rot').forEach((el) => rotatingText(el));
$$('[data-fold]').forEach((el) => foldText(el));
$$('[data-flyer]').forEach((el) => tearTabs(el));
years();
openNow();
map();
