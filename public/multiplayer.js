// Include the falling piece in snapshots without changing the settled board.
function networkState() {
  const visible = clone(board);
  if (running && piece)
    piece.m.forEach((row, y) =>
      row.forEach((cell, x) => {
        const bx = piece.x + x,
          by = piece.y + y;
        if (cell && by >= 0 && by < ROWS && bx >= 0 && bx < COLS)
          visible[by][bx] = cell;
      }),
    );
  return {
    name: playerName,
    board: visible,
    score,
    status: paused
      ? "PAUSED"
      : engine.countdown
        ? "READY"
        : engine.completed
          ? "COMPLETE"
          : running
            ? "PLAYING"
            : engine.message === "GAME OVER"
              ? "GAME OVER"
              : "READY",
  };
}
const validBoard = (value) =>
  Array.isArray(value) &&
  value.length === ROWS &&
  value.every(
    (row) =>
      Array.isArray(row) &&
      row.length === COLS &&
      row.every((cell) => Number.isInteger(cell) && cell >= 0 && cell <= 7),
  );
const roomStatus = document.querySelector("#roomStatus");
let joining = false,
  acceptedRoom = "";

function socketJoin() {
  if (!room || !socket?.connected) return;
  const requested = room;
  socket
    .timeout(5000)
    .emit("join", { room, name: playerName }, (error, result) => {
      if (room !== requested) return;
      if (error || result?.error) {
        room = acceptedRoom;
        roomStatus.textContent =
          result?.error || "Room join timed out. Try again.";
        return;
      }
      acceptedRoom = room = result.room;
      document.querySelector("#leave").disabled = false;
      roomStatus.textContent = `Room ${room} — connected. Share the room link with friends.`;
    });
}
async function connectMultiplayer() {
  try {
    if (typeof window.io !== "function") {
      const library = window.loadSocketLibrary
        ? await window.loadSocketLibrary()
        : await import("/socket.io/socket.io.esm.min.js");
      window.io = library.io;
    }
  } catch {
    roomStatus.textContent =
      "Multiplayer server unavailable — solo play still works.";
    return false;
  }
  if (!socket) {
    socket = window.io();
    socket.on("room", showPlayers);
    socket.on("connect", socketJoin);
    socket.on("disconnect", () => {
      showPlayers([]);
      if (room)
        roomStatus.textContent = `Disconnected — reconnecting to room ${room}…`;
    });
    socket.on("connect_error", () => {
      roomStatus.textContent =
        "Multiplayer server is offline — retrying. Solo play still works.";
    });
  } else if (socket.connected) socketJoin();
  return true;
}
async function connectPeerRoom() {
  roomStatus.textContent = `Connecting to room ${room}…`;
  try {
    const library = window.loadPeerLibrary
      ? await window.loadPeerLibrary()
      : await import("./vendor/trystero.js");
    sendPeerState = undefined;
    if (peerRoom) peerRoom.leave();
    peerRoom = undefined;
    peerPlayers.clear();
    const activeRoom = library.joinRoom(
      { appId: "julianattemptscoding-tetris-online-v1" },
      room,
    );
    peerRoom = activeRoom;
    const action = activeRoom.makeAction("board-state");
    const safeSend = (data, options) =>
      Promise.resolve()
        .then(() => action.send(data, options))
        .catch(() => {
          if (peerRoom === activeRoom)
            roomStatus.textContent =
              "Peer connection interrupted — waiting for friends to reconnect.";
        });
    action.onMessage = (data, { peerId }) => {
      if (
        peerRoom !== activeRoom ||
        !data ||
        !validBoard(data.board) ||
        !Number.isInteger(data.score) ||
        data.score < 0 ||
        data.score > Number.MAX_SAFE_INTEGER
      )
        return;
      if (!peerPlayers.has(peerId) && peerPlayers.size >= 8) return;
      peerPlayers.set(peerId, {
        id: peerId,
        name: String(data.name || "Player").slice(0, 16),
        board: data.board,
        score: data.score,
        status: data.status,
      });
      showPlayers([...peerPlayers.values()]);
      roomStatus.textContent = `Room ${room} — ${peerPlayers.size} players connected.`;
    };
    activeRoom.onPeerJoin = (peerId) =>
      safeSend(networkState(), { target: peerId });
    activeRoom.onPeerLeave = (peerId) => {
      if (peerRoom !== activeRoom) return;
      peerPlayers.delete(peerId);
      showPlayers([...peerPlayers.values()]);
      roomStatus.textContent = `Room ${room} — ${peerPlayers.size > 1 ? peerPlayers.size + " players connected." : "waiting for friends."}`;
    };
    sendPeerState = (data) => {
      peerPlayers.set("you", { id: "you", ...data });
      showPlayers([...peerPlayers.values()]);
      safeSend(data);
    };
    peerPlayers.set("you", { id: "you", ...networkState() });
    showPlayers([...peerPlayers.values()]);
    document.querySelector("#leave").disabled = false;
    roomStatus.textContent = `Room ${room} — peer-to-peer multiplayer ready; waiting for friends. Some networks require the Node server.`;
  } catch (error) {
    console.error(error);
    showPlayers([]);
    roomStatus.textContent =
      "Could not start online multiplayer — solo play still works.";
  }
}
document.querySelector("#join").onclick = async () => {
  if (joining) return;
  joining = true;
  document.querySelector("#join").disabled = true;
  room =
    document
      .querySelector("#room")
      .value.toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8) || "TETRIS";
  document.querySelector("#room").value = room;
  playerName =
    document.querySelector("#name").value.trim().slice(0, 16) || "Player";
  resetInputs();
  try {
    if (location.hostname.endsWith("github.io")) await connectPeerRoom();
    else if (location.protocol === "file:")
      roomStatus.textContent =
        "Open this game through npm start or GitHub Pages to join friends.";
    else await connectMultiplayer();
  } finally {
    joining = false;
    document.querySelector("#join").disabled = false;
  }
};
document.querySelector("#leave").onclick = () => {
  room = acceptedRoom = "";
  sendPeerState = undefined;
  if (peerRoom) peerRoom.leave();
  peerRoom = undefined;
  peerPlayers.clear();
  if (socket) socket.emit("leave");
  showPlayers([]);
  document.querySelector("#leave").disabled = true;
  roomStatus.textContent =
    "Solo mode — join a room to show your game to friends.";
};
document.querySelector("#share").onclick = async () => {
  const code =
    room ||
    document
      .querySelector("#room")
      .value.toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8) ||
    "TETRIS";
  const link = new URL(location.href);
  link.searchParams.set("room", code);
  try {
    await navigator.clipboard.writeText(link.href);
    roomStatus.textContent = "Room link copied — send it to a friend.";
  } catch {
    roomStatus.textContent = `Share this link: ${link.href}`;
  }
};
const linkedRoom = new URLSearchParams(location.search).get("room");
if (linkedRoom)
  document.querySelector("#room").value = linkedRoom
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);

