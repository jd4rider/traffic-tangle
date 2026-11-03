import Phaser from 'phaser'
import { COLORS, SHAPES } from '../core/palette'
import { buildGraph, edgeAxis, pairKey, parseNodeId, type RoadGraph } from '../core/graph'
import { KIND_LENGTH, type LevelDefinition, type RouteMap } from '../core/types'
import type { SimVehicleState as SimVehicle } from '../core/sim'
import { vehiclePose } from '../core/sim'
import type { WorldTheme } from '../core/worlds'
import { css, shade, type Rect } from './common'

export interface CityLayout {
  cell: number
  ox: number
  oy: number
  boardWidth: number
  boardHeight: number
}

interface CarSprite {
  container: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Graphics
  glyph: Phaser.GameObjects.Text
  id: string
}

/**
 * Draws the miniature city: raised board, curbs, asphalt, lane markings,
 * one-way arrows, bridges, parks, destination pins, signals and toy cars.
 * All positions come from the logical graph, never from sprite overlap.
 */
export class CityView {
  private scene: Phaser.Scene
  private level: LevelDefinition
  private graph: RoadGraph
  private theme: WorldTheme
  private area: Rect
  layout: CityLayout

  private boardLayer: Phaser.GameObjects.Container
  private routeLayer: Phaser.GameObjects.Graphics
  private carLayer: Phaser.GameObjects.Container
  private signalLayer: Phaser.GameObjects.Container
  private goalLayer: Phaser.GameObjects.Container
  private cars = new Map<string, CarSprite>()
  private goals = new Map<string, Phaser.GameObjects.Container>()

  constructor(scene: Phaser.Scene, level: LevelDefinition, theme: WorldTheme, area: Rect, parent: Phaser.GameObjects.Container) {
    this.scene = scene
    this.level = level
    this.theme = theme
    this.area = area
    this.graph = buildGraph(level)
    this.layout = this.computeLayout()
    this.boardLayer = scene.add.container(0, 0)
    this.routeLayer = scene.add.graphics()
    this.carLayer = scene.add.container(0, 0)
    this.signalLayer = scene.add.container(0, 0)
    this.goalLayer = scene.add.container(0, 0)
    parent.add(this.boardLayer)
    this.buildStatic()
    this.buildCars()
  }

  private computeLayout(): CityLayout {
    const margin = 34
    const usableWidth = this.area.w - margin * 2
    const usableHeight = this.area.h - margin * 2
    const cell = Math.max(
      34,
      Math.min(usableWidth / Math.max(1, this.level.width - 1), usableHeight / Math.max(1, this.level.height - 1)),
    )
    const boardWidth = cell * (this.level.width - 1)
    const boardHeight = cell * (this.level.height - 1)
    return {
      cell,
      ox: this.area.x + (this.area.w - boardWidth) / 2,
      oy: this.area.y + (this.area.h - boardHeight) / 2,
      boardWidth,
      boardHeight,
    }
  }

  /** Grid coordinates -> screen point. */
  point(node: string): { x: number; y: number } {
    const parsed = parseNodeId(node) ?? { x: 0, y: 0 }
    return {
      x: this.layout.ox + parsed.x * this.layout.cell,
      y: this.layout.oy + parsed.y * this.layout.cell,
    }
  }

  nodeAt(x: number, y: number, tolerance = this.layout.cell * 0.55): string | null {
    let best: string | null = null
    let bestDistance = tolerance
    for (const node of this.graph.nodes.values()) {
      const point = this.point(node.id)
      const distance = Phaser.Math.Distance.Between(x, y, point.x, point.y)
      if (distance <= bestDistance) {
        bestDistance = distance
        best = node.id
      }
    }
    return best
  }

  vehicleAt(x: number, y: number, tolerance = this.layout.cell * 0.55): string | null {
    let best: string | null = null
    let bestDistance = tolerance
    for (const [id, sprite] of this.cars) {
      const distance = Phaser.Math.Distance.Between(x, y, sprite.container.x, sprite.container.y)
      if (distance < bestDistance) {
        bestDistance = distance
        best = id
      }
    }
    return best
  }

  goalAt(x: number, y: number): string | null {
    for (const [id, container] of this.goals) {
      if (Phaser.Math.Distance.Between(x, y, container.x, container.y) < this.layout.cell * 0.5) return id
    }
    return null
  }

