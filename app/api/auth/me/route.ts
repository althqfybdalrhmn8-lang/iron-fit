import { getSessionUser } from "@/lib/auth";
import { json, route, unauthorized } from "@/lib/http";

export const GET = route(async () => {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return json({ user });
});
