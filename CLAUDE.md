# WB MCP Server — CLAUDE.md

## Project Overview

Open-source MCP (Model Context Protocol) server для доступа AI-агентов к Wildberries Seller API.
Переводит MCP tool calls в REST-запросы к dev.wildberries.ru.

**Goal:** Стать стандартным open-source мостом между AI-агентами и WB API для российских селлеров.

**License:** MIT
**Language:** TypeScript (strict mode)
**Runtime:** Node.js 20+
**Package:** `wb-mcp-server` (npm)

## Architecture

```
MCP Client (Claude Desktop / любой MCP-совместимый агент)
        ↓ MCP Protocol (stdio или SSE)
    wb-mcp-server
        ↓ REST/JSON over HTTPS
    Wildberries Seller API (dev.wildberries.ru)
```

## Tech Stack

- **TypeScript** strict mode, ESM only
- **@modelcontextprotocol/sdk** — MCP server SDK
- **zod** — валидация входных параметров инструментов
- **tsup** — сборка
- **vitest** — тесты
- **tsx** — dev-режим

## Internal folder (gitignored, не для публичного репо)

Все внутренние материалы собраны в `internal/` (игнорируется через `.git/info/exclude` — локально, имена не утекают в публичный `.gitignore`):

- `internal/audit/` — read-only аудиты реальных магазинов (KOSIK и др.) через WB API. Скрипты выгрузки + правила анализа + JSON-дампы + отчёты. Валидация продуктовых гипотез AI-финансиста. См. `internal/audit/README.md`.
- `internal/docs/` — личные материалы (showcase HTML, инструкции).
- `internal/cast_dev/` — интервью customer discovery (содержат PII — НЕ публиковать).
- `internal/TASKS.md`, `internal/VISION.md`, `internal/TZ-*.md` — планы, видение, ТЗ.
- `internal/test-api.mts` — скрипт live-проверки всех MCP-методов на реальном WB API. Запуск: `npx tsx --env-file=.env internal/test-api.mts`.

Также gitignored: `.claude/` (настройки Claude Code), `.env` (токен).

## Project Structure

```
wb-mcp-server/
├── src/
│   ├── index.ts              # Entry point, shebang, запуск сервера
│   ├── server.ts             # WBMCPServer class, регистрация tools
│   ├── config.ts             # BASE_URLS, env vars
│   ├── wb-client.ts          # HTTP-клиент: auth, rate-limit, error handling
│   ├── tools/
│   │   ├── feedbacks.ts      # get_feedbacks, reply_feedback, get_unanswered_count, get_questions, reply_question
│   │   ├── statistics.ts     # get_stocks, get_orders, get_sales, get_financial_report
│   │   ├── analytics.ts      # get_nm_report, get_warehouses_inventory, search_analytics
│   │   ├── finance.ts        # get_seller_balance
│   │   ├── advertising.ts    # get_advert_list, get_advert_stats, get_advert_balance, update_advert_bid
│   │   ├── prices.ts         # get_prices, update_prices
│   │   ├── content.ts        # get_content_cards
│   │   ├── supplies.ts       # get_supplies, create_supply
│   │   └── documents.ts      # get_documents
│   ├── types/
│   │   ├── wb-api.ts         # WB API response/request types
│   │   └── tools.ts          # Tool input/output schemas
│   └── utils/
│       ├── rate-limiter.ts   # Per-endpoint rate limiting
│       ├── pagination.ts     # Cursor-based pagination helper
│       └── errors.ts         # WBApiError, formatError()
├── tests/
│   ├── tools/
│   └── integration/
├── examples/
│   ├── claude-desktop.json
│   └── usage.md
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── .env.example
├── README.md
├── README.ru.md
├── LICENSE
├── CHANGELOG.md
└── CLAUDE.md
```

---

## WB API — Base URLs

```typescript
export const BASE_URLS = {
  feedbacks:  "https://feedbacks-api.wildberries.ru",
  statistics: "https://statistics-api.wildberries.ru",
  analytics:  "https://seller-analytics-api.wildberries.ru",
  advertising:"https://advert-api.wildberries.ru",
  finance:    "https://finance-api.wildberries.ru",
  prices:     "https://discounts-prices-api.wildberries.ru",
  content:    "https://content-api.wildberries.ru",
  marketplace:"https://marketplace-api.wildberries.ru",
  documents:  "https://documents-api.wildberries.ru",
  common:     "https://common-api.wildberries.ru",
  feedbacks_sandbox: "https://feedbacks-api-sandbox.wildberries.ru",
}
```

**Authentication:** заголовок `Authorization: {token}` (без "Bearer").
**Токен:** создаётся в ЛК продавца → Настройки → Доступ к API. Действует 180 дней.
**Цены:** в копейках (делить на 100 для рублей).

---

## MCP Tools — полный реестр (29 инструментов)

### Версионирование:
- **v0.1.0** — реализовано и опубликовано (10 инструментов)
- **v0.2.0** — MVP-блокер для wb-seller-agent (+3 инструмента = 13)
- **v0.3.0** — Phase 2: Ads + Supply агенты (+5 инструментов = 18)
- **v0.3.1** — миграция get_financial_report и get_stocks на новые endpoint'ы WB
- **v0.4.0** — Phase 3: контент, поставки, документы, продавец, аналитика рейтинга, эквайринг (+10 инструментов = 28) ✅ **проверено на живом WB API 2026-05-25**
- **v0.4.2** — get_incomes (+1 = 29)

---

### feedbacks.ts — Отзывы и вопросы

#### get_feedbacks ✅ v0.1.0
```
WB Endpoint: GET https://feedbacks-api.wildberries.ru/api/v1/feedbacks
Токен: Feedbacks
```
Input: isAnswered (bool), take (1-10000, default 50), skip (default 0), order ("dateAsc"|"dateDesc"), nmId (optional)
Returns: Array<{ id, text, productValuation, answer, createdDate, productDetails, userName }>

#### reply_feedback ✅ v0.1.0
```
Description: "⚠️ ОТВЕТИТЬ на отзыв. Отправляет реальный ответ покупателю. Редактировать можно 1 раз в 60 дней."
WB Endpoint: POST https://feedbacks-api.wildberries.ru/api/v1/feedbacks/answer
Токен: Feedbacks
```
Input: id (string), text (string, min 1)
Returns: HTTP 204 No Content при успехе.

#### get_unanswered_count ✅ v0.1.0
```
WB Endpoint: GET https://feedbacks-api.wildberries.ru/api/v1/feedbacks/count-unanswered
Токен: Feedbacks
```
Input: нет. Returns: { count: number }

#### get_questions ✅ v0.1.0
```
WB Endpoint: GET https://feedbacks-api.wildberries.ru/api/v1/questions
Токен: Feedbacks
```
Input: аналогично get_feedbacks

#### reply_question 🔧 v0.2.0
```
Description: "⚠️ ОТВЕТИТЬ на вопрос покупателя. Отправляет реальный ответ."
WB Endpoint: PATCH https://feedbacks-api.wildberries.ru/api/v1/questions
Токен: Feedbacks
```
Input: id (string), text (string, min 1)

---

### statistics.ts — Статистика

#### get_stocks ✅ v0.3.1
```
WB Endpoint: POST https://seller-analytics-api.wildberries.ru/api/analytics/v1/stocks-report/wb-warehouses
Rate limit: 1 req/min. Токен: Analytics
```
Input: limit (default 1000, max 1000), offset (default 0)
Body: { limit, offset }
Returns: { data: { items: [{ nmId, chrtId, warehouseId, warehouseName, regionName, quantity, inWayToClient, inWayFromClient }] } }
Pagination: если получено limit строк — есть ещё, использовать offset += limit.
⚠️ Старый GET /api/v1/supplier/stocks отключён WB 23.06.2026 — мигрировано на новый POST-метод.

#### get_orders ✅ v0.1.0
```
WB Endpoint: GET https://statistics-api.wildberries.ru/api/v1/supplier/orders
Rate limit: 1 req/min. Токен: Statistics
```
Input: dateFrom (ISO), flag (0 = все с даты, 1 = только обновлённые, optional)

