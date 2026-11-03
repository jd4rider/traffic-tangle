import { LEVELS_PER_WORLD, WORLD_COUNT } from './types'

export type PropKind =
  | 'town'
  | 'crossing'
  | 'oneway'
  | 'signals'
  | 'roundabout'
  | 'bridge'
  | 'delivery'
  | 'downtown'
  | 'rail'
  | 'tunnel'
  | 'works'
  | 'emergency'
  | 'harbor'
  | 'mountain'
  | 'festival'
  | 'night'
  | 'airport'
  | 'metro'
  | 'master'
  | 'ultimate'

export interface WorldTheme {
  id: number
  name: string
  blurb: string
  teaches: string
  /** Sky gradient, top then bottom. */
  sky: [number, number]
  ground: number
  road: number
  sidewalk: number
  accent: number
  prop: PropKind
  dark: boolean
}

export const WORLDS: WorldTheme[] = [
  {
    id: 1,
    name: 'Little Town',
    blurb: 'Warm little streets where every trip is a short one.',
    teaches: 'Tap a car \u00b7 draw a route \u00b7 press GO',
    sky: [0x9fd8ef, 0xe8f7ff],
    ground: 0x94c98a,
    road: 0x5b6474,
    sidewalk: 0xf0e4c8,
    accent: 0xf2c94c,
    prop: 'town',
    dark: false,
  },
  {
    id: 2,
    name: 'Crossroads Corner',
    blurb: 'Two cars, one crossing, and a little patience.',
    teaches: 'Shared roads \u00b7 junction rules',
    sky: [0xa9d7ea, 0xe4f3f8],
    ground: 0x9bc48f,
    road: 0x565f6f,
    sidewalk: 0xeadfc6,
    accent: 0xef8f4b,
    prop: 'crossing',
    dark: false,
  },
  {
    id: 3,
    name: 'One-Way Avenue',
    blurb: 'The avenue only runs one way. Plan the loop back.',
    teaches: 'One-way streets \u00b7 no U-turns',
    sky: [0xa7c8e8, 0xe7f0fa],
    ground: 0xa3ae95,
    road: 0x4f5868,
    sidewalk: 0xdad3c0,
    accent: 0x4f8ff0,
    prop: 'oneway',
    dark: false,
  },
  {
    id: 4,
    name: 'Signal Square',
    blurb: 'The lights are on a timer, and so are you.',
    teaches: 'Traffic lights \u00b7 tap a light to shift its phase',
    sky: [0xb6d6e5, 0xf2f6f2],
    ground: 0xa8bd93,
    road: 0x545d6b,
    sidewalk: 0xe6dcc5,
    accent: 0xe4572e,
    prop: 'signals',
    dark: false,
  },
  {
    id: 5,
    name: 'Roundabout Ridge',
    blurb: 'Keep the circle turning and nobody has to stop.',
    teaches: 'Loops \u00b7 keeping junctions clear',
    sky: [0xb9d3b0, 0xf1f8e6],
    ground: 0x8fbf7c,
    road: 0x566058,
    sidewalk: 0xd9d2ad,
    accent: 0x48a860,
    prop: 'roundabout',
    dark: false,
  },
  {
    id: 6,
    name: 'Bridge Boulevard',
    blurb: 'Overpasses let two streams cross without touching.',
    teaches: 'Bridges \u00b7 layered roads',
    sky: [0x9ec4e2, 0xe9f2f8],
    ground: 0x9aa7a2,
    road: 0x4e5765,
    sidewalk: 0xd8d2c2,
    accent: 0x8b5cf6,
    prop: 'bridge',
    dark: false,
  },
  {
    id: 7,
    name: 'Delivery District',
    blurb: 'Vans, boxes and very tight loading bays.',
    teaches: 'Vans \u00b7 heavier traffic',
    sky: [0xf0c78f, 0xfff1d6],
    ground: 0xc9ab82,
    road: 0x5d5a55,
    sidewalk: 0xeadcbe,
    accent: 0xd97706,
    prop: 'delivery',
    dark: false,
  },
  {
    id: 8,
    name: 'Downtown Dash',
    blurb: 'Dense blocks, short lights, no room to wait.',
    teaches: 'Congestion \u00b7 longer routes',
    sky: [0x9ab6d4, 0xe4edf6],
    ground: 0x9aa3ad,
    road: 0x4b5462,
    sidewalk: 0xd3cec4,
    accent: 0xef6f9b,
    prop: 'downtown',
    dark: false,
  },
  {
    id: 9,
    name: 'Railroad Row',
    blurb: 'The crossing closes on a schedule. Be early.',
    teaches: 'Timing \u00b7 deadlines',
    sky: [0xc7b6a0, 0xf4e8d6],
    ground: 0xb0a189,
    road: 0x53514c,
    sidewalk: 0xe0d3ba,
    accent: 0xb45309,
    prop: 'rail',
    dark: false,
  },
  {
    id: 10,
    name: 'Tunnel Town',
    blurb: 'Under the hill, over the hill, around the hill.',
    teaches: 'Tunnels \u00b7 route alternatives',
    sky: [0x8d9db8, 0xdfe6ee],
    ground: 0x8f9682,
    road: 0x464e5a,
    sidewalk: 0xc9c6b8,
    accent: 0x23b5ad,
    prop: 'tunnel',
    dark: false,
  },
  {
    id: 11,
    name: 'Construction Chaos',
    blurb: 'Half the streets are dug up. The other half are busy.',
    teaches: 'Road closures \u00b7 detours',
    sky: [0xe8bf88, 0xfdf0d7],
    ground: 0xc3a879,
    road: 0x5a574f,
    sidewalk: 0xe6d6b4,
    accent: 0xf0b429,
    prop: 'works',
    dark: false,
  },
  {
    id: 12,
    name: 'Emergency Express',
    blurb: 'A fire engine needs the clear road, right now.',
    teaches: 'Fast vehicles \u00b7 clearance',
    sky: [0xe2a9a1, 0xffe9e2],
    ground: 0xbfa090,
    road: 0x55504f,
    sidewalk: 0xead6c9,
    accent: 0xe4572e,
    prop: 'emergency',
    dark: false,
  },
  {
    id: 13,
    name: 'Harbor Highway',
    blurb: 'Salt wind, dock roads and a very narrow quay.',
    teaches: 'Narrow quays \u00b7 shared road capacity',
    sky: [0x8fd3dd, 0xe7f7f4],
    ground: 0xd9c9a0,
    road: 0x505b62,
    sidewalk: 0xeadfc0,
    accent: 0x23b5ad,
    prop: 'harbor',
    dark: false,
  },
  {
    id: 14,
    name: 'Mountain Motorway',
    blurb: 'Switchbacks with a long way between junctions.',
    teaches: 'Long routes \u00b7 speed planning',
    sky: [0x9db7c9, 0xe5eef2],
    ground: 0x8fa38a,
    road: 0x4c5662,
    sidewalk: 0xc9c8bc,
    accent: 0x9bc53d,
    prop: 'mountain',
    dark: false,
  },
  {
    id: 15,
    name: 'Festival Frenzy',
    blurb: 'Bunting over every street and cars everywhere.',
    teaches: 'Crowded grids \u00b7 many destinations',
    sky: [0xf3b96b, 0xffeeda],
    ground: 0xb0bf8a,
    road: 0x57534f,
    sidewalk: 0xece0c4,
    accent: 0xef5f5b,
    prop: 'festival',
    dark: false,
  },
  {
    id: 16,
    name: 'Night Shift',
    blurb: 'Signals blink, headlights sweep, the city keeps moving.',
    teaches: 'Signals in sequence \u00b7 tight timing',
    sky: [0x1d2c4a, 0x0f1b2d],
    ground: 0x27364a,
    road: 0x2f3a4c,
    sidewalk: 0x4b5872,
    accent: 0x7dd3fc,
    prop: 'night',
    dark: true,
  },
  {
    id: 17,
    name: 'Airport Access',
    blurb: 'Big vehicles, priority lanes and a strict runway clock.',
    teaches: 'Large vehicles \u00b7 priority routes',
    sky: [0xb7cfe0, 0xeef5fa],
    ground: 0xa9b3bb,
    road: 0x505b69,
    sidewalk: 0xd8dde2,
    accent: 0x4f8ff0,
    prop: 'airport',
    dark: false,
  },
  {
    id: 18,
    name: 'Metro Madness',
    blurb: 'Every crossing counts when the whole city wakes up.',
    teaches: 'Multi-junction coordination',
    sky: [0xa7b8d4, 0xe9eef7],
    ground: 0x9aa6a2,
    road: 0x485260,
    sidewalk: 0xd0cec8,
    accent: 0x8b5cf6,
    prop: 'metro',
    dark: false,
  },
  {
    id: 19,
    name: 'Traffic Master',
    blurb: 'Squeeze every car through the tightest plan you can find.',
    teaches: 'Expert route budgets',
    sky: [0x264055, 0x0f2230],
    ground: 0x2c4450,
    road: 0x364452,
    sidewalk: 0x5c6b74,
    accent: 0xf2c94c,
    prop: 'master',
    dark: true,
  },
  {
    id: 20,
    name: 'Ultimate Tangle',
    blurb: 'The whole junction box, every rule, no wasted move.',
    teaches: 'Everything at once',
    sky: [0xf0c184, 0xfff2df],
    ground: 0xb9b08c,
    road: 0x53514a,
    sidewalk: 0xe8dcbd,
    accent: 0xef5f5b,
    prop: 'ultimate',
    dark: false,
  },
]

