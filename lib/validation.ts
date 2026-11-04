export const limits = {
  name: 60, email: 254, message: 2000,
  programTitle: 120, programDescription: 2000,
  nutritionTitle: 120, nutritionNotes: 2000
} as const;

export function text(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export function email(value: unknown) {
  const valueText = text(value, limits.email).toLowerCase();
  if (!valueText || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valueText)) return null;
  return valueText;
}

export function numberInRange(value: unknown, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export function intInRange(value: unknown, min: number, max: number) {
  const n = numberInRange(value, min, max);
  return n === null ? null : Math.floor(n);
}
