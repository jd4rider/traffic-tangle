import {
  buildRoadGraph,
  directedKey,
  distanceBetween,
  intersectionNodes,
  nodeId,
  pairKey,
  routeLength,
  shortestPath,
  totalRouteLength,
  type RoadGraph,
} from './graph'
import { mulberry32, hashString, randInt, shuffle, type Rng } from './rng'
import { simulate } from './sim'
import { COLORS, COLOR_ORDER, SHAPE_ORDER } from './palette'
import {
  GENERATOR_ID,
  GENERATOR_VERSION,
  LEVEL_FORMAT,
  LEVELS_PER_WORLD,
  TOTAL_LEVELS,
  WORLD_COUNT,
  type LevelDefinition,
  type SignalSpec,
  type VehicleKind,
  type VehicleSpec,
} from './types'
import { levelName, WORLDS } from './worlds'

/** Every vehicle class unlocks in a world that can show it off. */
const KIND_UNLOCKS: { kind: VehicleKind; world: number }[] = [
  { kind: 'compact', world: 1 },
  { kind: 'taxi', world: 2 },
  { kind: 'van', world: 3 },
  { kind: 'sports', world: 5 },
  { kind: 'pickup', world: 6 },
  { kind: 'bus', world: 7 },
  { kind: 'truck', world: 9 },
  { kind: 'fire', world: 12 },
  { kind: 'ambulance', world: 13 },
  { kind: 'semi', world: 16 },
]

function kindsFor(world: number): VehicleKind[] {
  return KIND_UNLOCKS.filter((entry) => entry.world <= world).map((entry) => entry.kind)
}

function connected(graph: RoadGraph): boolean {
  if (graph.nodes.size === 0) return false
  const start = graph.nodes.keys().next().value as string
  const seen = new Set<string>([start])
  const queue = [start]
  let head = 0
  while (head < queue.length) {
    const node = queue[head]
    head += 1
    for (const next of graph.neighbours.get(node) ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return seen.size === graph.nodes.size
}

interface Topology {
  width: number
  height: number
  holes: string[]
}

/** Why the most recent attempts were rejected. Used by the bake diagnostics. */
export const generationLog: string[] = []

/** Last rejected simulation state, for debugging generation failures. */
export let generationDebug = ''

export const generationRejections: Record<string, number> = {}

function reject(reason: string): null {
  generationLog.push(reason)
  if (generationLog.length > 40) generationLog.shift()
  generationRejections[reason] = (generationRejections[reason] ?? 0) + 1
  return null
}

function makeTopology(rng: Rng, world: number, tier: number): Topology {
  const width = Math.min(8, 5 + Math.floor((world - 1) / 6) + (tier > 0.7 ? 1 : 0))
  const height = Math.min(10, 7 + Math.floor((world - 1) / 6) + (tier > 0.45 ? 1 : 0))
  const holes: string[] = []
  const interior: string[] = []
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) interior.push(nodeId(x, y))
  }
  const density = 0.08 + tier * 0.14 + Math.min(0.22, world * 0.008)
  const shuffled = shuffle(rng, interior)
  for (const id of shuffled) {
    if (rng() > density) continue
    holes.push(id)
    if (!connected(buildRoadGraph(width, height, holes, [], [], {}))) holes.pop()
  }
  return { width, height, holes }
}

interface PlannedVehicle {
  spec: VehicleSpec
  route: string[]
}

