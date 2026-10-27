# Rules and timing verification

This project now targets the **Tetris.com desktop Marathon game**, replacing the earlier NES-inspired rules. The engine is independently implemented; the official game code, graphics, fonts, and audio recordings are not redistributed.

Reference: [official game](https://play.tetris.com/play-now), inspected October 27, 2026, desktop game build `62B1EB587D30B208` (page package `ed6ac6050d45`). The loaded game's active parameter dictionary was inspected in a browser. Numerical observations are recorded in `test/fixtures/tetris-com-timing.json`; tests exercise the corresponding time boundaries rather than relying on visual guesses.

## Confirmed desktop configuration

| Setting                        | Observed value                                      | Implementation                                                   |
| ------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------- |
| Visible matrix / hidden buffer | 10 × 20 / 4 rows                                    | Same                                                             |
| Piece source                   | One of each seven shapes per bag                    | Shuffled seven-piece bags                                        |
| Next queue                     | 3                                                   | Same                                                             |
| Hold                           | Enabled, cannot hold again before locking           | Same                                                             |
| Ghost piece                    | Enabled, user toggle                                | Same                                                             |
| Countdown                      | 2,000 ms                                            | Same                                                             |
| Horizontal repeat              | Immediate move, 170 ms initial delay, 50 ms repeats | Millisecond simulation                                           |
| Direct placement budget        | 15; renewed on reaching a lower row                 | Locks on the exhausted budget when grounded                      |
| Soft drop                      | Integer part of normal fall interval / 20           | Zero becomes instant fall                                        |
| Generation delay               | Per-level values below                              | Same table                                                       |
| Ground lock delay              | Per-level values below                              | Same table                                                       |
| Clear / collapse               | 200 ms removal; 50 ms per falling row               | Combined settlement delay based on remaining cells' maximum fall |
| Level goal                     | 10 lines, carry excess lines forward                | Same                                                             |
| Start levels                   | 1–25                                                | Same                                                             |
| Final level                    | Complete level 30                                   | Same                                                             |

## Per-level timing

All values are milliseconds. A zero fall interval means instant gravity, not a one-millisecond approximation. Level 26's entry delay is intentionally 30 ms, as observed.

| Level | Fall / cell | Entry | Ground lock |
| ----: | ----------: | ----: | ----------: |
|     1 |        1000 |    50 |         500 |
|     2 |         793 |    50 |         500 |
|     3 |         618 |    50 |         500 |
|     4 |         473 |    50 |         500 |
|     5 |         355 |    50 |         500 |
|     6 |         262 |    50 |         500 |
|     7 |         190 |    50 |         500 |
|     8 |         135 |    50 |         500 |
|     9 |          94 |    50 |         500 |
|    10 |          64 |    50 |         500 |
|    11 |          43 |    50 |         500 |
|    12 |          28 |    50 |         500 |
|    13 |          18 |    50 |         500 |
|    14 |          11 |    50 |         500 |
|    15 |           7 |    50 |         500 |
|    16 |           4 |    50 |         500 |
|    17 |           3 |    50 |         500 |
|    18 |           2 |    50 |         500 |
|    19 |           1 |    50 |         500 |
|    20 |           0 |    47 |         450 |
|    21 |           0 |    43 |         400 |
|    22 |           0 |    40 |         350 |
|    23 |           0 |    35 |         300 |
|    24 |           0 |    30 |         250 |
|    25 |           0 |    25 |         200 |
|    26 |           0 |    30 |         195 |
|    27 |           0 |    15 |         184 |
|    28 |           0 |    10 |         167 |
|    29 |           0 |     5 |         151 |
|    30 |           0 |     0 |         150 |

## Rotation and scoring

The engine uses four-state SRS rotations with separate I and JLSTZ kick tables, a stable O shape, hidden spawn rows, collision rejection, block-out, and lock-out. Holding resets the swapped piece's orientation and spawn position. Hard drop locks immediately and awards two points per row; soft drop awards one. Drop points are not multiplied by level.

Observed line-clear values are 100 / 300 / 500 / 800. T-spins award 400 / 800 / 1,200 / 1,600 for zero through three lines; mini T-spins award 100 / 200 for zero / one line. Difficult consecutive clears receive ×1.5; combos add 50 times the combo index. Perfect-clear bonuses are 800 / 1,200 / 1,800 / 2,000, or 3,200 for a back-to-back Tetris perfect clear. These bonuses are multiplied by the pre-clear level. Tests cover full and mini spin recognition, wall kicks, scoring, level transitions, hidden spawns, and perfect clears.

## Controls and options

The official desktop keyboard defaults are left/right arrows, up arrow clockwise, Z counterclockwise, down arrow soft drop, Space hard drop, C hold, and Escape pause. All can be rebound here. X and Shift are convenience aliases for rotate/hold when default bindings are in use. On-screen buttons and board gestures remain available for phones. Starting a game uses a button, Space, or Enter.

Ghost/grid visibility, sound/music toggles, fullscreen, local personal best and five high scores, and key bindings are available. Mouse controls are optional: move to position, left click drops, right click holds, wheel rotates. Audio is independently synthesized; the optional melody is an original synthesized arrangement of the public-domain folk tune Korobeiniki.

## Scope of parity

The keyboard timing values and level configuration above are verified against the inspected desktop build. This is **not a claim of exhaustive, frame-for-frame equivalence** with the proprietary game. The official smart mouse targeting/path selection, exact input-event ordering at simultaneous boundaries, and every animation transition have not been reproduced or differentially certified. Clear/collapse visuals are simplified. Art, menus, music recordings, and effects differ. Browser scheduling can affect when a rendered frame becomes visible even though simulation timing uses milliseconds.

The shared-score multiplayer rooms are this project's additional feature; they are not an official Tetris.com mode. The official game may change after the recorded inspection date.
