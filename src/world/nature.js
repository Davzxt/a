// Vegetação estilizada da Mata Atlântica: copas "fofas" (normais esféricas), capim com a cor do chão,
// instanciada na GPU em blocos (culling por bloco, inclusive na sombra) e com dois níveis de detalhe.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { patch, DETAIL } from '../core/engine.js';
import { rng, noise2, lerp, smooth } from '../core/noise.js';
import { riverZ, SIZE } from './terrain.js';

const _a = new THREE.Color(), _b = new THREE.Color(), _t = new THREE.Color(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
const hash = (x, y, z) => { const k = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return k - Math.floor(k); };
const flat = (g) => (g.index ? g.toNonIndexed() : g);

// Pinta a geometria com degradê vertical (sombra embaixo, luz em cima).
function paint(g, lo, hi = lo, jitter = 0) {
  g = flat(g);
  const p = g.attributes.position, n = p.count, c = new Float32Array(n * 3);
  g.computeBoundingBox();
  const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
  _a.set(lo); _b.set(hi);
  for (let i = 0; i < n; i++) {
    _t.copy(_a).lerp(_b, (p.getY(i) - y0) / (y1 - y0 || 1));
    if (jitter) _t.multiplyScalar(1 - jitter + hash(p.getX(i), p.getY(i), p.getZ(i)) * jitter * 2);
    c[i * 3] = _t.r; c[i * 3 + 1] = _t.g; c[i * 3 + 2] = _t.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  if (!g.attributes.normal) g.computeVertexNormals();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}
// Deforma vértices de forma coerente (mesma posição => mesmo deslocamento).
function lumpy(g, amt) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = hash(x, y, z) - 0.5;
    p.setXYZ(i, x * (1 + r * amt), y * (1 + r * amt * 0.6), z * (1 + r * amt));
  }
  return g;
}
const merge = (list) => { const g = mergeGeometries(list.map(flat)); g.userData.shared = true; return g; };

// Copa estilizada: bolhas facetadas com normais "esféricas" (luz macia como algodão) e AO interno.
function canopy(blobs, det, lo, hi, seed = 1, hl = '#d8e070') {
  const parts = [], r = rng(seed);
  let cx = 0, cy = 0, cz = 0, wsum = 0;
  for (const [rad, x, y, z] of blobs) { cx += x * rad; cy += y * rad; cz += z * rad; wsum += rad; }
  cx /= wsum; cy /= wsum; cz /= wsum;
  let reach = 0;
  for (const [rad, x, y, z] of blobs) reach = Math.max(reach, Math.hypot(x - cx, (y - cy) * 1.2, z - cz) + rad);
  const L = new THREE.Color(lo), Hc = new THREE.Color(hi), HL = new THREE.Color(hl);
  let ymin = 1e9, ymax = -1e9;
  for (const [rad, , y] of blobs) { ymin = Math.min(ymin, y - rad); ymax = Math.max(ymax, y + rad); }
  const big = blobs.map((b) => b[0]).sort((a, b) => b - a)[2] ?? 0;
  for (const [rad, x, y, z, sy = 0.82] of blobs) {
    const d = det && rad >= big ? det : 0;
    const g = lumpy(new THREE.IcosahedronGeometry(rad, d), d ? 0.16 : 0.22);
    g.scale(1, sy, 1).translate(x, y, z);
    const p = g.attributes.position, n = new Float32Array(p.count * 3), c = new Float32Array(p.count * 3);
    const tone = 0.9 + r() * 0.2;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
      _v.set(px - x, (py - y) / sy, pz - z).normalize();
      _w.set(px - cx, (py - cy) * 1.25, pz - cz).normalize();
      _v.multiplyScalar(0.4).addScaledVector(_w, 0.6).normalize();
      n[i * 3] = _v.x; n[i * 3 + 1] = _v.y; n[i * 3 + 2] = _v.z;
      const t = smooth(ymin, ymax, py), occ = smooth(0.15, 0.95, Math.hypot(px - cx, (py - cy) * 1.2, pz - cz) / reach);
      _t.copy(L).lerp(Hc, Math.pow(t, 0.85) * 0.75 + occ * 0.25);
      _t.lerp(HL, smooth(0.55, 0.95, _v.y) * smooth(0.5, 1, t) * 0.32);
      _t.multiplyScalar(tone * (0.62 + 0.38 * occ) * (0.94 + hash(px, py, pz) * 0.12));
      c[i * 3] = _t.r; c[i * 3 + 1] = _t.g; c[i * 3 + 2] = _t.b;
    }
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    if (g.attributes.uv) g.deleteAttribute('uv');
    parts.push(g);
  }
  return mergeGeometries(parts);
}

