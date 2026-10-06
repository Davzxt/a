// Capítulo I — Inácio, Povo Puri: "Os Primeiros Caminhos" (c. 1855)
import * as THREE from 'three';
import { pal } from '../core/engine.js';
import { particles, makeFlyers, makeCascade } from '../core/fx.js';
import { buildNature, plants } from '../world/nature.js';
import { WATER_Y, riverZ } from '../world/terrain.js';
import { place, leafShelter, hammock, campfire, clayPot, basket, bigRock, cutTree, stump, log, mk } from '../world/props.js';
import { M } from '../core/engine.js';
import { B, spear, burst } from './kit.js';

const DAWN = pal({ top: '#5a78a8', mid: '#f4b8a0', bottom: '#7a6a6a', sunCol: '#ffc49a', sun: [95, 6], sunI: 2.5, hemi: ['#b8c4e0', '#4a4a3a', 1.2], fog: '#d8c6c4', near: 35, far: 460, fogH: [0.34, -1, 0.35], clouds: 0.45, exposure: 1.05, bloom: 0.45, cloudLit: '#ffd8c0', cloudShade: '#8a8aa8', water: ['#2a4a5a', '#6a8a90'] });
const MORNING = pal({ top: '#4f8ad0', mid: '#d4e6ef', bottom: '#7a7a6a', sunCol: '#fff0d6', sun: [110, 30], sunI: 3.3, hemi: ['#b8d4f0', '#5a5a3a', 1.2], fog: '#c8dce2', near: 50, far: 580, fogH: [0.26, 0.4, 0.08], clouds: 0.5, exposure: 1.0, bloom: 0.42, water: ['#1f4b55', '#4f8a7c'] });

const CAMP = B(-8, -1, 24), URU = B(16, -1, 38), JUC = B(-30, -1, 41), FISH = B(20, -1, 9.2), AXE = B(42, -1, 30), FORD = B(-42, 1, 0), NEW = B(-82, 1, 19);

