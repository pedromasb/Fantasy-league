# Fantasy Asesor: procedimiento diario

The user sends LaLiga Fantasy screenshots in chat (market daily, squad when it changes). For each:

1. Read the screenshot. Market cards give position tag (COA/DEF/MID/STR/GK), name, team badge, status, FSYP (season fantasy points), Value, Price and bids. Line-up gives formation, team value, signings and the XI (names may be truncated).
2. Update `public/data/fantasy.json` (types in `src/types.ts`):
   - `markets[YYYY-MM-DD]`: one entry per market player (`price` = shown Price).
   - `squads[YYYY-MM-DD]`: only when the squad changes or a squad screenshot arrives.
   - `players`: add new players; refresh `stats`, `news`, `sources`, `statsUpdated` with web research: WebSearch, plus direct `curl` to futbolfantasy.com, analiticafantasy.com, comuniate.com, jornadaperfecta.com, laliga.com, site.api.espn.com and understat.com (allowed in this environment; the official api-fantasy.llt-services.com answers 502 to datacenter IPs). Note conflicting sources instead of guessing.
   - `reports[YYYY-MM-DD]`: title, summary, sections, a `players` recommendation for every market and squad player, and `lineup`.
   - `updated`: current timestamp.
   - Before recommending, read `public/data/league.json` (synced every morning by `.github/workflows/sync.yml` from futbolfantasy.com and analiticafantasy.com): every player's points per matchday, last five matchdays, season average and rank, titularity %, value today and 1-30 days ago, next rival and play probability, understat xG/xA (players) and xG/xGA (teams), fixtures and team table. Deep per-player files (season value history, matchday stats with xG, advanced stats) are in `public/data/players/<ffId>.json`. To run the sync locally: `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/sync-league.mjs`. Use it for form, fixture difficulty and value speculation. Set `ffId` on players so the app links them to league data. Run the sync workflow (workflow_dispatch) if the data is stale.
   - Every decision gets an entry in `reports[date].analyses` (see `Analysis` in `src/types.ts`): the question, a comparison table with real numbers (average, last five, play probability, rival and its xG, value trend 1/7/30 days, xG/xA, clause, cost), the arguments and a clear conclusion. Use all available data: league.json, the per-player files, understat, fixtures, team xG/xGA, news and probable line-ups from the allowed sites, and the user's market, balance, squad and history.
   - Anything recommended in chat must be reflected in the web the same day (analyses, plan, verdicts, line-up and captain). Respect the user's decisions (e.g. players they choose to keep) and plan around them, noting the risk once.
3. Run `npm test` and `npm run build`, then commit and push to the working branch (deploys via `.github/workflows/deploy.yml`).

Keep all user-facing text in Spanish.