// Tronco com raízes alargadas e leve curvatura.
function trunk(h, r0, r1, bend = 0.4, seg = 7, lo = '#4a3424', hi = '#7a5a40') {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 3, true).translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), t = y / h, k = 1 + Math.pow(1 - t, 5) * 0.9;
    p.setXYZ(i, p.getX(i) * k + Math.sin(t * 2.2) * bend * t, y, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return paint(g, lo, hi, 0.08);
}
function branch(len, r, rz, ry, x, y, z, c = '#5a3e2a') {
  const g = new THREE.CylinderGeometry(r * 0.55, r, len, 5).translate(0, len / 2, 0).rotateZ(rz).rotateY(ry).translate(x, y, z);
  return paint(g, c, '#7a5a40');
}

// Fronde de palmeira/samambaia: nervura central com folíolos pendentes dos dois lados.
function featherFrond(L, leaf, droop, segs = 8, rise = 0.6) {
  const pos = [];
  const at = (t) => [t * L, Math.sin(t * Math.PI * 0.5) * droop * rise - t * t * droop, 0];
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs, a = at(t0), b = at(t1);
    const w = leaf * Math.sin(Math.PI * Math.min((t0 + 0.08) * 1.05, 1)) + 0.02;
    for (const s of [-1, 1]) {
      const tip = [a[0] + L / segs * 0.9, a[1] - w * 0.55, s * w];
      pos.push(...a, ...b, ...tip);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // normais para cima: folhagem iluminada de forma suave dos dois lados
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) { _v.set(n.getX(i) * 0.4, 1, n.getZ(i) * 0.4).normalize(); n.setXYZ(i, _v.x, _v.y, _v.z); }
  return g;
}
// Folha larga (bananeira).
function broadLeaf(L, W, droop, segs = 6) {
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, x = t * L, y = Math.sin(t * Math.PI * 0.55) * droop * 0.6 - t * t * droop, w = Math.sin(Math.PI * Math.min(t * 1.1, 1)) * W + 0.01;
    pos.push(x, y - w * 0.15, -w, x, y + w * 0.12, 0, x, y - w * 0.15, w);
    if (i < segs) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const GEO = { hi: null, lo: null };
function buildSet(hi) {
  const S = {}, det = hi ? 1 : 0;
  // Árvore da mata
  const tb = [[2.5, 0, 7.6, 0], [2.0, 1.8, 6.9, 0.5], [2.1, -1.7, 7.1, -0.4], [1.8, 0.3, 8.9, -0.3], [1.7, 0.5, 6.6, 1.7], [1.5, -0.8, 6.5, -1.6]];
  const tbl = [[2.9, 0, 7.5, 0], [2.3, 1.6, 6.9, 0.6], [2.3, -1.5, 7.0, -0.6]];
  const wood = () => [trunk(7, 0.4, 0.2, 0.35, hi ? 7 : 5), ...(hi ? [branch(2.6, 0.13, -0.9, 0, 0.1, 5.0, 0), branch(2.4, 0.12, 0.85, 0.3, 0, 5.2, 0)] : [])];
  S.tree = merge([...wood(), canopy(hi ? tb : tbl, det, '#24461f', '#7aa83e', 3, '#d6e66a')]);
  S.ipe = merge([...wood(), canopy(hi ? tb : tbl, det, '#c2801a', '#ffd84a', 5, '#fff2a0')]);
  S.ipeRosa = merge([...wood(), canopy(hi ? tb : tbl, det, '#a04a78', '#f6a8cc', 7, '#ffe0f0')]);
  // Emergente (jequitibá): copa em guarda-chuva
  const ub = [[3.4, 0, 13, 0, 0.6], [2.7, 2.7, 12.4, 0.8, 0.6], [2.6, -2.5, 12.6, -0.6, 0.6], [2.4, 0.4, 13.8, 2, 0.6], [2.3, -0.6, 12.3, -2.6, 0.6]];
  S.tall = merge([trunk(12.5, 0.6, 0.28, 0.6, hi ? 8 : 5, '#4d3a2a', '#8a6e52'), ...(hi ? [branch(3.4, 0.18, -1.0, 0.4, 0, 10, 0), branch(3.2, 0.17, 1.0, -0.3, 0, 10.4, 0)] : []),
    canopy(hi ? ub : ub.slice(0, 3), det, '#203f1c', '#6a9a38', 9, '#cfe070')]);
  // Palmeira juçara
  const fronds = [];
  const nf = hi ? 11 : 7;
  for (let i = 0; i < nf; i++) fronds.push(paint(featherFrond(2.8, 0.55, 1.5, hi ? 9 : 5).rotateZ(0.42 + (i % 3) * 0.14).rotateY((i / nf) * Math.PI * 2 + i * 0.3).translate(0, 8.9, 0), '#3a6a28', '#8ab84e', 0.1));
  const pt = new THREE.CylinderGeometry(0.1, 0.16, 9, hi ? 7 : 5, 6).translate(0, 4.5, 0);
  const ptc = paint(pt, '#6e6250', '#9a8e78');
  { const p = ptc.attributes.position, c = ptc.attributes.color; for (let i = 0; i < p.count; i++) { const k = 0.82 + 0.18 * (Math.sin(p.getY(i) * 7) > 0.6 ? 0 : 1); c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k); } }
  S.palm = merge([ptc, ...fronds, paint(new THREE.CylinderGeometry(0.17, 0.12, 1.0, 6).translate(0, 8.5, 0), '#4f7a30', '#6f9a3a')]);
  // Bananeira
  const bl = [];
  for (let i = 0; i < 7; i++) bl.push(paint(broadLeaf(2.2, 0.5, 1.1, hi ? 6 : 4).rotateZ(0.65 + (i % 2) * 0.25).rotateY((i / 7) * Math.PI * 2).translate(0, 2.1, 0), '#3f7a26', '#a8d060', 0.06));
  S.banana = merge([paint(new THREE.CylinderGeometry(0.15, 0.24, 2.3, 7).translate(0, 1.15, 0), '#6a7a40', '#a2b060'), ...bl]);
  // Arbustos e samambaias
  S.bush = canopy([[0.95, 0, 0.62, 0], [0.75, 0.62, 0.52, 0.3], [0.66, -0.55, 0.48, -0.3], [0.55, 0.1, 0.5, 0.7]], det, '#24461c', '#6d9c3c', 13);
  const ff = [];
  for (let i = 0; i < (hi ? 9 : 6); i++) ff.push(paint(featherFrond(1.15, 0.2, 0.55, hi ? 6 : 4, 1.3).rotateZ(0.75).rotateY((i / 9) * Math.PI * 2 + 0.2), '#24501f', '#76b044', 0.1));
  S.fern = merge(ff);
  // Pé de café com frutos vermelhos
  const cb = canopy([[0.6, 0, 0.95, 0, 1.25], [0.45, 0.2, 0.62, 0.15, 1.1], [0.42, -0.2, 0.7, -0.15, 1.1]], det, '#16341a', '#4a7a2e', 17, '#9ac050');
  const berries = [];
  for (let i = 0; i < (hi ? 16 : 8); i++) {
    const a = i * 2.4, y = 0.45 + (i % 5) * 0.2, r = 0.52 - Math.abs(y - 0.85) * 0.25;
    berries.push(paint(new THREE.IcosahedronGeometry(0.05, 0).translate(Math.cos(a) * r, y, Math.sin(a) * r), i % 3 ? '#c4231c' : '#e04a2a'));
  }
  S.coffee = merge([paint(new THREE.CylinderGeometry(0.04, 0.06, 0.5, 5).translate(0, 0.25, 0), '#5a4030'), cb, ...berries]);
  // Muda de café
  const sl = [paint(new THREE.CylinderGeometry(0.015, 0.02, 0.45, 4).translate(0, 0.22, 0), '#4a6a2a')];
  for (let i = 0; i < 6; i++) sl.push(paint(broadLeaf(0.2, 0.06, 0.05, 2).rotateZ(0.4).rotateY(i * 1.3).translate(0, 0.18 + i * 0.05, 0), '#3f7a2c', '#7ab648'));
  S.sapling = merge(sl);
  // Pedras: lisas, com musgo por cima
  {
    let g = lumpy(new THREE.IcosahedronGeometry(1, hi ? 1 : 0), 0.3);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g);
    g.scale(1.25, 0.7, 1);
    g.computeVertexNormals();
    g = g.toNonIndexed();
    const p = g.attributes.position, nn = g.attributes.normal, c = new Float32Array(p.count * 3);
    const r0 = new THREE.Color('#7d776e'), r1 = new THREE.Color('#b4ada2'), moss = new THREE.Color('#5f8a3a');
    for (let i = 0; i < p.count; i++) {
      _t.copy(r0).lerp(r1, smooth(-0.6, 0.6, p.getY(i)) * 0.8 + hash(p.getX(i), p.getY(i), p.getZ(i)) * 0.2);
      _t.lerp(moss, smooth(0.55, 0.9, nn.getY(i)) * 0.75);
      c[i * 3] = _t.r; c[i * 3 + 1] = _t.g; c[i * 3 + 2] = _t.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    S.rock = g;
  }
  Object.values(S).forEach((g) => { g.userData.shared = true; });
  return S;
}
// Capim e flores (iguais nos dois níveis).
function smallSet(S) {
  // Tufo de capim: lâminas curvas em 2 segmentos; cinza-claro na ponta (a cor vem do chão, por instância)
  const pos = [], col = [], blades = DETAIL.value < 1 ? 5 : 7;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + hash(i, 1, 2) * 1.2, rr = 0.06 + hash(i, 3, 1) * 0.12;
    const h = 0.38 + hash(i, 5, 7) * 0.32, w = 0.045, bend = 0.12 + hash(i, 9, 2) * 0.12;
    const ox = Math.cos(a) * rr, oz = Math.sin(a) * rr, dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    const P = (s, t, b) => [ox + px * s + dx * b, t, oz + pz * s + dz * b];
    const v0 = P(-w, 0, 0), v1 = P(w, 0, 0), v2 = P(-w * 0.6, h * 0.55, bend * 0.35), v3 = P(w * 0.6, h * 0.55, bend * 0.35), v4 = P(0, h, bend);
    pos.push(...v0, ...v1, ...v2, ...v2, ...v1, ...v3, ...v2, ...v3, ...v4);
    const c0 = [0.52, 0.55, 0.5], c1 = [0.95, 0.97, 0.88], c2 = [1.32, 1.3, 1.02];
    col.push(...c0, ...c0, ...c1, ...c1, ...c0, ...c1, ...c1, ...c1, ...c2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  S.grass = g;
  // Flor: haste + 5 pétalas + miolo (a cor da pétala vem por instância)
  const fl = [paint(new THREE.CylinderGeometry(0.008, 0.012, 0.32, 3).translate(0, 0.16, 0), '#3a6a24', '#5a8a30')];
  for (let i = 0; i < 5; i++) fl.push(paint(new THREE.SphereGeometry(0.055, 5, 3).scale(1, 0.25, 0.55).translate(0.06, 0.33, 0).rotateY((i / 5) * Math.PI * 2), '#e8e8e8', '#ffffff'));
  fl.push(paint(new THREE.IcosahedronGeometry(0.03, 0).translate(0, 0.345, 0), '#ffcf3a'));
  S.flower = merge(fl);
  Object.values(S).forEach((x) => { x.userData.shared = true; });
}
export function geos(level = 'hi') {
  if (!GEO.hi) {
    GEO.hi = buildSet(DETAIL.value >= 1);
    GEO.lo = buildSet(false);
    smallSet(GEO.hi);
    GEO.lo.grass = GEO.hi.grass; GEO.lo.flower = GEO.hi.flower;
  }
  return GEO[level];
}

// Folhagem de dois lados sem "inverter" a normal: as costas da folha não ficam pretas.
function noFlip(m) {
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh) => {
    base(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  const key = m.customProgramCacheKey();
  m.customProgramCacheKey = () => key + 'nf';
  return m;
}
const MATS = {};
function mats() {
  if (MATS.veg) return MATS;
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, ...o });
  MATS.veg = patch(std({}), 0.012, 0.9);
  MATS.leaf = noFlip(patch(std({ side: THREE.DoubleSide }), 0.022, 0.6));
  MATS.grass = noFlip(patch(std({ side: THREE.DoubleSide, roughness: 1 }), 0.15, 0));
  MATS.coffee = patch(std({ roughness: 0.6 }), 0.03, 0.7);
  MATS.rock = patch(std({ roughness: 0.92 }), 0, 0.4);
  MATS.flower = noFlip(patch(std({ side: THREE.DoubleSide, roughness: 0.7, emissive: '#1a1a1a' }), 0.1, 0.3));
  return MATS;
}
const MAT_OF = { tree: 'veg', tall: 'veg', ipe: 'veg', ipeRosa: 'veg', bush: 'veg', palm: 'leaf', banana: 'leaf', fern: 'leaf', coffee: 'coffee', sapling: 'coffee', rock: 'rock', grass: 'grass', flower: 'flower' };

