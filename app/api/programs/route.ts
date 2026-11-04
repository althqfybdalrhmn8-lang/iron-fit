import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, json, optionalUuid, readJsonObject, requireSameOrigin, route } from "@/lib/http";
import { text, limits } from "@/lib/validation";

export const GET = route(async () => {
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
});

export const POST = route(async (request: Request) => {
  if (!requireSameOrigin(request)) return badRequest("مصدر الطلب غير صالح");
  const user = await requireUser(["COACH"]);

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
    `insert into programs(coach_id, member_id, title, description) values($1, $2, $3, $4)
     returning id, title, description, member_id as "memberId", days`,
    [user.id, memberId, title, description]
  );

  return json({ program: result.rows[0] }, { status: 201 });
});
