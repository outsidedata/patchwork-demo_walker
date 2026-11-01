// moves: demo_walker's own plugin, the moves a walker body (`plugins/walker`) makes beside walking,
// played with anim's clips (`plugins/anim`): crouching, sitting on a chair, taking cover against a
// wall and sneaking along it, vaulting a low wall, running up a high one, and the tricks, a dodge roll,
// a running slide, a front flip and a backflip, and rolling out of a hard landing. It has no row and no
// page half. A rule hands each function its row, its `w` and its kind's `moves` numbers, `k` below.
//
// Two ways a move is played:
//   held    the clip is scrubbed by this plugin, as climber scrubs a ladder's: played with anim's
//           `play` at rate 0, holding the body, its `clipT` written each step, the body's root carried
//           along the clip's measured travel (anim's `at`) from the place it starts, turned by the clip's
//           turn where anim carries it (`carries`), and walker not asked to walk it. A move against a
//           thing (a chair, a wall) starts its clip where its end puts the body against the thing, and
//           the body is eased onto that start over `k.settle` seconds from where it stood (`slip`).
//           Sitting, cover's going in and coming out, the vault and the wall run are held.
//   played  the clip is played by anim as an act (`play`), carrying its own travel, which the rule's
//           stride carries by walker (`carry`), so a roll or a slide stops at a wall. The tricks are
//           played.
//
// The row carries walker's fields, anim's, the stick and `fast`, and its own:
//   crouch   true while crouched: anim's stance (`rig`) is `crouch`, and the rule walks at `k.crouch.speed`
//   move     the held move under way: `sit`, `seated`, `rise`, `in`, `hug`, `out`, `vault`, `wallrun`,
//            or '' for none
//   clock    seconds into a held move's clip; `anchor` [x, y, z] where its root starts and `turn0` the
//            way it faces then; `slip` [x, z, yaw] the body off that start, eased away
//   chair    [x, z, yaw] the chair it sits on; `wall` [ax, az, bx, bz, ox, oz, yaw, low] the side it hugs,
//            the yaw it faces there, and 1 for a low wall
//
// The numbers, `k`, the `moves` of the rule's kind's definition (`assets/demo_walker.json`):
//   touches  the loader `json` entry of what the clips touch, measured on the body they play on
//            (`assets/xbot.touches.json`, its `body` that body's anim kind, written by the game's bake):
//            where the seated clip sits (`things.seat`), the skin furthest behind of the sitting clips
//            (`things.behind`), where the vault sets its hands and how far its feet keep over the wall
//            (`things.over`), where the wall run kicks the wall (`things.face`) and the top it ends on
//            (`floor`). The chairs and walls are built to them.
//   fit      metres: how far a chair's seat, a vault's wall top or a wall run's top may stand from where
//            its clip has it
//   settle   seconds a held move's start is eased over
//   crouch   `{ down, up, speed }`: the clips played going down and getting up while still, and the
//            speed crouched, m/s
//   seat     `{ sit, seated, rise, reach }`: the clips, and how near where sitting starts a body must be.
//            A chair's seat must stand where the seated clip sits, within `fit` of its height and
//            under it across the ground, and its back's front face on the body's rearmost skin within
//            the back's span over the whole of sitting down, seated and getting up, no nearer and no
//            more than `fit` further (`backFits`, off the touches' `behind`), or sitting on it throws,
//            naming the height or the back that fits.
//   cover    `{ stand, crouch, in, out, lowIn, lowOut, tall, low, hug, faces, speed, reach, margin }`:
//            the stances, the clips in and out of a wall `tall` metres or more over the body's feet and
//            of one `low` or more, each with its `mirror` turned the other way; `hug` metres from the
//            wall the body stands in cover, `faces` `wall` or `out`, the way it faces there; `speed`
//            m/s along it; how near (`reach`) a wall a body must be to take cover; and `margin`, how near
//            a wall's ends it may sneak
//   vault    `{ clip, reach, run }`: over a wall whose top stands within `fit` of where the clip sets
//            its hands, over the feet, and thin enough that its feet keep over its top: the clip placed
//            so its hands land on the middle of the wall's top where the body runs at it, square to
//            the wall, for a body at `run` m/s or faster within `reach` of where the clip then starts,
//            landing on ground within a step of its feet
//   wallrun  `{ clip, reach, run }`: up onto a wall whose top stands within `fit` of the floor the clip
//            ends on, over the feet: the clip placed so its kick lands on the wall's face where the
//            body runs at it, square to it, for a body at `run` m/s or faster within `reach` of where
//            the clip then starts
//   tricks   `{ roll, slide, flip, backflip, landroll, land, slideAbove, flipAbove, rollAbove }`: the
//            clips; a slide only at `slideAbove` m/s or faster; a front flip at `flipAbove` or faster and
//            a backflip slower; and a hard landing (anim's `land` role, `land`) at `rollAbove` m/s across
//            the ground or faster rolls out with `landroll`
//
// `held(me, w, dt, k)` is one step of a held move, and false for a body making none (in cover, `hug`,
// the rule walks it). `hug(me, w, want, k)` is the velocity a body in cover walks at for the `want` the
// keys ask: along the wall at `k.cover.speed`, never past its margin from either end, facing the way it
// faces there (walker's `face`); keys pushing out from the wall leave cover instead, out toward the
// side they lean. `use(me, w, k)` sits on the nearest chair, takes cover against the nearest wall, or
// gets up or leaves cover, and is whether it did; `crouch(me, w, k)` crouches or stands; `jump(me, w,
// k)` vaults or runs up a wall in front of a running body, and is false where neither fits;
// `trick(me, k, name)` plays a trick; `landed(me, dt, k)`, asked after each stride, rolls out of a
// hard landing it has just begun. Each but `use` (which also gets up and leaves cover) and `hug`
// refuses, doing nothing, while the body is in the air, on a ladder, held or playing an act.
//
// The things the moves are made against are rows of the scene. A wall is any side of a shapes3d box
// (`faces(w)`, every box's four sides, `sidesOf(box)` one box's, each `{ a, b, out, top, base, deep }`: its two ends [x, z] across the
// ground, the way out from it [x, z], its top's height and its underside's, and how deep the box is
// behind it, listed ahead, behind, right and left of the way the box faces), and a move is made only
// against a side that stands on the ground the body stands on, its underside no more than a step over
// the feet. A chair is a `chair` row (`chairs(w)`): its `pos` where its sitter's hips stand over the
// ground, its `yaw` the way the sitter faces, and its seat's sizes its definition's (`height`, `width`,
// `depth`, `back`, `behind`, `board`, `leg`), which `chair.client.ts` draws. A body stands back on its
// feet where a held clip ends on the ground at the floor the clip ends on over its start (its touches'
// `floor`, the wall run's top), by gait's `underfoot`.
//
// `startFor(w, me, clip, x, z, yaw)` is where a held clip starts for its end to stand the body at (x, z)
// facing `yaw`, `placed(w, me, clip, anchor, turn0, t)` where a held clip begun there has the root at t,
// `begin(me, move, clip, anchor, turn0)` a held move begun, `onFace(face, x, z)` a point's place along a
// side and out from it, `overWall` and `upWall` where the vault and the wall run start against a side
// (none where the side does not fit), and `touchOf(w, me, k, clip)` what one clip touches: what the
// workshop stands a move by (`demo_walker.workshop.ts`), so a body there makes the move as `use` and
// `jump` start it.
import type { Row, W } from '#engine/engine.ts'
import { at, carries, clipOf, numbersOf, play, rigOf, stop, animKind } from '#plugins/anim/anim.sim.ts'
import { def, json } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { shapes, type Box } from '#plugins/shapes3d/shapes3d.sim.ts'
import { numbers, stand } from '#plugins/walker/walker.sim.ts'
import { underfoot } from '../gait/gait.sim.ts'

