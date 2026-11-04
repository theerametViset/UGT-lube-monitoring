import { getDashboardData } from "@/lib/queries/assets";
import { getAlarmConfig } from "@/lib/queries/alarms";
import { ReportDoc, type ReportConfig } from "@/components/reports/ReportDoc";

export const dynamic = "force-dynamic";

// (AUD-023) Cap the AI summary size carried in the URL.
const MAX_SUMMARY = 20000;

interface PageProps {
  searchParams: {
    site?: string;
    period?: string;
    type?: string;
    prepared?: string;
    reviewed?: string;
    approved?: string;
    summary?: string;
    summarySource?: string;
  };
}

export default async function PrintReportPage({ searchParams }: PageProps) {
  const config: ReportConfig = {
    type: (searchParams.type as ReportConfig["type"]) || "exec",
    period: searchParams.period || "ytd",
    site: searchParams.site || "",
    prepared: searchParams.prepared || "Senior Reliability Engineer",
    reviewed: searchParams.reviewed || "Maintenance Manager",
    approved: searchParams.approved || "Plant Manager",
  };

  const [{ data }, alarm] = await Promise.all([
    getDashboardData(""),
    getAlarmConfig(),
  ]);

  return (
    <div className="min-h-screen bg-bg py-6">
      <ReportDoc
        data={data}
        alarm={alarm}
        config={config}
        autoPrint
        showToolbar
        execSummaryOverride={(searchParams.summary || "").slice(0, MAX_SUMMARY) || undefined}
        execSummarySource={
          searchParams.summarySource ? searchParams.summarySource.slice(0, 32) : undefined
        }
      />
    </div>
  );
}
