// Writes the yard: a station for every kind of interaction the game's rig has a clip of, each the thing
// to stand the clip on, as shapes3d's shapes in the yard's scene (`yard.scene.json`'s
// `world.shapes3d.kinds`, a prefab and an actor each), and the stations that name them, `yard.json` beside
// this, laid out in a grid of cells `CELL` metres apart on the plane y = `Y`. The game's bake runs it
// after the rig's clips are read (`demo_walker.bake.ts`):
//   node games/demo_walker/assets/yard.mjs
// It writes the scene's shapes3d kinds, their prefabs and their actors anew, and leaves every other line
// of the scene as it was.
//
// Each thing is sized to its clip from what the clip touches (`xbot.touches.json`): a ledge a clip climbs
// onto from the ground stands as high as the lip its hands grip (`things.lip`) and the height a grip
// stands under a ledge's top (the mannequin's `lip` clip, its top less its grip); a box it starts or ends
// standing on, the floor it starts or ends on; a car's seat, the seat it sits at; a step's rise and tread,
// the steps it climbs. A thing a clip touches only with its hands (a hang, a bar, a rope, a pool's water)
// stands at one height for all, the clip placed to it: `HANG` metres for a ledge's top and a bar, and
// the rope's and the pool's below. Chairs are the game's one `chair`, its seat where the seated clip
// sits.
//
// The things, each one or more of shapes3d's boxes and cylinders (`plugins/shapes3d`), every kind named
// for its thing and its size:
//   ledge     a wall `top` less `COPING` high under a coping `COPING` thick that stands `LIP` out over
//             each of its sides: the lip a braced hang grips, its feet on the wall `LIP` behind its hands
//             (the mannequin's `edge` clip's `things.face.under`)
//   wall      a box from the ground to its top
//   stairs    a box for each step, from the ground to its tread, and the landing
//   bar       a box 2·radius square across at its height, on a post at each end
//   rope      a cylinder from the ground to its top under a beam on two posts; a swing's beam and posts
//             alone, its rope the mannequin's look
//   pool      four walls round it, its water the mannequin's look
//   car       its hood and boot to the door line, a floor, the far door, the roof on four pillars and the
//             driver's seat, each a box in the car's frame
// A station is `{ clip, on, at, side?, along? }` (the kind of the shape the clip stands on, the [x, z]
// its row stands at, and for a box, which of its sides, as moves' `faces` lists them, and how far along
// it), `{ clip, at, yaw, water? }` on the ground (`water` the height of a pool's water over it), or
// `{ clip, with }` beside its partner, and `props`, the loose things the mannequin's look draws where the
// clip touches them (`mannequin.client.ts`).
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const here = import.meta.dirname
const touches = JSON.parse(readFileSync(path.join(here, 'xbot.touches.json'), 'utf8')).clips
const defs = JSON.parse(readFileSync(path.join(here, 'demo_walker.json'), 'utf8'))
const k = defs.mannequin
const sceneFile = path.join(here, '..', 'yard.scene.json')

// The cells' spacing, metres; the plane the yard stands on; the height every ledge's top and bar a hang
// touches only with its hands stands at; and how thick a ledge's coping is.
const CELL = 7
const Y = 0.3
const HANG = 2.6
const COPING = 0.12
const round = v => Math.round(v * 1000) / 1000
const t = name => {
  const c = touches[name]
  if (!c || c.mirror) throw new Error(`yard.mjs: the rig has no clip ${name} of its own`)
  return c
}
// How far a grip stands under a ledge's top.
const under = t(k.lip).things.top - t(k.lip).things.lip
// A ledge a clip climbs onto from the ground stands so its lip is where its hands grip.
const lipped = name => round(t(name).things.lip + under)
const LIP = round(t(k.edge).things.face.under)

