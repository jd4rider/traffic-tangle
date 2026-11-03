import Phaser from 'phaser'
import { app } from '../core/app'
import { levelFor } from '../core/levels'
import { LEVELS_PER_WORLD, WORLD_COUNT } from '../core/types'
import type { LevelRecord } from '../core/saves'
import { WORLDS } from '../core/worlds'
import {
  CREAM,
  DESIGN_W,
  GOLD,
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
  starRow,
  title,
} from './common'

const COLUMNS = 5
const TILE = 118
const TILE_GAP = 12

export class LevelsScene extends Phaser.Scene {
  private world = 1

  constructor() {
    super('Levels')
  }

  init(data: { world?: number }): void {
    this.world = Math.min(WORLD_COUNT, Math.max(1, data.world ?? 1))
  }

  create(): void {
    app.refresh()
    const theme = WORLDS[this.world - 1]
    skyBackdrop(this, theme.sky[0], theme.sky[1], { hillsColor: theme.ground, stars: theme.dark })
    fadeIn(this)
    const root = stage(this)
    root.add(iconButton(this, 56, 66, '\u2190', () => fadeTo(this, 'Worlds'), { fill: 0x2c4a58, size: 58 }))
    root.add(title(this, DESIGN_W / 2, 52, theme.name, 30, theme.dark ? '#f3e9d2' : INK, 0.5).setOrigin(0.5, 0.35))
    root.add(
      label(this, DESIGN_W / 2, 98, theme.teaches, 14, theme.dark ? '#c9d7de' : '#4a6672', { origin: 0.5, wrap: 600, align: 'center' }),
    )

    const world = this.world
    const first = (world - 1) * LEVELS_PER_WORLD + 1
    const progress = app.progress
    let cleared = 0
    let stars = 0
    for (let index = 0; index < LEVELS_PER_WORLD; index += 1) {
      const record = progress.completed[`level-${String(first + index).padStart(4, '0')}`]
      if (record) {
        cleared += 1
        stars += record.stars
      }
    }
    root.add(
      label(this, DESIGN_W / 2, 128, `${cleared}/50 cleared \u00b7 ${stars}/150 stars`, 14, theme.dark ? '#c9d7de' : '#3f5b66', {
        origin: 0.5,
      }),
    )

    const view = { x: 28, y: 158, w: DESIGN_W - 56, h: 856 }
    const content = this.add.container(0, view.y)
    root.add(content)
    const rows = Math.ceil(LEVELS_PER_WORLD / COLUMNS)
    const contentHeight = rows * (TILE + TILE_GAP) + TILE_GAP
    const scroll = scrollView(this, root, view, content, contentHeight)

    const tileWidth = (view.w - TILE_GAP * (COLUMNS - 1)) / COLUMNS

    for (let index = 0; index < LEVELS_PER_WORLD; index += 1) {
      const column = index % COLUMNS
      const row = Math.floor(index / COLUMNS)
      const x = column * (tileWidth + TILE_GAP)
      const y = TILE_GAP + row * (TILE + TILE_GAP)
      const number = first + index
      const record = progress.completed[`level-${String(number).padStart(4, '0')}`] as LevelRecord | undefined
      const unlocked = number <= progress.unlocked
      const card = this.add.container(x, y)
      const fill = unlocked ? (record ? 0xdff1e0 : CREAM) : 0xd8dee0
      card.add(panel(this, 0, 0, tileWidth, TILE - 6, { fill, radius: 18, raised: 4, highlight: false, shadow: false }))
      card.add(
        label(this, tileWidth / 2, 22, String(index + 1), 22, unlocked ? INK : '#87949a', {
          origin: 0.5,
          fontStyle: 'bold',
        }),
      )
      if (record) {
        card.add(starRow(this, tileWidth / 2, TILE - 32, record.stars, 13))
        card.add(
          label(this, tileWidth / 2, 52, `${record.bestLength} hops`, 10, '#496570', { origin: 0.5, alpha: 0.9 }),
        )
      } else if (unlocked) {
        card.add(label(this, tileWidth / 2, 58, 'new', 11, '#5c7a4e', { origin: 0.5, fontStyle: 'bold' }))
      } else {
        card.add(label(this, tileWidth / 2, 58, '\u25a0', 14, '#95a2a8', { origin: 0.5 }))
      }
      if (unlocked) {
        const hit = this.add.zone(0, 0, tileWidth, TILE - 6).setOrigin(0).setInteractive({ useHandCursor: true })
        hit.on('pointerup', () => {
          if (scroll.moved()) return
          fadeTo(this, 'Game', { mode: 'journey', levelNumber: number })
        })
        card.add(hit)
      }
      content.add(card)
    }

    const current = levelFor(this.world, Math.min(49, Math.max(0, progress.unlocked - first)))
    const canPlay = progress.unlocked >= first
    const footer = canPlay
      ? button(this, 60, 1092, 600, 68, `Play garden ${current.index + 1}`, () => fadeTo(this, 'Game', { mode: 'journey', levelNumber: progress.unlocked }), {
          fill: GOLD,
          size: 21,
        })
      : button(this, 60, 1092, 600, 68, 'Finish the previous world', () => undefined, { fill: 0x9da9ad, disabled: true, size: 19 })
    root.add(footer)
    root.add(label(this, DESIGN_W / 2, 1190, 'Drag the grid to see all 50 gardens.', 14, theme.dark ? '#c9d7de' : '#3f5b66', { origin: 0.5 }))
    this.input.keyboard?.on('keydown-ESC', () => fadeTo(this, 'Worlds'))
  }
}
