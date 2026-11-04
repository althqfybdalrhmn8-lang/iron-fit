import { query, withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, json, readJsonObject, requireSameOrigin, route } from "@/lib/http";
import { MEMBER_COLUMNS, MEMBER_FROM, createSubscriberLogin, parseMemberInput } from "@/lib/members";

export const GET = route(async () => {
  const user = await requireUser(["COACH"]);
  const result = await query(
    `select ${MEMBER_COLUMNS} from ${MEMBER_FROM} where m.coach_id = $1 order by m.created_at desc`,
    [user.id]
  );
  return json({ members: result.rows });
});

export const POST = route(async (request: Request) => {
  if (!requireSameOrigin(request)) return badRequest("مصدر الطلب غير صالح");
  const user = await requireUser(["COACH"]);

  const input = await readJsonObject(request);
  if (!input) return badRequest("طلب غير صالح");
  const data = parseMemberInput(input);
  if (typeof data === "string") return badRequest(data);

  const outcome = await withTransaction(async (client) => {
    let userId: string | null = null;
    if (data.login) {
      userId = await createSubscriberLogin(client, data.name, data.login);
      if (!userId) return { error: "البريد الإلكتروني مستخدم مسبقًا" } as const;
    }
    const inserted = await client.query<{ id: string }>(
      `insert into members(coach_id, user_id, name, weight_kg, adherence, subscription_days, status, sleep_hours, last_activity)
       values($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [user.id, userId, data.name, data.weightKg, data.adherence, data.subscriptionDays, data.status,
       data.sleepHours, new Date().toISOString().slice(0, 10)]
    );
    const member = await client.query(`select ${MEMBER_COLUMNS} from ${MEMBER_FROM} where m.id = $1`, [inserted.rows[0].id]);
    return { member: member.rows[0] } as const;
  });

  if ("error" in outcome) return json({ error: outcome.error }, { status: 409 });
  return json({ member: outcome.member }, { status: 201 });
});
