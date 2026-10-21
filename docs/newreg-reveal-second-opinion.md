# NewReg Reveal: second opinion

Reviewed by Codex on 21 October 2026, against Texturizer commit `42c2e9f`.

## Overall assessment

NewReg Reveal is a useful improvement over NewReg: it feels brighter and more
alive, and Light Pool gives the picture a more coherent sense of illumination.
However, I would soften the treatment of faces and make exceptions to the yellow
include mask before adopting it as the standard reveal across all cards.

The main concerns are visual consistency and the brief, “a little more alive,
but still subtle.” The existing automated checks pass; they do not settle those
aesthetic questions.

## What was reviewed

- The committed renderer changes and settings schema.
- The chosen `newreg-reveal.texturizer-preset.json`.
- The supplied second-opinion archive: the 12-card original/current/chosen
  overview sheets, selected individual card sheets, alternative-setting sheets,
  and all five full-resolution detail crops.
- The archive's explanation and measurements, treated as supporting material
  from the author of the recommendation rather than independent evidence.

The archive's chosen preset and renderer/schema patch match the committed files
and changes byte for byte.

## Concerns

### 1. Skin Light can read as embossing on lighter faces

The doctor's darker face in “I'm from Canada” gains useful definition without
obvious material grain. On the lighter face in “Please,” the bright and dark
rims around the eyes, mouth, and forehead are more conspicuous. In the detail
crop, they read as a bevel applied to the drawing's lines.

This is consistent with how Skin Light works: it derives a surface slope from
the drawing's darkness. That produces relief around drawn edges; it does not
recover the actual three-dimensional shape of a face. It brings the face into
the effect, but can introduce an embossed appearance of its own.

**Recommendation:** compare the chosen Skin Light value of `0.6` with a gentler
`0.3–0.4`. Keep Picture Relief at `0.5` during that comparison so the effect of
changing Skin Light is clear. These lower values are proposed trials, not a
combination independently rendered or approved in this review.

### 2. The yellow include mask textures some people's skin

Including the artist's pale yellow, RGB `(252, 236, 153)`, clearly improves the
background on “Please.” The same inclusion also gives material grain to the
yellow skin on “Fine,” including the face, hands, and torso. The yellow-skinned
man in the market illustration, “How much is it?”, is another affected subject.

This creates an inconsistent rule across the deck: some people retain smooth
skin while others receive the concrete texture because of the artist's palette.
“Fine” also has the largest brightness shift in the supplied measurements:
`+10.2` luma levels relative to its original. That number comes from the supplied
report and was not independently recomputed here.

**Recommendation:** keep yellow inclusion as an artwork-specific adjustment.
Use a variant without it for cards with stylised yellow skin. Do not tighten
the global skin detector solely to solve this background-colour problem; that
would affect other skin colours and existing looks while leaving the ambiguity
between a yellow face and a yellow background unresolved.

### 3. An extra exclude pick cannot undo a fully matching include pick

The archive suggests an exclude pick as a possible remedy for “Fine.” With the
current renderer, inclusion takes precedence:

```glsl
protectMask = clamp(max(skinMask, excludeW) - includeW, 0.0, 1.0);
```

Where `includeW` is `1`, protection becomes `0` even if skin detection or an
exclude pick supplies full protection. Adding the same yellow to the exclude
list therefore will not restore smooth skin there.

**Recommendation:** remove the yellow inclusion from that card's preset. If a
card needs yellow background texture and smooth skin of the same colour,
colour picks alone cannot distinguish those regions; that requires spatial
masking or another source of region information.

### 4. Added shine makes the grid compete more strongly with the illustration

The full-resolution dark-background and colour-edge crops show stronger bright
glints in the chosen look. Those highlights add life, but also make the grid
more conspicuous. On busy cards and dark backgrounds, the material can draw
attention away from the illustration.

**Recommendation:** compare Shininess `0.12` with `0.06–0.08`, retaining Light
Pool `0.5`. Those are proposed trial values, not a tested replacement preset.
Judge the result at actual card size as well as in detail crops.

## What I would keep

- **Light Pool around `0.5`:** the broad directional lift is a convincing part
  of the improvement.
- **Vibrance off:** the artwork already has strong colour; the supplied
  alternatives do not make extra saturation look necessary.
- **Picture Relief at `0.5`:** increasing it is not the first adjustment I
  would make when some facial edges already look embossed.
- **The current skin detector for existing looks:** use preset exceptions for
  this artwork rather than changing the global classification to fit one yellow.

## Independent technical verification

Using Node `22.23.4`, npm `10.9.9`, and the installed headless Chromium:

| Check | Result |
|---|---|
| Preset tests | 26 of 26 passed |
| Browser checks | 73 of 73 passed |
| Pixel regression checks against `04d142d` | 71 of 71 passed |
| Production build | Passed |

The covered older looks retain identical pixels, including the translator house
look at full size and in preview. This supports the compatibility claims for
the cases exercised by the suite.

One test gap remains: the positive Skin Light browser assertion checks that
**some pixels change** when Skin Light is enabled with Preserve Skin on. It does
not independently verify that changes stay confined to protected skin, that
material grain remains absent there, or that the visual result is appropriate
across skin tones. Passing that check is useful functional evidence, but is
broader in its wording than in what it actually proves.

## Suggested next comparison

Compare the committed look with a variant using Skin Light `0.3–0.4` and
Shininess `0.06–0.08`, retaining Light Pool `0.5` and Picture Relief `0.5`.
Separately compare versions without yellow inclusion on “Fine” and the market
card. Review “Please” and the doctor's face alongside them to check that the
gentler treatment still improves both lighter and darker faces.

The deciding check should be repeated original-to-reveal turns on a phone at
normal size and speed. Static sheets and software WebGL tests cannot establish
whether that transition feels subtle in the actual app. That interaction was
not tested in this review.

No renderer or preset changes, translator refresh, or deployment were performed
as part of this review.
