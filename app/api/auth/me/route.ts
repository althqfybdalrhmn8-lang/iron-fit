import { getSessionUser } from "@/lib/auth";
import { json, unauthorized } from "@/lib/http";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return json({ user });
}
