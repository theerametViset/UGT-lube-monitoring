import { describe, expect, it } from "vitest";
import { NAV_SECTIONS, sectionsFor } from "./nav";

const hrefs = (items: { href: string }[]) => items.map((i) => i.href);

describe("sectionsFor (role sidebar layout, 0034)", () => {
  it("keeps the original sidebar without a layout", () => {
    expect(sectionsFor(null)).toBe(NAV_SECTIONS);
    expect(sectionsFor(["/admin"])).toBe(NAV_SECTIONS);
    expect(sectionsFor(["/nope"])).toBe(NAV_SECTIONS);
  });

  it("puts the role's links on top in order and folds the rest under อื่นๆ", () => {
    const [mine, more, admin] = sectionsFor(["/reports", "/dashboard"]);
    expect(hrefs(mine.items)).toEqual(["/reports", "/dashboard"]);
    expect(more.collapsible && more.defaultCollapsed).toBe(true);
    expect(hrefs(more.items)).toEqual(hrefs(NAV_SECTIONS[0].items).filter((h) => h !== "/reports" && h !== "/dashboard"));
    expect(admin.id).toBe("admin");
    expect(admin.defaultCollapsed).toBe(true);
  });

  it("opens the Admin group when the layout lists /admin, and never drops a link", () => {
    const s = sectionsFor(["/dashboard", "/admin"]);
    expect(s.find((x) => x.id === "admin")?.defaultCollapsed).toBe(false);
    expect(s.flatMap((x) => hrefs(x.items)).sort()).toEqual(NAV_SECTIONS.flatMap((x) => hrefs(x.items)).sort());
  });
});