function planVehicles(
  rng: Rng,
  graph: RoadGraph,
  level: LevelDefinition,
  count: number,
): PlannedVehicle[] | null {
  const nodes = [...graph.nodes.keys()].filter((id) => (graph.outgoing.get(id)?.length ?? 0) >= 2)
  const starts = shuffle(rng, nodes)
  const usedStarts = new Set<string>()
  const usedGoals = new Set<string>()
  const kinds = kindsFor(level.world)
  const palette = shuffle(rng, COLOR_ORDER)
  const shapes = shuffle(rng, SHAPE_ORDER)
  const planned: PlannedVehicle[] = []

  const maxHops = 5 + Math.min(10, Math.floor(level.world / 2) + Math.floor((level.index / LEVELS_PER_WORLD) * 6))

  for (let index = 0; index < count; index += 1) {
    const start = starts.find((id) => !usedStarts.has(id) && !usedGoals.has(id))
    if (!start) return reject('no free start node')
    let goal: string | null = null
    let route: string[] | null = null
    for (let tries = 0; tries < 40; tries += 1) {
      const candidate = nodes[Math.floor(rng() * nodes.length)]
      if (!candidate || candidate === start) continue
      if (usedGoals.has(candidate) || usedStarts.has(candidate)) continue
      const path = shortestPath(graph, start, candidate)
      if (!path) continue
      const hops = routeLength(path)
      if (hops < 3 || hops > maxHops) continue
      goal = candidate
      route = path
      break
    }
    if (!goal || !route) return reject('no destination at a useful distance')

    usedStarts.add(start)
    usedGoals.add(goal)
    const kind = kinds[Math.floor(rng() * kinds.length)]
    const color = palette[index % palette.length]
    const shape = shapes[index % shapes.length]
    planned.push({
      spec: {
        id: `v${index + 1}`,
        kind,
        color,
        shape,
        start,
        goal,
        priority: kind === 'fire' || kind === 'ambulance' ? true : undefined,
      },
      route,
    })
  }
  return planned
}

interface Restrictions {
  oneWay: string[]
  closed: string[]
  layers: Record<string, number>
  signals: SignalSpec[]
}

function applyRestrictions(
  rng: Rng,
  graph: RoadGraph,
  level: LevelDefinition,
  planned: PlannedVehicle[],
): Restrictions {
  const usedDirected = new Set<string>()
  const usedNodes = new Set<string>()
  for (const vehicle of planned) {
    const route = vehicle.route
    usedNodes.add(route[0])
    for (let index = 0; index < route.length - 1; index += 1) {
      usedDirected.add(directedKey(route[index], route[index + 1]))
      usedNodes.add(route[index + 1])
    }
  }

  const oneWay: string[] = []
  const closed: string[] = []
  const layers: Record<string, number> = {}
  const signals: SignalSpec[] = []
  const pairs = new Set<string>()
  for (const edge of graph.edges.values()) pairs.add(pairKey(edge.from, edge.to))

  const pairList = [...pairs]
  for (const pair of pairList) {
    const [a, b] = pair.split('|')
    const forward = usedDirected.has(directedKey(a, b))
    const backward = usedDirected.has(directedKey(b, a))
    if (forward && backward) continue
    if (forward) {
      if (level.world >= 3 && rng() < 0.12 + Math.min(0.2, level.world * 0.012)) oneWay.push(directedKey(a, b))
    } else if (backward) {
      if (level.world >= 3 && rng() < 0.12 + Math.min(0.2, level.world * 0.012)) oneWay.push(directedKey(b, a))
    } else if (level.world >= 11 && rng() < 0.05) {
      closed.push(pair)
    }
  }

  if (level.world >= 6) {
    const bridgeCandidates = shuffle(rng, [...usedDirected]).slice(0, 3)
    for (const key of bridgeCandidates) {
      const [from, to] = key.split('>')
      layers[pairKey(from, to)] = 1
    }
  }

  if (level.world >= 4) {
    const junctionCandidates = intersectionNodes(graph).filter((id) => usedNodes.has(id))
    const wanted = Math.min(4, 1 + Math.floor(level.world / 6) + (level.index > 35 ? 1 : 0))
    const chosen = shuffle(rng, junctionCandidates).slice(0, wanted)
    for (const at of chosen) {
      if (rng() < 0.55) continue
      const ns = randInt(rng, 4, 7)
      const ew = randInt(rng, 4, 7)
      const firstIsNs = rng() < 0.5
      signals.push({
        at,
        phases: firstIsNs
          ? [
              { axis: 'ns', duration: ns },
              { axis: 'ew', duration: ew },
            ]
          : [
              { axis: 'ew', duration: ew },
              { axis: 'ns', duration: ns },
            ],
        offset: randInt(rng, 0, 5),
      })
    }
  }

  // Keep bridges away from junctions: an overpass only reads clearly on a
  // straight run between two crossings.
  for (const pair of Object.keys(layers)) {
    const [a, b] = pair.split('|')
    const aJunction = (graph.neighbours.get(a)?.length ?? 0) >= 3
    const bJunction = (graph.neighbours.get(b)?.length ?? 0) >= 3
    if (aJunction && bJunction) delete layers[pair]
  }

  return { oneWay, closed, layers, signals }
}

