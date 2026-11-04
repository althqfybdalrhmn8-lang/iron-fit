import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  // Render per request so the CSP nonce from proxy.ts can be applied to scripts.
  await connection();
  const user = await getSessionUser();
  if (user) redirect(user.role === "COACH" ? "/dashboard" : "/subscriber");
  return <LoginForm />;
}
