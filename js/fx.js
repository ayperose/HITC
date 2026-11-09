// Home page motion, on the page's own GSAP + ScrollTrigger from npm (window.gsap, the same instance the hero's pin uses).
// Portions adapted from third-party code under the MIT licence with the Commons Clause: see /licenses.txt
// Vanilla ports of: Split Text, Shiny Text, Magnet, Scroll Reveal, Scroll Stack and Counter, plus the Lenis wiring.
// What changed from upstream is noted at each piece. Every piece shows its text whole under
// prefers-reduced-motion, and none of them keeps a frame loop running off screen.
import { paintFront, paintBack, paintStrap } from './student-id-art.js';

const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const { gsap, ScrollTrigger } = window;
const hasGsap = !!(gsap && ScrollTrigger);
if (hasGsap) gsap.registerPlugin(ScrollTrigger);
const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

/* ---------- Lenis: mouse and trackpad only (settings and wiring from src/scroll.js) ---------- */
function startLenis() {
  if (!fine || reduce || !hasGsap || root.dataset.smooth === 'off') return;
  // npm lenis, a separate chunk: phones and reduced motion never download it
  Promise.all([import('lenis'), import('lenis/dist/lenis.css')]).then(([{ default: Lenis }]) => {
    // lerp 0.15: a wheel notch settles in ~0.6 s
    const lenis = new Lenis({ lerp: 0.15, anchors: true, allowNestedScroll: true, stopInertiaOnNavigate: true, autoRaf: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000)); // one frame loop: GSAP's, which the hero's pin already runs
    ScrollTrigger.addEventListener('refresh', () => lenis.resize()); // the pin changes the page height
    // keyboard, scrollbar drags and find-in-page take over from a glide at once
    const handOff = () => { if (lenis.isScrolling === 'smooth') { lenis.stop(); lenis.start(); } };
    addEventListener('keydown', handOff, { passive: true });
    addEventListener('pointerdown', handOff, { passive: true });
    window.lenis = lenis; // QA: wait for !window.lenis.isScrolling after a wheel
  });
}

/* ---------- Split Text: letters rise in once (GSAP's SplitText plugin is not on the 3.12.5 CDN, so
   the split is by hand). The real text stays in an sr-only span; the letters are aria-hidden. ---------- */
function splitText(el) {
  if (reduce || !hasGsap) return;
  const text = el.textContent.trim().replace(/\s+/g, ' ');
  el.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  const vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');
  vis.className = 'split';
  const chars = [];
  text.split(' ').forEach((word, wi) => {
    if (wi) vis.append(' ');
    const w = document.createElement('span');
    w.className = 'split__word';
    for (const ch of word) {
      const c = document.createElement('span');
      c.className = 'split__char';
      c.textContent = ch;
      w.appendChild(c);
      chars.push(c);
    }
    vis.appendChild(w);
  });
  el.append(sr, vis);
  gsap.fromTo(chars, { opacity: 0, yPercent: 60 }, {
    opacity: 1, yPercent: 0, duration: 1.1, ease: 'power3.out', stagger: 0.045,
    scrollTrigger: { trigger: el, start: 'top 90%-=100px', once: true },
    onComplete: () => gsap.set(chars, { clearProps: 'transform,opacity,willChange' }),
  });
}

/* ---------- Shiny Text: a band of light sweeps across the text. The browser's own animation engine
   runs it (as in src/fx/ShinyText.jsx), paused off screen and with the tab hidden. ---------- */
function shinyText(el, { speed = 2.2, delay = 2.4 } = {}) {
  if (reduce || !el.animate) return;
  el.classList.add('is-shiny');
  const at = (p) => `${150 - p * 2}% center`;
  const a = el.animate(
    [{ backgroundPosition: at(0), offset: 0 }, { backgroundPosition: at(100), offset: speed / (speed + delay) }, { backgroundPosition: at(100), offset: 1 }],
    { duration: (speed + delay) * 1000, iterations: Infinity },
  );
  let seen = false;
  const update = () => (seen && !document.hidden ? a.play() : a.pause());
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; update(); }, { rootMargin: '40px' }).observe(el);
  document.addEventListener('visibilitychange', update);
}

