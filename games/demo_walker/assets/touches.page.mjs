// Writes the library's touch catalogue as one page: every clip of `~/troupe-collection/packs` under its
// case (anim's `plugins/anim/anim.touches.json`), with what anim's touch reader (`anim.touches.mjs`) read of
// it, searchable by name, description and file. The page holds its data and needs nothing else:
//   node games/demo_walker/assets/touches.page.mjs <out.html>
//
// It reads `anim.touches.json` (the things, the cases and their families), `mixamo-touches.json` (each clip as
// read) and `mixamo-catalogue.json` (Mixamo's preview of each clip, linked, not shown: the page loads no
// picture from elsewhere). Each clip carries its case, seconds, frames, whether it loops, its travel,
// its floors and lift, the sizes of what it touches (the reader's `things`, its long lists cut to their
// first few: the presses to their `over`, the grips to their `lip` and `span`), and its doubts.
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const here = import.meta.dirname
const troupe = path.join(homedir(), 'troupe-collection')
const packs = path.join(troupe, 'packs')
const out = process.argv[2]
if (!out) throw new Error('touches.page.mjs: name the page to write')
const taxonomy = JSON.parse(readFileSync(path.join(here, '..', '..', '..', 'plugins', 'anim', 'anim.touches.json'), 'utf8'))
const read = JSON.parse(readFileSync(path.join(packs, 'mixamo-touches.json'), 'utf8')).clips
const catalogue = JSON.parse(readFileSync(path.join(packs, 'mixamo-catalogue.json'), 'utf8'))

// Mixamo's preview of each clip, by its path under ~/troupe-collection.
const gif = new Map()
for (const m of Object.values(catalogue)) for (const c of m.clips ?? []) if (c.file && c.gif) gif.set(path.relative(troupe, c.file), c.gif)

// Each list the reader writes cut to its first few.
const FEW = 4
const trim = t => {
  const o = { ...t }
  delete o.press
  delete o.grips
  if (t.grips) o.grips = t.grips.length
  for (const k of ['points', 'palms', 'knees', 'back', 'seat']) if (Array.isArray(o[k])) o[k] = o[k].slice(0, FEW)
  if (o.strikes) o.strikes = o.strikes.slice(0, 3)
  return o
}

const clips = Object.entries(read).filter(([, c]) => !c.error).map(([file, c]) => ({
  file,
  name: c.name, description: c.description, case: c.case,
  dur: c.dur, frames: c.frames, loop: c.loop, travel: c.travel,
  floors: c.floors.map(l => l.y),
  lift: c.lift ? [Math.min(...c.lift.map(r => r[1])), Math.max(...c.lift.map(r => r[1]))] : null,
  things: trim(c.things),
  doubts: c.doubts.map(d => d.question),
  gif: gif.get(file) ?? null,
}))
const failed = Object.entries(read).filter(([, c]) => c.error).map(([file, c]) => ({ file, error: c.error }))
const data = { things: taxonomy.things, parts: taxonomy.parts, cases: taxonomy.cases.map(({ words, ...c }) => c), clips, failed }
const json = JSON.stringify(data).replace(/</g, '\\u003c')

