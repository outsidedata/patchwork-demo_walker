// climber: demo_walker's own plugin, a walker body (`plugins/walker`) that climbs ladders, played
// with anim's clips (`plugins/anim`): how a game makes a walker behaviour of its own. It has no row and
// no page half. A rule calls `climb` first each step, and walks only while it hands back false; after
// it walks, it calls `grab`, which starts a climb when the body asks for one.
//
// A ladder is a `ladder` row: `pos` [x, y, z] the foot of the wall it stands against, on the ground,
// and `yaw` the way out from that wall. Its top is the top of the highest of shapes3d's shapes `behind`
// metres in from the wall face, or the land there where none stands (gait's `topOf`), and a body that
// climbs off onto it or down off the ladder stands on gait's `underfoot` there. Its definition
// (`assets/demo_walker.json`) holds its numbers:
//   clips     `{ mount, climb, top }`, the rig's clips: stepping onto the ladder from the ground, the
//             climbing loop, and climbing off the top onto the ground there.
//   touches   the loader `json` entry of what the clips touch, measured on the body they play on
//             (`assets/xbot.touches.json`, its `body` that body's anim kind, written by the game's bake):
//             each ladder clip's rung plane (`things.ladder`), the rung tops its balls stand on, a loop's
//             `lap`, and the `floor` the top clip ends on. The ladder is built to them, so no clip is
//             moved off where it stands its feet.
//   standoff  metres from the wall face to the rungs' middles: far enough that where the mount starts a
//             body, beside the ladder, it stands its walker radius or more out from the wall, or the
//             climb throws, naming the standoff that fits.
//   behind    metres in from the wall face the top is read at.
//   reach     metres: how near the place a climb starts from a body must be to start it.
//   settle    seconds over which a body that started a climb off that place is eased onto it.
//   leap      [out, up] m/s: the jump key on the ladder lets go, flinging the body out from the
//             wall and up at those speeds.
//   fit       metres: how far the top may stand from where the top clip, its feet on the rungs, sets
//             them down on it; a ladder whose top misses by more throws, naming the tops that fit.
//   look      the ladder's look (`ladder.client.ts`).
// A ladder's rungs (`rungsOf`) are spaced as the climbing loop climbs them, its lap's climb over the
// rung tops one lap holds, their tops at the heights its balls stand on, a rung's middle `look.thick`
// under its top; the lowest is the lowest such top over the foot. Its rails stand `look.width` apart:
// a ladder throws whose rails stand closer than the furthest the clips stand a foot to either side, or
// further than `fit` from where the clips grip the rails, out past the feet.
//
// Anim draws a clip placed rigidly in the world: every point of it stands at where its root started plus
// the clip's own place of the point, turned by the way the root faced then, its travel and its turn
// included. So each clip is placed (`Place`) by one start and one facing, read off where its rung plane
// stands in the clip (`touches`): turned so the plane's normal toward the body points out from the
// wall, and set so the point of the plane between its balls stands on the ladder's rung plane, midway
// between the rails. Its height: the mount's on the ground, where it starts; the climb's whole laps up
// from the foot, its rung tops being the ladder's; the top clip's with the floor it ends on on the top.
//
// The climber's row carries walker's fields and anim's, the stick [x, z] its keys hold (forward +z),
// `jump`, and its own: `ladder` (the ladder row's id, 0 off one), `phase`, `clock` (seconds into the
// phase's clip), `rungs` (metres climbed, below) and `slip` [x, z, yaw] (where the body stood off the
// phase's start, eased away).
//
// Every clip is scrubbed, never run: each phase plays its clip with anim's `play` at rate 0, holding
// the body, and writes `clipT` itself each step, so the climb goes up and down the same clips and stops
// wherever the stick stops. The root stands where the clip's place and its measured travel (anim's
// `at`) put it, and faces its place's facing turned by the clip's measured turn where anim takes that
// turn off the hips (`carries`):
//   mount    from the ground: the clip runs forward from its place; at its end the body hangs on the
//            rungs as the climbing loop starts it.
//   climb    `rungs` grows with the stick's forward at the loop's own speed, a lap's climb over its
//            length, and shrinks with the stick's back. A whole lap lifts the root by that climb and the
//            rest of it is the clip's playhead. Below 0 it goes on as `leave`; at the rungs where the
//            loop's pose stands nearest the top clip's first frame (`handoff`), it goes on as `top`. The
//            jump key lets go: the body is flung by `leap` and falls as walker has it.
//   top      the clip runs forward from its place; at its end the body stands on the ground there.
//   leave    `mount` run back to its start: the body steps off onto the ground and walks.
//   descend  `top` run back from its end, from a body on the top at the ladder that pushes out over the
//            edge; at its start the climb goes on at the hand-off's rungs.
//
// `grab(me, w)` starts a climb for a body on the ground, not held by a clip, pushing toward a
// ladder's wall within `reach` of where `mount` starts, or on its top pushing out over the edge within
// `reach` of where `top` ends, and hands back whether it did. `climb(me, w, dt)` is one step of a climb,
// and false for a body on no ladder. `starts(me, w, ladder)` is where a climb of that ladder row starts
// for the body: `up` the root's place [x, y, z] and facing `[x, y, z, yaw]` where `mount` starts it,
// `down` where `top` ends it. `ladderOf(w, row)` is a ladder as the climber reads it (its foot, its way
// out, its top, its rungs and each clip's `Place`), `rigging(w, me, ladder)` the clips the body
// climbs it by and the rungs it hands over to the top at, and `placed(place, clip, a, t)` where a clip
// placed at `place` has the root at t: what the workshop poses a climb by (`demo_walker.workshop.ts`).
import type { Row, W } from '#engine/engine.ts'
import { animKind, at, carries, clipOf, ends, numbersOf, play, rigOf, stop, type Clip } from '#plugins/anim/anim.sim.ts'
import { def, json } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { numbers, stand } from '#plugins/walker/walker.sim.ts'
import { topOf, underfoot } from '../gait/gait.sim.ts'

