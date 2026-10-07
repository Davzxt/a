// Epílogo — Vargem Alta hoje: a praça, as memórias e a emancipação de 1988–1989.
import * as THREE from 'three';
import { pal, M } from '../core/engine.js';
import { particles } from '../core/fx.js';
import { buildNature, coffeeRows } from '../world/nature.js';
import { riverZ, alongRiver } from '../world/terrain.js';
import { place, station, townHouse, church, marco, bench, streetLamp, plaza, Path } from '../world/props.js';
import { Character } from '../world/character.js';
import { LOOKS } from './data.js';
import { B, spear } from './kit.js';

const DUSK = pal({ top: '#16204a', mid: '#ec8a5c', bottom: '#2a2030', sunCol: '#ff9a62', sun: [255, 2.5], sunI: 1.1, hemi: ['#5a6a9a', '#2a2020', 0.9], fog: '#6a5070', near: 40, far: 420, fogH: [0.25, 0, 0.08], clouds: 0.4, stars: 0.55, exposure: 1.3, bloom: 0.85, cloudLit: '#ffb48a', cloudShade: '#4a3a5a', glow: 1.3, water: ['#1a2238', '#5a4a60'], rimK: 0.28 });
const PZ = B(-4, -1, 31), STREET = alongRiver(-72, 72, -1, 27, 6);
const slope = (x) => riverZ(x + 0.5) - riverZ(x - 0.5);
const faceN = (x) => Math.atan2(-slope(x), 1);
const MEM = [['inacio', 'memInacio', '#f08a55', 'Inácio'], ['bento', 'memBento', '#f0b350', 'Bento'], ['pietro', 'memPietro', '#a8d070', 'Pietro'], ['youssef', 'memYoussef', '#7fcbe0', 'Youssef']];