#### get_sales ✅ v0.1.0
```
WB Endpoint: GET https://statistics-api.wildberries.ru/api/v1/supplier/sales
Rate limit: 1 req/min. Токен: Statistics
```
Input: аналогично get_orders

#### get_incomes ✅ v0.4.2
```
Description: "Поступления товаров на склады WB (приёмки). По каждому баркоду: номер поставки (incomeId), дата, склад, артикул, nmId, количество, статус. Для сверки приёмок и заказов."
WB Endpoint: GET https://statistics-api.wildberries.ru/api/v1/supplier/incomes
Rate limit: 1 req/min. Токен: Statistics
```
Input: dateFrom (RFC3339)
Returns: массив { incomeId, number, date, lastChangeDate, supplierArticle, techSize, barcode, quantity, totalPrice, dateClose, warehouseName, nmId, status }

#### get_financial_report ✅ v0.3.1
```
Description: "Детализация отчёта реализации: комиссии WB, логистика, хранение, штрафы, сумма к оплате.
Используй для расчёта реального P&L. Лимит: 1 req/min."
WB Endpoint: POST https://finance-api.wildberries.ru/api/finance/v1/sales-reports/detailed
Rate limit: 1 req/min (global limiter per seller). Токен: Finance
```
Input: dateFrom (YYYY-MM-DD), dateTo (YYYY-MM-DD)
Body: { dateFrom, dateTo }
Returns: массив строк. Поля в camelCase, денежные значения — строки.
Ключевые поля: forPay (сумма к выплате), deliveryService (логистика), paidStorage (хранение), penalty (штрафы), commissionPercent (комиссия WB), retailAmount (розничная выручка), rrdId (ID строки).
⚠️ Старый GET /api/v5/supplier/reportDetailByPeriod отключён WB 15.07.2026 — мигрировано на новый POST-метод (snake_case → camelCase, деньги стали строками).

---

### analytics.ts — Аналитика

#### get_nm_report ✅ v0.1.0
```
WB Endpoint: POST https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products
Токен: Analytics
```
Input: beginDate (ISO), endDate (ISO), page (default 1), nmIds (optional)
Body: { selectedPeriod: { start, end }, pageNumber, pageSize, nmIds? }
Returns: { data: { products: [{ product: { nmId, title, brandName, ... }, statistic: { selected: { openCount, cartCount, orderCount, buyoutCount, orderSum, ... } } }] } }

#### get_warehouses_inventory ✅ v0.3.0
```
Description: "Актуальный отчёт по остаткам. Точнее get_stocks для оперативного управления.
Асинхронный: создать задачу → polling статуса → скачать результат."
WB Endpoint (создать): GET https://seller-analytics-api.wildberries.ru/api/v1/warehouse_remains
WB Endpoint (статус):  GET https://seller-analytics-api.wildberries.ru/api/v1/warehouse_remains/tasks/{task_id}/status
WB Endpoint (скачать): GET https://seller-analytics-api.wildberries.ru/api/v1/warehouse_remains/tasks/{task_id}/download
Токен: Analytics
```
Input: нет обязательных (groupByBrand/Subject/Nm/Barcode/Size, filterPics, filterVolume — опциональные).
Реализация: создать → polling каждые 5 сек, макс 60 сек → скачать. Taskstatus → "done" обычно за 5 сек.

#### get_item_rating ✅ v0.4.0
```
Description: "Рейтинг продавца + прирост отзывов за период по звёздам (5★/4★/3★/2★/1★) + по товарам."
WB Endpoint: POST https://seller-analytics-api.wildberries.ru/api/analytics/v1/item-rating
Токен: Analytics
```
Input: beginDate (YYYY-MM-DD), endDate (YYYY-MM-DD, не сегодня!), orderField ("feedbackRating"), orderMode ("asc"|"desc"), limit, offset
Body: { currentPeriod: { start, end }, orderBy: { field, mode }, offset, limit }
Returns: { sellerRating: { current }, feedbackIncrease: { current, total, dynamics, fiveStar/fourStar/threeStar/twoStar/oneStar: { current, total } }, items: [...] }

