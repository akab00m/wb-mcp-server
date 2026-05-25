import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WBClient } from "../wb-client.js";
import { BASE_URLS } from "../config.js";
import { formatError } from "../utils/errors.js";

export function registerContentTools(server: McpServer, client: WBClient): void {
  // get_content_cards
  server.registerTool(
    "get_content_cards",
    {
      description: `Карточки товаров продавца: nmID, vendorCode, brand, title, description, subjectName, характеристики.
Курсорная пагинация: WB возвращает cursor — передавай его поля (updatedAt, nmID) в следующем запросе для получения следующей страницы.
Полезно агентам для маппинга nmID → название товара (например, при работе с отзывами/аналитикой/ценами).`,
      inputSchema: {
        limit: z.number().min(1).max(100).default(100).describe("Размер страницы (1-100)"),
        cursorUpdatedAt: z.string().optional().describe("Курсор: updatedAt из предыдущего ответа"),
        cursorNmID: z.number().optional().describe("Курсор: nmID из предыдущего ответа"),
        withPhoto: z.number().optional().describe("Фильтр: -1 без фото, 0 с фото или без, 1 с фото"),
        textSearch: z.string().optional().describe("Поиск по тексту в карточке"),
      },
    },
    async (args) => {
      try {
        const cursor: Record<string, any> = { limit: args.limit };
        if (args.cursorUpdatedAt) cursor.updatedAt = args.cursorUpdatedAt;
        if (args.cursorNmID !== undefined) cursor.nmID = args.cursorNmID;

        const filter: Record<string, any> = {};
        if (args.withPhoto !== undefined) filter.withPhoto = args.withPhoto;
        if (args.textSearch) filter.textSearch = args.textSearch;

        const data = await client.post<any>(
          BASE_URLS.content,
          "/content/v2/get/cards/list",
          { settings: { cursor, filter } },
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
