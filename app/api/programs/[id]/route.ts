import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, json, requireSameOrigin } from "@/lib/http";
import { text, limits } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return badRequest("Invalid request origin");
  const user = await requireUser(["COACH"]);
  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON"); }

  const input = body as Record<string, unknown>;
  const title = text(input.title, limits.programTitle);
  const description = text(input.description, limits.programDescription);
  const memberId = typeof input.memberId === "string" && input.memberId ? input.memberId : null;

  if (title.length < 2) return badRequest("Invalid program title");

  if (memberId) {
    const owner = await query(`select id from members where id = $1 and coach_id = $2 limit 1`, [memberId, user.id]);
    if (!owner.rows[0]) return Response.json({ error: "Invalid member" }, { status: 403 });
  }

  const result = await query(
    `update programs set title = $1, description = $2, member_id = $3, updated_at = now()
     where id = $4 and coach_id = $5
     returning id, title, description, member_id as "memberId", days`,
    [title, description, memberId, id, user.id]
  );

  if (!result.rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
  return json({ program: result.rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return badRequest("Invalid request origin");
  const user = await requireUser(["COACH"]);
  const { id } = await params;

  const result = await query(`delete from programs where id = $1 and coach_id = $2 returning id`, [id, user.id]);
  if (!result.rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
  return json({ ok: true });
}
