import { Card } from "@/components/ui/primitives";
import type { HistoryEntry } from "@/lib/asset-history";

const when = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export function HistoryTab({ entries }: { entries: HistoryEntry[] }) {
  return (
    <Card>
      <h2 className="mb-1 font-sans text-[18px] max-sm:text-[16px] font-semibold">ประวัติการแก้ไข</h2>
      <p className="mb-2.5 text-[13px] text-t3">การแก้ข้อมูลเครื่อง ผลแล็บ และเกณฑ์เฉพาะเครื่อง ใหม่สุดอยู่บน</p>
      {entries.length === 0 ? (
        <div className="py-6 text-center text-[14px] text-t3">ยังไม่มีประวัติการแก้ไขของเครื่องนี้</div>
      ) : (
        <ol className="divide-y divide-border">
          {entries.map((e) => (
            <li key={e.id} className="grid gap-x-4 gap-y-0.5 py-2 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
              <div className="text-[13px] text-t3">
                <div>{when(e.at)}</div>
                <div className="truncate" title={e.who}>{e.who}</div>
              </div>
              <div className="min-w-0 text-[14px]">
                <div className="font-semibold">{e.what}</div>
                {e.changes.length === 0 ? (
                  <div className="text-t3">ไม่มีค่าที่เปลี่ยน</div>
                ) : (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-t2">
                    {e.changes.map((c) => (
                      <span key={c.field}>
                        {c.field}: <span className="text-t3">{c.from}</span> → <span className="font-semibold text-t1">{c.to}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
