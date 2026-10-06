// Construções e objetos de cena, modelados com primitivas no estilo low-poly estilizado.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, glow, timeU } from '../core/engine.js';
import { makeFire, particles } from '../core/fx.js';

const mat = (c, o) => (typeof c === 'string' ? M(c, o) : c);
export function mk(geo, m, x = 0, y = 0, z = 0, p, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  o.castShadow = o.receiveShadow = true;
  if (p) p.add(o);
  return o;
}
export const box = (p, w, h, d, c, x = 0, y = 0, z = 0, ry = 0, o) => mk(new THREE.BoxGeometry(w, h, d), mat(c, o), x, y, z, p, 0, ry, 0);
export const cyl = (p, rt, rb, h, c, x = 0, y = 0, z = 0, seg = 8, o) => mk(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c, o), x, y, z, p);
export const put = (o, x, y, z, p) => { o.position.set(x, y, z); if (p) p.add(o); return o; };
const ball = (p, r, c, x, y, z, s = [1, 1, 1], d = 0) => { const m = mk(new THREE.IcosahedronGeometry(r, d), mat(c), x, y, z, p); m.scale.set(...s); return m; };

// Junta malhas estáticas por material: muito menos chamadas de desenho.
export function bake(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), groups = new Map(), kill = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.dynamic || Array.isArray(o.material) || o.material.map || o.material.isShaderMaterial) return;
    for (let p = o.parent; p && p !== root; p = p.parent) if (p.userData.dynamic) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!groups.has(o.material)) groups.set(o.material, []);
    groups.get(o.material).push(g);
    kill.push(o);
  });
  kill.forEach((o) => { o.removeFromParent(); o.geometry.dispose(); });
  for (const [m, list] of groups) {
    const g = mergeGeometries(list);
    list.forEach((x) => x.dispose());
    const o = new THREE.Mesh(g, m);
    o.castShadow = o.receiveShadow = true;
    root.add(o);
  }
  return root;
}

// Posiciona no terreno e registra colisões/superfícies declaradas no objeto.
export function place(W, obj, x, z, ry = 0, dy = 0) {
  W.add(obj, x, z, ry, dy);
  const c = Math.cos(ry), s = Math.sin(ry), wx = (lx, lz) => x + c * lx + s * lz, wz = (lx, lz) => z - s * lx + c * lz;
  for (const b of obj.userData.boxes || []) W.addBox(wx(b[0], b[1]), wz(b[0], b[1]), b[2], b[3], ry);
  for (const b of obj.userData.circles || []) W.addCollider(wx(b[0], b[1]), wz(b[0], b[1]), b[2]);
  for (const b of obj.userData.surfaces || []) W.addSurface(wx(b[0], b[1]), wz(b[0], b[1]), b[2], b[3], ry, obj.position.y + b[4]);
  return obj;
}

