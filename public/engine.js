/* Independent modern falling-block engine. See RULES.md for reference and limits. */
(function (root) {
  "use strict";
  const COLS = 10,
    ROWS = 20;
  const RULES = Object.freeze({
    das: 170,
    arr: 50,
    lock: 500,
    resetLimit: 15,
    softDropFactor: 20,
    entry: 50,
    clear: 200,
    collapse: 50,
    countdown: 2000,
    previews: 3,
  });
  const FALL = [
    1000, 793, 618, 473, 355, 262, 190, 135, 94, 64, 43, 28, 18, 11, 7, 4, 3, 2,
    1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ];
  const ENTRY = [
    50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
    47, 43, 40, 35, 30, 25, 30, 15, 10, 5, 0,
  ];
  const LOCK = [
    500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500,
    500, 500, 500, 500, 450, 400, 350, 300, 250, 200, 195, 184, 167, 151, 150,
  ];
  const SHAPES = [
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
  // SRS kick offsets use screen coordinates (positive y points down).
  const A = [
      [0, 0],
      [-1, 0],
      [-1, -1],
      [0, 2],
      [-1, 2],
    ],
    B = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, -2],
      [1, -2],
    ];
  const C = [
      [0, 0],
      [1, 0],
      [1, -1],
      [0, 2],
      [1, 2],
    ],
    D = [
      [0, 0],
      [-1, 0],
      [-1, 1],
      [0, -2],
      [-1, -2],
    ];
  const KICKS = {
    "0>1": A,
    "1>0": B,
    "1>2": B,
    "2>1": A,
    "2>3": C,
    "3>2": D,
    "3>0": D,
    "0>3": C,
  };
  const IA = [
      [0, 0],
      [-2, 0],
      [1, 0],
      [-2, 1],
      [1, -2],
    ],
    IB = [
      [0, 0],
      [2, 0],
      [-1, 0],
      [2, -1],
      [-1, 2],
    ];
  const IC = [
      [0, 0],
      [-1, 0],
      [2, 0],
      [-1, -2],
      [2, 1],
    ],
    ID = [
      [0, 0],
      [1, 0],
      [-2, 0],
      [1, 2],
      [-2, -1],
    ];
  const I_KICKS = {
    "0>1": IA,
    "1>0": IB,
    "1>2": IC,
    "2>1": ID,
    "2>3": IB,
    "3>2": IA,
    "3>0": ID,
    "0>3": IC,
  };
  const copy = (m) => m.map((row) => [...row]);
  const empty = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  const rotated = (m, d) =>
    m.map((row, y) =>
      row.map((_, x) =>
        d > 0 ? m[m.length - 1 - x][y] : m[x][m.length - 1 - y],
      ),
    );
  function gravity(level) {
    return FALL[Math.max(0, Math.min(29, level - 1))];
  }

  class TetrisEngine {
    constructor(random = Math.random) {
      this.random = random;
      this.reset(1, false);
    }
    reset(startLevel = 1, running = true) {
      this.board = empty();
      this.hidden = Array.from({ length: 4 }, () => Array(COLS).fill(0));
      this.bag = [];
      this.queue = [];
      this.countdown = running ? RULES.countdown : 0;
      this.timeRemainder = 0;
      this.score = 0;
      this.lines = 0;
      this.startLevel = Math.max(1, Math.min(25, Number(startLevel) || 1));
      this.level = this.startLevel;
      this.running = running;
      this.paused = false;
      this.placedCount = 0;
      this.elapsed = 0;
      this.holdType = null;
      this.holdUsed = false;
      this.combo = -1;
      this.backToBack = false;
      this.completed = false;
      this.pendingCompletion = false;
      this.delay = 0;
      this.clearingRows = [];
      this.message = running ? "" : "PRESS START";
      this.lastClear = "";
      this.input = { left: false, right: false, down: false };
      this.direction = 0;
      this.repeatTime = 0;
      this.fallTime = 0;
      this.lockTime = 0;
      this.lockResets = 0;
      this.lowestY = -2;
      this.lastRotation = null;
      while (this.queue.length < 3) this.queue.push(this.randomType());
      this.spawn();
    }
    randomType() {
      if (!this.bag.length) {
        this.bag = [0, 1, 2, 3, 4, 5, 6];
        for (let i = 6; i > 0; i--) {
          const j = Math.floor(this.random() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
      }
      return this.bag.pop();
    }
    makePiece(type) {
      return {
        type,
        m: copy(SHAPES[type]),
        x: type === 3 ? 4 : 3,
        y: -1,
        rotation: 0,
      };
    }
    spawn(type) {
      if (type === undefined) {
        type = this.queue.shift();
        this.queue.push(this.randomType());
      }
      this.piece = this.makePiece(type);
      this.fallTime = 0;
      this.lockTime = 0;
      this.lockResets = 0;
      this.lowestY = this.piece.y;
      this.lastRotation = null;
      if (this.collide(this.piece)) this.end();
    }
    end() {
      this.running = false;
      this.message = "GAME OVER";
      this.clearInputs();
    }
    cell(x, y) {
      if (x < 0 || x >= COLS || y >= ROWS || y < -4) return 1;
      return y < 0 ? this.hidden[y + 4][x] : this.board[y][x];
    }
    collide(p = this.piece, dx = 0, dy = 0, m = p?.m) {
      return (
        !p ||
        m.some((row, y) =>
          row.some((v, x) => v && this.cell(p.x + x + dx, p.y + y + dy)),
        )
      );
    }
    grounded() {
      return !!this.piece && this.collide(this.piece, 0, 1);
    }
    placementChanged(wasGrounded, direct = false) {
      if (this.piece.y > this.lowestY) {
        this.lowestY = this.piece.y;
        this.lockResets = 0;
        this.lockTime = 0;
      } else if (direct) {
        this.lockTime = 0;
        this.lockResets++;
        if (this.lockResets >= RULES.resetLimit && this.grounded()) this.lock();
      }
    }
    shift(direction) {
      if (
        !this.running ||
        this.paused ||
        this.countdown ||
        !this.piece ||
        this.collide(this.piece, direction)
      )
        return false;
      const grounded = this.grounded();
      this.piece.x += direction;
      this.lastRotation = null;
      this.placementChanged(grounded, true);
      return true;
    }
    rotate(direction) {
      if (!this.running || this.paused || this.countdown || !this.piece)
        return false;
      const p = this.piece,
        from = p.rotation,
        to = (from + direction + 4) % 4;
      const matrix = p.type === 3 ? p.m : rotated(p.m, direction);
      const tests =
        p.type === 3
          ? [[0, 0]]
          : (p.type === 0 ? I_KICKS : KICKS)[from + ">" + to];
      const grounded = this.grounded();
      for (let i = 0; i < tests.length; i++) {
        const [dx, dy] = tests[i];
        if (this.collide(p, dx, dy, matrix)) continue;
        p.x += dx;
        p.y += dy;
        p.m = matrix;
        p.rotation = to;
        this.lastRotation = { kick: i, direction };
        this.placementChanged(grounded, true);
        return true;
      }
      return false;
    }
    hold() {
      if (
        !this.running ||
        this.paused ||
        this.countdown ||
        !this.piece ||
        this.holdUsed
      )
        return false;
      const previous = this.holdType;
      this.holdType = this.piece.type;
      this.spawn(previous === null ? undefined : previous);
      this.holdUsed = true;
      return true;
    }
    ghostY() {
      if (!this.piece) return null;
      let distance = 0;
      while (!this.collide(this.piece, 0, distance + 1)) distance++;
      return this.piece.y + distance;
    }
    drop(soft = false) {
      if (
        !this.running ||
        this.paused ||
        this.countdown ||
        !this.piece ||
        this.collide(this.piece, 0, 1)
      )
        return false;
      this.piece.y++;
      if (soft) this.score += 1;
      // Falling keeps a rotation eligible for a T-spin; lateral moves cancel it.
      this.placementChanged(false);
      return true;
    }
    hardDrop() {
      if (!this.running || this.paused || this.countdown || !this.piece)
        return false;
      const y = this.ghostY();
      this.score += 2 * (y - this.piece.y);
      this.piece.y = y;
      this.lock();
      return true;
    }
    spinType() {
      if (this.piece?.type !== 5 || !this.lastRotation) return "";
      const p = this.piece,
        corners = [
          [0, 0],
          [2, 0],
          [0, 2],
          [2, 2],
        ].map(([x, y]) => !!this.cell(p.x + x, p.y + y));
      if (corners.filter(Boolean).length < 3) return "";
      const fronts = [
        [0, 1],
        [1, 3],
        [2, 3],
        [0, 2],
      ][p.rotation];
      return (corners[fronts[0]] && corners[fronts[1]]) ||
        this.lastRotation.kick === 4
        ? "full"
        : "mini";
    }
    lock() {
      if (!this.piece) return;
      const p = this.piece,
        spin = this.spinType();
      let entirelyHidden = true;
      p.m.forEach((row, y) =>
        row.forEach((v, x) => {
          if (v) {
            const by = p.y + y;
            if (by >= 0) {
              this.board[by][p.x + x] = v;
              entirelyHidden = false;
            } else if (by >= -4) this.hidden[by + 4][p.x + x] = v;
          }
        }),
      );
      this.placedCount++;
      this.holdUsed = false;
      this.clearingRows = [];
      for (let y = 0; y < ROWS; y++)
        if (this.board[y].every(Boolean)) this.clearingRows.push(y);
      const cleared = this.clearingRows.length;
      const difficult = cleared > 0 && (cleared === 4 || !!spin);
      let base =
        spin === "full"
          ? [400, 800, 1200, 1600][cleared]
          : spin === "mini"
            ? [100, 200, 400][cleared]
            : [0, 100, 300, 500, 800][cleared];
      if (difficult && this.backToBack) base = Math.floor(base * 1.5);
      if (cleared) {
        this.combo++;
        base += Math.max(0, this.combo) * 50;
      } else this.combo = -1;
      const perfect =
        cleared > 0 &&
        this.hidden.every((row) => row.every((v) => v === 0)) &&
        this.board.every(
          (row, y) =>
            this.clearingRows.includes(y) || row.every((v) => v === 0),
        );
      if (perfect)
        base +=
          cleared === 4 && this.backToBack
            ? 3200
            : [0, 800, 1200, 1800, 2000][cleared];
      this.score += base * this.level;
      this.lastClear = spin
        ? (spin === "mini" ? "MINI T-SPIN" : "T-SPIN") +
          (cleared ? " " + cleared : "")
        : ["", "SINGLE", "DOUBLE", "TRIPLE", "TETRIS"][cleared];
      if (difficult && this.backToBack)
        this.lastClear = "BACK-TO-BACK " + this.lastClear;
      if (perfect) this.lastClear += " · PERFECT CLEAR";
      if (cleared) this.backToBack = difficult;
      const levelBefore = this.level;
      this.lines += cleared;
      this.level = Math.min(30, this.startLevel + Math.floor(this.lines / 10));
      this.piece = null;
      let collapseDistance = 0;
      for (let y = -4; y < ROWS; y++) {
        if (this.clearingRows.includes(y)) continue;
        const row = y < 0 ? this.hidden[y + 4] : this.board[y];
        if (row.some(Boolean))
          collapseDistance = Math.max(
            collapseDistance,
            this.clearingRows.filter((clearedY) => clearedY > y).length,
          );
      }
      this.delay =
        ENTRY[levelBefore - 1] +
        (cleared ? RULES.clear + RULES.collapse * collapseDistance : 0);
      if (this.startLevel + Math.floor(this.lines / 10) > 30) {
        this.pendingCompletion = true;
      }
      if (entirelyHidden) {
        this.end();
        return;
      }
      if (!this.delay) this.finishDelay();
    }
    finishDelay() {
      if (this.clearingRows.length) {
        const grid = [...this.hidden, ...this.board].filter(
          (_, y) => !this.clearingRows.includes(y - 4),
        );
        while (grid.length < ROWS + 4) grid.unshift(Array(COLS).fill(0));
        this.hidden = grid.slice(0, 4);
        this.board = grid.slice(4);
        this.clearingRows = [];
      }
      if (this.pendingCompletion) {
        this.completed = true;
        this.pendingCompletion = false;
        this.running = false;
        this.message = "COMPLETE";
        this.clearInputs();
      } else this.spawn();
    }
    clearInputs() {
      this.input = { left: false, right: false, down: false };
      this.direction = 0;
      this.repeatTime = 0;
    }
    press(action) {
      if (!this.running || this.paused || this.countdown) return;
      if (action === "left" || action === "right") {
        if (this.input[action]) return;
        this.input[action] = true;
        this.direction = action === "left" ? -1 : 1;
        this.repeatTime = RULES.das;
        this.shift(this.direction);
      } else if (action === "down") {
        if (!this.input.down) {
          this.input.down = true;
          this.fallTime = 0;
          this.drop(true);
        }
      } else if (action === "rotateCW") this.rotate(1);
      else if (action === "rotateCCW") this.rotate(-1);
      else if (action === "hardDrop") this.hardDrop();
      else if (action === "hold") this.hold();
    }
    release(action) {
      if (!(action in this.input)) return;
      this.input[action] = false;
      if (action === "down") {
        this.fallTime = 0;
        return;
      }
      const direction = this.input.right ? 1 : this.input.left ? -1 : 0;
      if (direction !== this.direction) {
        this.direction = direction;
        this.repeatTime = RULES.das;
        if (direction) this.shift(direction);
      }
    }
    step(milliseconds) {
      if (!this.running || this.paused) return;
      this.timeRemainder = (this.timeRemainder || 0) + milliseconds;
      while (this.timeRemainder >= 1 && this.running && !this.paused) {
        this.timeRemainder--;
        this.advanceMillisecond();
      }
    }
    advanceMillisecond() {
      if (this.countdown > 0) {
        this.countdown--;
        return;
      }
      this.elapsed++;
      const placedBefore = this.placedCount;
      if (this.direction) {
        this.repeatTime--;
        if (this.repeatTime <= 0) {
          this.shift(this.direction);
          this.repeatTime += RULES.arr;
        }
      }
      if (this.placedCount !== placedBefore) return;
      if (this.delay > 0) {
        this.delay--;
        if (!this.delay) this.finishDelay();
        return;
      }
      if (!this.piece) return;
      const groundedBefore = this.grounded();
      this.fallTime++;
      const normal = gravity(this.level);
      const interval = this.input.down
        ? Math.floor(normal / RULES.softDropFactor)
        : normal;
      if (interval === 0) {
        while (this.drop(this.input.down)) {}
        this.fallTime = 0;
      } else
        while (this.piece && this.fallTime >= interval) {
          this.fallTime -= interval;
          if (!this.drop(this.input.down)) {
            this.fallTime = 0;
            break;
          }
        }
      if (this.piece && this.grounded()) {
        if (groundedBefore) this.lockTime++;
        if (this.lockTime >= LOCK[this.level - 1]) this.lock();
      }
    }
    snapshot() {
      return {
        board: copy(this.board),
        piece: this.piece && { ...this.piece, m: copy(this.piece.m) },
        next: [...this.queue],
        holdType: this.holdType,
        holdUsed: this.holdUsed,
        score: this.score,
        lines: this.lines,
        level: this.level,
        running: this.running,
        paused: this.paused,
        placedCount: this.placedCount,
        lockTime: this.lockTime,
        lockResets: this.lockResets,
        entryDelay: this.delay,
        elapsed: this.elapsed,
        combo: this.combo,
        backToBack: this.backToBack,
        countdown: this.countdown,
        completed: this.completed,
      };
    }
  }
  TetrisEngine.RULES = RULES;
  TetrisEngine.SHAPES = SHAPES;
  TetrisEngine.gravity = gravity;
  TetrisEngine.LEVELS = FALL.map((fall, i) => ({
    level: i + 1,
    fall,
    entry: ENTRY[i],
    lock: LOCK[i],
  }));
  if (typeof module !== "undefined" && module.exports)
    module.exports = TetrisEngine;
  else root.TetrisEngine = TetrisEngine;
})(typeof globalThis !== "undefined" ? globalThis : this);