  private buildStatic(): void {
    const { cell } = this.layout
    const graphics = this.scene.add.graphics()
    this.boardLayer.add(graphics)

    const pad = 26
    const left = this.area.x + 8
    const top = this.layout.oy - pad
    const width = this.area.w - 16
    const height = this.layout.boardHeight + pad * 2

    // Raised plate with a soft shadow and a bevel.
    graphics.fillStyle(0x102028, 0.24)
    graphics.fillRoundedRect(left + 5, top + 10, width, height, 30)
    graphics.fillStyle(shade(this.theme.ground, -0.35), 1)
    graphics.fillRoundedRect(left, top + 7, width, height, 30)
    graphics.fillStyle(shade(this.theme.ground, -0.12), 1)
    graphics.fillRoundedRect(left, top, width, height, 30)
    graphics.fillStyle(this.theme.ground, 1)
    graphics.fillRoundedRect(left + 6, top + 5, width - 12, height - 12, 26)
    graphics.fillStyle(0xffffff, 0.12)
    graphics.fillRoundedRect(left + 12, top + 9, width - 24, height * 0.24, 22)

    // Decorative blocks where the city has no road.
    for (const hole of this.level.holes) {
      const parsed = parseNodeId(hole)
      if (!parsed) continue
      const point = this.point(hole)
      this.drawBlock(graphics, point.x, point.y, cell * 0.62, hole)
    }

    // Roads: curb, asphalt, markings for every undirected pair once.
    const drawn = new Set<string>()
    for (const edge of this.graph.edges.values()) {
      const pair = pairKey(edge.from, edge.to)
      if (drawn.has(pair)) continue
      drawn.add(pair)
      this.drawRoad(graphics, edge.from, edge.to)
    }

    // Bridges get a raised deck so crossings read at a glance.
    for (const edge of this.graph.edges.values()) {
      if (edge.layer <= 0) continue
      const pair = pairKey(edge.from, edge.to)
      if (drawn.has(pair)) continue
      drawn.add(pair)
      this.drawRoad(graphics, edge.from, edge.to)
    }

    this.drawSignals()
    this.drawGoals()
    // Routes, pins, signals and cars layer above the city in that order.
    this.boardLayer.add(this.routeLayer)
    this.boardLayer.add(this.goalLayer)
    this.boardLayer.add(this.signalLayer)
    this.boardLayer.add(this.carLayer)
  }

