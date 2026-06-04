# Holoture Remotion Video Compositions

All compositions live in `remotion/compositions/`. They share the entry point `remotion/index.ts` and are registered in `remotion/Root.tsx`.

---

## Prerequisites

```bash
npm install          # all deps including @remotion/* are in package.json
```

Remotion uses **Chrome Headless Shell** for rendering — it downloads automatically on first render.

---

## Preview in Studio

```bash
npx remotion studio remotion/index.ts --port 3002
# open http://localhost:3002
```

Select any composition from the sidebar.

---

## Compositions

| ID | File | Size | Duration | Description |
|----|------|------|----------|-------------|
| `ExpandingBrain` | `ExpandingBrain.tsx` | 1080×1080 | 5 s | Expanding brain meme — TLS debugging |
| `MRVLExplainer` | `MRVLExplainer.tsx` | 1080×1920 | 60 s | Jensen Huang / MRVL $1T explainer |
| `ProductDemo` | `ProductDemo.tsx` | 1080×1920 | 40 s | Holoture product launch demo |
| `PromoVideo` | `PromoVideo.tsx` | 1080×1920 | 40 s | iPhone promo (screen recordings) |
| `Carousel-01-Title` … `Carousel-07-CTA` | `Carousel.tsx` | 1080×1350 | still | Instagram carousel — top 5 stocks 2026 |
| `SignalReel` | `SignalReel.tsx` | 1080×1920 | 15 s | Daily signal reel |
| `PoliticianReel` | `PoliticianReel.tsx` | 1080×1920 | 15 s | Politician trade reel |
| `WeeklyRecap` | `WeeklyRecap.tsx` | 1080×1920 | 18 s | Weekly recap |
| `SectorTrends` | `SectorTrends.tsx` | 1080×1920 | 12 s | Sector trends |

---

## Render Commands

### Expanding Brain meme → MP4
```bash
npx tsx scripts/render-expanding-brain.ts
# output: public/generated-videos/expanding-brain.mp4
```

Or via CLI directly:
```bash
npx remotion render remotion/index.ts ExpandingBrain \
  "C:\Users\jaken\Desktop\expanding-brain.mp4" \
  --public-dir=public
```

### Instagram Carousel → 7 PNGs
```bash
npx tsx scripts/render-carousel.ts
# output: public/generated-images/carousel/slide-01-title.png … slide-07-cta.png
```

### MRVL Explainer → MP4
```bash
npx remotion render remotion/index.ts MRVLExplainer \
  "C:\Users\jaken\Desktop\mrvl-explainer.mp4" \
  --public-dir=public
```

### PromoVideo → MP4
```bash
npx tsx scripts/render-promo.ts
# output: public/generated-videos/promo-video.mp4
```

---

## Notes

- All rendered MP4s and PNGs are gitignored (`*.mp4`, `/public/generated-images/`).
- The `publicDir` flag is required for local renders to find assets in `/public/`.
- DM Sans loads via `@remotion/google-fonts/DMSans` (correct casing — capital M).
- Composition IDs must use only `a-z A-Z 0-9 -` (no underscores).