const DEG = Math.PI / 180
const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
// The clips' playheads stop this far short of a clip's end, since anim lets an act go at its end.
const SHORT = 1e-6
// Two rung tops of one lap nearer than this, metres, are one rung.
const SAME = 0.05
// The segments whose ends the hand-off compares.
const SEGMENTS = ['torso', 'handL', 'handR', 'forearmL', 'forearmR', 'legL', 'legR', 'footL', 'footR']

type Numbers = {
  clips: { mount: string; climb: string; top: string }
  touches: string
  standoff: number; behind: number; reach: number; settle: number; leap: number[]; fit: number
  look: { width: number; rail: number; thick: number }
}
// What a ladder clip touches, as `xbot.touches.mjs` writes it: its rung plane, a loop's lap, the floor it
// ends on.
type Rungs = { normal: number; at: number[]; tops: number[]; across: number; rails: number | null }
type Touch = { dur: number; lap: number[] | null; floor: number | null; things: { ladder?: Rungs } }
type Touches = { body: string; clips: Record<string, Touch> }
type Climbed = Touch & { ladder: Rungs }
// A clip placed: where its root starts, the way it faces then, and the height it stands at.
export type Place = { x: number; z: number; y: number; yaw: number }

// A point `f` metres along yaw θ's facing and `l` to its left, from (x, z).
const along = (x: number, z: number, yaw: number, f: number, l: number) =>
  [x + f * math.sin(yaw) + l * math.cos(yaw), z + f * math.cos(yaw) - l * math.sin(yaw)]

