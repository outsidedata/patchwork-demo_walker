// demo_walker's moves, as the asset workshop shows them (`tools/workshop`, its Moves): each move the
// body makes against a thing of the course, made by the game's own plugins (climber, moves, gait,
// walker, anim) on the rows of the scene `scene`, so the workshop draws the body where the game puts it.
// The workshop boots that scene, spawns one row of `body` from its prefab, draws the rows of the kinds
// `looks` names by their own looks (`ladder.client.ts`, `chair.client.ts`, `tree.client.ts`,
// `water.client.ts`; the course's boxes and ramps are shapes3d's, drawn by solids, not a look) and the
// body by anim, and
// each frame hands a step its playhead: `pose(t)` writes the body's row as the game has it `t` seconds
// into the step, and `marks()` is what the clip touches then, read off the row as posed.
//
// `moves(w, me)`, the body's row `me` on the booted scene's `w`, is every move, in this order:
//   ladder     each ladder row: `mount` from the ground, `climb` up the rungs from the first to where
//              the climb hands over to the top, at the loop's own speed (the stick held forward), and
//              `top` onto the block: posed by climber's own `climb` from the phase, its clock and its
//              rungs. Climbing down and stepping off are these clips run back.
//   chair      each chair: `sit`, begun by moves' `use` from where sitting starts; `seated`; and `rise`,
//              begun by `use` from the seated body. Each also marks `back`: the body's skin furthest
//              behind within the chair's back over the whole of its clip (the touches' `behind`), its gap
//              how far in front of the back's front face it stands, off where it is through it or more
//              than `moves.fit` in front.
//   cover, low cover   each box whose side facing where the seat starts stands `cover.tall` over the
//              ground there (cover), or `cover.low` and under `tall` (low cover), at the middle of that
//              side: the clip in and its mirror, each begun where it starts (moves' `startFor`, `begin`);
//              the stance's idle and its gears along the wall at `cover.speed`; and the clip out, begun by
//              moves' `hug` pushing out from the wall toward either end.
//   vault, wall run   each box whose side facing the seat's start the move fits (moves' `overWall`,
//              `upWall`, a vault landing on ground within the body's `step` of its feet, as `jump` asks):
//              begun where it starts against the middle of that side.
//   floor      on the ground where the seat's start stands, facing its yaw: the stance's idle, the gears
//              the rule walks at `walk` and `run`, the rig's jump, fall and landing, the tricks, and the
//              crouch's going down, idle, gear at `crouch.speed` and getting up.
// A held clip is held as climber and moves hold theirs, at rate 0, its playhead written. A gear walks at
// its speed, its playhead running at that speed over the gear's own, as anim plays it (rule 2 of
// `plugins/anim/anim.sim.ts` picks the gear); a one-shot on the floor moves by the travel it carries,
// as walker carries it on open ground.
//
// A mark is a patch of skin the clip holds on something (`assets/xbot.touches.json`'s `plants`, live
// between their `from` and `to`, all but those `still`, held on nothing or at rest on the body), and the
// seat a sitting clip sits on (its `things.seat`), each where the clip has it: its place in the clip set where the step
// started the root, turned the way the root faced then. Its `gap` is how far it stands off what it is
// on, metres, by `on`: `ground` over the floor the move stands on, `raised floor` over walker's ground
// under it (the tops of shapes3d's shapes over the land, gait's `topOf`), `ledge` over the top of the nearest side of a box, `rung`
// over the nearest top of the ladder's rungs, `wall` out from the nearest side of a box that stands
// beside it, `seat` over the nearest chair's seat; `off` where that is further than the move's plugin's
// `fit` (the ladder's `fit`, the player's `moves.fit`), or a seat outside its chair. A `hold` on a
// ladder's clip is the hand's middle off the nearest rung or rail, with no `off`: the climber asks
// nothing of where the hands close.
import type { Row, W } from '#engine/engine.ts'
import { animKind, clipOf, momentOf, numbersOf, play, rest, rigOf, type Clip, type Rig } from '#plugins/anim/anim.sim.ts'
import { def, json } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { land } from '#plugins/shapes3d/shapes3d.sim.ts'
import { numbers, stand } from '#plugins/walker/walker.sim.ts'
import { climb, ladderOf, placed, rigging, rungsOf, type Place } from './plugins/climber/climber.sim.ts'
import { topOf, underfoot } from './plugins/gait/gait.sim.ts'
import * as moving from './plugins/moves/moves.sim.ts'
import { chairs, faces, type Chair, type Face } from './plugins/moves/moves.sim.ts'

