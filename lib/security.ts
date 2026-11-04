import crypto from "node:crypto";

const SCRYPT_N = 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 64;

function scrypt(password: string, salt: string, N = SCRYPT_N, r = SCRYPT_R, p = SCRYPT_P): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEYLEN, { N, r, p, maxmem: 128 * 1024 * 1024 }, (error, key) => {
      if (error) { reject(error); return; }
      resolve(key.toString("base64url"));
    });
  });
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt);
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt, derived].join("$");
}

export async function verifyPassword(password: string, encoded: string) {
  try {
    const [algorithm, n, r, p, salt, expected] = encoded.split("$");
    if (algorithm !== "scrypt" || !n || !r || !p || !salt || !expected) return false;
    const actual = await scrypt(password, salt, Number(n), Number(r), Number(p));
    const a = Buffer.from(actual, "base64url");
    const b = Buffer.from(expected, "base64url");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;
/** A valid hash to verify against when the user doesn't exist, so response time doesn't reveal which emails are registered. */
export function getDummyHash() {
  dummyHash ??= hashPassword(crypto.randomBytes(16).toString("hex"));
  return dummyHash;
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashIdentifier(value: string, pepper: string) {
  return sha256(`${pepper}:${value.trim().toLowerCase()}`);
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 100);
  return request.headers.get("x-real-ip") || "unknown";
}
