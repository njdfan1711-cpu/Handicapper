# Handicapper (personal prototype)

Read-only viewer for the Keeneland Breeders' Cup card (Sat Oct 31, 2026), parsed from the TVG/Equibase PP PDF.
Shows ranked horses per race, win/exacta/trifecta/superfecta picks from the scoring model, and a weights panel
(saved in your browser) to tune the model live.

## Deploy to Vercel
1. Create a new empty GitHub repo, then upload the contents of this folder (not the zip itself).
2. In Vercel: Add New > Project > import that repo.
3. Leave the defaults (Framework: Vite, Build: `npm run build`, Output: `dist`) and click Deploy.

## Run locally (optional)
1. Install Node.js 20 or newer from nodejs.org.
2. Open a terminal in this folder.
3. Run `npm install`, then `npm run dev`, then open the address it prints.

## Where things live
- `src/data/card.json`: the parsed card (swap this file to load another card).
- `src/lib/score.ts`: scoring model (z-scores per factor, weighted, softmax, Plackett-Luce for exotics).
- `src/App.tsx`, `src/styles.css`: the interface.
- `tools/`: the Python used to parse the PDF and build `card.json`. Reference only; paths are hardcoded to the build sandbox.

## Not built yet
PDF upload, live odds entry (value ranking), results/backtesting, race simulation.
