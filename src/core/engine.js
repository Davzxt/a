// Motor gráfico: renderer, céu, neblina de altura, paletas de luz e pós-processamento.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const timeU = { value: 0 };
export const fogHP = { value: new THREE.Vector3(0, 0, 0.1) };

// --- Neblina estilizada (distância + altura), aplicada a todos os materiais ---
const C = THREE.ShaderChunk;
C.fog_pars_vertex = '#ifdef USE_FOG\nvarying float vFogDepth;\nvarying vec3 vFogW;\n#endif';
C.fog_vertex = `#ifdef USE_FOG
vFogDepth = - mvPosition.z;
vec4 fogW = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
fogW = instanceMatrix * fogW;
#endif
vFogW = ( modelMatrix * fogW ).xyz;
#endif`;
C.fog_pars_fragment = `#ifdef USE_FOG
uniform vec3 fogColor;
uniform vec3 fogHP;
varying float vFogDepth;
varying vec3 vFogW;
#ifdef FOG_EXP2
uniform float fogDensity;
#else
uniform float fogNear;
uniform float fogFar;
#endif
#endif`;
C.fog_fragment = `#ifdef USE_FOG
#ifdef FOG_EXP2
float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
#else
float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
#endif
float fogH = fogHP.x * exp( - max( vFogW.y - fogHP.y, 0.0 ) * fogHP.z ) * smoothstep( 1.0, 45.0, vFogDepth );
fogFactor = clamp( fogFactor + fogH * ( 1.0 - fogFactor ), 0.0, 1.0 );
gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;

// Luz "envolvente" (wrap): o terminador fica macio, como em animação estilizada.
C.lights_physical_pars_fragment = C.lights_physical_pars_fragment.replace(
  /float dotNL = saturate\( dot\( geometryNormal, directLight\.direction \) \);\s*vec3 irradiance = dotNL \* directLight\.color;/,
  'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n\tfloat wrapNL = saturate( ( dot( geometryNormal, directLight.direction ) + 0.32 ) / 1.32 );\n\tvec3 irradiance = wrapNL * wrapNL * ( 3.0 - 2.0 * wrapNL ) * directLight.color;')
  // o brilho especular continua usando o N·L real (e limitado): sem pontos estourados nas bordas
  .replace('reflectedLight.directSpecular += irradiance * specularBRDF', 'reflectedLight.directSpecular += ( dotNL * directLight.color ) * min( specularBRDF, vec3( 6.0 ) )');

// Sombras que se desvanecem perto da borda do mapa de sombra (sem "quadrado" escuro ao longe).
C.shadowmap_pars_fragment = C.shadowmap_pars_fragment.replace(
  /(float getShadow\( sampler2DShadow shadowMap[^{]*\{[\s\S]*?)return mix\( 1\.0, shadow, shadowIntensity \);/,
  '$1vec2 edgeD = abs( shadowCoord.xy * 2.0 - 1.0 );\n\t\t\treturn mix( 1.0, shadow, shadowIntensity * ( 1.0 - smoothstep( 0.72, 0.98, max( edgeD.x, edgeD.y ) ) ) );');

// Luz de recorte (rim) global: cor e força vêm da paleta do capítulo.
export const rimU = { value: new THREE.Color(0.3, 0.28, 0.25) };

// Injeta a neblina de altura, o recorte de luz e (opcional) o balanço do vento na vegetação.
export function patch(m, wind = 0, rim = 1) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.fogHP = fogHP;
    if (rim && sh.fragmentShader.includes('#include <lights_fragment_begin>')) {
      sh.uniforms.uRim = rimU;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
        .replace('#include <opaque_fragment>', `float rimF = pow( 1.0 - saturate( dot( normal, geometryViewDir ) ), 3.0 );
outgoingLight += uRim * ${(+rim).toFixed(2)} * rimF * ( 0.45 + 0.55 * saturate( normal.y * 0.5 + 0.5 ) ) * ( 0.6 + diffuseColor.rgb * 0.8 );
#include <opaque_fragment>`);
    }
    if (!wind) return;
    sh.uniforms.uTime = timeU;
    sh.uniforms.uWind = { value: wind };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 wOrg = vec3(0.0);
