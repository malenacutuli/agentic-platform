import { Router, Request, Response } from "express";
import { logger } from "../../utils/logger.js";

const router = Router();

/**
 * Health check endpoint
 */
router.get("/", (req: Request, res: Response) => {
  const llmRouter = req.app.locals.llmRouter;

  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    llmRouter: llmRouter ? llmRouter.getStatus() : null,
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  });
});

/**
 * Readiness check
 */
router.get("/ready", (req: Request, res: Response) => {
  const llmRouter = req.app.locals.llmRouter;
  const status = llmRouter?.getStatus();
  const hasProviders = status?.providers && status.providers.length > 0;

  if (hasProviders) {
    res.json({ ready: true, providers: status.providers });
  } else {
    res.status(503).json({ ready: false, error: "No LLM providers available" });
  }
});

/**
 * Liveness check
 */
router.get("/live", (req: Request, res: Response) => {
  res.json({ alive: true });
});

export default router;
