import { WBApiError } from "./utils/errors.js";
import { RateLimiter } from "./utils/rate-limiter.js";
import { ALLOWED_WB_HOSTS } from "./config.js";

export class WBClient {
  private token: string;
  public rateLimiter: RateLimiter;

  constructor(token: string) {
    this.token = token;
    this.rateLimiter = new RateLimiter();
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: this.token,
      "Content-Type": "application/json",
    };
  }

  /**
   * Build and validate URL. Only *.wildberries.ru hosts from BASE_URLS are allowed.
   */
  private buildUrl(baseUrl: string, path: string, params?: Record<string, unknown>): URL {
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("//")) {
      throw new WBApiError(400, "FORBIDDEN_URL", "Абсолютный URL в path запрещён");
    }

    const url = new URL(path, baseUrl);
    if (!ALLOWED_WB_HOSTS.includes(url.hostname)) {
      throw new WBApiError(
        400,
        "FORBIDDEN_HOST",
        `Хост не разрешён для WB API: ${url.hostname}`,
      );
    }

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url;
  }

  private async handleResponse<T>(response: Response, url: string): Promise<T> {
    if (response.ok) {
      const text = await response.text();
      if (!text) return {} as T;
      return JSON.parse(text) as T;
    }

    let code = "";
    let message = `HTTP ${response.status}`;
    let detail = "";

    try {
      const body = await response.text();
      const parsed = JSON.parse(body);
      code = parsed.code ?? parsed.errorCode ?? "";
      message = parsed.message ?? parsed.errorText ?? message;
      detail = parsed.detail ?? parsed.additionalErrors ?? "";
      if (typeof detail !== "string") detail = JSON.stringify(detail);

      process.stderr.write(
        `[wb-client] Ошибка: ${url} -> ${response.status} ${body}\n`,
      );
    } catch {
      process.stderr.write(
        `[wb-client] Ошибка: ${url} -> ${response.status} (не удалось прочитать тело ответа)\n`,
      );
    }

    throw new WBApiError(response.status, code, message, detail);
  }

  async get<T>(baseUrl: string, path: string, params?: Record<string, any>): Promise<T> {
    const url = this.buildUrl(baseUrl, path, params);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: this.headers,
    });

    return this.handleResponse<T>(response, url.toString());
  }

  async post<T>(baseUrl: string, path: string, body?: any): Promise<T> {
    const url = this.buildUrl(baseUrl, path);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse<T>(response, url.toString());
  }

  async patch<T>(baseUrl: string, path: string, body?: any): Promise<T> {
    const url = this.buildUrl(baseUrl, path);

    const response = await fetch(url.toString(), {
      method: "PATCH",
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse<T>(response, url.toString());
  }
}
