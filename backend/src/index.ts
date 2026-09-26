import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { config } from "./config.js";
import "./db.js";
import { authRouter } from "./routes/auth.js";
import { gamesRouter } from "./routes/games.js";
import { adminRouter } from "./routes/admin.js";
import { startScheduler } from "./services/scheduler.js";

const app = express();
app.use(cors({ origin: config.frontendOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRouter);
app.use("/games", gamesRouter);
app.use("/admin", adminRouter);

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: config.frontendOrigin } });

io.on("connection", (socket) => {
  socket.on("join-game-room", (gameId: string) => {
    socket.join(`game:${gameId}`);
  });
});

startScheduler(io);

httpServer.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});
