import { describe, it, expect } from "vitest";
import { execSummaryEmail } from "./exec-summary";
import type { DashboardData } from "@/lib/queries/assets";

const data = {
  kpis: { total: 10, critical: 2, warning: 1, healthy: 7, avgHealth: 80 },
  perSite: [],
  siteReliability: [],
  perType: [],
  topCritical: [],
  scopedAssets: [],
} as unknown as DashboardData;

describe("execSummaryEmail", () => {
  it("escapes HTML in the summary (XSS guard)", () => {
    const { html } = execSummaryEmail({
      data,
      summary: "<script>alert(1)</script> & <b>bold</b>",
      source: "fallback",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("&amp;");
  });

  it("escapes asset ids/names in the top-critical table", () => {
    const d = {
      ...data,
      topCritical: [
        { id: "RE-<x>", name: "<img src=x onerror=alert(1)>", site: "UT", health: 10 },
      ],
    } as unknown as DashboardData;
    const { html } = execSummaryEmail({ data: d, summary: "ok", source: "fallback" });
    expect(html).toContain("&lt;x&gt;");
    expect(html).not.toContain("<img");
  });

  it("includes KPIs and the summary text", () => {
    const { subject, html } = execSummaryEmail({
      data,
      summary: "ภาพรวมกองเครื่องจักร",
      source: "fallback",
    });
    expect(subject).toContain("80%");
    expect(html).toContain("ภาพรวมกองเครื่องจักร");
  });

  it("maps provider source names", () => {
    const { html } = execSummaryEmail({ data, summary: "s", source: "openai" });
    expect(html).toContain("OpenAI");
  });
});
