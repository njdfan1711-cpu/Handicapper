# Handicapper (personal prototype)

Viewer and analysis tool for TVG/Equibase past-performance cards. Two cards are included:
Churchill Downs Derby Day (May 3, 2025) and Keeneland Breeders' Cup Saturday (Oct 31, 2026).

## What it does
- Ranked field per race with model win %, model odds and the gap to the morning line.
- Win / exacta / trifecta / superfecta picks from the model.
- Tap a horse for factor scores, running style, recent races, works and gear. Tap Scratch to drop it; everything re-scores.
  Official scratches and also-eligibles are pre-applied on these two past cards; Restore brings them back.
- Weights panel (saved in your browser). Pace fit is off by default.
- Race simulation: pick a point in the race (start, first turn, backstretch, far turn, quarter pole, stretch, finish) and see each horse's expected spot on the track, a close-up of the pack, and simulated win chances. "One run" shows a single random race; "Most likely" shows the average of 1,500 runs.

## Deploy to Vercel
1. Create a new empty GitHub repo and upload the contents of this folder (not the zip itself).
2. In Vercel: Add New > Project > import that repo. Keep the defaults (Vite, `npm run build`, `dist`) and Deploy.

## Updating an existing deployed copy
Replace the whole repo contents with this folder and delete the old `src/data/card.json` (it is now `src/data/cards.json`). Commit; Vercel redeploys.

## Run locally (optional)
1. Install Node.js 20 or newer from nodejs.org.
2. Open a terminal in this folder, run `npm install`, then `npm run dev`, and open the address it prints.

## Where things live
- `src/data/cards.json`: parsed cards (swap in new cards here).
- `src/lib/score.ts`: scoring model. `src/lib/pace.ts`: running-style and pace-matchup rules.
- `src/lib/sim.ts`: simulation engine. `src/lib/track.ts`: oval geometry and call points.
- `src/App.tsx`, `src/SimPanel.tsx`, `src/styles.css`: the interface.
- `scripts/simtest.ts`: backtests the simulation (`npx esbuild scripts/simtest.ts --bundle --platform=node --outfile=/tmp/simtest.cjs && node /tmp/simtest.cjs`).
- `tools/`: Python used to parse the PDFs, score and backtest. Reference only; paths are hardcoded to the build sandbox.

## Not built yet
PDF upload, live odds entry, results import, wet-track and pedigree factors.
