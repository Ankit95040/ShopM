import { Navbar } from "@/components/shared/Navbar";
import { ToastProvider } from "@/components/shared/ToastContext";
import { DemoBanner } from "@/components/shared/DemoBanner";
import { requireEffectiveAuth } from "@/server/auth";
import { runWithAuth } from "@/server/auth-context";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return runWithAuth(async () => {
    const session = await requireEffectiveAuth();

    return (
      <ToastProvider>
        {session.isGuest && <DemoBanner />}
        <Navbar userName={session.userName} role={session.role} />
        <main className="flex-1">{children}</main>
      </ToastProvider>
    );
  });
}
