// Vegetação estilizada da Mata Atlântica, instanciada na GPU e balançando ao vento.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, patch } from '../core/engine.js';
import { rng, noise2, lerp } from '../core/noise.js';
import { riverZ, SIZE } from './terrain.js';

const _a = new THREE.Color(), _b = new THREE.Color();

// Pinta a geometria com degradê vertical (sombra embaixo, luz em cima).
function paint(g, lo, hi = lo, jitter = 0) {
  g = g.index ? g.toNonIndexed() : g;
  const p = g.attributes.position, n = p.count, c = new Float32Array(n * 3);
  g.computeBoundingBox();
  const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
  _a.set(lo); _b.set(hi);
  const t = new THREE.Color();
  for (let i = 0; i < n; i++) {
    t.copy(_a).lerp(_b, (p.getY(i) - y0) / (y1 - y0 || 1));
    if (jitter) t.multiplyScalar(1 - jitter + Math.random() * jitter * 2);
    c[i * 3] = t.r; c[i * 3 + 1] = t.g; c[i * 3 + 2] = t.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
// Deforma vértices de forma coerente (mesma posição => mesmo deslocamento).
function lumpy(g, amt) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    const r = (k - Math.floor(k)) - 0.5;
    p.setXYZ(i, x * (1 + r * amt), y * (1 + r * amt * 0.6), z * (1 + r * amt));
  }
  return g;
}
const merge = (list) => { const g = mergeGeometries(list.map((x) => (x.index ? x.toNonIndexed() : x))); g.computeVertexNormals(); g.userData.shared = true; return g; };
const tr = (g, x, y, z) => { g.translate(x, y, z); return g; };

