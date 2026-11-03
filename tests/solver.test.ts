import { describe, expect, it } from 'vitest'
import { buildGraph } from '../src/core/graph'
import { hintFor, replaySolution, solveLevel } from '../src/core/solver'
import { baseVehicle, makeLevel } from './helpers'

const board = () =>
  makeLevel({
    width: 5,
    height: 5,
    timeLimit: 60,
    vehicles: [
      baseVehicle('v1', '0.0', '4.0', { color: 'red', shape: 'circle' }),
      baseVehicle('v2', '0.4', '4.4', { color: 'blue', shape: 'triangle' }),
    ],
  })

describe('solver', () => {
  it('solves a small board and replays the answer through the simulation', () => {
    const level = board()
    const graph = buildGraph(level)
    const result = solveLevel(level, graph, { maxSims: 200, maxMillis: 3000 })
    expect(result.status).toBe('solved')
    expect(result.routes).toBeDefined()
    const replay = replaySolution(level, result.routes!, graph)
    expect(replay.status).toBe('success')
    expect(result.totalLength).toBeGreaterThan(0)
  })

  it('returns unsolvable when a destination has no road', () => {
    const level = makeLevel({
      width: 5,
      height: 5,
      closed: ['3.0|4.0', '4.0|4.1', '4.1|3.1'],
      vehicles: [baseVehicle('v1', '0.0', '4.0')],
    })
    const result = solveLevel(level, buildGraph(level), { maxSims: 10, maxMillis: 500 })
    expect(result.status).toBe('unsolvable')
    expect(result.routes).toBeUndefined()
  })

  it('reports unknown rather than solved when the budget runs out', () => {
    const level = board()
    const result = solveLevel(level, buildGraph(level), { maxSims: 0, maxMillis: 500 })
    expect(result.status).toBe('unknown')
    expect(result.routes).toBeUndefined()
  })

  it('produces a hint that matches the current board state', () => {
    const level = makeLevel({
      width: 5,
      height: 5,
      timeLimit: 60,
      vehicles: [baseVehicle('v1', '0.0', '4.4')],
    })
    const graph = buildGraph(level)
    const hint = hintFor(level, graph, {})
    expect(hint).not.toBeNull()
    expect(hint!.vehicleId).toBe('v1')
    expect(hint!.route[0]).toBe('0.0')
    expect(hint!.route[hint!.route.length - 1]).toBe('4.4')
    expect(replaySolution(level, { v1: hint!.route }, graph).status).toBe('success')
  })

  it('never suggests a route through a closed road', () => {
    const level = makeLevel({
      width: 5,
      height: 5,
      closed: ['2.2|2.3'],
      vehicles: [baseVehicle('v1', '0.0', '4.4')],
    })
    const graph = buildGraph(level)
    const hint = hintFor(level, graph, {})
    expect(hint).not.toBeNull()
    for (let index = 0; index < hint!.route.length - 1; index += 1) {
      expect(graph.edges.has(`${hint!.route[index]}>${hint!.route[index + 1]}`)).toBe(true)
    }
    expect(graph.edges.has('2.2>2.3')).toBe(false)
  })
})
