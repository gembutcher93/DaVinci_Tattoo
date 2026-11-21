# DaVinci Tattoo

Web app (PWA) per iPad e PC: corpo 3D modellabile sulle misure del cliente, da cui estrarre le mappe piatte dei blocchi da tatuare (per Procreate).

## Stato: v0.3 — tappa 1 completa, tappa 2 in corso (foto fronte/retro/lato, calibrazione, misure)
- [x] **1. Corpo**: uomo/donna, età, muscolatura, peso, altezza, origine + ~60 comandi per braccia, mani, gambe, busto, addome, seno, collo (sinistro/destro separati o in simmetria)
- [ ] 2. Foto fronte/lato come sfondo + misure col metro con adattamento automatico
- [ ] 3. Blocchi selezionabili (mano, avambraccio, braccio, spalla, collo, coscia…) e mappa piatta calcolata nell'app
- [ ] 4. Pelle (carnagioni, pori, rilievo, macchie con spunte e levette) ed esportazione .usdz / .obj / PNG / guida in cm

## Pubblicazione (GitHub + Cloudflare Pages)
Non c'è nessun passaggio di build: è un sito statico.
1. Carica **il contenuto di questa cartella** nella radice del repository (deve esserci `index.html` in cima)
2. Cloudflare → Workers & Pages → Crea → Pages → Collega a Git → scegli il repository
3. Impostazioni di build: **Framework preset: None**, **Build command: vuoto**, **Build output directory: `/`**
4. Salva e pubblica

## Installazione su iPad
Apri il link in **Safari** → tasto **Condividi** → **Aggiungi alla schermata Home**. Si apre a tutto schermo e funziona anche offline dopo la prima apertura.

## Uso
- Un dito (o la Pencil) ruota il modello, due dita zoom e spostamento
- Doppio tocco sul nome di un comando = lo riporta a zero
- "Simmetria sx/dx" spenta = comandi separati per lato sinistro e destro del cliente
- Le regolazioni restano salvate sul dispositivo

## Struttura
- `index.html`, `css/`, `js/` — app
- `data/` — corpo base e deformazioni (generati da `tools/pack.py` partendo da MakeHuman)
- `vendor/three/` — three.js r187 (MIT)

## Licenze
- Corpo base e deformazioni: **MakeHuman**, rilasciati in **CC0** (pubblico dominio, uso commerciale libero) — makehumancommunity.org
- three.js: licenza MIT (vedi `vendor/three/LICENSE`)
