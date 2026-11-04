"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

// Shared "fetch rows → download as .xlsx" handler — the busy-state/try/toast
// wiring around lib/export-xlsx.ts's downloadXlsx was copy-pasted near-verbatim
// across the Assets/Work Orders/Budget/Users export buttons; this is the one
// place that logic lives now, so a future change to the busy state or toast
// wording only needs to happen here.
export function useXlsxExport<T>(
  fetchRows: () => Promise<T[]>,
  opts: {
    filenamePrefix: string;
    sheet: string;
    headers: string[];
    mapRow: (row: T) => (string | number | null | undefined)[];
  },
) {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  async function run() {
    setExporting(true);
    try {
      const rows = await fetchRows();
      // Dynamically imported (not a top-level import) so the xlsx library
      // stays out of the initial bundle for pages that may never export.
      const { downloadXlsx } = await import("@/lib/export-xlsx");
      downloadXlsx(
        `${opts.filenamePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`,
        opts.sheet,
        opts.headers,
        rows.map(opts.mapRow),
      );
      toast(`ส่งออก ${rows.length} รายการสำเร็จ`, "success");
    } catch {
      toast("ส่งออกไม่สำเร็จ", "error");
    } finally {
      setExporting(false);
    }
  }

  return { exporting, run };
}
