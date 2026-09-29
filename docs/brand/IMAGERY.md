# Imagery: AI-generated photos (decided 2026-09-30)

The public site pairs photographs of people in UAE businesses with live product pieces. The photos are AI-generated. Rules and the full brief are in the design system's brand book, under "Imagery".

## Rules that matter most
- **Never present them as customers, staff or testimonials.** No names, no quotes, no "Qamar Electronics" captions.
- **Nothing identifiable:** the images must not resemble a real, recognisable person.
- **Check every image at 100% zoom** for hands, eyes, teeth, text on screens and signs. Regenerate rather than retouch.
- **No WhatsApp logos or green chat UI** on phone screens. Screens are blank or blurred.
- Keep the generator's licence terms with the files (commercial use must be allowed on your plan).

## Where they go

| Slot | File (put in `apps/web/public/photos/`) | Crop | Brief |
|---|---|---|---|
| Landing hero | `hero-owner.webp` | 4:5, 1600 x 2000 or larger | A shop owner replying to customers on a phone |
| Alternative hero (A/B later) | `hero-team.webp` | 4:5 | Two staff at a counter, one handing a phone to the other |
| Auth screens (optional) | `auth-counter.webp` | 3:4 | A calm shop counter at golden hour, person out of focus |

Keep the subject on the right half of the hero crop: the live handoff demo overlaps the lower left.

## Prompts

Written for Midjourney v7, Imagen, Firefly or FLUX. Remove the parameters your tool doesn't support.

**1. Hero: owner on the phone**
> Editorial photograph of a woman in her thirties who owns a small electronics shop in Dubai, wearing a modest navy abaya with a light sand-coloured shayla, standing behind a clean white counter, smiling slightly as she types a reply on her phone. Soft natural window light from the left, shallow depth of field, shelves of laptops softly blurred behind her. Calm, warm, confident. Muted palette of deep teal, sand and white. Phone screen not visible. Shot on a 50mm lens, f/2, subject on the right third of the frame. No text, no logos, no signage. --ar 4:5 --style raw

**2. Hero alternative: the handoff**
> Documentary-style photograph inside a bright modern retail store in the UAE. A young South Asian sales assistant in a plain teal polo shirt passes a phone to an older Emirati manager in a white kandura at the counter, both looking at the phone, relaxed and friendly. Late-afternoon daylight, soft shadows, teal and sand tones, shallow depth of field. Phone screen facing away from camera. Subjects on the right half of the frame. No text, no logos. --ar 4:5 --style raw

**3. Auth screens: the counter**
> Quiet photograph of an empty modern shop counter in Dubai at golden hour, a phone and a small plant on the counter, a person softly out of focus in the background. Warm sand light against deep teal walls. Minimal, calm, lots of negative space on the left. No text, no logos. --ar 3:4 --style raw

**Negative prompt (tools that take one):**
> text, letters, watermark, logo, WhatsApp, green chat bubbles, extra fingers, distorted hands, uncanny eyes, stock-photo pose, handshake, pointing at screen, headset, harsh flash, oversaturated

## After generating
1. Export as WebP, around 80% quality. Keep each under 400 KB.
2. Put the files in `apps/web/public/photos/`.
3. Set `src` on the `PhotoSlot` in `apps/web/src/app/(marketing)/page.tsx` (the component already handles real images). Write an `alt` that describes the scene, not a person's identity.
