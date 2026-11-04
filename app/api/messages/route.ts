import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, json, requireSameOrigin } from "@/lib/http";
import { text, limits } from "@/lib/validation";

export async function GET() {
  const user = await requireUser(["COACH", "SUBSCRIBER"]);
  if (user.role === "COACH") {
    const result = await query(
      `select id, member_id as "memberId", body, created_at as "createdAt"
       from messages where coach_id = $1 order by created_at desc limit 100`,
      [user.id]
    );
    return json({ messages: result.rows });
  }
  const result = await query(
    `select msg.id, msg.body, msg.created_at as "createdAt"
     from messages msg inner join members m on m.id = msg.member_id
     where m.user_id = $1 order by msg.created_at desc limit 100`,
    [user.id]
  );
  return json({ messages: result.rows });
}

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return badRequest("Invalid request origin");
  const user = await requireUser(["COACH"]);

  let body: unknown;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON"); }

  const input = body as Record<string, unknown>;
  const bodyText = text(input.body, limits.message);
  const memberId = typeof input.memberId === "string" && input.memberId ? input.memberId : null;

  if (!memberId || !bodyText) return badRequest("Invalid message");

  const owner = await query(`select id from members where id = $1 and coach_id = $2`, [memberId, user.id]);
  if (!owner.rows[0]) return Response.json({ error: "Invalid member" }, { status: 403 });

  const result = await query(
    `insert into messages(coach_id, member_id, body) values($1, $2, $3)
     returning id, member_id as "memberId", body, created_at as "createdAt"`,
    [user.id, memberId, bodyText]
  );

  return json({ message: result.rows[0] }, { status: 201 });
}
