const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { JSDOM } = require("jsdom");
function loadGame(
  url = "https://julianattemptscoding.github.io/tetris-online/",
) {
  const root = path.join(__dirname, ".."),
    html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
  const window = new JSDOM(html, { url, runScripts: "outside-only" }).window;
  window.Math.random = () => 0;
  window.HTMLCanvasElement.prototype.getContext = () => ({
    scale() {},
    fillRect() {},
  });
  window.requestAnimationFrame = (callback) => {
    window.nextFrame = callback;
    return 1;
  };
  const source = ["engine.js", "game.js", "multiplayer.js"]
    .map((name) => fs.readFileSync(path.join(root, "public", name), "utf8"))
    .join("\n");
  window.eval(source + "\nwindow.networkSnapshot=networkState;");
  return window;
}
function start(w) {
  w.document.querySelector("#start").click();
  w.__tetrisTest.step(2000);
}
const key = (w, type, k, target = w.document) =>
  target.dispatchEvent(
    new w.KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }),
  );
test("initializes modern controls, level selector, hold, and three-piece preview", () => {
  const w = loadGame();
  assert.equal(w.document.querySelector("#startLevel").options.length, 25);
  assert.equal(w.document.querySelector("#level").textContent, "01");
  assert.equal(w.document.querySelector("#pause").disabled, true);
  assert.equal(w.__tetrisTest.snapshot().next.length, 3);
});
test("pause, resume, countdown, and restart work", () => {
  const w = loadGame();
  w.document.querySelector("#start").click();
  assert.equal(w.document.querySelector("#gameStatus").textContent, "2");
  w.__tetrisTest.step(2000);
  w.document.querySelector("#pause").click();
  assert.equal(w.document.querySelector("#gameStatus").textContent, "PAUSED");
  w.document.querySelector("#pause").click();
  assert.equal(w.__tetrisTest.snapshot().paused, false);
  w.document.querySelector("#start").click();
  assert.equal(w.__tetrisTest.snapshot().countdown, 2000);
});
test("keyboard supports arrows, hold, hard drop, and pause", () => {
  const w = loadGame();
  start(w);
  key(w, "keydown", "ArrowUp");
  assert.equal(w.__tetrisTest.snapshot().piece.rotation, 1);
  key(w, "keydown", "c");
  assert.notEqual(w.__tetrisTest.snapshot().holdType, null);
  key(w, "keydown", " ");
  assert.equal(w.__tetrisTest.snapshot().placedCount, 1);
  key(w, "keydown", "Escape");
  assert.equal(w.__tetrisTest.snapshot().paused, true);
});
test("typing in room inputs does not capture gameplay keys", () => {
  const w = loadGame();
  start(w);
  const event = new w.KeyboardEvent("keydown", {
    key: "c",
    bubbles: true,
    cancelable: true,
  });
  w.document.querySelector("#name").dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(w.__tetrisTest.snapshot().holdType, null);
});
test("opening settings or losing focus pauses and clears held movement", () => {
  const w = loadGame();
  start(w);
  key(w, "keydown", "ArrowLeft");
  w.dispatchEvent(new w.Event("blur"));
  const before = w.__tetrisTest.snapshot();
  w.__tetrisTest.step(5000);
  assert.equal(w.__tetrisTest.snapshot().piece.x, before.piece.x);
  assert.equal(w.__tetrisTest.snapshot().paused, true);
});
test("duplicate bindings swap and settings reset", () => {
  const w = loadGame();
  key(
    w,
    "keydown",
    "ArrowUp",
    w.document.querySelector('[data-action="left"]'),
  );
  const keys = JSON.parse(w.localStorage.getItem("tetris-keys"));
  assert.equal(keys.left, "ArrowUp");
  assert.equal(keys.rotateCW, "ArrowLeft");
  w.document.querySelector("#resetKeys").click();
  assert.equal(
    w.document.querySelector('[data-action="left"]').value,
    "ArrowLeft",
  );
});
test("network board shows active piece without changing settled cells", () => {
  const w = loadGame();
  start(w);
  assert.ok(w.networkSnapshot().board.flat().some(Boolean));
  assert.equal(w.__tetrisTest.snapshot().board.flat().some(Boolean), false);
});
test("solo works when Socket.IO is unavailable", async () => {
  const w = loadGame("http://localhost:3000/");
  w.loadSocketLibrary = async () => {
    throw Error("offline");
  };
  w.document.querySelector("#join").click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(
    w.document.querySelector("#roomStatus").textContent,
    /unavailable/,
  );
  start(w);
  assert.equal(w.__tetrisTest.snapshot().running, true);
});
test("peer API accepts valid boards, rejects malformed state, and leaves cleanly", async () => {
  const w = loadGame();
  let left = false;
  const action = { send() {} };
  w.loadPeerLibrary = async () => ({
    joinRoom: () => ({
      makeAction: () => action,
      leave() {
        left = true;
      },
    }),
  });
  w.document.querySelector("#join").click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  action.onMessage({ board: [[]], score: 0 }, { peerId: "bad" });
  assert.equal(w.document.querySelectorAll(".player").length, 1);
  action.onMessage(
    {
      name: "Friend",
      board: Array.from({ length: 20 }, () => Array(10).fill(0)),
      score: 1234567,
    },
    { peerId: "friend" },
  );
  assert.equal(w.document.querySelectorAll(".player").length, 2);
  w.document.querySelector("#leave").click();
  assert.equal(left, true);
  assert.equal(w.document.querySelectorAll(".player").length, 0);
});
