import { generateLevel } from './generator'
import { dailyKey, dailyLevel, levelAt, levelFor } from './levels'
import { hashString, utcDayNumber } from './rng'
import { TOTAL_LEVELS, WORLD_COUNT } from './types'
import type { LevelDefinition } from './types'

export { dailyKey, dailyLevel, levelAt }

/**
 * Endless stage: deterministic from the run seed and stage, generated with the
 * campaign generator so every stage is verified before it is shown. If a stage
 * cannot be built inside the attempt budget, the nearest campaign level is used
 * instead of an unverified board.
 */
export function endlessLevel(runSeed: string, stage: number): LevelDefinition {
  const world = Math.min(WORLD_COUNT, 1 + Math.floor((stage - 1) / 5))
  const index = hashString(`${runSeed}:${stage}`) % 50
  const generated = generateLevel(world, index, `${runSeed}:${stage}`)
  if (generated) return { ...generated, id: `endless-${runSeed}-${stage}` }
  return levelFor(world, index)
}

export function newRunSeed(): string {
  const day = utcDayNumber()
  return `${day.toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`
}

export interface DailyStatus {
  key: string
  level: LevelDefinition
  number: number
}

export function todayDaily(date: Date = new Date()): DailyStatus {
  const level = dailyLevel(date)
  const number = ((utcDayNumber(date) % TOTAL_LEVELS) + TOTAL_LEVELS) % TOTAL_LEVELS + 1
  return { key: dailyKey(date), level, number }
}