// --- texturas de texto (placas) ---
export function textTex(lines, { w = 1024, h = 256, bg = '#2a1c12', fg = '#f3e4c0', size = 110, border = '#c9a24a', font = 'Cinzel' } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const x = cv.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  if (border) { x.strokeStyle = border; x.lineWidth = h * 0.045; x.strokeRect(h * 0.07, h * 0.07, w - h * 0.14, h - h * 0.14); }
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  const L = Array.isArray(lines) ? lines : [lines];
  const total = L.length === 1 ? size : size * 1.55;
  L.forEach((ln, i) => {
    let s = i === 0 ? size : size * 0.48;
    x.font = `700 ${s}px ${font}, serif`;
    while (x.measureText(ln).width > w * 0.84 && s > 12) { s -= 4; x.font = `700 ${s}px ${font}, serif`; }
    x.fillText(ln, w / 2, h / 2 - total / 2 + (i === 0 ? size * 0.5 : size * 1.25));
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function signMesh(lines, w, h, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ map: textTex(lines, opts), roughness: 0.8, emissive: '#ffffff', emissiveIntensity: opts.lit ?? 0.08 });
  m.emissiveMap = m.map;
  m.userData.own = true;
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  o.castShadow = false;
  return o;
}

// --- telhados ---
function prism(L, W, H) {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0); s.lineTo(W / 2, 0); s.lineTo(0, H); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false });
  g.translate(0, 0, -L / 2);
  g.rotateY(Math.PI / 2);
  return g;
}
export function gableRoof(p, L, W, H, y0, roofCol, wallCol, over = 0.45, th = 0.16) {
  if (wallCol) mk(prism(L, W, H), mat(wallCol), 0, y0, 0, p);
  const a = Math.atan2(H, W / 2), sl = Math.hypot(W / 2, H) + over;
  for (const s of [1, -1]) {
    const m = box(p, L + over * 2, th, sl, roofCol);
    m.position.set(0, y0 + (H - over * Math.sin(a)) / 2 + (Math.cos(a) * th) / 2, (s * (W / 2 + over * Math.cos(a))) / 2 + (s * Math.sin(a) * th) / 2);
    m.rotation.x = s * a;
  }
  box(p, L + over * 2, th * 1.2, th * 2.2, roofCol, 0, y0 + H + th * 0.5, 0);
}
function hipGeo(L, W, H) {
  const l = L / 2, w = W / 2, r = Math.max(l - w, 0.01);
  const v = [-l, 0, w, l, 0, w, r, H, 0, -l, 0, w, r, H, 0, -r, H, 0, l, 0, -w, -l, 0, -w, -r, H, 0, l, 0, -w, -r, H, 0, r, H, 0,
    -l, 0, -w, -l, 0, w, -r, H, 0, l, 0, w, l, 0, -w, r, H, 0];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

function windowUnit(p0, x, y, z, { w = 1, h = 1.5, frame = '#f1ece2', shutter = '#3d6b8f', lit = false, open = 0.5, bars = false } = {}, ry = 0) {
  const p = put(new THREE.Group(), x, y, z, p0);
  p.rotation.y = ry;
  box(p, w + 0.16, h + 0.16, 0.12, frame);
  box(p, w, h, 0.06, lit ? glow('#ffbf6a', 1.6) : M('#2a231d'), 0, 0, 0.05);
  if (bars) for (let i = -1; i <= 1; i++) box(p, 0.04, h, 0.05, '#3a3330', i * w * 0.3, 0, 0.09);
  if (shutter) for (const s of [-1, 1]) {
    const sh = box(p, w / 2, h, 0.06, shutter, s * (w / 2 + (w / 4) * Math.cos(open)), 0, 0.08 + (w / 4) * Math.sin(open));
    sh.rotation.y = -s * open;
  }
}
function door(p, x, z, { w = 1.1, h = 2.2, c = '#5a3a22', frame = '#f1ece2', y = 0 } = {}) {
  box(p, w + 0.2, h + 0.12, 0.12, frame, x, y + h / 2 + 0.03, z);
  box(p, w, h, 0.08, c, x, y + h / 2, z + 0.05);
}

// ======== Construções ========
export function casaGrande({ lit = false, ruined = false } = {}) {
  const g = new THREE.Group(), L = 16, D = 9, H = 4.2, base = 1.1;
  const wall = ruined ? '#b4a68e' : '#efe7d6', stone = '#8c857a';
  box(g, L + 0.6, base, D + 0.6, stone, 0, base / 2, 0);
  for (let i = 0; i < 4; i++) box(g, 3, 0.25, 0.9 - i * 0.2, stone, 0, base - 0.25 * i - 0.12, D / 2 + 0.75 + i * 0.35);
  if (!ruined) {
    box(g, L, H, 0.35, wall, 0, base + H / 2, D / 2);
    box(g, L, H, 0.35, wall, 0, base + H / 2, -D / 2);
    for (const s of [-1, 1]) box(g, 0.35, H, D, wall, (s * L) / 2, base + H / 2, 0);
    box(g, L + 0.5, 0.3, D + 0.5, '#d9cfbb', 0, base + H, 0);
    mk(hipGeo(L + 1.6, D + 1.6, 3.2), M('#b0503a'), 0, base + H + 0.12, 0, g);
  } else {
    const hs = [3.6, 2.1, 4.2, 1.2, 3.1, 2.6, 4.0, 1.6];
    hs.forEach((h, i) => box(g, L / 8, h, 0.35, wall, -L / 2 + L / 16 + (i * L) / 8, base + h / 2, D / 2));
    box(g, L, 2.8, 0.35, wall, 0, base + 1.4, -D / 2);
    box(g, 0.35, 3.3, D, wall, -L / 2, base + 1.65, 0);
    box(g, 0.35, 1.9, D * 0.6, wall, L / 2, base + 0.95, -D * 0.2);
    const beam = box(g, L * 0.7, 0.2, 0.25, '#4a3526', -2, base + 2.6, 0.5);
    beam.rotation.z = 0.25;
    for (let i = 0; i < 9; i++) ball(g, 0.6 + (i % 3) * 0.3, i % 2 ? '#3f6a2c' : '#2f5422', -L / 2 + 1 + i * 1.8, base + 1 + (i % 4) * 0.8, D / 2 + 0.3, [1.4, 1, 0.5]);
  }
  for (let i = 0; i < 7; i++) {
    const x = -6.6 + i * 2.2;
    if (Math.abs(x) < 0.5) door(g, 0, D / 2 + 0.12, { y: base, h: 2.6, w: 1.4, c: ruined ? '#2a2420' : '#5a3a22' });
    else if (!ruined || i % 3 === 0) windowUnit(g, x, base + 2.2, D / 2 + 0.12, { lit, shutter: ruined ? null : '#3d6b8f' });
  }
  g.userData.boxes = [[0, 0, L / 2 + 0.3, D / 2 + 0.3]];
  return bake(g);
}

export function senzala({ lit = false } = {}) {
  const g = new THREE.Group(), L = 22, D = 5.5, H = 2.6;
  box(g, L + 0.4, 0.3, D + 0.4, '#7a6a58', 0, 0.15, 0);
  box(g, L, H, D, '#9a7a58', 0, 0.3 + H / 2, 0);
  gableRoof(g, L, D, 1.6, 0.3 + H, '#a04a34', '#9a7a58', 0.6);
  for (let i = 0; i < 5; i++) {
    const x = -8.8 + i * 4.4;
    box(g, 0.9, 1.8, 0.1, '#2a1f18', x, 1.2, D / 2 + 0.03);
    windowUnit(g, x + 1.6, 2.1, D / 2, { w: 0.5, h: 0.4, frame: '#7a5a40', shutter: null, bars: true, lit });
  }
  g.userData.boxes = [[0, 0, L / 2 + 0.2, D / 2 + 0.2]];
  return bake(g);
}

let coffeeTex = null;
function getCoffeeTex() {
  if (coffeeTex) return coffeeTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const x = cv.getContext('2d');
  x.fillStyle = '#5a3424'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { x.fillStyle = ['#7a2a1c', '#9a3a22', '#4a2a1c', '#6a4a2a', '#b84a2a'][i % 5]; x.beginPath(); x.ellipse(Math.random() * 256, Math.random() * 256, 2.6, 2, Math.random() * 3, 0, 7); x.fill(); }
  coffeeTex = new THREE.CanvasTexture(cv);
  coffeeTex.colorSpace = THREE.SRGBColorSpace;
  coffeeTex.wrapS = coffeeTex.wrapT = THREE.RepeatWrapping;
  coffeeTex.repeat.set(3, 2);
  return coffeeTex;
}
export function terreiro(w = 22, d = 14) {
  const g = new THREE.Group();
  box(g, w, 0.25, d, '#b8ab96', 0, 0.12, 0);
  for (const s of [-1, 1]) { box(g, w, 0.35, 0.3, '#9a5a3a', 0, 0.17, (s * d) / 2); box(g, 0.3, 0.35, d, '#9a5a3a', (s * w) / 2, 0.17, 0); }
  const cm = new THREE.MeshStandardMaterial({ map: getCoffeeTex(), roughness: 0.9 });
  const pl = mk(new THREE.PlaneGeometry(w * 0.8, d * 0.62), cm, 0, 0.27, 0, g, -Math.PI / 2);
  pl.castShadow = false;
  for (let i = 0; i < 5; i++) mk(new THREE.ConeGeometry(0.7, 0.45, 8), M('#5a3022'), -w * 0.32 + i * w * 0.16, 0.45, d * 0.38, g);
  return g;
}

// Rancho de pau-a-pique com cobertura de sapê (etapas de construção).
export function rancho({ stage = 3, door = true } = {}) {
  const g = new THREE.Group(), L = 5, D = 4, H = 2.1;
  const frame = new THREE.Group(), walls = new THREE.Group(), roofs = [0, 1, 2].map(() => new THREE.Group());
  g.add(frame, walls, ...roofs);
  for (const x of [-L / 2, 0, L / 2]) for (const z of [-D / 2, D / 2]) cyl(frame, 0.08, 0.1, H, '#5a3e28', x, H / 2, z, 6);
  for (const x of [-L / 2, L / 2]) cyl(frame, 0.07, 0.08, H + 1.5, '#5a3e28', x, (H + 1.5) / 2, 0, 6);
  const ridge = cyl(frame, 0.07, 0.07, L + 0.6, '#5a3e28', 0, H + 1.5, 0, 6);
  ridge.rotation.z = Math.PI / 2;
  const wc = '#8f6c4a';
  box(walls, L, H, 0.18, wc, 0, H / 2, -D / 2);
  for (const s of [-1, 1]) box(walls, 0.18, H, D, wc, (s * L) / 2, H / 2, 0);
  box(walls, L * 0.36, H, 0.18, wc, -L * 0.32, H / 2, D / 2);
  box(walls, L * 0.36, H, 0.18, wc, L * 0.32, H / 2, D / 2);
  if (!door) box(walls, L * 0.3, H, 0.16, '#3a2a1e', 0, H / 2, D / 2);
  for (let i = 0; i < 5; i++) box(walls, L + 0.05, 0.05, 0.22, '#6a4a30', 0, 0.3 + i * 0.4, -D / 2);
  const a = Math.atan2(1.5, D / 2), sl = Math.hypot(D / 2, 1.5) + 0.7;
  roofs.forEach((rg, k) => {
    for (const s of [1, -1]) for (let layer = 0; layer < 2; layer++) {
      const m = box(rg, L / 3 + 0.5, 0.22, sl - layer * 0.5, layer ? '#c9a95e' : '#a88a48');
      m.position.set(-L / 3 + (k * L) / 3, H + 0.68 + layer * 0.12, s * (D / 4 + 0.15) - s * layer * 0.1);
      m.rotation.x = s * a;
    }
  });
  g.userData.setStage = (n) => { walls.visible = n >= 0; roofs.forEach((r, i) => { r.visible = n > i; }); };
  g.userData.setStage(stage);
  g.userData.boxes = [[0, -0.6, L / 2 + 0.1, D / 2 - 0.4]];
  [frame, walls, ...roofs].forEach(bake);
  return g;
}

// Abrigo de folhas e varas (acampamento Puri — interpretação visual).
export function leafShelter() {
  const g = new THREE.Group();
  const layer = (r, ph0, phL, thL, c, y = 0) => {
    const geo = new THREE.SphereGeometry(r, 12, 6, ph0, phL, 0, thL);
    geo.scale(1.15, 0.95, 1);
    mk(geo, M(c, { side: THREE.DoubleSide }), 0, y, 0, g);
  };
  layer(1.9, 0.6, Math.PI * 1.65, Math.PI / 2, '#7f7a3e');
  layer(1.98, 0.75, Math.PI * 1.5, Math.PI * 0.4, '#9a9248', 0.08);
  layer(2.04, 0.95, Math.PI * 1.3, Math.PI * 0.26, '#6f8a3a', 0.16);
  mk(new THREE.ConeGeometry(0.55, 0.5, 7), M('#8a8a42'), 0, 1.95, 0, g);
  for (let i = 0; i < 3; i++) { const p = cyl(g, 0.04, 0.05, 2.6, '#5a4630', Math.cos(i * 2.1) * 0.3, 1.7, Math.sin(i * 2.1) * 0.3, 5); p.rotation.set(Math.sin(i * 2.1) * 0.25, 0, Math.cos(i * 2.1) * 0.25); }
  g.userData.circles = [[0, 0, 2.0]];
  return bake(g);
}

export function hammock(a, b, color = '#cdb98e') {
  const g = new THREE.Group(), N = 14, pos = [], idx = [];
  const dir = new THREE.Vector3().subVectors(b, a), side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  for (let i = 0; i <= N; i++) {
    const t = i / N, c = new THREE.Vector3().lerpVectors(a, b, t);
    c.y -= 0.9 * 4 * t * (1 - t);
    const w = 0.45 * Math.pow(Math.sin(Math.PI * Math.min(Math.max((t - 0.12) / 0.76, 0), 1)), 0.6) + 0.02;
    pos.push(c.x + side.x * w, c.y + w * 0.35, c.z + side.z * w, c.x, c.y, c.z, c.x - side.x * w, c.y + w * 0.35, c.z - side.z * w);
    if (i < N) { const k = i * 3; idx.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  mk(geo, M(color, { side: THREE.DoubleSide }), 0, 0, 0, g);
  return g;
}

export function campfire({ lit = true, scale = 1, stones = '#6e6a64' } = {}) {
  const g = new THREE.Group();
  const s = new THREE.Group();
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; ball(s, 0.2, stones, Math.cos(a) * 0.62, 0.1, Math.sin(a) * 0.62, [1.2, 0.8, 1]); }
  for (let i = 0; i < 4; i++) { const l = cyl(s, 0.07, 0.08, 1.1, '#3e2a1c', 0, 0.16, 0, 6); l.rotation.set(Math.PI / 2 - 0.35, (i * Math.PI) / 2, 0); }
  bake(s);
  g.add(s);
  const fire = makeFire(scale);
  fire.position.y = 0.05;
  g.add(fire);
  fire.userData.setLit(lit);
  g.userData.fire = fire;
  g.userData.update = fire.userData.update;
  g.userData.circles = [[0, 0, 0.75]];
  return g;
}

export function clayPot(c = '#a0522d') {
  const pts = [[0, 0], [0.22, 0.02], [0.32, 0.18], [0.3, 0.36], [0.2, 0.48], [0.22, 0.54], [0.19, 0.55]].map(([x, y]) => new THREE.Vector2(x, y));
  return mk(new THREE.LatheGeometry(pts, 10), M(c));
}
export function basket(c = '#b08850') {
  const g = new THREE.Group();
  cyl(g, 0.32, 0.22, 0.38, c, 0, 0.19, 0, 10);
  cyl(g, 0.34, 0.34, 0.06, '#8a6638', 0, 0.38, 0, 10);
  return g;
}
export function bigRock(sx = 6, sy = 4, sz = 5, c = '#a9a499') {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = Math.sin(x * 12.9 + y * 78.2 + z * 37.7) * 43758.5; const r = 1 + ((k - Math.floor(k)) - 0.5) * 0.25; p.setXYZ(i, x * r, y * r, z * r); }
  geo.computeVertexNormals();
  const m = mk(geo, M(c, { roughness: 0.9 }));
  m.scale.set(sx, sy, sz);
  return m;
}

export function drum(big = true) {
  const g = new THREE.Group(), h = big ? 1.0 : 0.72, r = big ? 0.3 : 0.21;
  const pts = [[r * 0.82, 0], [r, h * 0.3], [r * 1.02, h * 0.6], [r * 0.92, h]].map(([x, y]) => new THREE.Vector2(x, y));
  mk(new THREE.LatheGeometry(pts, 12), M('#7a4526'), 0, 0, 0, g);
  cyl(g, r * 0.95, r * 0.95, 0.03, '#e2cfa6', 0, h + 0.01, 0, 14);
  for (const y of [0.15, h - 0.12]) { const t = mk(new THREE.TorusGeometry(r * 0.98, 0.02, 4, 16), M('#3a2416'), 0, y, 0, g); t.rotation.x = Math.PI / 2; }
  return g;
}

export function italianHouse() {
  const g = new THREE.Group(), L = 7, D = 5.5, H = 2.8, y0 = 0.7;
  const parts = { base: new THREE.Group(), frame: new THREE.Group(), walls: new THREE.Group(), roof: new THREE.Group(), detail: new THREE.Group() };
  Object.values(parts).forEach((p) => g.add(p));
  box(parts.base, L + 0.3, y0, D + 0.3, '#857c70', 0, y0 / 2, 0);
  box(parts.base, L + 0.3, 0.12, D + 2.2, '#8a6440', 0, y0 + 0.06, 0.95);
  for (const x of [-L / 2, -L / 6, L / 6, L / 2]) for (const z of [-D / 2, D / 2]) cyl(parts.frame, 0.09, 0.09, H, '#6a4a30', x, y0 + H / 2, z, 6);
  for (const z of [-D / 2, D / 2]) box(parts.frame, L, 0.14, 0.14, '#6a4a30', 0, y0 + H, z);
  const wc = '#a8744a';
  box(parts.walls, L, H, 0.14, wc, 0, y0 + H / 2, -D / 2);
  for (const s of [-1, 1]) box(parts.walls, 0.14, H, D, wc, (s * L) / 2, y0 + H / 2, 0);
  box(parts.walls, 2.4, H, 0.14, wc, -2.3, y0 + H / 2, D / 2);
  box(parts.walls, 2.4, H, 0.14, wc, 2.3, y0 + H / 2, D / 2);
  box(parts.walls, 2.2, 0.6, 0.14, wc, 0, y0 + H - 0.3, D / 2);
  for (let i = 0; i < 14; i++) box(parts.walls, 0.03, H, 0.03, '#7a5234', -L / 2 + 0.25 + i * 0.5, y0 + H / 2, D / 2 + 0.08);
  gableRoof(parts.roof, L, D, 1.9, y0 + H, '#9a4a30', wc, 0.5);
  door(parts.detail, 0, D / 2 + 0.05, { y: y0, h: 2.1, c: '#4f6a3a' });
  windowUnit(parts.detail, -2.2, y0 + 1.5, D / 2 + 0.08, { shutter: '#4f7a4a', w: 0.9, h: 1.1 });
  windowUnit(parts.detail, 2.2, y0 + 1.5, D / 2 + 0.08, { shutter: '#4f7a4a', w: 0.9, h: 1.1 });
  for (const x of [-L / 2, -1.2, 1.2, L / 2]) cyl(parts.detail, 0.07, 0.07, 2.2, '#6a4a30', x, y0 + 1.1, D / 2 + 1.8, 6);
  const pr = box(parts.detail, L + 0.4, 0.1, 2.3, '#7a3e2a', 0, y0 + 2.35, D / 2 + 1.05);
  pr.rotation.x = 0.18;
  box(parts.detail, L, 0.08, 0.06, '#6a4a30', 0, y0 + 0.9, D / 2 + 1.85);
  box(parts.detail, 0.7, 4.6, 0.7, '#7d756a', L / 2 - 0.8, y0 + 2.4, -D / 2 + 0.6);
  const smoke = particles({ count: 24, mode: 3, spread: [0.5, 7, 0.5], color: '#cfcac2', size: 1, rate: 0.07, opacity: 0.22, additive: false });
  smoke.position.set(L / 2 - 0.8, y0 + 4.8, -D / 2 + 0.6);
  parts.detail.add(smoke);
  const order = ['base', 'frame', 'walls', 'roof', 'detail'];
  g.userData.setStage = (n) => order.forEach((k, i) => { parts[k].visible = i === 0 || (k === 'frame' ? n >= 0 && n < 2 : i - 1 <= n); });
  g.userData.setStage(3);
  ['base', 'frame', 'walls', 'roof', 'detail'].forEach((k) => bake(parts[k]));
  g.userData.boxes = [[0, 0, L / 2 + 0.15, D / 2 + 0.15]];
  return g;
}

export function chapel() {
  const g = new THREE.Group(), L = 5, D = 8, H = 4;
  box(g, L + 0.4, 0.4, D + 0.4, '#8a837a', 0, 0.2, 0);
  box(g, L, H, D, '#f2ede2', 0, 0.4 + H / 2, 0);
  const r = new THREE.Group();
  gableRoof(r, D, L, 2.2, 0.4 + H, '#b0503a', '#f2ede2', 0.4);
  r.rotation.y = Math.PI / 2;
  g.add(r);
  door(g, 0, D / 2 + 0.03, { y: 0.4, h: 2.4, w: 1.3, c: '#3d6b8f' });
  const rose = mk(new THREE.CircleGeometry(0.4, 16), glow('#e8c27a', 0.6), 0, 0.4 + H + 0.8, D / 2 + 0.06, g);
  rose.castShadow = false;
  box(g, 1.3, 1.6, 1.3, '#f2ede2', 0, 0.4 + H + 2.5, D / 2 - 0.7);
  mk(new THREE.ConeGeometry(1.0, 1.2, 4), M('#b0503a'), 0, 0.4 + H + 3.9, D / 2 - 0.7, g, 0, Math.PI / 4, 0);
  mk(new THREE.ConeGeometry(0.22, 0.35, 8, 1, true), M('#c9a24a', { metalness: 0.6, roughness: 0.4 }), 0, 0.4 + H + 2.4, D / 2 - 0.05, g);
  box(g, 0.08, 0.9, 0.08, '#c9a24a', 0, 0.4 + H + 4.9, D / 2 - 0.7);
  box(g, 0.45, 0.08, 0.08, '#c9a24a', 0, 0.4 + H + 5.1, D / 2 - 0.7);
  for (const s of [-1, 1]) windowUnit(g, (s * L) / 2 + s * 0.05, 2.6, 0, { w: 0.6, h: 1.3, shutter: null, frame: '#e0b84a' }, (s * Math.PI) / 2);
  g.userData.boxes = [[0, 0, L / 2 + 0.2, D / 2 + 0.2]];
  return bake(g);
}

export function church({ lit = false } = {}) {
  const g = new THREE.Group(), L = 9, D = 17, H = 7;
  box(g, L + 1, 0.6, D + 1, '#8a837a', 0, 0.3, 0);
  box(g, L, H, D, '#f3eee3', 0, 0.6 + H / 2, 0);
  const r = new THREE.Group();
  gableRoof(r, D, L, 3, 0.6 + H, '#a84a34', '#f3eee3', 0.4);
  r.rotation.y = Math.PI / 2;
  g.add(r);
  box(g, L + 0.6, H + 1.2, 0.6, '#f3eee3', 0, 0.6 + (H + 1.2) / 2, D / 2);
  for (const s of [-1, 1]) box(g, 0.5, H + 1.2, 0.7, '#e0b84a', (s * (L + 0.6)) / 2, 0.6 + (H + 1.2) / 2, D / 2 + 0.05);
  const ped = mk(prism(0.6, L + 0.6, 2.6), M('#f3eee3'), 0, 0.6 + H + 1.2, D / 2, g, 0, Math.PI / 2, 0);
  ped.rotation.y = Math.PI / 2;
  box(g, 3.2, 6, 3.2, '#f3eee3', 0, 0.6 + H + 4.4, D / 2 - 1.8);
  box(g, 3.4, 0.3, 3.4, '#e0b84a', 0, 0.6 + H + 7.4, D / 2 - 1.8);
  mk(new THREE.ConeGeometry(2.4, 3, 4), M('#a84a34'), 0, 0.6 + H + 9, D / 2 - 1.8, g, 0, Math.PI / 4, 0);
  box(g, 0.14, 1.6, 0.14, '#c9a24a', 0, 0.6 + H + 11.3, D / 2 - 1.8);
  box(g, 0.8, 0.14, 0.14, '#c9a24a', 0, 0.6 + H + 11.6, D / 2 - 1.8);
  door(g, 0, D / 2 + 0.33, { y: 0.6, w: 2, h: 3.4, c: '#3d5f80', frame: '#e0b84a' });
  for (const s of [-1, 1]) windowUnit(g, s * 2.8, 4.2, D / 2 + 0.33, { w: 0.9, h: 1.8, shutter: null, frame: '#e0b84a', lit });
  windowUnit(g, 0, 6.1, D / 2 + 0.33, { w: 1.1, h: 1.1, shutter: null, frame: '#e0b84a', lit });
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) windowUnit(g, s * (L / 2 + 0.03), 4, -D / 2 + 3 + i * 3.6, { w: 0.8, h: 2, shutter: null, frame: '#e0b84a', lit }, (s * Math.PI) / 2);
  g.userData.boxes = [[0, 0, L / 2 + 0.5, D / 2 + 0.6]];
  return bake(g);
}

export function townHouse({ w = 7, d = 6, h = 3.4, color = '#e7c26a', trim = '#f4efe4', roof = '#a8503a', shutter = '#3d6b8f', lit = false, doorC = '#5a3a22' } = {}) {
  const g = new THREE.Group();
  box(g, w + 0.2, 0.4, d + 0.2, '#8a837a', 0, 0.2, 0);
  box(g, w, h, d, color, 0, 0.4 + h / 2, 0);
  box(g, w + 0.08, 0.35, d + 0.08, trim, 0, 0.4 + h - 0.15, 0);
  box(g, w + 0.04, 0.5, d + 0.04, '#9a5a3a', 0, 0.65, 0);
  gableRoof(g, w, d, 1.7, 0.4 + h, roof, color, 0.5);
  door(g, 0, d / 2 + 0.03, { y: 0.4, c: doorC, frame: trim });
  for (const s of [-1, 1]) windowUnit(g, (s * w) / 3.2, 0.4 + h * 0.55, d / 2 + 0.05, { w: 0.9, h: 1.3, shutter, frame: trim, lit });
  g.userData.boxes = [[0, 0, w / 2 + 0.1, d / 2 + 0.1]];
  return bake(g);
}

export function store() {
  const g = new THREE.Group(), w = 9, d = 6.5, h = 3.8;
  const shell = new THREE.Group(), closed = new THREE.Group(), open = new THREE.Group();
  g.add(shell, closed, open);
  box(shell, w + 0.2, 0.45, d + 0.2, '#8a837a', 0, 0.22, 0);
  box(shell, w, h, d, '#d9a86a', 0, 0.45 + h / 2, 0);
  box(shell, w + 0.1, 0.4, d + 0.1, '#f2e6cc', 0, 0.45 + h - 0.2, 0);
  gableRoof(shell, w, d, 1.8, 0.45 + h, '#9a4a30', '#d9a86a', 0.5);
  box(shell, w + 0.6, 0.12, 1.8, '#6a3a2a', 0, 0.45 + h - 0.6, d / 2 + 0.9).rotation.x = 0.22;
  for (const x of [-w / 2, w / 2]) cyl(shell, 0.07, 0.07, h - 0.6, '#5a3a24', x, 0.45 + (h - 0.6) / 2, d / 2 + 1.7, 6);
  for (const x of [-3, 0, 3]) {
    box(shell, 1.7, 2.6, 0.12, '#f2e6cc', x, 0.45 + 1.3, d / 2 + 0.02);
    box(closed, 1.5, 2.5, 0.1, '#6a4a30', x, 0.45 + 1.25, d / 2 + 0.07);
    box(open, 1.5, 2.5, 0.06, glow('#ffc070', 1.2), x, 0.45 + 1.25, d / 2 + 0.03);
  }
  const blank = box(closed, 5.4, 0.9, 0.08, '#7a5a3a', 0, 0.45 + h - 1.1, d / 2 + 0.06);
  blank.castShadow = false;
  const sg = signMesh(['ARMAZÉM YOUSSEF', 'SECOS E MOLHADOS · TECIDOS · ARMARINHO'], 5.4, 1.05, { size: 112, lit: 0.25 });
  sg.position.set(0, 0.45 + h - 1.1, d / 2 + 0.09);
  open.add(sg);
  const light = new THREE.PointLight('#ffb866', 0, 12, 1.6);
  light.position.set(0, 2.4, d / 2 + 1.5);
  g.add(light);
  // mercadorias na calçada
  for (let i = 0; i < 3; i++) put(sack(), -4.2 + i * 0.75, 0.45, d / 2 + 0.9, g);
  for (let i = 0; i < 2; i++) put(barrel(), 3.6 + i * 0.85, 0.45, d / 2 + 0.8, g);
  box(open, 2.2, 0.08, 0.8, '#6a4a30', -1.8, 1.25, d / 2 + 1.0);
  ['#c0392b', '#2e86c1', '#f1c40f', '#27ae60', '#8e44ad'].forEach((c, i) => {
    const r = cyl(open, 0.1, 0.1, 0.75, c, -2.6 + i * 0.4, 1.4, d / 2 + 1.0, 8);
    r.rotation.x = Math.PI / 2;
  });
  g.userData.setOpen = (on) => { closed.visible = !on; open.visible = on; light.intensity = on ? 9 : 0; };
  g.userData.setOpen(false);
  [shell, closed].forEach(bake);
  g.userData.boxes = [[0, 0, w / 2 + 0.1, d / 2 + 0.1]];
  return g;
}

function clockTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  x.fillStyle = '#f6f0e0'; x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill();
  x.strokeStyle = '#2a2420'; x.lineWidth = 5; x.stroke();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; x.lineWidth = 3; x.beginPath(); x.moveTo(64 + Math.sin(a) * 48, 64 - Math.cos(a) * 48); x.lineTo(64 + Math.sin(a) * 56, 64 - Math.cos(a) * 56); x.stroke(); }
  x.lineWidth = 5; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + 24, 64 + 14); x.stroke();
  x.lineWidth = 3; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 - 8, 64 - 44); x.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function station({ name = 'VARGEM ALTA', rails = true, lit = false } = {}) {
  const g = new THREE.Group(), PL = 26, PD = 4, PH = 0.9;
  box(g, PL, PH, PD, '#9a8f80', 0, PH / 2, -PD / 2 - 1.5);
  box(g, PL, 0.12, 0.35, '#d8cdb8', 0, PH + 0.02, -1.6);
  const bx = 0, bz = -PD - 2.6;
  box(g, 10, 4, 5, '#efe2c4', bx, PH + 2, bz);
  box(g, 10.05, 0.9, 5.05, '#9a4a32', bx, PH + 0.45, bz);
  gableRoof(g, 10, 5, 1.6, PH + 4, '#8a3a2a', '#efe2c4', 0.4);
  const ov = box(g, 14, 0.14, 3.8, '#7a3426', bx, PH + 3.75, bz + 3.9);
  ov.rotation.x = 0.12;
  for (let i = -3; i <= 3; i++) cyl(g, 0.08, 0.08, 3.5, '#4a3a30', bx + i * 2.2, PH + 1.85, -2.4, 6);
  door(g, bx, bz + 2.53, { y: PH, w: 1.3, h: 2.5, c: '#4a6a7a' });
  for (const s of [-1, 1]) windowUnit(g, bx + s * 3, PH + 2, bz + 2.55, { w: 1.1, h: 1.6, shutter: '#4a6a7a', lit });
  const sg = signMesh([name], 5, 0.8, { size: 120, lit: lit ? 0.5 : 0.1 });
  sg.position.set(bx, PH + 3.25, bz + 2.62);
  g.add(sg);
  const ck = new THREE.Mesh(new THREE.CircleGeometry(0.35, 20), new THREE.MeshStandardMaterial({ map: clockTex(), roughness: 0.6 }));
  ck.material.userData.own = true;
  ck.position.set(bx + 2.2, PH + 3.25, bz + 2.63);
  g.add(ck);
  for (const s of [-1, 1]) {
    box(g, 1.8, 0.1, 0.5, '#6a4a30', bx + s * 5.5, PH + 0.5, -4.2);
    box(g, 1.8, 0.5, 0.08, '#6a4a30', bx + s * 5.5, PH + 0.8, -4.45);
  }
  const bell = mk(new THREE.ConeGeometry(0.16, 0.28, 10, 1, true), M('#c9a24a', { metalness: 0.6, roughness: 0.4 }), bx - 4, PH + 2.8, bz + 2.7, g);
  bell.castShadow = false;
  g.userData.boxes = [[bx, bz, 5.1, 2.6]];
  g.userData.surfaces = [[0, -PD / 2 - 1.5, PL / 2, PD / 2, PH]];
  return bake(g);
}

