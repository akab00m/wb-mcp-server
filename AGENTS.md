# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single TypeScript product: `wb-mcp-server`, an MCP (Model Context Protocol) server that bridges AI agents to the Wildberries Seller REST API. It runs as a stdio server — there is no web UI or HTTP port to open.

### Running / dev
- Start in dev mode: `npm run dev` (runs `tsx src/index.ts`). Production run is `npm run build` then `npm start`. See `package.json` scripts.
- A WB API token is REQUIRED to start: set `WB_API_TOKEN` (see `.env.example`) or pass `--token=<token>`. Without it the process prints a bilingual error and exits 1.
- The server communicates over stdio (JSON-RPC), so you cannot "just open a page". To exercise it, spawn it from an MCP client (e.g. `@modelcontextprotocol/sdk` `Client` + `StdioClientTransport`) and call `listTools` / `callTool`. Listing tools should return 35 tools.
- Any `callTool` makes a LIVE HTTPS request to `*.wildberries.ru`. With a dummy/invalid token, read tools return a graceful Russian error (`Ошибка WB API (HTTP 401)...`, `isError: true`) — this is expected, not a bug. Real data requires a valid seller token, and write tools (`reply_feedback`, `update_prices`, `update_advert_bid`, `create_supply`, etc.) mutate the real store, so avoid calling them without intent.

### Test / build / "lint"
- Test: `npm test` (`vitest run`). NOTE: `tests/tools/statistics.test.ts` has 5 PRE-EXISTING failures — those tests still mock `client.get` with old snake_case fields for `get_stocks`/`get_financial_report`, but the code was migrated to `client.post` on new endpoints (see CLAUDE.md v0.3.1). This is a stale-test issue in the repo, unrelated to environment setup; the other 21 tests pass.
- Build: `npm run build` (`tsup`, ESM only, emits `dist/index.js` with a node shebang).
- There is no dedicated lint script. The project relies on TypeScript strict mode; use `npx tsc --noEmit` as the type-check/lint gate (currently clean).

### Conventions (see CLAUDE.md for full detail)
- ESM only, TypeScript strict, Node.js 20+.
- Never log or commit the WB token. Tool descriptions and user-facing errors are in Russian.
- The `internal/` folder is intentionally gitignored (via `.git/info/exclude`) and not present in fresh clones.