const _o = new THREE.Object3D(), _tc = new THREE.Color();
export function instanced(geo, mat, items, { cast = true, receive = false, tint = null } = {}) {
  if (!items.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => {
    _o.position.set(it.x, it.y, it.z);
    _o.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    _o.scale.set(it.sx || it.s, it.sy || it.s, it.sz || it.s);
    _o.updateMatrix();
    m.setMatrixAt(i, _o.matrix);
    if (tint) m.setColorAt(i, tint(_tc, it));
  });
  m.instanceMatrix.needsUpdate = true;
  m.castShadow = cast;
  m.receiveShadow = receive;
  m.computeBoundingSphere();
  return m;
}
// Divide as instâncias em blocos: a câmera e a sombra só desenham os blocos visíveis.
export function chunked(geo, mat, items, opts = {}, size = 56, parent) {
  const cells = new Map();
  for (const it of items) {
    const k = Math.floor(it.x / size) + ',' + Math.floor(it.z / size);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(it);
  }
  const out = [];
  for (const list of cells.values()) { const m = instanced(geo, mat, list, opts); if (m) { out.push(m); parent?.add(m); } }
  return out;
}

// Espalha pontos aceitos por uma função de densidade.
export function scatter(W, { n, seed = 1, area, density = () => 1, minRiver = 9, maxSlope = 0.55, tries = 5, avoid = 0.6 }) {
  const r = rng(seed), out = [];
  const [x0, x1, z0, z1] = area || [-SIZE / 2 + 5, SIZE / 2 - 5, -SIZE / 2 + 5, SIZE / 2 - 5];
  for (let i = 0; i < n * tries && out.length < n; i++) {
    const x = lerp(x0, x1, r()), z = lerp(z0, z1, r());
    if (Math.abs(z - riverZ(x)) < minRiver) continue;
    if (r() > density(x, z)) continue;
    if (avoid >= 0 && W.blocked(x, z, avoid)) continue;
    const y = W.heightAt(x, z), e = 1.2;
    const sx = (W.heightAt(x + e, z) - W.heightAt(x - e, z)) / (2 * e), sz = (W.heightAt(x, z + e) - W.heightAt(x, z - e)) / (2 * e);
    if (Math.hypot(sx, sz) > maxSlope) continue;
    out.push({ x, y, z, s: 1, ry: r() * Math.PI * 2, rnd: r() });
  }
  return out;
}

