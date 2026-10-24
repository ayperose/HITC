// The demo student ID that hangs on the Campus Connect lanyard (home page, #student-id).
// HITC's own drawing (not third-party code): the card faces and the strap are painted here on 2D canvases
// and handed to js/lanyard.js as textures. It is the big version of the tiny ID the student wears in
// the hero's pop-up book: white card, blue top band, a photo box, her name, on a green lanyard.
// The student is a made-up example, drawn in the hero's paper-cut style; no real person's photo.
// Copies of this file and PNG renders of the faces: Assets\Made\HITC\ (client branding, not reusable).

export const STUDENT = { first: 'MARIA', last: 'DELA CRUZ', id: '2026 0142' };

const NAVY = '#0A0F1C';
const DESK = '#16244F';
const BLUE = '#1E6BFF';
const GOLD = '#F5A800';
const MUTED = '#5A6880';
const LANYARD = '#1F5E43'; // the hero student's lanyard green
const SKIN = '#C98E62';
const SKIN_S = '#B0774E';
const HAIR = '#1B1616';

const BARLOW = (wt, px) => `${wt} ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`;
const GROTESK = (wt, px) => `${wt} ${px}px "Space Grotesk", system-ui, sans-serif`;

const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
const circle = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };

// text squeezed to fit a width (never stretched)
function fitText(g, text, x, y, maxW) {
  const w = g.measureText(text).width;
  if (w <= maxW) { g.fillText(text, x, y); return; }
  g.save();
  g.translate(x, y);
  g.scale(maxW / w, 1);
  g.fillText(text, 0, 0);
  g.restore();
}

function wrap(g, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); line = word; y += lineH; }
    else line = test;
  }
  if (line) g.fillText(line, x, y);
  return y;
}

// the real Campus Connect app icon, cropped to its tile (the image has a tagline pill under it). The crop is
// measured on the 1254 px original and scaled to the size that ships (640 px).
function drawIcon(g, icon, x, y, s) {
  g.save();
  g.beginPath();
  g.roundRect(x, y, s, s, s * 0.2);
  g.clip();
  const k = icon ? icon.naturalWidth / 1254 : 1;
  if (icon) g.drawImage(icon, 205 * k, 102 * k, 840 * k, 832 * k, x, y, s, s);
  else { g.fillStyle = DESK; g.fillRect(x, y, s, s); }
  g.restore();
}

