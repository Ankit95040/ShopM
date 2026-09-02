import { redirect } from "next/navigation";
import { ForgotPasswordWizard } from "@/components/auth/ForgotPasswordWizard";
import { getCurrentSession } from "@/server/auth";

export default async function ForgotPasswordPage() {
  const session = await getCurrentSession();
  if (session) redirect("/");
  return <ForgotPasswordWizard />;
}
