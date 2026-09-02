import { ReportsViewContainer } from "@/components/reports/ReportsViewContainer";
import { getReportData } from "@/server/actions/report.actions";
import { getCurrentSession } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const reportData = await getReportData();

  return (
    <ReportsViewContainer
      initialData={reportData}
    />
  );
}