const kinds = {}
const actors = []
const stations = []
// A kind of shapes3d's of the shape and colour, once; a second of the name with other numbers throws.
const kind = (name, shape, colour, look = {}) => {
  const k = { shape, look: { colour, roughness: 0.8, ...look } }
  if (kinds[name] && JSON.stringify(kinds[name]) !== JSON.stringify(k)) throw new Error(`yard.mjs: two kinds named ${name}`)
  kinds[name] = k
  return name
}
// A box of the kind `name`, `size` [across, tall, along], its foot's middle at (x, y, z) turned by yaw.
const box = (name, size, colour, x, y, z, yaw = 0) => {
  kind(name, { box: { size: size.map(round) } }, colour)
  actors.push({ is: name, pos: [round(x), round(y), round(z)], ...(yaw ? { yaw } : {}) })
  return { on: name, at: [round(x), round(z)] }
}
const cylinder = (name, radius, height, colour, x, y, z) => {
  kind(name, { cylinder: { radius, height: round(height) } }, colour, { sides: 8 })
  actors.push({ is: name, pos: [round(x), round(y), round(z)] })
  return { on: name, at: [round(x), round(z)] }
}

// A ledge `top` high and `width` across whose face stands on z, facing −z: the wall under its coping, and
// the station's shape, its wall.
const ledge = (x, z, top, width = 4) => {
  const name = `ledge${width}-${round(top)}`
  const zc = z + 0.6 + LIP
  box(`coping${width}-${round(top)}`, [width + 2 * LIP, COPING, 1.2 + 2 * LIP], '#b8916c', x, Y + top - COPING, zc)
  return box(name, [width, top - COPING, 1.2], '#c9a27e', x, Y, zc)
}
const wall = (name, x, z, top, width = 4, deep = 1.2, colour = '#c9a27e') => box(name, [width, top, deep], colour, x, Y, z + deep / 2)
// A car facing `yaw`, `size` [across, along], its roof `top` high and its driver's hips at `seat` [left,
// ahead, up] in its frame: its parts, and the station's shape, the driver's seat.
const car = (name, x, z, yaw, size, top, seat, colour) => {
  const [w, l] = size, line = seat[2] + 0.15
  const hood = l * 0.3, boot = l * 0.2, cabin = l - hood - boot
  const s = Math.sin(yaw), c = Math.cos(yaw)
  // A part `dims` [across, tall, along] at (left, up, ahead) in the car's frame.
  const part = (p, dims, left, up, ahead) => box(`${name}-${p}`, dims, colour, x + ahead * s + left * c, Y + up, z + ahead * c - left * s, yaw)
  part('hood', [w, line, hood], 0, 0, l / 2 - hood / 2)
  part('boot', [w, line, boot], 0, 0, -l / 2 + boot / 2)
  part('floor', [w, 0.2, cabin], 0, 0, l / 2 - hood - cabin / 2)
  part('door', [0.06, line, cabin], -w / 2 + 0.03, 0, l / 2 - hood - cabin / 2)
  part('roof', [w, 0.08, l * 0.5], 0, top - 0.08, seat[1] - 0.1)
  for (const ahead of [seat[1] - 0.1 - l * 0.25, seat[1] - 0.1 + l * 0.25]) for (const side of [-1, 1]) part('pillar', [0.08, top - line, 0.08], (side * (w - 0.08)) / 2, line, ahead)
  return part('seat', [0.5, 0.12, 0.5], seat[0], seat[2] - 0.12, seat[1])
}
// A pool `size` [across, along] round (x, z): its four walls `wall` high and `thick` thick.
const pool = (name, x, z, size, high, thick) => {
  const [w, l] = size
  box(`${name}-end`, [w, high, thick], '#d8d8d0', x, Y, z + l / 2 - thick / 2)
  box(`${name}-end`, [w, high, thick], '#d8d8d0', x, Y, z - l / 2 + thick / 2)
  box(`${name}-side`, [thick, high, l - 2 * thick], '#d8d8d0', x + w / 2 - thick / 2, Y, z)
  box(`${name}-side`, [thick, high, l - 2 * thick], '#d8d8d0', x - w / 2 + thick / 2, Y, z)
}
// A beam `top` high on two posts 1.2 m apart across x, its underside on `top`.
const beam = (name, x, z, top) => {
  box(`${name}-post`, [0.12, top + 0.12, 0.12], '#b08a5a', x - 0.6, Y, z)
  box(`${name}-post`, [0.12, top + 0.12, 0.12], '#b08a5a', x + 0.6, Y, z)
  return box(`${name}-beam`, [1.2, 0.12, 0.12], '#b08a5a', x, Y + top, z)
}
const hang = { side: 1, along: 0.5 }

