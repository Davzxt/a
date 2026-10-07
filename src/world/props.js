// Construções e objetos de cena, modelados com primitivas num estilo estilizado de bordas chanfradas.
// Tudo o que é estático é "assado" (bake) numa única malha com cores por vértice: poucas chamadas de desenho.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, VCM, glow, DETAIL } from '../core/engine.js';
import { makeFire, particles } from '../core/fx.js';
import { rng, smooth } from '../core/noise.js';

const mat = (c, o) => (typeof c === 'string' ? M(c, o) : c);
export function mk(geo, m, x = 0, y = 0, z = 0, p, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  o.castShadow = o.receiveShadow = true;
  if (p) p.add(o);
  return o;
}

// Caixa chanfrada (bordas que pegam luz, típicas do visual estilizado): 44 triângulos.
const CHAMF = new Map();
function chamferGeo(w, h, d, r) {
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}`;
  let g = CHAMF.get(key);
  if (g) return g;
  const X = w / 2, Y = h / 2, Z = d / 2, pos = [];
  // pontos de cada canto: deslocado em x, em y e em z
  const P = (sx, sy, sz, ax) => (ax === 0 ? [sx * X, sy * (Y - r), sz * (Z - r)] : ax === 1 ? [sx * (X - r), sy * Y, sz * (Z - r)] : [sx * (X - r), sy * (Y - r), sz * Z]);
  const poly = (pts) => {
    const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length, a[2] + p[2] / pts.length], [0, 0, 0]);
    const a = new THREE.Vector3(...pts[0]), b = new THREE.Vector3(...pts[1]), e = new THREE.Vector3(...pts[2]);
    const n = b.clone().sub(a).cross(e.clone().sub(a));
    if (n.dot(new THREE.Vector3(...c)) < 0) pts = pts.slice().reverse();
    for (let i = 1; i < pts.length - 1; i++) pos.push(...pts[0], ...pts[i], ...pts[i + 1]);
  };
  const S = [-1, 1];
  // faces
  for (const s of S) {
    poly([P(s, -1, -1, 0), P(s, 1, -1, 0), P(s, 1, 1, 0), P(s, -1, 1, 0)]);
    poly([P(-1, s, -1, 1), P(1, s, -1, 1), P(1, s, 1, 1), P(-1, s, 1, 1)]);
    poly([P(-1, -1, s, 2), P(1, -1, s, 2), P(1, 1, s, 2), P(-1, 1, s, 2)]);
  }
  // chanfros das arestas
  for (const a of S) for (const b of S) {
    poly([P(a, b, -1, 0), P(a, b, 1, 0), P(a, b, 1, 1), P(a, b, -1, 1)]); // arestas ao longo de z
    poly([P(-1, a, b, 1), P(1, a, b, 1), P(1, a, b, 2), P(-1, a, b, 2)]); // ao longo de x
    poly([P(a, -1, b, 0), P(a, 1, b, 0), P(a, 1, b, 2), P(a, -1, b, 2)]); // ao longo de y
  }
  // cantos
  for (const a of S) for (const b of S) for (const c of S) poly([P(a, b, c, 0), P(a, b, c, 1), P(a, b, c, 2)]);
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.userData.shared = true;
  CHAMF.set(key, g);
  return g;
}
export function boxGeo(w, h, d) {
  const m = Math.min(w, h, d);
  if (m < 0.03 || DETAIL.value < 1 && m < 0.12) { const g = new THREE.BoxGeometry(w, h, d); return g; }
  return chamferGeo(w, h, d, Math.min(0.05, m * 0.22));
}
export const box = (p, w, h, d, c, x = 0, y = 0, z = 0, ry = 0, o) => mk(boxGeo(w, h, d), mat(c, o), x, y, z, p, 0, ry, 0);
export const cyl = (p, rt, rb, h, c, x = 0, y = 0, z = 0, seg = 8, o) => mk(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c, o), x, y, z, p);
export const put = (o, x, y, z, p) => { o.position.set(x, y, z); if (p) p.add(o); return o; };
const ball = (p, r, c, x, y, z, s = [1, 1, 1], d = 1) => { const m = mk(new THREE.IcosahedronGeometry(r, d), mat(c), x, y, z, p); m.scale.set(...s); return m; };
// Malha que já vem com cores por vértice.
const vmesh = (geo, p, x = 0, y = 0, z = 0, ry = 0, side) => mk(geo, VCM(side), x, y, z, p, 0, ry, 0);

// Junta malhas estáticas: as de cor lisa viram UMA malha com cores por vértice (+ oclusão na base).
const _pc = new THREE.Color();
const plainOK = (m) => m.isMeshStandardMaterial && !m.map && !m.transparent && !m.metalness && m.emissive.r + m.emissive.g + m.emissive.b === 0 && !m.userData.own;
export function bake(root, { ao = true } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), groups = new Map(), kill = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.dynamic || Array.isArray(o.material) || o.material.isShaderMaterial) return;
    if (o.material.map && !o.material.userData.bakeable) return;
    for (let p = o.parent; p && p !== root; p = p.parent) if (p.userData.dynamic) return;
    const m = o.material;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    let key = m;
    if (plainOK(m)) {
      key = VCM(m.side);
      if (!m.vertexColors || !g.attributes.color) {
        _pc.copy(m.color);
        const n = g.attributes.position.count, c = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { c[i * 3] = _pc.r; c[i * 3 + 1] = _pc.g; c[i * 3 + 2] = _pc.b; }
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      }
    }
    const keep = key.vertexColors ? ['position', 'normal', 'color'] : ['position', 'normal'];
    for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(g);
    kill.push(o);
  });
  kill.forEach((o) => { o.removeFromParent(); if (!o.geometry.userData.shared) o.geometry.dispose(); });
  for (const [m, list] of groups) {
    const g = mergeGeometries(list);
    list.forEach((x) => x.dispose());
    if (ao && m.vertexColors) {
      // oclusão ambiente "pintada": escurece perto do chão
      const p = g.attributes.position, c = g.attributes.color;
      for (let i = 0; i < p.count; i++) { const k = 0.66 + 0.34 * smooth(-0.15, 1.3, p.getY(i)); c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k); }
    }
    const o = new THREE.Mesh(g, m);
    o.castShadow = o.receiveShadow = true;
    root.add(o);
  }
  return root;
}

// Posiciona no terreno e registra colisões/superfícies declaradas no objeto.
// Construções ficam na cota mais alta da sua base (a fundação desce até o chão): nada flutua.
const _bb = new THREE.Box3();
export function place(W, obj, x, z, ry = 0, dy = 0) {
  W.add(obj, x, z, ry, dy);
  const c = Math.cos(ry), s = Math.sin(ry), wx = (lx, lz) => x + c * lx + s * lz, wz = (lx, lz) => z - s * lx + c * lz;
  const mode = obj.userData.ground || (obj.userData.boxes ? 'max' : 'center');
  if (mode !== 'center') {
    const rot = obj.rotation.y;
    obj.rotation.y = 0; obj.position.set(0, 0, 0); obj.updateMatrixWorld(true);
    _bb.setFromObject(obj);
    obj.rotation.y = rot;
    const hx = Math.min(_bb.max.x, -_bb.min.x, 30) * 0.92, hz = Math.min(_bb.max.z, -_bb.min.z, 30) * 0.92;
    let hmax = -1e9, sum = 0, n = 0;
    for (const u of [-1, 0, 1]) for (const v of [-1, 0, 1]) { const h = W.groundAt(wx(u * hx, v * hz), wz(u * hx, v * hz)); hmax = Math.max(hmax, h); sum += h; n++; }
    obj.position.set(x, (mode === 'max' ? hmax : sum / n) + dy, z);
  }
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
  const gr = x.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, bg); gr.addColorStop(1, '#1a120c');
  x.fillStyle = gr; x.fillRect(0, 0, w, h);
  // veios da madeira
  x.globalAlpha = 0.12;
  for (let i = 0; i < 40; i++) { x.strokeStyle = i % 2 ? '#000' : '#fff'; x.lineWidth = 1 + (i % 3); x.beginPath(); const y = (i / 40) * h + Math.sin(i * 7.1) * 6; x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + 8, w * 0.6, y - 8, w, y + 3); x.stroke(); }
  x.globalAlpha = 1;
  if (border) { x.strokeStyle = border; x.lineWidth = h * 0.04; x.strokeRect(h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16); }
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,0.55)'; x.shadowBlur = h * 0.03; x.shadowOffsetY = h * 0.012;
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
  // moldura de madeira atrás da placa
  const fr = mk(boxGeo(w + 0.16, h + 0.16, 0.08), M(opts.frame || '#4a3020'), 0, 0, -0.045, o);
  fr.castShadow = false;
  return o;
}

// ======== Telhados ========
const TILE = ['#b4553a', '#c0643f', '#a24a33', '#c8724a', '#9a4430', '#b85e3c'];
const THATCH = ['#c9a95e', '#b8954e', '#d6b86c', '#a8884a', '#bfa060'];
// Face de telhado em fileiras sobrepostas. Beiral em z=0 (x de -L0/2 a L0/2), sobe até z=-S·cos(a), y=S·sen(a)
// (cumeeira de comprimento L1). Telha "capa e canal" ou sapê (jag > 0).
function roofFace(L0, L1, S, a, { sp = 0.3, row = 0.42, amp = 0.05, lift = 0.035, pal = TILE, jag = 0, seed = 1, moss = 0.06 } = {}) {
  const det = DETAIL.value, spw = det < 1 ? 2 : 4, r = rng(seed);
  const rows = Math.max(1, Math.round(S / row)), rl = S / rows;
  const pos = [], nor = [], col = [];
  const ca = Math.cos(a), sa = Math.sin(a), c = new THREE.Color(), mc = new THREE.Color('#5f7a3a');
  // (x, v ao longo da encosta, deslocamento normal) -> mundo local
  const W = (x, v, off) => [x, v * sa + off * ca, -v * ca + off * sa];
  const NV = (nx, nv, nn) => { const v = new THREE.Vector3(nx, nv * sa + nn * ca, -nv * ca + nn * sa).normalize(); return [v.x, v.y, v.z]; };
  const pals = pal.map((h) => new THREE.Color(h));
  for (let i = 0; i < rows; i++) {
    const v0 = i * rl, v1 = Math.min(S, (i + 1) * rl + rl * 0.3), vm = (v0 + v1) / 2;
    const half = (L0 + (L1 - L0) * Math.min(vm / S, 1)) / 2;
    if (half <= 0.05) continue;
    const n = Math.max(1, Math.round((half * 2) / sp)), tsp = (half * 2) / n;
    for (let j = 0; j < n; j++) {
      c.copy(pals[Math.floor(r() * pals.length)]).multiplyScalar(0.86 + r() * 0.24);
      if (r() < moss) c.lerp(mc, 0.35 + r() * 0.3);
      const x0 = -half + j * tsp, jg0 = jag ? r() * jag : 0;
      const cu = c.clone().multiplyScalar(0.7), cl = c.clone().multiplyScalar(1.1);
      for (let k = 0; k < spw; k++) {
        const ua = k / spw, ub = (k + 1) / spw;
        const xa = x0 + ua * tsp, xb = x0 + ub * tsp;
        const fa = amp * Math.sin(Math.PI * ua), fb = amp * Math.sin(Math.PI * ub);
        const da = (amp * Math.PI / tsp) * Math.cos(Math.PI * ua), db = (amp * Math.PI / tsp) * Math.cos(Math.PI * ub);
        const j0a = jag ? jg0 * (0.6 + 0.4 * Math.sin(ua * 9 + j)) : 0, j0b = jag ? jg0 * (0.6 + 0.4 * Math.sin(ub * 9 + j)) : 0;
        const A = W(xa, v0 - j0a, fa + lift), B = W(xb, v0 - j0b, fb + lift), Cc = W(xb, v1, fb), D = W(xa, v1, fa);
        const nA = NV(-da, lift / rl, 1), nB = NV(-db, lift / rl, 1);
        pos.push(...A, ...B, ...Cc, ...A, ...Cc, ...D);
        nor.push(...nA, ...nB, ...nB, ...nA, ...nB, ...nA);
        col.push(cl.r, cl.g, cl.b, cl.r, cl.g, cl.b, cu.r, cu.g, cu.b, cl.r, cl.g, cl.b, cu.r, cu.g, cu.b, cu.r, cu.g, cu.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
// Cumeeira/espigão: fileira de telhas meia-cana entre dois pontos.
function ridgeCap(p, a, b, r = 0.13, c = '#a24a33') {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const m = mk(new THREE.CylinderGeometry(r, r, len, 7, 1, true), M(c), 0, 0, 0, p);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}
function prism(L, W, H) {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0); s.lineTo(W / 2, 0); s.lineTo(0, H); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false });
  g.translate(0, 0, -L / 2);
  g.rotateY(Math.PI / 2);
  return g;
}
// Telhado de duas águas com telhas, forro do beiral e cumeeira.
export function gableRoof(p, L, W, H, y0, roofCol, wallCol, over = 0.45, th = 0.16, opts = {}) {
  if (wallCol) mk(prism(L, W, H), mat(wallCol), 0, y0, 0, p);
  const a = Math.atan2(H, W / 2), sl = Math.hypot(W / 2, H) + over;
  const thatch = opts.thatch;
  for (const s of [1, -1]) {
    // forro (madeira) sob as telhas
    const m = box(p, L + over * 2, th, sl, opts.under || '#5a3e2c');
    m.position.set(0, y0 + (H - over * Math.sin(a)) / 2 + (Math.cos(a) * th) / 2 - 0.02, (s * (W / 2 + over * Math.cos(a))) / 2 + (s * Math.sin(a) * th) / 2);
    m.rotation.x = s * a;
    const f = vmesh(roofFace(L + over * 2, L + over * 2, sl, a, thatch ? { sp: 0.2, row: 0.34, amp: 0.035, lift: 0.1, pal: opts.pal || THATCH, jag: 0.14, seed: 3 + s, moss: 0 } : { pal: opts.pal || TILE, seed: 5 + s, moss: opts.moss ?? 0.06 }), p);
    f.position.set(0, y0 - over * Math.sin(a) + th * Math.cos(a) - 0.01, s * (W / 2 + over * Math.cos(a)) + s * th * Math.sin(a));
    f.rotation.y = s > 0 ? 0 : Math.PI;
  }
  if (thatch) {
    const rc = cyl(p, 0.18, 0.18, L + over * 2 + 0.1, opts.ridge || '#a8884a', 0, y0 + H + th + 0.06, 0, 8);
    rc.rotation.z = Math.PI / 2;
  } else ridgeCap(p, [-(L / 2 + over), y0 + H + th * 1.15, 0], [L / 2 + over, y0 + H + th * 1.15, 0], 0.14, roofCol);
}
// Telhado de quatro águas (casa-grande).
function hipRoof(p, L, W, H, y0, { over = 0.6, pal = TILE, fascia = '#efe7d6' } = {}) {
  const a = Math.atan2(H, W / 2), ye = y0 - over * Math.tan(a), S = (W / 2 + over) / Math.cos(a);
  const deck = new THREE.BufferGeometry();
  { // corpo do telhado (sob as telhas)
    const l = L / 2 + over, w = W / 2 + over, r = Math.max(L / 2 - W / 2, 0.01), h = H + over * Math.tan(a);
    const v = [-l, 0, w, l, 0, w, r, h, 0, -l, 0, w, r, h, 0, -r, h, 0, l, 0, -w, -l, 0, -w, -r, h, 0, l, 0, -w, -r, h, 0, r, h, 0,
      -l, 0, -w, -l, 0, w, -r, h, 0, l, 0, w, l, 0, -w, r, h, 0];
    deck.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    deck.computeVertexNormals();
  }
  mk(deck, M('#6a3a2a'), 0, ye - 0.04, 0, p);
  const faces = [[L + 2 * over, L - W, 0, W / 2 + over, 0], [L + 2 * over, L - W, 0, -(W / 2 + over), Math.PI], [W + 2 * over, 0, L / 2 + over, 0, Math.PI / 2], [W + 2 * over, 0, -(L / 2 + over), 0, -Math.PI / 2]];
  faces.forEach(([l0, l1, x, z, ry], i) => {
    const f = vmesh(roofFace(l0, l1, S, a, { pal, seed: 11 + i }), p, x, ye, z, ry);
    f.castShadow = true;
  });
  const top = y0 + H + 0.1, r = Math.max(L / 2 - W / 2, 0.01);
  ridgeCap(p, [-r, top, 0], [r, top, 0], 0.14);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) ridgeCap(p, [sx * (L / 2 + over), ye + 0.08, sz * (W / 2 + over)], [sx * r, top, 0], 0.12);
  // testeira (borda do beiral)
  for (const sz of [-1, 1]) box(p, L + 2 * over + 0.1, 0.22, 0.1, fascia, 0, ye - 0.06, sz * (W / 2 + over));
  for (const sx of [-1, 1]) box(p, 0.1, 0.22, W + 2 * over + 0.1, fascia, sx * (L / 2 + over), ye - 0.06, 0);
}

// ======== Peças de fachada ========
// Janela colonial: moldura saliente, peitoril, vidraça com caixilhos e venezianas abertas.
function windowUnit(p0, x, y, z, { w = 1, h = 1.5, frame = '#f1ece2', shutter = '#3d6b8f', lit = false, open = 0.5, bars = false, arch = false } = {}, ry = 0) {
  const p = put(new THREE.Group(), x, y, z, p0);
  p.rotation.y = ry;
  const t = 0.12;
  box(p, w + 0.3, 0.14, 0.24, frame, 0, -h / 2 - 0.07, 0.06); // peitoril
  box(p, w + 0.26, 0.16, 0.16, frame, 0, h / 2 + 0.08, 0.03); // verga
  for (const s of [-1, 1]) box(p, 0.13, h, 0.16, frame, s * (w / 2 + 0.065), 0, 0.03);
  if (arch) { const ar = mk(new THREE.CylinderGeometry(w / 2 + 0.13, w / 2 + 0.13, 0.16, 12, 1, false, -Math.PI / 2, Math.PI), M(frame), 0, h / 2 + 0.08, 0.03, p, -Math.PI / 2, 0, 0); ar.scale.set(1, 1, 0.6); }
  box(p, w, h, 0.05, lit ? glow('#ffbf6a', 1.6) : M('#2b2a2e', { roughness: 0.3 }), 0, 0, 0.0);
  if (!bars) {
    box(p, w, 0.05, 0.07, frame, 0, 0, 0.03);
    box(p, 0.05, h, 0.07, frame, 0, 0, 0.03);
  } else for (let i = -1; i <= 1; i++) cyl(p, 0.02, 0.02, h, '#3a3330', i * w * 0.3, 0, 0.04, 5);
  if (shutter) for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * (w / 2 + 0.02), 0, 0.08);
    sh.rotation.y = -s * (Math.PI / 2 + 0.25 - open * 0.3);
    p.add(sh);
    box(sh, w / 2, h, 0.05, shutter, s * w / 4, 0, 0);
    for (const yy of [-h * 0.3, 0, h * 0.3]) box(sh, w / 2 - 0.08, 0.05, 0.07, shutter, s * w / 4, yy, 0.01);
  }
  return p;
}
function door(p, x, z, { w = 1.1, h = 2.2, c = '#5a3a22', frame = '#f1ece2', y = 0, open = false } = {}) {
  box(p, w + 0.32, 0.18, 0.18, frame, x, y + h + 0.09, z + 0.03);
  for (const s of [-1, 1]) box(p, 0.15, h, 0.18, frame, x + s * (w / 2 + 0.075), y + h / 2, z + 0.03);
  box(p, w, h, 0.05, '#1e1814', x, y + h / 2, z);
  if (open) return;
  for (const s of [-1, 1]) {
    box(p, w / 2 - 0.02, h - 0.02, 0.07, c, x + s * w / 4, y + h / 2, z + 0.02);
    for (const yy of [0.3, 0.68]) box(p, w / 2 - 0.22, h * 0.26, 0.04, c, x + s * w / 4, y + h * yy, z + 0.07);
  }
}
// Base de pedra que entra 1,5 m no chão (assim nenhuma construção "flutua" num terreno irregular).
function plinth(p, w, d, top, c = '#8c857a', cap = '#a39b8e') {
  box(p, w, top + 1.5, d, c, 0, (top - 1.5) / 2, 0);
  if (top > 0.25) box(p, w + 0.1, 0.1, d + 0.1, cap, 0, top - 0.05, 0);
}
// Pedras irregulares encaixadas na fundação (detalhe visual).
function stones(p, w, d, y0, h, seed = 1, c = '#7d766c') {
  const r = rng(seed), n = DETAIL.value < 1 ? 6 : Math.round((w + d) * 1.2);
  for (let i = 0; i < n; i++) {
    const side = i % 4, t = r() - 0.5, s = 0.18 + r() * 0.16;
    const [x, z] = side === 0 ? [t * w, d / 2] : side === 1 ? [t * w, -d / 2] : side === 2 ? [w / 2, t * d] : [-w / 2, t * d];
    ball(p, s, c, x, y0 + r() * h, z, [1.4, 0.8, 0.5 + (side > 1 ? 0.6 : 0)], 0).rotation.y = side > 1 ? Math.PI / 2 : 0;
  }
}

// ======== Construções ========
export function casaGrande({ lit = false, ruined = false } = {}) {
  const g = new THREE.Group(), L = 16, D = 9, H = 4.2, base = 1.1;
  const wall = ruined ? '#b4a68e' : '#f2ead8', trim = ruined ? '#9a8f7c' : '#e2c46a', stone = '#8c857a', barra = ruined ? '#8f8270' : '#b8a27a';
  plinth(g, L + 0.6, D + 0.6, base, stone);
  stones(g, L + 0.62, D + 0.62, 0.1, base - 0.3, 3);
  for (let i = 0; i < 4; i++) box(g, 3.2 - i * 0.1, 0.27, 0.9 - i * 0.2 + 0.3, '#9a9286', 0, base - 0.27 * i - 0.14, D / 2 + 0.75 + i * 0.32);
  if (!ruined) {
    for (const s of [-1, 1]) {
      box(g, L, H, 0.35, wall, 0, base + H / 2, (s * D) / 2);
      box(g, 0.35, H, D, wall, (s * L) / 2, base + H / 2, 0);
      // barrado e cunhais (pilastras de canto)
      box(g, L + 0.06, 0.8, 0.4, barra, 0, base + 0.4, (s * D) / 2);
      box(g, 0.4, 0.8, D + 0.06, barra, (s * L) / 2, base + 0.4, 0);
      for (const t of [-1, 1]) box(g, 0.5, H, 0.5, trim, (s * L) / 2, base + H / 2, (t * D) / 2);
    }
    box(g, L + 0.5, 0.32, D + 0.5, trim, 0, base + H - 0.1, 0);
    box(g, L + 0.8, 0.14, D + 0.8, '#f6f0e2', 0, base + H + 0.06, 0);
    hipRoof(g, L + 0.2, D + 0.2, 3.1, base + H + 0.12, { over: 0.65 });
  } else {
    const hs = [3.6, 2.1, 4.2, 1.2, 3.1, 2.6, 4.0, 1.6];
    hs.forEach((h, i) => box(g, L / 8, h, 0.35, wall, -L / 2 + L / 16 + (i * L) / 8, base + h / 2, D / 2));
    box(g, L, 2.8, 0.35, wall, 0, base + 1.4, -D / 2);
    box(g, 0.35, 3.3, D, wall, -L / 2, base + 1.65, 0);
    box(g, 0.35, 1.9, D * 0.6, wall, L / 2, base + 0.95, -D * 0.2);
    box(g, L + 0.06, 0.8, 0.4, barra, 0, base + 0.4, D / 2);
    const beam = box(g, L * 0.7, 0.22, 0.26, '#4a3526', -2, base + 2.6, 0.5);
    beam.rotation.z = 0.25;
    const beam2 = box(g, D * 0.8, 0.2, 0.24, '#3e2c20', 3, base + 0.5, 0, 1.1);
    beam2.rotation.z = -0.08;
    for (let i = 0; i < 6; i++) box(g, 0.5 + (i % 3) * 0.2, 0.3, 0.4, '#a39b8e', -5 + i * 2.1, base + 0.15, D / 2 + 1.2 + (i % 2) * 0.6, i);
    // trepadeiras sobre as ruínas
    for (let i = 0; i < 11; i++) ball(g, 0.55 + (i % 3) * 0.3, i % 2 ? '#4a7a32' : '#365e26', -L / 2 + 0.8 + i * 1.45, base + 0.8 + (i % 4) * 0.7, D / 2 + 0.3, [1.4, 1, 0.5]);
    for (let i = 0; i < 5; i++) ball(g, 0.7, '#3f6a2c', -L / 2 + 0.3, base + 0.6 + i * 0.6, -D / 2 + 1 + i * 1.5, [0.5, 1, 1.4]);
  }
  for (let i = 0; i < 7; i++) {
    const x = -6.6 + i * 2.2;
    if (Math.abs(x) < 0.5) door(g, 0, D / 2 + 0.17, { y: base, h: 2.7, w: 1.5, c: ruined ? '#2a2420' : '#3d6b8f', frame: ruined ? '#9a8f7c' : '#f6f0e2', open: ruined });
    else if (!ruined || i % 3 === 0) windowUnit(g, x, base + 2.3, D / 2 + 0.17, { lit, shutter: ruined ? null : '#3d6b8f', frame: ruined ? '#9a8f7c' : '#f6f0e2' });
  }
  if (!ruined) for (let i = 0; i < 5; i++) windowUnit(g, -6 + i * 3, base + 2.3, -D / 2 - 0.17, { lit, shutter: '#3d6b8f', frame: '#f6f0e2' }, Math.PI);
  g.userData.boxes = [[0, 0, L / 2 + 0.3, D / 2 + 0.3]];
  return bake(g);
}

export function senzala({ lit = false } = {}) {
  const g = new THREE.Group(), L = 22, D = 5.5, H = 2.6, wc = '#a8805a';
  plinth(g, L + 0.4, D + 0.4, 0.3, '#7a6a58');
  box(g, L, H, D, wc, 0, 0.3 + H / 2, 0);
  box(g, L + 0.04, 0.5, D + 0.04, '#8a6a4a', 0, 0.55, 0);
  for (let i = 0; i <= 6; i++) box(g, 0.24, H, 0.24, '#5a4030', -L / 2 + (i * L) / 6, 0.3 + H / 2, D / 2 + 0.06);
  box(g, L + 0.1, 0.2, 0.26, '#5a4030', 0, 0.3 + H - 0.1, D / 2 + 0.06);
  gableRoof(g, L, D, 1.6, 0.3 + H, '#8a4030', wc, 0.6, 0.16, { pal: ['#9a4430', '#8a3e2c', '#a24a33', '#7a3a2a'], moss: 0.18 });
  for (let i = 0; i < 5; i++) {
    const x = -8.8 + i * 4.4;
    box(g, 0.95, 1.85, 0.1, '#2a1f18', x, 1.22, D / 2 + 0.03);
    box(g, 1.15, 0.14, 0.16, '#5a4030', x, 2.2, D / 2 + 0.06);
    windowUnit(g, x + 1.6, 2.1, D / 2, { w: 0.5, h: 0.4, frame: '#6a4a30', shutter: null, bars: true, lit });
  }
  g.userData.boxes = [[0, 0, L / 2 + 0.2, D / 2 + 0.2]];
  return bake(g);
}

let coffeeTex = null;
function getCoffeeTex() {
  if (coffeeTex) return coffeeTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const x = cv.getContext('2d'), r = rng(9);
  x.fillStyle = '#5a3424'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { x.fillStyle = ['#7a2a1c', '#9a3a22', '#4a2a1c', '#6a4a2a', '#b84a2a'][i % 5]; x.beginPath(); x.ellipse(r() * 256, r() * 256, 2.6, 2, r() * 3, 0, 7); x.fill(); }
  coffeeTex = new THREE.CanvasTexture(cv);
  coffeeTex.colorSpace = THREE.SRGBColorSpace;
  coffeeTex.wrapS = coffeeTex.wrapT = THREE.RepeatWrapping;
  coffeeTex.repeat.set(3, 2);
  return coffeeTex;
}
export function terreiro(w = 22, d = 14) {
  const g = new THREE.Group();
  box(g, w, 1.6, d, '#b8ab96', 0, -0.55, 0);
  for (const s of [-1, 1]) { box(g, w, 0.4, 0.3, '#a8664a', 0, 0.2, (s * d) / 2); box(g, 0.3, 0.4, d, '#a8664a', (s * w) / 2, 0.2, 0); }
  const cm = new THREE.MeshStandardMaterial({ map: getCoffeeTex(), roughness: 0.9 });
  const pl = mk(new THREE.PlaneGeometry(w * 0.8, d * 0.62), cm, 0, 0.26, 0, g, -Math.PI / 2);
  pl.castShadow = false;
  for (let i = 0; i < 5; i++) mk(new THREE.ConeGeometry(0.7, 0.45, 10), M('#5a3022'), -w * 0.32 + i * w * 0.16, 0.45, d * 0.38, g);
  // rodo de madeira encostado
  const ro = box(g, 0.08, 0.08, 2.2, '#8a6440', w * 0.4, 0.5, -d * 0.3);
  ro.rotation.x = 0.4;
  g.userData.ground = 'mean';
  return g;
}

// Rancho de pau-a-pique com cobertura de sapê (etapas de construção).
export function rancho({ stage = 3, door = true } = {}) {
  const g = new THREE.Group(), L = 5, D = 4, H = 2.1;
  const frame = new THREE.Group(), walls = new THREE.Group(), roofs = [0, 1, 2].map(() => new THREE.Group());
  g.add(frame, walls, ...roofs);
  box(frame, L + 0.5, 1.3, D + 0.5, '#7a5a40', 0, -0.6, 0);
  for (const x of [-L / 2, 0, L / 2]) for (const z of [-D / 2, D / 2]) cyl(frame, 0.08, 0.11, H + 0.1, '#5a3e28', x, H / 2, z, 7);
  for (const x of [-L / 2, L / 2]) cyl(frame, 0.07, 0.09, H + 1.5, '#5a3e28', x, (H + 1.5) / 2, 0, 7);
  const ridge = cyl(frame, 0.07, 0.07, L + 0.6, '#5a3e28', 0, H + 1.5, 0, 7);
  ridge.rotation.z = Math.PI / 2;
  for (const z of [-D / 2, D / 2]) { const b = cyl(frame, 0.06, 0.06, L + 0.3, '#5a3e28', 0, H, z, 6); b.rotation.z = Math.PI / 2; }
  // paredes de barro com a trama de varas aparecendo
  const wc = '#9a7652', mud = '#a8825a';
  box(walls, L, H, 0.2, wc, 0, H / 2, -D / 2);
  for (const s of [-1, 1]) box(walls, 0.2, H, D, wc, (s * L) / 2, H / 2, 0);
  box(walls, L * 0.36, H, 0.2, wc, -L * 0.32, H / 2, D / 2);
  box(walls, L * 0.36, H, 0.2, wc, L * 0.32, H / 2, D / 2);
  if (!door) box(walls, L * 0.3, H, 0.16, '#3a2a1e', 0, H / 2, D / 2);
  const r = rng(4);
  for (let i = 0; i < 16; i++) { const z = r() > 0.5 ? D / 2 + 0.11 : -D / 2 - 0.11, x = (r() - 0.5) * (L - 0.6); if (z > 0 && Math.abs(x) < 0.9) continue; ball(walls, 0.18 + r() * 0.16, mud, x, 0.3 + r() * 1.6, z, [1.6, 1, 0.25], 0); }
  for (let i = 0; i < 5; i++) for (const z of [-D / 2 - 0.1]) box(walls, L + 0.05, 0.05, 0.06, '#6a4a30', 0, 0.3 + i * 0.4, z);
  // sapê em três partes (o jogador cobre o rancho)
  const a = Math.atan2(1.5, D / 2), sl = Math.hypot(D / 2, 1.5) + 0.7, seg = L / 3 + 0.4;
  roofs.forEach((rg, k) => {
    for (const s of [1, -1]) {
      const f = vmesh(roofFace(seg, seg, sl, a, { sp: 0.18, row: 0.32, amp: 0.035, lift: 0.1, pal: THATCH, jag: 0.16, seed: k * 2 + (s > 0 ? 1 : 0), moss: 0 }), rg);
      f.position.set(-L / 3 + (k * L) / 3, H + 1.5 - sl * Math.sin(a) + 0.08, s * (sl * Math.cos(a)));
      f.rotation.y = s > 0 ? 0 : Math.PI;
    }
    const cap = cyl(rg, 0.2, 0.2, seg, '#a8884a', -L / 3 + (k * L) / 3, H + 1.62, 0, 8);
    cap.rotation.z = Math.PI / 2;
  });
  g.userData.setStage = (n) => { walls.visible = n >= 0; roofs.forEach((rr, i) => { rr.visible = n > i; }); };
  g.userData.setStage(stage);
  g.userData.boxes = [[0, -0.6, L / 2 + 0.1, D / 2 - 0.4]];
  [frame, walls, ...roofs].forEach((x) => bake(x));
  return g;
}

// Abrigo de folhas e varas (acampamento Puri — interpretação visual): camadas de palha em "saias" sobrepostas.
export function leafShelter() {
  const g = new THREE.Group(), r = rng(8), seg = DETAIL.value < 1 ? 12 : 20;
  const pal = ['#8a8a42', '#9a9248', '#7f7a3e', '#6f8a3a', '#a89a50'].map((h) => new THREE.Color(h));
  for (let i = 0; i < 4; i++) {
    const rb = 2.15 - i * 0.5, rt = Math.max(rb - 0.78, 0.12), h = 0.78, y = i * 0.5 + (i ? 0.25 : 0);
    const gap = i === 0 ? 0.75 : 0;
    const geo = new THREE.CylinderGeometry(rt, rb, h, seg, 2, true, gap / 2 + (i ? r() * 6 : 0), Math.PI * 2 - gap).translate(0, y + h / 2, 0);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3);
    for (let k = 0; k < p.count; k++) {
      const yy = p.getY(k) - y, ang = Math.atan2(p.getZ(k), p.getX(k));
      if (yy < 0.01) p.setY(k, p.getY(k) - Math.abs(Math.sin(ang * 13 + i)) * 0.16);
      const c = pal[Math.floor(Math.abs(Math.sin(ang * 5.3 + i * 2.1)) * pal.length) % pal.length].clone().multiplyScalar(0.75 + (yy / h) * 0.35);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    mk(geo, VCM(THREE.DoubleSide), 0, 0, 0, g);
  }
  mk(new THREE.SphereGeometry(0.42, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M('#8a8a42'), 0, 2.45, 0, g).scale.set(1, 0.7, 1);
  mk(new THREE.CircleGeometry(1.95, 16), M('#2a2218'), 0, 0.03, 0, g, -Math.PI / 2);
  for (let i = 0; i < 3; i++) { const p = cyl(g, 0.04, 0.05, 0.9, '#5a4630', Math.cos(i * 2.1) * 0.12, 2.8, Math.sin(i * 2.1) * 0.12, 5); p.rotation.set(Math.sin(i * 2.1) * 0.3, 0, Math.cos(i * 2.1) * 0.3); }
  // esteira no chão da entrada
  box(g, 1.4, 0.03, 1.0, '#b89a62', 0, 0.02, 2.3);
  g.userData.circles = [[0, 0, 2.0]];
  return bake(g);
}

export function hammock(a, b, color = '#cdb98e') {
  const g = new THREE.Group(), N = 16, pos = [], idx = [], col = [];
  const dir = new THREE.Vector3().subVectors(b, a), side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  const c0 = new THREE.Color(color), c1 = new THREE.Color('#b5562a');
  for (let i = 0; i <= N; i++) {
    const t = i / N, c = new THREE.Vector3().lerpVectors(a, b, t);
    c.y -= 0.9 * 4 * t * (1 - t);
    const w = 0.45 * Math.pow(Math.sin(Math.PI * Math.min(Math.max((t - 0.12) / 0.76, 0), 1)), 0.6) + 0.02;
    pos.push(c.x + side.x * w, c.y + w * 0.35, c.z + side.z * w, c.x, c.y, c.z, c.x - side.x * w, c.y + w * 0.35, c.z - side.z * w);
    const cc = i % 4 < 2 ? c0 : c0.clone().lerp(c1, 0.45);
    for (let k = 0; k < 3; k++) col.push(cc.r, cc.g, cc.b);
    if (i < N) { const k = i * 3; idx.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  mk(geo, VCM(THREE.DoubleSide), 0, 0, 0, g);
  return g;
}

export function campfire({ lit = true, scale = 1, stones = '#6e6a64' } = {}) {
  const g = new THREE.Group();
  const s = new THREE.Group();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; ball(s, 0.21, i % 2 ? stones : '#858078', Math.cos(a) * 0.64, 0.08, Math.sin(a) * 0.64, [1.2, 0.75, 1], 1); }
  for (let i = 0; i < 4; i++) { const l = cyl(s, 0.07, 0.08, 1.1, '#3e2a1c', 0, 0.16, 0, 6); l.rotation.set(Math.PI / 2 - 0.35, (i * Math.PI) / 2, 0); }
  mk(new THREE.CircleGeometry(0.6, 12), M('#2a2420'), 0, 0.02, 0, s, -Math.PI / 2);
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
  const pts = [[0, 0], [0.18, 0.01], [0.3, 0.12], [0.33, 0.26], [0.29, 0.4], [0.2, 0.48], [0.22, 0.53], [0.19, 0.55]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 14);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color(c), b = a.clone().multiplyScalar(0.55), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); t.copy(a).lerp(b, y > 0.3 && y < 0.36 ? 0.8 : 0); col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return mk(g, VCM());
}
export function basket(c = '#b08850') {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.32, 0.22, 0.38, 14, 6, true);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color(c), b = a.clone().multiplyScalar(0.72);
  for (let i = 0; i < p.count; i++) { const k = (Math.round(p.getY(i) * 15.8) + Math.round(Math.atan2(p.getZ(i), p.getX(i)) * 2.2)) % 2 ? a : b; col[i * 3] = k.r; col[i * 3 + 1] = k.g; col[i * 3 + 2] = k.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  mk(geo, VCM(THREE.DoubleSide), 0, 0.19, 0, g);
  const rim = mk(new THREE.TorusGeometry(0.32, 0.03, 5, 16), M('#8a6638'), 0, 0.38, 0, g);
  rim.rotation.x = Math.PI / 2;
  cyl(g, 0.22, 0.22, 0.02, '#8a6638', 0, 0.01, 0, 12);
  return bake(g);
}
export function bigRock(sx = 6, sy = 4, sz = 5, c = '#a9a499') {
  let geo = new THREE.IcosahedronGeometry(1, 3);
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), base = new THREE.Color(c), moss = new THREE.Color('#5f8a3a'), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = Math.sin(x * 4.9 + y * 7.2 + z * 3.7) * 0.5 + Math.sin(x * 11.3 - z * 9.1) * 0.25;
    const r = 1 + k * 0.1;
    p.setXYZ(i, x * r, y * r, z * r);
    const st = Math.sin(Math.atan2(z, x) * 9 + Math.sin(y * 3) * 0.6) * 0.5 + 0.5;
    t.copy(base).multiplyScalar((0.8 + (k + 0.75) * 0.16) * (1 - smooth(0.6, 0.95, st) * 0.3 * smooth(-0.6, 0.2, y)));
    t.lerp(moss, smooth(0.35, 0.8, y) * 0.65).lerp(moss, smooth(-0.55, -0.85, y) * 0.5);
    col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b;
  }
  geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = mk(geo, VCM());
  m.scale.set(sx, sy, sz);
  return m;
}

export function drum(big = true) {
  const g = new THREE.Group(), h = big ? 1.0 : 0.72, r = big ? 0.3 : 0.21;
  const pts = [[r * 0.82, 0], [r * 0.95, h * 0.15], [r, h * 0.3], [r * 1.02, h * 0.6], [r * 0.97, h * 0.85], [r * 0.92, h]].map(([x, y]) => new THREE.Vector2(x, y));
  mk(new THREE.LatheGeometry(pts, 16), M('#7a4526'), 0, 0, 0, g);
  cyl(g, r * 0.95, r * 0.95, 0.03, '#e2cfa6', 0, h + 0.01, 0, 16);
  for (const y of [0.15, h - 0.12]) { const t = mk(new THREE.TorusGeometry(r * 0.99, 0.022, 5, 18), M('#3a2416'), 0, y, 0, g); t.rotation.x = Math.PI / 2; }
  // cordas de afinação
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, c = cyl(g, 0.008, 0.008, h * 0.74, '#d8c49a', Math.cos(a) * r * 1.0, h * 0.5, Math.sin(a) * r * 1.0, 3); c.rotation.z = 0.08; }
  return bake(g);
}

// Tábua de parede (madeira vertical com mata-juntas), em várias peças com tons variados.
function plankWall(p, w, h, t, c, x, y, z, ry = 0, seed = 1) {
  const r = rng(seed), n = Math.max(2, Math.round(w / 0.3)), pw = w / n, base = new THREE.Color(c);
  const grp = put(new THREE.Group(), x, y, z, p);
  grp.rotation.y = ry;
  for (let i = 0; i < n; i++) {
    const col = '#' + base.clone().multiplyScalar(0.86 + r() * 0.24).getHexString();
    box(grp, pw - 0.01, h, t, col, -w / 2 + pw * (i + 0.5), 0, 0);
    if (i) box(grp, 0.05, h, 0.04, '#' + base.clone().multiplyScalar(0.7).getHexString(), -w / 2 + pw * i, 0, t / 2 + 0.01);
  }
  return grp;
}

export function italianHouse() {
  const g = new THREE.Group(), L = 7, D = 5.5, H = 2.8, y0 = 0.7, P = 1.9, zf = D / 2 + 0.15 + P;
  const parts = { base: new THREE.Group(), frame: new THREE.Group(), walls: new THREE.Group(), roof: new THREE.Group(), detail: new THREE.Group() };
  Object.values(parts).forEach((p) => g.add(p));
  // alicerce de pedra que entra no chão + assoalho e varanda (piso caminhável)
  box(parts.base, L + 0.3, y0 + 1.5, D + 0.3, '#857c70', 0, (y0 - 1.5) / 2 - 0.06, 0);
  stones(parts.base, L + 0.32, D + 0.32, 0.05, y0 - 0.25, 7);
  const deck = new THREE.Group();
  parts.base.add(deck);
  for (let i = 0; i < 12; i++) box(deck, L + 0.3, 0.12, (D + 0.3 + P) / 12 - 0.02, i % 2 ? '#8a6440' : '#946c46', 0, y0 - 0.06, -(D + 0.3) / 2 + ((D + 0.3 + P) / 12) * (i + 0.5));
  for (const x of [-L / 2, -L / 6, L / 6, L / 2]) box(parts.base, 0.32, y0 + 1.5, 0.32, '#7d756a', x, (y0 - 1.5) / 2 - 0.06, zf - 0.2);
  // degraus de pedra na frente da varanda
  [[0.47, 0.18], [0.24, 0.53]].forEach(([top, dz]) => box(parts.base, 1.8, top + 1.4, 0.36, '#8f877a', 0, (top - 1.4) / 2, zf + dz));
  for (const x of [-L / 2, -L / 6, L / 6, L / 2]) for (const z of [-D / 2, D / 2]) box(parts.frame, 0.18, H, 0.18, '#6a4a30', x, y0 + H / 2, z);
  for (const z of [-D / 2, D / 2]) box(parts.frame, L, 0.16, 0.16, '#6a4a30', 0, y0 + H, z);
  for (const x of [-L / 2, L / 2]) box(parts.frame, 0.16, 0.16, D, '#6a4a30', x, y0 + H, 0);
  const wc = '#b07a4c';
  plankWall(parts.walls, L, H, 0.12, wc, 0, y0 + H / 2, -D / 2, Math.PI, 2);
  for (const s of [-1, 1]) plankWall(parts.walls, D, H, 0.12, wc, (s * L) / 2, y0 + H / 2, 0, s * Math.PI / 2, 3 + s);
  plankWall(parts.walls, 2.4, H, 0.12, wc, -2.3, y0 + H / 2, D / 2, 0, 6);
  plankWall(parts.walls, 2.4, H, 0.12, wc, 2.3, y0 + H / 2, D / 2, 0, 7);
  plankWall(parts.walls, 2.2, 0.6, 0.12, wc, 0, y0 + H - 0.3, D / 2, 0, 8);
  for (const s of [-1, 1]) for (const zz of [-1, 1]) box(parts.walls, 0.2, H, 0.2, '#6a4a30', s * L / 2, y0 + H / 2, zz * D / 2);
  gableRoof(parts.roof, L, D, 1.9, y0 + H, '#9a4a30', wc, 0.55);
  door(parts.detail, 0, D / 2 + 0.06, { y: y0, h: 2.1, c: '#4f6a3a', frame: '#e8dcc4' });
  windowUnit(parts.detail, -2.2, y0 + 1.5, D / 2 + 0.08, { shutter: '#4f7a4a', w: 0.9, h: 1.1, frame: '#e8dcc4' });
  windowUnit(parts.detail, 2.2, y0 + 1.5, D / 2 + 0.08, { shutter: '#4f7a4a', w: 0.9, h: 1.1, frame: '#e8dcc4' });
  for (const x of [-L / 2, -1.2, 1.2, L / 2]) box(parts.detail, 0.15, 2.2, 0.15, '#6a4a30', x, y0 + 1.1, zf - 0.2);
  const pr = new THREE.Group();
  pr.position.set(0, y0 + 2.42, D / 2 + 1.05);
  pr.rotation.x = 0.2;
  parts.detail.add(pr);
  box(pr, L + 0.4, 0.08, 2.4, '#5a3e2c', 0, -0.06, 0);
  const pf = vmesh(roofFace(L + 0.4, L + 0.4, 2.4, 0, { pal: TILE, seed: 21 }), pr, 0, 0, 1.2);
  pf.rotation.set(0, 0, 0);
  for (const s of [-1, 1]) {
    box(parts.detail, L / 2 - 1.2, 0.09, 0.07, '#6a4a30', s * (1.2 + (L / 2 - 1.2) / 2), y0 + 0.9, zf - 0.2);
    for (let i = 0; i < 4; i++) box(parts.detail, 0.05, 0.85, 0.05, '#6a4a30', s * (1.45 + i * 0.6), y0 + 0.45, zf - 0.2);
  }
  // chaminé de pedra com fumaça
  box(parts.detail, 0.75, 5.6, 0.75, '#7d756a', L / 2 - 0.8, y0 + 1.9, -D / 2 + 0.6);
  box(parts.detail, 0.9, 0.18, 0.9, '#6a635a', L / 2 - 0.8, y0 + 4.75, -D / 2 + 0.6);
  // vasos de flores no parapeito
  for (const x of [-2.2, 2.2]) { box(parts.detail, 0.9, 0.18, 0.22, '#9a5a3a', x, y0 + 0.92, D / 2 + 0.25); for (let k = 0; k < 4; k++) ball(parts.detail, 0.09, ['#e84a4a', '#f0d040', '#e86aa0', '#ffffff'][k], x - 0.33 + k * 0.22, y0 + 1.07, D / 2 + 0.25, [1, 0.8, 1], 0); }
  const smoke = particles({ count: 24, mode: 3, spread: [0.5, 7, 0.5], color: '#cfcac2', size: 1, rate: 0.07, opacity: 0.22, additive: false });
  smoke.position.set(L / 2 - 0.8, y0 + 4.8, -D / 2 + 0.6);
  parts.detail.add(smoke);
  const order = ['base', 'frame', 'walls', 'roof', 'detail'];
  g.userData.setStage = (n) => order.forEach((k, i) => { parts[k].visible = i === 0 || (k === 'frame' ? n >= 0 && n < 2 : i - 1 <= n); });
  g.userData.setStage(3);
  order.forEach((k) => bake(parts[k]));
  // piso, varanda e degraus são caminháveis; as paredes só bloqueiam depois de erguidas (wallBox)
  g.userData.surfaces = [[0, P / 2, L / 2 + 0.15, (D + 0.3 + P) / 2, y0], [0, zf + 0.18, 0.9, 0.18, 0.47], [0, zf + 0.53, 0.9, 0.18, 0.24]];
  g.userData.wallBox = [0, 0, L / 2 + 0.15, D / 2 + 0.15];
  g.userData.porch = [0, D / 2 + 0.15 + P / 2];
  g.userData.ground = 'max';
  return g;
}

export function chapel() {
  const g = new THREE.Group(), L = 5, D = 8, H = 4, wc = '#f4efe4', tr = '#e0b84a';
  plinth(g, L + 0.5, D + 0.5, 0.4, '#8a837a');
  box(g, L, H, D, wc, 0, 0.4 + H / 2, 0);
  box(g, L + 0.04, 0.6, D + 0.04, '#c8b890', 0, 0.7, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.4, H, 0.4, tr, sx * L / 2, 0.4 + H / 2, sz * D / 2);
  box(g, L + 0.3, 0.25, D + 0.3, tr, 0, 0.4 + H, 0);
  const r = new THREE.Group();
  gableRoof(r, D, L, 2.2, 0.4 + H + 0.1, '#b0503a', null, 0.4);
  r.rotation.y = Math.PI / 2;
  g.add(r);
  // frontão
  mk(prism(0.3, L + 0.2, 2.3), M(wc), 0, 0.4 + H + 0.12, D / 2 + 0.05, g, 0, Math.PI / 2, 0);
  for (const s of [-1, 1]) { const e = box(g, Math.hypot(L / 2 + 0.2, 2.3) + 0.2, 0.2, 0.36, tr, s * (L / 4 + 0.05), 0.4 + H + 1.27, D / 2 + 0.06); e.rotation.z = -s * Math.atan2(2.3, L / 2 + 0.1); }
  door(g, 0, D / 2 + 0.03, { y: 0.4, h: 2.4, w: 1.3, c: '#3d6b8f', frame: tr });
  const rose = mk(new THREE.CircleGeometry(0.4, 16), glow('#e8c27a', 0.6), 0, 0.4 + H + 0.8, D / 2 + 0.22, g);
  rose.castShadow = false;
  const rr = mk(new THREE.TorusGeometry(0.42, 0.07, 6, 18), M(tr), 0, 0.4 + H + 0.8, D / 2 + 0.22, g);
  rr.castShadow = false;
  // campanário
  box(g, 1.4, 1.7, 1.4, wc, 0, 0.4 + H + 2.55, D / 2 - 0.7);
  box(g, 1.6, 0.18, 1.6, tr, 0, 0.4 + H + 3.45, D / 2 - 0.7);
  box(g, 0.7, 0.8, 1.45, '#2a2420', 0, 0.4 + H + 2.65, D / 2 - 0.7);
  mk(new THREE.ConeGeometry(1.1, 1.3, 4), M('#b0503a'), 0, 0.4 + H + 4.2, D / 2 - 0.7, g, 0, Math.PI / 4, 0);
  mk(new THREE.ConeGeometry(0.22, 0.35, 10, 1, true), M('#c9a24a', { metalness: 0.6, roughness: 0.4 }), 0, 0.4 + H + 2.5, D / 2 - 0.7, g);
  box(g, 0.08, 0.9, 0.08, tr, 0, 0.4 + H + 5.2, D / 2 - 0.7);
  box(g, 0.45, 0.08, 0.08, tr, 0, 0.4 + H + 5.4, D / 2 - 0.7);
  for (const s of [-1, 1]) for (const z of [-1.8, 1.4]) windowUnit(g, (s * L) / 2 + s * 0.05, 2.6, z, { w: 0.6, h: 1.3, shutter: null, frame: tr, arch: true }, (s * Math.PI) / 2);
  for (let i = 0; i < 3; i++) box(g, 2.4 - i * 0.2, 0.2, 0.5, '#9a9286', 0, 0.3 - i * 0.2, D / 2 + 0.4 + i * 0.35);
  g.userData.boxes = [[0, 0, L / 2 + 0.2, D / 2 + 0.2]];
  return bake(g);
}

export function church({ lit = false } = {}) {
  const g = new THREE.Group(), L = 9, D = 17, H = 7, wc = '#f4efe4', tr = '#e0b84a';
  plinth(g, L + 1, D + 1, 0.6, '#8a837a');
  box(g, L, H, D, wc, 0, 0.6 + H / 2, 0);
  box(g, L + 0.04, 0.7, D + 0.04, '#c8b890', 0, 0.95, 0);
  for (let i = 0; i <= 4; i++) for (const s of [-1, 1]) box(g, 0.45, H, 0.45, tr, s * L / 2, 0.6 + H / 2, -D / 2 + (i * D) / 4);
  box(g, L + 0.4, 0.3, D + 0.3, tr, 0, 0.6 + H, 0);
  const r = new THREE.Group();
  gableRoof(r, D, L, 3, 0.6 + H + 0.12, '#a84a34', null, 0.45);
  r.rotation.y = Math.PI / 2;
  g.add(r);
  // fachada com frontão e torre central
  box(g, L + 0.6, H + 1.2, 0.6, wc, 0, 0.6 + (H + 1.2) / 2, D / 2);
  for (const s of [-1, 1]) box(g, 0.6, H + 1.2, 0.8, tr, (s * (L + 0.6)) / 2, 0.6 + (H + 1.2) / 2, D / 2 + 0.05);
  box(g, L + 1.2, 0.35, 0.9, tr, 0, 0.6 + H + 1.2, D / 2 + 0.05);
  const ped = mk(prism(0.6, L + 0.6, 2.6), M(wc), 0, 0.6 + H + 1.35, D / 2, g, 0, Math.PI / 2, 0);
  ped.rotation.y = Math.PI / 2;
  for (const s of [-1, 1]) { const e = box(g, Math.hypot(L / 2 + 0.3, 2.6) + 0.3, 0.26, 0.75, tr, s * (L / 4 + 0.1), 0.6 + H + 2.7, D / 2 + 0.05); e.rotation.z = -s * Math.atan2(2.6, L / 2 + 0.3); }
  box(g, 3.2, 6, 3.2, wc, 0, 0.6 + H + 4.4, D / 2 - 1.8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.35, 6, 0.35, tr, sx * 1.6, 0.6 + H + 4.4, D / 2 - 1.8 + sz * 1.6);
  for (const s of [0, 1, 2, 3]) { const op = box(g, 1.1, 1.8, 0.2, '#2a2420', 0, 0.6 + H + 5.4, 0); op.position.set(Math.sin(s * Math.PI / 2) * 1.55, 0.6 + H + 5.4, D / 2 - 1.8 + Math.cos(s * Math.PI / 2) * 1.55); op.rotation.y = s * Math.PI / 2; }
  box(g, 3.5, 0.32, 3.5, tr, 0, 0.6 + H + 7.4, D / 2 - 1.8);
  mk(new THREE.ConeGeometry(2.4, 3, 4), M('#a84a34'), 0, 0.6 + H + 9.05, D / 2 - 1.8, g, 0, Math.PI / 4, 0);
  box(g, 0.14, 1.6, 0.14, '#c9a24a', 0, 0.6 + H + 11.3, D / 2 - 1.8);
  box(g, 0.8, 0.14, 0.14, '#c9a24a', 0, 0.6 + H + 11.6, D / 2 - 1.8);
  door(g, 0, D / 2 + 0.33, { y: 0.6, w: 2, h: 3.4, c: '#3d5f80', frame: tr });
  const ar = mk(new THREE.CylinderGeometry(1.15, 1.15, 0.2, 14, 1, false, -Math.PI / 2, Math.PI), M(tr), 0, 0.6 + 3.5, D / 2 + 0.36, g, -Math.PI / 2, 0, 0);
  ar.castShadow = false;
  for (const s of [-1, 1]) windowUnit(g, s * 2.8, 4.2, D / 2 + 0.33, { w: 0.9, h: 1.8, shutter: null, frame: tr, lit, arch: true });
  windowUnit(g, 0, 6.3, D / 2 + 0.33, { w: 1.1, h: 1.1, shutter: null, frame: tr, lit, arch: true });
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) windowUnit(g, s * (L / 2 + 0.03), 4, -D / 2 + 2.2 + i * 4.25, { w: 0.8, h: 2, shutter: null, frame: tr, lit, arch: true }, (s * Math.PI) / 2);
  for (let i = 0; i < 3; i++) box(g, 4 - i * 0.3, 0.22, 0.6, '#9a9286', 0, 0.5 - i * 0.22, D / 2 + 0.7 + i * 0.45);
  g.userData.boxes = [[0, 0, L / 2 + 0.5, D / 2 + 0.6]];
  return bake(g);
}

// Sobrado colonial da vila: fachada colorida com platibanda, cunhais, cimalha e telhado de telhas.
export function townHouse({ w = 7, d = 6, h = 3.4, color = '#e7c26a', trim = '#f4efe4', roof = '#a8503a', shutter = '#3d6b8f', lit = false, doorC = '#5a3a22', seed = 1 } = {}) {
  const g = new THREE.Group(), y0 = 0.4, r = rng(seed * 7 + 3);
  plinth(g, w + 0.24, d + 0.24, y0, '#8a837a');
  box(g, w, h, d, color, 0, y0 + h / 2, 0);
  box(g, w + 0.06, 0.55, d + 0.06, '#' + new THREE.Color(color).multiplyScalar(0.62).getHexString(), 0, y0 + 0.28, 0);
  for (const s of [-1, 1]) box(g, 0.34, h, 0.34, trim, s * (w / 2), y0 + h / 2, d / 2);
  box(g, w + 0.3, 0.3, d + 0.12, trim, 0, y0 + h - 0.05, 0);
  gableRoof(g, w, d, 1.6, y0 + h + 0.1, roof, color, 0.45);
  // platibanda (parapeito decorado) na frente
  const ph = 0.9;
  box(g, w + 0.2, ph, 0.3, color, 0, y0 + h + ph / 2 + 0.05, d / 2 + 0.05);
  box(g, w + 0.36, 0.16, 0.42, trim, 0, y0 + h + ph + 0.12, d / 2 + 0.05);
  for (const s of [-1, 1]) { box(g, 0.38, ph + 0.2, 0.38, trim, s * (w / 2 + 0.02), y0 + h + ph / 2 + 0.1, d / 2 + 0.05); ball(g, 0.16, trim, s * (w / 2 + 0.02), y0 + h + ph + 0.36, d / 2 + 0.05, [1, 1.3, 1], 1); }
  if (r() > 0.4) { const cr = mk(new THREE.CylinderGeometry(0.8, 0.8, 0.3, 12, 1, false, -Math.PI / 2, Math.PI), M(color), 0, y0 + h + ph + 0.05, d / 2 + 0.05, g, -Math.PI / 2, 0, 0); cr.scale.set(1, 1, 0.55); }
  for (let i = -1; i <= 1; i++) if (i) box(g, 0.6, 0.35, 0.06, trim, i * w / 4, y0 + h + ph / 2, d / 2 + 0.22);
  door(g, 0, d / 2 + 0.03, { y: y0, c: doorC, frame: trim });
  const nw = w > 7.4 ? 3 : 2;
  for (let i = 0; i < nw; i++) {
    const x = nw === 2 ? (i ? 1 : -1) * w / 3.2 : (i - 1) * w / 3;
    if (Math.abs(x) < 0.9) continue;
    windowUnit(g, x, y0 + h * 0.55, d / 2 + 0.05, { w: 0.9, h: 1.3, shutter, frame: trim, lit });
  }
  // calçada de pedra na frente
  box(g, w + 0.6, 0.12, 1.2, '#a8a094', 0, 0.06, d / 2 + 0.6);
  g.userData.boxes = [[0, 0, w / 2 + 0.12, d / 2 + 0.12]];
  return bake(g);
}

export function store() {
  const g = new THREE.Group(), w = 9, d = 6.5, h = 3.8, y0 = 0.45, wc = '#dfae70', trim = '#f2e6cc';
  const shell = new THREE.Group(), closed = new THREE.Group(), open = new THREE.Group();
  g.add(shell, closed, open);
  plinth(shell, w + 0.24, d + 0.24, y0, '#8a837a');
  box(shell, w, h, d, wc, 0, y0 + h / 2, 0);
  box(shell, w + 0.06, 0.6, d + 0.06, '#a8784a', 0, y0 + 0.3, 0);
  for (const s of [-1, 1]) box(shell, 0.36, h, 0.36, trim, s * w / 2, y0 + h / 2, d / 2);
  box(shell, w + 0.3, 0.34, d + 0.12, trim, 0, y0 + h - 0.1, 0);
  gableRoof(shell, w, d, 1.8, y0 + h + 0.1, '#9a4a30', wc, 0.5);
  box(shell, w + 0.2, 1.1, 0.3, wc, 0, y0 + h + 0.6, d / 2 + 0.05);
  box(shell, w + 0.36, 0.16, 0.42, trim, 0, y0 + h + 1.2, d / 2 + 0.05);
  // toldo de madeira com telhas
  const aw = new THREE.Group();
  aw.position.set(0, y0 + h - 0.55, d / 2 + 0.05);
  aw.rotation.x = 0.24;
  shell.add(aw);
  box(aw, w + 0.6, 0.08, 1.9, '#6a3a2a', 0, -0.05, 0.95);
  vmesh(roofFace(w + 0.6, w + 0.6, 1.9, 0, { pal: TILE, seed: 31 }), aw, 0, 0, 1.9);
  for (const x of [-w / 2, 0, w / 2]) box(shell, 0.14, h - 0.6, 0.14, '#5a3a24', x, y0 + (h - 0.6) / 2, d / 2 + 1.72);
  for (const x of [-3, 0, 3]) {
    box(shell, 1.95, 0.22, 0.18, trim, x, y0 + 2.6, d / 2 + 0.04);
    for (const s of [-1, 1]) box(shell, 0.2, 2.6, 0.18, trim, x + s * 0.875, y0 + 1.3, d / 2 + 0.04);
    box(shell, 1.55, 2.5, 0.04, '#2a1e16', x, y0 + 1.25, d / 2 + 0.0);
    box(closed, 1.55, 2.5, 0.1, '#6a4a30', x, y0 + 1.25, d / 2 + 0.07);
    for (const s of [-1, 1]) box(closed, 0.72, 2.4, 0.05, '#7a5636', x + s * 0.38, y0 + 1.25, d / 2 + 0.12);
    box(open, 1.55, 2.5, 0.06, glow('#ffc070', 1.2), x, y0 + 1.25, d / 2 + 0.03);
  }
  const blank = box(closed, 5.4, 0.9, 0.08, '#7a5a3a', 0, y0 + h + 0.55, d / 2 + 0.24);
  blank.castShadow = false;
  const sg = signMesh(['ARMAZÉM YOUSSEF', 'SECOS E MOLHADOS · TECIDOS · ARMARINHO'], 5.4, 1.05, { size: 112, lit: 0.25 });
  sg.position.set(0, y0 + h + 0.58, d / 2 + 0.27);
  open.add(sg);
  const light = new THREE.PointLight('#ffb866', 0, 12, 1.6);
  light.position.set(0, 2.4, d / 2 + 1.5);
  g.add(light);
  // mercadorias na calçada
  box(shell, w + 0.8, 0.14, 2.1, '#a8a094', 0, y0 - 0.07, d / 2 + 1.0);
  for (let i = 0; i < 3; i++) put(sack(), -4.2 + i * 0.75, y0, d / 2 + 0.9, g);
  for (let i = 0; i < 2; i++) put(barrel(), 3.6 + i * 0.85, y0, d / 2 + 0.8, g);
  put(crate(0.55), 4.1, y0, d / 2 + 1.6, g);
  box(open, 2.2, 0.08, 0.8, '#6a4a30', -1.8, 1.25, d / 2 + 1.0);
  for (const s of [-1, 1]) box(open, 0.08, 0.8, 0.7, '#5a3a24', -1.8 + s * 1.0, 0.85, d / 2 + 1.0);
  ['#c0392b', '#2e86c1', '#f1c40f', '#27ae60', '#8e44ad'].forEach((c, i) => {
    const r = cyl(open, 0.1, 0.1, 0.75, c, -2.6 + i * 0.4, 1.4, d / 2 + 1.0, 10);
    r.rotation.x = Math.PI / 2;
  });
  g.userData.setOpen = (on) => { closed.visible = !on; open.visible = on; light.intensity = on ? 9 : 0; };
  g.userData.setOpen(false);
  [shell, closed].forEach((x) => bake(x));
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
  const g = new THREE.Group(), PL = 26, PD = 4, PH = 0.9, wc = '#efe2c4', tr = '#9a4a32';
  // plataforma com borda de pedra
  box(g, PL, PH + 1.5, PD, '#9a8f80', 0, (PH - 1.5) / 2, -PD / 2 - 1.5);
  box(g, PL, 0.14, 0.4, '#d8cdb8', 0, PH + 0.01, -1.65);
  for (let i = 0; i < 12; i++) box(g, PL / 12 - 0.04, 0.03, PD - 0.5, i % 2 ? '#b0a492' : '#a89c8a', -PL / 2 + (PL / 12) * (i + 0.5), PH + 0.005, -PD / 2 - 1.75);
  const bx = 0, bz = -PD - 2.6;
  box(g, 10, 4, 5, wc, bx, PH + 2, bz);
  box(g, 10.05, 0.9, 5.05, tr, bx, PH + 0.45, bz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.36, 4, 0.36, '#d8c49a', bx + sx * 5, PH + 2, bz + sz * 2.5);
  box(g, 10.3, 0.26, 5.3, '#d8c49a', bx, PH + 3.95, bz);
  box(g, 10, PH + 1.5, 5, '#8a7a68', bx, (PH - 1.5) / 2, bz);
  gableRoof(put(new THREE.Group(), bx, 0, bz, g), 10, 5, 1.6, PH + 4.05, '#8a3a2a', wc, 0.4);
  // cobertura da plataforma sobre colunas com mãos-francesas
  const ov = new THREE.Group();
  ov.position.set(bx, PH + 3.7, bz + 2.5);
  ov.rotation.x = 0.12;
  g.add(ov);
  box(ov, 14, 0.12, 3.9, '#6a3426', 0, -0.06, 1.95);
  vmesh(roofFace(14, 14, 3.9, 0, { pal: TILE, seed: 41 }), ov, 0, 0, 3.9);
  for (let i = -3; i <= 3; i++) {
    box(g, 0.16, 3.45, 0.16, '#4a3a30', bx + i * 2.2, PH + 1.75, -2.4);
    const br = box(g, 0.1, 0.9, 0.1, '#4a3a30', bx + i * 2.2, PH + 3.15, -2.65);
    br.rotation.x = -0.7;
  }
  door(g, bx, bz + 2.53, { y: PH, w: 1.3, h: 2.5, c: '#4a6a7a', frame: '#d8c49a' });
  for (const s of [-1, 1]) windowUnit(g, bx + s * 3, PH + 2, bz + 2.55, { w: 1.1, h: 1.6, shutter: '#4a6a7a', lit, frame: '#d8c49a' });
  const sg = signMesh([name], 5, 0.8, { size: 120, lit: lit ? 0.5 : 0.1 });
  sg.position.set(bx, PH + 3.3, bz + 2.66);
  g.add(sg);
  const ck = new THREE.Mesh(new THREE.CircleGeometry(0.35, 20), new THREE.MeshStandardMaterial({ map: clockTex(), roughness: 0.6 }));
  ck.material.userData.own = true;
  ck.position.set(bx + 3.4, PH + 3.3, bz + 2.66);
  g.add(ck);
  const ckr = mk(new THREE.TorusGeometry(0.37, 0.05, 6, 20), M('#3a2a20'), bx + 3.4, PH + 3.3, bz + 2.64, g);
  ckr.castShadow = false;
  for (const s of [-1, 1]) {
    box(g, 1.8, 0.1, 0.5, '#6a4a30', bx + s * 5.5, PH + 0.5, -4.2);
    box(g, 1.8, 0.5, 0.08, '#6a4a30', bx + s * 5.5, PH + 0.8, -4.45);
    for (const t of [-0.75, 0.75]) box(g, 0.08, 0.5, 0.45, '#2a2a2a', bx + s * 5.5 + t, PH + 0.25, -4.2);
  }
  const bell = mk(new THREE.ConeGeometry(0.16, 0.28, 12, 1, true), M('#c9a24a', { metalness: 0.6, roughness: 0.4 }), bx - 4, PH + 2.8, bz + 2.7, g);
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
  const n = Math.floor(path.len / 0.75), sleepers = new THREE.InstancedMesh(boxGeo(0.28, 0.14, 2.5), M('#4a3628'), n);
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const q = path.at(i * 0.75);
    o.position.set(q.x, W.heightAt(q.x, q.z) + 0.07, q.z);
    o.rotation.set(0, q.ang + (Math.sin(i * 7.3) * 0.03), 0);
    o.updateMatrix();
    sleepers.setMatrixAt(i, o.matrix);
  }
  sleepers.receiveShadow = true;
  g.add(sleepers);
  // lastro de brita sob os dormentes
  const ballast = new THREE.Group();
  const rails = new THREE.Group();
  for (let i = 0; i < path.p.length - 1; i++) {
    const a = path.p[i], b = path.p[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z), ang = Math.atan2(-(b.z - a.z), b.x - a.x);
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, y = (W.heightAt(a.x, a.z) + W.heightAt(b.x, b.z)) / 2 + 0.2;
    for (const s of [-0.72, 0.72]) {
      const r = box(rails, len + 0.05, 0.12, 0.08, M('#6a6a70', { metalness: 0.6, roughness: 0.45 }), mx + Math.sin(ang) * s, y, mz + Math.cos(ang) * s);
      r.rotation.y = ang;
    }
    const bl = box(ballast, len + 0.1, 0.5, 3.1, '#8a8278', mx, y - 0.42, mz);
    bl.rotation.y = ang;
  }
  g.add(bake(rails, { ao: false }));
  g.add(bake(ballast, { ao: false }));
  parent.add(g);
  return path;
}

function wheel(p, r, x, z, c = '#8a1f18') {
  const w = new THREE.Group();
  w.position.set(x, r, z);
  w.rotation.x = Math.PI / 2;
  p.add(w);
  cyl(w, r, r, 0.12, c, 0, 0, 0, 18);
  const rim = mk(new THREE.TorusGeometry(r * 0.96, 0.04, 5, 18), M('#2a2a2a'), 0, Math.sign(z) * 0.07, 0, w, Math.PI / 2);
  rim.castShadow = false;
  const hub = cyl(w, r * 0.25, r * 0.25, 0.18, '#2a2a2a', 0, 0, 0, 10);
  hub.castShadow = false;
  for (let i = 0; i < 4; i++) { const sp = box(w, r * 1.7, 0.06, 0.05, '#2a2a2a', 0, Math.sign(z) * 0.065, 0); sp.rotation.y = (i / 4) * Math.PI; sp.castShadow = false; }
  bake(w, { ao: false });
  w.userData.dynamic = true;
  return w;
}
export function locomotive() {
  const g = new THREE.Group(), wheels = [];
  const black = M('#1e1e22', { metalness: 0.35, roughness: 0.5 }), brass = M('#c9a24a', { metalness: 0.7, roughness: 0.35 }), red = M('#8a1f18');
  box(g, 7.6, 0.35, 2.1, black, 0, 1.0, 0);
  const boiler = cyl(g, 0.78, 0.78, 4.6, black, 0.8, 2.0, 0, 20); boiler.rotation.z = Math.PI / 2;
  for (const x of [-0.6, 0.8, 2.2]) { const b = cyl(g, 0.81, 0.81, 0.1, brass, x, 2.0, 0, 20); b.rotation.z = Math.PI / 2; }
  const sb = cyl(g, 0.84, 0.84, 0.7, M('#2a2a2e'), 3.3, 2.0, 0, 20); sb.rotation.z = Math.PI / 2;
  cyl(g, 0.22, 0.3, 1.2, black, 3.1, 3.2, 0, 12);
  cyl(g, 0.44, 0.24, 0.45, black, 3.1, 3.9, 0, 12);
  mk(new THREE.SphereGeometry(0.36, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), brass, 1.2, 2.7, 0, g);
  mk(new THREE.SphereGeometry(0.28, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), black, -0.2, 2.72, 0, g);
  box(g, 2.2, 2.1, 2.3, M('#6a1a16'), -2.3, 2.3, 0);
  box(g, 2.6, 0.16, 2.6, black, -2.3, 3.42, 0);
  for (const s of [-1, 1]) box(g, 0.9, 0.7, 0.06, glow('#ffcf80', 0.8), -2.0, 2.8, s * 1.16);
  box(g, 0.3, 0.5, 2.3, red, 3.75, 1.1, 0);
  const lamp = cyl(g, 0.2, 0.22, 0.32, black, 3.6, 3.0, 0, 12); lamp.rotation.z = Math.PI / 2;
  mk(new THREE.CircleGeometry(0.15, 14), glow('#fff2c0', 3), 3.77, 3.0, 0, g, 0, Math.PI / 2, 0);
  const cc = mk(new THREE.ConeGeometry(0.9, 0.9, 4), red, 4.1, 0.55, 0, g, 0, Math.PI / 4, -Math.PI / 2);
  cc.scale.set(1, 0.6, 1.1);
  for (const s of [-1, 1]) {
    for (const x of [-1.5, -0.1, 1.3]) wheels.push(wheel(g, 0.62, x, s * 1.0));
    wheels.push(wheel(g, 0.4, 2.8, s * 1.0, '#2a2a2e'));
    const rod = box(g, 2.9, 0.08, 0.06, M('#9a9aa2', { metalness: 0.8, roughness: 0.3 }), -0.1, 0.62, s * 1.12);
    rod.userData.rod = true;
    box(g, 4.4, 0.08, 0.5, black, 0.8, 1.25, s * 1.05);
  }
  const smoke = particles({ count: 60, mode: 3, spread: [-3.5, 10, 1.5], color: '#4a4744', size: 1.6, rate: 0.12, opacity: 0.4, additive: false });
  smoke.position.set(3.1, 4.1, 0);
  g.add(smoke);
  g.userData.wheels = wheels;
  g.userData.smoke = smoke;
  return bake(g, { ao: false });
}
export function wagon(type = 'open') {
  const g = new THREE.Group(), wheels = [];
  const wood = type === 'passenger' ? '#2f5a3a' : '#7a4a2e';
  box(g, 6.2, 0.3, 2.2, M('#1e1e22'), 0, 0.95, 0);
  if (type === 'open') {
    for (const s of [-1, 1]) { plankWall(g, 6.2, 0.9, 0.12, wood, 0, 1.55, s * 1.05, 0, 3 + s); box(g, 0.12, 0.9, 2.2, wood, s * 3.05, 1.55, 0); }
  } else {
    box(g, 6.2, 2.2, 2.3, wood, 0, 2.2, 0);
    for (let i = -3; i <= 3; i++) for (const s of [-1, 1]) box(g, 0.08, 2.2, 0.05, '#' + new THREE.Color(wood).multiplyScalar(0.7).getHexString(), i * 1.0, 2.2, s * 1.16);
    const rf = cyl(g, 1.2, 1.2, 6.4, '#3a3a3a', 0, 3.3, 0, 16);
    rf.rotation.z = Math.PI / 2; rf.scale.set(0.22, 1, 1);
    if (type === 'passenger') for (let i = 0; i < 5; i++) for (const s of [-1, 1]) box(g, 0.7, 0.6, 0.05, glow('#ffd590', 0.9), -2.4 + i * 1.2, 2.5, s * 1.17);
    else box(g, 1.6, 1.8, 0.05, M('#5a3a24'), 0, 2.1, 1.17);
  }
  for (const s of [-1, 1]) for (const x of [-2.2, 2.2]) wheels.push(wheel(g, 0.42, x, s * 1.0, '#2a2a2e'));
  g.userData.wheels = wheels;
  return bake(g, { ao: false });
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
  ball(g, 0.32, c, 0, 0.3, 0, [1, 1.12, 0.78], 2);
  cyl(g, 0.11, 0.17, 0.14, c, 0, 0.66, 0, 8);
  cyl(g, 0.12, 0.12, 0.04, '#6a4a2a', 0, 0.62, 0, 8);
  box(g, 0.34, 0.12, 0.02, '#7a5a3a', 0, 0.36, 0.25);
  return bake(g);
}
export function barrel() {
  const g = new THREE.Group();
  const pts = [[0.26, 0], [0.31, 0.12], [0.34, 0.3], [0.345, 0.43], [0.34, 0.56], [0.31, 0.74], [0.26, 0.86]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(pts, 16);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color('#8a5a34'), r = rng(3);
  const tone = Array.from({ length: 17 }, () => 0.85 + r() * 0.25);
  for (let i = 0; i < p.count; i++) { const k = tone[Math.floor(i / pts.length) % 17]; col[i * 3] = a.r * k; col[i * 3 + 1] = a.g * k; col[i * 3 + 2] = a.b * k; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  mk(geo, VCM(), 0, 0, 0, g);
  cyl(g, 0.26, 0.26, 0.02, '#6a4426', 0, 0.85, 0, 16);
  for (const y of [0.13, 0.3, 0.56, 0.73]) { const t = mk(new THREE.TorusGeometry(y < 0.2 || y > 0.7 ? 0.315 : 0.345, 0.018, 4, 18), M('#3a3a3a'), 0, y, 0, g); t.rotation.x = Math.PI / 2; }
  return bake(g);
}
export function crate(s = 0.6, c = '#9a7044') {
  const g = new THREE.Group();
  box(g, s * 0.94, s * 0.94, s * 0.94, c, 0, s / 2, 0);
  const d = '#6a4a2a';
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    box(g, s, s * 0.12, s * 0.12, d, 0, s / 2 + a * s * 0.44, b * s * 0.44);
    box(g, s * 0.12, s, s * 0.12, d, a * s * 0.44, s / 2, b * s * 0.44);
    box(g, s * 0.12, s * 0.12, s, d, a * s * 0.44, s / 2 + b * s * 0.44, 0);
  }
  return bake(g);
}
export function planks(n = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) box(g, 2.6, 0.08, 0.28, i % 2 ? '#b88a5a' : '#c49864', 0, 0.06 + i * 0.09, (i % 3) * 0.3 - 0.3, (i % 2) * 0.05);
  return bake(g);
}
export function sapeBundle() {
  const g = new THREE.Group();
  const b = cyl(g, 0.16, 0.22, 1.5, '#c9a95e', 0, 0, 0, 10);
  b.rotation.z = Math.PI / 2;
  for (const x of [-0.4, 0.4]) { const t = cyl(g, 0.19, 0.19, 0.07, '#6a4a2a', x, 0, 0, 10); t.rotation.z = Math.PI / 2; }
  return bake(g);
}
export function chest(c = '#6a4a30') {
  const g = new THREE.Group();
  box(g, 0.9, 0.5, 0.55, c, 0, 0.25, 0);
  const lid = cyl(g, 0.275, 0.275, 0.9, c, 0, 0.5, 0, 12);
  lid.rotation.z = Math.PI / 2;
  lid.scale.set(1, 1, 0.55);
  for (const x of [-0.3, 0.3]) box(g, 0.06, 0.55, 0.58, '#3a3a3a', x, 0.3, 0);
  box(g, 0.12, 0.14, 0.04, '#c9a24a', 0, 0.45, 0.29);
  return bake(g);
}
export function cart(load = null) {
  const g = new THREE.Group();
  box(g, 2.6, 0.12, 1.4, '#8a6440', 0, 0.85, 0);
  for (const s of [-1, 1]) plankWall(g, 2.6, 0.35, 0.06, '#7a5434', 0, 1.05, s * 0.68, 0, 5 + s);
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(0, 0.7, s * 0.82); w.rotation.x = Math.PI / 2;
    g.add(w);
    const t = mk(new THREE.TorusGeometry(0.64, 0.07, 6, 18), M('#6a4a30'), 0, 0, 0, w); t.rotation.x = Math.PI / 2;
    cyl(w, 0.12, 0.12, 0.16, '#4a3420', 0, 0, 0, 8);
    for (let i = 0; i < 6; i++) { const sp = box(w, 1.25, 0.05, 0.05, '#7a5434', 0, 0, 0); sp.rotation.y = (i / 6) * Math.PI; }
  }
  const ax = cyl(g, 0.05, 0.05, 1.8, '#3a2a1e', 0, 0.7, 0, 6); ax.rotation.x = Math.PI / 2;
  const pole = cyl(g, 0.05, 0.06, 3, '#6a4a30', 2.6, 0.75, 0, 6);
  pole.rotation.z = Math.PI / 2 - 0.1;
  if (load === 'sacks') for (let i = 0; i < 4; i++) put(sack(), -0.8 + (i % 2) * 0.8, 0.95, i < 2 ? -0.3 : 0.3, g);
  if (load === 'planks') { const p = planks(6); p.position.y = 0.92; g.add(p); }
  g.userData.circles = [[0, 0, 1.3]];
  return bake(g);
}
export function mule(load = true) {
  const g = new THREE.Group(), c = '#6a5646', dark = '#3a2e26', muzzle = '#a89482';
  const body = mk(new THREE.CapsuleGeometry(0.4, 0.95, 6, 14), M(c), 0, 1.25, 0, g, 0, 0, Math.PI / 2);
  body.scale.set(1, 1, 0.82);
  ball(g, 0.36, c, -0.5, 1.3, 0, [1, 1, 0.85], 2);
  const legs = [];
  for (const x of [-0.55, 0.55]) for (const z of [-0.22, 0.22]) {
    const l = new THREE.Group();
    l.position.set(x, 1.05, z);
    mk(new THREE.CapsuleGeometry(0.085, 0.42, 4, 8), M(c), 0, -0.25, 0, l);
    mk(new THREE.CapsuleGeometry(0.06, 0.4, 4, 8), M(c), 0, -0.72, 0, l);
    cyl(l, 0.075, 0.085, 0.1, dark, 0, -0.99, 0.01, 8);
    g.add(l);
    legs.push(l);
  }
  const neck = mk(new THREE.CapsuleGeometry(0.17, 0.55, 4, 10), M(c), 0.85, 1.68, 0, g, 0, 0, -0.75);
  neck.scale.set(1, 1, 0.8);
  const head = new THREE.Group();
  head.position.set(1.2, 1.95, 0);
  g.add(head);
  const hm = mk(new THREE.CapsuleGeometry(0.15, 0.36, 4, 10), M(c), 0.12, -0.05, 0, head, 0, 0, Math.PI / 2 + 0.55);
  hm.scale.set(1, 1, 0.85);
  ball(head, 0.13, muzzle, 0.33, -0.22, 0, [1.1, 0.9, 0.9], 1);
  for (const s of [-1, 1]) {
    mk(new THREE.CapsuleGeometry(0.05, 0.3, 3, 6), M(c), -0.08, 0.22, s * 0.09, head, s * 0.25, 0, 0.25);
    ball(head, 0.028, '#111111', 0.12, 0.02, s * 0.12, [1, 1, 1], 1);
  }
  // crina
  for (let i = 0; i < 6; i++) ball(g, 0.06, dark, 0.62 + i * 0.1, 1.68 + i * 0.07, 0, [1, 1.2, 0.6], 0);
  const tail = cyl(g, 0.03, 0.07, 0.75, dark, -0.95, 1.1, 0, 6);
  tail.rotation.z = 0.35;
  if (load) {
    for (const s of [-1, 1]) box(g, 0.7, 0.48, 0.26, '#7a5a3a', 0, 1.35, s * 0.44);
    box(g, 1.0, 0.06, 0.9, '#8a3a2a', 0, 1.62, 0);
    const ch = chest('#5a4030');
    ch.scale.setScalar(0.75);
    ch.position.set(0, 1.62, 0);
    g.add(ch);
  }
  // partes fixas numa malha só; cabeça, pernas e rabo continuam animáveis
  head.userData.dynamic = true; tail.userData.dynamic = true;
  legs.forEach((l) => { bake(l); l.userData.dynamic = true; });
  bake(head);
  bake(g);
  g.userData.dynamic = true;
  g.userData.legs = legs;
  g.userData.update = (t) => { tail.rotation.x = Math.sin(t * 1.3) * 0.25; head.rotation.y = Math.sin(t * 0.4) * 0.15; head.rotation.z = Math.sin(t * 0.7) * 0.05; };
  g.userData.circles = [[0, 0, 0.9]];
  return g;
}
export function bench() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) box(g, 1.8, 0.06, 0.14, '#7a5434', 0, 0.48, -0.15 + i * 0.15);
  for (let i = 0; i < 2; i++) box(g, 1.8, 0.12, 0.05, '#7a5434', 0, 0.68 + i * 0.18, -0.24);
  for (const x of [-0.75, 0.75]) { box(g, 0.08, 0.48, 0.4, '#2e2e2e', x, 0.24, 0); box(g, 0.06, 0.45, 0.06, '#2e2e2e', x, 0.7, -0.25); }
  return bake(g);
}
export function lantern(on = true) {
  const g = new THREE.Group();
  box(g, 0.17, 0.04, 0.17, '#3a2e26', 0, -0.12, 0);
  box(g, 0.13, 0.17, 0.13, on ? glow('#ffb35c', 3) : M('#5a4a3a'), 0, 0, 0);
  for (const a of [-1, 1]) for (const b of [-1, 1]) box(g, 0.02, 0.2, 0.02, '#3a2e26', a * 0.075, 0, b * 0.075);
  mk(new THREE.ConeGeometry(0.11, 0.08, 4), M('#3a2e26'), 0, 0.13, 0, g, 0, Math.PI / 4, 0);
  const h = mk(new THREE.TorusGeometry(0.05, 0.008, 4, 10, Math.PI), M('#3a2e26'), 0, 0.17, 0, g);
  h.castShadow = false;
  return bake(g);
}
export function streetLamp(old = false) {
  const g = new THREE.Group(), c = old ? '#2a2a2a' : '#2f3a38';
  cyl(g, 0.16, 0.2, 0.4, c, 0, 0.2, 0, 10);
  cyl(g, 0.06, 0.09, 3.8, c, 0, 2.1, 0, 10);
  box(g, 0.8, 0.06, 0.06, c, 0.38, 4.05, 0);
  const sc = mk(new THREE.TorusGeometry(0.14, 0.025, 4, 10), M(c), 0.2, 3.9, 0, g);
  sc.castShadow = false;
  mk(new THREE.ConeGeometry(0.24, 0.2, 10), M(c), 0.7, 3.98, 0, g);
  const l = mk(new THREE.SphereGeometry(0.17, 12, 8), glow('#ffd08a', 3), 0.7, 3.78, 0, g);
  l.castShadow = false;
  const pl = new THREE.PointLight('#ffc477', 10, 16, 1.6);
  pl.position.set(0.7, 3.6, 0);
  g.add(pl);
  g.userData.circles = [[0, 0, 0.25]];
  return bake(g);
}
export function fence(W, pts, c = '#7a5a3a') {
  const g = new THREE.Group();
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 2.2));
    for (let k = 0; k <= n; k++) { const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n; cyl(g, 0.06, 0.08, 1.4, c, x, W.heightAt(x, z) + 0.4, z, 6); }
    const ang = Math.atan2(-(bz - az), bx - ax);
    for (const y of [0.45, 0.85]) { const r = box(g, len, 0.07, 0.06, c, (ax + bx) / 2, (W.heightAt(ax, az) + W.heightAt(bx, bz)) / 2 + y, (az + bz) / 2); r.rotation.y = ang; }
  }
  W.group.add(bake(g, { ao: false }));
  return g;
}
export function marco(lines = ['VARGEM ALTA', 'Espírito Santo']) {
  const g = new THREE.Group();
  box(g, 1.7, 1.5, 1.7, '#8a8276', 0, -0.5, 0);
  box(g, 1.5, 0.2, 1.5, '#9a9286', 0, 0.35, 0);
  box(g, 1.1, 1.6, 1.1, '#b0a898', 0, 1.25, 0);
  box(g, 1.25, 0.16, 1.25, '#9a9286', 0, 2.1, 0);
  mk(new THREE.ConeGeometry(0.62, 0.6, 4), M('#a39b8e'), 0, 2.48, 0, g, 0, Math.PI / 4, 0);
  const s = signMesh(lines, 0.95, 0.6, { size: 92, bg: '#3a3026', lit: 0.15, frame: '#6a6258' });
  s.position.set(0, 1.35, 0.6);
  g.add(s);
  g.userData.circles = [[0, 0, 0.95]];
  g.userData.ground = 'max';
  return bake(g);
}
export function stump(h = 0.5) {
  const g = new THREE.Group();
  cyl(g, 0.3, 0.42, h, '#5a4030', 0, h / 2, 0, 9);
  cyl(g, 0.29, 0.29, 0.02, '#d8b88a', 0, h + 0.01, 0, 9);
  const ring = mk(new THREE.TorusGeometry(0.17, 0.012, 3, 12), M('#b89868'), 0, h + 0.025, 0, g);
  ring.rotation.x = Math.PI / 2;
  return bake(g);
}
export function log(len = 3) {
  const g = new THREE.Group();
  const l = cyl(g, 0.25, 0.28, len, '#5a4030', 0, 0.25, 0, 10);
  l.rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) { const e = cyl(g, 0.24, 0.24, 0.02, '#d8b88a', s * (len / 2 + 0.005), 0.25, 0, 10); e.rotation.z = Math.PI / 2; }
  return bake(g);
}
export function cutTree() {
  const g = new THREE.Group();
  cyl(g, 0.4, 0.55, 5, '#5a4030', 0, 2.5, 0, 9);
  box(g, 0.5, 0.35, 0.3, '#e0c49a', 0, 0.9, 0.38).rotation.y = 0.2;
  box(g, 0.3, 0.3, 0.25, '#e0c49a', 0.3, 1.6, 0.3).rotation.y = 0.8;
  for (let i = 0; i < 5; i++) ball(g, 0.12, '#e0c49a', Math.cos(i * 1.3) * 0.9, 0.04, Math.sin(i * 1.3) * 0.9, [1.4, 0.4, 0.9], 0);
  return bake(g);
}
