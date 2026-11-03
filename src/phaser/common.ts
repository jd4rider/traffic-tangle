import Phaser from 'phaser'
import { sound } from '../core/audio'
import { css, shade } from '../core/worlds'

export { css, shade }

export const DESIGN_W = 720
export const DESIGN_H = 1280
export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif'
export const FONT_TITLE = 'Georgia, "Iowan Old Style", "Times New Roman", serif'
export const INK = '#23303a'
export const INK_SOFT = '#61707c'
export const PAPER = '#fff6e6'
export const CREAM = 0xfff4e0
export const GOLD = 0xf2b544
export const MINT = 0xbfe3c8
export const NIGHT = 0x14283a

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface TextOptions {
  origin?: number | [number, number]
  align?: 'left' | 'center' | 'right'
  fontStyle?: string
  wrap?: number
  alpha?: number
  lineSpacing?: number
  fontFamily?: string
}

export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  size = 20,
  color: string = INK,
  options: TextOptions = {},
): Phaser.GameObjects.Text {
  const text = scene.add.text(x, y, content, {
    fontFamily: options.fontFamily ?? FONT,
    fontSize: `${size}px`,
    color,
    align: options.align ?? 'left',
    fontStyle: options.fontStyle,
    lineSpacing: options.lineSpacing,
    resolution: 2,
    wordWrap: options.wrap ? { width: options.wrap, useAdvancedWrap: true } : undefined,
  })
  if (options.origin !== undefined) {
    if (Array.isArray(options.origin)) text.setOrigin(options.origin[0], options.origin[1])
    else text.setOrigin(options.origin, options.origin)
  }
  if (options.alpha !== undefined) text.setAlpha(options.alpha)
  return text
}

export function title(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  size = 46,
  color: string = PAPER,
  origin = 0.5,
): Phaser.GameObjects.Text {
  return label(scene, x, y, content, size, color, { origin, fontFamily: FONT_TITLE, fontStyle: 'bold' })
}

/** A design-space container that always fits the screen, centred. */
export function stage(scene: Phaser.Scene, designWidth = DESIGN_W, designHeight = DESIGN_H): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0)
  const fit = (): void => {
    const width = scene.scale.width
    const height = scene.scale.height
    const scale = Math.min(width / designWidth, height / designHeight)
    root.setScale(scale)
    root.setPosition((width - designWidth * scale) / 2, (height - designHeight * scale) / 2)
  }
  fit()
  scene.scale.on(Phaser.Scale.Events.RESIZE, fit)
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, fit)
  })
  return root
}

/** Full-bleed backdrop in the current world's palette. */
export function skyBackdrop(
  scene: Phaser.Scene,
  top: number,
  bottom: number,
  options: { hills?: boolean; stars?: boolean; hillsColor?: number } = {},
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setDepth(-200)
  const draw = (): void => {
    const width = scene.scale.width
    const height = scene.scale.height
    graphics.clear()
    graphics.fillGradientStyle(top, top, bottom, bottom, 1)
    graphics.fillRect(0, 0, width, height)
    if (options.stars) {
      for (let index = 0; index < 70; index += 1) {
        const x = ((Math.sin(index * 12.9898) * 43758.5453) % 1 + 1) % 1
        const y = ((Math.sin(index * 78.233) * 12345.6789) % 1 + 1) % 1
        graphics.fillStyle(index % 6 === 0 ? 0xffe6a3 : 0xffffff, index % 3 === 0 ? 0.5 : 0.2)
        graphics.fillCircle(x * width, y * height * 0.8, 1 + ((index * 7) % 5) / 3)
      }
    }
    if (options.hills !== false) {
      const hill = options.hillsColor ?? shade(bottom, -0.12)
      graphics.fillStyle(hill, 0.85)
      graphics.fillEllipse(width * 0.2, height * 1.02, width * 0.9, height * 0.34)
      graphics.fillEllipse(width * 0.85, height * 1.05, width * 1.0, height * 0.36)
    }
  }
  draw()
  scene.scale.on(Phaser.Scale.Events.RESIZE, draw)
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, draw)
    graphics.destroy()
  })
  return graphics
}

