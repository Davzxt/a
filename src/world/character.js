// Personagens estilizados (proporções de animação: cabeça um pouco maior, formas arredondadas),
// montados com primitivas lisas e animação procedural (andar, correr, conversar, carregar, tocar
// tambor, dançar, sentar, trabalhar...). Cada articulação vira UMA malha com cores por vértice:
// cerca de 11 chamadas de desenho por personagem.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M } from '../core/engine.js';

const CAP = (r, l, seg = 10) => new THREE.CapsuleGeometry(r, l, 4, seg);
const SPH = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
// Perfis sempre de baixo para cima: assim as faces e normais apontam para fora.
const LATHE = (pts, seg = 18, p0 = 0, pl = Math.PI * 2) => {
  const P = pts[0][1] > pts[pts.length - 1][1] ? pts.slice().reverse() : pts;
  return new THREE.LatheGeometry(P.map(([x, y]) => new THREE.Vector2(x, y)), seg, p0, pl);
};
const TOR = (r, t, rs = 6, ts = 16, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc);
// Membro afunilado com pontas arredondadas, do ponto de articulação (y = 0) até y = -len.
const LIMB = (r0, r1, len, seg = 12) => LATHE([[0, r0 * 0.95], [r0 * 0.72, r0 * 0.66], [r0, 0.0], [(r0 + r1) / 2 * 1.02, -len * 0.45], [r1, -len], [r1 * 0.72, -len - r1 * 0.66], [0, -len - r1 * 0.95]], seg);

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

// Acumula peças por articulação e junta tudo numa malha por articulação.
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
class Kit {
  constructor() { this.groups = new Map(); }
  add(grp, geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    _m4.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...(typeof scl === 'number' ? [scl, scl, scl] : scl)));
    g.applyMatrix4(_m4);
    _c.set(color);
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    if (!this.groups.has(grp)) this.groups.set(grp, []);
    this.groups.get(grp).push(g);
    return g;
  }
  build(mat) {
    const out = new Map();
    for (const [grp, list] of this.groups) {
      const m = new THREE.Mesh(mergeGeometries(list), mat);
      list.forEach((g) => g.dispose());
      m.castShadow = true;
      m.receiveShadow = true;
      grp.add(m);
      out.set(grp, m);
    }
    return out;
  }
}
const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const tint = (hex, to, k) => new THREE.Color(hex).lerp(new THREE.Color(to), k);

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

const POSE = { bodyY: 0, spineX: 0, spineY: 0, spineZ: 0, headX: 0, headY: 0, lsx: 0, lsz: 0.08, rsx: 0, rsz: -0.08, lex: -0.12, rex: -0.12, ltx: 0, rtx: 0, lkx: 0, rkx: 0 };

