// Capítulo III — Pietro, imigração italiana: "Terra, Café e Trilhos" (final do século XIX)
import * as THREE from 'three';
import { pal } from '../core/engine.js';
import { makeFlyers } from '../core/fx.js';
import { buildNature, plants, coffeeRows } from '../world/nature.js';
import { riverZ, alongRiver } from '../world/terrain.js';
import { place, casaGrande, italianHouse, chapel, cart, mule, planks, sack, station, railway, makeTrain, Path, chest, fence, put } from '../world/props.js';
import { B, carryTask, suitcase } from './kit.js';

const MORNING = pal({ top: '#3f86d8', mid: '#d6eaf5', bottom: '#7a7a6a', sunCol: '#fff3dc', sun: [140, 40], sunI: 3.3, hemi: ['#b5d3f0', '#7a6a4a', 1.2], fog: '#cfe3ee', near: 70, far: 640, fogH: [0.18, 0, 0.06], clouds: 0.6, exposure: 1.0, bloom: 0.4 });
const AFTERNOON = pal({ top: '#4a7ec0', mid: '#f6d2a2', bottom: '#8a6a4a', sunCol: '#ffcf90', sun: [250, 17], sunI: 3.2, hemi: ['#a9c3e6', '#6b5236', 1.25], fog: '#efcfa2', near: 60, far: 620, fogH: [0.22, 0, 0.06], clouds: 0.5, exposure: 1.02, bloom: 0.5, cloudLit: '#ffe2b8', cloudShade: '#b08a8a', sat: 1.12 });

const START = B(82, -1, 30), CG = B(34, -1, 47), HOUSE = B(2, -1, 50), CART = B(15, -1, 39), SACKS = B(9.5, -1, 45.5), CHAPEL = B(-22, -1, 50);
const SPOTS = [B(13, -1, 53), B(16, -1, 55), B(19, -1, 57), B(22, -1, 59)];
const ROAD = [[98, -1, 27], [82, -1, 30], [64, -1, 33], [46, -1, 35], [28, -1, 36], [14, -1, 37], [-2, -1, 38], [-20, -1, 40]].map(([x, s, d]) => [x, riverZ(x) + s * d]);
const RAIL = alongRiver(-220, 220, -1, 16, 6);

