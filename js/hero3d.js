// The home page's hero: the 7 a.m. scan at the school gate, told as a 3D pop-up book (three.js).
// index.html fetches this module once the page's text has painted, so the first paint never waits for three.js.
import * as THREE from 'three';

const root = document.documentElement;
const hero = document.getElementById('home');
const canvas = document.getElementById('book3d');
const copy = document.getElementById('hero-copy');
const paper = document.getElementById('hero-paper');
const hint = document.getElementById('hero-hint');
const shadeEl = document.getElementById('hero-shade');
const caps = [document.getElementById('cap-1'), document.getElementById('cap-2')];
// the section under the pinned story, holding the phone the story lands on
const ccSection = document.getElementById('student-id');
const ccPhone = document.getElementById('cc-phone');
const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
const fineMq = matchMedia('(hover: hover) and (pointer: fine)');
const mobileMq = matchMedia('(max-width: 767px)');

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

const fail = () => { root.classList.add('no-webgl'); window.hitcStory && window.hitcStory.teardown(); };
// a module that arrives after the watchdog gave up keeps the photo, rather than a story mid-page
if (root.classList.contains('no-webgl')) {
  window.hitcStory && window.hitcStory.teardown();
} else if (!webglOK()) {
  fail();
} else {
  start().catch((err) => {
    console.warn('HITC 3D book could not start:', err);
    fail();
  });
}

