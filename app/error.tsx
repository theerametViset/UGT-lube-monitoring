"use client";

import { Settings, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="th">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f5f5f7" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
          <Settings size={48} color="#7a7a7a" style={{ marginBottom: 16 }} aria-hidden />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1d1d1f", margin: "0 0 8px" }}>
            เกิดข้อผิดพลาดในระบบ
          </h1>
          <p style={{ fontSize: 13, color: "#7a7a7a", margin: "0 0 20px", textAlign: "center", maxWidth: 400 }}>
            {error.message || "Unexpected error occurred"}
          </p>
          <button
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 24px",
              background: "#0066cc",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={14} aria-hidden />ลองอีกครั้ง
          </button>
        </div>
      </body>
    </html>
  );
}
