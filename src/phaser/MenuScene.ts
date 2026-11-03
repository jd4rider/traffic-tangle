import Phaser from 'phaser'
import { app } from '../core/app'
import { sound } from '../core/audio'
import { arcade } from '../core/arcade'
import { levelAt } from '../core/levels'
import { totalStars } from '../core/saves'
import { WORLDS } from '../core/worlds'
import {
  CREAM,
  DESIGN_W,
  announce,
  button,
  fadeIn,
  fadeTo,
  formatNumber,
  iconButton,
  label,
  skyBackdrop,
  stage,
  title,
} from './common'

/** Animated toy-city skyline used on the main menu. */
function buildSkyline(scene: Phaser.Scene, root: Phaser.GameObjects.Container): void {
  const graphics = scene.add.graphics()
  root.add(graphics)
  const baseY = 700
  // Distant hills and buildings.
  graphics.fillStyle(0xbcd9b8, 0.9)
  graphics.fillEllipse(120, baseY + 40, 420, 190)
  graphics.fillEllipse(600, baseY + 52, 480, 210)
  graphics.fillStyle(0x9dc79b, 0.85)
  graphics.fillEllipse(360, baseY + 70, 780, 200)
  const blocks = [
    { x: 78, w: 96, h: 150, fill: 0xe9c7a3 },
    { x: 190, w: 78, h: 110, fill: 0xf1d9b5 },
    { x: 282, w: 110, h: 180, fill: 0xd8b8a2 },
    { x: 412, w: 84, h: 128, fill: 0xe8d3b6 },
    { x: 512, w: 104, h: 164, fill: 0xdcc0a8 },
    { x: 632, w: 72, h: 118, fill: 0xf0d8ba },
  ]
  for (const block of blocks) {
    graphics.fillStyle(0x1a2a33, 0.16)
    graphics.fillRoundedRect(block.x + 5, baseY - block.h + 8, block.w, block.h, 12)
    graphics.fillStyle(block.fill, 1)
    graphics.fillRoundedRect(block.x, baseY - block.h, block.w, block.h + 12, 12)
    graphics.fillStyle(0xffffff, 0.22)
    graphics.fillRoundedRect(block.x + 6, baseY - block.h + 6, block.w - 12, 28, 8)
    graphics.fillStyle(0x5b7d8c, 0.55)
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        if ((row + col) % 4 === 0) continue
        graphics.fillRoundedRect(block.x + 12 + col * 24, baseY - block.h + 34 + row * 32, 14, 18, 3)
      }
    }
  }
  graphics.fillStyle(0x2f7a52, 1)
  for (const treeX of [46, 250, 386, 588, 700]) {
    graphics.fillCircle(treeX, baseY - 6, 22)
    graphics.fillCircle(treeX + 16, baseY - 18, 15)
    graphics.fillStyle(0x6b4a2f, 1)
    graphics.fillRect(treeX - 4, baseY + 6, 8, 22)
    graphics.fillStyle(0x2f7a52, 1)
  }
}

