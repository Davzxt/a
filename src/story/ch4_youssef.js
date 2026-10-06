// Capítulo IV — Youssef, imigração libanesa: "O Armazém da Estação" (1927)
import * as THREE from 'three';
import { pal, M } from '../core/engine.js';
import { makeFlyers, particles } from '../core/fx.js';
import { buildNature, coffeeRows } from '../world/nature.js';
import { riverZ, alongRiver } from '../world/terrain.js';
import { place, station, railway, makeTrain, Path, townHouse, store, church, cart, mule, bench, barrel, crate, mk } from '../world/props.js';
import { B, suitcase } from './kit.js';

const GOLD = pal({ top: '#4a7fc0', mid: '#f7d6a6', bottom: '#8a6a4a', sunCol: '#ffc98a', sun: [255, 15], sunI: 3.3, hemi: ['#a9c3e6', '#6b5236', 1.3], fog: '#f0cfa0', near: 60, far: 600, fogH: [0.2, 0, 0.06], clouds: 0.45, exposure: 1.02, bloom: 0.5, cloudLit: '#ffe6c0', cloudShade: '#b08a8a', sat: 1.04, sepia: 0.16 });
const RAIL = alongRiver(-220, 220, -1, 16, 6);
const STREET = alongRiver(-72, 72, -1, 27, 6);
const slope = (x) => (riverZ(x + 0.5) - riverZ(x - 0.5));
const faceN = (x) => Math.atan2(-slope(x), 1);
const STORE = B(20, -1, 35.5);