/* ---------- Magnet: the button leans toward a nearby pointer. Pointer read once per frame, written
   only when the offset changes; still on touch screens and under reduced motion. ---------- */
function magnet(wrap, { padding = 90, strength = 3 } = {}) {
  if (!fine || reduce) return;
  const inner = wrap.firstElementChild;
  let frame = 0, px = 0, py = 0, active = false, x = 0, y = 0;
  const apply = () => {
    frame = 0;
    const r = wrap.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const near = Math.abs(cx - px) < r.width / 2 + padding && Math.abs(cy - py) < r.height / 2 + padding;
    const nx = near ? (px - cx) / strength : 0;
    const ny = near ? (py - cy) / strength : 0;
    if (near !== active) { active = near; inner.style.transition = near ? 'transform .3s ease-out' : 'transform .5s ease-in-out'; }
    if (nx !== x || ny !== y) { x = nx; y = ny; inner.style.transform = x || y ? `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)` : ''; }
  };
  addEventListener('mousemove', (e) => { px = e.clientX; py = e.clientY; if (!frame) frame = requestAnimationFrame(apply); }, { passive: true });
}

/* ---------- Scroll Reveal: words brighten and unblur one after another as the paragraph is
   scrolled past (scrubbed). Upstream's container rotation is off; the scrub ends when the
   paragraph's bottom reaches 55% of the screen rather than the bottom, so it plays over a longer
   stretch of scroll. ---------- */
function scrollReveal(el, { baseOpacity = 0.14, blur = 4, gap = 0.05, span = 0.5 } = {}) {
  if (reduce || !hasGsap) return;
  const text = el.textContent.trim().replace(/\s+/g, ' ');
  el.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  const vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');
  const pieces = text.split(' ').map((word, i) => {
    if (i) vis.append(' ');
    const p = document.createElement('span');
    p.className = 'reveal__word';
    p.textContent = word;
    vis.appendChild(p);
    return p;
  });
  el.append(sr, vis);
  const last = pieces.map(() => -1);
  const total = span + (pieces.length - 1) * gap;
  const state = { p: 0 };
  const render = () => {
    const at = state.p * total;
    pieces.forEach((piece, i) => {
      const t = clamp01((at - i * gap) / span);
      if (t === last[i]) return;
      last[i] = t;
      piece.style.opacity = t >= 1 ? '' : (baseOpacity + (1 - baseOpacity) * t).toFixed(3);
      piece.style.filter = blur && t < 1 ? `blur(${(blur * (1 - t)).toFixed(2)}px)` : '';
    });
  };
  render();
  gsap.to(state, {
    p: 1, ease: 'none', onUpdate: render,
    scrollTrigger: { trigger: el, start: () => `top bottom-=${0.2 * Math.min(el.offsetHeight, innerHeight)}`, end: 'bottom 55%', scrub: true },
  });
}

/* ---------- Scroll Stack: cards pin one by one and settle into a dimmed deck (window scrolling).
   Upstream's own wheel glide and snap are off (Lenis does the smoothing); the deck's scale and dim
   are written from ScrollTrigger's update, in the same frame as the scroll. Phones (and short
   screens) get a plain list instead. ---------- */