const NAME_PARTS: { first: string[]; second: string[] }[] = [
  { first: ['Willow', 'Acorn', 'Pebble', 'Maple', 'Clover', 'Honey', 'Sunny', 'Little', 'Copper', 'Daisy'], second: ['Lane', 'Green', 'Square'] },
  { first: ['Clock', 'Corner', 'Market', 'Lantern', 'Brick', 'Tram', 'Pigeon', 'Kettle', 'Baker', 'Quiet'], second: ['Crossing', 'Corner', 'Turn'] },
  { first: ['Arrow', 'Ribbon', 'Marlow', 'Compass', 'North', 'East', 'Signal', 'Mirror', 'Ember', 'Fable'], second: ['Avenue', 'Parade', 'Way'] },
  { first: ['Amber', 'Ruby', 'Clover', 'Bright', 'Ticker', 'Photon', 'Hour', 'Chime', 'Banner', 'Prism'], second: ['Square', 'Signals', 'Junction'] },
  { first: ['Orbit', 'Circle', 'Spindle', 'Marigold', 'Halo', 'Carousel', 'Wheel', 'Whirl', 'Ring', 'Lasso'], second: ['Circle', 'Round', 'Loop'] },
  { first: ['Raven', 'Stone', 'Arch', 'Iron', 'River', 'Cable', 'High', 'Pillar', 'Span', 'Keystone'], second: ['Bridge', 'Crossing', 'Reach'] },
  { first: ['Crate', 'Parcel', 'Handtruck', 'Cargo', 'Postal', 'Pallet', 'Dock', 'Manifest', 'Courier', 'Stack'], second: ['Depot', 'Delivery', 'Bay'] },
  { first: ['Metro', 'Neon', 'Glass', 'Harbor', 'Union', 'Times', 'Civic', 'Grand', 'Opera', 'Rush'], second: ['Blocks', 'Downtown', 'Rush'] },
  { first: ['Steam', 'Railside', 'Buffer', 'Sleeper', 'Whistle', 'Loco', 'Trestle', 'Caboose', 'Crossbuck', 'Depot'], second: ['Crossing', 'Junction', 'Line'] },
  { first: ['Burrow', 'Cavern', 'Echo', 'Under', 'Granite', 'Moss', 'Deep', 'Lantern', 'Hollow', 'Shadow'], second: ['Tunnel', 'Passage', 'Underpass'] },
  { first: ['Barrier', 'Scaffold', 'Detour', 'Hardhat', 'Cone', 'Trench', 'Rubble', 'Bypass', 'Spade', 'Girder'], second: ['Works', 'Yard', 'Route'] },
  { first: ['Siren', 'Rescue', 'Rapid', 'Ladder', 'Beacon', 'Priority', 'Lifeline', 'Dispatch', 'Flare', 'Clearway'], second: ['Express', 'Sprint', 'Run'] },
  { first: ['Quay', 'Dock', 'Anchor', 'Salt', 'Gull', 'Tide', 'Harbor', 'Pier', 'Crane', 'Boat'], second: ['Quay', 'Harbor', 'Way'] },
  { first: ['Alpine', 'Switchback', 'Summit', 'Granite', 'Pine', 'Ridge', 'Glacier', 'Cable', 'Valley', 'Echo'], second: ['Pass', 'Climb', 'Road'] },
  { first: ['Balloon', 'Bunting', 'Carnival', 'Parade', 'Confetti', 'Lantern', 'Fete', 'Jubilee', 'Ribbon', 'Stall'], second: ['Festival', 'Parade', 'Fair'] },
  { first: ['Midnight', 'Neon', 'Chrome', 'Moonlit', 'Signal', 'Afterhours', 'Violet', 'Glow', 'Hush', 'Starlit'], second: ['Shift', 'Lights', 'Night'] },
  { first: ['Runway', 'Terminal', 'Jetway', 'Transfer', 'Cabin', 'Gate', 'Passport', 'Trolley', 'Skycap', 'Apron'], second: ['Access', 'Shuttle', 'Loop'] },
  { first: ['Metro', 'Platform', 'Interchange', 'Rapid', 'Underground', 'District', 'Arcade', 'Crosstown', 'Central', 'City'], second: ['Lines', 'Grid', 'Network'] },
  { first: ['Master', 'Precision', 'Crown', 'Ironwork', 'Blueprint', 'Conductor', 'Virtuoso', 'Clockwork', 'Maestro', 'Guild'], second: ['Plan', 'Junction', 'Test'] },
  { first: ['Ultimate', 'Eternal', 'Grand', 'Final', 'Infinity', 'Zenith', 'Omega', 'Paramount', 'Apex', 'Culminate'], second: ['Tangle', 'Junction', 'Grid'] },
]

