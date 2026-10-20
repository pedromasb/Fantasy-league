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

async function get(url, sample, extraHeaders = {}) {
  if (samplesDir) {
    const f = `${samplesDir}/${sample}`
    return existsSync(f) ? readFile(f, 'utf8') : null
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9', ...extraHeaders } })
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

const MONTHS = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 }

/** "Domingo, 18 de octubre del 2026 a las 14:00h" -> "2026-10-18". */
export function parseMatchDate(html) {
  const m = html.match(/(\d{1,2}) de ([a-záéíóú]+) del? (\d{4})/i)
  const month = m && MONTHS[m[2].toLowerCase()]
  return month ? `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}` : undefined
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

/** Balanced-brace JSON object starting at `start` in `s`. */
function readObject(s, start) {
  let depth = 0
  let inStr = false
  for (let j = start; j < s.length; j++) {
    const c = s[j]
    if (inStr) {
      if (c === '\\') j++
      else if (c === '"') inStr = false
    } else if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return JSON.parse(s.slice(start, j + 1))
  }
  return null
}

const nextChunks = (html) =>
  [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map((m) => JSON.parse(`"${m[1]}"`)).join('')

/** analiticafantasy.com/jugadores/SLUG/fantasy/la-liga-fantasy: daily values and per-matchday stats. */
export function parseAnaliticaPlayer(html) {
  const s = nextChunks(html)
  const i = s.indexOf('"data":{"mode":"la-liga-fantasy"')
  if (i < 0) return null
  const data = readObject(s, s.indexOf('{', i + 6))
  if (!data) return null
  return {
    values: (data.marketHistory ?? []).map((h) => [h.date, h.marketValue]),
    weeks: (data.statsRows ?? []).map((r) => ({
      week: r.week,
      points: r.points,
      minutes: r.minutes,
      goals: r.goals,
      assists: r.assists,
      yellow: r.yellowCards,
      red: r.redCards,
      date: r.fixture?.date?.slice(0, 10),
      // Official LaLiga Fantasy breakdown: stat -> [value, points], only non-zero entries.
      breakdown: r.stats && Object.keys(r.stats).length
        ? Object.fromEntries(
            Object.entries(r.stats)
              .filter(([k, v]) => !k.endsWith('_pts') && typeof v === 'number' && (v !== 0 || r.stats[`${k}_pts`]))
              .map(([k, v]) => [k, [v, r.stats[`${k}_pts`] ?? 0]]),
          )
        : undefined,
    })),
  }
}

/** futbolfantasy.com/jugadores/SLUG: season stats block ("Pases completados / Pases: 246/281 (88%)"). */
export function parseFutbolFantasyPlayer(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const start = text.findIndex((l) => /^Estadísticas de .+ en LaLiga$/.test(l))
  if (start < 0) return null
  const end = text.findIndex((l, i) => i > start && l.startsWith('Selecciona modo'))
  const lines = text.slice(start + 1, end > 0 ? end : start + 200)
  const stats = {}
  for (let i = 0; i < lines.length; i++) {
    const label = lines[i].replace(/:$/, '')
    if (/^\(?\d/.test(label) || /^\//.test(label)) continue
    // Value lines follow the label: "246", "/281", "(88%)"; Titular/Suplente put the % first.
    const vals = []
    let j = i + 1
    while (j < lines.length && /^[(/\d-]/.test(lines[j])) vals.push(lines[j++])
    if (vals.length) {
      stats[label] = vals.join(' ').replace(/\s+/g, ' ').replace(' /', '/')
      i = j - 1
    }
  }
  return stats
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

const US = 'https://understat.com'
const usHeaders = (referer) => ({ 'X-Requested-With': 'XMLHttpRequest', Referer: referer })
const decode = (s) => s.replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')
const f2 = (x) => Math.round(Number(x) * 100) / 100

/** understat.com league JSON: season xG/xA per player and xG per match per team. */
async function loadUnderstat(season) {
  const text = await get(`${US}/getLeagueData/La_liga/${season}`, 'us-league.json', usHeaders(`${US}/league/La_liga`))
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** Match an understat player to a futbolfantasy one: same team, then full name or all short-name words. */
function understatIndex(us) {
  const byTeam = new Map()
  for (const p of us?.players ?? []) {
    // Players who changed club mid-season list both teams ("Getafe,Valencia").
    for (const t of String(p.team_title).split(',')) {
      const k = teamKey(t)
      if (!byTeam.has(k)) byTeam.set(k, [])
      byTeam.get(k).push({ ...p, n: norm(decode(p.player_name)) })
    }
  }
  return (ff, team) => {
    const list = byTeam.get(teamKey(team)) ?? []
    const full = norm(ff.fullName ?? ff.name)
    const exact = list.filter((u) => u.n === full || u.n === norm(ff.name))
    if (exact.length === 1) return exact[0]
    const words = norm(ff.name).replace(/\b[a-z]\b/g, '').split(' ').filter(Boolean)
    const loose = list.filter((u) => words.every((w) => u.n.split(' ').includes(w)))
    if (loose.length === 1) return loose[0]
    const fullWords = full.split(' ')
    const last = list.filter((u) => fullWords.length > 1 && u.n.split(' ').slice(-1)[0] === fullWords[fullWords.length - 1] && u.n[0] === full[0])
    return last.length === 1 ? last[0] : undefined
  }
}

const usSummary = (u) => ({
  id: Number(u.id),
  games: Number(u.games),
  minutes: Number(u.time),
  goals: Number(u.goals),
  xG: f2(u.xG),
  npg: Number(u.npg),
  npxG: f2(u.npxG),
  assists: Number(u.assists),
  xA: f2(u.xA),
  shots: Number(u.shots),
  keyPasses: Number(u.key_passes),
  xGChain: f2(u.xGChain),
  xGBuildup: f2(u.xGBuildup),
})

/** Season xG for and against per team, plus the last five matches. */
function understatTeams(us) {
  const out = {}
  for (const t of Object.values(us?.teams ?? {})) {
    const h = t.history ?? []
    const sum = (arr, k) => f2(arr.reduce((a, m) => a + Number(m[k] ?? 0), 0))
    out[teamKey(t.title)] = { xG: sum(h, 'xG'), xGA: sum(h, 'xGA'), games: h.length, last5xG: sum(h.slice(-5), 'xG'), last5xGA: sum(h.slice(-5), 'xGA') }
  }
  return out
}

const PLAYERS_DIR = 'public/data/players'
const SEASON_YEAR = '2026'

/** ffIds worth deep data: my squad, the latest market, pending bids, ledger players, plus the top 25 by form. */
async function trackedIds(out) {
  const ids = new Set()
  try {
    const mine = JSON.parse(await readFile('public/data/fantasy.json', 'utf8'))
    const last = (rec) => rec[Object.keys(rec).sort().pop()]
    const wanted = new Set([
      ...(last(mine.squads ?? {})?.slots ?? []).map((x) => x.playerId),
      ...(last(mine.markets ?? {}) ?? []).map((x) => x.playerId),
      ...(mine.bids ?? []).map((x) => x.playerId),
      ...(mine.ledger ?? []).map((x) => x.playerId),
    ])
    for (const id of wanted) if (mine.players[id]?.ffId) ids.add(mine.players[id].ffId)
    // Players bought or sold, so the team value history can be rebuilt.
    for (const x of mine.ledger ?? []) if (x.ffId && ['compra', 'venta'].includes(x.kind)) ids.add(x.ffId)
  } catch (e) {
    console.warn('fantasy.json unreadable:', e.message)
  }
  const form = (p) => p.last5.reduce((a, x) => a + (x ?? 0), 0)
  for (const p of [...out].filter((p) => p.pos !== 'COA').sort((a, b) => form(b) - form(a)).slice(0, 25)) ids.add(p.id)
  return ids
}

/** Per-player files with season-long value history, per-matchday stats and advanced season stats. */
async function syncTracked(out, matches, weekDates) {
  if (samplesDir) return
  await mkdir(PLAYERS_DIR, { recursive: true })
  const ids = await trackedIds(out)
  const byId = new Map(out.map((p) => [p.id, p]))
  const today = new Date().toISOString().slice(0, 10)
  let ok = 0
  for (const id of ids) {
    const p = byId.get(id)
    if (!p) continue
    const file = `${PLAYERS_DIR}/${id}.json`
    const prev = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : { values: [], weeks: [] }
    const af = p.afSlug ? await get(`https://www.analiticafantasy.com/jugadores/${p.afSlug}/fantasy/la-liga-fantasy`, '') : null
    await sleep(300)
    const ff = p.ffSlug ? await get(`${FF}/jugadores/${p.ffSlug}`, '') : null
    await sleep(300)
    const afData = af ? parseAnaliticaPlayer(af) : null
    const season = ff ? parseFutbolFantasyPlayer(ff) : null
    let usMatches = []
    if (p.xg?.id) {
      const raw = await get(`${US}/getPlayerData/${p.xg.id}`, '', usHeaders(`${US}/player/${p.xg.id}`))
      try {
        usMatches = (JSON.parse(raw ?? '{}').matches ?? []).filter((m) => String(m.season) === SEASON_YEAR)
      } catch {
        usMatches = []
      }
      await sleep(300)
    }

    // Values: keep every day ever seen, newer sources win.
    const values = new Map(prev.values)
    for (const [d, v] of afData?.values ?? []) values.set(d, v)
    for (const [ago, v] of Object.entries(p.valueAgo)) {
      const d = new Date(Date.now() - Number(ago) * 864e5).toISOString().slice(0, 10)
      if (!values.has(d)) values.set(d, v)
    }
    if (p.value) values.set(today, p.value)

    // Matchdays: merge, keep an older breakdown when the new row lacks it; add date and rival.
    const weeks = new Map(prev.weeks.map((w) => [w.week, w]))
    for (const w of afData?.weeks ?? []) {
      const old = weeks.get(w.week) ?? {}
      weeks.set(w.week, { ...old, ...w, breakdown: w.breakdown ?? old.breakdown, date: w.date ?? old.date })
    }
    for (const [wk, pts] of Object.entries(p.weeks)) {
      const w = Number(wk)
      if (!weeks.has(w)) weeks.set(w, { week: w, points: pts })
    }
    for (const w of weeks.values()) {
      const fx = matches.find((m) => m.week === w.week && (m.home === p.teamId || m.away === p.teamId))
      if (fx) {
        w.date = w.date ?? fx.date ?? weekDates[w.week]
        w.rival = fx.home === p.teamId ? fx.awayName : fx.homeName
        w.home = fx.home === p.teamId
        if (fx.score) w.score = fx.home === p.teamId ? fx.score : [fx.score[1], fx.score[0]]
      }
    }

    // understat per match: matched by date (±1 day for late kick-offs across midnight).
    for (const w of weeks.values()) {
      if (!w.date) continue
      const t = Date.parse(w.date)
      const m = usMatches.find((x) => Math.abs(Date.parse(x.date) - t) <= 864e5)
      if (m) Object.assign(w, { xG: f2(m.xG), xA: f2(m.xA), shots: Number(m.shots), keyPasses: Number(m.key_passes) })
    }

    const data = {
      id,
      name: p.name,
      updated: new Date().toISOString(),
      values: [...values.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      weeks: [...weeks.values()].sort((a, b) => a.week - b.week),
      season: season ?? prev.season,
    }
    await writeFile(file, JSON.stringify(data))
    if (afData || season) ok++
  }
  console.log(`tracked players: ${ids.size}, with fresh detail: ${ok}`)
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
  const slugs = {} // ffId -> futbolfantasy player slug
  const weekDates = {} // week -> first match date
  let fetched = 0
  for (const m of matches.filter((x) => x.finished)) {
    const file = `${CACHE}/${m.id}.json`
    let cached = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : null
    if (Array.isArray(cached)) cached = null // old cache format without the match date
    if (!cached) {
      const html = await get(`${FF}/partidos/${m.slug}`, samplesDir ? 'ff-partido.html' : '')
      if (!html) continue
      cached = { date: parseMatchDate(html), rows: parseMatch(html) }
      if (cached.rows.length && !samplesDir) await writeFile(file, JSON.stringify(cached))
      fetched++
      await sleep(400)
    }
    const rows = cached.rows
    m.date = cached.date
    if (cached.date && (!weekDates[m.week] || cached.date < weekDates[m.week])) weekDates[m.week] = cached.date
    for (const r of rows) {
      if (r.slug) slugs[r.id] = r.slug
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

  const us = await loadUnderstat(SEASON_YEAR)
  const findUs = understatIndex(us)
  console.log(`understat: ${us?.players?.length ?? 0} players`)

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
      ffSlug: slugs[p.id],
      afSlug: a?.playerSlug,
      xg: (() => {
        const u = findUs(p, teamName)
        return u ? usSummary(u) : undefined
      })(),
    }
  })

  await syncTracked(out, matches, weekDates)

  const data = {
    updated: new Date().toISOString(),
    season: '2026-27',
    lastWeek,
    recentWeeks,
    teams: (() => {
      const t = teamTable(matches)
      const xg = understatTeams(us)
      for (const row of Object.values(t)) Object.assign(row, xg[teamKey(row.name)] ?? {})
      return t
    })(),
    teamNames: teams,
    weekDates,
    fixtures: matches.map(({ id, week, home, away, homeName, awayName, score, when, finished, date }) => ({ id, week, home, away, homeName, awayName, score, when, finished, date })),
    players: out,
  }
  await mkdir('public/data', { recursive: true })
  await writeFile(samplesDir ? `${samplesDir}/league.test.json` : OUT, JSON.stringify(data))
  console.log(`understat matched: ${out.filter((p) => p.xg).length}`)
  console.log(`wrote ${out.length} players, last finished week ${lastWeek}, matched with analitica: ${out.filter((p) => p.rank !== undefined).length}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
