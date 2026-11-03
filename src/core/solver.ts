import { buildGraph, routeLength, shortestPath, totalRouteLength, type RoadGraph } from './graph'
import { simulate } from './sim'
import type { LevelDefinition, RouteMap } from './types'

export type SolveStatus = 'solved' | 'unsolvable' | 'unknown'

export interface SolveOptions {
  maxSims?: number
  maxMillis?: number
  /** Extra hops allowed above the shortest route for each car. */
  slack?: number
  maxCandidates?: number
  timeLimit?: number
  now?: () => number
}

export interface SolveResult {
  status: SolveStatus
  routes?: RouteMap
  totalLength: number
  makespan: number
  explored: number
  reason: string
}

interface Candidate {
  route: string[]
  length: number
}

/**
 * Enumerates simple paths from `from` to `to` no longer than `maxHops`, shortest
 * first. Bounded in both depth and result count so the solver stays predictable.
 */
export function enumeratePaths(graph: RoadGraph, from: string, to: string, maxHops: number, limit: number): string[][] {
  const found: string[][] = []
  const path: string[] = []
  const visited = new Set<string>()

  const walk = (node: string): void => {
    if (found.length >= limit) return
    path.push(node)
    visited.add(node)
    if (node === to && path.length > 1) {
      found.push(path.slice())
    } else if (path.length - 1 < maxHops) {
      for (const next of graph.outgoing.get(node) ?? []) {
        if (visited.has(next)) continue
        walk(next)
        if (found.length >= limit) break
      }
    }
    path.pop()
    visited.delete(node)
  }

  if (graph.nodes.has(from) && graph.nodes.has(to)) walk(from)
  found.sort((a, b) => a.length - b.length || a.join('>').localeCompare(b.join('>')))
  return found
}

/** Candidate routes for every vehicle, from shortest outwards. */
export function candidateRoutes(
  graph: RoadGraph,
  level: LevelDefinition,
  slack = 2,
  perVehicle = 8,
): Map<string, Candidate[]> {
  const result = new Map<string, Candidate[]>()
  for (const spec of level.vehicles) {
    const shortest = shortestPath(graph, spec.start, spec.goal)
    if (!shortest) {
      result.set(spec.id, [])
      continue
    }
    const maxHops = shortest.length - 1 + slack
    const paths = enumeratePaths(graph, spec.start, spec.goal, maxHops, 60)
    const seen = new Set<string>()
    const candidates: Candidate[] = []
    for (const route of paths) {
      const key = route.join('>')
      if (seen.has(key)) continue
      seen.add(key)
      candidates.push({ route, length: routeLength(route) })
      if (candidates.length >= perVehicle) break
    }
    result.set(spec.id, candidates)
  }
  return result
}

/**
 * Searches combinations of candidate routes and replays each one through the
 * real simulation. It returns the shortest total routing that finishes inside
 * the level clock.
 *
 * `UNSOLVABLE` means the bounded candidate space was exhausted without a
 * finishing plan; `UNKNOWN` means a budget stopped the search early. Neither is
 * ever reported as a solution.
 */
