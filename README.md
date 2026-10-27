# NES Tetris — Friends

A small browser falling-block game with NES-inspired timing, solo play, touch controls, and live rooms for friends. Multiplayer is a shared score chase: everyone plays their own board and can watch the others. It does not send garbage attacks or synchronize match starts.

[Play on GitHub Pages](https://julianattemptscoding.github.io/tetris-online/)

## Run locally or on your LAN

Use Node.js 22 or newer:

```sh
npm ci
npm start
```

Open `http://localhost:3000`. On the same Wi-Fi, share `http://YOUR-COMPUTER-IP:3000`; players enter the same room code. Allow Node through your firewall if needed. Set `PORT` to change the listening port. `npm start` builds the peer library first; the server listens on all network interfaces.

## Play

- Click **Start**. Arrow keys move and soft-drop; **X** rotates clockwise and **Z** counterclockwise.
- Touch buttons support taps, held movement, soft drop, and both rotation directions.
- **Settings** lets you rebind keys; duplicate bindings swap. Preferences are saved locally when browser storage is available.
- **Pause** stops the simulation. Switching tabs, losing window focus, or opening Settings pauses automatically; click **Resume** to continue.
- **Restart** starts a fresh game. There is no hold, hard drop, ghost piece, or wall kick.
- Enter your name and a room code, then click **Join Room**. **Copy Link** creates a URL that pre-fills the code for friends; **Leave** returns to solo play.

The engine uses a 60.0988 Hz fixed simulation, the NES gravity curve, 16-frame movement delay with six-frame repeats, immediate locking on a blocked downward step, entry and line-clear delays, and classic line scoring. Scoring uses the level before a clear, then advances the level every ten lines. This is an NES-inspired browser implementation, not a cycle-accurate emulator. No Nintendo assets or ROMs are included.

## Multiplayer hosting

**Node hosting / LAN:** Socket.IO runs alongside the static site. Rooms support up to eight players, remove disconnected players, and automatically rejoin after a connection recovers. Board messages are validated and broadcasts are rate limited. A restart clears in-memory rooms; connected clients recreate membership when they reconnect. The server relays client-reported boards and scores, so this is casual play rather than a cheat-resistant ranked service.

**GitHub Pages:** The deployment bundles pinned Trystero 0.25.0 locally and uses its real WebRTC API with public Nostr signaling relays. No runtime CDN import or separate application server is needed. A room is waiting until another peer actually connects. Relay outages, restrictive firewalls, and some NAT configurations can prevent peer connections; use the Node deployment for those networks. Different transports have separate rooms: friends must use the same hosted URL. Room codes identify shared rooms; they are not passwords.

**Render:** Connect this repository as a Blueprint using `render.yaml`. It builds the static peer bundle and starts the same Node service. `/health` supplies the health check. Use one service instance; multi-instance scaling would require shared room state and a Socket.IO adapter.

**Docker:** `docker build -t tetris-online .` then `docker run --rm -p 3000:3000 tetris-online`. The multi-stage image builds assets, removes development dependencies, and runs as a non-root user.

## Verification

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:e2e
npm audit
```

Unit and integration tests cover gravity, repeat timing, rotations and collisions, locking, line clears, level-boundary scoring, game over, settings, malformed messages, room switching, disconnects, and capacity limits. Chromium tests cover desktop controls, two actual Socket.IO clients, active-piece rendering, mobile taps/layout, and importing the real peer bundle. CI runs those checks before GitHub Pages deployment.

The live WebRTC smoke test uses public relays and is opt-in so relay availability does not make CI nondeterministic:

```powershell
$env:LIVE_PEER_TEST = '1'
npx playwright test e2e/peer.spec.js
```

On macOS/Linux: `LIVE_PEER_TEST=1 npx playwright test e2e/peer.spec.js`.

## References and credits

Reviewed on October 26, 2026. Stars are approximate popularity signals; suitability was also checked against source, license, API documentation, and executable tests.

| Repository                                                                        | Stars observed | License               | How it is used                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------- | -------------: | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [dmotz/trystero](https://github.com/dmotz/trystero)                               |           2.8k | MIT                   | Actual pinned dependency powering Pages rooms. Followed its documented `joinRoom`, `makeAction`, `onMessage`, peer lifecycle, and targeted-send API. Bundled locally with its license notices.                                       |
| [ovidiuch/flatris](https://github.com/ovidiuch/flatris)                           |           1.5k | MIT                   | Reviewed `server/socket.js` and `shared/reducers/game.js` for room subscriptions, reconnect behavior, and separation of falling pieces from settled cells. Architectural reference; its React/server implementation is not vendored. |
| [jakesgordon/javascript-tetris](https://github.com/jakesgordon/javascript-tetris) |            737 | MIT                   | Reviewed its canvas renderer, collision checks, line clearing, and capped animation-frame loop. Reference for comparison; this project retains its own NES-inspired engine.                                                          |
| [chvin/react-tetris](https://github.com/chvin/react-tetris)                       |           8.7k | No license identified | Reviewed the project overview for desktop/mobile UX. No code or assets copied.                                                                                                                                                       |

Source snapshots reviewed: Flatris `c01772a90af5149124aa2ba6099a6e658d344137`, Jake Gordon Tetris `e5c0c42f7dac0f3514a55eff656c6e22e95d68ed`. Trystero integration is pinned in `package-lock.json`.

Trystero and its bundled dependencies retain their copyright/license notices in `public/vendor/` after building. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Tetris is a trademark of its respective owners; this project is unaffiliated.
