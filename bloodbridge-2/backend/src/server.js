import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

import requestsRouter from "./routes/requests.js";
import sourcesRouter from "./routes/sources.js";
import matchRouter from "./routes/match.js";
import { initSocket } from "./socket.js";

const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

const app = express();
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "bloodbridge-backend", time: new Date().toISOString() });
});

app.use("/api/requests", requestsRouter);
app.use("/api/sources", sourcesRouter);
app.use("/api/match", matchRouter);

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: CORS_ORIGIN } });
initSocket(io);

httpServer.listen(PORT, () => {
  console.log(`BloodBridge backend listening on http://localhost:${PORT}`);
  console.log(`Socket.io realtime layer active (CORS origin: ${CORS_ORIGIN})`);
});
