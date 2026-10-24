// HITC inner pages: the product props, About, Contact and Careers (2026-10-24).
// Portions adapted from third-party code under the MIT licence with the Commons Clause: see /licenses.txt
// Vanilla ports of: Split Flap Text, Spring Check, Text Type, Bounce Cards, Counter, Stack, Slide Commit,
// Flip Card, Rotating Text, Fold Text and Tilted Card. Each port keeps upstream's timing and spring values; what changed is noted at
// each piece. Every piece moves only transform and opacity, shows its final state under
// prefers-reduced-motion, and none keeps a frame loop running when idle.

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));

/* ---------- a damped spring on one number, stepped like an odometer counter (240 Hz sub-steps).
   duration is one undamped period; bounce 0 is critically damped. ---------- */
function spring(from, to, { duration = 0.6, bounce = 0.2, velocity = 0 } = {}, onUpdate, onDone) {
  let pos = from, vel = velocity, raf = 0, last = 0;
  const omega = TAU / duration, zeta = 1 - bounce;
  const handle = { stop: () => cancelAnimationFrame(raf), get pos() { return pos; }, get vel() { return vel; } };
  if (reduce) { pos = to; onUpdate(to); onDone && onDone(); return handle; }
  const frame = (now) => {
    const elapsed = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    const steps = Math.ceil(elapsed * 240), dt = elapsed / steps;
    for (let i = 0; i < steps; i++) { vel += (-omega * omega * (pos - to) - 2 * zeta * omega * vel) * dt; pos += vel * dt; }
    if (Math.abs(pos - to) < 0.0005 * Math.max(1, Math.abs(to)) && Math.abs(vel) < 0.01) { pos = to; vel = 0; onUpdate(to); onDone && onDone(); return; }
    onUpdate(pos);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return handle;
}

/* ---------- Split Flap Text: a departures board that clacks through to each phrase.
   Upstream's tiles, cascade, random flips per tile and remounted leaves are kept; its brightness filter on the
   turning leaf is dropped (transform only). ---------- */
function splitFlap(el, { pad = 13, flipMs = 80, staggerMs = 50, flips = 5, glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' } = {}) {
  el.textContent = '';
  el.style.setProperty('--flap', flipMs / 1000 + 's');
  const make = (cls, ch) => { const s = document.createElement('span'); s.className = cls; const c = document.createElement('span'); c.className = 'flap__char'; c.textContent = ch; s.appendChild(c); return s; };
  const tiles = Array.from({ length: pad }, () => {
    const t = document.createElement('span');
    t.className = 'flap__tile';
    const top = make('flap__half flap__half--top', ' '), bottom = make('flap__half flap__half--bottom', ' ');
    t.append(top, bottom);
    el.appendChild(t);
    return { t, top: top.firstChild, bottom: bottom.firstChild, leaves: [] };
  });
  let raf = 0;
  const norm = (s) => String(s).toUpperCase().slice(0, pad).padEnd(pad, ' ');
  // tile.face is the letter a tile settles on if its flip stops now (the lower half). A new phrase starts from
  // these, not from the last phrase asked for: a phrase that interrupts a running cascade used to skip the tiles
  // whose last target matched, and left them on a random letter (e.g. "TIME IN JHNXS").
  const paint = (tile, current, next, flipping) => {
    tile.face = current;
    tile.top.textContent = flipping ? next : current;
    tile.bottom.textContent = current;
    tile.leaves.forEach((l) => l.remove());
    tile.leaves = flipping ? [make('flap__leaf flap__leaf--front', current), make('flap__leaf flap__leaf--back', next)] : [];
    tile.leaves.forEach((l) => tile.t.appendChild(l));
  };
  tiles.forEach((tile) => { tile.face = ' '; });
  const settle = (target) => tiles.forEach((tile, i) => paint(tile, target[i], target[i], false));
  const show = (text, gold = false) => {
    const target = norm(text);
    cancelAnimationFrame(raf);
    tiles.forEach((tile) => tile.t.classList.toggle('is-gold', gold));
    if (reduce) { settle(target); return; }
    // stop any flip in progress where it stands, then flip every tile that doesn't read the target yet
    tiles.forEach((tile) => { if (tile.leaves.length) paint(tile, tile.face, tile.face, false); });
    const from = tiles.map((tile) => tile.face);
    const plans = [];
    for (let i = 0; i < pad; i++) {
      if (from[i] === target[i]) continue;
      const seq = Array.from({ length: flips }, () => glyphs.charAt(Math.floor(Math.random() * glyphs.length)));
      seq.push(target[i]);
      plans.push({ i, from: from[i], seq, start: i * staggerMs, step: -1, done: false });
    }
    const t0 = performance.now();
    const tick = (now) => {
      const elapsed = now - t0;
      let running = false;
      plans.forEach((p) => {
        const local = elapsed - p.start;
        if (local < 0) { running = true; return; }
        const step = Math.floor(local / flipMs);
        if (step < p.seq.length) {
          running = true;
          if (step !== p.step) { p.step = step; paint(tiles[p.i], step === 0 ? p.from : p.seq[step - 1], p.seq[step], true); }
        } else if (!p.done) { p.done = true; paint(tiles[p.i], p.seq[p.seq.length - 1], p.seq[p.seq.length - 1], false); }
      });
      if (running) raf = requestAnimationFrame(tick);
      else settle(target); // the end state is always exactly the phrase
    };
    raf = requestAnimationFrame(tick);
  };
  return { show };
}

/* ---------- Spring Check: the box fills on a spring, swells past 1, and the tick draws in.
   Upstream draws the tick with stroke-dashoffset; here the tick is wiped in with scaleX. ---------- */
function springCheck(el) {
  const fill = $('.sc__fill', el), tick = $('.sc__tick', el), box = $('.sc__box', el);
  let t = el.classList.contains('is-on') ? 1 : 0, anim;
  const write = (v) => {
    t = v;
    fill.style.transform = `scale(${Math.max(v, 0)})`;
    box.style.transform = `scale(${1 + 0.35 * Math.max(0, v - 1)})`;
    tick.style.transform = `scaleX(${clamp(v, 0, 1)})`;
  };
  write(t);
  return {
    set(on) {
      anim && anim.stop();
      // upstream: visualDuration 0.2 s, bounce from zetaOf(0.2)
      anim = spring(t, on ? 1 : 0, { duration: 0.32, bounce: 0.45 }, write);
    },
  };
}

/* ---------- Text Type: types a sentence with a blinking caret. Upstream's typingSpeed (50 ms) with a
   little variable speed; no deleting or looping here, it types once per send. ---------- */
function textType(el, { speed = 34 } = {}) {
  const out = $('.tt__text', el);
  let timer = 0;
  return {
    type(text, done) {
      clearTimeout(timer);
      if (reduce) { out.textContent = text; done && done(); return; }
      let i = 0;
      out.textContent = '';
      const step = () => {
        i += 1;
        out.textContent = text.slice(0, i);
        if (i < text.length) timer = setTimeout(step, speed + Math.random() * speed * 0.8);
        else done && done();
      };
      timer = setTimeout(step, 220);
    },
  };
}

/* ---------- Bounce Cards: photo cards in a fan; the hovered one straightens and swells and its
   neighbours are pushed aside. Upstream's spread, rotation pattern and push are kept; the cards start in
   place rather than bouncing in, so nothing is ever blank. ---------- */
function bounceCards(el, { spread = 0.22, rotation = 10, push = 0.1, hoverScale = 1.06 } = {}) {
  const PATTERN = [1, 0.5, -0.3, -1, 0.2, 0.75, -0.6, 0.35, -0.85, 0.1];
  const cards = $$('.bounce__card', el);
  const middle = (cards.length - 1) / 2;
  const place = (hovered) => {
    const w = el.clientWidth;
    cards.forEach((c, i) => {
      const x = (i - middle) * spread * w + (hovered >= 0 && i !== hovered ? Math.sign(i - hovered) * push * w : 0);
      c.style.setProperty('--x', x.toFixed(1) + 'px');
      c.style.setProperty('--rot', (i === hovered ? 0 : rotation * PATTERN[i % PATTERN.length]) + 'deg');
      c.style.setProperty('--s', i === hovered ? hoverScale : 1);
      c.style.zIndex = i === hovered ? 10 : String(i + 1);
    });
  };
  place(-1);
  addEventListener('resize', () => place(-1));
  if (!fine || reduce) return;
  cards.forEach((c, i) => {
    c.addEventListener('pointerenter', () => place(i));
    c.addEventListener('pointerleave', () => place(-1));
  });
}

/* ---------- Counter: an odometer whose digits roll on springs to each new value, ones first.
   Upstream's spring (duration 0.7 s, bounce 0.2), stagger (0.04 s) and wrap-around numerals are kept;
   leading zeros fade and the digits slide up to the peso sign instead of animating their width. ---------- */
function odometer(el, { slots = 4, value = 0, duration = 0.7, bounce = 0.2, stagger = 0.04 } = {}) {
  el.textContent = '';
  el.classList.add('odo');
  const sym = document.createElement('span');
  sym.className = 'odo__sym';
  sym.textContent = '₱';
  const row = document.createElement('span');
  row.style.display = 'inline-flex';
  row.style.transition = reduce ? 'none' : 'transform .6s cubic-bezier(.34,1.56,.64,1)';
  el.append(sym, row);
  const W = 0.5, C = 0.22; // em widths of a digit and of the comma
  const digits = [];
  let comma = null;
  for (let s = 0; s < slots; s++) {
    if (slots - s === 3 && s > 0) { comma = document.createElement('span'); comma.className = 'odo__comma'; comma.textContent = ','; row.appendChild(comma); }
    const win = document.createElement('span');
    win.className = 'odo__digit';
    const nums = Array.from({ length: 10 }, (_, n) => { const sp = document.createElement('span'); sp.textContent = n; win.appendChild(sp); return sp; });
    row.appendChild(win);
    digits.push({ win, nums, pos: 0, vel: 0, target: 0, wait: 0 });
  }
  const mod = (v, b) => ((v % b) + b) % b;
  const wrap = (o) => mod(o + 5, 10) - 5;
  const paint = (d) => d.nums.forEach((sp, n) => { sp.style.transform = `translateY(${(wrap(n - d.pos) * 100).toFixed(2)}%)`; });
  const lead = (v) => {
    const str = String(v).padStart(slots, '0');
    const firstReal = Math.min(str.search(/[1-9]/) < 0 ? slots - 1 : str.search(/[1-9]/), slots - 1);
    digits.forEach((d, i) => { d.win.style.opacity = i < firstReal ? '0' : '1'; });
    const commaHidden = comma && firstReal > 0;
    if (comma) comma.style.opacity = commaHidden ? '0' : '1';
    row.style.transform = `translateX(${-(firstReal * W + (commaHidden ? C : 0))}em)`;
  };
  let raf = 0, last = 0, current = value;
  const frame = (now) => {
    raf = 0;
    const elapsed = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    const omega = TAU / duration, zeta = 1 - bounce;
    let busy = false;
    digits.forEach((d) => {
      let left = elapsed;
      if (d.wait > 0) { const used = Math.min(d.wait, left); d.wait -= used; left -= used; }
      if (left > 0) {
        const steps = Math.ceil(left * 240), dt = left / steps;
        for (let i = 0; i < steps; i++) { d.vel += (-omega * omega * (d.pos - d.target) - 2 * zeta * omega * d.vel) * dt; d.pos += d.vel * dt; }
      }
      if (d.wait <= 0 && Math.abs(d.pos - d.target) < 0.002 && Math.abs(d.vel) < 0.02) { d.target = mod(Math.round(d.target), 10); d.pos = d.target; d.vel = 0; }
      else busy = true;
      paint(d);
    });
    if (busy) raf = requestAnimationFrame(frame);
  };
  const set = (v, instant = false) => {
    const up = v >= current;
    current = v;
    const str = String(v).padStart(slots, '0');
    const moving = [];
    digits.forEach((d, i) => {
      const to = Number(str[i]);
      const now = mod(Math.round(d.target), 10);
      let step = mod(to - now, 10);
      if (!up && step) step -= 10;
      if (step) { d.target += step; moving.push(i); }
      if (instant || reduce) { d.target = to; d.pos = to; d.vel = 0; paint(d); }
    });
    lead(v);
    if (instant || reduce) return;
    moving.sort((a, b) => b - a).forEach((i, order) => { digits[i].wait = order * stagger; });
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  };
  set(value, true);
  return { set, get value() { return current; } };
}

/* ---------- Stack: a pile of photos; the top one flies off and tucks under the rest.
   Upstream's "fan" layout (rotate position x spread x 8 deg, scale 1 - position x depth x 0.12) and its
   visible count are kept; the whole pile is one button instead of a drag surface. ---------- */
function stackPile(btn, { spread = 0.5, depth = 0.5, visible = 4 } = {}) {
  let order = $$('.pile__card', btn);
  const live = $('[data-pile-live]', btn.parentElement);
  const layout = () => order.forEach((c, p) => {
    c.style.setProperty('--rot', (p * spread * 8 * (p % 2 ? -1 : 1)).toFixed(2) + 'deg');
    c.style.setProperty('--s', (1 - p * depth * 0.12).toFixed(3));
    c.style.setProperty('--y', (p * 8) + 'px');
    c.style.zIndex = String(order.length - p);
    c.style.opacity = p < visible ? '1' : '0';
  });
  layout();
  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    const top = order[0];
    top.classList.add('is-leaving');
    await wait(330);
    order = [...order.slice(1), top];
    top.classList.remove('is-leaving');
    layout();
    if (live) live.textContent = 'Now showing: ' + ($('img', order[0]).alt || '');
    busy = false;
  });
}

