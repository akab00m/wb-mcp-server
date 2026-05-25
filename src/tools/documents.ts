import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WBClient } from "../wb-client.js";
import { BASE_URLS } from "../config.js";
import { formatError } from "../utils/errors.js";

export function registerDocumentsTools(server: McpServer, client: WBClient): void {
  // get_documents
  server.registerTool(
    "get_documents",
    {
      description: `Список финансовых документов продавца: УПД, еженедельные отчёты реализации, уведомления о выкупе, акты.
Каждый документ — { serviceName, name, category, extensions, creationTime, viewed }.
serviceName используется для скачивания через отдельный endpoint /api/v1/documents/download.`,
      inputSchema: {
        locale: z.enum(["ru", "en", "zh"]).default("ru").describe("Локаль ответа"),
        beginTime: z.string().optional().describe("Начало периода (ISO, опционально)"),
        endTime: z.string().optional().describe("Конец периода (ISO, опционально)"),
        sort: z.enum(["date", "category"]).optional().describe("Поле сортировки. Если задано — нужен order"),
        order: z.enum(["asc", "desc"]).optional().describe("Направление сортировки. Если задано — нужен sort"),
        category: z.string().optional().describe("Фильтр по категории"),
      },
    },
    async (args) => {
      try {
        const params: Record<string, any> = { locale: args.locale };
        if (args.beginTime) params.beginTime = args.beginTime;
        if (args.endTime) params.endTime = args.endTime;
        if (args.sort && args.order) {
          params.sort = args.sort;
          params.order = args.order;
        }
        if (args.category) params.category = args.category;

        const data = await client.get<any>(
          BASE_URLS.documents,
          "/api/v1/documents/list",
          params,
        );

        const docs = data?.data?.documents ?? [];
        return {
          content: [{ type: "text" as const, text: JSON.stringify(docs, null, 2) }],
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
