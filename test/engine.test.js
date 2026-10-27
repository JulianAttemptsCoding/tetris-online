const test = require("node:test"),
  assert = require("node:assert/strict");
const Engine = require("../public/engine");
const empty = () => Array.from({ length: 20 }, () => Array(10).fill(0));
function game(level = 1) {
  const g = new Engine(() => 0);
  g.reset(level);
  g.step(2000);
  return g;
}
function setPiece(g, type, x, y, rotation = 0) {
  g.piece = g.makePiece(type);
  g.piece.x = x;
  g.piece.y = y;
  for (let i = 0; i < rotation; i++) {
    const m = g.piece.m;
    g.piece.m = m.map((row, y) => row.map((_, x) => m[m.length - 1 - x][y]));
  }
  g.piece.rotation = rotation;
  g.fallTime = 0;
  g.lockTime = 0;
  g.lockResets = 0;
  g.lowestY = y;
  g.lastRotation = null;
}
function tetrisFixture(g, perfect = false) {
  g.board = empty();
  for (let y = 16; y < 20; y++) {
    g.board[y].fill(2);
    g.board[y][5] = 0;
  }
  if (!perfect) g.board[15][0] = 2;
  setPiece(g, 0, 3, 16, 1);
}
function singleFixture(g, perfect = false) {
  g.board = empty();
  g.board[19].fill(2);
  g.board[19].fill(0, 3, 7);
  if (!perfect) g.board[18][0] = 2;
  setPiece(g, 0, 3, 18);
}

test("two-second countdown blocks input and gravity until it expires", () => {
  const g = new Engine(() => 0);
  g.reset();
  const x = g.piece.x,
    y = g.piece.y;
  g.press("hardDrop");
  g.press("left");
  g.step(1999);
  assert.equal(g.placedCount, 0);
  assert.equal(g.piece.x, x);
  assert.equal(g.piece.y, y);
  assert.equal(g.countdown, 1);
  g.step(1);
  assert.equal(g.countdown, 0);
  g.step(999);
  assert.equal(g.piece.y, y);
  g.step(1);
  assert.equal(g.piece.y, y + 1);
});
test("each bag contains all seven types with no missing or duplicate pieces", () => {
  const g = game();
  g.bag = [];
  for (let b = 0; b < 100; b++)
    assert.deepEqual(
      Array.from({ length: 7 }, () => g.randomType()).sort(),
      [0, 1, 2, 3, 4, 5, 6],
    );
});
const fall = [
  1000, 793, 618, 473, 355, 262, 190, 135, 94, 64, 43, 28, 18, 11, 7, 4, 3, 2,
  1,
];
for (let level = 1; level <= 19; level++)
  test(
    "level " +
      level +
      " falls at the observed " +
      fall[level - 1] +
      " ms interval",
    () => {
      const g = game(level);
      setPiece(g, 3, 4, 0);
      g.step(fall[level - 1] - 1);
      assert.equal(g.piece.y, 0);
      g.step(1);
      assert.equal(g.piece.y, 1);
    },
  );
const lock = [
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500,
  500, 500, 500, 500, 450, 400, 350, 300, 250, 200, 195, 184, 167, 151, 150,
];
for (let level = 1; level <= 30; level++)
  test(
    "level " +
      level +
      " locks after " +
      lock[level - 1] +
      " ms of ground contact",
    () => {
      const g = game();
      g.level = level;
      setPiece(g, 3, 4, 18);
      g.step(lock[level - 1] - 1);
      assert.equal(g.placedCount, 0);
      g.step(1);
      assert.equal(g.placedCount, 1);
    },
  );
