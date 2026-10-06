// Interface: telas HTML (desktop/toque) e painéis 3D equivalentes para a realidade virtual.
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const FONT_T = 'Cinzel, Georgia, serif', FONT_B = 'Nunito, system-ui, sans-serif';

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
    }
    out.push(line);
  }
  return out;
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

class Panel {
  constructor(wm, hm, px) {
    this.cv = document.createElement('canvas');
    this.cv.width = px; this.cv.height = Math.round((px * hm) / wm);
    this.ctx = this.cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(wm, hm), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
    this.mesh.renderOrder = 1000; this.mesh.visible = false; this.mesh.frustumCulled = false;
    this.buttons = []; this.hoverI = -1; this.spec = null;
  }
  draw(spec = this.spec) {
    this.spec = spec;
    const c = this.ctx, W = this.cv.width, H = this.cv.height, paper = spec.paper;
    c.clearRect(0, 0, W, H);
    rr(c, 6, 6, W - 12, H - 12, 28);
    c.fillStyle = paper ? 'rgba(242,230,203,0.97)' : 'rgba(18,13,10,0.9)'; c.fill();
    c.lineWidth = 4; c.strokeStyle = spec.titleColor || '#e3b964'; c.stroke();
    let y = 54;
    const ink = paper ? '#2b2017' : '#f4ead8';
    c.textAlign = spec.center ? 'center' : 'left'; c.textBaseline = 'alphabetic';
    const x0 = spec.center ? W / 2 : 50;
    if (spec.kicker) { c.font = `700 24px ${FONT_B}`; c.fillStyle = paper ? '#8a5a2a' : '#e3b964'; c.fillText(spec.kicker.toUpperCase(), x0, y); y += 44; }
    if (spec.title) { c.font = `700 ${spec.big ? 64 : 44}px ${FONT_T}`; c.fillStyle = paper ? '#3a2416' : spec.titleColor || '#f4ead8'; for (const l of wrap(c, spec.title, W - 100)) { c.fillText(l, x0, y); y += spec.big ? 70 : 52; } y += 6; }
    if (spec.body) {
      let size = spec.small ? 26 : 34;
      const lines = () => { c.font = `${spec.italic ? 'italic ' : ''}${spec.small ? 400 : 500} ${size}px ${FONT_B}`; return wrap(c, spec.body, W - 100); };
      let L = lines();
      while (L.length * size * 1.35 > H - y - (spec.buttons ? 90 * Math.ceil(spec.buttons.length / (spec.cols || 1)) : 60) && size > 18) { size -= 2; L = lines(); }
      c.fillStyle = ink;
      for (const l of L) { c.fillText(l, x0, y); y += size * 1.35; }
    }
    if (spec.source) { c.font = `italic 400 20px ${FONT_B}`; c.fillStyle = paper ? '#6a5040' : '#bfae94'; for (const l of wrap(c, spec.source, W - 100)) { y += 4; c.fillText(l, x0, y); y += 26; } }
    this.buttons = [];
    if (spec.buttons) {
      const cols = spec.cols || 1, bw = (W - 100 - (cols - 1) * 16) / cols, bh = 64;
      let by = Math.max(y + 10, H - 30 - Math.ceil(spec.buttons.length / cols) * (bh + 12));
      spec.buttons.forEach((b, i) => {
        const bx = 50 + (i % cols) * (bw + 16), yy = by + Math.floor(i / cols) * (bh + 12);
        rr(c, bx, yy, bw, bh, 14);
        c.fillStyle = i === this.hoverI ? '#e3b964' : paper ? 'rgba(60,40,25,0.12)' : 'rgba(255,255,255,0.08)'; c.fill();
        c.lineWidth = 2; c.strokeStyle = '#e3b964'; c.stroke();
        c.fillStyle = i === this.hoverI ? '#1a120c' : ink; c.font = `700 28px ${FONT_B}`; c.textAlign = 'center';
        c.fillText(b.label, bx + bw / 2, yy + 42);
        this.buttons.push({ x: bx, y: yy, w: bw, h: bh, id: b.id });
      });
      c.textAlign = 'left';
    }
    if (spec.hint) { c.font = `600 22px ${FONT_B}`; c.fillStyle = paper ? '#8a6a4a' : '#bfae94'; c.textAlign = 'right'; c.fillText(spec.hint, W - 40, H - 26); }
    if (spec.custom) spec.custom(c, W, H);
    this.tex.needsUpdate = true;
  }
  hit(ray) {
    if (!this.mesh.visible) return null;
    const h = ray.intersectObject(this.mesh, false)[0];
    if (!h) return null;
    const px = h.uv.x * this.cv.width, py = (1 - h.uv.y) * this.cv.height;
    h.button = this.buttons.findIndex((b) => px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.h);
    return h;
  }
}