const DEG = Math.PI / 180
const SHORT = 1e-6
const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
// A point `f` metres along yaw θ's facing and `l` to its left, from (x, z).
const along = (x: number, z: number, yaw: number, f: number, l: number) =>
  [x + f * math.sin(yaw) + l * math.cos(yaw), z + f * math.cos(yaw) - l * math.sin(yaw)]
const yawOf = (x: number, z: number) => math.atan2(x, z)

export type Numbers = {
  touches: string
  fit: number
  settle: number
  crouch: { down: string; up: string; speed: number }
  seat: { sit: string; seated: string; rise: string; reach: number }
  cover: {
    stand: string; crouch: string; in: string; out: string; lowIn: string; lowOut: string; mirror: Record<string, string>
    tall: number; low: number; hug: number; faces: 'wall' | 'out'; speed: number; reach: number; margin: number
  }
  vault: { clip: string; reach: number; run: number }
  wallrun: { clip: string; reach: number; run: number }
  tricks: { roll: string; slide: string; flip: string; backflip: string; landroll: string; land: string; slideAbove: number; flipAbove: number; rollAbove: number }
}

// A side of a box, and a chair (the header).
export type Face = { a: number[]; b: number[]; out: number[]; top: number; base: number; deep: number }
export type Seat = { height: number; width: number; depth: number; back: number; behind: number; board: number; leg: number }
export type Chair = { x: number; z: number; yaw: number; y: number; seat: Seat }

