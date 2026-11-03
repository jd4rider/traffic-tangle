import { describe, expect, it } from 'vitest'
import {
  defaultProgress,
  defaultStore,
  loadProgress,
  mergeProgress,
  recordCompletion,
  sanitizeProgress,
  saveProgress,
  starsFor,
  updateSettings,
} from '../src/core/saves'

describe('saves', () => {
  it('returns clean defaults for garbage', () => {
    expect(sanitizeProgress(null).unlocked).toBe(1)
    expect(sanitizeProgress('nope').completed).toEqual({})
    expect(sanitizeProgress({ completed: { x: { stars: 99, bestLength: -4 } } }).completed.x.stars).toBe(3)
  })

  it('round-trips through a store', () => {
    const progress = defaultProgress()
    progress.unlocked = 12
    progress.completed['level-0001'] = { stars: 3, bestLength: 8, bestTime: 11, hints: 0, at: 1 }
    saveProgress(progress)
    expect(loadProgress().unlocked).toBe(12)
    expect(loadProgress().completed['level-0001'].bestLength).toBe(8)
  })

  it('merges without losing the better side', () => {
    const local = defaultProgress()
    local.completed['a'] = { stars: 3, bestLength: 10, bestTime: 20, hints: 0, at: 2 }
    local.unlocked = 4
    local.achievements = ['first_commute']
    const cloud = defaultProgress()
    cloud.completed['a'] = { stars: 1, bestLength: 8, bestTime: 30, hints: 2, at: 1 }
    cloud.completed['b'] = { stars: 2, bestLength: 12, bestTime: 15, hints: 1, at: 3 }
    cloud.unlocked = 9
    cloud.achievements = ['route_rookie']
    const merged = mergeProgress(local, cloud)
    expect(merged.completed.a.stars).toBe(3)
    expect(merged.completed.a.bestLength).toBe(8)
    expect(merged.completed.b.stars).toBe(2)
    expect(merged.unlocked).toBe(9)
    expect(merged.achievements.sort()).toEqual(['first_commute', 'route_rookie'])
  })

  it('records a completion, unlocks the next level and awards stars', () => {
    const result = recordCompletion(defaultProgress(), {
      levelId: 'level-0001',
      levelNumber: 1,
      stars: 3,
      length: 8,
      time: 12,
      hints: 0,
      cars: 2,
    })
    expect(result.progress.unlocked).toBe(2)
    expect(result.progress.completed['level-0001'].stars).toBe(3)
    expect(result.progress.achievements).toContain('first_commute')
    expect(result.progress.stats.cars).toBe(2)
  })

  it('awards stars against the route budget', () => {
    expect(starsFor(10, 10, 0)).toBe(3)
    expect(starsFor(14, 10, 0)).toBe(2)
    expect(starsFor(15, 10, 3)).toBe(1)
    expect(starsFor(30, 10, 0)).toBe(1)
  })

  it('keeps settings changes', () => {
    const progress = updateSettings(defaultProgress(), { sound: false, speed: 1.6 })
    expect(progress.settings.sound).toBe(false)
    expect(loadProgress().settings.speed).toBe(1.6)
  })

  it('falls back to a memory store when local storage is unavailable', () => {
    const store = defaultStore()
    expect(typeof store.getItem('missing')).toBe('object')
  })
})
