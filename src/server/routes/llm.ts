import { Router, Request, Response } from "express";
import { logger } from "../../utils/logger.js";

const router = Router();

/**
 * LLM Completion endpoint (streaming and non-streaming)
 */
router.post("/complete", async (req: Request, res: Response) => {
  try {
    const { messages, model, stream, temperature, maxTokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid messages field",
      });
    }

    const llmRouter = req.app.locals.llmRouter;

    if (stream) {
      // Streaming response
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      try {
        for await (const chunk of llmRouter.stream({
          messages,
          model: model || "gpt-4",
          temperature,
          maxTokens,
        })) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        res.end();
      } catch (error: any) {
        logger.error(`[LLM] Streaming error`, { error });
        res.write(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming response
      try {
        const response = await llmRouter.invoke({
          messages,
          model: model || "gpt-4",
          temperature,
          maxTokens,
        });

        res.json({
          success: true,
          ...response,
        });
      } catch (error: any) {
        logger.error(`[LLM] Completion error`, { error });
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  } catch (error: any) {
    logger.error(`[LLM] Request error`, { error });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * LLM Router status
 */
router.get("/status", (req: Request, res: Response) => {
  try {
    const llmRouter = req.app.locals.llmRouter;
    const status = llmRouter.getStatus();

    res.json({
      success: true,
      ...status,
    });
  } catch (error: any) {
    logger.error(`[LLM] Status error`, { error });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Count tokens
 */
router.post("/count-tokens", (req: Request, res: Response) => {
  try {
    const { text, model } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "Missing text field",
      });
    }

    // Approximate token count
    const tokenCount = Math.ceil(text.length / 4);

    res.json({
      success: true,
      text,
      model: model || "gpt-4",
      tokenCount,
      estimatedCost: {
        input: (tokenCount / 1000) * 0.01,
        output: (tokenCount / 1000) * 0.03,
      },
    });
  } catch (error: any) {
    logger.error(`[LLM] Token counting error`, { error });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
