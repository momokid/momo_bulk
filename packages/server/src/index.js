import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { connectDB } from "./config/database.js";

const app = express();

// ─── Security Middleware ─────────────────────────────
app.use(helmet());

app.use(
  cors({
    origin: env.isDev ? "http://localhost:5173" : process.env.CLIENT_URL,
    credentials: true,
  }),
);

// ─── Body Parsing ────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Health Check ────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ─────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Global Error Handler ────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: env.isDev ? err.message : "Something went wrong",
  });
});

// ─── Start Server ────────────────────────────────────
const start = async () => {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
  });
};

start();

export default app;