// --- ferrovia ---
export class Path {
  constructor(pts) {
    this.p = pts.map(([x, z]) => ({ x, z }));
    this.L = [0];
    for (let i = 1; i < this.p.length; i++) this.L.push(this.L[i - 1] + Math.hypot(this.p[i].x - this.p[i - 1].x, this.p[i].z - this.p[i - 1].z));
    this.len = this.L[this.L.length - 1];
  }
  at(s) {
    s = Math.max(0, Math.min(this.len, s));
    let i = 1;
    while (i < this.L.length - 1 && this.L[i] < s) i++;
    const a = this.p[i - 1], b = this.p[i], t = (s - this.L[i - 1]) / (this.L[i] - this.L[i - 1] || 1);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, ang: Math.atan2(-(b.z - a.z), b.x - a.x) };
  }
  nearest(x, z) {
    let best = 0, bd = 1e9;
    for (let s = 0; s <= this.len; s += 0.5) { const q = this.at(s), d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = s; } }
    return best;
  }
}
export function railway(W, pts, parent = W.group) {
  const path = new Path(pts), g = new THREE.Group();
  const n = Math.floor(path.len / 0.75), sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.14, 2.5), M('#4a3628'), n);
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const q = path.at(i * 0.75);
    o.position.set(q.x, W.heightAt(q.x, q.z) + 0.07, q.z);
    o.rotation.set(0, q.ang, 0);
    o.updateMatrix();
    sleepers.setMatrixAt(i, o.matrix);
  }
  sleepers.receiveShadow = true;
  g.add(sleepers);
  const rails = new THREE.Group();
  for (let i = 0; i < path.p.length - 1; i++) {
    const a = path.p[i], b = path.p[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z), ang = Math.atan2(-(b.z - a.z), b.x - a.x);
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, y = (W.heightAt(a.x, a.z) + W.heightAt(b.x, b.z)) / 2 + 0.2;
    for (const s of [-0.72, 0.72]) {
      const r = box(rails, len + 0.05, 0.12, 0.08, M('#5a5a60', { metalness: 0.6, roughness: 0.45 }), mx + Math.sin(ang) * s, y, mz + Math.cos(ang) * s);
      r.rotation.y = ang;
    }
  }
  g.add(bake(rails));
  parent.add(g);
  return path;
}

