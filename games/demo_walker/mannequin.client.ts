// A mannequin's look: anim draws its body; this draws the loose things its station's clip works with,
// each where the clip touches it (its station's `props`, `assets/yard.mjs`), from what the clip touches
// (`plugins/touch`'s `touchOf`) and the row's `place`, where its clip starts:
//   table     from `palms`: a table top 1 m across and 0.6 deep whose top stands where the palms rest,
//             reaching from the palms' middle away from the body, on four legs to the floor.
//   panel     from `point:<hand><n>` (the n-th place that hand is held, `things.points`): a button on a
//             panel just beyond the hand, on a post to the floor.
//   ball      from `strike:<part>` (where that part moves fastest, `things.strikes`) or `points` (the
//             hands' held places' middle): a ball 0.22 m across there.
//   crate     from `point:<hand><n>`: a crate 0.3 m square on the floor, its top under the hand.
//   carried   from `span` (the hands' place before the body, `things.span`): a crate between the hands,
//             carried with the body.
//   door      from `point:<hand><n>`: a door frame round a doorway whose handle the hand takes, its
//             door open into the room the body walks into.
//   wheel     from `points`: a steering wheel through the hands' held places.
//   platform  from `end`: a platform under the floor the clip ends on, where its soles stand on it.
//   rope      from `swing`: a rope from the swing's pivot (`things.swing.pivot`) to the hands' middle as
//             anim poses them, every frame.
//   water     a pool's water, `size` [across, along] round where the clip's `things.water` surface
//             stands, a sheet of the `water` definition's colour and opacity at that surface.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { posed } from '#plugins/anim/anim.sim.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { stationsOf, toWorld, touchOf, type Numbers, type Place } from './plugins/touch/touch.sim.ts'

let group: THREE.Group | undefined
// The crates carried with the body, each at its place before the body.
let carried: { mesh: THREE.Mesh; ahead: number; up: number }[] = []
// A rope swung on: from its pivot to the hands, as anim draws them.
let swung: { mesh: THREE.Mesh; pivot: number[] } | undefined

const mean = (ps: number[][]) => ps[0].map((_, i) => ps.reduce((s, p) => s + p[i], 0) / ps.length)

