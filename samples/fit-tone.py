# Measures the tone change from each before (A.jpg, B.jpg) to its after
# (A2.PNG, B2.PNG) on flat colour areas only, away from outlines, and fits
# tone-curve shapes to it. A measurement record for
# docs/plans/concrete-lighten.md, not part of npm test: it needs Python with
# numpy, scipy and Pillow.
#
#   python -I samples/fit-tone.py samples > samples/fit-tone-output.txt
#
import sys
import numpy as np
from PIL import Image
from scipy import ndimage, optimize

D = sys.argv[1]
pairs = [("A.jpg", "A2.PNG"), ("B.jpg", "B2.PNG")]


def flat_samples(a, b):
    A = np.asarray(Image.open(f"{D}/{a}").convert("RGB")).astype(float)
    # flat = low local variation in the full-size before, then downscale
    lum = A.mean(2)
    sd = ndimage.generic_filter(lum[::3, ::3], np.std, size=7)
    sd = np.asarray(Image.fromarray(sd.astype("float32")).resize((480, 672), Image.BILINEAR))
    As = np.asarray(Image.fromarray(A.astype("uint8")).resize((480, 672), Image.LANCZOS)).astype(float)
    B = np.asarray(Image.open(f"{D}/{b}").convert("RGB")).astype(float)
    flat = sd < 2.0
    flat = ndimage.binary_erosion(flat, iterations=6)
    # each flat region: label by colour; take medians per colour cluster
    q = (As // 12).astype(int)
    key = q[..., 0] * 10000 + q[..., 1] * 100 + q[..., 2]
    out = []
    for k in np.unique(key[flat]):
        m = flat & (key == k)
        if m.sum() < 400:
            continue
        out.append((np.median(As[m], 0), np.median(B[m], 0), np.mean(B[m], 0), int(m.sum())))
    return out


allx, ally = [], []
for a, b in pairs:
    print(a)
    for x, ymed, ymean, n in flat_samples(a, b):
        print("  in", np.round(x, 2), "-> median", np.round(ymed, 2), "mean", np.round(ymean, 2), "n", n)
        allx.append(x); ally.append(ymed)
X = np.array(allx).ravel() / 255
Y = np.array(ally).ravel() / 255


def levels(p, x):
    w, g, bl = p
    return np.clip((x - bl) / (w - bl), 0, 1) ** (1 / g)


def screen_lift(p, x):  # mix toward screen blend + gamma
    s, g = p
    y = x ** (1 / g)
    return y + s * y * (1 - y)


def lift_gain(p, x):  # lift+gain+gamma (ASC-CDL-like): (x*slope+offset)^power
    sl, off, pw = p
    return np.clip(x * sl + off, 0, 1) ** pw


for name, f, p0 in [("levels w,g,black", levels, [0.92, 1.14, 0.0]),
                    ("gamma + screen", screen_lift, [0.3, 1.1]),
                    ("slope/offset/power", lift_gain, [1.1, 0.05, 0.9])]:
    r = optimize.least_squares(lambda p: f(p, X) - Y, p0)
    err = (f(r.x, X) - Y) * 255
    print(f"{name:20s} params {np.round(r.x, 3)}  rms {np.sqrt((err**2).mean()):.1f}  max {np.abs(err).max():.1f}")
    for xin in [6, 23, 50, 72, 100, 118, 137, 155, 208, 232, 242]:
        print(f"   {xin:3d}->{f(r.x, np.array([xin/255]))[0]*255:5.0f}", end="")
    print()
