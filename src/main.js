import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import Lenis from 'lenis';
import './style.css';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), sm = t => (t = cl(t)) * t * (3 - 2 * t), lr = (a, b, t) => a + (b - a) * t;
const C = h => new THREE.Color(h);
const OR = C('#f05a14'), BL = C('#1a4fe8'), PK = C('#ef4f9d'), LM = C('#9fe82b'), VI = C('#4b3de8'), BO = C('#efe9dc'), BK = C('#16120d'), GD = C('#c9a233');

/* ---------- renderer / scene ---------- */
let scene_env_i; const canvas = $('#gl'), R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
R.setPixelRatio(Math.min(devicePixelRatio, 1.5)); R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = .9; scene_env_i = .55;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, .1, 100); cam.position.set(0, 0, 10);
scene.environment = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(), .04).texture;
scene.environmentIntensity = scene_env_i; const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(3, 5, 4); scene.add(key);
let fit = 1;
function resize() { const w = innerWidth, h = innerHeight; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); fit = Math.min(1, cam.aspect / 1.55) }
addEventListener('resize', resize); resize();

/* ---------- the clog: supplied GLB, embedded in the bundle (works offline / file:// / Vercel) ---------- */
const GATOR = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="#e9e8e1" d="M16 47c3-9 14-13 25-10l5-9 4 8 6-8 3 11c11-2 21 6 23 17l-4 15c-9 3-19 1-27 4l-3-9-7 5-9-9c-8 2-15-4-16-10z"/><circle cx="33" cy="46" r="3" fill="#111"/></svg>');
$('#plogo').src = GATOR;
let MODEL, BASEMAT; const CH = new THREE.Vector3(-.6, 0, .5);
function prep(gltf) {
  const root = new THREE.Group(), norm = new THREE.Group(); norm.add(gltf.scene); root.add(norm);
  const each = fn => root.traverse(o => { if (o.isMesh) { const p = o.geometry.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); fn(v, i, o) } } });
  const fitIt = flip => { norm.rotation.set(0, Math.PI / 2 + (flip ? Math.PI : 0), 0); norm.scale.setScalar(1); norm.position.set(0, 0, 0); root.updateMatrixWorld(true);
    let b = new THREE.Box3().setFromObject(root); norm.scale.setScalar(3 / b.getSize(new THREE.Vector3()).x); root.updateMatrixWorld(true);
    b = new THREE.Box3().setFromObject(root); norm.position.copy(b.getCenter(new THREE.Vector3()).negate()); root.updateMatrixWorld(true) };
  const wid = () => { let a = 0, b = 0; each(v => { if (v.x > 1) a = Math.max(a, Math.abs(v.z)); if (v.x < -1) b = Math.max(b, Math.abs(v.z)) }); return [a, b] };
  fitIt(false); { const [a, b] = wid(); if (a < b) fitIt(true) }   // toe is the wider end -> must face +x
  each((v, i, o) => { const g = o.geometry; g.userData.ax = g.userData.ax || new Float32Array(g.attributes.position.count); g.userData.ax[i] = v.x });
  root.traverse(o => { if (o.isMesh) { o.geometry.setAttribute('aX', new THREE.BufferAttribute(o.geometry.userData.ax, 1)); BASEMAT = BASEMAT || o.material } });
  let zs = 0; each(v => { if (Math.abs(v.x - CH.x) < .06 && Math.abs(v.y - CH.y) < .08 && v.z > zs) zs = v.z }); CH.z = zs;
  MODEL = root;
}
function bodyMat() {
  const u = { uA: { value: OR.clone() }, uB: { value: OR.clone() }, uSeam: { value: -2 } };
  const m = BASEMAT.clone(); m.metalnessMap = null; m.metalness = 0; m.roughness = 1.3; m.side = THREE.DoubleSide;
  m.onBeforeCompile = s => { Object.assign(s.uniforms, u); s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aX;varying float vX;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvX=aX;'); s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vX;uniform vec3 uA;uniform vec3 uB;uniform float uSeam;').replace('#include <color_fragment>', '#include <color_fragment>\nfloat lum=dot(diffuseColor.rgb,vec3(.299,.587,.114));diffuseColor.rgb=mix(uA,uB,smoothstep(uSeam-.04,uSeam+.04,vX))*mix(1.,clamp(lum*2.,.35,1.25),.3);') };
  m.userData.u = u; return m;
}
function makeShoe() { const g = new THREE.Group(), mat = bodyMat(), o = MODEL.clone(true); o.traverse(m => { if (m.isMesh) m.material = mat }); g.add(o); g.userData = { mat }; scene.add(g); return g }
function setCol(s, a, b, seam, gold = 0) { const { mat } = s.userData, u = mat.userData.u; u.uA.value.copy(a); u.uB.value.copy(b); u.uSeam.value = seam; mat.metalness = gold * .85; mat.roughness = lr(1.3, .8, gold) }
function boot() {
const hero = makeShoe(), twin = makeShoe(), six = [BL, PK, LM, VI, BO, OR].map(c => { const w = new THREE.Group(), s = makeShoe(); scene.remove(s); s.rotation.x = Math.PI / 2; w.add(s); setCol(s, c, c, -2); scene.add(w); return w });

function pose(s, x, y, rx, ry, rz, sc, zm) { s.scale.setScalar(sc * fit); s.rotation.set(rx, ry, rz); const v = CH.clone().multiplyScalar(sc * fit).applyEuler(s.rotation); s.position.set(lr(x, -v.x, zm), lr(y, -v.y, zm), lr(0, -v.z, zm)) }

/* wireframe orbit rings (digital violet) */
const rings = new THREE.Group(), RM = new THREE.MeshBasicMaterial({ color: 0xcfd6ff, transparent: true, opacity: 0 });
[[0, 0, 0, 2.5], [Math.PI / 2, .25, 0, 1.9], [Math.PI / 2, 1.3, .6, 1.6], [.2, 0, 0, 3.1]].forEach(([rx, ry, rz, r], i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, .012, 6, 160), RM); m.rotation.set(rx, ry, rz); if (i == 0) m.scale.y = .12, m.rotation.x = 1.45; rings.add(m) }); scene.add(rings);

