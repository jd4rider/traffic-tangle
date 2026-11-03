import { describe, expect, it } from 'vitest'
import { buildGraph, directedKey, routeIsLegal, shortestPath, type RoadGraph } from '../src/core/graph'
import { createSimulation, findCollision, simulate, vehiclePose } from '../src/core/sim'
import type { LevelDefinition, RouteMap } from '../src/core/types'
import { baseVehicle, graphFor, makeLevel } from './helpers'

const twoCars = (): LevelDefinition =>
  makeLevel({
    width: 4,
    height: 4,
    vehicles: [
      baseVehicle('v1', '0.0', '3.0', { color: 'red', shape: 'circle' }),
      baseVehicle('v2', '0.1', '3.1', { color: 'blue', shape: 'triangle' }),
    ],
    timeLimit: 60,
  })

describe('road graph', () => {
  it('creates two-way roads by default', () => {
    const graph = buildGraph(twoCars())
    expect(graph.edges.has(directedKey('0.0', '1.0'))).toBe(true)
    expect(graph.edges.has(directedKey('1.0', '0.0'))).toBe(true)
  })

  it('honours one-way streets and closures', () => {
    const level = makeLevel({
      width: 4,
      height: 4,
      oneWay: [directedKey('0.0', '1.0')],
      closed: ['2.0|3.0'],
      vehicles: [baseVehicle('v1', '0.0', '3.1')],
    })
    const graph = buildGraph(level)
    expect(graph.edges.has(directedKey('0.0', '1.0'))).toBe(true)
    expect(graph.edges.has(directedKey('1.0', '0.0'))).toBe(false)
    expect(graph.edges.has(directedKey('2.0', '3.0'))).toBe(false)
    expect(graph.edges.has(directedKey('3.0', '2.0'))).toBe(false)
  })

  it('removes missing blocks from the network', () => {
    const level = makeLevel({
      width: 4,
      height: 4,
      holes: ['1.1'],
      vehicles: [baseVehicle('v1', '0.0', '3.3')],
    })
    const graph = buildGraph(level)
    expect(graph.nodes.has('1.1')).toBe(false)
    expect(graph.edges.has(directedKey('0.1', '1.1'))).toBe(false)
  })

  it('finds a shortest route that only uses open roads', () => {
    const level = makeLevel({
      width: 5,
      height: 5,
      oneWay: [directedKey('0.0', '1.0')],
      vehicles: [baseVehicle('v1', '0.0', '4.4')],
    })
    const graph = buildGraph(level)
    const route = shortestPath(graph, '0.0', '4.4')
    expect(route).not.toBeNull()
    expect(route![0]).toBe('0.0')
    expect(route![route!.length - 1]).toBe('4.4')
    expect(routeIsLegal(graph, route!)).toBe(true)
    expect(route).not.toContain('0.0>1.0')
  })

  it('rejects a route that drives the wrong way up a one-way', () => {
    const level = makeLevel({
      width: 4,
      height: 4,
      oneWay: [directedKey('0.0', '1.0')],
      vehicles: [baseVehicle('v1', '0.0', '3.0')],
    })
    const graph = buildGraph(level)
    expect(routeIsLegal(graph, ['1.0', '0.0'])).toBe(false)
  })
})

