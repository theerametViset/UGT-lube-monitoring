import { z } from "zod";

export const AssetIdSchema = z.object({ assetId: z.string().trim().min(1).max(50) });

export const StandardQuerySchema = z.object({
  id: z.string().trim().min(1).max(50),
  question: z.string().trim().max(1000).optional(),
});

export const SearchQuerySchema = z.object({ q: z.string().trim().max(100) });

export const CompareQuerySchema = z.object({ id: z.string().trim().min(1).max(50) });
