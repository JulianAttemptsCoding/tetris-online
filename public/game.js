const COLS = 10,
  ROWS = 20,
  CELL = 30,
  FRAME_MS = 1000 / 60;
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
const defaults = {
  left: "ArrowLeft",
  right: "ArrowRight",
  down: "ArrowDown",
  rotateCW: "ArrowUp",
  rotateCCW: "z",
  hardDrop: " ",
  hold: "c",
  pause: "Escape",
};
const boardEl = document.querySelector("#board"),
  ctx = boardEl.getContext("2d"),
  nextCtx = document.querySelector("#next").getContext("2d"),
  holdCtx = document.querySelector("#hold").getContext("2d");
ctx.scale(CELL, CELL);
nextCtx.scale(20, 20);
holdCtx.scale(20, 20);
for (let value = 1; value <= 25; value++) {
  const option = document.createElement("option");
  option.value = String(value);
  option.textContent = String(value);
  document.querySelector("#startLevel").append(option);
}
const engine = new TetrisEngine();
const clone = (m) => m.map((row) => [...row]);
let board, piece, score, lines, level, running, paused;
let socket,
  room = "",
  peerRoom,
  sendPeerState,
  playerName = "",
  lastSync = 0,
  lastTime = 0;
const peerPlayers = new Map();
let keys = { ...defaults },
  options = {
    ghost: true,
    grid: true,
    sound: false,
    music: false,
    mouse: false,
  };
try {
  const stored = JSON.parse(localStorage.getItem("tetris-keys") || "{}");
  for (const action of Object.keys(defaults))
    if (
      typeof stored?.[action] === "string" &&
      stored[action] &&
      stored[action].length < 32
    )
      keys[action] = stored[action];
  const saved = JSON.parse(localStorage.getItem("tetris-options") || "{}");
  for (const key of Object.keys(options))
    if (typeof saved?.[key] === "boolean") options[key] = saved[key];
} catch {}
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
function sync() {
  ({ board, piece, score, lines, level, running, paused } = engine);
}
function resetInputs() {
  engine.clearInputs();
}
function reset() {
  commitScore();
  scoreCommitted = false;
  engine.reset(Number(document.querySelector("#startLevel").value));
  document.querySelector("#settingsPanel").classList.add("hidden");
  document.querySelector("#settings").setAttribute("aria-expanded", "false");
  lastTime = performance.now();
  sync();
  ui();
  sound(440);
  if (options.music) {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume();
    } catch {}
  }
}
function pause() {
  if (!engine.running) return;
  engine.paused = !engine.paused;
  resetInputs();
  lastTime = performance.now();
  sync();
  ui();
}
function autoPause() {
  resetInputs();
  if (engine.running && !engine.paused) {
    engine.paused = true;
    sync();
    ui();
  }
  lastTime = performance.now();
}
let audio;
const melody = [
  76, 71, 72, 74, 72, 71, 69, 69, 72, 76, 74, 72, 71, 71, 72, 74, 76, 72, 69,
  69, 74, 77, 81, 79, 77, 76, 72, 76, 74, 72, 71, 71, 72, 74, 76, 72, 69, 69,
];
let melodyIndex = 0,
  nextNote = 0;
