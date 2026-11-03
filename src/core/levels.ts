import manifestJson from '../data/levels.json'
import type { LevelDefinition, LevelManifest } from './types'
import { LEVELS_PER_WORLD, TOTAL_LEVELS, WORLD_COUNT } from './types'
import { utcDayNumber } from './rng'

const manifest = manifestJson as unknown as LevelManifest

export const LEVELS: LevelDefinition[] = manifest.levels
export const LEVEL_COUNT = LEVELS.length

const byId = new Map<string, LevelDefinition>()
for (const level of LEVELS) byId.set(level.id, level)

export function levelById(id: string): LevelDefinition | undefined {
  return byId.get(id)
}

/** 1-based global level number, 1..1000. */
export function levelAt(globalNumber: number): LevelDefinition {
  const index = Math.min(TOTAL_LEVELS, Math.max(1, Math.round(globalNumber))) - 1
  return LEVELS[index] ?? LEVELS[0]
}

export function levelFor(world: number, index: number): LevelDefinition {
  const safeWorld = Math.min(WORLD_COUNT, Math.max(1, world))
  const safeIndex = Math.min(LEVELS_PER_WORLD - 1, Math.max(0, index))
  return levelAt((safeWorld - 1) * LEVELS_PER_WORLD + safeIndex + 1)
}

export function globalNumber(level: LevelDefinition): number {
  return level.world * LEVELS_PER_WORLD - LEVELS_PER_WORLD + level.index + 1
}

/** Same puzzle for every player on a given UTC date. */
export function dailyLevel(date: Date = new Date()): LevelDefinition {
  const day = utcDayNumber(date)
  return LEVELS[((day % LEVELS.length) + LEVELS.length) % LEVELS.length]
}

export function dailyKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** The furthest unlocked Journey level, from saved progress. */
export function nextJourneyLevel(unlocked: number): LevelDefinition {
  return levelAt(unlocked)
}
