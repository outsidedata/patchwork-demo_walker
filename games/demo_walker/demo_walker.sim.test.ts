// demo_walker: the manager booted as its page boots it and main loaded; a seat joins, walks its X Bot
// to where the ladder's climb starts (climber's `starts`), climbs it onto the top of the block it
// stands against, and climbs back down to the ground.
import { expect, test } from 'vitest'
import { boot, type Row, type Scene, type Truth, type W } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { starts } from './plugins/climber/climber.sim.ts'
import { sim } from './demo_walker.sim.ts'
import file from './demo_walker.scene.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

// The scene as a rule's `w` reads it, for asking climber where the ladder's climb starts.
const wOf = (t: Truth) => ({
  world: t.world,
  all: (kind: string) => t.rows.filter(r => r.kind === kind),
  find: (kind: string, pred: (r: Row) => boolean = () => true) => t.rows.find(r => r.kind === kind && pred(r))!,
  get: (id: number) => t.rows.find(r => r.id === id)!,
}) as unknown as W

test('a seat walks to the ladder, climbs onto the block and back down', async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  const me = () => room.rows.find(r => r.kind === 'player')!
  const ladder = room.rows.find(r => r.kind === 'ladder')!
  let seq = 0
  const send = (action: string, ...args: number[]) => {
    const last = heard[heard.length - 1]
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id: me().id, action, args } })
  }
  const until = (done: () => boolean, most: number) => {
    for (let i = 0; i < most && !done(); i++) truth.step(DT)
    expect(done()).toBe(true)
  }
  const ground = me().data.pos[1]
  const [sx, , sz] = starts(me(), wOf(room), ladder).up

  // Toward where the climb starts, then facing the ladder's wall and pushing on into it.
  const [x0, , z0] = me().data.pos
  send('look', Math.atan2(sx - x0, sz - z0), 0)
  send('stick', 0, -1)
  until(() => Math.hypot(me().data.pos[0] - sx, me().data.pos[2] - sz) < 0.5, 60 * 30)
  send('look', -me().data.look.yaw, 0)
  until(() => me().data.phase === 'mount', 60 * 3)
  until(() => me().data.phase === 'climb', 60 * 4)

  // Up and over the top: it stands on the block and walks.
  until(() => me().data.phase === 'top', 60 * 10)
  until(() => me().data.ladder === 0, 60 * 6)
  const top = me().data.pos[1]
  expect(top).toBeGreaterThan(ground + 2.5)
  expect(me().data.grounded).toBe(true)

  // Back out over the edge and down to the ground.
  send('stick', 0, 1)
  until(() => me().data.phase === 'descend', 60 * 2)
  until(() => me().data.phase === 'climb', 60 * 6)
  until(() => me().data.ladder === 0, 60 * 14)
  expect(me().data.pos[1]).toBeCloseTo(ground, 2)
  expect(me().data.grounded).toBe(true)
})
