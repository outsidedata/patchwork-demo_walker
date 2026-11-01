// gait: demo_walker's own plugin, one step of a body that walker walks and anim plays, which the
// `player` and `wanderer` kinds each call on their own row. It has no row and no page half.
//
// `underfoot(me, w, feet?)` is the ground a body of the row's walker numbers walks whose feet stand at y =
// `feet` (its own `pos` y when not given): shapes3d's ground (`plugins/shapes3d/shapes3d.walker.ts`'s
// `ground`), the top of the highest shape there no more than a step above the feet, else the land under
// the shapes (`world.shapes3d.mods.height`), every shape rising past that and starting below the head
// walked round; and under it the water the scene's `world.walker.mods.depth` names, where it names one.
//
// `topOf(w, x, z)` is the top of whatever stands over (x, z): the highest of shapes3d's shapes there, or
// the land where none does, however high over the feet (a ladder's top, a ledge's); `shapeTop(world, rows,
// x, z)` is the shapes' alone, each row of a kind `world.shapes3d.kinds` gives, or undefined where none
// stands: on the server a rule's rows, on the page the rows the wire was sent.
//
// `stride(me, w, dt, ground?)` walks the row by walker (`walk`, its `want`, `face` and `jump` as its rule
// set them) on `ground`, or on the ground the scene's `world.walker.mods` make (`groundOf`) when it is
// handed none, has anim play it from how it moved (`animate`), and carries the travel of a clip that
// carries one, a landing's step, by walker's `carry` and its turn on its `yaw`. It hands back the ground
// it walked on.
import type { Row, W } from '#engine/engine.ts'
import { mod } from '#addons/scenemanager/scenemanager.addon.ts'
import { animate } from '#plugins/anim/anim.sim.ts'
import { land, wordOf, type Kind } from '#plugins/shapes3d/shapes3d.sim.ts'
import { ground } from '#plugins/shapes3d/shapes3d.walker.ts'
import { carry, groundOf, numbers, walk, type Ground } from '#plugins/walker/walker.sim.ts'

const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))

export function underfoot(me: Row, w: W, feet: number = me.data.pos[1]): Ground {
  const on = ground(w, feet, numbers(me, w))
  const depth = mod<(w: W, x: number, z: number) => number>(w.world, 'walker', 'depth')
  return depth ? { ...on, depth: (x, z) => depth(w, x, z) } : on
}

export function shapeTop(world: Record<string, any>, rows: Row[], x: number, z: number): number | undefined {
  const kinds = (world.shapes3d?.kinds ?? {}) as Record<string, Kind>
  let best: number | undefined
  for (const r of rows) {
    const k = kinds[r.kind]
    if (!k) continue
    const { word, known } = wordOf(r.kind, k)
    const t = known.top(known.place(k.shape[word], r), x, z)
    if (t !== undefined && (best === undefined || t > best)) best = t
  }
  return best
}

export function topOf(w: W, x: number, z: number): number {
  const rows = Object.keys(w.world.shapes3d?.kinds ?? {}).flatMap(kind => w.all(kind))
  return Math.max(land(w)(w, x, z), shapeTop(w.world, rows, x, z) ?? -Infinity)
}

export function stride(me: Row, w: W, dt: number, ground: Ground = groundOf(w)): Ground {
  walk(me, w, dt, ground)
  const { travel } = animate(me, w, dt)
  if (travel.move[0] !== 0 || travel.move[1] !== 0) carry(me, w, travel.move, ground)
  if (travel.yaw !== 0) me.data.yaw = wrap(me.data.yaw + travel.yaw)
  return ground
}
