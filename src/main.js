import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import Lenis from 'lenis';
import './style.css';
import glb from '../assets/crocs.glb';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), sm = t => (t = cl(t)) * t * (3 - 2 * t), lr = (a, b, t) => a + (b - a) * t;
const C = h => new THREE.Color(h);
const OR = C('#f05a14'), BL = C('#1a4fe8'), PK = C('#e3157a'), LM = C('#86e010'), VI = C('#3a34ee'), BO = C('#efe9dc'), BK = C('#16120d'), GD = C('#c9a233'), GH = C('#a9c2cf');
const TS = 2, TE = 24.4, P2T = p => TS + p * (TE - TS);   // scroll progress <-> video seconds
const tri = (T, a, b, c) => sm((T - a) / (b - a)) * (1 - sm((T - b) / (c - b)));
const win = (T, a, b, f = .25) => Math.min(sm((T - a) / f), sm((b - T) / f));

/* ---------- renderer / scene ---------- */
const canvas = $('#gl'), R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
R.setPixelRatio(Math.min(devicePixelRatio, 1.5)); R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = .9;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, .1, 100); cam.position.set(0, 0, 10);
scene.environment = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .55;
const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(3, 5, 4); scene.add(key);
let fit = 1;
function resize() { const w = innerWidth, h = innerHeight; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); fit = Math.min(1, cam.aspect / 1.55) }
addEventListener('resize', resize); resize();

/* ---------- the clog: supplied GLB, embedded in the bundle ---------- */
const GATOR = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#e9e8e1" stroke-width="3"/><path fill="#e9e8e1" d="M28 62c6-22 22-32 44-30-8 6-12 14-12 22 0 8 4 14 10 18-20 6-34 2-42-10z"/><circle cx="62" cy="44" r="3.2" fill="#0c0c0c"/></svg>');
$('#plogo').src = GATOR;
let MODEL, BASEMAT; const FOC = [new THREE.Vector3(-.6, 0, .5), new THREE.Vector3(.45, .2, .6), new THREE.Vector3(1.0, .3, .5), new THREE.Vector3(0, -.6, 0)];
function prep(gltf) {
  const root = new THREE.Group(), norm = new THREE.Group(); norm.add(gltf.scene); root.add(norm);
  const each = fn => root.traverse(o => { if (o.isMesh) { const p = o.geometry.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); fn(v, i, o) } } });
  const fitIt = flip => { norm.rotation.set(0, Math.PI / 2 + (flip ? Math.PI : 0), 0); norm.scale.setScalar(1); norm.position.set(0, 0, 0); root.updateMatrixWorld(true);
    let b = new THREE.Box3().setFromObject(root); norm.scale.setScalar(3 / b.getSize(new THREE.Vector3()).x); root.updateMatrixWorld(true);
    b = new THREE.Box3().setFromObject(root); norm.position.copy(b.getCenter(new THREE.Vector3()).negate()); root.updateMatrixWorld(true) };
  const wid = () => { let a = 0, b = 0; each(v => { if (v.x > 1) a = Math.max(a, Math.abs(v.z)); if (v.x < -1) b = Math.max(b, Math.abs(v.z)) }); return [a, b] };
  fitIt(false); { const [a, b] = wid(); if (a < b) fitIt(true) }
  each((v, i, o) => { const g = o.geometry; g.userData.ax = g.userData.ax || new Float32Array(g.attributes.position.count); g.userData.ax[i] = v.x });
  root.traverse(o => { if (o.isMesh) { o.geometry.setAttribute('aX', new THREE.BufferAttribute(o.geometry.userData.ax, 1)); BASEMAT = BASEMAT || o.material } });
  const surf = f => { let z = 0; each(v => { if (Math.abs(v.x - f.x) < .08 && Math.abs(v.y - f.y) < .1 && v.z > z) z = v.z }); f.z = z };
  surf(FOC[0]); surf(FOC[1]); surf(FOC[2]); const bb = new THREE.Box3().setFromObject(root); FOC[3].y = bb.min.y;
  MODEL = root;
}
function bodyMat() {
  const u = { uA: { value: OR.clone() }, uB: { value: OR.clone() }, uSeam: { value: -2 }, uFade: { value: 0 }, uBG: { value: C('#fff') } };
  const m = BASEMAT.clone(); m.metalnessMap = null; m.metalness = 0; m.roughness = 1.3; m.side = THREE.DoubleSide;
  m.onBeforeCompile = s => { Object.assign(s.uniforms, u); s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aX;varying float vX;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvX=aX;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vX;uniform vec3 uA;uniform vec3 uB;uniform float uSeam;uniform float uFade;uniform vec3 uBG;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat lum=dot(diffuseColor.rgb,vec3(.299,.587,.114));float sk=smoothstep(uSeam-.05,uSeam+.05,vX);diffuseColor.rgb=mix(uA,uB,sk)*mix(1.,clamp(lum*2.,.35,1.25),.3);diffuseColor.rgb+=vec3(.55)*exp(-pow((vX-uSeam)/.07,2.))*step(-1.6,uSeam)*step(uSeam,1.6);')
      .replace('#include <dithering_fragment>', 'gl_FragColor.rgb=mix(gl_FragColor.rgb,uBG,uFade);\n#include <dithering_fragment>') };
  m.userData.u = u; return m;
}
function makeShoe() { const g = new THREE.Group(), mat = bodyMat(), o = MODEL.clone(true); o.traverse(m => { if (m.isMesh) m.material = mat }); g.add(o); g.userData = { mat }; scene.add(g); return g }
function setCol(s, a, b, seam, gold = 0, fade = 0, bg) { const { mat } = s.userData, u = mat.userData.u; u.uA.value.copy(a); u.uB.value.copy(b); u.uSeam.value = seam; u.uFade.value = fade; if (bg) u.uBG.value.copy(bg); mat.metalness = gold * .85; mat.roughness = lr(1.3, .8, gold) }
function focus(f) { const i = Math.min(2, Math.floor(f)), k = f - i; return FOC[i].clone().lerp(FOC[i + 1], k) }
function pose(s, x, y, rx, ry, rz, sc, zm, f = 0) { s.scale.setScalar(sc * fit); s.rotation.set(rx, ry, rz); const v = focus(f).multiplyScalar(sc * fit).applyEuler(s.rotation); s.position.set(lr(x, -v.x, zm), lr(y, -v.y, zm), lr(0, -v.z, zm)) }

/* ---------- procedural clouds (canvas) ---------- */
function cloudURL(w, h, n, seed) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); let r = seed; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < n; i++) { const px = rnd() * w, py = h * (.25 + .75 * Math.pow(rnd(), .6)), rad = (.05 + rnd() * .12) * h * (pass == 0 ? 1.5 : 1);
    const g = x.createRadialGradient(px, py - rad * .2, rad * .1, px, py, rad); const sh = pass == 0 ? '#b9d3ec' : pass == 1 ? '#e9f3fc' : '#ffffff';
    g.addColorStop(0, sh); g.addColorStop(.6, sh + 'cc'); g.addColorStop(1, sh + '00'); x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, 7); x.fill() }
  const m = x.createLinearGradient(0, 0, 0, h); m.addColorStop(0, '#fff0'); m.addColorStop(.3, '#fff0'); m.addColorStop(1, '#cfe2f4aa'); x.globalCompositeOperation = 'source-atop'; x.fillStyle = m; x.fillRect(0, 0, w, h);
  return `url(${c.toDataURL('image/png')})`;
}

function boot() {
  const hero = makeShoe(), twin = makeShoe(), six = [BL, PK, LM, VI, BO, OR].map(c => { const w = new THREE.Group(), s = makeShoe(); scene.remove(s); w.add(s); setCol(s, c, c, -2); scene.add(w); return w });
  /* bubbles (bubblegum chapter) */
  const bubbles = [[-4.2, 1.8, -1, .45], [3.2, 2.2, -2, .35], [-1.2, 2.6, .5, .16], [4.3, -.6, 0, .22], [-3.4, -1.9, .8, .5], [1.9, -2.3, 1, .26], [-4.8, .2, -2, .16], [2.6, .6, 1.8, .12], [.3, 2.3, 2, .2], [4.7, -2.2, -1, .17]].map(([x, y, z, r], i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), new THREE.MeshStandardMaterial({ color: i % 4 == 2 ? '#ff3d9a' : '#ff9ccb', roughness: .12, metalness: 0, envMapIntensity: 1.2, emissive: '#ff4fa3', emissiveIntensity: .18 })); m.userData = { x, y, z, r, i }; scene.add(m); return m });
  /* wireframe orbit rings (digital violet) */
  const rings = new THREE.Group(), RM = new THREE.MeshBasicMaterial({ color: 0xdfe6ff, transparent: true, opacity: 0 });
  const hr = new THREE.Mesh(new THREE.TorusGeometry(3.6, .022, 8, 220), RM); hr.rotation.x = 1.38; rings.add(hr);
  [[0, 0], [.55, 0], [-.55, 0]].forEach(([ry]) => { const m = new THREE.Mesh(new THREE.TorusGeometry(2.3, .014, 6, 160), RM); m.rotation.y = ry; m.scale.x = .22; rings.add(m) }); scene.add(rings);

  /* ---- keyframes, in video seconds ----  [T, x, y, rx, ry, rz, scale, zoom, focus] */
  const PI = Math.PI;
  const HP = [[0, 0, -.1, .1, -1.1, 0, .9, 0, 0], [1.8, 0, -.1, .1, -1, 0, 1, 0, 0], [2.4, 0, -.12, .1, -.8, .03, 1.6, 0, 0], [3.5, 0, -.15, .08, -.55, .04, 1.7, 0, 0], [3.9, .3, -.25, .05, -.3, 0, 2.4, 0, 0], [4.4, 0, 0, 0, -.12, 0, 6.5, .85, 0], [4.7, 0, 0, 0, -.08, 0, 9.5, 1, 0], [5.35, 0, 0, 0, -.1, .03, 9.8, 1, 0],
    [5.8, 0, 0, 0, -.15, .05, 8.5, 1, 1], [6.15, 0, 0, .05, -.25, .06, 8.5, 1, 1], [6.45, 0, 0, .3, -.4, .1, 6.5, 1, 2], [6.9, 0, 0, .5, -.5, .12, 3.6, .6, 2], [7.3, .4, .1, .2, -.6, .1, 2.2, 0, 0], [7.8, .2, .1, .1, -.5, .05, 1.6, 0, 0], [8.4, .25, .1, .1, -.45, .05, 1.75, 0, 0], [8.9, .25, .15, .1, -.4, .05, 1.75, 0, 0],
    [9.15, .2, .3, .45, .9, .15, 1.35, 0, 0], [9.45, .1, 0, .05, -.45, .02, 1.7, 0, 0], [9.9, .1, 0, .05, -.4, .02, 1.7, 0, 0], [10.05, 0, .3, .4, .9, .3, 1.3, 0, 0], [10.3, 0, -.15, .05, -.5, 0, 1.5, 0, 0], [10.95, 0, -.15, .05, -.5, 0, 1.5, 0, 0],
    [11.3, 0, .2, .3, 1.1, -.35, 1.2, 0, 0], [11.6, .6, 0, .15, -.5, .1, 1.6, 0, 0], [12.3, .55, 0, .1, -1, .1, 1.6, 0, 0], [12.65, 0, 0, .1, -1.57, 0, 1.1, 0, 0], [14.6, 0, 0, .1, -1.57, 0, 1.1, 0, 0],
    [14.9, 0, 0, .15, -.35, 0, 1.0, 0, 0], [15.2, 0, 0, .1, -.2, 0, 1.5, 0, 0], [15.5, 0, -1.05, .1, -.25, 0, 1.5, 0, 0], [15.9, 0, -1, .3, -.6, .25, 1.5, 0, 0], [16.3, 0, -1.05, .1, -.3, -.2, 1.5, 0, 0], [16.55, 0, -.3, -1, -.2, 0, 3, 0, 0], [16.8, 0, 0, -1.57, 0, .25, 5.5, .9, 3], [17, 0, 0, -1.57, 0, .22, 9, 1, 3], [17.6, 0, 0, -1.57, .1, .18, 8.5, 1, 3], [17.9, 0, 0, -1.57, 0, .2, 3.2, .2, 3], [18.2, 0, -1, .1, -.25, 0, 1.5, 0, 0], [18.6, 0, -1, .1, -.25, 0, 1.5, 0, 0],
    [20.3, -6, 1.8, .2, -.9, .4, 1.2, 0, 0], [20.8, -2.1, 1.2, .25, -.5, .25, 1.12, 0, 0], [21.7, -2.1, 1.2, .25, -.5, .25, 1.12, 0, 0], [22.1, -5, 3.4, .3, -.5, .5, .6, 0, 0], [24.5, -5, 3.4, .3, -.5, .5, .6, 0, 0]];
  const TP = [[0, 0, -1, .1, -.25, 0, 1.5, 0, 0], [15.2, 0, -1.05, .1, -.25, 0, 1.5, 0, 0], [15.55, 0, 1.05, PI + .1, -.25, 0, 1.5, 0, 0], [15.9, 0, 1, PI + .3, -.6, -.25, 1.5, 0, 0], [16.3, 0, 1.05, PI + .1, -.3, .2, 1.5, 0, 0], [16.55, 0, 2, PI, -.3, 0, 1.5, 0, 0], [17.9, 0, 1.05, PI + .1, -.25, 0, 1.5, 0, 0], [18.6, 0, 1.05, PI + .1, -.25, 0, 1.5, 0, 0],
    [20.65, 7, -1.1, .12, -.5, -.08, 1.25, 0, 0], [21, .4, -1.05, .12, -.5, -.08, 1.25, 0, 0], [21.75, .4, -1.05, .12, -.5, -.08, 1.25, 0, 0], [22, 0, 0, .05, -.45, 0, 3.4, .9, 0], [22.5, 0, 0, 0, -.1, 0, 11, 1, 0], [22.8, 0, 0, 0, 0, .15, 28, 1, 0], [22.95, 0, 0, 0, 0, .5, 50, 1, 0], [24.5, 0, 0, 0, 0, .5, 50, 1, 0]];
  const BG = [[0, '#bd420b', '#ee6d12', '#f3f1e8'], [3.9, '#bd420b', '#ee6d12', '#f3f1e8'], [4.2, '#b33c0a', '#e0620e', '#f3f1e8'], [6.9, '#b33c0a', '#e0620e', '#f3f1e8'], [7.7, '#4f8fe0', '#bfe0fb', '#0d1d52'], [8.2, '#2468dd', '#9fd0ff', '#0d1d52'], [9, '#2468dd', '#a6d6ff', '#0d1d52'], [9.35, '#dccbea', '#f0e4f4', '#4a0e30'], [9.5, '#f1cfe0', '#fbeaf2', '#4a0e30'], [9.95, '#f1cfe0', '#fbeaf2', '#4a0e30'], [10.25, '#c5d8d2', '#e6efeb', '#10170a'], [11.05, '#c5d8d2', '#e6efeb', '#10170a'],
    [11.5, '#0a1c9f', '#2a42f0', '#ffffff'], [12.35, '#0a1c9f', '#2a42f0', '#ffffff'], [12.7, '#f2fafb', '#ffffff', '#0e2a30'], [13.1, '#bfe0e6', '#eaf6f8', '#0e2a30'], [14.6, '#bfe0e6', '#eaf6f8', '#0e2a30'], [14.95, '#b9ab6a', '#efe6bf', '#2a2610'], [17.8, '#b9ab6a', '#efe6bf', '#2a2610'], [18.2, '#aebfc9', '#dbe6ec', '#101c20'], [18.7, '#d3e4ea', '#f1f7f9', '#101c20'], [20.25, '#d3e4ea', '#f1f7f9', '#101c20'], [20.6, '#d9b5b2', '#f0d4d0', '#2a1210'], [20.95, '#b13d09', '#ec6a12', '#f3f1e8'], [22.6, '#b13d09', '#ec6a12', '#f3f1e8'], [22.95, '#050506', '#0f0f13', '#ffffff'], [25, '#050506', '#0f0f13', '#ffffff']].map(r => [r[0], C(r[1]), C(r[2]), C(r[3])]);
  const CS = [[7, 7.6, OR, BL], [9, 9.35, BL, PK], [10, 10.3, PK, LM], [11.2, 11.55, LM, VI], [14.7, 15, VI, BK], [16.4, 16.7, BK, GD], [17.85, 18.1, GD, GH], [20.29, 20.3, GH, BK], [20.4, 20.85, BK, OR]];
  let pick = OR.clone();
  const at = (A, T) => { let i = 0; while (i < A.length - 2 && T >= A[i + 1][0]) i++; return [A[i], A[i + 1], sm((T - A[i][0]) / (A[i + 1][0] - A[i][0]))] };
  const heroColor = T => { if (T >= 20.9) return [pick, pick, -2]; let a = OR, b = OR, s = -2; for (const q of CS) if (T >= q[0]) { if (T < q[1]) { a = q[2]; b = q[3]; s = lr(1.7, -1.7, (T - q[0]) / (q[1] - q[0])) } else { a = b = q[3]; s = -2 } } return [a, b, s] };

  /* ---------- lookbook cards ---------- */
  const CARDS = [['window seat', 'win', BL], ['rock garden', 'rock', LM], ['gold hour', 'arch', BK], ['cotton sky', 'cloud', PK], ['marble hall', 'block', BO], ['burnt orange', 'sun', OR]];
  function buildCards() {
    const wrap = $('#cards'); [hero, ...six.map(w => w.children[0])].forEach(s => s.visible = false); six.forEach(w => w.visible = false); rings.visible = false; bubbles.forEach(b => b.visible = false);
    R.setPixelRatio(1); R.setSize(360, 520, false); cam.aspect = 360 / 520; cam.updateProjectionMatrix();
    CARDS.forEach(([name, prop, col]) => {
      const cv = document.createElement('canvas'); cv.width = 360; cv.height = 520; const x = cv.getContext('2d'), G = (c1, c2) => { const g = x.createLinearGradient(0, 0, 0, 520); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, 360, 520) };
      const puff = (px, py, r, c = '#ffffff') => { const g = x.createRadialGradient(px, py, r * .1, px, py, r); g.addColorStop(0, c); g.addColorStop(1, c + '00'); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill() };
      if (prop == 'win') { G('#2f86ff', '#bfe4ff'); [[80, 380, 70], [200, 420, 90], [300, 360, 60], [150, 330, 50]].forEach(a => puff(...a)); x.strokeStyle = '#a9a39a'; x.lineWidth = 14; x.strokeRect(46, 70, 268, 380); x.lineWidth = 6; x.beginPath(); x.moveTo(180, 70); x.lineTo(180, 450); x.stroke(); x.fillStyle = '#8f887d'; for (let i = 0; i < 12; i++) x.fillRect(200, 90 + i * 28, 100, 10); x.fillStyle = '#d8d2c6'; x.fillRect(30, 440, 300, 22) }
      if (prop == 'rock') { G('#f0a67c', '#3a2a3c'); puff(180, 160, 150, '#ffd7a8'); x.fillStyle = '#5a3c32'; x.beginPath(); x.moveTo(40, 520); x.lineTo(80, 350); x.lineTo(130, 330); x.lineTo(250, 345); x.lineTo(300, 520); x.fill(); x.strokeStyle = '#7a5445'; x.lineWidth = 2; for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(90 + i * 14, 345); x.lineTo(70 + i * 17, 520); x.stroke() } }
      if (prop == 'arch') { G('#151515', '#000'); x.strokeStyle = '#e8c868'; x.lineWidth = 7; x.beginPath(); x.arc(180, 250, 130, PI, 0); x.stroke(); x.fillStyle = '#d9b24a'; x.fillRect(30, 380, 300, 26); x.fillStyle = '#8a6c1e'; x.fillRect(30, 406, 300, 60) }
      if (prop == 'cloud') { G('#5b7dff', '#ffc4e2'); [[60, 380, 90], [180, 430, 110], [300, 390, 90], [120, 320, 60], [250, 330, 70]].forEach(a => puff(...a, '#ffe9f4')) }
      if (prop == 'block') { G('#d9d2c3', '#f3efe6'); x.fillStyle = '#f9f7f2'; x.fillRect(60, 350, 240, 170); x.strokeStyle = '#c4bdb0'; x.lineWidth = 1.5; for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(70 + i * 24, 350); x.bezierCurveTo(90 + i * 20, 400, 50 + i * 26, 460, 80 + i * 24, 520); x.stroke() } }
      if (prop == 'sun') { G('#f0701a', '#a93a08'); puff(180, 200, 120, '#ffb066'); x.fillStyle = '#c64a0a'; x.fillRect(0, 410, 360, 110) }
      twin.visible = true; setCol(twin, col, col, -2); twin.scale.setScalar(.92); twin.rotation.set(.12, -.6, 0); twin.position.set(0, -.15, 0); R.render(scene, cam); x.drawImage(canvas, 0, 0, 360, 520);
      const d = document.createElement('div'); d.className = 'card'; d.append(cv); d.insertAdjacentHTML('beforeend', `<i>${name}</i>`); wrap.append(d);
    });
    six.forEach(w => w.children[0].visible = true); twin.visible = false; hero.visible = true; bubbles.forEach(b => b.visible = true); R.setPixelRatio(Math.min(devicePixelRatio, 1.5)); resize();
  }
  buildCards();

  /* ---------- UI ---------- */
  const COLS = [[OR, 'Burnt orange'], [BL, 'Electric blue'], [PK, 'Pink lemonade'], [LM, 'Lime punch'], [VI, 'Digital violet'], [BO, 'Bone'], [BK, 'Black']];
  COLS.forEach(([c, n], i) => { const b = document.createElement('button'); b.style.background = '#' + c.getHexString(); b.setAttribute('aria-label', n); if (!i) b.className = 'on'; b.onclick = () => { pick = c.clone(); $('#cn').textContent = n; $$('#sw button').forEach(e => e.classList.toggle('on', e === b)) }; $('#sw').append(b) });
  ['M4 / W6', 'M5 / W7', 'M6 / W8', 'M7 / W9', 'M8 / W10', 'M9 / W11', 'M10 / W12', 'M11 / W13'].forEach((t, i) => { const b = document.createElement('button'); b.textContent = t; if (i == 3) b.className = 'on'; b.onclick = () => { $$('#sz button').forEach(e => e.classList.toggle('on', e === b)); b.parentElement.previousElementSibling.textContent = 'Size · ' + t }; $('#sz').append(b) });
  let bag = 0; $('#add').onclick = e => { bag++; const n = $('#bn'); n.style.display = 'flex'; n.textContent = bag; e.target.textContent = 'Added ✓'; setTimeout(() => e.target.textContent = 'Add to bag', 1300) };
  // per-letter reveal
  const splitEl = el => { const walk = n => [...n.childNodes].forEach(c => { if (c.nodeType == 3) { const f = document.createDocumentFragment(); [...c.textContent].forEach(ch => { const s = document.createElement('span'); s.className = 'c'; s.textContent = ch == ' ' ? '\u00a0' : ch; f.append(s) }); c.replaceWith(f) } else walk(c) }); walk(el); el.querySelectorAll('.c').forEach((s, i) => s.dataset.i = i) };
  $$('.sp').forEach(splitEl);
  const cloudA = cloudURL(2400, 900, 90, 11), cloudB = cloudURL(2400, 900, 70, 47), cloudS = cloudURL(900, 260, 26, 5);
  $('.cl.a').style.backgroundImage = cloudA; $('.cl.b').style.backgroundImage = cloudB; $('.cl.s').style.backgroundImage = cloudS;

  /* ---------- intro (preloader) + smooth scroll ---------- */
  const track = $('#track'), reduce = matchMedia('(prefers-reduced-motion:reduce)').matches, lenis = reduce ? null : new Lenis({ lerp: .075, wheelMultiplier: .9 });
  const maxS = () => track.offsetHeight - innerHeight; let ps = 0, mx = 0, my = 0, tx = 0, ty = 0, intro = true, t0 = performance.now(), prevPs = 0, blur = 0;
  lenis && lenis.stop(); scrollTo(0, 0);
  addEventListener('pointermove', e => { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5 });
  $$('[data-go]').forEach(a => a.onclick = e => { e.preventDefault(); const y = (parseFloat(a.dataset.go) - TS) / (TE - TS) * maxS(); lenis ? lenis.scrollTo(Math.max(0, y), { duration: 2.6 }) : scrollTo(0, Math.max(0, y)) });
  const rEls = $$('[data-r]').map(e => [e, ...e.dataset.r.split(',').map(Number)]), root = document.documentElement.style, bgEl = $('#bg'), tint = new THREE.Color(), tint2 = new THREE.Color(), ink = new THREE.Color(), bgc = new THREE.Color();
  const PT = [2, 3.9, 8.1, 12.7, 15.2, 18.7, 20.7];
  const I = { win: false, open: false, done: false };
  const cA = [[0, 100], [6.9, 100], [7.8, 0], [8.0, 0], [8.6, 63], [9.0, 63], [9.4, 100], [30, 100]], cB = [[0, 100], [7.0, 100], [7.9, 4], [8.1, 4], [8.8, 74], [9.1, 74], [9.45, 100], [30, 100]];
  const iv = (A, T) => { const [a, b, k] = at(A, T); return lr(a[1], b[1], k) };
  $('#mark').closest('footer') && new IntersectionObserver(es => es.forEach(e => $('#mark').classList.toggle('in', e.isIntersecting)), { threshold: .25 }).observe($('#foot'));

  function frame(now) {
    const tr = (now - t0) / 1000; let T;
    if (intro) {
      T = Math.min(tr, TS); const lp = sm(tr / 1.15); $('#lc').textContent = Math.round(lp * 100) + '%'; $('#lb').style.width = lp * 100 + '%';
      if (tr > 1.0 && !I.win) { I.win = true; $('#hole').classList.add('win'); $('.lw').style.opacity = 0 }
      if (tr > 1.45 && !I.open) { I.open = true; $('#hole').classList.remove('win'); $('#hole').classList.add('open') }
      if (tr > 2.55 && !I.done) { I.done = true; intro = false; $('#loader').remove(); document.body.classList.add('ready'); lenis && lenis.start() }
    }
    if (!intro) { lenis && lenis.raf(now); const raw = cl((lenis ? lenis.scroll : scrollY) / Math.max(1, maxS())); ps += (raw - ps) * (lenis ? .2 : 1); T = P2T(ps); blur = cl(Math.abs(raw - ps) * 110, 0, 2.2) }
    const ig = intro ? sm((tr - 1.7) / .8) : 1, TT = Math.min(T, TE);
    mx += (tx - mx) * .06; my += (ty - my) * .06;
    // background / ink
    const [a, b, k] = at(BG, TT); tint.lerpColors(a[1], b[1], k); tint2.lerpColors(a[2], b[2], k); ink.lerpColors(a[3], b[3], k);
    bgEl.style.background = `radial-gradient(120% 95% at 50% 42%,#${tint2.getHexString()},#${tint.getHexString()})`; root.setProperty('--ink', '#' + ink.getHexString()); bgc.copy(tint2).lerp(tint, .5);
    // clouds
    const cv = $('.cl.a'), cvb = $('.cl.b'), cs = $('.cl.s'), cyA = iv(cA, TT), cyB = iv(cB, TT), dr = Math.sin(TT * .6) * 2;
    cv.style.opacity = TT > 6.8 && TT < 9.5 ? 1 : 0; cv.style.transform = `translate(${dr - (TT - 8) * 3}%,${cyA}%)`; cvb.style.opacity = TT > 6.9 && TT < 9.55 ? 1 : 0; cvb.style.transform = `translate(${-dr * 1.6 + (TT - 8) * 4}%,${cyB}%) scale(1.15)`;
    cs.style.opacity = win(TT, 8.3, 9.2, .3); cs.style.transform = `translateX(${-(TT - 8.3) * 12}px)`;
    // stripes (lime) wipe
    $$('.stripes i').forEach((s, i) => { const inn = sm((TT - 10.15 - i * .07) / .35), out = sm((TT - 10.85 - i * .06) / .3); s.style.transformOrigin = out > 0 ? 'right' : 'left'; s.style.transform = `scaleX(${inn * (1 - out)}) translateY(${Math.sin(TT * 1.4 + i) * 6}px)` });
    $('#white').style.opacity = tri(TT, 12.4, 12.65, 12.9);
    $('#shadow').style.opacity = (win(TT, 1.8, 3.9, .3) * .7 + win(TT, 20.8, 21.9, .3) * .5) * (TT > 3.5 && TT < 20 ? 1 : 1);
    // DOM text windows
    for (const [e, r0, r1] of rEls) { let o = win(TT, r0, r1, .25); if (r0 < 0 || r0 < 2.5) o *= ig;
      if (e.classList.contains('g')) { e.style.visibility = o > .001 ? 'visible' : 'hidden'; e.querySelectorAll('.c').forEach(s => s.style.setProperty('--o', cl(o * 2.2 - s.dataset.i * .12))) }
      else if (e.classList.contains('sp')) { e.querySelectorAll('.c').forEach(s => s.style.setProperty('--o', cl(o * 2.2 - s.dataset.i * .09))) }
      else { e.style.opacity = o; e.style.setProperty('--y', (1 - o) * 26 + 'px'); e.style.pointerEvents = o > .6 && (e.id == 'pick' || e.classList.contains('bl')) ? 'auto' : 'none' } }
    // (headings inside .t also split: drive via parent's window)
    $$('.t .sp').forEach(h => { const p = h.closest('.t'), o = parseFloat(p.style.opacity || 0); h.querySelectorAll('.c').forEach(s => s.style.setProperty('--o', cl(o * 2.2 - s.dataset.i * .09))) });
    const cur = PT.filter(v => v <= TT).length; $('#pc').textContent = '0' + Math.max(1, cur); $('#pf').style.width = cl(ps) * 100 + '%'; $('#prog').style.opacity = (document.body.classList.contains('ready') ? 1 : 0) * (1 - sm((TT - 22.6) / .3));
    $('#portal').style.opacity = sm((TT - 22.85) / .2); $('#portal div').style.transform = `scale(${lr(3.2, 1, sm((TT - 22.9) / .9))})`; $('#portal p').style.opacity = sm((TT - 23.5) / .5);
    $('#cards').style.transform = `translate3d(${lr(innerWidth * .6, -innerWidth * .62 * (innerWidth > 760 ? 1 : 1.3), sm((TT - 18.6) / 1.7))}px,var(--y,0),0)`;
    // hero
    const [s0, s1, kk] = at(HP, TT), q = s0.slice(1).map((v, i) => lr(v, s1[i + 1], kk)), bob = Math.sin(TT * 1.3) * .06 * (1 - q[6]);
    const tw = (TT > 8.9 && TT < 12.7) ? 1 : 0.6; const mxs = (1 - q[6]) * (TT > 3 ? 1 : .2);
    pose(hero, q[0], q[1] + bob, q[2] + my * .12 * mxs, q[3] + mx * .25 * mxs, q[4], q[5], q[6], q[7]);
    // intro drop-in/spin (first 2s)
    const [ca, cb, cs2] = heroColor(TT), gold = sm((TT - 16.45) / .25) * (1 - sm((TT - 17.85) / .3)), fade = sm((TT - 17.9) / .25) * .92, ghostbg = bgc.clone().multiplyScalar(.93).lerp(bgc, sm((TT - 18.3) / .35));
    setCol(hero, ca, cb, cs2, gold, TT > 17.85 && TT < 18.7 ? fade : 0, ghostbg);
    hero.visible = !(TT > 12.75 && TT < 14.6) && !(TT > 18.65 && TT < 20.25) && TT < 22.6;
    // twin
    const [t0_, t1_, tk] = at(TP, TT), tq = t0_.slice(1).map((v, i) => lr(v, t1_[i + 1], tk));
    pose(twin, tq[0], tq[1] + (TT > 20.6 ? Math.sin(TT * 1.1) * .06 : 0), tq[2], tq[3], tq[4], tq[5], tq[6], tq[7]);
    const inAD = TT > 15.2 && TT < 18.65, tcol = TT < 20 ? [ca, cb, cs2] : [pick, pick, -2];
    setCol(twin, tcol[0], tcol[1], tcol[2], TT < 20 ? gold : 0, TT > 17.85 && TT < 18.7 ? fade : 0, ghostbg);
    twin.visible = (inAD && !(TT > 16.65 && TT < 17.85)) || (TT > 20.6);
    // bubbles
    const bo = tri(TT, 8.95, 9.5, 10.35); bubbles.forEach(m => { const u = m.userData; m.visible = bo > .01; m.scale.setScalar(bo * fit); m.position.set(u.x * fit, u.y + Math.sin(TT * .9 + u.i) * .2 + (TT - 9.6) * (.25 + (u.i % 3) * .12), u.z) });
    // orbit rings
    const ro = win(TT, 11.4, 12.4, .3); rings.visible = ro > .01; RM.opacity = ro * .9; rings.position.copy(hero.position); rings.rotation.set(Math.sin(TT * .7) * .08, TT * .55, .06); rings.scale.setScalar(fit);
    // six-color pinwheel
    const sx = win(TT, 12.75, 14.85, .1), sp = sm((TT - 12.8) / .45), sc = sm((TT - 14.4) / .45);
    six.forEach((w, i) => { const th = i * PI / 3 + (TT - 12.8) * .6 + sc * .8, r = (1.55 * sp + sc * 6) * fit; w.visible = sx > .01;
      w.position.set(Math.cos(th) * r, Math.sin(th) * r + .35, i == 3 ? sc * 5 : 0); w.rotation.z = th + 1.25; w.scale.setScalar((.62 * sp + .1) * fit * (i == 3 ? 1 + sc * 3 : 1 - sc * .5));
      w.children[0].rotation.x = Math.PI / 2 + Math.sin(TT * 1.15 + i * 1.3) * 1.35 + (1 - sp) * 1.2; w.children[0].rotation.y = Math.sin(TT * .8 + i) * .5 });
    // soft motion blur from scroll speed
    canvas.style.filter = blur > .3 ? `blur(${blur.toFixed(1)}px)` : 'none';
    R.render(scene, cam); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
new GLTFLoader().parse(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '', g => { prep(g); boot() }, e => console.error(e));
