import { PerformanceDashboard } from "./PerformanceDashboard";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  if (process.env.NODE_ENV !== "development") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500">Performance monitoring is only available in development.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PerformanceDashboard />
    </div>
  );
}