/* ---------- Slide Commit: drag the handle to the end to confirm. Upstream's spring (stiffness
   260 + speed x 6.4, critical damping, a bouncier return), keyboard keys and hold time are kept; the capsule's
   clip-path becomes a scaleX fill. ---------- */
function slideCommit(el, onConfirm, { holdMs = 2200 } = {}) {
  const grip = $('.slide__grip', el), fill = $('.slide__fill', el), label = $('.slide__label', el);
  let x = 0, anim = null, drag = null, done = false;
  const travel = () => el.clientWidth - 8 - grip.offsetWidth;
  const write = (v) => {
    x = v;
    const T = travel(), inner = el.clientWidth - 8;
    grip.style.transform = `translateX(${v.toFixed(1)}px)`;
    fill.style.transform = `scaleX(${((v + grip.offsetWidth) / inner).toFixed(4)})`;
    fill.style.opacity = String(clamp(v / 24, 0, 1)); // hidden under the handle at rest, where scaleX would squash its round end
    label.style.opacity = done ? '0' : String(clamp(1 - v / (T * 0.55), 0, 1));
    grip.setAttribute('aria-valuenow', String(Math.round((v / T) * 100)));
  };
  const k = 260 + 0.5 * 640, crit = 2 * Math.sqrt(k * 0.9); // speed 50, mass 0.9
  const omega = Math.sqrt(k / 0.9), period = TAU / omega;
  const to = (v, bounce) => { anim && anim.stop(); anim = spring(x, v, { duration: period, bounce }, write); };
  const commit = () => {
    if (done) return;
    done = true;
    anim && anim.stop();
    write(travel());
    el.classList.add('is-done');
    onConfirm();
    setTimeout(() => { done = false; el.classList.remove('is-done'); to(0, 0.38); }, reduce ? holdMs : holdMs);
  };
  write(0);
  grip.addEventListener('pointerdown', (e) => {
    if (done || e.button !== 0) return;
    anim && anim.stop();
    drag = { id: e.pointerId, grab: e.clientX - x };
    grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    write(clamp(e.clientX - drag.grab, 0, travel()));
  });
  const up = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    drag = null;
    if (x >= travel() - 1) commit();
    else to(0, 0.38);
  };
  grip.addEventListener('pointerup', up);
  grip.addEventListener('pointercancel', up);
  grip.addEventListener('keydown', (e) => {
    if (done) return;
    const T = travel();
    if (e.key === 'End' || e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); const n = Math.min(T, x + T / 10); write(n); if (n >= T) commit(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); write(Math.max(0, x - T / 10)); }
    else if (e.key === 'Home' || e.key === 'Escape') { e.preventDefault(); write(0); }
  });
  addEventListener('resize', () => { if (!done) write(0); });
}