export interface PanelOptions {
  radius?: number
  fill?: number
  side?: number
  alpha?: number
  raised?: number
  stroke?: number
  strokeAlpha?: number
  shadow?: boolean
  highlight?: boolean
}

/** A chunky raised card: shadow, side face, top face, hairline highlight. */
export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  options: PanelOptions = {},
): Phaser.GameObjects.Container {
  const radius = options.radius ?? 26
  const raised = options.raised ?? 6
  const fill = options.fill ?? CREAM
  const side = options.side ?? shade(fill, -0.26)
  const container = scene.add.container(x, y)
  const graphics = scene.add.graphics()
  if (options.shadow !== false) {
    graphics.fillStyle(0x1a2a33, 0.2)
    graphics.fillRoundedRect(4, raised + 7, width, height, radius)
  }
  graphics.fillStyle(side, 1)
  graphics.fillRoundedRect(0, raised, width, height, radius)
  graphics.fillStyle(fill, options.alpha ?? 1)
  graphics.fillRoundedRect(0, 0, width, height, radius)
  if (options.highlight !== false) {
    graphics.fillStyle(0xffffff, 0.18)
    graphics.fillRoundedRect(5, 4, width - 10, height * 0.34, radius * 0.8)
  }
  if (options.stroke !== undefined) {
    graphics.lineStyle(2, options.stroke, options.strokeAlpha ?? 0.6)
    graphics.strokeRoundedRect(1, 1, width - 2, height - 2, radius)
  }
  container.add(graphics)
  return container
}

export interface ButtonOptions {
  fill?: number
  textColor?: string
  size?: number
  radius?: number
  subtitle?: string
  disabled?: boolean
  icon?: string
  glow?: boolean
}

export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  onClick: () => void,
  options: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const radius = options.radius ?? Math.min(30, height / 2.4)
  const fill = options.fill ?? GOLD
  const container = scene.add.container(x, y)
  const graphics = scene.add.graphics()
  graphics.fillStyle(0x1a2a33, 0.24)
  graphics.fillRoundedRect(3, 8, width, height, radius)
  graphics.fillStyle(shade(fill, -0.3), 1)
  graphics.fillRoundedRect(0, 6, width, height, radius)
  graphics.fillStyle(fill, options.disabled ? 0.72 : 1)
  graphics.fillRoundedRect(0, 0, width, height, radius)
  graphics.fillStyle(0xffffff, 0.22)
  graphics.fillRoundedRect(5, 4, width - 10, height * 0.4, radius * 0.78)
  if (options.glow) {
    graphics.lineStyle(3, 0xffffff, 0.4)
    graphics.strokeRoundedRect(1.5, 1.5, width - 3, height - 3, radius)
  }
  const textColor = options.textColor ?? '#2b2415'
  const content = label(scene, width / 2, height / 2 - 2, text, options.size ?? 22, textColor, {
    origin: 0.5,
    fontStyle: 'bold',
  })
  container.add(graphics)
  container.add(content)
  if (options.icon) container.add(label(scene, 26, height / 2 - 2, options.icon, 20, textColor, { origin: 0.5 }))
  if (options.subtitle) {
    container.add(label(scene, width / 2, height - 16, options.subtitle, 11, textColor, { origin: 0.5, alpha: 0.76 }))
  }
  container.setSize(width, height + 8)
  if (!options.disabled) {
    container.setInteractive(
      new Phaser.Geom.Rectangle(width / 2, (height + 8) / 2, width, height + 8),
      Phaser.Geom.Rectangle.Contains,
    )
    container.input!.cursor = 'pointer'
    container.on('pointerdown', () => scene.tweens.add({ targets: container, scale: 0.97, duration: 60, ease: 'Sine.Out' }))
    container.on('pointerout', () => scene.tweens.add({ targets: container, scale: 1, duration: 90 }))
    container.on('pointerup', () => {
      scene.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Back.Out' })
      sound.click()
      onClick()
    })
  } else {
    container.setAlpha(0.55)
  }
  return container
}

