// A tree's look: a `tree` row standing at its `pos`, its trunk the shapes3d cylinder bodies walk round
// (`world.shapes3d.kinds.tree`, its `radius` and `height`), tapering to `taper` of its radius at the top,
// in its definition's `trunk` colour, under a crown of the definition's `crown` radius in its `leaves`,
// its middle at the trunk's top (`assets/demo_walker.json`).
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let tree: THREE.Group | undefined

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const k = def(plugins.wire, row.kind)
  const { radius, height } = plugins.wire.scene.world!.shapes3d.kinds[row.kind].shape.cylinder
  tree = new T.Group()
  const trunk = new T.Mesh(new T.CylinderGeometry(radius * k.taper, radius, height, 10), plugins.render3d.dress(new T.MeshStandardMaterial({ color: k.trunk, roughness: 0.9 })))
  trunk.position.y = height / 2
  const crown = new T.Mesh(new T.IcosahedronGeometry(k.crown, 1), plugins.render3d.dress(new T.MeshStandardMaterial({ color: k.leaves, roughness: 0.85, flatShading: true })))
  crown.position.y = height
  for (const m of [trunk, crown]) {
    m.castShadow = m.receiveShadow = true
    tree.add(m)
  }
  tree.position.set(row.data.pos[0], row.data.pos[1], row.data.pos[2])
  plugins.render3d.scene.add(tree)
}

export function tick() {}

export function remove(plugins: Plugins) {
  if (!tree) return
  plugins.render3d.scene.remove(tree)
  tree.traverse(o => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry.dispose()
    ;(m.material as THREE.Material).dispose()
  })
  tree = undefined
}
