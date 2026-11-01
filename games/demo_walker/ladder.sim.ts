// A ladder against a wall: a `ladder` actor of the scene, its `pos` [x, y, z] the foot of the wall it
// stands against, on the ground, and its `yaw` the way out from that wall. The game's climber plugin
// (`plugins/climber`) is how a body climbs it, every number of it its definition's, and
// `ladder.client.ts` is how it looks. It has no rule.
import type { Kind } from '#engine/engine.ts'

export const ladder: Kind = {}