// Uma folha/fronde curva (faixa que se afina), usada em palmeiras, bananeiras e samambaias.
function frond(L, W, droop, segs = 6) {
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, x = t * L, y = Math.sin(t * Math.PI * 0.55) * droop * 0.6 - t * t * droop, w = Math.sin(Math.PI * Math.min(t * 1.1, 1)) * W + 0.01;
    pos.push(x, y, -w, x, y + w * 0.25, 0, x, y, w);
    if (i < segs) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

const GEO = {};
export function geos() {
  if (GEO.tree) return GEO;
  // Árvore de copa (mata): tronco + galhos + nuvens de folhas facetadas
  const crown = (r, x, y, z, lo, hi) => paint(lumpy(new THREE.IcosahedronGeometry(r, 0), 0.25).scale(1, 0.78, 1).translate(x, y, z), lo, hi, 0.08);
  const trunk = paint(new THREE.CylinderGeometry(0.2, 0.38, 6.2, 6).translate(0, 3.1, 0), '#4a3424', '#6b4c34');
  const br1 = paint(new THREE.CylinderGeometry(0.07, 0.13, 2.6, 5).rotateZ(0.9).translate(0.9, 5.4, 0), '#5a3e2a');
  const br2 = paint(new THREE.CylinderGeometry(0.07, 0.12, 2.4, 5).rotateZ(-0.8).translate(-0.85, 5.6, 0.2), '#5a3e2a');
  const blobs = [[2.5, 0, 7.4, 0], [1.9, 1.7, 6.7, 0.5], [2, -1.6, 6.9, -0.4], [1.7, 0.3, 8.7, -0.3], [1.5, 0.4, 6.4, 1.6]];
  GEO.tree = merge([trunk, br1, br2, ...blobs.map(([r, x, y, z]) => crown(r, x, y, z, '#2d4d22', '#6f9a3a'))]);
  GEO.ipe = merge([trunk.clone(), br1.clone(), br2.clone(), ...blobs.map(([r, x, y, z]) => crown(r * 0.95, x, y, z, '#c8901a', '#ffd64a'))]);
  GEO.ipeRosa = merge([trunk.clone(), br1.clone(), br2.clone(), ...blobs.map(([r, x, y, z]) => crown(r * 0.95, x, y, z, '#a8507a', '#f2a0c8'))]);
  // Árvore emergente (jequitibá) com copa em guarda-chuva
  const t2 = paint(new THREE.CylinderGeometry(0.28, 0.55, 12, 7).translate(0, 6, 0), '#4d3a2a', '#7a5e44');
  GEO.tall = merge([t2, ...[[3.4, 0, 12.6, 0], [2.6, 2.6, 12, 0.8], [2.5, -2.4, 12.2, -0.6], [2.3, 0.4, 13.6, 1.8], [2.2, -0.6, 12, -2.5]].map(([r, x, y, z]) => crown(r, x, y, z, '#2a4a20', '#5f8a34'))]);
  // Palmeira juçara
  const pt = paint(new THREE.CylinderGeometry(0.1, 0.15, 9, 6).translate(0, 4.5, 0), '#6e6250', '#8f8470');
  const fronds = [];
  for (let i = 0; i < 9; i++) fronds.push(paint(frond(2.6, 0.34, 1.4).rotateZ(0.35 + (i % 3) * 0.12).rotateY((i / 9) * Math.PI * 2 + i * 0.3).translate(0, 8.9, 0), '#3f6a2a', '#7aa84a'));
  GEO.palm = merge([pt, ...fronds, paint(new THREE.CylinderGeometry(0.16, 0.12, 0.8, 6).translate(0, 8.6, 0), '#5f7a3a')]);
  // Bananeira
  const bt = paint(new THREE.CylinderGeometry(0.16, 0.22, 2.2, 7).translate(0, 1.1, 0), '#7a8a4a', '#9aa85a');
  const bl = [];
  for (let i = 0; i < 7; i++) bl.push(paint(frond(2.1, 0.42, 1.1, 5).rotateZ(0.6 + (i % 2) * 0.25).rotateY((i / 7) * Math.PI * 2).translate(0, 2.1, 0), '#4f8a2e', '#9cc85a'));
  GEO.banana = merge([bt, ...bl]);
  // Arbustos e samambaias
  GEO.bush = merge([crown(0.9, 0, 0.6, 0, '#2f4f22', '#5f8a38'), crown(0.7, 0.6, 0.5, 0.3, '#2f4f22', '#6a9440'), crown(0.6, -0.5, 0.45, -0.3, '#2f4f22', '#5a8434')]);
  const ff = [];
  for (let i = 0; i < 8; i++) ff.push(paint(frond(1.1, 0.16, 0.5, 4).rotateZ(0.7).rotateY((i / 8) * Math.PI * 2 + 0.2).translate(0, 0.05, 0), '#2e5a24', '#6aa040'));
  GEO.fern = merge(ff);
  // Pé de café com frutos vermelhos
  const cb = paint(lumpy(new THREE.IcosahedronGeometry(0.62, 1), 0.18).scale(0.9, 1.25, 0.9).translate(0, 0.85, 0), '#1f3d1c', '#3f6a2c', 0.06);
  const berries = [];
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, y = 0.45 + (i % 5) * 0.2, r = 0.5 - Math.abs(y - 0.85) * 0.25;
    berries.push(paint(new THREE.OctahedronGeometry(0.055, 0).translate(Math.cos(a) * r, y, Math.sin(a) * r), i % 3 ? '#b8231c' : '#d4482a'));
  }
  GEO.coffee = merge([paint(new THREE.CylinderGeometry(0.04, 0.06, 0.5, 5).translate(0, 0.25, 0), '#5a4030'), cb, ...berries]);
  // Muda de café
  const sl = [paint(new THREE.CylinderGeometry(0.015, 0.02, 0.45, 4).translate(0, 0.22, 0), '#4a6a2a')];
  for (let i = 0; i < 5; i++) sl.push(paint(frond(0.18, 0.05, 0.05, 2).rotateZ(0.4).rotateY(i * 1.3).translate(0, 0.18 + i * 0.06, 0), '#3f7a2c', '#6aa640'));
  GEO.sapling = merge(sl);
  // Tufos de capim
  const blades = [];
  for (let i = 0; i < 5; i++) {
    const h = 0.45 + (i % 3) * 0.15, a = (i / 5) * Math.PI, w = 0.045;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, 0.05, h, 0.04], 3));
    g.rotateY(a).translate(Math.cos(a * 3) * 0.08, 0, Math.sin(a * 3) * 0.08);
    blades.push(paint(g, '#3d5a22', '#a9bf5a'));
  }
  GEO.grass = mergeGeometries(blades);
  const gn = GEO.grass.attributes.position.count;
  GEO.grass.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(gn * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  GEO.grass.userData.shared = true;
  // Flores
  const fl = [];
  for (let i = 0; i < 3; i++) fl.push(paint(new THREE.OctahedronGeometry(0.07, 0).scale(1, 0.4, 1).translate(Math.cos(i * 2.1) * 0.12, 0.28 + i * 0.05, Math.sin(i * 2.1) * 0.12), '#ffffff'));
  GEO.flower = merge([...fl, paint(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 3).translate(0, 0.15, 0), '#4a7a2a')]);
  // Pedras
  GEO.rock = merge([paint(lumpy(new THREE.DodecahedronGeometry(1, 0), 0.35).scale(1.2, 0.7, 1), '#6f6a62', '#a8a298')]);
  return GEO;
}

