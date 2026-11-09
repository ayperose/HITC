// Portions adapted from third-party code under the MIT licence with the Commons Clause: see /licenses.txt
// HITC port (2026-10-24): the same rope-and-card physics, ported from a React effect to a plain
// ES module for this static page. Changes from upstream:
// - mount(el, opts) instead of a React component; the page paints the card faces and the strap
//   itself (opts.paintFront / paintBack / paintStrap), so there is no image loading here;
// - written against the page's three 0.170 (upstream used 0.186): every API used here exists in 0.170;
// - the holographic foil shader and the finish presets are gone (this card is plain glossy PVC);
// - a soft paper shadow behind the card, since this badge hangs over a paper page, not black;
// - min-spec laptop (Ryzen 3 3200U, Vega 3): pixel ratio 1.25 on 4 cores or fewer (1.5 otherwise),
//   low-power GPU hint, 30 fps while the card only sways, full rate while it is held or moving fast,
//   the breeze dies down 8 s after the last touch so the loop sleeps, and nothing runs off screen,
//   with the tab hidden, or while the page says another WebGL scene owns the frame (setAllowed);
// - the intro waits until the badge is first allowed to run, so it plays when it is seen, and a
//   new 'drop' intro lets the card fall in from the top instead of swinging in from the side;
// - prefers-reduced-motion: no intro, no breeze, a gentler flip; dragging still works;
// - pointer events are read on opts.eventTarget (the section), so the canvas can sit over text
//   without blocking it: only a press that lands on the card is taken;
// - no WebGL: the front face is shown as a still picture.
import * as THREE from 'three';

const THICKNESS = 0.018;
const BEVEL = 0.007;
const JOINTS = 4;
const NODE_WEIGHT = 1 / 0.05;
const MAX_STEP = 1 / 960;
const ITERATIONS = 2;
const SAMPLES = 72;
const FOV = 24;
const STRAP_WIDTH = 0.36;
const RING_RADIUS = 0.095;
const RING_TUBE = 0.0135;
const EYELET_RADIUS = 0.036;
const CLAMP_BODY = 0.15;
const FACE_WIDTH = 1024;
const BAND_COLUMNS = [0, 0.07, 0.93, 1];
const BAND_BEND = [-0.95, -0.28, 0.28, 0.95];
const FLIP_SPIN = 9;
const METALS = {
  silver: { color: '#d9dce2', roughness: 0.16 },
  gold: { color: '#e4b965', roughness: 0.2 },
  graphite: { color: '#4d4f55', roughness: 0.28 },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;

const seeded = (start) => {
  let state = start >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const traceRoundedRect = (path, x, y, width, height, radius) => {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const k = r * 0.4477;
  path.moveTo(x + r, y);
  path.lineTo(x + width - r, y);
  path.bezierCurveTo(x + width - k, y, x + width, y + k, x + width, y + r);
  path.lineTo(x + width, y + height - r);
  path.bezierCurveTo(x + width, y + height - k, x + width - k, y + height, x + width - r, y + height);
  path.lineTo(x + r, y + height);
  path.bezierCurveTo(x + k, y + height, x, y + height - k, x, y + height - r);
  path.lineTo(x, y + r);
  path.bezierCurveTo(x, y + k, x + k, y, x + r, y);
};

// card size in world units; the slot and ring sit at the top edge
export const cardLayout = (size, cornerRadius) => {
  const [width, height] = size;
  const radius = mix(0.03, Math.min(width, height) * 0.2, clamp(cornerRadius, 0, 1));
  const slot = { width: 0.34, height: 0.07, y: height / 2 - 0.13 };
  const ringY = height / 2 - 0.055;
  return { width, height, radius, slot, ringY, hangY: ringY + RING_RADIUS };
};

const buildCardGeometry = (layout) => {
  const { width, height, radius, slot } = layout;
  const outline = new THREE.Shape();
  traceRoundedRect(outline, -width / 2 + BEVEL, -height / 2 + BEVEL, width - BEVEL * 2, height - BEVEL * 2, Math.max(radius - BEVEL, 0.005));
  const hole = new THREE.Path();
  traceRoundedRect(hole, -slot.width / 2 - BEVEL, slot.y - slot.height / 2 - BEVEL, slot.width + BEVEL * 2, slot.height + BEVEL * 2, slot.height / 2 + BEVEL);
  outline.holes.push(hole);
  const body = new THREE.ExtrudeGeometry(outline, { depth: THICKNESS, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 5, curveSegments: 24 });
  body.translate(0, 0, -THICKNESS / 2);
  const face = new THREE.ShapeGeometry(outline, 24);
  const position = face.getAttribute('position');
  const uv = face.getAttribute('uv');
  for (let i = 0; i < position.count; i++) uv.setXY(i, (position.getX(i) + width / 2) / width, (position.getY(i) + height / 2) / height);
  uv.needsUpdate = true;
  return { body, face };
};

const buildClampGeometry = (width) => {
  const shape = new THREE.Shape();
  const w = width * 1.16;
  traceRoundedRect(shape, -w / 2 + 0.014, -CLAMP_BODY / 2 + 0.014, w - 0.028, CLAMP_BODY - 0.028, 0.024);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 6, curveSegments: 10 });
  geometry.translate(0, 0, -0.01);
  return geometry;
};

