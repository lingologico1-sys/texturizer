# Texturizer

A GPU-accelerated image texturizer. Upload an image and apply woven canvas,
paper, ink wash, clay, linocut, leather, slate, mosaic and other bump-mapped
textures in real time via WebGL2, then download the result as a PNG.

The whole app is a single self-contained Web Component (`<texturize-filter>`),
originally built as a Wix custom element and now hosted as a standalone site.
There is no backend — all processing happens in the browser on the GPU.

## Features

- 10 texture styles with per-style smart defaults, Concrete the newest
- Lighting (depth, light direction/elevation, shininess, ambient occlusion,
  Picture Relief: the drawing's own lines raised, or pressed in like letterpress;
  Light Pool: the light falls off across the picture from the side it comes from)
- Color grading (Lighten, brightness, contrast, saturation, Vibrance, paper tint,
  color-driven scale/depth)
- Effects (vignette, dye bleed, distressed, halftone, sharpness, color wash, preserve-skin,
  Glow: the whites bloom softly and the middle lifts, colours kept;
  Skin Light: preserved skin takes the drawing's relief and the scene's light, with no grain)
- Color masks: include/exclude specific picked colors from the effect
- Named presets (saved to `localStorage`), each with its colour masks
- Export / Import a preset as a file (`*.texturizer-preset.json`, format v1),
  to carry a look to another browser or into translator
- A mask preview that tints what the colour masks leave untextured
- Batch convert a whole folder to a downloaded `.zip` (JSZip loaded on demand)
- Last image + settings restored across reloads (IndexedDB / `localStorage`)

## Develop

```bash
npm install
npm run dev          # Vite dev server at http://localhost:5173
```

## Build

```bash
npm run build        # outputs static site to dist/
npm run preview      # preview the production build
```

## Deploy (Cloudflare Pages)

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and runs
`wrangler pages deploy dist --project-name texturizer`. The workflow needs two
repository/organization secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

To deploy by hand from a logged-in machine:

```bash
npm run deploy
```

## Project layout

```
index.html              mounts <texturize-filter>
src/main.js             entry; imports styles + registers the component
src/canvas-filter.js    the Web Component (WebGL2 shader + full UI)
src/preset.js           the settings schema, preset-file checks and settings hash (no browser needed)
test/, scripts/         npm test, npm run check:browser
src/style.css           page chrome around the element
wrangler.toml           Cloudflare Pages config
.github/workflows/      build + deploy on push to main
```
