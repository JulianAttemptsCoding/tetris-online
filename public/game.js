const COLS = 10,
  ROWS = 20,
  CELL = 30,
  FPS = 60.0988,
  FRAME_MS = 1000 / FPS;
const COLORS = [
  "",
  "#30c8ff",
  "#3f51ff",
  "#ff9d2e",
  "#ffe23d",
  "#51d66d",
  "#bd5cff",
  "#ff4e66",
];
const GRAVITY = [
  48, 43, 38, 33, 28, 23, 18, 13, 8, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2,
  2, 2, 2, 2, 2, 2, 1,
];
const BASES = [
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  [
    [2, 0, 0],
    [2, 2, 2],
    [0, 0, 0],
  ],
  [
    [0, 0, 3],
    [3, 3, 3],
    [0, 0, 0],
  ],
  [
    [4, 4],
    [4, 4],
  ],
  [
    [0, 5, 5],
    [5, 5, 0],
    [0, 0, 0],
  ],
  [
    [0, 6, 0],
    [6, 6, 6],
    [0, 0, 0],
  ],
  [
    [7, 7, 0],
    [0, 7, 7],
    [0, 0, 0],
  ],
];
const defaults = {
  left: "ArrowLeft",
  right: "ArrowRight",
  down: "ArrowDown",
  rotateCW: "x",
  rotateCCW: "z",
};
const boardEl = document.querySelector("#board"),
  ctx = boardEl.getContext("2d"),
  nextCtx = document.querySelector("#next").getContext("2d");
ctx.scale(CELL, CELL);
nextCtx.scale(20, 20);
let board,
  piece,
  next,
  score,
  lines,
  level,
  running = false,
  paused = false,
  gameMessage = "PRESS START";
let previousType = -1,
  gravityFrames = 0,
  softDropFrames = 0,
  softDropPoints = 0,
  placedCount = 0,
  entryDelay = 0,
  globalFrame = 0;
let lastTime = 0,
  accumulator = 0,
  socket,
  room = "",
  peerRoom,
  sendPeerState,
  playerName = "",
  lastSync = 0;
const held = { left: false, right: false, down: false };
let dasDirection = 0,
  dasFrames = 0;
const peerPlayers = new Map();
function loadKeys() {
  try {
    return JSON.parse(localStorage.getItem("tetris-keys") || "{}");
  } catch {
    return {};
  }
}
let keys = { ...defaults };
const storedKeys = loadKeys();
if (storedKeys && typeof storedKeys === "object")
  for (const action of Object.keys(defaults)) {
    const value = storedKeys[action];
    if (
      typeof value === "string" &&
      value.length > 0 &&
      value.length < 32 &&
      !Object.entries(keys).some(
        ([other, key]) =>
          other !== action && key.toLowerCase() === value.toLowerCase(),
      )
    )
      keys[action] = value;
  }