export default {
  id: 'pietro', tag: 'CAPÍTULO III · PIETRO · IMIGRAÇÃO ITALIANA', palette: MORNING,
  cfg() {
    return {
      flats: [{ x: HOUSE.x, z: HOUSE.z, r: 12 }, { x: CG.x, z: CG.z, r: 13 }, { x: CHAPEL.x, z: CHAPEL.z, r: 9 }, { ...B(6, -1, 16), r: 9 }],
      roads: [{ pts: ROAD, w: 2.4 }, { pts: RAIL, w: 2.2, smooth: 4, minY: 0.2 }],
      fields: [{ ...B(18, -1, 60), r: 18, k: 0.6 }, { ...B(-14, -1, 58), r: 14, k: 0.5 }],
      bounds: { x: 30, z: riverZ(30) - 36, r: 72 },
      forest: (x, z) => (z > riverZ(x) ? 1 : x > -40 && x < 110 && z > riverZ(x) - 70 ? 0.16 : 0.9),
      colors: { grassA: '#5f8f3a', grassB: '#a3ad4c', forest: '#36502a', soil: '#8c4a2c' },
    };
  },
  build(G, W) {
    buildNature(W, { trees: 1, grass: 1, bushes: 1.4, bananas: [B(-6, -1, 52), B(9, -1, 50), B(-8, -1, 41)].map((p) => ({ ...p })) });
    place(W, casaGrande({ ruined: true }), CG.x, CG.z, -0.25);
    W.house = place(W, italianHouse(), HOUSE.x, HOUSE.z, 0);
    const hp = W.house.position, pc = W.house.userData.porch;
    W.houseSpot = W.at(hp.x + pc[0], hp.z + pc[1]);
    // etapas da obra: as paredes passam a bloquear a passagem só depois de erguidas
    W.setHouse = (n) => {
      W.house.userData.setStage(n);
      if (n >= 1 && !W.walls) { W.walls = true; const b = W.house.userData.wallBox; W.addBox(hp.x + b[0], hp.z + b[1], b[2], b[3], 0); }
    };
    W.setHouse(0);
    W.cartObj = place(W, cart('planks'), CART.x, CART.z, 0.3);
    const sm = place(W, mule(true), START.x - 3, START.z + 2.2, -Math.PI / 2);
    W.muleObj = sm;
    fence(W, [[HOUSE.x - 9, HOUSE.z - 9], [HOUSE.x - 9, HOUSE.z + 6]]);
    // depois do salto no tempo
    const late = (W.late = new THREE.Group());
    late.visible = false;
    W.group.add(late);
    plants(W, 'coffee', [...coffeeRows(18, riverZ(18) - 61, 7, 12, 0.12), ...coffeeRows(-14, riverZ(-14) - 58, 5, 9, -0.1)], late);
    late.add(place(W, chapel(), CHAPEL.x, CHAPEL.z, 0.25));
    const path = (W.rail = new Path(RAIL));
    railway(W, RAIL, late);
    const sAt = path.nearest(6, riverZ(6) - 16), q = path.at(sAt);
    late.add(place(W, station({ name: 'VARGEM ALTA' }), q.x, q.z, q.ang));
    W.stationS = sAt;
    W.train = makeTrain(W, path, ['open', 'box'], late);
    W.train.set(sAt + 6.9);
    const sk = (W.sackPile = new THREE.Group());
    for (let i = 0; i < 5; i++) put(sack(), (i % 3) * 0.7 - 0.7, 0, Math.floor(i / 3) * 0.7, sk);
    sk.position.copy(W.at(SACKS.x, SACKS.z));
    late.add(sk);
    // família
    W.cast.giuseppe = G.npc('giuseppe', START.x - 2.2, START.z + 0.6, -Math.PI / 2);
    W.cast.lucia = G.npc('lucia', START.x + 1.2, START.z + 1.6, -Math.PI / 2);
    W.cast.nina = G.npc('nina', START.x + 0.6, START.z - 1.2, -Math.PI / 2);
    const birds = makeFlyers({ count: 16, center: W.at(20, -20), radius: 80, height: 45 });
    W.group.add(birds); W.anim(birds);
    G.setProtagonist('pietro', 'pietro').holdInHand(suitcase(), true);
  },

  async run(G, W) {
    const k = W.cast, h = W.house.position;
    G.music('pietro');
    G.player.place(START.x, START.z, -Math.PI / 2);
    await G.fade(0, 1.5);
    G.cinema(true);
    await Promise.all([
      G.chapterTitle({ kicker: 'Capítulo III · Imigração italiana', title: 'Terra, Café e Trilhos', sub: 'Vargem Alta · final do século XIX', color: '#8fbf5a' }),
      (async () => { G.player.snapCam(); await G.shot(h.clone().add(new THREE.Vector3(-20, 30, 40)), G.player.camPos.clone(), h.clone(), G.player.camLook.clone(), 7.5); })(),
    ]);
    G.cinema(false);
    G.unlock();
    await G.say([['eu', 'Mamma diz que atravessamos o oceano com uma mala e uma esperança. A mala chegou amassada. A esperança, inteira.']]);
    G.objective('Fale com seu pai', k.giuseppe);
    await G.interact(k.giuseppe, 'Conversar com Papà');
    await G.say([
      ['giuseppe', 'Eccoci, Pietro. Chegamos. Dizem que estas terras já foram uma fazenda de café.'],
      ['pietro', 'A mata tomou conta de tudo, papà. Até a casa grande virou ruína.'],
      ['giuseppe', 'Então começamos de novo. A terra é íngreme, mas é boa. Primeiro o café; depois, a casa.'],
      ['nina', 'E uma capela! A mamma prometeu uma capela!'],
      ['lucia', 'Prometi, sim. Mas antes: mãos à obra.'],
    ]);
    k.giuseppe.follow(G.player, 2.6, 1.1); k.lucia.follow(G.player, 3.6, -0.9); k.nina.follow(G.player, 2.2, -1.4);
    G.objective('Siga a estrada até o terreno da família', h);
    await G.reach(h, 13);
    await G.say([['giuseppe', 'É aqui. O chão é vermelho e firme. Vamos plantar as mudas na encosta.']]);
    const sc = G.player.char.releaseHand(true);
    if (sc) { sc.rotation.set(0, 0.4, 0); sc.position.copy(G.player.pos).add(new THREE.Vector3(0.6, 0.25, 0.4)); W.group.add(sc); }
    k.giuseppe.stop(); k.lucia.stop(); k.nina.stop();
    k.giuseppe.goTo(h.x - 3, h.z + 6).then(() => { k.giuseppe.anim = 'work'; });
    k.lucia.goTo(SPOTS[0].x - 3, SPOTS[0].z + 1.5).then(() => { k.lucia.anim = 'work'; });
    k.nina.goTo(h.x + 4, h.z + 6).then(() => { k.nina.anim = 'dance'; });
    let planted = 0;
    const saplings = new THREE.Group();
    W.group.add(saplings);
    const plant = (p) => async () => {
      G.player.char.anim = 'kneel';
      await G.wait(0.9);
      G.sfx('plant');
      plants(W, 'sapling', [{ ...p, s: 1.2 }], saplings);
      G.player.char.anim = 'idle';
      planted++;
      if (planted === 2) await bentoVisit(G, W);
    };
    await G.collect(SPOTS.map((p) => ({ target: W.at(p.x, p.z), label: 'Plantar uma muda de café', onUse: plant(p), radius: 1.9 })), 'Plante as mudas de café');
    await G.say([['giuseppe', 'Bravo! Agora a casa. Traga as tábuas da carroça.']]);
    await carryTask(G, {
      from: W.cartObj, to: W.houseSpot, count: 3, make: () => planks(2), title: 'Ajude a erguer a casa: leve as tábuas',
      pick: 'Pegar tábuas', put: 'Colocar as tábuas na obra',
      onPut: (i) => W.setHouse(i + 1),
    });
    k.giuseppe.anim = 'idle';
    await G.say([['lucia', 'Uma casa! Pietro, agora sim estamos em casa.']]);
    // ---- anos depois ----
    G.objective(null);
    G.lock();
    await G.fade(1, 1.4);
    W.late.visible = true;
    saplings.visible = false;
    W.setHouse(3);
    G.engine.applyPalette(AFTERNOON);
    G.curPal = AFTERNOON;
    k.giuseppe.remove(); k.nina.remove();
    k.lucia.teleport(h.x + 2.4, h.z + 4.2, 0);
    k.lucia.anim = 'idle';
    W.cast.giuseppe = G.npc('giuseppeVelho', h.x - 1.5, h.z + 4.4, 0.4);
    const sp = W.sackPile.position;
    G.player.place(sp.x + 2.5, sp.z + 3.5, Math.PI * 0.9);
    await G.wait(0.4);
    await G.fade(0, 1.4);
    await G.chapterTitle({ kicker: 'Alguns anos depois…', title: 'Os trilhos chegam ao vale', sub: 'O café da família agora segue de trem.', color: '#8fbf5a', dur: 4 });
    G.unlock();
    G.objective('Fale com seu pai, na varanda', W.cast.giuseppe);
    await G.interact(W.cast.giuseppe, 'Conversar com Papà');
    await G.say([
      ['giuseppe', 'Pietro! O trem da Leopoldina está esperando. Agora o nosso café vai longe: Cachoeiro, o porto… o mundo.'],
      ['pietro', 'E pensar que chegamos aqui a pé, com uma mula e uma mala.'],
    ]);
    const wagon = W.train.cars[1];
    await carryTask(G, {
      from: W.sackPile, to: wagon, count: 3, make: () => sack(), title: 'Leve as sacas de café até o vagão',
      pick: 'Pegar uma saca de café', put: 'Colocar no vagão',
      onPut: (i) => { put(sack(), -1.6 + i * 1.3, 1.1, 0, wagon); W.sackPile.children[W.sackPile.children.length - 1]?.removeFromParent(); },
    });
    G.objective(null);
    G.sfx('whistle');
    await G.wait(1.2);
    W.updates.push((t, dt) => { const T = W.train; if (T.speed < 7) T.speed += dt * 0.8; });
    let ch = 0;
    W.updates.push((t) => { if (t > ch && W.train.speed > 0.2) { ch = t + Math.max(0.18, 1.2 - W.train.speed * 0.14); G.sfx('chuff'); } });
    await G.wait(2.5);
    await G.say([
      ['pietro', 'Viemos de longe para plantar. E a terra ensinou que ninguém planta sozinho.'],
      ['lucia', 'Nem planta, nem colhe, nem constrói. Vá, filho: a vila está crescendo ao redor da estação.'],
    ]);
    await G.card('it_chegada');
    await G.card('it_ferrovia');
    G.lock();
    await G.chapterTitle({ kicker: 'Capítulo III concluído', title: 'Memória registrada', sub: 'Do pé de café ao trilho do trem, a vila começava a nascer.', color: '#8fbf5a', dur: 4.5 });
  },
};

async function bentoVisit(G, W) {
  const p = G.player.pos;
  const b = (W.cast.bentoAdulto = G.npc('bentoAdulto', p.x - 14, p.z + 4, Math.PI / 2));
  G.lock();
  await b.goTo(p.x - 2.2, p.z + 0.6, 1.8);
  b.faceTo = p;
  await G.say([
    ['bentoAdulto', 'Bom dia, vizinhos! Vi a fumaça e vim conhecer quem chegou.'],
    ['pietro', 'Bom dia! O senhor mora perto?'],
    ['bentoAdulto', 'Na comunidade de São Pedro, depois do rio. Trabalhei nestas terras antes de ser livre. Hoje planto o que é meu.'],
    ['bentoAdulto', 'Café novo gosta de sombra no começo e de cuidado sempre. E não planta muito junto, que ele briga pela água.'],
    ['pietro', 'Grazie… obrigado. Ainda misturo as duas línguas.'],
    ['bentoAdulto', 'Aqui todo mundo mistura alguma coisa. É assim que se vira vizinho.'],
  ]);
  G.unlock();
  b.faceTo = null;
  b.goTo(p.x - 40, p.z + 10, 1.6).then(() => b.remove());
}
