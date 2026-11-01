// touch: demo_walker's own plugin, a clip stood on a thing of the scene by what the clip touches. It has
// no row and no page half: a rule hands it a row, the station the row plays at and its kind's numbers.
//
// What each clip touches is the game's `assets/xbot.touches.json` (`xbot.touches.mjs`, by anim's
// touch reader `plugins/anim/anim.touches.mjs`, whose header says what each reading is): every place in it is in the
// clip's own space as the clip is baked (x the body's left, y up, z ahead, metres, the floor the clip was
// made on at y = 0). Anim draws a clip placed rigidly in the world: every point of it stands at where its
// root started plus the clip's own place of the point, turned by the way the root faced then. So a clip
// is stood on a thing by one place and one facing (`Place`): the place that carries a point the clip
// touches (`q`) onto the point of the thing it touches (`W`), turned so a way in the clip (its heading,
// degrees from +z, positive left) runs along a way in the world (a yaw, radians) (`anchor`).
//
// A station (`Station`, the stations file the stage's definition names, `assets/yard.json`) names a rig
// clip and what it is stood on: `on` and `at`, the row of that shapes3d kind standing at `at` [x, z], with,
// for a box, `side` (which of its four sides, as moves' `sidesOf` lists them: ahead, behind, right, left
// of the way it faces) and `along` (how far along that side, 0 to 1); or `at` [x, z], `yaw` and, in a
// pool, `water`, the height of its water over the ground there, on the ground; or `with`, the station of
// a partner. Where a body stands on the ground it stands on the land or a shape no more than a step over
// it (shapes3d's `ground`, for the walker kind the numbers' `body` names). By the shape and the clip's case (anim's `anim.touches.json`'s cases), the thing and the
// point:
//   box side, a ledge's (ledge-braced, ledge-free, ledge-pullup), a wall climbed or run along (wall-climb,
//            wall-run): the hands' grip (`things.grips`, the top of each hand) on the side's top edge,
//            `lip` metres under the top of whatever stands over that edge (gait's `topOf`: a ledge's
//            coping), the hands' middle on the wall's face: where the feet stand on it (`things.face`)
//            for a braced hang, else `edge` metres beyond the hands; the clip turned to face the wall. A
//            clip that grips nothing (a climb up, its palms on the top) sets its palms (`things.over`) on
//            the top; a wall run or climb its kicks (`things.face`) on the face at the ground. A clip that
//            starts standing on the ground stands on the ground there.
//   box side, gone over (vault): the hands' middle (`things.over`) on the middle of the box's top.
//   box side, a drop's edge (edge, step-down): the toes (the front of the balls on the floor it starts on)
//            on the side's top edge, the body facing out over it, the floor it starts on on the top.
//   box side, leant on (lean, cover): the back (`things.back`) on the side's face at the ground, the body
//            facing out from it.
//   box top (step-up): the soles on the raised floor the clip stands on (`floors`) on the box's middle.
//   box top (bed): the body's lowest floor (`floors`, where it lies) on the box's top, its middle there.
//   box top (stairs): the first raised floor's soles on the middle of the step's top.
//   box top, sat on (a car's seat): the seat (`things.seat`) on the middle of the box's top, facing the
//            way the box faces.
//   box, held (bar): the hands' middle (`plants` held `hold` by `handL`/`handR`, wrapped round it) on
//            its middle, the body facing the way the box faces.
//   box, swung from (rope-swing): the swing's pivot (`things.swing`) on the middle of the box's
//            underside, a beam.
//   chair:   the seat (`things.seat`) on the chair's seat, its definition's `height` over its `pos`,
//            facing the way the chair faces.
//   cylinder (rope): the hands' middle across the ground on its axis, standing on the ground.
//   pool:    the water's surface (`things.water`) on the station's `water`.
//   ground:  the clip's own floor on the ground at `at`, facing `yaw`.
//   with:    a partner's hold (`things.points`, the first right hand held) on the partner's, the bodies
//            facing each other, on the ground.
// `lip` and `edge` are read off the touches by the clip names the kind's numbers give (`touch.lip`, a
// clip that climbs up from a hang: its top less its grip; `touch.edge`, a braced hang: how far its feet
// stand on the wall beyond its hands, `things.face.under`).
//
// `stationsOf(from)` is the scene's stations, the json entry its `stage`'s definition names.
// `placeOf(w, me, k, station)` is the place the station's clip starts at. `pose(me, w, clip, place, t,
// laps)` stands the body `t` seconds into the clip begun there: the clip played by anim at rate 0, its
// playhead written; a loop carried on by its lap's progress (across the ground its steady progress, which
// anim pins the hips about; up, whole laps, since anim draws a lap's own climb) and back to its start
// every `laps` laps; a one-shot carried by its measured travel (anim's `at`) where anim carries it, and
// begun again `rest` seconds after it ends. `toWorld(place, q)` is where a point of the clip begun at
// `place` stands. `touchOf(from, k, clip)` is one clip's reading.
//
// A seat's body takes a station too (the player's `use`). `take(me, w, k)` starts the station whose
// clip starts nearest the body, within the numbers' `reach` across the ground, for a body on its feet in
// no move, on no ladder and playing no act, and is whether it did: the row's `station` the station's
// index, `place` where its clip starts, `clock` 0 (a partner's clip begun in step with its partner's
// mannequin), the body eased from where it stood onto the clip's start over `settle` seconds (`slip`),
// as moves' held moves are. `held(me, w, dt, k)` is one step of it, and false for a body at no station:
// the clip posed as a mannequin's is (`pose`); a one-shot ends at its end, a loop goes on until
// `letGo`. `letGo(me, w, k)` ends it: the body stands where the clip has it, on the ground there when
// the floor the clip ends on (its `things.end`, else its `floor`, else the floor it started on) is
// within a step of it, else in the air there, to fall. A station's mannequin stands out of sight under
// the ground while a body plays its station (`mannequin.sim.ts`).
import type { Row, W } from '#engine/engine.ts'
import type { Wire } from '#engine/browser.ts'
import { animKind, at, carries, clipOf, numbersOf, play, rigOf, stop } from '#plugins/anim/anim.sim.ts'
import { def, json } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { land, shapes, type Box, type Cylinder, type Placed } from '#plugins/shapes3d/shapes3d.sim.ts'
import { ground as shaped } from '#plugins/shapes3d/shapes3d.walker.ts'
import { numbers } from '#plugins/walker/walker.sim.ts'
import { topOf, underfoot } from '../gait/gait.sim.ts'
import { sidesOf, type Face, type Seat } from '../moves/moves.sim.ts'

