# Generative board · Claude × Supabase meetup

A live, multiplayer generative **board**. Audience members scan a QR code, tap
**join group: photo**, enter a name, and become a floating snapshot block in one shared
design-tool composition on black. Blocks are a *coupled* system: they drift and breathe,
push each other, and overlap — and where they overlap, the palette prints through.

Everything is a single self-contained file: [`index.html`](index.html). No build step.

## Run it

`getUserMedia` (camera) only works on `https://` or `localhost`, so serve the folder
rather than opening the file directly:

```bash
python3 -m http.server 8777
```

Then open:

- **Join view** (phones): `http://localhost:8777/index.html`
- **Host / big-screen view** (board + QR): `http://localhost:8777/index.html?host=1`

For real phones you need HTTPS — deploy the folder to any static host
(Netlify / Vercel / Cloudflare Pages / GitHub Pages) and share that URL. The QR on the
host view automatically encodes the current page URL minus `?host`.

## Enable the multiplayer layer (Supabase)

Without credentials the board runs fine locally (your own camera + placeholder blocks).
To make blocks appear across devices in real time, add your project keys near the top of
[`index.html`](index.html):

```js
const SUPABASE_URL = "https://xxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGci...";
```

That's all — it uses **Realtime broadcast + presence** only, so **no database tables,
schema, or RLS policies are required** (Realtime is on by default in new projects).
Presence makes blocks appear on join and vanish on leave; each client broadcasts its
latest snapshot (downscaled to 220px, JPEG ~q0.5) plus its name.

## The join flow

1. **join group: photo** → a name field (tag becomes `P0_` + your name; blank = random id).
2. Camera permission is requested; a still is captured every ~1.5s into your block.
3. **flip camera** toggles front/back (defaults to front, the most reliable).

If the camera is blocked you still join the board as a solid-ink block — just without a
photo.

### Demo / offline helpers
- Press **A** to add a placeholder block, **X** to remove one — handy for showing the
  coupled rebalancing and overlaps without a room full of phones.

## How the piece works

- **Coupled blocks** — each block springs toward a drifting "home" slot, breathes in
  anti-phase with its neighbours (so total area roughly holds), and softly shoves any
  block it overlaps, so pushes ripple through the field. Blocks are allowed to overlap.
- **Overlap = palette** — where two blocks cross, the intersection is painted opaque in
  a palette colour (solid, or a halftone dot screen in the two blocks' inks) *over* both
  photos, so it reads as a printed intersection. Overlaps are where the colour shows up
  strongest against the black.
- **Auto-adapt** — each participant is one block. As people join, blocks scale down and
  the system rebalances so everyone fits the field; as people leave, blocks ease larger.
  All size/position changes are eased, never snapped, and blocks never run off the field.
- **Chrome** (ivory on black): dashed extension lines drawn *only* where blocks cross,
  ivory corner handles, a few diagonal connectors + circles between handles, `P0_NAME`
  tags with the block's ink swatch, and small mono coordinate readouts.

## Palette

All generated graphics use these exclusively (camera photos are exempt): black `#141413`
(board), ivory `#FAF9F5`, clay `#D97757`, heather `#CBCADB`, plum `#827DBD`, cactus
`#BCD1CA`, mineral `#629987`, peach `#EBC9B7`, gray `#DEDCD1`. Each block is dealt one of
these as its "ink" on join. Gradients only from the three approved ramps (white → peach →
clay → orange; white → mineral → cactus; white → heather → plum).
