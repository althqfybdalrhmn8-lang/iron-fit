import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, json, requireSameOrigin } from "@/lib/http";
import { intInRange, numberInRange, text } from "@/lib/validation";

export async function GET() {
  const user = await requireUser(["COACH"]);
  const result = await query(
    `select id, name, weight_kg as "weightKg", adherence,
            subscription_days as "subscriptionDays", status,
            sleep_hours as "sleepHours", last_activity as "lastActivity", user_id as "userId"
     from members where coach_id = $1 order by created_at desc`,
    [user.id]
  );
  return json({ members: result.rows });
}

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return badRequest("Invalid request origin");
  const user = await requireUser(["COACH"]);

  let body: unknown;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON"); }
  if (!body || typeof body !== "object") return badRequest("Invalid request");

  const input = body as Record<string, unknown>;
  const name = text(input.name, 60);
  const weight = numberInRange(input.weightKg, 0, 400);
  const adherence = intInRange(input.adherence ?? 0, 0, 100);
  const subscriptionDays = intInRange(input.subscriptionDays ?? 30, 0, 3650);
  const sleepHours = numberInRange(input.sleepHours ?? 0, 0, 24);
  const status = input.status === "FOLLOW_UP" ? "FOLLOW_UP" : "ACTIVE";

  if (name.length < 2 || weight === null || adherence === null || subscriptionDays === null || sleepHours === null) {
    return badRequest("Invalid member data");
  }

  const result = await query(
    `insert into members(coach_id, name, weight_kg, adherence, subscription_days, status, sleep_hours, last_activity)
     values($1, $2, $3, $4, $5, $6, $7, $8)
     returning id, name, weight_kg as "weightKg", adherence, subscription_days as "subscriptionDays",
               status, sleep_hours as "sleepHours", last_activity as "lastActivity"`,
    [user.id, name, weight, adherence, subscriptionDays, status, sleepHours, new Date().toISOString().slice(0, 10)]
  );

  return json({ member: result.rows[0] }, { status: 201 });
}
