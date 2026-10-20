// Builds public/data/league.json with every LaLiga Fantasy player:
// values (today and 1-30 days ago), points per matchday, season totals,
// fixtures and team form. Runs daily in GitHub Actions (see .github/workflows/sync.yml).
//
// Sources: futbolfantasy.com (market analytics, calendar, match pages) and
// analiticafantasy.com (season totals, titularity, status). The official
// LaLiga Fantasy API rejects requests from GitHub's servers.
//
// Usage: node scripts/sync-league.mjs [--samples DIR]   (DIR = offline HTML for testing)
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
const FF = 'https://www.futbolfantasy.com'
const CACHE = 'data/cache/matches'
const OUT = 'public/data/league.json'

const args = process.argv.slice(2)
const samplesDir = args.includes('--samples') ? args[args.indexOf('--samples') + 1] : null
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(url, sample) {
  if (samplesDir) {
    const f = `${samplesDir}/${sample}`
    return existsSync(f) ? readFile(f, 'utf8') : null
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9' } })
      if (res.ok) return await res.text()
      console.warn(`HTTP ${res.status} ${url}`)
    } catch (e) {
      console.warn(`ERROR ${url}: ${e.message}`)
    }
    await sleep(1500 * (attempt + 1))
  }
  return null
}

const num = (s) => (s === undefined || s === null || s === '' ? undefined : Number(s))
const clean = (s) => s.replace(/\s+/g, ' ').trim()
export const norm = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Team names differ between sites ("Betis" vs "Real Betis"): compare by a canonical key. */
const TEAM_ALIASES = {
  'real betis': 'betis', 'celta vigo': 'celta', 'rayo vallecano': 'rayo', 'athletic club': 'athletic', 'athletic bilbao': 'athletic',
  'atletico madrid': 'atletico', 'atletico de madrid': 'atletico', 'racing santander': 'racing', 'racing de santander': 'racing',
  'deportivo la coruna': 'deportivo', 'rc deportivo': 'deportivo', 'real oviedo': 'oviedo', 'rcd espanyol': 'espanyol', 'rcd mallorca': 'mallorca',
}
export const teamKey = (s) => TEAM_ALIASES[norm(s)] ?? norm(s)

const POS = { Portero: 'GK', Defensa: 'DEF', Mediocampista: 'MID', Delantero: 'STR', Entrenador: 'COA' }

/** futbolfantasy.com/analytics/laliga-fantasy/mercado: one <tr> per player. */
export function parseMarket(html) {
  const players = []
  const teams = {}
  for (const row of html.split('<tr class="elemento_jugador').slice(1)) {
    const attr = (k) => row.match(new RegExp(`data-${k}="([^"]*)"`))?.[1]
    const id = num(attr('id'))
    if (!id) continue
    const teamId = num(attr('equipo'))
    const teamName = row.match(/<div class="player-equipo">[\s\S]*?<span>([^<]+)<\/span>/)?.[1]
    if (teamId && teamName) teams[teamId] = clean(teamName)
    const fullName = row.match(/class="player-name"><span[^>]*>([^<]+)<\/span>/)?.[1]
    const shortName = row.match(/class="d-inline d-md-none">([^<]+)<\/span>/)?.[1]
    const rival = row.match(/title="Jornada (\d+) · Próximo rival: ([^"(]+?) \((Casa|Fuera)\)"/)
    const prob = row.match(/class="prob-\d+"[^>]*>(\d+)%/)
    const valueAgo = {}
    for (const d of [1, 2, 3, 7, 14, 30]) {
      const v = num(attr(`valor${d}`))
      if (v) valueAgo[d] = v
    }
    players.push({
      id,
      name: clean(shortName ?? fullName ?? attr('nombre') ?? ''),
      fullName: fullName ? clean(fullName) : undefined,
      pos: POS[attr('posicion')] ?? 'MID',
      teamId,
      value: num(attr('valor')),
      valueAgo,
      trendDays: num(attr('tendencia')),
      next: rival ? { week: Number(rival[1]), rival: clean(rival[2]), home: rival[3] === 'Casa', prob: prob ? Number(prob[1]) : undefined } : undefined,
    })
  }
  return { players, teams }
}