function scrollStack(deck, { itemDistance = 90, stackDistance = 42, stackPosition = 0.15, itemScale = 0.035, baseScale = 0.85, dimAmount = 0.12, hold = 120 } = {}) {
  const cards = Array.from(deck.children);
  const n = cards.length;
  const slots = cards.map((card, i) => {
    if (i > 0) {
      const gapDiv = document.createElement('div');
      gapDiv.className = 'stack__gap';
      gapDiv.setAttribute('aria-hidden', 'true');
      const g = itemDistance - (n - i) * stackDistance;
      gapDiv.style.height = Math.max(0, g) + 'px';
      gapDiv.style.marginTop = Math.min(0, g) + 'px';
      deck.insertBefore(gapDiv, card);
    }
    const slot = document.createElement('div');
    slot.className = 'stack__slot';
    slot.style.top = `calc(${stackPosition * 100}vh + ${i * stackDistance}px)`;
    slot.style.marginBottom = (n - 1 - i) * stackDistance + 'px';
    slot.style.zIndex = String(i + 1);
    deck.insertBefore(slot, card);
    slot.appendChild(card);
    return slot;
  });
  const end = document.createElement('div');
  end.className = 'stack__end';
  end.setAttribute('aria-hidden', 'true');
  end.style.height = hold + 'px';
  deck.appendChild(end);
  deck.classList.add('is-stacked');
  if (reduce || !hasGsap) return;

  const cache = new Map();
  const write = (key, value, apply) => { if (cache.get(key) !== value) { cache.set(key, value); apply(value); } };
  const update = () => {
    if (!deck.classList.contains('is-stacked') || getComputedStyle(slots[0]).position !== 'sticky') return;
    const stackTop = stackPosition * innerHeight;
    const heights = slots.map((s) => s.offsetHeight);
    const tops = slots.map((s) => s.getBoundingClientRect().top);
    const depths = slots.map(() => 0);
    for (let j = 1; j < n; j++) {
      const pinBefore = stackTop + (j - 1) * stackDistance;
      const start = pinBefore + heights[j - 1];
      const span = Math.max(1, start - pinBefore - stackDistance);
      const cover = clamp01((start - tops[j]) / span);
      for (let i = 0; i < j; i++) depths[i] += cover;
    }
    slots.forEach((slot, i) => {
      const card = slot.firstElementChild;
      const depth = depths[i];
      const scale = Math.max(baseScale, 1 - depth * itemScale);
      const dim = 1 - Math.pow(1 - dimAmount, depth);
      write('t' + i, depth < 0.0005 ? '' : `scale(${scale.toFixed(4)})`, (v) => { card.style.transform = v; });
      write('d' + i, dim.toFixed(3), (v) => card.style.setProperty('--stack-dim', v));
    });
  };
  ScrollTrigger.create({ trigger: deck, start: 'top bottom', end: 'bottom top', onUpdate: update, onRefresh: update });
  addEventListener('resize', update);
  update();
}

/* ---------- Counter: the time-in card's clock rolls like an odometer. Each digit is a strip of 0 to 9
   moved by transform only (upstream springs each digit along the shortest way round; here a CSS transition
   with a slight overshoot, staggered right to left). It rolls up from 0:00 the first time the card is on
   screen, then between the time in and the time out on each press of the card's button. ---------- */
function gateClock(card) {
  const odo = card.querySelector('.odo'), btn = card.querySelector('[data-flip]'), note = card.querySelector('.note');
  if (!odo || !btn || !note) return;
  const strips = Array.from(odo.querySelectorAll('.odo__d')).map((d, i, all) => {
    const s = document.createElement('span');
    s.className = 'odo__s';
    for (let n = 0; n < 10; n++) s.appendChild(document.createElement('span')).textContent = n;
    s.style.transitionDelay = (all.length - 1 - i) * 90 + 'ms';
    d.textContent = '';
    d.appendChild(s);
    return s;
  });
  const ampm = odo.querySelector('.odo__aps');
  const STATES = [
    { time: '702', pm: 0, kind: 'Time in', title: 'Maria dela Cruz: Time In', body: 'Arrived on campus at 7:02 AM.', next: 'now see her time out' },
    { time: '431', pm: 1, kind: 'Time out', title: 'Maria dela Cruz: Time Out', body: 'Left the campus at 4:31 PM.', next: 'back to her time in' },
  ];
  const set = (time, pm) => {
    strips.forEach((s, i) => s.style.setProperty('--n', time[i]));
    if (ampm) ampm.style.setProperty('--n', pm);
  };
  let at = 0;
  const show = (k) => {
    const st = STATES[k];
    set(st.time, st.pm);
    note.querySelector('.note__kind').textContent = st.kind;
    note.querySelector('.note__title').textContent = st.title;
    note.querySelector('.note__body').textContent = st.body;
    btn.firstChild.textContent = st.next;
  };
  btn.addEventListener('click', () => { at = 1 - at; show(at); });
  if (reduce || !('IntersectionObserver' in window)) { show(0); return; }
  set('000', 0); // first roll: from 0:00 up to 7:02, once the card is in view
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); show(at); } }, { threshold: 0.35 });
  io.observe(odo);
}