export class Character {
  constructor(spec = {}) {
    const s = (this.spec = {
      skin: '#8a5a3c', hair: '#16110d', hairStyle: 'short', top: '#e9e1cf', topType: 'shirt', sleeves: 'long',
      bottom: '#5d4b3a', bottomType: 'pants', shoes: '#3b2a1e', barefoot: false, hat: null, hatColor: '#c9a35b',
      beard: null, scale: 1, build: 1, stoop: 0, child: false, eyes: '#2a1a10', ...spec,
    });
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.seed = Math.random() * 10;
    this.phase = 0; this.moveSpeed = 0; this.anim = 'idle'; this.lookAt = null; this.blink = 2 + Math.random() * 3;
    this.cur = { ...POSE }; this.tgt = { ...POSE };
    const K = new Kit(), b = s.build, skin = s.skin, hair = s.hair, top = s.top, bot = s.bottom;
    const pants = s.bottomType === 'pants' || s.bottomType === 'rolled', bare = s.topType === 'none';
    const shoe = s.barefoot ? null : s.shoes;
    const bg = s.baggy ? 1.32 : 1;
    // ---------- quadril e pernas ----------
    const hips = (this.hips = new THREE.Group());
    hips.position.y = 0.93;
    this.body.add(hips);
    const hipCol = pants ? bot : s.bottomType === 'fiber' ? s.bottom : skin;
    K.add(hips, LATHE([[0, -0.12], [0.1, -0.112], [0.142, -0.06], [0.152, 0.02], [0.14, 0.1], [0, 0.115]], 16), hipCol, [0, 0.02, 0], [0, 0, 0], [1.12 * b * (s.baggy ? 1.08 : 1), 1, 0.8]);
    this.legs = [1, -1].map((side) => {
      const thigh = new THREE.Group();
      thigh.position.set(0.095 * side * b, -0.02, 0);
      hips.add(thigh);
      K.add(thigh, LIMB(0.082 * b * bg, 0.062 * b * bg, 0.42), pants ? bot : skin, [0, 0, 0]);
      const knee = new THREE.Group();
      knee.position.y = -0.44;
      thigh.add(knee);
      const shinCol = s.bottomType === 'pants' ? bot : skin;
      K.add(knee, LIMB(0.062 * b * (s.bottomType === 'pants' ? bg : 1), 0.044 * b * (s.bottomType === 'pants' ? bg : 1), 0.37), shinCol, [0, 0, 0]);
      if (s.bottomType === 'rolled') K.add(knee, TOR(0.064, 0.022, 6, 14), shade(bot, 0.9), [0, -0.035, 0], [Math.PI / 2, 0, 0]);
      if (s.bottomType === 'pants' && s.baggy) K.add(knee, TOR(0.065, 0.025, 6, 14), shade(bot, 0.8), [0, -0.37, 0], [Math.PI / 2, 0, 0]);
      if (s.bands) for (const y of [-0.34, -0.37]) K.add(knee, TOR(0.062, 0.012, 5, 12), s.bands, [0, y, 0], [Math.PI / 2, 0, 0]);
      if (shoe) {
        K.add(knee, SPH(1, 12, 8), shoe, [0, -0.425, 0.035], [0, 0, 0], [0.062, 0.05, 0.125]);
        K.add(knee, CAP(0.058, 0.06, 8), shoe, [0, -0.39, -0.005], [0, 0, 0], [1, 1, 1]);
        K.add(knee, new THREE.BoxGeometry(0.11, 0.022, 0.24), shade(shoe, 0.45), [0, -0.462, 0.035]);
      } else {
        K.add(knee, SPH(1, 12, 8), skin, [0, -0.44, 0.035], [0, 0, 0], [0.052, 0.035, 0.11]);
        for (let t = -1; t <= 1; t++) K.add(knee, SPH(0.014, 6, 5), skin, [t * 0.02, -0.455, 0.135]);
      }
      return { thigh, knee };
    });
    // saias e vestidos
    if (s.bottomType === 'dress' || s.bottomType === 'skirt') {
      const R = s.bottomType === 'dress' ? 0.35 : 0.3;
      K.add(hips, LATHE([[0.15, 0.1], [0.165, -0.02], [0.22, -0.3], [R * 0.95, -0.66], [R, -0.74], [R - 0.012, -0.75]], 20), bot, [0, 0, 0], [0, 0, 0], [1, 1, 0.86]);
      K.add(hips, LATHE([[R - 0.005, -0.68], [R + 0.012, -0.72], [R + 0.004, -0.75]], 20), shade(bot, 0.72), [0, 0, 0], [0, 0, 0], [1, 1, 0.86]);
    }
    if (s.bottomType === 'fiber') {
      // saia de fibras: tiras soltas com tons variados
      const n = 26;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, len = 0.36 + ((i * 7) % 5) * 0.025;
        K.add(hips, new THREE.BoxGeometry(0.05, len, 0.014), shade(s.bottom, 0.82 + ((i * 3) % 4) * 0.08), [Math.sin(a) * 0.165 * 1.08, -len / 2 + 0.06, Math.cos(a) * 0.165 * 0.86], [-Math.cos(a) * 0.18, a, Math.sin(a) * 0.18]);
      }
    }
    if (s.belt) K.add(hips, TOR(0.152, 0.022, 6, 20), s.belt, [0, 0.08, 0], [Math.PI / 2, 0, 0], [1.13 * b, 0.82, 1]);
    if (s.sash) K.add(hips, LATHE([[0.162, 0.03], [0.168, 0.1], [0.162, 0.17]], 18), s.sash, [0, 0, 0], [0, 0, 0], [1.18 * b, 1, 0.82]);
    if (s.waistband) K.add(hips, LATHE([[0.168, 0.03], [0.174, 0.065], [0.168, 0.1]], 18), s.waistband, [0, 0, 0], [0, 0, 0], [1.12, 1, 0.86]);
    if (s.apron) K.add(hips, LATHE([[0.155, 0.09], [0.17, -0.02], [0.225, -0.3], [0.3, -0.6]], 8, -0.62, 1.24), s.apron, [0, 0, 0], [0, 0, 0], [1.04, 1, 0.92]);
    if (s.satchel) K.add(hips, new THREE.BoxGeometry(0.08, 0.2, 0.22), s.satchel, [0.2 * b, 0.0, 0.02]);
    // ---------- tronco ----------
    const spine = (this.spine = new THREE.Group());
    hips.add(spine);
    const torsoCol = bare || s.topType === 'wrap' ? skin : top;
    const TORSO = [[0, -0.02], [0.13, 0.0], [0.137, 0.08], [0.152, 0.2], [0.164, 0.3], [0.165, 0.4], [0.152, 0.465], [0.11, 0.52], [0.055, 0.555], [0, 0.565]];
    K.add(spine, LATHE(TORSO, 18), torsoCol, [0, 0, 0], [0, 0, 0], [1.18 * b, 1, 0.74]);
    if (bare) {
      if (s.paint === 'puri') for (const y of [0.25, 0.29]) K.add(spine, new THREE.BoxGeometry(0.2 * b, 0.014, 0.01), '#b0301e', [0, y, 0.112], [0.08, 0, 0]);
    } else if (s.topType === 'wrap') {
      K.add(spine, LATHE([[0.16, 0.2], [0.172, 0.3], [0.168, 0.4], [0.15, 0.45]], 18), top, [0, 0, 0], [0, 0, 0], [1.19 * b, 1, 0.77]);
      K.add(spine, new THREE.BoxGeometry(0.05, 0.3, 0.02), shade(top, 0.85), [0.09, 0.42, 0.1], [0.15, 0, -0.5]);
    } else {
      // camisa: gola e botões
      K.add(spine, TOR(0.062, 0.019, 6, 16), shade(top, 0.95), [0, 0.525, 0.005], [Math.PI / 2 + 0.25, 0, 0], [1.05, 0.95, 1]);
      if (!s.vest) for (let i = 0; i < 3; i++) K.add(spine, SPH(0.009, 6, 4), shade(top, 0.75), [0, 0.42 - i * 0.1, 0.122 - i * 0.002]);
    }
    if (s.vest) {
      K.add(spine, LATHE([[0.142, 0.05], [0.16, 0.2], [0.171, 0.3], [0.166, 0.4], [0.148, 0.47], [0.108, 0.52]], 18, 0.42, Math.PI * 2 - 0.84), s.vest, [0, 0, 0], [0, 0, 0], [1.19 * b, 1, 0.78]);
      for (let i = 0; i < 3; i++) K.add(spine, SPH(0.009, 6, 4), '#c9a24a', [0.055 * b, 0.36 - i * 0.09, 0.119]);
    }
    if (s.suspenders) for (const x of [-0.07, 0.07]) {
      K.add(spine, new THREE.BoxGeometry(0.028, 0.44, 0.012), s.suspenders, [x * b, 0.27, 0.117], [0.06, 0, 0]);
      K.add(spine, new THREE.BoxGeometry(0.028, 0.44, 0.012), s.suspenders, [x * b, 0.27, -0.117], [-0.06, 0, 0]);
    }
    if (s.satchel) K.add(spine, new THREE.BoxGeometry(0.03, 0.62, 0.016), s.satchel, [0, 0.29, 0.122], [0.05, 0, 0.62]);
    K.add(spine, new THREE.CylinderGeometry(0.05, 0.057, 0.13, 12), skin, [0, 0.565, 0.005]);
    if (s.scarfNeck) K.add(spine, TOR(0.07, 0.025, 6, 12), s.scarfNeck, [0, 0.52, 0.01], [Math.PI / 2, 0, 0]);
    if (s.necklace) {
      K.add(spine, TOR(0.115, 0.009, 5, 20), '#5a3420', [0, 0.5, 0.025], [Math.PI / 2 - 0.3, 0, 0], [1.08, 1, 1]);
      for (let k = 0; k < 11; k++) {
        const a = Math.PI * (0.15 + (k / 10) * 0.7), x = Math.cos(a) * 0.124, z = Math.sin(a) * 0.1, y = 0.478 - Math.sin(a) * 0.035;
        if (s.necklace === 'teeth' && k % 2 === 0) K.add(spine, new THREE.ConeGeometry(0.011, 0.055, 6), '#f1ead8', [x, y - 0.03, z + 0.012], [Math.PI, 0, 0]);
        else K.add(spine, SPH(0.016, 7, 5), k % 4 === 1 ? '#b8231c' : '#3a2416', [x, y, z + 0.008]);
      }
    }
    // ---------- braços ----------
    const sleeveU = bare || s.topType === 'wrap' || s.sleeves === 'none' ? skin : s.coat || top;
    const longS = s.sleeves === 'long' && !bare && s.topType !== 'wrap';
    const sleeveL = longS ? sleeveU : skin;
    this.arms = [1, -1].map((side) => {
      const sh = new THREE.Group();
      sh.position.set(0.186 * side * b, 0.455, 0);
      spine.add(sh);
      K.add(sh, SPH(0.057, 12, 8), sleeveU, [-side * 0.012, 0.0, 0], [0, 0, 0], [1.05, 0.85, 0.9]);
      if (s.sleeves === 'short' && !bare) {
        K.add(sh, LIMB(0.054, 0.044, 0.29), skin);
        K.add(sh, LATHE([[0.062, 0.02], [0.068, -0.08], [0.068, -0.13], [0.058, -0.135]], 12), sleeveU, [0, -0.0, 0]);
      } else K.add(sh, LIMB(0.058 * (longS && s.baggy ? 1.1 : 1), 0.047 * (longS && s.baggy ? 1.1 : 1), 0.29), sleeveU);
      if (s.bands) { K.add(sh, TOR(0.06, 0.016, 5, 12), s.bands, [0, -0.1, 0], [Math.PI / 2, 0, 0]); }
      if (s.paint === 'puri' && bare) for (const y of [-0.17, -0.2]) K.add(sh, TOR(0.056, 0.006, 4, 12), '#b0301e', [0, y, 0], [Math.PI / 2, 0, 0]);
      const el = new THREE.Group();
      el.position.y = -0.3;
      sh.add(el);
      K.add(el, LIMB(0.048, 0.035, 0.25), sleeveL);
      if (longS) K.add(el, TOR(0.047, 0.014, 5, 12), shade(sleeveL, 0.88), [0, -0.235, 0], [Math.PI / 2, 0, 0]);
      if (s.bands) K.add(el, TOR(0.05, 0.014, 5, 12), s.bands, [0, -0.2, 0], [Math.PI / 2, 0, 0]);
      const hand = new THREE.Group();
      hand.position.y = -0.27;
      el.add(hand);
      // mão em "luva": palma + polegar (incluída na malha do antebraço)
      K.add(el, SPH(1, 12, 9), skin, [0, -0.29, 0.005], [0, 0, 0], [0.047, 0.06, 0.034]);
      K.add(el, CAP(0.016, 0.04, 6), skin, [-side * 0.03, -0.27, 0.03], [-0.5, 0, side * 0.5]);
      let cuff = null;
      if (s.cuffs) {
        cuff = new THREE.Mesh(TOR(0.054, 0.02, 6, 14), M('#4a4a50', { metalness: 0.6, roughness: 0.4 }));
        cuff.position.y = -0.2; cuff.rotation.x = Math.PI / 2; cuff.castShadow = true;
        el.add(cuff);
      }
      return { sh, el, hand, cuff };
    });
    // ---------- cabeça ----------
    const head = (this.head = new THREE.Group());
    head.position.y = 0.6;
    spine.add(head);
    if (s.child) head.scale.setScalar(1.22);
    const HEAD = [[0.0, 0.0], [0.05, 0.004], [0.086, 0.026], [0.113, 0.066], [0.129, 0.112], [0.135, 0.156], [0.129, 0.2], [0.107, 0.239], [0.07, 0.263], [0, 0.274]];
    K.add(head, LATHE(HEAD, 22), skin, [0, 0, 0], [0, 0, 0], [0.95, 1, 1.04]);
    for (const sd of [-1, 1]) K.add(head, SPH(0.03, 8, 6), skin, [0.127 * sd, 0.13, -0.008], [0, 0, 0], [0.45, 1, 0.75]);
    // rosto: olhos grandes com brilho, sobrancelhas, nariz, boca, bochechas
    for (const sd of [-1, 1]) {
      K.add(head, SPH(1, 14, 10), '#f6f1ea', [0.047 * sd, 0.135, 0.11], [0, 0, 0], [0.026, 0.03, 0.017]);
      K.add(head, SPH(1, 12, 8), s.eyes, [0.046 * sd, 0.133, 0.122], [0, 0, 0], [0.0165, 0.019, 0.008]);
      K.add(head, SPH(1, 8, 6), '#0c0806', [0.046 * sd, 0.133, 0.127], [0, 0, 0], [0.008, 0.009, 0.005]);
      K.add(head, SPH(0.0048, 6, 4), '#ffffff', [0.046 * sd + 0.006, 0.142, 0.131]);
      K.add(head, new THREE.BoxGeometry(0.05, 0.012, 0.016), s.beard === 'full' || s.hairStyle === 'bald' ? shade(hair, 0.9) : hair, [0.047 * sd, 0.173, 0.117], [0.15, 0, -0.14 * sd]);
      K.add(head, SPH(0.022, 8, 6), tint(skin, '#e05050', 0.22), [0.074 * sd, 0.09, 0.104], [0, 0, 0], [1.2, 0.8, 0.4]);
    }
    K.add(head, SPH(1, 10, 8), shade(skin, 0.96), [0, 0.1, 0.131], [0, 0, 0], [0.021, 0.026, 0.026]);
    K.add(head, TOR(0.019, 0.0048, 4, 10, Math.PI), '#6a2a22', [0, 0.072, 0.122], [0, 0, Math.PI], [1, 0.75, 0.6]);
    if (s.paint === 'puri') for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) K.add(head, new THREE.BoxGeometry(0.045, 0.011, 0.008), '#c4281a', [0.07 * sd, 0.104 - k * 0.02, 0.108], [0, 0.55 * sd, 0]);
    // pálpebras (só aparecem ao piscar)
    const lids = new THREE.Group();
    head.add(lids);
    const L = new Kit();
    for (const sd of [-1, 1]) L.add(lids, SPH(1, 12, 8), shade(skin, 0.92), [0.047 * sd, 0.137, 0.114], [0, 0, 0], [0.029, 0.033, 0.019]);
    this.lids = lids;
    // cabelo
    const hs = s.hairStyle;
    if (hs !== 'bald' && hs !== 'curly' && hs !== 'scarf') {
      K.add(head, new THREE.SphereGeometry(0.146, 20, 12, 0, Math.PI * 2, 0, Math.PI * (hs === 'short' ? 0.5 : 0.55)), hair, [0, 0.128, -0.012], [-0.24, 0, 0], [0.98, 1.0, 1.04]);
      K.add(head, new THREE.SphereGeometry(0.142, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hair, [0, 0.13, -0.02], [-0.75, 0, 0], [0.97, 1, 1]);
      for (const sd of [-1, 1]) K.add(head, new THREE.BoxGeometry(0.02, 0.06, 0.035), hair, [0.122 * sd, 0.15, 0.03]);
      K.add(head, SPH(0.05, 10, 6), hair, [0.03, 0.245, 0.07], [0, 0, 0.3], [1.3, 0.55, 0.9]);
    }
    if (hs === 'curly') {
      const n = 22;
      for (let i = 0; i < n; i++) {
        const t = i / n, phi = Math.acos(1 - t * 1.25), th = i * 2.4;
        const x = Math.sin(phi) * Math.cos(th), z = Math.sin(phi) * Math.sin(th), y = Math.cos(phi);
        if (z > 0.55 && y < 0.55) continue;
        K.add(head, new THREE.IcosahedronGeometry(0.048, 1), shade(hair, 0.9 + (i % 3) * 0.08), [x * 0.13 * 0.95, 0.15 + y * 0.12, z * 0.13 - 0.01]);
      }
      K.add(head, SPH(0.142, 16, 10), hair, [0, 0.16, -0.012], [0, 0, 0], [0.98, 0.82, 1.02]);
    }
    if (hs === 'long') {
      K.add(head, SPH(1, 14, 10), hair, [0, 0.02, -0.085], [0.12, 0, 0], [0.135, 0.24, 0.07]);
      for (const sd of [-1, 1]) K.add(head, CAP(0.035, 0.22, 8), hair, [0.115 * sd, 0.03, -0.02], [0.05, 0, 0.08 * sd]);
      K.add(head, new THREE.BoxGeometry(0.2, 0.04, 0.05), hair, [0, 0.215, 0.09], [0.35, 0, 0]);
    }
    if (hs === 'bun') K.add(head, SPH(0.062, 12, 8), hair, [0, 0.2, -0.11]);
    if (hs === 'braid') {
      for (let i = 0; i < 5; i++) K.add(head, SPH(0.036 - i * 0.003, 8, 6), hair, [0, 0.04 - i * 0.062, -0.13 - i * 0.008]);
      K.add(head, SPH(0.016, 6, 4), '#b8402e', [0, -0.27, -0.165]);
    }
    if (hs === 'scarf') {
      const sc = s.scarf || '#c0472f';
      K.add(head, new THREE.SphereGeometry(0.152, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), sc, [0, 0.128, -0.012], [-0.32, 0, 0], [0.98, 1.02, 1.05]);
      K.add(head, TOR(0.13, 0.022, 6, 20), shade(sc, 0.85), [0, 0.19, 0.01], [Math.PI / 2 - 0.3, 0, 0], [1, 1.06, 1]);
      K.add(head, SPH(0.058, 10, 8), sc, [0, 0.22, -0.13], [0, 0, 0], [1.2, 0.9, 0.9]);
      for (const sd of [-1, 1]) K.add(head, CAP(0.022, 0.09, 6), shade(sc, 0.9), [0.03 * sd, 0.15, -0.17], [0.6, 0, 0.4 * sd]);
    }
    // chapéus
    const hc = s.hatColor;
    if (s.hat === 'straw') {
      K.add(head, LATHE([[0.125, -0.006], [0.31, -0.018], [0.335, -0.03], [0.3, -0.004], [0.125, 0.012]], 24), hc, [0, 0.215, 0]);
      K.add(head, LATHE([[0, 0.13], [0.105, 0.125], [0.124, 0.06], [0.135, 0]], 20), hc, [0, 0.215, 0]);
      K.add(head, LATHE([[0.131, 0.02], [0.135, 0.045]], 20), '#7a4a2a', [0, 0.215, 0]);
    }
    if (s.hat === 'fedora') {
      K.add(head, LATHE([[0.13, -0.006], [0.2, -0.004], [0.225, 0.02], [0.205, 0.004], [0.13, 0.008]], 22), hc, [0, 0.218, 0]);
      K.add(head, LATHE([[0, 0.12], [0.07, 0.118], [0.11, 0.11], [0.128, 0.06], [0.136, 0]], 20), hc, [0, 0.218, 0], [0, 0, 0], [1, 1, 1.08]);
      K.add(head, LATHE([[0.135, 0.008], [0.139, 0.036]], 20), '#2a2420', [0, 0.218, 0], [0, 0, 0], [1, 1, 1.08]);
    }
    if (s.hat === 'cap') {
      K.add(head, new THREE.CylinderGeometry(0.15, 0.136, 0.1, 18), hc, [0, 0.255, 0]);
      K.add(head, new THREE.CylinderGeometry(0.137, 0.137, 0.025, 18), '#141414', [0, 0.215, 0]);
      K.add(head, SPH(1, 14, 6), '#151515', [0, 0.212, 0.11], [0.15, 0, 0], [0.11, 0.012, 0.075]);
      K.add(head, SPH(0.016, 6, 4), '#c9a24a', [0, 0.25, 0.147]);
    }
    if (s.hat === 'flatcap') {
      K.add(head, new THREE.SphereGeometry(0.155, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), hc, [0, 0.19, 0.0], [0.14, 0, 0], [1.07, 0.5, 1.16]);
      K.add(head, SPH(1, 14, 6), shade(hc, 0.85), [0, 0.2, 0.13], [0.25, 0, 0], [0.12, 0.012, 0.07]);
      K.add(head, SPH(0.012, 6, 4), shade(hc, 0.8), [0, 0.272, 0.01]);
    }
    if (s.hat === 'fez') {
      K.add(head, LATHE([[0, 0.17], [0.092, 0.168], [0.1, 0.15], [0.12, 0.0], [0.11, -0.005]], 18), '#a3201c', [0, 0.2, -0.005], [-0.08, 0, 0]);
      K.add(head, new THREE.CylinderGeometry(0.004, 0.004, 0.1, 4), '#111111', [0.02, 0.36, -0.06], [0.9, 0, 0]);
      K.add(head, CAP(0.014, 0.05, 6), '#111111', [0.02, 0.3, -0.11], [0.2, 0, 0]);
    }
    if (s.headdress === 'cocar') {
      K.add(head, LATHE([[0.142, 0.0], [0.146, 0.026], [0.142, 0.052]], 20), '#b9762e', [0, 0.165, 0], [-0.12, 0, 0], [0.98, 1, 1.05]);
      for (let k = 0; k < 9; k++) K.add(head, SPH(0.014, 6, 4), k % 2 ? '#1e1a17' : '#f0e0b0', [Math.sin(-1.2 + k * 0.3) * 0.142, 0.19, Math.cos(-1.2 + k * 0.3) * 0.146]);
      const cols = ['#c8321e', '#f0b429', '#1e3a8a', '#d84a1a', '#f6c445', '#2a6a4a', '#f2ece0'];
      for (let k = 0; k < 11; k++) {
        const a = -1.25 + (k / 10) * 2.5;
        K.add(head, SPH(1, 8, 6), cols[k % cols.length], [Math.sin(a) * 0.12, 0.31 + Math.cos(a) * 0.1, -0.07], [-0.25, 0, -a * 0.85], [0.032, 0.17, 0.01]);
        K.add(head, SPH(1, 6, 4), '#f2ece0', [Math.sin(a) * 0.112, 0.25 + Math.cos(a) * 0.085, -0.075], [-0.25, 0, -a * 0.85], [0.012, 0.07, 0.006]);
      }
    }
    if (s.beard === 'mustache' || s.beard === 'full') for (const sd of [-1, 1]) K.add(head, CAP(0.014, 0.035, 6), hair, [0.02 * sd, 0.083, 0.128], [0, 0, (Math.PI / 2 - 0.35) * sd]);
    if (s.beard === 'full') {
      K.add(head, new THREE.SphereGeometry(0.128, 18, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), hair, [0, 0.13, 0.008], [0.12, 0, 0], [0.96, 1.05, 1.06]);
      K.add(head, SPH(0.05, 10, 8), hair, [0, 0.03, 0.09], [0, 0, 0], [1.25, 0.9, 0.85]);
    }
    // keffiyeh (tecido com textura: malha própria)
    if (s.keffiyeh) {
      const km = new THREE.MeshStandardMaterial({ map: keffiyeh(), roughness: 0.9, side: THREE.DoubleSide });
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.152, 20, 12, Math.PI * 0.84, Math.PI * 1.32, 0, Math.PI * 0.6), km);
      hood.position.set(0, 0.128, -0.012); hood.rotation.x = -0.18; hood.scale.set(0.99, 1.02, 1.05); hood.castShadow = true;
      head.add(hood);
      const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.2, 0.22, 16, 1, true, Math.PI * 0.3, Math.PI * 1.4), km);
      drape.position.set(0, 0.02, -0.01); drape.castShadow = true;
      head.add(drape);
      for (const z of [0.105, -0.105]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.02), km); st.position.set(0.11, 0.3, z * 1.08); st.rotation.set(0, Math.PI / 2, 0.1); spine.add(st); }
    }
    K.build(M('#ffffff', { vertexColors: true, roughness: 0.66, rim: 0.85 }));
    L.build(M('#ffffff', { vertexColors: true, roughness: 0.66, rim: 0.85 }));
    lids.visible = false;
    this.holder = new THREE.Group();
    this.holder.position.set(0, 0.24, 0.34);
    spine.add(this.holder);
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
