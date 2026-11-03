import type { ColorId, ShapeId, VehicleKind } from './types'

/** Toy-city palette. Colours are always paired with a shape glyph in UI. */
export const COLORS: Record<ColorId, { hex: number; name: string; ink: string }> = {
  red: { hex: 0xe4572e, name: 'Cherry', ink: '#5a1a08' },
  blue: { hex: 0x3d7fdc, name: 'Ocean', ink: '#0d2447' },
  green: { hex: 0x48a860, name: 'Clover', ink: '#103a1c' },
  amber: { hex: 0xf0b429, name: 'Honey', ink: '#4a3303' },
  violet: { hex: 0x8b5cf6, name: 'Berry', ink: '#2a1160' },
  teal: { hex: 0x23b5ad, name: 'Lagoon', ink: '#083c3a' },
  rose: { hex: 0xef6f9b, name: 'Blossom', ink: '#5a1330' },
  lime: { hex: 0x9bc53d, name: 'Sprout', ink: '#2c3a06' },
}

export const COLOR_ORDER: ColorId[] = ['red', 'blue', 'green', 'amber', 'violet', 'teal', 'rose', 'lime']

export const SHAPES: Record<ShapeId, string> = {
  circle: '\u25cf',
  triangle: '\u25b2',
  square: '\u25a0',
  star: '\u2605',
  diamond: '\u25c6',
  cross: '\u271a',
  heart: '\u2665',
  moon: '\u263e',
}

export const SHAPE_ORDER: ShapeId[] = ['circle', 'triangle', 'square', 'star', 'diamond', 'cross', 'heart', 'moon']

export const KIND_ICON: Record<VehicleKind, string> = {
  compact: '\u25ad',
  sports: '\u25b2',
  taxi: '\u25a4',
  van: '\u25a7',
  pickup: '\u25b1',
  bus: '\u25ac',
  fire: '\u2691',
  ambulance: '\u271a',
  truck: '\u25a6',
  semi: '\u25a5',
}

export function colorHex(color: ColorId): number {
  return COLORS[color].hex
}

export function colorName(color: ColorId): string {
  return COLORS[color].name
}

export function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`
}