class VRUI {
  constructor(G) {
    this.G = G;
    this.main = new Panel(1.5, 0.66, 1200);
    this.small = new Panel(0.9, 0.2, 900);
    this.obj = new Panel(0.7, 0.16, 800);
    const s = G.engine.scene;
    s.add(this.main.mesh, this.small.mesh, this.obj.mesh);
    this.fadeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), new THREE.MeshBasicMaterial({ color: '#000', side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
    this.fadeMesh.renderOrder = 2000;
    G.engine.vrCam.add(this.fadeMesh);
    this.objTimer = 0; this.onClick = null;
  }
  get on() { return this.G.xr.presenting; }
  placeFront(mesh, dist = 1.5, dy = -0.05, side = 0) {
    const G = this.G, head = G.xr.headPos(new THREE.Vector3()), yaw = G.xr.headYaw();
    mesh.position.set(head.x + Math.sin(yaw) * dist - Math.cos(yaw) * side, head.y + dy, head.z + Math.cos(yaw) * dist + Math.sin(yaw) * side);
    mesh.lookAt(head.x, head.y + dy, head.z);
  }
  show(spec, onClick) {
    this.onClick = onClick || null;
    this.main.hoverI = -1;
    this.main.draw(spec);
    if (!this.main.mesh.visible && this.on) this.placeFront(this.main.mesh);
    this.main.mesh.visible = this.on;
  }
  redraw() { if (this.main.mesh.visible) this.main.draw(); }
  hide() { this.main.mesh.visible = false; this.onClick = null; }
  menu(spec) { return new Promise((res) => this.show({ ...spec, center: true }, (id) => { this.hide(); res(id); })); }
  objective(text) {
    if (!text) { this.obj.mesh.visible = false; return; }
    this.obj.draw({ kicker: 'Objetivo', body: text, small: true });
    this.objTimer = 7;
  }
  prompt(text, pos) {
    const m = this.small.mesh;
    if (!text || !this.on) { m.visible = false; return; }
    if (this.small.spec?.body !== text) this.small.draw({ body: text, center: true, small: true });
    m.visible = true;
    m.position.copy(pos);
    m.position.y += 0.3;
    m.lookAt(this.G.xr.headPos(new THREE.Vector3()));
  }
  hover(ray) {
    const h = this.main.hit(ray);
    const i = h ? h.button : -1;
    if (i !== this.main.hoverI && this.main.spec?.buttons) { this.main.hoverI = i; this.main.draw(); }
    return h;
  }
  click(ray) {
    const h = this.main.hit(ray);
    if (!h) return false;
    if (h.button >= 0 && this.onClick) { this.G.audio.sfx('ui'); this.onClick(this.main.buttons[h.button].id); return true; }
    return !!this.main.spec?.buttons;
  }
  update(dt, fade) {
    this.fadeMesh.material.opacity = this.on ? fade : 0;
    this.fadeMesh.visible = this.on && fade > 0.001;
    if (!this.on) { this.main.mesh.visible = false; this.obj.mesh.visible = false; this.small.mesh.visible = false; return; }
    // painel principal segue o olhar com suavidade
    const m = this.main.mesh;
    if (m.visible) {
      const head = this.G.xr.headPos(new THREE.Vector3()), yaw = this.G.xr.headYaw();
      const pYaw = Math.atan2(m.position.x - head.x, m.position.z - head.z);
      let d = yaw - pYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) > 0.6 || m.position.distanceTo(head) > 2.5) {
        const tgt = new THREE.Object3D();
        this.placeFront(tgt);
        m.position.lerp(tgt.position, 1 - Math.exp(-dt * 3));
        m.lookAt(head);
      }
    }
    this.objTimer -= dt;
    const o = this.obj.mesh;
    o.visible = this.objTimer > 0 && !m.visible;
    if (o.visible) this.placeFront(o, 1.3, -0.42, 0);
  }
}

