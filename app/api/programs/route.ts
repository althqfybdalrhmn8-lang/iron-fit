import { query, withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, json, optionalUuid, readJsonObject, requireSameOrigin, route } from "@/lib/http";
import { InvalidVideosError, PROGRAM_COLUMNS, parseVideoIds, setProgramVideos } from "@/lib/programs";
import { text, limits } from "@/lib/validation";

export const GET = route(async () => {
  const user = await requireUser(["COACH", "SUBSCRIBER"]);
  if (user.role === "COACH") {
    const result = await query(
      `select ${PROGRAM_COLUMNS} from programs p where p.coach_id = $1 order by p.created_at desc`,
      [user.id]
    );
    return json({ programs: result.rows });
  }
  const result = await query(
    `select ${PROGRAM_COLUMNS}
     from programs p inner join members m on m.id = p.member_id
     where m.user_id = $1 order by p.created_at desc`,
    [user.id]
  );
  return json({ programs: result.rows });
});

export const POST = route(async (request: Request) => {
  if (!requireSameOrigin(request)) return badRequest("مصدر الطلب غير صالح");
  const user = await requireUser(["COACH"]);

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

  const program = await withTransaction(async (client) => {
    const inserted = await client.query<{ id: string }>(
      `insert into programs(coach_id, member_id, title, description) values($1, $2, $3, $4) returning id`,
      [user.id, memberId, title, description]
    );
    const id = inserted.rows[0].id;
    if (videoIds?.length && !(await setProgramVideos(client, id, user.id, memberId, videoIds))) {
      throw new InvalidVideosError();
    }
    const result = await client.query(`select ${PROGRAM_COLUMNS} from programs p where p.id = $1`, [id]);
    return result.rows[0];
  }).catch((error) => {
    if (error instanceof InvalidVideosError) return null;
    throw error;
  });

  if (!program) return badRequest("بعض المقاطع غير متاحة لهذا المشترك");
  return json({ program }, { status: 201 });
});
