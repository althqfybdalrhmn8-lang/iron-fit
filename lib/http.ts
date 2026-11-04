import { env } from "./env";

export function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, { ...init, headers: { "Cache-Control": "no-store", ...init.headers } });
}

export function badRequest(message: string) {
  return json({ error: message }, { status: 400 });
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(env.appUrl).origin;
  } catch {
    return false;
  }
}

export function unauthorized() { return json({ error: "Unauthorized" }, { status: 401 }); }
export function forbidden() { return json({ error: "Forbidden" }, { status: 403 }); }
export function rateLimited() {
  return json(
    { error: "Too many attempts. Please try again later." },
    { status: 429, headers: { "Retry-After": "900" } }
  );
}
