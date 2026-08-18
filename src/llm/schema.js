const { z } = require("zod");

// Stage 1: input validation. Wrong type, missing field, or a title too
// long gets rejected here — before a single model call is spent.
const EnrichInputSchema = z.object({
  title: z
    .string({ required_error: "title is required" })
    .min(1, "title must not be empty")
    .max(200, "title must be 200 characters or fewer"),
});

// Closed lists, straight from JOB-CARD.md. Anything outside these is a
// validation failure, not a new category.
const CATEGORIES = ["bug", "feature", "chore", "docs", "other"];
const PRIORITIES = ["low", "medium", "high"];

// Stage 1: output schema. This is what the model's answer must match —
// whether it comes from the real model or from stub mode.
const EnrichOutputSchema = z.object({
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
});

module.exports = { EnrichInputSchema, EnrichOutputSchema, CATEGORIES, PRIORITIES };