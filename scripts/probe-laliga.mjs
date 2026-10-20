// Prints status and a sample of candidate data sources (run in GitHub Actions).
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
const targets = [
  ['https://api-fantasy.llt-services.com/api/v3/players', {}],
  ['https://api-fantasy.llt-services.com/api/v3/players?x-lang=es', { 'User-Agent': UA }],
  ['https://fantasy.laliga.com/', { 'User-Agent': UA }],
  ['https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard', {}],
  ['https://site.api.espn.com/apis/v2/sports/soccer/esp.1/standings', {}],
  ['https://www.futbolfantasy.com/laliga/clasificacion', { 'User-Agent': UA }],
  ['https://www.futbolfantasy.com/jugadores/unai-nunez', { 'User-Agent': UA }],
  ['https://www.analiticafantasy.com/', { 'User-Agent': UA }],
  ['https://www.jornadaperfecta.com/jugador/luiz-felipe', { 'User-Agent': UA }],
  ['https://www.comuniate.com/jugadores/3311/pablo-ibanez', { 'User-Agent': UA }],
  ['https://api.sofascore.com/api/v1/unique-tournament/8/seasons', { 'User-Agent': UA }],
  ['https://www.fotmob.com/api/leagues?id=87', { 'User-Agent': UA }],
  ['https://fbref.com/en/comps/12/La-Liga-Stats', { 'User-Agent': UA }],
  ['https://www.laliga.com/laliga-easports/clasificacion', { 'User-Agent': UA }],
  ['https://understat.com/league/La_liga', { 'User-Agent': UA }],
]
for (const [url, headers] of targets) {
  try {
    const res = await fetch(url, { headers, redirect: 'follow' })
    const text = await res.text()
    console.log(`\n=== ${url} -> ${res.status} ${res.headers.get('content-type')} (${text.length} bytes)`)
    console.log(text.replace(/\s+/g, ' ').slice(0, 700))
  } catch (e) {
    console.log(`\n=== ${url} -> ERROR ${e.message}`)
  }
}
