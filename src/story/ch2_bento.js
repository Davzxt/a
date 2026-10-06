// Capítulo II — Bento, Pedra Branca: "O Caminho do Tambor" (c. 1886)
import * as THREE from 'three';
import { pal, M } from '../core/engine.js';
import { particles } from '../core/fx.js';
import { buildNature, coffeeRows } from '../world/nature.js';
import { riverZ, alongRiver } from '../world/terrain.js';
import { place, casaGrande, senzala, terreiro, rancho, campfire, drum, sapeBundle, lantern, clayPot, log, box, cyl } from '../world/props.js';
import { B, carryTask, rhythmGame, burst } from './kit.js';

const NIGHT = pal({ top: '#070e24', mid: '#22345e', bottom: '#0a0e18', sunCol: '#9fb8ff', sun: [250, 38], sunI: 1.5, hemi: ['#4a64a8', '#141a28', 1.15], fog: '#16244a', near: 22, far: 260, fogH: [0.38, -1, 0.3], clouds: 0.22, stars: 1, exposure: 1.55, bloom: 0.8, cloudLit: '#4a5a80', cloudShade: '#141c30', sunSize: 0.0013, glow: 0.6, sat: 1.0, water: ['#0a1a28', '#1a3040'] });

const SEN = B(-12, -1, 32), START = B(-15, -1, 26), JOANA = B(-8, -1, 26.6), TER = B(15, -1, 27), CG = B(34, -1, 47);
const BX = -2, BZ = riverZ(-2), BR_S = { x: BX, z: BZ - 11 }, EDGE = B(-2, 1, 18), QUI = B(36, 1, 64);