// The cells, row by row: what each stands on and how big it is.
const cells = [
  // hanging from a ledge, braced and free: one height for every hang, its own for a drop, a jump up and
  // a pull up from the ground
  (x, z) => stations.push({ clip: 'bracedidle', ...ledge(x, z, HANG), ...hang }),
  (x, z) => stations.push({ clip: 'bracedleft', ...ledge(x, z, HANG, 5), side: 1, along: 0.2 }),
  (x, z) => stations.push({ clip: 'bracedright', ...ledge(x, z, HANG, 5), side: 1, along: 0.8 }),
  (x, z) => stations.push({ clip: 'bracedclimb', ...ledge(x, z, HANG), ...hang }),
  (x, z) => stations.push({ clip: 'braceddrop', ...ledge(x, z, lipped('braceddrop')), ...hang }),
  (x, z) => stations.push({ clip: 'bracedjump', ...ledge(x, z, lipped('bracedjump')), ...hang }),
  (x, z) => stations.push({ clip: 'freeidle', ...ledge(x, z, HANG), ...hang }),
  (x, z) => stations.push({ clip: 'freeleft', ...ledge(x, z, HANG, 5), side: 1, along: 0.2 }),
  (x, z) => stations.push({ clip: 'freeright', ...ledge(x, z, HANG, 5), side: 1, along: 0.8 }),
  (x, z) => stations.push({ clip: 'freeclimb', ...ledge(x, z, HANG), ...hang }),
  (x, z) => stations.push({ clip: 'freedrop', ...ledge(x, z, lipped('freedrop')), ...hang }),
  (x, z) => stations.push({ clip: 'freejump', ...ledge(x, z, lipped('freejump')), ...hang }),
  (x, z) => stations.push({ clip: 'pullup', ...ledge(x, z, lipped('pullup')), ...hang }),
  // walls climbed, run along, vaulted, leant on, and the edge of a drop
  (x, z) => stations.push({ clip: 'wallclimb', ...wall('climbwall', x, z, 5, 3), ...hang }),
  (x, z) => stations.push({ clip: 'wallside', ...wall('runwall', x + 1, z + 2, 3.5, 8, 0.6), side: 1, along: 0.3 }),
  (x, z) => stations.push({ clip: 'vaultone', ...wall('vaultwall', x, z + 2, t('vaultone').things.over.top, 2.5, 0.4, '#60c0c0'), ...hang }),
  (x, z) => stations.push({ clip: 'lean', ...wall('leanwall', x, z, 2, 3, 0.4), ...hang }),
  (x, z) => stations.push({ clip: 'teeter', ...wall(`edge-${round(t('teeter').things.start)}`, x, z - 1.5, t('teeter').things.start, 3, 2, '#d0b070'), ...hang }),
  (x, z) => stations.push({ clip: 'jumpdown', ...wall(`edge-${round(t('jumpdown').things.start)}`, x, z - 1.5, t('jumpdown').things.start, 3, 2, '#d0b070'), ...hang }),
  (x, z) => {
    const raised = t('boxjump').floors.filter(l => l.y >= 0.15).sort((a, b) => b.to - b.from - (a.to - a.from))[0]
    stations.push({ clip: 'boxjump', ...box(`jumpbox-${round(raised.y)}`, [1.2, raised.y, 1.2], '#88d088', x, Y, z) })
  },
  (x, z) => {
    // A step for each riser up to a landing, and the station on the step the clip first stands on.
    const { riser, tread } = t('stairsup').things.steps
    const STEPS = 12
    const first = t('stairsup').plants.filter(p => p.point.startsWith('sole') && p.on === 'raised floor').sort((a, b) => a.from - b.from)[0]
    const n = Math.max(1, Math.round(first.at[1] / riser))
    let on
    for (let i = 1; i <= STEPS; i++) {
      const s = box(`stair-${round(riser)}-${i}`, [1.6, i * riser, tread], '#f0a060', x, Y, z - 2 + (i - 0.5) * tread)
      if (i === n) on = s
    }
    box(`stairland-${round(riser)}`, [1.6, STEPS * riser, 1.2], '#f0a060', x, Y, z - 2 + STEPS * tread + 0.6)
    stations.push({ clip: 'stairsup', ...on })
  },
  // ropes and a bar
  (x, z) => {
    const r = 0.03
    box('barpost', [0.1, HANG + 0.1, 0.1], '#b0b8c0', x - 2, Y, z)
    box('barpost', [0.1, HANG + 0.1, 0.1], '#b0b8c0', x + 2, Y, z)
    stations.push({ clip: 'barmove', ...box('bar', [4, 2 * r, 2 * r], '#b0b8c0', x, Y + HANG - r, z) })
  },
  (x, z) => {
    beam('rope', x, z, 6)
    stations.push({ clip: 'ropeclimb', ...cylinder('rope', 0.025, 6, '#b08a5a', x, Y, z) })
  },
  (x, z) => {
    const swing = t('ropeswing').things.swing
    stations.push({ clip: 'ropeswing', ...beam(`swing-${round(swing.pivot[1])}`, x, z - 2, swing.pivot[1]), props: [{ is: 'platform', from: 'end' }, { is: 'rope', from: 'swing' }] })
  },
  // seats, a table, a bed, cars and a pool
  (x, z) => {
    actors.push({ is: 'chair', pos: [x, Y, z], yaw: 0 })
    stations.push({ clip: 'typing', on: 'chair', at: [x, z], props: [{ is: 'table', from: 'palms' }] })
  },
  (x, z) => stations.push({ clip: 'fax', at: [x, z], yaw: 0, props: [{ is: 'table', from: 'palms' }] }),
  (x, z) => {
    const low = Math.min(...t('bedidle').floors.map(l => l.y))
    stations.push({ clip: 'bedidle', ...box(`bed-${round(low)}`, [1.2, low, 2.2], '#9fb4d8', x, Y, z) })
  },
  (x, z) => {
    const s = t('drive').things.seat[0]
    stations.push({ clip: 'drive', ...car('redcar', x, z, 0, [1.8, 4.2], 1.45, [0.4, 0.1, s.y], '#c05050'), props: [{ is: 'wheel', from: 'points' }] })
  },
  (x, z) => {
    const s = t('carin').things.seat[0]
    stations.push({ clip: 'carin', ...car('bluecar', x, z, -Math.PI / 2, [1.8, 4.2], s.y + 0.95, [0.4, 0.1, s.y], '#5070c0') })
  },
  (x, z) => {
    pool('pool', x, z, [4, 4], 1.8, 0.2)
    stations.push({ clip: 'tread', at: [x, z], yaw: 0, water: 1.6, props: [{ is: 'water', size: [3.6, 3.6] }] })
  },
  (x, z) => {
    pool('lane', x, z + 2, [3, 9], 1.8, 0.2)
    stations.push({ clip: 'swimunder', at: [x, z + 2], yaw: 0, water: 1.6, props: [{ is: 'water', size: [2.6, 8.6] }] })
  },
  // on the ground, with loose things where the clip touches them
  (x, z) => stations.push({ clip: 'lieback', at: [x, z], yaw: 0 }),
  (x, z) => stations.push({ clip: 'kneel', at: [x, z], yaw: 0 }),
  (x, z) => stations.push({ clip: 'crawl', at: [x, z - 2], yaw: 0 }),
  (x, z) => stations.push({ clip: 'dig', at: [x, z], yaw: 0 }),
  (x, z) => stations.push({ clip: 'pickup', at: [x, z], yaw: 0, props: [{ is: 'crate', from: 'point:R1' }] }),
  (x, z) => stations.push({ clip: 'carrybox', at: [x, z], yaw: 0, props: [{ is: 'carried', from: 'span' }] }),
  (x, z) => stations.push({ clip: 'push', at: [x, z - 2], yaw: 0, props: [{ is: 'carried', from: 'span' }] }),
  (x, z) => stations.push({ clip: 'kick', at: [x, z], yaw: 0, props: [{ is: 'ball', from: 'strike:ballR' }] }),
  (x, z) => stations.push({ clip: 'keeper', at: [x, z], yaw: 0, props: [{ is: 'ball', from: 'points' }] }),
  (x, z) => stations.push({ clip: 'putt', at: [x, z], yaw: 0, props: [{ is: 'ball', from: 'strike:handR' }] }),
  (x, z) => stations.push({ clip: 'button', at: [x, z], yaw: 0, props: [{ is: 'panel', from: 'point:R0' }] }),
  (x, z) => stations.push({ clip: 'lever', at: [x, z], yaw: 0, props: [{ is: 'panel', from: 'point:R0' }] }),
  (x, z) => stations.push({ clip: 'dooropen', at: [x, z - 2], yaw: 0, props: [{ is: 'door', from: 'point:R0' }] }),
  (x, z) => {
    stations.push({ clip: 'shake1', at: [x, z], yaw: 0 })
    stations.push({ clip: 'shake2', with: stations.length - 1 })
  },
]

