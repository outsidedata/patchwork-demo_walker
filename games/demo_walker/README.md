# demo_walker

Run, jump, climb and parkour your way around a checkerboard playground as an X Bot.

Climb the stairs and the ramps, wade into the pond, slide off the steep hill, weave through the
trees and dodge the other walkers strolling about. Climb the ladder onto the big block and jump
off. In the yard, sit on a chair, hide behind a wall and sneak along it, vault the low wall, run up
the platform, and roll, slide and flip.

## The course and the yard

Everything you walk on, climb, hang from or hide behind is shapes3d's (`plugins/shapes3d`): boxes,
tilted planes and cylinders, each kind in the scene's `world.shapes3d.kinds` and each one an actor,
drawn by solids. Main's course is written by hand in `main.scene.json`; the yard's is written by
`assets/yard.mjs`, every thing sized to the clip that uses it, with the stations that stand a mannequin
on each in `assets/yard.json` (`/games/demo_walker/dev.html?scene=yard`). Chairs, trees and the water
are kinds of the game's own with their own looks.

Walk up to any station in the yard and press E (X on a gamepad): your body takes the mannequin's place
and plays the same clip on the same thing, its hands and feet landing where the mannequin's do
(`plugins/touch`'s `take`). A one-shot (a climb, a vault, a drop) plays to its end and leaves you on
your feet, or falling where it ends in the air; a hold (a hang, a seat, swimming) lasts until you
press E again.

## How the yard's moves work

Five pieces, each feeding the next. To improve a move, find which piece it is in.

1. **What the clip touches** (`assets/xbot.touches.json`). The bake measures the X Bot's skin on every
   frame of every rig clip in Blender (anim's `plugins/anim/anim.touches.py`) and reads where it touches things
   (anim's touch reader, `plugins/anim/anim.touches.mjs`): where the hands grip a ledge, where the feet kick a wall, the seat's
   height, the floor it ends on, and so on, all in the clip's own space (x the body's left, y up, z
   ahead, the clip's floor at y = 0). Every number below comes from here.
2. **The thing, sized to the clip** (`assets/yard.mjs`, run by the bake). For each station it builds
   the shapes3d boxes and cylinders the clip needs, at the sizes the clip measured (a ledge's height
   from where the grip is, a chair at the seat's height, a car's seat block where the driver sits),
   writes them into `yard.scene.json`, and writes the station into `assets/yard.json`: `{ clip, on,
   at, side, along }` (the shape and which side of it), or `{ clip, at, yaw, water }` on the ground,
   or `{ clip, with }` beside a partner.
3. **Where the clip starts** (`plugins/touch`, `placeOf`). Anim plays a clip rigidly: every point of
   it is where the root started plus the clip's own offset, turned by the root's facing. So one start
   place and one facing put the clip anywhere. `placeOf` picks the point the clip touches (the grip,
   the kick, the seat, the soles) and the point of the shape it should land on, and works out the
   start that carries one onto the other (`anchor`). Each case has its own rule; the header of
   `touch.sim.ts` lists them.
4. **Playing it** (`touch.sim.ts`, `pose`). The clip is played by anim at rate 0 and its playhead
   written each step (`clipT`). A one-shot is carried along its measured travel (anim's `at`); a loop
   is carried by its lap's steady progress and stepped back to its start every `laps` laps.
5. **The player taking it** (`touch.sim.ts`, `take`, `held`, `letGo`; called from `player.sim.ts`).
   E runs the player's `use` act: `take` finds the station whose start is nearest the body, within the
   player's `touch.reach` (1.5 m, `assets/demo_walker.json`), on a body on its feet and in no other
   move. It writes `station`, `place` and `clock` onto the player row, and `eased`, how far the body
   stood from the start, which `held` eases away over `touch.settle` seconds (0.35 s), position
   and facing, height included. Each step `held` poses the body exactly as a mannequin is posed, and
   walker is not asked to walk it. A one-shot ends at its end; a loop ends at the next E. `letGo`
   stands the body where the clip left it: on the ground if the floor the clip ends on (its
   `things.end`, else `floor`, else the floor it started on) is within a step of the ground there,
   else at that height in the air, where walker drops it and it lands. While the player has a
   station, that station's mannequin stands 50 m under the ground (`mannequin.away`) so there is one
   body, not two. A partner clip (the handshake) starts its clock at the partner mannequin's, so the
   two stay in step.

`plugins/touch/touch.sim.test.ts` walks a seat up to all 46 stations, presses use, plays each and
checks it ends up on its feet.

### What is not right yet

These are what I know is rough, from how the code works; each is a place to start.

- **The snap.** Pressing E within 1.5 m slides the body onto the clip's start over 0.35 s, through
  anything in the way, including up into the air for a hang. Nothing walks you to the start, and
  nothing checks you can reach it from where you are.
- **No control while holding.** A hang, a bar, a rope, a seat just loop. The stick does nothing: no
  shimmying a ledge by pushing left, no climbing up from a hang by pushing up, no letting go by
  pushing away. The yard has the clips for each (`bracedleft`, `bracedclimb`, `braceddrop`, ...), but
  each is its own station; nothing chains one into the next.
- **Nothing collides during a clip.** While `held` has the body, walker doesn't walk it, so the clip
  goes wherever its travel goes, through walls and other bodies.
- **The end of a clip.** The body stands where the clip's root ends, at the floor the reading says.
  Where the reading has the floor wrong, the body pops up or down onto the ground, or falls from where
  the clip left it.
- **Loops that travel** (a shimmy, the bar, the crawl, swimming) are posed as the mannequin is: carried
  along their lap's progress and jumped back to the start every 3 laps. For a player that jump is a
  teleport.
- **The props.** Tables, panels, crates, the ball, the door, the wheel, the rope swing's platform and
  rope, and the pool water are the mannequin's looks (`mannequin.client.ts`), not shapes3d: the player
  walks through them, and a carried crate is drawn with the mannequin, not with the player.
- **Moves only at stations.** E only does a station. A ledge or wall anywhere else is not a station,
  so nothing happens there. Moving that to "any box of the right height" means `take` looking for
  shapes the way moves' `jump` looks for walls, instead of reading `yard.json`.
- **Not looked at in Chrome.** All 46 pass the node test. In Chrome, only the first braced hang was
  played with a real E press and looked at.

## Writing your own walker plugin

The point of this demo: walker handles walking, running, jumping, falling, steps, slopes, water and
bumping into things, and you add any other move as a plugin of your own game, without touching
walker. The ladder (`plugins/climber`) and the yard's moves (`plugins/moves`) are written that way.
Copy either one to start.

A walker plugin is a folder `plugins/<name>/` in your game holding `<name>.sim.ts`, a file of plain
functions your player's rule calls on its own row. Every step the rule asks your plugin first whether
it has the body this step; if it does, your plugin moves the body and walker leaves it alone; if not,
walker walks it as usual, and then your plugin gets a chance to start its move:

```ts
// player.sim.ts, each step
if (climb(me, w, dt) || moves.held(me, w, dt, k.moves)) {
  animate(me, w, dt)                  // a plugin has the body: anim just plays the clip it chose
  return
}
// ...the stick's way into d.want, as usual...
const ground = stride(me, w, dt)      // walker walks it, anim plays the walk
if (!d.crouch && !d.move) grab(me, w, ground)   // the ladder decides whether to take over
```

Inside your plugin, while it has the body:

1. **Play a clip held still and drive it yourself.** `play(me, 'mount', { holds: true, rate: 0 })`
   from anim, then write `me.data.clipT` every step, so the clip goes exactly as far as you say:
   forward, backward, or stopped where the stick stops.
2. **Move the body along the clip's own path.** anim's `at(clip.measure, t)` gives how far the clip
   has carried the hips forward and sideways, and how far it has turned, at time `t`. Put
   `me.data.pos` and `me.data.yaw` there, and the feet stay planted.
3. **Hand it back to walker** when the move ends: stand the body on the ground (`stand` from
   walker), set `grounded`, and call anim's `stop`. The next step walker has it again.

What your move needs to remember goes in fields on the player's row, and every number it uses goes in
the player's definition in `assets/demo_walker.json`, so it can be tuned. A new clip is a line in
`assets/xbot.rig.json` and a `yarn bake demo_walker`. A new key is a line in `player.client.ts`, and
an act of the same name in `player.sim.ts` that calls your plugin.

## Crowds: the wanderers

You walk as walker's whole body, every footstep worked out. The wanderers strolling about the course
walk as walker's **agents**, the cheap body walker gives a crowd, so a game can send dozens or hundreds
of them. Three things in this game make that happen, and a game of your own does the same:

1. **Walker's row.** `main.scene.json` has `"walker": {}` in `prefabs` and `{ "is": "walker" }` in
   `actors`, and `main.sim.ts` lists `walker` (from `#plugins/walker/walker.sim.ts`). At the start of
   every step it keeps the ground and notes where every body stands, so the wanderers push each other
   apart in whatever order they move.
2. **The course handed over as `fixed`.** The course is shapes3d's shapes (boxes, ramps, the chairs'
   and trees' cylinders) that never move, so shapes3d hands them to walker as `fixed`
   (`plugins/shapes3d/shapes3d.walker.ts`, and `"fixed": "shapes3d"` in `world.walker.mods`). Walker
   asks for them once for each patch of ground a wanderer reaches, and never again. Something that does
   move would go in `solids` instead, asked every step.
3. **`agent` on the wanderer.** The wanderer's entry in `world.walker.kinds` has `"agent": 0.25`: walker
   makes a map of the course in 0.25 m squares, each one standable for a wanderer or not and at what
   height, and walks the wanderers on it. Their rule (`wanderer.sim.ts`) is the same as before: `seek`
   toward a spot and `stride`.

An agent walks the land round every shape, keeps out of deep water and slides round the trees as you
do, but it never climbs onto a shape, jumps or falls, and its feet are only as exact as its squares.
You walk on the shapes themselves: your rule hands walker shapes3d's `ground` for your feet each step
(gait's `underfoot`), so you step up stairs of boxes, walk up the tilted planes of the ramps and stand
on whatever you climb onto. More wanderers are more
`{ "is": "wanderer" }` lines in `actors`, and more spots for them to walk between.

## Controls

| Keyboard | Gamepad | Does |
|---|---|---|
| W A S D or the arrows | left stick | walk |
| Shift | RT or L3 | run |
| Space | A | jump; running at a low wall vaults it, at a high one runs up it |
| E | X | sit on a chair, take cover at a wall, get up, leave cover; in the yard, do the move of the station you stand at, and let go of a hang |
| C | B | crouch and creep |
| Q | LB | dodge roll |
| X | RB | slide, while running |
| F | Y | front flip while running, backflip standing still |
| right mouse drag | right stick | look around |
| mouse wheel | d-pad up and down | zoom |

Walk into the ladder to climb it; W and S climb, Space leaps off, and walking out over its top climbs
back down. Behind a wall, A and D sneak along it.

## Playing it

From the root of core, `yarn vite`, then open `/games/demo_walker/index.html`.
`/games/demo_walker/dev.html` is the same game with a panel for tuning how the body moves.

Against its server: `node --experimental-strip-types games/demo_walker/demo_walker.server.ts`, then
`/games/demo_walker/client.html`.

## Remaking the art

`yarn bake demo_walker` draws the checkerboard and bakes the X Bot with all its animations, from the
library's `characters/xbot` and the clips in `~/troupe-collection`.

## Clip offsets

Many Mixamo clips are a little off: the crouches sink the feet up to 7 cm into the floor, sitting and
cover 3 to 5 cm, and a few float them a centimetre or two over it. The clips themselves are never
changed. Instead each clip can have a sidecar, a JSON file beside its FBX with the same name
(`Crouch Idle.json` beside `Crouch Idle.fbx`), and anim's bake lays the sidecar's offset onto the
clip as it writes it into `xbot.glb`. The crouch idle's begins:

```json
{ "offset": { "position": [[0, 0, 0.056, 0], [0.033, 0, 0.056, 0], [0.067, 0, 0.055, 0], ...] } }
```

and an offset may also give a `rotation`, `[[0, 90]]` turning the clip a quarter left.

`position` is rows of `[t, x, y, z]`, `rotation` rows of `[t, degrees]`: seconds into the clip, metres
with x the body's left, y up and z ahead, and a turn about the vertical, positive left. Each is
sampled straight between its rows, and one row holds for the whole clip. The whole body is turned and
moved by it. A clip with no sidecar bakes exactly as it is.

The sidecars are written by the bake itself, before the clips are baked, with the same measuring and
reading the whole library's touch catalogue is made by (What every clip touches, below):

1. anim's `plugins/anim/anim.touches.py` (in Blender) measures where the X Bot's skin is on every frame of every clip of
   the rig as its FBX has it: the soles, the balls and heels of the feet, the hands, the forearms, the
   knees, the seat, the torso and the head, the joints, the hips' own turn, and for the sitting clips
   the whole body's skin furthest behind at every height.
2. `assets/xbot.touches.mjs` reads each clip with anim's touch reader, `plugins/anim/anim.touches.mjs`, and writes
   `assets/xbot.touches.json`: what each clip stands on and holds (the floor, rungs, a seat, a wall, a
   top it vaults), as the rig plays it. For each clip whose planted feet, knees, seat or back sink into
   the floor or float over it, it writes the lift that stands them on it into the clip's sidecar, frame
   by frame. Each cover clip (going in and out, the idles and the sneaks, low and standing) it turns
   with a `rotation`: the Action Adventure pack made them facing up to 176° off their own forward, and
   anim takes a clip's forward as the way the body faces. Going in or out is turned so the body faces
   forward as it starts, an idle so it faces forward, a sneak so it travels the way its gear says. In
   cover the body stands with its back to the wall, facing out (`moves.cover.faces`), and the sneaks
   are filed by the way they travel turned (`right cover sneak.fbx` is `coverright`).
3. anim's export bakes the clips with their sidecars laid on.

`xbot.touches.json` also lists, under each clip's `doubts`, what the reading could not settle.

What the body uses is built to its clips from `xbot.touches.json`, and each clip is placed so its feet
and hands land on it:

- **The ladder**: its rungs stand where the climbing clip puts the balls of the feet, 0.25 m apart, its
  rails 0.76 m apart where the top clip grips them, its rungs 0.28 m off the wall so the body fits
  beside it where the step-on clip starts, and its block's top 2.983 m up, where the top clip sets its
  feet down.
- **The chairs**: their seats 0.437 m high, where the seated clip sits, and under it; their backs 0.222 m
  behind the sitter's hips, where the body reaches back furthest sitting down, seated and getting up
  (`xbot.touches.json`'s `things.behind` for each sitting clip, the skin furthest behind at every
  height), so no clip passes through the back.
- **The low wall**: 0.808 m high, where the vault sets its hands, its middle under them, and thin enough
  for the feet to keep over it.
- **The platform**: 2.266 m high, the top the wall run ends on; the run starts where its kick lands on
  the platform's face.

Each of them refuses one that does not fit its clips, naming the size that does: a ladder when it is
climbed, a chair when it is sat on. A wall of the wrong height is just not vaulted or run up.

## What every clip touches

The same measuring reads the whole Mixamo library in `~/troupe-collection/packs`, all 3,977 clips, so a
game choosing clips for a move can see what each one touches before baking it:

- `node games/demo_walker/assets/touches.mjs [<processes>]` measures every clip's skin in Blender, 4 at
  once unless told, into `~/troupe-collection/packs/mixamo-skin/`, again only for clips that changed.
- `node plugins/anim/anim.touches.mjs [<pattern>]` reads them into
  `~/troupe-collection/packs/mixamo-touches.json`, or, given a pattern, prints the clips it matches.
- `node games/demo_walker/assets/touches.page.mjs <out.html>` writes the catalogue: one page of every
  clip under its case, searchable.

anim's `plugins/anim/anim.touches.json` is the taxonomy the reader reads by. Its `things` are what a game puts in the
world (a ledge, a bar, a rope, a ladder, a wall, a seat, a table, a door, a vehicle, a ball, water,
another body), each with the sizes the reader measures. Its `cases` are the kinds of interaction the
library's clips make (hanging from a ledge braced or free, a rope swing, a wall run, a vault, sitting at
a table, opening a door, kicking a ball, getting into a car, ...), each with the Mixamo words that pick
its clips out and the things it needs. The headers of `anim.touches.py` and `anim.touches.mjs` say what each
measure and each read is.

## Credit

The X Bot and its animations are from Adobe Mixamo (mixamo.com).