export const scene = 'main'
export const body = 'player'
export const looks = ['ladder', 'chair', 'tree', 'water']

export type Mark = { name: string; on: string; at: number[]; gap?: number; off?: boolean }
export type Step = { name: string; clip: string; dur: number; loop: boolean; pose(t: number): void; marks(): Mark[] }
export type Move = { name: string; against: string; floor: number; steps: Step[] }

const DEG = Math.PI / 180
// The playhead held this far short of a clip's end, as climber and moves hold theirs.
const SHORT = 1e-6
// Two gears this close to the way the body moves, degrees, are equally near (anim's TIE).
const TIE = 1e-9
const wrapDeg = (a: number) => a - 360 * Math.ceil((a - 180) / 360)
// A point `f` metres along yaw θ's facing and `l` to its left, from (x, z).
const along = (x: number, z: number, yaw: number, f: number, l: number) =>
  [x + f * math.sin(yaw) + l * math.cos(yaw), z + f * math.cos(yaw) - l * math.sin(yaw)]
const yawOf = (x: number, z: number) => math.atan2(x, z)
const round = (v: number) => +v.toFixed(2)
type Fit = { touches: string; fit: number }

// The body on its feet at (x, y, z) facing `yaw` in `stance`, playing nothing, on no ladder and in no
// move: a row as moves' `use` and `jump` take a free body.
function free(me: Row, pos: number[], yaw: number, stance = 'stand') {
  rest(me)
  Object.assign(me.data, {
    pos: [...pos], yaw, vel: [0, 0, 0], want: [0, 0], grounded: true, sliding: false, face: null, jump: false, stick: [0, 0],
    ladder: 0, phase: '', clock: 0, rungs: 0, slip: [0, 0, 0], move: '', crouch: stance === 'crouch', rig: stance,
  })
}

// A clip held `t` seconds in at full weight, as climber's `cut` and moves' scrub hold theirs.
function hold(me: Row, clip: string, t: number, dur: number) {
  play(me, clip, { holds: true, rate: 0 })
  me.data.blend = 1
  me.data.from = null
  me.data.clipT = Math.max(0, Math.min(dur - SHORT, t))
}

// A held move begun by moves, `t` seconds in: its slip let go, its clock written, and moves' own step of
// it taken, so the body stands where the clip has it.
function scrubbed(me: Row, w: W, k: moving.Numbers, t: number) {
  const d = me.data
  const dur = clipOf(rigOf(w, animKind(me)), d.clip).dur
  d.slip = [0, 0, 0]
  d.clock = Math.max(0, Math.min(dur - SHORT, t))
  moving.held(me, w, 0, k)
}

// Where a held move's clip started the root, as `begin` keeps it on the row.
const anchored = (me: Row): Place => ({ x: me.data.anchor[0], y: me.data.anchor[1], z: me.data.anchor[2], yaw: me.data.turn0 })

// ---------------------------------------------------------------- marks

// What a step's marks are read against: its plugin's touches and `fit`, the floor the move stands on,
// and the ladder a ladder's clip climbs.
type On = Fit & { floor: number; ladder?: Row }

