# Asset manifest

| Asset | Source / permission | Role |
| --- | --- | --- |
| `public/screens/trip-card.png` | Actual local POT interface, Playwright capture at 2× | Shared-trip example |
| `public/screens/gift-card.png` | Actual local POT interface, Playwright capture at 2× | Gift example |
| `public/screens/community-card.png` | Actual local POT interface, Playwright capture at 2× | Community example |
| `public/screens/plan-fields.png` | Actual planner filled with a trip template and future deadline | Real form state |
| `public/screens/plan-summary.png` | Actual successful local planning preview | After-action state |
| `public/screens/rules.png` | Actual three-rule fieldset | Settlement disclosure |
| `public/screens/mobile-hero.png` | Actual mobile hero, measured top crop | Portrait presentation |
| `public/screens/home-raw.png` | Full actual local page, retained as source reference | Capture provenance, not used in film |
| `public/pot-logo.svg` | Original POT vector identity authored in this project | Brand |
| `public/geist-medium.ttf` | Installed Geist font, static medium instance | Film typography |
| `public/GEIST-LICENSE.txt` | Included open font license | Redistribution terms |
| `public/narration-original.mp3` | One ElevenLabs generation requested for this film | Original narrator take, 80.4 seconds |
| `public/narration.mp3` | Tempo-adjusted and loudness-normalized original take | Final narration, 86.445 seconds |
| `public/words.json` | Word timings from the completed narrator track | Synchronized captions |
| `public/score.mp3` | Original synthesized score from `scripts/score.py`, no samples | Quiet music bed and tonal cues, 90 seconds |

All editorial text, network diagrams, and token illustrations are original composition layers.
Payout/contribution diagrams explain implemented contract behavior; they do not depict real
transactions. Token and future-platform scenes are explicitly conceptual.

Screenshot crops are implemented in `scripts/capture.mjs` from measured element bounds. Source
UI content is not repainted or regenerated. Presentation headings, frames, and shadows remain
separate editable layers in `src/film.tsx`.