/* ---------- scroll keyframes ---------- */
// [p, x, y, rx, ry, rz, scale, zoom]
const PS = [[0, 0, -.1, .08, -.55, .04, 1.9, 0], [.10, 0, -.1, .08, -.55, .04, 1.9, 0], [.14, .6, -.35, .05, -.3, 0, 3.2, 0], [.17, 0, 0, 0, -.2, 0, 5.5, .85], [.21, 0, 0, 0, -.1, 0, 10, 1]];
for (let k = 0; k < 4; k++) { const p = .24 + k * .06; PS.push([p, .2, .05, .1, -.45, .05, 2.1, 0], [p + .02, .2, .05, .1, -.35, .05, 2.1, 0], [p + .045, .2, .25, .5, 1, .12, 1.85, 0]) }
PS.push([.475, .2, .05, .1, -.45, .05, 2.1, 0], [.57, 0, 0, .1, -.2, 0, 2.1, 0], [.65, 0, 0, .1, -.2, 0, 2.1, 0], [.665, 1.6, 0, -1.57, 0, .2, 3.4, 0], [.70, -1.6, 0, -1.57, 0, .2, 3.4, 0], [.83, -2.1, 1.15, .1, -.5, .25, 1.5, 0], [.93, -2.1, 1.15, .1, -.5, .25, 1.5, 0], [.945, 0, 0, 0, -.1, 0, 6, .9], [.975, 0, 0, 0, -.1, 0, 46, 1], [1, 0, 0, 0, -.1, 0, 46, 1]);
// [p, bg edge, bg center, ink]
const BG = [[0, '#bd420b', '#ee6d12', '#f3f1e8'], [.12, '#bd420b', '#ee6d12', '#f3f1e8'], [.14, '#b33c0a', '#e0620e', '#f3f1e8'], [.215, '#b33c0a', '#e0620e', '#f3f1e8'], [.24, '#2468dd', '#a6d6ff', '#0d1d52'], [.27, '#2468dd', '#a6d6ff', '#0d1d52'], [.30, '#ffd6e8', '#fff4f9', '#3a1030'], [.33, '#ffd6e8', '#fff4f9', '#3a1030'], [.36, '#e6efdc', '#fafaf4', '#141b0a'], [.39, '#e6efdc', '#fafaf4', '#141b0a'], [.42, '#0a1c9f', '#2a42f0', '#ffffff'], [.455, '#0a1c9f', '#2a42f0', '#ffffff'], [.48, '#cfe4e8', '#f0f8f9', '#0e2a30'], [.56, '#cfe4e8', '#f0f8f9', '#0e2a30'], [.58, '#9c8f4c', '#efe5b6', '#2a2610'], [.69, '#9c8f4c', '#efe5b6', '#2a2610'], [.715, '#d7e8ee', '#f6fbfc', '#101c20'], [.82, '#d7e8ee', '#f6fbfc', '#101c20'], [.84, '#b13d09', '#ec6a12', '#f3f1e8'], [.95, '#b13d09', '#ec6a12', '#f3f1e8'], [.97, '#050506', '#101014', '#ffffff'], [1, '#050506', '#101014', '#ffffff']].map(r => [r[0], C(r[1]), C(r[2]), C(r[3])]);
const SEG = [[.215, .24, OR, BL], [.27, .30, BL, PK], [.33, .36, PK, LM], [.39, .42, LM, VI], [.5, .51, VI, BK], [.655, .68, BK, GD]];
let pick = OR.clone(); const seg = (A, p) => { let i = 0; while (i < A.length - 2 && p >= A[i + 1][0]) i++; return [A[i], A[i + 1], sm((p - A[i][0]) / (A[i + 1][0] - A[i][0]))] };
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function heroColor(p) { if (p >= .83) return [pick, pick, -2, 0]; let a = OR, b = OR, s = -2; for (const q of SEG) { if (p >= q[0]) { if (p < q[1]) { a = q[2]; b = q[3]; s = lr(1.7, -1.7, (p - q[0]) / (q[1] - q[0])) } else { a = b = q[3]; s = -2 } } } return [a, b, s, p > .66 && p < .75 ? sm((p - .66) / .02) : 0] }

