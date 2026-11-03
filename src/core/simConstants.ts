import { SIM_DT } from './types'

export const BASE_SPEED = 2.2
export const FOLLOW_GAP = 0.42
export const STOP_LINE = 0.88
export const EXIT_CLEAR = 0.62
export const GRIDLOCK_SECONDS = 7

export type BlockedReason = 'none' | 'signal' | 'traffic'
export type SimStatus = 'running' | 'success' | 'timeout' | 'gridlock' | 'collision'

export interface SimVehicleState {
  id: string
  kind: import('./types').VehicleKind
  color: import('./types').ColorId
  shape: import('./types').ShapeId
  route: string[]
  link: number
  progress: number
  speed: number
  distance: number
  arrived: boolean
  arrivedAt: number
  blocked: BlockedReason
}

export interface Simulation {
  time: number
  status: SimStatus
  reason: string
  vehicles: SimVehicleState[]
  readonly timeLimit: number
  step(): void
}

export { SIM_DT }
