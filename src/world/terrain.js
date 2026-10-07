// O vale: relevo procedural, rio, estradas, colisões. A geografia é a mesma em todos os
// capítulos — o mesmo chão atravessado por épocas diferentes.
import * as THREE from 'three';
import { noise2, fbm, smooth, lerp, segDist } from '../core/noise.js';
import { M, fogHP, timeU, patch } from '../core/engine.js';

export const WATER_Y = -0.9;
export const SIZE = 760;

export function riverZ(x) {
  return 7 * Math.sin(x * 0.021 + 0.4) + 4 * Math.sin(x * 0.057 + 1.7) + 14 * Math.sin(x * 0.006);
}

// Relevo: várzea quase plana ao longo do rio (onde tudo é construído) e
// morros/serras só ao fundo — nada fica flutuando nem enterrado.
export function baseHeight(x, z) {
  const d = Math.abs(z - riverZ(x));
  let h = -2.3 + 2.6 * smooth(3, 10, d);
  const bank = smooth(8, 20, d);
  h += (fbm(x * 0.0065, z * 0.0065, 3) * 0.5 + noise2(x * 0.028, z * 0.028) * 0.07) * bank;
  // colinas suaves além da área jogável, depois a serra
  const hill = smooth(112, 200, d);
  h += hill * (10 + fbm(x * 0.009 + 4.2, z * 0.009 - 2.1, 4) * 16);
  const ridge = 1 - Math.abs(noise2(x * 0.0045 + 3.1, z * 0.0045 - 1.7));
  h += ridge * ridge * 70 * smooth(160, 320, d);
  return h;
}

function prepRoad(r) {
  const pts = r.pts.map(([x, z]) => ({ x, z, h: 0 }));
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const pad = (r.w || 3) * 2 + 6;
  return { w: 3, flatten: true, color: 'dirt', smooth: 3, ...r, pts, bb: [minX - pad, maxX + pad, minZ - pad, maxZ + pad] };
}

// Gera uma linha (estrada/trilho) acompanhando o rio a uma distância fixa.
export function alongRiver(x0, x1, side, d, step = 6) {
  const out = [];
  for (let x = x0; x <= x1 + 0.01; x += step) out.push([x, riverZ(x) + side * d]);
  return out;
}