// The middle of a set of heights round a spacing: where they stand within a rung, from 0 to `s`.
function phaseOf(tops: number[], s: number): number {
  const a = math.atan2(tops.reduce((v, t) => v + math.sin((2 * Math.PI * t) / s), 0), tops.reduce((v, t) => v + math.cos((2 * Math.PI * t) / s), 0))
  return (((a / (2 * Math.PI)) * s) % s + s) % s
}

// A ladder clip's touches, its rung plane brought up as `ladder`, thrown for when it has none.
function touchOf(c: Touches, clip: string, row: Row): Climbed {
  const got = c.clips[clip]
  if (!got) throw new Error(`climber: ladder ${row.id}'s touches have no clip ${clip}`)
  if (!got.things?.ladder) throw new Error(`climber: ladder ${row.id}'s clip ${clip} stands on no rungs in its touches`)
  return { ...got, ladder: got.things.ladder }
}

// A ladder's rungs: their spacing, the height of the lowest top over the foot, and the loop's lap.
export function rungsOf(from: Parameters<typeof def>[0], row: Row) {
  const k = def(from, row.kind) as Numbers
  const c = json(from, k.touches) as Touches
  const loop = touchOf(c, k.clips.climb, row)
  if (!loop.lap) throw new Error(`climber: ladder ${row.id}'s climbing clip ${k.clips.climb} is no loop`)
  const lap = loop.lap[1]
  // The rung tops one lap holds: the loop's tops, each taken to its lap's first.
  const within = loop.ladder.tops.map(t => ((t % lap) + lap) % lap).sort((a, b) => a - b)
  const distinct = within.filter((t, i) => i === 0 || t - within[i - 1] > SAME)
  if (distinct.length > 1 && distinct[distinct.length - 1] - distinct[0] > lap - SAME) distinct.pop()
  const spacing = lap / distinct.length
  const phase = phaseOf(loop.ladder.tops, spacing)
  const ladders = Object.values(k.clips).map(name => touchOf(c, name, row).ladder)
  const across = Math.max(...ladders.map(l => l.across))
  if (k.look.width / 2 - k.look.rail / 2 < across) {
    throw new Error(`climber: ladder ${row.id}'s rails stand ${k.look.width} m apart, and its clips stand a foot ${across} m to either side of its middle: they must stand more than ${2 * across + k.look.rail} m apart`)
  }
  // The rails stand where the clips grip furthest out to the side.
  const rails = Math.max(0, ...ladders.map(l => l.rails ?? 0))
  if (rails && Math.abs(k.look.width / 2 - rails) > k.fit) {
    throw new Error(`climber: ladder ${row.id}'s rails stand ${k.look.width} m apart, and its clips grip them ${rails} m to either side of its middle: they must stand ${(2 * rails).toFixed(3)} m apart`)
  }
  return { k, c, spacing, phase, lap, first: phase }
}

// A ladder as a climber reads it: its foot, the way out from its wall, its rungs, the top, and each of
// its clips placed.
export type Ladder = ReturnType<typeof ladderOf>