/** futbolfantasy.com/laliga/calendario: every match with its link and result. */
export function parseCalendar(html) {
  const matches = []
  const re = /href="https:\/\/www\.futbolfantasy\.com\/partidos\/(\d+)-([^"]+)" class="partido ([^"]*)"[\s\S]*?escudom\/(\d+)\.png" alt="([^"]+)"[\s\S]*?class="fase">\s*Jornada (\d+)\s*<\/div>\s*<div class="(resultado|date)[^"]*">([\s\S]*?)<\/div>[\s\S]*?escudom\/(\d+)\.png" alt="([^"]+)"/g
  for (const m of html.matchAll(re)) {
    const info = clean(m[8].replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, ''))
    const score = info.match(/^(\d+)-(\d+)$/)
    matches.push({
      id: Number(m[1]),
      slug: `${m[1]}-${m[2]}`,
      week: Number(m[6]),
      home: Number(m[4]),
      homeName: clean(m[5]),
      away: Number(m[9]),
      awayName: clean(m[10]),
      finished: /terminado/.test(m[3]),
      score: score ? [Number(score[1]), Number(score[2])] : undefined,
      when: score ? undefined : info || undefined,
    })
  }
  return matches
}

/** futbolfantasy.com/partidos/ID-slug: LaLiga Fantasy points of everyone in the squad lists. */
export function parseMatch(html) {
  const blocks = html.split('class="juggador ')
  const out = []
  const seen = new Set()
  for (let k = 1; k < blocks.length; k++) {
    const b = blocks[k]
    const before = blocks[k - 1]
    const ids = [...before.matchAll(/jugadores\/ficha\/(\d+)\.png/g)]
    const id = ids.length ? Number(ids[ids.length - 1][1]) : undefined
    const slug = b.match(/href="https:\/\/www\.futbolfantasy\.com\/jugadores\/([^"/]+)/)?.[1]
    const raw = b.match(/alineacion-juego-laliga-fantasy[^"]*">\s*([^<]*?)\s*<\/span>/)?.[1]
    const subOut = b.match(/icono_sale\.png[^>]*><span>(\d+)'/)?.[1]
    const subIn = b.match(/icono_entra\.png[^>]*><span>(\d+)'/)?.[1]
    if (!id || seen.has(id)) continue
    seen.add(id)
    const pts = raw !== undefined && /^-?\d+$/.test(raw) ? Number(raw) : null
    out.push({ id, slug, pts, ...(subOut ? { out: Number(subOut) } : {}), ...(subIn ? { in: Number(subIn) } : {}) })
  }
  return out
}

/** analiticafantasy.com/fantasy-la-liga/mercado: the page embeds every player as JSON. */
export function parseAnalitica(html) {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map((m) => JSON.parse(`"${m[1]}"`))
  const s = chunks.join('')
  const i = s.indexOf('"initialPlayers":')
  if (i < 0) return []
  const start = s.indexOf('[', i)
  let depth = 0
  for (let j = start; j < s.length; j++) {
    if (s[j] === '[') depth++
    else if (s[j] === ']' && --depth === 0) return JSON.parse(s.slice(start, j + 1))
  }
  return []
}

function teamTable(matches) {
  const t = {}
  const row = (id, name) => (t[id] ??= { id, name, played: 0, pts: 0, gf: 0, ga: 0, form: [] })
  for (const m of matches.filter((x) => x.score).sort((a, b) => a.week - b.week)) {
    const [hg, ag] = m.score
    const h = row(m.home, m.homeName)
    const a = row(m.away, m.awayName)
    h.played++; a.played++
    h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg
    const hr = hg > ag ? 'W' : hg < ag ? 'L' : 'D'
    const ar = hr === 'W' ? 'L' : hr === 'L' ? 'W' : 'D'
    h.pts += { W: 3, D: 1, L: 0 }[hr]; a.pts += { W: 3, D: 1, L: 0 }[ar]
    h.form.push(hr); a.form.push(ar)
  }
  const list = Object.values(t).sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf)
  list.forEach((x, i) => { x.rank = i + 1; x.form = x.form.slice(-5) })
  return Object.fromEntries(list.map((x) => [x.id, x]))
}

