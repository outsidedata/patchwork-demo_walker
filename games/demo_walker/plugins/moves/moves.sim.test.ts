// moves on demo_walker's course: a seat joins main, its X Bot is stood where a player would be about
// to make each move, and the move is played with the messages the page's keys send.
import { expect, test } from 'vitest'
import { boot, type Row, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { sim } from '../../demo_walker.sim.ts'
import file from '../../demo_walker.scene.json' with { type: 'json' }
import touches from '../../assets/xbot.touches.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

// The course stands on the land at y = 0.3; each place below is a row's of `main.scene.json`, a chair or
// a shapes3d box.
async function joined() {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, new URL('../../demo_walker.sim.ts', import.meta.url).href)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  const me = (): Row => room.rows.find(r => r.kind === 'player')!
  let seq = 0
  const send = (action: string, ...args: number[]) => {
    const last = heard[heard.length - 1]
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id: me().id, action, args } })
  }
  const steps = (n: number) => { for (let i = 0; i < n; i++) truth.step(DT) }
  const until = (done: () => boolean, most: number) => {
    for (let i = 0; i < most && !done(); i++) truth.step(DT)
    expect(done()).toBe(true)
  }
  // The body stood at (x, z) facing `yaw`, the camera behind it.
  const stand = (x: number, z: number, yaw: number) => {
    const d = me().data
    d.pos = [x, 0.3, z]
    d.yaw = yaw
    d.look = { ...d.look, yaw }
    d.vel = [0, 0, 0]
  }
  return { me, send, steps, until, stand }
}

test('a seat sits on a chair and gets up again', async () => {
  const { me, send, until, stand } = await joined()
  // In front of the chair at (-16, 18), whose sitter faces -z, with its back to it.
  stand(-16, 17.4, Math.PI)
  send('use')
  until(() => me().data.move === 'seated', 60 * 4)
  expect(me().data.pos[0]).toBeCloseTo(-16, 3)
  expect(me().data.pos[2]).toBeCloseTo(18, 3)
  send('use')
  until(() => me().data.move === '', 60 * 4)
  expect(me().data.grounded).toBe(true)
})

test('a seat takes cover at the tall wall, sneaks along it and steps out', async () => {
  const { me, send, until, steps, stand } = await joined()
  // A metre in front of the wall at (-8, 25), 8 m across and 0.5 deep, its front face at z = 24.75.
  stand(-8, 23.8, 0)
  send('use')
  until(() => me().data.move === 'hug', 60 * 3)
  expect(me().data.rig).toBe('cover')
  const x0 = me().data.pos[0], z0 = me().data.pos[2]
  send('stick', 1, 0)
  steps(60)
  expect(Math.abs(me().data.pos[0] - x0)).toBeGreaterThan(0.5)
  expect(me().data.pos[2]).toBeCloseTo(z0, 2)
  send('stick', 0, 0)
  send('use')
  until(() => me().data.move === '', 60 * 3)
  expect(me().data.rig).toBe('stand')
  expect(me().data.pos[2]).toBeLessThan(24.75)
})

test('a running seat vaults the low wall, its hands on its top', async () => {
  const { me, send, until, stand } = await joined()
  // Running at the low wall at (3, 25), 0.6 deep and 0.808 m high, where the vault sets its hands;
  // jump pressed where its clip starts, the wall's middle less how far ahead it sets them.
  stand(3, 20, 0)
  send('fast', 1)
  send('stick', 0, -1)
  until(() => me().data.pos[2] > 25 - touches.clips.vault.things.over!.at[1], 60 * 3)
  send('jump')
  until(() => me().data.move === 'vault', 2)
  until(() => me().data.move === '', 60 * 2)
  expect(me().data.pos[2]).toBeGreaterThan(25.3)
  expect(me().data.pos[1]).toBeCloseTo(0.3, 2)
})

test('a running seat runs up onto the platform, onto the top its clip ends on', async () => {
  const { me, send, until, stand } = await joined()
  // Running at the platform at (13, 27), 3 m square and 2.266 m high, its front face at z = 25.5;
  // jump pressed where its clip starts, the face less how far ahead it kicks it.
  stand(13, 19, 0)
  send('fast', 1)
  send('stick', 0, -1)
  until(() => me().data.pos[2] > 25.5 - touches.clips.wallrun.things.face!.at[1], 60 * 3)
  send('jump')
  until(() => me().data.move === 'wallrun', 2)
  until(() => me().data.move === '', 60 * 3)
  expect(me().data.pos[1]).toBeCloseTo(0.3 + 2.266, 2)
})

test('a crouched seat creeps', async () => {
  const { me, send, until, steps, stand } = await joined()
  stand(0, 0, 0)
  send('crouch')
  until(() => me().data.clip === 'crouch', 2)
  until(() => me().data.state !== 'act', 60 * 2)
  send('stick', 0, -1)
  steps(60)
  expect(me().data.clip).toBe('creep')
})

test('a seat dodge-rolls', async () => {
  const { me, send, until, stand } = await joined()
  stand(0, 0, 0)
  send('roll')
  until(() => me().data.clip === 'dodge', 2)
  until(() => me().data.state !== 'act', 60 * 2)
  expect(me().data.pos[2]).toBeGreaterThan(4)
})