export function solveLevel(level: LevelDefinition, graph: RoadGraph = buildGraph(level), options: SolveOptions = {}): SolveResult {
  const maxSims = options.maxSims ?? 500
  const maxMillis = options.maxMillis ?? 2500
  const slack = options.slack ?? 2
  const perVehicle = options.maxCandidates ?? 8
  const now = options.now ?? (() => Date.now())
  const started = now()
  const timeLimit = options.timeLimit ?? level.timeLimit

  const candidates = candidateRoutes(graph, level, slack, perVehicle)
  if ([...candidates.values()].some((list) => list.length === 0)) {
    return { status: 'unsolvable', totalLength: 0, makespan: 0, explored: 0, reason: 'A car has no legal route to its destination.' }
  }

  const order = [...level.vehicles].sort((a, b) => (candidates.get(a.id)?.length ?? 0) - (candidates.get(b.id)?.length ?? 0))
  const minimumRemaining = new Map<string, number>()
  for (const spec of level.vehicles) minimumRemaining.set(spec.id, candidates.get(spec.id)?.[0]?.length ?? 0)
  const minimumTotal = [...minimumRemaining.values()].reduce((sum, value) => sum + value, 0)

  let best: { routes: RouteMap; length: number; makespan: number } | null = null
  let explored = 0
  let exhausted = false
  let budgetHit = false
  const chosen: RouteMap = {}

  const partialMinimum = (depth: number): number => {
    let sum = 0
    for (let index = depth; index < order.length; index += 1) sum += minimumRemaining.get(order[index].id) ?? 0
    return sum
  }

  const search = (depth: number, length: number): void => {
    if (budgetHit) return
    if (best && length + partialMinimum(depth) >= best.length) return
    if (depth === order.length) {
      if (explored >= maxSims || now() - started > maxMillis) {
        budgetHit = true
        return
      }
      explored += 1
      const result = simulate(graph, level, chosen, { timeLimit })
      if (result.status !== 'success') return
      if (!best || length < best.length || (length === best.length && result.makespan < best.makespan)) {
        best = { routes: { ...chosen }, length, makespan: result.makespan }
      }
      return
    }
    const spec = order[depth]
    for (const candidate of candidates.get(spec.id) ?? []) {
      chosen[spec.id] = candidate.route
      search(depth + 1, length + candidate.length)
      if (budgetHit) return
    }
    delete chosen[spec.id]
    exhausted = true
  }

  search(0, 0)

  if (best) {
    const solved = best as { routes: RouteMap; length: number; makespan: number }
    return {
      status: 'solved',
      routes: solved.routes,
      totalLength: solved.length,
      makespan: solved.makespan,
      explored,
      reason: `All ${level.vehicles.length} cars finish in ${solved.makespan.toFixed(1)}s.`,
    }
  }
  if (budgetHit || explored >= maxSims) {
    return {
      status: 'unknown',
      totalLength: 0,
      makespan: 0,
      explored,
      reason: `Search stopped after ${explored} simulations.`,
    }
  }
  return {
    status: exhausted ? 'unsolvable' : 'unknown',
    totalLength: minimumTotal,
    makespan: 0,
    explored,
    reason: 'No combination of legal routes clears the level in time.',
  }
}

export interface Hint {
  vehicleId: string
  route: string[]
  text: string
  solved: boolean
  makespan: number
}

/**
 * Solver-backed hint for the current player state. Routes the player already
 * set are kept, and only the remaining cars are solved, so a hint is always
 * consistent with what is on the board.
 */
export function hintFor(level: LevelDefinition, graph: RoadGraph, current: RouteMap): Hint | null {
  const partial = Object.keys(current).length > 0
  if (!partial) {
    const solved = solveLevel(level, graph, { maxSims: 500, maxMillis: 2500 })
    if (solved.status !== 'solved' || !solved.routes) return null
    const first = level.vehicles[0]
    const route = solved.routes[first.id]
    if (!route) return null
    return {
      vehicleId: first.id,
      route,
      text: `Start with ${first.kind}: this route keeps the crossings clear.`,
      solved: true,
      makespan: solved.makespan,
    }
  }

  // Keep what the player has planned and complete the rest.
  const remaining = level.vehicles.filter((spec) => !current[spec.id])
  if (remaining.length === 0) {
    const result = simulate(graph, level, current)
    if (result.status === 'success') return null
    return null
  }
  const virtual: LevelDefinition = { ...level, vehicles: [...level.vehicles.filter((spec) => current[spec.id]), ...remaining] }
  const solved = solveLevel(virtual, graph, { maxSims: 400, maxMillis: 2200 })
  if (solved.status !== 'solved' || !solved.routes) return null
  const target = remaining[0]
  const route = solved.routes[target.id]
  if (!route) return null
  return {
    vehicleId: target.id,
    route,
    text: `Try ${target.kind}: this route fits with your other cars.`,
    solved: true,
    makespan: solved.makespan,
  }
}

/** Replays a stored solution through the exact gameplay simulation. */
export function replaySolution(level: LevelDefinition, routes: RouteMap, graph: RoadGraph = buildGraph(level)) {
  return simulate(graph, level, routes, { maxSeconds: Math.max(60, level.timeLimit + 30) })
}

/** Three-star budget: the verified reference length plus a little slack. */
export function parForLevel(level: LevelDefinition): number {
  return level.par || totalRouteLength(level.reference)
}
