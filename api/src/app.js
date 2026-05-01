const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { env } = require("./config/env");
const { apiRouter } = require("./routes");
const { notFound } = require("./middleware/notFound");
const { errorHandler } = require("./middleware/errorHandler");
const { pool } = require("./db/pool");

function createApp() {
  const app = express();

  app.disable("x-powered-by");

  // Allow the Next.js UI (separate origin/port) to embed uploaded images/receipts from the API.
  // Without this, browsers can block <img src="http://api/.../uploads/..."> with
  // Cross-Origin-Resource-Policy: same-origin (helmet default).
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Accept", "Origin", "X-Requested-With", "Authorization"],
    })
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Serve uploaded receipts (public link used on the submission flow).
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  if (env.nodeEnv !== "test") {
    app.use(morgan("dev"));
  }

  app.get("/healthz", async (req, res, next) => {
    try {
      await pool.query("SELECT 1");
      res.status(200).json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  app.use(apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };



