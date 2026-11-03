import Phaser from 'phaser'
import './style.css'
import { sound } from './core/audio'
import { AchievementsScene } from './phaser/AchievementsScene'
import { GameScene } from './phaser/GameScene'
import { LevelsScene } from './phaser/LevelsScene'
import { MenuScene } from './phaser/MenuScene'
import { SettingsScene } from './phaser/SettingsScene'
import { WorldsScene } from './phaser/WorldsScene'

declare global {
  interface Window {
    __TT_GAME__?: Phaser.Game
    __TT__?: {
      game: Phaser.Game
      active: () => string | null
      state: () => unknown
      project: (x: number, y: number) => { x: number; y: number }
      tap: (x: number, y: number) => void
      drag: (points: { x: number; y: number }[]) => void
    }
  }
}

const DESIGN_W = 720
const DESIGN_H = 1280

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#132a3a',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: typeof window === 'undefined' ? DESIGN_W : window.innerWidth,
    height: typeof window === 'undefined' ? DESIGN_H : window.innerHeight,
  },
  render: {
    antialias: true,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  input: {
    activePointers: 3,
  },
  fps: { target: 60, forceSetTimeOut: false },
  scene: [MenuScene, WorldsScene, LevelsScene, GameScene, AchievementsScene, SettingsScene],
}

export const game = new Phaser.Game(config)
window.__TT_GAME__ = game

/** Maps design coordinates (720x1280) onto the real canvas. */
function project(x: number, y: number): { x: number; y: number } {
  const canvas = game.canvas
  const rect = canvas?.getBoundingClientRect() ?? { left: 0, top: 0 }
  const width = game.scale.width
  const height = game.scale.height
  const scale = Math.min(width / DESIGN_W, height / DESIGN_H)
  const ox = (width - DESIGN_W * scale) / 2
  const oy = (height - DESIGN_H * scale) / 2
  return { x: rect.left + ox + x * scale, y: rect.top + oy + y * scale }
}

/**
 * A deliberately small surface for automated browser tests. It only reads the
 * running scene and dispatches the same pointer events a finger would.
 */
window.__TT__ = {
  game,
  active: () => game.scene.getScenes(true)[0]?.scene.key ?? null,
  state: () => {
    const scene = game.scene.getScene('Game') as GameScene | undefined
    if (!scene || !scene.scene.isActive()) return null
    return scene.testState()
  },
  project,
  tap: (x: number, y: number) => {
    const point = project(x, y)
    const canvas = game.canvas
    const rect = canvas.getBoundingClientRect()
    const event = (type: string) =>
      canvas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: point.x,
          clientY: point.y,
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
        }),
      )
    void rect
    event('pointerdown')
    event('pointerup')
  },
  drag: (points: { x: number; y: number }[]) => {
    const canvas = game.canvas
    const send = (type: string, point: { x: number; y: number }, buttons: number) => {
      canvas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: point.x,
          clientY: point.y,
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          button: 0,
          buttons,
        }),
      )
    }
    const first = project(points[0].x, points[0].y)
    send('pointerdown', first, 1)
    for (const point of points.slice(1)) send('pointermove', project(point.x, point.y), 1)
    send('pointerup', project(points[points.length - 1].x, points[points.length - 1].y), 0)
  },
}

// Browsers only allow audio after a gesture; unlock the synth once, quietly.
document.addEventListener('pointerdown', () => sound.unlock(), { once: true, capture: true })
document.addEventListener('keydown', () => sound.unlock(), { once: true, capture: true })

// Stop iOS Safari from rubber-banding the page while playing.
document.addEventListener(
  'touchmove',
  (event) => {
    if (event.touches.length > 1) return
    const target = event.target as HTMLElement | null
    if (target && target.tagName === 'CANVAS') event.preventDefault()
  },
  { passive: false },
)

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const fallback = document.getElementById('boot-fail')
    if (!event.error) fallback?.classList.add('visible')
  })
}