const WATER_MAT = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uDeep: { value: new THREE.Color('#1f4b55') }, uShallow: { value: new THREE.Color('#4f8a7c') }, uSky: { value: new THREE.Color('#9cc') },
    uSunCol: { value: new THREE.Color('#fff') }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunI: { value: 1 },
  }]),
  vertexShader: `varying vec3 vW; varying vec2 vUv; varying float vDepth;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uTime, uSunI, fogNear, fogFar; uniform vec3 uDeep, uShallow, uSky, uSunCol, uSunDir, fogColor, fogHP;
varying vec3 vW; varying vec2 vUv; varying float vDepth;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec2 p = vW.xz; float t = uTime;
  float n1 = vn(vec2(p.x * 0.25 - t * 0.9, p.y * 0.9)), n2 = vn(vec2(p.x * 0.6 - t * 1.6, p.y * 1.7 + 3.0)), n3 = vn(p * 1.6 + vec2(-t * 1.1, t * 0.3));
  vec3 N = normalize(vec3((n1 - 0.5) * 0.5 + (n3 - 0.5) * 0.25, 1.0, (n2 - 0.5) * 0.5));
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
  float across = abs(vUv.y - 0.5) * 2.0;
  vec3 col = mix(uDeep, uShallow, smoothstep(0.15, 0.85, across));
  col = mix(col, uSky, clamp(fres * 0.6 + 0.04, 0.0, 1.0));
  vec3 H = normalize(normalize(uSunDir) + V);
  col += uSunCol * pow(max(dot(N, H), 0.0), 160.0) * uSunI * 2.0;
  col += vec3(smoothstep(0.62, 0.9, vn(vec2(p.x * 0.35 - t * 1.3, p.y * 3.0))) * 0.12);
  // espuma estilizada junto às margens e faixas de correnteza
  float fn = vn(p * 1.3 + vec2(-t * 0.9, t * 0.2)) * 0.6 + vn(p * 3.1 + vec2(-t * 1.6, 0.0)) * 0.4;
  float foam = smoothstep(0.66, 0.74, across + fn * 0.1) * smoothstep(0.3, 0.55, fn);
  float streak = smoothstep(0.78, 0.86, vn(vec2(p.x * 0.18 - t * 1.1, p.y * 2.2))) * (1.0 - across) * 0.5;
  col = mix(col, vec3(0.92, 0.95, 0.93) * (0.55 + uSunI * 0.15), clamp(foam * 0.85 + streak * 0.35, 0.0, 1.0));
  float ff = smoothstep(fogNear, fogFar, vDepth);
  float fh = fogHP.x * exp(-max(vW.y - fogHP.y, 0.0) * fogHP.z) * smoothstep(1.0, 45.0, vDepth);
  ff = clamp(ff + fh * (1.0 - ff), 0.0, 1.0);
  gl_FragColor = vec4(mix(col, fogColor, ff), 0.84 + fres * 0.14);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  transparent: true, fog: true, depthWrite: false,
});
WATER_MAT.uniforms.uTime = timeU;
WATER_MAT.uniforms.fogHP = fogHP;
let WATER_MESH = null;
function waterMesh() {
  if (WATER_MESH) return WATER_MESH;
  const segs = 380, W = 17, pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const x = -SIZE / 2 + (SIZE * i) / segs, z = riverZ(x);
    pos.push(x, WATER_Y, z - W / 2, x, WATER_Y, z + W / 2);
    uv.push(x / 10, 0, x / 10, 1);
    if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  WATER_MESH = new THREE.Mesh(g, WATER_MAT);
  WATER_MESH.renderOrder = 2;
  WATER_MESH.userData.keep = true;
  return WATER_MESH;
}

// Textura de detalhe procedural (manchas e "pinceladas"), periódica e amostrada em coordenadas de mundo.
let DETAIL_TEX = null;
function detailTex() {
  if (DETAIL_TEX) return DETAIL_TEX;
  const S = 256, data = new Uint8Array(S * S * 4);
  const hash = (x, y, s) => { const k = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return k - Math.floor(k); };
  // ruído de valor periódico (período P células)
  const vn = (u, v, P, s) => {
    const x = u * P, y = v * P, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), w = (a) => ((a % P) + P) % P;
    const a = hash(w(ix), w(iy), s), b = hash(w(ix + 1), w(iy), s), c = hash(w(ix), w(iy + 1), s), d = hash(w(ix + 1), w(iy + 1), s);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const u = i / S, v = j / S, k = (j * S + i) * 4;
    // R: pinceladas finas alongadas; G: manchas largas
    const fine = vn(u, v, 64, 1) * 0.55 + vn(u, v, 32, 2) * 0.3 + vn(u, v, 128, 3) * 0.15;
    const broad = vn(u, v, 8, 4) * 0.6 + vn(u, v, 16, 5) * 0.3 + vn(u, v, 32, 6) * 0.1;
    data[k] = Math.round(smooth(0.2, 0.8, fine) * 255);
    data[k + 1] = Math.round(smooth(0.15, 0.85, broad) * 255);
    data[k + 2] = 128; data[k + 3] = 255;
  }
  DETAIL_TEX = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  DETAIL_TEX.wrapS = DETAIL_TEX.wrapT = THREE.RepeatWrapping;
  DETAIL_TEX.magFilter = THREE.LinearFilter;
  DETAIL_TEX.minFilter = THREE.LinearMipmapLinearFilter;
  DETAIL_TEX.generateMipmaps = true;
  DETAIL_TEX.anisotropy = 4;
  DETAIL_TEX.needsUpdate = true;
  return DETAIL_TEX;
}
let TERRAIN_MAT = null;
function terrainMat() {
  if (TERRAIN_MAT) return TERRAIN_MAT;
  const m = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), 0, 0);
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh) => {
    base(sh);
    sh.uniforms.uDetail = { value: detailTex() };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nuniform sampler2D uDetail;')
      .replace('#include <color_fragment>', `#include <color_fragment>
