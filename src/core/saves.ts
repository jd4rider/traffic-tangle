import { evaluateAchievements } from './achievements'
import { TOTAL_LEVELS } from './types'

export interface LevelRecord {
  stars: number
  bestLength: number
  bestTime: number
  hints: number
  at: number
}

export interface Settings {
  sound: boolean
  music: boolean
  reducedMotion: boolean
  highContrast: boolean
  /** Simulation speed multiplier: 0.5 slow, 1 normal, 1.6 fast. */
  speed: number
}

export interface Stats {
  levels: number
  cars: number
  routes: number
  threeStars: number
  hints: number
  dailyPlayed: number
  endlessBest: number
}

export interface SandboxSave {
  id: string
  name: string
  width: number
  height: number
  holes: string[]
  vehicles: { id: string; start: string; goal: string }[]
  at: number
}

export interface Progress {
  version: number
  completed: Record<string, LevelRecord>
  achievements: string[]
  settings: Settings
  unlocked: number
  stats: Stats
  daily: Record<string, { stars: number; length: number; time: number }>
  endless: { best: number; runs: number }
  sandbox: SandboxSave[]
}

export interface SaveStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

export const SAVE_VERSION = 1
export const STORAGE_KEY = 'traffic-tangle-save-v1'
export const SESSION_KEY = 'traffic-tangle-session-v1'

function memoryStore(): SaveStore {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  }
}

const fallback = memoryStore()

export function defaultStore(): SaveStore {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__tt_probe__'
      localStorage.setItem(probe, '1')
      localStorage.removeItem(probe)
      return localStorage
    }
  } catch {
    // Private mode or blocked storage: play on with a session store.
  }
  return fallback
}

export function defaultSettings(): Settings {
  return { sound: true, music: true, reducedMotion: false, highContrast: false, speed: 1 }
}

export function defaultProgress(): Progress {
  return {
    version: SAVE_VERSION,
    completed: {},
    achievements: [],
    settings: defaultSettings(),
    unlocked: 1,
    stats: { levels: 0, cars: 0, routes: 0, threeStars: 0, hints: 0, dailyPlayed: 0, endlessBest: 0 },
    daily: {},
    endless: { best: 0, runs: 0 },
    sandbox: [],
  }
}

const clampNumber = (value: unknown, min: number, max: number, fallbackValue: number): number => {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallbackValue
  return Math.min(max, Math.max(min, number))
}

const bool = (value: unknown, fallbackValue: boolean): boolean => (typeof value === 'boolean' ? value : fallbackValue)

