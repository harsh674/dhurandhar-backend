const http = require("http");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { Server: IOServer } = require("socket.io");

const env = require("./config/env");
const { connectDB } = require("./config/db");
const routes = require("./routes");
const errorHandler = require("./middleware/error");
const { globalLimiter } = require("./middleware/rateLimit");
const registerSockets = require("./sockets");

const app = express();

// Required behind Vercel / proxies for correct IPs and rate-limit
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(globalLimiter);

// Static fallback for locally uploaded files (when Cloudinary isn't configured).
// NOTE: Vercel's filesystem is read-only — uploads only persist locally.
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health
app.get("/", (_req, res) => res.json({ ok: true, service: "ServiQ API", version: "v1" }));
app.get("/health", (_req, res) => res.json({ status: "healthy", time: new Date().toISOString() }));

// Ensure DB is connected before any /api request (serverless-safe).
app.use("/api", async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.use("/api/v1", routes);

app.use(errorHandler.notFound);
app.use(errorHandler);

// HTTP server + Socket.IO (used in local/long-running mode only).
// Vercel serverless functions do NOT support websockets — sockets are skipped there.
const server = http.createServer(app);

if (!process.env.VERCEL) {
  const io = new IOServer(server, {
    cors: {
      origin: true,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  registerSockets(io);
  app.set("io", io);
}

async function start() {
  await connectDB();
  server.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[serviq] API listening on http://localhost:${env.port}/api/v1`);
  });
}

// Local dev: start a real HTTP server. On Vercel: just export `app`.
if (require.main === module && !process.env.VERCEL) {
  start().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[fatal]", err);
    process.exit(1);
  });
}

module.exports = app;
module.exports.app = app;
module.exports.server = server;
