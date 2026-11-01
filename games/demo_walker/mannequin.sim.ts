// A body that plays one clip on a thing of the scene, over and over: an X Bot played by anim (its
// `world.anim.kinds.mannequin`), stood on the thing by what the clip touches (`plugins/touch`). Its row
// names its `station`, the index of one of the scene's stations (touch's `stationsOf`), which names the
// clip and the thing. Its own fields, beside anim's and the ones anim reads (`pos`, `yaw`, `vel`,
// `grounded`, `limp`): `place` [x, y, z, yaw], where its clip starts, worked out by touch once, before
// its first step; and `clock`, the seconds it has played.
//
// Each step its clock runs on, and touch's `pose` stands it that far into the clip from its place: a
// loop carried on by its lap's progress and back to its start every `laps` laps, a one-shot played to
// its end, held there `rest` seconds and begun again (its definition's `laps` and `rest`). Its
// definition (`assets/demo_walker.json`) holds touch's numbers. While a seat's body plays its station
// (a `player` row whose `station` is its own), it stands out of sight its definition's `away` metres
// under its place.
import type { Kind } from '#engine/engine.ts'
import { animate } from '#plugins/anim/anim.sim.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { placeOf, pose, stationsOf, type Numbers, type Place } from './plugins/touch/touch.sim.ts'

export const mannequin: Kind = {
  before(me, _dt, w) {
    const d = me.data
    if (d.place) return
    const s = stationsOf(w)[d.station]
    if (!s) throw new Error(`mannequin: the scene has no station ${d.station}`)
    const p = placeOf(w, me, def(w, me.kind) as Numbers, s)
    d.place = [p.x, p.y, p.z, p.yaw]
    d.clock = 0
  },
  tick(me, dt, w) {
    const d = me.data
    if (!d.place) return
    const s = stationsOf(w)[d.station]
    const [x, y, z, yaw] = d.place
    const place: Place = { x, y, z, yaw }
    d.clock += dt
    pose(me, w, def(w, me.kind) as Numbers, s.clip, place, d.clock)
    // A seat's body playing its station takes its place: it stands out of sight under the ground.
    if (w.all('player').some(p => p.data.station === d.station)) d.pos = [d.pos[0], d.pos[1] - def(w, me.kind).away, d.pos[2]]
    animate(me, w, dt)
  },
}