const COLUMNS = 8
cells.forEach((make, i) => make((i % COLUMNS - (COLUMNS - 1) / 2) * CELL, Math.floor(i / COLUMNS) * CELL + 8))

// The scene: its shapes3d kinds, a prefab and the actors of each, written in place of the ones it had.
const scene = JSON.parse(readFileSync(sceneFile, 'utf8'))
const was = Object.keys(scene.world.shapes3d?.kinds ?? {})
scene.world.shapes3d = { ...scene.world.shapes3d, kinds: { ...kinds, chair: { shape: { cylinder: { radius: 0.25, height: round(defs.chair.height + defs.chair.back) } } } } }
for (const name of was) delete scene.prefabs[name]
for (const name of Object.keys(scene.world.shapes3d.kinds)) scene.prefabs[name] = { pos: [0, 0, 0], yaw: 0 }
scene.actors = [...scene.actors.filter(a => !was.includes(a.is)), ...actors]

// The scene as it is written by hand: a value on one line where it fits in `WIDE` characters, `{ "a": 1 }`,
// else its entries a line each.
const WIDE = 150
const pretty = (v, indent = '') => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  const list = Array.isArray(v)
  const items = list ? v.map(x => pretty(x, indent + '  ')) : Object.entries(v).map(([key, x]) => `${JSON.stringify(key)}: ${pretty(x, indent + '  ')}`)
  if (!items.length) return list ? '[]' : '{}'
  const one = list ? `[${items.join(', ')}]` : `{ ${items.join(', ')} }`
  if (!one.includes('\n') && indent.length + one.length <= WIDE) return one
  return `${list ? '[' : '{'}\n${items.map(i => `${indent}  ${i}`).join(',\n')}\n${indent}${list ? ']' : '}'}`
}
writeFileSync(sceneFile, pretty(scene) + '\n')
writeFileSync(path.join(here, 'yard.json'), JSON.stringify({ stations }, null, 1) + '\n')
console.log(`wrote yard.scene.json's ${Object.keys(scene.world.shapes3d.kinds).length} shapes3d kinds and ${actors.length} shapes, and yard.json's ${stations.length} stations`)
