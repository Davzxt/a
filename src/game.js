// Orquestra o jogo: estados, capítulos, NPCs, interações e o "roteiro" assíncrono de cada capítulo.
import * as THREE from 'three';
import { Engine, detectQuality, mixPal, timeU } from './core/engine.js';
import { pointScale, Guide, makeBeacon } from './core/fx.js';
import { Input } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { UI } from './core/ui.js';
import { XR } from './core/xr.js';
import { Player } from './core/player.js';
import { angLerp } from './core/noise.js';
import { World, riverZ } from './world/terrain.js';
import { Character } from './world/character.js';
import { LOOKS, SPEAKERS, PROTAGONISTS, CARDS, CREDITS_HTML } from './story/data.js';
import hub from './story/hub.js';
import puri from './story/ch1_puri.js';
import bento from './story/ch2_bento.js';
import pietro from './story/ch3_pietro.js';
import youssef from './story/ch4_youssef.js';
import epilogo from './story/ch5_epilogo.js';

export const CHAPTERS = { hub, puri, bento, pietro, youssef, epilogo };
const ORDER = ['puri', 'bento', 'pietro', 'youssef', 'epilogo'];
const ABORT = new Error('abort');
const $ = (id) => document.getElementById(id);
const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
const save = (k, set) => { try { localStorage.setItem(k, JSON.stringify([...set])); } catch (e) { /* ok */ } };
const _v = new THREE.Vector3();

// ---------------- NPC ----------------
const SEATED = ['sit', 'drum', 'dance', 'work', 'kneel', 'clap'];
export class NPC {
  constructor(G, look, x, z, yaw = 0, anim = 'idle') {
    this.G = G;
    this.char = look instanceof Character ? look : new Character(typeof look === 'string' ? LOOKS[look] : look);
    this.pos = new THREE.Vector3(x, G.world.groundAt(x, z), z);
    this.yaw = yaw; this.speed = 0; this.anim = anim; this.talking = false;
    this.target = null; this.followT = null; this.faceTo = null; this.solid = true;
    G.world.group.add(this.char.root);
    G.world.npcs.push(this);
    this.sync(0);
  }
  goTo(x, z, speed = 1.6) { this.followT = null; return new Promise((res) => { this.target = { x, z, speed, res }; }); }
  follow(t, dist = 2.2, side = 0) { this.target = null; this.followT = { t, dist, side }; }
  stop() { this.followT = null; if (this.target) { const r = this.target.res; this.target = null; r(); } }
  teleport(x, z, yaw = this.yaw) { this.pos.set(x, this.G.world.groundAt(x, z), z); this.yaw = yaw; this.target = null; }
  remove() { this.char.root.removeFromParent(); const a = this.G.world.npcs; a.splice(a.indexOf(this), 1); }
  update(dt) {
    const W = this.G.world;
    let want = null, sp = 0;
    if (this.target) { want = this.target; sp = want.speed; }
    else if (this.followT) {
      const f = this.followT, t = f.t.pos, ty = f.t.yaw ?? 0;
      const gx = t.x - Math.sin(ty) * f.dist - Math.cos(ty) * f.side, gz = t.z - Math.cos(ty) * f.dist + Math.sin(ty) * f.side;
      const d = Math.hypot(gx - this.pos.x, gz - this.pos.z);
      if (d > 0.7) { want = { x: gx, z: gz }; sp = Math.min(4.2, 0.9 + d * 0.9); }
    }
    let vx = 0, vz = 0;
    if (want) {
      const dx = want.x - this.pos.x, dz = want.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { if (this.target) { const r = this.target.res; this.target = null; r(); } }
      else { const s = Math.min(sp, d / Math.max(dt, 1e-3)); vx = (dx / d) * s; vz = (dz / d) * s; this.yaw = angLerp(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 7)); }
    } else if (this.faceTo) this.yaw = angLerp(this.yaw, Math.atan2(this.faceTo.x - this.pos.x, this.faceTo.z - this.pos.z), 1 - Math.exp(-dt * 5));
    this.pos.x += vx * dt; this.pos.z += vz * dt;
    if (vx || vz) { if (this.solid) for (const c of W.colliders) { const dx = this.pos.x - c.x, dz = this.pos.z - c.z, rr = c.r + 0.3, d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); this.pos.x = c.x + (dx / d) * rr; this.pos.z = c.z + (dz / d) * rr; } } }
    this.pos.y = W.groundAt(this.pos.x, this.pos.z);
    this.speed = dt ? Math.hypot(vx, vz) : 0;
    this.sync(dt);
  }
  sync(dt) {
    const c = this.char;
    c.root.position.copy(this.pos);
    c.root.rotation.y = this.yaw;
    c.moveSpeed = this.speed;
    c.anim = this.talking ? 'talk' : this.speed > 0.15 && SEATED.includes(this.anim) ? 'idle' : this.anim;
    c.update(dt, this.G.time);
  }
}

