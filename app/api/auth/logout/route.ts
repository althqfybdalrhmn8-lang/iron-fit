import { destroySession, getSessionUser } from "@/lib/auth";
import { badRequest, json, requireSameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return badRequest("Invalid request origin");
  await getSessionUser();
  await destroySession();
  return json({ ok: true });
}
