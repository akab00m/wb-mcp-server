import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

/**
 * Constant-time string comparison to avoid timing leaks on auth tokens.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Express middleware: require `Authorization: Bearer <token>`.
 * Token value is never logged.
 */
export function createBearerAuthMiddleware(expectedToken: string): RequestHandler {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="wb-mcp-server"');
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized: missing Bearer token" },
        id: null,
      });
      return;
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token || !safeEqual(token, expectedToken)) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="wb-mcp-server"');
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized: invalid Bearer token" },
        id: null,
      });
      return;
    }

    next();
  };
}
