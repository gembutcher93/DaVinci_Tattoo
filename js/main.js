import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadBodyData, buildSubdivision, quadsToTris } from './body.js';
import { SECTIONS, MACRO, RACES, targetNames, macroWeights } from './modifiers.js';

const $ = s => document.querySelector(s);
const STORE = 'davinci.state.v1';

// ---------------- stato ----------------
const defaultState = () => ({
  macro: Object.fromEntries(MACRO.map(m => [m.id, m.def])),
  race: { caucasian: 1, african: 0, asian: 0 },
  height: null, mods: {}, sym: true, smooth: true, wire: false,
});
let state = defaultState();
try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && s.macro) state = Object.assign(defaultState(), s); } catch (e) { }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { } };

// ---------------- scena ----------------
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1613);
scene.fog = new THREE.Fog(0x1a1613, 6, 14);
const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.12;
controls.minDistance = 0.4; controls.maxDistance = 8;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

scene.add(new THREE.HemisphereLight(0xfff1e0, 0x2a2018, 1.1));
const key = new THREE.DirectionalLight(0xfff4e8, 2.2); key.position.set(2, 3.5, 3); scene.add(key);
const rim = new THREE.DirectionalLight(0xc99a63, 1.4); rim.position.set(-3, 2.5, -2.5); scene.add(rim);
const fill = new THREE.DirectionalLight(0xdfe8ff, 0.5); fill.position.set(-2, 1, 3); scene.add(fill);

// pavimento con ombra morbida + cerchio "vitruviano"
{
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const gr = g.createRadialGradient(256, 256, 10, 256, 256, 250);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(201,154,99,0.35)'; g.lineWidth = 2; g.beginPath(); g.arc(256, 256, 236, 0, Math.PI * 2); g.stroke();
  g.strokeRect(256 - 150, 256 - 150, 300, 300);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.001; scene.add(floor);
}

const skinMat = new THREE.MeshStandardMaterial({ color: 0xd8a585, roughness: 0.62, metalness: 0 });
const wireMat = new THREE.MeshBasicMaterial({ color: 0x2b1d12, wireframe: true, transparent: true, opacity: 0.35 });

let engine, sub, geoLow, geoHi, mesh, wire, smoothBuf;
let bodyHeight = 1.75; // metri, dopo scala

function makeGeometry(nv, quads) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setIndex(new THREE.BufferAttribute(quadsToTris(quads), 1));
  return g;
}

// ---------------- calcolo forma ----------------
function weights() {
  const w = macroWeights({ ...state.macro, race: state.race });
  for (const sec of SECTIONS) for (const it of sec.items) {
    const v = state.mods[it.key]; if (!v) continue;
    const sides = it.sided ? ['l', 'r'] : [''];
    for (const s of sides) {
      const val = it.sided ? (v[s] || 0) : v; if (!val) continue;
      const t = targetNames(it, s);
      const name = val < 0 ? t.neg : t.pos;
      w.set(name, (w.get(name) || 0) + Math.abs(val));
    }
  }
  return w;
}

let pending = false;
function requestUpdate() { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; updateBody(); }); } }

function updateBody() {
  const P = engine.compute(weights());
  const nb = engine.nbody;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < nb; i++) { const y = P[i * 3 + 1]; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const naturalCm = (maxY - minY) * 10;
  const targetCm = state.height || naturalCm;
  const s = 0.1 * targetCm / naturalCm; // dm -> m con scala altezza
  bodyHeight = targetCm / 100;
  const src = state.smooth ? sub.apply(P, smoothBuf) : P;
  const geo = state.smooth ? geoHi : geoLow;
  const arr = geo.attributes.position.array, n = arr.length / 3;
  for (let i = 0; i < n; i++) {
    arr[i * 3] = src[i * 3] * s; arr[i * 3 + 1] = (src[i * 3 + 1] - minY) * s; arr[i * 3 + 2] = src[i * 3 + 2] * s;
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals(); geo.computeBoundingSphere();
  if (mesh.geometry !== geo) { mesh.geometry = geo; wire.geometry = geo; }
  $('#heightOut').textContent = Math.round(targetCm) + ' cm';
  const hs = document.querySelector('#sl-height'); if (hs) { hs.querySelector('input').value = targetCm; hs.querySelector('.val').textContent = Math.round(targetCm) + ' cm'; hs.classList.toggle('changed', !!state.height); }
  save();
}

// ---------------- viste ----------------
function setView(which, instant) {
  const h = bodyHeight, c = new THREE.Vector3(0, h * 0.52, 0), d = h * 2.7;
  const pos = { front: [0, h * 0.55, d], back: [0, h * 0.55, -d], side: [d, h * 0.55, 0] }[which];
  const from = camera.position.clone(), to = new THREE.Vector3(...pos);
  const tf = controls.target.clone();
  if (instant) { camera.position.copy(to); controls.target.copy(c); controls.update(); return; }
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / 450), e = 1 - Math.pow(1 - k, 3);
    camera.position.lerpVectors(from, to, e); controls.target.lerpVectors(tf, c, e); controls.update();
    if (k < 1) requestAnimationFrame(step);
  };
  step();
}

