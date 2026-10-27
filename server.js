const path = require("node:path");
const http = require("node:http");
const express = require("express");
const { Server } = require("socket.io");

const validBoard = (board) =>
  Array.isArray(board) &&
  board.length === 20 &&
  board.every(
    (row) =>
      Array.isArray(row) &&
      row.length === 10 &&
      row.every((cell) => Number.isInteger(cell) && cell >= 0 && cell <= 7),
  );

function createGameServer() {
  const app = express();
  app.disable("x-powered-by");
  const server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 8192 });
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use(express.static(path.join(__dirname, "public")));
  const rooms = new Map();
  const broadcast = (id) => {
    const players = rooms.get(id);
    if (players) io.to(`game:${id}`).emit("room", [...players.values()]);
  };
  function leave(socket) {
    const id = socket.data.room;
    const players = rooms.get(id);
    socket.leave(`game:${id}`);
    delete socket.data.room;
    if (!players) return;
    players.delete(socket.id);
    if (players.size) broadcast(id);
    else rooms.delete(id);
  }
  io.on("connection", (socket) => {
    socket.on("join", (data, ack) => {
      if (!data || typeof data.room !== "string") return;
      const id =
        data.room
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 8) || "TETRIS";
      const players = rooms.get(id);
      if (players && !players.has(socket.id) && players.size >= 8) {
        if (typeof ack === "function")
          ack({ error: "Room is full (8 players)." });
        return;
      }
      leave(socket);
      if (!rooms.has(id)) rooms.set(id, new Map());
      rooms.get(id).set(socket.id, {
        id: socket.id,
        name:
          typeof data.name === "string"
            ? data.name.trim().slice(0, 16) || "Player"
            : "Player",
        board: null,
        score: 0,
        status: "READY",
      });
      socket.join(`game:${id}`);
      socket.data.room = id;
      socket.data.lastState = 0;
      broadcast(id);
      if (typeof ack === "function") ack({ room: id });
    });
    socket.on("leave", () => leave(socket));
    socket.on("state", (data) => {
      const player = rooms.get(socket.data.room)?.get(socket.id);
      if (
        !player ||
        !data ||
        !validBoard(data.board) ||
        !Number.isInteger(data.score) ||
        data.score < 0 ||
        data.score > Number.MAX_SAFE_INTEGER
      )
        return;
      const now = Date.now();
      if (now - socket.data.lastState < 80) return;
      socket.data.lastState = now;
      player.board = data.board;
      player.score = data.score;
      player.status = [
        "READY",
        "PLAYING",
        "PAUSED",
        "GAME OVER",
        "COMPLETE",
      ].includes(data.status)
        ? data.status
        : "PLAYING";
      broadcast(socket.data.room);
    });
    socket.on("disconnect", () => leave(socket));
  });
  return { app, server, io, rooms };
}

if (require.main === module) {
  const { server, io } = createGameServer();
  server.listen(process.env.PORT || 3000, "0.0.0.0", () => {
    console.log(`Tetris is ready on http://localhost:${server.address().port}`);
  });
  for (const signal of ["SIGTERM", "SIGINT"])
    process.once(signal, () => io.close());
}
module.exports = { createGameServer, validBoard };
