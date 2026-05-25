import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WBClient } from "../wb-client.js";
import { BASE_URLS } from "../config.js";
import { formatError } from "../utils/errors.js";

export function registerAnalyticsTools(server: McpServer, client: WBClient): void {
  // get_warehouses_inventory
  server.registerTool(
    "get_warehouses_inventory",
    {
      description: `Актуальный отчёт по остаткам на складах WB — точнее чем get_stocks для оперативного управления.
Асинхронный: создаёт задачу → ожидает готовности → скачивает результат. Может занять до 60 секунд.
Возвращает массив строк: артикул, размер, баркод, предмет, бренд, количество по складам.`,
      inputSchema: {
        locale: z.string().default("ru").describe("Локаль: ru/en/zh"),
        groupByBrand: z.boolean().default(false).describe("Группировать по бренду"),
        groupBySubject: z.boolean().default(false).describe("Группировать по предмету"),
        groupBySa: z.boolean().default(false).describe("Группировать по артикулу продавца"),
        groupByNm: z.boolean().default(false).describe("Группировать по артикулу WB"),
        groupByBarcode: z.boolean().default(false).describe("Группировать по баркоду"),
        groupBySize: z.boolean().default(false).describe("Группировать по размеру"),
        filterPics: z.number().default(0).describe("0 — все товары, 1 — с фото, -1 — без фото"),
        filterVolume: z.number().default(0).describe("0 — все, 1 — объёмные, -1 — необъёмные"),
      },
    },
    async (args) => {
      try {
        const created = await client.get<any>(
          BASE_URLS.analytics,
          "/api/v1/warehouse_remains",
          {
            locale: args.locale,
            groupByBrand: args.groupByBrand,
            groupBySubject: args.groupBySubject,
            groupBySa: args.groupBySa,
            groupByNm: args.groupByNm,
            groupByBarcode: args.groupByBarcode,
            groupBySize: args.groupBySize,
            filterPics: args.filterPics,
            filterVolume: args.filterVolume,
          },
        );

        const taskId: string | undefined = created?.data?.taskId ?? created?.taskId;
        if (!taskId) {
          return {
            content: [{ type: "text" as const, text: `Не удалось получить taskId из ответа WB: ${JSON.stringify(created)}` }],
            isError: true,
          };
        }

        // Polling: каждые 5 сек, макс 12 попыток (60 сек)
        const maxAttempts = 12;
        const intervalMs = 5000;
        let status = "";

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          await new Promise((r) => setTimeout(r, intervalMs));
          const statusResp = await client.get<any>(
            BASE_URLS.analytics,
            `/api/v1/warehouse_remains/tasks/${taskId}/status`,
          );
          status = statusResp?.data?.status ?? statusResp?.status ?? "";
          if (status === "done") break;
          if (status === "canceled" || status === "purged") {
            return {
              content: [{ type: "text" as const, text: `Задача завершилась со статусом: ${status}` }],
              isError: true,
            };
          }
        }

        if (status !== "done") {
          return {
            content: [{ type: "text" as const, text: `Задача не готова за 60 секунд (последний статус: ${status}). Попробуйте позже.` }],
            isError: true,
          };
        }

        const result = await client.get<any>(
          BASE_URLS.analytics,
          `/api/v1/warehouse_remains/tasks/${taskId}/download`,
        );

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    },
  );

  // get_item_rating
  server.registerTool(
    "get_item_rating",
    {
      description: `Отчёт по рейтингу: общий рейтинг продавца (sellerRating.current) + прирост отзывов за период с разбивкой по звёздам (fiveStar, fourStar, threeStar, twoStar, oneStar) + детали по каждому товару.
Используй для мониторинга качества: видишь не только общий рейтинг, но и динамику отзывов 1-2 звезды (сигнал к разбору проблемных товаров).
⚠️ Дата end не может быть сегодня — используй вчерашнюю дату или раньше.`,
      inputSchema: {
        beginDate: z.string().describe("Начало периода, YYYY-MM-DD"),
        endDate: z.string().describe("Конец периода, YYYY-MM-DD (не должно быть сегодня)"),
        orderField: z.enum(["feedbackRating"]).default("feedbackRating").describe("Поле сортировки"),
        orderMode: z.enum(["asc", "desc"]).default("desc").describe("Направление сортировки"),
        limit: z.number().min(1).max(1000).default(100).describe("Макс товаров в ответе"),
        offset: z.number().min(0).default(0).describe("Смещение для пагинации"),
      },
    },
    async (args) => {
      try {
        const data = await client.post<any>(
          BASE_URLS.analytics,
          "/api/analytics/v1/item-rating",
          {
            currentPeriod: { start: args.beginDate, end: args.endDate },
            orderBy: { field: args.orderField, mode: args.orderMode },
            offset: args.offset,
            limit: args.limit,
          },
        );

        return {
          content: [{ type: "text" as const, text: JSON.stringify(data?.data ?? data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    },
  );

  // get_nm_report
  server.registerTool(
    "get_nm_report",
    {
      description: "Детальный отчёт по товарам: просмотры карточки, добавления в корзину, заказы, выкупы, конверсии. Данные за указанный период. Лимит: 3 запроса в минуту.",
      inputSchema: {
        beginDate: z.string().describe("Начало периода, ISO, например 2024-01-01"),
        endDate: z.string().describe("Конец периода, ISO, например 2024-01-31"),
        page: z.number().default(1).describe("Номер страницы"),
        nmIds: z.array(z.number()).optional().describe("Фильтр по артикулам WB (необязательно)"),
      },
    },
    async (args) => {
      try {
        const body: Record<string, any> = {
          selectedPeriod: {
            start: args.beginDate,
            end: args.endDate,
          },
          pageNumber: args.page,
          pageSize: 100,
        };
        if (args.nmIds && args.nmIds.length > 0) {
          body.nmIds = args.nmIds;
        }

        const data = await client.post<any>(BASE_URLS.analytics, "/api/analytics/v3/sales-funnel/products", body);

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
