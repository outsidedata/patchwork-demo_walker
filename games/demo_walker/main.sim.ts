// The kinds of main and the main.scene.json file next to this one. Every number of them that
// never changes is its definition in `assets/demo_walker.json`, which the scene's `world.defs` names.
// Where each seat's body starts is a `start` actor of the scene file, one per slot. walker's row keeps
// the ground for the truth and files the crowd the wanderers, walker's agents, walk among each step.
//
// The course is shapes3d's shapes on terrain3d's land (`world.shapes3d.kinds`, each kind a box, a tilted
// plane or a cylinder, and its rows in `actors`): the four flights of stairs, each step a box from the
// ground up to its tread; the five ramps, each a tilted plane up onto a box; the three blocks to climb;
// the block the ladder stands against; the tall wall to take cover at; the low wall to vault; and the
// platform to run up. solids draws each (`world.solids.mods.models`), the player walks on them (gait's
// `underfoot`) and the wanderers walk round them on the land (`world.walker.mods.fixed`). The `chair`s
// and `tree`s are shapes3d cylinders too, drawn by their own looks, and the `water` the pond's sheet.
// None of these kinds has a rule.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { walker } from '#plugins/walker/walker.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { ladder } from './ladder.sim.ts'
import { wanderer } from './wanderer.sim.ts'
import { spot } from './spot.sim.ts'
import file from './main.scene.json' with { type: 'json' }

const shaped = Object.fromEntries(Object.keys(file.world.shapes3d.kinds).map(kind => [kind, {}]))

export const sim: Sim = { ...shaped, scenemanager, loader, walker, player, start, ladder, wanderer, spot, water: {} }

export const scene = file as Scene
