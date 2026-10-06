// Jogador: movimento em 3ª pessoa (desktop/toque) ou 1ª pessoa (VR) e câmera cinematográfica.
import * as THREE from 'three';
import { angLerp, clamp } from './noise.js';
import { WATER_Y } from '../world/terrain.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Player {
  constructor(G) {
    this.G = G;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.locked = true;
    this.char = null;
    this.camYaw = 0; this.camPitch = 0.3; this.camDist = 5.4;
    this.camPos = new THREE.Vector3(0, 5, 10);
    this.camLook = new THREE.Vector3();
    this.focus = null; this.shotData = null;
    this.idleLook = 0; this.stepPhase = 0;
  }

  setChar(c) {
    if (this.char) this.char.root.removeFromParent();
    this.char = c;
    if (c) this.G.engine.scene.add(c.root);
  }

  place(x, z, yaw = 0) {
    const W = this.G.world;
    this.pos.set(x, W.groundAt(x, z), z);
    this.yaw = yaw; this.camYaw = yaw; this.vel.set(0, 0, 0);
    this.snapCam();
    const xr = this.G.xr;
    if (xr.presenting) {
      const rig = this.G.engine.rig, head = xr.headPos(_v);
      rig.position.x += x - head.x; rig.position.z += z - head.z; rig.position.y = this.pos.y;
      const dy = yaw - xr.headYaw();
      xr.rotateAroundHead(dy);
    }
    this.sync(0);
  }

  snapCam() {
    const p = this.pos;
    this.camLook.set(p.x, p.y + 1.45, p.z);
    this.camPos.set(p.x - Math.sin(this.camYaw) * this.camDist * Math.cos(this.camPitch), p.y + 1.45 + Math.sin(this.camPitch) * this.camDist, p.z - Math.cos(this.camYaw) * this.camDist * Math.cos(this.camPitch));
  }

  head(out) { return this.G.xr.presenting ? this.G.xr.headPos(out) : out.set(this.pos.x, this.pos.y + 1.55 * (this.char?.spec.scale || 1), this.pos.z); }

  update(dt) {
    const G = this.G, W = G.world, inp = G.input, xr = G.xr.presenting;
    if (!W) return;
    let mx = this.locked ? 0 : inp.move.x, my = this.locked ? 0 : inp.move.y;
    const len = Math.min(1, Math.hypot(mx, my));
    const base = xr ? G.xr.headYaw() : this.camYaw;
    const fx = Math.sin(base), fz = Math.cos(base), rx = -Math.cos(base), rz = Math.sin(base);
    let dx = fx * my + rx * mx, dz = fz * my + rz * mx;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    const inWater = this.pos.y < WATER_Y - 0.2;
    const sp = (xr ? 2.4 : inp.run ? 6.0 : 3.3) * (inWater ? 0.55 : 1) * (this.char?.carrying ? 0.85 : 1);
    const tv = _v.set(dx * sp * len, 0, dz * sp * len);
    this.vel.lerp(tv, 1 - Math.exp(-dt * (len > 0.05 ? 9 : 12)));
    if (xr) {
      // em VR o "corpo" é a cabeça do usuário: move o rig e resolve colisões pela cabeça
      const rig = G.engine.rig, head = G.xr.headPos(_w);
      const old = { x: head.x, z: head.z };
      head.x += this.vel.x * dt; head.z += this.vel.z * dt;
      W.collide(head, 0.3);
      rig.position.x += head.x - old.x; rig.position.z += head.z - old.z;
      const gy = W.groundAt(head.x, head.z);
      rig.position.y += (gy - rig.position.y) * (1 - Math.exp(-dt * 10));
      this.pos.set(head.x, gy, head.z);
      this.yaw = G.xr.headYaw();
      if (this.char) this.char.root.visible = false;
      this.speed = Math.hypot(this.vel.x, this.vel.z);
    } else {
      const ox = this.pos.x, oz = this.pos.z;
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      const hitBounds = W.collide(this.pos, 0.33);
      if (hitBounds && len > 0.1) G.boundsHint();
      this.pos.y = W.groundAt(this.pos.x, this.pos.z);
      this.speed = Math.hypot(this.pos.x - ox, this.pos.z - oz) / Math.max(dt, 1e-4);
      if (len > 0.1) this.yaw = angLerp(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 11));
      if (this.char) this.char.root.visible = true;
    }
    this.sync(dt);
    // passos
    if (this.speed > 0.4) {
      this.stepPhase += dt * (1.6 + this.speed * 0.55);
      if (this.stepPhase > 1) { this.stepPhase -= 1; G.audio.step(inWater, this.speed > 4.5); }
    }
  }

  sync(dt) {
    const c = this.char;
    if (!c) return;
    c.root.position.copy(this.pos);
    c.root.rotation.y = this.yaw;
    c.moveSpeed = this.speed || 0;
    if (c.carrying && c.anim !== 'carry') c.anim = 'carry';
    if (!c.carrying && c.anim === 'carry') c.anim = 'idle';
    c.update(dt, this.G.time);
  }

  // Plano de diálogo: enquadra jogador e interlocutor.
  setFocus(npc) { this.focus = npc; }

  // Movimento de câmera cinematográfico (desktop).
  shot(from, to, lookFrom, lookTo, dur) {
    return new Promise((res) => { this.shotData = { from, to, lookFrom, lookTo, dur, t: 0, res }; });
  }
  endShot() { if (this.shotData) { this.shotData.res(); this.shotData = null; } }

  updateCamera(dt, inputOn = true) {
    const G = this.G, cam = G.engine.camera, inp = G.input, W = G.world;
    if (this.shotData) {
      const s = this.shotData;
      s.t += dt / s.dur;
      const k = ease(Math.min(1, s.t));
      this.camPos.lerpVectors(s.from, s.to, k);
      this.camLook.lerpVectors(s.lookFrom, s.lookTo, k);
      cam.position.copy(this.camPos); cam.lookAt(this.camLook);
      if (s.t >= 1) this.endShot();
      return;
    }
    const p = this.pos;
    if (inputOn) {
      this.camYaw -= inp.look.dx * 0.0045;
      this.camPitch = clamp(this.camPitch + inp.look.dy * 0.003, -0.12, 1.15);
      this.camDist = clamp(this.camDist * (1 + inp.zoom * 0.0008), 2.6, 11);
      if (Math.abs(inp.look.dx) + Math.abs(inp.look.dy) > 0) this.idleLook = 0; else this.idleLook += dt;
      // a câmera acompanha suavemente a direção do personagem quando ele anda
      if (this.idleLook > 1.2 && this.speed > 0.5) {
        let d = this.yaw - this.camYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) < 1.9) this.camYaw += d * (1 - Math.exp(-dt * 0.9));
      }
    }
    const look = _w.set(p.x, p.y + 1.45, p.z), want = _v;
    if (this.focus) {
      const n = this.focus.pos, mid = look.clone().lerp(_v.set(n.x, n.y + 1.45, n.z), 0.5);
      const d = new THREE.Vector3(n.x - p.x, 0, n.z - p.z), len = d.length() || 1;
      d.divideScalar(len);
      const side = new THREE.Vector3(-d.z, 0, d.x);
      if (side.dot(_v.copy(this.camPos).sub(mid)) < 0) side.negate();
      want.copy(mid).addScaledVector(side, 2.2 + len * 0.5).addScaledVector(d, -1.2 - len * 0.3);
      want.y = mid.y + 0.35;
      look.copy(mid).lerp(new THREE.Vector3(n.x, n.y + 1.5, n.z), 0.45);
    } else {
      const cp = Math.cos(this.camPitch);
      want.set(p.x - Math.sin(this.camYaw) * this.camDist * cp, p.y + 1.45 + Math.sin(this.camPitch) * this.camDist, p.z - Math.cos(this.camYaw) * this.camDist * cp);
    }
    // evita que a câmera atravesse construções
    if (W && W.boxes.length) {
      const sx = want.x - look.x, sz = want.z - look.z;
      for (let i = 1; i <= 12; i++) {
        const k = i / 12, x = look.x + sx * k, z = look.z + sz * k;
        let hit = false;
        for (const b of W.boxes) {
          const dx = x - b.x, dz = z - b.z, lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
          if (Math.abs(lx) < b.hx + 0.4 && Math.abs(lz) < b.hz + 0.4) { hit = true; break; }
        }
        if (hit) { const kk = Math.max(0.15, (i - 1) / 12); want.set(look.x + sx * kk, look.y + (want.y - look.y) * kk, look.z + sz * kk); break; }
      }
    }
    const g = W ? W.groundAt(want.x, want.z) + 0.6 : -1e9;
    if (want.y < g) want.y = g;
    const f = 1 - Math.exp(-dt * (this.focus ? 3.5 : 9));
    this.camPos.lerp(want, f);
    this.camLook.lerp(look, f);
    cam.position.copy(this.camPos);
    cam.lookAt(this.camLook);
  }
}
