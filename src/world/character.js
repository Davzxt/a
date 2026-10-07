// Personagens estilizados (visual de animação): corpo contínuo com "pele" (SkinnedMesh) que dobra
// suavemente nos ombros, cotovelos, quadril e joelhos; rosto com olhos grandes e expressivos;
// cabelo em mechas volumosas; roupas com barras, golas e cintos. Tudo com cores por vértice numa
// ÚNICA malha por personagem (uma chamada de desenho). Animação procedural (andar, correr,
// conversar, carregar, tocar tambor, dançar, sentar, trabalhar...).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, patch } from '../core/engine.js';

const SPH = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const CAP = (r, l, seg = 8) => new THREE.CapsuleGeometry(r, l, 4, seg);
const TOR = (r, t, rs = 6, ts = 16, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc);
// Perfis sempre de baixo para cima: assim as faces e normais apontam para fora.
const LATHE = (pts, seg = 18, p0 = 0, pl = Math.PI * 2) => {
  const P = pts[0][1] > pts[pts.length - 1][1] ? pts.slice().reverse() : pts;
  return new THREE.LatheGeometry(P.map(([x, y]) => new THREE.Vector2(x, y)), seg, p0, pl);
};
const col = (c) => (c && c.isColor ? c.clone() : new THREE.Color(c));
const shade = (c, k) => col(c).multiplyScalar(k);
const tint = (c, to, k) => col(c).lerp(col(to), k);
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

let keffTex = null;
function keffiyeh() {
  if (keffTex) return keffTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const x = cv.getContext('2d');
  x.fillStyle = '#f2ece2'; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = '#b3242a'; x.lineWidth = 3;
  for (let i = -64; i < 128; i += 12) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke(); x.beginPath(); x.moveTo(i + 64, 0); x.lineTo(i, 64); x.stroke(); }
  x.fillStyle = '#b3242a'; x.fillRect(0, 56, 64, 8);
  keffTex = new THREE.CanvasTexture(cv); keffTex.colorSpace = THREE.SRGBColorSpace; keffTex.wrapS = keffTex.wrapT = THREE.RepeatWrapping;
  keffTex.repeat.set(3, 3);
  return keffTex;
}

// ---------------- esqueleto ----------------
const BONES = ['body', 'hips', 'thighL', 'kneeL', 'thighR', 'kneeR', 'spine', 'shL', 'elL', 'handL', 'shR', 'elR', 'handR', 'head'];
const I = Object.fromEntries(BONES.map((n, i) => [n, i]));
const HIP_Y = 0.93;

// pesos: [[osso, peso], ...] -> 4 índices + 4 pesos normalizados
function packW(list) {
  const m = new Map();
  for (const [b, w] of list) m.set(b, (m.get(b) || 0) + w);
  const arr = [...m].filter((e) => e[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const s = arr.reduce((a, e) => a + e[1], 0) || 1, idx = [0, 0, 0, 0], wt = [0, 0, 0, 0];
  arr.forEach((e, i) => { idx[i] = e[0]; wt[i] = e[1] / s; });
  return [idx, wt];
}
const mixW = (a, b, t) => [...a.map(([n, w]) => [n, w * (1 - t)]), ...b.map(([n, w]) => [n, w * t])];
const W1 = (b) => [[b, 1]];
const WB = (a, b, t) => [[a, 1 - t], [b, t]];

// Perfil de um tubo (anéis horizontais de cima para baixo): amostra em qualquer altura.
function sample(prof, y) {
  const n = prof.length;
  const norm = (p) => ({ y: p.y, rx: p.rx, rz: p.rz ?? p.rx, cx: p.cx || 0, cz: p.cz || 0, w: p.w });
  if (y >= prof[0].y) return norm(prof[0]);
  if (y <= prof[n - 1].y) return norm(prof[n - 1]);
  let i = 0;
  while (i < n - 2 && prof[i + 1].y > y) i++;
  const a = norm(prof[i]), b = norm(prof[i + 1]), t = (a.y - y) / (a.y - b.y);
  const L = (u, v) => u + (v - u) * t;
  return { y, rx: L(a.rx, b.rx), rz: L(a.rz, b.rz), cx: L(a.cx, b.cx), cz: L(a.cz, b.cz), w: mixW(a.w, b.w, t) };
}
// Gera os anéis com cor por altura (e ângulo) e "barras" nítidas (bainhas, punhos, cós).
function ringsOf(prof, colorAt, splits = []) {
  const ys = new Set(prof.map((p) => p.y));
  const special = new Map();
  for (const s of splits) {
    ys.add(s.y + 0.02); ys.add(s.y + 0.003); ys.add(s.y - 0.003);
    special.set(s.y + 0.003, { k: 1 + s.lip, at: s.y + 0.01, dark: s.dark ?? 0.88 });
    special.set(s.y - 0.003, { k: 1 - (s.inset ?? 0.02), at: s.y - 0.01 });
  }
  return [...ys].sort((a, b) => b - a).map((y) => {
    const r = sample(prof, y), sp = special.get(y);
    if (sp) { r.rx *= sp.k; r.rz *= sp.k; r.col = (th) => (sp.dark ? shade(colorAt(sp.at, th), sp.dark) : colorAt(sp.at, th)); }
    else r.col = (th) => colorAt(y, th);
    return r;
  });
}
// Tubo vertical a partir dos anéis: posições, cores, pesos de pele; tampas opcionais.
function tube(rings, seg = 16, { arc = null, capTop = true, capBot = true } = {}) {
  const closed = !arc, a0 = arc ? arc[0] : 0, al = arc ? arc[1] : Math.PI * 2, nc = closed ? seg : seg + 1;
  const pos = [], cl = [], si = [], sw = [], idx = [];
  const push = (x, y, z, c, w) => { pos.push(x, y, z); cl.push(c.r, c.g, c.b); const [a, b] = packW(w); si.push(...a); sw.push(...b); };
  for (const r of rings) for (let k = 0; k < nc; k++) {
    const th = a0 + (al * k) / seg;
    push(r.cx + r.rx * Math.sin(th), r.y, r.cz + r.rz * Math.cos(th), r.col(Math.atan2(Math.sin(th), Math.cos(th))), r.w);
  }
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < seg; k++) {
    const kn = closed ? (k + 1) % nc : k + 1, a = i * nc + k, b = i * nc + kn, c = (i + 1) * nc + k, d = (i + 1) * nc + kn;
    idx.push(a, c, b, b, c, d);
  }
  if (closed && capTop) { const r = rings[0], ci = pos.length / 3; push(r.cx, r.y + Math.min(r.rx, r.rz) * 0.3, r.cz, r.col(0), r.w); for (let k = 0; k < nc; k++) idx.push(ci, k, (k + 1) % nc); }
  if (closed && capBot) {
    const r = rings[rings.length - 1], ci = pos.length / 3, base = (rings.length - 1) * nc;
    push(r.cx, r.y - Math.min(r.rx, r.rz) * 0.3, r.cz, r.col(0), r.w);
    for (let k = 0; k < nc; k++) idx.push(ci, base + (k + 1) % nc, base + k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Junta peças (em espaço do modelo) numa geometria com pele.
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _v = new THREE.Vector3();
class Skin {
  constructor(rest) { this.rest = rest; this.parts = []; }
  add(geo, c, w) {
    const g = geo;
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count, p = g.attributes.position;
    if (!g.attributes.color) {
      const a = new Float32Array(n * 3), fixed = typeof c === 'function' ? null : col(c);
      for (let i = 0; i < n; i++) { const cc = fixed || c(_v.fromBufferAttribute(p, i)); a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    }
    if (!g.attributes.skinIndex) {
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      const fixed = typeof w === 'function' ? null : packW(w);
      for (let i = 0; i < n; i++) { const [a, b] = fixed || packW(w(_v.fromBufferAttribute(p, i))); si.set(a, i * 4); sw.set(b, i * 4); }
      g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    }
    this.parts.push(g);
    return g;
  }
  // Peça rígida presa a um osso: posição/rotação/escala locais ao osso (c pode ser função da posição local).
  rigid(bone, geo, c, pos = [0, 0, 0], rot = [0, 0, 0], scl = 1) {
    _m4.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...(typeof scl === 'number' ? [scl, scl, scl] : scl)));
    geo.applyMatrix4(_m4);
    if (typeof c === 'function') { const f = c; const p = geo.attributes.position, a = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const cc = f(_v.fromBufferAttribute(p, i)); a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
    geo.applyMatrix4(this.rest[bone]);
    return this.add(geo, c, W1(bone));
  }
  build() {
    const g = mergeGeometries(this.parts);
    this.parts.forEach((x) => x.dispose());
    // sombreado de contato "pintado": mais escuro perto do chão e nas faces voltadas para baixo
    const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const k = (0.84 + 0.16 * smooth(0.02, 0.85, p.getY(i))) * (1 - 0.14 * Math.max(0, -n.getY(i)));
      c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
    }
    return g;
  }
}

let CHAR_MAT = null;
const charMat = () => CHAR_MAT || (CHAR_MAT = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }), 0, 0.85));