function wheel(p, r, x, z, c = '#8a1f18') {
  const w = cyl(p, r, r, 0.12, c, x, r, z, 14);
  w.rotation.x = Math.PI / 2;
  const hub = cyl(w, r * 0.25, r * 0.25, 0.16, '#2a2a2a', 0, 0, 0, 8);
  hub.castShadow = false;
  return w;
}
export function locomotive() {
  const g = new THREE.Group(), wheels = [];
  const black = M('#1e1e22', { metalness: 0.35, roughness: 0.55 }), brass = M('#c9a24a', { metalness: 0.7, roughness: 0.35 }), red = M('#8a1f18');
  box(g, 7.6, 0.35, 2.1, black, 0, 1.0, 0);
  const boiler = cyl(g, 0.78, 0.78, 4.6, black, 0.8, 2.0, 0, 16); boiler.rotation.z = Math.PI / 2;
  for (const x of [-0.6, 0.8, 2.2]) { const b = cyl(g, 0.8, 0.8, 0.1, brass, x, 2.0, 0, 16); b.rotation.z = Math.PI / 2; }
  const sb = cyl(g, 0.82, 0.82, 0.7, M('#2a2a2e'), 3.3, 2.0, 0, 16); sb.rotation.z = Math.PI / 2;
  cyl(g, 0.22, 0.3, 1.2, black, 3.1, 3.2, 0, 10);
  cyl(g, 0.42, 0.24, 0.4, black, 3.1, 3.9, 0, 10);
  mk(new THREE.SphereGeometry(0.36, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), brass, 1.2, 2.7, 0, g);
  box(g, 2.2, 2.1, 2.3, M('#6a1a16'), -2.3, 2.3, 0);
  box(g, 2.6, 0.14, 2.6, black, -2.3, 3.42, 0);
  for (const s of [-1, 1]) box(g, 0.9, 0.7, 0.06, M('#ffd590'), -2.0, 2.8, s * 1.16).material = glow('#ffcf80', 0.8);
  box(g, 0.3, 0.5, 2.3, red, 3.75, 1.1, 0);
  const lamp = cyl(g, 0.2, 0.2, 0.3, black, 3.6, 3.0, 0, 10); lamp.rotation.z = Math.PI / 2;
  mk(new THREE.CircleGeometry(0.15, 12), glow('#fff2c0', 3), 3.76, 3.0, 0, g, 0, Math.PI / 2, 0);
  const cc = mk(new THREE.ConeGeometry(0.9, 0.9, 4), red, 4.1, 0.55, 0, g, 0, Math.PI / 4, -Math.PI / 2);
  cc.scale.set(1, 0.6, 1.1);
  for (const s of [-1, 1]) {
    for (const x of [-1.5, -0.1, 1.3]) wheels.push(wheel(g, 0.62, x, s * 1.0));
    wheels.push(wheel(g, 0.4, 2.8, s * 1.0, '#2a2a2e'));
    const rod = box(g, 2.9, 0.08, 0.06, M('#9a9aa2', { metalness: 0.8, roughness: 0.3 }), -0.1, 0.62, s * 1.1);
    rod.userData.rod = true;
  }
  const smoke = particles({ count: 60, mode: 3, spread: [-3.5, 10, 1.5], color: '#4a4744', size: 1.6, rate: 0.12, opacity: 0.4, additive: false });
  smoke.position.set(3.1, 4.1, 0);
  g.add(smoke);
  g.userData.wheels = wheels;
  g.userData.smoke = smoke;
  return g;
}
export function wagon(type = 'open') {
  const g = new THREE.Group(), wheels = [];
  const wood = type === 'passenger' ? M('#2f5a3a') : M('#7a4a2e');
  box(g, 6.2, 0.3, 2.2, M('#1e1e22'), 0, 0.95, 0);
  if (type === 'open') {
    box(g, 6.2, 0.9, 0.12, wood, 0, 1.55, 1.05); box(g, 6.2, 0.9, 0.12, wood, 0, 1.55, -1.05);
    box(g, 0.12, 0.9, 2.2, wood, 3.05, 1.55, 0); box(g, 0.12, 0.9, 2.2, wood, -3.05, 1.55, 0);
  } else {
    box(g, 6.2, 2.2, 2.3, wood, 0, 2.2, 0);
    box(g, 6.6, 0.15, 2.6, M('#3a3a3a'), 0, 3.35, 0);
    if (type === 'passenger') for (let i = 0; i < 5; i++) for (const s of [-1, 1]) box(g, 0.7, 0.6, 0.05, glow('#ffd590', 0.9), -2.4 + i * 1.2, 2.5, s * 1.17);
    else box(g, 1.6, 1.8, 0.05, M('#5a3a24'), 0, 2.1, 1.17);
  }
  for (const s of [-1, 1]) for (const x of [-2.2, 2.2]) wheels.push(wheel(g, 0.42, x, s * 1.0, '#2a2a2e'));
  g.userData.wheels = wheels;
  return g;
}
// Composição: posiciona cada carro ao longo do trilho; s = posição da frente.
export function makeTrain(W, path, types = ['open'], parent = W.group) {
  const cars = [locomotive(), ...types.map(wagon)];
  const offs = [0, 6.9, ...types.map((_, i) => 6.9 + 6.8 * (i + 1))];
  cars.forEach((c) => parent.add(c));
  const lengthOffsets = cars.map((_, i) => (i === 0 ? 0 : offs[i]));
  const T = { cars, s: 0, speed: 0, dir: 1 };
  T.set = (s) => {
    T.s = s;
    cars.forEach((c, i) => {
      const q = path.at(s - lengthOffsets[i] * T.dir);
      c.position.set(q.x, W.heightAt(q.x, q.z) + 0.2, q.z);
      c.rotation.y = q.ang + (T.dir < 0 ? Math.PI : 0);
    });
  };
  T.update = (t, dt) => {
    if (T.speed) T.set(T.s + T.speed * dt * T.dir);
    for (const c of cars) for (const w of c.userData.wheels || []) w.rotation.y -= (T.speed * dt) / 0.6;
    cars[0].userData.smoke.material.uniforms.uRate.value = 0.08 + Math.abs(T.speed) * 0.05;
  };
  W.updates.push(T.update);
  return T;
}

