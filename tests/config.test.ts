import { describe, it, expect, afterEach } from "vitest";
import { loadConfig } from "../src/config.js";

const ORIGINAL_ARGV = [...process.argv];
const ORIGINAL_ENV = { ...process.env };

function reset(): void {
  process.argv = [...ORIGINAL_ARGV];
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
  delete process.env.WB_API_TOKEN;
  delete process.env.MCP_TRANSPORT;
  delete process.env.MCP_AUTH_TOKEN;
  delete process.env.READ_ONLY;
  delete process.env.WB_MCP_READ_ONLY;
  delete process.env.MCP_HTTP_HOST;
  delete process.env.MCP_HTTP_PORT;
  delete process.env.MCP_HTTP_PATH;
  delete process.env.MCP_ALLOWED_HOSTS;
  delete process.env.MCP_SESSION_IDLE_TTL_MS;
  delete process.env.MCP_SESSION_MAX;
}

afterEach(() => {
  reset();
});

describe("loadConfig", () => {
  it("defaults to stdio when token is set via env", () => {
    process.env.WB_API_TOKEN = "wb-test-token";
    const cfg = loadConfig();
    expect(cfg.transport).toBe("stdio");
    expect(cfg.readOnly).toBe(false);
    expect(cfg.token).toBe("wb-test-token");
  });

  it("requires auth token for http transport", () => {
    process.env.WB_API_TOKEN = "wb-test-token";
    process.env.MCP_TRANSPORT = "http";
    process.env.MCP_HTTP_HOST = "127.0.0.1";
    expect(() => loadConfig()).toThrow(/MCP_AUTH_TOKEN/);
  });

  it("requires MCP_ALLOWED_HOSTS when binding non-loopback", () => {
    process.env.WB_API_TOKEN = "wb-test-token";
    process.env.MCP_TRANSPORT = "http";
    process.env.MCP_AUTH_TOKEN = "secret-mcp";
    process.env.MCP_HTTP_HOST = "0.0.0.0";
    expect(() => loadConfig()).toThrow(/MCP_ALLOWED_HOSTS/);
  });

  it("loads http config with auth and read-only", () => {
    process.env.WB_API_TOKEN = "wb-test-token";
    process.env.MCP_TRANSPORT = "http";
    process.env.MCP_AUTH_TOKEN = "secret-mcp";
    process.env.READ_ONLY = "true";
    process.env.MCP_HTTP_HOST = "0.0.0.0";
    process.env.MCP_HTTP_PORT = "3100";
    process.env.MCP_ALLOWED_HOSTS = "wb-mcp,model";
    const cfg = loadConfig();
    expect(cfg.transport).toBe("http");
    expect(cfg.readOnly).toBe(true);
    expect(cfg.http.port).toBe(3100);
    expect(cfg.http.authToken).toBe("secret-mcp");
    expect(cfg.http.allowedHosts).toContain("wb-mcp");
    expect(cfg.http.allowedHosts).toContain("wb-mcp:3100");
    expect(cfg.http.allowedHosts).toContain("localhost");
    expect(cfg.http.sessionIdleTtlMs).toBe(30 * 60 * 1000);
    expect(cfg.http.sessionMax).toBe(32);
  });

  it("parses session TTL and max from env", () => {
    process.env.WB_API_TOKEN = "wb-test-token";
    process.env.MCP_TRANSPORT = "http";
    process.env.MCP_AUTH_TOKEN = "secret-mcp";
    process.env.MCP_HTTP_HOST = "127.0.0.1";
    process.env.MCP_SESSION_IDLE_TTL_MS = "60000";
    process.env.MCP_SESSION_MAX = "4";
    const cfg = loadConfig();
    expect(cfg.http.sessionIdleTtlMs).toBe(60_000);
    expect(cfg.http.sessionMax).toBe(4);
  });

  it("supports --read-only and --transport=http flags on loopback", () => {
    process.env.WB_API_TOKEN = "wb-test-token";
    process.argv.push(
      "--transport=http",
      "--auth-token=cli-secret",
      "--read-only",
      "--host=127.0.0.1",
    );
    const cfg = loadConfig();
    expect(cfg.transport).toBe("http");
    expect(cfg.readOnly).toBe(true);
    expect(cfg.http.authToken).toBe("cli-secret");
    expect(cfg.http.host).toBe("127.0.0.1");
  });
});