#### search_analytics ⏳ deferred
```
Description: "⚠️ ТРЕБУЕТ подписку «Джем». Endpoint в release notes есть, но текущий путь /api/v2/analytics/search-report возвращает 404 — нужно дополнительное исследование, отложено."
```

---

### finance.ts — Финансы

#### get_seller_balance 🔧 v0.2.0
```
WB Endpoint: GET https://finance-api.wildberries.ru/api/v1/account/balance
Rate limit: 1 req/min. Токен: Finance
```
Input: нет.
Returns: { currency: string, current: number, for_withdraw: number }

#### get_sales_reports_summary ✅ v0.4.0
```
Description: "Сводные финансовые отчёты реализации за период (для быстрого дашборда)."
WB Endpoint: POST https://finance-api.wildberries.ru/api/finance/v1/sales-reports/list
Rate limit: 1 req/min (global per seller). Токен: Finance
```
Input: dateFrom (YYYY-MM-DD), dateTo (YYYY-MM-DD)
Body: { dateFrom, dateTo }
Returns: массив { reportId, sellerFinanceName, dateFrom, dateTo, createDate, currency, reportType, retailAmountSum (string), forPaySum (string), deliveryServiceSum (string), paidStorageSum (string), penaltySum (string), deductionSum (string), additionalPaymentSum (string), bankPaymentSum (string), ... }
Назначение: агрегаты по неделям — гораздо быстрее, чем агрегировать тысячи строк из get_financial_report.

#### get_acquiring_report_list ✅ v0.4.0
```
WB Endpoint: POST https://finance-api.wildberries.ru/api/finance/v1/acquiring/list
Rate limit: 1 req/min. Токен: Finance
```
Input: dateFrom, dateTo. 204 = нет данных за период.
Returns: список отчётов по эквайрингу (с апреля 2026 эквайринг вынесен в отдельный отчёт).

#### get_acquiring_report ✅ v0.4.0
```
WB Endpoint: POST https://finance-api.wildberries.ru/api/finance/v1/acquiring/detailed
Rate limit: 1 req/min. Токен: Finance
```
Input: dateFrom, dateTo. 204 = нет данных.
Returns: построчные комиссии банка-эквайера. Денежные поля — строки (camelCase). Для точного P&L отдельной строкой.

---

### advertising.ts — Реклама

#### get_advert_list ✅ v0.1.0
```
WB Endpoint: POST https://advert-api.wildberries.ru/adv/v1/promotion/count
Токен: Promotion
```
Input: нет.
Returns: массив { type, status, count, advert_list: [{ advertId, changeTime }] }

#### get_advert_stats ✅ v0.1.0
```
WB Endpoint: POST https://advert-api.wildberries.ru/adv/v0/normquery/stats
Токен: Promotion
```
Input: from (YYYY-MM-DD), to (YYYY-MM-DD), items: array<{ advert_id: number, nm_id: number }>
Returns: { stats: {...} | null } — статистика по поисковым кластерам (показы, клики, CTR, CPC, CPM, заказы).

#### get_advert_balance ✅ v0.3.0
```
WB Endpoint: GET https://advert-api.wildberries.ru/adv/v1/balance
Токен: Promotion
```
Input: нет.
Returns: { balance: number, net: number, bonus: number }

#### update_advert_bid ✅ v0.3.0
```
Description: "⚠️ ИЗМЕНИТЬ ставку в кампании. Немедленно влияет на показы и расход бюджета.
Только для кампаний в статусах 4, 9, 11."
WB Endpoint: PATCH https://advert-api.wildberries.ru/api/advert/v1/bids
Токен: Promotion
```
Input: advertId (number), type (number), bids: array<{ nm: number, price: number }>

---

### prices.ts — Цены

#### get_prices ✅ v0.3.0
```
WB Endpoint: GET https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter
Токен: Prices
```
Input: limit (default 1000, max 1000), offset (default 0), filterNmID (optional)
Returns: array<{ nmID, vendorCode, sizes: [{ price, discountedPrice, discount }] }>

#### update_prices ✅ v0.3.0
```
Description: "⚠️ ИЗМЕНИТЬ цены и/или скидки. Изменения немедленно вступают в силу на WB."
WB Endpoint: POST https://discounts-prices-api.wildberries.ru/api/v2/upload/task
Токен: Prices
```
Input: data: array<{ nmID: number, price: number (в рублях), discount: number (0-99%) }>

