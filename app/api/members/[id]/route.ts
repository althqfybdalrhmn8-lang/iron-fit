import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, json, requireSameOrigin } from "@/lib/http";
import { intInRange, numberInRange, text } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return badRequest("Invalid request origin");
  const user = await requireUser(["COACH"]);
  const { id } = await params;

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
    `update members set name = $1, weight_kg = $2, adherence = $3, subscription_days = $4,
       status = $5, sleep_hours = $6, updated_at = now()
     where id = $7 and coach_id = $8
     returning id, name, weight_kg as "weightKg", adherence, subscription_days as "subscriptionDays",
               status, sleep_hours as "sleepHours", last_activity as "lastActivity"`,
    [name, weight, adherence, subscriptionDays, status, sleepHours, id, user.id]
  );

  if (!result.rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
  return json({ member: result.rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return badRequest("Invalid request origin");
  const user = await requireUser(["COACH"]);
  const { id } = await params;

  const result = await query(
    `delete from members where id = $1 and coach_id = $2 returning id`,
    [id, user.id]
  );

  if (!result.rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
  return json({ ok: true });
}
