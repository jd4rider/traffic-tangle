import { directedKey, parseNodeId, type RoadGraph } from './graph'
import {
  BASE_SPEED,
  EXIT_CLEAR,
  FOLLOW_GAP,
  GRIDLOCK_SECONDS,
  SIM_DT,
  STOP_LINE,
  type Simulation,
  type SimStatus,
  type SimVehicleState,
  type BlockedReason,
} from './simConstants'
import { KIND_SPEED, type ColorId, type LevelDefinition, type RouteMap, type ShapeId } from './types'

export * from './simConstants'

const ACCELERATION = 8
const BRAKING = 16

interface Lock {
  vehicle: string
}

interface SignalRuntime {
  phases: { axis: 'ns' | 'ew'; duration: number }[]
  offset: number
  cycle: number
}

interface Vehicle extends SimVehicleState {
  priority: boolean
}

export interface SimulationOptions {
  /** Overrides level.timeLimit. 0 disables the clock. */
  timeLimit?: number
}

/**
 * Deterministic fixed-step traffic simulation.
 *
 * Rules (also documented in docs/TRAFFIC_ENGINE.md):
 * - Vehicles follow their route at a per-kind speed, braking for the car ahead.
 * - A vehicle stops at the stop line before a junction when the light is red,
 *   the junction is held by another vehicle, or the exit road has no room.
 * - A junction is reserved for the vehicle crossing it until its body clears.
 * - Waiting is never a failure: gridlock needs every active vehicle blocked by
 *   traffic for GRIDLOCK_SECONDS, and the deadline is explicit.
 * - All decisions are pure functions of the previous state and the tick count,
 *   so the same level, routes and timestep always replay identically.
 */
class TrafficSimulation implements Simulation {
  readonly graph: RoadGraph
  readonly level: LevelDefinition
  readonly vehicles: Vehicle[]
  time = 0
  status: SimStatus = 'running'
  reason = ''
  readonly timeLimit: number

  private locks = new Map<string, Lock>()
  private signals = new Map<string, SignalRuntime>()
  private jamTime = 0
  private lastDistance = 0
  private byId = new Map<string, Vehicle>()

  constructor(graph: RoadGraph, level: LevelDefinition, routes: RouteMap, options: SimulationOptions = {}) {
    this.graph = graph
    this.level = level
    this.timeLimit = options.timeLimit ?? level.timeLimit
    const palette: ColorId[] = ['red', 'blue', 'green', 'amber', 'violet', 'teal', 'rose', 'lime']
    const shapes: ShapeId[] = ['circle', 'triangle', 'square', 'star', 'diamond', 'cross', 'heart', 'moon']
    this.vehicles = level.vehicles.map((spec, index) => {
      const route = routes[spec.id] ?? [spec.start, spec.goal]
      const vehicle: Vehicle = {
        id: spec.id,
        kind: spec.kind,
        color: (spec.color ?? palette[index % palette.length]) as ColorId,
        shape: (spec.shape ?? shapes[index % shapes.length]) as ShapeId,
        route,
        link: 0,
        progress: 0,
        speed: 0,
        distance: 0,
        arrived: route.length < 2,
        arrivedAt: route.length < 2 ? 0 : 0,
        blocked: 'none',
        priority: Boolean(spec.priority),
      }
      this.byId.set(vehicle.id, vehicle)
      return vehicle
    })
    for (const signal of level.signals) {
      const cycle = signal.phases.reduce((sum, phase) => sum + Math.max(0.1, phase.duration), 0)
      this.signals.set(signal.at, { phases: signal.phases, offset: signal.offset, cycle })
    }
  }

  /** Current green axis at a signal, or null when the node has no signal. */
  greenAxis(node: string): 'ns' | 'ew' | null {
    const signal = this.signals.get(node)
    if (!signal) return null
    let phase = (this.time + signal.offset) % signal.cycle
    if (phase < 0) phase += signal.cycle
    for (const entry of signal.phases) {
      const duration = Math.max(0.1, entry.duration)
      if (phase < duration) return entry.axis
      phase -= duration
    }
    return signal.phases[signal.phases.length - 1]?.axis ?? null
  }

  private allows(axis: 'ns' | 'ew', node: string): boolean {
    const green = this.greenAxis(node)
    return green === null || green === axis
  }

  /** Room on the road after the junction, so nobody blocks the box. */
  private exitHasRoom(node: string, next: string, self: string): boolean {
    for (const other of this.vehicles) {
      if (other.id === self || other.arrived) continue
      const current = other.route[other.link]
      // Anything still in the junction box blocks it.
      if (current === node && other.progress < 0.5) return false
      // Only traffic heading the same way can fill the road we are entering.
      const sameDirection = current === node && other.route[other.link + 1] === next
      if (sameDirection && other.progress < EXIT_CLEAR) return false
    }
    return true
  }

