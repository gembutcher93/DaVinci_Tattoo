// Definizione dei comandi del corpo (target MakeHuman, licenza CC0).
// key: nome base del target nella cartella "cat" (senza -decr/-incr)
// sided: true se esiste la versione sinistra (l-) e destra (r-)
// neg/pos: suffissi dei due target opposti

const D = (cat, key, label, sided = false, neg = 'decr', pos = 'incr') => ({ cat, key, label, sided, neg, pos });

export const SECTIONS = [
  {
    id: 'braccia', title: 'Braccia', items: [
      D('arms', 'measure-upperarm-length', 'Lunghezza braccio (spalla-gomito)'),
      D('arms', 'measure-lowerarm-length', 'Lunghezza avambraccio'),
      D('arms', 'measure-upperarm-circ', 'Circonferenza braccio'),
      D('arms', 'upperarm-shoulder-muscle', 'Deltoide (spalla)', true),
      D('arms', 'upperarm-muscle', 'Muscolo braccio', true),
      D('arms', 'upperarm-fat', 'Grasso braccio', true),
      D('arms', 'upperarm-scale-horiz', 'Larghezza braccio', true),
      D('arms', 'upperarm-scale-depth', 'Spessore braccio', true),
      D('arms', 'lowerarm-muscle', 'Muscolo avambraccio', true),
      D('arms', 'lowerarm-fat', 'Grasso avambraccio', true),
      D('arms', 'lowerarm-scale-horiz', 'Larghezza avambraccio', true),
      D('arms', 'lowerarm-scale-depth', 'Spessore avambraccio', true),
    ]
  },
  {
    id: 'mani', title: 'Mani e polsi', items: [
      D('hands', 'measure-wrist-circ', 'Circonferenza polso'),
      D('hands', 'hand-scale', 'Dimensione mano', true),
      D('hands', 'hand-fingers-length', 'Lunghezza dita', true),
      D('hands', 'hand-fingers-diameter', 'Spessore dita', true),
      D('hands', 'hand-fingers-distance', 'Distanza tra le dita', true),
    ]
  },
  {
    id: 'gambe', title: 'Gambe', items: [
      D('legs', 'measure-upperleg-height', 'Lunghezza coscia'),
      D('legs', 'measure-lowerleg-height', 'Lunghezza tibia'),
      D('legs', 'measure-thigh-circ', 'Circonferenza coscia'),
      D('legs', 'measure-knee-circ', 'Circonferenza ginocchio'),
      D('legs', 'measure-calf-circ', 'Circonferenza polpaccio'),
      D('feet', 'measure-ankle-circ', 'Circonferenza caviglia'),
      D('legs', 'upperleg-muscle', 'Muscolo coscia', true),
      D('legs', 'upperleg-fat', 'Grasso coscia', true),
      D('legs', 'upperleg-scale-horiz', 'Larghezza coscia', true),
      D('legs', 'upperleg-scale-depth', 'Spessore coscia', true),
      D('legs', 'lowerleg-muscle', 'Muscolo polpaccio', true),
      D('legs', 'lowerleg-fat', 'Grasso polpaccio', true),
      D('legs', 'lowerleg-scale-horiz', 'Larghezza polpaccio', true),
      D('legs', 'lowerleg-scale-depth', 'Spessore polpaccio', true),
      D('legs', 'leg-valgus', 'Gambe a O / a X', true),
      D('feet', 'foot-scale', 'Dimensione piede', true),
    ]
  },
  {
    id: 'busto', title: 'Busto e schiena', items: [
      D('torso', 'measure-shoulder-dist', 'Larghezza spalle'),
      D('torso', 'torso-muscle-pectoral', 'Pettorali'),
      D('torso', 'torso-muscle-dorsi', 'Dorsali'),
      D('torso', 'torso-vshape', 'Forma a V'),
      D('torso', 'measure-bust-circ', 'Circonferenza torace'),
      D('torso', 'measure-underbust-circ', 'Circonferenza sotto il petto'),
      D('torso', 'measure-waist-circ', 'Circonferenza vita'),
      D('torso', 'measure-frontchest-dist', 'Larghezza petto'),
      D('torso', 'torso-scale-horiz', 'Larghezza busto'),
      D('torso', 'torso-scale-depth', 'Spessore busto'),
      D('torso', 'measure-napetowaist-dist', 'Lunghezza schiena (nuca-vita)'),
      D('torso', 'measure-waisttohip-dist', 'Distanza vita-fianchi'),
    ]
  },
  {
    id: 'addome', title: 'Addome, fianchi e glutei', items: [
      D('stomach', 'stomach-pregnant', 'Pancia'),
      D('stomach', 'stomach-tone', 'Tono addominale'),
      D('torso', 'measure-hips-circ', 'Circonferenza fianchi'),
      D('hip', 'hip-scale-horiz', 'Larghezza bacino'),
      D('hip', 'hip-scale-depth', 'Spessore bacino'),
      D('hip', 'hip-waist', 'Altezza vita', false, 'down', 'up'),
      D('buttocks', 'buttocks-volume', 'Volume glutei'),
    ]
  },
  {
    id: 'seno', title: 'Seno', items: [
      D('breast', 'breast-point', 'Proiezione seno'),
      D('breast', 'breast-volume-vert', 'Forma (alto / basso)', false, 'down', 'up'),
      D('breast', 'breast-trans', 'Posizione (alto / basso)', false, 'down', 'up'),
      D('breast', 'breast-dist', 'Distanza tra i seni'),
    ]
  },
  {
    id: 'collo', title: 'Collo', items: [
      D('neck', 'measure-neck-circ', 'Circonferenza collo'),
      D('neck', 'measure-neck-height', 'Lunghezza collo'),
      D('neck', 'neck-scale-horiz', 'Larghezza collo'),
      D('neck', 'neck-scale-depth', 'Spessore collo'),
      D('neck', 'neck-back-scale-depth', 'Nuca'),
    ]
  },
];