// ---------------- interfaccia ----------------
function fmtSigned(v) { const p = Math.round(v * 100); return (p > 0 ? '+' : '') + p + '%'; }

function slider({ id, label, min, max, step, value, fmt, onInput, onReset, changed }) {
  const el = document.createElement('div'); el.className = 'sl' + (changed ? ' changed' : ''); if (id) el.id = id;
  el.innerHTML = `<div class="sl-top"><span class="lab"></span><span class="val"></span></div><input type="range">`;
  el.querySelector('.lab').textContent = label;
  const inp = el.querySelector('input'); Object.assign(inp, { min, max, step, value });
  const val = el.querySelector('.val'); val.textContent = fmt(+value);
  inp.addEventListener('input', () => { val.textContent = fmt(+inp.value); onInput(+inp.value, el); });
  // doppio tocco sull'etichetta = azzera
  let last = 0;
  el.querySelector('.sl-top').addEventListener('pointerup', () => {
    const now = Date.now(); if (now - last < 350) { const v = onReset(); inp.value = v; val.textContent = fmt(v); el.classList.remove('changed'); } last = now;
  });
  return el;
}

function modSlider(it) {
  const wrap = document.createElement('div');
  const get = s => { const v = state.mods[it.key]; return it.sided ? ((v && v[s]) || 0) : (v || 0); };
  const set = (s, x) => {
    if (it.sided) {
      const v = state.mods[it.key] || { l: 0, r: 0 };
      if (state.sym) { v.l = x; v.r = x; } else v[s] = x;
      state.mods[it.key] = v;
    } else state.mods[it.key] = x;
    requestUpdate(); refreshCounts();
  };
  const mk = (s, lab) => slider({
    label: lab, min: -1, max: 1, step: 0.01, value: get(s), fmt: fmtSigned, changed: !!get(s),
    onInput: (x, el) => { set(s, x); el.classList.toggle('changed', x !== 0); },
    onReset: () => { set(s, 0); return 0; },
  });
  if (it.sided && !state.sym) {
    wrap.appendChild(mk('l', it.label + ' · sinistro'));
    wrap.appendChild(mk('r', it.label + ' · destro'));
  } else wrap.appendChild(mk('l', it.label));
  return wrap;
}
function syncTwins() { }