const DEG = Math.PI / 180
// The playhead held this far short of a clip's end, since anim lets an act go at its end.
const SHORT = 1e-6
const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
// A point `f` metres along yaw θ's facing and `l` to its left, from (x, z).
const along = (x: number, z: number, yaw: number, f: number, l: number) =>
  [x + f * math.sin(yaw) + l * math.cos(yaw), z + f * math.cos(yaw) - l * math.sin(yaw)]
const yawOf = (x: number, z: number) => math.atan2(x, z)
const mean = (ps: number[][]) => ps[0].map((_, i) => ps.reduce((s, p) => s + p[i], 0) / ps.length)

export type Numbers = { touches: string; body: string; lip: string; edge: string; rest: number; laps: number }
// A seat's numbers for taking a station: touch's, how near its clip's start the body must be, and the
// seconds it is eased onto it over.
export type Taking = Numbers & { reach: number; settle: number }
export type Place = { x: number; y: number; z: number; yaw: number }
// A station: a clip stood on a thing (the header), and the loose things the mannequin's look draws
// where the clip touches them (`mannequin.client.ts`).
export type Station = {
  clip: string; on?: string; at?: number[]; side?: number; along?: number; yaw?: number; water?: number; with?: number
  props?: { is: string; from?: string; size?: number[] }[]
}

export const stationsOf = (from: W | Wire): Station[] => (json(from, def(from, 'stage').stations) as { stations: Station[] }).stations

// One clip's reading (`anim.touches.mjs`'s header), the parts of it a placement reads.
type Plant = { point: string; from: number; to: number; at: number[]; on: string }
export type Touch = {
  case: string; loop: boolean; dur: number; lap: number[] | null; floor: number | null
  plants: Plant[]
  floors: { y: number; from: number; to: number; by: string[] }[]
  things: {
    grips?: { hand: string; y: number; at: number[] }[]; lip?: number
    face?: { at: number[]; normal: number; under?: number }
    over?: { top: number; at: number[]; way: number }
    start?: number; end?: number; top?: number
    seat?: { y: number; at: number[]; facing: number }[]
    back?: { y: number; at: number[]; normal: number }[]
    swing?: { pivot?: number[]; radius?: number }
    water?: { surface: number }
    points?: { hand: string; at: number[]; from: number; to: number }[]
  }
}