// Monta toda a vegetação do capítulo — depois das construções, para não nascer nada dentro delas.
// o = { trees, palms, ipes, grass, bushes, flowers, rocks, coffee:[...], bananas:[...] }
export function buildNature(W, o = {}) {
  const grp = new THREE.Group();
  W.group.add(grp);
  W.pending.push(() => natureNow(W, o, grp));
  return grp;
}
function natureNow(W, o, grp) {
  const G = geos('hi'), GL = geos('lo'), Mt = mats(), q = W.G.engine.q, B = W.bounds, shadows = q.shadow > 0;
  const fd = (x, z) => W.forestAt(x, z);
  const near = [B.x - B.r - 60, B.x + B.r + 60, B.z - B.r - 60, B.z + B.r + 60];
  const inNear = (x, z) => x > near[0] && x < near[1] && z > near[2] && z < near[3];
  const farD = (x, z) => (inNear(x, z) ? 0 : (W.cfg.forest ? W.cfg.forest(x, z) : 1) * (Math.abs(z - riverZ(x)) > 14 ? 1 : 0));
  const T = Math.round(q.trees * (o.trees ?? 1));
  const nearT = scatter(W, { n: Math.round(T * 0.58), seed: 11, area: near, density: fd, maxSlope: 0.7, avoid: 1.6 });
  const farT = scatter(W, { n: Math.round(T * 0.42), seed: 12, density: farD, maxSlope: 0.9, tries: 3, avoid: -1 });
  const ipeK = o.ipes ?? 0.03, palmK = o.palms ?? 0.16;
  const sort = (list) => {
    const kinds = { tree: [], tall: [], palm: [], ipe: [], ipeRosa: [] };
    for (const it of list) {
      it.s = 0.78 + it.rnd * 0.6;
      const k = noise2(it.x * 0.02, it.z * 0.02);
      if (it.rnd < ipeK) (it.rnd < ipeK * 0.6 ? kinds.ipe : kinds.ipeRosa).push(it);
      else if (it.rnd < ipeK + palmK) { it.s = 0.8 + it.rnd * 0.5; kinds.palm.push(it); }
      else if (k > 0.35 && it.rnd > 0.7) kinds.tall.push(it);
      else kinds.tree.push(it);
    }
    return kinds;
  };
  const tintGreen = (c, it) => c.setRGB(0.86 + it.rnd * 0.26, 0.88 + it.rnd * 0.2, 0.82 + it.rnd * 0.18);
  const kn = sort(nearT), kf = sort(farT);
  for (const k in kn) {
    const tint = k.startsWith('ipe') ? null : tintGreen;
    // perto: modelo detalhado; longe (> 120 m): o mesmo bloco com o modelo simples
    chunked(G[k], Mt[MAT_OF[k]], kn[k], { tint, cast: shadows, receive: shadows }, 64, grp).forEach((m) => W.addLod(m, 120));
    chunked(GL[k], Mt[MAT_OF[k]], kn[k], { tint, cast: false }, 64, grp).forEach((m) => W.addLod(m, 1e9, 120));
    const m = instanced(GL[k], Mt[MAT_OF[k]], kf[k], { tint, cast: false });
    if (m) grp.add(m);
  }
  for (const it of nearT) if (Math.hypot(it.x - B.x, it.z - B.z) < B.r + 4) W.addCollider(it.x, it.z, 0.4 * it.s + 0.1);

  // Sub-bosque
  const under = scatter(W, { n: Math.round(1500 * (o.bushes ?? 1) * (q.grass / 26000 + 0.4)), seed: 21, area: near, density: (x, z) => (0.12 + fd(x, z) * 0.88) * W.openAt(x, z) ** 2, maxSlope: 0.8, minRiver: 7 });
  const bushes = [], ferns = [];
  for (const it of under) { it.s = 0.6 + it.rnd * 0.9; (it.rnd > 0.5 ? bushes : ferns).push(it); }
  chunked(G.bush, Mt.veg, bushes, { cast: shadows && q.detail >= 1, receive: shadows, tint: tintGreen }, 64, grp).forEach((m) => W.addLod(m, 150));
  chunked(G.fern, Mt.leaf, ferns, { cast: false, receive: shadows, tint: tintGreen }, 64, grp).forEach((m) => W.addLod(m, 110));

  // Capim (onde há luz), com a cor do chão onde nasce
  const ga = [B.x - B.r - 15, B.x + B.r + 15, B.z - B.r - 15, B.z + B.r + 15];
  const gr = scatter(W, { n: Math.round(q.grass * (o.grass ?? 1)), seed: 31, area: ga, density: (x, z) => (1 - fd(x, z) * 0.8) * W.roadFree(x, z) * (o.grassAt ? o.grassAt(x, z) : 1), maxSlope: 0.9, minRiver: 6.8, tries: 3, avoid: 0.15 });
  for (const it of gr) { it.s = 0.62 + it.rnd * 0.6; it.sy = it.s * (0.75 + it.rnd * 0.5); it.sx = it.sz = it.s * 1.1; }
  // capim só é desenhado nos blocos próximos da câmera (de longe ele some na textura do chão)
  chunked(G.grass, Mt.grass, gr, { cast: false, receive: shadows, tint: (c, it) => W.colorAt(it.x, it.z, c).multiplyScalar(0.92 + it.rnd * 0.2) }, 40, grp).forEach((m) => W.addLod(m, 72));

  // Flores (e pétalas caídas sob os ipês)
  const fls = scatter(W, { n: Math.round(520 * (o.flowers ?? 1)), seed: 41, area: [B.x - B.r, B.x + B.r, B.z - B.r, B.z + B.r], density: (x, z) => (1 - fd(x, z)) * (noise2(x * 0.08, z * 0.08) > 0.2 ? 1 : 0.1), minRiver: 7, avoid: 0.2 });
  const fcol = ['#ffffff', '#ffd54a', '#f06aa0', '#a07ae8', '#ff8a4a'];
  fls.forEach((it) => { it.col = fcol[Math.floor(it.rnd * 5)]; it.s = 0.8 + it.rnd; });
  const r = rng(77);
  for (const ip of [...kn.ipe, ...kn.ipeRosa]) for (let i = 0; i < 14; i++) {
    const a = r() * 6.28, d = 1 + r() * 4.2, x = ip.x + Math.cos(a) * d, z = ip.z + Math.sin(a) * d;
    fls.push({ x, y: W.heightAt(x, z) - 0.3, z, s: 0.9 + r() * 0.5, ry: r() * 6.28, col: kn.ipe.includes(ip) ? '#ffd23a' : '#f6a0c8' });
  }
  chunked(G.flower, Mt.flower, fls, { cast: false, tint: (c, it) => c.set(it.col) }, 64, grp).forEach((m) => W.addLod(m, 90));
  const rk = scatter(W, { n: Math.round(170 * (o.rocks ?? 1)), seed: 51, area: near, maxSlope: 1.4, minRiver: 5, density: (x, z) => 0.12 + fd(x, z) });
  rk.forEach((it) => { it.s = 0.3 + it.rnd * it.rnd * 2.2; it.y -= it.s * 0.22; it.rx = it.rnd * 0.4; });
  const rm = instanced(G.rock, Mt.rock, rk, { cast: shadows, receive: shadows });
  if (rm) grp.add(rm);

  // Plantações e plantas posicionadas pelo capítulo
  if (o.coffee?.length) grp.userData.coffee = plants(W, 'coffee', o.coffee, grp);
  if (o.bananas?.length) plants(W, 'banana', o.bananas, grp);
}

