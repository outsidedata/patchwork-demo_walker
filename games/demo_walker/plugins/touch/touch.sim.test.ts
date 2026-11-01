// touch in the yard: a seat joins the yard, and at every station its X Bot is stood beside where the
// station's clip starts and presses use, as the page's E key or a gamepad's X sends it: it takes the
// station, plays its clip, and when the clip ends (a one-shot) or it presses use again (a loop) it is
// back on its feet, or falls to the ground and lands.
import { expect, test } from 'vitest'
import { boot, type Row, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { sim } from '../../demo_walker.sim.ts'
import file from '../../demo_walker.scene.json' with { type: 'json' }
import yard from '../../assets/yard.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

test('a seat takes every station of the yard with use, plays it, and is back on its feet', async () => {
  const scene = structuredClone(file) as Scene
  scene.prefabs.scenemanager.entry = 'yard'
  const truth = boot(scene, sim)
  const room = (await load(truth, new URL('../../demo_walker.sim.ts', import.meta.url).href)).get('yard')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  truth.step(DT)
  const me = (): Row => room.rows.find(r => r.kind === 'player')!
  let seq = 0
  const send = (action: string, ...args: number[]) => {
    const last = heard[heard.length - 1]
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id: me().id, action, args } })
  }
  const steps = (n: number) => { for (let i = 0; i < n; i++) truth.step(DT) }
  const ground = me().data.pos[1]
  for (let i = 0; i < yard.stations.length; i++) {
    // Beside where the station's clip starts: its mannequin's place, half a metre back along its facing.
    const m = room.rows.find(r => r.kind === 'mannequin' && r.data.station === i)!
    const [x, , z, yaw] = m.data.place
    const d = me().data
    Object.assign(d, { pos: [x - 0.5 * Math.sin(yaw), ground, z - 0.5 * Math.cos(yaw)], vel: [0, 0, 0], grounded: true, sliding: false, move: '', ladder: 0, crouch: false, rig: 'stand' })
    steps(2)
    send('use')
    steps(1)
    expect(me().data.station, `station ${i} (${yard.stations[i].clip})`).toBe(i)
    // Played: a loop for 3 s and let go of; a one-shot to its end.
    for (let n = 0; n < 60 * 8 && me().data.station === i; n++) {
      truth.step(DT)
      if (n === 180 && me().data.station === i) send('use')
    }
    expect(me().data.station, `station ${i} (${yard.stations[i].clip}) let go`).toBe(-1)
    // On its feet again, or fallen to the ground.
    for (let n = 0; n < 60 * 3 && !me().data.grounded; n++) truth.step(DT)
    expect(me().data.grounded, `station ${i} (${yard.stations[i].clip}) lands`).toBe(true)
    // Its landing played out, as a player waits before the next.
    for (let n = 0; n < 60 * 3 && me().data.state === 'act'; n++) truth.step(DT)
    expect(Number.isFinite(me().data.pos[1])).toBe(true)
  }
})
