// O vale: relevo procedural, rio, estradas, colisões. A geografia é a mesma em todos os
// capítulos — o mesmo chão atravessado por épocas diferentes.
import * as THREE from 'three';
import { noise2, fbm, smooth, lerp, segDist } from '../core/noise.js';
import { M, fogHP, timeU } from '../core/engine.js';

export const WATER_Y = -0.9;
export const SIZE = 760;

export function riverZ(x) {
  return 7 * Math.sin(x * 0.021 + 0.4) + 4 * Math.sin(x * 0.057 + 1.7) + 14 * Math.sin(x * 0.006);
}

export function baseHeight(x, z) {
  const d = Math.abs(z - riverZ(x));
  let h = -2.3 + 2.6 * smooth(3, 10, d) + 0.0021 * Math.max(d - 10, 0) ** 2;
  const bank = smooth(6, 18, d);
  h += fbm(x * 0.006, z * 0.006, 4) * (3 + d * 0.1) * bank;
  h += noise2(x * 0.035, z * 0.035) * 0.65 * bank;
  const ridge = 1 - Math.abs(noise2(x * 0.0045 + 3.1, z * 0.0045 - 1.7));
  h += ridge * ridge * 55 * smooth(90, 260, d);
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
  col += vec3(smoothstep(0.7, 0.95, across) * (0.4 + 0.6 * vn(p * 2.0 + vec2(-t * 0.8, 0.0)))) * 0.3;
  float ff = smoothstep(fogNear, fogFar, vDepth);
  float fh = fogHP.x * exp(-max(vW.y - fogHP.y, 0.0) * fogHP.z) * smoothstep(1.0, 45.0, vDepth);
  ff = clamp(ff + fh * (1.0 - ff), 0.0, 1.0);
  gl_FragColor = vec4(mix(col, fogColor, ff), 0.8 + fres * 0.18);
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

const _c = new THREE.Color();
export class World {
  constructor(G, cfg) {
    this.G = G;
    this.cfg = cfg;
    this.group = new THREE.Group();
    this.flats = (cfg.flats || []).map((f) => ({ r: 10, ...f, h: f.h ?? baseHeight(f.x, f.z) }));
    this.clear = cfg.clear || [];
    this.roads = (cfg.roads || []).map(prepRoad);
    this.surfaces = []; this.colliders = []; this.boxes = []; this.updates = []; this.npcs = [];
    this.cast = {}; this.fires = [];
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
    G.engine.water = WATER_MAT;
  }

  flatOnly(x, z) {
    let h = baseHeight(x, z);
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
    if (fx < 0 || fz < 0 || fx >= N || fz >= N) return baseHeight(x, z);
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
    f *= smooth(8, 15, Math.abs(z - riverZ(x)));
    for (const fl of this.flats) { const d = Math.hypot(x - fl.x, z - fl.z); if (d < fl.r + 6) f *= smooth(fl.r * 0.7, fl.r + 6, d); }
    for (const c of this.clear) { const d = Math.hypot(x - c.x, z - c.z); if (d < c.r + 5) f *= smooth(c.r, c.r + 5, d); }
    for (const r of this.roads) { const q = this.roadQuery(r, x, z); if (q) f *= smooth(r.w, r.w + 4, q.d); }
    return f;
  }

  buildTerrain() {
    const N = this.N, n1 = N + 1, H = this.hgrid, cfg = this.cfg;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, N, N);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    const P = Object.fromEntries(Object.entries({ grassA: '#5d8a3a', grassB: '#8aa64a', forest: '#3c5a2a', dirt: '#9a6a44', rock: '#8a8478', sand: '#a89070', soil: '#8c4a2c', ...cfg.colors }).map(([k, v]) => [k, new THREE.Color(v)]));
    const fields = cfg.fields || [];
    for (let iy = 0; iy <= N; iy++) for (let ix = 0; ix <= N; ix++) {
      const i = iy * n1 + ix, x = -SIZE / 2 + ix * this.cell, z = -SIZE / 2 + iy * this.cell, y = H[i];
      pos.setY(i, y);
      const hx = (H[iy * n1 + Math.min(ix + 1, N)] - H[iy * n1 + Math.max(ix - 1, 0)]) / (2 * this.cell);
      const hz = (H[Math.min(iy + 1, N) * n1 + ix] - H[Math.max(iy - 1, 0) * n1 + ix]) / (2 * this.cell);
      const ny = 1 / Math.sqrt(1 + hx * hx + hz * hz);
      const n2 = noise2(x * 0.013 + 7, z * 0.013) * 0.5 + 0.5;
      _c.copy(P.grassA).lerp(P.grassB, n2);
      const near = Math.abs(x - this.bounds.x) < this.bounds.r + 90 && Math.abs(z - this.bounds.z) < this.bounds.r + 90;
      _c.lerp(P.forest, (near ? this.forestAt(x, z) : (cfg.forest ? cfg.forest(x, z) : 1)) * 0.75);
      for (const f of fields) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r) _c.lerp(P.soil, smooth(f.r, f.r * 0.6, d) * (f.k ?? 0.55)); }
      _c.lerp(P.rock, smooth(0.86, 0.66, ny));
      _c.lerp(P.sand, smooth(0.5, -0.7, y));
      if (near) for (const r of this.roads) {
        const q = this.roadQuery(r, x, z);
        if (q && q.d < r.w) _c.lerp(r.color === 'stone' ? P.rock : P.dirt, smooth(r.w, r.w * 0.45, q.d) * 0.92);
      }
      _c.multiplyScalar(0.9 + 0.2 * (noise2(x * 0.31, z * 0.31) * 0.5 + 0.5));
      col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, M('#ffffff', { vertexColors: true, roughness: 0.96 }));
    mesh.receiveShadow = true;
    this.terrain = mesh;
    this.group.add(mesh);
  }

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
  addCollider(x, z, r) { this.colliders.push({ x, z, r }); }
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

  update(dt, t) { for (const f of this.updates) f(t, dt); }

  dispose() {
    this.group.traverse((o) => {
      if (o.userData.keep) return;
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      if (o.material && o.material.userData?.own) o.material.dispose();
    });
    this.group.removeFromParent();
  }
}