function musicTick(time) {
  if (!options.music || !running || paused || engine.countdown) {
    nextNote = time;
    return;
  }
  if (time < nextNote) return;
  nextNote = time + 220;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audio.createOscillator(),
      gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value =
      440 * Math.pow(2, (melody[melodyIndex++ % melody.length] - 69) / 12);
    gain.gain.setValueAtTime(0.018, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.19);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.2);
  } catch {}
}
function sound(frequency) {
  if (!options.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const oscillator = audio.createOscillator(),
      gain = audio.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.035, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.08);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.08);
  } catch {}
}
function pressAction(action) {
  if (action === "pause") {
    pause();
    return;
  }
  const before = engine.placedCount;
  engine.press(action);
  sync();
  ui();
  if (engine.placedCount > before) sound(180);
  else if (action.startsWith("rotate")) sound(660);
}
function releaseAction(action) {
  engine.release(action);
  sync();
}
function drawMatrix(matrix, offset, context = ctx, ghost = false) {
  matrix.forEach((row, y) =>
    row.forEach((value, x) => {
      if (!value) return;
      const bx = x + offset.x,
        by = y + offset.y;
      if (by < 0) return;
      context.fillStyle = ghost ? "#64748b" : COLORS[value];
      if (ghost) {
        context.fillRect(bx + 0.08, by + 0.08, 0.84, 0.1);
        context.fillRect(bx + 0.08, by + 0.82, 0.84, 0.1);
        context.fillRect(bx + 0.08, by + 0.08, 0.1, 0.84);
        context.fillRect(bx + 0.82, by + 0.08, 0.1, 0.84);
      } else {
        context.fillRect(bx + 0.025, by + 0.025, 0.95, 0.95);
        context.fillStyle = "rgba(255,255,255,.25)";
        context.fillRect(bx + 0.025, by + 0.025, 0.12, 0.95);
      }
    }),
  );
}
function draw() {
  ctx.fillStyle = "#020817";
  ctx.fillRect(0, 0, COLS, ROWS);
  if (options.grid) {
    ctx.fillStyle = "#0d172b";
    for (let x = 1; x < COLS; x++) ctx.fillRect(x, 0, 0.025, ROWS);
    for (let y = 1; y < ROWS; y++) ctx.fillRect(0, y, COLS, 0.025);
  }
  drawMatrix(board, { x: 0, y: 0 });
  if (running && piece && !engine.countdown) {
    if (options.ghost)
      drawMatrix(piece.m, { x: piece.x, y: engine.ghostY() }, ctx, true);
    drawMatrix(piece.m, { x: piece.x, y: piece.y });
  }
  if (engine.clearingRows.length) {
    ctx.fillStyle = "#ffffff88";
    for (const y of engine.clearingRows) ctx.fillRect(0, y, COLS, 1);
  }
  nextCtx.fillStyle = "#020817";
  nextCtx.fillRect(0, 0, 6, 16);
  engine.queue
    .slice(0, 5)
    .forEach((type, i) =>
      drawMatrix(
        TetrisEngine.SHAPES[type],
        { x: type === 3 ? 2 : 1, y: i * 3 + 0.4 },
        nextCtx,
      ),
    );
  holdCtx.fillStyle = "#020817";
  holdCtx.fillRect(0, 0, 6, 4);
  if (engine.holdType !== null)
    drawMatrix(
      TetrisEngine.SHAPES[engine.holdType],
      { x: engine.holdType === 3 ? 2 : 1, y: 1 },
      holdCtx,
    );
}
function ui() {
  document.querySelector("#score").textContent = String(score).padStart(6, "0");
  document.querySelector("#lines").textContent = String(lines).padStart(3, "0");
  document.querySelector("#level").textContent = String(level).padStart(2, "0");
  const button = document.querySelector("#pause");
  button.textContent = paused ? "RESUME" : "PAUSE";
  button.disabled = !running;
  button.setAttribute("aria-pressed", String(paused));
  document.querySelector("#start").textContent = running
    ? "RESTART"
    : engine.message === "GAME OVER"
      ? "PLAY AGAIN"
      : "START";
  const status = document.querySelector("#gameStatus");
  status.textContent = paused
    ? "PAUSED"
    : engine.countdown
      ? String(Math.ceil(engine.countdown / 1000))
      : engine.message;
  status.classList.toggle("hidden", running && !paused && !engine.countdown);
  document.querySelector("#lastClear").textContent = engine.lastClear;
  document.querySelector("#hold").style.opacity = engine.holdUsed ? ".4" : "1";
  document.querySelector("#best").textContent = String(bestScore).padStart(
    6,
    "0",
  );
}
let bestScore = 0;
let highScores = [],
  scoreCommitted = false;
