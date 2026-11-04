import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, json, requireSameOrigin } from "@/lib/http";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return badRequest("Invalid request origin");
  const user = await requireUser(["COACH"]);
  const { id } = await params;

  const result = await query(`delete from nutrition_plans where id = $1 and coach_id = $2 returning id`, [id, user.id]);
  if (!result.rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
  return json({ ok: true });
}
