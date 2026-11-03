import Phaser from 'phaser'
import { app } from '../core/app'
import { ACHIEVEMENTS } from '../core/achievements'
import { totalStars } from '../core/saves'
import {
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

export class AchievementsScene extends Phaser.Scene {
  constructor() {
    super('Achievements')
  }

  create(): void {
    app.refresh()
    const progress = app.progress
    skyBackdrop(this, 0x9ed8f0, 0xeaf7ff, { hillsColor: 0xc7e3ca })
    fadeIn(this)
    const root = stage(this)
    root.add(iconButton(this, 56, 66, '\u2190', () => fadeTo(this, 'Menu'), { fill: 0x2c4a58, size: 58 }))
    root.add(title(this, DESIGN_W / 2, 56, 'Badges', 34, INK).setOrigin(0.5, 0.4))
    root.add(
      label(
        this,
        DESIGN_W / 2,
        108,
        `${progress.achievements.length} of ${ACHIEVEMENTS.length} earned \u00b7 ${totalStars(progress)} stars`,
        15,
        '#48626e',
        { origin: 0.5 },
      ),
    )

    const view = { x: 34, y: 148, w: DESIGN_W - 68, h: 930 }
    const content = this.add.container(0, view.y)
    root.add(content)
    scrollView(this, root, view, content, ACHIEVEMENTS.length * 112 + 20)

    ACHIEVEMENTS.forEach((achievement, index) => {
      const y = index * 112
      const unlocked = progress.achievements.includes(achievement.id)
      const card = this.add.container(0, y)
      card.add(
        panel(this, 0, 0, view.w, 98, {
          fill: unlocked ? 0xfff2cf : 0xe3e8e9,
          radius: 20,
          raised: 4,
          highlight: false,
          stroke: unlocked ? 0xe0a93b : undefined,
          strokeAlpha: 0.55,
        }),
      )
      const badge = this.add.graphics()
      badge.fillStyle(unlocked ? 0xf2b544 : 0xbcc6ca, 1)
      badge.fillCircle(50, 49, 30)
      badge.fillStyle(0xffffff, 0.25)
      badge.fillCircle(42, 40, 12)
      card.add(badge)
      card.add(label(this, 50, 48, unlocked ? '\u2605' : '\u25cb', 26, unlocked ? '#5a3d05' : '#7e8b91', { origin: 0.5 }))
      card.add(label(this, 96, 18, achievement.name, 19, unlocked ? INK : '#6c7a80', { fontStyle: 'bold' }))
      card.add(label(this, 96, 46, achievement.description, 13, '#4f6772', { wrap: 500 }))
      card.add(
        label(this, view.w - 18, 20, unlocked ? 'earned' : 'locked', 12, unlocked ? '#8a6410' : '#7e8b91', {
          origin: [1, 0],
        }),
      )
      content.add(card)
    })

    root.add(button(this, 60, 1100, DESIGN_W - 120, 64, 'Back to menu', () => fadeTo(this, 'Menu'), { fill: 0xf2b544, size: 19 }))
    this.input.keyboard?.on('keydown-ESC', () => fadeTo(this, 'Menu'))
  }
}
