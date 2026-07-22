# Changelog

## 0.5.0 (2026-07-22)

### Features

- **HTTP transport (Streamable HTTP, stateful)** — `MCP_TRANSPORT=http` для Docker / контейнер↔контейнер. Endpoint `POST|GET|DELETE /mcp`, healthcheck `GET /health`. Сессии через `mcp-session-id`.
- **Bearer auth** — в HTTP-режиме обязателен `MCP_AUTH_TOKEN` (`Authorization: Bearer …`). Без токена процесс не стартует.
- **READ_ONLY** — `READ_ONLY=true` / `--read-only` не регистрирует write-tools: `reply_feedback`, `reply_question`, `update_prices`, `update_advert_bid`, `create_supply` (35 → 30 tools).
- **Allowlist хостов WB** — `WBClient` отклоняет запросы не на `*.wildberries.ru` из `BASE_URLS` и абсолютные URL в path.
- **Docker Host guard** — при bind ≠ loopback обязателен `MCP_ALLOWED_HOSTS` (иначе DNS-rebinding middleware даёт 403 на имя сервиса).
- **Session limits** — `MCP_SESSION_IDLE_TTL_MS` (default 30 мин) + `MCP_SESSION_MAX` (default 32). Idle сессии закрываются; при лимите новый `initialize` → 503.
- **Docker** — `Dockerfile` (ENV по умолчанию: http + read-only) + `examples/docker-compose.yml`.

### Notes

- Stdio остаётся транспортом по умолчанию вне Docker-образа (обратная совместимость с Claude Desktop).
- Docker-образ задаёт `MCP_TRANSPORT=http` + `READ_ONLY=true` + `MCP_HTTP_HOST=0.0.0.0` — на runtime обязательны `WB_API_TOKEN`, `MCP_AUTH_TOKEN`, `MCP_ALLOWED_HOSTS`.
- Default `MCP_HTTP_HOST=0.0.0.0` в коде: локальный HTTP без allowlist — передайте `--host=127.0.0.1`.
- Рекомендуется read-only WB API token + `READ_ONLY=true` для HTTP-деплоя.

## 0.4.3 (2026-06-22)

### Removed (1)

- **get_incomes** — endpoint `GET /api/v1/supplier/incomes` отключён WB без замены. Перепроверено 11 альтернативных путей (v2/v3, разные хосты) — все 404, при этом соседние `orders`/`sales` на том же хосте и токене работают. Метод удалён, для сверки приёмки используйте новые FBW-методы (`get_fbw_supply_goods`).

### Features — 7 новых инструментов (29 → 35)

**FBW-поставки (на склады WB) — закрывают задачу сверки приёмки по баркодам:**
- **get_fbw_supplies** — `POST https://supplies-api.wildberries.ru/api/v1/supplies`. Список поставок FBW с числовыми ID (например 38419461).
- **get_fbw_supply** — `GET .../api/v1/supplies/{supplyID}`. Детали поставки: склад, дата приёмки, заявлено/принято.
- **get_fbw_supply_goods** — `GET .../api/v1/supplies/{supplyID}/goods`. **Главный метод для сверки.** Состав поставки по баркодам: vendorCode, nmID, techSize, color, quantity, acceptedQuantity.
- **get_fbw_supply_package** — `GET .../api/v1/supplies/{supplyID}/package`. Раскладка по коробам (packageCode + баркоды в каждом коробе).
- **get_wb_warehouses** — `GET .../api/v1/warehouses`. Справочник складов WB (ID, name, address, workTime).

**Платная приёмка и коэффициенты:**
- **get_paid_acceptance_report** — `GET https://seller-analytics-api.wildberries.ru/api/v1/acceptance_report` (async: create → polling → download). Отчёт о расходах на платную приёмку за период.
- **get_acceptance_coefficients** — `GET https://common-api.wildberries.ru/api/tariffs/v1/acceptance/coefficients`. Коэффициенты приёмки складов на 14 дней (0 — бесплатно, 1+ — платная, -1 — приёмки нет).

### Notes

- Добавлен новый host в `BASE_URLS.supplies = "https://supplies-api.wildberries.ru"`.
- Все 7 новых endpoints проверены на живом WB API 2026-06-22.

## 0.4.2 (2026-06-19)

### Features — 1 новый инструмент (28 → 29)

**Statistics:**
- **get_incomes** — `GET /api/v1/supplier/incomes` (Statistics API). Поступления товаров на склады WB (приёмки). По каждому баркоду возвращает: номер поставки (incomeId), дату, дату изменения, склад, артикул продавца, nmId, баркод, количество, сумму, дату закрытия поставки, статус. Для сверки приёмок с заказами. Rate limit: 1 req/min.

## 0.4.1 (2026-05-25)

### Docs

