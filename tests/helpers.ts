import { buildGraph, shortestPath, type RoadGraph } from '../src/core/graph'
import type { LevelDefinition, RouteMap, SignalSpec, VehicleSpec } from '../src/core/types'

export const baseVehicle = (id: string, start: string, goal: string, overrides: Partial<VehicleSpec> = {}): VehicleSpec => ({
  id,
  kind: 'compact',
  color: 'red',
  shape: 'circle',
  start,
  goal,
  ...overrides,
})

export interface LevelParts {
  width?: number
  height?: number
  holes?: string[]
  closed?: string[]
  oneWay?: string[]
  layers?: Record<string, number>
  signals?: SignalSpec[]
  vehicles: VehicleSpec[]
  timeLimit?: number
  id?: string
  world?: number
  index?: number
}

/**
 * Builds a level whose reference routes are the graph's shortest paths, so a
 * handcrafted test board is always internally consistent.
 */
export function makeLevel(parts: LevelParts): LevelDefinition {
  const draft: LevelDefinition = {
    id: parts.id ?? 'test-level',
    world: parts.world ?? 1,
    index: parts.index ?? 0,
    name: 'Test Level',
    width: parts.width ?? 5,
    height: parts.height ?? 5,
    holes: parts.holes ?? [],
    closed: parts.closed ?? [],
    oneWay: parts.oneWay ?? [],
    layers: parts.layers ?? {},
    signals: parts.signals ?? [],
    vehicles: parts.vehicles,
    timeLimit: parts.timeLimit ?? 60,
    par: 0,
    difficulty: 1,
    seed: 'test',
    reference: {},
    referenceMakespan: 0,
    version: 1,
  }
  const graph = buildGraph(draft)
  const reference: RouteMap = {}
  for (const vehicle of draft.vehicles) {
    const route = shortestPath(graph, vehicle.start, vehicle.goal)
    if (route) reference[vehicle.id] = route
  }
  draft.reference = reference
  draft.par = Object.values(reference).reduce((sum, route) => sum + Math.max(0, route.length - 1), 0)
  return draft
}

export function graphFor(level: LevelDefinition): RoadGraph {
  return buildGraph(level)
}

export function straightRoutes(level: LevelDefinition): RouteMap {
  return { ...level.reference }
}