export function touchOf(from: W | Wire, k: Numbers, clip: string): Touch {
  const c = json(from, k.touches) as { clips: Record<string, Touch & { mirror?: string }> }
  const got = c.clips[clip]
  if (!got) throw new Error(`touch: the touches ${k.touches} have no clip ${clip}`)
  if (got.mirror) throw new Error(`touch: ${clip} is a mirror of ${got.mirror}, which anim makes; stand ${got.mirror} instead`)
  return got
}

// Where a point of the clip begun at `p` stands.
export const toWorld = (p: Place, q: number[]) => {
  const [x, z] = along(p.x, p.z, p.yaw, q[2], q[0])
  return [x, p.y + q[1], z]
}

// The place that carries the clip's point `q` onto the world's point `at`, its heading `h` (degrees) on
// the world's yaw `yaw`.
export function anchor(q: number[], h: number, at: number[], yaw: number): Place {
  const turn = wrap(yaw - h * DEG)
  const [ox, oz] = along(0, 0, turn, q[2], q[0])
  return { x: at[0] - ox, y: at[1] - q[1], z: at[2] - oz, yaw: turn }
}

// The heading the hands face, square to the line from the right hand's grip to the left's.
function handsFace(grips: { hand: string; at: number[] }[]): number {
  const l = grips.find(g => g.hand === 'L'), r = grips.find(g => g.hand === 'R')
  if (!l || !r) return 0
  return math.atan2(-(l.at[1] - r.at[1]), l.at[0] - r.at[0]) / DEG
}

// The shape a station stands on: the row of its `on` kind standing at its `at`.
function shapeOf(w: W, s: Station): Placed {
  if (!s.at) throw new Error(`touch: the station of ${s.clip} stands on ${s.on} at no place`)
  const [x, z] = s.at
  const found = shapes(w).find(p => p.kind === s.on && Math.abs(p.shape[p.word].pos[0] - x) < 1e-3 && Math.abs(p.shape[p.word].pos[2] - z) < 1e-3)
  if (!found) throw new Error(`touch: the station of ${s.clip} stands on the ${s.on} at (${x}, ${z}), and no ${s.on} of shapes3d's stands there`)
  return found
}

// A side's point `along` of the way from its first end to its second, at height y.
const onSide = (f: Face, along: number, y: number) => [f.a[0] + (f.b[0] - f.a[0]) * along, y, f.a[1] + (f.b[1] - f.a[1]) * along]

// The holds a clip's hands wrap round a bar or a rope by, their middle.
const handHolds = (t: Touch) => t.plants.filter(p => (p.point === 'handL' || p.point === 'handR') && p.on === 'hold')