let BLOB = null;
function blobShadow() {
  if (!BLOB) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(cv);
    BLOB = {
      geo: new THREE.PlaneGeometry(0.95, 0.95).rotateX(-Math.PI / 2),
      mat: new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true }),
    };
    BLOB.geo.userData.shared = true;
  }
  const m = new THREE.Mesh(BLOB.geo, BLOB.mat);
  m.position.y = 0.025;
  m.renderOrder = 1;
  return m;
}

// Cabeça estilizada: crânio arredondado, mandíbula mais estreita, rosto levemente achatado.
const HC = [0, 0.138, 0.006], HR = 0.15;
function headShape(x, y, z) {
  if (y < 0) y *= 0.88;
  if (y < 0.12) { const t = (0.12 - y) / 1.12; x *= 1 - 0.3 * t * t; z *= 1 - 0.06 * t; }
  if (y < -0.25 && z > 0) z += (-0.25 - y) * 0.16 * z;
  if (z < 0) z *= 1.06;
  if (z > 0.55) z = 0.55 + (z - 0.55) * 0.68;
  return [x * 0.95 * HR + HC[0], y * 1.07 * HR + HC[1], z * HR + HC[2]];
}
function headGeo() {
  const g = new THREE.SphereGeometry(1, 30, 22), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, ...headShape(p.getX(i), p.getY(i), p.getZ(i)));
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}
// Ponto da superfície frontal do rosto (coordenadas unitárias), afastado "out" para fora.
const face = (xu, yu, out = 0) => { const [x, y, z] = headShape(xu, yu, Math.sqrt(Math.max(0, 1 - xu * xu - yu * yu))); return [x, y, z + out]; };

const POSE = { bodyY: 0, hipsY: 0, spineX: 0, spineY: 0, spineZ: 0, headX: 0, headY: 0, lsx: 0, lsz: 0.1, rsx: 0, rsz: -0.1, lex: -0.18, rex: -0.18, ltx: 0, rtx: 0, lkx: 0, rkx: 0 };

