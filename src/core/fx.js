// Efeitos: partículas na GPU (vagalumes, brasas, poeira, fumaça), fogo, farol de objetivo,
// trilha-guia de luz, cachoeira e pássaros.
import * as THREE from 'three';
import { timeU } from './engine.js';

export const pointScale = { value: 600 };

const PVERT = `
uniform float uTime, uSize, uScale, uRate; uniform vec3 uSpread;
attribute vec4 seed;
varying float vA;
void main(){
  vec3 p = position; float t = uTime; float grow = 1.0;
#if MODE == 0
  p += vec3(sin(t * (0.3 + seed.x * 0.5) + seed.y * 6.28), sin(t * (0.4 + seed.y * 0.6) + seed.z * 6.28) * 0.5, cos(t * (0.35 + seed.z * 0.5) + seed.w * 6.28)) * 1.4;
  vA = pow(max(sin(t * (1.1 + seed.w * 1.7) + seed.x * 40.0), 0.0), 2.0);
#elif MODE == 1
  float a = fract(t * uRate * (0.7 + seed.x * 0.6) + seed.y);
  p = vec3(position.x * (0.25 + a * 0.9), a * uSpread.y, position.z * (0.25 + a * 0.9));
  p.x += sin(t * 2.1 + seed.z * 9.0) * 0.25 * a; p.z += cos(t * 1.7 + seed.w * 9.0) * 0.25 * a;
  vA = (1.0 - a) * smoothstep(0.0, 0.08, a);
#elif MODE == 2
  p += vec3(sin(t * 0.13 + seed.x * 6.28), sin(t * 0.17 + seed.y * 6.28) * 0.5, cos(t * 0.11 + seed.z * 6.28)) * 1.6;
  vA = 0.3 + 0.7 * (0.5 + 0.5 * sin(t * 0.7 + seed.w * 6.28));
#else
  float a = fract(t * uRate * (0.8 + seed.x * 0.4) + seed.y);
  p = vec3(position.x * (0.3 + a * 1.4), a * uSpread.y, position.z * (0.3 + a * 1.4)) + vec3(1.0, 0.0, 0.35) * a * a * uSpread.x;
  vA = (1.0 - a) * smoothstep(0.0, 0.12, a);
  grow = 0.6 + a * 2.4;
#endif
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * grow * uScale / max(-mv.z, 0.1);
  gl_Position = projectionMatrix * mv;
}`;
const PFRAG = `
uniform vec3 uColor; uniform float uOpacity; varying float vA;
void main(){
  float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.0, r);
  gl_FragColor = vec4(uColor, a * a * vA * uOpacity);
  #include <colorspace_fragment>
}`;

// mode: 0 vagalumes, 1 brasas, 2 poeira/pólen, 3 fumaça/vapor
export function particles({ count = 80, spread = [10, 4, 10], color = '#ffd27a', size = 0.15, mode = 0, rate = 0.3, opacity = 1, additive = true, intensity = 1 } = {}) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const emit = mode === 1 || mode === 3;
    pos[i * 3] = (Math.random() - 0.5) * spread[0] * (emit ? 0.3 : 1);
    pos[i * 3 + 1] = emit ? 0 : (Math.random() - 0.5) * spread[1];
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread[2] * (emit ? 0.3 : 1);
    for (let k = 0; k < 4; k++) seed[i * 4 + k] = Math.random();
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uTime: timeU, uScale: pointScale, uSize: { value: size }, uRate: { value: rate },
      uSpread: { value: new THREE.Vector3(...spread) }, uColor: { value: new THREE.Color(color).multiplyScalar(intensity) }, uOpacity: { value: opacity },
    },
    defines: { MODE: mode }, vertexShader: PVERT, fragmentShader: PFRAG,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = 5;
  return p;
}

