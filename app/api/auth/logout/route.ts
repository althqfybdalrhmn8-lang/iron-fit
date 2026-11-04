import { destroySession } from "@/lib/auth";
import { badRequest, json, requireSameOrigin, route } from "@/lib/http";

export const POST = route(async (request: Request) => {
  if (!requireSameOrigin(request)) return badRequest("مصدر الطلب غير صالح");
  await destroySession();
  return json({ ok: true });
});