export function placeOf(w: W, me: Row, k: Numbers, s: Station): Place {
  const t = touchOf(w, k, s.clip)
  // The ground a body stands on at (x, z): the land, or a shape no more than a step over it, by the
  // step and height of the walker kind the numbers' `body` names.
  const body = (w.world.walker?.kinds ?? {})[k.body]
  if (!body) throw new Error(`touch: its numbers stand a ${k.body} body, which world.walker.kinds has not`)
  const ground = (x: number, z: number) => shaped(w, land(w)(w, x, z), body).height(x, z)
  // A partner's: its hold on the partner's, facing it.
  if (s.with !== undefined) {
    const other = stationsOf(w)[s.with]
    if (!other) throw new Error(`touch: the station of ${s.clip} stands with station ${s.with}, which the scene has not`)
    const p = placeOf(w, me, k, other)
    const mine = (t.things.points ?? []).find(h => h.hand === 'R')
    const theirs = (touchOf(w, k, other.clip).things.points ?? []).find(h => h.hand === 'R')
    if (!mine || !theirs) throw new Error(`touch: ${s.clip} and ${other.clip} hold no right hand to meet by`)
    const meet = toWorld(p, theirs.at)
    const out = anchor(mine.at, 0, meet, wrap(p.yaw + Math.PI))
    return { ...out, y: p.y }
  }
  // On the ground, or in a pool's water there.
  if (s.on === undefined) {
    if (!s.at) throw new Error(`touch: the station of ${s.clip} stands on no shape and at no place`)
    const [x, z] = s.at
    if (t.case === 'swim') {
      const surface = t.things.water?.surface
      if (surface === undefined) throw new Error(`touch: ${s.clip} swims in no water`)
      if (s.water === undefined) throw new Error(`touch: the station of ${s.clip} swims in no water: it gives no water`)
      return anchor([0, surface, 0], 0, [x, ground(x, z) + s.water, z], s.yaw ?? 0)
    }
    return { x, y: ground(x, z), z, yaw: s.yaw ?? 0 }
  }
  const placed = shapeOf(w, s)
  // A chair: the seat on its seat, facing the way it faces.
  if (s.on === 'chair') {
    const seat = t.things.seat?.[0]
    if (!seat) throw new Error(`touch: ${s.clip} sits on nothing`)
    const row = w.get(placed.id)
    const [x, y, z] = row.data.pos
    return anchor([seat.at[0], seat.y, seat.at[1]], seat.facing, [x, y + (def(w, 'chair') as Seat).height, z], row.data.yaw)
  }
  if (placed.word === 'cylinder') {
    // A rope: the hands' middle across the ground on its axis.
    const c = placed.shape.cylinder as Cylinder
    const holds = handHolds(t)
    if (!holds.length) throw new Error(`touch: ${s.clip} holds the ${s.on} with no hand`)
    const q = mean(holds.map(h => h.at))
    const out = anchor([q[0], 0, q[2]], 0, [c.pos[0], 0, c.pos[2]], 0)
    return { ...out, y: ground(out.x, out.z) }
  }
  if (placed.word !== 'box') throw new Error(`touch: a station stands on a ${placed.word}, which touch stands no clip on`)
  const b = placed.shape.box as Box
  const top = b.pos[1] + b.size[1]
  const middle = [b.pos[0], top, b.pos[2]]
  // Its top, for the cases that stand or sit on it.
  if (t.case === 'step-up') {
    const raised = t.floors.filter(l => l.y >= 0.15).sort((a, b) => b.to - b.from - (a.to - a.from))[0]
    if (!raised) throw new Error(`touch: ${s.clip} stands on no raised floor to stand on a box's top by`)
    const soles = t.plants.filter(p => p.point.startsWith('sole') && Math.abs(p.at[1] - raised.y) <= 0.03)
    const out = anchor(mean(soles.map(p => p.at)), 0, middle, b.yaw)
    return { ...out, y: ground(out.x, out.z) }
  }
  if (t.case === 'bed') {
    const low = Math.min(...t.floors.map(l => l.y))
    const body = mean(t.plants.filter(p => p.on === 'ground' || p.on === 'raised floor').map(p => p.at))
    return anchor([body[0], low, body[2]], 0, middle, b.yaw)
  }
  if (t.case === 'stairs') {
    const raised = t.plants.filter(p => p.point.startsWith('sole') && p.on === 'raised floor').sort((a, b) => a.from - b.from)[0]
    if (!raised) throw new Error(`touch: ${s.clip} stands on no step`)
    return anchor(raised.at, 0, middle, b.yaw)
  }
  if (t.things.seat?.length) {
    const seat = t.things.seat[0]
    return anchor([seat.at[0], seat.y, seat.at[1]], seat.facing, middle, b.yaw)
  }
  if (t.case === 'bar') {
    const holds = handHolds(t)
    if (!holds.length) throw new Error(`touch: ${s.clip} wraps its hands round nothing`)
    return anchor(mean(holds.map(h => h.at)), t.things.grips ? handsFace(t.things.grips) : 0, [b.pos[0], b.pos[1] + b.size[1] / 2, b.pos[2]], b.yaw)
  }
  if (t.case === 'rope-swing') {
    const pivot = t.things.swing?.pivot
    if (!pivot) throw new Error(`touch: ${s.clip} swings from no pivot`)
    return anchor(pivot, 0, [b.pos[0], b.pos[1], b.pos[2]], b.yaw)
  }
  // A side.
  const f = sidesOf(b)[s.side ?? 0]
  const into = yawOf(-f.out[0], -f.out[1])
  const u = s.along ?? 0.5
  const startsOnGround = (t.things.start ?? Infinity) < 0.15
  switch (t.case) {
    case 'vault': {
      const o = t.things.over
      if (!o) throw new Error(`touch: ${s.clip} sets its hands on no top`)
      const edge = onSide(f, u, f.top)
      const over = [edge[0] - f.out[0] * (f.deep / 2), edge[1], edge[2] - f.out[1] * (f.deep / 2)]
      const out = anchor([o.at[0], o.top, o.at[1]], o.way, over, into)
      return { ...out, y: ground(out.x, out.z) }
    }
    case 'edge':
    case 'step-down': {
      // The toes at the edge: the front of the balls held on the floor the clip starts on.
      const start = t.things.start
      if (start === undefined) throw new Error(`touch: ${s.clip} starts on no floor to stand at an edge by`)
      const balls = t.plants.filter(p => p.point.startsWith('ball') && Math.abs(p.at[1] - start) <= 0.05)
      if (!balls.length) throw new Error(`touch: ${s.clip} holds no ball on the floor it starts on`)
      const front = balls.reduce((a, b) => (b.at[2] > a.at[2] ? b : a))
      const q = [mean(balls.map(b => b.at))[0], start, front.at[2]]
      return anchor(q, 0, onSide(f, u, f.top), wrap(into + Math.PI))
    }
    case 'lean':
    case 'cover': {
      const back = t.things.back?.[0]
      if (!back) throw new Error(`touch: ${s.clip} rests its back on nothing`)
      const at0 = onSide(f, u, 0)
      const out = anchor([back.at[0], 0, back.at[1]], back.normal + 180, [at0[0], 0, at0[2]], into)
      return { ...out, y: ground(out.x, out.z) }
    }
    case 'wall-run':
    case 'wall-climb': {
      const face = t.things.face
      if (!face) throw new Error(`touch: ${s.clip} sets its feet on no wall`)
      const at0 = onSide(f, u, 0)
      const out = anchor([face.at[0], 0, face.at[1]], face.normal + 180, [at0[0], 0, at0[2]], into)
      return { ...out, y: ground(out.x, out.z) }
    }
    default: {
      // A ledge: the grip on its lip, under the top of whatever stands over its edge (its coping), the
      // hands' middle on its face.
      const edge = onSide(f, u, 0)
      const high = topOf(w, edge[0] - f.out[0] * 0.01, edge[2] - f.out[1] * 0.01)
      const grips = t.things.grips
      const lip = touchOf(w, k, k.lip).things
      const under = (lip.top ?? NaN) - (lip.lip ?? NaN)
      if (!Number.isFinite(under)) throw new Error(`touch: ${k.lip}, which says how far a grip stands under a ledge's top, climbs onto no top from a grip`)
      if (grips?.length) {
        const hands = mean(grips.map(g => [g.at[0], g.y, g.at[1]]))
        const face = t.things.face
        const h = face ? face.normal + 180 : handsFace(grips)
        const dir = [math.sin(h * DEG), math.cos(h * DEG)]
        const ahead = face
          ? (face.at[0] - hands[0]) * dir[0] + (face.at[1] - hands[2]) * dir[1]
          : (touchOf(w, k, k.edge).things.face?.under ?? NaN)
        if (!Number.isFinite(ahead)) throw new Error(`touch: ${k.edge}, which says how far a ledge's face stands beyond the hands, braces its feet on no wall`)
        const q = [hands[0] + dir[0] * ahead, hands[1], hands[2] + dir[1] * ahead]
        const out = anchor(q, h, onSide(f, u, high - under), into)
        return startsOnGround ? { ...out, y: ground(out.x, out.z) } : out
      }
      const o = t.things.over
      if (!o) throw new Error(`touch: ${s.clip} grips no lip and sets its hands on no top`)
      const face = t.things.face
      const h = face ? face.normal + 180 : o.way
      const dir = [math.sin(h * DEG), math.cos(h * DEG)]
      const ahead = face ? (face.at[0] - o.at[0]) * dir[0] + (face.at[1] - o.at[1]) * dir[1] : 0
      const q = [o.at[0] + dir[0] * ahead, o.top, o.at[1] + dir[1] * ahead]
      return anchor(q, h, onSide(f, u, high), into)
    }
  }
}

