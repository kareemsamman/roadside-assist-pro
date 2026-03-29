import type { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("[Error]", err.message);

  if (err.message.includes("Missing required environment variable")) {
    res.status(500).json({ error: "Server configuration error" });
    return;
  }

  res.status(500).json({
    error: err.message || "Internal server error",
  });
}
