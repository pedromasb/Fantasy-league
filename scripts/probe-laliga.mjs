// Explores page structure of fantasy data sites (run in GitHub Actions).
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
const get = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  return { status: res.status, text: await res.text() }
}
const links = (html, re) => [...new Set([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => re.test(h)))]
const around = (html, needle, n = 3, width = 300) => {
  const out = []
  let i = -1
  while (out.length < n && (i = html.indexOf(needle, i + 1)) >= 0) out.push(html.slice(Math.max(0, i - 80), i + width).replace(/\s+/g, ' '))
  return out
}

// AnaliticaFantasy
{
  const { status, text } = await get('https://www.analiticafantasy.com/')
  console.log('\n### analitica home', status)
  console.log('links:', links(text, /^\/(?!_next)/).slice(0, 80).join('  '))
  console.log('NEXT_DATA:', text.includes('__NEXT_DATA__'), 'next_f:', text.includes('self.__next_f'))
  console.log('api refs:', [...new Set(text.match(/https?:\/\/[a-z0-9.-]*api[a-z0-9.-]*\/[^"'\s\\]{0,60}/gi) ?? [])].slice(0, 20))
}
for (const u of ['https://www.analiticafantasy.com/laliga-fantasy/jugadores', 'https://www.analiticafantasy.com/jugadores', 'https://www.analiticafantasy.com/laliga-fantasy/mercado', 'https://www.analiticafantasy.com/mercado-laliga-fantasy']) {
  const { status, text } = await get(u)
  console.log(`\n### ${u} ${status} ${text.length}`)
  if (status === 200) {
    console.log('links:', links(text, /jugador|player/).slice(0, 15).join('  '))
    console.log(around(text, 'marketValue', 2).join('\n'))
    console.log(around(text, 'points', 2).join('\n'))
  }
}

// FutbolFantasy player page and analytics
{
  const { text } = await get('https://www.futbolfantasy.com/jugadores/unai-nunez')
  console.log('\n### futbolfantasy player')
  console.log(around(text, 'LaLiga Fantasy', 4).join('\n'))
  console.log(around(text, 'Jornada 9', 3).join('\n'))
  console.log('links:', links(text, /analytics|fantasy|mercado/).slice(0, 30).join('  '))
}
for (const u of ['https://www.futbolfantasy.com/analytics/laliga-fantasy/mercado', 'https://www.futbolfantasy.com/laliga/calendario']) {
  const { status, text } = await get(u)
  console.log(`\n### ${u} ${status} ${text.length}`)
  console.log(around(text, '<table', 1, 1200).join('\n'))
}

// Understat embedded JSON
{
  const { text } = await get('https://understat.com/league/La_liga')
  console.log('\n### understat', ['playersData', 'teamsData', 'datesData'].map((k) => `${k}:${text.includes(k)}`).join(' '))
  console.log(around(text, 'playersData', 1, 400).join('\n'))
}

// LaLiga.com Next data
{
  const { text } = await get('https://www.laliga.com/jugador/pablo-ibanez')
  console.log('\n### laliga player NEXT_DATA:', text.includes('__NEXT_DATA__'))
  console.log(around(text, '"stats"', 2, 600).join('\n'))
}
