import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { config } from "./config.js";
import { errorHandler } from "./middleware/error-handler.js";
import dwgRoutes from "./routes/dwg.js";

const app = express();

// Ensure uploads directory exists
const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(
  cors({
    origin: config.server.corsOrigin,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use(dwgRoutes);

// Error handler
app.use(errorHandler);

app.listen(config.server.port, () => {
  console.log(`[Server] Running on http://localhost:${config.server.port}`);
  console.log(`[Server] CORS origin: ${config.server.corsOrigin}`);
  console.log(
    `[Server] APS Activity: ${config.aps.activityId || "(not configured — run npm run setup-da)"}`
  );
});