/* ---------- lookbook cards (rendered once with the same scene) ---------- */
const CARDS = [['#3d8bff', '#cfeaff', BL, 'window seat', 'win'], ['#e9a07a', '#3b2a3a', LM, 'rock garden', 'rock'], ['#141414', '#000', BK, 'gold hour', 'arch'], ['#6f8cff', '#ffc2e0', PK, 'cotton sky', 'cloud'], ['#d9d2c3', '#f3efe6', BO, 'marble hall', 'block'], ['#e8680f', '#a93a08', OR, 'burnt orange', 'none']];
function buildCards() {
  const wrap = $('#cards'); [hero, twin, ...six.map(w => w.children[0])].forEach(s => s.visible = false); six.forEach(w => w.visible = false); rings.visible = false; scene.add(twin);
  R.setPixelRatio(1); R.setSize(360, 520, false); cam.aspect = 360 / 520; cam.updateProjectionMatrix();
  CARDS.forEach(([c1, c2, col, name, prop]) => {
    const cv = document.createElement('canvas'); cv.width = 360; cv.height = 520; const x = cv.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 520); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, 360, 520);
    x.fillStyle = '#fffd'; if (prop == 'cloud') [[80, 400, 120], [230, 440, 150], [310, 380, 90]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill() });
    if (prop == 'win') { x.strokeStyle = '#8a7f72'; x.lineWidth = 16; x.strokeRect(40, 60, 280, 420) } if (prop == 'rock') { x.fillStyle = '#6b4a3a'; x.beginPath(); x.moveTo(60, 520); x.lineTo(90, 360); x.lineTo(270, 350); x.lineTo(310, 520); x.fill() }
    if (prop == 'arch') { x.strokeStyle = '#d9b24a'; x.lineWidth = 6; x.beginPath(); x.arc(180, 230, 120, Math.PI, 0); x.stroke(); x.fillStyle = '#c9a233'; x.fillRect(30, 400, 300, 22) } if (prop == 'block') { x.fillStyle = '#fff'; x.fillRect(70, 360, 220, 160) }
    twin.visible = true; setCol(twin, col, col, -2, col === GD ? 1 : 0); pose(twin, 0, -.1, .12, -.6, 0, .92, 0); twin.scale.setScalar(.92); R.render(scene, cam); x.drawImage(canvas, 0, 0, 360, 520);
    const d = document.createElement('div'); d.className = 'card'; d.append(cv); d.insertAdjacentHTML('beforeend', `<i>${name}</i>`); wrap.append(d);
  });
  six.forEach(w => w.children[0].visible = true); twin.visible = false; hero.visible = true; R.setPixelRatio(Math.min(devicePixelRatio, 1.5)); resize();
}

