// The kinds of shapes and the shapes.scene.json file next to this one: shapes3d's shapes standing on
// terrain3d's land, a checkerboard rolling a little, which the seat walks on. The seat's `player` row is
// `walking` (`player.sim.ts`), which walks on shapes3d's ground: the stairs of `step` boxes up onto the
// `deck`, a box raised over a body's head; the `ramp`, a tilted plane, up onto the `ledge`; the `pad`,
// a flat plane; the `block` to step onto and the `crate` to jump onto; round the `post`s; and the
// `lift`s, hyperplanes riding up and down (`lift.sim.ts`): one from the ground to the deck's top, one to
// the ledge's, and one up into the air and back. The other shapes' kinds have no rule: what each is, and
// how it looks, is its `world.shapes3d.kinds` entry.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { walking } from './player.sim.ts'
import { lift } from './lift.sim.ts'
import { start } from './start.sim.ts'
import file from './shapes.scene.json' with { type: 'json' }

export const sim: Sim = {
  scenemanager, loader, player: walking, start, lift,
  step: {}, deck: {}, ramp: {}, ledge: {}, pad: {}, block: {}, crate: {}, post: {},
}

export const scene = file as Scene
