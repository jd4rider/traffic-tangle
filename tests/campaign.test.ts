import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildGraph } from '../src/core/graph'
import { solveLevel } from '../src/core/solver'
import { simulate } from '../src/core/sim'
import { validateManifest } from '../src/core/validate'
import type { LevelManifest } from '../src/core/types'

const manifest = JSON.parse(readFileSync(resolve(__dirname, '../src/data/levels.json'), 'utf8')) as LevelManifest

describe('the 1,000-level campaign', () => {
  it('has twenty worlds of fifty levels and passes schema validation', () => {
    expect(manifest.levels).toHaveLength(1000)
    const problems = validateManifest(manifest)
    expect(problems.slice(0, 10)).toEqual([])
    const worlds = new Set(manifest.levels.map((level) => level.world))
    expect(worlds.size).toBe(20)
    for (let world = 1; world <= 20; world += 1) {
      expect(manifest.levels.filter((level) => level.world === world)).toHaveLength(50)
    }
  })

  it('replays every stored reference plan through the real simulation', () => {
    const failures: string[] = []
    for (const level of manifest.levels) {
      const result = simulate(buildGraph(level), level, level.reference, { maxSeconds: level.timeLimit + 20 })
      if (result.status !== 'success') failures.push(`${level.id}: ${result.status}`)
      if (result.makespan > level.timeLimit) failures.push(`${level.id}: over the clock`)
    }
    expect(failures).toEqual([])
  })

  it('independently solves a sample of levels', () => {
    const sample = manifest.levels.filter((level) => level.index === 0 || level.index === 25)
    const failures: string[] = []
    for (const level of sample) {
      const result = solveLevel(level, buildGraph(level), { maxSims: 600, maxMillis: 4000 })
      if (result.status !== 'solved') failures.push(`${level.id}: ${result.status}`)
    }
    expect(failures).toEqual([])
  })
})
