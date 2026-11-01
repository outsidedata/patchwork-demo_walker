// What every clip of the X Bot's rig touches, read by anim's touch reader (`plugins/anim/anim.touches.mjs`)
// off the skin anim's `anim.touches.py` measured on each clip as its FBX has it (the game's bake runs it with `--rear` on the
// rig's clips, `demo_walker.bake.ts`), and written to `xbot.touches.json` beside it; each clip's lift and
// turn are written to its sidecar beside its FBX, which anim's export (`plugins/anim/anim.export.py`) lays
// onto the clip as it bakes it:
//   node games/demo_walker/assets/xbot.touches.mjs <skin dir>
//
// Every place is as the reader has it (its header): the clip's own space, lifted by its `lift` and turned
// by its `turned`, which is the clip as the export bakes it. So a game stands a clip on a thing by the
// place and the facing where the clip starts alone: anim draws a clip placed rigidly in the world.
//
// Each clip is read as the rig has it: a loop where its entry says `loop`, and turned where it is one of
// the game's cover clips, since anim and the game's moves take a clip's +z as the way its body faces, and
// the Action Adventure pack made them facing up to 176° off their own forward (`xbot.contacts.mjs`'s
// rule, before this): the clips of `demo_walker.json`'s `player.moves.cover` (`in`, `out`, `lowIn`,
// `lowOut`) so the body faces +z on their first frame, the idles of the two stances its `stand` and
// `crouch` name so the body faces +z over a lap, and their gears so each travels the way its `gear` says.
// The facing is the line between the hip joints'. A mirrored clip (`mirror` in the rig) is anim's own,
// its source's across x: its entry is `{ mirror }`.
//
// `xbot.touches.json` is `{ body, clips: { <rig clip>: <the reader's reading, with its `file`> } }`. Each
// clip's sidecar gets the reading's `lift` as its `offset.position` (`[t, 0, metres, 0]` rows) and its
// turn as its `offset.rotation` (one row); a clip with neither has them taken out of its sidecar, and a
// sidecar left with nothing in it is removed. A line a clip is printed, with its doubts.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { read } from '../../../plugins/anim/anim.touches.mjs'

const here = import.meta.dirname
const skins = process.argv[2]
if (!skins) throw new Error('xbot.touches.mjs: name the folder anim.touches.py wrote the rig\'s skin to')
const CLIPS = path.join(homedir(), 'troupe-collection')
const BODY = 'xbot'
const rig = JSON.parse(readFileSync(path.join(here, 'xbot.rig.json'), 'utf8'))
const cover = JSON.parse(readFileSync(path.join(here, 'demo_walker.json'), 'utf8')).player.moves.cover

const DEG = Math.PI / 180
const round = (v, places = 1) => Math.round(v * 10 ** places) / 10 ** places
const wrapDeg = a => a - 360 * Math.ceil((a - 180) / 360)
const meanDeg = as => Math.atan2(as.reduce((s, a) => s + Math.sin(a * DEG), 0), as.reduce((s, a) => s + Math.cos(a * DEG), 0)) / DEG
// The way a line from a body's right hip joint to its left faces, degrees from +z, positive left.
const square = (l, r) => Math.atan2(-(l[2] - r[2]), l[0] - r[0]) / DEG
const entryOf = name => (typeof rig.clips[name] === 'string' ? { file: rig.clips[name] } : rig.clips[name])
const joint = (s, f, k) => s.joints[f].slice(k * 3, k * 3 + 3)
const facingAt = (s, f) => square(joint(s, f, 1), joint(s, f, 2))

// The turn a cover clip is given, as its FBX has it (the header).
const stances = [cover.stand, cover.crouch]
function turnOf(name, s) {
  const e = entryOf(name)
  const n = s.frames - 1
  if ([cover.in, cover.out, cover.lowIn, cover.lowOut].includes(name)) return round(-facingAt(s, 0))
  if (stances.some(st => rig.stances?.[st]?.idle === name)) return round(-meanDeg(Array.from({ length: Math.max(1, n) }, (_, f) => facingAt(s, f))))
  if (e.loop && e.gear !== undefined && stances.includes(e.stance)) {
    const a = joint(s, 0, 0), b = joint(s, n, 0)
    return round(wrapDeg(e.gear - Math.atan2(b[0] - a[0], b[2] - a[2]) / DEG))
  }
  return 0
}

const sidecarPath = file => path.join(CLIPS, file.replace(/\.fbx$/i, '.json'))
const sidecarOf = file => (existsSync(sidecarPath(file)) ? JSON.parse(readFileSync(sidecarPath(file), 'utf8')) : {})

const out = {}
for (const name of Object.keys(rig.clips)) {
  const e = entryOf(name)
  if (e.mirror) { out[name] = { mirror: e.mirror }; continue }
  const skinFile = path.join(skins, e.file + '.json')
  if (!existsSync(skinFile)) throw new Error(`xbot.touches.mjs: no skin of ${name} (${e.file}) in ${skins}`)
  const s = JSON.parse(readFileSync(skinFile, 'utf8'))
  if (s.error) throw new Error(`xbot.touches.mjs: ${name} (${e.file}) could not be measured: ${s.error}`)
  const turn = turnOf(name, s)
  out[name] = { file: e.file, ...read(e.file, s, { turn, loop: !!e.loop }) }
}
writeFileSync(path.join(here, 'xbot.touches.json'), JSON.stringify({ body: BODY, clips: out }) + '\n')

// Each clip's lift and turn into its sidecar.
for (const [name, c] of Object.entries(out)) {
  if (c.mirror) continue
  const file = sidecarPath(c.file)
  const side = sidecarOf(c.file)
  side.offset = { ...side.offset }
  if (c.lift) side.offset.position = c.lift.map(([t, y]) => [t, 0, y, 0])
  else delete side.offset.position
  if (c.turned) side.offset.rotation = [[0, c.turned]]
  else delete side.offset.rotation
  if (!Object.keys(side.offset).length) delete side.offset
  if (Object.keys(side).length) writeFileSync(file, JSON.stringify(side) + '\n')
  else if (existsSync(file)) rmSync(file)
}

// A line a clip, for reading at a glance.
for (const [name, c] of Object.entries(out)) {
  if (c.mirror) { console.log(`${name.padEnd(17)} mirror of ${c.mirror}`); continue }
  const lift = c.lift ? ` lift ${Math.min(...c.lift.map(r => r[1]))}..${Math.max(...c.lift.map(r => r[1]))}` : ''
  const t = c.things
  const said = [
    c.turned ? `turned ${c.turned}°` : '',
    t.ladder ? `ladder normal ${t.ladder.normal}° at ${t.ladder.at} tops ${t.ladder.tops}` : '',
    c.floor !== null ? `ends on ${c.floor} m` : '',
    t.seat ? `sits at ${t.seat[0].y} m` : '',
    t.over ? `over a top ${t.over.top} m at ${t.over.at} way ${t.over.way}° clear ${t.over.clear}` : '',
    t.face ? `wall normal ${t.face.normal}° at ${t.face.at}` : '',
    t.behind ? `${t.behind.length} rear squares` : '',
  ].filter(Boolean).join(', ')
  console.log(`${name.padEnd(17)} [${c.case}]${lift} ${said}`)
  for (const d of c.doubts) console.log(`    ? ${d.question}`)
}