async function main() {
  const marketHtml = await get(`${FF}/analytics/laliga-fantasy/mercado`, 'ff-mercado.html')
  const calendarHtml = await get(`${FF}/laliga/calendario`, 'ff-calendario.html')
  if (!marketHtml || !calendarHtml) throw new Error('futbolfantasy market or calendar unavailable')
  const { players, teams } = parseMarket(marketHtml)
  const matches = parseCalendar(calendarHtml)
  console.log(`market: ${players.length} players, ${Object.keys(teams).length} teams; calendar: ${matches.length} matches`)

  // Points per matchday from finished match pages (cached once finished).
  await mkdir(CACHE, { recursive: true })
  const points = {} // ffId -> { week: pts }
  const minutes = {}
  let fetched = 0
  for (const m of matches.filter((x) => x.finished)) {
    const file = `${CACHE}/${m.id}.json`
    let rows
    if (existsSync(file)) rows = JSON.parse(await readFile(file, 'utf8'))
    else {
      const html = await get(`${FF}/partidos/${m.slug}`, samplesDir ? 'ff-partido.html' : '')
      if (!html) continue
      rows = parseMatch(html)
      if (rows.length && !samplesDir) await writeFile(file, JSON.stringify(rows))
      fetched++
      await sleep(400)
    }
    for (const r of rows) {
      ;(points[r.id] ??= {})[m.week] = r.pts
      if (r.pts !== null) (minutes[r.id] ??= {})[m.week] = r.out ?? (r.in ? 90 - r.in : 90)
    }
  }
  console.log(`match pages fetched: ${fetched}`)

  // Season totals, titularity and status from analiticafantasy (best effort).
  const afHtml = await get('https://www.analiticafantasy.com/fantasy-la-liga/mercado', 'af-mercado.html')
  const af = afHtml ? parseAnalitica(afHtml) : []
  const afIndex = new Map(af.map((p) => [`${norm(p.nickname)}|${teamKey(p.teamName ?? '')}`, p]))
  const afByTeam = new Map()
  for (const p of af) (afByTeam.get(teamKey(p.teamName ?? '')) ?? afByTeam.set(teamKey(p.teamName ?? ''), []).get(teamKey(p.teamName ?? ''))).push(p)
  // Same team and the nickname appears inside the full name ("Unai Núñez" ~ "Núñez").
  const fuzzy = (p, team) => {
    const words = new Set(norm(p.fullName ?? p.name).split(' '))
    const hits = (afByTeam.get(teamKey(team)) ?? []).filter((a) => norm(a.nickname).split(' ').every((w) => words.has(w)))
    return hits.length === 1 ? hits[0] : undefined
  }
  console.log(`analiticafantasy: ${af.length} players`)

  const finishedWeeks = [...new Set(matches.filter((m) => m.finished).map((m) => m.week))].sort((a, b) => a - b)
  const lastWeek = finishedWeeks[finishedWeeks.length - 1] ?? 0
  const recentWeeks = finishedWeeks.slice(-5)

  const out = players.map((p) => {
    const teamName = teams[p.teamId] ?? ''
    const a = afIndex.get(`${norm(p.name)}|${teamKey(teamName)}`) ?? fuzzy(p, teamName)
    const weeks = points[p.id] ?? {}
    const played = Object.values(weeks).filter((x) => x !== null)
    const total = played.reduce((s, x) => s + x, 0)
    return {
      ...p,
      team: teamName,
      points: a?.currentSeason?.points ?? total,
      average: a?.currentSeason?.average ?? (played.length ? +(total / played.length).toFixed(2) : undefined),
      played: a?.currentSeason?.played ?? played.length,
      rank: a?.currentSeason?.rank,
      lastSeason: a?.lastSeason ? { points: a.lastSeason.points, average: a.lastSeason.average, played: a.lastSeason.played } : undefined,
      titularity: a?.titularityPercent,
      status: a ? (a.isSanctioned ? 'suspended' : a.playerStatus === 'injured' ? 'injured' : a.playerStatus === 'doubtful' ? 'doubtful' : 'available') : undefined,
      dayChange: a?.subida,
      weeks,
      minutes: minutes[p.id],
      last5: recentWeeks.map((w) => (weeks[w] === undefined ? null : weeks[w])),
    }
  })

  const data = {
    updated: new Date().toISOString(),
    season: '2026-27',
    lastWeek,
    recentWeeks,
    teams: teamTable(matches),
    teamNames: teams,
    fixtures: matches.map(({ id, week, home, away, homeName, awayName, score, when, finished }) => ({ id, week, home, away, homeName, awayName, score, when, finished })),
    players: out,
  }
  await mkdir('public/data', { recursive: true })
  await writeFile(samplesDir ? `${samplesDir}/league.test.json` : OUT, JSON.stringify(data))
  console.log(`wrote ${out.length} players, last finished week ${lastWeek}, matched with analitica: ${out.filter((p) => p.rank !== undefined).length}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