const page = `<title>Mixamo Touch Catalogue</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..100,500..800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: a capture-room ledger. A sticky bar (name, count, search) over two columns: the cases by
   family on the left, the selected case's clips on the right, each a row of numbers read off the skin. */
:root {
  --paper: #eef1f0; --sheet: #f8faf9; --ink: #1a2321; --muted: #5a6865; --rule: #d3dbd8;
  --accent: #2346a6; --accent-soft: #dde4f6; --doubt: #9a5b00; --doubt-soft: #f6ead6;
  --display: "Archivo", "Arial Narrow", system-ui, sans-serif;
  --body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --paper: #121715; --sheet: #19201e; --ink: #dfe7e4; --muted: #93a29e; --rule: #2b3532;
  --accent: #8ea7ff; --accent-soft: #1f2a48; --doubt: #f0b35a; --doubt-soft: #3a2b12; color-scheme: dark } }
:root[data-theme="dark"] {
  --paper: #121715; --sheet: #19201e; --ink: #dfe7e4; --muted: #93a29e; --rule: #2b3532;
  --accent: #8ea7ff; --accent-soft: #1f2a48; --doubt: #f0b35a; --doubt-soft: #3a2b12; color-scheme: dark }
body { background: var(--paper); color: var(--ink); font: 15px/1.5 var(--body); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--sheet); }
.wrap { padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
header { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--sheet); border-bottom: 1px solid var(--rule); }
header .wrap { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 24px; padding-block: 14px; }
h1 { margin: 0; font: 800 26px/1.1 var(--display); font-stretch: 80%; letter-spacing: -0.01em; }
.count { color: var(--muted); font: 13px var(--mono); font-variant-numeric: tabular-nums; }
.search { flex: 1 1 280px; display: flex; min-width: 0; }
.search input { flex: 1; min-width: 0; font: 15px var(--body); padding: 8px 12px; border: 1px solid var(--rule); border-radius: 6px; background: var(--paper); color: var(--ink); }
.search input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
main.wrap { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 32px; padding-block: 24px 64px; }
nav { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 74px); align-self: start; max-height: calc(100vh - 100px); overflow-y: auto; display: grid; gap: 18px; }
nav h2 { margin: 0 0 4px; font: 600 11px var(--body); letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted); }
nav ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px; }
nav button { width: 100%; display: flex; justify-content: space-between; gap: 8px; text-align: left; font: 14px var(--body); color: var(--ink); background: none; border: 0; border-radius: 5px; padding: 4px 8px; cursor: pointer; }
nav button:hover { background: var(--accent-soft); }
nav button:focus-visible { outline: 2px solid var(--accent); }
nav button[aria-current="true"] { background: var(--accent); color: var(--sheet); }
nav button span:last-child { font: 12px var(--mono); font-variant-numeric: tabular-nums; opacity: 0.8; }
#pick { display: none; font: 15px var(--body); padding: 8px; border: 1px solid var(--rule); border-radius: 6px; background: var(--sheet); color: var(--ink); width: 100%; }
.case-head { display: grid; gap: 10px; margin-bottom: 18px; }
.case-head h2 { margin: 0; font: 800 30px/1.1 var(--display); font-stretch: 85%; text-wrap: balance; }
.case-head .family { font: 600 11px var(--body); letter-spacing: 0.09em; text-transform: uppercase; color: var(--accent); }
.case-head p { margin: 0; max-width: 68ch; }
.needs { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.thing { background: var(--sheet); border: 1px solid var(--rule); border-radius: 8px; padding: 12px 14px; min-width: 0; }
.thing b { font: 700 15px var(--display); font-stretch: 90%; }
.thing .shape { font: 12px var(--mono); color: var(--muted); margin-left: 6px; }
.thing p { margin: 4px 0 6px; color: var(--muted); font-size: 14px; }
.thing dl { margin: 0; display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 2px 10px; font-size: 13px; }
.thing dt { font-family: var(--mono); }
.thing dd { margin: 0; color: var(--muted); }
.list { display: grid; border-top: 1px solid var(--rule); }
.clip { border-bottom: 1px solid var(--rule); }
.clip > button { width: 100%; text-align: left; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 16px; padding: 10px 4px; background: none; border: 0; color: inherit; font: inherit; cursor: pointer; }
.clip > button:hover { background: var(--sheet); }
.clip > button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.name { font-weight: 600; }
.name small { font-weight: 400; color: var(--muted); }
.meta { font: 12px var(--mono); color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.read { grid-column: 1 / -1; font: 13px var(--mono); color: var(--ink); overflow-wrap: anywhere; }
.chip { display: inline-block; font: 600 11px var(--body); letter-spacing: 0.04em; padding: 1px 7px; border-radius: 99px; margin-right: 6px; }
.chip.case { background: var(--accent-soft); color: var(--accent); }
.chip.doubt { background: var(--doubt-soft); color: var(--doubt); }
.detail { padding: 4px 4px 16px; display: grid; gap: 10px; }
.detail .file { font: 12px var(--mono); color: var(--muted); overflow-wrap: anywhere; }
.detail ul.doubts { margin: 0; padding-left: 18px; color: var(--doubt); }
.detail pre { margin: 0; background: var(--sheet); border: 1px solid var(--rule); border-radius: 6px; padding: 10px 12px; font: 12px/1.45 var(--mono); overflow-x: auto; }
.detail a { color: var(--accent); }
.more { margin-top: 14px; font: 14px var(--body); padding: 8px 14px; border: 1px solid var(--rule); border-radius: 6px; background: var(--sheet); color: var(--ink); cursor: pointer; }
.empty { color: var(--muted); padding: 24px 0; }
.note { color: var(--muted); font-size: 13px; max-width: 68ch; margin: 0 0 12px; }
@media (max-width: 760px) {
  main.wrap { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  nav { display: none; }
  #pick { display: block; }
  .clip > button { grid-template-columns: minmax(0, 1fr); }
  .meta { text-align: left; }
}
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
</style>

<header><div class="wrap">
  <h1>Mixamo Touch Catalogue</h1>
  <span class="count" id="count"></span>
  <label class="search" for="q"><input id="q" type="search" placeholder="Search names, descriptions and files" autocomplete="off"></label>
</div></header>
<main class="wrap">
  <nav id="nav" aria-label="Cases"></nav>
  <section style="min-width:0">
    <select id="pick" aria-label="Case"></select>
    <div id="head"></div>
    <div id="list" class="list"></div>
    <div id="tail"></div>
  </section>
</main>
<script type="application/json" id="data">${json}</script>
<script>
const D = JSON.parse(document.getElementById('data').textContent)
const byCase = new Map(D.cases.map(c => [c.case, []]))
for (const c of D.clips) byCase.get(c.case).push(c)
for (const list of byCase.values()) list.sort((a, b) => (a.name + a.file).localeCompare(b.name + b.file))
const families = []
for (const c of D.cases) { let f = families.find(x => x.name === c.family); if (!f) families.push(f = { name: c.family, cases: [] }); f.cases.push(c) }

const m = v => v == null ? '?' : (Math.round(v * 1000) / 1000).toFixed(2) + ' m'
const cm = v => Math.round(v * 100) + ' cm'
const deg = v => Math.round(v) + '°'
const PART = { ballL: 'left foot', ballR: 'right foot', kneeL: 'left knee', kneeR: 'right knee', handL: 'left hand', handR: 'right hand', head: 'head' }
const median = vs => { const s = [...vs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// One line of what the reader measured, in words and metres.
function reading(c) {
  const t = c.things, out = []
  if (t.lip != null) out.push('grips a lip at ' + m(t.lip) + (typeof t.span === 'number' ? ', hands ' + m(t.span) + ' apart' : ''))
  if (t.face) out.push('wall facing ' + deg(t.face.normal) + (t.face.along ? ', run along' : '') + ', feet on it at ' + t.face.heights.map(m).join(', ') + (t.face.under != null ? ', ' + cm(t.face.under) + ' past the hands' : ''))
  if (t.swing) out.push(t.swing.pivot ? 'swings on a ' + m(t.swing.radius) + ' line hung ' + m(t.swing.pivot[1]) + ' up' : 'runs along a straight line')
  if (t.over) out.push('hands over a top at ' + m(t.over.top))
  if (t.spacing != null) out.push('rungs ' + m(t.spacing) + ' apart' + (t.lap ? ', ' + m(t.lap) + ' a lap' : ''))
  if (t.seat) out.push('sits at ' + m(t.seat[0].y) + ', back reaches ' + m(t.seat[0].rear) + ' behind the seat')
  if (t.palms) out.push('palms rest at ' + m(median(t.palms.map(p => p.y))))
  if (t.bed != null) out.push('lies on a bed ' + m(t.bed) + ' high')
  else if (t.lies) out.push('lies on the floor')
  if (t.knees) out.push('kneels, ' + t.knees.length + ' knee hold' + (t.knees.length > 1 ? 's' : ''))
  if (t.back && !t.seat) out.push('back on a wall ' + m(t.back[0].y) + ' up')
  if (t.points) out.push('hands hold ' + t.points.length + ' spot' + (t.points.length > 1 ? 's' : '') + ', first ' + m(t.points[0].at[1]) + ' up')
  if (t.span && typeof t.span === 'object') out.push('carries ' + m(t.span.apart) + ' between the hands, ' + m(t.span.y) + ' up, ' + m(t.span.ahead) + ' ahead')
  if (t.strikes) { const s = t.strikes[0]; out.push(PART[s.part] + ' fastest, ' + s.speed.toFixed(1) + ' m/s at ' + s.t.toFixed(2) + ' s, ' + m(s.at[1]) + ' up') }
  if (t.water) out.push((t.water.under ? 'under water, surface ' : 'surface ') + m(t.water.surface))
  if (t.top != null) out.push('ends on a top at ' + m(t.top) + (t.climb != null ? ' (' + (t.climb >= 0 ? '+' : '') + cm(t.climb) + ' over the lip)' : ''))
  else if (t.rise) out.push('ends ' + m(Math.abs(t.rise)) + (t.rise > 0 ? ' up' : ' down'))
  if (!out.length) out.push(c.floors.length ? 'stands on ' + [...new Set(c.floors.map(y => m(y)))].slice(0, 3).join(', ') : 'touches no floor')
  return out.join(' · ')
}

const state = { case: 'ledge-braced', shown: 200, q: '' }
try { const saved = localStorage.getItem('touch-case'); if (saved && byCase.has(saved)) state.case = saved } catch {}
if (location.hash && byCase.has(location.hash.slice(1))) state.case = location.hash.slice(1)

const nav = document.getElementById('nav'), pick = document.getElementById('pick')
nav.innerHTML = families.map(f => '<div><h2>' + esc(f.name) + '</h2><ul>' + f.cases.map(c => '<li><button data-case="' + c.case + '"><span>' + esc(c.case) + '</span><span>' + byCase.get(c.case).length + '</span></button></li>').join('') + '</ul></div>').join('')
pick.innerHTML = families.map(f => '<optgroup label="' + esc(f.name) + '">' + f.cases.map(c => '<option value="' + c.case + '">' + esc(c.case) + ' (' + byCase.get(c.case).length + ')</option>').join('') + '</optgroup>').join('')
nav.addEventListener('click', e => { const b = e.target.closest('button[data-case]'); if (b) choose(b.dataset.case) })
pick.addEventListener('change', () => choose(pick.value))
document.getElementById('q').addEventListener('input', e => { state.q = e.target.value.trim().toLowerCase(); state.shown = 200; draw() })
document.getElementById('count').textContent = D.clips.length + ' clips · ' + D.cases.length + ' cases · ' + Object.keys(D.things).length + ' things' + (D.failed.length ? ' · ' + D.failed.length + ' unread' : '')

function choose(k) {
  state.case = k; state.shown = 200
  try { localStorage.setItem('touch-case', k) } catch {}
  document.getElementById('q').value = ''; state.q = ''
  draw(); window.scrollTo({ top: 0 })
}

function row(c, showCase) {
  const base = c.file.split('/').slice(1, -1).join('/')
  return '<div class="clip"><button aria-expanded="false" data-file="' + esc(c.file) + '">' +
    '<span class="name">' + esc(c.name) + (c.description ? ' <small>' + esc(c.description) + '</small>' : '') + '</span>' +
    '<span class="meta">' + c.dur.toFixed(2) + ' s' + (c.loop ? ' · loop' : '') + ' · ' + esc(base) + '</span>' +
    '<span class="read">' + (showCase ? '<span class="chip case">' + esc(c.case) + '</span>' : '') + (c.doubts.length ? '<span class="chip doubt">doubt</span>' : '') + esc(reading(c)) + '</span>' +
    '</button><div class="detail" hidden></div></div>'
}

function detail(c) {
  const t = { travel: c.travel, floors: c.floors, lift: c.lift, ...c.things }
  return '<div class="file">' + esc(c.file) + ' · ' + c.frames + ' frames at 30 fps</div>' +
    (c.doubts.length ? '<ul class="doubts">' + c.doubts.map(d => '<li>' + esc(d) + '</li>').join('') + '</ul>' : '') +
    '<pre>' + esc(JSON.stringify(t, null, 1)) + '</pre>' +
    (c.gif ? '<a href="' + esc(c.gif) + '" target="_blank" rel="noopener">Mixamo’s preview of it ↗</a>' : '')
}

document.getElementById('list').addEventListener('click', e => {
  const b = e.target.closest('.clip > button'); if (!b) return
  const d = b.nextElementSibling, open = b.getAttribute('aria-expanded') === 'true'
  if (!open && !d.innerHTML) d.innerHTML = detail(D.clips.find(c => c.file === b.dataset.file))
  b.setAttribute('aria-expanded', String(!open)); d.hidden = open
})

function draw() {
  for (const b of nav.querySelectorAll('button')) b.setAttribute('aria-current', String(!state.q && b.dataset.case === state.case))
  pick.value = state.case
  const head = document.getElementById('head'), list = document.getElementById('list'), tail = document.getElementById('tail')
  let clips
  if (state.q) {
    clips = D.clips.filter(c => (c.name + ' ' + (c.description ?? '') + ' ' + c.file + ' ' + c.case).toLowerCase().includes(state.q))
    head.innerHTML = '<div class="case-head"><h2>' + clips.length + ' clip' + (clips.length === 1 ? '' : 's') + ' match “' + esc(state.q) + '”</h2></div>'
  } else {
    const k = D.cases.find(c => c.case === state.case)
    clips = byCase.get(k.case)
    head.innerHTML = '<div class="case-head"><span class="family">' + esc(k.family) + '</span><h2>' + esc(k.case) + '</h2><p>' + esc(k.about) + '</p>' +
      '<div class="needs">' + k.things.map(n => { const t = D.things[n]; return '<div class="thing"><b>' + esc(n) + '</b><span class="shape">' + esc(t.shape) + '</span><p>' + esc(t.about) + '</p><dl>' + Object.entries(t.sizes).map(([s, v]) => '<dt>' + esc(s) + '</dt><dd>' + esc(v) + '</dd>').join('') + '</dl></div>' }).join('') + '</div>' +
      '<p class="note">' + clips.length + ' clips. ' + (k.by === 'grip' ? 'Placed by the hands: the clip hangs from what they hold and is never lifted onto a floor. ' : '') + 'Every height is metres over the floor the clip was made on, lifted to stand its feet on it; a heading is degrees from the way the body faces at the start, left positive. Select a clip for everything read of it.</p></div>'
  }
  list.innerHTML = clips.length ? clips.slice(0, state.shown).map(c => row(c, !!state.q)).join('') : '<p class="empty">No clip matches. Try a word from a clip’s name, like “ledge”, “chair” or “soccer”.</p>'
  tail.innerHTML = clips.length > state.shown ? '<button class="more" id="more">Show ' + Math.min(200, clips.length - state.shown) + ' more of ' + (clips.length - state.shown) + '</button>' : ''
  const more = document.getElementById('more'); if (more) more.onclick = () => { state.shown += 200; draw() }
}
draw()
</script>
`
writeFileSync(out, page)
console.log(`wrote ${out}: ${clips.length} clips, ${(page.length / 1e6).toFixed(1)} MB`)
