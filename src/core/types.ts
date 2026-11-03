// Shared game data. Everything here is serialisable: a level is fully described
// by this object, and the deterministic simulation consumes it without ever
// touching Phaser.

export const WORLD_COUNT = 20
export const LEVELS_PER_WORLD = 50
export const TOTAL_LEVELS = WORLD_COUNT * LEVELS_PER_WORLD

/** Fixed simulation timestep. All validation, baking and play use this value. */
export const SIM_DT = 1 / 60
export const LEVEL_FORMAT = 1
export const GENERATOR_VERSION = 1
export const GENERATOR_ID = 'traffic-tangle/roads-v1'

export type Axis = 'ns' | 'ew'

export type ColorId = 'red' | 'blue' | 'green' | 'amber' | 'violet' | 'teal' | 'rose' | 'lime'

/** Shape is the non-colour channel: accessibility and route readability. */
export type ShapeId = 'circle' | 'triangle' | 'square' | 'star' | 'diamond' | 'cross' | 'heart' | 'moon'

export type VehicleKind =
  | 'compact'
  | 'sports'
  | 'taxi'
  | 'van'
  | 'pickup'
  | 'bus'
  | 'fire'
  | 'ambulance'
  | 'truck'
  | 'semi'

export const KIND_SPEED: Record<VehicleKind, number> = {
  compact: 1,
  sports: 1.22,
  taxi: 1.06,
  van: 0.92,
  pickup: 0.9,
  bus: 0.8,
  fire: 1.16,
  ambulance: 1.12,
  truck: 0.78,
  semi: 0.7,
}

export const KIND_LENGTH: Record<VehicleKind, number> = {
  compact: 0.5,
  sports: 0.5,
  taxi: 0.5,
  van: 0.58,
  pickup: 0.56,
  bus: 0.76,
  fire: 0.72,
  ambulance: 0.68,
  truck: 0.66,
  semi: 0.82,
}

export const KIND_LABEL: Record<VehicleKind, string> = {
  compact: 'Compact',
  sports: 'Sports car',
  taxi: 'Taxi',
  van: 'Delivery van',
  pickup: 'Pickup',
  bus: 'City bus',
  fire: 'Fire engine',
  ambulance: 'Ambulance',
  truck: 'Box truck',
  semi: 'Semi-truck',
}

export interface VehicleSpec {
  id: string
  kind: VehicleKind
  color: ColorId
  shape: ShapeId
  /** Start node id, e.g. "3.4". */
  start: string
  /** Destination node id. */
  goal: string
  /** Emergency vehicles are drawn with a beacon; rules are unchanged. */
  priority?: boolean
}

export interface SignalPhase {
  axis: Axis
  duration: number
}

export interface SignalSpec {
  /** Node the signal controls. */
  at: string
  phases: SignalPhase[]
  /** Seconds added to the cycle clock, adjustable by the player. */
  offset: number
}

/**
 * A complete level. Roads are implied by the grid: every orthogonally adjacent
 * pair of live nodes has a two-way road unless it is listed in `closed`, and
 * `oneWay` entries ("a>b") remove the opposite direction.
 */
export interface LevelDefinition {
  id: string
  world: number
  index: number
  name: string
  width: number
  height: number
  holes: string[]
  closed: string[]
  oneWay: string[]
  /** Edge pair key ("a|b") -> elevation layer for bridges and tunnels. */
  layers: Record<string, number>
  signals: SignalSpec[]
  vehicles: VehicleSpec[]
  /** Seconds until the level fails. 0 means untimed (Zen). */
  timeLimit: number
  /** Sum of the reference route lengths, the three-star target. */
  par: number
  difficulty: number
  seed: string
  /** Verified reference routes, keyed by vehicle id. */
  reference: Record<string, string[]>
  referenceMakespan: number
  version: number
}

export interface LevelManifest {
  format: number
  generator: string
  levels: LevelDefinition[]
}

export type GameMode = 'journey' | 'zen' | 'daily' | 'endless' | 'sandbox'

export interface RouteMap {
  [vehicleId: string]: string[]
}

export interface RouteRun {
  vehicles: { id: string; route: string[] }[]
}

export function isColorId(value: unknown): value is ColorId {
  return (
    value === 'red' ||
    value === 'blue' ||
    value === 'green' ||
    value === 'amber' ||
    value === 'violet' ||
    value === 'teal' ||
    value === 'rose' ||
    value === 'lime'
  )
}

export function isShapeId(value: unknown): value is ShapeId {
  return (
    value === 'circle' ||
    value === 'triangle' ||
    value === 'square' ||
    value === 'star' ||
    value === 'diamond' ||
    value === 'cross' ||
    value === 'heart' ||
    value === 'moon'
  )
}