export function ladderOf(w: W, row: Row) {
  const r = rungsOf(w, row)
  const { k, c } = r
  const [x, y, z] = row.data.pos
  const yaw = row.data.yaw
  const out = [math.sin(yaw), math.cos(yaw)]
  const top = topOf(w, x - out[0] * k.behind, z - out[1] * k.behind)
  // The rung plane midway between the rails, and a clip turned and set onto it.
  const plane = [x + out[0] * k.standoff, z + out[1] * k.standoff]
  const place = (clip: string, height: number): Place => {
    const l = touchOf(c, clip, row).ladder
    const turn = wrap(yaw - l.normal * DEG)
    const [ox, oz] = along(0, 0, turn, l.at[1], l.at[0])
    return { x: plane[0] - ox, z: plane[1] - oz, y: height, yaw: turn }
  }
  // The top clip ends on the floor it measured, set on the top; its rungs must then be the ladder's.
  const tops = touchOf(c, k.clips.top, row)
  if (tops.floor === null) throw new Error(`climber: ladder ${row.id}'s top clip ${k.clips.top} ends on no raised floor in its touches`)
  const upY = top - tops.floor
  const miss = ((((upY + phaseOf(tops.ladder.tops, r.spacing)) - (y + r.phase)) % r.spacing) + r.spacing) % r.spacing
  const off = Math.min(miss, r.spacing - miss)
  if (off > k.fit) {
    const base = y + r.phase - phaseOf(tops.ladder.tops, r.spacing) + tops.floor
    const below = base + Math.floor((top - base) / r.spacing) * r.spacing
    throw new Error(`climber: ladder ${row.id}'s top stands ${(top - y).toFixed(3)} m over its foot, ${off.toFixed(3)} m from where its top clip sets its feet down from the rungs; a top ${(below - y).toFixed(3)} or ${(below + r.spacing - y).toFixed(3)} m over the foot fits`)
  }
  return {
    row, k, rungs: r, foot: [x, y, z], out, yaw, top,
    mount: place(k.clips.mount, y),
    climb: place(k.clips.climb, y),
    up: place(k.clips.top, upY),
  }
}

// What the climber's rig says of the climb: each clip resolved, and where the climb hands over to the top.
export function rigging(w: W, me: Row, l: Ladder) {
  const { k } = l
  const kind = animKind(me)
  if (l.rungs.c.body !== kind) throw new Error(`climber: ladder ${l.row.id} is built to the clips of ${l.rungs.c.body}, and a ${kind} climbs it`)
  const rig = rigOf(w, kind)
  const a = numbersOf(w)
  const clip = (name: string) => {
    if (!rig.table[name]) throw new Error(`climber: the rig of ${kind} has no clip ${name}`)
    return clipOf(rig, name)
  }
  const mount = clip(k.clips.mount), loop = clip(k.clips.climb), top = clip(k.clips.top)
  // The mount starts the body beside the ladder, where it must stand clear of the wall.
  const s = placed(l.mount, mount, a, 0)
  const clear = (s.x - l.foot[0]) * l.out[0] + (s.z - l.foot[2]) * l.out[1]
  const radius = numbers(me, w).radius
  if (clear < radius) {
    throw new Error(`climber: ladder ${l.row.id}'s mount starts a ${kind} ${clear.toFixed(3)} m out from the wall, inside its ${radius} m radius: stand its rungs at least ${(k.standoff + radius - clear).toFixed(3)} m out from the wall`)
  }
  // The hand-off: the loop's frame, a whole number of laps up, whose segments stand nearest the top
  // clip's on its first frame, each placed by its own clip's place.
  const world = (p: Place, q: number[]) => {
    const [px, pz] = along(p.x, p.z, p.yaw, q[2], q[0])
    return [px, p.y + q[1], pz]
  }
  const want = SEGMENTS.flatMap(s => { const e = ends(w, me, s, { clip: top.name, clipT: 0 }); return [world(l.up, e.slice(0, 3)), world(l.up, e.slice(3))] })
  const frames = Math.max(1, Math.round(loop.measure.frames ?? loop.dur * 30))
  const hipsUp = want[0][1]
  let best = { rungs: 0, err: Infinity }
  for (let f = 0; f < frames; f++) {
    const t = (f / frames) * loop.dur
    const got = SEGMENTS.flatMap(s => { const e = ends(w, me, s, { clip: loop.name, clipT: t }); return [e.slice(0, 3), e.slice(3)] })
    const laps = Math.round((hipsUp - (l.climb.y + got[0][1])) / l.rungs.lap)
    const p = { ...l.climb, y: l.climb.y + laps * l.rungs.lap }
    let err = 0
    for (let i = 0; i < got.length; i++) {
      const g = world(p, got[i])
      err += Math.hypot(g[0] - want[i][0], g[1] - want[i][1], g[2] - want[i][2])
    }
    if (err < best.err) best = { rungs: laps * l.rungs.lap + (f / frames) * l.rungs.lap, err }
  }
  if (best.rungs <= 0) throw new Error(`climber: ladder ${l.row.id}'s top is under where its climb starts`)
  return { mount, loop, top, a, handoff: best.rungs }
}

