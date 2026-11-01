// The kinds of the yard and the yard.scene.json file next to this one: a station for every kind of
// interaction the rig has a clip of (`assets/yard.json`, written by `assets/yard.mjs` from what the clips
// touch), each played over and over by a mannequin stood on its thing by `plugins/touch`, and the seat's
// body to walk among them. The things are shapes3d's shapes (`world.shapes3d.kinds`, which `yard.mjs`
// writes with their actors), drawn by solids and walked on as main's are, and a `chair`; the stage puts a
// mannequin on every station. None of the shapes' kinds has a rule.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { walker } from '#plugins/walker/walker.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { stage } from './stage.sim.ts'
import { mannequin } from './mannequin.sim.ts'
import file from './yard.scene.json' with { type: 'json' }

const shaped = Object.fromEntries(Object.keys(file.world.shapes3d.kinds).map(kind => [kind, {}]))

export const sim: Sim = { ...shaped, scenemanager, loader, walker, player, start, stage, mannequin, water: {} }

export const scene = file as Scene
