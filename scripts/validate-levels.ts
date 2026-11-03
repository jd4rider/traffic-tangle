// Re-validates the shipped manifest without regenerating it: schema checks,
// replay of every stored reference plan, and independent solves on a sample.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildGraph } from '../src/core/graph'
import { simulate } from '../src/core/sim'
import { solveLevel } from '../src/core/solver'
import { validateManifest } from '../src/core/validate'
import type { LevelManifest } from '../src/core/types'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'src/data/levels.json'), 'utf8')) as LevelManifest

const started = Date.now()
const problems = validateManifest(manifest)
if (problems.length) {
  console.error(problems.slice(0, 40).join('\n'))
  if (problems.length > 40) console.error(`... and ${problems.length - 40} more`)
  process.exit(1)
}

let replayFailures = 0
for (const level of manifest.levels) {
  const replay = simulate(buildGraph(level), level, level.reference, { maxSeconds: level.timeLimit + 20 })
  if (replay.status !== 'success') {
    replayFailures += 1
    console.error(`${level.id}: reference replay ${replay.status} (${replay.reason})`)
  }
}
if (replayFailures) {
  console.error(`\n${replayFailures} level(s) failed to replay`)
  process.exit(1)
}

// Independent solves: every 25th level, plus all first levels of each world.
const sample = manifest.levels.filter((level) => level.index % 25 === 0 || level.index === 0)
let solved = 0
let unsolved = 0
for (const level of sample) {
  const result = solveLevel(level, buildGraph(level), { maxSims: 600, maxMillis: 4000 })
  if (result.status === 'solved') {
    solved += 1
    if (result.totalLength > level.par) {
      console.error(`${level.id}: solver found ${result.totalLength} hops, par is ${level.par}`)
      process.exit(1)
    }
  } else {
    unsolved += 1
    console.error(`${level.id}: independent solve returned ${result.status} after ${result.explored} simulations`)
  }
}

const seconds = ((Date.now() - started) / 1000).toFixed(1)
if (unsolved) {
  console.error(`\n${unsolved}/${sample.length} sampled levels could not be independently solved`)
  process.exit(1)
}
console.log(`All ${manifest.levels.length} levels valid and replayed; ${solved} independent solves verified in ${seconds}s.`)
