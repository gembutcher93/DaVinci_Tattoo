"""Pack MakeHuman CC0 base mesh + selected targets into compact binaries for the web app."""
import gzip, json, os, glob, struct
import numpy as np
RAW = '/home/claude/dv/raw'; SRC = '/home/claude/sh/src/base.obj'; OUT = '/home/claude/dv/app/data'
V = []; groups = {}; cur = None; VT = []; FT = {}
for l in open(SRC):
    if l.startswith('v '): V.append([float(t) for t in l.split()[1:4]])
    elif l.startswith('g '): cur = l.split()[1]
    elif l.startswith('f '):
        groups.setdefault(cur, []).append([int(t.split('/')[0]) - 1 for t in l.split()[1:]])
V = np.array(V, np.float32)
body = groups['body'] + groups['helper-l-eye'] + groups['helper-r-eye']
keep = sorted(set(i for f in body for i in f))
nbody = len(keep)
joints = {g[6:]: sorted(set(i for f in fs for i in f)) for g, fs in groups.items() if g.startswith('joint-')}
for g, idx in joints.items():
    for i in idx:
        if i not in keep: keep.append(i)
remap = -np.ones(len(V), np.int64); remap[keep] = np.arange(len(keep))
assert len(keep) < 65536
faces = np.array([[remap[i] for i in f] for f in body], np.uint16)
pos = V[keep]
with open(f'{OUT}/base.bin', 'wb') as fh:
    fh.write(pos.astype('<f4').tobytes()); fh.write(faces.astype('<u2').tobytes())
jmap = {g: [int(remap[i]) for i in idx] for g, idx in joints.items()}
json.dump(dict(nv=len(keep), nbody=nbody, nf=len(faces), joints=jmap, units='dm'), open(f'{OUT}/base.json', 'w'))

SCALE = 1e-4
manifest = []; blob = bytearray()
for f in sorted(glob.glob(f'{RAW}/**/*.target.gz', recursive=True)):
    name = os.path.relpath(f, RAW)[:-10]
    rows = [l.split() for l in gzip.open(f, 'rt') if l[0] != '#' and l.strip()]
    idx = []; d = []
    for r in rows:
        i = int(r[0])
        if remap[i] < 0: continue
        idx.append(remap[i]); d.append([float(x) for x in r[1:4]])
    if not idx:
        manifest.append(dict(name=name, off=0, n=0)); continue
    idx = np.array(idx, '<u2'); d = np.round(np.array(d) / SCALE).astype('<i2')
    off = len(blob)
    blob += idx.tobytes(); blob += d.tobytes()
    manifest.append(dict(name=name, off=off, n=len(idx)))
open(f'{OUT}/targets.bin', 'wb').write(blob)
json.dump(dict(scale=SCALE, targets=manifest), open(f'{OUT}/targets.json', 'w'))
print('verts', len(keep), 'body', nbody, 'faces', len(faces), 'targets', len(manifest), 'bytes', len(blob))