- README: блок с информацией об авторе (Дмитрий Косик) и Telegram-каналом (@dmkosik) вверху страницы — на GitHub и npm.
- README: расширены примеры использования для новых v0.4.0 методов (рейтинг продавца, сводный финотчёт, документы, эквайринг, карточки, поставки).
- Никаких изменений в коде, чистый docs-релиз для обновления страницы пакета на npmjs.com.

## 0.4.0 (2026-05-25)

### Features — 10 новых инструментов (18 → 28)

**Finance (для P&L и дашборда):**
- **get_sales_reports_summary** — `POST /api/finance/v1/sales-reports/list`. Сводные суммы по неделям (forPaySum, retailAmountSum, deliveryServiceSum, paidStorageSum, penaltySum, deductionSum). Быстрее, чем агрегировать строки из get_financial_report.
- **get_acquiring_report_list** — `POST /api/finance/v1/acquiring/list`. Сводные отчёты по эквайрингу (новый раздел WB с апреля 2026).
- **get_acquiring_report** — `POST /api/finance/v1/acquiring/detailed`. Построчные комиссии банка-эквайера для точного учёта.

**Analytics:**
- **get_item_rating** — `POST /api/analytics/v1/item-rating`. Рейтинг продавца + прирост отзывов по звёздам.

**Seller info (новый файл seller.ts):**
- **get_seller_info** — `GET /api/v1/seller-info`. Имя, ИНН, торговая марка.
- **get_jam_subscription** — `GET /api/common/v1/subscriptions`. Подписка Jam. ⚠ Требует Service token.

**Контент (новый файл content.ts):**
- **get_content_cards** — `POST /content/v2/get/cards/list`. Карточки товаров с курсорной пагинацией.

**Поставки FBS (новый файл supplies.ts):**
- **get_supplies** — `GET /api/v3/supplies`. Список поставок.
- **create_supply** — `POST /api/v3/supplies`. ⚠ Write-операция: создаёт реальную поставку.

**Документы (новый файл documents.ts):**
- **get_documents** — `GET /api/v1/documents/list`. УПД, отчёты реализации, акты, уведомления о выкупе.

### Notes

- Все 9 READ-методов проверены на живом WB API 2026-05-25.
- `search_analytics` отложен — endpoint `/api/v2/analytics/search-report` отдаёт 404, нужно дополнительное исследование.
- Добавлен новый домен `common-api.wildberries.ru` в BASE_URLS.

## 0.3.1 (2026-05-14)

### API compatibility — миграция устаревающих endpoint'ов WB

- **get_financial_report** — мигрирован с `GET /api/v5/supplier/reportDetailByPeriod` на `POST /api/finance/v1/sales-reports/detailed` (старый endpoint отключается WB 15.07.2026). Поля ответа теперь в camelCase, денежные значения — строки. Input: `dateFrom`, `dateTo` (YYYY-MM-DD).
- **get_stocks** — мигрирован с `GET /api/v1/supplier/stocks` на `POST /api/analytics/v1/stocks-report/wb-warehouses` (старый endpoint отключается WB 23.06.2026). Возвращает остатки с разбивкой по складам и регионам. Input: `limit`, `offset` (вместо `dateFrom`).

### Notes

- Все 18 инструментов проверены на живом WB API 2026-05-14.
- Документация endpoint'ов в CLAUDE.md синхронизирована с актуальным WB API.

## 0.3.0 (2026-04-14)

### Features

- **get_warehouses_inventory** — актуальный отчёт по остаткам на складах (асинхронный: создание задачи + polling статуса + скачивание)
- **get_advert_balance** — баланс рекламного кабинета
- **update_advert_bid** — изменение ставок в рекламной кампании (⚠️ write-операция)
- **get_prices** — список товаров с ценами и скидками
- **update_prices** — обновление цен и скидок (⚠️ write-операция)

### Notes

- Всего 18 инструментов из 22 запланированных.
- Новый модуль `src/tools/prices.ts`.

## 0.2.0 (2026-03-31)

### Features

- **get_questions** — получение списка вопросов покупателей
- **reply_question** — ответ на вопрос покупателя (⚠️ write-операция)
- **get_financial_report** — детализация отчёта реализации WB (комиссии, логистика, хранение, штрафы)
- **get_seller_balance** — текущий баланс продавца

### Refactoring

- Разделение `analytics.ts` → `statistics.ts` (stocks, orders, sales) + `analytics.ts` (nm_report)
- Добавлен `finance.ts` для финансовых инструментов
- Исправлены BASE_URLS: добавлен `finance`, исправлен `documents`
- Исправлена конфигурация vitest для стабильного запуска тестов

## 0.1.0 (2026-03-24)

### Features

- MCP server with stdio transport
- WB API client with authentication, error handling, and rate limiting
- **Feedback tools:** get_feedbacks, reply_feedback, get_unanswered_count
- **Analytics tools:** get_stocks, get_orders, get_sales, get_nm_report
- **Advertising tools:** get_advert_list, get_advert_stats
- Claude Desktop configuration example
