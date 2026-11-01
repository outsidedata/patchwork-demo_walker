// The stage: puts a mannequin on every station of the scene (touch's `Station`, the stations file its
// definition's `stations` names, `assets/yard.json`), once, before its first step: one `mannequin` row
// spawned for each, its `station` the station's index. One `actors` entry of it makes it the scene's.
// Its own field: `staged`, true once it has.
import type { Kind } from '#engine/engine.ts'
import { stationsOf } from './plugins/touch/touch.sim.ts'

export const stage: Kind = {
  before(me, _dt, w) {
    if (me.data.staged) return
    stationsOf(w).forEach((_, station) => w.spawn('mannequin', { station }))
    me.data.staged = true
  },
}