// A box's four sides: ahead, behind, right and left of the way it faces.
export function sidesOf(b: Box): Face[] {
  const [across, , along] = b.size
  const s = math.sin(b.yaw), c = math.cos(b.yaw)
  const fwd = [s, c], right = [c, -s]
  // Each side: the way out, its half length along it, and the box's half depth behind it.
  return ([[fwd, across / 2, along / 2], [[-fwd[0], -fwd[1]], across / 2, along / 2], [right, along / 2, across / 2], [[-right[0], -right[1]], along / 2, across / 2]] as [number[], number, number][]).map(([out, half, depth]) => {
    const t = [-out[1], out[0]]
    const mx = b.pos[0] + out[0] * depth, mz = b.pos[2] + out[1] * depth
    return { a: [mx - t[0] * half, mz - t[1] * half], b: [mx + t[0] * half, mz + t[1] * half], out, top: b.pos[1] + b.size[1], base: b.pos[1], deep: 2 * depth }
  })
}

export const faces = (w: W): Face[] => shapes(w).flatMap(p => (p.word === 'box' ? sidesOf(p.shape.box as Box) : []))

export const chairs = (w: W): Chair[] =>
  w.all('chair').map(r => ({ x: r.data.pos[0], z: r.data.pos[2], yaw: r.data.yaw, y: r.data.pos[1], seat: def(w, 'chair') as Seat }))

// Whether a side stands on the ground a body stands on at `y`: its underside no more than a step over it.
const grounded = (f: Face, y: number, step: number) => f.base <= y + step

// Where a held clip leaves the root at t, the way it faces, from its start.
export function placed(w: W, me: Row, clip: string, anchor: number[], turn0: number, t: number) {
  const c = clipOf(rigOf(w, animKind(me)), clip)
  const [f, l, turn] = at(c.measure, Math.max(0, Math.min(c.dur, t)))
  const [x, z] = along(anchor[0], anchor[2], turn0, f * c.scale, l * c.scale)
  return { x, z, yaw: wrap(turn0 + (carries(c, numbersOf(w)).turns ? turn * DEG : 0)), dur: c.dur }
}

// Where a held clip must start for its end to stand the body at (x, z) facing `yaw`.
export function startFor(w: W, me: Row, clip: string, x: number, z: number, yaw: number) {
  const c = clipOf(rigOf(w, animKind(me)), clip)
  const [f, l, turn] = at(c.measure, c.dur)
  const turn0 = wrap(yaw - (carries(c, numbersOf(w)).turns ? turn * DEG : 0))
  const [sx, sz] = along(x, z, turn0, -f * c.scale, -l * c.scale)
  return { x: sx, z: sz, yaw: turn0 }
}

// A held move begun: its clip from 0, the root's start, and the body's way off it to ease away.
export function begin(me: Row, move: string, clip: string, anchor: number[], turn0: number) {
  const d = me.data
  d.move = move
  d.clock = 0
  d.anchor = anchor
  d.turn0 = turn0
  d.slip = [d.pos[0] - anchor[0], d.pos[2] - anchor[2], wrap(d.yaw - turn0)]
  d.vel = [0, 0, 0]
  d.want = [0, 0]
  play(me, clip, { holds: true, rate: 0 })
}

