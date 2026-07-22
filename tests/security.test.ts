import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createConfiguredMcpServer } from "../src/create-mcp.js";
import { WBClient } from "../src/wb-client.js";
import { BASE_URLS } from "../src/config.js";
import { WBApiError } from "../src/utils/errors.js";

const WRITE_TOOLS = [
  "reply_feedback",
  "reply_question",
  "update_prices",
  "update_advert_bid",
  "create_supply",
] as const;

function toolNames(server: McpServer): string[] {
  return Object.keys((server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools);
}

describe("READ_ONLY mode", () => {
  it("registers write tools by default", () => {
    const { mcpServer } = createConfiguredMcpServer("t", "0.0.0", { readOnly: false });
    const names = toolNames(mcpServer);
    for (const name of WRITE_TOOLS) {
      expect(names).toContain(name);
    }
    expect(names.length).toBe(35);
  });

  it("omits write tools when readOnly=true", () => {
    const { mcpServer } = createConfiguredMcpServer("t", "0.0.0", { readOnly: true });
    const names = toolNames(mcpServer);
    for (const name of WRITE_TOOLS) {
      expect(names).not.toContain(name);
    }
    expect(names.length).toBe(30);
    expect(names).toContain("get_seller_info");
    expect(names).toContain("get_prices");
  });
});

describe("WBClient host allowlist", () => {
  it("rejects non-WB hosts", async () => {
    const client = new WBClient("t");
    await expect(
      client.get("https://evil.example", "/api/v1/x"),
    ).rejects.toBeInstanceOf(WBApiError);
  });

  it("rejects absolute path URLs", async () => {
    const client = new WBClient("t");
    await expect(
      client.get(BASE_URLS.common, "https://evil.example/steal"),
    ).rejects.toBeInstanceOf(WBApiError);
  });
});
