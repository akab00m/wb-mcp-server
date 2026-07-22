import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createConfiguredMcpServer } from "./create-mcp.js";
import { createBearerAuthMiddleware } from "./http-auth.js";
import type { ServerConfig } from "./config.js";
import type { ToolRegistrationOptions } from "./types/options.js";

export interface HttpListenOptions {
  token: string;
  version: string;
  readOnly: boolean;
  http: ServerConfig["http"];
}

export interface HttpListenResult {
  server: HttpServer;
  baseUrl: string;
}

type SessionEntry = {
  transport: StreamableHTTPServerTransport;
  mcpServer: ReturnType<typeof createConfiguredMcpServer>["mcpServer"];
};

/**
 * Start Streamable HTTP MCP with Bearer auth and stateful sessions (SDK pattern).
 * Returns the Node HTTP server so callers/tests can close it.
 */
export async function listenHttpMcp(options: HttpListenOptions): Promise<HttpListenResult> {
  const { token, version, readOnly, http: config } = options;
  const toolOpts: ToolRegistrationOptions = { readOnly };

  const app = createMcpExpressApp({
    host: config.host,
    allowedHosts: config.allowedHosts,
  });

  const requireAuth = createBearerAuthMiddleware(config.authToken);
  const sessions = new Map<string, SessionEntry>();

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      version,
      readOnly,
      sessions: sessions.size,
    });
  });

  const handlePost = async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.headers["mcp-session-id"];
    const sid = typeof sessionId === "string" ? sessionId : undefined;

    try {
      if (sid && sessions.has(sid)) {
        await sessions.get(sid)!.transport.handleRequest(req, res, req.body);
        return;
      }

      if (!sid && isInitializeRequest(req.body)) {
        const { mcpServer } = createConfiguredMcpServer(token, version, toolOpts);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSid) => {
            sessions.set(newSid, { transport, mcpServer });
          },
        });

        transport.onclose = () => {
          const closedId = transport.sessionId;
          if (closedId) sessions.delete(closedId);
        };

        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
    } catch (error) {
      process.stderr.write(`[http] Ошибка MCP POST: ${error}\n`);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  };

  const handleSessionRequest = async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.headers["mcp-session-id"];
    const sid = typeof sessionId === "string" ? sessionId : undefined;
    if (!sid || !sessions.has(sid)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Invalid or missing session ID" },
        id: null,
      });
      return;
    }

    try {
      await sessions.get(sid)!.transport.handleRequest(req, res);
    } catch (error) {
      process.stderr.write(`[http] Ошибка MCP ${req.method}: ${error}\n`);
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
  app.get(config.path, requireAuth, (req, res) => {
    void handleSessionRequest(req, res);
  });
  app.delete(config.path, requireAuth, (req, res) => {
    void handleSessionRequest(req, res);
  });

  const server = await new Promise<HttpServer>((resolve, reject) => {
    const s = app.listen(config.port, config.host, () => resolve(s));
    s.on("error", reject);
  });

  server.on("close", () => {
    for (const entry of sessions.values()) {
      void entry.transport.close();
      void entry.mcpServer.close();
    }
    sessions.clear();
  });

  const mode = readOnly ? "read-only" : "full";
  process.stderr.write(
    `wb-mcp-server v${version} started (http://${config.host}:${config.port}${config.path}, ${mode}, bearer auth, stateful)\n`,
  );

  const displayHost = config.host === "0.0.0.0" ? "127.0.0.1" : config.host;
  return {
    server,
    baseUrl: `http://${displayHost}:${config.port}`,
  };
}
