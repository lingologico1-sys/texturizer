# Concrete texture, Picture Relief, Lighten (and Glow next)

Drafted 2026-10-16 with the owner's answers to a first round of questions,
then revised the same day after a second opinion from another model (see
"Review round 1"). Not built yet.

This file is written to be read on its own, including by a reviewer who has
never seen the code: why the work exists, what the target looks like in
numbers, the design, and what is still open.

## Progress

Build order follows the review: compatibility first, each control alone,
then the style that combines them.

- [x] 0. Compatibility fixtures: real old presets with their literal hashes,
      and pixel baselines of all nine existing styles, captured **before**
      any schema or shader change. Done 2026-10-16: `test/fixtures/presets/`
      (the owner's four exports; 02–04 are installed in translator, whose
      server stored them under the same hashes) in `npm test`, and
      `npm run check:pixels`, which renders 22 looks with 04d142d and with
      the working tree in one browser and needs identical pixels (71 checks;
      a 0.002 shift in Contrast fails 48 of them).
- [x] 1. Lighten slider (alone, with Brightness and Contrast neutral).
      Done 2026-10-16. At 0.5 with Intensity 0, Brightness 1, Contrast 1,
      the samples' flat colours come out within rms 3.7 (A) and 4.3 (B)
      levels of the targets, the same at 480 and at full size scaled down.
      The `addedLater` rule (step 4) came with it: old hashes, files and
      pixels unchanged (`npm test` 26, `check:browser` 51, `check:pixels` 71).
