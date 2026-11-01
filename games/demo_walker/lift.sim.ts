// A lift: a shapes3d hyperplane (`world.shapes3d.kinds.lift`) drawn by solids, moved with shapes3d's
// `move` every step, up and down between the heights of its face `low` and `high`, its own fields, at its
// definition's `speed` metres a second, waiting `wait` seconds at each end, so a body steps on at one end
// and off at the other while the face is within its step; a `low` under the land sinks the face into
// it, and the land takes a body riding down (`shapes.scene.json`). Its changing fields:
// `going`, 1 up and -1 down, and `held`, the seconds it has still to wait where it stopped.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { move } from '#plugins/shapes3d/shapes3d.sim.ts'

export const lift: Kind = {
  tick(me, dt, w) {
    const d = me.data, k = def(w, me.kind)
    const [x, y, z] = d.pos as number[]
    if (d.held > 0) {
      d.held = Math.max(0, d.held - dt)
      move(w, me, [x, y, z], d.rot)
      return
    }
    const to = d.going > 0 ? d.high : d.low
    const next = d.going > 0 ? Math.min(to, y + k.speed * dt) : Math.max(to, y - k.speed * dt)
    if (next === to) {
      d.going = -d.going
      d.held = k.wait
    }
    move(w, me, [x, next, z], d.rot)
  },
}