#ifdef USE_INSTANCING
wOrg = instanceMatrix[3].xyz;
#endif
float wK = max(position.y, 0.0) * uWind;
float wP = uTime * 1.7 + wOrg.x * 0.23 + wOrg.z * 0.19;
float gust = 0.75 + 0.25 * sin(uTime * 0.37 + wOrg.x * 0.02);
transformed.x += (sin(wP) + 0.4 * sin(wP * 2.7 + 1.3)) * wK * gust;
transformed.z += cos(wP * 0.83) * 0.6 * wK * gust;`);
  };
  m.customProgramCacheKey = () => 'cdm' + wind + '_' + rim;
  return m;
}

const matCache = new Map();
export function M(color, o = {}) {
  const key = color + JSON.stringify(o);
  let m = matCache.get(key);
  if (!m) {
    const { rim = 1, ...rest } = o;
    m = patch(new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...rest }), 0, rim);
    matCache.set(key, m);
  }
  return m;
}
// Material único com cores por vértice: construções e personagens viram poucas chamadas de desenho.
export function VCM(side = THREE.FrontSide, rough = 0.84) { return M('#ffffff', { vertexColors: true, side, roughness: rough }); }

// Material emissivo (janelas acesas, lampiões) — brilha com o bloom.
export function glow(color, k = 2.5) {
  const key = 'glow' + color + k;
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) }); patch(m); matCache.set(key, m); }
  return m;
}

// --- Paletas de iluminação (hora do dia de cada capítulo) ---
export function pal(d) {
  const c = (h) => new THREE.Color(h);
  const az = THREE.MathUtils.degToRad(d.sun[0]), el = THREE.MathUtils.degToRad(d.sun[1]);
  return {
    top: c(d.top), mid: c(d.mid), bottom: c(d.bottom || d.mid), sunCol: c(d.sunCol),
    sunDir: new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)),
    sunI: d.sunI ?? 3, hemiSky: c(d.hemi[0]), hemiGround: c(d.hemi[1]), hemiI: d.hemi[2] ?? 1,
    fog: c(d.fog), near: d.near ?? 40, far: d.far ?? 520, fogH: new THREE.Vector3(...(d.fogH || [0, 0, 0.1])),
    clouds: d.clouds ?? 0.5, stars: d.stars ?? 0, exposure: d.exposure ?? 1, bloom: d.bloom ?? 0.45,
    sat: d.sat ?? 1.1, contrast: d.contrast ?? 1.04, sepia: d.sepia ?? 0, vignette: d.vignette ?? 0.4,
    cloudLit: c(d.cloudLit || '#ffffff'), cloudShade: c(d.cloudShade || '#9aa6b8'), glow: d.glow ?? 1,
    sunSize: d.sunSize ?? 0.0016, deep: c(d.water?.[0] || '#1f4b55'), shallow: c(d.water?.[1] || '#4f8a7c'),
    rim: d.rim ? c(d.rim) : c(d.sunCol).lerp(c(d.hemi[0]), 0.5).multiplyScalar(d.rimK ?? 0.38),
    warm: c(d.warm || '#ffe2b0'), cool: c(d.cool || '#6a86b0'), split: d.split ?? 0.12,
  };
}
export function mixPal(a, b, t, out) {
  out = out || pal({ top: '#000', mid: '#000', sunCol: '#fff', sun: [0, 45], hemi: ['#fff', '#000'], fog: '#fff' });
  for (const k in a) {
    const va = a[k], vb = b[k];
    if (va.isColor) out[k].lerpColors(va, vb, t);
    else if (va.isVector3) out[k].lerpVectors(va, vb, t);
    else out[k] = va + (vb - va) * t;
  }
  out.sunDir.normalize();
  return out;
}

// --- Céu procedural: degradê, sol/lua, nuvens estilizadas e estrelas ---
function makeSky() {
  const uniforms = {
    uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() },
    uCloudLit: { value: new THREE.Color() }, uCloudShade: { value: new THREE.Color() },
    uTime: timeU, uClouds: { value: 0.5 }, uStars: { value: 0 }, uGlow: { value: 1 }, uSunSize: { value: 0.0016 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
uniform vec3 uTop, uMid, uBottom, uSunDir, uSunCol, uCloudLit, uCloudShade;
uniform float uTime, uClouds, uStars, uGlow, uSunSize;
varying vec3 vDir;
float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir); float y = d.y;
  vec3 col = mix(uMid, uTop, pow(smoothstep(0.0, 1.0, max(y, 0.0)), 0.55));
  col = mix(col, uBottom, smoothstep(0.0, -0.25, y));
  vec3 sd3 = normalize(uSunDir); float sd = max(dot(d, sd3), 0.0);
  col += uSunCol * (pow(sd, 5.0) * 0.22 + pow(sd, 42.0) * 0.55) * uGlow;
  float disc = smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.45, sd);
  col = mix(col, uSunCol * 5.0, disc);
  if (y > 0.0) {
    vec2 uv = d.xz / (y + 0.12);
    float n = fbm(uv * 0.85 + vec2(uTime * 0.005, uTime * 0.0018));
    float c = smoothstep(0.6 - uClouds * 0.26, 0.74 - uClouds * 0.26, n) * smoothstep(0.0, 0.2, y);
    float lit = clamp(0.45 + (n - 0.6) * 2.2 + sd * 0.7, 0.0, 1.0);
    col = mix(col, mix(uCloudShade, uCloudLit, lit), c * 0.92);
    vec3 q = floor(d * 330.0);
    float st = step(0.9968, h3(q)) * uStars * smoothstep(0.04, 0.35, y) * (1.0 - c);
    st *= 0.55 + 0.45 * sin(uTime * 2.3 + h3(q + 3.0) * 40.0);
    col += vec3(st) * 1.8;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), mat);
  sky.renderOrder = -1000;
  sky.frustumCulled = false;
  return sky;
}

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.1 }, uContrast: { value: 1.04 }, uSepia: { value: 0 }, uVig: { value: 0.4 }, uTime: { value: 0 }, uGrain: { value: 0.012 },
    uWarm: { value: new THREE.Color('#ffe2b0') }, uCool: { value: new THREE.Color('#6a86b0') }, uSplit: { value: 0.12 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat, uContrast, uSepia, uVig, uTime, uGrain, uSplit; uniform vec3 uWarm, uCool; varying vec2 vUv;
float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec4 tx = texture2D(tDiffuse, vUv); vec3 c = tx.rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, uSat), 0.0);
  c = pow(c, vec3(uContrast)) * pow(0.18, 1.0 - uContrast);
  c = mix(c, vec3(1.08, 0.93, 0.72) * l, uSepia);
  // tons divididos: sombras frias, luzes quentes (visual de animação)
  float sl = smoothstep(0.0, 0.6, l);
  c *= mix(mix(vec3(1.0), uCool * 1.25, uSplit * (1.0 - sl)), mix(vec3(1.0), uWarm * 1.08, uSplit), sl);
  vec2 d = vUv - 0.5; c *= clamp(1.0 - dot(d, d) * uVig * 2.2, 0.0, 1.0);
  c += (hh(vUv * 917.0 + fract(uTime) * 61.0) - 0.5) * uGrain * (0.25 + l);
  gl_FragColor = vec4(c, tx.a);
}`,
};

