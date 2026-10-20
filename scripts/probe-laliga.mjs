// Saves raw samples of candidate sources into samples/ (run in GitHub Actions).
import { mkdir, writeFile } from 'node:fs/promises'
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
const samples = {
  'ff-mercado.html': 'https://www.futbolfantasy.com/analytics/laliga-fantasy/mercado',
  'ff-player.html': 'https://www.futbolfantasy.com/jugadores/unai-nunez',
  'ff-partido.html': 'https://www.futbolfantasy.com/partidos/22508-osasuna-racing',
  'ff-calendario.html': 'https://www.futbolfantasy.com/laliga/calendario',
  'af-mercado.html': 'https://www.analiticafantasy.com/fantasy-la-liga/mercado',
  'af-puntuaciones.html': 'https://www.analiticafantasy.com/partido/100012019/puntuaciones',
  'espn-scoreboard.json': 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard?dates=20261023-20261026',
  'espn-standings.json': 'https://site.api.espn.com/apis/v2/sports/soccer/esp.1/standings',
}
await mkdir('samples', { recursive: true })
for (const [file, url] of Object.entries(samples)) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    const text = await res.text()
    await writeFile(`samples/${file}`, text)
    console.log(file, res.status, text.length)
  } catch (e) {
    console.log(file, 'ERROR', e.message)
  }
}
