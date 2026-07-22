import { describe, it, expect, afterEach } from "vitest";
import http from "node:http";
import type { Server as HttpServer } from "node:http";
import { listenHttpMcp } from "../src/http-server.js";

const AUTH = "test-secret-http";
let server: HttpServer | undefined;
let baseUrl = "";
let port = 0;

async function start(opts?: {
  allowedHosts?: string[];
  host?: string;
  port?: number;
}): Promise<void> {
  port = opts?.port ?? 3700 + Math.floor(Math.random() * 200);
  const host = opts?.host ?? "127.0.0.1";
  const result = await listenHttpMcp({
    token: "wb-dummy",
    version: "0.0.0-test",
    readOnly: true,
    http: {
      host,
      port,
      path: "/mcp",
      authToken: AUTH,
      allowedHosts: opts?.allowedHosts ?? [
        "localhost",
        "127.0.0.1",
        `localhost:${port}`,
        `127.0.0.1:${port}`,
      ],
    },
  });
  server = result.server;
  baseUrl = result.baseUrl;
}

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((err) => (err ? reject(err) : resolve()));
    });
    server = undefined;
  }
});

function mcpHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${AUTH}`,
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    ...extra,
  };
}

async function postMcp(
  body: unknown,
  headers: Record<string, string> = mcpHeaders(),
): Promise<{ status: number; text: string; sessionId?: string }> {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const sessionId = res.headers.get("mcp-session-id") ?? undefined;
  return { status: res.status, text, sessionId };
}

/** Low-level POST so we can set Host (fetch often ignores Host override). */
function postMcpRaw(hostHeader: string, body: unknown): Promise<{ status: number; text: string }> {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/mcp",
        method: "POST",
        headers: {
          ...mcpHeaders({ Host: hostHeader }),
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") });
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

const initBody = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "t", version: "0" },
  },
};

describe("HTTP MCP integration", () => {
  it("serves /health without auth", async () => {
    await start();
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; readOnly: boolean };
    expect(json.status).toBe("ok");
    expect(json.readOnly).toBe(true);
  });

  it("rejects missing Bearer on /mcp", async () => {
    await start();
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(initBody),
    });
    expect(res.status).toBe(401);
  });

  it("initialize then tools/list via session", async () => {
    await start();
    const init = await postMcp(initBody);
    expect(init.status).toBe(200);
    expect(init.sessionId).toBeTruthy();
    expect(init.text).toContain("wb-mcp-server");

    const list = await postMcp(
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      mcpHeaders({ "mcp-session-id": init.sessionId! }),
    );
    expect(list.status).toBe(200);
    expect(list.text).toContain("get_seller_info");
    expect(list.text).not.toContain("reply_feedback");
    expect(list.text).not.toContain("update_prices");
  });

  it("rejects tools/list without session", async () => {
    await start();
    const list = await postMcp({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    expect(list.status).toBe(400);
    expect(list.text).toMatch(/session/i);
  });

  it("rejects Docker-style Host not in allowlist with 403", async () => {
    const p = 3900 + Math.floor(Math.random() * 80);
    await start({
      port: p,
      allowedHosts: ["127.0.0.1", `127.0.0.1:${p}`],
    });
    const res = await postMcpRaw(`wb-mcp:${p}`, initBody);
    expect(res.status).toBe(403);
    expect(res.text).toMatch(/Invalid Host|Host/i);
  });

  it("accepts Docker-style Host when listed in allowlist", async () => {
    const p = 3980 + Math.floor(Math.random() * 80);
    await start({
      port: p,
      allowedHosts: ["wb-mcp", `wb-mcp:${p}`, "127.0.0.1", `127.0.0.1:${p}`],
    });
    const res = await postMcpRaw(`wb-mcp:${p}`, initBody);
    expect(res.status).toBe(200);
    expect(res.text).toContain("wb-mcp-server");
  });
});
