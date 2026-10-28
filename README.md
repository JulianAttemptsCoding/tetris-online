# Tetris — Friends

[Play online](https://julianattemptscoding.github.io/tetris-online/)

A modern falling-block game targeting the Tetris.com desktop Marathon rules and observed level timings. Play solo or share a score-chasing room with friends. It replaces the earlier NES-inspired engine.

Features include hold, three next previews, ghost projection, seven-piece bags, SRS wall kicks, soft/hard drop, lock delay and placement limits, T-spins, combos, back-to-back and perfect-clear scoring, levels 1–30, selectable starts at levels 1–25, a countdown, local high scores, touch buttons/gestures, rebindable keys, fullscreen, and optional synthesized sound/music.

**Verified timing tables, sources, tests, and remaining parity limits: [RULES.md](RULES.md).** Numerical keyboard timing and level settings were read from the actual official desktop build; exhaustive equivalence with its smart mouse behavior and rendering is not claimed.

## For reviewers

**What's interesting.** The engine ([`public/engine.js`](public/engine.js)) is written from scratch to
match a reference game's *measured* behaviour, not just its rules. I recorded the official desktop
build's timing parameters per level (gravity, entry delay, lock delay, DAS/ARR) in
[`test/fixtures/tetris-com-timing.json`](test/fixtures/tetris-com-timing.json), and the tests check the
engine against them level by level. [RULES.md](RULES.md) lists every value, where it came from, and the
remaining known differences.

```bash
npm ci
npm test          # 116 tests: timing at every level, SRS kicks, 7-bag, hold, scoring, T-spins, server
npm run test:e2e  # Playwright: real browser games, multiplayer room join/leave
```

**Multiplayer** ([`server.js`](server.js)) is a Socket.IO relay, not an authoritative game server:

- **Rooms:** capped at 8 players.
- **Validation:** boards must have the right shape (`validBoard`) and scores must be non-negative
  integers.
- **Rate limit:** each client can send a state update at most once every 80 ms.
- **Cleanup:** disconnected players are removed.

It stops malformed or flooding clients, not a determined cheater. The README calls rooms "casual" for
that reason. The GitHub Pages build uses peer-to-peer WebRTC (Trystero over Nostr signalling) instead
of the server.

## Run

Node.js 22 or newer:

```sh
npm ci
npm start
```

Open `http://localhost:3000`. On the same Wi-Fi, share `http://YOUR-COMPUTER-IP:3000` and join the same room. Allow Node through the firewall if needed. The service listens on all interfaces; `PORT` changes its port.

## Controls

| Action                       | Default             |
| ---------------------------- | ------------------- |
| Move                         | Left / right arrows |
| Clockwise / counterclockwise | Up arrow / Z        |
| Soft drop                    | Down arrow          |
| Hard drop                    | Space               |
| Hold                         | C                   |
| Pause                        | Escape              |

X and Shift are additional default rotate/hold aliases. Settings support rebinding, ghost/grid visibility, sound/music, and optional mouse controls. Switching tabs, losing focus, or opening Settings pauses the game. Restart begins a fresh countdown. Local best/five high scores and preferences use browser storage when available.

Click **Join Room** after entering a name and code. **Copy Link** pre-fills that code for friends; **Leave** returns to solo play. Everyone plays their own board and watches the others. There are no garbage attacks or synchronized match starts.

## Hosting

- **GitHub Pages:** The workflow builds pinned Trystero 0.25.0 locally, tests the game, and deploys the static site. WebRTC peers connect through public Nostr signaling. Some networks/relay outages prevent peer connections; use Node hosting in that case.
- **Node / LAN:** Socket.IO serves up to eight players per room, validates boards/scores, rate limits state updates, removes disconnected players, and rejoins after recovery. `/health` is the health check. State is in memory and scores are client-reported, for casual play.
- **Render:** Connect the repository as a Blueprint with `render.yaml`. The build produces the peer bundle and starts the Node service. Use one service instance; scaling requires a shared room store/Socket.IO adapter.
- **Docker:** `docker build -t tetris-online .` then `docker run --rm -p 3000:3000 tetris-online`. CI verifies image build, container health, and asset serving; the runtime uses a non-root user.

Friends must use the same hosted URL/transport. Room codes identify shared rooms and are not passwords.

## Verification

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:e2e
npm audit
```

Engine tests check the observed timing boundaries at every level, plus countdown, repeat delay, lock placement budget, seven-piece bags, SRS kicks/collisions, hold, scoring, line settlement, top-out, and level 30 completion. Browser tests check desktop/mobile controls, persistence, modern actions, real Socket.IO clients, and reconnects.

Live WebRTC is tested separately because public relay availability is nondeterministic:

```powershell
$env:LIVE_PEER_TEST = '1'
npx playwright test e2e/peer.spec.js
```

macOS/Linux: `LIVE_PEER_TEST=1 npx playwright test e2e/peer.spec.js`.

## References and credits

- [Official Tetris.com desktop game](https://play.tetris.com/play-now): behavioral and numerical reference, inspected October 27, 2026. No official source code or assets are redistributed. See [RULES.md](RULES.md) for the build and observations.
- [dmotz/trystero](https://github.com/dmotz/trystero), approximately 2.8k stars, MIT: actual pinned WebRTC dependency, bundled locally with license notices.
- [ovidiuch/flatris](https://github.com/ovidiuch/flatris), approximately 1.5k stars, MIT: reviewed room subscriptions, reconnects, and separation of active pieces from settled cells. Architectural reference, not vendored.
- [jakesgordon/javascript-tetris](https://github.com/jakesgordon/javascript-tetris), 737 stars, MIT: reviewed canvas rendering, collision checks, and animation-frame handling. Comparison reference, not vendored.
- [chvin/react-tetris](https://github.com/chvin/react-tetris), approximately 8.7k stars: UX overview only; no license was identified and no code/assets were copied.

Star counts were checked October 26, 2026. Popularity was considered alongside source quality, API compatibility, and licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). No ROMs or Nintendo assets are included. Tetris is a trademark of its respective owners; this independent fan project is unaffiliated.