export default {
  id: 'puri', tag: 'CAPÍTULO I · INÁCIO · POVO PURI', palette: DAWN,
  boundsText: 'A mata é grande demais para se perder agora. Siga as luzes.',
  cfg() {
    return {
      flats: [{ x: CAMP.x, z: CAMP.z, r: 13 }, { x: FORD.x, z: FORD.z, r: 9, h: -1.05 }, { x: NEW.x, z: NEW.z, r: 11 }],
      clear: [{ ...URU, r: 3 }, { ...JUC, r: 3 }, { ...AXE, r: 9 }, { x: FISH.x, z: FISH.z, r: 3 }],
      bounds: { x: -22, z: -8, r: 98 }, forest: () => 1,
      colors: { grassA: '#557f34', grassB: '#7d9a42', forest: '#2f4a26' },
    };
  },
  build(G, W) {
    buildNature(W, { trees: 1.15, palms: 0.24, ipes: 0.025, grass: 0.75, bushes: 1.5 });
    const c = W.at(CAMP.x, CAMP.z);
    // acampamento: abrigos de folhas, redes entre árvores, fogo
    place(W, leafShelter(), c.x - 6, c.z - 3, 0.6);
    place(W, leafShelter(), c.x + 5.5, c.z - 4.5, -0.5);
    const tA = { x: c.x - 3, z: c.z + 6.5 }, tB = { x: c.x + 1.6, z: c.z + 7.4 }, tC = { x: c.x + 6.2, z: c.z + 5 };
    plants(W, 'tree', [{ ...tA, s: 0.95 }, { ...tB, s: 1.05 }, { ...tC, s: 0.9 }]);
    for (const t of [tA, tB, tC]) W.addCollider(t.x, t.z, 0.45);
    const hy = (t) => W.groundAt(t.x, t.z) + 1.35;
    W.group.add(hammock(new THREE.Vector3(tA.x + 0.3, hy(tA), tA.z), new THREE.Vector3(tB.x - 0.3, hy(tB), tB.z), '#cdb98e'));
    W.group.add(hammock(new THREE.Vector3(tB.x + 0.3, hy(tB), tB.z), new THREE.Vector3(tC.x - 0.3, hy(tC), tC.z), '#b8a070'));
    const fire = place(W, campfire(), c.x, c.z);
    W.fires.push(fire.position);
    place(W, log(2.2), c.x - 1.6, c.z - 1.2, 0.5);
    [[2.2, -1.6], [-4, -1], [3.6, -2.6]].forEach(([dx, dz], i) => place(W, i % 2 ? basket() : clayPot(), c.x + dx, c.z + dz));
    // família
    W.cast.avo = G.npc('avo', c.x - 1.6, c.z - 1.25, 0.9, 'sit');
    W.cast.tio = G.npc('tio', c.x + 4.2, c.z - 1.5, -1.2, 'work');
    W.cast.tia = G.npc('tia', c.x - 4.6, c.z + 1.4, 2.2);
    W.cast.menino = G.npc('menino', c.x + 1.8, c.z + 2.2, 3, 'dance');
    W.cast.menina = G.npc('menina', c.x + 2.8, c.z + 1.4, -2, 'clap');
    W.cast.tio.char.holdInHand(spear(), false);
    // urucuzeiro com cachos vermelhos
    const u = W.at(URU.x, URU.z);
    plants(W, 'bush', [{ x: u.x, z: u.z, s: 1.5 }]);
    const pods = new THREE.Group();
    for (let i = 0; i < 9; i++) mk(new THREE.IcosahedronGeometry(0.12, 0), M('#c42a1a'), Math.cos(i * 2.3) * 0.8, 0.9 + (i % 3) * 0.25, Math.sin(i * 2.3) * 0.8, pods);
    pods.position.copy(u);
    W.group.add(pods);
    // juçaras com cacho de frutos
    const j = W.at(JUC.x, JUC.z);
    plants(W, 'palm', [{ x: j.x + 1, z: j.z, s: 0.75 }, { x: j.x - 1.2, z: j.z + 0.8, s: 0.65 }, { x: j.x + 0.2, z: j.z - 1.4, s: 0.85 }]);
    const fruit = new THREE.Group();
    for (let i = 0; i < 14; i++) mk(new THREE.SphereGeometry(0.06, 6, 5), M('#2a1a2e'), Math.cos(i) * 0.2, 1.4 - i * 0.03, Math.sin(i) * 0.2, fruit);
    fruit.position.copy(j);
    W.group.add(fruit);
    // peixes no rio
    const fishes = new THREE.Group();
    for (let i = 0; i < 4; i++) { const f = mk(new THREE.SphereGeometry(0.12, 8, 6), M('#3a4a48'), 0, 0, 0, fishes); f.scale.set(0.5, 0.35, 1.4); f.castShadow = false; }
    fishes.position.set(FISH.x, WATER_Y - 0.28, riverZ(FISH.x) - 4.5);
    fishes.userData.update = (t) => fishes.children.forEach((f, i) => { const a = t * 0.8 + i * 1.6; f.position.set(Math.cos(a) * 1.4, 0, Math.sin(a) * 0.9); f.rotation.y = -a; });
    W.group.add(fishes); W.anim(fishes);
    place(W, bigRock(1.2, 0.5, 1.0, '#8a857c'), FISH.x, FISH.z + 1.2);
    // sinais de machado e fumaça distante
    const a = W.at(AXE.x, AXE.z);
    place(W, cutTree(), a.x + 2, a.z + 1.5); place(W, cutTree(), a.x - 2.5, a.z - 1);
    [[0, 0], [1.5, -2.5], [-1.2, 2.4]].forEach(([dx, dz]) => place(W, stump(0.45), a.x + dx, a.z + dz));
    place(W, log(3.4), a.x + 0.8, a.z - 1.2, 1.1);
    const smoke = particles({ count: 60, mode: 3, spread: [6, 70, 6], color: '#8a8580', size: 9, rate: 0.03, opacity: 0.3, additive: false });
    smoke.position.copy(W.at(150, riverZ(150) - 110));
    W.group.add(smoke);
    // vau com pedras e novo acampamento junto à pedra grande
    for (let i = -3; i <= 3; i++) place(W, bigRock(0.55, 0.3, 0.5, '#7d786f'), FORD.x + (i % 2) * 0.6, FORD.z + i * 1.9, i, -0.1);
    const n = W.at(NEW.x, NEW.z);
    place(W, bigRock(9, 7, 7, '#a8a296'), n.x - 9, n.z + 10, 0.4, -1.5);
    const cas = makeCascade(3.2, 9);
    W.add(cas, n.x - 5.6, n.z + 5.2, 2.3, 0);
    W.newFire = place(W, campfire({ lit: false }), n.x, n.z);
    W.addCollider(n.x - 9, n.z + 10, 7);
    // vida: névoa, pássaros, borboletas-azuis
    const mist = particles({ count: 70, mode: 2, spread: [160, 3, 40], color: '#f2ece8', size: 7, opacity: 0.16, additive: false });
    mist.position.set(-20, 0.6, riverZ(-20));
    W.group.add(mist);
    W.mist = mist;
    const birds = makeFlyers({ count: 16, center: W.at(-10, 0), radius: 70, height: 38 });
    const blue = makeFlyers({ count: 10, center: c.clone(), radius: 16, height: 2.6, color: '#3a8aff', size: 0.16, flap: 24, speed: 0.22, glowK: 1.5 });
    W.group.add(birds, blue); W.anim(birds); W.anim(blue);
    G.setProtagonist('inacio', 'inacio').holdInHand(spear(), false);
  },

  async run(G, W) {
    const k = W.cast, c = W.at(CAMP.x, CAMP.z);
    G.music('puri');
    G.player.place(c.x + 3, c.z + 4.2, Math.atan2(-3, -4.2));
    await G.fade(0, 1.5);
    G.cinema(true);
    await Promise.all([
      G.chapterTitle({ kicker: 'Capítulo I · Povo Puri', title: 'Os Primeiros Caminhos', sub: 'Território Puri, sul do Espírito Santo · c. 1855', color: '#e0703f' }),
      (async () => { G.player.snapCam(); await G.shot(c.clone().add(new THREE.Vector3(34, 22, 26)), G.player.camPos.clone(), c.clone().add(new THREE.Vector3(-10, 0, 0)), G.player.camLook.clone(), 7); })(),
    ]);
    G.cinema(false);
    G.unlock();
    await G.say([['eu', 'No aldeamento, me batizaram de Inácio. O nome que minha avó me deu, eu guardo comigo — como semente.']]);
    G.objective('Fale com sua avó, junto ao fogo', k.avo);
    await G.interact(k.avo, 'Conversar com a Avó');
    await G.say([
      ['avo', 'Já de pé, meu neto? A névoa ainda dorme em cima do rio.'],
      ['inacio', 'Sonhei com o aldeamento, vó. Com a gente carregando peso para os outros.'],
      ['avo', 'Lá nos obrigavam a trabalhar nas obras deles, longe da nossa gente. Muitos fugiram, voltaram para a mata, guardaram a língua, os cantos, os caminhos.'],
      ['avo', 'Resistir também é lembrar. Vá: traga urucum, frutos da juçara e um peixe do rio. Leia a mata como eu te ensinei.'],
    ]);
    G.toPalette(MORNING, 70);
    await G.collect([
      { target: W.at(URU.x, URU.z), label: 'Colher urucum', toast: 'Urucum — as sementes vermelhas tingem a pele e protegem do sol e dos insetos.', onUse: async () => { G.player.char.anim = 'work'; await G.wait(0.8); G.player.char.anim = 'idle'; } },
      { target: W.at(JUC.x, JUC.z), label: 'Colher frutos da juçara', toast: 'Juçara — os frutos escuros da palmeira alimentam gente e bicho na mata.', onUse: async () => { G.player.char.anim = 'work'; await G.wait(0.8); G.player.char.anim = 'idle'; } },
      { target: W.at(FISH.x, FISH.z), label: 'Pescar com a lança', toast: 'Paciência e mira: a lança encontra o peixe na água rasa.', onUse: async () => { G.player.char.anim = 'point'; await G.wait(0.5); G.sfx('splash'); burst(W, W.at(FISH.x, riverZ(FISH.x) - 4.5, 0.2), '#cfe8f0'); await G.wait(0.4); G.player.char.anim = 'idle'; } },
    ], 'Colete os presentes da mata');
    // o som dos machados
    let next = 0;
    W.updates.push((t) => { if (W.axeOn && t > next) { next = t + 1.3 + Math.random() * 1.2; G.sfx('axe'); } });
    W.axeOn = true;
    G.objective('Um som estranho vem da mata… Investigue', W.at(AXE.x, AXE.z));
    await G.reach(W.at(AXE.x, AXE.z), 7);
    W.axeOn = false;
    await G.say([
      ['eu', 'Marcas de machado… árvores derrubadas. E fumaça subindo além da serra.'],
      ['eu', 'Gente de fora está abrindo caminho. Preciso avisar a Avó.'],
    ]);
    G.objective('Volte ao acampamento e conte à Avó', k.avo);
    await G.interact(k.avo, 'Contar o que viu');
    await G.say([
      ['inacio', 'Vó, vi árvores cortadas a machado. E fumaça para o lado do nascente.'],
      ['avo', 'São os de fora. Chegam com machados e papéis, e dizem que a terra está vazia.'],
      ['inacio', 'Mas nós estamos aqui.'],
      ['avo', 'Estamos. E vamos continuar. Vamos subir o rio até a pedra grande, onde a água canta. Guie a família, Inácio.'],
    ]);
    await G.card('puri_aldeamento');
    k.avo.anim = 'idle'; k.tio.anim = 'idle'; k.menino.anim = 'idle'; k.menina.anim = 'idle';
    k.avo.follow(G.player, 2.2, 0.6); k.tia.follow(G.player, 3.2, -0.9); k.tio.follow(G.player, 4.4, 0.8); k.menino.follow(G.player, 3, 1.6); k.menina.follow(G.player, 4.2, -1.8);
    G.objective('Guie sua família rio acima e atravesse pelo vau', W.at(FORD.x, FORD.z));
    await G.reach(W.at(FORD.x, FORD.z), 6);
    G.objective('Siga até a pedra grande, onde a água canta', W.at(NEW.x, NEW.z));
    await G.reach(W.at(NEW.x, NEW.z), 8);
    G.objective('Acenda o fogo no novo acampamento', W.newFire);
    await G.interact(W.newFire, 'Acender o fogo', { radius: 2.6 });
    G.player.char.anim = 'kneel';
    await G.wait(1);
    W.newFire.userData.fire.userData.setLit(true);
    W.fires.push(W.newFire.position);
    G.sfx('fire');
    G.player.char.anim = 'idle';
    const n = W.newFire.position;
    for (const npc of [k.avo, k.tia, k.tio, k.menino, k.menina]) npc.stop();
    k.avo.goTo(n.x - 1.6, n.z - 1.2).then(() => { k.avo.anim = 'sit'; k.avo.faceTo = n; });
    k.menino.goTo(n.x + 1.8, n.z + 1.6).then(() => { k.menino.anim = 'dance'; });
    k.menina.goTo(n.x - 1.4, n.z + 2).then(() => { k.menina.anim = 'clap'; });
    k.tia.goTo(n.x + 2.4, n.z - 1.4).then(() => { k.tia.faceTo = n; });
    k.tio.goTo(n.x - 3, n.z + 0.4).then(() => { k.tio.faceTo = n; });
    await G.wait(2.2);
    await G.say([
      ['avo', 'Onde o fogo acende, a memória mora.'],
      ['inacio', 'Quando perguntarem de quem é esta terra, vou contar dos caminhos que a gente abriu primeiro.'],
      ['avo', 'Conte. E diga o meu nome, e o seu, para quem ainda vai nascer.'],
    ]);
    await G.card('puri_terra');
    G.objective(null);
    G.lock();
    await G.chapterTitle({ kicker: 'Capítulo I concluído', title: 'Memória registrada', sub: 'Antes dos mapas, havia caminhos — e eles eram Puri.', color: '#e0703f', dur: 4.5 });
  },
};
