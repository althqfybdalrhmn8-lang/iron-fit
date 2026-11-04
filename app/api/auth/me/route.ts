import { query, withTransaction } from "@/lib/db";
import { env } from "@/lib/env";
import { currentSessionTokenHash, getSessionUser, requireUser } from "@/lib/auth";
import { badRequest, json, rateLimited, readJsonObject, requireSameOrigin, route, unauthorized } from "@/lib/http";
import { getClientIp, hashIdentifier, hashPassword, verifyPassword } from "@/lib/security";
import { email as parseEmail, limits, text } from "@/lib/validation";

export const GET = route(async () => {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return json({ user });
});

const MAX_FAILED = 10;

/**
 * Updates the signed-in user's name, email and/or password.
 * Changing email or password requires the current password; changing the password
 * signs out all other sessions.
 */
export const PATCH = route(async (request: Request) => {
  if (!requireSameOrigin(request)) return badRequest("مصدر الطلب غير صالح");
  const user = await requireUser();

  const input = await readJsonObject(request);
  if (!input) return badRequest("طلب غير صالح");

  const name = text(input.name, limits.name);
  const newEmail = parseEmail(input.email);
  const currentPassword = typeof input.currentPassword === "string" ? input.currentPassword : "";
  const newPassword = typeof input.newPassword === "string" ? input.newPassword : "";

  if (name.length < 2) return badRequest("الاسم يجب أن يكون حرفين على الأقل");
  if (!newEmail) return badRequest("البريد الإلكتروني غير صالح");
  if (newPassword && (newPassword.length < 8 || newPassword.length > 200)) {
    return badRequest("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل");
  }

  const emailChanged = newEmail !== user.email;
  const sensitive = emailChanged || !!newPassword;

  if (sensitive) {
    if (!currentPassword) return badRequest("أدخل كلمة المرور الحالية لتغيير البريد أو كلمة المرور");

    // Same brute-force protection as login: failed checks count toward the account's limit.
    const identifierHash = hashIdentifier(user.email, env.securityPepper);
    const ipHash = hashIdentifier(getClientIp(request), env.securityPepper);
    const attempts = await query<{ count: number }>(
      `select count(*)::int as count from login_attempts
       where successful = false and identifier_hash = $1 and created_at > now() - interval '15 minutes'`,
      [identifierHash]
    );
    if ((attempts.rows[0]?.count ?? 0) >= MAX_FAILED) return rateLimited();

    const stored = await query<{ password_hash: string }>(`select password_hash from users where id = $1`, [user.id]);
    const ok = !!stored.rows[0] && await verifyPassword(currentPassword, stored.rows[0].password_hash);
    if (!ok) {
      await query(`insert into login_attempts(identifier_hash, ip_hash, successful) values($1, $2, false)`, [identifierHash, ipHash]);
      return badRequest("كلمة المرور الحالية غير صحيحة");
    }
  }

  const newHash = newPassword ? await hashPassword(newPassword) : null;
  const currentTokenHash = await currentSessionTokenHash();

  const outcome = await withTransaction(async (client) => {
    if (emailChanged) {
      const taken = await client.query(`select 1 from users where email = $1 and id <> $2`, [newEmail, user.id]);
      if (taken.rows[0]) return { error: "البريد الإلكتروني مستخدم مسبقًا" } as const;
    }
    const updated = await client.query(
      `update users set name = $1, email = $2, password_hash = coalesce($3, password_hash), updated_at = now()
       where id = $4 returning id, email, name, role`,
      [name, newEmail, newHash, user.id]
    );
    // Keep the member profile's display name in sync for subscribers.
    if (user.role === "SUBSCRIBER") {
      await client.query(`update members set name = $1, updated_at = now() where user_id = $2`, [name, user.id]);
    }
    if (newHash) {
      await client.query(`delete from sessions where user_id = $1 and token_hash <> $2`, [user.id, currentTokenHash ?? ""]);
    }
    await client.query(
      `insert into audit_logs(user_id, action, resource_type, resource_id) values($1, $2, 'USER', $3)`,
      [user.id, newHash ? "PASSWORD_CHANGE" : "PROFILE_UPDATE", user.id]
    );
    return { user: updated.rows[0] } as const;
  });

  if ("error" in outcome) return json({ error: outcome.error }, { status: 409 });
  return json({ user: outcome.user });
});
