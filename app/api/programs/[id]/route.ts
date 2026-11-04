import { query, withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, isUuid, json, notFound, optionalUuid, readJsonObject, requireSameOrigin, route } from "@/lib/http";
import { InvalidVideosError, PROGRAM_COLUMNS, parseVideoIds, pruneProgramVideos, setProgramVideos } from "@/lib/programs";
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
  const videoIds = parseVideoIds(input.videoIds);

  if (title.length < 2) return badRequest("عنوان البرنامج يجب أن يكون حرفين على الأقل");
  if (memberId === undefined) return badRequest("المشترك غير صالح");
  if (videoIds === null) return badRequest("قائمة المقاطع غير صالحة");

  if (memberId) {
    const owner = await query(`select id from members where id = $1 and coach_id = $2 limit 1`, [memberId, user.id]);
    if (!owner.rows[0]) return json({ error: "المشترك غير صالح" }, { status: 403 });
  }

  const outcome = await withTransaction(async (client) => {
    const updated = await client.query(
      `update programs set title = $1, description = $2, member_id = $3, updated_at = now()
       where id = $4 and coach_id = $5 returning id`,
      [title, description, memberId, id, user.id]
    );
    if (!updated.rows[0]) return { status: 404 } as const;

    if (videoIds === undefined) {
      // Videos not sent: keep the links, minus any the (possibly new) member can't watch.
      await pruneProgramVideos(client, id, memberId);
    } else if (!(await setProgramVideos(client, id, user.id, memberId, videoIds))) {
      throw new InvalidVideosError(); // rolls back the program update too
    }

    const result = await client.query(`select ${PROGRAM_COLUMNS} from programs p where p.id = $1`, [id]);
    return { status: 200, program: result.rows[0] } as const;
  }).catch((error) => {
    if (error instanceof InvalidVideosError) return { status: 400 } as const;
    throw error;
  });

  if (outcome.status === 404) return notFound();
  if (outcome.status === 400) return badRequest("بعض المقاطع غير متاحة لهذا المشترك");
  return json({ program: outcome.program });
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
