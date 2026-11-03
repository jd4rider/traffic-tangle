# Level format

A level is a JSON object. Roads are implicit in the grid, which keeps 1,000 levels in a single ~1.1 MB manifest (about 300 KB gzipped).

```ts
interface LevelDefinition {
  id: string                  // "level-0001"
  world: number               // 1..20
  index: number               // 0..49
  name: string
  width: number; height: number   // grid corners (5..8 x 7..10)
  holes: string[]             // "3.4" — blocks with no road
  closed: string[]            // "3.4|4.4" — no road either way
  oneWay: string[]            // "3.4>4.4" — only this direction
  layers: Record<string, 1>   // "3.4|4.4" -> bridge deck
  signals: { at: string; phases: { axis: 'ns'|'ew'; duration: number }[]; offset: number }[]
  vehicles: {
    id: string; kind: VehicleKind; color: ColorId; shape: ShapeId;
    start: string; goal: string; priority?: boolean
  }[]
  timeLimit: number           // seconds; 0 means relaxed (Zen/sandbox)
  par: number                 // road hops in the verified plan (three-star budget)
  difficulty: number
  seed: string                // generator + attempt seed
  reference: Record<string, string[]>  // verified route per car (node ids)
  referenceMakespan: number
  version: number
}
```

## Validation

`validateLevel` checks schema, bounds, unique starts/goals/colours, legal reference routes, par accounting, reachability, and then *replays the reference plan through the simulation* and requires a success inside the clock. `validateManifest` runs that across all 1,000 levels and fails the build on any problem.

## Bake pipeline

`npm run bake`:

1. Builds a connected grid with holes.
2. Chooses unique starts/goals at a useful distance and routes them with BFS.
3. Applies one-way streets, closures, bridges and signals in ways that keep the reference plan legal.
4. Replays the plan; rejects gridlock, timeouts, unreachable goals and levels with no shared road.
5. Sets `timeLimit = ceil(makespan * 1.55 + 6)` and `par` to the reference hop count.
6. Falls back to a simpler two-car layout if a stubborn seed cannot be built.
7. Writes `src/data/levels.json` with a generator id and version.

The same generator powers Endless stages (seeded by run seed + stage) and the Daily Challenge (a published campaign level chosen by UTC day number, so every player sees the same board).
