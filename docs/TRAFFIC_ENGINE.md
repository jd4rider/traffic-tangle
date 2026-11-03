# The traffic engine

`src/core/sim.ts` is a deterministic, fixed-step simulation. It is independent of Phaser: the renderer asks the engine where cars are, never the other way round.

## Timestep

A tick is exactly `1 / 60 s` (`SIM_DT`). The scene accumulates real time and steps whole ticks, so a slow frame changes *when* the next tick runs, never what it does. Baking, validation, the solver, hints and play all use the same step, so a verified solution replays identically.

## Road model

`s src/core/graph.ts` turns a level into a directed graph:

- Nodes are grid corners that are not holes.
- Every orthogonal pair of live nodes has a two-way road unless it is listed in `closed`.
- A pair listed in `oneWay` ("a>b") drops the reverse direction.
- `layers` lifts a pair onto a bridge; it is visual today, and part of the collision identity for future mechanics.
- Edges are one cell long. A car's position is `(segment index, progress 0..1)`.

## Car rules, in order

Each tick every car is processed in level order:

1. **Follow** the nearest car on the same directed segment, keeping a `FOLLOW_GAP` of 0.42 of a cell.
2. **Approach**: within one stop-line (`0.88`) of a junction, the car may only cross when:
   - the light is green for its movement axis (north–south or east–west),
   - no other car holds the junction,
   - the exit road has room (`EXIT_CLEAR` of 0.62), so nobody blocks the box.
3. **Cross** when the nose reaches the junction. The junction is reserved for that car until its nose is 0.16 past it or it stops, so a stalled car cannot freeze cross traffic forever.
4. **Arrive** at the final node: the car pulls over, fades out visually, and stays arrived for scoring.

Waiting is never a failure. The engine only ends a run on:

- `success` — every car arrived,
- `timeout` — the level clock expired,
- `gridlock` — every active car has been stopped and blocked by traffic for `GRIDLOCK_SECONDS` (7 s),
- `collision` — an overlap guard fired (defensive: reservations make this unreachable in campaign play).

## Signals

A signal has phases of `(axis, duration)` and an offset. The player can tap a signal to shift its offset by one second, which changes arrival order at that junction. Signals are part of the level data, so a verified plan includes its signal timing.

## Determinism and testing

- No randomness inside a step.
- Stable iteration order (level vehicle order).
- Every gridlock/closure decision is expressed in the engine, not the scene.
- `tests/traffic.test.ts` covers following distance, red lights, deadlines, collision detection and deterministic replay.
