// The lift: the manager booted into the shapes scene; a seat stands on the ground beside the lift that
// rides up to the deck's top, steps on while it waits at the bottom, rides it up, steps off onto the deck,
// steps back on once it has come up again, rides it down until it sinks under the land, which the body
// is left standing on, and steps off onto the ground.
import { expect, test } from 'vitest'
import { boot, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { sim } from './demo_walker.sim.ts'
import file from './demo_walker.scene.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

test('a seat rides the lift up onto the deck and back down to the ground', async () => {
  const scene = { ...file, prefabs: { ...file.prefabs, scenemanager: { ...file.prefabs.scenemanager, entry: 'shapes' } } }
  const truth = boot(scene as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('shapes')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  const me = () => room.rows.find(r => r.kind === 'player')!
  const lift = room.rows.find(r => r.kind === 'lift' && r.data.high === 2.5)!
  let seq = 0
  const send = (action: string, ...args: number[]) => {
    const last = heard[heard.length - 1]
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id: me().id, action, args } })
  }
  const until = (done: () => boolean, most: number) => {
    for (let i = 0; i < most && !done(); i++) truth.step(DT)
    expect(done()).toBe(true)
  }
  // Walk to (x, z) and stop there.
  const walkTo = (x: number, z: number) => {
    const [x0, , z0] = me().data.pos
    send('look', Math.atan2(x - x0, z - z0) - me().data.look.yaw, 0)
    send('stick', 0, -1)
    until(() => Math.hypot(me().data.pos[0] - x, me().data.pos[2] - z) < 0.4, 60 * 4)
    send('stick', 0, 0)
  }
  const waiting = (y: number) => () => lift.data.held > 0 && lift.data.pos[1] === y
  const [lx, , lz] = lift.data.pos

  // On the ground past the lift's far side from the deck.
  me().data.pos = [lx, 0.5, lz + 3.5]
  me().data.grounded = false
  until(() => me().data.grounded, 60)
  const ground = me().data.pos[1]

  // On while it waits at the bottom, and up with it to the deck's top.
  until(waiting(0), 60 * 15)
  walkTo(lx, lz)
  until(() => lift.data.pos[1] > 1, 60 * 6)
  expect(me().data.grounded).toBe(true)
  until(waiting(2.5), 60 * 6)
  expect(me().data.pos[1]).toBeCloseTo(2.5, 3)

  // Off onto the deck, which it stays on as the lift goes down.
  walkTo(lx, lz - 3.5)
  until(() => lift.data.pos[1] < 1, 60 * 8)
  expect(me().data.pos[1]).toBeCloseTo(2.5, 3)
  expect(me().data.grounded).toBe(true)

  // Back on once it is up again, down with it until it sinks under the land, which takes the body, and
  // off onto the ground.
  until(waiting(2.5), 60 * 15)
  walkTo(lx, lz)
  until(waiting(0), 60 * 6)
  expect(me().data.pos[1]).toBeGreaterThan(lift.data.pos[1])
  expect(me().data.grounded).toBe(true)
  walkTo(lx, lz + 3.5)
  expect(me().data.pos[1]).toBeCloseTo(ground, 2)
  expect(me().data.grounded).toBe(true)
})