const MATS = {};
function mats() {
  if (MATS.veg) return MATS;
  MATS.veg = patch(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 }), 0.012);
  MATS.leaf = patch(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, side: THREE.DoubleSide }), 0.02);
  MATS.grass = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }), 0.16);
  MATS.coffee = patch(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55 }), 0.03);
  MATS.rock = M('#ffffff', { vertexColors: true, roughness: 0.95 });
  MATS.flower = patch(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7, emissive: '#222222' }), 0.1);
  return MATS;
}

const _o = new THREE.Object3D(), _t = new THREE.Color();
export function instanced(geo, mat, items, { cast = true, receive = false, tint = null } = {}) {
  if (!items.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => {
    _o.position.set(it.x, it.y, it.z);
    _o.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    _o.scale.set(it.sx || it.s, it.sy || it.s, it.sz || it.s);
    _o.updateMatrix();
    m.setMatrixAt(i, _o.matrix);
    if (tint) m.setColorAt(i, tint(_t, it));
  });
  m.instanceMatrix.needsUpdate = true;
  m.castShadow = cast;
  m.receiveShadow = receive;
  m.computeBoundingSphere();
  return m;
}

// Espalha pontos aceitos por uma função de densidade.
export function scatter(W, { n, seed = 1, area, density = () => 1, minRiver = 9, maxSlope = 0.55, tries = 5 }) {
  const r = rng(seed), out = [];
  const [x0, x1, z0, z1] = area || [-SIZE / 2 + 5, SIZE / 2 - 5, -SIZE / 2 + 5, SIZE / 2 - 5];
  for (let i = 0; i < n * tries && out.length < n; i++) {
    const x = lerp(x0, x1, r()), z = lerp(z0, z1, r());
    if (Math.abs(z - riverZ(x)) < minRiver) continue;
    if (r() > density(x, z)) continue;
    const y = W.heightAt(x, z), e = 1.2;
    const sx = (W.heightAt(x + e, z) - W.heightAt(x - e, z)) / (2 * e), sz = (W.heightAt(x, z + e) - W.heightAt(x, z - e)) / (2 * e);
    if (Math.hypot(sx, sz) > maxSlope) continue;
    out.push({ x, y, z, s: 1, ry: r() * Math.PI * 2, rnd: r() });
  }
  return out;
}