export default {
  id: 'epilogo', tag: 'EPÍLOGO · VARGEM ALTA HOJE', palette: DUSK,
  cfg() {
    return {
      flats: [{ x: PZ.x, z: PZ.z, r: 17 }, { ...B(6, -1, 16), r: 10 }, { ...B(-66, -1, 33), r: 12 }],
      roads: [{ pts: STREET, w: 3.6, color: 'stone' }],
      fields: [{ ...B(12, -1, 66), r: 24, k: 0.35 }],
      bounds: { x: PZ.x, z: PZ.z, r: 30 },
      forest: (x, z) => (z > riverZ(x) + 20 ? 0.9 : z > riverZ(x) - 80 && Math.abs(x) < 110 ? 0.03 : 0.8),
      colors: { grassA: '#55803a', grassB: '#8a9a48', forest: '#2f4a28', dirt: '#8a7a6a' },
    };
  },
  build(G, W) {
    buildNature(W, { trees: 0.9, grass: 0.7, coffee: coffeeRows(12, riverZ(12) - 66, 6, 14, 0.05) });
    const p = W.at(PZ.x, PZ.z);
    place(W, plaza(14), p.x, p.z);
    W.marco = place(W, marco(['VARGEM ALTA', 'Lei nº 4.063 · 6/5/1988']), p.x, p.z, Math.PI);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      place(W, streetLamp(), p.x + Math.cos(a) * 12.5, p.z + Math.sin(a) * 12.5, -a + Math.PI);
      place(W, bench(), p.x + Math.cos(a + 0.45) * 9.5, p.z + Math.sin(a + 0.45) * 9.5, -a - 0.45 - Math.PI / 2);
    }
    const sq = new Path(alongRiver(-30, 40, -1, 16, 6)), sAt = sq.nearest(6, riverZ(6) - 16), q = sq.at(sAt);
    place(W, station({ name: 'ESTAÇÃO · CENTRO CULTURAL', lit: true }), q.x, q.z, q.ang);
    const cols = ['#e7c26a', '#8fb3c4', '#e6a38a', '#b6c98a', '#f1e6d0', '#d9a0b0', '#a8c8b0'];
    [-52, -40, -28, 20, 34, 48].forEach((x, i) => { const b = B(x, -1, 36); place(W, townHouse({ w: 7, color: cols[i % cols.length], lit: true }), b.x, b.z, faceN(x)); });
    [-40, 34].forEach((x, i) => { const b = B(x, -1, 20.5); place(W, townHouse({ w: 6.5, color: cols[(i + 4) % cols.length], lit: true }), b.x, b.z, faceN(x) + Math.PI); });
    const c = B(-66, -1, 33);
    place(W, church({ lit: true }), c.x, c.z, Math.PI / 2);
    // as quatro memórias, feitas de luz
    MEM.forEach(([look, key, color], i) => {
      const a = Math.PI * 1.15 + (i / 3) * Math.PI * 0.7;
      const ch = new Character(LOOKS[look]);
      if (ch.bound) ch.free();
      if (look === 'inacio') ch.holdInHand(spear(), false);
      ch.ghost(color);
      const n = (W.cast[key] = G.npc(ch, p.x + Math.cos(a) * 5.4, p.z + Math.sin(a) * 5.4, Math.atan2(-Math.cos(a), -Math.sin(a))));
      n.solid = false;
      const motes = particles({ count: 26, mode: 0, spread: [1.6, 2.4, 1.6], color, size: 0.07, intensity: 2.4 });
      motes.position.copy(n.pos).add(new THREE.Vector3(0, 1.2, 0));
      W.group.add(motes);
    });
    const ff = particles({ count: 140, mode: 0, spread: [70, 6, 70], color: '#ffe08a', size: 0.07, intensity: 2.4 });
    ff.position.copy(p).add(new THREE.Vector3(0, 2.5, 0));
    W.group.add(ff);
    G.setProtagonist('visitante', 'voce');
  },

  async run(G, W) {
    const p = W.at(PZ.x, PZ.z), k = W.cast;
    G.music('epilogo');
    const s = B(-4, -1, 47);
    G.player.place(s.x, s.z, 0.05);
    await G.fade(0, 1.6);
    G.cinema(true);
    await Promise.all([
      G.chapterTitle({ kicker: 'Epílogo', title: 'Vargem Alta', sub: '1988 · 1989 · hoje', color: '#e3b964' }),
      (async () => { G.player.snapCam(); await G.shot(p.clone().add(new THREE.Vector3(18, 16, 22)), G.player.camPos.clone(), p.clone().add(new THREE.Vector3(0, 1.5, 0)), G.player.camLook.clone(), 7); })(),
    ]);
    G.cinema(false);
    G.unlock();
    await G.say([['eu', 'Dizem que esta praça guarda histórias. Talvez seja só olhar com atenção.']]);
    const lines = {
      memInacio: [['memInacio', 'Antes dos mapas, havia caminhos. Nós, os Puri, abrimos os primeiros — e seguimos aqui, na memória e nas pessoas.']],
      memBento: [['memBento', 'A liberdade foi feita de passos no escuro e de tambor aceso. Pedra Branca continua tocando.']],
      memPietro: [['memPietro', 'Viemos de longe para plantar. A terra nos ensinou que ninguém planta sozinho.']],
      memYoussef: [['memYoussef', 'Uma porta aberta faz de estranhos, vizinhos. Foi assim que o comércio virou amizade.']],
    };
    await G.collect(MEM.map(([, key, , name]) => ({ target: k[key], label: `Ouvir a memória de ${name}`, onUse: () => G.say(lines[key]) })), 'Ouça as memórias da praça');
    G.objective('Leia a placa do marco', W.marco);
    await G.interact(W.marco, 'Ler a placa', { radius: 2.8, height: 3 });
    await G.card('va_municipio');
    await G.say([['narrador', 'Vargem Alta foi criada em 1988. Mas foi formada muito antes — por muitos caminhos, muitas mãos e muitas memórias.']]);
    G.objective(null);
    G.lock();
    await G.chapterTitle({ kicker: 'Fim', title: 'Caminhos da Memória', sub: 'Obrigado por caminhar com estas histórias.', color: '#e3b964', dur: 6 });
  },
};