vec2 dUv = vWP.xz;
float dF = texture2D(uDetail, dUv * 0.17).r, dM = texture2D(uDetail, dUv * 0.045 + 0.3).g, dL = texture2D(uDetail, dUv * 0.011).g;
float dd = (dF - 0.5) * 0.5 + (dM - 0.5) * 0.7 + (dL - 0.5) * 0.6;
float dist = length(vWP - cameraPosition);
dd *= 1.0 - smoothstep(60.0, 260.0, dist) * 0.6;
diffuseColor.rgb *= 1.0 + dd * 0.55;
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 1.04, 0.86), smoothstep(0.1, 0.4, dd));`);
  };
  m.customProgramCacheKey = () => 'terrain';
  TERRAIN_MAT = m;
  return m;
}

// Pedras de granito (como as do sul capixaba) e serras ao fundo: compartilhadas por todos os capítulos.
let BACKDROP = null;
function domeGeo(seed, lean) {
  const g = new THREE.SphereGeometry(1, 48, 32);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  const rock = new THREE.Color('#9c948c'), rockD = new THREE.Color('#57534f'), rockL = new THREE.Color('#d2c8ba'), veg = new THREE.Color('#41682f'), vegL = new THREE.Color('#6f9440');
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ang = Math.atan2(z, x), hr = Math.hypot(x, z);
    if (y < 0) { const k = 1 + -y * 0.9; x *= k; z *= k; y *= 0.25; }
    else if (hr > 1e-4) {
      // perfil "pão de açúcar": laterais íngremes e topo arredondado
      const target = Math.pow(Math.max(1 - Math.pow(y, 2.5), 0), 1 / 2.5), k = target / hr;
      x *= k; z *= k;
    }
    const gro = 1 + 0.03 * Math.sin(ang * 9 + seed) + 0.02 * noise2(ang * 3 + seed, y * 4);
    x = x * gro + y * y * lean; z *= gro;
    p.setXYZ(i, x, y, z);
    // estrias verticais escuras (escorrimento) e manchas claras
    const streak = noise2(ang * 9 + seed * 3, y * 0.9) * 0.5 + 0.5, fine = noise2(ang * 26 + seed, y * 11) * 0.5 + 0.5;
    c.copy(rock).lerp(rockD, smooth(0.5, 0.82, streak) * 0.8 * smooth(0.05, 0.4, y)).lerp(rockL, smooth(0.5, 1, y) * 0.4 * (1 - streak));
    c.multiplyScalar(0.88 + fine * 0.22);
    const vy = 0.16 + noise2(ang * 4 + seed, 1.3) * 0.12;
    c.lerp(veg, smooth(vy + 0.06, vy - 0.06, y)).lerp(vegL, smooth(vy + 0.04, vy - 0.1, y) * fine * 0.5);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
function backdrop(W) {
  if (!BACKDROP) {
    BACKDROP = new THREE.Group();
    const m = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 0, 0.6);
    // [x, distância do rio (sinal = margem), raio, altura, inclinação]
    [[-300, 135, 54, 112, 0.22], [-372, 52, 44, 84, -0.2], [-150, -285, 60, 100, 0.15], [140, -268, 46, 122, -0.25],
      [215, 255, 66, 92, 0.2], [40, 318, 50, 116, 0.3], [362, 70, 48, 86, -0.3], [-330, -150, 56, 74, 0.1]].forEach(([x, d, r, h, lean], i) => {
      const z = riverZ(x) + d;
      const o = new THREE.Mesh(domeGeo(i * 2.7 + 1, lean), m);
      o.scale.set(r, h, r * (0.8 + (i % 3) * 0.12));
      o.rotation.y = i * 1.3;
      o.position.set(x, baseHeight(x, z) - 6, z);
      BACKDROP.add(o);
    });
    BACKDROP.userData.keep = true;
    BACKDROP.traverse((o) => { o.userData.keep = true; });
  }
  W.group.add(BACKDROP);
}

const _c = new THREE.Color();
export class World {
  constructor(G, cfg) {
    this.G = G;
    this.cfg = cfg;
    this.group = new THREE.Group();
    this.flats = (cfg.flats || []).map((f) => ({ r: 10, ...f, h: f.h ?? this.base(f.x, f.z) }));
    this.clear = cfg.clear || [];
    this.roads = (cfg.roads || []).map(prepRoad);
    this.surfaces = []; this.colliders = []; this.boxes = []; this.updates = []; this.npcs = [];
    this.cast = {}; this.fires = []; this.pending = []; this.lods = []; this.lodT = 0;
    this.bounds = cfg.bounds || { x: 0, z: 0, r: 100 };
    this.N = G.engine.q.seg;
    this.cell = SIZE / this.N;
    for (const r of this.roads) {
      const hs = r.pts.map((p) => this.flatOnly(p.x, p.z));
      r.pts.forEach((p, i) => {
        let s = 0, n = 0;
        for (let k = -r.smooth; k <= r.smooth; k++) { const j = i + k; if (j >= 0 && j < hs.length) { s += hs[j]; n++; } }
        p.h = Math.max(s / n, r.minY ?? -0.4);
      });
    }
    this.buildHeights();
    this.buildTerrain();
    this.group.add(waterMesh());
    backdrop(this);
    G.engine.water = WATER_MAT;
  }

  base(x, z) { const h = baseHeight(x, z); return this.cfg.height ? this.cfg.height(x, z, h) : h; }

  flatOnly(x, z) {
    let h = this.base(x, z);
    for (const f of this.flats) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r) h = lerp(h, f.h, smooth(f.r, f.r * 0.55, d)); }
    return h;
  }

  roadQuery(r, x, z) {
    if (x < r.bb[0] || x > r.bb[1] || z < r.bb[2] || z > r.bb[3]) return null;
    let best = null;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], q = segDist(x, z, a.x, a.z, b.x, b.z);
      if (!best || q.d < best.d) best = { d: q.d, h: lerp(a.h, b.h, q.t) };
    }
    return best;
  }

  heightRaw(x, z) {
    let h = this.flatOnly(x, z);
    for (const r of this.roads) {
      if (!r.flatten) continue;
      const q = this.roadQuery(r, x, z);
      if (q && q.d < r.w * 1.7) h = lerp(h, q.h, smooth(r.w * 1.7, r.w * 0.6, q.d));
    }
    return h;
  }

  buildHeights() {
    const N = this.N, n1 = N + 1, H = (this.hgrid = new Float32Array(n1 * n1));
    for (let iy = 0; iy <= N; iy++) for (let ix = 0; ix <= N; ix++) H[iy * n1 + ix] = this.heightRaw(-SIZE / 2 + ix * this.cell, -SIZE / 2 + iy * this.cell);
  }

  // Altura exata da malha renderizada (interpolação por triângulo).
  heightAt(x, z) {
    const N = this.N, n1 = N + 1;
    let fx = (x + SIZE / 2) / this.cell, fz = (z + SIZE / 2) / this.cell;
    if (fx < 0 || fz < 0 || fx >= N || fz >= N) return this.base(x, z);
    const ix = Math.floor(fx), iz = Math.floor(fz);
    fx -= ix; fz -= iz;
    const H = this.hgrid, a = H[iz * n1 + ix], d = H[iz * n1 + ix + 1], b = H[(iz + 1) * n1 + ix], c = H[(iz + 1) * n1 + ix + 1];
    if (fx + fz <= 1) return a + (d - a) * fx + (b - a) * fz;
    return c + (b - c) * (1 - fx) + (d - c) * (1 - fz);
  }

  groundAt(x, z) {
    let h = this.heightAt(x, z);
    for (const s of this.surfaces) {
      const dx = x - s.x, dz = z - s.z, lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c;
      if (Math.abs(lx) < s.hx && Math.abs(lz) < s.hz) h = Math.max(h, s.y);
    }
    return h;
  }

  forestAt(x, z) {
    let f = this.cfg.forest ? this.cfg.forest(x, z) : 1;
    if (f <= 0) return 0;
    return f * smooth(8, 15, Math.abs(z - riverZ(x))) * this.openAt(x, z);
  }
  // 0 nas clareiras, terreiros e estradas; 1 no resto.
  openAt(x, z) {
    let f = 1;
    for (const fl of this.flats) { const d = Math.hypot(x - fl.x, z - fl.z); if (d < fl.r + 6) f *= smooth(fl.r * 0.7, fl.r + 6, d); }
    for (const c of this.clear) { const d = Math.hypot(x - c.x, z - c.z); if (d < c.r + 5) f *= smooth(c.r, c.r + 5, d); }
    for (const r of this.roads) { const q = this.roadQuery(r, x, z); if (q) f *= smooth(r.w, r.w + 4, q.d); }
    return f;
  }
  // 0 sobre o leito das estradas (onde não nasce capim).
  roadFree(x, z) {
    let f = 1;
    for (const r of this.roads) { const q = this.roadQuery(r, x, z); if (q) f *= smooth(r.w * 0.55, r.w * 1.05, q.d); }
    return f;
  }

  buildTerrain() {
    const N = this.N, n1 = N + 1, H = this.hgrid, cfg = this.cfg;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, N, N);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = (this.tcol = new Float32Array(pos.count * 3));
    const P = Object.fromEntries(Object.entries({ grassA: '#6a9a3a', grassB: '#a6b850', grassC: '#4f7f34', forest: '#3a5c2a', dirt: '#b07a4a', rock: '#9a9286', sand: '#c2a878', soil: '#9a4e2c', hill: '#5f8a44', ...cfg.colors }).map(([k, v]) => [k, new THREE.Color(v)]));
    const fields = cfg.fields || [];
    for (let iy = 0; iy <= N; iy++) for (let ix = 0; ix <= N; ix++) {
      const i = iy * n1 + ix, x = -SIZE / 2 + ix * this.cell, z = -SIZE / 2 + iy * this.cell, y = H[i];
      pos.setY(i, y);
      const hx = (H[iy * n1 + Math.min(ix + 1, N)] - H[iy * n1 + Math.max(ix - 1, 0)]) / (2 * this.cell);
      const hz = (H[Math.min(iy + 1, N) * n1 + ix] - H[Math.max(iy - 1, 0) * n1 + ix]) / (2 * this.cell);
      const ny = 1 / Math.sqrt(1 + hx * hx + hz * hz);
      // manchas grandes de capim claro/escuro (pinceladas)
      const n2 = noise2(x * 0.011 + 7, z * 0.011) * 0.5 + 0.5, n3 = noise2(x * 0.045 - 3, z * 0.045 + 9) * 0.5 + 0.5;
      _c.copy(P.grassA).lerp(P.grassB, smooth(0.35, 0.8, n2)).lerp(P.grassC, smooth(0.6, 0.95, n3) * 0.55);
      const near = Math.abs(x - this.bounds.x) < this.bounds.r + 90 && Math.abs(z - this.bounds.z) < this.bounds.r + 90;
      _c.lerp(P.forest, (near ? this.forestAt(x, z) : (cfg.forest ? cfg.forest(x, z) : 1)) * 0.7);
      _c.lerp(P.hill, smooth(4, 30, y) * 0.5);
      for (const f of fields) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r) _c.lerp(P.soil, smooth(f.r, f.r * 0.6, d) * (f.k ?? 0.55)); }
      _c.lerp(P.rock, smooth(0.86, 0.62, ny));
      _c.lerp(P.sand, smooth(0.45, -0.75, y));
      if (near) for (const r of this.roads) {
        const q = this.roadQuery(r, x, z);
        if (q && q.d < r.w * 1.25) _c.lerp(r.color === 'stone' ? P.rock : P.dirt, smooth(r.w * 1.25, r.w * 0.5, q.d) * 0.95);
      }
      _c.multiplyScalar(0.93 + 0.14 * (noise2(x * 0.31, z * 0.31) * 0.5 + 0.5));
      col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, terrainMat());
    mesh.receiveShadow = true;
    this.terrain = mesh;
    this.group.add(mesh);
  }

  // Cor do chão em (x, z): o capim nasce com a cor do terreno.
  colorAt(x, z, out) {
    const N = this.N, n1 = N + 1, C = this.tcol;
    const fx = Math.min(Math.max((x + SIZE / 2) / this.cell, 0), N - 1e-3), fz = Math.min(Math.max((z + SIZE / 2) / this.cell, 0), N - 1e-3);
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const a = (iz * n1 + ix) * 3, b = a + 3, c = a + n1 * 3, d = c + 3;
    const k = (o) => lerp(lerp(C[a + o], C[b + o], tx), lerp(C[c + o], C[d + o], tx), tz);
    return out.setRGB(k(0), k(1), k(2));
  }

  // Ponto ocupado por construção/objeto (não nasce árvore nem capim ali).
  blocked(x, z, pad = 0.4) {
    for (const b of this.boxes) {
      const dx = x - b.x, dz = z - b.z, lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
      if (Math.abs(lx) < b.hx + pad && Math.abs(lz) < b.hz + pad) return true;
    }
    for (const s of this.surfaces) {
      const dx = x - s.x, dz = z - s.z, lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c;
      if (Math.abs(lx) < s.hx + pad && Math.abs(lz) < s.hz + pad) return true;
    }
    if (!this._bigC) this._bigC = this.colliders.filter((c) => c.r > 0.75);
    for (const c of this._bigC) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + pad) ** 2) return true;
    return false;
  }

  // Executa o que precisa saber onde ficaram as construções (vegetação).
  finalize() { for (const f of this.pending.splice(0)) f(); }

  // --- utilitários para montar cenários ---
  at(x, z, dy = 0) { return new THREE.Vector3(x, this.groundAt(x, z) + dy, z); }
  bank(x, side, d) { return this.at(x, riverZ(x) + side * d); }
  add(obj, x, z, rotY = 0, dy = 0) {
    obj.position.set(x, this.groundAt(x, z) + dy, z);
    obj.rotation.y = rotY;
    this.group.add(obj);
    if (obj.userData.update) this.updates.push(obj.userData.update);
    return obj;
  }
  anim(obj) { if (obj.userData.update) this.updates.push(obj.userData.update); return obj; }
  addCollider(x, z, r) { this.colliders.push({ x, z, r }); this._bigC = null; }
  addBox(x, z, hx, hz, ang = 0) { this.boxes.push({ x, z, hx, hz, c: Math.cos(ang), s: Math.sin(ang) }); }
  addSurface(x, z, hx, hz, ang, y) { this.surfaces.push({ x, z, hx, hz, y, c: Math.cos(ang), s: Math.sin(ang) }); }

  collide(p, r = 0.35) {
    for (const c of this.colliders) {
      const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + r, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2); p.x = c.x + (dx / d) * rr; p.z = c.z + (dz / d) * rr; }
    }
    for (const b of this.boxes) {
      const dx = p.x - b.x, dz = p.z - b.z;
      let lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
      const px = b.hx + r - Math.abs(lx), pz = b.hz + r - Math.abs(lz);
      if (px > 0 && pz > 0) {
        if (px < pz) lx = Math.sign(lx || 1) * (b.hx + r); else lz = Math.sign(lz || 1) * (b.hz + r);
        p.x = b.x + b.c * lx + b.s * lz;
        p.z = b.z - b.s * lx + b.c * lz;
      }
    }
    const B = this.bounds, dx = p.x - B.x, dz = p.z - B.z, d = Math.hypot(dx, dz);
    if (d > B.r) { p.x = B.x + (dx / d) * B.r; p.z = B.z + (dz / d) * B.r; return true; }
    return false;
  }

  // Some com o que está longe da câmera (capim, flores, arbustos).
  addLod(mesh, far, near = -1) { const c = mesh.boundingSphere.center; this.lods.push({ mesh, x: c.x, z: c.z, r: mesh.boundingSphere.radius, far, near }); }
  updateLod() {
    const E = this.G.engine, cam = E.renderer.xr.isPresenting ? E.rig.position : E.camera.position;
    for (const l of this.lods) { const d = Math.hypot(cam.x - l.x, cam.z - l.z) - l.r * 0.7; l.mesh.visible = d < l.far && d >= l.near; }
  }

  update(dt, t) {
    for (const f of this.updates) f(t, dt);
    this.lodT -= dt;
    if (this.lodT <= 0) { this.lodT = 0.2; this.updateLod(); }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.userData.keep) return;
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      if (o.material && o.material.userData?.own) o.material.dispose();
    });
    this.group.removeFromParent();
  }
}
