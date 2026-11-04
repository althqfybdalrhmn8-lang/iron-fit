import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, isUuid, json, readJsonObject, requireSameOrigin, route } from "@/lib/http";
import { text, limits } from "@/lib/validation";

export const GET = route(async () => {
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
});

export const POST = route(async (request: Request) => {
  if (!requireSameOrigin(request)) return badRequest("مصدر الطلب غير صالح");
  const user = await requireUser(["COACH"]);

  const input = await readJsonObject(request);
  if (!input) return badRequest("طلب غير صالح");

  const bodyText = text(input.body, limits.message);
  if (!isUuid(input.memberId)) return badRequest("اختر المشترك");
  if (!bodyText) return badRequest("اكتب نص الرسالة");
  const memberId = input.memberId;

  const owner = await query(`select id from members where id = $1 and coach_id = $2`, [memberId, user.id]);
  if (!owner.rows[0]) return json({ error: "المشترك غير صالح" }, { status: 403 });

  const result = await query(
    `insert into messages(coach_id, member_id, body) values($1, $2, $3)
     returning id, member_id as "memberId", body, created_at as "createdAt"`,
    [user.id, memberId, bodyText]
  );

  return json({ message: result.rows[0] }, { status: 201 });
});
