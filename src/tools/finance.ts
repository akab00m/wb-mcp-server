import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WBClient } from "../wb-client.js";
import { BASE_URLS } from "../config.js";
import { formatError } from "../utils/errors.js";

const FINANCE_RATE_LIMIT = 1; // 1 req/min (global per seller)

export function registerFinanceTools(server: McpServer, client: WBClient): void {
  // get_seller_balance
  server.registerTool(
    "get_seller_balance",
    {
      description: "Текущий баланс продавца: доступные средства и сумма к ближайшей выплате. Лимит: 1 запрос в минуту.",
    },
    async () => {
      try {
        await client.rateLimiter.waitIfNeeded("finance", FINANCE_RATE_LIMIT);

        const data = await client.get<any>(BASE_URLS.finance, "/api/v1/account/balance");

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

  // get_sales_reports_summary — список отчётов реализации со сводными суммами
  server.registerTool(
    "get_sales_reports_summary",
    {
      description: `Список финансовых отчётов реализации за период со сводными суммами по каждому.
Намного быстрее get_financial_report для дашборда: даёт forPaySum (к выплате), retailAmountSum (выручка), deliveryServiceSum (логистика), paidStorageSum (хранение), penaltySum (штрафы), deductionSum (вычеты), additionalPaymentSum (доплаты), bankPaymentSum (банковский платёж) — всё уже агрегировано WB по неделям.
Лимит: 1 запрос в минуту (global limiter).`,
      inputSchema: {
        dateFrom: z.string().describe("Начало периода, YYYY-MM-DD"),
        dateTo: z.string().describe("Конец периода, YYYY-MM-DD"),
      },
    },
    async (args) => {
      try {
        await client.rateLimiter.waitIfNeeded("finance", FINANCE_RATE_LIMIT);

        const data = await client.post<any>(
          BASE_URLS.finance,
          "/api/finance/v1/sales-reports/list",
          { dateFrom: args.dateFrom, dateTo: args.dateTo },
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

  // get_acquiring_report_list — сводный отчёт по эквайрингу
  server.registerTool(
    "get_acquiring_report_list",
    {
      description: `Список отчётов по эквайрингу за период (сводные суммы комиссий банка-эквайера).
Эквайринг с апреля 2026 вынесен в отдельный отчёт — раньше был размазан в общем отчёте реализации.
204 No Content = нет данных за период (валидный ответ).
Лимит: 1 запрос в минуту.`,
      inputSchema: {
        dateFrom: z.string().describe("Начало периода, YYYY-MM-DD"),
        dateTo: z.string().describe("Конец периода, YYYY-MM-DD"),
      },
    },
    async (args) => {
      try {
        await client.rateLimiter.waitIfNeeded("finance", FINANCE_RATE_LIMIT);

        const data = await client.post<any>(
          BASE_URLS.finance,
          "/api/finance/v1/acquiring/list",
          { dateFrom: args.dateFrom, dateTo: args.dateTo },
        );

        // 204 → null/{} от handleResponse
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

  // get_acquiring_report — детальный отчёт по эквайрингу
  server.registerTool(
    "get_acquiring_report",
    {
      description: `Детализация отчёта по эквайрингу за период: построчные комиссии банка-эквайера.
Для точного учёта эквайринговых сборов в P&L — отдельной строкой, не смешано с другими комиссиями.
204 No Content = нет данных. Денежные поля — строки (camelCase).
Лимит: 1 запрос в минуту.`,
      inputSchema: {
        dateFrom: z.string().describe("Начало периода, YYYY-MM-DD"),
        dateTo: z.string().describe("Конец периода, YYYY-MM-DD"),
      },
    },
    async (args) => {
      try {
        await client.rateLimiter.waitIfNeeded("finance", FINANCE_RATE_LIMIT);

        const data = await client.post<any>(
          BASE_URLS.finance,
          "/api/finance/v1/acquiring/detailed",
          { dateFrom: args.dateFrom, dateTo: args.dateTo },
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
