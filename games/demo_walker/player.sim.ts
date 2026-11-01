// The row one seat possesses, and the body it plays: an X Bot (`as: "xbot"`) that walks on walker
// (`plugins/walker`, its numbers `world.walker.kinds.xbot`) over shapes3d's shapes and the land under
// them (gait's `underfoot`, shapes3d's ground for its feet), is drawn and played by anim (its
// `world.anim.kinds.xbot`), climbs ladders on the game's own climber (`plugins/climber`) and makes the
// game's own moves (`plugins/moves`): crouching, sitting, cover, the vault, the wall run and the
// tricks. Every seat is sent every `player` row. Its own fields, beside walker's, anim's, climber's and
// moves': `stick` [x, z], the keys' way, right and forward; `fast`, the run key held; `look` `{ yaw,
// pitch, dist }`, chasecamera3d's orbit about it, `lift` metres over its feet; `turning` [x, y], how
// far a gamepad's right stick is pushed right and down; and `stood`, once it stands on its slot's
// start.
//
// `before` stands it once on the ground at its slot's `start`, on the land or the shape there no more
// than a step over it, facing the start's `yaw`, its look along it. Each step its look turns while `turning` is held, at the definition's `camera.turn` across
// and `tilt` up and down a second at full push, the yaw less for a push right and the pitch more for a
// push down, within `minPitch` and `maxPitch`. A station's clip is touch's (its `station`, `place` and
// `eased` fields), a climb is climber's and a held move is moves', and anim plays the clip they hold; a seated body that the stick pushes gets up. Otherwise it strides (`plugins/gait`) the way the
// stick points from the camera's yaw, facing the way it goes: in cover along the wall as moves' `hug`
// has it; standing still while an act plays (a trick, a landing, going down into a crouch); crouched at
// its definition's `moves.crouch.speed`; else at `walk` m/s or `run` with `fast` held. After it strides
// a hard landing rolls out (moves' `landed`), and a body on its feet, not crouched and in no move, takes
// hold of a ladder it pushes into (climber's `grab`).
//
// The acts are the page's keys: `stick(x, y)` (y down, as a stick reads), `turn(x, y)` (the right
// stick, the same), `fast(v)` (1 held, 0 let
// go), `jump` (a vault or a wall run where moves' `jump` finds one, else a jump), `use` (in a scene of
// stations, the yard, play the station whose clip starts nearest, within reach, or let go of the one it
// plays, touch's `take` and `letGo`; else sit, take cover, get up, leave cover), `crouch`, `roll`,
// `slide` and `flip` (moves' tricks), `look(dyaw,
// dpitch)` and `zoom(by)`, the wheel's pixels. A seat's message arrives from outside the program, so
// each refuses arguments of the wrong kind and writes nothing.
//
// `walking` is the seat's row in a scene of shapes3d's shapes on the land (`shapes.scene.json`), which
// holds no ladder or chair: it walks, runs and jumps on the same ground, so it steps up stairs of boxes,
// walks up tilted planes and stands on what it climbs onto, and makes no moves. `before` stands it on
// that ground at its slot's `start`; its view turns as the player's does; its acts are the player's
// `stick`, `turn`, `fast`, `look` and `zoom`, and `jump`, always a jump.
import type { Kind, Row, W } from '#engine/engine.ts'
import { animate } from '#plugins/anim/anim.sim.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { relative } from '#plugins/walker/walker.sim.ts'
import { land } from '#plugins/shapes3d/shapes3d.sim.ts'
import { climb, grab } from './plugins/climber/climber.sim.ts'
import { stride, underfoot } from './plugins/gait/gait.sim.ts'
import * as moves from './plugins/moves/moves.sim.ts'
import * as touch from './plugins/touch/touch.sim.ts'

const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const finite = (...v: unknown[]) => v.every(x => typeof x === 'number' && Number.isFinite(x))
const way = (v: unknown) => typeof v === 'number' && Math.abs(v) <= 1

// The view turns while the right stick is held, whatever the body does.
function view(me: Row, dt: number, k: any) {
  const d = me.data
  if (d.turning[0] === 0 && d.turning[1] === 0) return
  const c = k.camera
  d.look = { ...d.look, yaw: wrap(d.look.yaw - d.turning[0] * c.turn * dt), pitch: clamp(d.look.pitch + d.turning[1] * c.tilt * dt, c.minPitch, c.maxPitch) }
}

