// Ruído determinístico (simplex 2D), aleatório com semente e utilitários matemáticos.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
const GR = [1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1];

export function makeSimplex(seed = 1) {
  const r = rng(seed), p = new Uint8Array(256), perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const corner = (g, x, y) => { let t = 0.5 - x * x - y * y; if (t < 0) return 0; t *= t; g = (g & 7) * 2; return t * t * (GR[g] * x + GR[g + 1] * y); };
  return (x, y) => {
    const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const ii = i & 255, jj = j & 255;
    return 70 * (corner(perm[ii + perm[jj]], x0, y0)
      + corner(perm[ii + i1 + perm[jj + j1]], x0 - i1 + G2, y0 - j1 + G2)
      + corner(perm[ii + 1 + perm[jj + 1]], x0 - 1 + 2 * G2, y0 - 1 + 2 * G2));
  };
}

export const noise2 = makeSimplex(1977);
export function fbm(x, y, oct = 4) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const angLerp = (a, b, t) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, l = vx * vx + vz * vz;
  const t = l ? clamp(((px - ax) * vx + (pz - az) * vz) / l, 0, 1) : 0;
  return { d: Math.hypot(px - ax - vx * t, pz - az - vz * t), t };
}
