// Measures the X Bot's skin on every frame of every clip in the library, for the touch catalogue
// (anim's touch reader, `plugins/anim/anim.touches.mjs`, reads it):
//   node games/demo_walker/assets/touches.mjs [<processes>]
//
// Every `.fbx` under ~/troupe-collection/packs is a clip. Each is measured by anim's `anim.touches.py` in Blender
// (`BLENDER` from the shell or the root's `.env`, else the macOS application's), the clips split across
// <processes> Blender runs at once (4 when not given), and written to
// `~/troupe-collection/packs/mixamo-skin/<its path under ~/troupe-collection>.json` (`anim.touches.py`'s
// header says what it holds). A clip whose measure is newer than its FBX is not measured again, so a
// re-run measures only clips that are new or changed. At the end it prints how many clips are measured
// and every one that could not be, with why.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')
const troupe = path.join(homedir(), 'troupe-collection')
const packs = path.join(troupe, 'packs')
const OUT = path.join(packs, 'mixamo-skin')
const WORK = path.join(OUT, '.lists')

// The root's `.env`, under the shell's own variables.
const env = { ...Object.fromEntries((existsSync(path.join(root, '.env')) ? readFileSync(path.join(root, '.env'), 'utf8') : '')
  .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && l.includes('='))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2')] })), ...process.env }
const BLENDER = env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender'
const processes = Number(process.argv[2] ?? 4)

// Every FBX under the packs, as paths under ~/troupe-collection.
const fbx = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? (e.name.startsWith('.') || e.name === 'mixamo-skin' ? [] : fbx(path.join(dir, e.name))) : /\.fbx$/i.test(e.name) ? [path.join(dir, e.name)] : [])
const all = fbx(packs).map(p => path.relative(troupe, p)).sort()
const measureOf = clip => path.join(OUT, clip + '.json')
const todo = all.filter(clip => !existsSync(measureOf(clip)) || statSync(measureOf(clip)).mtimeMs < statSync(path.join(troupe, clip)).mtimeMs)
console.log(`${all.length} clips, ${todo.length} to measure, ${processes} at once`)

if (todo.length) {
  rmSync(WORK, { recursive: true, force: true })
  mkdirSync(WORK, { recursive: true })
  let done = 0
  const shards = Array.from({ length: Math.min(processes, todo.length) }, (_, i) => todo.filter((_, j) => j % processes === i))
  await Promise.all(shards.map((clips, i) => new Promise(finish => {
    const list = path.join(WORK, `${i}.txt`)
    writeFileSync(list, clips.join('\n') + '\n')
    const run = spawn(BLENDER, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', path.join(root, 'plugins', 'anim', 'anim.touches.py'), '--', list, OUT], { stdio: ['ignore', 'pipe', 'pipe'] })
    let tail = ''
    run.stdout.on('data', b => {
      tail = (tail + b).slice(-4000)
      for (const line of String(b).split('\n')) if (line.startsWith('TOUCHES')) if (++done % 100 === 0) console.log(`${done}/${todo.length}`)
    })
    run.stderr.on('data', b => { tail = (tail + b).slice(-4000) })
    run.on('close', code => {
      if (code !== 0) console.log(`process ${i} ended ${code}:\n${tail}`)
      finish()
    })
  })))
  rmSync(WORK, { recursive: true, force: true })
}

const missing = all.filter(clip => !existsSync(measureOf(clip)))
const failed = all.filter(clip => existsSync(measureOf(clip))).map(clip => [clip, JSON.parse(readFileSync(measureOf(clip), 'utf8')).error]).filter(([, e]) => e)
console.log(`measured ${all.length - missing.length - failed.length} of ${all.length}`)
for (const clip of missing) console.log(`  not measured: ${clip}`)
for (const [clip, e] of failed) console.log(`  could not be measured: ${clip}: ${e}`)
