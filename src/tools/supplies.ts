import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WBClient } from "../wb-client.js";
import { BASE_URLS } from "../config.js";
import { formatError } from "../utils/errors.js";

export function registerSuppliesTools(server: McpServer, client: WBClient): void {
  // get_supplies
  server.registerTool(
    "get_supplies",
    {
      description: `Список поставок FBS/FBO: id, name, createdAt, closedAt, done, cargoType, destinationOfficeId.
done=true — поставка закрыта (отгружена). done=false — открытая поставка, в неё можно добавлять задания.
Курсорная пагинация через next: передавай next из предыдущего ответа.`,
      inputSchema: {
        limit: z.number().min(1).max(1000).default(1000).describe("Размер страницы (1-1000)"),
        next: z.number().min(0).default(0).describe("Курсор пагинации (0 — первая страница)"),
      },
    },
    async (args) => {
      try {
        const data = await client.get<any>(
          BASE_URLS.marketplace,
          "/api/v3/supplies",
          { limit: args.limit, next: args.next },
        );

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

  // create_supply
  server.registerTool(
    "create_supply",
    {
      description: `⚠️ ВНИМАНИЕ: СОЗДАТЬ новую открытую поставку FBS. Создаёт реальную поставку в личном кабинете WB.
После создания в неё можно добавлять сборочные задания через add_orders_to_supply (отдельный метод, в этом сервере не реализован).
Возвращает { id: "WB-GI-..." } — идентификатор созданной поставки.
Используй только после явного подтверждения пользователем.`,
      inputSchema: {
        name: z.string().min(1).max(128).describe("Название поставки (1-128 символов)"),
      },
      annotations: { destructiveHint: true },
    },
    async (args) => {
      try {
        const data = await client.post<any>(
          BASE_URLS.marketplace,
          "/api/v3/supplies",
          { name: args.name },
        );

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
