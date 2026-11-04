import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, json, optionalUuid, readJsonObject, requireSameOrigin, route } from "@/lib/http";
import { intInRange, text, limits } from "@/lib/validation";

const COLUMNS = `n.id, n.title, n.calories, n.protein_g as "proteinG", n.carbs_g as "carbsG", n.fat_g as "fatG",
  n.notes, n.member_id as "memberId"`;

export const GET = route(async () => {
  const user = await requireUser(["COACH", "SUBSCRIBER"]);
  if (user.role === "COACH") {
    const result = await query(
      `select ${COLUMNS} from nutrition_plans n where n.coach_id = $1 order by n.created_at desc`,
      [user.id]
    );
    return json({ plans: result.rows });
  }
  const result = await query(
    `select ${COLUMNS} from nutrition_plans n inner join members m on m.id = n.member_id
     where m.user_id = $1 order by n.created_at desc`,
    [user.id]
  );
  return json({ plans: result.rows });
});

export const POST = route(async (request: Request) => {
  if (!requireSameOrigin(request)) return badRequest("مصدر الطلب غير صالح");
  const user = await requireUser(["COACH"]);

  const input = await readJsonObject(request);
  if (!input) return badRequest("طلب غير صالح");

  const title = text(input.title, limits.nutritionTitle);
  const calories = intInRange(input.calories, 0, 10000);
  const protein = intInRange(input.proteinG, 0, 1000);
  const carbs = intInRange(input.carbsG, 0, 2000);
  const fat = intInRange(input.fatG, 0, 1000);
  const notes = text(input.notes, limits.nutritionNotes);
  const memberId = optionalUuid(input.memberId);

  if (title.length < 2) return badRequest("عنوان الخطة يجب أن يكون حرفين على الأقل");
  if (calories === null || protein === null || carbs === null || fat === null) {
    return badRequest("قيم السعرات أو الماكروز غير صالحة");
  }
  if (memberId === undefined) return badRequest("المشترك غير صالح");

  if (memberId) {
    const owner = await query(`select id from members where id = $1 and coach_id = $2`, [memberId, user.id]);
    if (!owner.rows[0]) return json({ error: "المشترك غير صالح" }, { status: 403 });
  }

  const result = await query(
    `insert into nutrition_plans(coach_id, member_id, title, calories, protein_g, carbs_g, fat_g, notes)
     values($1, $2, $3, $4, $5, $6, $7, $8)
     returning id, title, calories, protein_g as "proteinG", carbs_g as "carbsG", fat_g as "fatG",
               notes, member_id as "memberId"`,
    [user.id, memberId, title, calories, protein, carbs, fat, notes]
  );

  return json({ plan: result.rows[0] }, { status: 201 });
});