/* ---------- Flip Card: turns over on a spring (stiffness 170, damping 20) and tilts toward a
   fine pointer (12 deg max). Drag-to-flip and the glare are left out; click, Enter and Space flip it. ---------- */
function flipCard(btn) {
  const rotor = $('.flip__rotor', btn);
  let turn = 0, tx = 0, ty = 0, anim = null, tiltRaf = 0, want = { x: 0, y: 0 };
  // which face is toward the viewer is also set by class (past 90 degrees), so a browser that draws the back of a
  // turned face, or flattens 3D, still shows only the right one
  const write = () => {
    rotor.style.transform = `rotateX(${tx.toFixed(2)}deg) rotateY(${(turn + ty).toFixed(2)}deg)`;
    const a = (((turn + ty) % 360) + 360) % 360;
    btn.classList.toggle('is-back', a > 90 && a < 270);
  };
  const omega = Math.sqrt(170), duration = TAU / omega, bounce = 1 - 20 / (2 * omega);
  btn.addEventListener('click', () => {
    const base = Math.round(turn / 180) * 180;
    const back = Math.abs(Math.round(base / 180)) % 2 === 1;
    const target = back ? base - 180 : base + 180;
    btn.setAttribute('aria-pressed', String(!back));
    anim && anim.stop();
    anim = spring(turn, target, { duration, bounce, velocity: anim ? anim.vel : 0 }, (v) => { turn = v; write(); });
  });
  if (!fine || reduce) return;
  const ease = () => {
    tx += (want.x - tx) * 0.18; ty += (want.y - ty) * 0.18;
    write();
    tiltRaf = Math.abs(want.x - tx) + Math.abs(want.y - ty) > 0.05 ? requestAnimationFrame(ease) : 0;
  };
  btn.addEventListener('pointermove', (e) => {
    const r = btn.getBoundingClientRect();
    want = { x: (0.5 - (e.clientY - r.top) / r.height) * 24, y: ((e.clientX - r.left) / r.width - 0.5) * 24 };
    if (!tiltRaf) tiltRaf = requestAnimationFrame(ease);
  });
  btn.addEventListener('pointerleave', () => { want = { x: 0, y: 0 }; if (!tiltRaf) tiltRaf = requestAnimationFrame(ease); });
}

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