/* ---------- the student ID on its lanyard (#student-id) ---------- */
// The badge's one-off set-up (an environment bake and texture uploads) blocks the page for a moment. The hero's
// 3D book waits for it before its first frame (index.html, at most 2 s), so it never freezes the book's intro or
// the scroll story; the book's own shaders compile on the GPU meanwhile.
let markBuilt;
window.hitcLanyardBuilt = new Promise((r) => { markBuilt = r; });
async function startLanyard() {
  const section = document.getElementById('student-id');
  const stage = document.getElementById('sid-stage');
  const hang = document.getElementById('sid-hang');
  if (!section || !stage) return;
  const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  // the badge and three.js are their own chunk, fetched once the page's text has painted
  const afterPaint = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r)));
  const [icon, logo, , { mount: mountLanyard }] = await Promise.all([
    // new URL(…, import.meta.url): Vite sees these and ships the files in the build
    load(new URL('../brand_assets/campus-connect-deck/campus-connect-app-icon-640.webp', import.meta.url).href),
    load(new URL('../brand_assets/hitclogo-300.webp', import.meta.url).href),
    Promise.race([
      Promise.all(['900 80px "Barlow Condensed"', '800 80px "Barlow Condensed"', '700 60px "Barlow Condensed"', '600 30px "Space Grotesk"', '500 30px "Space Grotesk"'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2500)),
    ]),
    afterPaint().then(() => import('./lanyard.js')),
  ]);
  // the strap hangs over the empty middle column on wide screens, centred on phones
  const anchorX = () => {
    const s = stage.getBoundingClientRect();
    if (!hang || !hang.offsetWidth || s.width < 1) return 0.5;
    const r = hang.getBoundingClientRect();
    return (r.left + r.width / 2 - s.left) / s.width;
  };
  const badge = mountLanyard(stage, {
    paintFront: (g, w, h) => paintFront(g, w, h, { icon }),
    paintBack: (g, w, h) => paintBack(g, w, h, { icon, logo }),
    paintStrap,
    cardSize: [1.52, 2.4],
    cornerRadius: 0.2,
    size: 0.48,
    strapLength: 0.42,
    anchorX: anchorX(),
    breeze: 0.3,
    intro: 'drop',
    eventTarget: section,
    onFlip: (back) => { flipBtn && flipBtn.setAttribute('aria-pressed', String(back)); },
  });
  window.__hitcBadge = badge; // QA
  badge.compiled.then(markBuilt);
  // Two WebGL scenes never both draw: the badge waits while the hero's book is rendering.
  const S = window.hitcStory;
  const sync = () => badge.setAllowed(!(S && S.rendering));
  addEventListener('hitc:hero', sync);
  sync();
  new ResizeObserver(() => badge.setAnchor(anchorX())).observe(section);
  const flipBtn = document.getElementById('sid-flip');
  if (flipBtn) flipBtn.addEventListener('click', () => badge.flip());
}

startLenis();
document.querySelectorAll('[data-split]').forEach(splitText);
document.querySelectorAll('[data-shiny]').forEach((el) => shinyText(el));
document.querySelectorAll('[data-magnet]').forEach((el) => magnet(el));
document.querySelectorAll('[data-reveal]').forEach((el) => scrollReveal(el));
document.querySelectorAll('[data-stack]').forEach((el) => scrollStack(el));
document.querySelectorAll('[data-taps]').forEach((el) => gateClock(el));
startLanyard().catch((err) => console.warn('HITC lanyard could not start:', err)).finally(() => markBuilt());
if (hasGsap) {
  // the fonts change line breaks, and with them every trigger below the hero
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}