try {
  bestScore = Number(localStorage.getItem("tetris-best")) || 0;
  const stored = JSON.parse(localStorage.getItem("tetris-high-scores") || "[]");
  if (Array.isArray(stored))
    highScores = stored
      .filter((item) => Number.isSafeInteger(item?.score) && item.score > 0)
      .slice(0, 5);
} catch {}
function paintHighScores() {
  document.querySelector("#highScores").replaceChildren(
    ...highScores.map((item) => {
      const li = document.createElement("li");
      li.textContent =
        String(item.name || "Player").slice(0, 16) + " — " + item.score;
      return li;
    }),
  );
}
function commitScore() {
  if (scoreCommitted || !score || engine.placedCount === 0) return;
  highScores.push({ name: playerName || "Player", score });
  highScores.sort((a, b) => b.score - a.score);
  highScores = highScores.slice(0, 5);
  scoreCommitted = true;
  try {
    localStorage.setItem("tetris-high-scores", JSON.stringify(highScores));
  } catch {}
  paintHighScores();
}
function tick(time) {
  if (!lastTime) lastTime = time;
  const elapsed = Math.max(0, Math.min(time - lastTime, 250));
  lastTime = time;
  const placed = engine.placedCount;
  engine.step(elapsed);
  sync();
  musicTick(time);
  if (!running) commitScore();
  if (engine.placedCount !== placed) sound(engine.lastClear ? 880 : 180);
  if (score > bestScore) {
    bestScore = score;
    try {
      localStorage.setItem("tetris-best", String(bestScore));
    } catch {}
  }
  ui();
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
  const action = Object.entries(keys).find(
    ([, bound]) => bound.toLowerCase() === key.toLowerCase(),
  )?.[0];
  if (action) return action;
  if (key.toLowerCase() === "x" && keys.rotateCW === defaults.rotateCW)
    return "rotateCW";
  if (key === "Shift" && keys.hold === defaults.hold) return "hold";
}
document.addEventListener("keydown", (event) => {
  if (
    event.target.matches?.("input,textarea,select") ||
    event.target.isContentEditable
  )
    return;
  if (!running && (event.key === " " || event.key === "Enter")) {
    event.preventDefault();
    if (!event.repeat) reset();
    return;
  }
  if (event.key === "F4") {
    event.preventDefault();
    toggleFullscreen();
    return;
  }
  const action = actionForKey(event.key);
  if (!action) return;
  event.preventDefault();
  if (!event.repeat) pressAction(action);
});
document.addEventListener("keyup", (event) => {
  const action = actionForKey(event.key);
  if (action) releaseAction(action);
});
window.addEventListener("blur", autoPause);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) autoPause();
});
document.querySelector("#start").onclick = reset;
document.querySelector("#pause").onclick = pause;
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
    if (["Control", "Alt", "Meta"].includes(event.key)) return;
    const action = input.dataset.action,
      previous = keys[action],
      conflict = Object.keys(keys).find(
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
for (const input of document.querySelectorAll("[data-option]")) {
  input.checked = options[input.dataset.option];
  input.onchange = () => {
    options[input.dataset.option] = input.checked;
    if (input.dataset.option === "music" && input.checked) {
      try {
        audio ||= new (window.AudioContext || window.webkitAudioContext)();
        audio.resume();
      } catch {}
    }
    try {
      localStorage.setItem("tetris-options", JSON.stringify(options));
    } catch {}
  };
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {}
}
document.querySelector("#fullscreen").onclick = toggleFullscreen;
boardEl.addEventListener("pointermove", (event) => {
  if (
    !options.mouse ||
    event.pointerType === "touch" ||
    !running ||
    paused ||
    !piece
  )
    return;
  const box = boardEl.getBoundingClientRect(),
    target =
      Math.floor(((event.clientX - box.left) / box.width) * COLS) -
      Math.floor(piece.m.length / 2);
  for (let i = 0; i < COLS && piece.x !== target; i++)
    if (!engine.shift(Math.sign(target - piece.x))) break;
  sync();
});
boardEl.addEventListener("contextmenu", (event) => {
  if (options.mouse) event.preventDefault();
});
boardEl.addEventListener("pointerdown", (event) => {
  if (!options.mouse || event.pointerType === "touch") return;
  event.preventDefault();
  pressAction(event.button === 2 ? "hold" : "hardDrop");
});
boardEl.addEventListener(
  "wheel",
  (event) => {
    if (!options.mouse) return;
    event.preventDefault();
    pressAction(event.deltaY > 0 ? "rotateCW" : "rotateCCW");
  },
  { passive: false },
);
// Gesture controls: tap either side to rotate, horizontal drag to move, flick down to drop, up to hold.
let gesture;
boardEl.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch" || !running || paused) return;
  event.preventDefault();
  boardEl.setPointerCapture(event.pointerId);
  gesture = {
    x: event.clientX,
    y: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    time: performance.now(),
    moved: false,
  };
});
boardEl.addEventListener("pointermove", (event) => {
  if (!gesture || event.pointerType !== "touch") return;
  const cell = boardEl.getBoundingClientRect().width / COLS;
  let delta = event.clientX - gesture.lastX;
  while (Math.abs(delta) >= cell * 0.7) {
    pressAction(delta < 0 ? "left" : "right");
    releaseAction(delta < 0 ? "left" : "right");
    gesture.lastX += Math.sign(delta) * cell * 0.7;
    delta = event.clientX - gesture.lastX;
    gesture.moved = true;
  }
  if (event.clientY - gesture.lastY >= cell) {
    if (performance.now() - gesture.time > 200) {
      engine.drop(true);
      sync();
      gesture.moved = true;
      gesture.lastY = event.clientY;
    }
  }
});
boardEl.addEventListener("pointerup", (event) => {
  if (!gesture) return;
  const dy = event.clientY - gesture.y,
    dx = event.clientX - gesture.x,
    box = boardEl.getBoundingClientRect();
  if (Math.abs(dy) > 30 && Math.abs(dy) > Math.abs(dx)) {
    if (dy < 0) pressAction("hold");
    else if (performance.now() - gesture.time < 300) pressAction("hardDrop");
  } else if (!gesture.moved && Math.abs(dx) < 15)
    pressAction(
      event.clientX < box.left + box.width / 2 ? "rotateCCW" : "rotateCW",
    );
  gesture = null;
});
boardEl.addEventListener("pointercancel", () => {
  gesture = null;
  resetInputs();
});
window.__tetrisTest = {
  snapshot: () => engine.snapshot(),
  frameStep: () => {
    engine.step(FRAME_MS);
    sync();
    ui();
  },
  step: (ms) => {
    engine.step(ms);
    sync();
    ui();
  },
  rules: TetrisEngine.RULES,
};
paintHighScores();
sync();
ui();
requestAnimationFrame(tick);