function sharedRouteCount(planned: PlannedVehicle[]): number {
  const counts = new Map<string, number>()
  for (const vehicle of planned) {
    for (let index = 0; index < vehicle.route.length - 1; index += 1) {
      const key = directedKey(vehicle.route[index], vehicle.route[index + 1])
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  let shared = 0
  for (const count of counts.values()) if (count > 1) shared += 1
  return shared
}

function baseLevel(world: number, index: number): Pick<LevelDefinition, 'id' | 'world' | 'index' | 'name' | 'version'> {
  const global = (world - 1) * LEVELS_PER_WORLD + index + 1
  return {
    id: `level-${String(global).padStart(4, '0')}`,
    world,
    index,
    name: levelName(world, index),
    version: GENERATOR_VERSION,
  }
}

function attemptLevel(world: number, index: number, seed: number, simple = false): LevelDefinition | null {
  const rng = mulberry32(seed)
  const tier = index / (LEVELS_PER_WORLD - 1)
  const topology = makeTopology(rng, world, tier)
  const graph = buildRoadGraph(topology.width, topology.height, topology.holes, [], [], {})
  if (!connected(graph)) return reject('road network disconnected')

  const count = simple
    ? 2
    : Math.min(6, 2 + Math.floor(world / 4) + (tier > 0.55 ? 1 : 0) + (tier > 0.9 ? 1 : 0))
  const base = baseLevel(world, index)
  const draft: LevelDefinition = {
    ...base,
    width: topology.width,
    height: topology.height,
    holes: topology.holes,
    closed: [],
    oneWay: [],
    layers: {},
    signals: [],
    vehicles: [],
    timeLimit: 0,
    par: 0,
    difficulty: 0,
    seed: `${seed}`,
    reference: {},
    referenceMakespan: 0,
  }

  const planned = planVehicles(rng, graph, draft, count)
  if (!planned) return reject('could not plan vehicles')

  const restrictions: Restrictions = simple
    ? { oneWay: [], closed: [], layers: {}, signals: [] }
    : applyRestrictions(rng, graph, draft, planned)
  const reference: Record<string, string[]> = {}
  for (const vehicle of planned) reference[vehicle.spec.id] = vehicle.route

  const level: LevelDefinition = {
    ...draft,
    oneWay: restrictions.oneWay,
    closed: restrictions.closed,
    layers: restrictions.layers,
    signals: restrictions.signals,
    vehicles: planned.map((vehicle) => vehicle.spec),
    reference,
    par: totalRouteLength(reference),
  }

  const finalGraph = buildRoadGraph(level.width, level.height, level.holes, level.closed, level.oneWay, level.layers)
  for (const spec of level.vehicles) {
    if (distanceBetween(finalGraph, spec.start, spec.goal) === Infinity) return reject('a destination became unreachable')
  }

  const simulation = simulate(finalGraph, level, reference, { timeLimit: 0, maxSeconds: 160 })
  if (simulation.status !== 'success') {
    generationDebug = JSON.stringify(
      {
        status: simulation.status,
        reason: simulation.reason,
        time: simulation.time,
        vehicles: simulation.vehicles.map((vehicle) => ({
          id: vehicle.id,
          color: vehicle.color,
          blocked: vehicle.blocked,
          link: vehicle.link,
          progress: Number(vehicle.progress.toFixed(2)),
          speed: Number(vehicle.speed.toFixed(2)),
          route: vehicle.route.join('>'),
        })),
        signals: level.signals,
        oneWay: level.oneWay,
      },
      null,
      1,
    )
    return reject(`reference plan ended as ${simulation.status}`)
  }
  if (!Number.isFinite(simulation.makespan) || simulation.makespan < 2 || simulation.makespan > 140) {
    return reject(`reference makespan out of range (${simulation.makespan.toFixed(1)}s)`)
  }

  if (!simple) {
    if (sharedRouteCount(planned) === 0 && world >= 6) return reject('routes never share a road')
    if (level.par < 6) return reject(`route budget too small (${level.par})`)
    if (world > 3 && level.vehicles.length < 3) return reject('not enough cars')
  }

  const timeLimit = Math.max(16, Math.ceil(simulation.makespan * 1.55 + 6))
  const junctions = intersectionNodes(finalGraph).length
  const difficulty =
    1.5 +
    world * 0.45 +
    level.vehicles.length * 1.6 +
    junctions * 0.35 +
    level.oneWay.length * 0.22 +
    level.signals.length * 0.9 +
    level.par * 0.09 +
    tier * 2

  return {
    ...level,
    timeLimit,
    difficulty: Math.round(difficulty * 10) / 10,
    referenceMakespan: Math.round(simulation.makespan * 100) / 100,
    seed: `${GENERATOR_ID}:${seed}`,
  }
}

/**
 * Builds one campaign level. The generator starts from a working plan: it picks
 * a connected road network, routes every car, applies restrictions that keep
 * the plan legal, then replays the plan through the real simulation before
 * accepting it. Failed attempts are retried with a new deterministic seed.
 */
export function generateLevel(world: number, index: number, seedName?: string): LevelDefinition | null {
  const baseSeed = hashString(seedName ?? `${GENERATOR_ID}:${world}:${index}`)
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const seed = (baseSeed ^ Math.imul(attempt + 1, 0x9e3779b9)) >>> 0
    const level = attemptLevel(world, index, seed)
    if (level) return level
  }
  // Fallback: a simpler two-car board with no restrictions still teaches the
  // world's route shape, and is verified the same way as every other level.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const seed = (baseSeed ^ Math.imul(attempt + 101, 0x85ebca6b)) >>> 0
    const level = attemptLevel(world, index, seed, true)
    if (level) return level
  }
  return null
}

