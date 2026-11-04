import { query, withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, isUuid, json, readJsonObject, requireSameOrigin, route } from "@/lib/http";
import { intInRange, numberInRange } from "@/lib/validation";

const COLUMNS = `p.id, p.member_id as "memberId", p.weight_kg::float8 as "weightKg",
  p.sleep_hours::float8 as "sleepHours", p.adherence, p.recorded_at as "recordedAt"`;

export const GET = route(async () => {
  const user = await requireUser(["COACH", "SUBSCRIBER"]);
  const ownerColumn = user.role === "COACH" ? "m.coach_id" : "m.user_id";
  const result = await query(
    `select ${COLUMNS}
     from progress_entries p inner join members m on m.id = p.member_id
     where ${ownerColumn} = $1 order by p.recorded_at desc limit 500`,
    [user.id]
  );
  return json({ progress: result.rows });
});

export const POST = route(async (request: Request) => {
  if (!requireSameOrigin(request)) return badRequest("مصدر الطلب غير صالح");
  const user = await requireUser(["COACH"]);

  const input = await readJsonObject(request);
  if (!input) return badRequest("طلب غير صالح");

  const weight = numberInRange(input.weightKg, 0, 400);
  const sleep = numberInRange(input.sleepHours, 0, 24);
  const adherence = intInRange(input.adherence, 0, 100);

  if (!isUuid(input.memberId)) return badRequest("اختر المشترك");
  if (weight === null || sleep === null || adherence === null) return badRequest("بيانات التقدم غير صالحة");
  const memberId = input.memberId;

  const saved = await withTransaction(async (client) => {
    const updated = await client.query(
      `update members set weight_kg = $1, sleep_hours = $2, adherence = $3, last_activity = $4, updated_at = now()
       where id = $5 and coach_id = $6 returning id`,
      [weight, sleep, adherence, new Date().toISOString().slice(0, 10), memberId, user.id]
    );
    if (!updated.rows[0]) return null;
    const entry = await client.query(
      `insert into progress_entries(member_id, weight_kg, sleep_hours, adherence) values($1, $2, $3, $4)
       returning id, member_id as "memberId", weight_kg::float8 as "weightKg", sleep_hours::float8 as "sleepHours",
                 adherence, recorded_at as "recordedAt"`,
      [memberId, weight, sleep, adherence]
    );
    return entry.rows[0];
  });

  if (!saved) return json({ error: "المشترك غير صالح" }, { status: 403 });
  return json({ entry: saved }, { status: 201 });
});
