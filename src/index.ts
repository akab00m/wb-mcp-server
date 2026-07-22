import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadConfig } from "./config.js";
import { WBMCPServer } from "./server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(__dirname, "..", "package.json"), "utf-8"),
    );
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `Ошибка: ${message}\n\n` +
        `Установите WB_API_TOKEN или --token=<токен>.\n` +
        `Для HTTP: MCP_TRANSPORT=http, MCP_AUTH_TOKEN=<секрет>.\n` +
        `При MCP_HTTP_HOST=0.0.0.0 обязателен MCP_ALLOWED_HOSTS=<имя-сервиса>.\n` +
        `Опционально: READ_ONLY=true, MCP_HTTP_PORT=3000\n\n` +
        `Error: ${message}\n` +
        `Set WB_API_TOKEN or --token=<token>.\n` +
        `For HTTP: MCP_TRANSPORT=http, MCP_AUTH_TOKEN=<secret>.\n` +
        `When MCP_HTTP_HOST=0.0.0.0, MCP_ALLOWED_HOSTS=<service-name> is required.\n` +
        `Optional: READ_ONLY=true, MCP_HTTP_PORT=3000\n`,
    );
    process.exit(1);
  }

  const version = getVersion();
  const server = new WBMCPServer(config.token, version, {
    readOnly: config.readOnly,
  });
  await server.start(config);
}

main().catch((error) => {
  process.stderr.write(`Критическая ошибка: ${error}\n`);
  process.exit(1);
});