// The body where its held clip has it this step; and whether the clip has ended.
function scrub(me: Row, w: W, dt: number, k: Numbers): boolean {
  const d = me.data
  d.clock += dt
  const p = placed(w, me, d.clip, d.anchor, d.turn0, d.clock)
  const ease = Math.max(0, 1 - d.clock / k.settle)
  d.pos = [p.x + d.slip[0] * ease, d.anchor[1], p.z + d.slip[1] * ease]
  d.yaw = wrap(p.yaw + d.slip[2] * ease)
  d.clipT = Math.min(d.clock, p.dur - SHORT)
  d.vel = [0, 0, 0]
  d.grounded = true
  d.sliding = false
  return d.clock >= p.dur
}

// The body back on its feet where its held clip ends, on the ground at the floor the clip ends on over
// its start, walking, in its stance.
function walkOn(me: Row, w: W, k: Numbers) {
  const d = me.data
  const feet = d.anchor[1] + (touchOf(w, me, k, d.clip).floor ?? 0)
  d.move = ''
  d.slip = [0, 0, 0]
  d.want = [0, 0]
  d.pos = [d.pos[0], stand(numbers(me, w), underfoot(me, w, feet), d.pos[0], d.pos[2]), d.pos[2]]
  d.grounded = true
  d.sliding = false
  stop(me, w)
}

// Whether the body is free to start a move: on the ground, on no ladder, holding no move, playing no act.
const free = (me: Row) => {
  const d = me.data
  return d.grounded && !d.ladder && !d.move && d.state !== 'act'
}

const speedOf = (me: Row) => math.hypot(me.data.vel[0], me.data.vel[2])

// What one clip touches (`assets/xbot.touches.json`, as `xbot.touches.mjs` writes it), measured on the
// body this row plays: the floor it ends on, and of its `things` the wall it kicks (`face`), the top it
// sets its hands on going over (`over`), where it sits (`seat`) and its skin furthest behind in the
// chair's frame (`behind`).
export type Touch = {
  floor: number | null
  things: {
    face?: { normal: number; at: number[] }
    over?: { top: number; at: number[]; way: number; clear: number[] }
    seat?: { y: number; at: number[] }[]
    behind?: number[][]
  }
}
export function touchOf(w: W, me: Row, k: Numbers, clip: string): Touch {
  const c = json(w, k.touches) as { body: string; clips: Record<string, Touch> }
  const kind = animKind(me)
  if (c.body !== kind) throw new Error(`moves: the touches ${k.touches} are measured on ${c.body}, and a ${kind} makes the move`)
  const got = c.clips[clip]
  if (!got) throw new Error(`moves: the touches ${k.touches} have no clip ${clip}`)
  return got
}

// ---------------------------------------------------------------- crouching

export function crouch(me: Row, w: W, k: Numbers) {
  const d = me.data
  if (!free(me)) return
  d.crouch = !d.crouch
  d.rig = d.crouch ? 'crouch' : 'stand'
  // Still, it goes down or gets up; moving, its gears change to the stance's.
  if (speedOf(me) < numbersOf(w).still) play(me, d.crouch ? k.crouch.down : k.crouch.up)
}

// ---------------------------------------------------------------- the moves held

export function held(me: Row, w: W, dt: number, k: Numbers): boolean {
  const d = me.data
  switch (d.move) {
    case '':
    case undefined:
      return false
    case 'sit':
      if (scrub(me, w, dt, k)) {
        d.move = 'seated'
        play(me, k.seat.seated, { holds: true })
      }
      return true
    case 'seated': {
      const [x, z, yaw] = d.chair
      d.pos = [x, d.anchor[1], z]
      d.yaw = yaw
      d.vel = [0, 0, 0]
      d.want = [0, 0]
      d.grounded = true
      return true
    }
    case 'rise':
    case 'out':
      if (scrub(me, w, dt, k)) {
        if (d.move === 'out') d.rig = d.crouch ? 'crouch' : 'stand'
        walkOn(me, w, k)
      }
      return true
    case 'in':
      if (scrub(me, w, dt, k)) {
        d.move = 'hug'
        d.slip = [0, 0, 0]
        d.rig = d.wall[7] ? k.cover.crouch : k.cover.stand
        stop(me, w)
      }
      return true
    case 'hug':
      return false
    case 'vault':
    case 'wallrun': {
      if (!scrub(me, w, dt, k)) return true
      // On its feet where the clip ends, running on the way it faced.
      const speed = (d.move === 'vault' ? k.vault : k.wallrun).run
      walkOn(me, w, k)
      d.vel = [math.sin(d.yaw) * speed, 0, math.cos(d.yaw) * speed]
      return true
    }
  }
  throw new Error(`moves: the body holds a move it knows nothing of, ${d.move}`)
}

