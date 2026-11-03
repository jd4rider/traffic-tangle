import Phaser from 'phaser'
import { app } from '../core/app'
import { arcade } from '../core/arcade'
import { sound } from '../core/audio'
import { buildGraph, directedKey, routeLength, shortestPath, totalRouteLength, type RoadGraph } from '../core/graph'
import { globalNumber, levelAt } from '../core/levels'
import { dailyKey, dailyLevel, endlessLevel, newRunSeed } from '../core/modes'
import { matchesRoute } from '../core/routes'
import { recordCompletion, recordEndless, saveSandbox, saveSession, loadSession, starsFor, type SandboxSave } from '../core/saves'
import { createSimulation, type Simulation } from '../core/sim'
import { hintFor } from '../core/solver'
import { KIND_LABEL, GENERATOR_VERSION, type GameMode, type LevelDefinition, type RouteMap } from '../core/types'
import { COLORS, SHAPES } from '../core/palette'
import { WORLDS, shade, type WorldTheme } from '../core/worlds'
import { ACHIEVEMENTS } from '../core/achievements'
import { CityView } from './city'
import {
  CREAM,
  DESIGN_W,
  GOLD,
  INK,
  PAPER,
  announce,
  button,
  fadeIn,
  fadeTo,
  iconButton,
  label,
  panel,
  stage,
  starRow,
  title,
  toast,
} from './common'

interface GameData {
  mode?: GameMode
  levelNumber?: number
  runSeed?: string
  stage?: number
}

const BOARD = { x: 26, y: 196, w: 668, h: 686 }
const TRAY_TOP = 912
const CONTROL_Y = 1156

export class GameScene extends Phaser.Scene {
  private mode: GameMode = 'journey'
  private level!: LevelDefinition
  private theme!: WorldTheme
  private graph!: RoadGraph
  private city!: CityView
  private routes: RouteMap = {}
  private history: RouteMap[] = []
  private redoStack: RouteMap[] = []
  private selected: string | null = null
  private hintsUsed = 0
  private hinted = new Set<string>()

  private simulation: Simulation | null = null
  private running = false
  private paused = false
  private accumulator = 0
  private overlay: Phaser.GameObjects.Container | null = null

  private root!: Phaser.GameObjects.Container
  private clockText!: Phaser.GameObjects.Text
  private statusText!: Phaser.GameObjects.Text
  private objectiveText!: Phaser.GameObjects.Text
  private tray!: Phaser.GameObjects.Container
  private uiLayer!: Phaser.GameObjects.Container
  private runLabel!: Phaser.GameObjects.Text
  private runButton!: Phaser.GameObjects.Container
  private drawing = false
  private pointerMoved = false
  private pointerStart = { x: 0, y: 0 }

  private runSeed = ''
  private stage = 1
  private dailyKeyValue = ''
  private levelNumber = 1
  private sandboxLevel: LevelDefinition | null = null

  constructor() {
    super('Game')
  }

  init(data: GameData): void {
    this.mode = data.mode ?? 'journey'
    this.levelNumber = data.levelNumber ?? app.progress.unlocked
    this.runSeed = data.runSeed ?? ''
    this.stage = data.stage ?? 1
    this.routes = {}
    this.history = []
    this.redoStack = []
    this.selected = null
    this.hintsUsed = 0
    this.hinted = new Set()
    this.simulation = null
    this.running = false
    this.paused = false
    this.accumulator = 0
    this.overlay = null
    this.sandboxLevel = null
  }

  create(): void {
    app.refresh()
    if (this.mode === 'endless') {
      if (!this.runSeed) this.runSeed = newRunSeed()
      this.level = endlessLevel(this.runSeed, this.stage)
    } else if (this.mode === 'daily') {
      this.level = dailyLevel()
      this.dailyKeyValue = dailyKey()
    } else if (this.mode === 'sandbox') {
      this.level = this.makeSandboxLevel()
      this.sandboxLevel = this.level
    } else {
      this.level = levelAt(this.levelNumber)
    }
    this.theme = WORLDS[this.level.world - 1]
    this.graph = buildGraph(this.level)

    fadeIn(this)
    this.root = stage(this)
    this.drawBackground()
    this.drawHud()
    this.uiLayer = this.add.container(0, 0)
    this.root.add(this.uiLayer)

    this.city = new CityView(this, this.level, this.theme, BOARD, this.root)
    this.city.drawRoutes(this.routes, this.selected)
    this.city.updateCars(this.routes, null)

    this.buildTray()
    this.buildControls()
    this.bindBoardInput()
    this.bindKeyboard()

    const session = this.mode === 'journey' ? loadSession() : null
    if (session && session.levelId === this.level.id && session.mode === 'journey' && !this.isSandbox()) {
      this.routes = this.filterRoutes(session.routes)
      this.hintsUsed = session.hints
      this.refreshAll()
      toast(this, 'Picked up where you left off.', { y: 178 })
    }

    this.updateHud()
    announce(`${this.modeTitle()}. ${this.level.vehicles.length} cars. Press GO to start the traffic.`)
  }

