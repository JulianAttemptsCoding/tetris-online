const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { io } = require("socket.io-client");
const { createGameServer } = require("../server");

async function setup(t) {
  const game = createGameServer();
  game.server.listen(0, "127.0.0.1");
  await once(game.server, "listening");
  const url = `http://127.0.0.1:${game.server.address().port}`;
  const clients = [];
  t.after(async () => {
    clients.forEach((client) => client.disconnect());
    await new Promise((resolve) => game.io.close(resolve));
  });
  async function connect() {
    const client = io(url, { transports: ["websocket"], reconnection: false });
    clients.push(client);
    await once(client, "connect");
    return client;
  }
  return { ...game, url, connect };
}
const join = (client, room, name = "Player") =>
  client.timeout(2000).emitWithAck("join", { room, name });
const empty = () => Array.from({ length: 20 }, () => Array(10).fill(0));
function waitRoom(client, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off("room", handler);
      reject(new Error("Room update timed out"));
    }, 2000);
    function handler(players) {
      if (predicate(players)) {
        clearTimeout(timer);
        client.off("room", handler);
        resolve(players);
      }
    }
    client.on("room", handler);
  });
}

test("serves the game, bundled library, Socket.IO module and health endpoint", async (t) => {
  const game = await setup(t);
  for (const path of [
    "/",
    "/game.js",
    "/multiplayer.js",
    "/vendor/trystero.js",
    "/socket.io/socket.io.esm.min.js",
    "/health",
  ]) {
    const response = await fetch(game.url + path);
    assert.equal(response.status, 200, path);
  }
});
test("two clients receive state and switching rooms removes ghost players", async (t) => {
  const game = await setup(t),
    a = await game.connect(),
    b = await game.connect();
  await join(a, "FRIENDS", "Alice");
  await join(b, "FRIENDS", "Bob");
  const board = empty();
  board[0][0] = 1;
  const update = waitRoom(b, (players) =>
    players.some((p) => p.name === "Alice" && p.score === 40),
  );
  a.emit("state", { board, score: 40, status: "PLAYING" });
  const players = await update;
  assert.equal(players.find((p) => p.name === "Alice").board[0][0], 1);
  const left = waitRoom(b, (players) => players.length === 1);
  await join(a, "OTHER");
  await left;
  assert.equal(game.rooms.get("FRIENDS").size, 1);
  assert.equal(game.rooms.get("OTHER").size, 1);
  await join(a, "FRIENDS");
  const gone = waitRoom(b, (players) => players.length === 1);
  a.emit("leave");
  await gone;
  assert.equal(game.rooms.has("OTHER"), false);
});
test("malformed messages are ignored and valid state still works", async (t) => {
  const game = await setup(t),
    client = await game.connect();
  for (const payload of [null, {}, 42, { room: 3 }])
    client.emit("join", payload);
  await join(client, "SAFE");
  for (const payload of [
    null,
    {},
    42,
    { board: [[]], score: 0 },
    { board: empty(), score: -1 },
    { board: empty(), score: "Infinity" },
  ])
    client.emit("state", payload);
  const update = waitRoom(client, (players) => players[0]?.score === 123);
  client.emit("state", { board: empty(), score: 123, status: "PAUSED" });
  assert.equal((await update)[0].status, "PAUSED");
  assert.equal(game.rooms.size, 1);
});
test("disconnect cleans up empty rooms and reconnect can rejoin", async (t) => {
  const game = await setup(t),
    a = await game.connect(),
    b = await game.connect();
  await join(a, "ROOM");
  await join(b, "ROOM");
  const update = waitRoom(b, (players) => players.length === 1);
  a.disconnect();
  await update;
  const c = await game.connect();
  await join(c, "ROOM");
  assert.equal(game.rooms.get("ROOM").size, 2);
  c.disconnect();
  const cleanup = waitRoom(b, (players) => players.length === 1);
  await cleanup;
  b.emit("leave");
  // An acknowledgement on a subsequent event orders this check after leave.
  await join(b, "OTHER");
  assert.equal(game.rooms.has("ROOM"), false);
});
test("rooms enforce an eight-player limit without removing an existing membership", async (t) => {
  const game = await setup(t);
  for (let i = 0; i < 8; i++) await join(await game.connect(), "FULL");
  const client = await game.connect();
  await join(client, "OLD");
  assert.match((await join(client, "FULL")).error, /full/);
  assert.equal(game.rooms.get("FULL").size, 8);
  assert.equal(game.rooms.get("OLD").size, 1);
});
