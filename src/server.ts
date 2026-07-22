import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WBClient } from "./wb-client.js";
import { createConfiguredMcpServer } from "./create-mcp.js";
import { listenHttpMcp } from "./http-server.js";
import type { ServerConfig } from "./config.js";
import type { ToolRegistrationOptions } from "./types/options.js";

export { createConfiguredMcpServer } from "./create-mcp.js";

export class WBMCPServer {
  public mcpServer: McpServer | null;
  public wbClient: WBClient | null;
  private version: string;
  private token: string;
  private readOnly: boolean;

  constructor(token: string, version: string, options: ToolRegistrationOptions = {}) {
    this.token = token;
    this.version = version;
    this.readOnly = options.readOnly === true;
    // Lazy for HTTP: tools are created per session. Eager for stdio.
    this.mcpServer = null;
    this.wbClient = null;
  }

  private ensureStdioServer(): void {
    if (this.mcpServer) return;
    const created = createConfiguredMcpServer(this.token, this.version, {
      readOnly: this.readOnly,
    });
    this.mcpServer = created.mcpServer;
    this.wbClient = created.wbClient;
  }

  /** Stdio transport (default, Claude Desktop / local MCP clients). */
  async startStdio(): Promise<void> {
    this.ensureStdioServer();
    const transport = new StdioServerTransport();
    await this.mcpServer!.connect(transport);
    const mode = this.readOnly ? "read-only" : "full";
    process.stderr.write(`wb-mcp-server v${this.version} started (stdio, ${mode})\n`);
  }

  /**
   * Streamable HTTP for container-to-container use.
   * Sessions create their own McpServer instances.
   */
  async startHttp(config: ServerConfig["http"]): Promise<void> {
    await listenHttpMcp({
      token: this.token,
      version: this.version,
      readOnly: this.readOnly,
      http: config,
    });
  }

  async start(config: ServerConfig): Promise<void> {
    if (config.transport === "http") {
      await this.startHttp(config.http);
      return;
    }
    await this.startStdio();
  }
}
