# Texturizer

A GPU-accelerated image texturizer. Upload an image and apply woven canvas,
paper, ink wash, clay, linocut, leather, slate, mosaic and other bump-mapped
textures in real time via WebGL2, then download the result as a PNG.

The whole app is a single self-contained Web Component (`<texturize-filter>`),
originally built as a Wix custom element and now hosted as a standalone site.
There is no backend — all processing happens in the browser on the GPU.

## Features

- 9 texture styles with per-style smart defaults
- Lighting (depth, light direction/elevation, shininess, ambient occlusion)
- Color grading (brightness, contrast, saturation, paper tint, color-driven scale/depth)
- Effects (vignette, dye bleed, distressed, halftone, sharpness, color wash, preserve-skin)
- Color masks: include/exclude specific picked colors from the effect
- Named presets (saved to `localStorage`)
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
src/style.css           page chrome around the element
wrangler.toml           Cloudflare Pages config
.github/workflows/      build + deploy on push to main
```
