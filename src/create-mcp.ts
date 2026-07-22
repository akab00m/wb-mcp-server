import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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

/** Build an McpServer with all tools registered. */
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
