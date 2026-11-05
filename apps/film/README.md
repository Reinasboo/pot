# POT product film and screenshot studio

Editable Remotion project for the 90-second hackathon product introduction and six product
screenshots. Uses real interface captures, original motion diagrams, a narrated product story,
an original synthesized score, and a clearly framed future/token chapter.

## Prerequisites

Node.js 24, npm, Chromium, and FFmpeg for media inspection / audio preparation. Install the web
app dependencies too, because the render script reuses its Playwright Chromium installation.

```powershell
cd apps/web
npm ci
npx playwright install chromium
cd ../film
npm ci
npm run preview
```

The render script finds the Playwright browser automatically. Alternatively set
`REMOTION_BROWSER_EXECUTABLE` to a compatible Chrome/Chromium executable.

```powershell
npm run stills
npm run screenshots
npm run render
```

Outputs go to the repository's `deliverables` folder: the MP4, cover, scene stills, and six edited
1920×1080 screenshots. The main composition is `Launch`, 5400 frames at 60fps. The screenshot
compositions are `ProductShot1` through `ProductShot6`.

To recapture the real product after changes, run the web app and then `node scripts/capture.mjs`.
It uses `http://127.0.0.1:3001` by default; set `POT_CAPTURE_URL` to override. No wallet transaction
is sent by the capture script. Templates and example amounts remain visibly examples.

## Replaceable content

- Product visuals: `public/screens`, captured from the actual app.
- Brand and scene styling: the shared `C` tokens and components in `src/film.tsx`.
- Narration: `production/NARRATION.txt` and the two MP3 assets.
- Word timing and captions: `public/words.json`; update the timing transform if changing tempo.
- Story and event frames: `production/STORYBOARD.md` and the `scenes` array.
- Original background score: `scripts/score.py`, exported to `public/score.mp3`.
- Token rationale and authority limits: `../../docs/TOKEN_VISION.md`.

The film deliberately does not discuss deployment status, as requested. It also does not invent
transaction receipts, contributors, funding totals, endorsements, or live service verification.
Future platform and token statements are conditional concepts, not implemented feature claims.
