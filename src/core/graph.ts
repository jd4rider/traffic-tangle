import type { Axis, LevelDefinition } from './types'

export interface RoadNode {
  id: string
  x: number
  y: number
}

export interface RoadEdge {
  id: string
  from: string
  to: string
  axis: Axis
  layer: number
  speed: number
  /** True when the opposite direction does not exist. */
  oneWay: boolean
}

export interface RoadGraph {
  nodes: Map<string, RoadNode>
  edges: Map<string, RoadEdge>
  /** node -> neighbours reachable from it */
  outgoing: Map<string, string[]>
  /** node -> all neighbours, regardless of direction */
  neighbours: Map<string, string[]>
}

export function nodeId(x: number, y: number): string {
  return `${x}.${y}`
}

export function parseNodeId(id: string): { x: number; y: number } | null {
  const match = /^(\d+)\.(\d+)$/.exec(id)
  if (!match) return null
  const x = Number(match[1])
  const y = Number(match[2])
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null
  return { x, y }
}

/** Undirected edge key, used for closures and elevation layers. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export function directedKey(a: string, b: string): string {
  return `${a}>${b}`
}

export function edgeAxis(from: string, to: string): Axis {
  const a = parseNodeId(from)
  const b = parseNodeId(to)
  if (!a || !b) return 'ew'
  return a.x === b.x ? 'ns' : 'ew'
}

const DIRECTIONS: { dx: number; dy: number }[] = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
]

/**
 * Builds the directed road graph for a level. `holes` are missing blocks,
 * `closed` removes both directions of a pair, `oneWay` ("a>b") removes the
 * reverse direction, and `layers` lifts a pair onto a bridge.
 */
export function buildGraph(level: LevelDefinition): RoadGraph {
  return buildRoadGraph(level.width, level.height, level.holes, level.closed, level.oneWay, level.layers)
}

/** Builds the road network without needing a full level (used by the generator). */
export function buildRoadGraph(
  width: number,
  height: number,
  holes: string[],
  closed: string[],
  oneWay: string[],
  layers: Record<string, number> = {},
): RoadGraph {
  const nodes = new Map<string, RoadNode>()
  const holesSet = new Set(holes)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const id = nodeId(x, y)
      if (holesSet.has(id)) continue
      nodes.set(id, { id, x, y })
    }
  }

  const closedSet = new Set(closed)
  const oneWaySet = new Set(oneWay)
  const edges = new Map<string, RoadEdge>()
  const outgoing = new Map<string, string[]>()
  const neighbours = new Map<string, string[]>()
  for (const id of nodes.keys()) {
    outgoing.set(id, [])
    neighbours.set(id, [])
  }

  const addEdge = (from: string, to: string): void => {
    const pair = pairKey(from, to)
    if (closedSet.has(pair)) return
    const forwardBlocked = oneWaySet.has(directedKey(to, from))
    const backwardBlocked = oneWaySet.has(directedKey(from, to))
    if (forwardBlocked) return
    const axis = edgeAxis(from, to)
    const edge: RoadEdge = {
      id: directedKey(from, to),
      from,
      to,
      axis,
      layer: layers[pair] ?? 0,
      speed: 1,
      oneWay: backwardBlocked,
    }
    edges.set(edge.id, edge)
    outgoing.get(from)!.push(to)
    neighbours.get(from)!.push(to)
    if (!backwardBlocked) {
      const reverse: RoadEdge = {
        id: directedKey(to, from),
        from: to,
        to: from,
        axis,
        layer: edge.layer,
        speed: 1,
        oneWay: false,
      }
      edges.set(reverse.id, reverse)
      outgoing.get(to)!.push(from)
      neighbours.get(to)!.push(from)
    }
  }

  for (const node of nodes.values()) {
    for (const direction of DIRECTIONS) {
      const other = nodeId(node.x + direction.dx, node.y + direction.dy)
      if (!nodes.has(other)) continue
      // Add each undirected pair once, from the lower coordinate.
      if (direction.dx === -1 || direction.dy === -1) continue
      addEdge(node.id, other)
    }
  }

  return { nodes, edges, outgoing, neighbours }
}

export function edgeBetween(graph: RoadGraph, from: string, to: string): RoadEdge | undefined {
  return graph.edges.get(directedKey(from, to))
}

/** Breadth-first shortest route in road hops. Null when the goal is unreachable. */
export function shortestPath(graph: RoadGraph, from: string, to: string, maxHops = 64): string[] | null {
  if (!graph.nodes.has(from) || !graph.nodes.has(to)) return null
  if (from === to) return [from]
  const queue: string[] = [from]
  const previous = new Map<string, string>()
  const visited = new Set<string>([from])
  let head = 0
  while (head < queue.length) {
    const current = queue[head]
    head += 1
    if (visited.size > 4096) break
    for (const next of graph.outgoing.get(current) ?? []) {
      if (visited.has(next)) continue
      visited.add(next)
      previous.set(next, current)
      if (next === to) {
        const route: string[] = [to]
        let cursor: string | undefined = to
        while (cursor && cursor !== from) {
          cursor = previous.get(cursor)
          if (!cursor) return null
          route.push(cursor)
        }
        route.reverse()
        return route.length - 1 > maxHops ? null : route
      }
      queue.push(next)
    }
  }
  return null
}

export function routeIsLegal(graph: RoadGraph, route: string[]): boolean {
  if (route.length < 2) return false
  if (!graph.nodes.has(route[0])) return false
  for (let index = 0; index < route.length - 1; index += 1) {
    const edge = graph.edges.get(directedKey(route[index], route[index + 1]))
    if (!edge) return false
  }
  return true
}

/** Number of road hops a route covers. */
export function routeLength(route: string[]): number {
  return Math.max(0, route.length - 1)
}

/** Total length of every assigned route; the star budget uses this. */
export function totalRouteLength(routes: Record<string, string[]>): number {
  return Object.values(routes).reduce((sum, route) => sum + routeLength(route), 0)
}

export function distanceBetween(graph: RoadGraph, from: string, to: string): number {
  const route = shortestPath(graph, from, to)
  return route ? route.length - 1 : Infinity
}

/** Nodes touching at least three roads: the crossings the player must manage. */
export function intersectionNodes(graph: RoadGraph): string[] {
  const result: string[] = []
  for (const [id, list] of graph.neighbours) {
    if (list.length >= 3) result.push(id)
  }
  return result
}