  private releaseLocks(): void {
    for (const [node, lock] of this.locks) {
      const vehicle = this.byId.get(lock.vehicle)
      if (!vehicle) {
        this.locks.delete(node)
        continue
      }
      if (vehicle.arrived) {
        this.locks.delete(node)
        continue
      }
      const onExit = vehicle.route[vehicle.link] === node
      // A junction is only held while the car is truly in the box. Letting go
      // as soon as the nose is clear keeps a stalled car from freezing cross
      // traffic, which is the one deadlock the rules should never create.
      if (!onExit || vehicle.progress > 0.16 || vehicle.speed < 0.02) this.locks.delete(node)
    }
  }

  private leaderGap(vehicle: Vehicle, from: string, to: string): number {
    let gap = Number.POSITIVE_INFINITY
    for (const other of this.vehicles) {
      if (other.id === vehicle.id || other.arrived) continue
      if (other.route[other.link] !== from || other.route[other.link + 1] !== to) continue
      const difference = other.progress - vehicle.progress
      if (difference > 0 && difference < gap) gap = difference
    }
    return gap
  }

  step(): void {
    if (this.status !== 'running') return
    this.time += SIM_DT
    const time = this.time

    this.releaseLocks()

    let anyTrafficBlock = false
    let anyMoving = false

    for (const vehicle of this.vehicles) {
      if (vehicle.arrived) continue
      const lastLink = vehicle.link === vehicle.route.length - 2
      const from = vehicle.route[vehicle.link]
      const to = vehicle.route[vehicle.link + 1]
      const edge = this.graph.edges.get(directedKey(from, to))
      if (!edge) {
        vehicle.blocked = 'traffic'
        anyTrafficBlock = true
        continue
      }

      vehicle.blocked = 'none'
      let desired = BASE_SPEED * KIND_SPEED[vehicle.kind] * edge.speed

      const gap = this.leaderGap(vehicle, from, to)
      if (gap < FOLLOW_GAP) {
        const allowed = Math.max(0, (gap - FOLLOW_GAP) / SIM_DT)
        if (allowed < desired) desired = allowed
        if (desired < 0.08) {
          desired = 0
          vehicle.blocked = 'traffic'
        }
      }

      const next = vehicle.route[vehicle.link + 2]
      const nextEdge = next ? this.graph.edges.get(directedKey(to, next)) : undefined
      const approach = !lastLink && vehicle.progress >= STOP_LINE - 0.001
      if (approach) {
        const axis = nextEdge?.axis ?? edge.axis
        let block: BlockedReason = 'none'
        if (!this.allows(axis, to)) block = 'signal'
        else if (this.locks.get(to) && this.locks.get(to)!.vehicle !== vehicle.id) block = 'traffic'
        else if (next && !this.exitHasRoom(to, next, vehicle.id)) block = 'traffic'
        if (block !== 'none') {
          desired = 0
          vehicle.blocked = block
        }
      }

      if (desired > vehicle.speed) vehicle.speed = Math.min(desired, vehicle.speed + ACCELERATION * SIM_DT)
      else vehicle.speed = Math.max(desired, vehicle.speed - BRAKING * SIM_DT)
      if (vehicle.speed < 0.02) vehicle.speed = 0

      let target = vehicle.progress + vehicle.speed * SIM_DT
      const stopAt = Math.max(vehicle.progress, STOP_LINE)
      if (vehicle.blocked !== 'none' && !lastLink) target = Math.min(target, stopAt)

      if (target >= 1) {
        if (lastLink) {
          vehicle.distance += 1 - vehicle.progress
          vehicle.progress = 1
          vehicle.speed = 0
          vehicle.arrived = true
          vehicle.arrivedAt = time
          continue
        }
        const lock = this.locks.get(to)
        if ((lock && lock.vehicle !== vehicle.id) || !this.exitHasRoom(to, vehicle.route[vehicle.link + 2], vehicle.id)) {
          vehicle.speed = 0
          vehicle.blocked = 'traffic'
          anyTrafficBlock = true
          continue
        }
        this.locks.set(to, { vehicle: vehicle.id })
        vehicle.distance += target - vehicle.progress
        vehicle.link += 1
        vehicle.progress = Math.min(0.999, target - 1)
      } else {
        vehicle.distance += target - vehicle.progress
        vehicle.progress = target
      }

      if (vehicle.speed > 0.05) anyMoving = true
      if (vehicle.blocked === 'traffic') anyTrafficBlock = true
    }

    const distance = this.vehicles.reduce((sum, vehicle) => sum + vehicle.distance, 0)
    const progressed = distance - this.lastDistance > 0.01
    this.lastDistance = distance

    if (progressed) this.jamTime = 0
    else if (this.vehicles.some((vehicle) => !vehicle.arrived) && !anyMoving) {
      const onlyTraffic = this.vehicles
        .filter((vehicle) => !vehicle.arrived)
        .every((vehicle) => vehicle.blocked === 'traffic')
      if (onlyTraffic && anyTrafficBlock) this.jamTime += SIM_DT
      else this.jamTime = 0
    }

    if (this.vehicles.every((vehicle) => vehicle.arrived)) {
      this.status = 'success'
      this.reason = 'Every car is home.'
      return
    }

    const collision = findCollision(this.vehicles)
    if (collision) {
      this.status = 'collision'
      this.reason = `${collision.a} and ${collision.b} collided.`
      return
    }

    if (this.timeLimit > 0 && time > this.timeLimit) {
      this.status = 'timeout'
      this.reason = 'The clock ran out with cars still on the road.'
      return
    }

    if (this.jamTime > GRIDLOCK_SECONDS) {
      this.status = 'gridlock'
      this.reason = 'Nobody can move: the junction is blocked.'
    }
  }

