import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, json, requireSameOrigin } from "@/lib/http";
import { text, limits } from "@/lib/validation";

export async function GET() {
  const user = await requireUser(["COACH", "SUBSCRIBER"]);
  if (user.role === "COACH") {
    const result = await query(
      `select id, title, description, member_id as "memberId", days
       from programs where coach_id = $1 order by created_at desc`,
      [user.id]
    );
    return json({ programs: result.rows });
  }
  const result = await query(
    `select p.id, p.title, p.description, p.member_id as "memberId", p.days
     from programs p inner join members m on m.id = p.member_id
     where m.user_id = $1 order by p.created_at desc`,
    [user.id]
  );
  return json({ programs: result.rows });
}

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return badRequest("Invalid request origin");
  const user = await requireUser(["COACH"]);

  let body: unknown;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON"); }
  if (!body || typeof body !== "object") return badRequest("Invalid request");

  const input = body as Record<string, unknown>;
  const title = text(input.title, limits.programTitle);
  const description = text(input.description, limits.programDescription);
  const memberId = typeof input.memberId === "string" && input.memberId.length ? input.memberId : null;

  if (title.length < 2) return badRequest("Invalid program title");

  if (memberId) {
    const owner = await query(`select id from members where id = $1 and coach_id = $2 limit 1`, [memberId, user.id]);
    if (!owner.rows[0]) return Response.json({ error: "Invalid member" }, { status: 403 });
  }

  const result = await query(
    `insert into programs(coach_id, member_id, title, description) values($1, $2, $3, $4)
     returning id, title, description, member_id as "memberId", days`,
    [user.id, memberId, title, description]
  );

  return json({ program: result.rows[0] }, { status: 201 });
}