// detail: 1 = modelos completos; < 1 simplifica telhados, copas e capim.
export const QUALITY = {
  high: { pr: 2, shadow: 2048, shadowR: 46, shadowSoft: 3, grass: 26000, trees: 2300, seg: 240, bloom: true, detail: 1 },
  medium: { pr: 1.35, shadow: 1536, shadowR: 40, shadowSoft: 2.5, grass: 14000, trees: 1700, seg: 200, bloom: true, detail: 1 },
  low: { pr: 1, shadow: 0, shadowR: 0, shadowSoft: 0, grass: 5500, trees: 1100, seg: 150, bloom: false, detail: 0.5 },
};
export const DETAIL = { value: 1 };

export function detectQuality() {
  try { const saved = localStorage.getItem('cdm-quality'); if (saved && QUALITY[saved]) return saved; } catch (e) { /* sem storage */ }
  const ua = navigator.userAgent;
  if (/OculusBrowser|Quest|Pico|Android|iPhone|iPad|Mobile/i.test(ua)) return 'low';
  if ((navigator.hardwareConcurrency || 4) <= 4) return 'medium';
  return 'high';
}

const _f = new THREE.Vector3(), _q = new THREE.Vector3(), _o = new THREE.Vector3(), _o2 = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _mi = new THREE.Matrix4();

