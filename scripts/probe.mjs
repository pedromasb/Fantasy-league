// Temporary: saves raw samples of player pages into samples/ (run in GitHub Actions).
import { mkdir, writeFile } from 'node:fs/promises'
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
const samples = {
  'af-player.html': 'https://www.analiticafantasy.com/jugadores/v-koski-106759/fantasy/la-liga-fantasy',
  'af-player-root.html': 'https://www.analiticafantasy.com/jugadores/v-koski-106759',
  'ff-player.html': 'https://www.futbolfantasy.com/jugadores/ville-koski',
  'ff-player-season.html': 'https://www.futbolfantasy.com/jugadores/ville-koski/laliga-26-27',
  'ff-app.js': 'https://www.futbolfantasy.com/js/app.min.js',
  'ff-app2.js': 'https://www.futbolfantasy.com/js/app-secondary.min.js',
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