// ---------------- Jogo ----------------
export class Game {
  constructor() {
    const url = new URLSearchParams(location.search);
    this.debug = url;
    this.auto = url.has('auto');
    this.autoStop = +(url.get('stop') || 1e9);
    this.steps = 0;
    const q = url.get('q');
    this.engine = new Engine($('app'), q || detectQuality());
    this.time = 0;
    this.input = new Input(this);
    this.audio = new AudioEngine();
    this.ui = new UI(this);
    this.xr = new XR(this);
    this.player = new Player(this);
    this.guide = new Guide(this.engine.scene);
    this.beacon = makeBeacon();
    this.engine.scene.add(this.beacon);
    this.engine.onResize = (s) => { pointScale.value = s; };
    this.engine.resize();
    this.world = null; this.runId = 0; this.state = 'boot'; this.screenBack = 'title';
    this.inter = []; this.timers = []; this.triggers = []; this.objTarget = null; this.busy = false;
    this.found = new Set(load('cdm-found')); this.done = new Set(load('cdm-done'));
    this.palAnim = null; this.curPal = null;
    this.titleCam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), init: false };
    this.last = performance.now();
    this.markerGeo = new THREE.OctahedronGeometry(0.17, 0);
    this.markerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(2.6), fog: false });
    this.ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(1.6), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.ringGeo = new THREE.RingGeometry(0.55, 0.62, 40).rotateX(-Math.PI / 2);
    window.__cdm = this;
    this.engine.renderer.setAnimationLoop(() => this.tick());
  }

  // ---------- inicialização ----------
  setLoad(p, msg) { $('load-bar').style.width = `${p * 100}%`; if (msg) $('load-msg').textContent = msg; }
  async boot() {
    this.setLoad(0.1, 'Afinando os tambores…');
    await Promise.race([Promise.all(['700 40px Cinzel', '600 20px Nunito', 'italic 400 20px Nunito'].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 2500))]);
    this.setLoad(0.35, 'Esculpindo os personagens…');
    await new Promise((r) => setTimeout(r, 30));
    try { this.portraits = this.makePortraits(); } catch (e) { this.portraits = {}; }
    this.setLoad(0.6, 'Erguendo as serras e o rio…');
    await new Promise((r) => setTimeout(r, 30));
    this.loadWorld('hub');
    this.setLoad(0.9, 'Acendendo o céu…');
    try { await this.engine.renderer.compileAsync(this.engine.scene, this.engine.camera); } catch (e) { /* ok */ }
    this.setLoad(1, 'Pronto.');
    const ch = this.debug.get('ch');
    if (ch && CHAPTERS[ch]) { this.ui.showScreen(null); this.audio.init(); this.startChapter(ch, this.debug.has('journey')); return; }
    this.state = 'title';
    this.ui.showScreen('title');
    this.ui.fade(0, 1.6);
  }

  makePortraits() {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(360, 300);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(26, 360 / 300, 0.1, 50);
    sc.add(new THREE.HemisphereLight('#fff1d6', '#3a2a1e', 1.7));
    const key = new THREE.DirectionalLight('#ffd8a8', 3); key.position.set(2, 3, 4); sc.add(key);
    const rim = new THREE.DirectionalLight('#9fc8ff', 2.2); rim.position.set(-3, 2, -3); sc.add(rim);
    const out = {};
    for (const p of PROTAGONISTS) {
      const c = new Character(LOOKS[p.look]);
      if (c.bound) c.free();
      for (let i = 0; i < 4; i++) c.update(0.05, i);
      sc.add(c.root);
      cam.position.set(0.42, 1.62, 1.95);
      cam.lookAt(0, 1.5, 0);
      r.render(sc, cam);
      out[p.id] = r.domElement.toDataURL('image/png');
      sc.remove(c.root);
    }
    r.dispose();
    r.forceContextLoss();
    return out;
  }

  // ---------- mundos ----------
  loadWorld(id) {
    const ch = CHAPTERS[id];
    this.clearInteract();
    this.objective(null);
    this.triggers = []; this.timers = []; this.palAnim = null; this.busy = false;
    this.player.focus = null; this.player.shotData = null;
    if (this.world) this.world.dispose();
    const W = (this.world = new World(this, ch.cfg()));
    this.engine.scene.add(W.group);
    this.curPal = ch.palette;
    this.engine.applyPalette(ch.palette);
    this.chapter = ch;
    this.chapterId = id;
    ch.build(this, W);
    W.finalize();
    return W;
  }

  setProtagonist(look, pid) {
    this.pid = pid;
    const c = new Character(LOOKS[look]);
    this.player.setChar(c);
    return c;
  }

  npc(look, x, z, yaw = 0, anim = 'idle') { return new NPC(this, look, x, z, yaw, anim); }

  // ---------- fluxo de capítulos ----------
  async startChapter(id, journey = false) {
    const rid = ++this.runId;
    this.journey = journey;
    this.audio.init();
    this.state = 'loading';
    this.ui.showScreen(null); this.ui.hud(false); this.ui.endDialog(); this.ui.modal = null; this.ui.cinema(false);
    $('record').classList.remove('show'); $('chapter-card').classList.remove('show'); $('rhythm').classList.remove('show');
    await this.ui.fade(1, 0.7);
    if (rid !== this.runId) return;
    this.player.locked = true;
    this.loadWorld(id);
    try { await this.engine.renderer.compileAsync(this.engine.scene, this.engine.camera); } catch (e) { /* ok */ }
    if (rid !== this.runId) return;
    this.state = 'play';
    this.ui.hud(true);
    this.ui.chapterTag(this.chapter.tag || '');
    try {
      await this.chapter.run(this, this.world);
      if (rid !== this.runId) return;
      this.done.add(id); save('cdm-done', this.done);
      await this.finishChapter(id);
    } catch (e) { if (e !== ABORT) console.error(e); }
  }
  async finishChapter(id) {
    const i = ORDER.indexOf(id);
    if (id === 'epilogo') { await this.ui.fade(1, 1.2); this.showCredits(true); return; }
    if (this.journey && i >= 0) return this.startChapter(ORDER[i + 1], true);
    return this.toTitle('chapters');
  }
  async toTitle(screen = 'title') {
    const rid = ++this.runId;
    this.ui.hud(false); this.ui.endDialog(); this.ui.modal = null; this.ui.cinema(false); this.ui.objective(null); this.ui.prompt(null);
    $('record').classList.remove('show'); $('chapter-card').classList.remove('show'); $('rhythm').classList.remove('show');
    this.state = 'loading';
    await this.ui.fade(1, 0.6);
    if (rid !== this.runId) return;
    this.player.setChar(null);
    this.loadWorld('hub');
    this.audio.setScene('title');
    this.state = 'title';
    this.titleCam.init = false;
    this.previewId = null;
    if (screen === 'chapters') this.openChapters(); else this.ui.showScreen(screen);
    $('title').classList.add('ready');
    this.ui.fade(0, 1.2);
    if (this.xr.presenting) this.vrMenu();
  }
  restart() { if (this.chapterId && this.chapterId !== 'hub') this.startChapter(this.chapterId, this.journey); }

  showCredits(final = false) {
    $('credits-body').innerHTML = CREDITS_HTML;
    this.screenBack = 'title';
    if (final) {
      this.runId++;
      this.state = 'title';
      this.ui.hud(false);
      this.player.setChar(null);
      this.loadWorld('hub');
      this.audio.setScene('title');
      this.titleCam.init = false;
      $('title').classList.add('ready');
      this.ui.fade(0, 1.5);
      if (this.xr.presenting) { this.ui.vr.menu({ title: 'Obrigado por caminhar com estas histórias', body: 'Vargem Alta foi criada em 1988 — mas foi formada muito antes, por muitos caminhos. As fontes da pesquisa estão no Acervo e nos créditos (fora do modo VR).', buttons: [{ label: 'Menu', id: 'm' }] }).then(() => this.vrMenu()); return; }
    }
    this.ui.showScreen('credits');
  }

  openChapters() {
    const list = PROTAGONISTS.map((p) => ({ ...p, portrait: this.portraits?.[p.id] }));
    this.ui.renderChapters(list, this.done);
    this.ui.showScreen('chapters');
  }
  previewChar(id) { this.previewId = id; }

  menu(act) {
    this.audio.init();
    const back = this.state === 'paused' ? 'pause' : 'title';
    switch (act) {
      case 'journey': this.startChapter('puri', true); break;
      case 'chapters': this.screenBack = 'title'; this.openChapters(); break;
      case 'epilogo': this.startChapter('epilogo'); break;
      case 'archive': this.screenBack = back; this.ui.renderArchive(CARDS, this.found); this.ui.showScreen('archive'); break;
      case 'credits': this.screenBack = 'title'; this.showCredits(); break;
      case 'settings': this.screenBack = back; this.ui.showScreen('settings'); break;
      case 'back': this.previewId = null; this.ui.showScreen(this.screenBack); break;
      case 'vr': this.xr.enter(); break;
      case 'resume': this.togglePause(); break;
      case 'restart': this.state = 'play'; this.audio.duck(false); this.restart(); break;
      case 'title': this.audio.duck(false); this.toTitle(); break;
      default: break;
    }
  }

  togglePause() {
    if (this.state === 'play') {
      this.state = 'paused';
      this.ui.showScreen('pause');
      this.audio.duck(true);
      if (this.xr.presenting) this.vrPause();
    } else if (this.state === 'paused') {
      this.state = 'play';
      this.ui.showScreen(null);
      this.audio.duck(false);
      if (this.xr.presenting) this.refreshVRModal();
    }
  }
  async vrPause() {
    const id = await this.ui.vr.menu({ title: 'Pausa', buttons: [{ label: 'Continuar', id: 'resume' }, { label: 'Reiniciar capítulo', id: 'restart' }, { label: 'Menu principal', id: 'title' }, { label: 'Sair da realidade virtual', id: 'exit' }] });
    if (id === 'exit') { this.togglePause(); this.xr.exit(); return; }
    this.menu(id);
  }
  refreshVRModal() {
    const m = this.ui.modal;
    if (m?.type === 'dialog') this.ui.renderText();
    else this.ui.vr.hide();
  }
  async vrMenu() {
    if (!this.xr.presenting || this.state !== 'title') return;
    const bt = [{ label: 'Iniciar Jornada', id: 'journey' }, ...PROTAGONISTS.map((p) => ({ label: `${p.num.split('·')[0].trim()} · ${p.name}`, id: p.id })), { label: 'Epílogo', id: 'epilogo' }, { label: 'Sair da realidade virtual', id: 'exit' }];
    const id = await this.ui.vr.menu({ kicker: 'Vargem Alta · Espírito Santo', title: 'Caminhos da Memória', body: 'Quatro histórias. Um mesmo chão. Aponte e use o gatilho.', buttons: bt, cols: 2 });
    if (this.state !== 'title') return;
    if (id === 'exit') this.xr.exit();
    else if (id === 'journey') this.startChapter('puri', true);
    else if (id === 'epilogo') this.startChapter('epilogo');
    else this.startChapter(PROTAGONISTS.find((p) => p.id === id).chapter);
  }
  onXR(on) {
    const rig = this.engine.rig;
    if (on) {
      $('ui').style.visibility = 'hidden';
      const p = this.state === 'title' ? this.hubSpot : this.player.pos;
      rig.position.set(p.x, this.world.groundAt(p.x, p.z), p.z);
      rig.rotation.y = this.state === 'title' ? this.hubYaw + Math.PI : this.player.yaw;
      if (this.state === 'title') this.vrMenu();
      else this.refreshVRModal();
    } else {
      $('ui').style.visibility = '';
      if (this.player.char) this.player.char.root.visible = true;
      this.ui.vr.hide();
      this.engine.resize();
    }
  }

  // ---------- auxiliares de roteiro (todos abortam se o capítulo mudar) ----------
  _chk(rid) { if (rid !== this.runId) throw ABORT; }
  step() { this.steps++; if (this.auto && this.steps >= this.autoStop) { this.auto = false; console.log('auto stop', this.steps); } }
  wait(s) {
    const rid = this.runId;
    if (this.auto) s *= 0.02;
    return new Promise((res) => this.timers.push({ t: this.time + s, res })).then(() => this._chk(rid));
  }
  async say(lines) {
    const rid = this.runId;
    this.step();
    const W = this.world;
    for (const [who, text] of lines) {
      this._chk(rid);
      const thought = who === 'eu' || who === 'narrador';
      const sp = who === 'eu' ? SPEAKERS[this.pid] : SPEAKERS[who] || ['', '#e3b964'];
      const npc = W.cast[who];
      if (npc) { this.talker = npc; npc.talking = true; npc.faceTo = this.player.pos; }
      if (this.talker && !thought) {
        this.player.setFocus(this.talker);
        const t = this.talker.pos;
        this.player.yaw = angLerp(this.player.yaw, Math.atan2(t.x - this.player.pos.x, t.z - this.player.pos.z), 1);
      }
      if (who === this.pid && this.player.char) this.player.char.anim = 'talk';
      if (this.auto) await new Promise((r) => setTimeout(r, 5));
      else await this.ui.dialog({ name: who === 'narrador' ? '' : sp[0], color: sp[1], text, italic: thought });
      if (npc) npc.talking = false;
      if (this.player.char && this.player.char.anim === 'talk') this.player.char.anim = 'idle';
    }
    this.ui.endDialog();
    this.player.setFocus(null);
    this.talker = null;
    this._chk(rid);
  }
  objective(text, target = null) {
    this.ui.objective(text);
    this.objTarget = target;
    if (text) this.audio.sfx('objective');
  }
  objPos(t = this.objTarget) {
    if (!t) return null;
    if (typeof t === 'function') return this.objPos(t());
    if (t.isVector3) return t;
    if (t.pos) return t.pos;
    if (t.isObject3D) return t.getWorldPosition(_v);
    return null;
  }
  addInteract(target, label, { radius = 2.4, height = 2.3, onUse, marker = true } = {}) {
    const it = { target, label, r: radius, onUse, h: height };
    if (marker) {
      const g = new THREE.Group();
      const d = new THREE.Mesh(this.markerGeo, this.markerMat);
      d.scale.y = 1.6;
      g.add(d);
      const ring = new THREE.Mesh(this.ringGeo, this.ringMat);
      g.add(ring);
      it.marker = g; it.diamond = d; it.ring = ring;
      this.engine.scene.add(g);
    }
    it.remove = () => { it.marker?.removeFromParent(); const i = this.inter.indexOf(it); if (i >= 0) this.inter.splice(i, 1); };
    this.inter.push(it);
    return it;
  }
  // Testes: confere se o jogador consegue chegar perto o bastante do alvo (colisões incluídas)
  checkReach(target, r, label) {
    const p = this.objPos(target);
    if (!p || !this.world) return;
    const probe = new THREE.Vector3(p.x + 0.03, 0, p.z + 0.02);
    for (let i = 0; i < 4; i++) this.world.collide(probe, 0.33);
    const d = Math.hypot(probe.x - p.x, probe.z - p.z);
    if (d >= r) console.error(`[auto] alvo inalcançável (${d.toFixed(2)} m ≥ ${r} m): ${label}`);
  }
  clearInteract() { for (const it of [...this.inter]) it.remove(); this.ui.prompt(null); }
  interact(target, label, opts = {}) {
    const rid = this.runId;
    this.step();
    return new Promise((res) => {
      const it = this.addInteract(target, label, { ...opts, onUse: () => { it.remove(); res(); } });
      if (this.auto) setTimeout(() => { this.checkReach(target, it.r, label); const p = this.objPos(target); if (p) this.player.place(p.x + 1.2, p.z + 1.2, this.player.yaw); it.onUse(); }, 20);
    }).then(() => this._chk(rid));
  }
  // Vários alvos, em qualquer ordem. items: [{target, label, onUse, toast}]
  collect(items, title) {
    const rid = this.runId;
    this.step();
    let n = 0;
    const open = () => items.filter((i) => !i.done);
    const nearest = () => { const o = open(); let best = null, bd = 1e9; for (const i of o) { const p = this.objPos(i.target), d = p ? p.distanceTo(this.player.pos) : 1e9; if (d < bd) { bd = d; best = i.target; } } return best; };
    const upd = () => this.objective(`${title} (${n}/${items.length})`, nearest);
    return new Promise((res, rej) => {
      for (const it of items) {
        it.handle = this.addInteract(it.target, it.label, {
          radius: it.radius,
          onUse: async () => {
            it.handle.remove(); it.done = true; this.busy = true;
            try { if (it.onUse) await it.onUse(); } catch (e) { this.busy = false; rej(e); return; }
            this.busy = false;
            if (rid !== this.runId) return;
            n++;
            this.audio.sfx('collect');
            if (it.toast) this.ui.toast(it.toast, 4200);
            if (n === items.length) res(); else upd();
          },
        });
      }
      upd();
      if (this.auto) items.forEach((it, k) => setTimeout(() => { if (it.done) return; this.checkReach(it.target, it.handle.r, it.label); it.handle.onUse(); }, 30 + k * 40));
    }).then(() => this._chk(rid));
  }
  reach(pos, r = 4) {
    const rid = this.runId;
    this.step();
    return new Promise((res) => {
      this.triggers.push({ pos, r, res });
      if (this.auto) setTimeout(() => this.player.place(pos.x, pos.z, this.player.yaw), 20);
    }).then(() => this._chk(rid));
  }
  async card(id) {
    const rid = this.runId;
    this.step();
    if (!this.found.has(id)) { this.found.add(id); save('cdm-found', this.found); }
    if (!this.auto) await this.ui.record(CARDS[id]);
    this.ui.toast('★ Registro guardado no Acervo Histórico');
    this._chk(rid);
  }
  async chapterTitle(o) {
    const rid = this.runId;
    this.step();
    if (!this.auto) await this.ui.chapterCard(o);
    this._chk(rid);
  }
  shot(from, to, lookFrom, lookTo, dur) {
    if (this.xr.presenting || this.auto) return Promise.resolve();
    return this.player.shot(from, to, lookFrom, lookTo, dur);
  }
  async fade(v, d = 0.8) { const rid = this.runId; await this.ui.fade(v, this.auto ? 0.01 : d); this._chk(rid); }
  toast(t, ms) { this.ui.toast(t, ms); }
  music(s) { this.audio.setScene(s); }
  sfx(s) { this.audio.sfx(s); }
  cinema(on) { this.ui.cinema(on); }
  unlock() { this.player.locked = false; }
  lock() { this.player.locked = true; }
  carry(obj) { this.player.char.hold(obj); }
  drop() { return this.player.char.drop(); }
  toPalette(p, dur = 3) { this.palAnim = { from: mixPal(this.curPal, this.curPal, 0), to: p, t: 0, dur }; this.curPal = p; }
  boundsHint() {
    const now = performance.now();
    if (now - (this.lastBounds || 0) > 6000) { this.lastBounds = now; this.ui.toast(this.chapter.boundsText || 'Por aqui não — o caminho é outro. Siga as luzes.'); }
  }
  async caught(text, x, z, yaw) {
    if (this.caughtBusy) return;
    this.caughtBusy = true;
    this.lock();
    this.sfx('caught');
    this.ui.toast(text, 3200);
    await this.ui.fade(1, 0.5);
    this.player.place(x, z, yaw);
    await new Promise((r) => setTimeout(r, 400));
    this.ui.fade(0, 0.6);
    this.unlock();
    this.caughtBusy = false;
  }

  // ---------- laço principal ----------
  tick() {
    const now = performance.now(), dt = this.auto ? 0.2 : Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const inp = this.input, ui = this.ui;
    inp.update();
    this.xr.update();
    if (inp.actions.has('any') && this.state === 'title' && !$('title').classList.contains('ready')) { this.audio.init(); this.audio.setScene('title'); $('title').classList.add('ready'); inp.actions.delete('interact'); inp.actions.delete('click'); }
    if (inp.take('pause')) {
      if (this.state === 'play' || this.state === 'paused') this.togglePause();
      else if (this.state === 'title' && ui.screen && ui.screen !== 'title') this.menu('back');
    }
    if (inp.take('back') && this.state === 'title' && ui.screen !== 'title') this.menu('back');
    const paused = this.state === 'paused';
    if (!paused) { this.time += dt; timeU.value = this.time; }
    if (!paused && this.timers.length) {
      const due = this.timers.filter((t) => t.t <= this.time);
      this.timers = this.timers.filter((t) => t.t > this.time);
      due.forEach((t) => t.res());
    }
    if (!paused && ui.modal) {
      if (inp.take('interact') || inp.take('click')) ui.advance();
      for (let k = 1; k <= 4; k++) if (inp.take('c' + k)) ui.pickChoice(k - 1);
    }
    const W = this.world;
    if (W && !paused) {
      if (this.state === 'play') this.player.update(dt);
      for (const n of [...W.npcs]) n.update(dt);
      W.update(dt, this.time);
      if (this.state === 'play') {
        this.updateInteract(dt);
        for (const tr of [...this.triggers]) if (Math.hypot(tr.pos.x - this.player.pos.x, tr.pos.z - this.player.pos.z) < tr.r) { this.triggers.splice(this.triggers.indexOf(tr), 1); tr.res(); }
      }
      if (this.palAnim) {
        const a = this.palAnim;
        a.t += dt / a.dur;
        const k = Math.min(1, a.t), e = k * k * (3 - 2 * k);
        this.engine.applyPalette(mixPal(a.from, a.to, e, this._mp || (this._mp = mixPal(a.from, a.to, 0))));
        if (k >= 1) { this.palAnim = null; this.engine.applyPalette(a.to); }
      }
    }
    // câmera
    if (!this.xr.presenting) {
      if (this.state === 'title' || this.state === 'boot') this.updateTitleCam(dt);
      else if (this.player.char) this.player.updateCamera(dt, !ui.modal && !paused);
    }
    // guia e farol do objetivo
    const tp = this.state === 'play' && !ui.modal ? this.objPos() : null;
    this.guide.update(dt, this.player.pos, W, tp);
    const bu = this.beacon.material.uniforms.uOpacity;
    if (tp && W) { this.beacon.position.set(tp.x, W.groundAt(tp.x, tp.z), tp.z); }
    const bd = tp ? Math.hypot(tp.x - this.player.pos.x, tp.z - this.player.pos.z) : 0;
    bu.value += ((tp && bd > 7 ? Math.min(1, (bd - 7) / 10) : 0) - bu.value) * Math.min(1, dt * 3);
    this.beacon.visible = bu.value > 0.01;
    // áudio posicional simples
    if (W && this.audio.ctx) {
      const p = this.state === 'title' ? this.hubSpot || this.player.pos : this.player.pos;
      let fd = 99;
      for (const f of W.fires) fd = Math.min(fd, Math.hypot(f.x - p.x, f.z - p.z));
      const st = { river: Math.abs(p.z - riverZ(p.x)), fire: fd, guide: null };
      if (W.drumSource && this.state === 'play') {
        const s = W.drumSource, dx = s.x - p.x, dz = s.z - p.z, d = Math.hypot(dx, dz);
        const yaw = this.xr.presenting ? this.xr.headYaw() : this.player.camYaw;
        const rel = Math.atan2(dx, dz) - yaw;
        st.guide = { pan: Math.max(-1, Math.min(1, -Math.sin(rel))) * 0.85, gain: Math.max(0.12, Math.min(1, 14 / (d + 4))) };
      }
      this.audio.update(st);
    }
    ui.update(dt);
    const focus = this.state === 'title' || !this.player.char ? this.hubSpot || this.player.pos : this.player.pos;
    this.engine.render(dt, focus);
    inp.endFrame();
    // modo exposição: volta ao menu após inatividade longa
    if (this.state === 'play' && !this.xr.presenting && !this.auto) {
      const idle = (now - inp.lastActive) / 1000;
      if (idle > 150 && !this.idleWarned) { this.idleWarned = true; this.ui.toast('Ainda está aí? Sem interação, o jogo volta ao menu em instantes.', 6000); }
      if (idle < 150) this.idleWarned = false;
      if (idle > 180) { inp.lastActive = now; this.toTitle(); }
    }
  }

  updateInteract(dt) {
    const p = this.player.pos, t = this.time;
    let best = null, bd = 1e9;
    for (const it of this.inter) {
      const q = this.objPos(it.target);
      if (!q) continue;
      if (it.marker) {
        const gy = this.world.groundAt(q.x, q.z);
        it.marker.position.set(q.x, gy, q.z);
        it.diamond.position.y = (q.y - gy > 0.5 ? q.y - gy : 0) + it.h + Math.sin(t * 2.4) * 0.12;
        it.diamond.rotation.y = t * 1.6;
        it.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
      }
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < it.r && d < bd && !this.busy) { bd = d; best = it; }
    }
    const lp = best ? _v.copy(best.marker ? best.marker.position : this.objPos(best.target)).setY((best.marker ? best.marker.position.y : 0) + best.h + 0.3) : null;
    this.ui.prompt(best && !this.ui.modal ? best.label : null, lp);
    if (best && !this.ui.modal && (this.input.take('interact') || this.input.take('click'))) { this.audio.sfx('ui'); best.onUse(); }
  }

  // Câmera da tela-título: órbita lenta ao redor dos quatro protagonistas.
  updateTitleCam(dt) {
    const C = this.hubCenter;
    if (!C) return;
    const cam = this.engine.camera, tc = this.titleCam, yaw = this.hubYaw, t = this.time;
    const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), r = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const pos = new THREE.Vector3(), look = new THREE.Vector3();
    const prev = this.previewId && this.hubChars?.[this.previewId];
    if (prev) {
      const q = prev.pos;
      pos.copy(q).addScaledVector(f, 2.7).addScaledVector(r, -0.35); pos.y = q.y + 1.6;
      look.copy(q).addScaledVector(r, 0.25); look.y = q.y + 1.38;
    } else {
      const a = Math.sin(t * 0.045) * 0.75 - 0.15;
      const dir = f.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      pos.copy(C).addScaledVector(dir, 6.6); pos.y = C.y + 1.6 + Math.sin(t * 0.07) * 0.2;
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      look.copy(C).addScaledVector(side, innerWidth > innerHeight ? 1.6 : 0); look.y = C.y + 1.25;
    }
    if (!tc.init) { tc.pos.copy(pos); tc.look.copy(look); tc.init = true; }
    const k = 1 - Math.exp(-dt * (prev ? 2.5 : 1.2));
    tc.pos.lerp(pos, k); tc.look.lerp(look, k);
    cam.position.copy(tc.pos);
    cam.lookAt(tc.look);
  }
}
