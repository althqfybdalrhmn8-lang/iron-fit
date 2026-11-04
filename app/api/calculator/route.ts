import { badRequest, json, requireSameOrigin } from "@/lib/http";
import { intInRange, numberInRange } from "@/lib/validation";

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return badRequest("Invalid request origin");

  let body: unknown;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON"); }
  if (!body || typeof body !== "object") return badRequest("Invalid request");

  const input = body as Record<string, unknown>;
  const gender = input.gender === "female" ? "female" : "male";
  const age = intInRange(input.age, 14, 100);
  const weight = numberInRange(input.weightKg, 30, 300);
  const height = numberInRange(input.heightCm, 120, 230);
  const activity = numberInRange(input.activity, 1.2, 1.9);
  const goal = input.goal === "cut" || input.goal === "bulk" ? input.goal : "maintain";

  if (age === null || weight === null || height === null || activity === null) {
    return badRequest("Invalid calculator data");
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
}