/* ---------- Tilted Card: the poster tilts toward the pointer (rotateAmplitude 12, scaleOnHover
   1.05, spring follow) and its glare slides with it. Fine pointers only. ---------- */
function tiltedCard(el, { amp = 12, scale = 1.05 } = {}) {
  if (!fine || reduce) return;
  const card = $('.poster__card', el), glare = $('.poster__glare', el);
  let cur = { x: 0, y: 0, s: 1, g: 0 }, want = { x: 0, y: 0, s: 1, g: 0 }, raf = 0;
  const step = () => {
    let moving = false;
    for (const k of ['x', 'y', 's', 'g']) { cur[k] += (want[k] - cur[k]) * 0.14; if (Math.abs(want[k] - cur[k]) > 0.001) moving = true; }
    card.style.transform = `rotateX(${cur.x.toFixed(2)}deg) rotateY(${cur.y.toFixed(2)}deg) scale(${cur.s.toFixed(3)})`;
    if (glare) glare.style.transform = `translateX(${cur.g.toFixed(1)}%)`;
    raf = moving ? requestAnimationFrame(step) : 0;
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(step); };
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const ox = (e.clientX - r.left) / r.width - 0.5, oy = (e.clientY - r.top) / r.height - 0.5;
    want = { x: -oy * 2 * amp, y: ox * 2 * amp, s: scale, g: ox * 60 };
    go();
  });
  el.addEventListener('pointerleave', () => { want = { x: 0, y: 0, s: 1, g: 0 }; go(); });
}

