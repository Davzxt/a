// Entrada unificada: teclado, mouse, toque (joystick virtual) e gamepad.
export class Input {
  constructor(G) {
    this.G = G;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.look = { dx: 0, dy: 0 };
    this.zoom = 0;
    this.run = false;
    this.actions = new Set();
    this.lastActive = performance.now();
    this.touch = { id: null, x0: 0, y0: 0, x: 0, y: 0, look: null, lx: 0, ly: 0 };
    this.stickV = { x: 0, y: 0 };
    this.gpPrev = [];
    this.isTouch = matchMedia('(pointer: coarse)').matches;
    const act = { KeyE: 'interact', Space: 'interact', Enter: 'interact', NumpadEnter: 'interact', Escape: 'pause', KeyP: 'pause', Digit1: 'c1', Digit2: 'c2', Digit3: 'c3', Digit4: 'c4' };
    addEventListener('keydown', (e) => {
      this.lastActive = performance.now();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && e.target === document.body) e.preventDefault();
      if (!e.repeat && act[e.code]) this.actions.add(act[e.code]);
      if (!e.repeat) this.actions.add('any');
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    const cv = G.engine.renderer.domElement;
    cv.style.touchAction = 'none';
    let drag = null;
    cv.addEventListener('pointerdown', (e) => {
      this.lastActive = performance.now();
      this.actions.add('any');
      if (e.pointerType === 'touch') return this.touchStart(e);
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return this.touchMove(e);
      if (!drag) return;
      this.look.dx += e.clientX - drag.x; this.look.dy += e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
    });
    const up = (e) => {
      if (e.pointerType === 'touch') return this.touchEnd(e);
      if (drag && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6 && performance.now() - drag.t < 400) this.actions.add('click');
      drag = null;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => { this.zoom += e.deltaY; e.preventDefault(); }, { passive: false });
    // joystick virtual
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    this.stickEl = stick; this.knob = knob;
    document.getElementById('btn-act').addEventListener('pointerdown', (e) => { e.preventDefault(); this.actions.add('interact'); this.lastActive = performance.now(); });
  }

  touchStart(e) {
    const t = this.touch;
    if (e.clientX < innerWidth * 0.45 && t.id === null) {
      t.id = e.pointerId; t.x0 = t.x = e.clientX; t.y0 = t.y = e.clientY;
      this.stickEl.style.left = `${e.clientX - 60}px`; this.stickEl.style.top = `${e.clientY - 60}px`;
      this.stickEl.classList.add('on');
    } else if (t.look === null) { t.look = e.pointerId; t.lx = e.clientX; t.ly = e.clientY; t.tap = { x: e.clientX, y: e.clientY, t: performance.now() }; }
  }
  touchMove(e) {
    const t = this.touch;
    if (e.pointerId === t.id) {
      t.x = e.clientX; t.y = e.clientY;
      let dx = (t.x - t.x0) / 50, dy = (t.y - t.y0) / 50;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      this.stickV.x = dx; this.stickV.y = -dy;
      this.knob.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
    } else if (e.pointerId === t.look) {
      this.look.dx += (e.clientX - t.lx) * 1.4; this.look.dy += (e.clientY - t.ly) * 1.4;
      t.lx = e.clientX; t.ly = e.clientY;
    }
  }
  touchEnd(e) {
    const t = this.touch;
    if (e.pointerId === t.id) { t.id = null; this.stickV.x = this.stickV.y = 0; this.knob.style.transform = ''; this.stickEl.classList.remove('on'); }
    if (e.pointerId === t.look) {
      if (t.tap && Math.hypot(e.clientX - t.tap.x, e.clientY - t.tap.y) < 10 && performance.now() - t.tap.t < 350) this.actions.add('click');
      t.look = null;
    }
  }

  update() {
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    x += this.stickV.x; y += this.stickV.y;
    this.run = k.has('ShiftLeft') || k.has('ShiftRight') || Math.hypot(this.stickV.x, this.stickV.y) > 0.95;
    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp || gp.mapping !== 'standard') continue;
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      x += dz(gp.axes[0]); y -= dz(gp.axes[1]);
      this.look.dx += dz(gp.axes[2]) * 14; this.look.dy += dz(gp.axes[3]) * 10;
      const b = gp.buttons.map((bt) => bt.pressed), prev = this.gpPrev[gp.index] || [];
      const edge = (i) => b[i] && !prev[i];
      if (edge(0)) this.actions.add('interact');
      if (edge(9) || edge(1)) this.actions.add(edge(9) ? 'pause' : 'back');
      if (b.some((v, i) => v && !prev[i])) { this.actions.add('any'); this.lastActive = performance.now(); }
      if (b[6] || b[7] || b[10]) this.run = true;
      if (Math.abs(gp.axes[0]) + Math.abs(gp.axes[1]) > 0.3) this.lastActive = performance.now();
      this.gpPrev[gp.index] = b;
    }
    if (x || y) this.lastActive = performance.now();
    this.move.x = Math.max(-1, Math.min(1, x));
    this.move.y = Math.max(-1, Math.min(1, y));
  }
  take(a) { if (this.actions.has(a)) { this.actions.delete(a); return true; } return false; }
  endFrame() { this.actions.clear(); this.look.dx = this.look.dy = 0; this.zoom = 0; }
}
