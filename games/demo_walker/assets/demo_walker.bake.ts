// demo_walker's bake, `yarn bake demo_walker` (core's `scripts/bake.ts`): every built file the scene's
// catalogue names, written where the catalogue reads it.
//   xbot.touches.json    what every clip of the rig touches (`xbot.touches.mjs`, by anim's touch reader
//                        `plugins/anim/anim.touches.mjs`), read off where the skin is on every frame of each
//                        clip as its FBX has it (anim's `anim.touches.py`, in Blender, with the rearmost
//                        skin of the sitting clips),
//                        and each clip's lift and turn written to its sidecar beside its FBX, which anim's
//                        export lays onto the clip as it bakes it
//   yard.json            the yard (`yard.mjs`): a station for every kind of interaction the rig has a
//                        clip of, and its thing, sized to the clip from `xbot.touches.json`, as shapes3d's
//                        kinds and actors in `yard.scene.json`
//   xbot.glb             Mixamo's X Bot (the library's `characters/xbot/xbot.fbx`) with every clip of
//                        `xbot.rig.json` baked onto it by anim's export (`plugins/anim/anim.export.py`),
//                        which packs it with gltfpack; the rig's measured `table` and `ends` are then
//                        written back into `xbot.rig.json` by the mixamo skill's `merge-table.mjs`
//   checker-1024.webp    the ground's checkerboard, drawn here from nothing: `squares`
//                        squares a side in two greys, `light` and `dark`, each with a `line` pixel rim
//                        of `rim` grey, so a repeat of the map is `squares` squares across
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import type { Tools } from '#scripts/bake.ts'

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')

const SIZE = 1024
const CHECKER = { squares: 2, light: 0xd4, dark: 0xa8, rim: 0x86, line: 3 }

const node = (args: string[]) =>
  new Promise<string>((done, fail) => execFile(process.execPath, args, (e, stdout, stderr) =>
    e ? fail(new Error(`node ${args.join(' ')} failed:\n${stdout}${stderr}`)) : done(`${stdout}${stderr}`)))

// A PNG of grey pixels, `size` a side: its signature, IHDR, one IDAT of the filtered rows, IEND.
function png(size: number, grey: (x: number, y: number) => number): Buffer {
  const table = new Uint32Array(256).map((_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (b: Buffer) => {
    let c = 0xffffffff
    for (const v of b) c = table[(c ^ v) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(4)
    head.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const tail = Buffer.alloc(4)
    tail.writeUInt32BE(crc(body))
    return Buffer.concat([head, body, tail])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bits a sample
  ihdr[9] = 0 // greyscale
  const rows = Buffer.alloc(size * (size + 1))
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) rows[y * (size + 1) + 1 + x] = grey(x, y)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

export default async ({ blender, webp, scratch }: Tools) => {
  // the checkerboard
  const cell = SIZE / CHECKER.squares
  const raw = scratch('checker.png')
  fs.writeFileSync(raw, png(SIZE, (x, y) => {
    const i = Math.floor(x / cell), j = Math.floor(y / cell)
    const u = x - i * cell, v = y - j * cell
    const edge = Math.min(u, v, cell - 1 - u, cell - 1 - v) < CHECKER.line
    return edge ? CHECKER.rim : (i + j) % 2 ? CHECKER.dark : CHECKER.light
  }))
  const checker = path.join(here, `checker-${SIZE}.webp`)
  await webp(raw, checker, SIZE)
  console.log('wrote', path.relative(root, checker))

  // what the clips touch, and their sidecars, before the export lays them on: each clip of the rig with a
  // file of its own (a mirror is anim's) measured once
  const rig = path.join(here, 'xbot.rig.json')
  const files = [...new Set(Object.values(JSON.parse(fs.readFileSync(rig, 'utf8')).clips as Record<string, string | { file?: string }>)
    .map(e => (typeof e === 'string' ? e : e.file)).filter((f): f is string => !!f))]
  const list = scratch('xbot.clips.txt')
  fs.writeFileSync(list, files.join('\n') + '\n')
  const skins = scratch('skin')
  console.log(await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(root, 'plugins', 'anim', 'anim.touches.py'), '--', list, skins, '--rear']))
  console.log(await node([path.join(here, 'xbot.touches.mjs'), skins]))
  // the yard's level, its things sized to the clips just read
  console.log(await node([path.join(here, 'yard.mjs')]))

  // the X Bot and its clips, and the rig's measures
  const table = scratch('xbot.table.json')
  const glb = path.join(here, 'xbot.glb')
  console.log(await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(root, 'plugins', 'anim', 'anim.export.py'), '--', rig, table, `xbot=${glb}`]))
  console.log(await node([path.join(root, '.claude', 'skills', 'using-mixamo-assets', 'scripts', 'merge-table.mjs'), rig, table, rig]))
  console.log('wrote', path.relative(root, glb))
}