function buildPanel() {
  const root = $('#sections'); root.innerHTML = '';
  const openIds = JSON.parse(sessionStorage.getItem('dv.open') || '["generale"]');
  const mkSec = (id, title) => {
    const d = document.createElement('details'); d.className = 'sec'; d.dataset.id = id; d.open = openIds.includes(id);
    d.innerHTML = `<summary><span></span><span class="count"></span></summary><div class="sec-body"></div>`;
    d.querySelector('summary span').textContent = title;
    d.addEventListener('toggle', () => {
      const ids = [...document.querySelectorAll('.sec[open]')].map(x => x.dataset.id);
      sessionStorage.setItem('dv.open', JSON.stringify(ids));
    });
    root.appendChild(d); return d.querySelector('.sec-body');
  };
  // Generale
  const g = mkSec('generale', 'Generale');
  for (const m of MACRO) g.appendChild(slider({
    label: m.label, min: 0, max: 1, step: 0.01, value: state.macro[m.id], fmt: m.fmt, changed: state.macro[m.id] !== m.def,
    onInput: (v, el) => { state.macro[m.id] = v; el.classList.toggle('changed', v !== m.def); if (m.id === 'gender') syncSex(); requestUpdate(); },
    onReset: () => { state.macro[m.id] = m.def; if (m.id === 'gender') syncSex(); requestUpdate(); return m.def; },
  }));
  g.appendChild(slider({
    id: 'sl-height', label: 'Altezza', min: 140, max: 215, step: 0.5, value: state.height || 175, fmt: v => Math.round(v) + ' cm', changed: !!state.height,
    onInput: v => { state.height = v; requestUpdate(); },
    onReset: () => { state.height = null; requestUpdate(); return 175; },
  }));
  const h = document.createElement('p'); h.className = 'hint'; h.textContent = 'Origine (corporatura di base). Doppio tocco su un nome per azzerarlo.'; g.appendChild(h);
  for (const r of RACES) g.appendChild(slider({
    label: r.label, min: 0, max: 1, step: 0.01, value: state.race[r.id], fmt: v => Math.round(v * 100) + '%', changed: r.id === 'caucasian' ? state.race[r.id] !== 1 : state.race[r.id] !== 0,
    onInput: v => { state.race[r.id] = v; requestUpdate(); },
    onReset: () => { const d = r.id === 'caucasian' ? 1 : 0; state.race[r.id] = d; requestUpdate(); return d; },
  }));
  // Parti del corpo
  for (const sec of SECTIONS) {
    const b = mkSec(sec.id, sec.title);
    for (const it of sec.items) b.appendChild(modSlider(it));
  }
  refreshCounts();
}
function refreshCounts() {
  for (const sec of SECTIONS) {
    const n = sec.items.filter(it => { const v = state.mods[it.key]; return it.sided ? v && (v.l || v.r) : v; }).length;
    const el = document.querySelector(`.sec[data-id="${sec.id}"] .count`); if (el) el.textContent = n ? n + ' modificati' : '';
  }
}
function syncSex() {
  document.querySelectorAll('#sexSeg button').forEach(b => b.classList.toggle('on', Math.round(state.macro.gender) === +b.dataset.v));
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1800); }

function wireUI() {
  document.querySelectorAll('#sexSeg button').forEach(b => b.addEventListener('click', () => {
    state.macro.gender = +b.dataset.v; syncSex(); buildPanel(); requestUpdate();
  }));
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $('#panelBtn').addEventListener('click', () => { document.body.classList.toggle('panel-closed'); setTimeout(resize, 280); });
  const sym = $('#symTg'); sym.checked = state.sym;
  sym.addEventListener('change', () => {
    state.sym = sym.checked;
    if (state.sym) for (const k in state.mods) { const v = state.mods[k]; if (v && typeof v === 'object') { const m = (v.l + v.r) / 2; v.l = v.r = m; } }
    buildPanel(); requestUpdate(); toast(state.sym ? 'Simmetria attiva: sinistro e destro insieme' : 'Ora puoi regolare sinistro e destro separati');
  });
  const sm = $('#smoothTg'); sm.checked = state.smooth; sm.addEventListener('change', () => { state.smooth = sm.checked; requestUpdate(); });
  const wr = $('#wireTg'); wr.checked = state.wire; wire.visible = state.wire; wr.addEventListener('change', () => { state.wire = wr.checked; wire.visible = state.wire; save(); });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Azzero tutte le regolazioni del corpo?')) return;
    const keep = { sym: state.sym, smooth: state.smooth, wire: state.wire };
    state = Object.assign(defaultState(), keep); syncSex(); buildPanel(); requestUpdate();
  });
}

function resize() {
  const r = canvas.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);

// ---------------- avvio ----------------
(async function init() {
  engine = await loadBodyData('data/');
  const q = engine.quads;
  sub = buildSubdivision(q, engine.nbody);
  smoothBuf = new Float32Array(sub.n * 3);
  geoLow = makeGeometry(engine.nbody, q);
  geoHi = makeGeometry(sub.n, sub.quads);
  mesh = new THREE.Mesh(geoLow, skinMat); scene.add(mesh);
  wire = new THREE.Mesh(geoLow, wireMat); wire.visible = false; scene.add(wire);
  if (window.matchMedia('(max-aspect-ratio: 1/1)').matches) document.body.classList.add('panel-closed');
  buildPanel(); wireUI(); syncSex();
  resize(); updateBody(); setView('front', true);
  $('#loading').classList.add('hide');
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
})().catch(e => { console.error(e); $('#loading p').textContent = 'Errore nel caricamento: ' + e.message; });

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
