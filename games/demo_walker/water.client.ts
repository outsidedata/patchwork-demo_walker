// The water's look: a sheet of its definition's `colour` and `opacity`, `size` metres a side, level at the
// `water` row's `pos`, on the waterline, y = 0, which terrain3d's land floods up to: it shows where the
// land dips under it, the pond, and lies under the land everywhere else (`assets/demo_walker.json`).
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let sheet: THREE.Mesh | undefined

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const k = def(plugins.wire, row.kind)
  sheet = new T.Mesh(
    new T.PlaneGeometry(k.size, k.size),
    plugins.render3d.dress(new T.MeshStandardMaterial({ color: k.colour, transparent: true, opacity: k.opacity, roughness: 0.15 })),
  )
  sheet.rotation.x = -Math.PI / 2
  sheet.position.set(row.data.pos[0], row.data.pos[1], row.data.pos[2])
  sheet.receiveShadow = true
  plugins.render3d.scene.add(sheet)
}

export function tick() {}

export function remove(plugins: Plugins) {
  if (!sheet) return
  plugins.render3d.scene.remove(sheet)
  sheet.geometry.dispose()
  ;(sheet.material as THREE.Material).dispose()
  sheet = undefined
}