export default {
  id: 'youssef', tag: 'CAPÍTULO IV · YOUSSEF · IMIGRAÇÃO LIBANESA', palette: GOLD,
  cfg() {
    return {
      flats: [{ ...B(6, -1, 16), r: 10 }, { ...B(-66, -1, 33), r: 12 }],
      roads: [{ pts: RAIL, w: 2.2, smooth: 4, minY: 0.2, color: 'stone' }, { pts: STREET, w: 3.4, smooth: 3 }, { pts: [[6, riverZ(6) - 19], [6, riverZ(6) - 27]], w: 2.4 }],
      fields: [{ ...B(10, -1, 66), r: 26, k: 0.45 }, { ...B(-40, -1, 62), r: 20, k: 0.45 }],
      bounds: { x: 0, z: riverZ(0) - 30, r: 66 },
      forest: (x, z) => (z > riverZ(x) + 20 ? 0.9 : z > riverZ(x) - 80 && Math.abs(x) < 110 ? 0.02 : 0.75),
      colors: { grassA: '#6f9440', grassB: '#b0b052', forest: '#3a5a2c', soil: '#8c4a2c', dirt: '#a57650' },
    };
  },
  build(G, W) {
    buildNature(W, { trees: 0.85, grass: 0.8, bushes: 0.6, coffee: [...coffeeRows(10, riverZ(10) - 66, 6, 14, 0.05), ...coffeeRows(-40, riverZ(-40) - 62, 5, 10, -0.1)], bananas: [B(-20, -1, 42), B(30, -1, 43), B(-46, -1, 41)] });
    const path = (W.rail = new Path(RAIL));
    railway(W, RAIL);
    const sAt = path.nearest(6, riverZ(6) - 16), q = path.at(sAt);
    W.station = place(W, station({ name: 'VARGEM ALTA' }), q.x, q.z, q.ang);
    W.train = makeTrain(W, path, ['passenger', 'box']);
    W.train.set(sAt + 6.9);
    W.stationQ = q;
    // casario
    const cols = ['#e7c26a', '#8fb3c4', '#e6a38a', '#b6c98a', '#f1e6d0', '#d9a0b0', '#a8c8b0'];
    [-52, -40, -28, -14, 4, 34, 48].forEach((x, i) => {
      const p = B(x, -1, 35.5);
      place(W, townHouse({ w: 7 + (i % 2), color: cols[i % cols.length], shutter: i % 2 ? '#3d6b8f' : '#4f7a4a' }), p.x, p.z, faceN(x));
    });
    [-40, 34].forEach((x, i) => { const p = B(x, -1, 20.5); place(W, townHouse({ w: 6.5, color: cols[(i + 3) % cols.length] }), p.x, p.z, faceN(x) + Math.PI); });
    W.store = place(W, store(), STORE.x, STORE.z, faceN(20));
    const c = B(-66, -1, 33);
    place(W, church(), c.x, c.z, Math.PI / 2);
    place(W, bench(), W.station.position.x + 4.5, W.station.position.z - 3.2, q.ang);
    const ca = Math.cos(q.ang), sa = Math.sin(q.ang);
    [[-9, -3.2], [-9.8, -2.6], [-9.2, -4.2]].forEach(([lx, lz], i) => place(W, i ? crate() : barrel(), q.x + ca * lx + sa * lz, q.z - sa * lx + ca * lz, 0));
    // pessoas da vila
    const at = (x, d) => B(x, -1, d);
    const sm = at(9, 18.6);
    W.cast.chefe = G.npc('chefe', sm.x, sm.z, Math.PI);
    const gi = at(-14, 31.2); W.cast.giulia = G.npc('giulia', gi.x, gi.z, 0);
    const pv = at(-38, 27.5); W.cast.pietroVelho = G.npc('pietroVelho', pv.x, pv.z, Math.PI / 2);
    place(W, cart('sacks'), pv.x - 3.4, pv.z - 0.4, 0);
    const bv = at(47, 26.5); W.cast.bentoVelho = G.npc('bentoVelho', bv.x, bv.z, -Math.PI / 2);
    place(W, mule(false), bv.x + 2.4, bv.z + 0.6, -Math.PI / 2);
    const ma = at(27, 29.5); W.cast.mariana = G.npc('mariana', ma.x, ma.z, -0.6);
    const extras = [['morador1', -22, 26, 1.4], ['moradora1', 12, 29, -1.2], ['morador2', 1.5, 19, Math.PI], ['moradora2', -6, 31, 0.6], ['crianca2', 8, 27.4, 2]];
    W.extras = extras.map(([l, x, d, y]) => { const p = at(x, d); return G.npc(l, p.x, p.z, y); });
    W.extras[4].anim = 'dance';
    const walker = W.extras[0];
    (async () => { for (;;) { await walker.goTo(...Object.values(at(-50, 27)), 1.2); await walker.goTo(...Object.values(at(40, 27)), 1.2); } })();
    const dust = particles({ count: 160, mode: 2, spread: [90, 10, 50], color: '#fff0c8', size: 0.06, opacity: 0.8, intensity: 1.5 });
    dust.position.set(0, 3, riverZ(0) - 28);
    W.group.add(dust);
    const birds = makeFlyers({ count: 12, center: W.at(0, -30), radius: 60, height: 40 });
    W.group.add(birds); W.anim(birds);
    const bag = suitcase();
    mk(new THREE.ConeGeometry(0.05, 0.13, 6), M('#2f7a3a'), 0.085, -0.24, 0, bag).rotation.z = -Math.PI / 2;
    G.setProtagonist('youssef', 'youssef').holdInHand(bag, true);
  },

  async run(G, W) {
    const k = W.cast, q = W.stationQ;
    G.music('youssef');
    const st = W.at(q.x - 3.5, q.z - 3.2);
    G.player.place(st.x, st.z, 0.1);
    await G.fade(0, 1.5);
    G.cinema(true);
    await Promise.all([
      G.chapterTitle({ kicker: 'Capítulo IV · Imigração libanesa', title: 'O Armazém da Estação', sub: 'Vila de Vargem Alta · 1927', color: '#5fb3c9' }),
      (async () => { G.player.snapCam(); await G.shot(st.clone().add(new THREE.Vector3(30, 18, -26)), G.player.camPos.clone(), st.clone().add(new THREE.Vector3(0, 2, -12)), G.player.camLook.clone(), 7); })(),
    ]);
    G.cinema(false);
    G.unlock();
    await G.say([['eu', 'Saí das montanhas do Líbano com uma mala de tecidos e um caderno de contas. Andei de fazenda em fazenda como mascate. Agora, quero um lugar para ficar.']]);
    G.objective('Fale com o chefe da estação', k.chefe);
    await G.interact(k.chefe, 'Conversar com o chefe da estação');
    await G.say([
      ['chefe', 'Seu Youssef! Chegou com as encomendas de Cachoeiro?'],
      ['youssef', 'Tecido, linha, botão, querosene… e coragem para abrir as portas do armazém.'],
      ['chefe', 'Então entregue as encomendas primeiro. Freguês bem servido é freguês que volta!'],
    ]);
    G.sfx('whistle');
    let ch = 0;
    W.updates.push((t, dt) => { const T = W.train; if (T.speed < 8) T.speed += dt * 0.7; if (t > ch) { ch = t + Math.max(0.2, 1.2 - T.speed * 0.13); G.sfx('chuff'); } });
    await G.collect([
      { target: k.giulia, label: 'Entregar a chita a Dona Giulia', onUse: () => G.say([
        ['giulia', 'A chita florida! Que cores lindas, seu Youssef. Vou costurar os vestidos da festa.'],
        ['youssef', 'Para a senhora, eu vendo fiado — mas só até a colheita!'],
        ['giulia', 'Ah, os libaneses e as contas no caderno… Grazie, seu Youssef!'],
      ]) },
      { target: k.pietroVelho, label: 'Entregar o lampião a Seu Pietro', onUse: () => G.say([
        ['pietroVelho', 'O lampião e o querosene! Chegaram em boa hora: a colheita não espera o sol.'],
        ['pietroVelho', 'Meu pai dizia: quem vem de longe entende quem vem de longe.'],
        ['youssef', 'Seu pai era um homem sábio, seu Pietro.'],
      ]) },
      { target: k.bentoVelho, label: 'Entregar o tecido a Seu Bento', onUse: () => G.say([
        ['bentoVelho', 'O tecido branco para as roupas da festa. Lá na Pedra Branca a festa é de todos — venha ouvir o tambor, seu Youssef.'],
        ['youssef', 'Irei, seu Bento. Na minha terra também se dança em roda: chamamos de dabke.'],
        ['bentoVelho', 'Então na roda tem lugar para mais um.'],
      ]) },
    ], 'Entregue as encomendas da vila');
    G.objective('Dona Mariana quer falar com você', k.mariana);
    await G.interact(k.mariana, 'Conversar com Dona Mariana');
    await G.say([
      ['mariana', 'Seu Youssef, trouxe ervas para o seu armazém: guaco, erva-cidreira, folha de goiabeira.'],
      ['mariana', 'Minha avó era Puri. Ela me ensinou o nome de cada planta desta mata.'],
      ['youssef', 'Então elas terão lugar de honra na prateleira, com o nome dela.'],
      ['mariana', 'Ponha, sim. Memória é coisa que se passa adiante.'],
    ]);
    G.objective('Abra as portas do armazém', W.store);
    await G.interact(W.store, 'Abrir o armazém', { radius: 4.5, height: 4.6 });
    W.store.userData.setOpen(true);
    G.sfx('door');
    G.sfx('bell');
    const s = W.store.position, fx = Math.sin(W.store.rotation.y), fz = Math.cos(W.store.rotation.y);
    const crowd = [k.giulia, k.pietroVelho, k.bentoVelho, k.mariana, ...W.extras.slice(1)];
    crowd.forEach((n, i) => { const a = -1.2 + (i / (crowd.length - 1)) * 2.4, r = 6 + (i % 2) * 1.2; n.stop(); n.anim = 'idle'; n.goTo(s.x + fx * r * Math.cos(a) + fz * r * Math.sin(a) * 0.9, s.z + fz * r * Math.cos(a) - fx * r * Math.sin(a) * 0.9, 1.8).then(() => { n.faceTo = s; n.anim = i % 3 ? 'clap' : 'idle'; }); });
    G.lock();
    G.player.place(s.x + fx * 4.4, s.z + fz * 4.4, Math.atan2(fx, fz));
    await G.wait(3);
    await G.say([
      ['youssef', 'Ahlan wa sahlan — sejam bem-vindos! Hoje o café é por conta da casa.'],
      ['giulia', 'E quibe? Disseram que o senhor faz quibe!'],
      ['youssef', 'Minha mãe dizia: uma casa só é casa quando a porta está aberta.'],
    ]);
    await G.card('lb_comercio');
    await G.chapterTitle({ kicker: 'Capítulo IV concluído', title: 'Memória registrada', sub: 'Na vila da estação, o comércio virou vizinhança.', color: '#5fb3c9', dur: 4.5 });
  },
};
