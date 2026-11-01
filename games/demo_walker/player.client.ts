// One seat's `player` row (`player.sim.ts`). Its body is anim's to draw, for every seat's row. For the
// seat's own row, the one that is `mine`, its keys, mouse and gamepad, and the camera. Every key is
// the player's definition's `keys`, each a list of the keys of the keyboard, the mouse and the gamepad
// that do it (the player plugin's names: `Pad0` a pad's bottom button, `PadStickLeft` its left stick
// pushed left), and each names the `player` row's act of the same name:
//   stick     the way to walk, left, right, forward and back: read analog, so a stick pushed part way
//             walks part speed
//   look      the right stick, read analog, sent as `turn` with how far it is pushed across and down:
//             the rule turns the view at the definition's `camera.turn` and `tilt` while it is held
//   fast      held to run; `jump`, `use`, `crouch`, `roll`, `slide`, `flip` each pressed
//   nearer, further   the camera in and out by `camera.step` of the wheel's pixels a press
// The mouse dragged with `drag` held sends `look` with its pixels times `sens`, right turning the view
// right and down tilting it down; the wheel sends `zoom` with the pixels it turned. chasecamera3d
// follows the row.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import type { Binds, Input } from '#plugins/player/player.plugin.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let ours = false

export function setup(row: Row, plugins: Plugins) {
  ours = row.data.mine === true
  if (!ours) return
  const k = def(plugins.wire, row.kind)
  const keys = k.keys
  // Each of a button's keys presses it.
  const press: Record<string, Input> = {}
  const button = (list: string[], input: Input) => { for (const key of list) press[key] = input }
  for (const act of ['jump', 'use', 'crouch', 'roll', 'slide', 'flip']) button(keys[act], [act])
  button(keys.nearer, ['zoom', -k.camera.step])
  button(keys.further, ['zoom', k.camera.step])
  // chasecamera3d looks along (sin yaw, cos yaw), so a larger yaw turns the view left: right on the
  // mouse is less yaw. A larger pitch lifts the camera over the row and looks down.
  plugins.player.bind({
    stick: [
      { keys: keys.stick, send: (x, y) => ['stick', x, y], analog: true },
      { keys: keys.look, send: (x, y) => ['turn', x, y], analog: true },
    ],
    hold: [{ keys: keys.fast, send: v => ['fast', v] }],
    press,
    drag: { key: keys.drag, send: (dx, dy) => ['look', -dx * k.sens, dy * k.sens] },
    wheel: dy => ['zoom', dy],
  } satisfies Binds)
  plugins.chasecamera3d.follow(row.id)
}

export function tick() {}

export function remove(plugins: Plugins) {
  if (ours) plugins.player.unbind()
}
