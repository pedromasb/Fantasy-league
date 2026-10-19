# Fantasy Asesor: procedimiento diario

The user sends LaLiga Fantasy screenshots in chat (market daily, squad when it changes). For each:

1. Read the screenshot. Market cards give position tag (COA/DEF/MID/STR/GK), name, team badge, status, FSYP (season fantasy points), Value, Price and bids. Line-up gives formation, team value, signings and the XI (names may be truncated).
2. Update `public/data/fantasy.json` (types in `src/types.ts`):
   - `markets[YYYY-MM-DD]`: one entry per market player (`price` = shown Price).
   - `squads[YYYY-MM-DD]`: only when the squad changes or a squad screenshot arrives.
   - `players`: add new players; refresh `stats`, `news`, `sources`, `statsUpdated` with web research (WebSearch works; WebFetch is blocked in this environment). Note conflicting sources instead of guessing.
   - `reports[YYYY-MM-DD]`: title, summary, sections, a `players` recommendation for every market and squad player, and `lineup`.
   - `updated`: current timestamp.
3. Run `npm test` and `npm run build`, then commit and push to the working branch (deploys via `.github/workflows/deploy.yml`).

Keep all user-facing text in Spanish.
