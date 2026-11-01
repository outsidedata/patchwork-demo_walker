// A ladder's look: two rails and the rungs between them, standing `standoff` metres out from the
// wall face at the row's `pos`, facing out along its `yaw`, in the definition's `look`:
//   width   metres between the rails' middles;  rail  their side, metres;
//   thick   a rung's radius;  above  metres the rails stand over the top;  colour  the wood's.
// Its rungs are the ones its clips climb (climber's `rungsOf`): spaced as the climbing loop climbs them,
// each one's top where the clips stand the balls of the feet, its middle `thick` under that, from the
// lowest such top over the foot. The top is the highest of shapes3d's shapes `behind` metres in from the
// wall face (gait's `shapeTop`, the top climber climbs onto), and the rungs run up to it.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { rungsOf } from './plugins/climber/climber.sim.ts'
import { shapeTop } from './plugins/gait/gait.sim.ts'

let group: THREE.Group | undefined

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const k = def(plugins.wire, row.kind)
  const look = k.look
  const [x, y, z] = row.data.pos
  const yaw = row.data.yaw
  const out = [Math.sin(yaw), Math.cos(yaw)]
  const high = shapeTop(plugins.wire.scene.world ?? {}, plugins.wire.rows, x - out[0] * k.behind, z - out[1] * k.behind)
  if (high === undefined) throw new Error(`ladder ${row.id} stands against no shape`)
  const { spacing, first } = rungsOf(plugins.wire, row)
  const tall = high - y + look.above
  const wood = plugins.render3d.dress(new T.MeshStandardMaterial({ color: look.colour, roughness: 0.75 }))
  group = new T.Group()
  const add = (m: THREE.Mesh) => {
    m.castShadow = m.receiveShadow = true
    group!.add(m)
  }
  // In the ladder's own frame: x across, y up, z out from the wall, its rungs on z = 0.
  for (const side of [-1, 1]) {
    const rail = new T.Mesh(new T.BoxGeometry(look.rail, tall, look.rail), wood)
    rail.position.set((side * look.width) / 2, tall / 2, 0)
    add(rail)
  }
  for (let h = first; h <= high - y; h += spacing) {
    const rung = new T.Mesh(new T.CylinderGeometry(look.thick, look.thick, look.width, 8), wood)
    rung.rotation.z = Math.PI / 2
    rung.position.set(0, h - look.thick, 0)
    add(rung)
  }
  group.position.set(x + out[0] * k.standoff, y, z + out[1] * k.standoff)
  group.rotation.y = yaw
  plugins.render3d.scene.add(group)
}

export function tick() {}

export function remove(plugins: Plugins) {
  if (!group) return
  plugins.render3d.scene.remove(group)
  let material: THREE.Material | undefined
  group.traverse(o => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry.dispose()
    material = m.material as THREE.Material
  })
  material?.dispose()
  group = undefined
}