export default {
  id: 'bento', tag: 'CAPÍTULO II · BENTO · PEDRA BRANCA', palette: NIGHT,
  boundsText: 'Não por aí. Siga o caminho do tambor.',
  cfg() {
    return {
      flats: [{ x: SEN.x, z: SEN.z, r: 14 }, { x: TER.x, z: TER.z, r: 15 }, { x: CG.x, z: CG.z, r: 13 }, { x: QUI.x, z: QUI.z, r: 16 }],
      roads: [{ pts: [[BX, BZ + 10], ...[[4, 26], [14, 40], [26, 52], [34, 59]].map(([x, d]) => [x, riverZ(x) + d])], w: 1.4, flatten: false }],
      fields: [{ ...B(58, -1, 50), r: 26, k: 0.5 }, { ...B(-42, -1, 46), r: 20, k: 0.5 }],
      bounds: { x: 12, z: 16, r: 86 },
      forest: (x, z) => (z > riverZ(x) ? 1 : x > -70 && x < 90 && z > riverZ(x) - 75 ? 0.04 : 0.85),
      colors: { grassA: '#4f7a36', grassB: '#7a8f44', forest: '#2c4424', soil: '#7a3a24' },
    };
  },
  build(G, W) {
    buildNature(W, { trees: 1.1, grass: 0.8, coffee: [...coffeeRows(58, riverZ(58) - 50, 8, 14, 0.15), ...coffeeRows(-42, riverZ(-42) - 46, 6, 10, -0.1)] });
    place(W, senzala({ lit: true }), SEN.x, SEN.z, 0);
    place(W, terreiro(), TER.x, TER.z, 0.05);
    place(W, casaGrande({ lit: true }), CG.x, CG.z, -0.25);
    const lamp = lantern(true);
    lamp.position.set(SEN.x - 4.4, W.groundAt(SEN.x, SEN.z) + 2.1, SEN.z + 3.1);
    W.group.add(lamp);
    const sl = new THREE.PointLight('#ff9a4a', 6, 9, 1.6);
    sl.position.copy(lamp.position);
    W.group.add(sl);
    place(W, log(1.4), JOANA.x, JOANA.z, 0.2);
    W.cast.joana = G.npc('joana', JOANA.x, JOANA.z + 0.1, Math.PI, 'sit');
    // pinguela
    const br = new THREE.Group();
    box(br, 2.4, 0.16, 21, '#5a4030', 0, 0.55, 0);
    for (let i = -10; i <= 10; i += 2.5) for (const s of [-1, 1]) cyl(br, 0.08, 0.1, 2.4, '#4a3426', s * 1.1, -0.2, i, 6);
    for (const s of [-1, 1]) box(br, 0.08, 0.08, 21, '#4a3426', s * 1.1, 1.2, 0);
    W.add(br, BX, BZ, 0, 0);
    br.position.y = 0;
    W.addSurface(BX, BZ, 1.2, 10.5, 0, 0.63);
    // capatazes com lampiões (furtividade)
    const loop = [[TER.x - 11, TER.z + 9], [TER.x + 13, TER.z + 9], [TER.x + 13, TER.z - 9], [TER.x - 11, TER.z - 9]];
    const line = [[-26, riverZ(-26) - 14], [6, riverZ(6) - 14]];
    W.patrols = [loop, line].map((pts, i) => {
      const n = G.npc('capataz', pts[0][0], pts[0][1], 0, 'lantern');
      n.char.holdInHand(lantern(true), true);
      const l = new THREE.PointLight('#ffb35c', 16, 12, 1.4);
      l.position.set(0.25, 1.2, 0.3);
      n.char.root.add(l);
      n.solid = false;
      (async () => { for (;;) for (const [x, z] of i ? [...pts, ...[...pts].reverse()] : pts) await n.goTo(x, z, 1.3); })();
      return n;
    });
    // o quilombo na mata
    const q = W.at(QUI.x, QUI.z);
    place(W, rancho({ stage: 3 }), q.x - 7, q.z + 5, -0.6);
    W.rB = place(W, rancho({ stage: 0 }), q.x + 7, q.z + 5.5, 0.6);
    const fire = place(W, campfire({ scale: 1.25 }), q.x, q.z);
    W.fires.push(fire.position);
    W.tambu = place(W, drum(true), q.x + 2.6, q.z - 2.6, 0);
    W.tambu.rotation.z = 0.25;
    place(W, drum(false), q.x + 3.8, q.z - 1.4, 0).rotation.z = 0.2;
    W.pile = W.at(q.x - 4.5, q.z - 8);
    for (let i = 0; i < 6; i++) { const b = sapeBundle(); b.position.set(W.pile.x + (i % 3) * 0.35 - 0.35, W.pile.y + 0.2 + Math.floor(i / 3) * 0.3, W.pile.z + (i % 2) * 0.3); b.rotation.y = 0.3 * i; W.group.add(b); }
    place(W, clayPot('#8a4a2a'), q.x - 1.2, q.z + 1.1);
    W.cast.benedito = G.npc('benedito', q.x - 2.2, q.z - 2.6, 0.6);
    W.cast.q1 = G.npc('quilombola1', q.x - 6, q.z + 2.2, 0.4);
    W.cast.q2 = G.npc('quilombola2', q.x + 4.7, q.z - 1.9, -0.8);
    W.cast.q3 = G.npc('quilombola3', q.x - 1.8, q.z + 1.8, 2.4, 'work');
    W.cast.crianca = G.npc('crianca', q.x + 2, q.z + 2.6, 3, 'dance');
    W.drumSource = q;
    const ff = particles({ count: 120, mode: 0, spread: [120, 6, 120], color: '#c8ff7a', size: 0.08, intensity: 2.2 });
    ff.position.set(20, 3, 30);
    W.group.add(ff);
    G.setProtagonist('bento', 'bento');
  },

  async run(G, W) {
    const k = W.cast;
    G.music('bentoNoite');
    G.player.place(START.x, START.z, 0.15);
    await G.fade(0, 1.5);
    G.cinema(true);
    const t = W.at(TER.x, TER.z);
    await Promise.all([
      G.chapterTitle({ kicker: 'Capítulo II · Pedra Branca', title: 'O Caminho do Tambor', sub: 'Fazendas da região de Vargem Alta · c. 1886', color: '#f0b350' }),
      (async () => { G.player.snapCam(); await G.shot(t.clone().add(new THREE.Vector3(-8, 26, 34)), G.player.camPos.clone(), t, G.player.camLook.clone(), 7); })(),
    ]);
    G.cinema(false);
    G.unlock();
    await G.say([['eu', 'Na fazenda me chamam de escravo. Mas escravizado é o que fizeram comigo — não quem eu sou. Eu sou Bento.']]);
    G.objective('Fale com Tia Joana, perto da senzala', k.joana);
    await G.interact(k.joana, 'Conversar com Tia Joana');
    await G.say([
      ['joana', 'Fala baixo, Bento. Os capatazes estão rondando o terreiro com os lampiões.'],
      ['bento', 'É hoje, Tia?'],
      ['joana', 'É hoje. Gente da Pedra Branca, da São Pedro e da Prosperidade já está levantando ranchos lá na mata. Lá a gente vai ser família.'],
      ['bento', 'E estes ferros nos meus pulsos?'],
      ['joana', 'Seu Benedito sabe lidar com ferro. Chegando lá, ele dá um jeito. Agora escuta: vá pelas sombras, longe da luz dos lampiões, e atravesse a pinguela do rio.'],
      ['joana', 'Do outro lado, siga o tambor. Ele vai te chamar.'],
    ]);
    k.joana.anim = 'idle';
    k.joana.goTo(-40, riverZ(-40) - 20, 1.4).then(() => k.joana.teleport(QUI.x - 3, QUI.z + 3.5, 0));
    const caughtAt = [START.x, START.z, 0.15];
    W.stealth = true;
    let warn = 0;
    W.updates.push((tm) => {
      if (!W.stealth || G.state !== 'play' || G.auto) return;
      const p = G.player.pos;
      for (const n of W.patrols) {
        const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z);
        if (d < 4.8) { G.caught('Você foi visto! Volte às sombras e tente de novo.', ...caughtAt); return; }
        if (d < 8.5 && tm > warn) { warn = tm + 5; G.toast('Cuidado: a luz do lampião está perto.', 2200); }
      }
      if (p.z > BZ - 6) { caughtAt[0] = BX; caughtAt[1] = BZ - 4; caughtAt[2] = 0; }
    });
    G.objective('Atravesse pelas sombras até a pinguela do rio', W.at(BR_S.x, BR_S.z));
    G.toast('Fique longe da luz dos lampiões.', 4000);
    await G.reach(W.at(BR_S.x, BR_S.z), 3.2);
    G.objective('Atravesse a pinguela e alcance a mata', W.at(EDGE.x, EDGE.z));
    await G.reach(W.at(EDGE.x, EDGE.z), 5);
    W.stealth = false;
    G.music('bentoMata');
    await G.say([['eu', 'A mata me esconde. Agora, o tambor me guia.']]);
    G.objective('Siga o som do tambor pela mata', W.drumSource);
    await G.reach(W.drumSource, 11);
    G.music('bentoRoda');
    W.drumSource = null;
    await G.say([
      ['benedito', 'Chegou, meu filho! Aqui ninguém é dono de ninguém.'],
      ['joana', 'Eu não disse que o tambor ia te chamar?'],
      ['benedito', 'Primeiro, esses ferros. Estenda os pulsos.'],
    ]);
    G.objective('Deixe Seu Benedito quebrar os grilhões', k.benedito);
    await G.interact(k.benedito, 'Estender os pulsos');
    k.benedito.anim = 'work';
    G.lock();
    for (let i = 0; i < 3; i++) { await G.wait(0.45); G.sfx('build'); burst(W, G.player.pos.clone().add(new THREE.Vector3(0, 1, 0))); }
    G.player.char.free();
    k.benedito.anim = 'idle';
    G.unlock();
    G.toast('Seus pulsos estão livres.', 3500);
    await G.say([
      ['bento', 'Minhas mãos… são minhas de novo.'],
      ['benedito', 'Então use para ajudar os seus. O rancho da sua família precisa de cobertura antes da chuva.'],
    ]);
    await carryTask(G, {
      from: W.pile, to: W.rB, count: 3, make: sapeBundle, title: 'Cubra o rancho com sapê',
      pick: 'Pegar um feixe de sapê', put: 'Cobrir o rancho',
      onPut: (i) => W.rB.userData.setStage(i + 1),
    });
    await G.say([['joana', 'Ficou bonito. Agora vem, Bento: a roda vai começar.']]);
    G.objective('Junte-se à roda de caxambu: toque o tambu', W.tambu);
    await G.interact(W.tambu, 'Tocar o tambu', { radius: 2.6 });
    const q = W.at(QUI.x, QUI.z);
    const ring = [k.joana, k.q1, k.q3, k.crianca];
    ring.forEach((n, i) => { const a = (i / ring.length) * Math.PI * 2; n.stop(); n.goTo(q.x + Math.cos(a) * 3.2, q.z + Math.sin(a) * 3.2, 1.6).then(() => { n.anim = 'dance'; }); });
    k.benedito.anim = 'clap'; k.benedito.faceTo = q;
    k.q2.anim = 'drum'; k.q2.faceTo = q;
    G.lock();
    G.player.place(W.tambu.position.x - 0.7, W.tambu.position.z - 0.5, Math.atan2(q.x - W.tambu.position.x, q.z - W.tambu.position.z));
    G.player.char.anim = 'drum';
    G.music('rhythm');
    const hits = await rhythmGame(G, { bpm: 100 });
    G.player.char.anim = 'idle';
    G.music('bentoRoda');
    G.toast(`Você tocou ${hits} batidas no tempo — e a roda inteira respondeu.`, 4000);
    await G.say([
      ['joana', 'Esse tambor veio com os nossos mais velhos. Enquanto ele tocar, a gente não esquece.'],
      ['bento', 'Aqui ninguém me chama de escravo. Aqui eu sou Bento.'],
      ['benedito', 'E esta terra vai lembrar de nós: São Pedro… Pedra Branca.'],
    ]);
    await G.card('pb_origem');
    await G.card('pb_caxambu');
    await G.card('pb_bento');
    await G.say([['narrador', 'Em 13 de maio de 1888, a Lei Áurea aboliria oficialmente a escravidão no Brasil. Mas a liberdade também foi conquistada antes — passo a passo, nos caminhos da mata.']]);
    G.objective(null);
    await G.chapterTitle({ kicker: 'Capítulo II concluído', title: 'Memória registrada', sub: 'O tambor de Pedra Branca segue tocando.', color: '#f0b350', dur: 4.5 });
  },
};
