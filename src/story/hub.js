// Cena da tela-título: um mirante sobre o vale ao entardecer, com os quatro protagonistas.
import * as THREE from 'three';
import { smooth } from '../core/noise.js';
import { pal } from '../core/engine.js';
import { buildNature, plants } from '../world/nature.js';
import { place, marco } from '../world/props.js';
import { particles, makeFlyers } from '../core/fx.js';
import { B, spear, suitcase } from './kit.js';

const H = B(-30, 1, 80);
// mirante: um morro de topo plano, com os personagens perto da borda que dá para o vale
const HC = { x: H.x + 9, z: H.z - 0.5 };

export default {
  id: 'hub',
  palette: pal({
    top: '#3a6db0', mid: '#f5c38c', bottom: '#8a6a4a', sunCol: '#ffcf8f', sun: [222, 9], sunI: 3.0, glow: 0.75,
    hemi: ['#a9c3e6', '#6b5236', 1.3], fog: '#e8b98a', near: 60, far: 700, fogH: [0.28, 2, 0.06],
    clouds: 0.55, exposure: 1.0, bloom: 0.45, cloudLit: '#ffe2b8', cloudShade: '#b08a8a', sat: 1.12,
  }),
  cfg() {
    return {
      height: (x, z, h) => h + 15 * smooth(78, 15, Math.hypot(x - HC.x, (z - HC.z) * 0.9)),
      flats: [{ x: H.x, z: H.z, r: 18 }], clear: [{ x: H.x, z: H.z, r: 24 }, { x: H.x - 40, z: H.z - 12, r: 30 }, { x: H.x - 80, z: H.z - 20, r: 30 }], bounds: { x: H.x, z: H.z, r: 40 }, forest: () => 0.75, colors: { grassA: '#6f9a3c', grassB: '#a8b44e' } };
  },
  build(G, W) {
    buildNature(W, { trees: 0.9, ipes: 0.06, flowers: 1.5, grass: 0.6, rocks: 0.3, grassAt: (x, z) => Math.min(1, Math.hypot(x - H.x, z - H.z) / 14) });
    const yaw = 1.62;
    const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), r = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const C = W.at(H.x, H.z);
    G.hubCenter = C; G.hubYaw = yaw; G.hubSpot = C.clone().addScaledVector(f, 3.2);
    // ordem da imagem de referência: libanês, Bento, italiano, indígena
    const ids = [['youssef', 1.95], ['bento', 0.65], ['pietro', -0.65], ['inacio', -1.95]];
    G.hubChars = {};
    for (const [id, k] of ids) {
      const p = C.clone().addScaledVector(r, k * 1.05);
      const n = G.npc(id, p.x, p.z, yaw + k * -0.06);
      if (n.char.bound) n.char.free();
      if (id === 'inacio') n.char.holdInHand(spear(), false);
      if (id === 'pietro') n.char.holdInHand(suitcase(), true);
      n.solid = false;
      G.hubChars[id] = n;
    }
    const fill = new THREE.DirectionalLight('#ffe6c8', 1.1);
    fill.position.copy(C).addScaledVector(f, 10).add(new THREE.Vector3(0, 4, 0));
    fill.target.position.copy(C);
    W.group.add(fill, fill.target);
    const m = C.clone().addScaledVector(f, -1.2).addScaledVector(r, 4);
    place(W, marco(['VARGEM ALTA', 'Espírito Santo']), m.x, m.z, yaw - 0.5);
    const t = C.clone().addScaledVector(f, -3).addScaledVector(r, -7.5);
    plants(W, 'ipe', [{ x: t.x, z: t.z, s: 1.35 }]);
    const petals = particles({ count: 90, mode: 2, spread: [10, 6, 10], color: '#ffd23a', size: 0.09, opacity: 0.9, additive: false });
    petals.position.set(t.x, W.groundAt(t.x, t.z) + 5, t.z);
    W.group.add(petals);
    const fl = makeFlyers({ count: 14, center: W.at(H.x, H.z - 70), radius: 70, height: 40 });
    W.group.add(fl); W.anim(fl);
  },
  async run() {},
};
