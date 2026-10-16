// Sky, sun, fog, clouds and post-processing. setTime(phase) moves from afternoon (0) to dusk (1).
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { cloudSprite } from './textures.js';
import { rand01 } from '../../sim/prng.js';

const FOG = { clear: 0.0009, cloudy: 0.0013, fog: 0.0055, rain: 0.0026, snow: 0.0032 };

export function buildEnvironment(renderer, scene, camera, { weather = 'clear', seed = 1, width, height, quality = 'high' }) {
  // Physical sky only feeds the environment map; the visible sky is a cheap gradient dome.
  const sky = new Sky();
  const su = sky.material.uniforms;
  const domeU = { zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(20000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: domeU,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunCol; uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        float h = max(vDir.y, 0.0);
        vec3 c = mix(horizon, zenith, pow(h, 0.55));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        c += sunCol * (pow(s, 600.0) * 4.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.12 * (1.0 - h));
        if (vDir.y < 0.0) c = horizon * 0.92;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);
  const overcast = weather !== 'clear';
  su.turbidity.value = overcast ? 9 : 3.2;
  su.rayleigh.value = weather === 'fog' ? 3.2 : overcast ? 2.2 : 2.1;
  su.mieCoefficient.value = 0.006;
  su.mieDirectionalG.value = 0.86;

  const sun = new THREE.DirectionalLight('#fff3df', 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 1500;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#bcd3ff', '#6a6648', 1.1);
  scene.add(hemi);

  const baseFog = FOG[weather] ?? FOG.clear;
  scene.fog = new THREE.FogExp2('#c9d6e3', baseFog);

  // environment map for reflections (water, metal) from the sky at golden hour
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(1000);
  Object.assign(envSky.material.uniforms.turbidity, { value: su.turbidity.value });
  envSky.material.uniforms.rayleigh.value = su.rayleigh.value;
  envSky.material.uniforms.sunPosition.value.set(0.6, 0.25, 0.7).normalize();
  envScene.add(envSky);
  scene.environment = pmrem.fromScene(envScene, 0, 1, 2000).texture;
  scene.environmentIntensity = 0.6;

  // clouds
  const nClouds = { clear: 10, cloudy: 46, fog: 20, rain: 60, snow: 50 }[weather] ?? 12;
  const cloudTex = cloudSprite(seed);
  const clouds = [];
  for (let i = 0; i < nClouds; i++) {
    const m = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: true, opacity: overcast ? 0.85 : 0.7 });
    const s = new THREE.Sprite(m);
    const a = rand01(seed, 'ca', i) * Math.PI * 2, r = 600 + rand01(seed, 'cr', i) * 2200;
    s.position.set(300 + Math.cos(a) * r, 260 + rand01(seed, 'ch', i) * 260, Math.sin(a) * r * 0.8 - 300);
    const sc = 500 + rand01(seed, 'cs', i) * 700;
    s.scale.set(sc, sc * 0.45, 1);
    s.userData.base = s.position.clone();
    clouds.push(s);
    scene.add(s);
  }

  // post-processing
  const rt = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: quality === 'high' ? 4 : 0 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(width / 2, height / 2), 0.32, 0.45, 0.88);
  composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, vignette: { value: 0.32 }, warmth: { value: 0.0 }, sat: { value: 0.96 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float vignette; uniform float warmth; uniform float sat; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
        c.rgb = mix(vec3(l), c.rgb, sat);
        c.rgb *= vec3(1.0 + warmth * 0.08, 1.0, 1.0 - warmth * 0.1);
        vec2 d = vUv - 0.5; d.x *= 0.75;
        c.rgb *= 1.0 - vignette * smoothstep(0.25, 0.75, length(d));
        gl_FragColor = c;
      }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  if (quality !== 'high') {
    const fxaa = new ShaderPass(FXAAShader);
    fxaa.material.uniforms.resolution.value.set(1 / width, 1 / height);
    composer.addPass(fxaa);
  }

  const sunDir = new THREE.Vector3();
  const fogDay = new THREE.Color(overcast ? '#b9c3cc' : '#c8d7e6'), fogDusk = new THREE.Color(overcast ? '#5e5a66' : '#b7876e');
  const sunDay = new THREE.Color('#fff1dc'), sunDusk = new THREE.Color('#ff9a52');
  const skyDay = new THREE.Color('#bcd3ff'), skyDusk = new THREE.Color('#6a6f9a');
  const dim = overcast ? 0.55 : 1;

  return {
    sun, composer, bloom, grade,
    /** phase 0 = afternoon, 1 = dusk; focus = point the shadows should cover; radius = shadow extent */
    set(phase, focus, radius, t) {
      const el = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(33, 1.5, phase));
      const az = THREE.MathUtils.lerp(0.95, 0.35, phase); // from the south-east toward the south-west
      sunDir.set(Math.cos(el) * Math.sin(az + 0.6), Math.sin(el), Math.cos(el) * Math.cos(az + 0.6)).normalize();
      su.sunPosition.value.copy(sunDir);
      const night = THREE.MathUtils.smoothstep(phase, 0.42, 0.8);
      sun.color.copy(sunDay).lerp(sunDusk, THREE.MathUtils.smoothstep(phase, 0.35, 1));
      sun.intensity = (3.2 - 2.3 * phase) * dim;
      hemi.color.copy(skyDay).lerp(skyDusk, phase);
      hemi.intensity = (1.15 - 0.35 * phase) * (overcast ? 1.15 : 1);
      scene.environmentIntensity = 0.6 - 0.35 * phase;
      renderer.toneMappingExposure = 0.62 - 0.04 * phase;
      grade.uniforms.warmth.value = phase;
      bloom.strength = 0.25 + 0.45 * night;
      bloom.enabled = night > 0.04;
      const zen = overcast ? [0.42, 0.47, 0.55] : [0.24, 0.42, 0.72], zenD = [0.13, 0.15, 0.3];
      const hor = overcast ? [0.74, 0.76, 0.79] : [0.78, 0.84, 0.9], horD = overcast ? [0.42, 0.36, 0.38] : [0.95, 0.56, 0.36];
      domeU.zenith.value.setRGB(...zen.map((v, i) => THREE.MathUtils.lerp(v, zenD[i], phase)));
      domeU.horizon.value.setRGB(...hor.map((v, i) => THREE.MathUtils.lerp(v, horD[i], phase)));
      domeU.sunCol.value.copy(sun.color).multiplyScalar(overcast ? 0.25 : 1);
      domeU.sunDir.value.copy(sunDir);
      scene.fog.color.copy(domeU.horizon.value).multiplyScalar(0.97);
      const alt = Math.max(1, camera.position.y);
      scene.fog.density = baseFog * THREE.MathUtils.clamp(140 / alt, 0.3, 1);
      sun.position.copy(focus).addScaledVector(sunDir, 700);
      sun.target.position.copy(focus);
      const sc = sun.shadow.camera;
      sc.left = sc.bottom = -radius; sc.right = sc.top = radius;
      sc.updateProjectionMatrix();
      for (const c of clouds) c.position.x = c.userData.base.x + (t || 0) * 3;
      for (const c of clouds) c.material.color.setScalar(1 - 0.45 * phase);
      return night;
    },
  };
}