---

### content.ts — Контент карточек

#### get_content_cards ✅ v0.4.0
```
WB Endpoint: POST https://content-api.wildberries.ru/content/v2/get/cards/list
Токен: Content
```
Input: limit (default 100, max 100), cursorUpdatedAt (опц.), cursorNmID (опц.), withPhoto (-1/0/1, опц.), textSearch (опц.)
Body: { settings: { cursor: { limit, updatedAt?, nmID? }, filter: { withPhoto?, textSearch? } } }
Returns: { cards: [{ nmID, imtID, vendorCode, subjectID, subjectName, brand, title, description, sizes, characteristics, ... }], cursor: {...} }
Pagination: курсорная — передавай cursor.updatedAt и cursor.nmID из предыдущего ответа.

---

### supplies.ts — Поставки FBS

#### get_supplies ✅ v0.4.0
```
WB Endpoint: GET https://marketplace-api.wildberries.ru/api/v3/supplies
Токен: Marketplace
```
Input: limit (default 1000, max 1000), next (cursor, default 0)
Returns: { supplies: [{ id ("WB-GI-..."), name, createdAt, closedAt, scanDt, rejectDt, destinationOfficeId, cargoType, done }], next }

#### create_supply ✅ v0.4.0
```
Description: "⚠️ СОЗДАТЬ новую открытую поставку FBS. Реальная поставка в ЛК WB."
WB Endpoint: POST https://marketplace-api.wildberries.ru/api/v3/supplies
Токен: Marketplace
```
Input: name (string, 1-128 символов)
Returns: { id: "WB-GI-..." }

---

### seller.ts — Информация о продавце (v0.4.0)

#### get_seller_info ✅ v0.4.0
```
WB Endpoint: GET https://common-api.wildberries.ru/api/v1/seller-info
Токен: любой
```
Input: нет.
Returns: { name, sid, tin, tradeMark }

#### get_jam_subscription ✅ v0.4.0
```
Description: "⚠️ Требует SERVICE token. Personal token вернёт 403."
WB Endpoint: GET https://common-api.wildberries.ru/api/common/v1/subscriptions
Токен: Service
```
Input: нет.
Returns: информация о подписке Jam (даты, уровень) — открывает доступ к поисковой аналитике.

---

### documents.ts — Документы

#### get_documents ✅ v0.4.0
```
WB Endpoint: GET https://documents-api.wildberries.ru/api/v1/documents/list
Токен: Documents
```
Input: locale ("ru"/"en"/"zh", default "ru"), beginTime (опц.), endTime (опц.), sort ("date"|"category", опц.), order ("asc"|"desc", опц., sort и order — оба или ни одного), category (опц.)
Returns: массив { serviceName, name, category, extensions, creationTime, viewed }
Скачивание: через отдельный endpoint /api/v1/documents/download?serviceName=...

---

## Coding Standards

- TypeScript strict mode, ESM only
- zod для валидации ВСЕХ входных параметров
- Описания инструментов на русском
- "⚠️ ВНИМАНИЕ" в описании всех write-операций
- "⚠️ ТРЕБУЕТ подписку «Джем»" для search_analytics
- JSDoc на всех публичных функциях
- WB API ошибки → человекочитаемые сообщения на русском
- Rate limiting через rate-limiter.ts (statistics, finance — 1 req/min)
- Unit тесты для каждого инструмента

## Important Conventions

- README.ru.md — PRIMARY. README.md — английский.
- Semantic versioning: v0.1.0 → v0.2.0 → v0.3.0 → v0.4.0
- Имена инструментов в snake_case
- Ошибки пользователю — на русском
- Никогда не логировать WB-токен

## What NOT to do

- Не использовать эндпоинты не из документации dev.wildberries.ru
- Не хранить и не логировать WB API токен
- Не делать write-операции без явного предупреждения в описании
- Не хардкодить URL — только через BASE_URLS
- Не игнорировать rate limits — exponential backoff обязателен
- Не использовать CommonJS — только ESM
