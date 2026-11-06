import { describe, it, expect } from "vitest";
import { execSummaryEmail } from "./exec-summary";
import type { DashboardData } from "@/lib/queries/assets";
import type { ReportTexts } from "@/lib/exec-summary-text";

const data = {
  kpis: { total: 249, critical: 1, warning: 5, healthy: 243, avgHealth: 98.9 },
  perSite: [],
  siteReliability: [],
  perType: [],
  topCritical: [],
  scopedAssets: [],
} as unknown as DashboardData;

const texts: ReportTexts = {
  headline: "มี 1 เครื่องต้องแก้ไขด่วนที่โรงงาน TSL",
  critical: [
    { asset: { id: "01-B01-A", name: "ADSORBER BLOWER A", site: "TSL" } as ReportTexts["critical"][0]["asset"], what: "น้ำมันเสื่อม", act: "เปลี่ยนน้ำมัน" },
  ],
  more: null,
  warning: "เครื่องเฝ้าระวัง 5 เครื่อง",
  recs: [{ tag: "Corrective · ≤ 2 สัปดาห์", text: "แก้ไขเครื่องจักรสภาวะวิกฤต 1 เครื่อง" }],
};

const base = {
  data,
  texts,
  verdict: { label: "ต้องดำเนินการแก้ไข", detail: "พบเครื่องจักรสภาวะวิกฤต 1 เครื่อง (TSL)", tone: "crit" as const },
  scopeLabel: "โรงงาน TSL",
  scopeCode: "TSL",
  typeLabel: "Executive Summary",
  reportNo: "UGT-LUB-2569-11-TSL-EXEC",
};

describe("execSummaryEmail", () => {
  it("subject names the report, plant and verdict — no score %", () => {
    const { subject } = execSummaryEmail(base);
    expect(subject).toMatch(/^\[UGT Lube\] Executive Summary · TSL · .+ · ต้องดำเนินการแก้ไข$/);
    expect(subject).not.toContain("%");
  });

  it("carries the verdict, summary, recommendations and report number", () => {
    const { html } = execSummaryEmail(base);
    expect(html).toContain("ผลการประเมิน (โรงงาน TSL): ต้องดำเนินการแก้ไข");
    expect(html).toContain("ADSORBER BLOWER A");
    expect(html).toContain("ข้อเสนอแนะ");
    expect(html).toContain("UGT-LUB-2569-11-TSL-EXEC");
    expect(html).not.toContain("แก้ไขโดยผู้จัดทำ");
  });

  it("says when the text was reworded", () => {
    expect(execSummaryEmail({ ...base, edited: true }).html).toContain("ข้อความบางส่วนแก้ไขโดยผู้จัดทำ");
  });

  it("escapes the note and edited text (XSS guard)", () => {
    const { html } = execSummaryEmail({
      ...base,
      texts: { ...texts, headline: "<img src=x onerror=alert(1)>" },
      note: "<script>alert(1)</script> & ok",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; ok");
  });
});