test("level 20 and above use instant gravity and still allow ground movement", () => {
  const g = game(20);
  g.step(1);
  assert.equal(g.grounded(), true);
  assert.equal(g.placedCount, 0);
  const x = g.piece.x;
  g.press("left");
  assert.equal(g.piece.x, x - 1);
});
test("horizontal input is immediate, repeats at 170 ms, then every 50 ms", () => {
  const g = game();
  setPiece(g, 3, 4, 0);
  g.press("left");
  assert.equal(g.piece.x, 3);
  g.step(169);
  assert.equal(g.piece.x, 3);
  g.step(1);
  assert.equal(g.piece.x, 2);
  g.step(49);
  assert.equal(g.piece.x, 2);
  g.step(1);
  assert.equal(g.piece.x, 1);
  g.release("left");
  g.step(300);
  assert.equal(g.piece.x, 1);
});
test("soft drop uses the level gravity divided by 20 and scores one per cell", () => {
  const g = game(2);
  const y = g.piece.y;
  g.press("down");
  assert.equal(g.piece.y, y + 1);
  g.step(38);
  assert.equal(g.piece.y, y + 1);
  g.step(1);
  assert.equal(g.piece.y, y + 2);
  assert.equal(g.score, 2);
});
test("hard drop locks immediately, scores twice the distance, and waits for entry", () => {
  const g = game();
  const distance = g.ghostY() - g.piece.y;
  g.press("hardDrop");
  assert.equal(g.placedCount, 1);
  assert.equal(g.score, distance * 2);
  assert.equal(g.piece, null);
  g.step(49);
  assert.equal(g.piece, null);
  g.step(1);
  assert.ok(g.piece);
});
test("hold is once per placed piece, swaps, and resets orientation and position", () => {
  const g = game();
  const first = g.piece.type;
  assert.equal(g.hold(), true);
  const second = g.piece.type;
  assert.equal(g.holdType, first);
  assert.equal(g.hold(), false);
  g.hardDrop();
  g.step(50);
  assert.equal(g.hold(), true);
  assert.equal(g.piece.type, first);
  assert.equal(g.piece.rotation, 0);
  assert.equal(g.piece.y, -1);
  assert.notEqual(first, second);
});
test("successful grounded moves reset lock delay only fifteen times", () => {
  const g = game();
  setPiece(g, 3, 4, 18);
  for (let i = 0; i < 14; i++) {
    g.step(100);
    g.shift(i % 2 ? -1 : 1);
    assert.equal(g.lockTime, 0);
  }
  assert.equal(g.lockResets, 14);
  assert.equal(g.placedCount, 0);
  g.shift(1);
  assert.equal(g.placedCount, 1);
});
test("blocked movement does not reset the lock timer", () => {
  const g = game();
  setPiece(g, 3, 0, 18);
  g.step(250);
  assert.equal(g.shift(-1), false);
  assert.equal(g.lockTime, 250);
  g.step(250);
  assert.equal(g.placedCount, 1);
});
test("SRS rotates all seven shapes through four orientations without changing cell count", () => {
  for (let type = 0; type < 7; type++) {
    const g = game();
    setPiece(g, type, 3, 5);
    const before = JSON.stringify(g.piece.m);
    for (let i = 0; i < 4; i++) assert.equal(g.rotate(1), true);
    assert.equal(JSON.stringify(g.piece.m), before);
    assert.equal(g.piece.rotation, 0);
  }
});
test("JLSTZ and I use different wall kick offsets", () => {
  const g = game();
  setPiece(g, 5, -1, 5, 1);
  assert.equal(g.collide(), false);
  assert.equal(g.rotate(1), true);
  assert.equal(g.piece.x, 0);
  setPiece(g, 0, -2, 5, 1);
  assert.equal(g.collide(), false);
  assert.equal(g.rotate(-1), true);
  assert.equal(g.piece.x, 0);
});
test("rotation surrounded by occupied cells fails without mutating the piece", () => {
  const g = game();
  setPiece(g, 5, 3, 5);
  for (let y = 1; y < 12; y++) g.board[y].fill(2);
  g.piece.m.forEach((row, y) =>
    row.forEach((v, x) => {
      if (v) g.board[y + 5][x + 3] = 0;
    }),
  );
  const before = JSON.stringify(g.piece);
  assert.equal(g.rotate(1), false);
  assert.equal(JSON.stringify(g.piece), before);
});
test("a single uses the pre-clear level and carries extra lines into the next level", () => {
  const g = game();
  g.lines = 9;
  singleFixture(g);
  g.lock();
  assert.equal(g.score, 100);
  assert.equal(g.level, 2);
  assert.equal(g.lines, 10);
});
test("line clear and collapse delay preserve rows until settlement", () => {
  const g = game();
  singleFixture(g);
  g.lock();
  assert.equal(g.delay, 300);
  g.step(299);
  assert.equal(g.piece, null);
  g.step(1);
  assert.ok(g.piece);
  assert.equal(g.board[19][0], 2);
  assert.equal(g.board[19].filter(Boolean).length, 1);
});
test("back-to-back Tetrises and combos award their separate bonuses", () => {
  const g = game();
  tetrisFixture(g);
  g.lock();
  assert.equal(g.score, 800);
  g.step(450);
  tetrisFixture(g);
  g.lock();
  assert.equal(g.score, 800 + 1200 + 50);
});
test("perfect clears award the observed normal and back-to-back bonuses", () => {
  const g = game();
  tetrisFixture(g, true);
  g.lock();
  assert.equal(g.score, 2800);
  g.step(450);
  assert.equal(g.board.flat().some(Boolean), false);
  tetrisFixture(g, true);
  g.lock();
  assert.equal(g.score, 2800 + 1200 + 50 + 3200);
});
test("T-spin detection distinguishes full, mini, and non-rotation placements", () => {
  for (const [kind, points] of [
    ["full", 400],
    ["mini", 100],
    ["none", 0],
  ]) {
    const g = game();
    setPiece(g, 5, 3, 17);
    for (const [x, y] of [
      [5, 17],
      [3, 19],
      [5, 19],
    ])
      g.board[y][x] = 2;
    if (kind === "full") g.board[17][3] = 2;
    if (kind !== "none") g.lastRotation = { kick: 0 };
    g.lock();
    assert.equal(g.score, points);
  }
});
test("blocked spawn and a fully hidden lock top out without overwriting occupied cells", () => {
  const g = game();
  g.board[0][4] = 2;
  g.spawn(3);
  assert.equal(g.running, false);
  assert.equal(g.board[0][4], 2);
  const h = game();
  setPiece(h, 0, 3, -3);
  h.lock();
  assert.equal(h.running, false);
  assert.equal(h.message, "GAME OVER");
});
test("pause freezes gravity, lock timer, countdown, and elapsed time", () => {
  const g = game();
  setPiece(g, 3, 4, 18);
  g.step(100);
  g.paused = true;
  g.step(10000);
  assert.equal(g.lockTime, 100);
  assert.equal(g.elapsed, 100);
  assert.equal(g.placedCount, 0);
});
test("the game completes when level 30 line goal is reached", () => {
  const g = game(25);
  g.level = 30;
  g.lines = 59;
  singleFixture(g);
  g.lock();
  g.step(300);
  assert.equal(g.completed, true);
  assert.equal(g.message, "COMPLETE");
  assert.equal(g.running, false);
});
test("fractional frame durations sum consistently and reset clears leftover time", () => {
  const a = game(),
    b = game();
  for (let i = 0; i < 120; i++) a.step(1000 / 60);
  b.step(2000);
  assert.equal(a.piece.y, b.piece.y);
  a.step(0.9);
  a.reset();
  assert.equal(a.timeRemainder, 0);
});

test("paused and countdown states reject every direct movement action", () => {
  const g = game();
  const before = JSON.stringify(g.piece);
  g.paused = true;
  for (const action of [
    () => g.shift(1),
    () => g.rotate(1),
    () => g.drop(true),
    () => g.hardDrop(),
    () => g.hold(),
  ])
    assert.equal(action(), false);
  assert.equal(JSON.stringify(g.piece), before);
  g.reset();
  const start = JSON.stringify(g.piece);
  g.rotate(1);
  g.hold();
  g.drop(true);
  g.shift(-1);
  assert.equal(JSON.stringify(g.piece), start);
});