// Where a clip placed at `p` has the root at t, and the way it faces.
export function placed(p: Place, c: Clip, a: ReturnType<typeof numbersOf>, t: number) {
  const how = carries(c, a)
  const [f, lf, turn] = how.carries ? at(c.measure, t) : [0, 0, 0]
  const [x, z] = along(p.x, p.z, p.yaw, f * c.scale, lf * c.scale)
  return { x, z, yaw: wrap(p.yaw + (how.turns ? turn * DEG : 0)) }
}

// The playhead held short of the clip's end.
const scrub = (me: Row, c: Clip, t: number) => { me.data.clipT = Math.max(0, Math.min(c.dur - SHORT, t)) }

// A clip begun at full weight, where the last clip's pose meets its own.
function cut(me: Row, clip: string) {
  play(me, clip, { holds: true, rate: 0 })
  me.data.blend = 1
  me.data.from = null
}

// The body still, on the ground its feet stand on at `feet`, on no ladder.
function off(me: Row, w: W, feet: number) {
  const d = me.data
  d.ladder = 0
  d.phase = ''
  d.slip = [0, 0, 0]
  d.vel = [0, 0, 0]
  d.want = [0, 0]
  d.pos = [d.pos[0], stand(numbers(me, w), underfoot(me, w, feet), d.pos[0], d.pos[2]), d.pos[2]]
  d.grounded = true
  d.sliding = false
  stop(me, w)
}

// The share of the slip left `elapsed` seconds into a phase.
const left = (k: Numbers, elapsed: number) => Math.max(0, 1 - elapsed / k.settle)

export function starts(me: Row, w: W, ladder: Row) {
  const l = ladderOf(w, ladder)
  const r = rigging(w, me, l)
  const s = placed(l.mount, r.mount, r.a, 0), e = placed(l.up, r.top, r.a, r.top.dur)
  return { up: [s.x, l.mount.y, s.z, s.yaw], down: [e.x, l.top, e.z, e.yaw] }
}

export function grab(me: Row, w: W): boolean {
  const d = me.data
  if (d.ladder || !d.grounded || d.state === 'act') return false
  const speed = math.hypot(d.want[0], d.want[1])
  if (!(speed > 0)) return false
  const [x, y, z] = d.pos
  for (const row of w.all('ladder')) {
    const l = ladderOf(w, row)
    const r = rigging(w, me, l)
    // From the ground: pushing toward the wall, near where the mount starts.
    const s = placed(l.mount, r.mount, r.a, 0)
    if (Math.abs(y - l.foot[1]) <= numbers(me, w).step && math.hypot(x - s.x, z - s.z) <= l.k.reach && -(d.want[0] * l.out[0] + d.want[1] * l.out[1]) > speed / 2) {
      d.ladder = row.id
      d.phase = 'mount'
      d.clock = 0
      d.slip = [x - s.x, z - s.z, wrap(d.yaw - s.yaw)]
      play(me, l.k.clips.mount, { holds: true, rate: 0 })
      return true
    }
    // From the top: pushing out over the edge, near where the top clip ends.
    const e = placed(l.up, r.top, r.a, r.top.dur)
    if (Math.abs(y - l.top) <= numbers(me, w).step && math.hypot(x - e.x, z - e.z) <= l.k.reach && d.want[0] * l.out[0] + d.want[1] * l.out[1] > speed / 2) {
      d.ladder = row.id
      d.phase = 'descend'
      d.clock = r.top.dur
      d.slip = [x - e.x, z - e.z, wrap(d.yaw - e.yaw)]
      play(me, l.k.clips.top, { holds: true, rate: 0 })
      scrub(me, r.top, r.top.dur)
      return true
    }
  }
  return false
}

