import { env } from "./env";

export function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, { ...init, headers: { "Cache-Control": "no-store", ...init.headers } });
}

export function badRequest(message: string) {
  return json({ error: message }, { status: 400 });
}

export function unauthorized() { return json({ error: "يجب تسجيل الدخول" }, { status: 401 }); }
export function forbidden() { return json({ error: "غير مصرح لك بهذا الإجراء" }, { status: 403 }); }
export function notFound() { return json({ error: "العنصر غير موجود" }, { status: 404 }); }
export function rateLimited() {
  return json(
    { error: "محاولات كثيرة، حاول مرة أخرى بعد 15 دقيقة" },
    { status: 429, headers: { "Retry-After": "900" } }
  );
}

/**
 * Rejects cross-site state-changing requests. Browsers always send `Origin` on
 * cross-origin fetch/POST, so a missing header means a same-origin or non-browser client.
 * Also accepts the request's own host, so the app works behind a proxy or on a
 * different hostname than NEXT_PUBLIC_APP_URL.
 */
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    if (originUrl.origin === new URL(env.appUrl).origin) return true;
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    return !!host && originUrl.host === host;
  } catch {
    return false;
  }
}

/** Parses a JSON object body; returns null for invalid JSON or non-object bodies. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get("content-type") || "").includes("application/json")) return null;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Optional UUID field: "" / null / undefined -> null, valid uuid -> value, anything else -> undefined (invalid). */
export function optionalUuid(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return isUuid(value) ? value : undefined;
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/** Wraps a route handler: maps auth errors to 401/403 and hides unexpected errors behind a 500. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorized();
      if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
      console.error(error);
      return json({ error: "حدث خطأ في الخادم" }, { status: 500 });
    }
  };
}
