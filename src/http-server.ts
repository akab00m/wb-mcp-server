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
  /** Test seam: override clock (ms since epoch). */
  now?: () => number;
}

export interface HttpListenResult {
  server: HttpServer;
  baseUrl: string;
}

type SessionEntry = {
  transport: StreamableHTTPServerTransport;
  mcpServer: ReturnType<typeof createConfiguredMcpServer>["mcpServer"];
  lastAccessAt: number;
};

/**
 * Start Streamable HTTP MCP with Bearer auth and stateful sessions (SDK pattern).
 * Idle TTL + max sessions protect against unbounded memory growth.
 */
export async function listenHttpMcp(options: HttpListenOptions): Promise<HttpListenResult> {
  const { token, version, readOnly, http: config } = options;
  const now = options.now ?? Date.now;
  const toolOpts: ToolRegistrationOptions = { readOnly };
  const { sessionIdleTtlMs, sessionMax } = config;

  const app = createMcpExpressApp({
    host: config.host,
    allowedHosts: config.allowedHosts,
  });

  const requireAuth = createBearerAuthMiddleware(config.authToken);
  const sessions = new Map<string, SessionEntry>();

  const destroySession = async (sid: string, reason: string): Promise<void> => {
    const entry = sessions.get(sid);
    if (!entry) return;
    sessions.delete(sid);
    process.stderr.write(`[http] session ${sid} closed (${reason})\n`);
    try {
      await entry.transport.close();
    } catch {
      /* ignore */
    }
    try {
      await entry.mcpServer.close();
    } catch {
      /* ignore */
    }
  };

  const sweepIdleSessions = async (): Promise<number> => {
    if (sessionIdleTtlMs <= 0) return 0;
    const cutoff = now() - sessionIdleTtlMs;
    const expired: string[] = [];
    for (const [sid, entry] of sessions) {
      if (entry.lastAccessAt < cutoff) expired.push(sid);
    }
    for (const sid of expired) {
      await destroySession(sid, "idle TTL");
    }
    return expired.length;
  };

  const touch = (sid: string): SessionEntry | undefined => {
    const entry = sessions.get(sid);
    if (!entry) return undefined;
    if (sessionIdleTtlMs > 0 && entry.lastAccessAt < now() - sessionIdleTtlMs) {
      void destroySession(sid, "idle TTL on access");
      return undefined;
    }
    entry.lastAccessAt = now();
    return entry;
  };

  const sweepMs =
    sessionIdleTtlMs > 0 ? Math.min(10_000, Math.max(50, Math.floor(sessionIdleTtlMs / 2))) : 0;
  const sweepTimer =
    sweepMs > 0
      ? setInterval(() => {
          void sweepIdleSessions();
        }, sweepMs)
      : undefined;
  sweepTimer?.unref?.();

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      version,
      readOnly,
      sessions: sessions.size,
      sessionMax,
      sessionIdleTtlMs,
    });
  });

  const handlePost = async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.headers["mcp-session-id"];
    const sid = typeof sessionId === "string" ? sessionId : undefined;

    try {
      if (sid) {
        const entry = touch(sid);
        if (!entry) {
          res.status(400).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Invalid or expired session ID" },
            id: null,
          });
          return;
        }
        await entry.transport.handleRequest(req, res, req.body);
        return;
      }

      if (isInitializeRequest(req.body)) {
        await sweepIdleSessions();

        if (sessions.size >= sessionMax) {
          res.status(503).json({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: `Session limit reached (${sessionMax}). Close idle sessions or raise MCP_SESSION_MAX.`,
            },
            id: null,
          });
          return;
        }

        const { mcpServer } = createConfiguredMcpServer(token, version, toolOpts);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSid) => {
            sessions.set(newSid, {
              transport,
              mcpServer,
              lastAccessAt: now(),
            });
          },
        });

        transport.onclose = () => {
          const closedId = transport.sessionId;
          if (!closedId) return;
          const entry = sessions.get(closedId);
          if (!entry) return;
          sessions.delete(closedId);
          void entry.mcpServer.close().catch(() => undefined);
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
    const entry = sid ? touch(sid) : undefined;
    if (!entry) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Invalid or expired session ID" },
        id: null,
      });
      return;
    }

    try {
      await entry.transport.handleRequest(req, res);
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
    if (sweepTimer) clearInterval(sweepTimer);
    for (const sid of [...sessions.keys()]) {
      void destroySession(sid, "server close");
    }
  });

  const mode = readOnly ? "read-only" : "full";
  process.stderr.write(
    `wb-mcp-server v${version} started (http://${config.host}:${config.port}${config.path}, ${mode}, bearer auth, stateful, maxSessions=${sessionMax}, idleTtlMs=${sessionIdleTtlMs})\n`,
  );

  const displayHost = config.host === "0.0.0.0" ? "127.0.0.1" : config.host;
  return {
    server,
    baseUrl: `http://${displayHost}:${config.port}`,
  };
}