const buildBandGeometry = (count) => {
  const columns = BAND_COLUMNS.length;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * columns * 3), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * columns * 3), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * columns * 2), 2));
  const index = [];
  for (let i = 0; i < count - 1; i++) {
    for (let c = 0; c < columns - 1; c++) {
      const a = i * columns + c;
      index.push(a, a + columns, a + 1, a + 1, a + columns, a + columns + 1);
    }
  }
  geometry.setIndex(index);
  return geometry;
};

const buildEnvironment = (renderer) => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.035, 0.035, 0.04);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const materials = [];
  const panel = (intensity, position, scale, rotation = 0) => {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity), side: THREE.DoubleSide });
    materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(scale[0], scale[1], 1);
    mesh.lookAt(0, 0, 0);
    mesh.rotateZ(rotation);
    scene.add(mesh);
  };
  panel(2.6, [0, 4.5, 8], [9, 4]);
  panel(6, [-5.5, 0.5, 7], [0.9, 14]);
  panel(4, [5, -0.5, 8], [0.6, 14]);
  panel(3.5, [0, -1, 9], [24, 0.35], Math.PI / 3);
  panel(2.5, [1, 2.5, 9], [24, 0.2], Math.PI / 3);
  panel(1.4, [0, 6, -6], [12, 4]);
  panel(0.5, [0, -7, 1], [16, 6]);
  panel(0.9, [8, 0, -2], [4, 10]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.035);
  pmrem.dispose();
  geometry.dispose();
  materials.forEach((m) => m.dispose());
  return target;
};

const buildGrainTexture = () => {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const random = seeded(7);
  const field = Float32Array.from({ length: size * size }, () => random());
  const height = (x, y) => {
    let sum = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) sum += field[((y + j + size) % size) * size + ((x + i + size) % size)];
    return (sum / 9) * 1.6;
  };
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = height((x - 1 + size) % size, y) - height((x + 1) % size, y);
      const ny = height(x, (y - 1 + size) % size) - height(x, (y + 1) % size);
      const length = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      image.data[i] = ((nx / length) * 0.5 + 0.5) * 255;
      image.data[i + 1] = ((ny / length) * 0.5 + 0.5) * 255;
      image.data[i + 2] = ((1 / length) * 0.5 + 0.5) * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 7);
  return texture;
};

