import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { Request, Response } from "express";
import { WBClient } from "./wb-client.js";
import { registerFeedbackTools } from "./tools/feedbacks.js";
import { registerStatisticsTools } from "./tools/statistics.js";
import { registerAnalyticsTools } from "./tools/analytics.js";
import { registerAdvertisingTools } from "./tools/advertising.js";
import { registerFinanceTools } from "./tools/finance.js";
import { registerPricesTools } from "./tools/prices.js";
import { registerDocumentsTools } from "./tools/documents.js";
import { registerSellerTools } from "./tools/seller.js";
import { registerContentTools } from "./tools/content.js";
import { registerSuppliesTools } from "./tools/supplies.js";
import { createBearerAuthMiddleware } from "./http-auth.js";
import type { ServerConfig } from "./config.js";
import type { ToolRegistrationOptions } from "./types/options.js";

function registerAllTools(
  mcpServer: McpServer,
  wbClient: WBClient,
  options: ToolRegistrationOptions,
): void {
  registerFeedbackTools(mcpServer, wbClient, options);
  registerStatisticsTools(mcpServer, wbClient);
  registerAnalyticsTools(mcpServer, wbClient);
  registerAdvertisingTools(mcpServer, wbClient, options);
  registerFinanceTools(mcpServer, wbClient);
  registerPricesTools(mcpServer, wbClient, options);
  registerDocumentsTools(mcpServer, wbClient);
  registerSellerTools(mcpServer, wbClient);
  registerContentTools(mcpServer, wbClient);
  registerSuppliesTools(mcpServer, wbClient, options);
}

/** Build a connected-ready McpServer with tools registered. */
export function createConfiguredMcpServer(
  token: string,
  version: string,
  options: ToolRegistrationOptions = {},
): { mcpServer: McpServer; wbClient: WBClient } {
  const wbClient = new WBClient(token);
  const mcpServer = new McpServer({
    name: "wb-mcp-server",
    version,
  });
  registerAllTools(mcpServer, wbClient, options);
  return { mcpServer, wbClient };
}

export class WBMCPServer {
  public mcpServer: McpServer;
  public wbClient: WBClient;
  private version: string;
  private token: string;
  private readOnly: boolean;

  constructor(token: string, version: string, options: ToolRegistrationOptions = {}) {
    this.token = token;
    this.version = version;
    this.readOnly = options.readOnly === true;
    const created = createConfiguredMcpServer(token, version, options);
    this.mcpServer = created.mcpServer;
    this.wbClient = created.wbClient;
  }

  /** Stdio transport (default, Claude Desktop / local MCP clients). */
  async startStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
    const mode = this.readOnly ? "read-only" : "full";
    process.stderr.write(`wb-mcp-server v${this.version} started (stdio, ${mode})\n`);
  }

  /**
   * Streamable HTTP transport for container-to-container use.
   * Stateless mode + Bearer auth. Health check at GET /health (no auth).
   */
  async startHttp(config: ServerConfig["http"]): Promise<void> {
    const app = createMcpExpressApp({
      host: config.host,
      allowedHosts: config.allowedHosts,
    });

    const requireAuth = createBearerAuthMiddleware(config.authToken);

    app.get("/health", (_req, res) => {
      res.status(200).json({
        status: "ok",
        version: this.version,
        readOnly: this.readOnly,
      });
    });

    const handlePost = async (req: Request, res: Response): Promise<void> => {
      // Stateless: new server + transport per request (SDK example pattern).
      const { mcpServer } = createConfiguredMcpServer(this.token, this.version, {
        readOnly: this.readOnly,
      });
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      try {
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
        res.on("close", () => {
          void transport.close();
          void mcpServer.close();
        });
      } catch (error) {
        process.stderr.write(`[http] Ошибка MCP-запроса: ${error}\n`);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          });
        }
      }
    };

    app.post(config.path, requireAuth, (req, res) => {
      void handlePost(req, res);
    });

    app.get(config.path, requireAuth, (_req, res) => {
      res.status(405).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      });
    });

    app.delete(config.path, requireAuth, (_req, res) => {
      res.status(405).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      });
    });

    await new Promise<void>((resolve, reject) => {
      const server = app.listen(config.port, config.host, (error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        const mode = this.readOnly ? "read-only" : "full";
        process.stderr.write(
          `wb-mcp-server v${this.version} started (http://${config.host}:${config.port}${config.path}, ${mode}, bearer auth)\n`,
        );
        resolve();
      });
      server.on("error", reject);
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