// What the clip the row plays touches now, each where the clip has it from `start`, its gap off what it
// is on and whether that is further than `fit`.
function marksOf(w: W, me: Row, on: On, start: Place): Mark[] {
  const d = me.data
  const c = json(w, on.touches).clips?.[d.clip]
  if (!c) return []
  const place = (q: number[]) => {
    const [x, z] = along(start.x, start.z, start.yaw, q[2], q[0])
    return [x, start.y + q[1], z]
  }
  const out: Mark[] = []
  for (const p of (c.plants ?? []) as { point: string; from: number; to: number; at: number[]; on: string }[]) {
    if (p.on === 'still' || d.clipT < p.from || d.clipT > p.to) continue
    out.push(gapOf(w, { name: p.point, on: p.on, at: place(p.at) }, on))
  }
  const seat = (c.things?.seat as { y: number; at: number[] }[] | undefined)?.[0]
  if (seat) out.push(gapOf(w, { name: 'seat', on: 'seat', at: place([seat.at[0], seat.y, seat.at[1]]) }, on))
  return out
}

// A ladder as its look stands it (`ladder.client.ts`): its rung plane's middle, the way out from its
// wall and along its rungs, its rung tops, its rails' half spacing, and its rungs' radius and rails'
// side.
function ladderAt(w: W, row: Row) {
  const { k, spacing, first } = rungsOf(w, row)
  const [x, y, z] = row.data.pos
  const yaw = row.data.yaw
  const out = [math.sin(yaw), math.cos(yaw)], right = [math.cos(yaw), -math.sin(yaw)]
  const high = topOf(w, x - out[0] * k.behind, z - out[1] * k.behind)
  const tops: number[] = []
  for (let h = first; h <= high - y; h += spacing) tops.push(y + h)
  return { plane: [x + out[0] * k.standoff, z + out[1] * k.standoff], out, right, tops, half: k.look.width / 2, thick: k.look.thick, rail: k.look.rail }
}

const nearest = <T>(all: T[], far: (t: T) => number) => all.reduce<T | undefined>((b, t) => (b === undefined || far(t) < far(b) ? t : b), undefined)

// How far a point stands across the ground from a side, metres: to its nearest point.
function offSide(f: Face, x: number, z: number) {
  const o = moving.onFace(f, x, z)
  const u = Math.max(0, Math.min(o.len, o.u))
  return math.hypot(x - (f.a[0] + o.t[0] * u), z - (f.a[1] + o.t[1] * u))
}

function gapOf(w: W, m: Mark, on: On): Mark {
  const [x, y, z] = m.at
  let gap: number | undefined
  let outside = false
  let judged = true
  switch (m.on) {
    case 'ground':
      gap = y - on.floor
      break
    case 'raised floor':
      gap = y - topOf(w, x, z)
      break
    case 'ledge': {
      const f = nearest(faces(w), f => offSide(f, x, z))
      if (f) gap = y - f.top
      break
    }
    case 'rung': {
      if (!on.ladder) break
      const t = nearest(ladderAt(w, on.ladder).tops, t => Math.abs(y - t))
      if (t !== undefined) gap = y - t
      break
    }
    case 'hold': {
      if (!on.ladder) break
      // Off the nearest bar's skin: a rung's axis `thick` under its top across the rails, or a rail's.
      const l = ladderAt(w, on.ladder)
      const dx = x - l.plane[0], dz = z - l.plane[1]
      const out = dx * l.out[0] + dz * l.out[1], across = Math.abs(dx * l.right[0] + dz * l.right[1])
      const t = nearest(l.tops, t => Math.abs(y - (t - l.thick)))
      const rung = t === undefined || across > l.half ? Infinity : math.hypot(out, y - (t - l.thick)) - l.thick
      gap = Math.min(rung, math.hypot(out, across - l.half) - l.rail / 2)
      judged = false
      break
    }
    case 'wall': {
      const beside = faces(w).map(f => ({ f, o: moving.onFace(f, x, z) })).filter(({ f, o }) => o.u >= 0 && o.u <= o.len && y >= f.base && y <= f.top)
      const f = nearest(beside, b => Math.abs(b.o.out))
      if (f) gap = f.o.out
      break
    }
    case 'seat': {
      const s = nearest(chairs(w), s => math.hypot(x - s.x, z - s.z))
      if (!s) break
      gap = y - (s.y + s.seat.height)
      const dx = x - s.x, dz = z - s.z
      const ahead = dx * math.sin(s.yaw) + dz * math.cos(s.yaw), side = dx * math.cos(s.yaw) - dz * math.sin(s.yaw)
      outside = ahead < -s.seat.behind || ahead > s.seat.depth - s.seat.behind || Math.abs(side) > s.seat.width / 2
      break
    }
  }
  if (gap === undefined) return m
  return judged ? { ...m, gap, off: outside || Math.abs(gap) > on.fit } : { ...m, gap }
}