// The body stood once on the ground at its slot's start, facing the start's yaw, its look along it.
function stood(me: Row, w: W) {
  const d = me.data
  const start = w.find('start', s => s.data.slot === d.seat).data
  const [x, z] = start.pos
  d.pos = [x, underfoot(me, w, land(w)(w, x, z)).height(x, z), z]
  d.yaw = start.yaw
  d.look = { ...d.look, yaw: start.yaw }
  d.grounded = true
  d.stood = true
}

export const player: Kind = {
  before(me, _dt, w) {
    if (!me.data.stood) stood(me, w)
  },
  tick(me, dt, w) {
    const d = me.data
    if (!d.stood) return
    const k = def(w, me.kind)
    view(me, dt, k)
    if (d.move === 'seated' && (d.stick[0] !== 0 || d.stick[1] !== 0)) moves.use(me, w, k.moves)
    if (touch.held(me, w, dt, k.touch) || climb(me, w, dt) || moves.held(me, w, dt, k.moves)) {
      animate(me, w, dt)
      return
    }
    const [wx, wz] = relative(d.stick, d.look.yaw)
    d.face = null
    if (d.move === 'hug') d.want = moves.hug(me, w, [wx, wz], k.moves)
    else if (d.state === 'act') d.want = [0, 0]
    else {
      const speed = d.crouch ? k.moves.crouch.speed : d.fast ? k.run : k.walk
      d.want = [wx * speed, wz * speed]
    }
    stride(me, w, dt, underfoot(me, w))
    moves.landed(me, dt, k.moves)
    if (!d.crouch && !d.move) grab(me, w)
  },
  acts: {
    stick(me, _w, _seat, x: unknown, y: unknown) {
      if (way(x) && way(y)) me.data.stick = [x, 0 - (y as number)]
    },
    turn(me, _w, _seat, x: unknown, y: unknown) {
      if (way(x) && way(y)) me.data.turning = [x, y]
    },
    fast(me, _w, _seat, v: unknown) {
      if (v === 0 || v === 1) me.data.fast = v === 1
    },
    jump(me, w) {
      if (me.data.move || moves.jump(me, w, def(w, me.kind).moves)) return
      me.data.jump = true
    },
    use(me, w) {
      const k = def(w, me.kind)
      if (me.data.station >= 0) touch.letGo(me, w, k.touch)
      else if (!touch.take(me, w, k.touch)) moves.use(me, w, k.moves)
    },
    crouch(me, w) {
      moves.crouch(me, w, def(w, me.kind).moves)
    },
    roll(me, w) {
      moves.trick(me, def(w, me.kind).moves, 'roll')
    },
    slide(me, w) {
      moves.trick(me, def(w, me.kind).moves, 'slide')
    },
    flip(me, w) {
      moves.trick(me, def(w, me.kind).moves, 'flip')
    },
    look(me, w, _seat, dyaw: unknown, dpitch: unknown) {
      if (!finite(dyaw, dpitch)) return
      const c = def(w, me.kind).camera
      const l = me.data.look
      me.data.look = { ...l, yaw: wrap(l.yaw + (dyaw as number)), pitch: clamp(l.pitch + (dpitch as number), c.minPitch, c.maxPitch) }
    },
    zoom(me, w, _seat, by: unknown) {
      if (!finite(by)) return
      const c = def(w, me.kind).camera
      const l = me.data.look
      me.data.look = { ...l, dist: clamp(l.dist * math.exp((by as number) * c.zoom), c.minDist, c.maxDist) }
    },
  },
}

const { stick, turn, fast, look, zoom } = player.acts!

export const walking: Kind = {
  before(me, _dt, w) {
    if (!me.data.stood) stood(me, w)
  },
  tick(me, dt, w) {
    const d = me.data
    if (!d.stood) return
    const k = def(w, me.kind)
    view(me, dt, k)
    const [wx, wz] = relative(d.stick, d.look.yaw)
    const speed = d.fast ? k.run : k.walk
    d.face = null
    d.want = [wx * speed, wz * speed]
    stride(me, w, dt, underfoot(me, w))
  },
  acts: {
    stick, turn, fast, look, zoom,
    jump(me) {
      me.data.jump = true
    },
  },
}