const playerCards = new Map();
function showPlayers(players) {
  if (!Array.isArray(players)) return;
  const host = document.querySelector("#players"),
    ids = new Set();
  for (const player of players.slice(0, 8)) {
    if (!player || typeof player.id !== "string") continue;
    ids.add(player.id);
    let card = playerCards.get(player.id);
    if (!card) {
      const element = document.createElement("div"),
        label = document.createElement("div"),
        canvas = document.createElement("canvas");
      element.className = "player";
      canvas.className = "mini";
      canvas.width = 80;
      canvas.height = 160;
      const context = canvas.getContext("2d");
      context.scale(8, 8);
      element.append(label, canvas);
      host.append(element);
      card = { element, label, context };
      playerCards.set(player.id, card);
    }
    card.label.textContent = `${String(player.name || "Player").slice(0, 16)} — ${Number(player.score) || 0} · ${["READY", "PLAYING", "PAUSED", "GAME OVER", "COMPLETE"].includes(player.status) ? player.status : "READY"}`;
    card.context.fillStyle = "#020817";
    card.context.fillRect(0, 0, COLS, ROWS);
    if (validBoard(player.board))
      drawMatrix(player.board, { x: 0, y: 0 }, card.context);
  }
  for (const [id, card] of playerCards)
    if (!ids.has(id)) {
      card.element.remove();
      playerCards.delete(id);
    }
}

// Pointer capture releases held movement even when a finger leaves a button.
document.querySelectorAll("[data-touch]").forEach((button) => {
  const release = () => {
    const action = button.dataset.touch;
    releaseAction(action);
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (!running || paused) return;
    button.setPointerCapture?.(event.pointerId);
    const action = button.dataset.touch;
    pressAction(action);
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(event, release);
});