// Plantas posicionadas uma a uma (cafezal, bananeiras, mudas, árvores de cena).
export function plants(W, kind, list, parent = W.group) {
  const G = geos('hi'), Mt = mats(), shadows = W.G.engine.q.shadow > 0;
  const r = rng(list.length * 13 + 7);
  const m = instanced(G[kind], Mt[MAT_OF[kind]], list.map((p) => ({ x: p.x, y: W.heightAt(p.x, p.z), z: p.z, s: p.s || 0.8 + r() * 0.4, ry: r() * 6.28 })), { cast: shadows && kind !== 'sapling', receive: shadows });
  if (m) parent.add(m);
  return m;
}

// Fileiras de café num retângulo inclinado.
export function coffeeRows(cx, cz, rows, cols, ang = 0, sp = 1.8, rowSp = 2.6) {
  const out = [], c = Math.cos(ang), s = Math.sin(ang), r = rng(rows * 31 + cols);
  for (let ro = 0; ro < rows; ro++) for (let k = 0; k < cols; k++) {
    const lx = (k - (cols - 1) / 2) * sp + (r() - 0.5) * 0.3, lz = (ro - (rows - 1) / 2) * rowSp;
    out.push({ x: cx + c * lx + s * lz, z: cz - s * lx + c * lz, s: 0.85 + r() * 0.3 });
  }
  return out;
}