export function levelName(world: number, index: number): string {
  const parts = NAME_PARTS[world - 1] ?? NAME_PARTS[0]
  const first = parts.first[index % 10]
  const second = parts.second[Math.floor(index / 10) % 3]
  return `${first} ${second}`
}

export function worldOf(globalLevel: number): WorldTheme {
  const world = Math.floor((globalLevel - 1) / LEVELS_PER_WORLD) + 1
  return WORLDS[Math.min(WORLD_COUNT, Math.max(1, world)) - 1]
}

export function worldByNumber(world: number): WorldTheme {
  return WORLDS[Math.min(WORLD_COUNT, Math.max(1, world)) - 1]
}

export function worldNumber(globalLevel: number): number {
  return Math.floor((globalLevel - 1) / LEVELS_PER_WORLD) + 1
}

export function levelInWorld(globalLevel: number): number {
  return ((globalLevel - 1) % LEVELS_PER_WORLD) + 1
}

export function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`
}

export function shade(hex: number, amount: number): number {
  const r = (hex >> 16) & 255
  const g = (hex >> 8) & 255
  const b = hex & 255
  const mix = (channel: number): number =>
    Math.round(amount < 0 ? channel * (1 + amount) : channel + (255 - channel) * amount)
  return (mix(r) << 16) | (mix(g) << 8) | mix(b)
}
