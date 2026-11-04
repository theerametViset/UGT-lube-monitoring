"use client";

import { TriangleAlert, RotateCcw } from "lucide-react";

export function RouteError({
  error,
  reset,
  label,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  label: string;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6">
      <TriangleAlert className="h-10 w-10 text-yellow" aria-hidden />
      <h1 className="mt-2 font-sans text-[18px] font-bold text-t1">โหลด{label}ไม่สำเร็จ</h1>
      <p className="mt-1 max-w-[400px] text-center text-[13px] text-t3">
        {error.message || "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่"}
      </p>
      <button
        onClick={reset}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-cyan px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-cyan-focus"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />ลองอีกครั้ง
      </button>
    </div>
  );
}