export function iconButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  glyph: string,
  onClick: () => void,
  options: { size?: number; fill?: number; color?: string; label?: string; disabled?: boolean } = {},
): Phaser.GameObjects.Container {
  const size = options.size ?? 64
  const fill = options.fill ?? 0x2c4a58
  const container = scene.add.container(x, y)
  const graphics = scene.add.graphics()
  graphics.fillStyle(0x1a2a33, 0.22)
  graphics.fillRoundedRect(-size / 2 + 2, -size / 2 + 5, size, size, size / 3)
  graphics.fillStyle(shade(fill, 0.12), 1)
  graphics.fillRoundedRect(-size / 2, -size / 2, size, size, size / 3)
  graphics.fillStyle(0xffffff, 0.14)
  graphics.fillRoundedRect(-size / 2 + 4, -size / 2 + 3, size - 8, size * 0.38, size / 4)
  container.add(graphics)
  container.add(label(scene, 0, options.label ? -6 : 0, glyph, size * 0.42, options.color ?? PAPER, { origin: 0.5, fontStyle: 'bold' }))
  if (options.label) container.add(label(scene, 0, size * 0.29, options.label, 10, options.color ?? PAPER, { origin: 0.5, alpha: 0.82 }))
  container.setSize(size, size)
  if (!options.disabled) {
    container.setInteractive(new Phaser.Geom.Rectangle(0, 0, size, size), Phaser.Geom.Rectangle.Contains)
    container.input!.cursor = 'pointer'
    container.on('pointerdown', () => scene.tweens.add({ targets: container, scale: 0.93, duration: 60 }))
    container.on('pointerout', () => scene.tweens.add({ targets: container, scale: 1, duration: 80 }))
    container.on('pointerup', () => {
      scene.tweens.add({ targets: container, scale: 1, duration: 110, ease: 'Back.Out' })
      sound.click()
      onClick()
    })
  } else {
    container.setAlpha(0.42)
  }
  return container
}

export function starRow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  stars: number,
  size = 26,
  total = 3,
  animated = false,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y)
  const gap = size * 1.25
  for (let index = 0; index < total; index += 1) {
    const earned = index < stars
    const glyph = label(scene, (index - (total - 1) / 2) * gap, 0, earned ? '\u2605' : '\u2606', size, earned ? '#f7c948' : '#ffffff', {
      origin: 0.5,
      alpha: earned ? 1 : 0.3,
    })
    container.add(glyph)
    if (earned && animated) {
      glyph.setScale(0.4)
      scene.tweens.add({ targets: glyph, scale: 1, duration: 300, delay: 160 + index * 130, ease: 'Back.Out' })
    }
  }
  return container
}

export function announce(message: string): void {
  if (typeof document === 'undefined') return
  const node = document.getElementById('game-status')
  if (node) node.textContent = message
}

export function toast(
  scene: Phaser.Scene,
  message: string,
  options: { y?: number; width?: number; fill?: number; textColor?: string; duration?: number } = {},
): void {
  const width = options.width ?? 580
  const height = 62
  const x = DESIGN_W / 2
  const y = options.y ?? 210
  const container = scene.add.container(x, y).setDepth(3000)
  const card = panel(scene, -width / 2, 0, width, height, {
    fill: options.fill ?? 0x24404c,
    side: 0x102028,
    radius: 18,
    raised: 4,
    shadow: true,
    highlight: false,
    stroke: 0xffffff,
    strokeAlpha: 0.14,
  })
  const text = label(scene, 0, height / 2 - 1, message, 16, options.textColor ?? PAPER, {
    origin: 0.5,
    align: 'center',
    wrap: width - 40,
  })
  container.add(card)
  container.add(text)
  container.setAlpha(0)
  scene.tweens.add({
    targets: container,
    alpha: 1,
    y: y + 8,
    duration: 160,
    ease: 'Sine.Out',
    hold: options.duration ?? 1700,
    yoyo: true,
    onComplete: () => container.destroy(),
  })
  announce(message)
}

export function fadeTo(scene: Phaser.Scene, key: string, data?: object): void {
  // Guard on our own flag rather than camera.fadeEffect.isRunning: a scene that
  // has just faded *in* still has a running effect, which swallowed taps.
  if (scene.data.get('__leaving') === true) return
  scene.data.set('__leaving', true)
  scene.cameras.main.fadeOut(150, 16, 34, 42)
  // Switch on a wall-clock timer, not the fade event: camera effects advance with
  // the render loop, so on a loaded or backgrounded tab the transition could take
  // many seconds. The scene still fades in when it arrives.
  const leave = (): void => {
    if (scene.data.get('__left') === true) return
    scene.data.set('__left', true)
    scene.scene.start(key, data)
  }
  scene.time.delayedCall(160, leave)
  window.setTimeout(leave, 200)
}

