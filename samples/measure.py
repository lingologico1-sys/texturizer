# Holds renders from scripts/compare-samples.mjs against the wanted reveal
# faces (A2.PNG, B2.PNG): the tone of each flat colour, the texture's
# strength and groove spacing on the plain backgrounds, and side-by-side
# crops to look at. Same flat-area method as fit-tone.py.
#
#   python -I samples/measure.py samples/out
#
# Needs Python with numpy, scipy and Pillow. A measurement aid, not a test.

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
OUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else HERE / "out"
SIZE = (480, 672)

# Plain background squares at 480 x 672, away from the figures: where the
# texture can be seen on its own.
BACKGROUND = {"A": (10, 10, 138, 138), "B": (330, 0, 458, 128)}
# Crops to look at: (left, top, right, bottom) at 480 x 672.
CROPS = {"A": {"face": (200, 180, 360, 340), "bg": (0, 0, 160, 160)},
         "B": {"bg": (300, 0, 460, 160), "jacket": (40, 180, 200, 340)}}


def load(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(float)


def flat_regions(name):
    """Flat colour areas of the before, as boolean masks at 480 x 672."""
    full = load(HERE / f"{name}.jpg")
    sd = ndimage.generic_filter(full.mean(2)[::3, ::3], np.std, size=7)
    sd = np.asarray(Image.fromarray(sd.astype("float32")).resize(SIZE, Image.BILINEAR))
    small = np.asarray(Image.fromarray(full.astype("uint8")).resize(SIZE, Image.LANCZOS)).astype(float)
    flat = ndimage.binary_erosion(sd < 2.0, iterations=6)
    q = (small // 12).astype(int)
    key = q[..., 0] * 10000 + q[..., 1] * 100 + q[..., 2]
    regions = []
    for k in np.unique(key[flat]):
        m = flat & (key == k)
        if m.sum() >= 400:
            regions.append((np.median(small[m], 0), m))
    return regions


def texture_stats(img, box):
    l, t, r, b = box
    lum = img[t:b, l:r].mean(2)
    lum = lum - lum.mean()
    spectrum = np.abs(np.fft.fftshift(np.fft.fft2(lum)))
    c = lum.shape[0] // 2
    spectrum[c, c] = 0
    peaks = []
    for i in np.argsort(spectrum.ravel())[::-1][:8]:
        y, x = divmod(i, lum.shape[1])
        f = max(abs(x - c), abs(y - c))
        if f:
            peaks.append(round(lum.shape[0] / f, 1))
    return lum.std(), sorted(set(peaks), reverse=True)[:4]


def side_by_side(name, render, target, label):
    for crop, (l, t, r, b) in CROPS[name].items():
        pair = np.concatenate([render[t:b, l:r], target[t:b, l:r]], 1)
        Image.fromarray(np.clip(pair, 0, 255).astype("uint8")).resize(
            ((r - l) * 8, (b - t) * 4), Image.NEAREST).save(OUT / f"crop-{name}-{label}-{crop}.png")


for name in ["A", "B"]:
    target = load(HERE / f"{name}2.PNG")
    regions = flat_regions(name)
    tgt_std, tgt_peaks = texture_stats(target, BACKGROUND[name])
    print(f"\n{name}: background texture  target  std {tgt_std:5.1f}  periods {tgt_peaks}")
    renders = [(label, OUT / f"{name}-{label}.png") for label in ["480", "full-480"]]
    for label, path in renders:
        if not path.exists():
            continue
        img = load(path)
        std, peaks = texture_stats(img, BACKGROUND[name])
        print(f"   {label:9s}            render  std {std:5.1f}  periods {peaks}")
        side_by_side(name, img, target, label)
    print(f"   flat colours: before -> target median | render medians ({', '.join(l for l, _ in renders)})")
    errors = {label: [] for label, _ in renders}
    for before, m in regions:
        want = np.median(target[m], 0)
        row = f"   {before.astype(int)} -> {want.astype(int)} |"
        for label, path in renders:
            if path.exists():
                got = np.median(load(path)[m], 0)
                errors[label].extend(got - want)
                row += f" {got.astype(int)}"
        print(row)
    for label, e in errors.items():
        if e:
            e = np.array(e)
            print(f"   {label:9s} tone error: rms {np.sqrt((e ** 2).mean()):.1f}, worst {np.abs(e).max():.1f}")
print(f"\nCrops written to {OUT}")