/* ═════════════════ the pages ═════════════════ */

const say = (el, text) => { if (el) el.textContent = text; };
const showNote = (all, which) => all.forEach((n) => n.classList.toggle('is-on', n === which));

// Turnstile: tap her ID, the reader pings, the board flaps to the time, the arm swings and the note lands.
function gate() {
  const box = $('[data-gate]');
  if (!box) return;
  const board = splitFlap($('.flap', box), { pad: 13 });
  board.show('TAP YOUR ID');
  const btn = $('.idtap', box), notes = $$('.note', box), live = $('[data-gate-live]', box);
  let out = false, busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    box.classList.add('is-tapped');
    await wait(450);
    box.classList.add('is-open');
    board.show(out ? 'TIME OUT 4:31' : 'TIME IN 7:02', true);
    showNote(notes, notes[out ? 1 : 0]);
    say(live, out ? 'Gate opened. Time out, 4:31 PM, sent to her parents.' : 'Gate opened. Time in, 7:02 AM, sent to her parents.');
    await wait(2600);
    box.classList.remove('is-open', 'is-tapped');
    out = !out;
    busy = false;
  });
}

// Attendance Manager: the gate taps fill Friday's row, and the tick springs in.
function register() {
  const box = $('[data-reg]');
  if (!box) return;
  $$('.sc', box).forEach((el) => { el._sc = springCheck(el); });
  const fri = $('[data-reg-fri] .sc', box)._sc;
  const cellIn = $('[data-reg-in]', box), cellOut = $('[data-reg-out]', box);
  const btn = $('[data-reg-tap]', box), label = $('span', btn), notes = $$('.note', box);
  const blankIn = cellIn.innerHTML, blankOut = cellOut.innerHTML;
  let stage = 0;
  const swap = async (cell, html) => { cell.style.opacity = '0'; await wait(160); cell.innerHTML = html; cell.style.opacity = '1'; };
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    if (stage === 0) {
      await swap(cellIn, '7:02 AM');
      fri.set(true);
      showNote(notes, notes[0]);
      label.textContent = 'Tap out at the gate';
    } else if (stage === 1) {
      await swap(cellOut, '3:15 PM');
      showNote(notes, notes[1]);
      label.textContent = 'Start Friday again';
    } else {
      fri.set(false);
      showNote(notes, null);
      await Promise.all([swap(cellIn, blankIn), swap(cellOut, blankOut)]);
      label.textContent = 'Tap in at the gate';
    }
    stage = (stage + 1) % 3;
    btn.disabled = false;
  });
}