/* ---------- UI ---------- */
const COLS = [[OR, 'Burnt orange'], [BL, 'Electric blue'], [PK, 'Pink lemonade'], [LM, 'Lime punch'], [VI, 'Digital violet'], [BO, 'Bone'], [BK, 'Black']];
COLS.forEach(([c, n], i) => { const b = document.createElement('button'); b.style.background = '#' + c.getHexString(); b.setAttribute('aria-label', n); if (!i) b.className = 'on'; b.onclick = () => { pick = c.clone(); $('#cn').textContent = n; $$('#sw button').forEach(e => e.classList.toggle('on', e === b)) }; $('#sw').append(b) });
['M4 / W6', 'M5 / W7', 'M6 / W8', 'M7 / W9', 'M8 / W10', 'M9 / W11', 'M10 / W12', 'M11 / W13'].forEach((t, i) => { const b = document.createElement('button'); b.textContent = t; if (i == 3) b.className = 'on'; b.onclick = () => { $$('#sz button').forEach(e => e.classList.toggle('on', e === b)); b.parentElement.previousElementSibling.textContent = 'Size · ' + t }; $('#sz').append(b) });
let bag = 0; $('#add').onclick = e => { bag++; const n = $('#bn'); n.style.display = 'flex'; n.textContent = bag; e.target.textContent = 'Added ✓'; setTimeout(() => e.target.textContent = 'Add to bag', 1300) };