// ---------------------------------------------------------------- sitting and cover

// A point's nearest place on a side, metres along it from its first end, and its distance out from it.
export function onFace(f: Face, x: number, z: number) {
  const tx = f.b[0] - f.a[0], tz = f.b[1] - f.a[1]
  const len = math.hypot(tx, tz)
  const u = ((x - f.a[0]) * tx + (z - f.a[1]) * tz) / len
  const out = (x - f.a[0]) * f.out[0] + (z - f.a[1]) * f.out[1]
  return { u, len, out, t: [tx / len, tz / len] }
}

export function use(me: Row, w: W, k: Numbers): boolean {
  const d = me.data
  if (d.move === 'seated') {
    const [x, z, yaw] = d.chair
    begin(me, 'rise', k.seat.rise, [x, d.anchor[1], z], yaw)
    return true
  }
  if (d.move === 'hug') return leave(me, w, k, 0)
  if (!free(me)) return false
  const [x, y, z] = d.pos

  // The nearest chair whose sitting starts within reach.
  let best: (Chair & { far: number }) | undefined
  for (const s of chairs(w)) {
    const start = startFor(w, me, k.seat.sit, s.x, s.z, s.yaw)
    const far = math.hypot(x - start.x, z - start.z)
    if (far <= k.seat.reach && (!best || far < best.far)) best = { ...s, far }
  }
  if (best) {
    // The seat stands where the seated clip sits: its height, and under it across the ground.
    const sits = touchOf(w, me, k, k.seat.seated).things.seat?.[0]
    if (!sits) throw new Error(`moves: the seated clip ${k.seat.seated} sits on nothing in its touches`)
    const sy = sits.y, [sx, sz] = sits.at
    const { height, width, depth, behind } = best.seat
    if (Math.abs(height - sy) > k.fit) {
      throw new Error(`moves: the chair at (${best.x}, ${best.z})'s seat stands ${height} m high, and the seated clip ${k.seat.seated} sits at ${sy} m: a seat ${sy} m high fits`)
    }
    if (sz < -behind || sz > depth - behind || Math.abs(sx) > width / 2) {
      throw new Error(`moves: the chair at (${best.x}, ${best.z})'s seat runs from ${-behind} to ${depth - behind} m along its facing and ${width / 2} m to either side of where its sitter's hips stand, and the seated clip ${k.seat.seated} sits ${sz} m along and ${sx} m to the side`)
    }
    const fits = backFits(w, me, k, best, y)
    if (fits !== undefined && (behind < fits || behind > fits + k.fit)) {
      throw new Error(`moves: the chair at (${best.x}, ${best.z})'s back stands ${behind} m behind where its sitter's hips stand, and the body sitting down, seated and getting up reaches back to a back ${fits.toFixed(3)} m behind them: a chair whose back stands ${fits.toFixed(3)} m behind, its depth ${(depth - behind + fits).toFixed(3)} m, fits`)
    }
    const start = startFor(w, me, k.seat.sit, best.x, best.z, best.yaw)
    d.chair = [best.x, best.z, best.yaw]
    begin(me, 'sit', k.seat.sit, [start.x, y, start.z], start.yaw)
    return true
  }

  // The nearest wall within reach, on the ground the body stands on, that stands at least `low` over the
  // feet.
  const step = numbers(me, w).step
  let wall: { f: Face; u: number; out: number; t: number[] } | undefined
  for (const f of faces(w)) {
    const o = onFace(f, x, z)
    if (!grounded(f, y, step) || o.out < 0 || o.out > k.cover.reach || o.u < k.cover.margin || o.u > o.len - k.cover.margin) continue
    if (f.top - y < k.cover.low) continue
    if (!wall || o.out < wall.out) wall = { f, u: o.u, out: o.out, t: o.t }
  }
  if (!wall) return false
  const { f, u, t } = wall
  const low = f.top - y < k.cover.tall
  const ex = f.a[0] + t[0] * u + f.out[0] * k.cover.hug
  const ez = f.a[1] + t[1] * u + f.out[1] * k.cover.hug
  const yaw = k.cover.faces === 'wall' ? yawOf(-f.out[0], -f.out[1]) : yawOf(f.out[0], f.out[1])
  // The clip in, or its mirror, whichever starts nearer the body.
  const clip = low ? k.cover.lowIn : k.cover.in
  const [one, other] = [clip, k.cover.mirror[clip]].map(c => ({ c, s: startFor(w, me, c, ex, ez, yaw) }))
  const pick = math.hypot(x - one.s.x, z - one.s.z) <= math.hypot(x - other.s.x, z - other.s.z) ? one : other
  d.wall = [...f.a, ...f.b, ...f.out, yaw, low ? 1 : 0]
  begin(me, 'in', pick.c, [pick.s.x, y, pick.s.z], pick.s.yaw)
  return true
}