function buildStreet(scene: Phaser.Scene, root: Phaser.GameObjects.Container): void {
  const y = 760
  const graphics = scene.add.graphics()
  root.add(graphics)
  graphics.fillStyle(0xcfc6b3, 1)
  graphics.fillRect(0, y - 24, DESIGN_W, 120)
  graphics.fillStyle(0x586372, 1)
  graphics.fillRoundedRect(-10, y - 6, DESIGN_W + 20, 76, 10)
  graphics.fillStyle(0xfdf3d8, 0.75)
  for (let x = 10; x < DESIGN_W; x += 74) graphics.fillRoundedRect(x, y + 30, 38, 4, 2)

  // Three toy cars driving across the menu.
  const colors = [0xe4572e, 0x3d7fdc, 0x48a860]
  colors.forEach((color, index) => {
    const car = scene.add.container(index % 2 === 0 ? -80 : DESIGN_W + 80, y + 8 + (index % 2) * 30)
    const body = scene.add.graphics()
    body.fillStyle(0x16262e, 0.22)
    body.fillEllipse(2, 16, 96, 20)
    body.fillStyle(0x26313a, 1)
    body.fillCircle(-22, 14, 8)
    body.fillCircle(22, 14, 8)
    body.fillStyle(0xB0 & 0xffffff, 1)
    body.fillStyle(color, 1)
    body.fillRoundedRect(-44, -16, 88, 30, 12)
    body.fillStyle(0xffffff, 0.26)
    body.fillRoundedRect(-34, -12, 46, 12, 6)
    body.fillStyle(0xbfe6f2, 0.9)
    body.fillRoundedRect(8, -11, 20, 20, 5)
    body.fillStyle(0xfff2b0, 1)
    body.fillRect(40, -8, 5, 7)
    body.fillRect(40, 2, 5, 7)
    car.add(body)
    car.setScale(index === 1 ? 1.15 : 1)
    root.add(car)
    const start = index % 2 === 0 ? -80 : DESIGN_W + 80
    const end = index % 2 === 0 ? DESIGN_W + 80 : -80
    scene.tweens.add({
      targets: car,
      x: end,
      duration: 9000 + index * 2600,
      delay: index * 900,
      repeat: -1,
      ease: 'Linear',
      onRepeat: () => {
        car.x = start
      },
    })
    car.setRotation(index % 2 === 0 ? 0 : Math.PI)
  })

  // Traffic light on the corner.
  const light = scene.add.container(664, y - 46)
  const casing = scene.add.graphics()
  casing.fillStyle(0x1a2a33, 0.28)
  casing.fillRoundedRect(-15, -36, 34, 78, 9)
  casing.fillStyle(0x2c3a44, 1)
  casing.fillRoundedRect(-18, -42, 34, 78, 9)
  const red = scene.add.circle(-1, -28, 7, 0xe4572e)
  const amber = scene.add.circle(-1, -6, 7, 0x796b45)
  const green = scene.add.circle(-1, 16, 7, 0x2f5c3c)
  light.add([casing, red, amber, green])
  root.add(light)
  scene.time.addEvent({
    delay: 2200,
    loop: true,
    callback: () => {
      const phase = (light.getData('phase') as number ?? 0) + 1
      light.setData('phase', phase % 3)
      red.setFillStyle(phase % 3 === 0 ? 0xe4572e : 0x5a2f26)
      amber.setFillStyle(phase % 3 === 1 ? 0xf0b429 : 0x796b45)
      green.setFillStyle(phase % 3 === 2 ? 0x48a860 : 0x2f5c3c)
    },
  })
}

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu')
  }

  create(): void {
    app.refresh()
    const progress = app.progress
    skyBackdrop(this, 0x9ed8f0, 0xeaf7ff, { hillsColor: 0xbfe0c4 })
    fadeIn(this)
    const root = stage(this)
    buildSkyline(this, root)
    buildStreet(this, root)

    const badge = label(this, DESIGN_W / 2, 58, `${progress.achievements.length} badges \u00b7 ${formatNumber(totalStars(progress))} stars`, 15, '#3b5563', {
      origin: 0.5,
      alpha: 0.9,
    })
    root.add(badge)

    const titleShadow = title(this, DESIGN_W / 2 + 4, 152, 'TRAFFIC', 82, '#3f6c7c')
    titleShadow.setAlpha(0.3)
    const t1 = title(this, DESIGN_W / 2, 148, 'TRAFFIC', 82, '#1f3c4a')
    const t2 = title(this, DESIGN_W / 2, 226, 'TANGLE', 82, '#e08a2e')
    root.add([titleShadow, t1, t2])
    const tagline = label(this, DESIGN_W / 2, 300, 'Draw the routes. Start the traffic. Get everyone home.', 18, '#2f4b57', {
      origin: 0.5,
      align: 'center',
      wrap: 620,
    })
    root.add(tagline)

    root.add(iconButton(this, 648, 64, '\u2605', () => fadeTo(this, 'Achievements', { from: 'Menu' }), { fill: 0x2c4a58, size: 58 }))
    root.add(iconButton(this, 574, 64, '\u2699', () => fadeTo(this, 'Settings', { from: 'Menu' }), { fill: 0x2c4a58, size: 58 }))

    const continueLevel = progress.unlocked > 1
    const playMain = button(
      this,
      60,
      842,
      600,
      82,
      continueLevel ? `Continue \u00b7 ${levelAt(progress.unlocked).name}` : 'Play',
      () => {
        sound.select()
        fadeTo(this, 'Game', { mode: 'journey', levelNumber: progress.unlocked })
      },
      { fill: 0xf2b544, size: 25, glow: true },
    )
    root.add(playMain)

    const half = 290
    const rows: { text: string; icon: string; action: () => void }[] = [
      { text: 'Journey', icon: '\u25b6', action: () => fadeTo(this, 'Worlds') },
      { text: 'Endless', icon: '\u221e', action: () => fadeTo(this, 'Game', { mode: 'endless' }) },
      { text: 'Daily', icon: '\u25ce', action: () => fadeTo(this, 'Game', { mode: 'daily' }) },
      { text: 'Zen', icon: '\u263e', action: () => fadeTo(this, 'Game', { mode: 'zen', levelNumber: progress.unlocked }) },
      { text: 'Free Build', icon: '\u2692', action: () => fadeTo(this, 'Game', { mode: 'sandbox' }) },
      { text: 'Settings', icon: '\u2699', action: () => fadeTo(this, 'Settings', { from: 'Menu' }) },
    ]
    rows.forEach((row, index) => {
      const x = 60 + (index % 2) * (half + 20)
      const y = 950 + Math.floor(index / 2) * 74
      root.add(
        button(this, x, y, half, 62, row.text, row.action, {
          fill: index < 2 ? 0xdff0e2 : CREAM,
          size: 19,
          icon: row.icon,
        }),
      )
    })

    const worldsOpen = WORLDS.filter((world) => progress.unlocked > (world.id - 1) * 50).length
    root.add(
      label(this, DESIGN_W / 2, 1162, `${formatNumber(Object.keys(progress.completed).length)} of 1,000 gardens \u00b7 ${worldsOpen} worlds open`, 15, '#2f4b57', {
        origin: 0.5,
      }),
    )
    const arcadeButton = label(this, DESIGN_W / 2, 1206, 'Little Joy Arcade \u2197', 16, '#1f4a5a', {
      origin: 0.5,
      fontStyle: 'bold',
    })
    arcadeButton.setInteractive({ useHandCursor: true })
    arcadeButton.on('pointerup', () => arcade.openArcade())
    root.add(arcadeButton)
    root.add(
      label(this, DESIGN_W / 2, 1240, arcade.status(), 13, '#4a6672', { origin: 0.5, alpha: 0.8 }),
    )

    // Gentle floating animation keeps the menu alive without costing frames.
    if (!app.reducedMotion) {
      root.add(
        (() => {
          const sparkle = this.add.graphics()
          sparkle.fillStyle(0xffffff, 0.5)
          for (let index = 0; index < 18; index += 1) {
            const x = 40 + ((index * 137) % 640)
            const y = 330 + ((index * 91) % 360)
            sparkle.fillCircle(x, y, 1.6 + (index % 3))
          }
          this.tweens.add({ targets: sparkle, alpha: 0.25, duration: 2400, yoyo: true, repeat: -1 })
          return sparkle
        })(),
      )
    }

    this.input.keyboard?.on('keydown-ENTER', () => {
      sound.select()
      fadeTo(this, 'Game', { mode: 'journey', levelNumber: progress.unlocked })
    })
    this.input.keyboard?.on('keydown-SPACE', () => fadeTo(this, 'Worlds'))
    announce('Traffic Tangle main menu. Press Enter to continue, or choose a mode.')

    // Freeze tweens when the tab is hidden so background play stays cheap.
    const visibility = (): void => {
      this.tweens.timeScale = document.hidden ? 0 : 1
    }
    document.addEventListener('visibilitychange', visibility)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => document.removeEventListener('visibilitychange', visibility))
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.removeAllListeners())
  }
}
