import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import IronFitApp from "@/components/IronFitApp";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "COACH") redirect("/subscriber");
  return <IronFitApp user={user} />;
}
