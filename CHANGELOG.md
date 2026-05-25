# Changelog

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
