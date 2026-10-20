// Temporary: saves raw samples of player pages into samples/ (run in GitHub Actions).
import { mkdir, writeFile } from 'node:fs/promises'
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
const samples = {
  'ff-partido.html': 'https://www.futbolfantasy.com/partidos/22508-osasuna-racing',
  'ff-calendario.html': 'https://www.futbolfantasy.com/laliga/calendario',
  'espn-day.json': 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard?dates=20261017',
  'espn-range.json': 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard?dates=20260801-20261020&limit=400',
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
