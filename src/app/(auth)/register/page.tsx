import { redirect } from "next/navigation";
import { RegisterWizard } from "@/components/auth/RegisterWizard";
import { getCurrentSession } from "@/server/auth";

export default async function RegisterPage() {
  const session = await getCurrentSession();
  if (session) redirect("/");

  return <RegisterWizard />;
}