// The body `t` seconds into `clip` begun at `place` (the header).
export function pose(me: Row, w: W, k: Numbers, clip: string, place: Place, t: number) {
  const d = me.data
  const c = clipOf(rigOf(w, animKind(me)), clip)
  if (d.clip !== clip || d.state !== 'act') play(me, clip, { holds: true, rate: 0 })
  if (c.loop) {
    const laps = Math.floor(t / c.dur) % k.laps
    const into = t % c.dur
    const [f, l] = at(c.measure, c.dur)
    const lap = touchOf(w, k, clip).lap ?? [0, 0, 0]
    const share = laps + into / c.dur
    const [x, z] = along(place.x, place.z, place.yaw, f * c.scale * share, l * c.scale * share)
    d.pos = [x, place.y + lap[1] * laps, z]
    d.yaw = place.yaw
    d.clipT = Math.min(into, c.dur - SHORT)
  } else {
    const into = t % (c.dur + k.rest)
    const playhead = Math.min(into, c.dur - SHORT)
    const how = carries(c, numbersOf(w))
    const [f, l, turn] = how.carries ? at(c.measure, playhead) : [0, 0, 0]
    const [x, z] = along(place.x, place.z, place.yaw, f * c.scale, l * c.scale)
    d.pos = [x, place.y, z]
    d.yaw = wrap(place.yaw + (how.turns ? turn * DEG : 0))
    d.clipT = playhead
  }
  d.vel = [0, 0, 0]
  d.grounded = true
}

