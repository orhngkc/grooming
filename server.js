const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ALLOWED_SCORES = [1, 2, 3, 5, 8, 13, 21];

const state = {
  users: new Map(), // socketId -> { name, vote }
  revealed: false,
};

app.use(express.static(path.join(__dirname, "public")));

function getSnapshot() {
  const users = Array.from(state.users.values()).map((u) => ({
    name: u.name,
    hasVoted: typeof u.vote === "number",
    vote: state.revealed ? u.vote : null,
  }));

  return {
    revealed: state.revealed,
    users,
    allowedScores: ALLOWED_SCORES,
  };
}

function broadcastState() {
  io.emit("state:update", getSnapshot());
}

io.on("connection", (socket) => {
  socket.on("user:join", (name) => {
    const safeName = String(name || "").trim().slice(0, 30);
    if (!safeName) {
      socket.emit("error:message", "İsim gerekli.");
      return;
    }

    state.users.set(socket.id, { name: safeName, vote: null });
    broadcastState();
  });

  socket.on("vote:submit", (value) => {
    const user = state.users.get(socket.id);
    if (!user) {
      socket.emit("error:message", "Önce katılmalısın.");
      return;
    }

    const numericValue = Number(value);
    if (!ALLOWED_SCORES.includes(numericValue)) {
      socket.emit("error:message", "Geçersiz puan.");
      return;
    }

    user.vote = numericValue;
    state.users.set(socket.id, user);
    broadcastState();
  });

  socket.on("vote:reveal", () => {
    state.revealed = true;
    broadcastState();
  });

  socket.on("vote:reset", () => {
    state.revealed = false;
    for (const [id, user] of state.users.entries()) {
      state.users.set(id, { ...user, vote: null });
    }
    broadcastState();
  });

  socket.on("disconnect", () => {
    state.users.delete(socket.id);
    broadcastState();
  });

  socket.emit("state:update", getSnapshot());
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server çalışıyor: http://0.0.0.0:${PORT}`);
});