// ---------------------------------------------------------------- gears

// The gear anim plays for a body moving `way` degrees off its facing at `speed` m/s in `stance`: of the
// stance's gears nearest that way, the fastest whose speed times `shift` is at or under the body's, else
// the slowest (anim's rule 2).
function gearAt(w: W, rig: Rig, stance: string, way: number, speed: number): Clip {
  const gears = Object.keys(rig.clips).map(n => clipOf(rig, n)).filter(c => c.loop && c.gear !== undefined && (c.stance === undefined || c.stance === stance))
  if (!gears.length) throw new Error(`demo_walker.workshop: the rig has no gears in the stance ${stance}`)
  const off = (c: Clip) => Math.abs(wrapDeg(c.gear! - way))
  const least = Math.min(...gears.map(off))
  const near = gears.filter(c => off(c) - least <= TIE).sort((a, b) => a.speed - b.speed)
  const shift = numbersOf(w).shift
  return [...near].reverse().find(c => c.speed * shift <= speed) ?? near[0]
}

// A lap of a gear walked from `start`, `way` degrees off its facing, at `speed` m/s in `stance`: the
// body `speed` metres a second along that way, its playhead at the speed over the gear's own times the
// clip's rate, as anim runs it. `held` writes what else the row holds as it walks (cover's wall).
function gearStep(w: W, me: Row, name: string, c: Clip, start: Place, stance: string, way: number, speed: number, on: On, held: (d: any) => void = () => {}): Step {
  const rate = (c.rate * speed) / c.speed
  const go = (t: number) => along(start.x, start.z, start.yaw, speed * t * math.cos(way * DEG), speed * t * math.sin(way * DEG))
  const [vx, vz] = along(0, 0, start.yaw, speed * math.cos(way * DEG), speed * math.sin(way * DEG))
  let posed = 0
  return {
    name, clip: c.name, dur: c.dur / rate, loop: true,
    pose(t) {
      posed = t
      const [x, z] = go(t)
      free(me, [x, start.y, z], start.yaw, stance)
      held(me.data)
      hold(me, c.name, (t * rate) % c.dur, c.dur)
      me.data.vel = [vx, 0, vz]
    },
    marks() {
      // The lap the playhead is in began where the body stood that many seconds before.
      const [x, z] = go(posed - me.data.clipT / rate)
      return marksOf(w, me, on,{ x, y: start.y, z, yaw: start.yaw })
    },
  }
}

// ---------------------------------------------------------------- the ladder

