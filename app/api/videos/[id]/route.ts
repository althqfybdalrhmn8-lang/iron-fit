import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, isUuid, json, notFound, requireSameOrigin, route } from "@/lib/http";
import { removeFile } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>(async (request, { params }) => {
  if (!requireSameOrigin(request)) return badRequest("مصدر الطلب غير صالح");
  const user = await requireUser(["COACH"]);
  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const result = await query<{ storage_key: string }>(
    `delete from exercise_videos where id = $1 and coach_id = $2 returning storage_key`,
    [id, user.id]
  );
  if (!result.rows[0]) return notFound();
  await removeFile(result.rows[0].storage_key);
  return json({ ok: true });
});
