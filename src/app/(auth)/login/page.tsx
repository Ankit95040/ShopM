import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentSession } from "@/server/auth";

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) redirect("/");

  return <LoginForm />;
}