export function climb(me: Row, w: W, dt: number): boolean {
  const d = me.data
  if (!d.ladder) return false
  const l = ladderOf(w, w.get(d.ladder))
  const { k } = l
  const r = rigging(w, me, l)
  d.vel = [0, 0, 0]
  d.want = [0, 0]
  d.grounded = true
  d.sliding = false
  const jump = d.jump
  d.jump = false

  switch (d.phase) {
    case 'mount':
    case 'leave': {
      d.clock = d.phase === 'mount' ? d.clock + dt : d.clock - dt
      const t = Math.max(0, Math.min(r.mount.dur, d.clock))
      const p = placed(l.mount, r.mount, r.a, t)
      const ease = d.phase === 'mount' ? left(k, d.clock) : 0
      d.pos = [p.x + d.slip[0] * ease, l.mount.y, p.z + d.slip[1] * ease]
      d.yaw = wrap(p.yaw + d.slip[2] * ease)
      scrub(me, r.mount, t)
      if (d.phase === 'mount' && d.clock >= r.mount.dur) {
        d.phase = 'climb'
        d.rungs = 0
        d.slip = [0, 0, 0]
        cut(me, k.clips.climb)
        return climbing(me, l, r, 0)
      }
      if (d.phase === 'leave' && d.clock <= 0) off(me, w, l.foot[1])
      return true
    }
    case 'climb': {
      if (jump) {
        d.ladder = 0
        d.phase = ''
        d.vel = [l.out[0] * k.leap[0], k.leap[1], l.out[1] * k.leap[0]]
        d.grounded = false
        stop(me, w)
        return true
      }
      d.rungs = Math.min(r.handoff, d.rungs + d.stick[1] * (l.rungs.lap / r.loop.dur) * dt)
      if (d.rungs < 0) {
        d.phase = 'leave'
        d.clock = r.mount.dur
        cut(me, k.clips.mount)
        return climb(me, w, 0)
      }
      climbing(me, l, r, d.rungs)
      if (d.rungs >= r.handoff) {
        d.phase = 'top'
        d.clock = 0
        cut(me, k.clips.top)
        return climb(me, w, 0)
      }
      return true
    }
    case 'top':
    case 'descend': {
      d.clock = d.phase === 'top' ? d.clock + dt : d.clock - dt
      const t = Math.max(0, Math.min(r.top.dur, d.clock))
      const p = placed(l.up, r.top, r.a, t)
      const ease = d.phase === 'descend' ? left(k, r.top.dur - d.clock) : 0
      d.pos = [p.x + d.slip[0] * ease, l.up.y, p.z + d.slip[1] * ease]
      d.yaw = wrap(p.yaw + d.slip[2] * ease)
      scrub(me, r.top, t)
      if (d.phase === 'top' && d.clock >= r.top.dur) off(me, w, l.top)
      if (d.phase === 'descend' && d.clock <= 0) {
        d.phase = 'climb'
        d.rungs = r.handoff
        d.slip = [0, 0, 0]
        cut(me, k.clips.climb)
        climbing(me, l, r, r.handoff)
      }
      return true
    }
  }
  throw new Error(`climber:the body is on ladder ${d.ladder} in no phase it knows, ${d.phase}`)
}

// The body on the climbing loop `rungs` metres up: its whole laps in its height, the rest its playhead.
function climbing(me: Row, l: Ladder, r: ReturnType<typeof rigging>, rungs: number): true {
  const d = me.data
  const laps = Math.floor(rungs / l.rungs.lap)
  const p = placed(l.climb, r.loop, r.a, 0)
  d.pos = [p.x, l.climb.y + laps * l.rungs.lap, p.z]
  d.yaw = p.yaw
  scrub(me, r.loop, (rungs / l.rungs.lap - laps) * r.loop.dur)
  return true
}