function build(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const k = def(plugins.wire, row.kind) as Numbers
  const station = stationsOf(plugins.wire)[row.data.station]
  if (!station) throw new Error(`mannequin ${row.id} plays at station ${row.data.station}, which the scene has not`)
  const [x, y, z, yaw] = row.data.place
  const place: Place = { x, y, z, yaw }
  const t = touchOf(plugins.wire, k, station.clip) as any
  const fwd = [Math.sin(yaw), Math.cos(yaw)], left = [Math.cos(yaw), -Math.sin(yaw)]
  const material = (colour: string) => plugins.render3d.dress(new T.MeshStandardMaterial({ color: colour, roughness: 0.7 }))
  group = new T.Group()
  const put = (mesh: THREE.Mesh, at: number[], turn = yaw) => {
    mesh.position.set(at[0], at[1], at[2])
    mesh.rotation.y = turn
    mesh.castShadow = mesh.receiveShadow = true
    group!.add(mesh)
    return mesh
  }
  // A place the clip touches, by a prop's `from`.
  const point = (from?: string) => {
    if (!from) throw new Error(`mannequin: a prop of ${station.clip} names no place it stands at`)
    const [kind, which] = from.split(':')
    if (kind === 'point') {
      const hand = which[0], n = Number(which.slice(1))
      const held = (t.things.points ?? []).filter((p: any) => p.hand === hand)[n]
      if (!held) throw new Error(`mannequin: ${station.clip} holds no ${from}`)
      return toWorld(place, held.at)
    }
    if (kind === 'strike') {
      const s = (t.things.strikes ?? []).find((p: any) => p.part === which)
      if (!s) throw new Error(`mannequin: ${station.clip} strikes with no ${which}`)
      return toWorld(place, s.at)
    }
    if (kind === 'points') return toWorld(place, mean((t.things.points ?? []).map((p: any) => p.at)))
    if (kind === 'palms') return toWorld(place, mean(t.things.palms.map((p: any) => [p.at[0], p.y, p.at[1]])))
    if (kind === 'end') {
      const soles = t.plants.filter((p: any) => p.point.startsWith('sole') && Math.abs(p.at[1] - t.things.end) <= 0.03)
      return toWorld(place, mean(soles.map((p: any) => p.at)))
    }
    throw new Error(`mannequin: a prop from ${from}, which the look reads nothing by`)
  }
  for (const prop of station.props ?? []) {
    if (prop.is === 'table') {
      const at = point(prop.from)
      const c = [at[0] + fwd[0] * 0.2, at[1] - 0.02, at[2] + fwd[1] * 0.2]
      put(new T.Mesh(new T.BoxGeometry(1, 0.04, 0.6), material('#a07850')), c)
      for (const [a, b] of [[-0.45, -0.25], [0.45, -0.25], [-0.45, 0.25], [0.45, 0.25]]) {
        const lx = c[0] + left[0] * a + fwd[0] * b, lz = c[2] + left[1] * a + fwd[1] * b
        put(new T.Mesh(new T.BoxGeometry(0.05, at[1] - y, 0.05), material('#a07850')), [lx, y + (at[1] - y) / 2, lz])
      }
    } else if (prop.is === 'panel') {
      const at = point(prop.from)
      const p = [at[0] + fwd[0] * 0.05, at[1], at[2] + fwd[1] * 0.05]
      put(new T.Mesh(new T.BoxGeometry(0.5, 0.6, 0.04), material('#7a8088')), p)
      put(new T.Mesh(new T.BoxGeometry(0.06, at[1] - y, 0.06), material('#7a8088')), [p[0] + fwd[0] * 0.03, y + (at[1] - y) / 2, p[2] + fwd[1] * 0.03])
      put(new T.Mesh(new T.SphereGeometry(0.03, 12, 8), material('#d03030')), at)
    } else if (prop.is === 'ball') {
      put(new T.Mesh(new T.SphereGeometry(0.11, 20, 14), material('#f2f2f2')), point(prop.from))
    } else if (prop.is === 'crate') {
      const at = point(prop.from)
      const h = Math.max(0.1, at[1] - y)
      put(new T.Mesh(new T.BoxGeometry(0.3, h, 0.3), material('#b08a5a')), [at[0], y + h / 2, at[2]])
    } else if (prop.is === 'carried') {
      const s = t.things.span
      const mesh = new T.Mesh(new T.BoxGeometry(Math.max(0.2, s.apart - 0.08), 0.4, 0.4), material('#b08a5a'))
      mesh.castShadow = mesh.receiveShadow = true
      group.add(mesh)
      carried.push({ mesh, ahead: s.ahead, up: s.y })
    } else if (prop.is === 'door') {
      // The doorway 1 m wide, its middle 0.45 m to the body's left of the handle (the hand takes the
      // handle at the door's edge), its door hung on the doorway's far side and open into the room.
      const at = point(prop.from)
      const mid = [at[0] + left[0] * 0.45, at[2] + left[1] * 0.45]
      const wood = material('#8a6a4a')
      for (const side of [-0.5, 0.5]) put(new T.Mesh(new T.BoxGeometry(0.1, 2.2, 0.15), wood), [mid[0] + left[0] * side, y + 1.1, mid[1] + left[1] * side])
      put(new T.Mesh(new T.BoxGeometry(1.1, 0.1, 0.15), wood), [mid[0], y + 2.2, mid[1]])
      const hinge = [mid[0] + left[0] * 0.45, mid[1] + left[1] * 0.45]
      const open = yaw + Math.PI / 2 + 0.3
      const door = new T.Mesh(new T.BoxGeometry(0.9, 2.1, 0.04), wood)
      put(door, [hinge[0] - Math.cos(open) * 0.45, y + 1.05, hinge[1] + Math.sin(open) * 0.45], open)
    } else if (prop.is === 'wheel') {
      const ps = (t.things.points ?? []).map((p: any) => toWorld(place, p.at))
      const at = mean(ps)
      const r = Math.max(0.15, Math.hypot(ps[0][0] - ps[ps.length - 1][0], ps[0][2] - ps[ps.length - 1][2]) / 2)
      const wheel = put(new T.Mesh(new T.TorusGeometry(r, 0.02, 8, 24), material('#202020')), at)
      wheel.rotation.x = -Math.PI / 3
    } else if (prop.is === 'rope') {
      const pivot = t.things.swing?.pivot
      if (!pivot) throw new Error(`mannequin: ${station.clip} swings from no pivot`)
      const mesh = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 1, 8), material('#b08a5a'))
      mesh.castShadow = true
      group.add(mesh)
      swung = { mesh, pivot: toWorld(place, pivot) }
    } else if (prop.is === 'platform') {
      const at = point(prop.from)
      put(new T.Mesh(new T.BoxGeometry(1.6, at[1] - y, 1.6), material('#c07060')), [at[0], y + (at[1] - y) / 2, at[2]])
    } else if (prop.is === 'water') {
      const surface = t.things.water?.surface
      if (surface === undefined || !prop.size) throw new Error(`mannequin: water round ${station.clip}, which swims in none or gives it no size`)
      const water = def(plugins.wire, 'water')
      const sheet = new T.Mesh(new T.PlaneGeometry(prop.size[0], prop.size[1]), plugins.render3d.dress(new T.MeshStandardMaterial({ color: water.colour, transparent: true, opacity: water.opacity, roughness: 0.15 })))
      const [sx, sy, sz] = toWorld(place, [0, surface, 0])
      sheet.position.set(sx, sy, sz)
      sheet.rotation.set(-Math.PI / 2, 0, yaw)
      group.add(sheet)
    } else throw new Error(`mannequin: a ${prop.is} prop, which the look draws nothing of`)
  }
  plugins.render3d.scene.add(group)
}

