// Realidade virtual (WebXR): sessão, controles com laser, locomoção suave e giro por etapas.
import * as THREE from 'three';

const _q = new THREE.Quaternion(), _f = new THREE.Vector3(), _m = new THREE.Matrix4();

export class XR {
  constructor(G) {
    this.G = G;
    this.presenting = false;
    this.supported = false;
    this.turnReady = true;
    this.prevBtn = {};
    const r = G.engine.renderer, rig = G.engine.rig;
    if (navigator.xr?.isSessionSupported) {
      navigator.xr.isSessionSupported('immersive-vr').then((ok) => { this.supported = ok; G.ui.setVR(ok); }).catch(() => {});
    }
    this.ray = new THREE.Raycaster();
    this.controllers = [0, 1].map((i) => {
      const c = r.xr.getController(i);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
        new THREE.LineBasicMaterial({ color: '#ffd98a', transparent: true, opacity: 0.8 }));
      line.scale.z = 4;
      c.add(line);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff4cc' }));
      dot.visible = false;
      c.add(dot);
      c.userData = { line, dot };
      c.addEventListener('connected', (e) => { c.userData.src = e.data; });
      c.addEventListener('disconnected', () => { c.userData.src = null; });
      c.addEventListener('selectstart', () => this.select(c));
      rig.add(c);
      const grip = r.xr.getControllerGrip(i);
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.09, 3, 8), new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.5 }));
      body.rotation.x = Math.PI / 2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#e3b964').multiplyScalar(1.5) }));
      ring.position.z = -0.06;
      grip.add(body, ring);
      rig.add(grip);
      c.userData.grip = grip;
      return c;
    });
    r.xr.addEventListener('sessionstart', () => { this.presenting = true; G.onXR(true); });
    r.xr.addEventListener('sessionend', () => { this.presenting = false; this.session = null; G.onXR(false); });
  }

  async enter() {
    if (!navigator.xr) return;
    try {
      const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      this.session = s;
      const r = this.G.engine.renderer;
      r.xr.setFoveation?.(0.6);
      await r.xr.setSession(s);
    } catch (e) { console.warn('VR indisponível', e); this.G.ui.toast('Não foi possível iniciar a realidade virtual neste dispositivo.'); }
  }
  exit() { this.session?.end(); }

  headPos(out) { return this.G.engine.vrCam.getWorldPosition(out); }
  headYaw() {
    this.G.engine.vrCam.getWorldQuaternion(_q);
    _f.set(0, 0, -1).applyQuaternion(_q);
    return Math.atan2(_f.x, _f.z);
  }
  rotateAroundHead(da) {
    const rig = this.G.engine.rig, before = this.headPos(new THREE.Vector3());
    rig.rotation.y += da;
    rig.updateMatrixWorld(true);
    const after = this.headPos(new THREE.Vector3());
    rig.position.x += before.x - after.x;
    rig.position.z += before.z - after.z;
  }

  select(c) {
    if (!this.presenting) return;
    this.G.input.lastActive = performance.now();
    if (!this.G.ui.vr.click(this.rayFrom(c))) this.G.input.actions.add('interact');
  }
  rayFrom(c) {
    _m.identity().extractRotation(c.matrixWorld);
    this.ray.ray.origin.setFromMatrixPosition(c.matrixWorld);
    this.ray.ray.direction.set(0, 0, -1).applyMatrix4(_m);
    return this.ray;
  }

  update() {
    if (!this.presenting || !this.session) return;
    const inp = this.G.input;
    let mx = 0, my = 0, turn = 0;
    for (const src of this.session.inputSources) {
      const gp = src.gamepad;
      if (!gp) continue;
      const ax = gp.axes, x = ax.length > 2 ? ax[2] : ax[0] || 0, y = ax.length > 3 ? ax[3] : ax[1] || 0;
      if (src.handedness === 'left') { mx = x; my = -y; } else turn = x;
      const id = src.handedness, prev = this.prevBtn[id] || [];
      const b = gp.buttons.map((bt) => bt.pressed);
      if (b[4] && !prev[4]) inp.actions.add('interact');
      if (b[5] && !prev[5]) inp.actions.add('pause');
      if (b.some((v) => v)) inp.lastActive = performance.now();
      this.prevBtn[id] = b;
    }
    const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
    inp.move.x = dz(mx); inp.move.y = dz(my);
    if (Math.abs(turn) > 0.7 && this.turnReady) { this.rotateAroundHead(-Math.sign(turn) * Math.PI / 6); this.turnReady = false; }
    if (Math.abs(turn) < 0.3) this.turnReady = true;
    // laser: mostra o ponto de mira nos painéis
    for (const c of this.controllers) {
      const hit = this.G.ui.vr.hover(this.rayFrom(c));
      c.userData.line.scale.z = hit ? hit.distance : 4;
      c.userData.dot.visible = !!hit;
      if (hit) c.userData.dot.position.set(0, 0, -hit.distance);
    }
  }
}
