import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WBClient } from "../wb-client.js";
import { BASE_URLS } from "../config.js";
import { formatError } from "../utils/errors.js";

export function registerSellerTools(server: McpServer, client: WBClient): void {
  // get_seller_info
  server.registerTool(
    "get_seller_info",
    {
      description: "Информация о продавце: юридическое имя (name), ИНН (tin), торговая марка (tradeMark), seller ID (sid). Полезно для контекста: имя в отчётах, идентификация владельца магазина.",
    },
    async () => {
      try {
        const data = await client.get<any>(BASE_URLS.common, "/api/v1/seller-info");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    },
  );

  // get_jam_subscription
  server.registerTool(
    "get_jam_subscription",
    {
      description: `Информация о подписке Jam: даты активации/истечения, уровень, метод подписки.
⚠️ Требует SERVICE token (с Personal token вернёт 403 "personal token is not allowed"). Если используешь Personal token — этот метод вернёт ошибку, это ожидаемо.
Зачем нужно: подписка Jam открывает доступ к поисковой аналитике (search-report). Без подписки этот функционал недоступен.`,
    },
    async () => {
      try {
        const data = await client.get<any>(BASE_URLS.common, "/api/common/v1/subscriptions");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    },
  );
}
