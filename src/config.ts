export const BASE_URLS = {
  content: "https://content-api.wildberries.ru",
  marketplace: "https://marketplace-api.wildberries.ru",
  supplies: "https://supplies-api.wildberries.ru",
  statistics: "https://statistics-api.wildberries.ru",
  advertising: "https://advert-api.wildberries.ru",
  feedbacks: "https://feedbacks-api.wildberries.ru",
  analytics: "https://seller-analytics-api.wildberries.ru",
  prices: "https://discounts-prices-api.wildberries.ru",
  finance: "https://finance-api.wildberries.ru",
  documents: "https://documents-api.wildberries.ru",
  common: "https://common-api.wildberries.ru",
  feedbacksSandbox: "https://feedbacks-api-sandbox.wildberries.ru",
} as const;

export type BaseUrlKey = keyof typeof BASE_URLS;

/** Hostnames allowed for outbound WB API calls (defense in depth). */
export const ALLOWED_WB_HOSTS: readonly string[] = Object.freeze(
  [...new Set(Object.values(BASE_URLS).map((url) => new URL(url).hostname))],
);

export type TransportMode = "stdio" | "http";

export interface ServerConfig {
  token: string;
  transport: TransportMode;
  readOnly: boolean;
  http: {
    host: string;
    port: number;
    path: string;
    authToken: string;
    allowedHosts: string[];
    /** Close sessions with no requests for this long (ms). 0 disables idle TTL. */
    sessionIdleTtlMs: number;
    /** Max concurrent MCP sessions. New initialize → 503 when full (after idle sweep). */
    sessionMax: number;
  };
}

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const v = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return defaultValue;
}

function parsePort(value: string | undefined, defaultPort: number): number {
  if (!value) return defaultPort;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`Некорректный порт: ${value}`);
  }
  return n;
}

function parsePositiveInt(
  value: string | undefined,
  defaultValue: number,
  label: string,
  opts?: { min?: number; allowZero?: boolean },
): number {
  if (!value) return defaultValue;
  const n = Number(value);
  const min = opts?.min ?? (opts?.allowZero ? 0 : 1);
  if (!Number.isInteger(n) || n < min) {
    throw new Error(`Некорректное значение ${label}: ${value}`);
  }
  return n;
}

/**
 * Resolve WB API token from CLI or env. Never log the value.
 */
export function getToken(): string | undefined {
  return getArg("token") ?? process.env.WB_API_TOKEN;
}

/**
 * Load full server config from argv + env.
 * HTTP mode requires MCP_AUTH_TOKEN (or --auth-token).
 */
export function loadConfig(): ServerConfig {
  const token = getToken();
  if (!token) {
    throw new Error(
      "не указан WB API токен (WB_API_TOKEN или --token=...)",
    );
  }

  const transportRaw =
    getArg("transport") ?? process.env.MCP_TRANSPORT ?? "stdio";
  const transport = transportRaw.toLowerCase();
  if (transport !== "stdio" && transport !== "http") {
    throw new Error(`Неизвестный транспорт: ${transportRaw} (ожидается stdio|http)`);
  }

  const readOnly =
    hasFlag("read-only") ||
    parseBool(getArg("read-only") ?? process.env.READ_ONLY ?? process.env.WB_MCP_READ_ONLY, false);

  const host = getArg("host") ?? process.env.MCP_HTTP_HOST ?? "0.0.0.0";
  const port = parsePort(getArg("port") ?? process.env.MCP_HTTP_PORT, 3000);
  const path = getArg("path") ?? process.env.MCP_HTTP_PATH ?? "/mcp";
  const authToken =
    getArg("auth-token") ?? process.env.MCP_AUTH_TOKEN ?? "";

  const allowedHostsRaw =
    getArg("allowed-hosts") ?? process.env.MCP_ALLOWED_HOSTS ?? "";
  const extraHosts = allowedHostsRaw
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  const allowedHosts = ["localhost", "127.0.0.1", "::1", ...extraHosts];
  // Include host:port forms commonly sent by Docker / reverse-proxy clients
  const withPorts = new Set<string>(allowedHosts);
  for (const h of [...withPorts]) {
    withPorts.add(`${h}:${port}`);
  }

  if (transport === "http" && !authToken) {
    throw new Error(
      "HTTP-режим требует MCP_AUTH_TOKEN (или --auth-token=...). Без auth MCP станет открытым прокси к WB.",
    );
  }

  const isLoopback =
    host === "127.0.0.1" || host === "localhost" || host === "::1";
  if (transport === "http" && !isLoopback && extraHosts.length === 0) {
    throw new Error(
      "При MCP_HTTP_HOST≠loopback задайте MCP_ALLOWED_HOSTS (имя Docker-сервиса, напр. wb-mcp). Иначе Host-заголовок от контейнеров получит 403.",
    );
  }

  if (!path.startsWith("/")) {
    throw new Error(`MCP_HTTP_PATH должен начинаться с /: ${path}`);
  }

  const sessionIdleTtlMs = parsePositiveInt(
    getArg("session-idle-ttl-ms") ?? process.env.MCP_SESSION_IDLE_TTL_MS,
    30 * 60 * 1000,
    "MCP_SESSION_IDLE_TTL_MS",
    { allowZero: true },
  );
  const sessionMax = parsePositiveInt(
    getArg("session-max") ?? process.env.MCP_SESSION_MAX,
    32,
    "MCP_SESSION_MAX",
    { min: 1 },
  );

  return {
    token,
    transport,
    readOnly,
    http: {
      host,
      port,
      path,
      authToken,
      allowedHosts: [...withPorts],
      sessionIdleTtlMs,
      sessionMax,
    },
  };
}
