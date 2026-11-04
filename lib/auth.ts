import { cookies } from "next/headers";
import { query } from "./db";
import { env } from "./env";
import { randomToken, sha256 } from "./security";

const SESSION_TTL = 60 * 60 * 8;

export type Role = "COACH" | "SUBSCRIBER";

export type SessionUser = { id: string; email: string; name: string; role: Role };

export async function createSession(userId: string) {
  const token = randomToken(32);
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL * 1000);

  await query(
    `insert into sessions(user_id, token_hash, expires_at) values($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  const store = await cookies();
  store.set({
    name: env.sessionCookieName,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(env.sessionCookieName)?.value;
  if (token) {
    await query(`delete from sessions where token_hash = $1`, [sha256(token)]);
  }
  store.delete(env.sessionCookieName);
}

export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(env.sessionCookieName)?.value;
  if (!token) return null;

  const tokenHash = sha256(token);
  const result = await query<SessionUser>(
    `select u.id, u.email, u.name, u.role
     from sessions s inner join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now() limit 1`,
    [tokenHash]
  );

  if (!result.rows[0]) return null;

  await query(`update sessions set last_seen_at = now() where token_hash = $1`, [tokenHash]);
  return result.rows[0];
}

export async function requireUser(roles?: Role[]) {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  if (roles && !roles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}
