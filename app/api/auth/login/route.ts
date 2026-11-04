import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { createSession } from "@/lib/auth";
import { badRequest, json, rateLimited, requireSameOrigin } from "@/lib/http";
import { email } from "@/lib/validation";
import { getClientIp, hashIdentifier, verifyPassword } from "@/lib/security";

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 10;

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return badRequest("Invalid request origin");

  let body: unknown;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON"); }
  if (!body || typeof body !== "object") return badRequest("Invalid request");

  const input = body as Record<string, unknown>;
  const emailValue = email(input.email);
  const password = String(input.password ?? "");

  if (!emailValue || password.length < 8 || password.length > 200) {
    return badRequest("Invalid credentials");
  }

  const ip = getClientIp(request);
  const identifierHash = hashIdentifier(emailValue, env.securityPepper);
  const ipHash = hashIdentifier(ip, env.securityPepper);

  const attempts = await query<{ count: string }>(
    `select count(*)::text as count from login_attempts
     where created_at > now() - ($3::text || ' minutes')::interval
     and (identifier_hash = $1 or ip_hash = $2)`,
    [identifierHash, ipHash, WINDOW_MINUTES]
  );

  if (Number(attempts.rows[0]?.count || 0) >= MAX_ATTEMPTS) return rateLimited();

  const result = await query<{
    id: string; role: "COACH" | "SUBSCRIBER"; email: string; name: string; password_hash: string;
  }>(`select id, role, email, name, password_hash from users where email = $1 limit 1`, [emailValue]);

  const user = result.rows[0];
  const passwordOk = user ? await verifyPassword(password, user.password_hash) : false;

  await query(
    `insert into login_attempts(identifier_hash, ip_hash, successful) values($1, $2, $3)`,
    [identifierHash, ipHash, passwordOk]
  );

  if (!user || !passwordOk) return json({ error: "Invalid credentials" }, { status: 401 });

  await query(`delete from sessions where user_id = $1`, [user.id]);
  await createSession(user.id);
  await query(
    `insert into audit_logs(user_id, action, resource_type, ip_hash) values($1, 'LOGIN', 'AUTH', $2)`,
    [user.id, ipHash]
  );

  return json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}
