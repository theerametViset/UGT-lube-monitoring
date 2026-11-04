import { describe, it, expect } from "vitest";
import { ruleBasedStandardSummary, ruleBasedStandardAnswer } from "./standard";
import type { Standard } from "@/lib/types";

const std: Standard = {
  id: "std-3",
  category: "VIBRATION",
  title: "ISO 10816-3:2009",
  subtitle: "Evaluation of machine vibration",
  description: "เกณฑ์ประเมินการสั่นสะเทือนเครื่องจักรด้วย Velocity RMS",
  full_text:
    "Zone A ≤2.3 · B 2.3–4.5 · C 4.5–7.1 · D >7.1 mm/s (15–300 kW)\nวัดที่ Bearing Housing ช่วง 10–1,000 Hz",
  tags: ["Velocity RMS Zone A–D", "Bearing Housing"],
  version: 3,
  updated_at: null,
  updated_by: null,
  related_params: ["vel", "acc"],
  asset_types: ["Electric Motor"],
  related_standard_ids: [],
};

describe("ruleBasedStandardSummary", () => {
  it("includes the description and key sentences", () => {
    const s = ruleBasedStandardSummary(std);
    expect(s).toContain("Velocity RMS");
    expect(s).toContain("Zone A ≤2.3");
    expect(s).toContain("Bearing Housing");
  });
});

describe("ruleBasedStandardAnswer", () => {
  it("returns the sentence containing the asked keyword", () => {
    const a = ruleBasedStandardAnswer(std, "เกณฑ์ Zone C คือเท่าไร");
    expect(a).toContain("C 4.5–7.1");
  });

  it("falls back to the summary when nothing matches", () => {
    const a = ruleBasedStandardAnswer(std, "ราคาน้ำมันวันนี้");
    expect(a).toContain("ไม่มีเนื้อหาที่ตรงกับคำถาม");
    expect(a).toContain("คำอธิบาย");
  });
});