  /** Fraction of vehicles that have reached their destination. */
  get progressFraction(): number {
    if (this.vehicles.length === 0) return 1
    return (this.vehicles.filter((vehicle) => vehicle.arrived).length + this.partialProgress()) / this.vehicles.length
  }

  private partialProgress(): number {
    let total = 0
    for (const vehicle of this.vehicles) {
      if (vehicle.arrived) continue
      const length = Math.max(1, vehicle.route.length - 1)
      total += (vehicle.link + vehicle.progress) / length
    }
    return total
  }
}

/**
 * Overlap detector. The reservation rules keep cars apart, so this is a safety
 * net: it also protects sandbox maps and any future mechanic that moves a car
 * outside the normal approach logic.
 */
export function findCollision(vehicles: SimVehicleState[]): { a: string; b: string } | null {
  for (let i = 0; i < vehicles.length; i += 1) {
    const a = vehicles[i]
    if (a.arrived) continue
    for (let j = i + 1; j < vehicles.length; j += 1) {
      const b = vehicles[j]
      if (b.arrived) continue
      if (a.route[a.link] !== b.route[b.link]) continue
      if (a.route[a.link + 1] !== b.route[b.link + 1]) continue
      if (Math.abs(a.progress - b.progress) < 0.28) return { a: a.id, b: b.id }
    }
  }
  return null
}

export function createSimulation(
  graph: RoadGraph,
  level: LevelDefinition,
  routes: RouteMap,
  options: SimulationOptions = {},
): Simulation {
  return new TrafficSimulation(graph, level, routes, options)
}

export interface SimResult {
  status: SimStatus
  reason: string
  makespan: number
  time: number
  vehicles: SimVehicleState[]
  ticks: number
}

/** Runs a full simulation to a verdict. Used by the solver, generator and tests. */
export function simulate(
  graph: RoadGraph,
  level: LevelDefinition,
  routes: RouteMap,
  options: SimulationOptions & { maxSeconds?: number } = {},
): SimResult {
  const simulation = createSimulation(graph, level, routes, options)
  const limit = options.maxSeconds ?? (simulation.timeLimit > 0 ? simulation.timeLimit + 6 : 180)
  let ticks = 0
  while (simulation.status === 'running' && simulation.time < limit) {
    simulation.step()
    ticks += 1
  }
  return {
    status: simulation.status,
    reason: simulation.reason,
    makespan: simulation.status === 'success' ? Math.max(...simulation.vehicles.map((vehicle) => vehicle.arrivedAt)) : simulation.time,
    time: simulation.time,
    vehicles: simulation.vehicles.map((vehicle) => ({ ...vehicle })),
    ticks,
  }
}

/** Convenience for rendering: the car's position in road-grid units. */
export function vehiclePose(
  vertex: SimVehicleState,
  graph: RoadGraph,
): { x: number; y: number; angle: number; from: string; to: string } {
  const fromId = vertex.route[Math.min(vertex.link, vertex.route.length - 2)]
  const toId = vertex.route[Math.min(vertex.link + 1, vertex.route.length - 1)]
  const from = graph.nodes.get(fromId)
  const to = graph.nodes.get(toId)
  if (!from || !to) return { x: 0, y: 0, angle: 0, from: fromId, to: toId }
  const t = vertex.arrived ? 1 : Math.min(1, Math.max(0, vertex.progress))
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    angle: Math.atan2(to.y - from.y, to.x - from.x),
    from: fromId,
    to: toId,
  }
}

/** The node a waiting car is queued at, for highlighting jams. */
export function waitingNode(vertex: SimVehicleState): string {
  return vertex.route[Math.min(vertex.link + 1, vertex.route.length - 1)] ?? ''
}

export function nodeCoords(graph: RoadGraph, id: string): { x: number; y: number } {
  return graph.nodes.get(id) ?? parseNodeId(id) ?? { x: 0, y: 0 }
}
