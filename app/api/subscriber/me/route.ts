import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json } from "@/lib/http";

export async function GET() {
  const user = await requireUser(["SUBSCRIBER"]);

  const memberResult = await query(
    `select id, name, weight_kg as "weightKg", adherence, subscription_days as "subscriptionDays",
            status, sleep_hours as "sleepHours", last_activity as "lastActivity"
     from members where user_id = $1 limit 1`,
    [user.id]
  );

  const member = memberResult.rows[0];
  if (!member) return Response.json({ error: "Subscriber profile not found" }, { status: 404 });

  const [programs, nutrition, messages, progress] = await Promise.all([
    query(
      `select p.id, p.title, p.description, p.member_id as "memberId", p.days
       from programs p where p.member_id = $1 order by p.created_at desc`,
      [member.id]
    ),
    query(
      `select n.id, n.title, n.calories, n.protein_g as "proteinG", n.carbs_g as "carbsG", n.fat_g as "fatG",
              n.notes, n.member_id as "memberId"
       from nutrition_plans n where n.member_id = $1 order by n.created_at desc`,
      [member.id]
    ),
    query(
      `select id, body, created_at as "createdAt" from messages where member_id = $1 order by created_at desc`,
      [member.id]
    ),
    query(
      `select id, weight_kg as "weightKg", sleep_hours as "sleepHours", adherence, recorded_at as "recordedAt"
       from progress_entries where member_id = $1 order by recorded_at desc`,
      [member.id]
    )
  ]);

  return json({ member, programs: programs.rows, nutrition: nutrition.rows, messages: messages.rows, progress: progress.rows });
}
