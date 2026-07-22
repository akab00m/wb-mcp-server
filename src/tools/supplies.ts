import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WBClient } from "../wb-client.js";
import { BASE_URLS } from "../config.js";
import { formatError } from "../utils/errors.js";
import type { ToolRegistrationOptions } from "../types/options.js";

export function registerSuppliesTools(
  server: McpServer,
  client: WBClient,
  options: ToolRegistrationOptions = {},
): void {
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

  // create_supply (write)
  if (!options.readOnly) {
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

  // get_fbw_supplies — список поставок FBW (на склад WB)
  server.registerTool(
    "get_fbw_supplies",
    {
      description: `Список поставок FBW (на склады WB). Возвращает: supplyID (числовой ID поставки, напр. 38419461), preorderID, statusID, boxTypeID, createDate, supplyDate (плановая дата), factDate (фактическая приёмка), updatedDate.
statusID: 1=черновик, 5=принята.
Это НЕ то же самое, что get_supplies (FBS-поставки маркетплейса). Используй именно этот метод, если у клиента поставки на склад WB вида 38047342, 38744380 и т.п.`,
      inputSchema: {
        limit: z.number().min(1).max(1000).default(50).describe("Размер страницы (1-1000)"),
        offset: z.number().min(0).default(0).describe("Смещение для пагинации"),
      },
    },
    async (args) => {
      try {
        const data = await client.post<any>(
          BASE_URLS.supplies,
          "/api/v1/supplies",
          { limit: args.limit, offset: args.offset },
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

  // get_fbw_supply — детали одной FBW-поставки
  server.registerTool(
    "get_fbw_supply",
    {
      description: `Детали одной FBW-поставки по supplyID. Возвращает: warehouseName/actualWarehouseName (склад приёмки), supplyDate, factDate, quantity (заявленное), acceptedQuantity (фактически принято), readyForSaleQuantity, depersonalizedQuantity (обезличено), rejectReason, supplierAssignName, acceptanceCost (стоимость платной приёмки), paidAcceptanceCoefficient.
Если acceptedQuantity < quantity — есть расхождение, имеет смысл сверять состав через get_fbw_supply_goods.`,
      inputSchema: {
        supplyID: z.number().describe("Числовой ID поставки FBW (из get_fbw_supplies, поле supplyID)"),
      },
    },
    async (args) => {
      try {
        const data = await client.get<any>(
          BASE_URLS.supplies,
          `/api/v1/supplies/${args.supplyID}`,
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

  // get_fbw_supply_goods — состав поставки по баркодам (ГЛАВНОЕ для сверки приёмки)
  server.registerTool(
    "get_fbw_supply_goods",
    {
      description: `Состав FBW-поставки по баркодам. Главный метод для сверки акта приёмки с табличкой клиента.
По каждой позиции возвращает: barcode, vendorCode (артикул продавца), nmID (артикул WB), techSize, color, tnved, needKiz (требуется ли маркировка), supplierBoxAmount (заявлено в коробе), quantity (заявлено всего), acceptedQuantity (фактически принято), readyForSaleQuantity (готово к продаже), unloadingQuantity (выгрузка/брак).
Расхождение приёмки: если quantity > acceptedQuantity — часть не приняли.`,
      inputSchema: {
        supplyID: z.number().describe("Числовой ID поставки FBW (из get_fbw_supplies)"),
      },
    },
    async (args) => {
      try {
        const data = await client.get<any>(
          BASE_URLS.supplies,
          `/api/v1/supplies/${args.supplyID}/goods`,
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

  // get_fbw_supply_package — раскладка по коробам
  server.registerTool(
    "get_fbw_supply_package",
    {
      description: `Раскладка FBW-поставки по коробам. По каждому коробу: packageCode (напр. WB_1569700847), quantity (всего в коробе), barcodes (массив { barcode, quantity }).
Полезно когда нужно понять, в каком коробе пришёл конкретный баркод, или при разборе расхождений по конкретному коробу.`,
      inputSchema: {
        supplyID: z.number().describe("Числовой ID поставки FBW (из get_fbw_supplies)"),
      },
    },
    async (args) => {
      try {
        const data = await client.get<any>(
          BASE_URLS.supplies,
          `/api/v1/supplies/${args.supplyID}/package`,
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

  // get_wb_warehouses — справочник складов WB
  server.registerTool(
    "get_wb_warehouses",
    {
      description: `Справочник складов WB для FBW-поставок. По каждому складу: ID, name, address, workTime. Полезно для понимания, куда можно отправлять поставки, и для сопоставления warehouseID из get_fbw_supply с человеческим названием.`,
    },
    async () => {
      try {
        const data = await client.get<any>(BASE_URLS.supplies, "/api/v1/warehouses");

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
