import { Request, Response, NextFunction } from "express";
import { logger } from "./logger.js";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error({ err }, "Unhandled error");

  if (err.name === "ZodError") {
    res.status(422).json({
      error: "Datos invalidos",
      details: (err as any).issues,
    });
    return;
  }

  res.status(500).json({ error: "Error interno del servidor" });
}
