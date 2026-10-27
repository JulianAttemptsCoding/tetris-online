# Third-party notices

The GitHub Pages peer bundle is built from the following MIT-licensed packages. These are actual reused dependencies, not code claimed as original:

- `trystero` 0.25.0 — Copyright (c) 2021 Dan Motzenbecker.
- `@trystero-p2p/nostr` 0.25.0 — Copyright (c) 2021 Dan Motzenbecker.
- `@trystero-p2p/core` 0.25.0 — Copyright (c) 2021 Dan Motzenbecker.
- `@noble/secp256k1` — Copyright (c) 2019 Paul Miller (https://paulmillr.com).

`npm run build` copies each complete license into the deployed `public/vendor/` directory as `TRYSTERO-LICENSE.txt`, `NOSTR-LICENSE.txt`, `CORE-LICENSE.txt`, and `SECP256K1-LICENSE.txt`. Exact dependency versions are recorded in `package-lock.json`; esbuild also preserves legal comments in the generated bundle.

The runtime server uses Express and Socket.IO; their installed package license files remain in the Node distribution. Test/build dependencies are recorded separately in `package.json` and the lockfile.

Flatris and Jake Gordon's JavaScript Tetris were architectural and behavioral references. No files, art, music, or substantive code from those games are distributed here. The unlicensed `chvin/react-tetris` repository was not used as a code or asset source.