/** Never trust a stored blob: rebuild a clean Progress from whatever is there. */
export function sanitizeProgress(raw: unknown): Progress {
  const clean = defaultProgress()
  if (!raw || typeof raw !== 'object') return clean
  const value = raw as Record<string, unknown>

  if (value.completed && typeof value.completed === 'object') {
    for (const [id, record] of Object.entries(value.completed as Record<string, unknown>)) {
      if (!record || typeof record !== 'object') continue
      const entry = record as Record<string, unknown>
      clean.completed[id] = {
        stars: Math.round(clampNumber(entry.stars, 0, 3, 0)),
        bestLength: Math.round(clampNumber(entry.bestLength, 0, 999, 0)),
        bestTime: clampNumber(entry.bestTime, 0, 9999, 0),
        hints: Math.round(clampNumber(entry.hints, 0, 999, 0)),
        at: Math.round(clampNumber(entry.at, 0, Number.MAX_SAFE_INTEGER, 0)),
      }
    }
  }

  if (Array.isArray(value.achievements)) {
    clean.achievements = [...new Set(value.achievements.filter((id): id is string => typeof id === 'string'))]
  }

  if (value.settings && typeof value.settings === 'object') {
    const settings = value.settings as Record<string, unknown>
    clean.settings = {
      sound: bool(settings.sound, true),
      music: bool(settings.music, true),
      reducedMotion: bool(settings.reducedMotion, false),
      highContrast: bool(settings.highContrast, false),
      speed: clampNumber(settings.speed, 0.5, 1.6, 1),
    }
  }

  clean.unlocked = Math.round(clampNumber(value.unlocked, 1, TOTAL_LEVELS, 1))

  if (value.stats && typeof value.stats === 'object') {
    const stats = value.stats as Record<string, unknown>
    clean.stats = {
      levels: Math.round(clampNumber(stats.levels, 0, 1_000_000, 0)),
      cars: Math.round(clampNumber(stats.cars, 0, 10_000_000, 0)),
      routes: Math.round(clampNumber(stats.routes, 0, 10_000_000, 0)),
      threeStars: Math.round(clampNumber(stats.threeStars, 0, 1_000_000, 0)),
      hints: Math.round(clampNumber(stats.hints, 0, 1_000_000, 0)),
      dailyPlayed: Math.round(clampNumber(stats.dailyPlayed, 0, 1_000_000, 0)),
      endlessBest: Math.round(clampNumber(stats.endlessBest, 0, 100_000, 0)),
    }
  }

  if (value.daily && typeof value.daily === 'object') {
    for (const [date, record] of Object.entries(value.daily as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !record || typeof record !== 'object') continue
      const entry = record as Record<string, unknown>
      clean.daily[date] = {
        stars: Math.round(clampNumber(entry.stars, 0, 3, 0)),
        length: Math.round(clampNumber(entry.length, 0, 999, 0)),
        time: clampNumber(entry.time, 0, 9999, 0),
      }
    }
  }

  if (value.endless && typeof value.endless === 'object') {
    const endless = value.endless as Record<string, unknown>
    clean.endless = {
      best: Math.round(clampNumber(endless.best, 0, 100_000, 0)),
      runs: Math.round(clampNumber(endless.runs, 0, 100_000, 0)),
    }
  }

  if (Array.isArray(value.sandbox)) {
    clean.sandbox = value.sandbox
      .filter((entry): entry is SandboxSave => Boolean(entry) && typeof entry === 'object' && typeof (entry as SandboxSave).id === 'string')
      .slice(0, 20)
      .map((entry) => ({
        id: entry.id,
        name: typeof entry.name === 'string' ? entry.name.slice(0, 40) : 'My garden city',
        width: Math.round(clampNumber(entry.width, 4, 9, 6)),
        height: Math.round(clampNumber(entry.height, 5, 11, 8)),
        holes: Array.isArray(entry.holes) ? entry.holes.filter((hole): hole is string => typeof hole === 'string') : [],
        vehicles: Array.isArray(entry.vehicles)
          ? entry.vehicles
              .filter((vehicle) => vehicle && typeof vehicle.start === 'string' && typeof vehicle.goal === 'string')
              .slice(0, 6)
              .map((vehicle, index) => ({ id: vehicle.id ?? `v${index + 1}`, start: vehicle.start, goal: vehicle.goal }))
          : [],
        at: Math.round(clampNumber(entry.at, 0, Number.MAX_SAFE_INTEGER, 0)),
      }))
  }

  return clean
}

export function loadProgress(store: SaveStore = defaultStore()): Progress {
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return defaultProgress()
    return sanitizeProgress(JSON.parse(raw))
  } catch {
    return defaultProgress()
  }
}

export function saveProgress(progress: Progress, store: SaveStore = defaultStore()): void {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // A full quota must never end the session.
  }
}

/** Conservative merge: the best of both sides, never a regression. */
export function mergeProgress(local: Progress, cloud: Progress): Progress {
  const merged = sanitizeProgress(local)
  for (const [id, record] of Object.entries(cloud.completed)) {
    const existing = merged.completed[id]
    if (!existing) {
      merged.completed[id] = { ...record }
      continue
    }
    merged.completed[id] = {
      stars: Math.max(existing.stars, record.stars),
      bestLength: existing.bestLength <= 0 ? record.bestLength : record.bestLength <= 0 ? existing.bestLength : Math.min(existing.bestLength, record.bestLength),
      bestTime: existing.bestTime <= 0 ? record.bestTime : record.bestTime <= 0 ? existing.bestTime : Math.min(existing.bestTime, record.bestTime),
      hints: Math.min(existing.hints, record.hints),
      at: Math.max(existing.at, record.at),
    }
  }
  merged.achievements = [...new Set([...merged.achievements, ...cloud.achievements])]
  merged.unlocked = Math.max(merged.unlocked, cloud.unlocked)
  merged.stats = {
    levels: Math.max(merged.stats.levels, cloud.stats.levels),
    cars: Math.max(merged.stats.cars, cloud.stats.cars),
    routes: Math.max(merged.stats.routes, cloud.stats.routes),
    threeStars: Math.max(merged.stats.threeStars, cloud.stats.threeStars),
    hints: Math.max(merged.stats.hints, cloud.stats.hints),
    dailyPlayed: Math.max(merged.stats.dailyPlayed, cloud.stats.dailyPlayed),
    endlessBest: Math.max(merged.stats.endlessBest, cloud.stats.endlessBest),
  }
  merged.daily = { ...cloud.daily, ...merged.daily }
  merged.endless = {
    best: Math.max(merged.endless.best, cloud.endless.best),
    runs: Math.max(merged.endless.runs, cloud.endless.runs),
  }
  return merged
}

