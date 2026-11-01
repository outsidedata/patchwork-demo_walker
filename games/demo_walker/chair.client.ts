// A chair's look: a `chair` row, its `pos` where its sitter's hips stand over the ground and its `yaw`
// the way the sitter faces, drawn from its definition (`assets/demo_walker.json`): a seat `width` across
// and `depth` deep with its top `height` up, reaching `behind` metres behind the hips, a back `back` tall
// at its rear edge, and four legs `leg` square, its boards `board` thick, in its `tint`. What a body
// walks round is its shapes3d cylinder (`world.shapes3d.kinds.chair`), and what sits on it is moves'
// (`plugins/moves`, `chairs`).
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let chair: THREE.Group | undefined

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const k = def(plugins.wire, row.kind)
  const dressed = plugins.render3d.dress(new T.MeshStandardMaterial({ color: k.tint, roughness: 0.8 }))
  chair = new T.Group()
  // In the chair's own frame: z the way its sitter faces, the sitter's hips over z = 0.
  const piece = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), dressed)
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    chair!.add(m)
  }
  const front = k.depth - k.behind, back = -k.behind, { board, leg } = k
  piece(k.width, board, k.depth, 0, k.height - board / 2, (front + back) / 2)
  piece(k.width, k.back, board, 0, k.height + k.back / 2, back + board / 2)
  for (const x of [-1, 1]) for (const z of [back + leg / 2, front - leg / 2]) piece(leg, k.height - board, leg, (x * (k.width - leg)) / 2, (k.height - board) / 2, z)
  chair.position.set(row.data.pos[0], row.data.pos[1], row.data.pos[2])
  chair.rotation.y = row.data.yaw
  plugins.render3d.scene.add(chair)
}

export function tick() {}

export function remove(plugins: Plugins) {
  if (!chair) return
  plugins.render3d.scene.remove(chair)
  let material: THREE.Material | undefined
  chair.traverse(o => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry.dispose()
    material = m.material as THREE.Material
  })
  material?.dispose()
  chair = undefined
}
