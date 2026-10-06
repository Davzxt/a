// Personagens estilizados montados com primitivas, com animação procedural
// (andar, correr, conversar, carregar, tocar tambor, dançar, sentar, trabalhar...).
import * as THREE from 'three';
import { M } from '../core/engine.js';

const CAP = (r, l, seg = 8) => new THREE.CapsuleGeometry(r, l, 3, seg);
function part(geo, m, p, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  p.add(o);
  return o;
}
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
  return keffTex;
}
const ring = (r, tube, m, p, x, y, z, sx = 1, sz = 1) => { const o = part(new THREE.TorusGeometry(r, tube, 5, 14), m, p, x, y, z); o.rotation.x = Math.PI / 2; o.scale.set(sx, sz, 1); return o; };

const POSE = { bodyY: 0, spineX: 0, spineY: 0, spineZ: 0, headX: 0, headY: 0, lsx: 0, lsz: 0.08, rsx: 0, rsz: -0.08, lex: -0.12, rex: -0.12, ltx: 0, rtx: 0, lkx: 0, rkx: 0 };

export class Character {
  constructor(spec = {}) {
    const s = (this.spec = {
      skin: '#8a5a3c', hair: '#16110d', hairStyle: 'short', top: '#e9e1cf', topType: 'shirt', sleeves: 'long',
      bottom: '#5d4b3a', bottomType: 'pants', shoes: '#3b2a1e', barefoot: false, hat: null, hatColor: '#c9a35b',
      beard: null, scale: 1, build: 1, stoop: 0, child: false, ...spec,
    });
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.seed = Math.random() * 10;
    this.phase = 0; this.moveSpeed = 0; this.anim = 'idle'; this.lookAt = null; this.blink = 2 + Math.random() * 3;
    this.cur = { ...POSE }; this.tgt = { ...POSE };
    const skin = M(s.skin, { roughness: 0.6 }), top = M(s.top), bot = M(s.bottom), hairM = M(s.hair, { roughness: 0.9 });
    const shoe = s.barefoot ? skin : M(s.shoes), b = s.build;
    const pants = s.bottomType === 'pants' || s.bottomType === 'rolled';
    const hips = (this.hips = new THREE.Group());
    hips.position.y = 0.93;
    this.body.add(hips);
    this.legs = [1, -1].map((side) => {
      const thigh = new THREE.Group();
      thigh.position.set(0.095 * side * b, -0.02, 0);
      hips.add(thigh);
      const bg = s.baggy ? 1.3 : 1;
      part(CAP(0.072 * b * bg, 0.3), pants ? bot : skin, thigh, 0, -0.21, 0);
      const knee = new THREE.Group();
      knee.position.y = -0.44;
      thigh.add(knee);
      part(CAP(0.058 * b * bg, 0.3), s.bottomType === 'pants' ? bot : skin, knee, 0, -0.2, 0);
      if (s.bottomType === 'rolled') ring(0.07, 0.03, bot, knee, 0, -0.05, 0);
      if (s.bands) for (const y of [-0.36, -0.39]) ring(0.06, 0.012, M(s.bands), knee, 0, y, 0);
      part(new THREE.BoxGeometry(0.1, 0.07, 0.22), shoe, knee, 0, -0.43, 0.045);
      return { thigh, knee };
    });
    part(CAP(0.14, 0.06, 8), pants ? bot : s.bottomType === 'fiber' ? M(s.bottom) : skin, hips, 0, 0.03, 0).scale.set(1.15 * b, 1, 0.8);
    const spine = (this.spine = new THREE.Group());
    hips.add(spine);
    const bare = s.topType === 'none';
    part(CAP(0.155, 0.28, 10), bare || s.topType === 'wrap' ? skin : top, spine, 0, 0.27, 0).scale.set(1.18 * b, 1, 0.74);
    if (s.topType === 'wrap') part(new THREE.CylinderGeometry(0.17, 0.165, 0.16, 12), top, spine, 0, 0.36, 0).scale.set(1.18 * b, 1, 0.76);
    if (s.vest) part(CAP(0.162, 0.22, 10), M(s.vest), spine, 0, 0.29, 0).scale.set(1.2 * b, 1, 0.78);
    if (s.suspenders) for (const x of [-0.07, 0.07]) part(new THREE.BoxGeometry(0.03, 0.42, 0.25), M(s.suspenders), spine, x, 0.28, 0);
    if (s.belt) ring(0.15, 0.02, M(s.belt), hips, 0, 0.08, 0, 1.15 * b, 0.82);
    if (s.sash) part(new THREE.CylinderGeometry(0.168, 0.162, 0.13, 14), M(s.sash), hips, 0, 0.1, 0).scale.set(1.18 * b, 1, 0.8);
    if (s.waistband) part(new THREE.CylinderGeometry(0.172, 0.172, 0.07, 14), M(s.waistband), hips, 0, 0.06, 0).scale.set(1.12, 1, 0.86);
    if (s.keffiyeh) {
      const km = new THREE.MeshStandardMaterial({ map: keffiyeh(), roughness: 0.9 });
      for (const z of [0.115, -0.115]) part(new THREE.BoxGeometry(0.13, 0.62, 0.025), km, spine, 0.1, 0.27, z).rotation.z = 0.12;
      part(new THREE.BoxGeometry(0.14, 0.03, 0.26), km, spine, 0.12, 0.55, 0);
    }
    if (s.satchel) {
      for (const z of [0.12, -0.12]) part(new THREE.BoxGeometry(0.035, 0.6, 0.02), M(s.satchel), spine, 0, 0.3, z).rotation.z = 0.62;
      part(new THREE.BoxGeometry(0.08, 0.2, 0.22), M(s.satchel), hips, 0.2, 0.0, 0.02);
    }
    if (s.apron) part(new THREE.BoxGeometry(0.3, 0.55, 0.02), M(s.apron), hips, 0, -0.2, 0.17);
    if (s.bottomType === 'dress' || s.bottomType === 'skirt') part(new THREE.CylinderGeometry(0.17, s.bottomType === 'dress' ? 0.34 : 0.3, 0.78, 12), bot, hips, 0, -0.35, 0).scale.set(1, 1, 0.85);
    if (s.bottomType === 'fiber') {
      const sk = new THREE.CylinderGeometry(0.165, 0.27, 0.42, 18, 1, true);
      const p = sk.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) - (i % 2) * 0.06);
      sk.computeVertexNormals();
      part(sk, M(s.bottom, { side: THREE.DoubleSide }), hips, 0, -0.14, 0).scale.set(1.05, 1, 0.85);
    }
    part(new THREE.CylinderGeometry(0.048, 0.055, 0.12, 8), skin, spine, 0, 0.55, 0);
    if (s.scarfNeck) part(new THREE.TorusGeometry(0.07, 0.025, 5, 10), M(s.scarfNeck), spine, 0, 0.52, 0.01).rotation.x = Math.PI / 2;
    // braços
    const sleeveU = bare || s.topType === 'wrap' || s.sleeves === 'none' ? skin : s.coat ? M(s.coat) : top;
    const sleeveL = s.sleeves === 'long' && !bare && s.topType !== 'wrap' ? sleeveU : skin;
    this.arms = [1, -1].map((side) => {
      const sh = new THREE.Group();
      sh.position.set(0.205 * side * b, 0.47, 0);
      spine.add(sh);
      part(CAP(0.052, 0.22), sleeveU, sh, 0, -0.15, 0);
      const el = new THREE.Group();
      el.position.y = -0.3;
      sh.add(el);
      part(CAP(0.045, 0.2), sleeveL, el, 0, -0.13, 0);
      const hand = new THREE.Group();
      hand.position.y = -0.27;
      el.add(hand);
      part(new THREE.SphereGeometry(0.05, 8, 6), skin, hand, 0, -0.02, 0).scale.set(0.9, 1.1, 0.7);
      if (s.bands) { ring(0.058, 0.02, M(s.bands), sh, 0, -0.1, 0); ring(0.05, 0.016, M(s.bands), el, 0, -0.2, 0); }
      let cuff = null;
      if (s.cuffs) cuff = ring(0.052, 0.02, M('#3a3a3c', { metalness: 0.6, roughness: 0.45 }), el, 0, -0.2, 0);
      return { sh, el, hand, cuff };
    });
    // cabeça
    const head = (this.head = new THREE.Group());
    head.position.y = 0.6;
    spine.add(head);
    if (s.child) head.scale.setScalar(1.22);
    part(new THREE.SphereGeometry(0.128, 16, 12), skin, head, 0, 0.115, 0).scale.set(0.95, 1.06, 1);
    for (const sd of [-1, 1]) part(new THREE.SphereGeometry(0.028, 6, 5), skin, head, 0.12 * sd, 0.11, -0.005).scale.set(0.5, 1, 0.8);
    const white = M('#f3eee6', { roughness: 0.4, flatShading: false }), dark = M('#17110d', { roughness: 0.25, flatShading: false });
    this.eyes = [-1, 1].map((sd) => {
      const e = new THREE.Group();
      e.position.set(0.045 * sd, 0.128, 0.104);
      head.add(e);
      part(new THREE.SphereGeometry(0.022, 10, 8), white, e).scale.set(1, 1.15, 0.55);
      part(new THREE.SphereGeometry(0.0135, 8, 6), dark, e, 0, -0.002, 0.009);
      part(new THREE.BoxGeometry(0.045, 0.009, 0.012), hairM, head, 0.046 * sd, 0.166, 0.112).rotation.z = -0.1 * sd;
      return e;
    });
    part(new THREE.ConeGeometry(0.018, 0.05, 4), skin, head, 0, 0.096, 0.13).rotation.x = Math.PI / 2;
    part(new THREE.BoxGeometry(0.038, 0.008, 0.01), M('#5a2e26'), head, 0, 0.058, 0.119);
    if (s.paint === 'puri') for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) part(new THREE.BoxGeometry(0.045, 0.011, 0.008), M('#c4281a'), head, 0.068 * sd, 0.098 - k * 0.02, 0.101).rotation.y = 0.55 * sd;
    if (s.necklace) {
      const nk = part(new THREE.TorusGeometry(0.12, 0.012, 5, 18), M('#5a3420'), spine, 0, 0.5, 0.02);
      nk.rotation.x = Math.PI / 2 - 0.25;
      for (let k = 0; k < 9; k++) {
        const a = Math.PI * (0.18 + (k / 8) * 0.64), x = Math.cos(a) * 0.125, z = Math.sin(a) * 0.105, y = 0.475 - Math.sin(a) * 0.03;
        if (s.necklace === 'teeth' && k % 2 === 0) part(new THREE.ConeGeometry(0.012, 0.06, 5), M('#f1ead8'), spine, x, y - 0.03, z + 0.01).rotation.x = Math.PI;
        else part(new THREE.SphereGeometry(0.016, 6, 5), M(k % 4 === 1 ? '#b8231c' : '#3a2416'), spine, x, y, z);
      }
    }
    // cabelo
    const hs = s.hairStyle;
    if (hs !== 'bald' && hs !== 'curly') {
      const capR = hs === 'scarf' ? 0.146 : 0.138;
      const cap = part(new THREE.SphereGeometry(capR, 14, 10, 0, Math.PI * 2, 0, Math.PI * (hs === 'short' ? 0.5 : 0.56)), hs === 'scarf' ? M(s.scarf || '#c0472f') : hairM, head, 0, 0.12, -0.008);
      cap.scale.set(0.98, 1.06, 1.04);
      cap.rotation.x = -0.22;
    }
    if (hs === 'curly') part(new THREE.IcosahedronGeometry(0.146, 1), hairM, head, 0, 0.165, -0.012).scale.set(1, 0.82, 1.04);
    if (hs === 'long') {
      part(new THREE.BoxGeometry(0.25, 0.44, 0.07), hairM, head, 0, -0.05, -0.095).rotation.x = 0.12;
      part(new THREE.BoxGeometry(0.21, 0.045, 0.05), hairM, head, 0, 0.205, 0.095);
      for (const sd of [-1, 1]) part(new THREE.BoxGeometry(0.04, 0.26, 0.09), hairM, head, 0.12 * sd, 0.02, -0.02);
    }
    if (hs === 'bun') part(new THREE.SphereGeometry(0.06, 8, 6), hairM, head, 0, 0.19, -0.11);
    if (hs === 'braid') part(CAP(0.035, 0.32), hairM, head, 0, -0.1, -0.12).rotation.x = 0.15;
    if (hs === 'scarf') part(new THREE.SphereGeometry(0.055, 8, 6), M(s.scarf || '#c0472f'), head, 0, 0.17, -0.13);
    // chapéus
    const hc = M(s.hatColor);
    if (s.hat === 'straw') { part(new THREE.CylinderGeometry(0.3, 0.3, 0.018, 18), hc, head, 0, 0.21, 0); part(new THREE.CylinderGeometry(0.12, 0.14, 0.12, 14), hc, head, 0, 0.27, 0); }
    if (s.hat === 'fedora') { part(new THREE.CylinderGeometry(0.21, 0.21, 0.016, 16), hc, head, 0, 0.215, 0); part(new THREE.CylinderGeometry(0.11, 0.135, 0.13, 14), hc, head, 0, 0.28, 0); part(new THREE.CylinderGeometry(0.136, 0.136, 0.03, 14), M('#2a2420'), head, 0, 0.235, 0); }
    if (s.hat === 'cap') { part(new THREE.CylinderGeometry(0.135, 0.13, 0.09, 14), hc, head, 0, 0.245, 0); part(new THREE.BoxGeometry(0.15, 0.012, 0.09), M('#1a1a1a'), head, 0, 0.205, 0.13); }
    if (s.hat === 'flatcap') {
      const cap = part(new THREE.SphereGeometry(0.152, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hc, head, 0, 0.19, -0.01);
      cap.scale.set(1.06, 0.5, 1.14); cap.rotation.x = 0.16;
      part(new THREE.BoxGeometry(0.17, 0.014, 0.075), hc, head, 0, 0.2, 0.135).rotation.x = 0.25;
    }
    if (s.hat === 'fez') {
      part(new THREE.CylinderGeometry(0.096, 0.118, 0.16, 14), M('#a3201c'), head, 0, 0.27, -0.005).rotation.x = -0.08;
      part(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 4), M('#111'), head, 0.02, 0.31, -0.08).rotation.x = 0.9;
      part(new THREE.SphereGeometry(0.018, 6, 5), M('#111'), head, 0.02, 0.27, -0.12);
    }
    if (s.headdress === 'cocar') {
      const band = part(new THREE.CylinderGeometry(0.143, 0.143, 0.05, 18, 1, true), M('#b9762e', { side: THREE.DoubleSide }), head, 0, 0.19, 0);
      band.rotation.x = -0.12;
      const cols = ['#c8321e', '#f0b429', '#1e1a17', '#d84a1a', '#f6c445', '#2a2420'];
      for (let k = 0; k < 9; k++) {
        const a = -1.15 + (k / 8) * 2.3, f = part(new THREE.SphereGeometry(1, 6, 4), M(cols[k % cols.length]), head, Math.sin(a) * 0.12, 0.31 + Math.cos(a) * 0.1, -0.07);
        f.scale.set(0.034, 0.17, 0.012); f.rotation.z = -a * 0.85; f.rotation.x = -0.25;
      }
    }
    if (s.beard === 'mustache' || s.beard === 'full') part(new THREE.BoxGeometry(0.075, 0.02, 0.025), hairM, head, 0, 0.074, 0.122);
    if (s.beard === 'full') part(new THREE.SphereGeometry(0.075, 8, 6), hairM, head, 0, 0.04, 0.075).scale.set(1.15, 0.85, 0.75);
    this.holder = new THREE.Group();
    this.holder.position.set(0, 0.24, 0.34);
    spine.add(this.holder);
    if (s.child) this.root.scale.setScalar(0.62 * s.scale);
    else this.root.scale.setScalar(s.scale);
    if (s.cuffs) {
      this.links = [];
      for (let k = 0; k < 9; k++) { const l = part(new THREE.TorusGeometry(0.017, 0.006, 4, 8), M('#4a4a4e', { metalness: 0.6, roughness: 0.45 }), this.root); l.castShadow = false; this.links.push(l); }
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
    const closed = this.blink < 0.12;
    if (this.blink < 0) this.blink = 2.5 + Math.random() * 3;
    for (const e of this.eyes) e.scale.y = closed ? 0.12 : 1;
    if (this.links) {
      this.root.updateMatrixWorld(true);
      const A = this.arms[0].cuff.getWorldPosition(this._ha || (this._ha = new THREE.Vector3())), B = this.arms[1].cuff.getWorldPosition(this._hb || (this._hb = new THREE.Vector3()));
      this.root.worldToLocal(A); this.root.worldToLocal(B);
      const n = this.links.length;
      this.links.forEach((l, i) => {
        const t = (i + 0.5) / n;
        l.position.lerpVectors(A, B, t);
        l.position.y -= Math.sin(Math.PI * t) * 0.06;
        l.rotation.set(i % 2 ? Math.PI / 2 : 0, Math.atan2(B.x - A.x, B.z - A.z) + Math.PI / 2, 0);
      });
    }
  }

  // Versão "memória": figura feita de luz (epílogo).
  ghost(color) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.AdditiveBlending });
    m.userData.own = true;
    this.root.traverse((o) => { if (o.isMesh) { o.material = m; o.castShadow = false; } });
    return m;
  }
}