// ---------------------------------------------------------------- a seat at a station

const placeIn = (d: Record<string, any>): Place => ({ x: d.place[0], y: d.place[1], z: d.place[2], yaw: d.place[3] })

export function take(me: Row, w: W, k: Taking): boolean {
  const d = me.data
  if (!d.grounded || d.ladder || d.move || d.state === 'act' || d.station >= 0 || !w.all('stage').length) return false
  const [x, , z] = d.pos
  let best: { i: number; p: Place; far: number } | undefined
  stationsOf(w).forEach((s, i) => {
    const p = placeOf(w, me, k, s)
    const far = math.hypot(x - p.x, z - p.z)
    if (far <= k.reach && (!best || far < best.far)) best = { i, p, far }
  })
  if (!best) return false
  const { i, p } = best
  const s = stationsOf(w)[i]
  d.station = i
  d.place = [p.x, p.y, p.z, p.yaw]
  // A partner's clip begun in step with its partner's mannequin.
  const partner = s.with === undefined ? undefined : w.all('mannequin').find(m => m.data.station === s.with)
  d.clock = partner ? partner.data.clock : 0
  d.eased = [d.pos[0] - p.x, d.pos[1] - p.y, d.pos[2] - p.z, wrap(d.yaw - p.yaw)]
  d.want = [0, 0]
  play(me, s.clip, { holds: true, rate: 0 })
  return true
}

export function held(me: Row, w: W, dt: number, k: Taking): boolean {
  const d = me.data
  if (!(d.station >= 0)) return false
  const s = stationsOf(w)[d.station]
  const c = clipOf(rigOf(w, animKind(me)), s.clip)
  d.clock += dt
  // A one-shot ends at its end; a loop goes on until let go.
  if (!c.loop && d.clock >= c.dur) {
    pose(me, w, k, s.clip, placeIn(d), c.dur - SHORT)
    letGo(me, w, k)
    return true
  }
  pose(me, w, k, s.clip, placeIn(d), d.clock)
  const ease = Math.max(0, 1 - d.clock / k.settle)
  const [ex, ey, ez, eyaw] = d.eased
  d.pos = [d.pos[0] + ex * ease, d.pos[1] + ey * ease, d.pos[2] + ez * ease]
  d.yaw = wrap(d.yaw + eyaw * ease)
  d.want = [0, 0]
  return true
}

export function letGo(me: Row, w: W, k: Taking) {
  const d = me.data
  const s = stationsOf(w)[d.station]
  const t = touchOf(w, k, s.clip)
  const place = placeIn(d)
  const start = t.things.start ?? 0
  const feet = place.y + (t.things.end ?? t.floor ?? start)
  const [x, , z] = d.pos
  const g = underfoot(me, w, feet).height(x, z)
  const on = Math.abs(g - feet) <= numbers(me, w).step
  d.pos = [x, on ? g : feet, z]
  d.vel = [0, 0, 0]
  d.want = [0, 0]
  d.grounded = on
  d.sliding = false
  d.station = -1
  d.place = null
  stop(me, w)
}