function ladderMove(w: W, me: Row, row: Row): Move {
  const l = ladderOf(w, row)
  const r = rigging(w, me, l)
  const { k } = l
  const speed = l.rungs.lap / r.loop.dur
  const on: On = { touches: k.touches, fit: k.fit, floor: l.foot[1], ladder: row }
  // On the ladder in `phase`, the stick let go.
  const onIt = (at: Place, phase: string) => {
    free(me, [at.x, at.y, at.z], at.yaw)
    Object.assign(me.data, { ladder: row.id, phase })
  }
  return {
    name: `ladder ${row.id}`,
    against: `the ladder at (${round(l.foot[0])}, ${round(l.foot[2])}), its top ${round(l.top - l.foot[1])} m up`,
    floor: l.foot[1],
    steps: [
      {
        name: 'mount', clip: k.clips.mount, dur: r.mount.dur, loop: false,
        pose(t) {
          onIt(l.mount, 'mount')
          me.data.clock = Math.max(0, Math.min(r.mount.dur - SHORT, t))
          hold(me, k.clips.mount, me.data.clock, r.mount.dur)
          climb(me, w, 0)
        },
        marks: () => marksOf(w, me, on, l.mount),
      },
      {
        name: 'climb', clip: k.clips.climb, dur: r.handoff / speed, loop: false,
        pose(t) {
          onIt(l.climb, 'climb')
          me.data.rungs = Math.max(0, Math.min(r.handoff - SHORT, t * speed))
          hold(me, k.clips.climb, 0, r.loop.dur)
          climb(me, w, 0)
        },
        // The loop is placed by its whole laps up: where its root stands, which its travel never moves.
        marks: () => marksOf(w, me, on, { x: me.data.pos[0], y: me.data.pos[1], z: me.data.pos[2], yaw: me.data.yaw }),
      },
      {
        name: 'top', clip: k.clips.top, dur: r.top.dur, loop: false,
        pose(t) {
          onIt(l.up, 'top')
          me.data.clock = Math.max(0, Math.min(r.top.dur - SHORT, t))
          hold(me, k.clips.top, me.data.clock, r.top.dur)
          climb(me, w, 0)
        },
        marks: () => marksOf(w, me, on, l.up),
      },
    ],
  }
}

// ---------------------------------------------------------------- the chairs

function chairMove(w: W, me: Row, k: moving.Numbers, s: Chair): Move {
  const st = moving.startFor(w, me, k.seat.sit, s.x, s.z, s.yaw)
  const y = stand(numbers(me, w), underfoot(me, w, s.y), st.x, st.z)
  const rig = rigOf(w, animKind(me))
  const dur = (clip: string) => clipOf(rig, clip).dur
  const on: On = { touches: k.touches, fit: k.fit, floor: y }
  // The body's skin furthest behind within the chair's back over the whole of the clip it plays (its
  // touches' `behind`), and how far in front of the back's front face it stands: 0 touching it, under 0
  // through it.
  const back = (): Mark[] => {
    const rear = (json(w, k.touches).clips?.[me.data.clip]?.things?.behind ?? []) as number[][]
    const { width, height, back: tall, board, behind } = s.seat
    const inside = rear.filter(([x, up]) => Math.abs(x) <= width / 2 && y + up >= s.y + height && y + up <= s.y + height + tall)
    if (!inside.length) return []
    const [x, up, z] = inside.reduce((b, p) => (p[2] < b[2] ? p : b))
    const [wx, wz] = along(s.x, s.z, s.yaw, z, x)
    const gap = z - (board - behind)
    return [{ name: 'back', on: 'chair back', at: [wx, y + up, wz], gap, off: gap < 0 || gap > k.fit }]
  }
  // The body seated on this chair, as sitting leaves it.
  const seated = () => {
    free(me, [s.x, y, s.z], s.yaw)
    Object.assign(me.data, { move: 'seated', chair: [s.x, s.z, s.yaw], anchor: [st.x, y, st.z], turn0: st.yaw })
  }
  return {
    name: `chair at (${round(s.x)}, ${round(s.z)})`,
    against: `the chair at (${round(s.x)}, ${round(s.z)}), its seat ${s.seat.height} m high, its back ${s.seat.behind} m behind the hips`,
    floor: y,
    steps: [
      {
        name: 'sit', clip: k.seat.sit, dur: dur(k.seat.sit), loop: false,
        pose(t) {
          free(me, [st.x, y, st.z], st.yaw)
          if (!moving.use(me, w, k) || me.data.move !== 'sit') throw new Error(`moves: a body where sitting on the chair at (${s.x}, ${s.z}) starts sits on no chair`)
          scrubbed(me, w, k, t)
        },
        marks: () => [...marksOf(w, me, on, anchored(me)), ...back()],
      },
      {
        name: 'seated', clip: k.seat.seated, dur: dur(k.seat.seated), loop: true,
        pose(t) {
          seated()
          hold(me, k.seat.seated, t % dur(k.seat.seated), dur(k.seat.seated))
          moving.held(me, w, 0, k)
        },
        marks: () => [...marksOf(w, me, on, { x: s.x, y, z: s.z, yaw: s.yaw }), ...back()],
      },
      {
        name: 'rise', clip: k.seat.rise, dur: dur(k.seat.rise), loop: false,
        pose(t) {
          seated()
          moving.use(me, w, k)
          scrubbed(me, w, k, t)
        },
        marks: () => [...marksOf(w, me, on, anchored(me)), ...back()],
      },
    ],
  }
}

