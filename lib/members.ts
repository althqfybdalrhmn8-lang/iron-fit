import type { PoolClient } from "pg";
import { hashPassword } from "./security";
import { email as parseEmail, intInRange, numberInRange, text, limits } from "./validation";

/** Columns returned for a member; numerics are cast so the client receives numbers, not strings. */
export const MEMBER_COLUMNS = `m.id, m.name, m.weight_kg::float8 as "weightKg", m.adherence,
  m.subscription_days as "subscriptionDays", m.status, m.sleep_hours::float8 as "sleepHours",
  m.last_activity as "lastActivity", m.user_id as "userId", u.email as "loginEmail"`;

export const MEMBER_FROM = `members m left join users u on u.id = m.user_id`;

export type MemberInput = {
  name: string; weightKg: number; adherence: number; subscriptionDays: number;
  sleepHours: number; status: "ACTIVE" | "FOLLOW_UP";
  login: { email: string; password: string } | null;
};

export function parseMemberInput(input: Record<string, unknown>): MemberInput | string {
  const name = text(input.name, limits.name);
  const weightKg = numberInRange(input.weightKg, 0, 400);
  const adherence = intInRange(input.adherence ?? 0, 0, 100);
  const subscriptionDays = intInRange(input.subscriptionDays ?? 30, 0, 3650);
  const sleepHours = numberInRange(input.sleepHours ?? 0, 0, 24);
  const status = input.status === "FOLLOW_UP" ? "FOLLOW_UP" : "ACTIVE";

  if (name.length < 2) return "الاسم يجب أن يكون حرفين على الأقل";
  if (weightKg === null) return "الوزن يجب أن يكون بين 0 و 400";
  if (adherence === null) return "الالتزام يجب أن يكون بين 0 و 100";
  if (subscriptionDays === null) return "أيام الاشتراك يجب أن تكون بين 0 و 3650";
  if (sleepHours === null) return "ساعات النوم يجب أن تكون بين 0 و 24";

  let login: MemberInput["login"] = null;
  const rawEmail = text(input.loginEmail, limits.email);
  const password = typeof input.loginPassword === "string" ? input.loginPassword : "";
  if (rawEmail || password) {
    const emailValue = parseEmail(rawEmail);
    if (!emailValue) return "بريد دخول المشترك غير صالح";
    if (password.length < 8 || password.length > 200) return "كلمة مرور المشترك يجب أن تكون 8 أحرف على الأقل";
    login = { email: emailValue, password };
  }

  return { name, weightKg, adherence, subscriptionDays, sleepHours, status, login };
}

/** Creates a SUBSCRIBER account. Returns the new user id, or null if the email is taken. */
export async function createSubscriberLogin(client: PoolClient, name: string, login: { email: string; password: string }) {
  const result = await client.query<{ id: string }>(
    `insert into users(role, email, password_hash, name) values('SUBSCRIBER', $1, $2, $3)
     on conflict(email) do nothing returning id`,
    [login.email, await hashPassword(login.password), name]
  );
  return result.rows[0]?.id ?? null;
}