// Monta toda a vegetação do capítulo. o = { trees, palms, ipes, grass, bushes, flowers, rocks, coffee:[...], bananas:[...], saplings:[...] }
export function buildNature(W, o = {}) {
  const G = geos(), Mt = mats(), q = W.G.engine.q, B = W.bounds;
  const grp = new THREE.Group();
  const fd = (x, z) => W.forestAt(x, z);
  const near = [B.x - B.r - 60, B.x + B.r + 60, B.z - B.r - 60, B.z + B.r + 60];
  const inNear = (x, z) => x > near[0] && x < near[1] && z > near[2] && z < near[3];
  const farD = (x, z) => (inNear(x, z) ? 0 : (W.cfg.forest ? W.cfg.forest(x, z) : 1) * (Math.abs(z - riverZ(x)) > 14 ? 1 : 0));
  const T = Math.round(q.trees * (o.trees ?? 1));
  const nearT = scatter(W, { n: Math.round(T * 0.55), seed: 11, area: near, density: fd, maxSlope: 0.7 });
  const farT = scatter(W, { n: Math.round(T * 0.45), seed: 12, density: farD, maxSlope: 0.9, tries: 3 });
  const all = nearT.concat(farT);
  const kinds = { tree: [], tall: [], palm: [], ipe: [], ipeRosa: [] };
  const ipeK = o.ipes ?? 0.03, palmK = o.palms ?? 0.16;
  for (const it of all) {
    it.s = 0.75 + it.rnd * 0.65;
    const k = noise2(it.x * 0.02, it.z * 0.02);
    if (it.rnd < ipeK) (it.rnd < ipeK * 0.6 ? kinds.ipe : kinds.ipeRosa).push(it);
    else if (it.rnd < ipeK + palmK) { it.s = 0.8 + it.rnd * 0.5; kinds.palm.push(it); }
    else if (k > 0.35 && it.rnd > 0.7) kinds.tall.push(it);
    else kinds.tree.push(it);
  }
  const tintGreen = (c, it) => c.setRGB(0.82 + it.rnd * 0.3, 0.85 + it.rnd * 0.25, 0.8 + it.rnd * 0.2);
  for (const k in kinds) {
    const m = instanced(G[k], k === 'palm' ? Mt.leaf : Mt.veg, kinds[k], { tint: k.startsWith('ipe') ? null : tintGreen });
    if (m) grp.add(m);
  }
  for (const it of nearT) if (Math.hypot(it.x - B.x, it.z - B.z) < B.r + 4) W.addCollider(it.x, it.z, 0.35 * it.s + 0.1);

  // Sub-bosque
  const under = scatter(W, { n: Math.round(1400 * (o.bushes ?? 1) * (q.grass / 24000 + 0.4)), seed: 21, area: near, density: (x, z) => 0.25 + fd(x, z) * 0.75, maxSlope: 0.8, minRiver: 7 });
  const bushes = [], ferns = [];
  for (const it of under) { it.s = 0.6 + it.rnd * 0.9; (it.rnd > 0.5 ? bushes : ferns).push(it); }
  [[GEO.bush, Mt.veg, bushes], [GEO.fern, Mt.leaf, ferns]].forEach(([g, m, l]) => { const im = instanced(g, m, l, { cast: false, tint: tintGreen }); if (im) grp.add(im); });

  // Capim (onde há luz) e flores
  const gr = scatter(W, { n: Math.round(q.grass * (o.grass ?? 1)), seed: 31, area: [B.x - B.r - 15, B.x + B.r + 15, B.z - B.r - 15, B.z + B.r + 15], density: (x, z) => (1 - fd(x, z) * 0.85) * (o.grassAt ? o.grassAt(x, z) : 1), maxSlope: 0.9, minRiver: 6.5, tries: 3 });
  for (const it of gr) { it.s = 0.55 + it.rnd * 0.55; it.sy = it.s * (0.7 + it.rnd * 0.45); it.sx = it.sz = it.s; }
  const gm = instanced(GEO.grass, Mt.grass, gr, { cast: false, tint: (c, it) => c.setRGB(0.85 + it.rnd * 0.3, 0.9 + it.rnd * 0.2, 0.85) });
  if (gm) grp.add(gm);
  const fls = scatter(W, { n: Math.round(500 * (o.flowers ?? 1)), seed: 41, area: [B.x - B.r, B.x + B.r, B.z - B.r, B.z + B.r], density: (x, z) => (1 - fd(x, z)) * (noise2(x * 0.08, z * 0.08) > 0.2 ? 1 : 0.1), minRiver: 7 });
  const fcol = ['#ffffff', '#ffd54a', '#e86aa0', '#9a7ae8', '#ff8a4a'];
  const fm = instanced(GEO.flower, Mt.flower, fls.map((it) => ({ ...it, s: 0.8 + it.rnd })), { cast: false, tint: (c, it) => c.set(fcol[Math.floor(it.rnd * 5)]) });
  if (fm) grp.add(fm);
  const rk = scatter(W, { n: Math.round(160 * (o.rocks ?? 1)), seed: 51, area: near, maxSlope: 1.4, minRiver: 5, density: (x, z) => 0.12 + fd(x, z) });
  rk.forEach((it) => { it.s = 0.3 + it.rnd * it.rnd * 2.2; it.y -= it.s * 0.25; it.rx = it.rnd; });
  const rm = instanced(GEO.rock, Mt.rock, rk, { receive: true });
  if (rm) grp.add(rm);

  // Plantações e plantas posicionadas pelo capítulo
  if (o.coffee?.length) grp.userData.coffee = plants(W, 'coffee', o.coffee, grp);
  if (o.bananas?.length) plants(W, 'banana', o.bananas, grp);
  W.group.add(grp);
  return grp;
}

// Plantas posicionadas uma a uma (cafezal, bananeiras, mudas).
export function plants(W, kind, list, parent = W.group) {
  const G = geos(), Mt = mats();
  const mat = kind === 'coffee' || kind === 'sapling' ? Mt.coffee : kind === 'banana' ? Mt.leaf : Mt.veg;
  const m = instanced(G[kind], mat, list.map((p) => ({ x: p.x, y: W.heightAt(p.x, p.z), z: p.z, s: p.s || 0.8 + Math.random() * 0.4, ry: Math.random() * 6.28 })), { cast: kind !== 'sapling' });
  if (m) parent.add(m);
  return m;
}

// Fileiras de café num retângulo inclinado.
export function coffeeRows(cx, cz, rows, cols, ang = 0, sp = 1.8, rowSp = 2.6) {
  const out = [], c = Math.cos(ang), s = Math.sin(ang);
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const lx = (k - (cols - 1) / 2) * sp + (Math.random() - 0.5) * 0.3, lz = (r - (rows - 1) / 2) * rowSp;
    out.push({ x: cx + c * lx + s * lz, z: cz - s * lx + c * lz, s: 0.85 + Math.random() * 0.3 });
  }
  return out;
}