  private drawBlock(graphics: Phaser.GameObjects.Graphics, x: number, y: number, size: number, seed: string): void {
    const hash = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
    const prop = this.theme.prop
    const park = prop === 'town' || prop === 'roundabout' || prop === 'mountain' || prop === 'metro' || hash % 3 === 0
    if (park) {
      graphics.fillStyle(shade(this.theme.ground, -0.18), 0.9)
      graphics.fillEllipse(x, y + size * 0.18, size * 1.05, size * 0.5)
      graphics.fillStyle(0x6fbf73, 1)
      graphics.fillCircle(x, y, size * 0.42)
      graphics.fillStyle(0x4f9c58, 1)
      graphics.fillCircle(x - size * 0.12, y + size * 0.08, size * 0.3)
      graphics.fillStyle(shade(0x8a5a3b, 0), 1)
      graphics.fillStyle(0x8a5a3b, 1)
      graphics.fillRect(x - size * 0.05, y - size * 0.02, size * 0.1, size * 0.3)
      return
    }

    const palette = [0xf2d8a7, 0xe8b7a0, 0xc9d8e8, 0xd7e3c4, 0xe3cfe8]
    const fill = palette[hash % palette.length]
    const height = size * (0.7 + (hash % 4) * 0.12)
    graphics.fillStyle(0x1a2a33, 0.2)
    graphics.fillRoundedRect(x - size * 0.4 + 3, y - height * 0.42 + 6, size * 0.8, height, 8)
    graphics.fillStyle(shade(fill, -0.25), 1)
    graphics.fillRoundedRect(x - size * 0.4, y - height * 0.42, size * 0.8, height, 8)
    graphics.fillStyle(fill, 1)
    graphics.fillRoundedRect(x - size * 0.4, y - height * 0.5, size * 0.8, height, 8)
    graphics.fillStyle(0xffffff, 0.18)
    graphics.fillRoundedRect(x - size * 0.34, y - height * 0.46, size * 0.68, height * 0.34, 6)
    // Windows
    graphics.fillStyle(0x3d5a6c, 0.55)
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        graphics.fillRoundedRect(
          x - size * 0.26 + col * size * 0.3,
          y - height * 0.3 + row * size * 0.24,
          size * 0.16,
          size * 0.14,
          3,
        )
      }
    }
  }

  private roadWidth(): number {
    return Math.max(16, this.layout.cell * 0.46)
  }

  private drawRoad(graphics: Phaser.GameObjects.Graphics, from: string, to: string): void {
    const a = this.point(from)
    const b = this.point(to)
    const pair = pairKey(from, to)
    const forward = this.graph.edges.get(`${from}>${to}`)
    const backward = this.graph.edges.get(`${to}>${from}`)
    const layer = this.level.layers[pair] ?? 0
    const width = this.roadWidth()
    const asphalt = layer > 0 ? shade(this.theme.road, 0.16) : this.theme.road

    // Sidewalk curb under the asphalt.
    graphics.lineStyle(width + 14, shade(this.theme.sidewalk, -0.1), 1)
    graphics.lineBetween(a.x, b.y === a.y ? a.y : a.y, b.x, b.y)
    graphics.fillCircle(a.x, a.y, (width + 14) / 2)
    graphics.fillCircle(b.x, b.y, (width + 14) / 2)

    if (layer > 0) {
      graphics.lineStyle(width + 10, 0x1a2a33, 0.22)
      graphics.lineBetween(a.x + 6, a.y + 12, b.x + 6, b.y + 12)
    }

    graphics.lineStyle(width, asphalt, 1)
    graphics.lineBetween(a.x, a.y, b.x, b.y)
    graphics.fillStyle(asphalt, 1)
    graphics.fillCircle(a.x, a.y, width / 2)
    graphics.fillCircle(b.x, b.y, width / 2)

    // Centre dashes on two-way roads, a chevron on one-ways.
    const bothWays = Boolean(forward && backward)
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    if (bothWays) {
      const dash = width * 0.32
      const offset = this.layout.cell * 0.16
      for (let t = -offset; t <= offset; t += dash * 1.9) {
        graphics.fillStyle(0xfdf3d8, 0.55)
        graphics.fillRoundedRect(mx + Math.cos(angle) * t - dash / 2, my + Math.sin(angle) * t - 1.6, dash, 3.2, 2)
      }
    } else {
      const direction = forward ? 1 : -1
      graphics.fillStyle(0xfdf3d8, 0.8)
      const size = width * 0.34
      for (let step = -1; step <= 1; step += 1) {
        const cx = mx + Math.cos(angle) * step * size * 1.5 * direction
        const cy = my + Math.sin(angle) * step * size * 1.5 * direction
        const tipX = cx + Math.cos(angle) * size * direction
        const tipY = cy + Math.sin(angle) * size * direction
        const leftX = cx + Math.cos(angle + 2.6) * size * direction
        const leftY = cy + Math.sin(angle + 2.6) * size * direction
        const rightX = cx + Math.cos(angle - 2.6) * size * direction
        const rightY = cy + Math.sin(angle - 2.6) * size * direction
        graphics.fillTriangle(tipX, tipY, leftX, leftY, rightX, rightY)
      }
    }

    if (layer > 0) {
      graphics.lineStyle(3, 0xffffff, 0.4)
      graphics.lineBetween(a.x, a.y - width / 2 + 3, b.x, b.y - width / 2 + 3)
    }
  }

  private drawSignals(): void {
    for (const signal of this.level.signals) {
      const point = this.point(signal.at)
      const container = this.scene.add.container(point.x, point.y)
      const graphics = this.scene.add.graphics()
      const size = Math.max(16, this.layout.cell * 0.26)
      graphics.fillStyle(0x1a2a33, 0.28)
      graphics.fillRoundedRect(-size / 2 + 2, -size * 1.1 + 4, size, size * 1.7, 5)
      graphics.fillStyle(0x2c3a44, 1)
      graphics.fillRoundedRect(-size / 2, -size * 1.2, size, size * 1.7, 5)
      const dot = size * 0.26
      graphics.fillStyle(0xe4572e, 0.95)
      graphics.fillCircle(0, -size * 0.92, dot)
      graphics.fillStyle(0xf0b429, 0.35)
      graphics.fillCircle(0, -size * 0.55, dot)
      graphics.fillStyle(0x48a860, 0.35)
      graphics.fillCircle(0, -size * 0.18, dot)
      container.add(graphics)
      container.setData('signal', signal.at)
      this.signalLayer.add(container)
    }
  }

  private drawGoals(): void {
    for (const spec of this.level.vehicles) {
      const point = this.point(spec.goal)
      const container = this.scene.add.container(point.x, point.y).setDepth(40)
      const color = COLORS[spec.color]
      const graphics = this.scene.add.graphics()
      const radius = Math.max(13, this.layout.cell * 0.24)
      graphics.fillStyle(0x1a2a33, 0.25)
      graphics.fillEllipse(0, radius * 0.9, radius * 2.1, radius * 0.7)
      graphics.fillStyle(0xffffff, 0.94)
      graphics.fillCircle(0, 0, radius * 1.12)
      graphics.fillStyle(color.hex, 1)
      graphics.fillCircle(0, 0, radius)
      graphics.fillStyle(0xffffff, 0.35)
      graphics.fillCircle(-radius * 0.3, -radius * 0.35, radius * 0.35)
      const glyph = this.scene.add.text(0, 0, SHAPES[spec.shape], {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${Math.round(radius * 1.25)}px`,
        color: '#ffffff',
        resolution: 2,
      })
      glyph.setOrigin(0.5)
      container.add(graphics)
      container.add(glyph)
      container.setScale(0.92)
      this.scene.tweens.add({
        targets: container,
        scale: 1,
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      })
      this.goals.set(spec.id, container)
      this.goalLayer.add(container)
    }
  }

  private buildCars(): void {
    for (const spec of this.level.vehicles) {
      const container = this.scene.add.container(0, 0)
      const body = this.scene.add.graphics()
      const glyph = this.scene.add.text(0, 0, SHAPES[spec.shape], {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
        resolution: 2,
      })
      glyph.setOrigin(0.5)
      container.add(body)
      container.add(glyph)
      this.carLayer.add(container)
      const sprite: CarSprite = { container, body, glyph, id: spec.id }
      this.cars.set(spec.id, sprite)
      this.paintCar(sprite, spec.color, spec.kind)
    }
  }

  private paintCar(sprite: CarSprite, color: string, kind: string): void {
    const palette = COLORS[color as keyof typeof COLORS] ?? COLORS.red
    const length = Math.max(20, this.layout.cell * (KIND_LENGTH[kind as keyof typeof KIND_LENGTH] ?? 0.55))
    const width = length * 0.52
    const graphics = sprite.body
    graphics.clear()
    // Shadow
    graphics.fillStyle(0x16262e, 0.22)
    graphics.fillEllipse(2, width * 0.55, length * 1.05, width * 0.7)
    // Wheels
    graphics.fillStyle(0x26313a, 1)
    graphics.fillRoundedRect(-length * 0.24, -width * 0.52, length * 0.16, width * 0.18, 3)
    graphics.fillRoundedRect(length * 0.1, -width * 0.52, length * 0.16, width * 0.18, 3)
    graphics.fillRoundedRect(-length * 0.24, width * 0.34, length * 0.16, width * 0.18, 3)
    graphics.fillRoundedRect(length * 0.1, width * 0.34, length * 0.16, width * 0.18, 3)
    // Body
    graphics.fillStyle(shade(palette.hex, -0.28), 1)
    graphics.fillRoundedRect(-length / 2, -width / 2 + 3, length, width, width * 0.34)
    graphics.fillStyle(palette.hex, 1)
    graphics.fillRoundedRect(-length / 2, -width / 2, length, width * 0.94, width * 0.34)
    // Roof
    graphics.fillStyle(0xffffff, 0.24)
    graphics.fillRoundedRect(-length * 0.32, -width * 0.34, length * 0.6, width * 0.42, width * 0.2)
    // Windscreen
    graphics.fillStyle(0xbfe6f2, 0.9)
    graphics.fillRoundedRect(length * 0.12, -width * 0.3, length * 0.16, width * 0.6, 3)
    // Headlights
    graphics.fillStyle(0xfff2b0, 1)
    graphics.fillRect(length / 2 - 2.5, -width * 0.3, 3, width * 0.2)
    graphics.fillRect(length / 2 - 2.5, width * 0.1, 3, width * 0.2)
    sprite.glyph.setPosition(-length * 0.04, -1)
  }

  setSelected(id: string | null): void {
    for (const [carId, sprite] of this.cars) {
      const selected = carId === id
      sprite.container.setScale(selected ? 1.18 : 1)
      sprite.body.setAlpha(selected ? 1 : 0.98)
    }
  }

  /** Places cars at their route start (edit mode) or their simulated pose. */
  updateCars(routes: RouteMap, simulation: { vehicles: SimVehicle[] } | null): void {
    for (const spec of this.level.vehicles) {
      const sprite = this.cars.get(spec.id)
      if (!sprite) continue
      if (simulation) {
        const state = simulation.vehicles.find((vehicle) => vehicle.id === spec.id)
        if (state) {
          if (state.arrived) {
            sprite.container.setAlpha(0.25)
            continue
          }
          sprite.container.setAlpha(1)
          const pose = vehiclePose(state, this.graph)
          const point = this.point(pose.from)
          const nextPoint = this.point(pose.to)
          sprite.container.setPosition(
            Phaser.Math.Linear(point.x, nextPoint.x, pose.x - Math.floor(pose.x)),
            Phaser.Math.Linear(point.y, nextPoint.y, pose.y - Math.floor(pose.y)),
          )
          sprite.container.setRotation(pose.angle)
        }
        continue
      }
      const route = routes[spec.id]
      const start = route?.[0] ?? spec.start
      const point = this.point(start)
      sprite.container.setPosition(point.x, point.y)
      sprite.container.setRotation(0)
      sprite.container.setAlpha(1)
    }
  }

  /** Draws each planned route with a lane offset, arrows and a selection glow. */
  drawRoutes(routes: RouteMap, selectedId: string | null): void {
    const graphics = this.routeLayer
    graphics.clear()
    let order = 0
    for (const spec of this.level.vehicles) {
      const route = routes[spec.id]
      if (!route || route.length < 2) {
        order += 1
        continue
      }
      const color = COLORS[spec.color]
      const selected = spec.id === selectedId
      const offset = (order - 1) * 3
      const width = selected ? 8 : 5
      const alpha = selectedId ? (selected ? 1 : 0.35) : 0.85
      graphics.lineStyle(width + 3, 0x102028, selected ? 0.35 : 0.18)
      this.strokeRoute(graphics, route, offset)
      graphics.lineStyle(width, color.hex, alpha)
      this.strokeRoute(graphics, route, offset)
      // Direction arrows at each corner.
      for (let index = 1; index < route.length - 1; index += 1) {
        const point = this.point(route[index])
        const previous = this.point(route[index - 1])
        const angle = Math.atan2(point.y - previous.y, point.x - previous.x)
        graphics.fillStyle(0xffffff, alpha * 0.9)
        const size = 5
        graphics.fillTriangle(
          point.x + Math.cos(angle) * size - Math.cos(angle - 1.5) * size,
          point.y + Math.sin(angle) * size - Math.sin(angle - 1.5) * size,
          point.x + Math.cos(angle) * size - Math.cos(angle + 1.5) * size,
          point.y + Math.sin(angle) * size - Math.sin(angle + 1.5) * size,
          point.x + Math.cos(angle) * size * 1.5,
          point.y + Math.sin(angle) * size * 1.5,
        )
      }
      order += 1
    }
  }

  private strokeRoute(graphics: Phaser.GameObjects.Graphics, route: string[], offset: number): void {
    const points = route.map((node) => this.point(node))
    for (let index = 0; index < points.length - 1; index += 1) {
      const a = points[index]
      const b = points[index + 1]
      const angle = Math.atan2(b.y - a.y, b.x - a.x)
      const normal = angle + Math.PI / 2
      const ax = a.x + Math.cos(normal) * offset
      const ay = a.y + Math.sin(normal) * offset
      const bx = b.x + Math.cos(normal) * offset
      const by = b.y + Math.sin(normal) * offset
      // Dashes make overlapping routes readable.
      const length = Phaser.Math.Distance.Between(ax, ay, bx, by)
      const dash = 11
      const gap = 7
      for (let travelled = 0; travelled < length; travelled += dash + gap) {
        const end = Math.min(length, travelled + dash)
        graphics.lineBetween(
          ax + Math.cos(angle) * travelled,
          ay + Math.sin(angle) * travelled,
          ax + Math.cos(angle) * end,
          ay + Math.sin(angle) * end,
        )
      }
    }
  }

  signalNodeAt(x: number, y: number): string | null {
    for (const signal of this.level.signals) {
      const point = this.point(signal.at)
      if (Phaser.Math.Distance.Between(x, y, point.x, point.y - this.layout.cell * 0.2) < this.layout.cell * 0.4) {
        return signal.at
      }
    }
    return null
  }

  destroy(): void {
    this.boardLayer.destroy(true)
    this.goals.clear()
    this.cars.clear()
  }
}

export function vehicleLegend(color: string, shape: string): string {
  return `${SHAPES[shape as keyof typeof SHAPES] ?? '\u25cf'} ${COLORS[color as keyof typeof COLORS]?.name ?? 'Car'}`
}

export function axisLabel(from: string, to: string): string {
  return edgeAxis(from, to) === 'ns' ? 'north-south' : 'east-west'
}

export function themeInk(theme: WorldTheme): string {
  return theme.dark ? css(0xfff1d6) : '#23303a'
}
