import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { createSession } from "@/lib/auth";
import { badRequest, json, rateLimited, readJsonObject, requireSameOrigin, route } from "@/lib/http";
import { email } from "@/lib/validation";
import { getClientIp, getDummyHash, hashIdentifier, verifyPassword } from "@/lib/security";

const WINDOW_MINUTES = 15;
const MAX_FAILED_PER_ACCOUNT = 10;
const MAX_FAILED_PER_IP = 30;

export const POST = route(async (request: Request) => {
  if (!requireSameOrigin(request)) return badRequest("مصدر الطلب غير صالح");

  const input = await readJsonObject(request);
  if (!input) return badRequest("طلب غير صالح");

  const emailValue = email(input.email);
  const password = typeof input.password === "string" ? input.password : "";

  if (!emailValue || password.length < 8 || password.length > 200) {
    return json({ error: "البريد أو كلمة المرور غير صحيحة" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const identifierHash = hashIdentifier(emailValue, env.securityPepper);
  const ipHash = hashIdentifier(ip, env.securityPepper);

  // Only failed attempts count, so a user who logs in often never locks themself out.
  const attempts = await query<{ account: number; ip: number }>(
    `select count(*) filter (where identifier_hash = $1)::int as account,
            count(*) filter (where ip_hash = $2)::int as ip
     from login_attempts
     where successful = false
       and created_at > now() - make_interval(mins => $3)
       and (identifier_hash = $1 or ip_hash = $2)`,
    [identifierHash, ipHash, WINDOW_MINUTES]
  );
  const counts = attempts.rows[0];
  if (counts && (counts.account >= MAX_FAILED_PER_ACCOUNT || counts.ip >= MAX_FAILED_PER_IP)) {
    return rateLimited();
  }

  const result = await query<{
    id: string; role: "COACH" | "SUBSCRIBER"; email: string; name: string; password_hash: string;
  }>(`select id, role, email, name, password_hash from users where email = $1 limit 1`, [emailValue]);

  const user = result.rows[0];
  const passwordOk = await verifyPassword(password, user ? user.password_hash : await getDummyHash());

  await query(
    `insert into login_attempts(identifier_hash, ip_hash, successful) values($1, $2, $3)`,
    [identifierHash, ipHash, !!user && passwordOk]
  );

  if (!user || !passwordOk) return json({ error: "البريد أو كلمة المرور غير صحيحة" }, { status: 401 });

  // Housekeeping: drop this user's old sessions and globally expired sessions / old attempts.
  await query(`delete from sessions where user_id = $1 or expires_at < now()`, [user.id]);
  await query(`delete from login_attempts where created_at < now() - interval '1 day'`);
  await createSession(user.id);
  await query(
    `insert into audit_logs(user_id, action, resource_type, ip_hash) values($1, 'LOGIN', 'AUTH', $2)`,
    [user.id, ipHash]
  );

  return json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});