async function start() {
  // Canvas textures use the page fonts, so wait for them (but never longer than 2.5s).
  await Promise.race([
    Promise.all([
      document.fonts.load('900 60px "Barlow Condensed"'),
      document.fonts.load('600 30px "Space Grotesk"'),
      document.fonts.load('400 30px "Space Grotesk"'),
      document.fonts.load('700 30px "Space Grotesk"'),
      document.fonts.load('40px Schoolbell'),
    ]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);

  // the scene is built in short steps with a breath between them, so a phone stays responsive while it builds
  const breathe = () => new Promise((r) => setTimeout(r));
  const lowPower = (navigator.hardwareConcurrency || 4) <= 4;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // reading every shader's log back on first use stalls the page for a moment per shader; the shaders are fixed and known good
  renderer.debug.checkShaderErrors = false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // three 0.18x removed PCFSoftShadowMap: PCF with sun.shadow.radius
  renderer.shadowMap.autoUpdate = false;
  let needFrame = true;
  let needShadow = true;

  const NIGHT = new THREE.Color('#0C1430');
  const scene = new THREE.Scene();
  scene.background = NIGHT;
  scene.fog = new THREE.Fog(NIGHT, 8, 17);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.02, 40);

  /* ---------- little helpers ---------- */
  const TAU = Math.PI * 2;
  const HALF = Math.PI / 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const backOut = (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }
  const rand = rng(7);

  const C = {
    paper: '#F4F2EA', card: '#FBFAF4', ink: '#0A0F1C', navy: '#1F2E63', blue: '#1E6BFF', gold: '#F5A800',
    green: '#2E8B57', leaf: '#3F8A55', leafDark: '#2F6F45', grass: '#D5E7C0', skin: '#C98E62', skinS: '#B0774E',
    hair: '#1B1616', white: '#FFFFFF', shade: '#E2E6EE', roof: '#C65A3E', wall: '#F2D6B6', wallS: '#E0BD98',
    concrete: '#E4DDCD', cream: '#F3E7C9',
  };

  function canvasTex(w, h, draw, { srgb = true, repeat = null } = {}) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
    t.userData.canvas = c;
    return t;
  }
  function mesh(geo, mat, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
  function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  function grain(g, w, h, amt) {
    const n = Math.round((w * h) / 140);
    for (let k = 0; k < n; k++) {
      g.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${amt})` : `rgba(60,44,24,${amt})`;
      g.fillRect(rand() * w, rand() * h, 1.5, 1.5);
    }
  }
  function roundedRect(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  // Every pop-up piece is a die-cut card: the art, a white cut edge around it, and paper grain.
  function cutOut(src, pad) {
    const w = src.width, h = src.height;
    const s = document.createElement('canvas');
    s.width = w; s.height = h;
    const sg = s.getContext('2d');
    sg.drawImage(src, 0, 0);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = C.card;
    sg.fillRect(0, 0, w, h);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    for (let a = 0; a < 20; a++) g.drawImage(s, Math.cos((a / 20) * TAU) * pad, Math.sin((a / 20) * TAU) * pad);
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    grain(g, w, h, 0.05);
    g.globalCompositeOperation = 'source-over';
    return c;
  }
  function pieceTex(w, h, draw, pad = 7) {
    const a = document.createElement('canvas');
    a.width = w; a.height = h;
    const ag = a.getContext('2d');
    ag.lineJoin = 'round';
    ag.lineCap = 'round';
    draw(ag, w, h);
    const t = new THREE.CanvasTexture(cutOut(a, pad));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  function card(tex, w, h, { cast = true } = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }));
    m.castShadow = cast;
    m.receiveShadow = true;
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
    return m;
  }

  /* ---------- illustration bits ---------- */
  function hills(g, w, h, base, amp, freq, seed, color) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 10) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * freq + seed) * Math.cos(x * freq * 0.37 + seed * 1.7)));
    g.lineTo(w, h);
    g.closePath();
    g.fill();
  }
  function cloud(g, x, y, s) {
    g.fillStyle = 'rgba(255,255,255,0.94)';
    [[0, 0, 46], [42, -20, 40], [86, 0, 44], [40, 14, 42]].forEach(([dx, dy, r]) => circle(g, x + dx * s, y + dy * s, r * s));
  }
  function leaf(g, x, y, a, len) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.5, -len * 0.24, len, len * 0.2);
    g.quadraticCurveTo(len * 0.5, len * 0.1, 0, 0);
    g.fill();
    g.restore();
  }
  function palm(g, x, y, hgt, lean) {
    const tx = x + lean * hgt, ty = y - hgt;
    g.strokeStyle = '#8A6A48';
    g.lineWidth = 15;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + lean * hgt * 0.15, y - hgt * 0.6, tx, ty);
    g.stroke();
    g.fillStyle = C.leaf;
    for (let k = 0; k < 7; k++) leaf(g, tx, ty, -HALF + (k - 3) * 0.52 + (k > 3 ? 0.2 : 0), hgt * 0.44);
    g.fillStyle = '#7A5A3A';
    circle(g, tx - 7, ty + 10, 9);
    circle(g, tx + 8, ty + 12, 9);
  }
  function tree(g, x, y, r) {
    g.fillStyle = '#7A5A3A';
    g.fillRect(x - 9, y - r * 0.9, 18, r * 0.9);
    g.fillStyle = C.leafDark;
    [[0, -r * 1.5, r], [-r * 0.6, -r * 1.1, r * 0.72], [r * 0.62, -r * 1.12, r * 0.76]].forEach(([dx, dy, rr2]) => circle(g, x + dx, y + dy, rr2));
    g.fillStyle = C.leaf;
    circle(g, x - r * 0.25, y - r * 1.7, r * 0.55);
  }
  function flower(g, x, y, r, color) {
    g.fillStyle = color;
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; circle(g, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.55); }
    g.fillStyle = C.gold;
    circle(g, x, y, r * 0.32);
  }
  function bush(g, x, y, r) {
    g.fillStyle = C.leafDark;
    circle(g, x, y, r);
    g.fillStyle = C.leaf;
    circle(g, x - r * 0.35, y - r * 0.3, r * 0.6);
  }

  /* ---------- textures: pages, desk, book ---------- */
  function pageTex(draw) {
    return canvasTex(1000, 1320, (g, w, h) => {
      g.fillStyle = C.paper;
      g.fillRect(0, 0, w, h);
      draw(g, w, h);
      grain(g, w, h, 0.03);
    });
  }
  // left page: home. canvas x = world x + 1.01, canvas y = world z + 0.66 (x1000)
  const leftGround = pageTex((g, w, h) => {
    g.fillStyle = C.grass;
    rr(g, 40, 180, 920, 1010, 70);
    g.strokeStyle = C.concrete;
    g.lineWidth = 118;
    g.beginPath();
    g.moveTo(590, 420);
    g.bezierCurveTo(600, 640, 690, 770, 1010, 790);
    g.stroke();
    g.fillStyle = '#D6CDB8';
    for (let k = 0; k < 7; k++) {
      const t = k / 6;
      const x = 590 + (1010 - 590) * t * t * 0.9 + 20 * Math.sin(t * 3);
      const y = 440 + (790 - 440) * Math.sqrt(t);
      g.beginPath(); g.ellipse(x, y, 34, 20, 0.3, 0, TAU); g.fill();
    }
    [[180, 700], [260, 820], [120, 900], [420, 980], [330, 1080]].forEach(([x, y], i) => flower(g, x, y, 16, i % 2 ? '#D8342F' : '#F08BA0'));
    const gs = g.createLinearGradient(w - 110, 0, w, 0);
    gs.addColorStop(0, 'rgba(70,56,34,0)');
    gs.addColorStop(1, 'rgba(70,56,34,0.24)');
    g.fillStyle = gs;
    g.fillRect(w - 110, 0, 110, h);
    g.fillStyle = '#9A958A';
    g.font = '600 26px "Space Grotesk", sans-serif';
    g.fillText('14', 70, h - 46);
  });
  // right page: school. canvas x = world x - 0.01
  const rightGround = pageTex((g, w, h) => {
    g.fillStyle = C.grass;
    rr(g, 40, 180, 920, 1010, 70);
    g.fillStyle = C.concrete;
    rr(g, 120, 200, 780, 520, 40);
    g.strokeStyle = C.concrete;
    g.lineWidth = 118;
    g.beginPath();
    g.moveTo(-10, 790);
    g.bezierCurveTo(200, 790, 380, 760, 560, 640);
    g.stroke();
    g.strokeStyle = 'rgba(160,150,130,0.35)';
    g.lineWidth = 3;
    for (let y = 240; y < 700; y += 60) { g.beginPath(); g.moveTo(140, y); g.lineTo(880, y); g.stroke(); }
    [[860, 820], [760, 960], [900, 1060], [640, 1100]].forEach(([x, y], i) => flower(g, x, y, 16, i % 2 ? '#F5C542' : '#D8342F'));
    const gs = g.createLinearGradient(0, 0, 110, 0);
    gs.addColorStop(0, 'rgba(70,56,34,0.24)');
    gs.addColorStop(1, 'rgba(70,56,34,0)');
    g.fillStyle = gs;
    g.fillRect(0, 0, 110, h);
    g.fillStyle = '#9A958A';
    g.font = '600 26px "Space Grotesk", sans-serif';
    g.textAlign = 'right';
    g.fillText('15', w - 70, h - 46);
  });
  const edgeTex = canvasTex(64, 128, (g, w, h) => {
    for (let y = 0; y < h; y += 4) { g.fillStyle = (y / 4) % 2 ? '#F6F3EA' : '#DEDACD'; g.fillRect(0, y, w, 4); }
  }, { repeat: [8, 1] });
  const clothTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = C.navy;
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 256; k += 3) {
      g.fillStyle = 'rgba(255,255,255,0.035)'; g.fillRect(k, 0, 1, h);
      g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, k, w, 1);
    }
  }, { repeat: [3, 3] });
  // navy-painted school desk, like the ones in their classrooms
  const deskTex = canvasTex(1024, 1024, (g, w, h) => {
    const planks = 6, ph = h / planks;
    for (let r = 0; r < planks; r++) {
      const tone = 0.9 + rand() * 0.16;
      g.fillStyle = `rgb(${Math.round(30 * tone)},${Math.round(50 * tone)},${Math.round(104 * tone)})`;
      g.fillRect(0, r * ph, w, ph);
      g.strokeStyle = 'rgba(8,14,36,0.22)';
      g.lineWidth = 1.2;
      for (let k = 0; k < 10; k++) {
        g.beginPath();
        const yy = r * ph + 8 + rand() * (ph - 16);
        g.moveTo(0, yy);
        for (let s = 0; s <= w; s += 48) g.lineTo(s, yy + Math.sin(s * 0.013 + k) * 3);
        g.stroke();
      }
      g.fillStyle = 'rgba(6,10,28,0.55)';
      g.fillRect(0, r * ph, w, 3);
    }
    for (let k = 0; k < 90; k++) { // chipped paint
      g.fillStyle = rand() > 0.5 ? 'rgba(120,96,64,0.35)' : 'rgba(80,110,190,0.18)';
      g.beginPath(); g.ellipse(rand() * w, rand() * h, 2 + rand() * 7, 1 + rand() * 3, rand() * 3, 0, TAU); g.fill();
    }
  }, { repeat: [3, 3] });

  await breathe();
  /* ---------- the desk ---------- */
  const desk = mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ map: deskTex, color: '#9FB0DC', roughness: 0.62 }), { cast: false });
  desk.rotation.x = -HALF;
  scene.add(desk);

  /* ---------- the pop-up book ---------- */
  const book = new THREE.Group();
  scene.add(book);
  const PAGE_Y = 0.0765;
  const boardMat = new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.85 });
  [-1, 1].forEach((s) => {
    const board = mesh(new THREE.BoxGeometry(1.08, 0.026, 1.4), boardMat);
    board.position.set(s * 0.545, 0.013, 0);
    book.add(board);
    const edge = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.9 });
    const top = new THREE.MeshStandardMaterial({ color: C.paper, roughness: 0.9 });
    const block = mesh(new THREE.BoxGeometry(1.0, 0.05, 1.32), [edge, edge, top, top, edge, edge]);
    block.position.set(s * 0.51, 0.026 + 0.025, 0);
    book.add(block);
    const page = mesh(new THREE.PlaneGeometry(1.0, 1.32), new THREE.MeshStandardMaterial({ map: s < 0 ? leftGround : rightGround, roughness: 0.92 }), { cast: false });
    page.rotation.x = -HALF;
    page.position.set(s * 0.51, PAGE_Y, 0);
    book.add(page);
  });
  const spine = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 16, 1, false, 0, Math.PI), boardMat);
  spine.rotation.x = HALF;
  spine.rotation.y = Math.PI;
  spine.position.set(0, 0.012, 0);
  book.add(spine);

  // pop-up pieces stand on the page, hinged at their base so they fold flat and rise
  const pops = [];
  function popup(tex, w, h, x, z, delay, lean = 0) {
    const hinge = new THREE.Group();
    hinge.position.set(x, PAGE_Y + pops.length * 0.0006, z);
    const c = card(tex, w, h);
    c.position.y = h / 2;
    hinge.add(c);
    book.add(hinge);
    pops.push({ hinge, delay, lean });
    return hinge;
  }

  await breathe();
  /* ----- left page: home ----- */
  const homeBackTex = pieceTex(1000, 600, (g, w, h) => {
    const top = new Path2D();
    top.moveTo(12, h);
    top.lineTo(12, 210);
    top.bezierCurveTo(60, 130, 150, 120, 200, 160);
    top.bezierCurveTo(240, 88, 340, 78, 380, 138);
    top.bezierCurveTo(430, 110, 490, 118, 520, 170);
    top.bezierCurveTo(580, 160, 620, 176, 650, 196);
    top.bezierCurveTo(710, 118, 830, 100, 880, 158);
    top.bezierCurveTo(930, 128, 984, 160, 988, 220);
    top.lineTo(988, h);
    top.closePath();
    g.save();
    g.clip(top);
    const sky = g.createLinearGradient(0, 80, 0, h);
    sky.addColorStop(0, '#A7CBEC');
    sky.addColorStop(0.55, '#D8E7F1');
    sky.addColorStop(1, '#FBE1B0');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(245,168,0,0.24)';
    circle(g, 770, 410, 150);
    g.fillStyle = C.gold;
    circle(g, 770, 410, 90);
    cloud(g, 170, 220, 1);
    cloud(g, 520, 260, 0.8);
    hills(g, w, h, 440, 70, 0.008, 1.2, '#A3CBA0');
    hills(g, w, h, 510, 60, 0.012, 3.4, '#72B07C');
    palm(g, 110, 560, 270, -0.12);
    palm(g, 905, 580, 230, 0.1);
    g.restore();
  });
  const houseTex = pieceTex(660, 540, (g) => {
    g.fillStyle = C.wall;
    g.fillRect(80, 250, 500, 290);
    g.fillStyle = C.wallS;
    g.fillRect(80, 250, 500, 24);
    g.fillStyle = C.roof;
    g.beginPath(); g.moveTo(36, 266); g.lineTo(330, 92); g.lineTo(624, 266); g.closePath(); g.fill();
    g.save();
    g.beginPath(); g.moveTo(36, 266); g.lineTo(330, 92); g.lineTo(624, 266); g.closePath(); g.clip();
    g.strokeStyle = 'rgba(0,0,0,0.13)';
    g.lineWidth = 5;
    for (let x = 40; x < 640; x += 28) { g.beginPath(); g.moveTo(x, 90); g.lineTo(x, 270); g.stroke(); }
    g.restore();
    g.fillStyle = '#F7F1E3';
    g.fillRect(36, 262, 588, 10);
    g.fillStyle = C.wallS;
    circle(g, 330, 196, 24);
    g.fillStyle = '#8C3B2E';
    circle(g, 330, 196, 16);
    const win = (x, y, ww, hh) => {
      g.fillStyle = '#F7F1E3'; g.fillRect(x - 8, y - 8, ww + 16, hh + 16);
      g.fillStyle = '#BFD6EA'; g.fillRect(x, y, ww, hh);
      g.fillStyle = 'rgba(245,168,0,0.55)'; g.fillRect(x, y, ww * 0.26, hh); g.fillRect(x + ww * 0.74, y, ww * 0.26, hh);
      g.strokeStyle = '#2E5AA8'; g.lineWidth = 5;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + (ww * k) / 4, y); g.lineTo(x + (ww * k) / 4, y + hh); g.stroke(); }
      g.beginPath(); g.moveTo(x, y + hh / 2); g.lineTo(x + ww, y + hh / 2); g.stroke();
      g.fillStyle = '#F7F1E3'; g.fillRect(x - 14, y + hh + 6, ww + 28, 12);
    };
    win(118, 320, 130, 104);
    win(272, 320, 104, 104);
    g.fillStyle = '#F7F1E3';
    g.fillRect(408, 318, 134, 222);
    g.fillStyle = '#FFE2A6';
    g.fillRect(420, 330, 110, 210);
    g.fillStyle = '#7A4B2E';
    g.beginPath(); g.moveTo(420, 330); g.lineTo(452, 340); g.lineTo(452, 530); g.lineTo(420, 540); g.closePath(); g.fill();
    g.fillStyle = C.concrete;
    g.fillRect(396, 524, 158, 16);
    g.fillStyle = '#B5603F';
    rr(g, 92, 486, 46, 50, 8);
    rr(g, 566, 486, 46, 50, 8);
    bush(g, 115, 470, 34);
    bush(g, 589, 470, 34);
    flower(g, 104, 452, 11, '#D8342F');
    flower(g, 600, 456, 11, '#F08BA0');
  });
  const parentTex = pieceTex(320, 700, (g) => {
    g.fillStyle = C.skin;
    g.fillRect(128, 590, 24, 82);
    g.fillRect(170, 590, 24, 82);
    g.fillStyle = '#6B4A3A';
    rr(g, 116, 664, 44, 18, 7);
    rr(g, 164, 664, 44, 18, 7);
    g.fillStyle = C.navy;
    g.beginPath(); g.moveTo(104, 410); g.lineTo(216, 410); g.lineTo(234, 604); g.lineTo(86, 604); g.closePath(); g.fill();
    g.fillStyle = C.gold;
    rr(g, 94, 212, 132, 214, 38);
    g.fillStyle = '#E09A00';
    rr(g, 94, 212, 34, 214, [38, 0, 0, 38]);
    g.fillStyle = C.gold;
    rr(g, 66, 226, 42, 92, 20);
    g.fillStyle = C.skin;
    rr(g, 72, 300, 30, 116, 14);
    circle(g, 87, 420, 17);
    g.fillStyle = C.skinS;
    g.fillRect(146, 176, 28, 46);
    g.fillStyle = '#F7F1E3';
    g.beginPath(); g.moveTo(128, 214); g.lineTo(160, 250); g.lineTo(192, 214); g.closePath(); g.fill();
    g.fillStyle = C.skin;
    g.beginPath(); g.ellipse(160, 126, 64, 70, 0, 0, TAU); g.fill();
    g.fillStyle = C.hair;
    circle(g, 196, 50, 34);
    g.beginPath();
    g.ellipse(160, 108, 70, 62, 0, Math.PI * 1.02, Math.PI * 1.98);
    g.closePath();
    g.fill();
    g.beginPath(); g.moveTo(92, 110); g.quadraticCurveTo(120, 72, 170, 86); g.quadraticCurveTo(140, 96, 110, 150); g.closePath(); g.fill();
    g.strokeStyle = C.ink;
    g.lineWidth = 5;
    g.beginPath(); g.arc(136, 134, 10, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.beginPath(); g.arc(184, 134, 10, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.fillStyle = 'rgba(232,120,110,0.5)';
    circle(g, 118, 156, 12);
    circle(g, 202, 156, 12);
    g.strokeStyle = '#7A3B2E';
    g.lineWidth = 5;
    g.beginPath(); g.arc(160, 158, 16, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
  });
  const parentArmTex = pieceTex(84, 236, (g) => {
    g.fillStyle = C.gold;
    rr(g, 14, 8, 56, 80, 24);
    g.fillStyle = C.skin;
    rr(g, 24, 70, 36, 128, 16);
    circle(g, 42, 204, 22);
  }, 5);
  const hedgeTex = pieceTex(900, 140, (g, w, h) => {
    for (let x = 30; x < w - 20; x += 54) bush(g, x + (rand() - 0.5) * 12, h - 34 - rand() * 12, 38 + rand() * 12);
    g.fillStyle = C.leafDark;
    g.fillRect(12, h - 40, w - 24, 40);
    for (let k = 0; k < 11; k++) flower(g, 50 + k * 80 + rand() * 20, 40 + rand() * 40, 12, k % 3 ? '#D8342F' : '#F08BA0');
  });

  await breathe();
  /* ----- right page: school ----- */
  const schoolBackTex = pieceTex(1000, 640, (g, w, h) => {
    const top = new Path2D();
    top.moveTo(12, h);
    top.lineTo(12, 250);
    top.bezierCurveTo(50, 170, 130, 160, 170, 196);
    top.bezierCurveTo(200, 140, 280, 130, 312, 176);
    top.lineTo(320, 150);
    top.lineTo(680, 150);
    top.lineTo(690, 176);
    top.bezierCurveTo(720, 128, 810, 132, 836, 186);
    top.bezierCurveTo(880, 156, 978, 170, 988, 250);
    top.lineTo(988, h);
    top.closePath();
    g.save();
    g.clip(top);
    const sky = g.createLinearGradient(0, 100, 0, h);
    sky.addColorStop(0, '#A7CBEC');
    sky.addColorStop(1, '#E6EEF2');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    tree(g, 120, 560, 110);
    tree(g, 880, 560, 100);
    g.fillStyle = '#2B6F55';
    g.beginPath(); g.moveTo(96, 262); g.lineTo(904, 262); g.lineTo(862, 214); g.lineTo(138, 214); g.closePath(); g.fill();
    g.fillStyle = C.cream;
    g.fillRect(110, 262, 780, 380);
    g.fillStyle = C.green;
    g.fillRect(104, 256, 792, 16);
    g.fillRect(110, 438, 780, 16);
    g.fillStyle = '#2B6F55';
    g.fillRect(430, 150, 140, 70);
    g.fillStyle = C.cream;
    g.fillRect(442, 162, 116, 58);
    const winRow = (y) => {
      for (let k = 0; k < 9; k++) {
        const x = 138 + k * 84;
        if (k === 4) continue;
        g.fillStyle = '#FFFFFF'; g.fillRect(x - 5, y - 5, 66, 106);
        g.fillStyle = '#CFE3F1'; g.fillRect(x, y, 56, 96);
        g.fillStyle = 'rgba(46,90,168,0.35)';
        for (let s = 8; s < 96; s += 12) g.fillRect(x, y + s, 56, 3);
      }
    };
    winRow(300);
    winRow(482);
    g.fillStyle = '#FFFFFF';
    circle(g, 500, 191, 22);
    g.strokeStyle = C.ink;
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(500, 191); g.lineTo(500, 176); g.moveTo(500, 191); g.lineTo(511, 196); g.stroke();
    g.fillStyle = '#2B6F55';
    g.fillRect(446, 478, 108, 164);
    g.fillStyle = '#CFE3F1';
    g.fillRect(458, 494, 38, 70);
    g.fillRect(504, 494, 38, 70);
    g.fillStyle = C.green;
    g.fillRect(12, h - 26, w, 26);
    g.restore();
  });
  const flagTex = pieceTex(280, 1200, (g) => {
    const pole = g.createLinearGradient(38, 0, 56, 0);
    pole.addColorStop(0, '#E8EBF0');
    pole.addColorStop(1, '#8E96A3');
    g.fillStyle = pole;
    g.fillRect(40, 40, 14, 1130);
    g.fillStyle = C.gold;
    circle(g, 47, 34, 15);
    g.fillStyle = '#C9C1AE';
    rr(g, 10, 1150, 74, 50, 6);
    // the Philippine flag: blue over red, a white triangle at the hoist with the sun and three stars
    g.fillStyle = '#0038A8';
    g.fillRect(54, 70, 210, 53);
    g.fillStyle = '#CE1126';
    g.fillRect(54, 123, 210, 53);
    g.fillStyle = '#FFFFFF';
    g.beginPath(); g.moveTo(54, 70); g.lineTo(145, 123); g.lineTo(54, 176); g.closePath(); g.fill();
    g.fillStyle = '#FCD116';
    circle(g, 82, 123, 12);
    g.strokeStyle = '#FCD116';
    g.lineWidth = 3;
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; g.beginPath(); g.moveTo(82 + Math.cos(a) * 14, 123 + Math.sin(a) * 14); g.lineTo(82 + Math.cos(a) * 22, 123 + Math.sin(a) * 22); g.stroke(); }
    [[62, 81], [62, 165], [130, 123]].forEach(([x, y]) => circle(g, x, y, 4.5));
  });
  const gateTex = pieceTex(840, 560, (g, w, h) => {
    const pillar = (x) => {
      g.fillStyle = C.cream; g.fillRect(x, 150, 120, 380);
      g.fillStyle = C.green; g.fillRect(x - 10, 134, 140, 26); g.fillRect(x - 10, 522, 140, 38);
      g.fillStyle = 'rgba(46,139,87,0.2)'; g.fillRect(x + 20, 190, 80, 300);
    };
    pillar(40);
    pillar(680);
    g.fillStyle = C.green;
    g.beginPath();
    g.moveTo(30, 170);
    g.lineTo(30, 104);
    g.quadraticCurveTo(420, 8, 810, 104);
    g.lineTo(810, 170);
    g.quadraticCurveTo(420, 86, 30, 170);
    g.closePath();
    g.fill();
    g.fillStyle = '#FFFFFF';
    rr(g, 268, 56, 304, 66, 14);
    g.fillStyle = C.green;
    g.font = '900 50px "Barlow Condensed", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('WELCOME', 420, 91);
    g.fillStyle = C.gold;
    circle(g, 100, 114, 16);
    circle(g, 740, 114, 16);
  });
  const turnTex = pieceTex(320, 420, (g) => {
    g.fillStyle = '#8E96A3';
    rr(g, 40, 394, 240, 22, 6);
    const body = g.createLinearGradient(70, 0, 250, 0);
    body.addColorStop(0, '#EEF1F5');
    body.addColorStop(1, '#A7B0BD');
    g.fillStyle = body;
    rr(g, 70, 148, 180, 252, 14);
    g.fillStyle = '#C3CAD5';
    g.beginPath(); g.moveTo(58, 152); g.lineTo(262, 152); g.lineTo(250, 90); g.lineTo(70, 90); g.closePath(); g.fill();
    g.fillStyle = '#1C2433';
    rr(g, 102, 98, 116, 44, 9);
    g.strokeStyle = '#FFFFFF';
    g.lineWidth = 3;
    g.strokeRect(122, 108, 30, 22);
    g.beginPath(); g.arc(164, 119, 8, -0.8, 0.8); g.stroke();
    g.beginPath(); g.arc(164, 119, 15, -0.8, 0.8); g.stroke();
    g.fillStyle = '#16244F';
    g.font = '900 36px "Barlow Condensed", sans-serif';
    g.textAlign = 'center';
    g.fillText('HITC', 160, 250);
    g.fillStyle = C.blue;
    g.fillRect(118, 262, 84, 6);
    g.fillStyle = 'rgba(10,15,28,0.18)';
    for (let y = 300; y < 380; y += 14) g.fillRect(100, y, 120, 4);
  });
  const wheelTex = pieceTex(260, 260, (g) => {
    const steel = g.createLinearGradient(0, 0, 260, 260);
    steel.addColorStop(0, '#F2F4F7');
    steel.addColorStop(1, '#9AA3B0');
    g.fillStyle = steel;
    for (let k = 0; k < 3; k++) {
      g.save();
      g.translate(130, 130);
      g.rotate((k / 3) * TAU - HALF);
      rr(g, 0, -10, 118, 20, 10);
      g.restore();
    }
    circle(g, 130, 130, 28);
    g.fillStyle = '#6E7785';
    circle(g, 130, 130, 10);
  }, 5);
  const plantersTex = pieceTex(900, 130, (g, w, h) => {
    [[20, 400], [480, 400]].forEach(([x, ww]) => {
      for (let k = 0; k < 7; k++) {
        g.fillStyle = C.leaf;
        leaf(g, x + 30 + k * 56, h - 52, -HALF - 0.5, 60);
        leaf(g, x + 30 + k * 56, h - 52, -HALF + 0.5, 60);
      }
      for (let k = 0; k < 6; k++) flower(g, x + 50 + k * 62, 40 + (k % 2) * 16, 11, '#F5C542');
      g.fillStyle = C.green; g.fillRect(x, h - 56, ww, 56);
      g.fillStyle = '#FFFFFF'; g.fillRect(x, h - 56, ww, 9);
    });
  });

  // home
  popup(homeBackTex, 0.94, 0.564, -0.51, -0.5, 0.0);
  const house = popup(houseTex, 0.62, 0.507, -0.6, -0.26, 0.12);
  const parent = popup(parentTex, 0.16, 0.35, -0.41, -0.15, 0.3);
  parent.scale.setScalar(1.28);
  popup(hedgeTex, 0.9, 0.14, -0.52, 0.5, 0.42);
  // the parent's waving arm, on a paper brad at the shoulder
  const parentArm = new THREE.Group();
  parentArm.position.set(0.03, 0.232, 0.003);
  {
    const arm = card(parentArmTex, 0.042, 0.118);
    arm.position.y = -0.05;
    parentArm.add(arm);
  }
  parent.children[0].add(parentArm);
  parentArm.position.y -= 0.175;
  // school
  popup(schoolBackTex, 0.94, 0.6, 0.51, -0.5, 0.06);
  popup(flagTex, 0.14, 0.6, 0.18, -0.36, 0.2);
  popup(gateTex, 0.66, 0.44, 0.58, -0.12, 0.24);
  const turnstile = popup(turnTex, 0.152, 0.2, 0.5, -0.02, 0.36);
  popup(plantersTex, 0.9, 0.13, 0.52, 0.52, 0.48);
  const wheel = new THREE.Group();
  wheel.position.set(-0.043, 0.016, 0.006);
  wheel.add(card(wheelTex, 0.124, 0.124));
  turnstile.children[0].add(wheel);
  const ledMat = new THREE.MeshBasicMaterial({ color: '#3F8CFF', toneMapped: false });
  const led = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 0.01), ledMat);
  led.position.set(0.02, 0.043, 0.004);
  turnstile.children[0].add(led);

  await breathe();
  /* ---------- the student (a paper doll on brads) ---------- */
  const studentTex = pieceTex(400, 600, (g) => {
    g.fillStyle = '#1656D6';
    rr(g, 66, 300, 96, 176, 28);
    g.fillStyle = C.navy;
    g.beginPath(); g.moveTo(124, 452); g.lineTo(276, 452); g.lineTo(300, 590); g.lineTo(100, 590); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 3;
    for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(124 + k * 25, 456); g.lineTo(100 + k * 33, 588); g.stroke(); }
    g.fillStyle = C.white;
    rr(g, 116, 300, 168, 176, 42);
    g.fillStyle = C.shade;
    rr(g, 116, 300, 40, 176, [42, 0, 0, 42]);
    g.fillStyle = C.white;
    rr(g, 90, 312, 42, 74, 20);
    g.fillStyle = C.skin;
    rr(g, 96, 372, 30, 98, 13);
    circle(g, 111, 474, 17);
    g.fillStyle = '#1656D6';
    g.fillRect(150, 300, 16, 90);
    g.fillStyle = C.skinS;
    g.fillRect(184, 276, 32, 36);
    g.fillStyle = '#FFFFFF';
    g.strokeStyle = '#B9C2D2';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(160, 300); g.lineTo(200, 338); g.lineTo(186, 300); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(240, 300); g.lineTo(200, 338); g.lineTo(214, 300); g.closePath(); g.fill(); g.stroke();
    // checked neck ribbon, like their uniforms
    g.fillStyle = '#8D96A8';
    g.beginPath(); g.moveTo(200, 326); g.lineTo(166, 312); g.lineTo(170, 344); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(200, 326); g.lineTo(234, 312); g.lineTo(230, 344); g.closePath(); g.fill();
    g.fillStyle = '#5D6679';
    circle(g, 200, 327, 8);
    // ID on a lanyard
    g.strokeStyle = '#1F5E43';
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(178, 300); g.lineTo(196, 372); g.moveTo(222, 300); g.lineTo(204, 372); g.stroke();
    g.fillStyle = '#FFFFFF';
    rr(g, 162, 370, 76, 94, 9);
    g.strokeStyle = '#B9C2D2';
    g.lineWidth = 2.5;
    g.beginPath(); g.roundRect(162, 370, 76, 94, 9); g.stroke();
    g.fillStyle = C.blue;
    rr(g, 162, 370, 76, 22, [9, 9, 0, 0]);
    g.fillStyle = '#C9D6EA';
    g.fillRect(172, 400, 24, 30);
    g.fillStyle = C.skinS;
    circle(g, 184, 411, 7);
    g.fillStyle = '#7A8499';
    g.fillRect(202, 404, 26, 5);
    g.fillRect(202, 416, 20, 5);
    g.fillRect(172, 440, 56, 5);
    g.fillStyle = C.skin;
    circle(g, 200, 170, 126);
    circle(g, 76, 182, 20);
    circle(g, 324, 182, 20);
    g.fillStyle = C.hair;
    g.beginPath(); g.arc(200, 168, 134, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(68, 160);
    for (let k = 0; k <= 8; k++) g.quadraticCurveTo(84 + k * 30, 100 + (k % 2) * 30, 96 + k * 30, 128 + (k % 2 ? 0 : 12));
    g.lineTo(332, 160);
    g.lineTo(332, 120);
    g.lineTo(68, 120);
    g.closePath();
    g.fill();
    rr(g, 62, 140, 44, 146, 22);
    rr(g, 294, 140, 44, 146, 22);
    g.fillStyle = C.gold;
    rr(g, 262, 84, 40, 16, 7);
    g.fillStyle = 'rgba(242,130,120,0.5)';
    circle(g, 130, 222, 16);
    circle(g, 270, 222, 16);
    g.strokeStyle = '#7A3B2E';
    g.lineWidth = 6;
    g.beginPath(); g.arc(200, 232, 16, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
  });
  const legTex = pieceTex(60, 170, (g) => {
    g.fillStyle = C.skin; rr(g, 16, 0, 28, 110, 12);
    g.fillStyle = '#FFFFFF'; rr(g, 14, 94, 32, 44, 8);
    g.fillStyle = '#16181F'; rr(g, 6, 128, 52, 36, 13);
    g.fillStyle = 'rgba(255,255,255,0.35)'; rr(g, 14, 134, 16, 6, 3);
  }, 4);
  const armTex = pieceTex(70, 210, (g) => {
    g.fillStyle = C.white; rr(g, 8, 0, 54, 72, 22);
    g.fillStyle = C.skin; rr(g, 16, 58, 38, 118, 16);
    circle(g, 35, 182, 21);
  }, 4);
  const eyesTex = (open) => canvasTex(200, 80, (g) => {
    g.fillStyle = '#1B1616';
    g.strokeStyle = '#1B1616';
    g.lineWidth = 7;
    g.lineCap = 'round';
    if (open) {
      [58, 142].forEach((x) => { g.beginPath(); g.ellipse(x, 42, 17, 22, 0, 0, TAU); g.fill(); });
      g.fillStyle = '#FFFFFF';
      circle(g, 64, 33, 6);
      circle(g, 148, 33, 6);
    } else {
      [58, 142].forEach((x) => { g.beginPath(); g.arc(x, 30, 18, Math.PI * 0.12, Math.PI * 0.88); g.stroke(); });
    }
  });
  const EYES_OPEN = eyesTex(true);
  const EYES_SHUT = eyesTex(false);

  const student = new THREE.Group();
  const doll = new THREE.Group();
  student.add(doll);
  const LEG = 0.065;
  const body = card(studentTex, 0.2, 0.3);
  body.position.y = LEG + 0.15;
  doll.add(body);
  const eyeMat = new THREE.MeshBasicMaterial({ map: EYES_SHUT, transparent: true, alphaTest: 0.3, toneMapped: false, color: '#b8a9a0' });
  const eyes = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.04), eyeMat);
  eyes.position.set(0, LEG + 0.15 + 0.056, 0.002);
  doll.add(eyes);
  const legs = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.028, LEG + 0.02, -0.002);
    const l = card(legTex, 0.03, 0.085);
    l.position.y = -0.0425;
    pivot.add(l);
    doll.add(pivot);
    return pivot;
  });
  const arm = new THREE.Group();
  arm.position.set(0.041, LEG + 0.139, 0.003);
  {
    const a = card(armTex, 0.035, 0.105);
    a.position.y = -0.05;
    arm.add(a);
  }
  doll.add(arm);
  student.position.set(-0.27, PAGE_Y, 0.1);
  student.scale.setScalar(1.12);
  book.add(student);
  const studentLight = new THREE.PointLight('#FFF1D6', 0.5, 0.9, 1.6);
  scene.add(studentLight);

  // zzz while she dozes by the door
  const zTex = canvasTex(128, 128, (g) => { g.fillStyle = '#F4F4F0'; g.font = '96px Schoolbell'; g.textAlign = 'center'; g.fillText('z', 64, 96); });
  const zs = [0, 1, 2].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false, fog: false })); book.add(s); return s; });
  // the scan: rings pulse out of the reader, one after another
  const ringTex = canvasTex(128, 128, (g) => { g.strokeStyle = '#FFFFFF'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.stroke(); });
  const rings = [0, 1, 2].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: '#2BD67B', transparent: true, depthWrite: false, opacity: 0, fog: false, toneMapped: false })); book.add(s); return s; });

  /* ---------- the paper plane: the SMS, flying home ---------- */
  const planeGeo = new THREE.BufferGeometry();
  planeGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0.075, -0.042, 0.004, -0.04, 0, -0.004, -0.032,
    0, 0, 0.075, 0, -0.004, -0.032, 0.042, 0.004, -0.04,
    0, 0, 0.075, 0, -0.004, -0.032, 0, -0.024, -0.03,
  ], 3));
  planeGeo.computeVertexNormals();
  const paperPlane = mesh(planeGeo, new THREE.MeshStandardMaterial({ color: '#FFFFFF', side: THREE.DoubleSide, roughness: 0.7, flatShading: true }));
  paperPlane.visible = false;
  scene.add(paperPlane);
  const dotTex = canvasTex(32, 32, (g) => { g.fillStyle = '#FFFFFF'; circle(g, 16, 16, 12); });
  const trail = Array.from({ length: 7 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, transparent: true, depthWrite: false, fog: false, opacity: 0 })); s.scale.setScalar(0.016); scene.add(s); return s; });

  await breathe();
  /* ---------- the parent's phone, running Campus Connect ---------- */
  const BODY_W = 0.352, BODY_H = 0.759, BODY_T = 0.022, SCR_W = 0.33, SCR_H = 0.737;
  const phone = new THREE.Group();
  scene.add(phone);
  {
    const bodyGeo = new THREE.ExtrudeGeometry(roundedRect(BODY_W - 0.006, BODY_H - 0.006, 0.048), { depth: BODY_T - 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 10 });
    bodyGeo.rotateX(-HALF);
    bodyGeo.translate(0, 0.003, 0);
    phone.add(mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: '#0A0F1C', roughness: 0.32, metalness: 0.45 })));
  }
  const ccMarkPaths = [
    ['M24.8 11.6a9.2 9.2 0 1 0 0 12.8', '#1E6BFF', 4.4],
    ['M22.1 14.6a5 5 0 1 0 0 6.8', '#F5A800', 2.4],
  ].map(([d, c, w]) => ({ p: new Path2D(d), c, w }));
  const ccCap = new Path2D('M13.2 16.4 19 13.6l5.8 2.8-5.8 2.8Z');
  function drawMark(g, x, y, s) {
    g.save();
    g.translate(x, y);
    g.scale(s / 36, s / 36);
    g.fillStyle = '#FFFFFF'; rr(g, 0, 0, 36, 36, 10);
    g.fillStyle = '#16244F'; rr(g, 3, 3, 30, 30, 8);
    g.lineCap = 'round';
    ccMarkPaths.forEach(({ p, c, w }) => { g.strokeStyle = c; g.lineWidth = w; g.stroke(p); });
    g.fillStyle = '#FFFFFF'; g.fill(ccCap);
    g.restore();
  }
  // The screen is drawn from the same coordinates as the section's HTML phone, so the
  // phone the story lands on is the phone the section shows.
  const dates = window.hitcDates || { today: 'Sep 25, 2026', yday: 'Sep 24, 2026' };
  const drawPhone = (g) => {
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.fillStyle = '#F3F5F9'; g.fillRect(0, 0, 300, 670);
    g.textBaseline = 'top';
    const font = (wt, px) => `${wt} ${px}px "Space Grotesk", sans-serif`;
    g.fillStyle = '#0A0F1C'; g.font = font(600, 15); g.fillText('7:02', 26, 17);
    g.save();
    g.translate(300 - 22 - 58, 17);
    g.fillStyle = '#0A0F1C';
    [[0, 9, 5], [5, 6, 8], [10, 3, 11], [15, 0, 14]].forEach(([x, y, h]) => rr(g, x, y, 3, h, 1));
    g.strokeStyle = '#0A0F1C'; g.lineWidth = 1.8; g.lineCap = 'round';
    g.beginPath(); g.arc(29, 12.5, 7.5, Math.PI * 1.22, Math.PI * 1.78); g.stroke();
    g.beginPath(); g.arc(29, 12.5, 4.2, Math.PI * 1.22, Math.PI * 1.78); g.stroke();
    circle(g, 29, 12, 1.5);
    g.lineWidth = 1.5; g.beginPath(); g.roundRect(39.5, 1.5, 16, 11, 3); g.stroke();
    rr(g, 41.5, 3.5, 10, 7, 1.5);
    rr(g, 56.5, 5, 1.5, 4, 0.7);
    g.restore();
    g.fillStyle = '#1E6BFF'; rr(g, 12, 48, 276, 54, 16);
    drawMark(g, 22, 57, 36);
    g.fillStyle = '#FFFFFF'; g.font = font(600, 16); g.fillText('Campus Connect', 70, 67);
    g.fillStyle = '#1E6BFF'; rr(g, 12, 114, 128, 34, 17);
    g.fillStyle = '#FFFFFF'; g.font = font(500, 13); g.textAlign = 'center'; g.fillText('Add ID Card', 76, 124); g.textAlign = 'left';
    g.fillStyle = '#1E6BFF'; g.fillText('Settings', 168, 124);
    g.fillStyle = '#7A8499'; g.font = font(400, 11); g.fillText('Showing the latest updates', 16, 164);
    const items = [
      ['Time in', 'Maria dela Cruz: Time In', ['Maria dela Cruz arrived on campus at', `${dates.today} 7:02 AM.`], true],
      ['Tuition', 'Tuition payment posted', ['A tuition payment for Maria dela Cruz', 'was received.'], false],
      ['Announcement', 'A message from the school', ['School announcements arrive here,', 'in the same feed.'], false],
      ['Time out', 'Maria dela Cruz: Time Out', ['Maria dela Cruz left the campus at', `${dates.yday} 4:31 PM.`], false],
    ];
    items.forEach(([kind, title, body, isNew], i) => {
      const y = 184 + i * 112;
      if (isNew) { g.fillStyle = '#E7EFFF'; rr(g, 8, y + 4, 284, 104, 14); }
      g.strokeStyle = '#1E6BFF'; g.lineWidth = 2;
      g.beginPath(); g.arc(27, y + 22, 5, 0, TAU); g.stroke();
      g.fillStyle = '#1E6BFF'; g.font = font(700, 10.5);
      if ('letterSpacing' in g) g.letterSpacing = '0.63px';
      g.fillText(kind.toUpperCase(), 40, y + 17);
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      g.fillStyle = '#0A0F1C'; g.font = font(600, 14); g.fillText(title, 20, y + 38);
      g.fillStyle = '#5A6880'; g.font = font(400, 12);
      body.forEach((line, k) => g.fillText(line, 20, y + 60 + k * 16));
      g.fillStyle = '#9AA3B5'; g.font = font(400, 20); g.fillText('›', 274, y + 46);
      g.fillStyle = '#E3E7EF'; g.fillRect(16, y + 111, 268, 1);
    });
  };
  const phoneTex = canvasTex(600, 1340, drawPhone);
  document.fonts && document.fonts.ready.then(() => {
    const g = phoneTex.userData.canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, 600, 1340);
    drawPhone(g);
    phoneTex.needsUpdate = true;
    needFrame = true;
  });
  const screenMat = new THREE.MeshBasicMaterial({ map: phoneTex, toneMapped: false, fog: false, color: new THREE.Color(0.05, 0.06, 0.08) });
  {
    const geo = new THREE.ShapeGeometry(roundedRect(SCR_W, SCR_H, 0.0396), 10);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / SCR_W + 0.5, pos.getY(i) / SCR_H + 0.5);
    geo.rotateX(-HALF);
    const scr = new THREE.Mesh(geo, screenMat);
    scr.position.y = BODY_T + 0.0008;
    phone.add(scr);
  }
  const phoneLight = new THREE.PointLight('#CFE0FF', 0, 1.3, 1.8);
  scene.add(phoneLight);

  await breathe();
  /* ---------- a stack of the books they print ---------- */
  const stack = new THREE.Group();
  scene.add(stack);
  function coverTex(bg, ink, accent) {
    return canvasTex(512, 700, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = accent; g.fillRect(0, h * 0.62, w, 26);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, 0, 34, h);
      g.font = '900 120px "Barlow Condensed", sans-serif';
      g.textBaseline = 'alphabetic';
      const letters = [['H', ink], ['I', accent], ['T', accent], ['C', ink]];
      let x = 90;
      letters.forEach(([ch, col]) => { g.fillStyle = col; g.fillText(ch, x, h * 0.5); x += g.measureText(ch).width + 4; });
      grain(g, w, h, 0.04);
    });
  }
  const pagesMat = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.9 });
  const bookSpecs = [
    { w: 0.74, d: 1.0, t: 0.07, bg: '#1E6BFF', ink: '#F4F4F0', accent: '#0A0F1C', rot: 0.08 },
    { w: 0.7, d: 0.96, t: 0.06, bg: '#F5A800', ink: '#16244F', accent: '#1E6BFF', rot: -0.1 },
    { w: 0.72, d: 0.98, t: 0.075, bg: '#16244F', ink: '#F4F4F0', accent: '#5B93FF', rot: 0.04 },
  ];
  let sy = 0;
  let topCover = null;
  stack.scale.setScalar(0.82);
  bookSpecs.forEach((b, i) => {
    const bk = new THREE.Group();
    const cMat = new THREE.MeshStandardMaterial({ map: coverTex(b.bg, b.ink, b.accent), roughness: 0.7 });
    const sideMat = new THREE.MeshStandardMaterial({ color: b.bg, roughness: 0.7 });
    const last = i === bookSpecs.length - 1;
    const block = mesh(new THREE.BoxGeometry(b.w - 0.02, b.t - 0.012, b.d - 0.02), [pagesMat, sideMat, sideMat, sideMat, pagesMat, pagesMat]);
    block.position.y = b.t / 2;
    bk.add(block);
    const bottom = mesh(new THREE.BoxGeometry(b.w, 0.008, b.d), sideMat);
    bottom.position.y = 0.004;
    bk.add(bottom);
    const hingeG = new THREE.Group();
    hingeG.position.set(-b.w / 2, b.t - 0.004, 0);
    const cover = mesh(new THREE.BoxGeometry(b.w, 0.008, b.d), [sideMat, sideMat, cMat, sideMat, sideMat, sideMat]);
    cover.position.x = b.w / 2;
    hingeG.add(cover);
    bk.add(hingeG);
    bk.position.y = sy;
    bk.rotation.y = b.rot;
    sy += b.t;
    stack.add(bk);
    if (last) topCover = hingeG;
  });

  /* ---------- a pencil ---------- */
  const pencil = new THREE.Group();
  {
    const woodMat = new THREE.MeshStandardMaterial({ color: '#F5A800', roughness: 0.5 });
    const shaft = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.6, 6), woodMat);
    pencil.add(shaft);
    const cone = mesh(new THREE.CylinderGeometry(0.003, 0.018, 0.07, 6), new THREE.MeshStandardMaterial({ color: '#E8C79A', roughness: 0.8 }));
    cone.position.y = 0.335;
    pencil.add(cone);
    const lead = mesh(new THREE.ConeGeometry(0.004, 0.012, 6), new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.4 }));
    lead.position.y = 0.375;
    pencil.add(lead);
    const ferrule = mesh(new THREE.CylinderGeometry(0.0195, 0.0195, 0.04, 12), new THREE.MeshStandardMaterial({ color: '#C8CCD3', metalness: 0.7, roughness: 0.3 }));
    ferrule.position.y = -0.32;
    pencil.add(ferrule);
    const eraser = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 12), new THREE.MeshStandardMaterial({ color: '#E77F8A', roughness: 0.8 }));
    eraser.position.y = -0.36;
    pencil.add(eraser);
    pencil.rotation.set(0, 0.5, HALF);
    pencil.position.set(-0.35, 0.018, 1.02);
    pencil.rotation.y = 0.12;
  }
  scene.add(pencil);

  await breathe();
  /* ---------- lights ---------- */
  const hemi = new THREE.HemisphereLight('#CFE0FF', '#1A2445', 0.62);
  scene.add(hemi);
  // morning sun through a classroom window: the only light that casts shadows
  const sun = new THREE.DirectionalLight('#FFD9A6', 2.3);
  sun.position.set(-2.6, 3.4, 2.0);
  sun.target.position.set(0.2, 0, -0.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lowPower ? 768 : 1024, lowPower ? 768 : 1024);
  sun.shadow.camera.left = -2.6;
  sun.shadow.camera.right = 2.8;
  sun.shadow.camera.top = 2.2;
  sun.shadow.camera.bottom = -2.2;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 10;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#A9C0FF', 0.4);
  fill.position.set(2.6, 2.2, 3.2);
  fill.target.position.set(0, 0.2, 0);
  scene.add(fill, fill.target);
  const rim = new THREE.DirectionalLight('#FFE4BE', 0.35);
  rim.position.set(0.4, 2.2, -3.2);
  scene.add(rim);
  const readerLight = new THREE.PointLight('#3F8CFF', 0.3, 0.45, 1.8);
  scene.add(readerLight);

  /* ---------- state ---------- */
  const REST = new THREE.Vector3(-0.27, PAGE_Y, 0.1);
  const state = {
    mode: 'sleep',          // sleep | awake | return
    awakeUntil: 0,
    scanAt: -99,            // last tap on the reader
    phoneAt: -99,           // last tap on the phone
    coverAt: -99,           // last tap on the books
    pointer: new THREE.Vector2(0, 0),
    pointerIn: false,
    look: new THREE.Vector2(0, 0),
  };
  const walkTo = new THREE.CatmullRomCurve3([
    REST.clone(),
    new THREE.Vector3(-0.1, PAGE_Y, 0.16),
    new THREE.Vector3(0.12, PAGE_Y, 0.17),
    new THREE.Vector3(0.3, PAGE_Y, 0.12),
    new THREE.Vector3(0.39, PAGE_Y, 0.09),
  ], false, 'centripetal');
  const walkIn = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.39, PAGE_Y, 0.09),
    new THREE.Vector3(0.52, PAGE_Y, 0.11),
    new THREE.Vector3(0.66, PAGE_Y, 0.05),
    new THREE.Vector3(0.7, PAGE_Y, -0.12),
    new THREE.Vector3(0.64, PAGE_Y, -0.3),
  ], false, 'centripetal');
  const pos = REST.clone();
  const vel = new THREE.Vector3();
  const target = new THREE.Vector3();
  const lastPos = REST.clone();
  let facing = 1;
  let stride = 0;

  const doodleEls = {};
  document.querySelectorAll('[data-doodle]').forEach((el) => { doodleEls[el.dataset.doodle] = el; });

  /* ---------- camera framing ---------- */
  const camA = new THREE.Vector3();
  const lookA = new THREE.Vector3();
  const camB = new THREE.Vector3();
  const phoneTop = new THREE.Vector3();
  const phoneUp = new THREE.Vector3();
  const readerPos = new THREE.Vector3();
  let flight = null;
  let offX = 0, offY = 0, W = 1, H = 1, landX = 0, landY = 0;
  let copyBox = { right: 0, bottom: 0 };
  let portraitView = false;
  let framed = false;
  // 100svh measured once per resize: the height you can see while the browser bars show
  const svhProbe = document.createElement('div');
  svhProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
  document.body.appendChild(svhProbe);
  let barGap = 0;
  let holeX = 0, holeY = 0;
  // Move the scene sideways (or down, on tall screens) so it clears the copy and stays on screen,
  // and pull the camera back when there isn't room for both.
  const fitPts = [
    new THREE.Vector3(-1.09, 0.03, 0.72), new THREE.Vector3(-1.09, 0.68, -0.5),
    new THREE.Vector3(1.09, 0.68, -0.5), new THREE.Vector3(1.09, 0.03, 0.72),
  ];
  const fitTmp = new THREE.Vector3();
  function fitScene(portrait) {
    const pts = fitPts.slice();
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => {
      pts.push(phone.localToWorld(new THREE.Vector3(a * BODY_W / 2, 0, b * BODY_H / 2)));
      if (!portrait) pts.push(stack.localToWorld(new THREE.Vector3(a * 0.37, 0.22, b * 0.5)));
    });
    const base = camA.clone().sub(lookA);
    const visBottom = H - barGap;
    let dist = 1;
    for (let i = 0; i < 14; i++) {
      camera.position.copy(lookA).addScaledVector(base, dist);
      camera.up.set(0, 1, 0);
      camera.lookAt(lookA);
      camera.setViewOffset(W, H, offX * W, offY * H + barGap / 2, W, H);
      camera.updateMatrixWorld();
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const q of pts) {
        fitTmp.copy(q).project(camera);
        const x = (fitTmp.x * 0.5 + 0.5) * W, y = (-fitTmp.y * 0.5 + 0.5) * H;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      if (!portrait) {
        const needL = copyBox.right + 24 - minX, roomR = W - 12 - maxX;
        const tooTall = minY < 66 || maxY > visBottom - 10;
        if (needL <= 0 && roomR >= 0 && !tooTall) break;
        if (!tooTall && needL > 0 && roomR >= needL) { offX -= (needL + 2) / W; continue; }
        if (!tooTall && needL <= 0 && roomR < 0 && -needL >= -roomR) { offX += (-roomR + 2) / W; continue; }
        dist *= 1.06;
      } else {
        const needT = copyBox.bottom - 24 - minY, roomB = visBottom - 16 - maxY;
        const tooWide = minX < 4 || maxX > W - 4;
        if (needT <= 0 && roomB >= 0 && !tooWide) break;
        if (!tooWide && needT > 0 && roomB >= needT) { offY -= (needT + 2) / H; continue; }
        if (!tooWide && needT <= 0 && roomB < 0 && -needT >= -roomB) { offY += (-roomB + 2) / H; continue; }
        dist *= 1.06;
      }
    }
    camA.copy(lookA).addScaledVector(base, dist);
  }
  function frame() {
    W = hero.clientWidth;
    H = hero.clientHeight;
    const visH = svhProbe.offsetHeight;
    barGap = visH > 100 ? Math.max(0, H - visH) : 0;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    needFrame = needShadow = true;
    // labels and framing never sit on the copy: measure the text block once per resize
    const hr = hero.getBoundingClientRect();
    copyBox = { right: 0, bottom: 0 };
    copy.querySelectorAll('.wrap > *').forEach((el) => {
      const r = el.getBoundingClientRect();
      copyBox.right = Math.max(copyBox.right, r.right - hr.left);
      copyBox.bottom = Math.max(copyBox.bottom, r.bottom - hr.top);
    });
    const portrait = camera.aspect < 0.9;
    if (portrait) {
      phone.position.set(0.6, 0, 1.3);
      phone.rotation.y = -0.16;
      stack.position.set(-1.2, 0, -1.35);
      stack.rotation.y = -0.3;
      const dist = 5.6 + (0.9 - camera.aspect) * 6.2;
      lookA.set(0.08, 0.1, 0.42);
      camA.set(lookA.x, lookA.y + dist * 0.74, lookA.z + dist * 0.67);
      offX = 0;
      offY = -0.24;
      scene.fog.near = 11;
      scene.fog.far = 22;
    } else {
      phone.position.set(1.3, 0, 0.92);
      phone.rotation.y = -0.38;
      stack.position.set(1.72, 0, -1.3);
      stack.rotation.y = 0.2;
      camA.set(0.36, 3.2, 4.6);
      lookA.set(0.36, 0.14, 0.18);
      scene.fog.near = 8;
      scene.fog.far = 17;
      offX = camera.aspect > 1.25 ? -0.185 : -0.09;
      offY = -0.04;
    }
    scene.updateMatrixWorld(true);
    fitScene(portrait);
    turnstile.children[0].localToWorld(readerPos.set(0.02, 0.05, 0.02));
    phone.localToWorld(phoneTop.set(0, BODY_T, 0));
    phoneUp.set(0, 0, -1).applyQuaternion(phone.quaternion);
    flight = new THREE.CatmullRomCurve3([
      readerPos.clone(),
      readerPos.clone().add(new THREE.Vector3(0.1, 0.35, 0.05)),
      new THREE.Vector3(lerp(readerPos.x, phoneTop.x, 0.6), 0.85, lerp(readerPos.z, phoneTop.z, 0.6)),
      phoneTop.clone().add(new THREE.Vector3(0, 0.25, 0.1)),
      phoneTop.clone().add(new THREE.Vector3(0, 0.01, 0.12)),
    ], false, 'centripetal');
    // Land where the section's phone will be when the story hands off, at the same size.
    window.hitcSizePhone && window.hitcSizePhone();
    const sr = ccSection.getBoundingClientRect();
    const pr = ccPhone.getBoundingClientRect();
    let lw = pr.width, lh = pr.height, lx = pr.left + pr.width / 2, ly = pr.top - sr.top + pr.height / 2;
    if (ly + lh / 2 > H - 4 || lw < 40) {
      const s = Math.min(1, (H * 0.78) / 690);
      lw = 320 * s; lh = 690 * s; lx = W / 2; ly = H / 2 + 20;
    }
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = (BODY_H * H) / (2 * t * lh);
    camB.copy(phoneTop).add(new THREE.Vector3(0, d, 0));
    landX = W / 2 - lx;
    landY = H / 2 - ly;
    paper.style.width = lw + 'px';
    paper.style.height = lh + 'px';
    paper.style.borderRadius = (46 * lw) / 320 + 'px';
    holeX = lx - lw / 2;
    holeY = ly - lh / 2;
    paper.style.transform = `translate(${holeX.toFixed(1)}px, ${holeY.toFixed(1)}px)`;
    if (!framed) { camera.position.copy(camA); framed = true; }
    camera.updateProjectionMatrix();
    portraitView = portrait;
    Object.values(doodleEls).forEach((el) => {
      const inner = el.firstElementChild;
      el._w = inner.offsetWidth;
      el._h = inner.offsetHeight;
      el._dx = parseFloat(inner.style.getPropertyValue('--dx') || '-10') / 100;
      el._dy = parseFloat(inner.style.getPropertyValue('--dy') || '-100') / 100;
    });
  }
  frame();
  let lastSize = '';
  new ResizeObserver(() => {
    const size = hero.clientWidth + 'x' + hero.clientHeight;
    if (size === lastSize) return;
    lastSize = size;
    frame();
    if (root.classList.contains('has-story')) {
      root.style.setProperty('--story-overlap', hero.offsetHeight + 'px');
      window.ScrollTrigger && ScrollTrigger.refresh();
    }
  }).observe(hero);

  /* ---------- the scroll story (the pin is made early, in the page script) ---------- */
  const S = window.hitcStory || { t: 0, trigger: null };
  const story = { p: S.t || 0 };
  S.driven = true;
  S.onUpdate = () => run();
  // Read the reduced-motion query once and then only from its change event: reading
  // .matches every frame stops Chromium from sending the event at all.
  let still = reduceMq.matches;
  reduceMq.addEventListener('change', (e) => { still = e.matches; story.p = S.t; needFrame = needShadow = true; run(); });

  /* ---------- picking ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickables = [
    { key: 'student', obj: student },
    { key: 'reader', obj: turnstile },
    { key: 'phone', obj: phone },
    { key: 'books', obj: stack },
  ];
  function pickAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickables.map((p) => p.obj), true);
    for (const h of hits) {
      // cards are alpha-cut, so skip hits on their transparent corners
      const m = h.object.material;
      if (m && m.map && m.alphaTest && h.uv) {
        const img = m.map.image;
        if (img && img.getContext) {
          const px = img.getContext('2d').getImageData(Math.floor(h.uv.x * (img.width - 1)), Math.floor((1 - h.uv.y) * (img.height - 1)), 1, 1).data;
          if (px[3] < 128) continue;
        }
      }
      let o = h.object;
      while (o) {
        const p = pickables.find((q) => q.obj === o);
        if (p) return p.key;
        o = o.parent;
      }
    }
    return null;
  }
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PAGE_Y);
  const hit = new THREE.Vector3();
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    state.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    state.pointerIn = true;
    if (state.mode === 'awake') state.awakeUntil = Math.max(state.awakeUntil, clock.elapsedTime + 3);
    if (e.pointerType === 'mouse') canvas.style.cursor = story.p < 0.05 && pickAt(e.clientX, e.clientY) ? 'pointer' : '';
  });
  canvas.addEventListener('pointerleave', () => { state.pointerIn = false; canvas.style.cursor = ''; });
  canvas.addEventListener('click', (e) => { if (story.p < 0.05) act(pickAt(e.clientX, e.clientY)); });
  // Page-level pointer drives the gentle lean, even over the copy.
  window.addEventListener('pointermove', (e) => {
    if (!fineMq.matches) return;
    state.look.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });
  Object.entries(doodleEls).forEach(([k, el]) => {
    if (el.tagName === 'BUTTON') el.addEventListener('click', () => act(k));
  });

  const live = document.getElementById('hero-live');
  function say(msg) { live.textContent = ''; requestAnimationFrame(() => { live.textContent = msg; }); }
  function act(key) {
    if (!key) return;
    const now = clock.elapsedTime;
    if (key === 'student') {
      if (state.mode === 'awake') { state.mode = 'return'; say('The student goes back to the door.'); }
      else { state.mode = 'awake'; state.awakeUntil = now + 7; say('The student is awake and walks toward your pointer.'); }
    } else if (key === 'reader') {
      if (now - state.scanAt > 2.2) state.scanAt = now;
      say('ID scanned at the gate. Time in, 7:02 AM. The alert is on its way to the parent\u2019s phone.');
    } else if (key === 'phone') {
      state.phoneAt = now;
      say('The parent\u2019s phone shows Campus Connect: time in, tuition payment, a school announcement, time out.');
    } else if (key === 'books') {
      if (now - state.coverAt > 1.8) state.coverAt = now;
      say('The top book opens.');
    }
    needFrame = needShadow = true;
    updateStudentLabel();
  }
  function updateStudentLabel() {
    const el = doodleEls.student;
    el.querySelector('.doodle__word').textContent = state.mode === 'awake' ? 'off to school!' : '5 more minutes…';
    el.querySelector('[data-sr]').textContent = state.mode === 'awake' ? ' (let the student rest)' : ' (wake the student)';
  }

  /* ---------- per-frame ---------- */
  // THREE.Clock is deprecated since r183 (console warning): the same getDelta/elapsedTime on performance.now()
  const clock = { elapsedTime: 0, last: 0, getDelta() { const n = performance.now(); const d = this.last ? (n - this.last) / 1000 : 0; this.last = n; this.elapsedTime += d; return d; } };
  const v3 = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const upV = new THREE.Vector3();
  const Y_UP = new THREE.Vector3(0, 1, 0);
  const LED_BLUE = new THREE.Color('#3F8CFF');
  const LED_GREEN = new THREE.Color('#2BD67B');
  const ANCHORS = {
    student: () => tmp.copy(student.position).add(v3.set(-0.06, 0.4, 0)),
    reader: () => tmp.copy(readerPos).add(v3.set(0.05, 0.05, 0)),
    phone: () => phone.localToWorld(tmp.set(-0.12, BODY_T, -0.34)),
    books: () => stack.localToWorld(tmp.set(-0.3, 0.22, 0.2)),
    timein: () => tmp.copy(readerPos).add(v3.set(0, 0.16, 0)),
  };
  const LABEL_ORDER = ['timein', 'student', 'reader', 'phone', 'books'];
  const placed = [];
  let visible = true;
  let ready = false;
  // The pop-up intro starts once frames are flowing (three in a row under 50 ms after the first frame), so a
  // one-off stall while the GPU warms up never makes the first pop-ups jump.
  let introAt = Infinity;
  let settled = 0;

  function tick() {
    const raw = clock.getDelta();
    const dt = Math.min(raw, 0.05);
    const t = clock.elapsedTime;
    if (introAt === Infinity && ready) { settled = raw < 0.05 ? settled + 1 : 0; if (settled >= 3) introAt = t + 0.2; }
    // with reduced motion the scene is still, so only draw when something changed
    if (still && ready && !needFrame && state.mode === 'sleep' && t - state.scanAt > 7.2 && t - state.phoneAt > 5.2 && t - state.coverAt > 2) return;
    needFrame = false;

    // story progress eases toward the scroll position, like a soft scrub, but never trails
    // the pin by more than a little: a fast fling used to unpin a half-told story
    const st = S.t;
    story.p += (st - story.p) * (1 - Math.exp(-dt * 7));
    story.p = clamp(story.p, st - 0.04, st + 0.04);
    if (Math.abs(st - story.p) < 0.0004) story.p = st;
    const p = story.p;

    // the pop-ups rise when the page loads, one after another, with a little spring
    for (const pc of pops) {
      const k = still ? 1 : clamp((t - introAt - pc.delay) / 0.75, 0, 1);
      const up = still ? 1 : backOut(k);
      pc.hinge.rotation.x = -HALF * (1 - up) + pc.lean;
    }
    const introStudent = still ? 1 : backOut(clamp((t - introAt - 0.5) / 0.7, 0, 1));

    // ---- the student ----
    const wake = smooth(0.03, 0.07, p);
    const w1 = smooth(0.06, 0.3, p);
    const w2 = smooth(0.36, 0.5, p);
    const inStory = p > 0.02;
    if (state.mode === 'awake' && t > state.awakeUntil) { state.mode = 'return'; updateStudentLabel(); }
    if (state.mode === 'awake') {
      if (state.pointerIn && fineMq.matches) {
        ray.setFromCamera(state.pointer, camera);
        if (ray.ray.intersectPlane(floorPlane, hit)) target.set(clamp(hit.x, -0.9, 0.9), PAGE_Y, clamp(hit.z, 0.0, 0.4));
      } else {
        target.set(Math.sin(t * 0.5) * 0.5, PAGE_Y, 0.16 + Math.cos(t * 0.5) * 0.08);
      }
    } else {
      target.copy(REST);
      if (state.mode === 'return' && pos.distanceTo(REST) < 0.015 && vel.length() < 0.05) { state.mode = 'sleep'; updateStudentLabel(); }
    }
    if (still && state.mode !== 'awake') { pos.copy(REST); vel.set(0, 0, 0); }
    else {
      vel.addScaledVector(v3.subVectors(target, pos), dt * 10);
      vel.multiplyScalar(Math.exp(-dt * 4.2));
      const sp = vel.length();
      if (sp > 0.55) vel.multiplyScalar(0.55 / sp);
      pos.addScaledVector(vel, dt);
    }
    if (inStory) {
      if (w2 > 0) walkIn.getPointAt(w2, v3);
      else walkTo.getPointAt(w1, v3);
      student.position.lerpVectors(pos, v3, smooth(0.02, 0.06, p));
    } else {
      student.position.copy(pos);
    }
    const moved = v3.subVectors(student.position, lastPos);
    const speed = dt > 0 ? moved.length() / dt : 0;
    lastPos.copy(student.position);
    if (moved.x > 0.0004) facing = 1;
    else if (moved.x < -0.0004) facing = -1;
    stride += speed * dt * 38;
    const walking = still ? 0 : clamp(speed * 8, 0, 1);
    legs.forEach((l, i) => { l.rotation.z = Math.sin(stride + i * Math.PI) * 0.5 * walking; });
    doll.position.y = Math.abs(Math.sin(stride)) * 0.012 * walking;
    doll.rotation.z = Math.sin(stride) * 0.04 * walking;
    doll.scale.x += (facing - doll.scale.x) * (1 - Math.exp(-dt * (still ? 60 : 10)));
    const vanish = smooth(0.47, 0.51, p);
    doll.scale.y = introStudent * (1 - vanish);
    student.visible = vanish < 0.999;
    const awake = state.mode !== 'sleep' || wake > 0.5;
    const blink = awake && !still && (t % 3.6) < 0.12;
    eyeMat.map = awake && !blink ? EYES_OPEN : EYES_SHUT;
    doll.scale.z = 1;
    body.scale.y = awake || still ? 1 : 1 + Math.sin(t * 1.7) * 0.012;
    // the scan: her arm reaches out with the ID, then back
    const tapLocal = t - state.scanAt;
    const reach = Math.max(smooth(0.29, 0.31, p) * (1 - smooth(0.34, 0.37, p)), tapLocal < 0.9 ? Math.sin(clamp(tapLocal / 0.9, 0, 1) * Math.PI) : 0);
    arm.rotation.z = Math.sin(stride + Math.PI) * 0.35 * walking + reach * 1.9;
    studentLight.position.copy(student.position).add(v3.set(0.12, 0.35, 0.3));
    studentLight.intensity = 0.5 * (1 - vanish);

    // zzz
    zs.forEach((z, i) => {
      const k = (t * 0.42 + i / 3) % 1;
      const show = !awake && !still && p < 0.05;
      z.visible = show;
      if (!show) return;
      z.position.set(student.position.x + 0.1 + k * 0.08, student.position.y + 0.36 + k * 0.22, student.position.z);
      z.scale.setScalar(0.035 + k * 0.045);
      z.material.opacity = Math.sin(k * Math.PI) * 0.9;
    });

    // ---- the gate ----
    const scanned = Math.max(smooth(0.3, 0.32, p) * (1 - smooth(0.7, 0.8, p)), tapLocal >= 0 && tapLocal < 2.2 ? 1 : 0);
    ledMat.color.copy(LED_BLUE).lerp(LED_GREEN, scanned);
    readerLight.color.copy(ledMat.color);
    readerLight.intensity = 0.3 + 0.5 * scanned;
    readerLight.position.copy(readerPos).add(v3.set(0, 0.05, 0.08));
    const wheelTurn = Math.max(smooth(0.34, 0.42, p), clamp((tapLocal - 0.25) / 0.6, 0, 1));
    wheel.rotation.z = -ease(wheelTurn) * (TAU / 3);
    rings.forEach((r, i) => {
      const storyK = (p - 0.3 - i * 0.012) / 0.05;
      const tapK = (tapLocal - i * 0.14) / 0.6;
      const k = tapK >= 0 && tapK <= 1 ? tapK : storyK >= 0 && storyK <= 1 && S.t > 0.02 ? storyK : -1;
      r.visible = k >= 0 && !still;
      if (!r.visible) return;
      r.position.copy(readerPos).add(v3.set(0, 0.02, 0.02));
      r.scale.setScalar(0.03 + k * 0.16);
      r.material.opacity = (1 - k) * 0.9;
    });

    // ---- the SMS flies home as a paper plane ----
    const tapFlight = tapLocal >= 0.3 && tapLocal <= 1.6 ? (tapLocal - 0.3) / 1.3 : -1;
    const storyFlight = p > 0.35 && p < 0.565 ? smooth(0.35, 0.56, p) : -1;
    const fk = storyFlight >= 0 ? storyFlight : tapFlight;
    paperPlane.visible = fk >= 0 && fk < 0.995 && flight !== null;
    if (paperPlane.visible) {
      flight.getPointAt(ease(fk), paperPlane.position);
      flight.getTangentAt(Math.min(ease(fk) + 0.01, 1), tmp);
      paperPlane.lookAt(v3.copy(paperPlane.position).add(tmp));
      paperPlane.rotateZ(Math.sin(fk * Math.PI * 2) * 0.4);
      paperPlane.scale.setScalar(lerp(1, 0.55, smooth(0.85, 1, fk)) * 2.3);
    }
    trail.forEach((d, i) => {
      const k = ease(fk) - (i + 1) * 0.035;
      d.visible = paperPlane.visible && k > 0 && !still;
      if (!d.visible) return;
      flight.getPointAt(k, d.position);
      d.material.opacity = 0.75 * (1 - i / trail.length) * (1 - smooth(0.9, 1, fk));
    });
    // the phone wakes up with the time-in on top
    const phoneOn = Math.max(
      smooth(0.54, 0.58, p),
      tapLocal >= 1.55 && tapLocal < 7 ? smooth(1.55, 1.75, tapLocal) * (1 - smooth(6, 7, tapLocal)) : 0,
      t - state.phoneAt < 5 ? smooth(0, 0.2, t - state.phoneAt) * (1 - smooth(4, 5, t - state.phoneAt)) : 0,
    );
    screenMat.color.setRGB(lerp(0.05, 1, phoneOn), lerp(0.06, 1, phoneOn), lerp(0.08, 1, phoneOn));
    phoneLight.position.copy(phoneTop).add(v3.set(0, 0.3, 0.1));
    phoneLight.intensity = 0.9 * phoneOn * (1 - smooth(0.6, 0.8, p));

    // the parent waves her off, and again when the message lands
    const waving = still ? 0 : Math.max(w1 > 0.01 && w1 < 0.99 ? 1 : 0, state.mode === 'awake' ? 1 : 0, phoneOn > 0.5 && p < 0.7 ? 1 : 0);
    parentArm.rotation.z += ((waving ? 2.3 + Math.sin(t * 7) * 0.35 : 0.1) - parentArm.rotation.z) * (1 - Math.exp(-dt * 8));

    // the top book's cover lifts and settles
    const ck = t - state.coverAt;
    topCover.rotation.z = ck >= 0 && ck < 1.8 ? Math.sin(clamp(ck / 1.8, 0, 1) * Math.PI) * 0.85 * (still ? 0.6 : 1) : 0;

    // ---- camera: lean with the pointer, then swoop from the book to the phone ----
    const cp = ease(smooth(0.5, 0.93, p));
    const centre = ease(smooth(0.03, 0.24, p));
    const lean = still ? 0 : 1 - smooth(0, 0.3, p);
    state.look.x = clamp(state.look.x, -1, 1);
    camPos.copy(camA).lerp(lookA, centre * (portraitView ? 0.14 : 0.12));
    camPos.add(v3.set(state.look.x * 0.22 * lean, -state.look.y * 0.08 * lean, 0));
    camPos.lerp(camB, cp);
    camPos.y += Math.sin(cp * Math.PI) * 1.1;
    camLook.copy(lookA).lerp(phoneTop, smooth(0, 0.55, cp));
    camera.position.lerp(camPos, still ? 1 : 1 - Math.exp(-dt * 4));
    if (cp > 0.001) camera.position.copy(camPos);
    upV.copy(Y_UP).lerp(phoneUp, smooth(0.25, 0.85, cp)).normalize();
    camera.up.copy(upV);
    camera.lookAt(camLook);
    const oc = ease(smooth(0.5, 0.93, p));
    const ox = offX * W * (1 - centre), oy = offY * H * (1 - centre * (portraitView ? 0.85 : 1)) + barGap / 2;
    // until the pin ends, the section (and its phone) is still sliding up into place:
    // the 3D phone and the paper's hole ride along with it
    const ride = S.trigger ? Math.max(0, S.trigger.end - window.scrollY) * smooth(0.6, 0.93, p) : 0;
    camera.setViewOffset(W, H, lerp(ox, landX, oc), lerp(oy, landY, oc) - ride, W, H);
    paper.style.transform = `translate(${holeX.toFixed(1)}px, ${(holeY + ride).toFixed(1)}px)`;

    // html layers that ride along with the story
    copy.style.opacity = String(1 - smooth(0.01, 0.14, p));
    copy.style.setProperty('--lift', Math.round(p * 120) + 'px');
    copy.style.visibility = p > 0.16 ? 'hidden' : '';
    hint.style.opacity = String(1 - smooth(0, 0.04, p));
    caps[0].style.opacity = String(smooth(0.14, 0.2, p) * (1 - smooth(0.38, 0.44, p)));
    caps[1].style.opacity = String(smooth(0.5, 0.56, p) * (1 - smooth(0.7, 0.76, p)));
    paper.style.opacity = String(smooth(0.8, 0.92, p));
    // the book steps aside as soon as the phone has landed (0.93), so the section's copy and ID show
    // while the pin is still holding; run() stops drawing at the same point so the lanyard can start
    const gone = smooth(0.93, 0.955, Math.max(p, st));
    hero.style.opacity = gone > 0 ? String(1 - gone) : '';
    hero.style.pointerEvents = gone > 0.5 ? 'none' : '';
    hero.style.visibility = gone >= 1 ? 'hidden' : '';
    shadeEl.style.opacity = String(1 - smooth(0.4, 0.7, p));

    // doodle labels follow what they point at
    const labelsOn = 1 - smooth(0.0, 0.05, p);
    const noteOn = Math.max(tapLocal >= 0.1 && tapLocal < 2.6 ? 1 : 0, smooth(0.31, 0.33, p) * (1 - smooth(0.44, 0.47, p)));
    // labels are placed in priority order; one that would overlap a label already shown waits
    placed.length = 0;
    for (const k of LABEL_ORDER) {
      const el = doodleEls[k];
      const anchor = ANCHORS[k];
      if (!el || !anchor) continue;
      anchor().project(camera);
      const x = (tmp.x * 0.5 + 0.5) * W;
      const y = (-tmp.y * 0.5 + 0.5) * H;
      let o = k === 'timein' ? noteOn : labelsOn;
      if (k === 'student' && state.mode === 'return') o = 0;
      if (k === 'reader' && noteOn > 0.5) o = 0;
      const left = x + (el._dx || 0) * (el._w || 0);
      const topEdge = y + (el._dy || 0) * (el._h || 0);
      const w = el._w || 0, h = el._h || 0;
      if (k !== 'timein' && (portraitView ? topEdge < copyBox.bottom + 12 : left < copyBox.right + 20)) o = 0;
      if (left < 6 || left + w > W - 6 || topEdge < 62) o = 0;
      const focused = el === document.activeElement && p < 0.05;
      if (focused) o = 1;
      if (o > 0.01) {
        if (!focused && placed.some((r) => left < r[2] && left + w > r[0] && topEdge < r[3] && topEdge + h > r[1])) o = 0;
        else placed.push([left - 6, topEdge - 4, left + w + 6, topEdge + h + 4]);
      }
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = String(o);
      el.classList.toggle('is-hidden', o < 0.5);
      if (el.tagName === 'BUTTON') el.tabIndex = o < 0.5 ? -1 : 0;
    }

    const casting = !ready || t - introAt < 2.4 || walking > 0.01 || speed > 0.0005 || waving || (tapLocal >= 0 && tapLocal < 1.3) || (ck >= 0 && ck < 1.9) || (p < 0.6 && Math.abs(p - lastShadowP) > 0.0002);
    if (casting || needShadow) { renderer.shadowMap.needsUpdate = true; lastShadowP = p; needShadow = false; }
    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      hero.classList.add('is-ready');
    }
    if (st >= 0.955 && story.p >= 0.955) run();
  }
  let lastShadowP = -1;

  // Only draw while the hero is on screen, the tab is visible and the story isn't over.
  function run() {
    const done = S.t >= 0.955 && story.p >= 0.955; // the book is fully gone by then (see "gone")
    const on = visible && !document.hidden && !done;
    renderer.setAnimationLoop(on ? tick : null);
    // the lanyard below waits while the book draws, so two WebGL scenes never both run
    if (S.rendering !== on) { S.rendering = on; window.dispatchEvent(new Event('hitc:hero')); }
    if (!on) clock.getDelta();
  }
  // compile every shader before the first frame, in the background where the GPU driver allows it, so the
  // first frame isn't one long stall (on a phone it held up the page's first paint of text)
  await renderer.compileAsync(scene, camera).catch(() => {});
  // and let the lanyard below finish its one-off set-up first (js/fx.js), so it never freezes the intro
  await Promise.race([window.hitcLanyardBuilt, new Promise((r) => setTimeout(r, 2000))]);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }, { rootMargin: '80px' }).observe(hero);
  document.addEventListener('visibilitychange', run);
  run();
}
