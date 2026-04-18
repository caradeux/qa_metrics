import { Router, type Request, type Response } from "express";
import { runDailyAlerts } from "../lib/daily-alerts.js";

const router = Router();

function requireInternalSecret(req: Request, res: Response): boolean {
  const expected = process.env.INTERNAL_SECRET;
  if (!expected) {
    res.status(503).json({ error: "INTERNAL_SECRET not configured" });
    return false;
  }
  const provided = req.header("X-Internal-Secret");
  if (provided !== expected) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

router.post("/run-daily-alerts", async (req: Request, res: Response) => {
  if (!requireInternalSecret(req, res)) return;
  const dryRun = req.query.dryRun === "true";
  try {
    const result = await runDailyAlerts({ dryRun });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal error" });
  }
});

export default router;
