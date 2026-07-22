# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single TypeScript product: `wb-mcp-server`, an MCP (Model Context Protocol) server that bridges AI agents to the Wildberries Seller REST API. Default local transport is stdio; Docker image defaults to Streamable HTTP.

### Running / dev
- Start in dev mode: `npm run dev` (runs `tsx src/index.ts`). Production run is `npm run build` then `npm start`. See `package.json` scripts.
- A WB API token is REQUIRED to start: set `WB_API_TOKEN` (see `.env.example`) or pass `--token=<token>`. Without it the process prints a bilingual error and exits 1.
- Default transport is **stdio**. For Docker ↔ model: `MCP_TRANSPORT=http`, `MCP_AUTH_TOKEN=<secret>`, `READ_ONLY=true`, `MCP_ALLOWED_HOSTS=<service-name>` (required when bind is `0.0.0.0`), optional `MCP_SESSION_MAX` / `MCP_SESSION_IDLE_TTL_MS` (defaults 32 / 30min). Stateful sessions: after `initialize` pass `mcp-session-id`. Endpoints `POST|GET|DELETE /mcp`, health `GET /health`.
- Dockerfile defaults: `MCP_TRANSPORT=http`, `READ_ONLY=true`, `MCP_HTTP_HOST=0.0.0.0` — still need `WB_API_TOKEN`, `MCP_AUTH_TOKEN`, `MCP_ALLOWED_HOSTS` at runtime.
- Listing tools should return 35 tools (or 30 with `READ_ONLY=true`).
- Any `callTool` makes a LIVE HTTPS request to `*.wildberries.ru`. With a dummy/invalid token, read tools return a graceful Russian error (`Ошибка WB API (HTTP 401)...`, `isError: true`) — this is expected, not a bug.
- A valid `WB_API_TOKEN` secret is provided in this environment, so read tools (`get_seller_info`, `get_prices`, `get_stocks`, `get_content_cards`, `get_seller_balance`, etc.) return real store data end-to-end. This connects to a REAL production seller account: never call write tools (`reply_feedback`, `reply_question`, `update_prices`, `update_advert_bid`, `create_supply`) unless explicitly intended — they mutate the live store. Also mind the 1 req/min rate limits on the statistics/finance/analytics buckets.

### Test / build / "lint"
- Test: `npm test` (`vitest run`). NOTE: `tests/tools/statistics.test.ts` has 5 PRE-EXISTING failures — those tests still mock `client.get` with old snake_case fields for `get_stocks`/`get_financial_report`, but the code was migrated to `client.post` on new endpoints (see CLAUDE.md v0.3.1). This is a stale-test issue in the repo, unrelated to environment setup; the other tests (including HTTP/auth/read-only) pass.
- Build: `npm run build` (`tsup`, ESM only, emits `dist/index.js` with a node shebang).
- There is no dedicated lint script. The project relies on TypeScript strict mode; use `npx tsc --noEmit` as the type-check/lint gate (currently clean).

### Conventions (see CLAUDE.md for full detail)
- ESM only, TypeScript strict, Node.js 20+.
- Never log or commit the WB token. Tool descriptions and user-facing errors are in Russian.
- The `internal/` folder is intentionally gitignored (via `.git/info/exclude`) and not present in fresh clones.
