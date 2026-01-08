import { Router, Request, Response } from "express";
import { logger } from "../../utils/logger.js";

const router = Router();

/**
 * Create sandbox
 */
router.post("/create", async (req: Request, res: Response) => {
  try {
    const { projectId, projectPath, environment } = req.body;

    if (!projectId || !projectPath) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: projectId, projectPath",
      });
    }

    const sandboxManager = req.app.locals.sandboxManager;

    const result = await sandboxManager.createSandbox({
      projectId,
      projectPath,
      environment: environment || {},
      resources: {
        cpuLimit: 1,
        memoryLimit: 2048,
        diskLimit: 10,
      },
      ports: {
        devServer: 3000,
        debugger: 9229,
      },
    });

    logger.info(`[Sandboxes] Sandbox created for ${projectId}`);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error(`[Sandboxes] Sandbox creation failed`, { error });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get sandbox status
 */
router.get("/:sandboxId", (req: Request, res: Response) => {
  try {
    const { sandboxId } = req.params;
    const sandboxManager = req.app.locals.sandboxManager;

    const sandbox = sandboxManager.getSandboxStatus(sandboxId);

    if (!sandbox) {
      return res.status(404).json({
        success: false,
        error: "Sandbox not found",
      });
    }

    res.json({
      success: true,
      sandbox,
    });
  } catch (error: any) {
    logger.error(`[Sandboxes] Failed to get sandbox status`, { error });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get sandbox logs
 */
router.get("/:sandboxId/logs", async (req: Request, res: Response) => {
  try {
    const { sandboxId } = req.params;
    const tail = parseInt(req.query.tail as string) || 100;

    const sandboxManager = req.app.locals.sandboxManager;
    const logs = await sandboxManager.getLogs(sandboxId, tail);

    res.json({
      success: true,
      logs,
    });
  } catch (error: any) {
    logger.error(`[Sandboxes] Failed to get logs`, { error });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Stop sandbox
 */
router.post("/:sandboxId/stop", async (req: Request, res: Response) => {
  try {
    const { sandboxId } = req.params;
    const sandboxManager = req.app.locals.sandboxManager;

    await sandboxManager.stopSandbox(sandboxId);

    logger.info(`[Sandboxes] Sandbox stopped: ${sandboxId}`);

    res.json({
      success: true,
      message: "Sandbox stopped",
    });
  } catch (error: any) {
    logger.error(`[Sandboxes] Failed to stop sandbox`, { error });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * List all sandboxes
 */
router.get("/", (req: Request, res: Response) => {
  try {
    const sandboxManager = req.app.locals.sandboxManager;
    const sandboxes = sandboxManager.getAllSandboxes();

    res.json({
      success: true,
      sandboxes,
      total: sandboxes.length,
    });
  } catch (error: any) {
    logger.error(`[Sandboxes] Failed to list sandboxes`, { error });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
