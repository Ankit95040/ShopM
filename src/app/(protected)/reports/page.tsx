import { Suspense } from "react";
import { ReportsViewContainer } from "@/components/reports/ReportsViewContainer";
import { getReportData } from "@/server/actions/report.actions";

export const dynamic = "force-dynamic";

function ReportsSkeleton() {
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-10 w-24 bg-slate-200 rounded-lg" />
          <div className="h-10 w-24 bg-slate-200 rounded-lg" />
          <div className="h-10 w-24 bg-slate-200 rounded-lg" />
        </div>
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
    </div>
  );
}

async function ReportsContent() {
  const reportData = await getReportData();
  return <ReportsViewContainer initialData={reportData} />;
}

export default function ReportsPage() {
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <Suspense fallback={<ReportsSkeleton />}>
        <ReportsContent />
      </Suspense>
    </div>
  );
}