export class UI {
  constructor(G) {
    this.G = G;
    this.modal = null;
    this.fadeV = 0;
    this.vr = new VRUI(G);
    document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); G.audio.sfx('ui'); G.menu(b.dataset.act, b); }));
    $('dialog').addEventListener('click', () => this.advance());
    $('chapter-card').addEventListener('click', () => this.advance());
    $('rec-close').addEventListener('click', (e) => { e.stopPropagation(); this.advance(); });
    $('btn-pause').addEventListener('click', (e) => { e.stopPropagation(); G.togglePause(); });
    $('title').addEventListener('pointerdown', () => { G.input.actions.add('any'); G.input.lastActive = performance.now(); });
    $('opt-quality').value = G.engine.qName;
    $('opt-quality').addEventListener('change', (e) => { try { localStorage.setItem('cdm-quality', e.target.value); } catch (err) { /* ok */ } this.toast('A nova qualidade gráfica vale ao recarregar a página.'); });
    $('opt-volume').value = G.audio.vol.master;
    $('opt-music').value = G.audio.vol.music;
    $('opt-volume').addEventListener('input', (e) => G.audio.setVolume({ master: +e.target.value }));
    $('opt-music').addEventListener('input', (e) => G.audio.setVolume({ music: +e.target.value }));
    this.screen = null;
  }

  setVR(ok) { $('btn-vr').classList.toggle('hidden', !ok); }
  showScreen(id) {
    this.screen = id;
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('show', s.id === id));
  }
  hud(on) { $('hud').classList.toggle('show', on); $('touch').classList.toggle('show', on && this.G.input.isTouch); }
  chapterTag(t) { $('chapter-tag').textContent = t || ''; }
  cinema(on) { $('letterbox').classList.toggle('on', on); }

  objective(text) {
    const o = $('objective');
    o.classList.toggle('show', !!text);
    if (text) { $('objective-text').textContent = text; o.classList.remove('flash'); void o.offsetWidth; o.classList.add('flash'); }
    this.vr.objective(text);
  }
  prompt(text, pos) {
    const key = `${text}|${!!this.modal}`;
    if (key !== this._lp) {
      this._lp = key;
      const p = $('prompt');
      p.classList.toggle('show', !!text && !this.modal);
      if (text) {
        $('prompt-text').textContent = text;
        $('prompt-key').textContent = this.G.input.isTouch ? 'Toque ●' : 'E';
      }
      $('btn-act').classList.toggle('ready', !!text || !!this.modal);
    }
    this.vr.prompt(text && !this.modal ? `${text}  ·  Gatilho` : null, pos);
  }
  toast(text, ms = 3600) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    $('toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 600);
  }

  // ---- diálogo ----
  dialog({ name, color = '#e3b964', text, italic = false }) {
    return new Promise((res) => {
      this.modal = { type: 'dialog', res, text, shown: 0, name, color, italic, acc: 0 };
      const d = $('dialog');
      d.classList.add('show');
      d.classList.toggle('thought', italic);
      d.classList.remove('has-choices');
      $('dlg-name').textContent = name;
      $('dlg-name').style.color = color;
      $('dlg-text').textContent = '';
      $('dlg-choices').innerHTML = '';
      this.prompt(null);
      this.vr.show({ title: name, titleColor: color, body: '', italic, hint: 'Gatilho ▸' });
    });
  }
  choose(options, name = '', color = '#e3b964') {
    return new Promise((res) => {
      const d = $('dialog');
      d.classList.add('show', 'has-choices');
      $('dlg-name').textContent = name;
      $('dlg-name').style.color = color;
      $('dlg-text').textContent = '';
      const box = $('dlg-choices');
      box.innerHTML = '';
      const done = (i) => { this.modal = null; box.innerHTML = ''; d.classList.remove('has-choices'); this.vr.hide(); res(i); };
      options.forEach((o, i) => {
        const b = document.createElement('button');
        b.innerHTML = `<kbd>${i + 1}</kbd> ${o}`;
        b.addEventListener('click', (e) => { e.stopPropagation(); this.G.audio.sfx('ui'); done(i); });
        box.appendChild(b);
      });
      this.modal = { type: 'choice', n: options.length, done };
      this.vr.show({ title: name || 'Escolha', titleColor: color, buttons: options.map((label, i) => ({ label, id: i })) }, (i) => done(i));
    });
  }
  endDialog() { $('dialog').classList.remove('show'); this.vr.hide(); }

  // ---- registro histórico ----
  record(card) {
    return new Promise((res) => {
      $('rec-title').textContent = card.title;
      $('rec-kicker').textContent = card.kicker || 'Registro histórico';
      $('rec-body').innerHTML = card.body.split('\n').map((p) => `<p>${p}</p>`).join('');
      $('rec-source').textContent = card.source ? `Fonte: ${card.source}` : '';
      $('record').classList.add('show');
      this.modal = { type: 'record', res, t: 0 };
      this.G.audio.sfx('card');
      this.vr.show({ paper: true, kicker: card.kicker || 'Registro histórico', title: card.title, body: card.body.replace(/\n/g, ' '), source: card.source ? `Fonte: ${card.source}` : '', small: true, buttons: [{ label: 'Continuar', id: 'ok' }] }, () => this.advance(true));
    });
  }
  chapterCard({ kicker, title, sub, color = '#e3b964', dur = 5 }) {
    return new Promise((res) => {
      $('cc-kicker').textContent = kicker; $('cc-title').textContent = title; $('cc-sub').textContent = sub;
      $('chapter-card').style.setProperty('--accent', color);
      $('chapter-card').classList.add('show');
      this.modal = { type: 'chapter', res, t: 0, dur };
      this.G.audio.sfx('chapter');
      this.vr.show({ kicker, title, big: true, body: sub, center: true, titleColor: color });
    });
  }
  // modal personalizado (minijogo de ritmo)
  custom(m) { this.modal = { type: 'custom', ...m }; }

  advance(force = false) {
    const m = this.modal;
    if (!m) return;
    if (m.type === 'dialog') {
      if (m.shown < m.text.length) { m.shown = m.text.length; this.renderText(); return; }
      this.modal = null; m.res();
    } else if (m.type === 'record') {
      if (m.t < 0.6 && !force) return;
      $('record').classList.remove('show'); this.vr.hide(); this.modal = null; m.res();
    } else if (m.type === 'chapter') {
      if (m.t < 1.4) return;
      this.closeChapterCard();
    } else if (m.type === 'custom') m.hit?.();
  }
  closeChapterCard() { const m = this.modal; $('chapter-card').classList.remove('show'); this.vr.hide(); this.modal = null; m?.res?.(); }
  pickChoice(i) { if (this.modal?.type === 'choice' && i < this.modal.n) this.modal.done(i); }

  renderText() {
    const m = this.modal;
    const txt = m.text.slice(0, Math.floor(m.shown));
    $('dlg-text').textContent = txt;
    $('dialog').classList.toggle('done', m.shown >= m.text.length);
    if (this.vr.on) this.vr.show({ title: m.name, titleColor: m.color, body: txt, italic: m.italic, hint: m.shown >= m.text.length ? 'Gatilho ▸' : '' });
  }

  fade(to, dur = 0.8) {
    return new Promise((res) => {
      const f = $('fade');
      f.style.transition = `opacity ${dur}s ease`;
      f.style.opacity = to;
      this.fadeAnim = { from: this.fadeV, to, t: 0, dur };
      setTimeout(res, dur * 1000 + 30);
    });
  }

  update(dt) {
    const m = this.modal;
    if (m?.type === 'dialog' && m.shown < m.text.length) {
      m.shown = Math.min(m.text.length, m.shown + dt * 52);
      m.acc += dt;
      if (m.acc > 0.06 || m.shown >= m.text.length) { m.acc = 0; this.renderText(); }
    }
    if (m?.type === 'record') m.t += dt;
    if (m?.type === 'chapter') { m.t += dt; if (m.t > m.dur) this.closeChapterCard(); }
    if (m?.type === 'custom') m.update?.(dt);
    if (this.fadeAnim) {
      const a = this.fadeAnim;
      a.t += dt;
      this.fadeV = a.from + (a.to - a.from) * Math.min(1, a.t / a.dur);
      if (a.t >= a.dur) this.fadeAnim = null;
    }
    this.vr.update(dt, this.fadeV);
  }

  // ---- telas de menu ----
  renderChapters(list, done) {
    const box = $('chapter-cards');
    box.innerHTML = '';
    list.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'ch-card';
      b.style.setProperty('--accent', c.color);
      b.innerHTML = `<div class="ch-portrait" style="background-image:url(${c.portrait || ''})"></div>
        <div class="ch-info"><div class="ch-num">${c.num}${done.has(c.id) ? ' <span class="ch-done">✓ concluído</span>' : ''}</div>
        <div class="ch-name">${c.name}</div><div class="ch-people">${c.people}</div><div class="ch-era">${c.era}</div><p>${c.blurb}</p></div>`;
      b.addEventListener('mouseenter', () => this.G.previewChar(c.id));
      b.addEventListener('focus', () => this.G.previewChar(c.id));
      b.addEventListener('click', () => { this.G.audio.sfx('ui'); this.G.startChapter(c.id, false); });
      box.appendChild(b);
    });
  }
  renderArchive(cards, found) {
    const box = $('archive-list');
    box.innerHTML = '';
    for (const [id, c] of Object.entries(cards)) {
      const d = document.createElement('article');
      d.className = 'arc-item' + (found.has(id) ? ' found' : '');
      d.innerHTML = `<div class="arc-k">${found.has(id) ? '★ ' : ''}${c.kicker || 'Registro histórico'}</div><h3>${c.title}</h3>${c.body.split('\n').map((p) => `<p>${p}</p>`).join('')}<div class="arc-src">${c.source ? 'Fonte: ' + c.source : ''}</div>`;
      box.appendChild(d);
    }
  }
}