// ---------------------------------------------------------------- walls

// Each box's side facing (x, z): of its four (`faces` lists each box's four in turn), the one whose way
// out points most toward it.
function sidesFacing(w: W, x: number, z: number): Face[] {
  const all = faces(w)
  const toward = (f: Face) => {
    const [mx, mz] = middleOf(f)
    const len = math.hypot(x - mx, z - mz)
    return len > 0 ? ((x - mx) * f.out[0] + (z - mz) * f.out[1]) / len : 0
  }
  const out: Face[] = []
  for (let i = 0; i < all.length; i += 4) out.push(all.slice(i, i + 4).reduce((b, f) => (toward(f) > toward(b) ? f : b)))
  return out
}
const middleOf = (f: Face) => [(f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2]
const lengthOf = (f: Face) => math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1])
const wallName = (f: Face, y: number) => `the ${round(f.top - y)} m wall at (${round(middleOf(f)[0])}, ${round(middleOf(f)[1])})`

function coverMove(w: W, me: Row, k: moving.Numbers, f: Face, low: boolean): Move {
  const rig = rigOf(w, animKind(me))
  const dur = (clip: string) => clipOf(rig, clip).dur
  const len = lengthOf(f)
  const t = [(f.b[0] - f.a[0]) / len, (f.b[1] - f.a[1]) / len]
  const ex = f.a[0] + t[0] * (len / 2) + f.out[0] * k.cover.hug, ez = f.a[1] + t[1] * (len / 2) + f.out[1] * k.cover.hug
  const y = stand(numbers(me, w), underfoot(me, w, f.base), ex, ez)
  const yaw = k.cover.faces === 'wall' ? yawOf(-f.out[0], -f.out[1]) : yawOf(f.out[0], f.out[1])
  const stance = low ? k.cover.crouch : k.cover.stand
  const wall = [...f.a, ...f.b, ...f.out, yaw, low ? 1 : 0]
  const hugged: Place = { x: ex, y, z: ez, yaw }
  const on: On = { touches: k.touches, fit: k.fit, floor: y }
  // In cover against this wall, as going in leaves the body.
  const hugging = () => {
    free(me, [ex, y, ez], yaw, stance)
    Object.assign(me.data, { move: 'hug', wall: [...wall], face: yaw })
  }
  // Out of cover toward one end of the wall, as `hug` takes a push out from it and toward that end.
  const pushOut = (side: number) => {
    hugging()
    moving.hug(me, w, [f.out[0] + t[0] * side * 0.5, f.out[1] + t[1] * side * 0.5], k)
  }
  const into = (clip: string): Step => {
    const st = moving.startFor(w, me, clip, ex, ez, yaw)
    return {
      name: `in · ${clip}`, clip, dur: dur(clip), loop: false,
      pose(time) {
        free(me, [st.x, y, st.z], st.yaw)
        me.data.wall = [...wall]
        moving.begin(me, 'in', clip, [st.x, y, st.z], st.yaw)
        scrubbed(me, w, k, time)
      },
      marks: () => marksOf(w, me, on, anchored(me)),
    }
  }
  const idle = momentOf(rig, stance, 'still')
  if (!idle) throw new Error(`demo_walker.workshop: the rig names no still role for the stance ${stance}`)
  const sneaks = [90, -90].map(way => ({ way, c: gearAt(w, rig, stance, way, k.cover.speed) })).filter((g, i, all) => all.findIndex(x => x.c.name === g.c.name) === i)
  const outs = [1, -1].map(side => { pushOut(side); return { side, clip: me.data.clip as string } }).filter((o, i, all) => all.findIndex(x => x.clip === o.clip) === i)
  const inClip = low ? k.cover.lowIn : k.cover.in
  return {
    name: `${low ? 'low cover' : 'cover'} · ${wallName(f, y)}`,
    against: `${wallName(f, y)}, the body ${k.cover.hug} m out from it facing ${k.cover.faces === 'wall' ? 'it' : 'out'}`,
    floor: y,
    steps: [
      into(inClip),
      into(k.cover.mirror[inClip]),
      {
        name: `idle · ${idle}`, clip: idle, dur: dur(idle), loop: true,
        pose(time) {
          hugging()
          hold(me, idle, time % dur(idle), dur(idle))
        },
        marks: () => marksOf(w, me, on, hugged),
      },
      ...sneaks.map(({ way, c }) => gearStep(w, me, `sneak · ${c.name}`, c, hugged, stance, way, k.cover.speed, on, d =>Object.assign(d, { move: 'hug', wall: [...wall], face: yaw }))),
      ...outs.map(o => ({
        name: `out · ${o.clip}`, clip: o.clip, dur: dur(o.clip), loop: false,
        pose(time: number) {
          pushOut(o.side)
          scrubbed(me, w, k, time)
        },
        marks: () => marksOf(w, me, on, anchored(me)),
      })),
    ],
  }
}