// eBroadcasting: pick who it goes to, send, and the message types itself out on a phone.
function broadcast() {
  const box = $('[data-cast]');
  if (!box) return;
  const typer = textType($('.sms__bubble', box));
  const to = $('[data-cast-to]', box), state = $('[data-cast-state]', box), btn = $('[data-cast-send]', box);
  const msg = $('[data-cast-msg]', box).textContent.trim();
  btn.addEventListener('click', () => {
    const who = $('input[name="who"]:checked', box);
    to.textContent = 'To: ' + who.value;
    state.textContent = 'Sending…';
    btn.disabled = true;
    typer.type(msg, () => { state.textContent = 'Sent to ' + who.value; btn.disabled = false; });
  });
}

// eCash: load the wallet, the balance rolls, and the parent's alert lands.
function wallet() {
  const box = $('[data-wallet]');
  if (!box) return;
  const bal = odometer($('[data-wallet-bal]', box), { slots: 4, value: 40 });
  const note = $('.note', box), live = $('[data-wallet-live]', box);
  $$('[data-load]', box).forEach((b) => b.addEventListener('click', () => {
    let v = bal.value + Number(b.dataset.load);
    if (v > 9999) v = Number(b.dataset.load);
    bal.set(v);
    note.classList.remove('is-on');
    setTimeout(() => note.classList.add('is-on'), reduce ? 0 : 380);
    say(live, `Loaded ₱${b.dataset.load}. New balance ₱${v.toLocaleString('en-US')}. Her parents get an eCash load alert.`);
  }));
}

// SFMS: the cashier slides to post a payment; the receipt prints and the notes go out.
function cashier() {
  const box = $('[data-fees]');
  if (!box) return;
  const notes = $$('.note', box), live = $('[data-fees-live]', box);
  const slip = $('.slip', box), stamp = $('.slip__stamp', box);
  slideCommit($('.slide', box), async () => {
    // the last receipt drops out of sight at once, then the new one prints
    notes.forEach((n) => n.classList.remove('is-on'));
    slip.style.transition = stamp.style.transition = 'none';
    box.classList.remove('is-printed');
    slip.getBoundingClientRect();
    slip.style.transition = stamp.style.transition = '';
    await wait(120);
    box.classList.add('is-printed');
    await wait(1500);
    notes.forEach((n) => n.classList.add('is-on'));
    say(live, 'Payment posted. The receipt printed, the parent is notified and the payment is in the Daily Collection Report.');
  });
}

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
  if (frame) frame.src = `https://www.google.com/maps?q=${geo}&z=17&output=embed`;
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
      const body = `Name: ${f('name')}\nEmail: ${f('email')}\nSchool or institution: ${f('school') || 'not given'}\nProduct of interest: ${f('product') || 'not chosen'}\n\n${f('message')}`;
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

// YouTube demos: a saved still and a play button; the video itself is only requested when someone taps.
function videos() {
  $$('[data-yt]').forEach((b) => b.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = `https://www.youtube.com/embed/${b.dataset.yt}?autoplay=1`;
    f.title = b.dataset.title;
    f.allow = 'autoplay; encrypted-media; picture-in-picture';
    f.allowFullscreen = true;
    b.replaceWith(f);
    f.focus();
  }));
}

phoneMenu();
mailForms();
videos();
gate();
register();
broadcast();
wallet();
cashier();
$$('.bounce').forEach((el) => bounceCards(el));
$$('[data-pile]').forEach((el) => stackPile(el));
$$('.flip').forEach(flipCard);
$$('.rot').forEach((el) => rotatingText(el));
$$('[data-fold]').forEach((el) => foldText(el));
$$('.poster').forEach((el) => tiltedCard(el));
years();
openNow();
map();
