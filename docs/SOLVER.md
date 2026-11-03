# Solver, hints and difficulty

`src/core/solver.ts` searches the space of *route assignments*, and validates every candidate with the real simulation.

## Candidate routes

For each car, `enumeratePaths` walks simple paths from start to pin up to `shortest + 2` hops, shortest first, capped at 8 candidates. This keeps the branching factor small without ruling out the detours that avoid a jam.

## Search

A depth-first search over cars (fewest candidates first) with:

- pruning when the partial route length plus the shortest possible remainder cannot beat the best found,
- a simulation per complete assignment,
- hard budgets (`maxSims`, `maxMillis`).

Outcomes:

- `solved` — the plan finishes inside the clock; returns the routes, total hops and makespan.
- `unsolvable` — the candidate space was exhausted with no finishing plan.
- `unknown` — a budget stopped the search. Never treated as solved.

## Replay guarantee

`replaySolution` runs the returned routes through the same `simulate` call used by gameplay. `scripts/validate-levels.ts` independently re-solves a sample of shipped levels and fails if any returns `unknown`/`unsolvable` or beats the recorded par.

## Hints

`hintFor` solves the *current* board. If the player has already routed some cars, those routes are locked and only the remaining cars are solved, so the suggestion always fits what is on screen. The hint fills one verified route and explains why that car goes next. Hints used are recorded for the star rating (three stars requires none).

## Difficulty

Shipped difficulty is computed from world, car count, junction count, one-ways, signals, route length and position within the world — not from the level number alone. Progression is smoothed because each world keeps the previous mechanics while adding one new constraint.