// Fogueira estilizada com luz tremulante e brasas.
const flameMat = new THREE.ShaderMaterial({
  uniforms: { uTime: timeU },
  vertexShader: `uniform float uTime; varying float vY;
void main(){ vec3 p = position; vY = uv.y;
  p.x += sin(uTime * 9.0 + position.y * 6.0 + position.z * 3.0) * 0.07 * uv.y;
  p.z += cos(uTime * 7.3 + position.y * 5.0) * 0.07 * uv.y;
  p.y *= 0.85 + 0.15 * sin(uTime * 13.0 + position.x * 20.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
  fragmentShader: `varying float vY;
void main(){ vec3 c = mix(vec3(2.6, 1.55, 0.5), vec3(1.5, 0.32, 0.05), vY); gl_FragColor = vec4(c, (1.0 - vY) * 0.85);
  #include <tonemapping_fragment>
}`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});

export function makeFire(scale = 1, { light = true, smoke = true } = {}) {
  const g = new THREE.Group();
  const flames = new THREE.Group();
  [[0, 0, 0, 0.34, 1.25], [0.14, 0, 0.08, 0.24, 0.9], [-0.12, 0, -0.06, 0.26, 1.0], [0.02, 0, -0.14, 0.2, 0.8], [0, 0, 0, 0.16, 1.5]].forEach(([x, y, z, r, h], i) => {
    const geo = new THREE.ConeGeometry(r, h, 7, 3, true);
    geo.translate(0, h / 2, 0);
    const m = new THREE.Mesh(geo, flameMat);
    m.position.set(x, y + 0.1, z);
    m.rotation.y = i * 1.3;
    flames.add(m);
  });
  g.add(flames);
  g.add(particles({ count: 45, mode: 1, spread: [0.5, 4.5, 0.5], color: '#ffae55', size: 0.05, rate: 0.32, intensity: 1.8 }));
  if (smoke) {
    const sm = particles({ count: 26, mode: 3, spread: [0.6, 8, 0.6], color: '#77706a', size: 1.2, rate: 0.06, opacity: 0.18, additive: false });
    sm.position.y = 1.2;
    g.add(sm);
  }
  let pl = null;
  if (light) { pl = new THREE.PointLight('#ff9a4a', 15, 20, 1.5); pl.position.y = 1.1; g.add(pl); }
  g.scale.setScalar(scale);
  g.userData.dynamic = true;
  const base = pl ? pl.intensity : 0;
  let lit = true;
  g.userData.update = (t) => {
    if (pl) pl.intensity = lit ? base * (0.82 + 0.12 * Math.sin(t * 17.0) + 0.08 * Math.sin(t * 7.3 + 1.1)) : 0;
  };
  g.userData.setLit = (on) => {
    lit = on;
    g.children.forEach((c) => { if (c !== pl) c.visible = on; });
  };
  return g;
}

// Feixe de luz vertical que marca o objetivo à distância.
export function makeBeacon(color = '#ffd27a') {
  const geo = new THREE.CylinderGeometry(0.5, 0.5, 46, 18, 1, true);
  geo.translate(0, 23, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: timeU, uColor: { value: new THREE.Color(color).multiplyScalar(1.6) }, uOpacity: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uTime, uOpacity; varying vec2 vUv;
void main(){ float a = pow(1.0 - vUv.y, 2.2) * (0.7 + 0.3 * sin(vUv.y * 30.0 - uTime * 2.5)) * 0.42 * uOpacity;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 6;
  return m;
}

// Trilha de partículas que flui do jogador até o objetivo.
export class Guide {
  constructor(scene) {
    this.n = 44;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.n * 3);
    const s = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) s[i] = i / (this.n - 1);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: timeU, uScale: pointScale, uColor: { value: new THREE.Color('#ffd98a').multiplyScalar(2.2) }, uOpacity: { value: 0 } },
      vertexShader: `uniform float uTime, uScale; attribute float aS; varying float vA;
void main(){ float f = fract(aS * 4.0 - uTime * 0.7);
  vA = smoothstep(0.0, 0.25, f) * smoothstep(1.0, 0.5, f) * smoothstep(0.0, 0.1, aS) * smoothstep(1.0, 0.8, aS);
  vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = (0.1 + 0.08 * vA) * uScale / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA;
void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(uColor, a * a * vA * uOpacity);
  #include <colorspace_fragment>
}`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 7;
    scene.add(this.points);
    this.target = null;
    this.timer = 0;
  }
  update(dt, from, world, target) {
    const u = this.mat.uniforms.uOpacity;
    const show = target && world && from.distanceTo(target) > 4;
    u.value += ((show ? 1 : 0) - u.value) * Math.min(1, dt * 3);
    if (!show) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.05;
    const dx = target.x - from.x, dz = target.z - from.z, len = Math.hypot(dx, dz);
    const span = Math.min(len - 1.5, 26);
    for (let i = 0; i < this.n; i++) {
      const k = i / (this.n - 1), d = 1.2 + k * span;
      const x = from.x + (dx / len) * d + Math.sin(k * 9 + d) * 0.12, z = from.z + (dz / len) * d;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = world.groundAt(x, z) + 0.55 + Math.sin(k * 7) * 0.12; this.pos[i * 3 + 2] = z;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

// Cachoeira estilizada (faixa animada + névoa).
// bow(k): quanto a lâmina avança para fora (k = 0 no topo, 1 na base) — permite seguir a face de uma pedra.
export function makeCascade(w = 3, h = 10, bow = (k) => k * k * 1.6) {
  const geo = new THREE.PlaneGeometry(w, h, 4, 16);
  const pa = geo.attributes.position;
  for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); pa.setZ(i, bow((h / 2 - y) / h) + Math.abs(pa.getX(i)) * -0.08); }
  geo.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: timeU },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main(){ float s = vn(vec2(vUv.x * 14.0, vUv.y * 3.0 + uTime * 2.6)) * 0.6 + vn(vec2(vUv.x * 30.0, vUv.y * 6.0 + uTime * 4.0)) * 0.4;
  vec3 c = mix(vec3(0.35, 0.6, 0.68), vec3(1.25), smoothstep(0.35, 0.8, s));
  float a = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) * (0.75 + 0.25 * s);
  gl_FragColor = vec4(c, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat);
  m.position.y = h / 2;
  g.add(m);
  const mist = particles({ count: 40, mode: 2, spread: [w * 1.6, 1.5, 2.5], color: '#e8f4f6', size: 0.7, opacity: 0.35, additive: false });
  mist.position.set(0, 0.6, 1.4);
  g.add(mist);
  g.userData.dynamic = true;
  return g;
}

// Bando de pássaros (ou borboletas) circulando, com bater de asas no shader.
export function makeFlyers({ count = 16, center = new THREE.Vector3(), radius = 50, height = 40, color = '#2a2622', size = 0.7, flap = 10, speed = 0.12, glowK = 0 } = {}) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.3, -1, 0, -0.1, 0, 0, -0.3, 0, 0, 0.3, 0, 0, -0.3, 1, 0, -0.1], 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(glowK || 1), side: THREE.DoubleSide, fog: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed.y += abs(position.x) * sin(uTime * ${flap.toFixed(1)} + float(gl_InstanceID) * 1.7) * 0.7;`);
  };
  mat.customProgramCacheKey = () => 'fly' + flap;
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.frustumCulled = false;
  const o = new THREE.Object3D();
  const data = Array.from({ length: count }, (_, i) => ({ r: radius * (0.5 + Math.random() * 0.6), a: Math.random() * 6.28, s: speed * (0.7 + Math.random() * 0.6) * (i % 5 === 0 ? -1 : 1), h: height + (Math.random() - 0.5) * height * 0.3, p: Math.random() * 6.28 }));
  m.userData.dynamic = true;
  m.userData.update = (t) => {
    data.forEach((d, i) => {
      const a = d.a + t * d.s;
      o.position.set(center.x + Math.cos(a) * d.r, center.y + d.h + Math.sin(t * 0.5 + d.p) * 2, center.z + Math.sin(a) * d.r);
      o.rotation.set(0, -a + (d.s > 0 ? 0 : Math.PI), 0);
      o.scale.setScalar(size);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  };
  return m;
}
