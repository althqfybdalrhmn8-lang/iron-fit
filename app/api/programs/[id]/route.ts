import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, isUuid, json, notFound, optionalUuid, readJsonObject, requireSameOrigin, route } from "@/lib/http";
import { text, limits } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (request, { params }) => {
  if (!requireSameOrigin(request)) return badRequest("مصدر الطلب غير صالح");
  const user = await requireUser(["COACH"]);
  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const input = await readJsonObject(request);
  if (!input) return badRequest("طلب غير صالح");

  const title = text(input.title, limits.programTitle);
  const description = text(input.description, limits.programDescription);
  const memberId = optionalUuid(input.memberId);

  if (title.length < 2) return badRequest("عنوان البرنامج يجب أن يكون حرفين على الأقل");
  if (memberId === undefined) return badRequest("المشترك غير صالح");

  if (memberId) {
    const owner = await query(`select id from members where id = $1 and coach_id = $2 limit 1`, [memberId, user.id]);
    if (!owner.rows[0]) return json({ error: "المشترك غير صالح" }, { status: 403 });
  }

  const result = await query(
    `update programs set title = $1, description = $2, member_id = $3, updated_at = now()
     where id = $4 and coach_id = $5
     returning id, title, description, member_id as "memberId", days`,
    [title, description, memberId, id, user.id]
  );

  if (!result.rows[0]) return notFound();
  return json({ program: result.rows[0] });
});

export const DELETE = route<Ctx>(async (request, { params }) => {
  if (!requireSameOrigin(request)) return badRequest("مصدر الطلب غير صالح");
  const user = await requireUser(["COACH"]);
  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const result = await query(`delete from programs where id = $1 and coach_id = $2 returning id`, [id, user.id]);
  if (!result.rows[0]) return notFound();
  return json({ ok: true });
});
