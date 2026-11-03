import { buildGraph, distanceBetween, parseNodeId, pairKey, routeIsLegal, routeLength, totalRouteLength } from './graph'
import { simulate } from './sim'
import {
  GENERATOR_VERSION,
  KIND_LABEL,
  LEVEL_FORMAT,
  LEVELS_PER_WORLD,
  TOTAL_LEVELS,
  WORLD_COUNT,
  isColorId,
  isShapeId,
  type LevelDefinition,
  type LevelManifest,
  type VehicleKind,
} from './types'

const KINDS = new Set(Object.keys(KIND_LABEL))

function isNodeIn(level: LevelDefinition, id: string): boolean {
  const parsed = parseNodeId(id)
  if (!parsed) return false
  if (parsed.x < 0 || parsed.y < 0 || parsed.x >= level.width || parsed.y >= level.height) return false
  return !level.holes.includes(id)
}

/**
 * Structural validation. Every shipped level must return no problems, and the
 * campaign test runs this over all 1,000 levels before any build is allowed.
 */
export function validateLevel(level: LevelDefinition): string[] {
  const problems: string[] = []
  if (typeof level.id !== 'string' || !level.id) problems.push('missing id')
  if (!Number.isInteger(level.world) || level.world < 1 || level.world > WORLD_COUNT) problems.push('world out of range')
  if (!Number.isInteger(level.index) || level.index < 0 || level.index >= LEVELS_PER_WORLD) problems.push('index out of range')
  if (level.version !== GENERATOR_VERSION) problems.push('generator version mismatch')
  if (!Number.isInteger(level.width) || level.width < 4 || level.width > 9) problems.push('width out of range')
  if (!Number.isInteger(level.height) || level.height < 5 || level.height > 11) problems.push('height out of range')
  if (level.width > level.height) problems.push('board is not portrait')
  if (level.vehicles.length < 2 || level.vehicles.length > 6) problems.push('vehicle count out of range')
  if (!(level.timeLimit > 0)) problems.push('missing time limit')
  if (!(level.par > 0)) problems.push('missing par')

  for (const hole of level.holes) {
    const parsed = parseNodeId(hole)
    if (!parsed || parsed.x < 0 || parsed.y < 0 || parsed.x >= level.width || parsed.y >= level.height) {
      problems.push(`bad hole ${hole}`)
    }
  }

  for (const pair of level.closed) {
    const [a, b] = pair.split('|')
    if (!a || !b || pairKey(a, b) !== pair) problems.push(`bad closure ${pair}`)
    if (!isNodeIn(level, a) || !isNodeIn(level, b)) problems.push(`closure on missing node ${pair}`)
  }

  for (const key of level.oneWay) {
    const [a, b] = key.split('>')
    if (!a || !b) {
      problems.push(`bad one-way ${key}`)
      continue
    }
    if (!isNodeIn(level, a) || !isNodeIn(level, b)) problems.push(`one-way on missing node ${key}`)
  }

  for (const [pair, layer] of Object.entries(level.layers)) {
    const [a, b] = pair.split('|')
    if (!a || !b || pairKey(a, b) !== pair) problems.push(`bad bridge ${pair}`)
    if (layer !== 0 && layer !== 1) problems.push(`bad bridge layer ${pair}`)
  }

  for (const signal of level.signals) {
    if (!isNodeIn(level, signal.at)) problems.push(`signal on missing node ${signal.at}`)
    if (!Array.isArray(signal.phases) || signal.phases.length === 0) problems.push(`signal ${signal.at} has no phases`)
    for (const phase of signal.phases) {
      if (phase.axis !== 'ns' && phase.axis !== 'ew') problems.push(`signal ${signal.at} has a bad axis`)
      if (!(phase.duration > 0)) problems.push(`signal ${signal.at} has a bad duration`)
    }
    if (!Number.isFinite(signal.offset) || signal.offset < 0) problems.push(`signal ${signal.at} has a bad offset`)
  }

  const ids = new Set<string>()
  const starts = new Set<string>()
  const goals = new Set<string>()
  const looks = new Set<string>()
  for (const spec of level.vehicles) {
    if (ids.has(spec.id)) problems.push(`duplicate vehicle id ${spec.id}`)
    ids.add(spec.id)
    if (!KINDS.has(spec.kind)) problems.push(`unknown vehicle kind ${spec.kind}`)
    if (!isColorId(spec.color)) problems.push(`bad colour on ${spec.id}`)
    if (!isShapeId(spec.shape)) problems.push(`bad shape on ${spec.id}`)
    if (!isNodeIn(level, spec.start)) problems.push(`bad start node ${spec.start}`)
    if (!isNodeIn(level, spec.goal)) problems.push(`bad goal node ${spec.goal}`)
    if (spec.start === spec.goal) problems.push(`${spec.id} starts at its destination`)
    if (starts.has(spec.start)) problems.push(`two cars start on ${spec.start}`)
    if (goals.has(spec.goal)) problems.push(`two cars share destination ${spec.goal}`)
    starts.add(spec.start)
    goals.add(spec.goal)
    const look = `${spec.color}/${spec.shape}`
    if (looks.has(look)) problems.push(`two cars share the ${look} look`)
    looks.add(look)
  }

  const graph = buildGraph(level)
  for (const spec of level.vehicles) {
    if (!graph.nodes.has(spec.start) || !graph.nodes.has(spec.goal)) continue
    if (distanceBetween(graph, spec.start, spec.goal) === Infinity) problems.push(`${spec.id} has no legal road to its destination`)
    const reference = level.reference[spec.id]
    if (!reference) {
      problems.push(`${spec.id} has no reference route`)
      continue
    }
    if (reference[0] !== spec.start) problems.push(`${spec.id} reference starts at ${reference[0]}`)
    if (reference[reference.length - 1] !== spec.goal) problems.push(`${spec.id} reference ends at ${reference[reference.length - 1]}`)
    if (!routeIsLegal(graph, reference)) problems.push(`${spec.id} reference uses a closed road`)
    if (routeLength(reference) < 2) problems.push(`${spec.id} reference is too short`)
  }

  if (Object.keys(level.reference).length !== level.vehicles.length) problems.push('reference count mismatch')
  const referenceLength = totalRouteLength(level.reference)
  if (level.par !== referenceLength) problems.push(`par ${level.par} does not match reference ${referenceLength}`)

  if (problems.length === 0) {
    const replay = simulate(graph, level, level.reference, { maxSeconds: Math.max(90, level.timeLimit + 20) })
    if (replay.status !== 'success') {
      problems.push(`reference replay ended as ${replay.status}: ${replay.reason}`)
    } else if (replay.makespan > level.timeLimit) {
      problems.push(`reference needs ${replay.makespan.toFixed(1)}s but the limit is ${level.timeLimit}s`)
    } else if (Math.abs(replay.makespan - level.referenceMakespan) > 0.6) {
      problems.push(`recorded makespan ${level.referenceMakespan} != replay ${replay.makespan.toFixed(2)}`)
    }
  }

  if (!Number.isFinite(level.difficulty) || level.difficulty <= 0) problems.push('bad difficulty')
  return problems
}

export function validateManifest(manifest: LevelManifest): string[] {
  const problems: string[] = []
  if (manifest.format !== LEVEL_FORMAT) problems.push(`format ${manifest.format} is not ${LEVEL_FORMAT}`)
  if (manifest.levels.length !== TOTAL_LEVELS) problems.push(`expected ${TOTAL_LEVELS} levels, found ${manifest.levels.length}`)
  const seen = new Set<string>()
  for (const level of manifest.levels) {
    if (seen.has(level.id)) problems.push(`duplicate level id ${level.id}`)
    seen.add(level.id)
    for (const problem of validateLevel(level)) problems.push(`${level.id}: ${problem}`)
  }
  return problems
}

export function isVehicleKind(value: string): value is VehicleKind {
  return KINDS.has(value)
}
