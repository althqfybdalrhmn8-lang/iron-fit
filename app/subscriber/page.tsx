import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import IronFitApp from "@/components/IronFitApp";

export default async function SubscriberPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "SUBSCRIBER") redirect("/dashboard");
  return <IronFitApp user={user} />;
}
