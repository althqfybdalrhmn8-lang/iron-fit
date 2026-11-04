import { requireUser } from "@/lib/auth";
import { badRequest, json, readJsonObject, requireSameOrigin, route } from "@/lib/http";
import { intInRange, numberInRange } from "@/lib/validation";

export const POST = route(async (request: Request) => {
  if (!requireSameOrigin(request)) return badRequest("مصدر الطلب غير صالح");
  await requireUser();

  const input = await readJsonObject(request);
  if (!input) return badRequest("طلب غير صالح");
  const gender = input.gender === "female" ? "female" : "male";
  const age = intInRange(input.age, 14, 100);
  const weight = numberInRange(input.weightKg, 30, 300);
  const height = numberInRange(input.heightCm, 120, 230);
  const activity = numberInRange(input.activity, 1.2, 1.9);
  const goal = input.goal === "cut" || input.goal === "bulk" ? input.goal : "maintain";

  if (age === null || weight === null || height === null || activity === null) {
    return badRequest("تحقق من القيم: العمر 14-100، الوزن 30-300، الطول 120-230");
  }

  const bmr = gender === "male"
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const tdee = bmr * activity;
  let calories = tdee;
  if (goal === "cut") calories *= 0.8;
  if (goal === "bulk") calories *= 1.1;

  const protein = Math.round(weight * 2);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return json({
    calories: Math.round(calories), bmr: Math.round(bmr), tdee: Math.round(tdee), protein, carbs, fat
  });
});
