const fs = require("node:fs");
const esbuild = require("esbuild");
fs.mkdirSync("public/vendor", { recursive: true });
esbuild.buildSync({
  stdin: {
    contents: "export { joinRoom } from 'trystero';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: "esm",
  minify: true,
  outfile: "public/vendor/trystero.js",
  legalComments: "eof",
  target: ["es2020"],
});
fs.copyFileSync(
  "node_modules/trystero/LICENSE",
  "public/vendor/TRYSTERO-LICENSE.txt",
);
fs.copyFileSync(
  "node_modules/@trystero-p2p/nostr/LICENSE",
  "public/vendor/NOSTR-LICENSE.txt",
);
fs.copyFileSync(
  "node_modules/@trystero-p2p/core/LICENSE",
  "public/vendor/CORE-LICENSE.txt",
);
fs.copyFileSync(
  "node_modules/@noble/secp256k1/LICENSE",
  "public/vendor/SECP256K1-LICENSE.txt",
);