// --- objetos pequenos ---
export function sack(c = '#b39b72') {
  const g = new THREE.Group();
  ball(g, 0.32, c, 0, 0.3, 0, [1, 1.15, 0.75], 1);
  cyl(g, 0.12, 0.16, 0.12, c, 0, 0.66, 0, 6);
  box(g, 0.5, 0.06, 0.02, '#6a4a2a', 0, 0.4, 0.24);
  return g;
}
export function barrel() {
  const g = new THREE.Group();
  const pts = [[0.26, 0], [0.33, 0.25], [0.34, 0.45], [0.26, 0.85]].map(([x, y]) => new THREE.Vector2(x, y));
  mk(new THREE.LatheGeometry(pts, 12), M('#8a5a34'), 0, 0, 0, g);
  for (const y of [0.15, 0.7]) { const t = mk(new THREE.TorusGeometry(0.31, 0.02, 4, 14), M('#3a3a3a'), 0, y, 0, g); t.rotation.x = Math.PI / 2; }
  return g;
}
export function crate(s = 0.6, c = '#9a7044') {
  const g = new THREE.Group();
  box(g, s, s, s, c, 0, s / 2, 0);
  box(g, s * 1.02, s * 0.12, s * 1.02, '#6a4a2a', 0, s / 2, 0);
  return g;
}
export function planks(n = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) box(g, 2.6, 0.08, 0.28, '#b88a5a', 0, 0.06 + i * 0.09, (i % 3) * 0.3 - 0.3, (i % 2) * 0.05);
  return g;
}
export function sapeBundle() {
  const g = new THREE.Group();
  const b = cyl(g, 0.16, 0.22, 1.5, '#c9a95e', 0, 0, 0, 8);
  b.rotation.z = Math.PI / 2;
  const t = cyl(g, 0.17, 0.17, 0.08, '#6a4a2a', 0, 0, 0, 8);
  t.rotation.z = Math.PI / 2;
  return g;
}
export function chest(c = '#6a4a30') {
  const g = new THREE.Group();
  box(g, 0.9, 0.5, 0.55, c, 0, 0.25, 0);
  const lid = cyl(g, 0.275, 0.275, 0.9, c, 0, 0.5, 0, 10);
  lid.rotation.z = Math.PI / 2;
  lid.scale.set(1, 1, 0.55);
  for (const x of [-0.3, 0.3]) box(g, 0.06, 0.55, 0.58, '#3a3a3a', x, 0.3, 0);
  return g;
}
export function cart(load = null) {
  const g = new THREE.Group();
  box(g, 2.6, 0.12, 1.4, '#8a6440', 0, 0.85, 0);
  for (const s of [-1, 1]) box(g, 2.6, 0.35, 0.06, '#7a5434', 0, 1.05, s * 0.68);
  for (const s of [-1, 1]) { const w = cyl(g, 0.7, 0.7, 0.12, '#6a4a30', 0, 0.7, s * 0.82, 12); w.rotation.x = Math.PI / 2; }
  const pole = cyl(g, 0.05, 0.06, 3, '#6a4a30', 2.6, 0.75, 0, 6);
  pole.rotation.z = Math.PI / 2 - 0.1;
  if (load === 'sacks') for (let i = 0; i < 4; i++) put(sack(), -0.8 + (i % 2) * 0.8, 0.95, i < 2 ? -0.3 : 0.3, g);
  if (load === 'planks') { const p = planks(6); p.position.y = 0.92; g.add(p); }
  g.userData.circles = [[0, 0, 1.3]];
  return g;
}
export function mule(load = true) {
  const g = new THREE.Group(), c = '#6a5646';
  const body = mk(new THREE.CapsuleGeometry(0.38, 1.0, 4, 10), M(c), 0, 1.25, 0, g, 0, 0, Math.PI / 2);
  body.scale.set(1, 1, 0.85);
  const legs = [];
  for (const x of [-0.55, 0.55]) for (const z of [-0.22, 0.22]) {
    const l = new THREE.Group();
    l.position.set(x, 1.0, z);
    cyl(l, 0.07, 0.06, 1.0, c, 0, -0.5, 0, 6);
    box(l, 0.11, 0.08, 0.13, '#2a2420', 0, -0.98, 0.01);
    g.add(l);
    legs.push(l);
  }
  const neck = cyl(g, 0.16, 0.24, 0.8, c, 0.85, 1.65, 0, 8);
  neck.rotation.z = -0.75;
  const head = box(g, 0.62, 0.3, 0.3, c, 1.25, 1.85, 0);
  head.rotation.z = -0.5;
  for (const s of [-1, 1]) mk(new THREE.ConeGeometry(0.06, 0.32, 5), M(c), 1.1, 2.15, s * 0.1, g, s * 0.2, 0, 0.2);
  const tail = cyl(g, 0.03, 0.06, 0.7, '#3a2e26', -0.95, 1.1, 0, 5);
  tail.rotation.z = 0.35;
  if (load) {
    for (const s of [-1, 1]) box(g, 0.7, 0.45, 0.25, '#7a5a3a', 0, 1.35, s * 0.42);
    const ch = chest('#5a4030');
    ch.scale.setScalar(0.75);
    ch.position.set(0, 1.55, 0);
    g.add(ch);
  }
  g.userData.dynamic = true;
  g.userData.legs = legs;
  g.userData.update = (t) => { tail.rotation.x = Math.sin(t * 1.3) * 0.25; head.rotation.y = Math.sin(t * 0.4) * 0.15; };
  g.userData.circles = [[0, 0, 0.9]];
  return g;
}
export function bench() {
  const g = new THREE.Group();
  box(g, 1.8, 0.08, 0.45, '#7a5434', 0, 0.48, 0);
  box(g, 1.8, 0.4, 0.06, '#7a5434', 0, 0.75, -0.22);
  for (const x of [-0.75, 0.75]) box(g, 0.08, 0.48, 0.4, '#3a3a3a', x, 0.24, 0);
  return g;
}
export function lantern(on = true) {
  const g = new THREE.Group();
  box(g, 0.16, 0.22, 0.16, '#3a2e26', 0, 0, 0);
  box(g, 0.12, 0.16, 0.12, on ? glow('#ffb35c', 3) : M('#5a4a3a'), 0, 0, 0);
  cyl(g, 0.02, 0.02, 0.12, '#3a2e26', 0, 0.16, 0, 4);
  return g;
}
export function streetLamp(old = false) {
  const g = new THREE.Group();
  cyl(g, 0.07, 0.1, 4, old ? '#2a2a2a' : '#3a3f45', 0, 2, 0, 8);
  box(g, 0.8, 0.06, 0.06, old ? '#2a2a2a' : '#3a3f45', 0.35, 3.95, 0);
  const l = mk(new THREE.SphereGeometry(0.2, 10, 8), glow('#ffd08a', 3), 0.7, 3.75, 0, g);
  l.castShadow = false;
  const pl = new THREE.PointLight('#ffc477', 10, 16, 1.6);
  pl.position.set(0.7, 3.6, 0);
  g.add(pl);
  g.userData.circles = [[0, 0, 0.2]];
  return g;
}
export function fence(W, pts, c = '#7a5a3a') {
  const g = new THREE.Group();
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 2.2));
    for (let k = 0; k <= n; k++) { const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n; cyl(g, 0.06, 0.07, 1.1, c, x, W.heightAt(x, z) + 0.5, z, 5); }
    const ang = Math.atan2(-(bz - az), bx - ax);
    for (const y of [0.45, 0.85]) { const r = box(g, len, 0.06, 0.05, c, (ax + bx) / 2, (W.heightAt(ax, az) + W.heightAt(bx, bz)) / 2 + y, (az + bz) / 2); r.rotation.y = ang; }
  }
  W.group.add(bake(g));
  return g;
}
export function marco(lines = ['VARGEM ALTA', 'Espírito Santo']) {
  const g = new THREE.Group();
  box(g, 1.6, 0.3, 1.6, '#8a8276', 0, 0.15, 0);
  box(g, 1.1, 1.6, 1.1, '#a8a092', 0, 1.1, 0);
  mk(new THREE.ConeGeometry(0.6, 0.6, 4), M('#9a9286'), 0, 2.2, 0, g, 0, Math.PI / 4, 0);
  const s = signMesh(lines, 0.95, 0.6, { size: 92, bg: '#3a3026', lit: 0.15 });
  s.position.set(0, 1.25, 0.56);
  g.add(s);
  g.userData.circles = [[0, 0, 0.95]];
  return g;
}
export function stump(h = 0.5) {
  const g = new THREE.Group();
  cyl(g, 0.3, 0.38, h, '#5a4030', 0, h / 2, 0, 7);
  cyl(g, 0.29, 0.29, 0.02, '#d8b88a', 0, h + 0.01, 0, 7);
  return g;
}
export function log(len = 3) {
  const l = cyl(null, 0.25, 0.28, len, '#5a4030', 0, 0.25, 0, 7);
  l.rotation.z = Math.PI / 2;
  const g = new THREE.Group();
  g.add(l);
  return g;
}
export function cutTree() {
  const g = new THREE.Group();
  cyl(g, 0.4, 0.5, 5, '#5a4030', 0, 2.5, 0, 7);
  box(g, 0.5, 0.35, 0.3, '#e0c49a', 0, 0.9, 0.38).rotation.y = 0.2;
  box(g, 0.3, 0.3, 0.25, '#e0c49a', 0.3, 1.6, 0.3).rotation.y = 0.8;
  return g;
}
