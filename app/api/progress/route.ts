import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, json, requireSameOrigin } from "@/lib/http";
import { intInRange, numberInRange } from "@/lib/validation";

export async function GET() {
  const user = await requireUser(["COACH", "SUBSCRIBER"]);
  if (user.role === "COACH") {
    const result = await query(
      `select p.id, p.member_id as "memberId", p.weight_kg as "weightKg", p.sleep_hours as "sleepHours",
              p.adherence, p.recorded_at as "recordedAt"
       from progress_entries p inner join members m on m.id = p.member_id
       where m.coach_id = $1 order by p.recorded_at desc`,
      [user.id]
    );
    return json({ progress: result.rows });
  }
  const result = await query(
    `select p.id, p.member_id as "memberId", p.weight_kg as "weightKg", p.sleep_hours as "sleepHours",
            p.adherence, p.recorded_at as "recordedAt"
     from progress_entries p inner join members m on m.id = p.member_id
     where m.user_id = $1 order by p.recorded_at desc`,
    [user.id]
  );
  return json({ progress: result.rows });
}

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return badRequest("Invalid request origin");
  const user = await requireUser(["COACH"]);

  let body: unknown;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON"); }

  const input = body as Record<string, unknown>;
  const memberId = typeof input.memberId === "string" ? input.memberId : null;
  const weight = numberInRange(input.weightKg, 0, 400);
  const sleep = numberInRange(input.sleepHours, 0, 24);
  const adherence = intInRange(input.adherence, 0, 100);

  if (!memberId || weight === null || sleep === null || adherence === null) {
    return badRequest("Invalid progress data");
  }

  const owner = await query(`select id from members where id = $1 and coach_id = $2 limit 1`, [memberId, user.id]);
  if (!owner.rows[0]) return Response.json({ error: "Invalid member" }, { status: 403 });

  await query(
    `insert into progress_entries(member_id, weight_kg, sleep_hours, adherence) values($1, $2, $3, $4)`,
    [memberId, weight, sleep, adherence]
  );

  await query(
    `update members set weight_kg = $1, sleep_hours = $2, adherence = $3, last_activity = $4, updated_at = now()
     where id = $5 and coach_id = $6`,
    [weight, sleep, adherence, new Date().toISOString().slice(0, 10), memberId, user.id]
  );

  return json({ ok: true });
}
