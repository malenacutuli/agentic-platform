import { Router, Request, Response } from "express";
import { logger } from "../../utils/logger.js";

const router = Router();

/**
 * Generate new project
 */
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { projectName, template, features, owner } = req.body;

    // Validation
    if (!projectName || !template || !owner) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: projectName, template, owner",
      });
    }

    const templateGenerator = req.app.locals.templateGenerator;

    const result = await templateGenerator.generateProject({
      projectId: `proj_${Date.now()}`,
      projectName,
      template,
      owner,
      features: features || [],
      environment: "development",
    });

    logger.info(`[Projects] Project generated: ${projectName}`);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error(`[Projects] Project generation failed`, { error });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * List projects
 */
router.get("/", (req: Request, res: Response) => {
  // In production, fetch from database
  res.json({
    projects: [],
    total: 0,
  });
});

/**
 * Get project details
 */
router.get("/:projectId", (req: Request, res: Response) => {
  const { projectId } = req.params;

  // In production, fetch from database
  res.json({
    projectId,
    name: "Sample Project",
    template: "web-ai-agent",
    createdAt: new Date(),
  });
});

export default router;
