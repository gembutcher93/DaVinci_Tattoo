// Foto del cliente come sfondo (fronte / retro / lato), calibrazione con l'altezza e misure.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const VIEWS = {
  front: { label: 'Fronte', dir: [0, 0, 1], plane: [0, 0, -0.6], rotY: 0 },
  back: { label: 'Retro', dir: [0, 0, -1], plane: [0, 0, 0.6], rotY: Math.PI },
  side: { label: 'Lato', dir: [1, 0, 0], plane: [-0.6, 0, 0], rotY: Math.PI / 2 },
};

// ---- archivio foto (IndexedDB) ----
const DB = 'davinci-foto';
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('foto');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbPut(k, v) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('foto', 'readwrite'); v == null ? t.objectStore('foto').delete(k) : t.objectStore('foto').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
async function idbGet(k) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('foto').objectStore('foto').get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); }

// riduce la foto a max 2048 px (rispetta l'orientamento EXIF)
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(res, 'image/jpeg', 0.9));
  } finally { URL.revokeObjectURL(url); }
}
async function blobToTexture(blob) {
  const url = URL.createObjectURL(blob);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  t.userData.url = url; t.userData.aspect = img.naturalWidth / img.naturalHeight;
  return t;
}

export function createPhotoTool({ scene, canvas, overlay, state, save, toast, getHeight, onMode, skinMat, hideInPhoto }) {
  if (!state.photo) state.photo = {};
  const P = state.photo;
  P.views = P.views || {}; P.opacity ??= 0.85; P.model ??= 0.55; P.measures = P.measures || { front: [], back: [], side: [] };

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 30);
  const ctl = new OrbitControls(cam, canvas);
  ctl.enableRotate = false; ctl.enableDamping = true; ctl.dampingFactor = 0.15;
  ctl.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  ctl.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  ctl.screenSpacePanning = true; ctl.minZoom = 0.5; ctl.maxZoom = 12; ctl.enabled = false;

  const groups = {}, meshes = {}, tex = {};
  for (const [k, v] of Object.entries(VIEWS)) {
    const g = new THREE.Group(); g.position.set(...v.plane); g.rotation.y = v.rotY; g.visible = false; scene.add(g);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: P.opacity, depthWrite: false, toneMapped: false }));
    m.visible = false; g.add(m); groups[k] = g; meshes[k] = m;
  }

  const api = { active: false, view: 'front', camera: cam, controls: ctl, mode: 'none', taps: [] };

  function applyTransform(k) {
    const t = P.views[k], m = meshes[k]; if (!t || !tex[k]) { m.visible = false; return; }
    m.visible = true; m.position.set(t.x, t.y, 0); m.rotation.z = t.r;
    m.scale.set(t.s * t.aspect, t.s, 1); m.material.map = tex[k]; m.material.opacity = P.opacity; m.material.needsUpdate = true;
  }

  async function load() {
    for (const k of Object.keys(VIEWS)) {
      try { const b = await idbGet(k); if (b) { tex[k] = await blobToTexture(b); applyTransform(k); } } catch (e) { }
    }
    api.onChange?.();
  }

  api.setPhoto = async (k, file) => {
    const blob = await shrink(file);
    if (tex[k]) { URL.revokeObjectURL(tex[k].userData.url); tex[k].dispose(); }
    tex[k] = await blobToTexture(blob);
    const H = getHeight();
    P.views[k] = { x: 0, y: H * 0.52, s: H * 1.15, r: 0, aspect: tex[k].userData.aspect, cal: false };
    applyTransform(k); save();
    try { await idbPut(k, blob); } catch (e) { toast('Foto caricata, ma non salvata sul dispositivo'); }
    api.onChange?.();
  };
  api.removePhoto = async k => {
    if (tex[k]) { URL.revokeObjectURL(tex[k].userData.url); tex[k].dispose(); delete tex[k]; }
    delete P.views[k]; P.measures[k] = []; meshes[k].visible = false; save();
    try { await idbPut(k, null); } catch (e) { }
    api.onChange?.();
  };
  api.has = k => !!tex[k];
  // l'altezza del modello è cambiata: le foto calibrate seguono (restano in scala reale)
  api.rescale = f => {
    for (const k of Object.keys(P.views)) { const t = P.views[k]; if (!t.cal) continue; t.x *= f; t.y *= f; t.s *= f; applyTransform(k); }
    for (const k of Object.keys(P.measures)) P.measures[k] = P.measures[k].map(m => m.map(p => p.map(c => c * f)));
    save();
  };
  api.thumb = k => tex[k]?.userData.url;
  api.calibrated = k => !!P.views[k]?.cal;

  function frame() {
    const r = canvas.getBoundingClientRect(), a = r.width / Math.max(1, r.height);
    const H = getHeight(), h = H * 1.4;
    cam.top = h / 2; cam.bottom = -h / 2; cam.left = -h * a / 2; cam.right = h * a / 2; cam.updateProjectionMatrix();
  }
  api.resize = frame;

  api.setView = (k) => {
    api.view = k; const v = VIEWS[k], H = getHeight();
    for (const g of Object.keys(groups)) groups[g].visible = api.active && g === k;
    const c = new THREE.Vector3(0, H * 0.44, 0);
    cam.position.copy(c).addScaledVector(new THREE.Vector3(...v.dir), 6); cam.zoom = 1;
    ctl.target.copy(c); cam.lookAt(c); frame(); ctl.update();
    setMode('none'); api.onChange?.();
  };

  api.enter = (k = api.view) => {
    api.active = true; ctl.enabled = true; hideInPhoto.forEach(o => o.visible = false);
    skinMat.transparent = true; skinMat.opacity = P.model; skinMat.needsUpdate = true;
    api.setView(k); onMode(true);
  };
  api.exit = () => {
    api.active = false; ctl.enabled = false; setMode('none');
    for (const g of Object.values(groups)) g.visible = false;
    hideInPhoto.forEach(o => o.visible = true);
    skinMat.transparent = false; skinMat.opacity = 1; skinMat.needsUpdate = true;
    onMode(false); api.onChange?.();
  };
  api.setOpacity = v => { P.opacity = v; for (const m of Object.values(meshes)) m.material.opacity = v; save(); };
  api.setModelOpacity = v => { P.model = v; if (api.active) { skinMat.opacity = v; } save(); };

  // ---- modalità di tocco: none | move | calib | measure ----
  function setMode(m) {
    api.mode = m; api.taps = []; ctl.enabled = api.active && m === 'none';
    api.onMode?.(m);
  }
  api.setMode = m => {
    if (m !== 'none' && !tex[api.view]) { toast('Carica prima la foto ' + VIEWS[api.view].label.toLowerCase()); return; }
    setMode(api.mode === m ? 'none' : m);
  };
  api.clearMeasures = () => { P.measures[api.view] = []; save(); };

  // punto toccato sul piano della foto (coordinate locali del gruppo)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane();
  function hit(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const g = groups[api.view]; g.updateMatrixWorld();
    const n = new THREE.Vector3(...VIEWS[api.view].dir); plane.setFromNormalAndCoplanarPoint(n, g.getWorldPosition(new THREE.Vector3()));
    const w = new THREE.Vector3(); if (!ray.ray.intersectPlane(plane, w)) return null;
    return { world: w, local: g.worldToLocal(w.clone()) };
  }

  const ptrs = new Map(); let start = null;
  function snapshot() {
    const pts = [...ptrs.values()].map(p => p.local.clone());
    return { pts, t: { ...P.views[api.view] } };
  }
  canvas.addEventListener('pointerdown', e => {
    if (!api.active || api.mode === 'none') return;
    const h = hit(e); if (!h) return;
    e.preventDefault(); canvas.setPointerCapture?.(e.pointerId);
    if (api.mode === 'move') { ptrs.set(e.pointerId, h); start = snapshot(); return; }
    api.taps.push(h.world.clone());
    if (api.mode === 'calib' && api.taps.length === 2) finishCalib();
    if (api.mode === 'measure' && api.taps.length === 2) {
      const [a, b] = api.taps; P.measures[api.view].push([a.toArray(), b.toArray()]); api.taps = []; save();
      toast('Misura: ' + (a.distanceTo(b) * 100).toFixed(1) + ' cm');
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (api.mode !== 'move' || !ptrs.has(e.pointerId)) return;
    const h = hit(e); if (!h) return; ptrs.set(e.pointerId, h);
    const t0 = start.t, now = [...ptrs.values()].map(p => p.local), was = start.pts;
    const t = P.views[api.view];
    if (now.length === 1 || was.length === 1) {
      t.x = t0.x + now[0].x - was[0].x; t.y = t0.y + now[0].y - was[0].y;
    } else {
      const d0 = new THREE.Vector2(was[1].x - was[0].x, was[1].y - was[0].y), d1 = new THREE.Vector2(now[1].x - now[0].x, now[1].y - now[0].y);
      const k = d1.length() / Math.max(1e-6, d0.length()), a = Math.atan2(d1.y, d1.x) - Math.atan2(d0.y, d0.x);
      const pc = new THREE.Vector2((was[0].x + was[1].x) / 2, (was[0].y + was[1].y) / 2), qc = new THREE.Vector2((now[0].x + now[1].x) / 2, (now[0].y + now[1].y) / 2);
      const v = new THREE.Vector2(t0.x - pc.x, t0.y - pc.y).rotateAround(new THREE.Vector2(), a).multiplyScalar(k);
      t.x = qc.x + v.x; t.y = qc.y + v.y; t.s = t0.s * k; t.r = t0.r + a;
    }
    applyTransform(api.view);
  });
  const up = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId); start = ptrs.size ? snapshot() : null;
    if (!ptrs.size) { P.views[api.view].cal = false; save(); }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

  // calibrazione: tocco 1 = punta della testa, tocco 2 = pianta dei piedi
  function finishCalib() {
    const g = groups[api.view];
    const [a, b] = api.taps.map(w => g.worldToLocal(w.clone()));
    const H = getHeight();
    const t = P.views[api.view];
    const s0 = new THREE.Vector2(a.x - b.x, a.y - b.y), d = new THREE.Vector2(0, H);
    const k = d.length() / Math.max(1e-6, s0.length());
    const ang = Math.atan2(d.y, d.x) - Math.atan2(s0.y, s0.x);
    const v = new THREE.Vector2(t.x - b.x, t.y - b.y).rotateAround(new THREE.Vector2(), ang).multiplyScalar(k);
    t.x = v.x; t.y = v.y; t.s *= k; t.r += ang; t.cal = true;
    applyTransform(api.view); save(); setMode('none');
    toast(`Foto ${VIEWS[api.view].label.toLowerCase()} calibrata su ${Math.round(H * 100)} cm`);
    api.onChange?.();
  }

  // ---- disegno misure e tocchi (canvas 2D sopra il 3D) ----
  const g2 = overlay.getContext('2d');
  api.draw = () => {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
    if (overlay.width !== Math.round(r.width * dpr) || overlay.height !== Math.round(r.height * dpr)) { overlay.width = Math.round(r.width * dpr); overlay.height = Math.round(r.height * dpr); }
    g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.clearRect(0, 0, r.width, r.height);
    if (!api.active) return;
    const scr = w => { const v = new THREE.Vector3(...w).project(cam); return [(v.x + 1) / 2 * r.width, (1 - v.y) / 2 * r.height]; };
    g2.font = '600 14px -apple-system, sans-serif'; g2.lineWidth = 2;
    for (const [a, b] of P.measures[api.view] || []) {
      const A = scr(a), B = scr(b);
      g2.strokeStyle = '#ffcc4d'; g2.beginPath(); g2.moveTo(...A); g2.lineTo(...B); g2.stroke();
      for (const p of [A, B]) { g2.fillStyle = '#ffcc4d'; g2.beginPath(); g2.arc(p[0], p[1], 4, 0, 7); g2.fill(); }
      const cm = (new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b)) * 100).toFixed(1) + ' cm';
      const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, tw = g2.measureText(cm).width;
      g2.fillStyle = 'rgba(0,0,0,.75)'; g2.fillRect(mx + 8, my - 11, tw + 12, 22);
      g2.fillStyle = '#ffcc4d'; g2.fillText(cm, mx + 14, my + 5);
    }
    for (const w of api.taps) {
      const p = scr(w.toArray()); g2.strokeStyle = api.mode === 'calib' ? '#5ad1ff' : '#ffcc4d';
      g2.beginPath(); g2.arc(p[0], p[1], 9, 0, 7); g2.stroke();
      g2.beginPath(); g2.moveTo(p[0] - 14, p[1]); g2.lineTo(p[0] + 14, p[1]); g2.moveTo(p[0], p[1] - 14); g2.lineTo(p[0], p[1] + 14); g2.stroke();
    }
    if (api.mode === 'calib') {
      // righe guida: testa e piedi del modello
      const H = getHeight(), dir = VIEWS[api.view].dir;
      for (const y of [0, H]) {
        const A = scr(dir[0] ? [0, y, -1] : [-1, y, 0]), B = scr(dir[0] ? [0, y, 1] : [1, y, 0]);
        g2.setLineDash([6, 6]); g2.strokeStyle = 'rgba(90,209,255,.6)'; g2.beginPath(); g2.moveTo(...A); g2.lineTo(...B); g2.stroke(); g2.setLineDash([]);
      }
    }
  };

  load();
  return api;
}