// The vault or the wall run against a side, begun where the game begins it against its middle; none
// where the side does not fit it.
function overMove(w: W, me: Row, k: moving.Numbers, f: Face, move: 'vault' | 'wallrun'): Move | undefined {
  const m = move === 'vault' ? k.vault : k.wallrun
  const c = moving.touchOf(w, me, k, m.clip)
  const [mx, mz] = middleOf(f)
  const y = stand(numbers(me, w), underfoot(me, w, f.base), mx + f.out[0] * m.reach, mz + f.out[1] * m.reach)
  const o = moving.onFace(f, mx, mz)
  const start = move === 'vault' ? moving.overWall(c, m.clip, f, o, y, k) : moving.upWall(c, m.clip, f, o, y, k)
  if (!start) return undefined
  if (move === 'vault') {
    const end = moving.placed(w, me, m.clip, [start.x, y, start.z], start.yaw, Infinity)
    if (Math.abs(underfoot(me, w, y).height(end.x, end.z) - y) > numbers(me, w).step) return undefined
  }
  const anchor = [start.x, y, start.z]
  const name = move === 'vault' ? 'vault' : 'wall run'
  const on: On = { touches: k.touches, fit: k.fit, floor: y }
  return {
    name: `${name} · ${wallName(f, y)}`,
    against: wallName(f, y),
    floor: y,
    steps: [{
      name, clip: m.clip, dur: clipOf(rigOf(w, animKind(me)), m.clip).dur, loop: false,
      pose(t) {
        free(me, anchor, start.yaw)
        moving.begin(me, move, m.clip, anchor, start.yaw)
        scrubbed(me, w, k, t)
      },
      marks: () => marksOf(w, me, on, { x: start.x, y, z: start.z, yaw: start.yaw }),
    }],
  }
}

// ---------------------------------------------------------------- the floor