export class Character {
  constructor(spec = {}) {
    const s = (this.spec = {
      skin: '#8a5a3c', hair: '#16110d', hairStyle: 'short', top: '#e9e1cf', topType: 'shirt', sleeves: 'long',
      bottom: '#5d4b3a', bottomType: 'pants', shoes: '#3b2a1e', barefoot: false, hat: null, hatColor: '#c9a35b',
      beard: null, scale: 1, build: 1, stoop: 0, child: false, eyes: '#3a2414', ...spec,
    });
    this.root = new THREE.Group();
    this.seed = Math.random() * 10;
    this.phase = 0; this.moveSpeed = 0; this.anim = 'idle'; this.lookAt = null; this.blink = 2 + Math.random() * 3;
    this.cur = { ...POSE }; this.tgt = { ...POSE };
    const b = s.build, fem = s.fem ?? (s.bottomType === 'dress' || s.bottomType === 'skirt');
    const skin = col(s.skin), hair = col(s.hair), top = col(s.top), bot = col(s.bottom);
    const pants = s.bottomType === 'pants' || s.bottomType === 'rolled', bare = s.topType === 'none', wrap = s.topType === 'wrap';
    const shoulderX = (fem ? 0.19 : 0.205) * b;

    // ----- ossos (pose de descanso) -----
    const bones = BONES.map((n) => { const o = new THREE.Bone(); o.name = n; return o; });
    const at = (n, parent, x, y, z) => { bones[I[n]].position.set(x, y, z); if (parent) bones[I[parent]].add(bones[I[n]]); };
    at('body', null, 0, 0, 0);
    at('hips', 'body', 0, HIP_Y, 0);
    at('thighL', 'hips', 0.095 * b, -0.02, 0); at('kneeL', 'thighL', 0, -0.44, 0);
    at('thighR', 'hips', -0.095 * b, -0.02, 0); at('kneeR', 'thighR', 0, -0.44, 0);
    at('spine', 'hips', 0, 0, 0);
    at('shL', 'spine', shoulderX, 0.45, 0); at('elL', 'shL', 0, -0.29, 0); at('handL', 'elL', 0, -0.27, 0);
    at('shR', 'spine', -shoulderX, 0.45, 0); at('elR', 'shR', 0, -0.29, 0); at('handR', 'elR', 0, -0.27, 0);
    at('head', 'spine', 0, 0.6, 0);
    bones[0].updateMatrixWorld(true);
    const rest = bones.map((o) => o.matrixWorld.clone());
    const S = new Skin(rest);

    // ----- tronco -----
    const sw = fem ? 0.93 : 1, hw = fem ? 1.07 : 1, bust = fem ? 0.014 : 0, bag = s.baggy ? 1.06 : 1;
    const TORSO = [
      { y: 1.63, rx: 0.044, w: W1(I.head) },
      { y: 1.555, rx: 0.05, rz: 0.053, w: WB(I.spine, I.head, 0.5) },
      { y: 1.5, rx: 0.056, rz: 0.057, w: W1(I.spine) },
      { y: 1.482, rx: 0.098 * sw * b, rz: 0.078, w: W1(I.spine) },
      { y: 1.448, rx: 0.15 * sw * b, rz: 0.098, w: W1(I.spine) },
      { y: 1.395, rx: 0.172 * sw * b, rz: 0.11, w: W1(I.spine) },
      { y: 1.32, rx: 0.168 * sw * b, rz: 0.118 + bust, cz: bust * 0.8, w: W1(I.spine) },
      { y: 1.24, rx: 0.163 * b, rz: 0.12 + bust, cz: bust, w: W1(I.spine) },
      { y: 1.15, rx: 0.152 * b, rz: 0.112, w: W1(I.spine) },
      { y: 1.06, rx: (fem ? 0.134 : 0.146) * b, rz: 0.105, w: WB(I.spine, I.hips, 0.35) },
      { y: 1.0, rx: 0.152 * b * hw * bag, rz: 0.108 * bag, w: WB(I.spine, I.hips, 0.75) },
      { y: 0.93, rx: 0.16 * b * hw * bag, rz: 0.108 * bag, cz: -0.006, w: W1(I.hips) },
      { y: 0.875, rx: 0.13 * b * hw * bag, rz: 0.085 * bag, cz: -0.012, w: W1(I.hips) },
      { y: 0.845, rx: 0.06 * b, rz: 0.05, w: W1(I.hips) },
    ];
    const WAIST = 1.0, NECK = 1.488;
    const topCol = bare || wrap ? skin : top;
    const lowCol = pants ? bot : s.bottomType === 'fiber' ? skin : fem ? top : skin;
    const shirtLike = !bare && !wrap;
    const torsoCol = (y, th) => {
      if (y > NECK) return skin;
      if (shirtLike && y > 1.415 && Math.abs(th) < 0.42 - (NECK - y) * 3) return skin; // gola aberta em V
      return y > WAIST ? topCol : lowCol;
    };
    const tsplits = [];
    if (shirtLike) tsplits.push({ y: NECK, lip: 0.06 });
    if (pants || (shirtLike && !fem)) tsplits.push({ y: WAIST, lip: 0.05, dark: 0.8 });
    S.add(tube(ringsOf(TORSO, torsoCol, tsplits), 22));
    const tz = (y, th = 0) => { const r = sample(TORSO, y); return [r.cx + r.rx * Math.sin(th), y, r.cz + r.rz * Math.cos(th)]; };
    const band = (y0, y1, extra, c, lip = 0.04, arc = null) => {
      const prof = [y0 + 0.001, y1].map((y) => { const r = sample(TORSO, y); return { ...r, rx: r.rx + extra, rz: r.rz + extra }; });
      S.add(tube(ringsOf(prof, () => col(c), lip ? [{ y: y1 + 0.002, lip, dark: 0.85 }] : []), 22, { arc, capTop: false, capBot: false }));
    };

    // ----- braços -----
    const sy = HIP_Y + 0.45, EL = sy - 0.29, WR = EL - 0.25;
    const sleeve = bare || wrap || s.sleeves === 'none' ? skin : col(s.coat || s.top);
    const longS = shirtLike && s.sleeves === 'long', shortS = shirtLike && s.sleeves === 'short';
    const ab = (longS && s.baggy ? 1.12 : 1) * (0.94 + 0.06 * b);
    this.arms = [1, -1].map((side) => {
      const sh = bones[I[side > 0 ? 'shL' : 'shR']], el = bones[I[side > 0 ? 'elL' : 'elR']], hand = bones[I[side > 0 ? 'handL' : 'handR']];
      const x = side * shoulderX, bsh = I[side > 0 ? 'shL' : 'shR'], bel = I[side > 0 ? 'elL' : 'elR'];
      const prof = [
        { y: sy + 0.04, rx: 0.034, cx: x - side * 0.055, w: W1(I.spine) },
        { y: sy + 0.012, rx: 0.054 * ab, cx: x - side * 0.016, w: WB(I.spine, bsh, 0.5) },
        { y: sy - 0.04, rx: 0.061 * ab, cx: x, w: WB(I.spine, bsh, 0.88) },
        { y: sy - 0.13, rx: 0.058 * ab, rz: 0.056 * ab, cx: x, w: W1(bsh) },
        { y: EL + 0.06, rx: 0.049 * ab, cx: x, w: W1(bsh) },
        { y: EL + 0.015, rx: 0.046 * ab, cx: x, w: WB(bsh, bel, 0.4) },
        { y: EL - 0.025, rx: 0.046 * ab, cx: x, cz: -0.004, w: WB(bsh, bel, 0.8) },
        { y: EL - 0.09, rx: 0.047 * ab, rz: 0.044 * ab, cx: x, w: W1(bel) },
        { y: WR + 0.05, rx: 0.036 * ab, cx: x, w: W1(bel) },
        { y: WR - 0.02, rx: 0.031, cx: x, w: W1(bel) },
      ];
      const end = longS ? WR + 0.035 : shortS ? sy - 0.125 : null;
      const ac = (y) => (end !== null && y > end ? sleeve : skin);
      S.add(tube(ringsOf(prof, ac, end !== null ? [{ y: end, lip: longS ? 0.12 : 0.2 }] : []), 14));
      if (s.bands) { S.rigid(bsh, TOR(0.06, 0.013, 5, 14), s.bands, [0, -0.1, 0], [Math.PI / 2, 0, 0]); S.rigid(bel, TOR(0.047, 0.012, 5, 14), s.bands, [0, -0.2, 0], [Math.PI / 2, 0, 0]); }
      if (s.paint === 'puri' && bare) for (const y of [-0.16, -0.19]) S.rigid(bsh, TOR(0.059, 0.005, 4, 14), '#b0301e', [0, y, 0], [Math.PI / 2, 0, 0]);
      // mão: palma achatada, dedos juntos e polegar (palma voltada para a coxa)
      const hb = I[side > 0 ? 'handL' : 'handR'];
      S.rigid(hb, SPH(1, 14, 10), skin, [0, -0.034, 0.004], [0, 0, 0], [0.03, 0.05, 0.045]);
      S.rigid(hb, SPH(1, 12, 9), skin, [side * 0.003, -0.084, 0.008], [0.12, 0, side * 0.12], [0.027, 0.045, 0.042]);
      S.rigid(hb, CAP(0.015, 0.034, 6), skin, [-side * 0.014, -0.034, 0.04], [-0.75, 0, 0]);
      let cuff = null;
      if (s.cuffs) {
        cuff = new THREE.Mesh(TOR(0.041, 0.012, 6, 14), M('#4a4a50', { metalness: 0.6, roughness: 0.4 }));
        cuff.position.y = -0.21; cuff.rotation.x = Math.PI / 2; cuff.castShadow = true;
        el.add(cuff);
      }
      return { sh, el, hand, cuff };
    });

    // ----- pernas -----
    const LEG_T = HIP_Y - 0.02, KN = LEG_T - 0.44, AN = KN - 0.38;
    const baggy = s.baggy && pants;
    this.legs = [1, -1].map((side) => {
      const thigh = bones[I[side > 0 ? 'thighL' : 'thighR']], knee = bones[I[side > 0 ? 'kneeL' : 'kneeR']];
      const bt = I[side > 0 ? 'thighL' : 'thighR'], bk = I[side > 0 ? 'kneeL' : 'kneeR'], x = side * 0.095 * b;
      const p1 = (pants ? (baggy ? 1.32 : 1.06) : 1) * b, p2 = (s.bottomType === 'pants' ? (baggy ? 1.38 : 1.08) : 1) * b;
      const prof = [
        { y: LEG_T + 0.1, rx: 0.07 * p1, cx: x * 0.8, w: W1(I.hips) },
        { y: LEG_T + 0.02, rx: 0.086 * p1, cx: x, w: WB(I.hips, bt, 0.45) },
        { y: LEG_T - 0.06, rx: 0.088 * p1, rz: 0.086 * p1, cx: x, w: W1(bt) },
        { y: LEG_T - 0.2, rx: 0.079 * p1, cx: x, w: W1(bt) },
        { y: KN + 0.1, rx: 0.066 * p1, cx: x, w: W1(bt) },
        { y: KN + 0.03, rx: 0.062 * p2, cx: x, cz: 0.004, w: WB(bt, bk, 0.3) },
        { y: KN - 0.02, rx: 0.06 * p2, cx: x, cz: 0.004, w: WB(bt, bk, 0.72) },
        { y: KN - 0.09, rx: 0.061 * p2, cx: x, cz: -0.006, w: W1(bk) },
        { y: KN - 0.17, rx: 0.058 * p2, cx: x, cz: -0.01, w: W1(bk) },
        { y: KN - 0.28, rx: (baggy ? 0.06 : 0.047) * b, cx: x, w: W1(bk) },
        { y: AN + 0.03, rx: (baggy ? 0.048 : 0.041) * b, cx: x, w: W1(bk) },
        { y: AN - 0.05, rx: 0.04 * b, cx: x, w: W1(bk) },
      ];
      const end = s.bottomType === 'pants' ? AN + 0.04 : s.bottomType === 'rolled' ? KN - 0.09 : null;
      const lc = (y) => (end !== null && y > end ? bot : skin);
      S.add(tube(ringsOf(prof, lc, end !== null ? [{ y: end, lip: s.bottomType === 'rolled' ? 0.22 : 0.08 }] : []), 16));
      if (s.bands) for (const y of [-0.36, -0.385]) S.rigid(bk, TOR(0.047, 0.01, 5, 12), s.bands, [0, y, 0], [Math.PI / 2, 0, 0]);
      // pés: botina arredondada ou pé descalço
      if (!s.barefoot) {
        const sc = col(s.shoes);
        S.rigid(bk, SPH(1, 16, 10), sc, [0, -0.425, 0.05], [0, 0, 0], [0.058, 0.048, 0.105]);
        S.rigid(bk, SPH(1, 14, 10), sc, [0, -0.405, -0.012], [0, 0, 0], [0.055, 0.062, 0.068]);
        S.rigid(bk, new THREE.CylinderGeometry(0.05, 0.054, 0.07, 14), shade(sc, 1.08), [0, -0.36, -0.004]);
        S.rigid(bk, SPH(1, 16, 6), shade(sc, 0.42), [0, -0.464, 0.035], [0, 0, 0], [0.064, 0.013, 0.13]);
      } else {
        S.rigid(bk, SPH(1, 14, 10), skin, [0, -0.445, 0.04], [0, 0, 0], [0.05, 0.032, 0.1]);
        for (let t = 0; t < 4; t++) S.rigid(bk, SPH(0.0125 - t * 0.0012, 6, 5), shade(skin, 0.97), [(t - 1.2) * 0.019 * -side, -0.455, 0.128 - t * 0.006]);
      }
      return { thigh, knee };
    });

    // ----- roupas sobre o corpo -----
    if (s.bottomType === 'dress' || s.bottomType === 'skirt') {
      const R = s.bottomType === 'dress' ? 0.36 : 0.32;
      const prof = [{ y: 1.06, rx: 0.15 * b, rz: 0.115, w: W1(I.hips) }, { y: 0.95, rx: 0.175 * b, rz: 0.135, w: W1(I.hips) }, { y: 0.72, rx: 0.235, rz: 0.2, w: W1(I.hips) }, { y: 0.42, rx: R * 0.92, rz: R * 0.82, w: W1(I.hips) }, { y: 0.2, rx: R, rz: R * 0.9, w: W1(I.hips) }];
      const sk = tube(ringsOf(prof, (y) => (y < 0.27 ? shade(bot, 0.78) : bot), [{ y: 0.27, lip: 0.02, dark: 1 }, { y: 0.21, lip: 0.04, dark: 0.7 }]), 26, { capTop: false, capBot: false });
      // a frente da saia acompanha as coxas (balança ao andar e cobre o colo ao sentar)
      const sp = sk.attributes.position, si = sk.attributes.skinIndex, swt = sk.attributes.skinWeight;
      for (let i = 0; i < sp.count; i++) {
        const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i), f = smooth(-0.1, 0.12, z);
        const tk = f * smooth(0.62, 0.42, y), tt = f * smooth(0.98, 0.62, y) - tk;
        si.setXYZW(i, I.hips, x > 0 ? I.thighL : I.thighR, x > 0 ? I.kneeL : I.kneeR, 0); swt.setXYZW(i, 1 - tt - tk, tt, tk, 0);
      }
      S.add(sk);
      if (s.apron) {
        const ap = prof.map((p) => ({ ...p, rx: p.rx + 0.012, rz: p.rz + 0.012 })).filter((p) => p.y > 0.4);
        S.add(tube(ringsOf(ap, () => col(s.apron), [{ y: 0.44, lip: 0.02, dark: 0.85 }]), 10, { arc: [-0.7, 1.4], capTop: false, capBot: false }));
      }
      band(1.08, 1.0, 0.012, shade(top, 0.8), 0.03);
    }
    if (s.bottomType === 'fiber') {
      const n = 30;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, len = 0.34 + ((i * 7) % 5) * 0.025, c = tint(s.bottom, '#6a5030', ((i * 3) % 4) * 0.08);
        const [x, , z] = tz(0.96, a);
        const g = new THREE.BoxGeometry(0.048, len, 0.012);
        g.translate(0, -len / 2, 0);
        _m4.compose(_p.set(x * 1.05, 0.98, z * 1.05), _q.setFromEuler(_e.set(-0.2, a, 0, 'YXZ')), _s.set(1, 1, 1));
        _e.order = 'XYZ';
        g.applyMatrix4(_m4);
        S.add(g, c, W1(I.hips));
      }
    }
    if (s.belt) band(1.025, 0.985, 0.01, s.belt, 0.06);
    if (s.sash) band(1.09, 0.96, 0.016, s.sash, 0.05);
    if (s.waistband) band(1.0, 0.95, 0.014, s.waistband, 0.05);
    if (wrap) {
      band(1.36, 1.2, 0.012, top, 0.05);
      const g = new THREE.BoxGeometry(0.05, 0.34, 0.012).rotateZ(-0.55);
      S.add(g.translate(0.07, 1.36, 0.118), shade(top, 0.85), W1(I.spine));
    }
    if (s.paint === 'puri' && bare) for (const y of [1.25, 1.28]) band(y + 0.006, y - 0.006, 0.003, '#b0301e', 0, [-1.0, 2.0]);
    if (s.vest) {
      const vp = [1.44, 1.385, 1.32, 1.24, 1.15, 1.06, 0.98].map((y) => { const r = sample(TORSO, y); return { ...r, rx: r.rx + 0.012, rz: r.rz + 0.014 }; });
      vp[0].rx *= 0.86; vp[0].rz *= 0.9;
      S.add(tube(ringsOf(vp, () => col(s.vest), [{ y: 0.995, lip: 0.04, dark: 0.8 }]), 22, { arc: [0.36, Math.PI * 2 - 0.72], capTop: false, capBot: false }));
      for (let i = 0; i < 4; i++) { const [x, y, z] = tz(1.3 - i * 0.08, 0.4); S.add(SPH(0.009, 6, 5).translate(x + 0.004, y, z + 0.015), '#c9a24a', W1(I.spine)); }
    }
    if (shirtLike) {
      // botões (quando não há colete por cima)
      if (!s.vest && !fem) for (let i = 0; i < 3; i++) { const [x, y, z] = tz(1.36 - i * 0.11); S.add(SPH(0.0085, 6, 5).translate(x, y, z + 0.004), shade(topCol, 0.72), W1(I.spine)); }
    }
    if (s.suspenders) for (const sd of [-1, 1]) for (const fz of [1, -1]) {
      const [x, , z] = tz(1.2, (fz > 0 ? 0 : Math.PI) + sd * 0.42 * fz);
      S.add(new THREE.BoxGeometry(0.026, 0.42, 0.012).translate(x, 1.2, z + fz * 0.006), s.suspenders, W1(I.spine));
    }
    if (s.satchel) {
      const strap = new THREE.BoxGeometry(0.03, 0.64, 0.014).rotateZ(0.62);
      S.add(strap.translate(0, 1.22, tz(1.22)[2] + 0.012), s.satchel, W1(I.spine));
      S.add(new THREE.BoxGeometry(0.08, 0.22, 0.24).translate(-0.205 * b, 0.95, 0.02), s.satchel, W1(I.hips));
      S.add(new THREE.BoxGeometry(0.085, 0.09, 0.245).translate(-0.205 * b, 1.02, 0.02), shade(s.satchel, 0.8), W1(I.hips));
    }
    if (s.scarfNeck) S.add(TOR(0.068, 0.024, 6, 14).rotateX(Math.PI / 2).translate(0, 1.47, 0.01), s.scarfNeck, W1(I.spine));
    if (s.necklace) {
      // contas que acompanham o peito (caem mais na frente)
      const n = 17;
      for (let k = 0; k < n; k++) {
        const th = -1.25 + (k / (n - 1)) * 2.5, y = 1.465 - 0.06 * Math.cos(th);
        const [x, , z] = tz(y, th), o = 1 + 0.012 / Math.hypot(x, z);
        if (s.necklace === 'teeth' && k % 3 === 1) S.add(new THREE.ConeGeometry(0.011, 0.05, 6).rotateX(Math.PI).translate(x * o, y - 0.028, z * o + 0.004), '#f1ead8', W1(I.spine));
        else S.add(SPH(k % 2 ? 0.012 : 0.015, 7, 5).translate(x * o, y, z * o), k % 4 === 1 ? '#b8231c' : k % 4 === 3 ? '#e0b040' : '#3a2416', W1(I.spine));
      }
    }

    // ----- cabeça e rosto -----
    const H = I.head, dark = shade(hair, 0.55), browC = s.hairStyle === 'bald' || s.hairStyle === 'scarf' ? shade(skin, 0.45) : shade(hair, 0.9);
    S.rigid(H, headGeo(), skin);
    for (const sd of [-1, 1]) {
      // orelhas
      S.rigid(H, SPH(1, 10, 8), skin, [sd * 0.141, HC[1] - 0.012, HC[2] - 0.012], [0, 0, sd * 0.12], [0.019, 0.036, 0.027]);
      S.rigid(H, SPH(1, 8, 6), shade(skin, 0.78), [sd * 0.155, HC[1] - 0.012, HC[2] - 0.01], [0, 0, 0], [0.006, 0.023, 0.015]);
      // olhos grandes: branco, íris colorida, pupila, brilho e linha dos cílios
      const [ex, ey, ez] = face(sd * 0.34, 0.05);
      S.rigid(H, SPH(1, 16, 12), '#f7f3ec', [ex, ey, ez - 0.008], [0, -sd * 0.2, 0], [0.026, 0.03, 0.018]);
      S.rigid(H, SPH(1, 14, 10), s.eyes, [ex - sd * 0.002, ey - 0.001, ez + 0.005], [0, -sd * 0.15, 0], [0.0175, 0.02, 0.009]);
      S.rigid(H, SPH(1, 10, 8), '#0b0806', [ex - sd * 0.002, ey - 0.001, ez + 0.0105], [0, 0, 0], [0.009, 0.0105, 0.005]);
      S.rigid(H, SPH(0.005, 6, 5), '#ffffff', [ex - sd * 0.002 + 0.006, ey + 0.008, ez + 0.0155]);
      S.rigid(H, SPH(0.0025, 5, 4), '#ffffff', [ex - sd * 0.002 - 0.005, ey - 0.007, ez + 0.0145]);
      // pálpebra superior (olhar tranquilo) com a linha dos cílios
      S.rigid(H, new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.36), shade(skin, 0.93), [ex, ey + 0.001, ez - 0.008], [0.18, -sd * 0.2, -sd * 0.08], [0.0285, 0.033, 0.0205]);
      S.rigid(H, TOR(0.028, fem ? 0.0048 : 0.0036, 4, 12, Math.PI * 0.72), dark, [ex, ey + 0.002, ez + 0.006], [0, -sd * 0.2, Math.PI * 0.14 - sd * 0.08], [1, 0.82, 1]);
      if (fem) S.rigid(H, CAP(0.0038, 0.012, 4), dark, [ex + sd * 0.028, ey + 0.012, ez + 0.002], [0, 0, -sd * 1.05]);
      // sobrancelhas em arco, tranquilas
      const [bx, by, bz] = face(sd * 0.33, 0.27, 0.003);
      S.rigid(H, TOR(0.034, fem ? 0.005 : 0.0068, 4, 10, Math.PI * 0.42), browC, [bx, by - 0.026, bz - 0.008], [0.1, -sd * 0.25, Math.PI * 0.29 + sd * 0.05], [1, 0.9, 1]);
      // bochechas rosadas
      const [cx, cy, cz] = face(sd * 0.55, -0.13, -0.006);
      S.rigid(H, SPH(1, 10, 8), tint(skin, '#e0605a', 0.2), [cx, cy, cz], [0, sd * 0.5, 0], [0.026, 0.018, 0.01]);
      if (s.paint === 'puri') for (let k = 0; k < 2; k++) { const [px, py, pz] = face(sd * 0.55, -0.02 - k * 0.14, 0.001); S.rigid(H, new THREE.BoxGeometry(0.044, 0.01, 0.006), '#c4281a', [px, py, pz], [0, sd * 0.55, 0]); }
    }
    // nariz e boca
    const [nx, ny, nz] = face(0, -0.1, 0.012);
    S.rigid(H, SPH(1, 12, 10), tint(skin, '#c0605a', 0.08), [nx, ny, nz], [0, 0, 0], [0.022, 0.019, 0.02]);
    S.rigid(H, CAP(0.011, 0.04, 6), skin, [nx, ny + 0.03, nz - 0.01], [-0.35, 0, 0]);
    const [mx, my, mz] = face(0, -0.36, 0.002);
    S.rigid(H, TOR(0.022, 0.0052, 5, 12, Math.PI), '#6a2a24', [mx, my, mz], [0, 0, Math.PI], [1, 0.7, 0.6]);
    S.rigid(H, SPH(1, 10, 6), tint(skin, '#b04848', 0.3), [mx, my - 0.016, mz - 0.004], [0, 0, 0], [0.016, 0.007, 0.008]);
    // pálpebras (só aparecem ao piscar): malha própria presa ao osso da cabeça
    {
      const lg = [];
      for (const sd of [-1, 1]) { const [ex, ey, ez] = face(sd * 0.34, 0.05); lg.push(SPH(1, 12, 8).scale(0.029, 0.034, 0.021).translate(ex, ey, ez - 0.006)); }
      this.lids = new THREE.Mesh(mergeGeometries(lg), M(s.skin, { roughness: 0.6 }));
      this.lids.visible = false;
      bones[H].add(this.lids);
    }

    // ----- cabelo (mechas) -----
    const hs = s.keffiyeh ? 'bald' : s.hairStyle;
    const hcol = (v) => tint(hair, shade(hair, 1.5).lerp(new THREE.Color('#a08060'), 0.12), smooth(0.2, 0.32, v.y) * 0.45).multiplyScalar(0.9 + 0.1 * Math.sin(v.x * 90 + v.z * 70));
    // calota de cabelo que acompanha o formato da cabeça (r = quanto fica acima do couro)
    const capG = (r, th, tilt) => {
      const g = new THREE.SphereGeometry(1, 26, 14, 0, Math.PI * 2, 0, th).rotateX(tilt), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const [x, y, z] = headShape(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, HC[0] + (x - HC[0]) * r, HC[1] + (y - HC[1]) * r + 0.003, HC[2] + (z - HC[2]) * r); }
      g.deleteAttribute('normal'); g.computeVertexNormals();
      return g;
    };
    const clump = (pos, scl, rot = [0, 0, 0]) => S.rigid(H, SPH(1, 10, 8), hcol, pos, rot, scl);
    if (hs === 'short' || hs === 'long' || hs === 'bun' || hs === 'braid') {
      S.rigid(H, capG(1.07, Math.PI * 0.5, -0.62), hcol);
      S.rigid(H, capG(1.055, Math.PI * 0.6, -1.0), hcol);
      if (hs === 'short' && !s.hat) {
        // franja em mechas e volume no topo
        for (let k = -2; k <= 2; k++) { const [x, y, z] = face(k * 0.2, 0.66, -0.004); clump([x, y + 0.006, z], [0.042, 0.03, 0.036], [0.3, 0, k * 0.22 + 0.3]); }
        clump([0.02, HC[1] + HR * 1.0, HC[2] + 0.01], [0.1, 0.045, 0.11], [0, 0, 0.12]);
        for (const sd of [-1, 1]) clump([sd * 0.125, HC[1] + 0.04, HC[2] + 0.005], [0.022, 0.05, 0.05]);
      }
    }
    if (hs === 'curly') {
      S.rigid(H, capG(1.04, Math.PI * 0.5, -0.6), shade(hair, 0.8));
      S.rigid(H, capG(1.03, Math.PI * 0.6, -1.0), shade(hair, 0.8));
      const n = 34;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, phi = Math.acos(1 - t * 1.35), th = i * 2.399;
        const ux = Math.sin(phi) * Math.cos(th), uz = Math.sin(phi) * Math.sin(th), uy = Math.cos(phi);
        if (uz > 0.45 && uy < 0.5) continue;
        if (s.hat && uy > 0.3) continue;
        const r = 0.032 + ((i * 7) % 5) * 0.003;
        S.rigid(H, new THREE.IcosahedronGeometry(r, 1), shade(hair, 0.85 + ((i * 3) % 4) * 0.09), [HC[0] + ux * HR * 1.02, HC[1] + 0.012 + uy * HR * 1.03, HC[2] + uz * HR * 1.02 - 0.008]);
      }
    }
    if (hs === 'long') {
      clump([0, HC[1] - 0.04, HC[2] - 0.085], [0.13, 0.2, 0.075], [0.15, 0, 0]);
      clump([0, HC[1] - 0.17, HC[2] - 0.075], [0.11, 0.13, 0.06], [0.25, 0, 0]);
      for (const sd of [-1, 1]) {
        S.rigid(H, CAP(0.034, 0.2, 8), hcol, [sd * 0.122, HC[1] - 0.09, HC[2] - 0.02], [0.08, 0, sd * 0.1]);
        const [x, y, z] = face(sd * 0.22, 0.62, -0.004); clump([x, y, z], [0.07, 0.03, 0.04], [0.25, 0, -sd * 0.45]);
      }
    }
    if (hs === 'bun') { clump([0, HC[1] + 0.07, HC[2] - 0.13], [0.064, 0.06, 0.06]); S.rigid(H, TOR(0.05, 0.008, 5, 14), '#b8402e', [0, HC[1] + 0.055, HC[2] - 0.115], [0.7, 0, 0]); }
    if (hs === 'braid') {
      for (let i = 0; i < 6; i++) clump([0, HC[1] - 0.09 - i * 0.055, HC[2] - 0.13 - i * 0.006], [0.034 - i * 0.002, 0.036, 0.032], [0, i * 0.6, 0]);
      S.rigid(H, SPH(0.015, 6, 4), '#b8402e', [0, HC[1] - 0.43, HC[2] - 0.17]);
    }
    if (hs === 'scarf') {
      const sc = col(s.scarf || '#c0472f');
      // turbante: calota + volume enrolado no alto + nó na frente + pontas atrás
      const scol = (v) => shade(sc, 0.86 + 0.18 * (0.5 + 0.5 * Math.sin(v.y * 95 + v.x * 30)));
      S.rigid(H, capG(1.12, Math.PI * 0.55, -0.55), scol);
      S.rigid(H, capG(1.1, Math.PI * 0.62, -1.0), scol);
      S.rigid(H, SPH(1, 18, 12), scol, [0, HC[1] + 0.12, HC[2] - 0.035], [-0.35, 0, 0], [0.135, 0.075, 0.145]);
      S.rigid(H, SPH(1, 12, 9), shade(sc, 1.08), [0.01, HC[1] + 0.15, HC[2] + 0.1], [0.4, 0, 0.3], [0.045, 0.04, 0.035]);
      for (const sd of [-1, 1]) S.rigid(H, CAP(0.02, 0.1, 6), shade(sc, 0.9), [sd * 0.03, HC[1] + 0.01, HC[2] - 0.18], [0.6, 0, 0.4 * sd]);
    }
    // barba e bigode (em mechas, deixando a boca à mostra)
    if (s.beard === 'full') {
      for (let k = 0; k <= 8; k++) {
        const a = -1.25 + (k / 8) * 2.5, xu = Math.sin(a) * 0.86, yu = -0.42 - 0.33 * Math.cos(a);
        const [x, y, z] = face(xu, Math.max(yu, -0.92), -0.012);
        clump([x, y, z], [0.045, 0.05, 0.04], [0, a * 0.6, 0]);
      }
      const [cx, cy, cz] = face(0, -0.8, 0.0);
      clump([cx, cy - 0.012, cz], [0.055, 0.05, 0.04]);
    }
    if (s.beard === 'full' || s.beard === 'mustache') for (const sd of [-1, 1]) {
      const [x, y, z] = face(sd * 0.13, -0.24, 0.012);
      S.rigid(H, CAP(0.013, 0.034, 6), shade(hair, 0.95), [x, y, z], [0, -sd * 0.3, (Math.PI / 2 - 0.42) * sd]);
    }

    // ----- chapéus -----
    const hc = col(s.hatColor), HB = 0.233, HS = [1.07, 1, 1.07];
    if (s.hat === 'straw') {
      S.rigid(H, LATHE([[0.13, -0.006], [0.31, -0.02], [0.338, -0.034], [0.3, -0.006], [0.13, 0.012]], 26), (v) => shade(hc, 0.9 + 0.12 * Math.sin(Math.hypot(v.x, v.z) * 140)), [0, HB, 0], [0, 0, 0], HS);
      S.rigid(H, LATHE([[0.138, 0], [0.128, 0.06], [0.108, 0.122], [0.05, 0.132], [0, 0.133]], 22), hc, [0, HB, 0], [0, 0, 0], HS);
      S.rigid(H, LATHE([[0.137, 0.012], [0.135, 0.04]], 22), '#7a4a2a', [0, HB, 0], [0, 0, 0], [1.083, 1, 1.083]);
    }
    if (s.hat === 'fedora') {
      S.rigid(H, LATHE([[0.135, -0.006], [0.2, -0.004], [0.226, 0.02], [0.206, 0.004], [0.135, 0.008]], 24), hc, [0, HB + 0.004, 0], [0, 0, 0], HS);
      S.rigid(H, LATHE([[0.138, 0], [0.13, 0.06], [0.11, 0.11], [0.07, 0.118], [0, 0.11]], 22), hc, [0, HB + 0.004, 0], [0, 0, 0], [1.07, 1, 1.15]);
      S.rigid(H, LATHE([[0.139, 0.008], [0.136, 0.036]], 22), '#2a2420', [0, HB + 0.004, 0], [0, 0, 0], [1.08, 1, 1.16]);
    }
    if (s.hat === 'cap') {
      S.rigid(H, new THREE.CylinderGeometry(0.162, 0.148, 0.1, 22), hc, [0, HB + 0.06, 0]);
      S.rigid(H, new THREE.CylinderGeometry(0.149, 0.149, 0.026, 22), '#141414', [0, HB + 0.02, 0]);
      S.rigid(H, SPH(1, 16, 6), '#151515', [0, HB + 0.014, 0.125], [0.15, 0, 0], [0.115, 0.012, 0.078]);
      S.rigid(H, SPH(0.016, 6, 4), '#c9a24a', [0, HB + 0.055, 0.16]);
    }
    if (s.hat === 'flatcap') {
      S.rigid(H, new THREE.SphereGeometry(0.168, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), hc, [0, HB - 0.022, 0.004], [0.14, 0, 0], [1.06, 0.52, 1.16]);
      S.rigid(H, SPH(1, 16, 6), shade(hc, 0.85), [0, HB - 0.012, 0.145], [0.25, 0, 0], [0.125, 0.012, 0.072]);
      S.rigid(H, SPH(0.012, 6, 4), shade(hc, 0.8), [0, HB + 0.062, 0.012]);
    }
    if (s.hat === 'fez') {
      S.rigid(H, LATHE([[0.124, 0], [0.104, 0.15], [0.096, 0.168], [0, 0.17]], 20), '#a3201c', [0, HB - 0.03, -0.004], [-0.08, 0, 0], HS);
      S.rigid(H, new THREE.CylinderGeometry(0.004, 0.004, 0.1, 4), '#111111', [0.02, HB + 0.13, -0.06], [0.9, 0, 0]);
      S.rigid(H, CAP(0.014, 0.05, 6), '#111111', [0.02, HB + 0.07, -0.11], [0.2, 0, 0]);
    }
    if (s.headdress === 'cocar') {
      S.rigid(H, LATHE([[0.146, 0.0], [0.15, 0.026], [0.146, 0.052]], 22), '#b9762e', [0, HC[1] + 0.035, HC[2]], [-0.14, 0, 0], [1.05, 1, 1.12]);
      for (let k = 0; k < 9; k++) S.rigid(H, SPH(0.014, 6, 4), k % 2 ? '#1e1a17' : '#f0e0b0', [Math.sin(-1.2 + k * 0.3) * 0.156, HC[1] + 0.06, HC[2] + Math.cos(-1.2 + k * 0.3) * 0.165]);
      const cols = ['#c8321e', '#f0b429', '#1e3a8a', '#d84a1a', '#f6c445', '#2a6a4a', '#f2ece0'];
      for (let k = 0; k < 11; k++) {
        const a = -1.25 + (k / 10) * 2.5;
        S.rigid(H, SPH(1, 8, 6), cols[k % cols.length], [Math.sin(a) * 0.12, HC[1] + 0.17 + Math.cos(a) * 0.1, HC[2] - 0.075], [-0.25, 0, -a * 0.85], [0.032, 0.17, 0.01]);
        S.rigid(H, SPH(1, 6, 4), '#f2ece0', [Math.sin(a) * 0.112, HC[1] + 0.11 + Math.cos(a) * 0.085, HC[2] - 0.08], [-0.25, 0, -a * 0.85], [0.012, 0.07, 0.006]);
      }
    }

    // ----- monta a malha com pele -----
    const geo = S.build();
    const mesh = (this.mesh = new THREE.SkinnedMesh(geo, charMat()));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.add(bones[0]);
    this.root.add(mesh);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.95, 0), 1.25);
    mesh.boundingBox = new THREE.Box3(new THREE.Vector3(-0.9, -0.1, -0.9), new THREE.Vector3(0.9, 2.1, 0.9));
    this.body = bones[I.body]; this.hips = bones[I.hips]; this.spine = bones[I.spine]; this.head = bones[I.head];
    // keffiyeh (tecido com textura: malhas próprias presas aos ossos)
    if (s.keffiyeh) {
      const km = new THREE.MeshStandardMaterial({ map: keffiyeh(), roughness: 0.9, side: THREE.DoubleSide });
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.168, 22, 14, Math.PI * 0.84, Math.PI * 1.32, 0, Math.PI * 0.6), km);
      hood.position.set(HC[0], HC[1] + 0.004, HC[2] - 0.01); hood.rotation.x = -0.18; hood.scale.set(0.98, 1.06, 1.06); hood.castShadow = true;
      this.head.add(hood);
      const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.2, 16, 1, true, Math.PI * 0.3, Math.PI * 1.4), km);
      drape.position.set(0, 0.03, -0.01); drape.castShadow = true;
      this.head.add(drape);
      for (const z of [0.112, -0.112]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.02), km); st.position.set(0.12, 0.3, z); st.rotation.set(0, Math.PI / 2, 0.1); this.spine.add(st); }
    }
    if (s.child) this.head.scale.setScalar(1.22);
    this.holder = new THREE.Group();
    this.holder.position.set(0, 0.24, 0.34);
    this.spine.add(this.holder);
    this.blob = blobShadow();
    this.root.add(this.blob);
    if (s.child) { this.root.scale.setScalar(0.62 * s.scale); this.blob.scale.setScalar(1.1); }
    else this.root.scale.setScalar(s.scale);
    if (s.cuffs) {
      this.links = [];
      const lm = M('#4a4a4e', { metalness: 0.6, roughness: 0.45 }), lg = TOR(0.017, 0.006, 4, 8);
      for (let k = 0; k < 9; k++) { const l = new THREE.Mesh(lg, lm); this.root.add(l); this.links.push(l); }
      this.bound = true;
    }
    this.stride = s.bottomType === 'dress' || s.bottomType === 'skirt' ? 0.55 : 1;
    this.carrying = null;
  }

  hold(obj) {
    this.drop();
    if (!obj) return;
    this.carrying = obj;
    this.holder.add(obj);
  }
  drop() {
    if (this.carrying) this.carrying.removeFromParent();
    const o = this.carrying;
    this.carrying = null;
    return o;
  }
  holdInHand(obj, right = true) {
    this.arms[right ? 1 : 0].hand.add(obj);
    obj.position.set(0, -0.05, 0);
    if (right) this.rightHold = obj; else this.leftHold = obj;
    return obj;
  }
  releaseHand(right = true) { const o = right ? this.rightHold : this.leftHold; o?.removeFromParent(); if (right) this.rightHold = null; else this.leftHold = null; return o; }
  // Liberta os pulsos (remove grilhões e corrente).
  free() {
    this.bound = false;
    for (const a of this.arms) a.cuff?.removeFromParent();
    for (const l of this.links || []) l.removeFromParent();
    this.links = null;
  }

  update(dt, t) {
    const p = Object.assign(this.tgt, POSE), s = this.spec;
    const br = Math.sin(t * 1.6 + this.seed) * 0.012;
    p.bodyY = br * 0.4;
    p.spineX = s.stoop + br;
    const k = Math.min(this.moveSpeed / 3.2, 1.8);
    if (this.moveSpeed > 0.05) this.phase += dt * (4.6 + this.moveSpeed * 1.25);
    if (k > 0.02) {
      const sn = Math.sin(this.phase), cs = Math.cos(this.phase), A = 0.52 * Math.min(k, 1.25) * this.stride;
      p.ltx = -sn * A; p.rtx = sn * A;
      p.lkx = Math.max(0, cs) * A * 1.6 + 0.05; p.rkx = Math.max(0, -cs) * A * 1.6 + 0.05;
      p.lsx = sn * A * 0.85; p.rsx = -sn * A * 0.85;
      p.lex = p.rex = -0.25 - k * 0.35;
      p.bodyY = -Math.abs(cs) * 0.03 * k + 0.012 * k;
      p.spineY = sn * 0.07 * k;
      p.hipsY = -sn * 0.08 * k;
      p.spineX += 0.04 * k + (k > 1.3 ? 0.1 : 0);
    }
    const a = this.anim;
    if (a === 'talk') { p.headX += Math.sin(t * 4.3 + this.seed) * 0.035; p.rsx = -0.35 + Math.sin(t * 1.7) * 0.2; p.rex = -0.95; p.rsz = -0.18; }
    else if (a === 'carry') { p.lsx = p.rsx = -1.0; p.lex = p.rex = -0.6; p.lsz = 0.16; p.rsz = -0.16; }
    else if (a === 'drum') {
      const h1 = Math.max(0, Math.sin(t * 9.5)), h2 = Math.max(0, Math.sin(t * 9.5 + Math.PI));
      p.spineX = 0.32; p.lsx = -0.75 - h1 * 0.55; p.rsx = -0.75 - h2 * 0.55; p.lex = p.rex = -1.0; p.headX = 0.1 + h1 * 0.05; p.bodyY = -0.05;
    } else if (a === 'dance') {
      const w = t * 4.2 + this.seed;
      p.bodyY = Math.abs(Math.sin(w)) * 0.05; p.spineZ = Math.sin(w * 0.5) * 0.14; p.spineY = Math.sin(w * 0.5) * 0.25;
      p.lsz = 0.55 + Math.sin(w) * 0.3; p.rsz = -0.55 + Math.sin(w) * 0.3; p.lex = p.rex = -0.7;
      p.ltx = Math.sin(w) * 0.28; p.rtx = -Math.sin(w) * 0.28; p.lkx = Math.max(0, Math.sin(w)) * 0.4; p.rkx = Math.max(0, -Math.sin(w)) * 0.4;
    } else if (a === 'clap') {
      const c = Math.abs(Math.sin(t * 5.2 + this.seed));
      p.lsx = p.rsx = -1.1; p.lsz = 0.05 + c * 0.35; p.rsz = -p.lsz; p.lex = p.rex = -0.9; p.bodyY = c * 0.02;
    } else if (a === 'sit') {
      p.bodyY = -0.47; p.ltx = p.rtx = -1.5; p.lkx = p.rkx = 1.45; p.lsx = p.rsx = -0.55; p.lex = p.rex = -0.7; p.spineX = 0.1 + s.stoop;
    } else if (a === 'work') {
      const w = Math.sin(t * 3.2 + this.seed);
      p.spineX = 0.6 + w * 0.12; p.lsx = p.rsx = -1.1 + w * 0.35; p.lex = p.rex = -0.25; p.ltx = p.rtx = -0.25; p.lkx = p.rkx = 0.4; p.bodyY = -0.06;
    } else if (a === 'kneel') {
      p.bodyY = -0.42; p.ltx = -1.35; p.lkx = 1.45; p.rtx = 0.25; p.rkx = 2.1; p.spineX = 0.35; p.lsx = p.rsx = -0.95; p.lex = p.rex = -0.45;
    } else if (a === 'wave') { p.rsz = -2.5 + Math.sin(t * 7) * 0.25; p.rex = -0.3; p.rsx = 0; }
    else if (a === 'point') { p.rsx = -1.45; p.rsz = -0.1; p.rex = -0.05; }
    else if (a === 'lantern') { p.rsx = -0.5; p.rex = -0.9; }
    if (this.leftHold && a !== 'carry') { p.lsx = -0.22 + (k > 0.02 ? Math.sin(this.phase) * 0.12 : 0); p.lsz = 0.12; p.lex = -1.1; }
    if (this.rightHold && a !== 'carry') { p.rsx = k > 0.02 ? -Math.sin(this.phase) * 0.18 : 0.02; p.rsz = -0.13; p.rex = -0.06; }
    if (this.bound) { p.lsx = p.rsx = -0.5 + (k > 0.02 ? Math.sin(this.phase * 2) * 0.04 : 0); p.lsz = -0.34; p.rsz = 0.34; p.lex = p.rex = -1.15; }
    // olhar para um ponto
    if (this.lookAt) {
      const v = this.root.worldToLocal(this._v || (this._v = new THREE.Vector3()).copy(this.lookAt));
      p.headY = Math.max(-1, Math.min(1, Math.atan2(v.x, v.z)));
    }
    const f = 1 - Math.exp(-dt * 10), c = this.cur;
    for (const key in p) c[key] += (p[key] - c[key]) * f;
    this.body.position.y = c.bodyY;
    this.hips.rotation.y = c.hipsY;
    this.spine.rotation.set(c.spineX, c.spineY, c.spineZ);
    this.head.rotation.set(c.headX, c.headY, 0);
    this.arms[0].sh.rotation.set(c.lsx, 0, c.lsz); this.arms[1].sh.rotation.set(c.rsx, 0, c.rsz);
    this.arms[0].el.rotation.x = c.lex; this.arms[1].el.rotation.x = c.rex;
    this.legs[0].thigh.rotation.x = c.ltx; this.legs[1].thigh.rotation.x = c.rtx;
    this.legs[0].knee.rotation.x = c.lkx; this.legs[1].knee.rotation.x = c.rkx;
    // piscar
    this.blink -= dt;
    this.lids.visible = this.blink < 0.12;
    if (this.blink < 0) this.blink = 2.5 + Math.random() * 3;
    if (this.links) {
      this.root.updateMatrixWorld(true);
      const A = this.arms[0].cuff.getWorldPosition(this._ha || (this._ha = new THREE.Vector3())), B = this.arms[1].cuff.getWorldPosition(this._hb || (this._hb = new THREE.Vector3()));
      this.root.worldToLocal(A); this.root.worldToLocal(B);
      const n = this.links.length;
      this.links.forEach((l, i) => {
        const tt = (i + 0.5) / n;
        l.position.lerpVectors(A, B, tt);
        l.position.y -= Math.sin(Math.PI * tt) * 0.06;
        l.rotation.set(i % 2 ? Math.PI / 2 : 0, Math.atan2(B.x - A.x, B.z - A.z) + Math.PI / 2, 0);
      });
    }
  }

  // Versão "memória": figura feita de luz (epílogo).
  ghost(color) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.AdditiveBlending });
    m.userData.own = true;
    this.root.traverse((o) => { if (o.isMesh) { o.material = m; o.castShadow = false; } });
    this.blob.visible = false;
    return m;
  }
}