export function fadeIn(scene: Phaser.Scene): void {
  scene.data.set('__leaving', false)
  scene.data.set('__left', false)
  scene.cameras.main.fadeIn(220, 16, 34, 42)
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

/** Shared safe-area inset in design pixels (portrait phones with notches). */
export const SAFE_TOP = 26
export const SAFE_BOTTOM = 26

export interface ScrollHandle {
  refresh: () => void
  /** True when the gesture that just ended was a drag rather than a tap. */
  moved: () => boolean
  destroy: () => void
}

/**
 * Drag-and-wheel scrolling for a clipped list inside the scaled design stage.
 * The mask is recomputed in screen space whenever the viewport changes, so the
 * clipped region always matches the visible card area on every device.
 */
export function scrollView(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  view: Rect,
  content: Phaser.GameObjects.Container,
  contentHeight: number,
): ScrollHandle {
  const maskGraphics = scene.make.graphics({})
  const mask = maskGraphics.createGeometryMask()
  content.setMask(mask)
  let offset = 0
  let dragging = false
  let moved = false
  let startY = 0
  let lastY = 0

  const maxScroll = (): number => Math.max(0, contentHeight - view.h)
  const clampOffset = (value: number): number => Math.min(0, Math.max(-maxScroll(), value))

  const apply = (): void => {
    content.setY(view.y + offset)
  }

  const updateMask = (): void => {
    const scale = root.scaleX || 1
    maskGraphics.clear()
    maskGraphics.fillStyle(0xffffff, 1)
    maskGraphics.fillRect(
      root.x + view.x * scale,
      root.y + view.y * scale,
      view.w * scale,
      view.h * scale,
    )
    apply()
  }

  const inside = (pointer: Phaser.Input.Pointer): boolean => {
    const scaleX = root.scaleX || 1
    const scaleY = root.scaleY || 1
    const x = (pointer.x - root.x) / scaleX
    const y = (pointer.y - root.y) / scaleY
    return x >= view.x && x <= view.x + view.w && y >= view.y && y <= view.y + view.h
  }

  const moveTo = (pointerY: number): void => {
    const scale = root.scaleY || 1
    offset = clampOffset(offset + (pointerY - lastY) / scale)
    lastY = pointerY
    apply()
  }

  // Scrolling listens at scene level instead of using an interactive overlay:
  // an overlay would sit above the cards and swallow every tap on them.
  const onDown = (pointer: Phaser.Input.Pointer): void => {
    if (!inside(pointer)) return
    dragging = true
    moved = false
    startY = pointer.y
    lastY = pointer.y
  }
  const onMove = (pointer: Phaser.Input.Pointer): void => {
    if (!dragging || !pointer.isDown) return
    if (!moved && Math.abs(pointer.y - startY) > 8) moved = true
    if (!moved) return
    moveTo(pointer.y)
  }
  const onUp = (): void => {
    dragging = false
  }
  scene.input.on('pointerdown', onDown)
  scene.input.on('pointermove', onMove)
  scene.input.on('pointerup', onUp)
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.off('pointerdown', onDown)
    scene.input.off('pointermove', onMove)
    scene.input.off('pointerup', onUp)
  })
  scene.input.on('wheel', (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
    const scale = root.scaleY || 1
    const x = (pointer.x - root.x) / (root.scaleX || 1)
    const y = (pointer.y - root.y) / scale
    if (x < view.x || x > view.x + view.w || y < view.y || y > view.y + view.h) return
    offset = clampOffset(offset - dy * 0.6)
    apply()
  })

  const onResize = (): void => updateMask()
  scene.scale.on(Phaser.Scale.Events.RESIZE, onResize)
  updateMask()

  return {
    refresh: () => updateMask(),
    moved: () => moved,
    destroy: () => {
      scene.scale.off(Phaser.Scale.Events.RESIZE, onResize)
      content.clearMask()
      maskGraphics.destroy()
    },
  }
}
