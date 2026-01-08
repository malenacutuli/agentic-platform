import { v4 as uuid } from "uuid";
import { logger } from "../utils/logger.js";

export interface SandboxConfig {
  projectId: string;
  projectPath: string;
  environment: Record<string, string>;
  resources: {
    cpuLimit: number;
    memoryLimit: number;
    diskLimit: number;
  };
  ports: {
    devServer: number;
    debugger: number;
  };
}

export interface Sandbox {
  id: string;
  projectId: string;
  status: "running" | "stopped" | "error";
  devServerUrl: string;
  debuggerUrl: string;
  createdAt: Date;
  logs: string[];
}

/**
 * Sandbox Manager - Manages containerized development environments
 * Note: This is a simplified implementation. In production, integrate with Docker/Kubernetes
 */
export class SandboxManager {
  private sandboxes: Map<string, Sandbox> = new Map();

  /**
   * Create and start a sandbox container
   */
  async createSandbox(config: SandboxConfig): Promise<{
    containerId: string;
    devServerUrl: string;
    debuggerUrl: string;
  }> {
    logger.info(`[SandboxManager] Creating sandbox for ${config.projectId}`);

    const containerId = uuid();

    try {
      // In production, this would create an actual Docker container
      // For now, we'll create a mock sandbox
      const sandbox: Sandbox = {
        id: containerId,
        projectId: config.projectId,
        status: "running",
        devServerUrl: `https://${config.ports.devServer}-${config.projectId}.agentic-platform.dev`,
        debuggerUrl: `https://${config.ports.debugger}-${config.projectId}.agentic-platform.dev`,
        createdAt: new Date(),
        logs: [
          `[${new Date().toISOString()}] Sandbox created`,
          `[${new Date().toISOString()}] Environment variables loaded`,
          `[${new Date().toISOString()}] Dependencies installing...`,
        ],
      };

      this.sandboxes.set(containerId, sandbox);

      logger.info(`[SandboxManager] Sandbox created: ${containerId}`, {
        devServerUrl: sandbox.devServerUrl,
      });

      return {
        containerId,
        devServerUrl: sandbox.devServerUrl,
        debuggerUrl: sandbox.debuggerUrl,
      };
    } catch (error) {
      logger.error(`[SandboxManager] Failed to create sandbox`, { error });
      throw error;
    }
  }

  /**
   * Execute command in sandbox
   */
  async executeCommand(
    containerId: string,
    command: string[]
  ): Promise<string> {
    const sandbox = this.sandboxes.get(containerId);
    if (!sandbox) {
      throw new Error(`Sandbox ${containerId} not found`);
    }

    logger.info(`[SandboxManager] Executing command in ${containerId}`, {
      command: command.join(" "),
    });

    // In production, this would execute in the actual container
    // For now, return mock output
    const output = `Command executed: ${command.join(" ")}\n`;
    sandbox.logs.push(`[${new Date().toISOString()}] ${output}`);

    return output;
  }

  /**
   * Get sandbox logs
   */
  async getLogs(containerId: string, tail: number = 100): Promise<string> {
    const sandbox = this.sandboxes.get(containerId);
    if (!sandbox) {
      throw new Error(`Sandbox ${containerId} not found`);
    }

    return sandbox.logs.slice(-tail).join("\n");
  }

  /**
   * Stop sandbox
   */
  async stopSandbox(containerId: string): Promise<void> {
    const sandbox = this.sandboxes.get(containerId);
    if (!sandbox) {
      throw new Error(`Sandbox ${containerId} not found`);
    }

    try {
      sandbox.status = "stopped";
      sandbox.logs.push(`[${new Date().toISOString()}] Sandbox stopped`);

      logger.info(`[SandboxManager] Sandbox stopped: ${containerId}`);
    } catch (error) {
      logger.error(`[SandboxManager] Failed to stop sandbox`, { error });
      throw error;
    }
  }

  /**
   * Get sandbox status
   */
  getSandboxStatus(containerId: string): Sandbox | undefined {
    return this.sandboxes.get(containerId);
  }

  /**
   * Get all sandboxes
   */
  getAllSandboxes(): Sandbox[] {
    return Array.from(this.sandboxes.values());
  }

  /**
   * Get sandboxes for project
   */
  getProjectSandboxes(projectId: string): Sandbox[] {
    return Array.from(this.sandboxes.values()).filter(
      (s) => s.projectId === projectId
    );
  }
}
