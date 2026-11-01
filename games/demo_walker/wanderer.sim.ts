// A bystander that strolls about the course between the scene's spots: an X Bot walked by walker as one
// of its agents, a crowd's body (its numbers `world.walker.kinds.wanderer`, its map's squares `agent`
// metres across), and played by anim (`world.anim.kinds.wanderer`), solid to
// the seats' bodies and theirs to it as each kind's `bodies` lists. It stands at `pos` [x, y, z] in its
// `actors` entry; its own fields, beside walker's and anim's: `spot`, the id of the `spot` row it
// heads for or rests at (0 before it has chosen one), and `wait`, the seconds it rests there yet.
//
// Each step, resting, it stands; otherwise walker's `seek` takes it toward its spot at the kind's
// `seekSpeed` over the land, round shapes3d's shapes (the scene's `world.walker.mods.fixed`) and the
// other bodies, and it strides (`plugins/gait`) on the ground those mods make. Within its
// definition's `stop` metres of the spot it rests for a time between the definition's `rest` [least,
// most] seconds, rolled on the scene's die, and then chooses, on the die, a spot no other wanderer
// holds; the spot a row has chosen is its `spot` field, so two never head for one.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { groundOf, seek } from '#plugins/walker/walker.sim.ts'
import { stride } from './plugins/gait/gait.sim.ts'

// A spot no other wanderer holds, chosen on the die, other than the one it is at.
function choose(me: Row, w: W): number {
  const held = new Set(w.all('wanderer').filter(o => o.id !== me.id).map(o => o.data.spot))
  const free = w.all('spot').filter(s => s.id !== me.data.spot && !held.has(s.id))
  if (!free.length) return me.data.spot
  return free[Math.floor(w.die() * free.length)].id
}

export const wanderer: Kind = {
  tick(me, dt, w) {
    const d = me.data
    const k = def(w, me.kind)
    if (!d.spot) d.spot = choose(me, w)
    if (d.wait > 0) {
      d.wait = Math.max(0, d.wait - dt)
      d.want = [0, 0]
      if (d.wait === 0) d.spot = choose(me, w)
    } else {
      const [x, z] = w.get(d.spot).data.pos
      if (seek(me, w, [x, z], k.stop, groundOf(w))) d.wait = k.rest[0] + w.die() * (k.rest[1] - k.rest[0])
    }
    d.face = null
    stride(me, w, dt)
  },
}
