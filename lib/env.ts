function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const env = {
  get databaseUrl() { return required("DATABASE_URL"); },
  get securityPepper() { return required("SECURITY_PEPPER"); },
  get sessionCookieName() { return process.env.SESSION_COOKIE_NAME || "ironfit_session"; },
  get appUrl() { return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"; }
};