function floorMove(w: W, me: Row, p: any, there: Row): Move {
  const k = p.moves as moving.Numbers
  const rig = rigOf(w, animKind(me))
  const a = numbersOf(w)
  const [x, z] = there.data.pos
  const y = underfoot(me, w, land(w)(w, x, z)).height(x, z)
  const start: Place = { x, y, z, yaw: there.data.yaw }
  const on: On = { touches: k.touches, fit: k.fit, floor: y }
  // A clip played where the body stands in `stance`, carried by the travel a one-shot carries.
  const still = (name: string, clip: string, stance: string): Step => {
    const c = clipOf(rig, clip)
    return {
      name: `${name} · ${clip}`, clip, dur: c.dur, loop: c.loop,
      pose(t) {
        const played = c.loop ? t % c.dur : Math.min(t, c.dur - SHORT)
        const r = placed(start, c, a, played)
        free(me, [r.x, y, r.z], r.yaw, stance)
        hold(me, clip, played, c.dur)
      },
      marks: () => marksOf(w, me, on, start),
    }
  }
  const role = (stance: string, moment: 'still' | 'jump' | 'fall') => {
    const clip = momentOf(rig, stance, moment)
    if (!clip) throw new Error(`demo_walker.workshop: the rig names no ${moment} role for the stance ${stance}`)
    return clip
  }
  // The gears the rule walks the stance at, each once.
  const gears = (stance: string, speeds: number[]) => speeds.map(v => ({ v, c: gearAt(w, rig, stance, 0, v) }))
    .filter((g, i, all) => all.findIndex(x => x.c.name === g.c.name) === i)
    .map(({ v, c }) => gearStep(w, me, `${c.name} · ${v} m/s`, c, start, stance, 0, v, on))
  const t = k.tricks
  return {
    name: 'floor',
    against: `the ground at the seat's start (${round(x)}, ${round(z)})`,
    floor: y,
    steps: [
      still('idle', role('stand', 'still'), 'stand'),
      ...gears('stand', [p.walk, p.run]),
      still('jump', role('stand', 'jump'), 'stand'),
      still('fall', role('stand', 'fall'), 'stand'),
      still('land', t.land, 'stand'),
      still('land roll', t.landroll, 'stand'),
      still('roll', t.roll, 'stand'),
      still('slide', t.slide, 'stand'),
      still('flip', t.flip, 'stand'),
      still('backflip', t.backflip, 'stand'),
      // Crouching flips the stance, then plays the clip down; standing flips it back, then plays it up.
      still('crouch', k.crouch.down, 'crouch'),
      still('crouched', role('crouch', 'still'), 'crouch'),
      ...gears('crouch', [k.crouch.speed]),
      still('stand up', k.crouch.up, 'stand'),
    ],
  }
}

// ---------------------------------------------------------------- every move

export function moves(w: W, me: Row): Move[] {
  const p = def(w, me.kind)
  const k = p.moves as moving.Numbers
  const there = w.find('start', s => s.data.slot === me.data.seat)
  const sides = sidesFacing(w, there.data.pos[0], there.data.pos[1])
  // How high a side stands over the ground where a body takes cover at its middle.
  const over = (f: Face) => {
    const [mx, mz] = middleOf(f)
    return f.top - stand(numbers(me, w), underfoot(me, w, f.base), mx + f.out[0] * k.cover.hug, mz + f.out[1] * k.cover.hug)
  }
  // A side a body takes cover at the middle of: as long as its two margins.
  const coverable = (f: Face) => lengthOf(f) >= 2 * k.cover.margin
  return [
    ...w.all('ladder').map(row => ladderMove(w, me, row)),
    ...chairs(w).map(s => chairMove(w, me, k, s)),
    ...sides.filter(f => coverable(f) && over(f) >= k.cover.tall).map(f => coverMove(w, me, k, f, false)),
    ...sides.filter(f => coverable(f) && over(f) >= k.cover.low && over(f) < k.cover.tall).map(f => coverMove(w, me, k, f, true)),
    ...sides.map(f => overMove(w, me, k, f, 'vault')).filter((m): m is Move => !!m),
    ...sides.map(f => overMove(w, me, k, f, 'wallrun')).filter((m): m is Move => !!m),
    floorMove(w, me, p, there),
  ]
}