  private isSandbox(): boolean {
    return this.mode === 'sandbox'
  }

  private drawBackground(): void {
    const graphics = this.add.graphics().setDepth(-100)
    const draw = (): void => {
      const width = this.scale.width
      const height = this.scale.height
      graphics.clear()
      graphics.fillGradientStyle(this.theme.sky[0], this.theme.sky[0], this.theme.sky[1], this.theme.sky[1], 1)
      graphics.fillRect(0, 0, width, height)
      const scale = this.root?.scaleX ?? 1
      const ox = this.root?.x ?? 0
      const oy = this.root?.y ?? 0
      graphics.fillStyle(shade(this.theme.ground, 0.12), 0.9)
      graphics.fillEllipse(ox + DESIGN_W * 0.2 * scale, oy + 1080 * scale, DESIGN_W * 1.05 * scale, 420 * scale)
      graphics.fillEllipse(ox + DESIGN_W * 0.85 * scale, oy + 1110 * scale, DESIGN_W * 0.9 * scale, 380 * scale)
    }
    draw()
    this.scale.on(Phaser.Scale.Events.RESIZE, draw)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, draw)
      graphics.destroy()
    })
  }

  private modeTitle(): string {
    switch (this.mode) {
      case 'journey':
        return `Garden ${globalNumber(this.level)}`
      case 'zen':
        return 'Zen garden'
      case 'daily':
        return `Daily ${this.dailyKeyValue}`
      case 'endless':
        return `Endless stage ${this.stage}`
      default:
        return 'Free build'
    }
  }

  private drawHud(): void {
    const root = this.root
    root.add(iconButton(this, 54, 58, '\u2190', () => this.exitToMenu(), { fill: 0x2c4a58, size: 56 }))
    root.add(
      title(this, DESIGN_W / 2, 44, this.modeTitle(), 27, this.theme.dark ? '#f4ead4' : INK, 0.5).setOrigin(0.5, 0.3),
    )
    root.add(
      label(this, DESIGN_W / 2, 80, this.theme.name, 14, this.theme.dark ? '#c9d7de' : '#4d6570', { origin: 0.5 }),
    )
    root.add(iconButton(this, 666, 58, '\u2699', () => this.openSettings(), { fill: 0x2c4a58, size: 56 }))

    const bar = panel(this, 26, 112, DESIGN_W - 52, 70, {
      fill: this.theme.dark ? 0x203543 : 0xfdf4e2,
      radius: 20,
      raised: 4,
      highlight: false,
    })
    root.add(bar)
    this.objectiveText = label(this, 46, 128, '', 16, this.theme.dark ? PAPER : INK, { fontStyle: 'bold' })
    this.clockText = label(this, DESIGN_W - 46, 128, '', 18, this.theme.dark ? '#ffd88a' : '#a4621a', {
      origin: [1, 0],
      fontStyle: 'bold',
    })
    this.statusText = label(this, DESIGN_W - 46, 152, '', 12, this.theme.dark ? '#a9bcc6' : '#5b7280', { origin: [1, 0] })
    root.add([this.objectiveText, this.clockText, this.statusText])
  }

  private buildTray(): void {
    if (this.tray) this.tray.destroy(true)
    this.tray = this.add.container(0, 0)
    this.uiLayer.add(this.tray)
    const vehicles = this.level.vehicles
    const columns = 2
    const width = (DESIGN_W - 52 - 14) / columns
    vehicles.forEach((spec, index) => {
      const x = 26 + (index % columns) * (width + 14)
      const y = TRAY_TOP + Math.floor(index / columns) * 70
      const selected = this.selected === spec.id
      const card = panel(this, x, y, width, 62, {
        fill: selected ? 0xfbe6bd : this.theme.dark ? 0x24404c : CREAM,
        radius: 16,
        raised: 3,
        highlight: false,
        shadow: false,
        stroke: selected ? 0xffffff : undefined,
        strokeAlpha: 0.5,
      })
      this.tray.add(card)
      const dot = this.add.graphics()
      dot.fillStyle(COLORS[spec.color].hex, 1)
      dot.fillCircle(x + 26, y + 26, 13)
      dot.lineStyle(2, 0xffffff, 0.7)
      dot.strokeCircle(x + 26, y + 26, 13)
      this.tray.add(dot)
      this.tray.add(
        label(this, x + 26, y + 26, SHAPES[spec.shape], 13, '#ffffff', { origin: 0.5, fontStyle: 'bold' }),
      )
      this.tray.add(
        label(this, x + 50, y + 10, KIND_LABEL[spec.kind], 14, this.theme.dark ? PAPER : INK, { fontStyle: 'bold' }),
      )
      const route = this.routes[spec.id]
      const info = route ? `${routeLength(route)} hops` : 'no route yet'
      this.tray.add(label(this, x + 50, y + 32, info, 12, this.theme.dark ? '#a9bcc6' : '#5b7280'))
      const hit = this.add.zone(x, y, width, 62).setOrigin(0).setInteractive({ useHandCursor: true })
      hit.on('pointerup', () => {
        this.selectVehicle(spec.id)
      })
      this.tray.add(hit)
    })
    if (vehicles.length === 0) {
      this.tray.add(label(this, 40, TRAY_TOP + 20, 'No cars yet.', 15, INK))
    }
  }

  private buildControls(): void {
    const undo = iconButton(this, 62, CONTROL_Y, '\u21b6', () => this.undo(), { fill: 0x2c4a58, size: 62, label: 'Undo' })
    const redo = iconButton(this, 152, CONTROL_Y, '\u21b7', () => this.redo(), { fill: 0x2c4a58, size: 62, label: 'Redo' })
    const reset = iconButton(this, 242, CONTROL_Y, '\u21ba', () => this.reset(), { fill: 0x2c4a58, size: 62, label: 'Reset' })
    const hint = iconButton(this, 332, CONTROL_Y, '\u2049', () => this.useHint(), { fill: 0x2c4a58, size: 62, label: 'Hint' })
    if (!this.isSandbox()) {
      this.uiLayer.add([undo, redo, reset, hint])
    } else {
      this.uiLayer.add([
        iconButton(this, 62, CONTROL_Y, '\uff0b', () => this.sandboxAddCar(), { fill: 0x2c4a58, size: 62, label: 'Add car' }),
        iconButton(this, 152, CONTROL_Y, '\u21ba', () => this.sandboxReset(), { fill: 0x2c4a58, size: 62, label: 'Clear' }),
        iconButton(this, 242, CONTROL_Y, '\u21c4', () => this.sandboxRouteAll(), { fill: 0x2c4a58, size: 62, label: 'Route' }),
        iconButton(this, 332, CONTROL_Y, '\u2913', () => this.sandboxSave(), { fill: 0x2c4a58, size: 62, label: 'Save' }),
      ])
    }

    this.runButton = button(this, 420, CONTROL_Y - 32, 274, 64, 'GO', () => this.toggleRun(), {
      fill: 0x48a860,
      size: 25,
      textColor: '#ffffff',
      glow: true,
    })
    this.uiLayer.add(this.runButton)
    this.runLabel = this.runButton.list.find((child) => child instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text
  }

  private setRunLabel(text: string): void {
    if (this.runLabel) this.runLabel.setText(text)
  }

  private refreshAll(): void {
    this.city.drawRoutes(this.routes, this.selected)
    this.city.setSelected(this.selected)
    this.city.updateCars(this.routes, this.simulation)
    this.buildTray()
    this.updateHud()
    if (this.mode === 'journey' && !this.running) {
      saveSession({
        version: 1,
        levelId: this.level.id,
        routes: this.routes,
        hints: this.hintsUsed,
        mode: 'journey',
        at: Date.now(),
      })
    }
  }

  private updateHud(): void {
    const total = this.level.vehicles.length
    const routed = this.level.vehicles.filter((spec) => this.routes[spec.id]?.length > 1).length
    this.objectiveText.setText(
      this.isSandbox() ? `${total} cars \u00b7 tap a road to block or clear it` : `Get all ${total} cars home \u00b7 ${routed}/${total} routed`,
    )
    if (this.simulation) {
      const remaining = Math.max(0, this.level.timeLimit - this.simulation.time)
      this.clockText.setText(this.level.timeLimit > 0 ? `0:${String(Math.ceil(remaining)).padStart(2, '0')}` : 'relaxed')
    } else {
      this.clockText.setText(this.level.timeLimit > 0 ? `0:${String(this.level.timeLimit).padStart(2, '0')}` : 'relaxed')
    }
    const hints = this.hintsUsed > 0 ? ` \u00b7 ${this.hintsUsed} hint${this.hintsUsed > 1 ? 's' : ''}` : ''
    this.statusText.setText(`${this.level.vehicles.length} cars \u00b7 par ${this.level.par} hops${hints}`)
  }

  private bindBoardInput(): void {
    const zone = this.add.zone(BOARD.x, BOARD.y, BOARD.w, BOARD.h).setOrigin(0).setInteractive()
    this.root.add(zone)

    const toDesign = (pointer: Phaser.Input.Pointer): { x: number; y: number } => ({
      x: (pointer.x - this.root.x) / this.root.scaleX,
      y: (pointer.y - this.root.y) / this.root.scaleY,
    })

    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.running) return
      const point = toDesign(pointer)
      this.pointerStart = { x: point.x, y: point.y }
      this.pointerMoved = false
      const car = this.city.vehicleAt(point.x, point.y)
      if (car) {
        this.selectVehicle(car)
        this.drawing = true
        if (!this.routes[car] || this.routes[car].length < 2) {
          const spec = this.level.vehicles.find((entry) => entry.id === car)
          if (spec) this.startRoute(car, spec.start)
        }
      } else {
        this.drawing = Boolean(this.selected && this.routes[this.selected]?.length)
      }
    })

    zone.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.running || !pointer.isDown) return
      const point = toDesign(pointer)
      if (Phaser.Math.Distance.Between(point.x, point.y, this.pointerStart.x, this.pointerStart.y) > 8) {
        this.pointerMoved = true
      }
      if (!this.drawing || !this.selected) return
      this.extendRouteTo(point.x, point.y, true)
    })

    zone.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.running) return
      const point = toDesign(pointer)
      const moved = this.pointerMoved || Phaser.Math.Distance.Between(point.x, point.y, this.pointerStart.x, this.pointerStart.y) > 8
      this.drawing = false
      if (moved) return

      if (this.isSandbox()) {
        this.sandboxTap(point.x, point.y)
        return
      }

      const signal = this.city.signalNodeAt(point.x, point.y)
      if (signal) {
        this.cycleSignal(signal)
        return
      }
      const goal = this.city.goalAt(point.x, point.y)
      if (goal) {
        this.autoRoute(goal)
        return
      }
      const car = this.city.vehicleAt(point.x, point.y)
      if (car) {
        this.selectVehicle(car)
        return
      }
      if (this.selected) {
        const node = this.city.nodeAt(point.x, point.y)
        if (node && this.canExtend(this.selected, node)) {
          this.extendRouteTo(point.x, point.y, false)
          return
        }
      }
      this.selected = null
      this.city.setSelected(null)
      this.city.drawRoutes(this.routes, this.selected)
      this.buildTray()
    })
  }

  private bindKeyboard(): void {
    const keyboard = this.input.keyboard
    if (!keyboard) return
    keyboard.on('keydown-ENTER', () => this.toggleRun())
    keyboard.on('keydown-SPACE', () => this.toggleRun())
    keyboard.on('keydown-U', () => this.undo())
    keyboard.on('keydown-R', () => this.reset())
    keyboard.on('keydown-H', () => this.useHint())
    keyboard.on('keydown-ESC', () => {
      if (this.running) this.pauseRun()
      else this.exitToMenu()
    })
    keyboard.on('keydown-TAB', (event: KeyboardEvent) => {
      event.preventDefault()
      this.cycleSelection()
    })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.removeAllListeners())
  }

  private cycleSelection(): void {
    if (this.running) return
    const ids = this.level.vehicles.map((spec) => spec.id)
    if (ids.length === 0) return
    const index = this.selected ? ids.indexOf(this.selected) : -1
    this.selectVehicle(ids[(index + 1) % ids.length])
  }

  private selectVehicle(id: string): void {
    this.selected = id
    this.city.setSelected(id)
    this.city.drawRoutes(this.routes, this.selected)
    this.buildTray()
    sound.select()
    const spec = this.level.vehicles.find((entry) => entry.id === id)
    if (spec) announce(`${KIND_LABEL[spec.kind]} selected. Draw a route to its ${spec.color} pin.`)
  }

  private startRoute(vehicleId: string, node: string): void {
    // A tap fires pointerdown *and* pointerup, and both can land on the car.
    // Only the first call may take a snapshot so one undo removes the route.
    const existing = this.routes[vehicleId]
    if (!existing || existing.length === 0) this.pushHistory()
    this.routes[vehicleId] = [node]
    this.refreshAll()
  }

  private canExtend(vehicleId: string, node: string): boolean {
    const route = this.routes[vehicleId]
    if (!route || route.length === 0) return false
    const last = route[route.length - 1]
    if (last === node) return false
    if (route.includes(node)) return false
    return Boolean(this.graph.edges.get(directedKey(last, node)))
  }

  private extendRouteTo(x: number, y: number, fromDrag: boolean): void {
    if (!this.selected) return
    const node = this.city.nodeAt(x, y, this.city.layout.cell * 0.42)
    if (!node || !this.canExtend(this.selected, node)) return
    const route = this.routes[this.selected]
    if (!route) return
    route.push(node)
    if (fromDrag) sound.draw()
    this.city.drawRoutes(this.routes, this.selected)
    this.city.updateCars(this.routes, null)
    this.buildTray()
    this.updateHud()
    const spec = this.level.vehicles.find((entry) => entry.id === this.selected)
    if (spec && node === spec.goal) {
      sound.horn()
      this.selected = null
      this.city.setSelected(null)
      this.city.drawRoutes(this.routes, this.selected)
      this.buildTray()
    }
  }

  private autoRoute(vehicleId: string): void {
    if (this.running) return
    const spec = this.level.vehicles.find((entry) => entry.id === vehicleId)
    if (!spec) return
    // A car that already holds its start node came from the tap that began this
    // route, so that snapshot already captured the pre-route state.
    const existing = this.routes[vehicleId]
    if (!existing || existing.length >= 2) this.pushHistory()
    const route = shortestPath(this.graph, spec.start, spec.goal)
    if (!route) {
      toast(this, 'That destination is cut off. Try another way.', { y: 178 })
      sound.invalid()
      return
    }
    this.routes[vehicleId] = route
    this.selected = vehicleId
    sound.horn()
    this.refreshAll()
  }

  private cycleSignal(node: string): void {
    const signal = this.level.signals.find((entry) => entry.at === node)
    if (!signal) return
    signal.offset = (signal.offset + 1) % 6
    sound.light()
    toast(this, `Light phase shifted by ${signal.offset}s.`, { y: 178, duration: 1100 })
    this.city.destroy()
    this.city = new CityView(this, this.level, this.theme, BOARD, this.root)
    this.root.bringToTop(this.tray)
    this.refreshAll()
  }

  private pushHistory(): void {
    this.history.push(this.cloneRoutes(this.routes))
    if (this.history.length > 60) this.history.shift()
    this.redoStack = []
  }

  private cloneRoutes(routes: RouteMap): RouteMap {
    const copy: RouteMap = {}
    for (const [id, route] of Object.entries(routes)) copy[id] = [...route]
    return copy
  }

  private undo(): void {
    if (this.running) return
    const previous = this.history.pop()
    if (!previous) {
      toast(this, 'Nothing to undo yet.', { y: 178, duration: 1000 })
      return
    }
    this.redoStack.push(this.cloneRoutes(this.routes))
    this.routes = previous
    sound.undo()
    this.refreshAll()
  }

  private redo(): void {
    if (this.running) return
    const next = this.redoStack.pop()
    if (!next) {
      toast(this, 'Nothing to redo.', { y: 178, duration: 1000 })
      return
    }
    this.history.push(this.cloneRoutes(this.routes))
    this.routes = next
    sound.undo()
    this.refreshAll()
  }

  private reset(): void {
    if (this.running) this.stopRun()
    this.pushHistory()
    this.routes = {}
    this.selected = null
    this.simulation = null
    this.city.updateCars(this.routes, null)
    this.refreshAll()
    sound.undo()
    toast(this, 'Routes cleared.', { y: 178, duration: 1100 })
  }

  private toggleRun(): void {
    if (this.running) {
      if (this.paused) this.resumeRun()
      else this.pauseRun()
      return
    }
    const missing = this.level.vehicles.filter((spec) => !matchesRoute(this.routes[spec.id], spec.start, spec.goal))
    if (missing.length > 0) {
      sound.invalid()
      toast(this, `Route the ${missing.length === 1 ? KIND_LABEL[missing[0].kind] : `${missing.length} cars`} first.`, { y: 178 })
      this.selectVehicle(missing[0].id)
      return
    }
    this.startRun()
  }

  private startRun(): void {
    if (this.overlay) this.overlay.destroy(true)
    this.overlay = null
    this.simulation = createSimulation(this.graph, this.level, this.routes)
    this.running = true
    this.paused = false
    this.accumulator = 0
    this.setRunLabel('PAUSE')
    this.selected = null
    this.city.setSelected(null)
    this.city.drawRoutes({}, null)
    this.buildTray()
    sound.go()
    announce('Traffic started.')
    this.updateHud()
  }

  private pauseRun(): void {
    if (!this.running) return
    this.paused = true
    this.setRunLabel('RESUME')
    announce('Traffic paused.')
  }

  private resumeRun(): void {
    if (!this.running) return
    this.paused = false
    this.setRunLabel('PAUSE')
    announce('Traffic running.')
  }

  private stopRun(): void {
    this.running = false
    this.paused = false
    this.simulation = null
    this.accumulator = 0
    this.setRunLabel('GO')
    this.city.drawRoutes(this.routes, this.selected)
    this.city.updateCars(this.routes, null)
    this.buildTray()
    this.updateHud()
  }

  override update(_time: number, delta: number): void {
    if (!this.running || this.paused || !this.simulation) return
    if (typeof document !== 'undefined' && document.hidden) return
    const speed = app.progress.settings.speed
    this.accumulator += (delta / 1000) * speed
    let guard = 0
    while (this.accumulator >= 1 / 60 && guard < 12) {
      this.simulation.step()
      this.accumulator -= 1 / 60
      guard += 1
      if (this.simulation.status !== 'running') break
    }
    this.city.updateCars(this.routes, { vehicles: this.simulation.vehicles })
    this.updateHud()
    if (this.simulation.status !== 'running') this.finish(this.simulation.status)
  }

  private finish(status: string): void {
    const simulation = this.simulation
    if (!simulation) return
    this.running = false
    this.paused = false
    this.simulation = null
    this.setRunLabel('GO')
    if (status === 'success') {
      this.showSuccess(simulation.time)
    } else {
      sound.lose()
      this.showFailure(status)
    }
  }

  private showSuccess(time: number): void {
    const length = totalRouteLength(this.routes)
    const stars = starsFor(length, this.level.par, this.hintsUsed)
    const cars = this.level.vehicles.length
    if (this.mode === 'endless') {
      app.progress = recordEndless(app.progress, this.stage)
    } else if (!this.isSandbox()) {
      const recordId = this.mode === 'daily' ? `daily-${this.dailyKeyValue}` : this.level.id
      const unlockIndex = this.mode === 'journey' ? globalNumber(this.level) : Math.max(0, app.progress.unlocked - 1)
      const result = recordCompletion(app.progress, {
        levelId: recordId,
        levelNumber: unlockIndex,
        stars,
        length,
        time,
        hints: this.hintsUsed,
        cars,
        dailyKey: this.mode === 'daily' ? this.dailyKeyValue : undefined,
      })
      app.progress = result.progress
      for (const id of result.newAchievements.slice(0, 2)) {
        const definition = ACHIEVEMENTS.find((entry) => entry.id === id)
        if (definition) toast(this, `Badge unlocked \u00b7 ${definition.name}`, { y: 250, duration: 2200 })
      }
      void arcade.sync()
    }
    sound.win()
    announce(`All cars home with ${stars} stars.`)

    const overlay = this.add.container(0, 0).setDepth(4000)
    this.root.add(overlay)
    const shadeRect = this.add.rectangle(0, 0, DESIGN_W, 1280, 0x0d1b24, 0.45).setOrigin(0)
    shadeRect.setInteractive()
    overlay.add(shadeRect)
    const card = panel(this, 60, 360, DESIGN_W - 120, 470, { fill: 0xfff7e8, radius: 30, raised: 8 })
    overlay.add(card)
    overlay.add(title(this, DESIGN_W / 2, 400, 'All cars home!', 34, '#1f3c4a'))
    overlay.add(starRow(this, DESIGN_W / 2, 468, stars, 40, 3, true))
    overlay.add(
      label(this, DESIGN_W / 2, 530, `${length} hops \u00b7 par ${this.level.par} \u00b7 ${time.toFixed(1)}s`, 17, '#405a66', {
        origin: 0.5,
      }),
    )
    const note =
      stars === 3
        ? 'That is the shortest plan we can verify. Beautiful driving.'
        : length > this.level.par
          ? `Try trimming ${length - this.level.par} hops for three stars.`
          : 'Three stars needs no hints.'
    overlay.add(label(this, DESIGN_W / 2, 566, note, 14, '#5b7280', { origin: 0.5, wrap: 500, align: 'center' }))

    const nextLabel = this.mode === 'endless' ? 'Next stage' : this.mode === 'sandbox' ? 'Keep building' : 'Next garden'
    overlay.add(
      button(this, 90, 626, 250, 68, nextLabel, () => this.nextLevel(), { fill: GOLD, size: 19 }),
    )
    overlay.add(
      button(this, 380, 626, 250, 68, 'Replay', () => this.restartLevel(), { fill: 0xdff0e2, size: 19 }),
    )
    overlay.add(
      button(this, 90, 712, 250, 60, 'World map', () => fadeTo(this, 'Worlds'), { fill: CREAM, size: 17 }),
    )
    overlay.add(
      button(this, 380, 712, 250, 60, 'Menu', () => this.exitToMenu(), { fill: CREAM, size: 17 }),
    )
    this.overlay = overlay
  }

  private showFailure(status: string): void {
    const reasons: Record<string, { title: string; body: string }> = {
      timeout: {
        title: 'Out of time',
        body: 'The clock ran out. A shorter route or a better signal phase will get everyone home.',
      },
      gridlock: {
        title: 'Total tangle',
        body: 'Everyone is waiting for everyone. Spread the routes out so no junction stays blocked.',
      },
      collision: {
        title: 'Bump!',
        body: 'Two cars tried to be in the same place. Stagger the routes and try again.',
      },
    }
    const info = reasons[status] ?? { title: 'Not quite', body: 'Traffic could not finish. Adjust the routes and try again.' }
    announce(info.title)

    const overlay = this.add.container(0, 0).setDepth(4000)
    this.root.add(overlay)
    const shadeRect = this.add.rectangle(0, 0, DESIGN_W, 1280, 0x0d1b24, 0.5).setOrigin(0)
    shadeRect.setInteractive()
    overlay.add(shadeRect)
    const card = panel(this, 70, 400, DESIGN_W - 140, 400, { fill: 0xfff2e6, radius: 30, raised: 8 })
    overlay.add(card)
    overlay.add(title(this, DESIGN_W / 2, 442, info.title, 34, '#7a3320'))
    overlay.add(label(this, DESIGN_W / 2, 500, info.body, 16, '#4a5560', { origin: 0.5, wrap: 520, align: 'center' }))
    overlay.add(
      button(this, 110, 604, 230, 68, 'Edit routes', () => {
        overlay.destroy(true)
        this.overlay = null
        this.city.drawRoutes(this.routes, this.selected)
        this.city.updateCars(this.routes, null)
        this.refreshAll()
      }, { fill: GOLD, size: 19 }),
    )
    overlay.add(
      button(this, 380, 604, 230, 68, 'Try again', () => this.restartSimulation(), { fill: 0xdff0e2, size: 19 }),
    )
    overlay.add(
      button(this, DESIGN_W / 2 - 115, 692, 230, 58, 'Hint', () => {
        overlay.destroy(true)
        this.overlay = null
        this.useHint()
      }, { fill: CREAM, size: 17 }),
    )
    this.overlay = overlay
  }

  private restartSimulation(): void {
    if (this.overlay) {
      this.overlay.destroy(true)
      this.overlay = null
    }
    this.routes = this.filterRoutes(this.routes)
    this.startRun()
  }

  private restartLevel(): void {
    if (this.overlay) {
      this.overlay.destroy(true)
      this.overlay = null
    }
    this.routes = {}
    this.hintsUsed = 0
    this.selected = null
    this.simulation = null
    this.city.updateCars({}, null)
    this.refreshAll()
  }

  private nextLevel(): void {
    if (this.mode === 'endless') {
      this.scene.restart({ mode: 'endless', runSeed: this.runSeed, stage: this.stage + 1 })
      return
    }
    if (this.mode === 'sandbox') {
      this.restartLevel()
      return
    }
    if (this.mode === 'daily') {
      fadeTo(this, 'Menu')
      return
    }
    const next = Math.min(1000, globalNumber(this.level) + 1)
    if (next > 1000) {
      fadeTo(this, 'Menu')
      return
    }
    this.scene.restart({ mode: this.mode, levelNumber: next })
  }

  private useHint(): void {
    if (this.running) return
    const hint = hintFor(this.level, this.graph, this.routes)
    if (!hint) {
      toast(this, 'Every car already has a route. Press GO to test it.', { y: 178 })
      return
    }
    this.hintsUsed += 1
    this.hinted.add(hint.vehicleId)
    this.routes[hint.vehicleId] = hint.route
    this.selected = hint.vehicleId
    sound.hint()
    this.refreshAll()
    toast(this, hint.text, { y: 178, duration: 2400 })
  }

  private filterRoutes(routes: RouteMap): RouteMap {
    const clean: RouteMap = {}
    for (const spec of this.level.vehicles) {
      const route = routes[spec.id]
      if (!route || route.length < 2) continue
      if (route[0] !== spec.start) continue
      if (route[route.length - 1] !== spec.goal) continue
      if (!matchesRoute(route, spec.start, spec.goal)) continue
      clean[spec.id] = route
    }
    return clean
  }

  private openSettings(): void {
    if (this.running) this.pauseRun()
    fadeTo(this, 'Settings', { from: 'Game', levelNumber: globalNumber(this.level), mode: this.mode })
  }

  private exitToMenu(): void {
    if (this.overlay) this.overlay.destroy(true)
    this.overlay = null
    this.scene.stop()
    this.scene.start('Menu')
  }

  // ---- Sandbox -----------------------------------------------------------

  private makeSandboxLevel(): LevelDefinition {
    const level = this.buildSandboxLevel([], this.sandboxVehicles())
    return level
  }

  private sandboxVehicles(): { start: string; goal: string }[] {
    return [
      { start: '1.1', goal: '4.6' },
      { start: '4.1', goal: '1.6' },
      { start: '2.4', goal: '5.3' },
    ]
  }

  private buildSandboxLevel(holes: string[], pairs: { start: string; goal: string }[]): LevelDefinition {
    const width = 6
    const height = 8
    const vehicles = pairs.map((pair, index) => ({
      id: `v${index + 1}`,
      kind: (['compact', 'van', 'taxi', 'bus', 'sports', 'pickup'] as const)[index % 6],
      color: (['red', 'blue', 'green', 'amber', 'violet', 'teal'] as const)[index % 6],
      shape: (['circle', 'triangle', 'square', 'star', 'diamond', 'cross'] as const)[index % 6],
      start: pair.start,
      goal: pair.goal,
    }))
    const draft: LevelDefinition = {
      id: 'sandbox',
      world: 1,
      index: 0,
      name: 'Free build',
      width,
      height,
      holes,
      closed: [],
      oneWay: [],
      layers: {},
      signals: [],
      vehicles,
      timeLimit: 0,
      par: 0,
      difficulty: 1,
      seed: 'sandbox',
      reference: {},
      referenceMakespan: 0,
      version: GENERATOR_VERSION,
    }
    const graph = buildGraph(draft)
    for (const vehicle of vehicles) {
      const route = shortestPath(graph, vehicle.start, vehicle.goal)
      if (route) draft.reference[vehicle.id] = route
    }
    draft.par = totalRouteLength(draft.reference)
    return draft
  }

  private sandboxTap(x: number, y: number): void {
    const node = this.city.nodeAt(x, y)
    if (!node) return
    const occupied = this.level.vehicles.some((spec) => spec.start === node || spec.goal === node)
    if (occupied) {
      toast(this, 'A parked car needs that corner. Pick another piece of road.', { y: 178 })
      return
    }
    const nextHoles = this.level.holes.includes(node)
      ? this.level.holes.filter((hole) => hole !== node)
      : [...this.level.holes, node]
    const rebuilt = this.buildSandboxLevel(
      nextHoles,
      this.level.vehicles.map((spec) => ({ start: spec.start, goal: spec.goal })),
    )
    const unreachable = rebuilt.vehicles.filter((spec) => !rebuilt.reference[spec.id])
    if (unreachable.length > 0) {
      toast(this, 'That road is the only way through. Keep it open.', { y: 178 })
      return
    }
    this.level = rebuilt
    this.sandboxLevel = rebuilt
    this.graph = buildGraph(this.level)
    this.routes = rebuilt.reference
    this.city.destroy()
    this.city = new CityView(this, this.level, this.theme, BOARD, this.root)
    this.root.bringToTop(this.uiLayer)
    this.refreshAll()
  }

  private sandboxAddCar(): void {
    if (this.running) return
    if (this.level.vehicles.length >= 6) {
      toast(this, 'Six cars is the limit for one board.', { y: 178 })
      return
    }
    const graph = buildGraph(this.level)
    const nodes = [...graph.nodes.keys()].filter(
      (id) => !this.level.vehicles.some((spec) => spec.start === id || spec.goal === id),
    )
    for (let tries = 0; tries < 60; tries += 1) {
      const start = nodes[Math.floor(Math.random() * nodes.length)]
      const goal = nodes[Math.floor(Math.random() * nodes.length)]
      if (!start || !goal || start === goal) continue
      if (!shortestPath(graph, start, goal)) continue
      const pairs = [...this.level.vehicles.map((spec) => ({ start: spec.start, goal: spec.goal })), { start, goal }]
      const rebuilt = this.buildSandboxLevel(this.level.holes, pairs)
      if (rebuilt.vehicles.some((spec) => !rebuilt.reference[spec.id])) continue
      this.level = rebuilt
      this.sandboxLevel = rebuilt
      this.graph = graph
      this.routes = rebuilt.reference
      this.city.destroy()
      this.city = new CityView(this, this.level, this.theme, BOARD, this.root)
      this.root.bringToTop(this.tray)
      this.root.bringToTop(this.runButton)
      this.refreshAll()
      return
    }
    toast(this, 'No room for another trip just now.', { y: 178 })
  }

  private sandboxReset(): void {
    if (this.running) this.stopRun()
    this.routes = {}
    this.selected = null
    this.refreshAll()
  }

  private sandboxRouteAll(): void {
    const routes: RouteMap = {}
    for (const spec of this.level.vehicles) {
      const route = shortestPath(this.graph, spec.start, spec.goal)
      if (route) routes[spec.id] = route
    }
    this.routes = routes
    this.refreshAll()
    toast(this, 'Shortest route drawn for every car.', { y: 178, duration: 1200 })
  }

  private sandboxSave(): void {
    if (!this.sandboxLevel) return
    const creation: SandboxSave = {
      id: `sandbox-${Date.now().toString(36)}`,
      name: `${this.level.vehicles.length} cars \u00b7 ${this.level.holes.length} blocked`,
      width: this.level.width,
      height: this.level.height,
      holes: this.level.holes,
      vehicles: this.level.vehicles.map((spec) => ({ id: spec.id, start: spec.start, goal: spec.goal })),
      at: Date.now(),
    }
    app.progress = saveSandbox(app.progress, creation)
    sound.horn()
    toast(this, 'Creation saved to this device.', { y: 178 })
  }

  /**
   * Read-only snapshot for the browser tests. Node points are design-space
   * coordinates, so a test can project them exactly like the renderer does.
   */
  testState(): {
    mode: GameMode
    levelId: string
    levelNumber: number
    running: boolean
    paused: boolean
    overlay: boolean
    hints: number
    par: number
    timeLimit: number
    routes: RouteMap
    nodes: Record<string, { x: number; y: number }>
    vehicles: { id: string; start: string; goal: string; kind: string; color: string; shape: string }[]
    status: string | null
    time: number
  } {
    const nodes: Record<string, { x: number; y: number }> = {}
    for (const id of this.graph.nodes.keys()) nodes[id] = this.city.point(id)
    return {
      mode: this.mode,
      levelId: this.level.id,
      levelNumber: globalNumber(this.level),
      running: this.running,
      paused: this.paused,
      overlay: Boolean(this.overlay),
      hints: this.hintsUsed,
      par: this.level.par,
      timeLimit: this.level.timeLimit,
      routes: Object.fromEntries(Object.entries(this.routes).map(([id, route]) => [id, [...route]])),
      nodes,
      vehicles: this.level.vehicles.map((spec) => ({
        id: spec.id,
        start: spec.start,
        goal: spec.goal,
        kind: spec.kind,
        color: spec.color,
        shape: spec.shape,
      })),
      status: this.simulation?.status ?? null,
      time: this.simulation?.time ?? 0,
    }
  }

  /** Routes every car with the shortest path; used by the arcade smoke test. */
  testRouteAll(): void {
    for (const spec of this.level.vehicles) this.autoRoute(spec.id)
    this.selected = null
    this.city.setSelected(null)
    this.refreshAll()
  }
}
