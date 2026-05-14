import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WBClient } from "../wb-client.js";
import { BASE_URLS } from "../config.js";
import { formatError } from "../utils/errors.js";

const STATISTICS_RATE_LIMIT = 1; // 1 req/min

export function registerStatisticsTools(server: McpServer, client: WBClient): void {
  // get_stocks
  server.registerTool(
    "get_stocks",
    {
      description: "Получить текущие остатки товаров на складах WB с разбивкой по складам и регионам. Возвращает количество на складе, в пути к клиенту (inWayToClient) и от клиента (inWayFromClient).",
      inputSchema: {
        limit: z.number().min(1).max(1000).default(1000).describe("Количество строк (1-1000)"),
        offset: z.number().min(0).default(0).describe("Смещение для пагинации"),
      },
    },
    async (args) => {
      try {
        await client.rateLimiter.waitIfNeeded("statistics", STATISTICS_RATE_LIMIT);

        const data = await client.post<any>(
          BASE_URLS.analytics,
          "/api/analytics/v1/stocks-report/wb-warehouses",
          {
            limit: args.limit,
            offset: args.offset,
          },
        );

        const items = data?.data?.items ?? [];
        let text = JSON.stringify(items, null, 2);

        if (Array.isArray(items) && items.length >= args.limit) {
          text += `\n\n⚠️ Получено ${args.limit} строк — возможно, есть ещё данные. Используйте offset=${args.offset + args.limit} для следующей страницы.`;
        }

        return {
          content: [{ type: "text" as const, text }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    },
  );

  // get_orders
  server.registerTool(
    "get_orders",
    {
      description: "Получить список заказов. Данные хранятся до 90 дней. Лимит: 1 запрос в минуту.",
      inputSchema: {
        dateFrom: z.string().describe("Дата начала в формате ISO, например 2024-01-01"),
        flag: z.number().optional().describe("0 — все заказы с указанной даты, 1 — только обновлённые"),
      },
    },
    async (args) => {
      try {
        await client.rateLimiter.waitIfNeeded("statistics", STATISTICS_RATE_LIMIT);

        const params: Record<string, any> = { dateFrom: args.dateFrom };
        if (args.flag !== undefined) params.flag = args.flag;

        const data = await client.get<any[]>(BASE_URLS.statistics, "/api/v1/supplier/orders", params);
        const items = Array.isArray(data) ? data : [];

        return {
          content: [{ type: "text" as const, text: JSON.stringify(items, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    },
  );

  // get_sales
  server.registerTool(
    "get_sales",
    {
      description: "Получить данные о продажах (выкупах). Включает сумму к оплате продавцу. Лимит: 1 запрос в минуту.",
      inputSchema: {
        dateFrom: z.string().describe("Дата начала в формате ISO, например 2024-01-01"),
        flag: z.number().optional().describe("0 — все продажи с указанной даты, 1 — только обновлённые"),
      },
    },
    async (args) => {
      try {
        await client.rateLimiter.waitIfNeeded("statistics", STATISTICS_RATE_LIMIT);

        const params: Record<string, any> = { dateFrom: args.dateFrom };
        if (args.flag !== undefined) params.flag = args.flag;

        const data = await client.get<any[]>(BASE_URLS.statistics, "/api/v1/supplier/sales", params);
        const items = Array.isArray(data) ? data : [];

        return {
          content: [{ type: "text" as const, text: JSON.stringify(items, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    },
  );

  // get_financial_report
  server.registerTool(
    "get_financial_report",
    {
      description: `Детализация отчёта реализации WB: комиссии, логистика, хранение, штрафы, сумма к оплате.
Используй для расчёта реального P&L. Лимит: 1 запрос в минуту.
Денежные поля возвращаются строками (camelCase). Ключевые поля: forPay (сумма к выплате), deliveryService (логистика), paidStorage (хранение), penalty (штрафы), commissionPercent (комиссия WB), retailAmount (розничная выручка), rrdId (ID строки).`,
      inputSchema: {
        dateFrom: z.string().describe("Начало периода, YYYY-MM-DD"),
        dateTo: z.string().describe("Конец периода, YYYY-MM-DD"),
      },
    },
    async (args) => {
      try {
        await client.rateLimiter.waitIfNeeded("finance", STATISTICS_RATE_LIMIT);

        const data = await client.post<any>(
          BASE_URLS.finance,
          "/api/finance/v1/sales-reports/detailed",
          {
            dateFrom: args.dateFrom,
            dateTo: args.dateTo,
          },
        );

        const items = Array.isArray(data) ? data : [];

        return {
          content: [{ type: "text" as const, text: JSON.stringify(items, null, 2) }],
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