export function setup(row: Row, plugins: Plugins) {
  if (row.data.place) build(row, plugins)
}

export function tick(row: Row, plugins: Plugins) {
  if (!group && row.data.place) build(row, plugins)
  const [x, y, z] = row.data.pos
  const yaw = row.data.yaw
  for (const c of carried) {
    c.mesh.position.set(x + Math.sin(yaw) * c.ahead, y + c.up, z + Math.cos(yaw) * c.ahead)
    c.mesh.rotation.y = yaw
  }
  if (swung) {
    // The hands' middle, off the skeleton anim poses, turned by the row's yaw and moved to its place.
    const joints = posed(plugins.wire, row)
    const hands = ['LeftHand', 'RightHand'].map(n => {
      const e = joints.get(n)!.elements
      return [x + e[12] * Math.cos(yaw) + e[14] * Math.sin(yaw), y + e[13], z - e[12] * Math.sin(yaw) + e[14] * Math.cos(yaw)]
    })
    const to = mean(hands), from = swung.pivot
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
    const length = Math.hypot(...d)
    swung.mesh.position.set((to[0] + from[0]) / 2, (to[1] + from[1]) / 2, (to[2] + from[2]) / 2)
    swung.mesh.scale.set(1, length, 1)
    const T = plugins.render3d.THREE as typeof THREE
    swung.mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(d[0] / length, d[1] / length, d[2] / length))
  }
}

export function remove(plugins: Plugins) {
  if (!group) return
  plugins.render3d.scene.remove(group)
  group.traverse(o => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry.dispose()
    ;(m.material as THREE.Material).dispose()
  })
  group = undefined
  carried = []
  swung = undefined
}
