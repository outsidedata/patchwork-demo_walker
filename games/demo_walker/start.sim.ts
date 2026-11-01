// Where a seat's body starts: a `start` actor of the scene, one per slot, a row at its `pos` [x, z],
// facing its `yaw`, for the slot in `slot`, and nothing else. The `player` row stands on the ground at
// the start of its slot. It has no rule and is not drawn.
import type { Kind } from '#engine/engine.ts'

export const start: Kind = {}