- [x] 2. Picture Relief slider, −1 to 1 (raised and pressed-in / letterpress).
      Done 2026-10-16. Tap 1.0 and blur 1.25 reference pixels, strength 3.6:
      at 0.5 the rims along the samples' edges come out at 0.97 (A) and 0.91
      (B) of the targets' strength, the right way round (correlation +0.26
      and +0.15; the targets' own texture limits it). A sweep of wider taps
      and blurs matched worse. `check:browser` 60, including the stale-mip
      sequence; taking out the mip regeneration after the panel's upload
      fails it (an incomplete chain reads flat, so the relief silently
      vanishes; a fresh element alone can't catch that).
- [x] 3. Concrete texture style. Done 2026-10-16. Defaults: scale 85,
      depth 0.65, soften 0.15, ao 0.4, relief 0.5. With Lighten 0.5 the plain backgrounds come out at
      std 27.9 (B, target 26.1) and 4.7 (A, target 6.6), groove periods 5.6–5.8
      px (target 5.8), tone within rms 3.6–4.3; full size scaled down: 22.7
      and 3.9, tone 3.9–4.9. Groove depth in the height is 0.033: anything
      sharper than a pixel saturates the lighting, which is why the first
      tries came out as hard black-and-white strips.
- [ ] 4. Sample comparison script; tune against A2 / B2 at sample size and
      at full size downscaled
- [ ] 5. Checks pass, commit, push (deploys Texturizer); owner judges crops
      and a front → reveal sequence on a phone
- [ ] 6. Owner runs the time-per-card check on the Chromebook
- [ ] 7. Glow (warm, soft highlight bloom): designed below, built after 1–6
- [ ] 8. (Later, the owner's call) refresh translator's pinned copy

## Why this exists: the reveal face of a card

**lingomondo** is a language-learning flashcard app. Every card has two
faces: the **front**, a hand-drawn illustration, and the **reveal face**,
shown when the learner reveals the answer. The reveal face is the same
picture given a tactile, printed-on-a-surface look, so the moment of
revealing feels different from the question, and a little rewarding,
without introducing a second picture to learn.

**Texturizer** (this repo) is the owner's tool that applies that look: a
single Web Component, `<texturize-filter>`, rendering with a WebGL2 fragment
shader, no backend. **translator** (the owner's deck-making app) runs a
pinned copy of this component to make each card's reveal face automatically
from the card's full-size front (normally 1400 × 1925), using a "house look"
saved as a preset file. Every reveal face records the settings hash and the
renderer version that made it.

The owner is disappointed with the looks the current nine styles and colour
controls can make. The reveal faces they want are the ones in `samples/`:

| Before (front) | After (wanted reveal face) |
|---|---|
| `samples/A.jpg` 1500 × 2100, a woman waving on yellow | `samples/A2.PNG` 480 × 672 |
| `samples/B.jpg` 1500 × 2100, a woman with a cane and a girl on slate blue | `samples/B2.PNG` 480 × 672 |

The afters show two things at once: a texture the owner calls **"concrete"**,
and a **lightening** of the whole picture. Neither can be made with the
current controls. 480 × 672 is exactly the size of the old decks' reveal
faces (`im<NN>B.png`), so these are probably old reveal faces made by some
earlier process, now wanted at full size; this repo's history has no style
that made them.

## The brief: pleasant, not jarring

The owner's standing wish for every reveal effect. Each item is a test the
work must pass, not a mood:

1. **Same picture, same colours.** No hue changes beyond what the samples
   themselves do (Lighten turns an orange-yellow lemon, as the samples do).
   On a vocabulary card the colour can be the answer ("the red dress").
2. **Nothing harsh.** No hard clipping of light colours (a soft shoulder
   instead), no dark halos around ink, no high-contrast grain.
3. **No shimmer.** Fine regular patterns can moiré when a 1400 px picture
   is shown at phone size. Every new look is checked downscaled to phone
   display size (about 360–430 CSS px wide at 2–3× density).
4. **A calm step from front to reveal.** The reveal follows the front on
   screen; the brightness jump between them should feel like light coming
   up, not a flash. Judged on a phone in sequence, not side by side.

## What the samples show, measured

The after images were compared with the befores downscaled to 480 × 672 (no
offset between them).

### The tone change: brighter and more contrast, black kept

Measured on **flat colour areas only** (low local variation in the full-size
before, eroded away from outlines), medians, both images:

| Before | After |
|---|---|
| 242, 208, 22 (yellow) | 254, 245, 39 |
| 246, 71, 24 (dress red) | 254, 104, 43 |
| 233, 156, 138 (jacket pink) | 251, 184, 165 |
| 95, 62, 55 (dark skin) | 123, 89, 82 |
| 71, 100, 118 (slate blue) | 100, 127, 145 |
| 49, 23, 6 (hair) | 72, 37, 5 |

(The yellow appears in both pictures; the fit uses it twice, the table once.)

A per-channel Levels curve fits well: `out = 255 · clamp(in / 223, 0, 1) ^
(1 / 1.20)`, black point 0.

- Fitted on the 21 unrounded values (7 colours × 3 channels), the fitted
  parameters (white 0.874, gamma 1.204, black 0.002) give rms 3.8, worst
  6.6 levels.
- The rounded curve above against the table's 18 values gives rms 3.82,
  worst 7.53 (a reviewer's check, confirmed).
- Two other shapes were tried: gamma plus a screen blend fit worse (rms 7.1,
  worst 16.6); slope/offset/power fit identically to Levels.

The script and its unrounded output are kept: `samples/fit-tone.py` and
`samples/fit-tone-output.txt` (Python with numpy, scipy and Pillow; a
measurement record, not part of `npm test`). The afters' means are about 5
levels below their medians, which is the texture's shading, so the curve
describes "picture under neutral lighting".

Six flat colours are a small sample, and the brightest inputs (232 and up)
all clip to 255 in the fit, losing pale detail (B's cream trousers). The
design uses a soft shoulder there instead (brief item 2), accepting a few
levels' difference from the samples at the very top.

Why the existing sliders can't do it:

- **Brightness** (`applyBrightness`) raises HSV *value* with a power curve,
  scaling the three channels together, so hue ratios are kept: the yellow
  stays orange-ish. The target moves each channel on its own curve.
- **Contrast** (`applyContrast`) pivots around mid-grey, `(c − 0.5)·k + 0.5`,
  so raising it darkens every dark. The target never darkens anything.
- Note the default Contrast is **1.08**, not 1. Lighten must be measured and
  tuned with Brightness 1 and Contrast 1.

### The texture: a broken grid, plus the drawing in relief

After removing the tone curve, what is left (after − curve(before)) is the
texture and lighting:

- **A fine grid of grooves**: thin, axis-aligned dark lines, horizontal and
  vertical, in runs that start and stop at random, irregularly spaced (5–7 px
  apart at 480 px wide, so roughly 80–90 across the short side; the FFT's
  strongest peaks are at periods of 5.8, 4.7 and 2.9 px on both axes). Each
  groove has a light edge on one side: embossed, lit from the top-left. It
  reads as stucco or rough render more than pitted concrete. The owner chose
  to **match the samples**, not real concrete. The FFT is supporting
  evidence only: spacing alone says nothing about groove width, contrast,
  continuity or lighting, so tuning is done on background crops.
- **The drawing itself is embossed**: every outline and colour edge has a
  bright rim on its top-left side and a shadow on its bottom-right, as if
  the dark ink were raised. No current style can do this, because the shader
  never uses the picture as a height map.
- The texture is strong on mid and dark colours and faint on near-white
  ones, which is what the shader's existing overlay blend already does.

## How the shader works today (what the design plugs into)

All in `src/canvas-filter.js`, `initWebGL()`. One fragment shader, one
program, every style inlined (no per-style recompile). Per pixel:

1. A **height** from the chosen style's height function,
   `getHeightAt(uv, original_uv)` → 0..1, in pattern space
   `p = rotate(angle) · (pixel / shortSide) · scale` (the pattern's density
   is relative to the picture's short side, not to pixels).
2. A **normal** from four more height taps (`normalFromHeight`, offset by
   0.85–2.75 **output pixels** depending on Soften), and **ambient
   occlusion** from four more (`computeAO`, 4.5 output pixels): nine height
   evaluations per pixel. Because the offsets are in pixels while the
   pattern is relative, the same settings give different apparent relief at
   480 px and at 1400 px, and in the preview (rendered at 2× display size)
   versus the export.
3. A grey **lighting** value around 0.5: Lambert against a flat surface,
   groove shading from the height, AO.
4. The **colour** path on the source pixel: saturation → brightness →
   contrast → paper tint → halftone → per-style tweaks (Canvas 2 also uses
   the height to shift colour).
5. **Overlay** blend of colour with lighting, then specular, vignette, colour
   wash. Colour masks (picked colours, skin) mix the untextured colour back
   in. Masks are matched on the *original* pixel.

Settings are declared once in `src/preset.js` (`CONTROL_CONFIG`), which has
no browser dependencies because translator's server runs it to check preset
files. `settingsHash` is a sha256 over every normalised param (all keys in
`CONTROL_CONFIG`) and the masks; translator stores the house look by that
hash. Choosing a style applies that style's partial defaults
(`styleDefaults`), leaving every other setting as it was.

## Design

### Shared rule: new controls are relative to the picture

Everything new (the relief's blur and sampling distance, Concrete's normal
and AO distances, Glow's radius) is defined in units of the picture's short
side against a **reference short side of 480 px** (the samples' size), so a
look renders alike at 480, at 1400 and in the preview. The nine existing
styles keep their pixel-based offsets untouched, whether or not the new
controls are on, so their material looks the same as today.

Three sizes are kept apart (review round 2, point 2):

- **Picture size** (its aspect): the relative tap distances are worked out
  from it, so a distance means the same fraction of the picture whatever the
  output size.
- **Output size** (preview canvas or export): what the existing styles' pixel
  offsets use, as today.
- **Source texture size** (what was really uploaded, after any cap at
  `maxTextureSize`): what the **mip level** for the relief's blur follows,
  `lod = log2(blur radius in source texels)`. The preview and an export of
  the same picture share one source texture but have different output sizes.

"Alike" means visually similar, not identical pixels: the checks compare
renders at different sizes after downscaling, with a tolerance, not
bit-for-bit.

### 0. Compatibility fixtures (first, done)

Before touching the schema or the shader:

- Take real old preset JSON (translator's installed house look, plus a few
  exported from the live Texturizer) and record their **literal** expected
  hashes in `test/`.
- Render every one of the nine existing styles (and the house look) on a
  fixed picture in headless Chrome with the current build, and keep the
  pixels as baselines. After each later step, the same browser must produce
  identical pixels.

### 1. Lighten (Color group, 0 to 1, default 0)

One slider that raises brightness and contrast together, the way the samples
do. Owner's choice: a new slider; Brightness and Contrast keep their current
behaviour.

```glsl
// t = u_lighten; at 0.5: white ≈ 223/255, gamma ≈ 1.20 (the samples)
float white = mix(1.0, 0.75, t);
float gamma = mix(1.0, 1.40, t);
const float knee = 0.90;
float m = (1.0 / white - knee) / (1.0 - knee);   // 1 at t = 0
vec3 u = color / white;                          // 0 .. 1/white
vec3 v = clamp((u - knee) / (1.0 / white - knee), 0.0, 1.0);
vec3 top = knee + (1.0 - knee) * (m * v) / (1.0 + (m - 1.0) * v);
vec3 c = mix(u, top, step(knee, u));
color = pow(c, vec3(1.0 / gamma));
```

The shoulder (review round 2, point 1) is a rational curve over the top of
the range: instead of everything above the white point clipping to 1, the
span from the knee up to pure white input is rolled smoothly into knee .. 1:

- **Identity at t = 0**: `m` is 1, the shoulder is a straight line and the
  gamma is 1, so the first slider step moves the picture by one step's worth,
  with no jump. (The shader still skips Lighten at exactly 0, so old pixels
  stay bit-identical.)
- **Endpoints kept**: input 0 gives 0, input 1 gives 1, at every t.
- **Monotonic** for every t: the shoulder's slope is
  `m / (1 + (m − 1)·v)²`, always above 0.
- **Continuous slope at the knee**: slope 1 on both sides.
- **Highlight detail kept**: at the very top the slope is `1/m` (about 0.4 at
  t = 0.5), compressed but never flat, unlike the samples' clipping.

Checked numerically for t from 0 to 1 in steps of 0.05: monotonic, endpoints
exact, identity at t = 0. At t = 0.5 against the table's 18 values the knee
decides the fit:

| Knee | rms | worst | 208 → (sample 245) | 242 → (sample 254) |
|---|---|---|---|---|
| 0.75 | 4.94 | 12.72 | 232 | 250 |
| 0.85 | 4.12 | 8.22 | 237 | 251 |
| **0.90** | **3.78** | **7.53** | 239 | 253 |

At 0.90 the shoulder fits as well as the hard-clipped curve does and still
keeps pale detail, so 0.90 is the starting value.

- Applied **first** in the colour path, to the source pixel, before
  saturation: "the picture, lightened", then textured. Mask and skin
  matching keep using the original pixel. If the highlights don't match,
  applying it after the overlay blend is the fallback.
- Black stays black at every setting, so ink keeps its weight.
- Tuned with Brightness 1 and Contrast 1.

### 2. Picture Relief (Lighting group, −1 to 1, default 0)

The picture's own luma becomes a second height map so outlines come out in
relief, lit by the same light as the texture. Owner's choice: its own
slider, usable with every style; Concrete turns it on in its defaults.

- **Positive** raises the ink (the samples). **Negative** presses it in:
  a **letterpress / deboss** look, the drawing pressed into thick paper
  with soft shadows on the inner walls of the lines. With Paper style, a
  little Paper Tint and a little Lighten, this is a second calm reveal look
  at no extra cost.
- **Kept separate from material height** (review point 2). `textureHeight`
  stays the style's own height and is still what groove shading, AO and
  Canvas 2's colour shift use. Relief does **not** feed AO: AO from ink
  would put dark halos round every line (brief item 2).
- **Two slopes, combined before normalising** (review round 2, point 2).
  The material's height differences are taken exactly as today (its own
  taps, its own pixel offsets, its own strength). The picture's height
  differences are taken separately at relative offsets. The normal is
  `normalize(vec3(materialSlope + relief · pictureSlope, 1))`, so turning
  Relief on adds to the material's lighting without changing how the
  material itself is sampled.
- `pictureHeight = 1 − luma` (dark ink high). The edge-only alternative
  (gradient magnitude) makes a different, ridge-along-edges look and is not
  the starting point.
- The luma is sampled at each normal tap's **offset** uv (not at
  `original_uv`, which `getHeightAt` receives unshifted).
- **Blur without extra reads** (review point 4): bind the same image a
  second time on another texture unit with a mipmapped WebGL2 sampler
  object, and read relief luma with `textureLod` at a level set from the
  blur radius. One read per normal tap (four per pixel), no extra pass. The
  existing unit keeps its current non-mipmapped sampler, so every existing
  read, and every existing pixel, is unchanged. If the mip blur looks
  blocky, a pre-blurred luma texture made in a one-off pass is the fallback;
  that call is made on observed quality, and neither choice says anything
  about Chromebook speed until it is measured there.

**Mipmap lifecycle** (review round 2, point 3). A WebGL2 sampler object
bound to a texture unit overrides that texture's own sampling state there,
so one image serves both units with no copy. What has to be added:

- `gl.generateMipmap` after **every** level-0 upload into an image texture.
  There are four today: the 1 × 1 placeholder made in `initWebGL`, the
  placeholder written back when the image is cleared, `uploadImageTexture`
  (load, restore from IndexedDB, batch), and the temporary texture in
  `renderBlobNow`. A level-0 upload at a new size leaves the old mip chain
  the wrong size, the texture "incomplete", and an incomplete texture read
  through a mipmapped sampler comes back black, so missing one is a visible
  bug, not a slow one.
- The relief sampler: `LINEAR_MIPMAP_LINEAR` minification, `LINEAR`
  magnification, `CLAMP_TO_EDGE` on both axes (as the image texture today).
- `renderBlobNow` binds its temporary texture to **both** units, and puts the
  panel's texture back on both afterwards.
- Cleanup: the sampler is deleted in `dispose()`; temporary textures are
  deleted as now (their mips go with them).
- A browser check: render image A, replace it with image B, export B through
  `renderBlob`, return to the preview, and compare each step with a fresh
  render of the same picture. This catches stale mips and binding mistakes.

### 3. Concrete style (Texture Style option 10, index 9)

A new `concreteHeightAt(p)`:

- A flat surface cut by **grooves**.
- Horizontal grooves: one per row of cells, each row's line jittered by a
  per-row hash so spacing is irregular (about 0.7–1.3 of a cell). Because a
  jittered line can cross into the next cell, each evaluation checks the
  rows **above and below** as well (review point 6), so lines never break
  by accident.
- Along the row, the groove is split into runs of random length; a run is
  cut or not by a hash threshold, which makes the lines start and stop.
  Deliberate run ends get **soft caps** (the groove fades over a short
  distance) rather than square ends. Vertical grooves the same, with their
  own hashes.
- Groove profile narrow, with edges whose softness follows Soften.
- Fine grit on top: low-amplitude `noise(p · 6)`, kept low (brief item 2).
- `distressed` adds wider patches where grooves fade.
- Normal and AO offsets relative to the picture (shared rule).

Style defaults (`styleDefaults[9]`): scale about 85, depth about 0.9, soften
about 0.15, ao about 0.5, paper tint 0, **relief about 0.5**. The default
light (127°, 46°) already comes from the top-left. Exact numbers come from
tuning.

**Switching styles** (review point 7): every style's defaults gain a
`relief` value (0 for the nine existing styles, about 0.5 for Concrete), so
choosing Canvas after Concrete turns relief off. Importing a preset restores
its saved relief. Lighten is a colour setting and is never touched by a
style change.

`texturetype`'s `max` in `preset.js` goes from 8 to 9, the options list
gains "Concrete", and `paperColor(9)` returns a neutral grey-white.

### 4. Old looks keep their hashes and their pixels

Adding keys to `CONTROL_CONFIG` would change the hash of every existing look
(including translator's stored house look), because `settingsHash` covers
all normalised params. So:

- New settings carry a flag (e.g. `addedLater: true`) and an **identity
  value of 0, fixed forever**, independent of any style's defaults.
- `settingsHash` leaves an `addedLater` param out when it equals its
  identity value. A look that doesn't use the new controls hashes exactly as
  before; one that does gets a new hash.
- `normalizeSettings` fills a missing `addedLater` param with 0 **without a
  warning** (translator shows warnings to the owner; an old file isn't
  wrong).
- The shader skips each new control at 0, so old looks render
  pixel-identical (checked against step 0's baselines).
- Tests: missing controls, explicit zeros (same hash as missing), non-zero
  values (new hash), and export → import round trips.

### 5. Tuning and checking

A repeatable script (`scripts/compare-samples.mjs`, on the existing headless
Chrome harness in `scripts/check-browser.mjs`) renders A.jpg and B.jpg:

- at 480 × 672, and at full size **downscaled** to 480 × 672, so both must
  match the samples;
- with Concrete, Lighten 0.5, Brightness 1, Contrast 1;

and `samples/measure.py` reports the flat-area tone table above (the same
method as `samples/fit-tone.py`, so it stays in Python), the background
texture's strength and groove spacing, and side-by-side crops. Full size downscaled and sample size must be
visually similar within a tolerance, not identical.

**Shimmer is a display test, not a file test** (review round 2). Downscaled
files can show moiré but can't show its absence. So the check is the real
reveal face shown in a page at phone width, at device pixel ratios 2, 2.625
and 3, while the page scrolls and the picture's size changes by a few pixels.
Low-amplitude grit can alias too, so it is looked at as well as the grooves.
Done once in headless Chrome as a screen recording for the owner, then by
the owner on their phone.

The owner then judges the crops and a front → reveal sequence on a phone.

**Performance:** the harness uses software WebGL, so it says nothing about
device speed. translator won't have the new copy yet, so the owner times
Texturizer's own Batch on the Chromebook: the same folder of full-size
fronts, once with the current house look and once with Concrete + Relief.

### 6. Shipping

- `npm test` and `npm run check:browser` pass, plus the new fixtures.
- Commit and push to main; that deploys Texturizer (Cloudflare Pages).
- Commit `samples/` too (it is untracked today), so the comparison script
  and this file's references work.

### 7. Glow (next, after Concrete ships)

A warm, gentle "the card lights up" look, the most clearly rewarding of the
calm options. One **Glow** slider (Effects, 0 to 1, default 0, `addedLater`):

- a soft bloom of the light areas;
- a slight lift toward the centre (an inverted vignette, never darkening
  the edges);
- warmth kept small through the existing Light Warmth, because warmth
  shifts hue (brief item 1).

Glow combines with any style, including Concrete and letterpress.

**The bloom's algorithm is provisional**, decided in Glow's own prototype
(review round 2). Blurring the whole picture and screening it back gives a
broad colour wash as well as spread highlights, which would break brief
item 1. Thresholding an already-blurred mip loses small highlights (teeth,
the whites of eyes). The likely shape is to extract the highlights first,
then blur them, which needs a small extra pass rather than a mip read.

### 8. translator (later, the owner's call)

translator keeps a pinned copy of `canvas-filter.js` and `preset.js`. Until
it is refreshed (`npm run texturizer:update` there), a preset using Concrete
is **refused** by translator (`texturetype` 9 is out of range), and a preset
using Lighten, Relief or Glow loads with those settings **dropped** and a
warning. Refreshing gives every reveal face made afterwards a new renderer
identity. The owner chose to try the new looks in Texturizer first.

## Decisions (owner, 2026-10-16)

1. Picture Relief is **its own slider**, usable with every style; Concrete
   turns it on by default.
2. Lightening is a **new Lighten slider**; Brightness and Contrast keep
   their current behaviour.
3. Concrete should **match the samples** (broken grid + grit).
4. translator's copy: **decide later**.
5. Every reveal effect must be **pleasant, not jarring** (the brief above).
   The house look installed in translator today ("04": Canvas, scale 86,
   Brightness 1.98) was too jarring; that is why this work exists. The
   fixtures keep it reproducible for reveal faces already made, not as a
   target.
6. Add the **letterpress deboss** (Relief below 0) to this work, and do
   **Glow** next.

## Review round 1 (another model, 2026-10-16)

All seven points accepted; where each landed:

| Point | Outcome |
|---|---|
| 1. The Levels match was overstated | Correct: the first fit (235, 1.14) was skewed by edge pixels and mapped 208 → 229, not 241. Refitted on flat areas only: 223, 1.20, rms 3.8. Lighten is tuned with Brightness and Contrast neutral. |
| 2. Keep picture height out of material height | Relief feeds the normal only; groove shading, AO and Canvas 2 keep the style's own height. |
| 3. Resolution behaviour | New controls are relative to a 480 px reference short side; checks compare full size downscaled as well as sample size. Old styles keep their pixel offsets. |
| 4. Blur vs. one read per tap | Mipmapped second sampler on the same image, read with `textureLod`; pre-blurred texture as fallback. Device timing on the Chromebook, not the software harness. |
| 5. Stronger hash fixtures | Step 0, before any change: real presets, literal hashes, pixel baselines of all nine styles; identity value 0 fixed forever. |
| 6. Continuous grooves | Neighbouring rows evaluated; soft caps on run ends; tuned on background crops, FFT as support only. |
| 7. Switching away from Concrete | Every style's defaults set relief; import restores the saved value; Lighten untouched by style changes. |

## Review round 2 (same model, 2026-10-16)

The reviewer's verdict: proceed to a prototype after tightening three
details. All accepted:

| Point | Outcome |
|---|---|
| 1. Lighten must be continuous near 0 | Rational shoulder that is the identity at t = 0, monotonic, endpoints kept, slope 1/m at the top; knee 0.90 fits the samples as well as clipping (rms 3.78). |
| 2. Separate sampling for material and relief; source vs. output size | Two slopes computed apart and summed before normalising; mip level follows the uploaded texture's size, tap distances follow the picture, old offsets follow the output. |
| 3. Mipmap lifecycle | Mips regenerated after all four level-0 uploads; sampler state, binding in `renderBlobNow`, cleanup, and a replace-export-return browser check. |
| Phone check | Now a display test at real device pixel ratios with scrolling and small size changes; similarity with a tolerance across sizes. |
| Glow's bloom | Left provisional; highlights extracted before blurring is the likely shape. |
| Measurement | Corrected: 18 values in the table (yellow appears in both pictures), worst 7.53 for the rounded curve; script and unrounded output kept in `samples/`. |

## Open questions and risks

- **Texture density at full size.** The pattern scales with the picture, so
  at 1400 px there are still about 85 grooves across, about 16 px apart.
  That may feel coarser than the samples did at their size. The owner judges
  a full-size render before tuning is called done.
- **Relief on soft areas.** Luma relief raises every dark area, not only ink:
  a dark skin tone next to a light background gets a rim along its whole
  contour (the samples show this). Internal shading in faces may get bumps;
  the blur level and strength control it.
- **Lighten's top end.** The soft shoulder keeps pale detail and fits the
  samples as well as clipping does (knee 0.90), but the samples have only
  six flat colours; judged by eye on more pictures.
- **Mip blur quality.** Mip levels are box-filtered; at higher levels they can
  look blocky. Fallback above.

## For a further opinion

Both review rounds' points are folded in; the reviewer's last verdict was
to go ahead with a prototype. Open to a reviewer still:

1. Anything in the brief ("pleasant, not jarring") the design still breaks?
2. Is the rational shoulder the best shape, or would a reviewer pick
   another monotonic curve with the same endpoints?