export function starsFor(totalLength: number, par: number, hints: number): number {
  if (hints === 0 && totalLength <= par) return 3
  if (hints <= 2 && totalLength <= Math.ceil(par * 1.4)) return 2
  return 1
}

export interface CompletionInput {
  levelId: string
  levelNumber: number
  stars: number
  length: number
  time: number
  hints: number
  cars: number
  dailyKey?: string
}

export interface CompletionResult {
  progress: Progress
  newAchievements: string[]
  bestLength: number
  improved: boolean
}

export function recordCompletion(progress: Progress, input: CompletionInput): CompletionResult {
  const next = sanitizeProgress(progress)
  const existing = next.completed[input.levelId]
  const bestLength = existing && existing.bestLength > 0 ? Math.min(existing.bestLength, input.length) : input.length
  const bestTime = existing && existing.bestTime > 0 ? Math.min(existing.bestTime, input.time) : input.time
  const improved = !existing || input.stars > existing.stars || input.length < (existing.bestLength || Infinity)
  next.completed[input.levelId] = {
    stars: Math.max(existing?.stars ?? 0, input.stars),
    bestLength,
    bestTime,
    hints: existing ? Math.min(existing.hints, input.hints) : input.hints,
    at: Date.now(),
  }
  next.unlocked = Math.max(next.unlocked, Math.min(TOTAL_LEVELS, input.levelNumber + 1))
  next.stats.levels = Object.keys(next.completed).length
  next.stats.cars += input.cars
  next.stats.routes += input.length
  next.stats.hints += input.hints
  next.stats.threeStars = Object.values(next.completed).filter((record) => record.stars >= 3).length
  next.stats.endlessBest = Math.max(next.stats.endlessBest, next.endless.best)
  if (input.dailyKey) {
    const previous = next.daily[input.dailyKey]
    next.daily[input.dailyKey] = {
      stars: Math.max(previous?.stars ?? 0, input.stars),
      length: previous ? Math.min(previous.length || input.length, input.length) : input.length,
      time: previous ? Math.min(previous.time || input.time, input.time) : input.time,
    }
    next.stats.dailyPlayed += 1
  }
  const newAchievements = evaluateAchievements(next)
  saveProgress(next)
  return { progress: next, newAchievements, bestLength, improved }
}

export function recordEndless(progress: Progress, cleared: number): Progress {
  const next = sanitizeProgress(progress)
  next.endless.best = Math.max(next.endless.best, cleared)
  next.endless.runs += 1
  next.stats.endlessBest = Math.max(next.stats.endlessBest, next.endless.best)
  saveProgress(next)
  return next
}

export function updateSettings(progress: Progress, patch: Partial<Settings>): Progress {
  const next = sanitizeProgress(progress)
  next.settings = { ...next.settings, ...patch }
  saveProgress(next)
  return next
}

export function saveSandbox(progress: Progress, creation: SandboxSave): Progress {
  const next = sanitizeProgress(progress)
  next.sandbox = [creation, ...next.sandbox.filter((entry) => entry.id !== creation.id)].slice(0, 20)
  saveProgress(next)
  return next
}

export interface SavedSession {
  version: number
  levelId: string
  routes: Record<string, string[]>
  hints: number
  mode: 'journey' | 'zen' | 'daily' | 'endless' | 'sandbox'
  dailyKey?: string
  runSeed?: string
  stage?: number
  at: number
}

export function saveSession(session: SavedSession, store: SaveStore = defaultStore()): void {
  try {
    store.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // ignore
  }
}

export function loadSession(store: SaveStore = defaultStore()): SavedSession | null {
  try {
    const raw = store.getItem(SESSION_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as SavedSession
    if (!value || value.version !== SAVE_VERSION || typeof value.levelId !== 'string') return null
    if (!value.routes || typeof value.routes !== 'object') return null
    return value
  } catch {
    return null
  }
}

export function clearSession(store: SaveStore = defaultStore()): void {
  try {
    store.removeItem?.(SESSION_KEY)
  } catch {
    // ignore
  }
}

export function totalStars(progress: Progress): number {
  return Object.values(progress.completed).reduce((sum, record) => sum + record.stars, 0)
}
