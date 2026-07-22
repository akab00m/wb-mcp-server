import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createBearerAuthMiddleware, safeEqual } from "../src/http-auth.js";

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown; headers: Record<string, string> };
}

describe("safeEqual", () => {
  it("returns true for equal strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
  });

  it("returns false for different strings / lengths", () => {
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });
});

describe("createBearerAuthMiddleware", () => {
  it("rejects missing Authorization", () => {
    const mw = createBearerAuthMiddleware("secret");
    const req = { headers: {} } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    mw(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects invalid token", () => {
    const mw = createBearerAuthMiddleware("secret");
    const req = { headers: { authorization: "Bearer wrong" } } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    mw(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts valid Bearer token", () => {
    const mw = createBearerAuthMiddleware("secret");
    const req = { headers: { authorization: "Bearer secret" } } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
