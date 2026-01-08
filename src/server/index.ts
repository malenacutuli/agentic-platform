import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config();

// Import services
import { LLMRouter } from "../services/llm/router.js";
import { HMRServer } from "../services/hmrServer.js";
import { SandboxManager } from "../services/sandboxManager.js";
import { TemplateGenerator } from "../services/templateGenerator.js";
import { logger } from "../utils/logger.js";

// Import routes
import projectRoutes from "./routes/projects.js";
import sandboxRoutes from "./routes/sandboxes.js";
import llmRoutes from "./routes/llm.js";
import healthRoutes from "./routes/health.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });
  next();
});

// Initialize services
logger.info("Initializing services...");

const llmRouter = new LLMRouter([
  {
    name: "openai",
    apiKey: process.env.OPENAI_API_KEY || "",
    enabled: !!process.env.OPENAI_API_KEY,
    priority: 1,
    maxConcurrent: 10,
    rateLimitPerMinute: 60,
  },
  {
    name: "anthropic",
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    enabled: !!process.env.ANTHROPIC_API_KEY,
    priority: 2,
    maxConcurrent: 10,
    rateLimitPerMinute: 60,
  },
  {
    name: "google",
    apiKey: process.env.GOOGLE_API_KEY || "",
    enabled: !!process.env.GOOGLE_API_KEY,
    priority: 3,
    maxConcurrent: 10,
    rateLimitPerMinute: 60,
  },
]);

const sandboxManager = new SandboxManager();
const templateGenerator = new TemplateGenerator();
const hmrServer = new HMRServer(httpServer);

// Store services in app locals for route access
app.locals.llmRouter = llmRouter;
app.locals.sandboxManager = sandboxManager;
app.locals.templateGenerator = templateGenerator;
app.locals.io = io;

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/sandboxes", sandboxRoutes);
app.use("/api/llm", llmRoutes);

// Static files
app.use(express.static(path.join(__dirname, "../../public")));

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "Not found",
    path: req.path,
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// WebSocket events
io.on("connection", (socket) => {
  logger.info(`[WebSocket] Client connected: ${socket.id}`);

  socket.on("watch-project", (projectPath: string) => {
    logger.info(`[WebSocket] Watching project: ${projectPath}`);
    socket.emit("watching", { projectPath });
  });

  socket.on("disconnect", () => {
    logger.info(`[WebSocket] Client disconnected: ${socket.id}`);
  });

  socket.on("error", (error) => {
    logger.error(`[WebSocket] Error: ${error}`);
  });
});

// Start server
const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

httpServer.listen(PORT, HOST, () => {
  logger.info(`🚀 Server running on http://${HOST}:${PORT}`);
  logger.info(`📊 LLM Providers: ${llmRouter.getStatus().providers.map(p => p.name).join(", ")}`);
  logger.info(`🔧 Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully...");
  httpServer.close(async () => {
    logger.info("Server closed");
    process.exit(0);
  });
});

export default app;