/** Generates a level for another game mode (endless, daily, sandbox). */
export function generateWithSeed(seedText: string, world: number, index = 0): LevelDefinition | null {
  return generateLevel(world, index, seedText)
}

/** Builds the whole campaign, throwing if any level cannot be constructed. */
export function generateCampaign(): LevelDefinition[] {
  const levels: LevelDefinition[] = []
  for (let world = 1; world <= WORLD_COUNT; world += 1) {
    for (let index = 0; index < LEVELS_PER_WORLD; index += 1) {
      const level = generateLevel(world, index)
      if (!level) {
        throw new Error(`Could not generate level ${(world - 1) * LEVELS_PER_WORLD + index + 1} (world ${world}, index ${index})`)
      }
      levels.push(level)
    }
  }
  if (levels.length !== TOTAL_LEVELS) throw new Error(`Expected ${TOTAL_LEVELS} levels, built ${levels.length}`)
  return levels
}

export function describeLevel(level: LevelDefinition): string {
  const theme = WORLDS[level.world - 1]
  const total = level.vehicles.reduce((sum, spec) => sum + routeLength(level.reference[spec.id] ?? []), 0)
  const color = COLORS[level.vehicles[0]?.color ?? 'red'].name
  return `${theme.name} \u00b7 ${level.vehicles.length} cars \u00b7 ${total} road hops \u00b7 ${color}-led`
}

export { LEVEL_FORMAT }
