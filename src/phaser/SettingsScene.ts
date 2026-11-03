import Phaser from 'phaser'
import { app } from '../core/app'
import { arcade } from '../core/arcade'
import { sound } from '../core/audio'
import type { GameMode } from '../core/types'
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
  skyBackdrop,
  stage,
  title,
  toast,
} from './common'

interface SettingsData {
  from?: string
  levelNumber?: number
  mode?: GameMode
}

export class SettingsScene extends Phaser.Scene {
  private returnTo: SettingsData = {}

  constructor() {
    super('Settings')
  }

  init(data: SettingsData): void {
    this.returnTo = data ?? {}
  }

  create(): void {
    app.refresh()
    skyBackdrop(this, 0xb8dcea, 0xeef8fb, { hillsColor: 0xc9e0c9 })
    fadeIn(this)
    const root = stage(this)
    root.add(
      iconButton(this, 56, 66, '\u2190', () => this.goBack(), { fill: 0x2c4a58, size: 58 }),
    )
    root.add(title(this, DESIGN_W / 2, 56, 'Settings', 34, INK).setOrigin(0.5, 0.4))

    const settings = app.settings
    const rows: { label: string; detail: string; active: () => boolean; toggle: () => void }[] = [
      {
        label: 'Sound effects',
        detail: 'Clicks, horns, signals and boarding chimes.',
        active: () => app.settings.sound,
        toggle: () => {
          app.setSettings({ sound: !app.settings.sound })
          sound.click()
        },
      },
      {
        label: 'Music',
        detail: 'A gentle clockwork loop.',
        active: () => app.settings.music,
        toggle: () => app.setSettings({ music: !app.settings.music }),
      },
      {
        label: 'Reduced motion',
        detail: 'Calmer menus and no endless bobbing.',
        active: () => app.settings.reducedMotion,
        toggle: () => app.setSettings({ reducedMotion: !app.settings.reducedMotion }),
      },
      {
        label: 'High contrast',
        detail: 'Stronger route lines and clearer labels.',
        active: () => app.settings.highContrast,
        toggle: () => app.setSettings({ highContrast: !app.settings.highContrast }),
      },
    ]

    rows.forEach((row, index) => {
      const y = 168 + index * 108
      root.add(panel(this, 40, y, DESIGN_W - 80, 92, { fill: CREAM, radius: 20, raised: 4, highlight: false }))
      root.add(label(this, 66, y + 18, row.label, 20, INK, { fontStyle: 'bold' }))
      root.add(label(this, 66, y + 48, row.detail, 13, '#5b7280', { wrap: 430 }))
      const on = row.active()
      const toggle = this.add.container(DESIGN_W - 130, y + 22)
      const graphics = this.add.graphics()
      graphics.fillStyle(on ? 0x48a860 : 0xb8c2c6, 1)
      graphics.fillRoundedRect(0, 0, 80, 42, 21)
      graphics.fillStyle(0xffffff, 1)
      graphics.fillCircle(on ? 59 : 21, 21, 15)
      graphics.fillStyle(0xffffff, 0.25)
      graphics.fillRoundedRect(5, 4, 70, 14, 8)
      toggle.add(graphics)
      const hit = this.add.zone(0, 0, 80, 42).setOrigin(0).setInteractive({ useHandCursor: true })
      hit.on('pointerup', () => {
        row.toggle()
        this.scene.restart(this.returnTo)
      })
      toggle.add(hit)
      root.add(toggle)
      root.add(
        label(this, DESIGN_W - 90, y + 62, on ? 'on' : 'off', 12, on ? '#2f6e44' : '#7b8a90', { origin: [0.5, 0] }),
      )
    })

    const speedY = 168 + rows.length * 108 + 14
    root.add(panel(this, 40, speedY, DESIGN_W - 80, 148, { fill: CREAM, radius: 20, raised: 4, highlight: false }))
    root.add(label(this, 66, speedY + 16, 'Simulation speed', 20, INK, { fontStyle: 'bold' }))
    root.add(
      label(this, 66, speedY + 46, 'Slow the traffic down to watch a junction, or speed it up.', 13, '#5b7280', { wrap: 520 }),
    )
    const speeds = [
      { label: 'Slow', value: 0.5 },
      { label: 'Normal', value: 1 },
      { label: 'Fast', value: 1.6 },
    ]
    speeds.forEach((option, index) => {
      const active = Math.abs(app.settings.speed - option.value) < 0.01
      root.add(
        button(this, 60 + index * 196, speedY + 78, 180, 52, option.label, () => {
          app.setSettings({ speed: option.value })
          this.scene.restart(this.returnTo)
        }, { fill: active ? 0x48a860 : 0xdfe8e2, size: 16, textColor: active ? '#ffffff' : '#2b3a42' }),
      )
    })

    root.add(panel(this, 40, speedY + 166, DESIGN_W - 80, 150, { fill: 0xe8f2f4, radius: 20, raised: 4, highlight: false }))
    root.add(label(this, 66, speedY + 182, 'Little Joy Arcade', 20, INK, { fontStyle: 'bold' }))
    root.add(
      label(this, 66, speedY + 212, arcade.available() ? `Signed in as ${arcade.userLabel()}` : 'Playing locally \u00b7 progress stays on this device', 13, '#405a66', { wrap: 520 }),
    )
    root.add(
      button(this, 66, speedY + 246, 250, 56, 'Sync progress', async () => {
        await arcade.sync()
        toast(this, 'Synced with your arcade account where available.', { y: 150 })
      }, { fill: CREAM, size: 16 }),
    )
    root.add(
      button(this, 336, speedY + 246, 250, 56, 'Open arcade', () => arcade.openArcade(), { fill: CREAM, size: 16 }),
    )

    root.add(button(this, 60, 1140, DESIGN_W - 120, 66, 'Back', () => this.goBack(), { fill: 0xf2b544, size: 19 }))
    root.add(
      label(this, DESIGN_W / 2, 1230, 'Traffic Tangle \u00b7 v1.0.0 \u00b7 built for Little Joy Arcade', 12, '#4a6672', { origin: 0.5 }),
    )
    void settings
  }

  private goBack(): void {
    const from = this.returnTo.from
    if (from === 'Game' && this.returnTo.mode) {
      fadeTo(this, 'Game', { mode: this.returnTo.mode, levelNumber: this.returnTo.levelNumber })
      return
    }
    fadeTo(this, 'Menu')
  }
}
