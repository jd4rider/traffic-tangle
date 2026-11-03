import { describe, expect, it } from 'vitest'
import { generateLevel } from '../src/core/generator'
import { buildGraph } from '../src/core/graph'
import { simulate } from '../src/core/sim'
import { validateLevel } from '../src/core/validate'
import { WORLD_COUNT } from '../src/core/types'

describe('level generator', () => {
  it('is deterministic for the same world and index', () => {
    const first = generateLevel(2, 3)
    const second = generateLevel(2, 3)
    expect(first).toEqual(second)
    expect(first?.id).toBe('level-0054')
  })

  it('builds levels that pass validation and replay', () => {
    for (const [world, index] of [
      [1, 0],
      [4, 5],
      [9, 12],
      [14, 20],
      [19, 40],
    ] as const) {
      const level = generateLevel(world, index)
      expect(level, `world ${world} index ${index}`).not.toBeNull()
      expect(validateLevel(level!)).toEqual([])
      const replay = simulate(buildGraph(level!), level!, level!.reference)
      expect(replay.status).toBe('success')
    }
  })

  it('introduces signals only from the world that teaches them', () => {
    const early = generateLevel(1, 20)!
    expect(early.signals).toHaveLength(0)
    const signalWorld = Array.from({ length: 10 }, (_, index) => generateLevel(4, index)!)
    expect(signalWorld.some((level) => level.signals.length > 0)).toBe(true)
  })

  it('uses one-way streets from the one-way world onwards', () => {
    const levels = Array.from({ length: 6 }, (_, index) => generateLevel(3, index)!)
    expect(levels.some((level) => level.oneWay.length > 0)).toBe(true)
  })

  it('keeps every world buildable', () => {
    for (let world = 1; world <= WORLD_COUNT; world += 1) {
      const level = generateLevel(world, 49)
      expect(level, `world ${world}`).not.toBeNull()
      expect(validateLevel(level!)).toEqual([])
    }
  })
})
