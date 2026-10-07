// Ferramentas compartilhadas pelos capítulos: posições, adereços e minijogos.
import * as THREE from 'three';
import { riverZ } from '../world/terrain.js';
import { cyl, box, mk, bake } from '../world/props.js';
import { M } from '../core/engine.js';
import { particles } from '../core/fx.js';

// Ponto a "d" metros do rio (side +1 = margem norte, -1 = margem sul)
export const B = (x, side, d) => ({ x, z: riverZ(x) + side * d });

export function spear() {
  const g = new THREE.Group();
  cyl(g, 0.018, 0.022, 1.9, '#7a5a3a', 0, 0.5, 0, 6);
  mk(new THREE.ConeGeometry(0.035, 0.2, 5), M('#5c5a58', { metalness: 0.3, roughness: 0.5 }), 0, 1.54, 0, g);
  for (const y of [1.36, 1.4]) cyl(g, 0.026, 0.026, 0.02, '#b5562a', 0, y, 0, 6);
  bake(g);
  g.rotation.x = 1.32;
  return g;
}
export function suitcase() {
  const g = new THREE.Group();
  box(g, 0.15, 0.36, 0.52, '#7a4526', 0, -0.25, 0);
  box(g, 0.16, 0.04, 0.53, '#5a3018', 0, -0.2, 0);
  box(g, 0.04, 0.05, 0.16, '#3a2414', 0, -0.05, 0);
  return bake(g);
}
export function burst(W, pos, color = '#ffb060', ms = 900) {
  const p = particles({ count: 40, mode: 1, spread: [0.6, 1.4, 0.6], color, size: 0.05, rate: 1.4, intensity: 3 });
  p.position.copy(pos);
  W.group.add(p);
  setTimeout(() => p.removeFromParent(), ms);
}

// Levar objetos de um ponto a outro, várias vezes.
export async function carryTask(G, { from, to, count, make, title, pick, put, onPut }) {
  for (let i = 0; i < count; i++) {
    G.objective(`${title} (${i}/${count})`, from);
    await G.interact(from, pick);
    G.carry(make());
    G.sfx('ui');
    G.objective(`${title} (${i}/${count})`, to);
    await G.interact(to, put, { radius: 3.2 });
    G.drop();
    G.sfx('build');
    if (onPut) await onPut(i);
  }
}

// Minijogo de ritmo (roda de caxambu): toque o tambor no tempo certo.
export function rhythmGame(G, { bpm = 100, onHit } = {}) {
  const A = G.audio, spb = 60 / bpm;
  const pattern = [0, 1, 2, 2.5, 3, 4, 5, 6, 6.5, 7, 8, 9, 10, 10.5, 11, 12, 12.5, 13, 14, 15];
  const t0 = A.now() + 4 * spb + 0.8;
  if (A.ctx) {
    for (let k = 0; k < 4; k++) A.drum('cand', t0 - (4 - k) * spb, 0.3, A.sfxBus);
    for (let b = 0; b < 16; b += 0.5) {
      A.burst(t0 + b * spb, 0.05, b % 1 ? 0.04 : 0.07, 'highpass', 6500, 1, A.sfxBus);
      if (b % 1) A.drum('cand', t0 + b * spb, 0.17, A.sfxBus);
    }
  }
  const notes = pattern.map((b) => ({ t: t0 + b * spb, res: null }));
  const cv = document.getElementById('rhythm'), dctx = cv.getContext('2d');
  const hint = G.xr.presenting ? 'Gatilho para tocar' : G.input.isTouch ? 'Toque no botão ● para tocar' : 'E · Espaço · clique para tocar';
  let fb = null, hits = 0, done = false, pulse = 0;
  const draw = (c, Wd, Hd, clear = true) => {
    const now = A.now(), cx = Wd / 2, cy = Hd * 0.54, R = Math.min(Wd, Hd) * 0.2;
    if (clear) c.clearRect(0, 0, Wd, Hd);
    c.save();
    c.fillStyle = 'rgba(14,10,8,0.66)'; c.beginPath(); c.arc(cx, cy, R * 2.25, 0, 7); c.fill();
    const k = Math.max(0, 1 - (now - pulse) * 4);
    c.fillStyle = '#d8c09a'; c.beginPath(); c.arc(cx, cy, R * (0.8 + k * 0.06), 0, 7); c.fill();
    c.lineWidth = R * 0.14; c.strokeStyle = '#7a4526'; c.beginPath(); c.arc(cx, cy, R * 0.92, 0, 7); c.stroke();
    c.lineWidth = 4; c.strokeStyle = `rgba(255,217,138,${0.5 + k * 0.5})`; c.beginPath(); c.arc(cx, cy, R * 1.05, 0, 7); c.stroke();
    for (const n of notes) {
      if (n.res) continue;
      const dt = n.t - now;
      if (dt > 1.7 || dt < -0.3) continue;
      c.globalAlpha = Math.min(1, (1.7 - dt) * 1.5);
      c.lineWidth = 7; c.strokeStyle = Math.abs(dt) < 0.09 ? '#fff4cc' : '#ffcf70';
      c.beginPath(); c.arc(cx, cy, R * 1.05 + Math.max(dt, 0) * R * 1.4, 0, 7); c.stroke();
    }
    c.globalAlpha = 1; c.textAlign = 'center';
    c.fillStyle = '#f4ead8'; c.font = `800 ${Math.round(Hd * 0.05)}px Nunito, sans-serif`;
    c.fillText(now < t0 - 0.3 ? 'Prepare-se… escute o candongueiro' : 'Toque o tambu no ritmo!', cx, Hd * 0.1);
    c.font = `600 ${Math.round(Hd * 0.038)}px Nunito, sans-serif`; c.fillStyle = '#bfae94';
    c.fillText(`${hint}   ·   ${hits}/${notes.length}`, cx, Hd * 0.95);
    if (fb && now - fb.t < 0.6) { c.font = `900 ${Math.round(Hd * 0.065)}px Nunito, sans-serif`; c.fillStyle = '#ffe2a0'; c.fillText(fb.text, cx, cy - R * 1.45); }
    c.restore();
  };
  cv.classList.add('show');
  return new Promise((res) => {
    const finish = () => { if (done) return; done = true; cv.classList.remove('show'); G.ui.modal = null; G.ui.vr.hide(); res(hits); };
    G.ui.custom({
      hit() {
        const now = A.now();
        let best = null, bd = 1;
        for (const n of notes) if (!n.res) { const d = Math.abs(n.t - now); if (d < bd) { bd = d; best = n; } }
        A.sfx('drumLow');
        pulse = now;
        onHit?.();
        if (best && bd < 0.26) { best.res = bd < 0.09 ? 'Perfeito!' : bd < 0.17 ? 'Bom!' : 'Quase!'; hits++; fb = { text: best.res, t: now }; }
      },
      update() {
        const now = A.now();
        for (const n of notes) if (!n.res && now - n.t > 0.3) n.res = 'miss';
        draw(dctx, cv.width, cv.height);
        if (G.xr.presenting) G.ui.vr.show({ custom: (c, w, h) => draw(c, w, h, false) });
        if (now > notes[notes.length - 1].t + 1.2) finish();
      },
    });
    if (G.auto) finish();
  });
}