// Comandi generali (macro). Valori 0..1
export const MACRO = [
  { id: 'gender', label: 'Donna ↔ Uomo', def: 1, fmt: v => v < 0.05 ? 'donna' : v > 0.95 ? 'uomo' : Math.round(v * 100) + '% uomo' },
  { id: 'age', label: 'Età', def: 0, fmt: v => Math.round(25 + v * 65) + ' anni' },
  { id: 'muscle', label: 'Muscolatura', def: 0.5, fmt: v => Math.round((v - 0.5) * 200) + '%' },
  { id: 'weight', label: 'Peso / massa grassa', def: 0.5, fmt: v => Math.round((v - 0.5) * 200) + '%' },
];
export const RACES = [
  { id: 'caucasian', label: 'Europea' },
  { id: 'african', label: 'Africana' },
  { id: 'asian', label: 'Asiatica' },
];

export function targetNames(item, side) {
  const pre = item.sided ? (side === 'l' ? 'l-' : 'r-') : '';
  return { neg: `${item.cat}/${pre}${item.key}-${item.neg}`, pos: `${item.cat}/${pre}${item.key}-${item.pos}` };
}

// pesi dei target "macro" secondo lo schema MakeHuman
export function macroWeights(m) {
  const out = new Map();
  const g = { female: 1 - m.gender, male: m.gender };
  const a = { young: 1 - m.age, old: m.age };
  const tri = v => v < 0.5 ? { min: 1 - 2 * v, average: 2 * v } : { average: 2 - 2 * v, max: 2 * v - 1 };
  const mu = tri(m.muscle), we = tri(m.weight);
  for (const [gk, gw] of Object.entries(g)) for (const [ak, aw] of Object.entries(a))
    for (const [mk, mw] of Object.entries(mu)) for (const [wk, ww] of Object.entries(we)) {
      const w = gw * aw * mw * ww;
      if (w > 1e-4) out.set(`macrodetails/universal-${gk}-${ak}-${mk}muscle-${wk}weight`, w);
    }
  const rs = RACES.reduce((s, r) => s + m.race[r.id], 0) || 1;
  for (const r of RACES) for (const [gk, gw] of Object.entries(g)) for (const [ak, aw] of Object.entries(a)) {
    const w = (m.race[r.id] / rs) * gw * aw;
    if (w > 1e-4) out.set(`macrodetails/${r.id}-${gk}-${ak}`, w);
  }
  return out;
}