export class Engine {
  constructor(container, quality) {
    this.qName = quality;
    this.q = QUALITY[quality];
    DETAIL.value = this.q.detail;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.basePR = Math.min(devicePixelRatio || 1, this.q.pr);
    this.prScale = 1;
    r.setPixelRatio(this.basePR);
    r.setSize(innerWidth, innerHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = this.q.shadow > 0;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.xr.enabled = true;
    r.xr.setReferenceSpaceType('local-floor');
    container.appendChild(r.domElement);

    const s = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 2600);
    this.rig = new THREE.Group();
    this.vrCam = new THREE.PerspectiveCamera(70, 1, 0.05, 2600);
    this.rig.add(this.vrCam);
    s.add(this.rig);

    this.hemi = new THREE.HemisphereLight('#ffffff', '#444444', 1);
    this.sun = new THREE.DirectionalLight('#ffffff', 3);
    if (this.q.shadow) {
      this.sun.castShadow = true;
      const sc = this.sun.shadow;
      sc.mapSize.set(this.q.shadow, this.q.shadow);
      this.shadowR = this.q.shadowR;
      Object.assign(sc.camera, { left: -this.shadowR, right: this.shadowR, top: this.shadowR, bottom: -this.shadowR, near: 1, far: 400 });
      sc.bias = -0.0003;
      sc.normalBias = 0.06;
      sc.radius = this.q.shadowSoft;
      sc.intensity = 0.86;
    }
    s.add(this.hemi, this.sun, this.sun.target);
    s.fog = new THREE.Fog('#ffffff', 40, 500);
    this.sky = makeSky();
    s.add(this.sky);
    this.cur = null;

    if (this.q.bloom) {
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      const cp = this.composer = new EffectComposer(r, rt);
      cp.addPass(new RenderPass(s, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.55, 0.85);
      cp.addPass(this.bloom);
      this.grade = new ShaderPass(GradeShader);
      cp.addPass(this.grade);
      cp.addPass(new OutputPass());
    }
    this.resize();
    addEventListener('resize', () => this.resize());
    this.frames = 0; this.acc = 0;
  }

  resize() {
    const w = innerWidth, h = innerHeight, pr = this.basePR * this.prScale;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.renderer.xr.isPresenting) return;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); }
    this.onResize?.(h * pr / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))));
  }

  applyPalette(p) {
    this.cur = p;
    const u = this.sky.material.uniforms;
    u.uTop.value.copy(p.top); u.uMid.value.copy(p.mid); u.uBottom.value.copy(p.bottom);
    u.uSunDir.value.copy(p.sunDir); u.uSunCol.value.copy(p.sunCol);
    u.uCloudLit.value.copy(p.cloudLit); u.uCloudShade.value.copy(p.cloudShade);
    u.uClouds.value = p.clouds; u.uStars.value = p.stars; u.uGlow.value = p.glow; u.uSunSize.value = p.sunSize;
    this.sun.color.copy(p.sunCol); this.sun.intensity = p.sunI;
    this.hemi.color.copy(p.hemiSky); this.hemi.groundColor.copy(p.hemiGround); this.hemi.intensity = p.hemiI;
    this.scene.fog.color.copy(p.fog); this.scene.fog.near = p.near; this.scene.fog.far = p.far;
    fogHP.value.copy(p.fogH);
    this.renderer.toneMappingExposure = p.exposure;
    rimU.value.copy(p.rim);
    if (this.bloom) {
      this.bloom.strength = p.bloom;
      const g = this.grade.uniforms;
      g.uSat.value = p.sat; g.uContrast.value = p.contrast; g.uSepia.value = p.sepia; g.uVig.value = p.vignette;
      g.uWarm.value.copy(p.warm); g.uCool.value.copy(p.cool); g.uSplit.value = p.split;
    }
    if (this.water) {
      const w = this.water.uniforms;
      w.uDeep.value.copy(p.deep); w.uShallow.value.copy(p.shallow);
      w.uSky.value.copy(p.mid).lerp(p.top, 0.35); w.uSunCol.value.copy(p.sunCol); w.uSunDir.value.copy(p.sunDir);
      w.uSunI.value = Math.min(p.sunI, 3.5) * (p.sunDir.y > 0 ? 1 : 0.3);
    }
  }

  render(dt, focus) {
    // Sombra e céu acompanham o ponto de interesse (jogador)
    const sd = this.cur ? this.cur.sunDir : this.sun.position;
    const f = _f.copy(focus);
    if (this.shadowR) {
      // encaixa o centro da sombra na grade de texels: sem "tremido" ao andar
      const texel = (this.shadowR * 2) / this.q.shadow;
      _m.lookAt(_o.set(0, 0, 0), _o2.copy(sd).negate(), _up);
      _q.copy(f).applyMatrix4(_mi.copy(_m).transpose());
      _q.x = Math.round(_q.x / texel) * texel; _q.y = Math.round(_q.y / texel) * texel;
      f.copy(_q.applyMatrix4(_m));
    }
    this.sun.position.copy(f).addScaledVector(sd, 160);
    this.sun.target.position.copy(f);
    const xr = this.renderer.xr.isPresenting;
    this.sky.position.copy(xr ? this.rig.position : this.camera.position);
    if (xr) { this.renderer.render(this.scene, this.vrCam); return; }
    if (this.composer) { this.grade.uniforms.uTime.value += dt; this.composer.render(dt); }
    else this.renderer.render(this.scene, this.camera);
    // Resolução dinâmica para manter a fluidez em máquinas modestas
    this.acc += dt; this.frames++;
    if (this.acc > 2.5) {
      const fps = this.frames / this.acc; this.acc = 0; this.frames = 0;
      const old = this.prScale;
      if (fps < 38 && this.prScale > 0.6) this.prScale = Math.max(0.6, this.prScale - 0.12);
      else if (fps > 57 && this.prScale < 1) this.prScale = Math.min(1, this.prScale + 0.08);
      if (old !== this.prScale) this.resize();
    }
  }
}