const keyLabel = (key) => (key === " " ? "Space" : key);
function paintBindings() {
  document
    .querySelectorAll("#bindings input")
    .forEach((input) => (input.value = keyLabel(keys[input.dataset.action])));
}
function saveKeys() {
  try {
    localStorage.setItem("tetris-keys", JSON.stringify(keys));
  } catch {}
  paintBindings();
}
const empty = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));
const clone = (matrix) => matrix.map((row) => [...row]);
function randomType() {
  let type = Math.floor(Math.random() * 7);
  if (type === previousType) type = Math.floor(Math.random() * 7);
  previousType = type;
  return type;
}
function newPiece() {
  const type = randomType();
  return { type, m: clone(BASES[type]), x: 3, y: 0, rotation: 0 };
}
function resetInputs() {
  held.left = held.right = held.down = false;
  dasDirection = dasFrames = softDropFrames = softDropPoints = 0;
}
function reset() {
  board = empty();
  previousType = -1;
  piece = newPiece();
  next = newPiece();
  score =
    lines =
    level =
    placedCount =
    gravityFrames =
    entryDelay =
    globalFrame =
      0;
  running = true;
  paused = false;
  gameMessage = "";
  lastTime = performance.now();
  accumulator = 0;
  resetInputs();
  ui();
}
function initialize() {
  board = empty();
  piece = newPiece();
  next = newPiece();
  score =
    lines =
    level =
    placedCount =
    gravityFrames =
    entryDelay =
    globalFrame =
      0;
  running = false;
  paused = false;
  gameMessage = "PRESS START";
  resetInputs();
  ui();
}
function collide(candidate, dx = 0, dy = 0, matrix = candidate.m) {
  return matrix.some((row, y) =>
    row.some((value, x) => {
      if (!value) return false;
      const bx = x + candidate.x + dx,
        by = y + candidate.y + dy;
      return (
        bx < 0 ||
        bx >= COLS ||
        by >= ROWS ||
        (by >= 0 && Boolean(board[by][bx]))
      );
    }),
  );
}
function rotateMatrix(matrix, direction) {
  const size = matrix.length;
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) =>
      direction > 0 ? matrix[size - 1 - x][y] : matrix[x][size - 1 - y],
    ),
  );
}
function rotate(direction) {
  if (!piece || piece.type === 3) return false;
  let rotation, matrix;
  if ([0, 4, 6].includes(piece.type)) {
    rotation = piece.rotation === 0 ? 1 : 0;
    matrix = rotation
      ? rotateMatrix(BASES[piece.type], 1)
      : clone(BASES[piece.type]);
  } else {
    rotation = (piece.rotation + direction + 4) % 4;
    matrix = rotateMatrix(piece.m, direction);
  }
  if (!collide(piece, 0, 0, matrix)) {
    piece.m = matrix;
    piece.rotation = rotation;
    return true;
  }
  return false;
}
function shift(direction) {
  if (piece && !collide(piece, direction, 0)) {
    piece.x += direction;
    return true;
  }
  return false;
}
function spawnNext() {
  piece = next;
  piece.x = 3;
  piece.y = 0;
  next = newPiece();
  gravityFrames = softDropFrames = softDropPoints = 0;
  if (collide(piece)) {
    running = false;
    gameMessage = "GAME OVER";
  }
  ui();
}
function entryDelayFor(bottom, cleared, frame) {
  const are = Math.min(18, 10 + 2 * Math.ceil(Math.max(0, 18 - bottom) / 4));
  return are + (cleared ? 20 - (frame % 4) : 0);
}
function lockPiece() {
  const bottom = piece.m.reduce(
    (lowest, row, y) =>
      row.some(Boolean) ? Math.max(lowest, piece.y + y) : lowest,
    0,
  );
  piece.m.forEach((row, y) =>
    row.forEach((value, x) => {
      if (value && piece.y + y >= 0) board[piece.y + y][piece.x + x] = value;
    }),
  );
  placedCount++;
  let cleared = 0;
  board = board.filter((row) => {
    if (row.every(Boolean)) {
      cleared++;
      return false;
    }
    return true;
  });
  while (board.length < ROWS) board.unshift(Array(COLS).fill(0));
  if (held.down) score = Math.min(999999, score + softDropPoints);
  if (cleared) {
    score = Math.min(
      999999,
      score + [0, 40, 100, 300, 1200][cleared] * (level + 1),
    );
    lines += cleared;
    level = Math.floor(lines / 10);
  }
  entryDelay = entryDelayFor(bottom, cleared, globalFrame);
  piece = null;
  ui();
}
function stepDown(soft = false) {
  if (!collide(piece, 0, 1)) {
    piece.y++;
    if (soft) softDropPoints++;
    return true;
  }
  lockPiece();
  return false;
}
function gravityDelay() {
  return GRAVITY[Math.min(level, GRAVITY.length - 1)];
}
function frameStep() {
  if (!running || paused) return;
  globalFrame++;
  const direction = held.left === held.right ? 0 : held.left ? -1 : 1;
  if (direction) {
    if (direction !== dasDirection) {
      dasDirection = direction;
      dasFrames = 0;
      if (piece) shift(direction);
    } else {
      dasFrames++;
      if (piece && dasFrames >= 16 && (dasFrames - 16) % 6 === 0)
        shift(direction);
    }
  } else {
    dasDirection = dasFrames = 0;
  }
  if (entryDelay) {
    entryDelay--;
    if (!entryDelay) spawnNext();
    return;
  }
  if (held.down) {
    softDropFrames++;
    if (softDropFrames >= 2) {
      softDropFrames = 0;
      stepDown(true);
      gravityFrames = 0;
    }
  } else {
    softDropFrames = softDropPoints = 0;
    gravityFrames++;
    if (gravityFrames >= gravityDelay()) {
      gravityFrames = 0;
      stepDown(false);
    }
  }
}
function drawMatrix(matrix, offset, context = ctx) {
  matrix.forEach((row, y) =>
    row.forEach((value, x) => {
      if (value) {
        context.fillStyle = COLORS[value];
        context.fillRect(x + offset.x, y + offset.y, 1, 1);
        context.fillStyle = "rgba(255,255,255,.25)";
        context.fillRect(x + offset.x, y + offset.y, 0.13, 1);
      }
    }),
  );
}
function draw() {
  ctx.fillStyle = "#020817";
  ctx.fillRect(0, 0, COLS, ROWS);
  drawMatrix(board, { x: 0, y: 0 });
  if (running && piece) drawMatrix(piece.m, { x: piece.x, y: piece.y });
  nextCtx.fillStyle = "#020817";
  nextCtx.fillRect(0, 0, 6, 5);
  drawMatrix(next.m, { x: 1, y: 1 }, nextCtx);
}
function ui() {
  document.querySelector("#score").textContent = String(score).padStart(6, "0");
  document.querySelector("#lines").textContent = String(lines).padStart(3, "0");
  document.querySelector("#level").textContent = String(level).padStart(2, "0");
  const pauseButton = document.querySelector("#pause");
  pauseButton.textContent = paused ? "RESUME" : "PAUSE";
  pauseButton.disabled = !running;
  pauseButton.setAttribute("aria-pressed", String(paused));
  document.querySelector("#start").textContent = running
    ? "RESTART"
    : gameMessage === "GAME OVER"
      ? "PLAY AGAIN"
      : "START";
  const status = document.querySelector("#gameStatus");
  status.textContent = paused ? "PAUSED" : gameMessage;
  status.classList.toggle("hidden", running && !paused);
}
function tick(time) {
  if (!lastTime) lastTime = time;
  accumulator += Math.min(time - lastTime, 250);
  lastTime = time;
  while (accumulator >= FRAME_MS) {
    frameStep();
    accumulator -= FRAME_MS;
  }
  draw();
  if (time - lastSync > 100 && ((socket?.connected && room) || sendPeerState)) {
    const state = networkState();
    if (socket?.connected && room) socket.volatile.emit("state", state);
    if (sendPeerState) sendPeerState(state);
    lastSync = time;
  }
  requestAnimationFrame(tick);
}
function actionForKey(key) {
  return Object.entries(keys).find(
    ([, bound]) => bound.toLowerCase() === key.toLowerCase(),
  )?.[0];
}
document.addEventListener("keydown", (event) => {
  if (
    event.target.matches?.("input,textarea,select") ||
    event.target.isContentEditable
  )
    return;
  const action = actionForKey(event.key);
  if (!action) return;
  event.preventDefault();
  if (!running || paused || event.repeat) return;
  if (action === "left" || action === "right" || action === "down") {
    held[action] = true;
    if (action === "down") {
      softDropFrames = 0;
      softDropPoints = 0;
    }
  } else if (action === "rotateCW") rotate(1);
  else if (action === "rotateCCW") rotate(-1);
});
document.addEventListener("keyup", (event) => {
  const action = actionForKey(event.key);
  if (action === "left" || action === "right" || action === "down") {
    held[action] = false;
    if (action === "down") {
      softDropFrames = softDropPoints = 0;
    }
  }
});
function autoPause() {
  resetInputs();
  if (running && !paused) {
    paused = true;
    ui();
  }
  accumulator = 0;
  lastTime = performance.now();
}
window.addEventListener("blur", autoPause);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) autoPause();
});
document.querySelector("#start").addEventListener("click", reset);
document.querySelector("#pause").addEventListener("click", () => {
  if (running) {
    paused = !paused;
    resetInputs();
    ui();
  }
});
document.querySelector("#settings").onclick = () => {
  const panel = document.querySelector("#settingsPanel");
  panel.classList.toggle("hidden");
  document
    .querySelector("#settings")
    .setAttribute("aria-expanded", String(!panel.classList.contains("hidden")));
  if (!panel.classList.contains("hidden")) autoPause();
};
document.querySelectorAll("#bindings input").forEach((input) =>
  input.addEventListener("keydown", (event) => {
    if (event.key === "Tab") return;
    event.preventDefault();
    event.stopPropagation();
    if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
    const action = input.dataset.action,
      previous = keys[action];
    const conflict = Object.keys(keys).find(
      (other) =>
        other !== action &&
        keys[other].toLowerCase() === event.key.toLowerCase(),
    );
    if (conflict) keys[conflict] = previous;
    keys[action] = event.key;
    saveKeys();
    input.blur();
  }),
);
document.querySelector("#resetKeys").onclick = () => {
  keys = { ...defaults };
  saveKeys();
};
paintBindings();
// Network and touch controls are initialized by multiplayer.js after this script.
window.__tetrisTest = {
  snapshot: () => ({
    board: board.map((row) => [...row]),
    piece: piece && {
      x: piece.x,
      y: piece.y,
      rotation: piece.rotation,
      type: piece.type,
    },
    score,
    lines,
    level,
    running,
    paused,
    placedCount,
    gravityFrames,
    dasFrames,
    entryDelay,
  }),
  frameStep,
  rules: { gravity: [...GRAVITY], entryDelayFor },
};
initialize();
requestAnimationFrame(tick);
