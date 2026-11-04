import Link from "next/link";
import { History as HistoryIcon, ShieldCheck } from "lucide-react";
import { listAuditLog, RBAC_AUDIT_TABLES } from "@/lib/queries/audit-log";
import { hasPermission } from "@/lib/queries/permissions";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const ACTION_CLS: Record<string, string> = {
  INSERT: "badge-ok",
  UPDATE: "",
  DELETE: "badge-crit",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { rbac?: string };
}) {
  if (!(await hasPermission("audit:read"))) redirect("/dashboard");

  const rbacOnly = searchParams.rbac === "1";
  const logs = await listAuditLog(50, rbacOnly ? RBAC_AUDIT_TABLES : undefined);

  return (
    <div className="fade space-y-3">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 font-sans text-[22px] max-sm:text-[18px] font-bold"><HistoryIcon className="h-4 w-4" aria-hidden />Audit Trail (ประวัติการแก้ไข)</h2>
            <div className="text-[14px] text-t2">บันทึกการเปลี่ยนแปลงข้อมูลทุกครั้ง — ใช้สอบ ISO audit + traceability</div>
          </div>
          <div className="flex gap-1">
            <Link href="/admin/audit">
              <span className={`inline-flex items-center rounded-pill border px-2.5 py-1 text-[14px] font-semibold transition ${!rbacOnly ? "border-cyan bg-cyan/10 text-cyan" : "border-border text-t2"}`}>
                ทั้งหมด
              </span>
            </Link>
            <Link href="/admin/audit?rbac=1">
              <span className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-[14px] font-semibold transition ${rbacOnly ? "border-cyan bg-cyan/10 text-cyan" : "border-border text-t2"}`}>
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />Role/สิทธิ์ เท่านั้น
              </span>
            </Link>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="sticky top-0 border-b border-border bg-bg2 text-[13px] text-t3">
                <th scope="col" className="px-2.5 py-2">เวลา</th>
                <th scope="col">Action</th>
                <th scope="col">Table</th>
                <th scope="col">Record</th>
                <th scope="col">ผู้แก้</th>
                <th scope="col">รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={6} className="px-2.5 py-4 text-center text-t3">ยังไม่มีประวัติ</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-black/[0.025] hover:bg-cyan/[0.025]">
                    <td className="px-2.5 py-1.5 font-mono text-t3 whitespace-nowrap">{log.created_at?.slice(0, 19).replace("T", " ")}</td>
                    <td>
                      <span className={`badge ${ACTION_CLS[log.action] ?? ""}`} style={!ACTION_CLS[log.action] ? { background: "rgba(0,102,204,.12)", color: "#0066cc", border: "1px solid rgba(0,102,204,.3)" } : {}}>
                        {log.action}
                      </span>
                    </td>
                    <td className="font-mono text-t2">{log.table_name}</td>
                    <td className="font-mono text-cyan truncate max-w-[100px]">{log.record_id ?? "—"}</td>
                    <td className="text-t3 truncate max-w-[120px]">{log.user_email}</td>
                    <td className="text-t2 truncate max-w-[250px]">{log.summary}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
