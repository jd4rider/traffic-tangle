import type { RouteMap } from './types'

/** A route is complete when it starts at the car, ends at its pin and has at least one hop. */
export function matchesRoute(route: string[] | undefined, start: string, goal: string): boolean {
  if (!route || route.length < 2) return false
  return route[0] === start && route[route.length - 1] === goal
}

export function routeHops(route: string[] | undefined): number {
  return route && route.length > 1 ? route.length - 1 : 0
}

export function cloneRoutes(routes: RouteMap): RouteMap {
  const copy: RouteMap = {}
  for (const [id, route] of Object.entries(routes)) copy[id] = [...route]
  return copy
}

export function routesEqual(a: RouteMap, b: RouteMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    const left = a[key]
    const right = b[key]
    if (!left || !right) return false
    if (left.length !== right.length) return false
    for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false
  }
  return true
}
