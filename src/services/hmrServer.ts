import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import chokidar from "chokidar";
import path from "path";
import { logger } from "../utils/logger.js";

export class HMRServer {
  private io: SocketIOServer;
  private watchers: Map<string, any> = new Map();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: { origin: "*" },
    });

    this.setupConnections();
  }

  /**
   * Setup WebSocket connections for HMR
   */
  private setupConnections(): void {
    this.io.on("connection", (socket) => {
      logger.info(`[HMR] Client connected: ${socket.id}`);

      socket.on("watch", (projectPath: string) => {
        this.watchProjectFiles(socket, projectPath);
      });

      socket.on("disconnect", () => {
        logger.info(`[HMR] Client disconnected: ${socket.id}`);
      });

      socket.on("error", (error) => {
        logger.error(`[HMR] Socket error: ${error}`);
      });
    });
  }

  /**
   * Watch project files for changes
   */
  private watchProjectFiles(socket: any, projectPath: string): void {
    logger.info(`[HMR] Watching files in ${projectPath}`);

    const watcher = chokidar.watch(projectPath, {
      ignored: [
        "node_modules",
        ".git",
        "dist",
        "build",
        ".next",
        "out",
        ".turbo",
      ],
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
    });

    watcher.on("change", (filePath: string) => {
      logger.debug(`[HMR] File changed: ${filePath}`);

      const ext = path.extname(filePath);
      const fileType = this.getFileType(ext);

      socket.emit("file-change", {
        filePath,
        fileType,
        timestamp: Date.now(),
      });
    });

    watcher.on("add", (filePath: string) => {
      logger.debug(`[HMR] File added: ${filePath}`);
      socket.emit("file-add", { filePath });
    });

    watcher.on("unlink", (filePath: string) => {
      logger.debug(`[HMR] File removed: ${filePath}`);
      socket.emit("file-remove", { filePath });
    });

    this.watchers.set(socket.id, watcher);

    socket.on("disconnect", () => {
      const watcher = this.watchers.get(socket.id);
      if (watcher) {
        watcher.close();
        this.watchers.delete(socket.id);
        logger.info(`[HMR] Watcher closed for ${socket.id}`);
      }
    });
  }

  /**
   * Determine file type from extension
   */
  private getFileType(
    ext: string
  ): "style" | "script" | "template" | "config" | "other" {
    switch (ext) {
      case ".css":
      case ".scss":
      case ".less":
        return "style";
      case ".ts":
      case ".tsx":
      case ".js":
      case ".jsx":
        return "script";
      case ".html":
        return "template";
      case ".json":
      case ".yaml":
      case ".yml":
        return "config";
      default:
        return "other";
    }
  }

  /**
   * Get active watchers count
   */
  getActiveWatchers(): number {
    return this.watchers.size;
  }

  /**
   * Get connected clients count
   */
  getConnectedClients(): number {
    return this.io.engine.clientsCount;
  }
}
