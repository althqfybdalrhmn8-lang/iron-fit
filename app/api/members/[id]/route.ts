import { withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, isUuid, json, notFound, readJsonObject, requireSameOrigin, route } from "@/lib/http";
import { MEMBER_COLUMNS, MEMBER_FROM, createSubscriberLogin, parseMemberInput } from "@/lib/members";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (request, { params }) => {
  if (!requireSameOrigin(request)) return badRequest("مصدر الطلب غير صالح");
  const user = await requireUser(["COACH"]);
  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const input = await readJsonObject(request);
  if (!input) return badRequest("طلب غير صالح");
  const data = parseMemberInput(input);
  if (typeof data === "string") return badRequest(data);

  const outcome = await withTransaction(async (client) => {
    const existing = await client.query<{ user_id: string | null }>(
      `select user_id from members where id = $1 and coach_id = $2 for update`,
      [id, user.id]
    );
    if (!existing.rows[0]) return { status: 404 } as const;

    let userId = existing.rows[0].user_id;
    if (data.login && !userId) {
      userId = await createSubscriberLogin(client, data.name, data.login);
      if (!userId) return { status: 409, error: "البريد الإلكتروني مستخدم مسبقًا" } as const;
    }

    await client.query(
      `update members set name = $1, weight_kg = $2, adherence = $3, subscription_days = $4,
         status = $5, sleep_hours = $6, user_id = $7, updated_at = now()
       where id = $8 and coach_id = $9`,
      [data.name, data.weightKg, data.adherence, data.subscriptionDays, data.status, data.sleepHours, userId, id, user.id]
    );
    if (userId) await client.query(`update users set name = $1, updated_at = now() where id = $2`, [data.name, userId]);

    const member = await client.query(`select ${MEMBER_COLUMNS} from ${MEMBER_FROM} where m.id = $1`, [id]);
    return { status: 200, member: member.rows[0] } as const;
  });

  if (outcome.status === 404) return notFound();
  if (outcome.status === 409) return json({ error: outcome.error }, { status: 409 });
  return json({ member: outcome.member });
});

export const DELETE = route<Ctx>(async (request, { params }) => {
  if (!requireSameOrigin(request)) return badRequest("مصدر الطلب غير صالح");
  const user = await requireUser(["COACH"]);
  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const deleted = await withTransaction(async (client) => {
    const result = await client.query<{ user_id: string | null }>(
      `delete from members where id = $1 and coach_id = $2 returning user_id`,
      [id, user.id]
    );
    const row = result.rows[0];
    if (!row) return false;
    // Remove the member's login too, otherwise it would remain as an orphan account that can still sign in.
    if (row.user_id) await client.query(`delete from users where id = $1 and role = 'SUBSCRIBER'`, [row.user_id]);
    return true;
  });

  if (!deleted) return notFound();
  return json({ ok: true });
});
