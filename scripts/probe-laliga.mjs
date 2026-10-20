// Prints the shape of candidate LaLiga Fantasy endpoints (run in GitHub Actions).
const BASE = 'https://api-fantasy.llt-services.com'
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  Accept: 'application/json',
  Origin: 'https://fantasy.laliga.com',
  Referer: 'https://fantasy.laliga.com/',
}

async function show(path) {
  try {
    const res = await fetch(BASE + path, { headers: HEADERS })
    const text = await res.text()
    console.log(`\n=== ${path} -> ${res.status} (${text.length} bytes)`)
    console.log(text.slice(0, 1800))
    return res.ok ? JSON.parse(text) : null
  } catch (e) {
    console.log(`\n=== ${path} -> ERROR ${e.message}`)
    return null
  }
}

const list = (await show('/api/v4/players?x-lang=es')) ?? (await show('/api/v3/players?x-lang=es'))
const arr = Array.isArray(list) ? list : list?.data ?? list?.players ?? []
console.log('\nplayers:', arr.length)
const top = [...arr].sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0))[0]
if (top) {
  await show(`/api/v4/player/${top.id}?x-lang=es`)
  await show(`/api/v3/player/${top.id}?x-lang=es`)
  await show(`/api/v3/player/${top.id}/market-value?x-lang=es`)
}
for (const p of ['/stats/v1/stats/week/10?x-lang=es', '/api/v3/calendar?x-lang=es&weekNumber=10', '/stats/v1/calendar/week/10', '/api/v3/teams?x-lang=es', '/stats/v1/stats/teams?x-lang=es', '/api/v3/week/current?x-lang=es']) {
  await show(p)
}
