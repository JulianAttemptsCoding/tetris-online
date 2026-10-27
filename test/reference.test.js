const test = require("node:test"),
  assert = require("node:assert/strict"),
  Engine = require("../public/engine"),
  reference = require("./fixtures/tetris-com-timing.json");
for (const row of reference.levels)
  test("observed entry delay is respected at level " + row.level, () => {
    const g = new Engine(() => 0);
    g.reset(Math.min(25, row.level));
    g.step(2000);
    g.level = row.level;
    g.lines = Math.max(0, row.level - g.startLevel) * 10;
    g.hardDrop();
    assert.equal(g.delay, row.entry);
    if (row.entry) {
      g.step(row.entry - 1);
      assert.equal(g.piece, null);
      g.step(1);
    }
    assert.ok(g.piece);
    assert.equal(g.level, row.level);
  });
test("the shipped rules match the recorded desktop reference values", () => {
  for (const name of [
    "das",
    "arr",
    "countdown",
    "previews",
    "softDropFactor",
    "resetLimit",
    "clear",
    "collapse",
  ])
    assert.equal(Engine.RULES[name], reference[name], name);
  assert.deepEqual(Engine.LEVELS, reference.levels);
});