// Maria, in the pop-up book's paper-cut style
function drawPortrait(g, x, y, w, h) {
  g.save();
  g.beginPath();
  g.roundRect(x, y, w, h, 26);
  g.clip();
  const bg = g.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, '#D7E2F2');
  bg.addColorStop(1, '#BCCBE3');
  g.fillStyle = bg;
  g.fillRect(x, y, w, h);
  g.translate(x + w / 2 - 196, y + 24);
  const shapes = (dx, dy, shade) => {
    g.save();
    g.translate(dx, dy);
    // blouse and shoulders
    g.fillStyle = shade || '#FFFFFF';
    g.beginPath(); g.ellipse(196, 548, 188, 150, 0, Math.PI, 0); g.lineTo(384, 640); g.lineTo(8, 640); g.closePath(); g.fill();
    // neck
    g.fillStyle = shade || SKIN_S;
    g.fillRect(168, 318, 56, 96);
    // side hair
    g.fillStyle = shade || HAIR;
    rr(g, 62, 190, 46, 196, 23);
    rr(g, 284, 190, 46, 196, 23);
    // ears and face
    g.fillStyle = shade || SKIN;
    circle(g, 84, 236, 19);
    circle(g, 308, 236, 19);
    circle(g, 196, 226, 114);
    // hair over the head, with the bangs
    g.fillStyle = shade || HAIR;
    g.beginPath(); g.arc(196, 222, 122, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(74, 214);
    for (let k = 0; k <= 8; k++) g.quadraticCurveTo(90 + k * 27, 160 + (k % 2) * 26, 100 + k * 27, 184 + (k % 2 ? 0 : 10));
    g.lineTo(318, 214);
    g.lineTo(318, 170);
    g.lineTo(74, 170);
    g.closePath();
    g.fill();
    g.restore();
  };
  // a paper layer's shadow first, then the layer
  shapes(7, 9, 'rgba(22,36,79,0.16)');
  shapes(0, 0);
  // collar and ribbon
  g.fillStyle = '#FFFFFF';
  g.strokeStyle = '#B9C2D2';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(150, 402); g.lineTo(196, 452); g.lineTo(178, 402); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(242, 402); g.lineTo(196, 452); g.lineTo(214, 402); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#8D96A8';
  g.beginPath(); g.moveTo(196, 438); g.lineTo(156, 420); g.lineTo(160, 458); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(196, 438); g.lineTo(236, 420); g.lineTo(232, 458); g.closePath(); g.fill();
  g.fillStyle = '#5D6679';
  circle(g, 196, 439, 9);
  // gold hair clip
  g.fillStyle = GOLD;
  rr(g, 248, 150, 44, 17, 8);
  // eyes, cheeks, smile
  g.fillStyle = HAIR;
  g.beginPath(); g.ellipse(156, 246, 12, 16, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(236, 246, 12, 16, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#FFFFFF';
  circle(g, 160, 240, 4.5);
  circle(g, 240, 240, 4.5);
  g.fillStyle = 'rgba(242,130,120,0.5)';
  circle(g, 134, 286, 16);
  circle(g, 258, 286, 16);
  g.strokeStyle = '#7A3B2E';
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.beginPath(); g.arc(196, 284, 18, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
  g.restore();
}

// the contactless mark: a dot and three widening arcs
function drawTap(g, x, y, s, color) {
  g.save();
  g.translate(x, y);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineCap = 'round';
  g.lineWidth = s * 0.075;
  circle(g, s * 0.18, s * 0.5, s * 0.07);
  [0.2, 0.36, 0.52].forEach((r) => { g.beginPath(); g.arc(s * 0.18, s * 0.5, s * r, -0.9, 0.9); g.stroke(); });
  g.restore();
}

function drawBarcode(g, x, y, w, h) {
  let s = 20260142;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  g.fillStyle = NAVY;
  let cx = x;
  while (cx < x + w - 8) {
    const bar = 3 + Math.floor(rnd() * 4) * 3;
    g.fillRect(cx, y, bar, h);
    cx += bar + 4 + Math.floor(rnd() * 3) * 4;
  }
}

export function paintFront(g, W, H, { icon } = {}) {
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, W, H);
  // faint security print across the lower card
  g.strokeStyle = 'rgba(30,107,255,0.07)';
  g.lineWidth = 2;
  for (let k = 0; k < 26; k++) {
    g.beginPath();
    for (let x = 0; x <= W; x += 16) {
      const yy = 880 + k * 22 + Math.sin(x / 70 + k * 0.6) * 12;
      x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy);
    }
    g.stroke();
  }
  // blue top band, the slot is punched through it
  const band = g.createLinearGradient(0, 0, W, 300);
  band.addColorStop(0, '#2774FF');
  band.addColorStop(1, '#1452D6');
  g.fillStyle = band;
  g.fillRect(0, 0, W, 300);
  g.fillStyle = GOLD;
  g.fillRect(0, 300, W, 16);
  drawIcon(g, icon, 64, 150, 116);
  g.fillStyle = '#FFFFFF';
  g.textBaseline = 'alphabetic';
  g.font = BARLOW(900, 84);
  fitText(g, 'CAMPUS CONNECT', 206, 226, W - 206 - 60);
  g.fillStyle = 'rgba(255,255,255,0.82)';
  g.font = GROTESK(600, 32);
  g.fillText('Student ID', 208, 270);

  drawPortrait(g, 64, 372, 392, 500);

  g.fillStyle = BLUE;
  g.font = GROTESK(600, 32);
  g.fillText('Student', 500, 420);
  g.fillStyle = NAVY;
  g.font = BARLOW(900, 124);
  fitText(g, STUDENT.first, 496, 540, W - 496 - 60);
  fitText(g, STUDENT.last, 496, 654, W - 496 - 60);
  g.fillStyle = MUTED;
  g.font = GROTESK(500, 30);
  g.fillText('ID no.', 500, 744);
  g.fillStyle = NAVY;
  g.font = BARLOW(700, 74);
  g.fillText(STUDENT.id, 498, 822);

  g.fillStyle = 'rgba(10,15,28,0.1)';
  g.fillRect(64, 918, W - 128, 3);
  drawTap(g, 52, 940, 132, BLUE);
  g.fillStyle = NAVY;
  g.font = BARLOW(800, 70);
  g.fillText('Tap at the gate', 196, 1004);
  g.fillStyle = MUTED;
  g.font = GROTESK(500, 31);
  g.fillText('Time in and time out go to Campus Connect.', 198, 1056);

  drawBarcode(g, 64, 1118, W - 128, 150);
  g.fillStyle = MUTED;
  g.font = GROTESK(500, 28);
  g.fillText(STUDENT.id.replace(' ', '  '), 64, 1314);

  g.fillStyle = NAVY;
  g.fillRect(0, 1390, W, H - 1390);
  g.fillStyle = GOLD;
  g.font = BARLOW(700, 64);
  fitText(g, 'Real time. Secure. School-linked.', 64, 1490, W - 128);
  g.fillStyle = 'rgba(244,244,240,0.72)';
  g.font = GROTESK(500, 30);
  g.fillText('Campus Connect, by HITC', 64, 1546);
}

export function paintBack(g, W, H, { icon, logo } = {}) {
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#1452D6';
  g.fillRect(0, 0, W, 170);
  g.fillStyle = GOLD;
  g.fillRect(0, 170, W, 12);

  g.fillStyle = NAVY;
  g.font = BARLOW(900, 96);
  g.fillText('THIS ID LINKS TO', 64, 318);
  g.fillText('CAMPUS CONNECT', 64, 414);
  g.fillStyle = '#3D4A5C';
  g.font = GROTESK(500, 38);
  wrap(g, 'Parents and guardians sign in to the app with this ID number and an activation code. Only authorized users get in.', 64, 500, W - 128, 56);

  drawIcon(g, icon, 64, 730, 270);
  g.font = BARLOW(800, 78);
  g.fillStyle = NAVY;
  g.fillText('Real time.', 380, 812);
  g.fillStyle = BLUE;
  g.fillText('Secure.', 380, 898);
  g.fillStyle = '#C98600';
  g.fillText('School-linked.', 380, 984);

  g.fillStyle = 'rgba(10,15,28,0.35)';
  g.fillRect(64, 1160, 560, 3);
  g.fillStyle = MUTED;
  g.font = GROTESK(500, 28);
  g.fillText('Student’s signature', 64, 1204);
  g.font = GROTESK(500, 31);
  g.fillText('If found, please return this ID to the school office.', 64, 1300);

  g.fillStyle = NAVY;
  g.fillRect(0, 1390, W, H - 1390);
  g.fillStyle = '#FFFFFF';
  rr(g, 64, 1430, 214, 146, 18);
  if (logo) {
    const s = Math.min(186 / logo.width, 126 / logo.height);
    g.drawImage(logo, 64 + (214 - logo.width * s) / 2, 1430 + (146 - logo.height * s) / 2, logo.width * s, logo.height * s);
  }
  g.fillStyle = '#F4F4F0';
  g.font = BARLOW(700, 52);
  g.fillText('Campus Connect, by HITC', 312, 1494);
  g.fillStyle = 'rgba(244,244,240,0.7)';
  g.font = GROTESK(500, 28);
  g.fillText('Tuguegarao City, Philippines', 314, 1540);
}

// a little Campus Connect "C" for the strap
function drawMark(g, x, y, s) {
  g.save();
  g.translate(x, y);
  g.lineCap = 'round';
  g.strokeStyle = '#FFFFFF';
  g.lineWidth = s * 0.16;
  g.beginPath(); g.arc(0, 0, s * 0.4, Math.PI * 0.28, Math.PI * 1.72); g.stroke();
  g.strokeStyle = GOLD;
  g.lineWidth = s * 0.09;
  g.beginPath(); g.arc(0, 0, s * 0.2, Math.PI * 0.3, Math.PI * 1.7); g.stroke();
  g.restore();
}

// Green woven strap printed CAMPUS CONNECT and HITC. Returns its along/across ratio.
export function paintStrap(canvas) {
  const across = 192;
  const along = 1280;
  canvas.width = across;
  canvas.height = along;
  const g = canvas.getContext('2d');
  g.fillStyle = LANYARD;
  g.fillRect(0, 0, across, along);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 0; y < along; y += 4) g.fillRect(0, y, across, 1);
  g.fillStyle = 'rgba(255,255,255,0.22)';
  for (let y = 0; y < along; y += 14) {
    g.fillRect(across * 0.075, y, 2, 8);
    g.fillRect(across * 0.925 - 2, y, 2, 8);
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const word = (text, at, font, color) => {
    g.save();
    g.translate(across / 2, at);
    g.rotate(Math.PI / 2);
    g.font = font;
    g.fillStyle = color;
    g.fillText(text, 0, 4);
    g.restore();
  };
  word('CAMPUS CONNECT', 330, BARLOW(800, 82), '#FFFFFF');
  drawMark(g, across / 2, 690, 74);
  word('HITC', 860, BARLOW(900, 86), GOLD);
  drawMark(g, across / 2, 1040, 74);
  return along / across;
}