describe('traffic simulation', () => {
  it('drives a car along its route to the destination', () => {
    const level = twoCars()
    const result = simulate(graphFor(level), level, level.reference)
    expect(result.status).toBe('success')
    expect(result.makespan).toBeGreaterThan(0)
    expect(result.vehicles.every((vehicle) => vehicle.arrived)).toBe(true)
  })

  it('is deterministic for the same level and routes', () => {
    const level = twoCars()
    const graph = graphFor(level)
    const first = simulate(graph, level, level.reference)
    const second = simulate(graph, level, level.reference)
    expect(first.makespan).toBe(second.makespan)
    expect(first.ticks).toBe(second.ticks)
    expect(first.vehicles.map((vehicle) => vehicle.arrivedAt)).toEqual(second.vehicles.map((vehicle) => vehicle.arrivedAt))
  })

  it('waits at a red light and proceeds when the phase turns', () => {
    const level = makeLevel({
      width: 5,
      height: 5,
      signals: [{ at: '2.2', phases: [{ axis: 'ew', duration: 6 }, { axis: 'ns', duration: 4 }], offset: 0 }],
      timeLimit: 60,
      vehicles: [baseVehicle('v1', '2.0', '2.4')],
    })
    const graph = graphFor(level)
    const slow = simulate(graph, level, { v1: ['2.0', '2.1', '2.2', '2.3', '2.4'] })
    expect(slow.status).toBe('success')
    // The signal is red for the north-south movement for the first six seconds,
    // so the car must queue at 2.2 before it can finish.
    expect(slow.makespan).toBeGreaterThan(5)
  })

  it('keeps a safe gap between cars on the same road', () => {
    const level = makeLevel({
      width: 7,
      height: 3,
      timeLimit: 60,
      vehicles: [
        baseVehicle('v1', '0.0', '6.0', { color: 'red', shape: 'circle' }),
        baseVehicle('v2', '1.0', '6.1', { color: 'blue', shape: 'triangle' }),
      ],
    })
    const graph = graphFor(level)
    const routes: RouteMap = {
      v1: ['0.0', '1.0', '2.0', '3.0', '4.0', '5.0', '6.0'],
      v2: ['1.0', '2.0', '3.0', '4.0', '5.0', '6.0', '6.1'],
    }
    const simulation = createSimulation(graph, level, routes)
    let minimumGap = Number.POSITIVE_INFINITY
    while (simulation.status === 'running' && simulation.time < 40) {
      simulation.step()
      const [a, b] = simulation.vehicles
      if (!a.arrived && !b.arrived && a.link === b.link && a.route[a.link] === b.route[b.link]) {
        minimumGap = Math.min(minimumGap, Math.abs(a.progress - b.progress))
      }
    }
    expect(simulation.status).toBe('success')
    expect(minimumGap).toBeGreaterThan(0.3)
  })

  it('fails on the deadline instead of pretending the level is clear', () => {
    const level = makeLevel({
      width: 6,
      height: 3,
      timeLimit: 1,
      vehicles: [baseVehicle('v1', '0.0', '5.0')],
    })
    const graph = graphFor(level)
    const result = simulate(graph, level, { v1: ['0.0', '1.0', '2.0', '3.0', '4.0', '5.0'] })
    expect(result.status).toBe('timeout')
  })

  it('reports a collision when two bodies overlap', () => {
    const level = twoCars()
    const graph = graphFor(level)
    const collision = findCollision([
      {
        id: 'v1',
        kind: 'compact',
        color: 'red',
        shape: 'circle',
        route: ['0.0', '3.0'],
        link: 0,
        progress: 0.5,
        speed: 1,
        distance: 0,
        arrived: false,
        arrivedAt: 0,
        blocked: 'none',
      },
      {
        id: 'v2',
        kind: 'compact',
        color: 'blue',
        shape: 'triangle',
        route: ['0.0', '3.0'],
        link: 0,
        progress: 0.55,
        speed: 1,
        distance: 0,
        arrived: false,
        arrivedAt: 0,
        blocked: 'none',
      },
    ])
    expect(collision).toEqual({ a: 'v1', b: 'v2' })
    expect(graph.edges.size).toBeGreaterThan(0)
  })

  it('never places a car outside the board', () => {
    const level = twoCars()
    const graph: RoadGraph = graphFor(level)
    const result = simulate(graph, level, level.reference)
    for (const vehicle of result.vehicles) {
      const pose = vehiclePose(vehicle, graph)
      expect(pose.x).toBeGreaterThanOrEqual(0)
      expect(pose.x).toBeLessThanOrEqual(level.width - 1)
      expect(pose.y).toBeGreaterThanOrEqual(0)
      expect(pose.y).toBeLessThanOrEqual(level.height - 1)
    }
  })
})
