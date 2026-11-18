// Motore del corpo: carica mesh base + target e calcola la forma.
export async function loadBodyData(base = 'data/') {
  const [bj, bb, tj, tb] = await Promise.all([
    fetch(base + 'base.json').then(r => r.json()),
    fetch(base + 'base.bin').then(r => r.arrayBuffer()),
    fetch(base + 'targets.json').then(r => r.json()),
    fetch(base + 'targets.bin').then(r => r.arrayBuffer()),
  ]);
  const pos = new Float32Array(bb, 0, bj.nv * 3);
  const quads = new Uint16Array(bb, bj.nv * 12, bj.nf * 4);
  const targets = new Map();
  for (const t of tj.targets) {
    if (!t.n) { targets.set(t.name, null); continue; }
    targets.set(t.name, {
      idx: new Uint16Array(tb, t.off, t.n),
      d: new Int16Array(tb, t.off + t.n * 2, t.n * 3),
    });
  }
  return new BodyEngine(bj, pos, quads, targets, tj.scale);
}

export class BodyEngine {
  constructor(meta, pos, quads, targets, scale) {
    this.meta = meta; this.base = pos; this.quads = quads; this.targets = targets; this.scale = scale;
    this.nv = meta.nv; this.nbody = meta.nbody;
    this.out = new Float32Array(pos.length);
  }
  has(name) { return this.targets.has(name); }
  // weights: Map(nome target -> peso)
  compute(weights) {
    const o = this.out; o.set(this.base);
    for (const [name, w] of weights) {
      if (!w) continue;
      const t = this.targets.get(name);
      if (!t) continue;
      const k = w * this.scale, idx = t.idx, d = t.d;
      for (let i = 0, n = idx.length; i < n; i++) {
        const v = idx[i] * 3, j = i * 3;
        o[v] += d[j] * k; o[v + 1] += d[j + 1] * k; o[v + 2] += d[j + 2] * k;
      }
    }
    return o;
  }
  joint(name, P = this.out) {
    const ids = this.meta.joints[name]; let x = 0, y = 0, z = 0;
    for (const i of ids) { x += P[i * 3]; y += P[i * 3 + 1]; z += P[i * 3 + 2]; }
    return [x / ids.length, y / ids.length, z / ids.length];
  }
}

// Catmull-Clark (1 livello) precalcolato come matrice sparsa: nuovo = S * vecchio
export function buildSubdivision(quads, nverts) {
  const nf = quads.length / 4;
  const edgeKey = (a, b) => a < b ? a * 65536 + b : b * 65536 + a;
  const edges = new Map(); // key -> {a,b,faces:[]}
  const vFaces = Array.from({ length: nverts }, () => []);
  const vEdges = Array.from({ length: nverts }, () => []);
  for (let f = 0; f < nf; f++) {
    for (let k = 0; k < 4; k++) {
      const a = quads[f * 4 + k], b = quads[f * 4 + (k + 1) % 4];
      const key = edgeKey(a, b);
      let e = edges.get(key);
      if (!e) { e = { a, b, faces: [], id: edges.size }; edges.set(key, e); vEdges[a].push(e); vEdges[b].push(e); }
      e.faces.push(f);
      vFaces[a].push(f);
    }
  }
  const E = [...edges.values()];
  const nNew = nverts + E.length + nf;
  const rows = [];
  const add = (m, i, w) => m.set(i, (m.get(i) || 0) + w);
  const facePt = (m, f, w) => { for (let k = 0; k < 4; k++) add(m, quads[f * 4 + k], w / 4); };
  // vertici originali
  for (let v = 0; v < nverts; v++) {
    const m = new Map();
    const bnd = vEdges[v].filter(e => e.faces.length === 1);
    if (vEdges[v].length === 0) { add(m, v, 1); }
    else if (bnd.length >= 2) {
      add(m, v, 6 / 8);
      for (const e of bnd.slice(0, 2)) add(m, e.a === v ? e.b : e.a, 1 / 8);
    } else {
      const n = vEdges[v].length;
      // Q = media punti faccia, R = media punti medi spigoli
      for (const f of vFaces[v]) facePt(m, f, 1 / (vFaces[v].length) / n);
      for (const e of vEdges[v]) { add(m, e.a, 2 / n / n / 2); add(m, e.b, 2 / n / n / 2); }
      add(m, v, (n - 3) / n);
    }
    rows.push(m);
  }
  for (const e of E) {
    const m = new Map();
    if (e.faces.length === 2) { add(m, e.a, 0.25); add(m, e.b, 0.25); facePt(m, e.faces[0], 0.25); facePt(m, e.faces[1], 0.25); }
    else { add(m, e.a, 0.5); add(m, e.b, 0.5); }
    rows.push(m);
  }
  for (let f = 0; f < nf; f++) { const m = new Map(); facePt(m, f, 1); rows.push(m); }
  // CSR
  let nnz = 0; for (const r of rows) nnz += r.size;
  const ptr = new Uint32Array(nNew + 1), col = new Uint32Array(nnz), val = new Float32Array(nnz);
  let p = 0;
  rows.forEach((r, i) => { ptr[i] = p; for (const [c, w] of r) { col[p] = c; val[p] = w; p++; } });
  ptr[nNew] = p;
  // nuove facce (quad -> 4 quad)
  const nq = new Uint32Array(nf * 16);
  for (let f = 0; f < nf; f++) {
    const fp = nverts + E.length + f;
    for (let k = 0; k < 4; k++) {
      const v = quads[f * 4 + k];
      const eNext = edges.get(edgeKey(v, quads[f * 4 + (k + 1) % 4])).id + nverts;
      const ePrev = edges.get(edgeKey(quads[f * 4 + (k + 3) % 4], v)).id + nverts;
      nq.set([v, eNext, fp, ePrev], (f * 4 + k) * 4);
    }
  }
  return {
    n: nNew, quads: nq,
    apply(src, dst) {
      for (let i = 0; i < nNew; i++) {
        let x = 0, y = 0, z = 0;
        for (let q = ptr[i]; q < ptr[i + 1]; q++) { const c = col[q] * 3, w = val[q]; x += src[c] * w; y += src[c + 1] * w; z += src[c + 2] * w; }
        dst[i * 3] = x; dst[i * 3 + 1] = y; dst[i * 3 + 2] = z;
      }
      return dst;
    }
  };
}

export function quadsToTris(q) {
  const t = new Uint32Array(q.length / 4 * 6);
  for (let i = 0, j = 0; i < q.length; i += 4, j += 6) {
    t[j] = q[i]; t[j + 1] = q[i + 1]; t[j + 2] = q[i + 2];
    t[j + 3] = q[i]; t[j + 4] = q[i + 2]; t[j + 5] = q[i + 3];
  }
  return t;
}