// How far behind where its sitter's hips stand a chair's back stands with its front face on the body's
// rearmost skin, over the whole of sitting down, seated and getting up (each clip's touches' `behind`, in
// the chair's frame, from the floor the body stands on at `y`): of the skin within the back's width and
// between the seat's top and the back's, the furthest behind, and the board's thickness behind that.
// Undefined where no skin of the clips reaches the back's span.
export function backFits(w: W, me: Row, k: Numbers, chair: Chair, y: number): number | undefined {
  const { width, height, back, board } = chair.seat
  const rear = [k.seat.sit, k.seat.seated, k.seat.rise].flatMap(c => touchOf(w, me, k, c).things.behind ?? [])
  const inside = rear.filter(([x, up]) => Math.abs(x) <= width / 2 && y + up >= chair.y + height && y + up <= chair.y + height + back)
  return inside.length ? board - Math.min(...inside.map(p => p[2])) : undefined
}

// Out of cover: the clip out, or its mirror, the one that ends the way `side` asks along the wall (1
// toward its second end, −1 its first, 0 whichever ends further out from it).
function leave(me: Row, w: W, k: Numbers, side: number): boolean {
  const d = me.data
  const [ax, az, bx, bz, ox, oz, yaw, low] = d.wall
  const clip = low ? k.cover.lowOut : k.cover.out
  const tx = bx - ax, tz = bz - az
  const ends = [clip, k.cover.mirror[clip]].map(c => {
    const p = placed(w, me, c, d.pos, yaw, Infinity)
    const dx = p.x - d.pos[0], dz = p.z - d.pos[2]
    return { c, out: dx * ox + dz * oz, side: dx * tx + dz * tz }
  })
  const pick = side === 0
    ? (ends[0].out >= ends[1].out ? ends[0] : ends[1])
    : (ends[0].side * side >= ends[1].side * side ? ends[0] : ends[1])
  begin(me, 'out', pick.c, [...d.pos], yaw)
  d.slip = [0, 0, 0]
  return true
}

export function hug(me: Row, w: W, want: number[], k: Numbers): number[] {
  const d = me.data
  const [ax, az, bx, bz, ox, oz, yaw] = d.wall
  // Pushed out from the wall, it leaves cover, toward the way the keys ask along it.
  const len = math.hypot(want[0], want[1])
  const tx = (bx - ax), tz = (bz - az)
  const tl = math.hypot(tx, tz)
  const ux = tx / tl, uz = tz / tl
  if (len > 0 && (want[0] * ox + want[1] * oz) / len > 0.7) {
    leave(me, w, k, Math.sign(want[0] * ux + want[1] * uz))
    return [0, 0]
  }
  // Along the wall at the cover speed, never past its margin from either end.
  const s = len > 0 ? (want[0] * ux + want[1] * uz) / len : 0
  const at = (d.pos[0] - ax) * ux + (d.pos[2] - az) * uz
  const room = s > 0 ? tl - k.cover.margin - at : at - k.cover.margin
  const v = room > 0 ? s * k.cover.speed : 0
  d.face = yaw
  return [ux * v, uz * v]
}

// ---------------------------------------------------------------- vault and wall run