const buildWeaveTexture = () => {
  const size = 128;
  const threads = 8;
  const random = seeded(19);
  const fiber = Float32Array.from({ length: size * size }, () => random());
  const profile = (f) => Math.sqrt(Math.max(0, 1 - 4 * f * f));
  const height = (x, y) => {
    const px = ((x % size) + size) % size;
    const py = ((y % size) + size) % size;
    const u = (px / size) * threads;
    const v = (py / size) * threads;
    const cu = Math.floor(u);
    const cv = Math.floor(v);
    const fu = u - cu - 0.5;
    const fv = v - cv - 0.5;
    const lift = (cu + cv) % 2 === 0;
    const warp = profile(fu) * (0.55 + 0.45 * Math.cos(fv * Math.PI * (lift ? 1 : 0.6)));
    const weft = profile(fv) * (0.55 + 0.45 * Math.cos(fu * Math.PI * (lift ? 0.6 : 1)));
    return (lift ? Math.max(warp, weft * 0.7) : Math.max(weft, warp * 0.7)) + fiber[py * size + px] * 0.08;
  };
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (height(x - 1, y) - height(x + 1, y)) * 1.6;
      const ny = (height(x, y - 1) - height(x, y + 1)) * 1.6;
      const length = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      data[i] = ((nx / length) * 0.5 + 0.5) * 255;
      data[i + 1] = ((ny / length) * 0.5 + 0.5) * 255;
      data[i + 2] = ((1 / length) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
};

// a soft, blurred rounded rectangle: the card's shadow on the paper behind it
const buildShadowTexture = (layout) => {
  const w = 256;
  const h = Math.round((w * layout.height) / layout.width);
  const pad = 48;
  const canvas = document.createElement('canvas');
  canvas.width = w + pad * 2;
  canvas.height = h + pad * 2;
  const ctx = canvas.getContext('2d');
  ctx.filter = 'blur(18px)';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(pad + 10, pad + 10, w - 20, h - 20, 24);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  return { texture, scaleX: (w + pad * 2) / w, scaleY: (h + pad * 2) / h };
};

const createSimulation = () => {
  const vectors = () => Array.from({ length: JOINTS + 1 }, () => new THREE.Vector3());
  return {
    nodes: vectors(),
    previous: vectors(),
    velocities: vectors(),
    lengths: new Float64Array(JOINTS),
    impulses: new Float64Array(JOINTS),
    rest: 1,
    anchor: new THREE.Vector3(),
    body: {
      position: new THREE.Vector3(),
      previous: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      previousQuaternion: new THREE.Quaternion(),
      angular: new THREE.Vector3(),
      mass: 1,
      inverseInertia: new THREE.Vector3(1, 1, 1),
      hang: new THREE.Vector3(),
    },
    grab: null,
    turn: 0,
    twist: 0,
    twistRaw: 0,
    calm: 0,
    energy: 0,
  };
};

const scratch = {
  a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(),
  e: new THREE.Vector3(), f: new THREE.Vector3(), g: new THREE.Vector3(), pin: new THREE.Vector3(),
  q: new THREE.Quaternion(), r: new THREE.Quaternion(),
};

const applyInverseInertia = (body, vector, out) => {
  scratch.r.copy(body.quaternion).invert();
  out.copy(vector).applyQuaternion(scratch.r);
  out.set(out.x * body.inverseInertia.x, out.y * body.inverseInertia.y, out.z * body.inverseInertia.z);
  return out.applyQuaternion(body.quaternion);
};

const rotateBody = (q, w) => {
  const { x: qx, y: qy, z: qz, w: qw } = q;
  q.x += 0.5 * (w.x * qw + w.y * qz - w.z * qy);
  q.y += 0.5 * (w.y * qw + w.z * qx - w.x * qz);
  q.z += 0.5 * (w.z * qw + w.x * qy - w.y * qx);
  q.w += 0.5 * (-w.x * qx - w.y * qy - w.z * qz);
  q.normalize();
};

const bodyWeight = (body, r, normal) => {
  const rn = scratch.c.crossVectors(r, normal);
  return 1 / body.mass + rn.dot(applyInverseInertia(body, rn, scratch.d));
};

const pushBody = (body, r, impulse) => {
  body.position.addScaledVector(impulse, 1 / body.mass);
  rotateBody(body.quaternion, applyInverseInertia(body, scratch.e.crossVectors(r, impulse), scratch.f));
};

const solveSegment = (sim, i, h, physics) => {
  const { nodes, body } = sim;
  const a = nodes[i];
  const wa = i === 0 ? 0 : NODE_WEIGHT;
  const last = i === JOINTS - 1;
  const r = scratch.g;
  let b = nodes[i + 1];
  if (last) {
    r.copy(body.hang).applyQuaternion(body.quaternion);
    b = scratch.b.copy(body.position).add(r);
  }
  const delta = scratch.a.subVectors(b, a);
  const length = delta.length();
  const stretch = length - sim.rest;
  if (stretch <= 0 || length < 1e-9) return;
  const normal = delta.divideScalar(length);
  const wb = last ? bodyWeight(body, r, normal) : NODE_WEIGHT;
  const rate = (length - sim.lengths[i]) / h;
  const tension = physics.hold * Math.tanh((physics.stiffness * stretch) / physics.hold) + physics.spring * stretch + physics.bandDamping * Math.max(0, rate);
  const room = tension * h * h - sim.impulses[i];
  if (room <= 0) return;
  const lambda = Math.min(stretch / (wa + wb), room);
  sim.impulses[i] += lambda;
  if (wa) a.addScaledVector(normal, lambda * wa);
  if (last) pushBody(body, r, normal.multiplyScalar(-lambda));
  else b.addScaledVector(normal, -lambda * wb);
};

const solvePin = (body, grab, target) => {
  const r = scratch.g.copy(grab.local).applyQuaternion(body.quaternion);
  const delta = scratch.a.copy(target).sub(body.position).sub(r);
  const distance = delta.length();
  if (distance < 1e-9) return;
  const normal = delta.divideScalar(distance);
  const lambda = distance / bodyWeight(body, r, normal);
  pushBody(body, r, normal.multiplyScalar(lambda));
};

const placeHanging = (sim, layout, intro) => {
  const { nodes, previous, velocities, body, anchor } = sim;
  nodes[0].copy(anchor);
  for (let i = 1; i <= JOINTS; i++) {
    nodes[i].copy(nodes[i - 1]);
    if (intro === 'drop') { nodes[i].y -= sim.rest * 0.22; nodes[i].x += (i % 2 ? 0.06 : -0.06); }
    else if (intro) nodes[i].x += sim.rest;
    else nodes[i].y -= sim.rest;
  }
  body.quaternion.identity();
  // 'drop' (HITC): the strap starts bunched at the top and the card falls in, turning a little
  if (intro === 'drop') body.quaternion.setFromEuler(new THREE.Euler(0.15, 0.7, 0.22));
  else if (intro) body.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  body.hang.set(0, layout.hangY, 0);
  const offset = scratch.a.copy(body.hang).applyQuaternion(body.quaternion);
  body.position.copy(nodes[JOINTS]).sub(offset);
  body.previous.copy(body.position);
  body.previousQuaternion.copy(body.quaternion);
  body.velocity.set(0, 0, 0);
  body.angular.set(0, 0, 0);
  for (let i = 0; i <= JOINTS; i++) {
    previous[i].copy(nodes[i]);
    velocities[i].set(0, 0, 0);
  }
  sim.lengths.fill(sim.rest);
  sim.turn = 0;
  sim.twist = 0;
  sim.twistRaw = 0;
  sim.calm = 0;
};

const configureSimulation = (sim, layout, length) => {
  sim.rest = length / JOINTS;
  const { width, height } = layout;
  const body = sim.body;
  const t = THICKNESS + BEVEL * 2;
  body.mass = 1;
  body.inverseInertia.set(12 / (height * height + t * t), 12 / (width * width + t * t), 12 / (width * width + height * height));
  body.hang.set(0, layout.hangY, 0);
};

const stepSimulation = (sim, dt, physics, time) => {
  const steps = Math.max(1, Math.ceil(dt / MAX_STEP - 1e-6));
  const h = dt / steps;
  const { nodes, previous, velocities, body } = sim;
  const windX = physics.breeze * (Math.sin(time * 0.53) * 0.7 + Math.sin(time * 1.31 + 1.7) * 0.3) * 3;
  const windZ = physics.breeze * Math.sin(time * 0.37 + 0.6) * 2;
  const grab = sim.grab;
  const pin = scratch.pin;
  const nodeDrag = Math.exp(-physics.nodeDrag * h);
  const linearDrag = Math.exp(-physics.linearDrag * h);
  const angularDrag = Math.exp(-physics.angularDrag * h);

  for (let s = 0; s < steps; s++) {
    for (let i = 1; i < JOINTS; i++) {
      const v = velocities[i];
      v.y -= physics.gravity * h;
      v.x += windX * h;
      v.z += windZ * h;
      previous[i].copy(nodes[i]);
      nodes[i].addScaledVector(v, h);
    }
    body.previous.copy(body.position);
    body.previousQuaternion.copy(body.quaternion);
    const q = body.quaternion;
    if (grab) {
      const turn = scratch.q.copy(grab.rotation).multiply(scratch.r.copy(q).invert());
      if (turn.w < 0) turn.set(-turn.x, -turn.y, -turn.z, -turn.w);
      const torque = scratch.a.set(turn.x, turn.y, turn.z).multiplyScalar(2 * physics.grip);
      torque.addScaledVector(body.angular, -physics.gripDamping);
      body.angular.addScaledVector(applyInverseInertia(body, torque, scratch.b), h);
    }
    const up = scratch.a.set(0, 1, 0).applyQuaternion(q);
    const front = scratch.b.set(-up.x * up.z, -up.y * up.z, 1 - up.z * up.z);
    if (front.lengthSq() > 1e-3) {
      const facing = scratch.d.set(0, 0, 1).applyQuaternion(q);
      const raw = Math.atan2(scratch.e.crossVectors(front, facing).dot(up), front.dot(facing));
      let turned = raw - sim.twistRaw;
      if (turned > Math.PI) turned -= Math.PI * 2;
      else if (turned < -Math.PI) turned += Math.PI * 2;
      sim.twist += turned;
      sim.twistRaw = raw;
    }
    if (!grab) {
      const spin = body.angular.dot(up);
      body.angular.addScaledVector(up, (physics.twist * (sim.turn - sim.twist) - physics.twistDamping * spin) * h);
    }
    body.velocity.y -= physics.gravity * h;
    body.velocity.x += windX * 0.35 * h;
    body.velocity.z += windZ * 0.35 * h;
    body.position.addScaledVector(body.velocity, h);
    rotateBody(body.quaternion, scratch.f.copy(body.angular).multiplyScalar(h));

    sim.impulses.fill(0);
    if (grab) pin.lerpVectors(grab.from, grab.target, (s + 1) / steps);
    for (let iteration = 0; iteration < ITERATIONS; iteration++) {
      for (let i = 0; i < JOINTS; i++) solveSegment(sim, i, h, physics);
      if (grab) solvePin(body, grab, pin);
    }

    for (let i = 1; i < JOINTS; i++) {
      const v = velocities[i].subVectors(nodes[i], previous[i]).divideScalar(h).multiplyScalar(nodeDrag);
      v.multiplyScalar(1 / (1 + physics.nodeAir * v.length() * h));
    }
    body.velocity.subVectors(body.position, body.previous).divideScalar(h);
    const dq = scratch.q.copy(body.previousQuaternion).invert().premultiply(body.quaternion);
    body.angular.set(dq.x, dq.y, dq.z).multiplyScalar((2 / h) * (dq.w < 0 ? -1 : 1));

    const normal = scratch.a.set(0, 0, 1).applyQuaternion(body.quaternion);
    const across = body.velocity.dot(normal);
    const along = scratch.b.copy(body.velocity).addScaledVector(normal, -across);
    along.multiplyScalar(1 / (1 + physics.air * along.length() * h));
    body.velocity.copy(along).addScaledVector(normal, across / (1 + physics.broadside * Math.abs(across) * h)).multiplyScalar(linearDrag);
    body.angular.multiplyScalar(angularDrag / (1 + physics.spinAir * body.angular.length() * h));
    if (body.velocity.lengthSq() > 3600) body.velocity.setLength(60);
    if (body.angular.lengthSq() > 1600) body.angular.setLength(40);

    nodes[JOINTS].copy(body.hang).applyQuaternion(body.quaternion).add(body.position);
    for (let i = 0; i < JOINTS; i++) sim.lengths[i] = nodes[i].distanceTo(nodes[i + 1]);
  }

  if (grab) grab.from.copy(grab.target);

  let energy = body.velocity.lengthSq() + body.angular.lengthSq() * 0.3;
  for (let i = 1; i < JOINTS; i++) energy += velocities[i].lengthSq() * 0.05;
  sim.energy = energy;
  sim.calm = energy < 2e-4 ? sim.calm + dt : 0;
};

/**
 * mount(el, opts) puts a hanging badge into `el` (sized by CSS) and returns controls.
 * opts: paintFront(ctx, w, h), paintBack(ctx, w, h), paintStrap(canvas) -> along/across ratio,
 * cardSize [w, h] in world units, cornerRadius 0..1, size (card height as a share of the view),
 * anchorX (0..1 across el), strapLength 0..1, strapWidth, metal, gravity, damping, elasticity,
 * breeze, intro, cardColor (edges), eventTarget (where presses are read), onFlip().
 */
export function mount(el, opts = {}) {
  const o = {
    cardSize: [1.52, 2.4], cornerRadius: 0.2, size: 0.42, anchorX: 0.5, strapLength: 0.5, strapWidth: 0.65,
    metal: 'silver', gravity: 1, damping: 0.5, elasticity: 0.5, breeze: 0.5, intro: true, cardColor: '#ffffff',
    eventTarget: el, ...opts,
  };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layout = cardLayout(o.cardSize, o.cornerRadius);
  const faceH = Math.round((FACE_WIDTH * layout.height) / layout.width);
  const frontCanvas = document.createElement('canvas');
  const backCanvas = document.createElement('canvas');
  frontCanvas.width = backCanvas.width = FACE_WIDTH;
  frontCanvas.height = backCanvas.height = faceH;
  o.paintFront?.(frontCanvas.getContext('2d'), FACE_WIDTH, faceH);
  o.paintBack?.(backCanvas.getContext('2d'), FACE_WIDTH, faceH);

  let renderer;
  try {
    const probe = document.createElement('canvas');
    if (!probe.getContext('webgl2')) throw new Error('no webgl2');
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (err) {
    // no WebGL: the front of the card, still
    frontCanvas.className = 'lanyard-still';
    frontCanvas.setAttribute('aria-hidden', 'true');
    el.appendChild(frontCanvas);
    return { setAllowed() {}, flip() {}, setAnchor() {}, destroy() { frontCanvas.remove(); }, still: true };
  }

  // reading every shader's log back on first use stalls the page for a moment per shader; the shaders are fixed and known good
  renderer.debug.checkShaderErrors = false;
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  const canvas = renderer.domElement;
  canvas.className = 'lanyard-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  el.appendChild(canvas);

  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const scene = new THREE.Scene();
  const environment = buildEnvironment(renderer);
  scene.environment = environment.texture;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
  keyLight.position.set(-2.5, 4, 6);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
  fillLight.position.set(3, -1, 4);
  scene.add(keyLight, fillLight);

  const faceTexture = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    return t;
  };
  const frontTexture = faceTexture(frontCanvas);
  const backTexture = faceTexture(backCanvas);
  const strapCanvas = document.createElement('canvas');
  const tileRatio = o.paintStrap ? o.paintStrap(strapCanvas) : (strapCanvas.width = strapCanvas.height = 2, 1);
  const strapTexture = faceTexture(strapCanvas);
  strapTexture.wrapS = THREE.ClampToEdgeWrapping;
  strapTexture.wrapT = THREE.RepeatWrapping;
  const grain = buildGrainTexture();
  const weave = buildWeaveTexture();
  weave.repeat.set(2, 2 * tileRatio);

  // glossy PVC
  const faceMaterial = (map) => new THREE.MeshPhysicalMaterial({
    map, normalMap: grain, normalScale: new THREE.Vector2(0.06, 0.06), roughness: 0.42, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06,
  });
  const frontMaterial = faceMaterial(frontTexture);
  const backMaterial = faceMaterial(backTexture);
  const edge = new THREE.Color(o.cardColor);
  const edgeMaterial = new THREE.MeshPhysicalMaterial({ roughness: 0.35, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 });
  edgeMaterial.color.setRGB(edge.r * 0.92, edge.g * 0.92, edge.b * 0.92);
  const metalLook = METALS[o.metal] || METALS.silver;
  const metalMaterial = new THREE.MeshStandardMaterial({ metalness: 1, color: metalLook.color, roughness: metalLook.roughness });
  const bandMaterial = new THREE.MeshPhysicalMaterial({
    map: strapTexture, normalMap: weave, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.68,
    sheen: 1, sheenRoughness: 0.42, sheenColor: new THREE.Color(0.32, 0.32, 0.34), side: THREE.DoubleSide,
  });

  const cardGroup = new THREE.Group();
  const geometry = buildCardGeometry(layout);
  const bodyMesh = new THREE.Mesh(geometry.body, edgeMaterial);
  const frontMesh = new THREE.Mesh(geometry.face, frontMaterial);
  const backMesh = new THREE.Mesh(geometry.face.clone(), backMaterial);
  frontMesh.position.z = THICKNESS / 2 + BEVEL + 0.0006;
  backMesh.rotation.y = Math.PI;
  backMesh.position.z = -(THICKNESS / 2 + BEVEL + 0.0006);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 18, 72), metalMaterial);
  ring.rotation.y = Math.PI / 2 - 0.7;
  ring.position.set(0, layout.ringY, 0);
  cardGroup.add(bodyMesh, frontMesh, backMesh, ring);
  scene.add(cardGroup);

  // the card's soft shadow on the paper behind it
  const shadowTex = buildShadowTexture(layout);
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTex.texture, color: 0x16244f, transparent: true, opacity: 0.2, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(layout.width * shadowTex.scaleX, layout.height * shadowTex.scaleY), shadowMaterial);
  shadow.renderOrder = -1;
  scene.add(shadow);

  const bandGeometry = buildBandGeometry(SAMPLES);
  const band = new THREE.Mesh(bandGeometry, bandMaterial);
  band.frustumCulled = false;
  scene.add(band);

  const strapScale = STRAP_WIDTH * clamp(o.strapWidth, 0.4, 2);
  const clampGroup = new THREE.Group();
  const clampMesh = new THREE.Mesh(buildClampGeometry(strapScale), metalMaterial);
  clampMesh.position.y = EYELET_RADIUS + CLAMP_BODY / 2 - 0.004;
  const eyelet = new THREE.Mesh(new THREE.TorusGeometry(EYELET_RADIUS, 0.0105, 14, 40), metalMaterial);
  clampGroup.add(clampMesh, eyelet);
  scene.add(clampGroup);

  const sim = createSimulation();
  const controls = [];
  const mouth = new THREE.Vector3();
  const tuck = new THREE.Vector3();
  const curve = new THREE.CatmullRomCurve3(controls, false, 'centripetal');
  const view = { width: 1, height: 1, worldW: 1 };
  let raf = 0;
  let last = performance.now();
  let lastDraw = 0;
  let time = 0;
  let touched = 0; // sim time of the last interaction
  let onScreen = false;
  let allowed = true;
  let alive = true;
  let placed = false;
  let hovering = false;
  let press = null;
  let swallowClick = false;
  const stats = { frames: 0, ms: 0, worst: 0 }; // QA: time spent per tick (physics + draw submit)

  const frameView = () => {
    const aspect = view.width / view.height;
    let viewHeight = layout.height / clamp(o.size, 0.15, 0.9);
    const minimumWidth = layout.width / 0.72;
    if (viewHeight * aspect < minimumWidth) viewHeight = minimumWidth / aspect;
    const viewWidth = viewHeight * aspect;
    view.worldW = viewWidth;
    camera.aspect = aspect;
    camera.position.set(0, 0, viewHeight / 2 / Math.tan((FOV * Math.PI) / 360));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const anchorX = (clamp(o.anchorX, 0.05, 0.95) - 0.5) * viewWidth;
    const anchorY = viewHeight / 2 + 0.2;
    const cardTop = viewHeight / 2 - viewHeight * mix(0.12, 0.42, clamp(o.strapLength, 0, 1));
    const hangTop = cardTop + (layout.hangY - layout.height / 2);
    const moved = sim.anchor.x - anchorX;
    sim.anchor.set(anchorX, anchorY, 0);
    configureSimulation(sim, layout, anchorY - hangTop);
    sim.nodes[0].copy(sim.anchor);
    sim.previous[0].copy(sim.anchor);
    if (placed && Math.abs(moved) > 1e-6) {
      // the column moved (a resize): carry the badge with it instead of yanking it across
      for (let i = 1; i <= JOINTS; i++) { sim.nodes[i].x -= moved; sim.previous[i].x -= moved; }
      sim.body.position.x -= moved;
      sim.body.previous.x -= moved;
    }
  };

  const points = Array.from({ length: SAMPLES }, () => new THREE.Vector3());
  const sides = Array.from({ length: SAMPLES }, () => new THREE.Vector3());
  const bends = BAND_BEND.map((angle) => [Math.cos(angle), Math.sin(angle)]);
  const work = {
    tangent: new THREE.Vector3(), toCamera: new THREE.Vector3(), basis: new THREE.Matrix4(), up: new THREE.Vector3(),
    across: new THREE.Vector3(), facing: new THREE.Vector3(), end: new THREE.Vector3(), normal: new THREE.Vector3(),
  };

  const updateBand = () => {
    const hang = sim.nodes[JOINTS];
    const reach = EYELET_RADIUS + CLAMP_BODY + 0.05;
    let guide = JOINTS - 1;
    while (guide > 0 && sim.nodes[guide].distanceTo(hang) < reach * 1.1) guide--;
    const axis = work.up.subVectors(sim.nodes[guide], hang);
    if (axis.lengthSq() < 1e-8) axis.set(0, 1, 0).applyQuaternion(sim.body.quaternion);
    axis.normalize();
    mouth.copy(hang).addScaledVector(axis, reach);
    tuck.copy(hang).addScaledVector(axis, EYELET_RADIUS + CLAMP_BODY * 0.35);
    controls.length = 0;
    for (let i = 0; i <= guide; i++) controls.push(sim.nodes[i]);
    controls.push(mouth, tuck);
    curve.updateArcLengths();
    for (let i = 0; i < SAMPLES; i++) curve.getPointAt(i / (SAMPLES - 1), points[i]);
    const length = curve.getLength();
    const held = 1 - mouth.distanceTo(tuck) / Math.max(length, 0.001);
    const position = bandGeometry.getAttribute('position');
    const normal = bandGeometry.getAttribute('normal');
    const uv = bandGeometry.getAttribute('uv');
    const columns = BAND_COLUMNS.length;
    const restLength = sim.rest * JOINTS;
    const repeats = restLength / (strapScale * tileRatio);
    const width = strapScale / Math.pow(Math.max(1, length / Math.max(restLength, 0.001)), 0.35);
    const { tangent, toCamera, across, facing } = work;
    for (let i = 0; i < SAMPLES; i++) {
      tangent.subVectors(points[Math.min(SAMPLES - 1, i + 1)], points[Math.max(0, i - 1)]);
      if (tangent.lengthSq() < 1e-12) tangent.set(0, -1, 0);
      tangent.normalize();
      toCamera.subVectors(camera.position, points[i]).normalize();
      const side = sides[i].crossVectors(toCamera, tangent);
      if (side.lengthSq() < 1e-10) side.copy(i > 0 ? sides[i - 1] : scratch.a.set(1, 0, 0));
      side.normalize();
      if (i > 0 && side.dot(sides[i - 1]) < 0) side.negate();
      const angle = -sim.twist * Math.pow(Math.min(1, i / (SAMPLES - 1) / held), 1.3);
      facing.crossVectors(tangent, side);
      across.copy(side).multiplyScalar(Math.cos(angle)).addScaledVector(facing, Math.sin(angle));
      facing.crossVectors(tangent, across);
      const p = points[i];
      const v = (1 - i / (SAMPLES - 1)) * repeats;
      for (let c = 0; c < columns; c++) {
        const k = i * columns + c;
        const offset = (BAND_COLUMNS[c] - 0.5) * width;
        const [bendCos, bendSin] = bends[c];
        position.setXYZ(k, p.x + across.x * offset, p.y + across.y * offset, p.z + across.z * offset);
        normal.setXYZ(k, facing.x * bendCos + across.x * bendSin, facing.y * bendCos + across.y * bendSin, facing.z * bendCos + across.z * bendSin);
        uv.setXY(k, BAND_COLUMNS[c], v);
      }
    }
    work.end.copy(across);
    position.needsUpdate = true;
    normal.needsUpdate = true;
    uv.needsUpdate = true;
    across.copy(work.end).addScaledVector(axis, -work.end.dot(axis)).normalize();
    facing.crossVectors(across, axis).normalize();
    work.basis.makeBasis(across, axis, facing);
    clampGroup.quaternion.setFromRotationMatrix(work.basis);
    clampGroup.position.copy(hang);
  };

  const updateShadow = () => {
    const b = sim.body;
    // the shadow falls down and to the right on paper 0.55 behind the card, squeezed as it turns edge-on
    const n = work.normal.set(0, 0, 1).applyQuaternion(b.quaternion);
    const up = scratch.a.set(0, 1, 0).applyQuaternion(b.quaternion);
    shadow.position.set(b.position.x + 0.1, b.position.y - 0.14, -0.55 + Math.min(0, b.position.z));
    shadow.rotation.set(0, 0, Math.atan2(-up.x, up.y));
    shadow.scale.set(Math.max(0.08, Math.abs(n.z)), 1, 1);
    shadowMaterial.opacity = 0.2 * clamp(1 - Math.abs(b.position.z) * 0.4, 0.3, 1);
  };

  const render = () => {
    cardGroup.position.copy(sim.body.position);
    cardGroup.quaternion.copy(sim.body.quaternion);
    updateBand();
    updateShadow();
    renderer.render(scene, camera);
  };

  const physicsFor = () => {
    const gravity = 40 * clamp(o.gravity, 0, 3);
    const weight = Math.max(gravity, 20);
    const springy = clamp(o.elasticity, 0, 1);
    const settle = clamp(o.damping, 0, 1);
    // the breeze fades out 8 to 11 s after the last touch, so a still page costs nothing
    const fade = clamp(1 - (time - touched - 8) / 3, 0, 1);
    return {
      gravity,
      hold: weight * mix(2.2, 5.5, springy),
      stiffness: weight * 10 * JOINTS,
      spring: weight * mix(0.1, 0.4, springy) * JOINTS,
      bandDamping: weight * mix(0.3, 0.08, springy) * JOINTS,
      linearDrag: 0.25 * Math.pow(16, settle),
      angularDrag: 0.5 * Math.pow(12, settle),
      air: 0.15, broadside: 0.5, spinAir: 0.03, nodeDrag: 2, nodeAir: 0.2,
      twist: 30, twistDamping: 3, grip: 40, gripDamping: 6,
      breeze: reducedMotion ? 0 : clamp(o.breeze, 0, 1) * fade,
    };
  };

  const running = () => onScreen && allowed && !document.hidden && alive;

  const tick = (now) => {
    raf = 0;
    if (!running()) return;
    const t0 = performance.now();
    const dt = Math.min(1 / 30, Math.max(1 / 240, (now - last) / 1000));
    last = now;
    time += dt;
    const current = physicsFor();
    stepSimulation(sim, dt, current, time);
    const body = sim.body;
    if (!Number.isFinite(body.position.x + body.position.y + body.position.z + body.quaternion.w)) {
      sim.grab = null;
      placeHanging(sim, layout, false);
    }
    // 60 fps while held or moving fast; 30 fps while it only sways
    const busy = sim.grab || sim.energy > 0.5;
    if (now - lastDraw >= (busy ? 1000 / 60 : 1000 / 30) - 1) {
      lastDraw = now;
      render();
    }
    const cost = performance.now() - t0;
    stats.frames++;
    stats.ms += cost;
    if (cost > stats.worst) stats.worst = cost;
    const resting = sim.calm > 1.2 && !sim.grab && current.breeze === 0;
    if (!resting) raf = requestAnimationFrame(tick);
  };

  const firstRun = () => {
    if (placed) return;
    placeHanging(sim, layout, reducedMotion ? false : o.intro);
    placed = true;
  };

  const start = () => {
    if (raf || !running()) return;
    firstRun();
    sim.calm = 0;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  const touch = () => { touched = time; start(); };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const toPointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  };
  const pickCard = () => {
    if (!placed) return null;
    cardGroup.updateMatrixWorld();
    const hits = raycaster.intersectObjects([bodyMesh, frontMesh, backMesh], false);
    return hits[0] || null;
  };
  const target = o.eventTarget;
  const setCursor = (value) => { if (target.style.cursor !== value) target.style.cursor = value; };

  const flip = (point) => {
    const body = sim.body;
    const up = scratch.a.set(0, 1, 0).applyQuaternion(body.quaternion);
    let direction = sim.turn > 0 ? -1 : 1;
    if (sim.turn === 0 && point) {
      const away = scratch.c.subVectors(point, camera.position).normalize();
      direction = scratch.b.subVectors(point, body.position).cross(away).dot(up) < 0 ? -1 : 1;
    }
    sim.turn = sim.turn === 0 ? Math.PI * direction : 0;
    body.angular.addScaledVector(up, (reducedMotion ? 3 : FLIP_SPIN) * direction);
    o.onFlip?.(sim.turn !== 0);
    touch();
  };

  const onPointerDown = (event) => {
    if (event.button > 0 || !running()) return;
    if (!toPointer(event)) return;
    const hit = pickCard();
    if (!hit) return;
    sim.grab = {
      local: hit.point.clone().sub(sim.body.position).applyQuaternion(sim.body.quaternion.clone().invert()),
      rotation: sim.body.quaternion.clone(),
      reach: hit.distance,
      from: hit.point.clone(),
      target: hit.point.clone(),
    };
    press = { x: event.clientX, y: event.clientY, time: performance.now(), point: hit.point.clone(), id: event.pointerId };
    swallowClick = true;
    target.setPointerCapture?.(event.pointerId);
    setCursor('grabbing');
    event.preventDefault();
    touch();
  };

  const onPointerMove = (event) => {
    if (sim.grab) {
      toPointer(event);
      if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) press = null;
      raycaster.ray.at(sim.grab.reach, sim.grab.target);
      touch();
      return;
    }
    if (event.pointerType === 'touch' || !placed) return;
    hovering = toPointer(event) && !!pickCard();
    setCursor(hovering ? 'grab' : '');
  };

  const onPointerUp = (event) => {
    if (!sim.grab) return;
    sim.grab = null;
    if (press && event.type === 'pointerup' && performance.now() - press.time < 450) flip(press.point);
    press = null;
    if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);
    setCursor(hovering && event.pointerType !== 'touch' ? 'grab' : '');
    touch();
    // a press that took the card never also clicks what lies under it
    setTimeout(() => { swallowClick = false; }, 0);
  };

  const onClickCapture = (event) => {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  // Touch: no touchstart handler on purpose. The section's CSS touch-action (pan-y) lets a vertical swipe scroll
  // the page even when it starts on the card (the browser then sends pointercancel and the card lets go), while
  // a sideways drag and a tap still reach the card.

  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointermove', onPointerMove);
  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('pointercancel', onPointerUp);
  target.addEventListener('lostpointercapture', onPointerUp);
  target.addEventListener('click', onClickCapture, true);

  const dpr = () => Math.min(window.devicePixelRatio || 1, (navigator.hardwareConcurrency || 4) <= 4 ? 1.25 : 1.5);
  const resize = () => {
    view.width = Math.max(1, el.clientWidth);
    view.height = Math.max(1, el.clientHeight);
    renderer.setPixelRatio(dpr());
    renderer.setSize(view.width, view.height, false);
    frameView();
    if (placed) render();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(el);
  const io = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen && allowed) start();
    else if (onScreen && !placed && reducedMotion) { firstRun(); render(); }
  });
  io.observe(el);
  const onVisibility = () => { if (!document.hidden) start(); };
  document.addEventListener('visibilitychange', onVisibility);
  resize();
  // Compile the shaders (in the background where the driver allows) and upload the textures now, so the first
  // frame drawn when the card scrolls into view isn't a 200 ms stall.
  const compiled = renderer.compileAsync(scene, camera).catch(() => {});
  [frontTexture, backTexture, strapTexture, grain, weave, shadowTex.texture].forEach((t) => t && renderer.initTexture(t));

  return {
    canvas,
    stats,
    /** resolves once the shaders are compiled (the GPU does that in the background) */
    compiled,
    /** false while another scene owns the frame (the hero); the loop waits, nothing is lost */
    setAllowed(on) {
      allowed = !!on;
      if (allowed) start();
    },
    flip() { if (!placed) { firstRun(); } flip(null); },
    setAnchor(x) {
      if (Math.abs(x - o.anchorX) < 0.002) return;
      o.anchorX = x;
      frameView();
      if (placed) { render(); start(); }
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      target.removeEventListener('pointerdown', onPointerDown);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', onPointerUp);
      target.removeEventListener('pointercancel', onPointerUp);
      target.removeEventListener('lostpointercapture', onPointerUp);
      target.removeEventListener('click', onClickCapture, true);
      [bodyMesh, frontMesh, backMesh, ring, clampMesh, eyelet, band, shadow].forEach((m) => m.geometry?.dispose());
      [frontMaterial, backMaterial, edgeMaterial, metalMaterial, bandMaterial, shadowMaterial].forEach((m) => m.dispose());
      [frontTexture, backTexture, strapTexture, grain, weave, shadowTex.texture].forEach((t) => t.dispose());
      environment.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
