import { describe, it, expect } from "vitest";
import {
  AssetIdSchema,
  StandardQuerySchema,
  SearchQuerySchema,
  CompareQuerySchema,
} from "./validation";

describe("AssetIdSchema", () => {
  it("accepts a valid asset id", () => {
    expect(AssetIdSchema.safeParse({ assetId: "34-U02-B" }).success).toBe(true);
  });
  it("rejects an empty assetId", () => {
    expect(AssetIdSchema.safeParse({ assetId: "" }).success).toBe(false);
  });
  it("rejects an assetId over 50 chars", () => {
    expect(AssetIdSchema.safeParse({ assetId: "a".repeat(51) }).success).toBe(false);
  });
  it("rejects a missing assetId", () => {
    expect(AssetIdSchema.safeParse({}).success).toBe(false);
  });
});

describe("StandardQuerySchema", () => {
  it("accepts id alone (question optional)", () => {
    expect(StandardQuerySchema.safeParse({ id: "std-1" }).success).toBe(true);
  });
  it("accepts id with a question", () => {
    expect(StandardQuerySchema.safeParse({ id: "std-1", question: "limits?" }).success).toBe(true);
  });
  it("rejects a question over 1000 chars", () => {
    expect(StandardQuerySchema.safeParse({ id: "std-1", question: "a".repeat(1001) }).success).toBe(false);
  });
  it("rejects a missing id", () => {
    expect(StandardQuerySchema.safeParse({ question: "x" }).success).toBe(false);
  });
});

describe("SearchQuerySchema", () => {
  it("accepts an empty query", () => {
    expect(SearchQuerySchema.safeParse({ q: "" }).success).toBe(true);
  });
  it("rejects a query over 100 chars", () => {
    expect(SearchQuerySchema.safeParse({ q: "a".repeat(101) }).success).toBe(false);
  });
});

describe("CompareQuerySchema", () => {
  it("accepts a valid id", () => {
    expect(CompareQuerySchema.safeParse({ id: "34-U02-B" }).success).toBe(true);
  });
  it("rejects an empty id", () => {
    expect(CompareQuerySchema.safeParse({ id: "" }).success).toBe(false);
  });
});