export function jump(me: Row, w: W, k: Numbers): boolean {
  const d = me.data
  if (!free(me) || d.crouch) return false
  const speed = speedOf(me)
  const [x, y, z] = d.pos
  const fx = math.sin(d.yaw), fz = math.cos(d.yaw)
  const step = numbers(me, w).step
  for (const [move, m] of [['vault', k.vault], ['wallrun', k.wallrun]] as const) {
    if (speed < m.run) continue
    const c = touchOf(w, me, k, m.clip)
    for (const f of faces(w)) {
      const o = onFace(f, x, z)
      const head = -(fx * f.out[0] + fz * f.out[1])
      if (!grounded(f, y, step) || head < 0.7 || o.out < 0 || o.u < 0 || o.u > o.len) continue
      const start = move === 'vault' ? overWall(c, m.clip, f, o, y, k) : upWall(c, m.clip, f, o, y, k)
      if (!start || math.hypot(x - start.x, z - start.z) > m.reach) continue
      // A vault lands where the ground is near the feet's height.
      if (move === 'vault') {
        const end = placed(w, me, m.clip, [start.x, y, start.z], start.yaw, Infinity)
        if (Math.abs(underfoot(me, w, y).height(end.x, end.z) - y) > step) continue
      }
      begin(me, move, m.clip, [start.x, y, start.z], start.yaw)
      return true
    }
  }
  return false
}

// Where a side's face meets the line the body runs at it on.
const faceAt = (f: Face, o: ReturnType<typeof onFace>) => [f.a[0] + o.t[0] * o.u, f.a[1] + o.t[1] * o.u]

// Where the vault starts the root, and the way it faces, to set its hands on the middle of this wall's
// top; none for a wall of a height it does not set them on, or too deep for its feet to keep over.
export function overWall(c: Touch, clip: string, f: Face, o: ReturnType<typeof onFace>, y: number, k: Numbers) {
  if (!c.things.over) throw new Error(`moves: the vault ${clip} sets its hands on no top in its touches`)
  const { top, at: [ax, az], way, clear } = c.things.over
  if (Math.abs(f.top - y - top) > k.fit || f.deep / 2 > Math.min(-clear[0], clear[1])) return undefined
  const [px, pz] = faceAt(f, o)
  const hands = [px - f.out[0] * (f.deep / 2), pz - f.out[1] * (f.deep / 2)]
  const yaw = wrap(yawOf(-f.out[0], -f.out[1]) - way * DEG)
  const [x, z] = along(hands[0], hands[1], yaw, -az, -ax)
  return { x, z, yaw }
}

// Where the wall run starts the root, and the way it faces, to kick this wall's face; none for a wall
// whose top is not the floor it ends on.
export function upWall(c: Touch, clip: string, f: Face, o: ReturnType<typeof onFace>, y: number, k: Numbers) {
  if (!c.things.face) throw new Error(`moves: the wall run ${clip} kicks no wall in its touches`)
  if (c.floor === null) throw new Error(`moves: the wall run ${clip} ends on no raised floor in its touches`)
  if (Math.abs(f.top - y - c.floor) > k.fit) return undefined
  const { normal, at: [ax, az] } = c.things.face
  const [px, pz] = faceAt(f, o)
  const yaw = wrap(yawOf(f.out[0], f.out[1]) - normal * DEG)
  const [x, z] = along(px, pz, yaw, -az, -ax)
  return { x, z, yaw }
}

// ---------------------------------------------------------------- tricks

export function trick(me: Row, k: Numbers, name: 'roll' | 'slide' | 'flip') {
  const d = me.data
  if (!free(me) || d.crouch) return
  const speed = speedOf(me)
  if (name === 'roll') play(me, k.tricks.roll)
  if (name === 'slide' && speed >= k.tricks.slideAbove) play(me, k.tricks.slide)
  if (name === 'flip') play(me, speed >= k.tricks.flipAbove ? k.tricks.flip : k.tricks.backflip)
}

export function landed(me: Row, dt: number, k: Numbers) {
  const d = me.data
  if (d.state !== 'act' || d.clip !== k.tricks.land || d.clipT > dt * 1.5) return
  if (math.hypot(d.vel[0], d.vel[2]) >= k.tricks.rollAbove) play(me, k.tricks.landroll)
}
