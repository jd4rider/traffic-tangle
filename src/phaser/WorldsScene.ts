import Phaser from 'phaser'
import { app } from '../core/app'
import { LEVELS_PER_WORLD, WORLD_COUNT } from '../core/types'
import { css, shade, WORLDS, type WorldTheme } from '../core/worlds'
import {
  CREAM,
  DESIGN_W,
  INK,
  button,
  fadeIn,
  fadeTo,
  iconButton,
  label,
  panel,
  scrollView,
  skyBackdrop,
  stage,
  title,
} from './common'

const CARD_HEIGHT = 138
const CARD_GAP = 14

function worldProgress(world: WorldTheme): { cleared: number; stars: number; unlocked: boolean } {
  const progress = app.progress
  let cleared = 0
  let stars = 0
  for (let index = 0; index < LEVELS_PER_WORLD; index += 1) {
    const id = `level-${String((world.id - 1) * LEVELS_PER_WORLD + index + 1).padStart(4, '0')}`
    const record = progress.completed[id]
    if (!record) continue
    cleared += 1
    stars += record.stars
  }
  return { cleared, stars, unlocked: progress.unlocked > (world.id - 1) * LEVELS_PER_WORLD }
}

export class WorldsScene extends Phaser.Scene {
  constructor() {
    super('Worlds')
  }

  create(): void {
    app.refresh()
    skyBackdrop(this, 0x9ed8f0, 0xe9f7ff, { hillsColor: 0xc3e2c6 })
    fadeIn(this)
    const root = stage(this)
    root.add(iconButton(this, 56, 66, '\u2190', () => fadeTo(this, 'Menu'), { fill: 0x2c4a58, size: 58 }))
    root.add(title(this, DESIGN_W / 2, 58, 'Choose a world', 34, INK, 0.5).setOrigin(0.5, 0.35))
    root.add(
      label(this, DESIGN_W / 2, 108, `${Object.keys(app.progress.completed).length} of 1,000 gardens awake`, 15, '#4a6672', {
        origin: 0.5,
      }),
    )

    const view = { x: 40, y: 152, w: DESIGN_W - 80, h: 900 }
    const content = this.add.container(0, view.y)
    root.add(content)
    const totalHeight = WORLD_COUNT * (CARD_HEIGHT + CARD_GAP)
    const scroll = scrollView(this, root, view, content, totalHeight)

    WORLDS.forEach((world, index) => {
      const data = worldProgress(world)
      const y = index * (CARD_HEIGHT + CARD_GAP)
      const card = this.add.container(0, y)
      const fill = data.unlocked ? CREAM : 0xdfe4e6
      card.add(panel(this, 0, 0, view.w, CARD_HEIGHT, { fill, radius: 24, raised: 5, stroke: world.accent, strokeAlpha: 0.4 }))
      const art = this.add.graphics()
      art.fillStyle(world.sky[0], 1)
      art.fillRoundedRect(16, 18, 108, 100, 18)
      art.fillStyle(shade(world.ground, 0.05), 1)
      art.fillEllipse(70, 104, 96, 40)
      art.fillStyle(world.road, 1)
      art.fillRoundedRect(22, 74, 96, 22, 8)
      art.fillStyle(world.accent, 1)
      art.fillRoundedRect(44, 42, 34, 30, 10)
      art.fillStyle(0xffffff, 0.28)
      art.fillRoundedRect(48, 46, 26, 10, 5)
      art.fillStyle(0xfdf3d8, 0.8)
      for (let mark = 0; mark < 4; mark += 1) art.fillRect(30 + mark * 22, 84, 12, 3)
      card.add(art)
      card.add(label(this, 142, 24, world.name, 23, data.unlocked ? INK : '#7d8b93', { fontStyle: 'bold' }))
      card.add(label(this, 142, 56, world.teaches, 13, '#4d6570', { wrap: 470 }))
      const barWidth = 470
      const barY = 96
      const bar = this.add.graphics()
      bar.fillStyle(0xcfd9d4, 1)
      bar.fillRoundedRect(142, barY, barWidth, 12, 6)
      if (data.cleared > 0) {
        bar.fillStyle(world.accent, 1)
        bar.fillRoundedRect(142, barY, (barWidth * data.cleared) / LEVELS_PER_WORLD, 12, 6)
      }
      card.add(bar)
      card.add(label(this, 142, 112, `${data.cleared}/${LEVELS_PER_WORLD} gardens \u00b7 ${data.stars} stars`, 12, '#4d6570'))
      card.add(label(this, view.w - 20, 26, data.unlocked ? '\u25b6' : '\u25a0', 20, data.unlocked ? css(world.accent) : '#8d9aa1', { origin: 1, fontStyle: 'bold' }))
      if (!data.unlocked) {
        card.add(label(this, view.w - 20, 100, 'locked', 12, '#7d8b93', { origin: 1 }))
      }
      const hit = this.add
        .zone(0, 0, view.w, CARD_HEIGHT)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true })
      hit.on('pointerup', () => {
        if (!data.unlocked || scroll.moved()) return
        fadeTo(this, 'Levels', { world: world.id })
      })
      card.add(hit)
      content.add(card)
    })

    root.add(button(this, 60, 1090, 600, 64, 'Continue journey', () => fadeTo(this, 'Game', { mode: 'journey', levelNumber: app.progress.unlocked }), {
      fill: 0xf2b544,
      size: 21,
    }))
    root.add(label(this, DESIGN_W / 2, 1188, 'Worlds unlock as you clear gardens. Every level can be replayed for a better route.', 14, '#3c5763', { origin: 0.5, wrap: 600, align: 'center' }))
    this.input.keyboard?.on('keydown-ESC', () => fadeTo(this, 'Menu'))
  }
}
