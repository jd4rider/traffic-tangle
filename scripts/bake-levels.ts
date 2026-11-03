// Bakes the full 1,000-level campaign. Every level is generated from a working
// traffic plan, replayed through the shipped simulation, and rejected if
// anything fails.
//
// Usage: npm run bake [-- --from 1 --to 50]
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateLevel, generationLog } from '../src/core/generator'
import { validateLevel } from '../src/core/validate'
import { LEVELS_PER_WORLD, LEVEL_FORMAT, TOTAL_LEVELS, WORLD_COUNT, type LevelDefinition, type LevelManifest } from '../src/core/types'
import { WORLDS } from '../src/core/worlds'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const args = process.argv.slice(2)
const readArg = (name: string): number | null => {
  const index = args.indexOf(`--${name}`)
  if (index < 0) return null
  const value = Number(args[index + 1])
  return Number.isFinite(value) ? value : null
}
const from = readArg('from')
const to = readArg('to')
const partial = from !== null || to !== null

const levels: LevelDefinition[] = []
const started = Date.now()

for (let world = 1; world <= WORLD_COUNT; world += 1) {
  for (let index = 0; index < LEVELS_PER_WORLD; index += 1) {
    const global = (world - 1) * LEVELS_PER_WORLD + index + 1
    if (partial && ((from !== null && global < from) || (to !== null && global > to))) continue
    const level = generateLevel(world, index)
    if (!level) throw new Error(`level ${global} could not be generated\nlast rejections:\n${generationLog.join('\n')}`)
    const problems = validateLevel(level)
    if (problems.length) throw new Error(`level ${global} failed validation:\n${problems.join('\n')}`)
    levels.push(level)
    process.stdout.write(
      `\u2713 ${String(global).padStart(4, ' ')} ${WORLDS[world - 1].name.padEnd(22)} ${level.name.padEnd(20)} cars ${level.vehicles.length} hops ${String(level.par).padStart(2)} limit ${String(level.timeLimit).padStart(3)}s diff ${level.difficulty}\n`,
    )
  }
}

if (partial) {
  console.log(`\nBaked ${levels.length} level(s); the manifest was not overwritten during a partial run.`)
  process.exit(0)
}

if (levels.length !== TOTAL_LEVELS) throw new Error(`expected ${TOTAL_LEVELS} levels, built ${levels.length}`)

const manifest: LevelManifest = {
  format: LEVEL_FORMAT,
  generator: 'traffic-tangle/roads-v1',
  levels,
}
mkdirSync(resolve(root, 'src/data'), { recursive: true })
writeFileSync(resolve(root, 'src/data/levels.json'), `${JSON.stringify(manifest)}\n`)

const seconds = ((Date.now() - started) / 1000).toFixed(1)
const cars = levels.reduce((sum, level) => sum + level.vehicles.length, 0)
const hops = levels.reduce((sum, level) => sum + level.par, 0)
const limits = levels.map((level) => level.timeLimit)
console.log(`\nBaked ${levels.length} verified levels in ${seconds}s`)
console.log(`Cars ${cars} \u00b7 road hops ${hops} \u00b7 time limits ${Math.min(...limits)}\u2013${Math.max(...limits)}s`)