/* ---------- smooth scroll (Lenis) + render loop ---------- */
const track = $('#track'), reduce = matchMedia('(prefers-reduced-motion:reduce)').matches, lenis = reduce ? null : new Lenis({ lerp: .075, wheelMultiplier: .9 });
const maxS = () => track.offsetHeight - innerHeight; let ps = 0, mx = 0, my = 0, tx = 0, ty = 0;
addEventListener('pointermove', e => { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5 });
$$('[data-go]').forEach(a => a.onclick = e => { e.preventDefault(); const y = parseFloat(a.dataset.go) * maxS(); lenis ? lenis.scrollTo(y, { duration: 2.4 }) : scrollTo(0, y) });
const rEls = $$('[data-r]').map(e => [e, ...e.dataset.r.split(',').map(Number)]), root = document.documentElement.style, bgEl = $('#bg'), fx = { c: $('.clouds'), b: $('.bubbles'), s: $('.stripes') }, tint = new THREE.Color(), tint2 = new THREE.Color(), ink = new THREE.Color();
const win = (p, a, b, f = .012) => Math.min(sm((p - a) / f), sm((b - p) / f));
const PT = [0, .125, .23, .465, .57, .71, .83];
function frame(t) {
  lenis && lenis.raf(t); const raw = cl((lenis ? lenis.scroll : scrollY) / Math.max(1, maxS())); ps += (raw - ps) * (lenis ? .2 : 1); const p = ps, T = t / 1000;
  mx += (tx - mx) * .06; my += (ty - my) * .06;
  const [a, b, k] = seg(BG, p); tint.lerpColors(a[1], b[1], k); tint2.lerpColors(a[2], b[2], k); ink.lerpColors(a[3], b[3], k);
  bgEl.style.background = `radial-gradient(120% 95% at 50% 42%,#${tint2.getHexString()},#${tint.getHexString()})`; root.setProperty('--ink', '#' + ink.getHexString());
  fx.c.style.opacity = win(p, .225, .30, .02) * .95; fx.c.style.transform = `translateY(${(p - .26) * -900}px)`; fx.b.style.opacity = win(p, .295, .365, .02); fx.b.style.transform = `translateY(${(p - .33) * -1200}px)`; fx.s.style.opacity = win(p, .355, .425, .02); fx.s.style.transform = `translateY(${(p - .39) * 1500}px)`;
  $('#shadow').style.opacity = win(p, 0, .12, .03) * .7 + win(p, .85, .93, .02) * .5;
  for (const [e, r0, r1] of rEls) { const o = win(p, r0, r1, .012); e.style.opacity = o; e.style.setProperty('--y', (1 - o) * 26 + 'px'); e.style.pointerEvents = o > .6 && (e.id == 'pick' || e.classList.contains('bl')) ? 'auto' : 'none' }
  const cur = PT.filter(v => v <= p).length; $('#pc').textContent = '0' + cur; $('#pf').style.width = p * 100 + '%'; $('#portal').style.opacity = sm((p - .962) / .02); $('#prog').style.opacity = 1 - sm((p - .95) / .015);
  $('#cards').style.transform = `translate3d(${-sm((p - .715) / .1) * (innerWidth * .62) * (innerWidth > 760 ? 1 : 1.2)}px,var(--y,0),0)`;
  // hero pose
  const [s0, s1, kk] = seg(PS, p); const q = s0.slice(1).map((v, i) => lr(v, s1[i + 1], kk)), zm = q[6], bob = Math.sin(T * 1.3) * .06 * (1 - zm);
  pose(hero, q[0], q[1] + bob, q[2] + my * .12 * (1 - zm), q[3] + mx * .25 * (1 - zm), q[4], q[5], zm);
  const [ca, cb, cs, gold] = heroColor(p); setCol(hero, ca, cb, cs, gold);
  hero.visible = !(p > .462 && p < .565) && !(p > .705 && p < .83);
  // twin: after-dark mirror + pair-up partner
  const split = sm((p - .595) / .025) - sm((p - .635) / .02), ad = p > .575 && p < .66, pr = p > .83 && p < .945;
  if (ad) { hero.position.y -= split * 1.5 * fit; pose(twin, 0, split * 1.5, Math.PI, -.2, .02, 2.1, 0); setCol(twin, ca, cb, cs, 0) }
  if (pr) { const e = 1 - sm((p - .835) / .03), o = sm((p - .93) / .015); pose(twin, .5 + e * 5, -1.05 + Math.sin(T * 1.1 + 1) * .06, .12, -.5, -.08, 1.5 * (1 - o), 0); setCol(twin, pick, pick, -2, 0); hero.position.x += (1 - sm((p - .83) / .03)) * 0 }
  if (pr) { const e = sm((p - .83) / .03); pose(hero, -2.1 - (1 - e) * 5, 1.15 + Math.sin(T * 1.3) * .06, .1, -.5, .25, 1.5, 0) }
  twin.visible = ad || pr;
  // six colors pinwheel
  const sx = win(p, .462, .565, .02); six.forEach((w, i) => { const th = i * Math.PI / 3 + (p - .47) * 9, r = 1.75 * sm((p - .465) / .03) * fit; w.visible = sx > .01; w.position.set(Math.cos(th) * r, Math.sin(th) * r + .5, 0); w.rotation.z = th + 1.25; w.scale.setScalar(.68 * fit * sx) });
  // orbit rings
  const ro = win(p, .405, .465, .02); rings.visible = ro > .01; RM.opacity = ro * .85; rings.position.copy(hero.position); rings.rotation.y = T * .5; rings.scale.setScalar(fit);
  R.render(scene, cam); requestAnimationFrame(frame);
}
buildCards(); requestAnimationFrame(frame);
}
import glb from '../assets/crocs.glb';
new GLTFLoader().parse(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '', g => { prep(g); boot() }, e => console.error(e));
