import { z } from "zod";

const n = z.number().finite().min(0).max(1e10);
const id = z.string().min(1).max(40);

export const ProfileSchema = z.object({
  id,
  name: z.string().max(60),
  age: z.number().int().min(0).max(120),
  city: z.string().max(60),
  cityTier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  language: z.enum(["en", "hi", "ta"]),
  incomeStable: z.boolean(),
  monthlyIncome: n,
  essentialExpenses: n,
  otherExpenses: n,
  dependents: z.number().int().min(0).max(20),
  familySize: z.number().int().min(1).max(30),
  liquidSavings: n,
  goals: z
    .array(
      z.object({
        id,
        kind: z.enum(["home", "education", "retirement", "travel", "wedding", "other"]),
        targetAmount: n,
        years: z.number().min(0.5).max(60),
        // Savings already set aside for this goal. Without it here, Zod would silently strip the field and the
        // engine behind /api/ai would work out the monthly amount as if nothing had been saved.
        savedSoFar: n.optional(),
      }),
    )
    .max(6),
  debts: z.array(z.object({ id, label: z.string().max(60), outstanding: n, ratePct: z.number().min(0).max(100), emi: n })).max(8),
  insurance: z.array(z.object({ id, kind: z.enum(["term", "health"]), cover: n })).max(8),
  holdings: z
    .array(z.object({ id, label: z.string().max(80), assetClass: z.enum(["equity", "debt", "gold", "international_equity", "other"]), amount: n }))
    .max(30),
  risk: z.object({ onFall: z.enum(["sell", "wait", "buy"]), followsTips: z.boolean() }),
  // optional inputs the engine reads; without them here Zod would strip them and /api/ai would compute different numbers
  incomeMonths: z.object({ good: n, bad: n, history: z.array(n).max(12).optional() }).optional(),
  employerTermCover: n.optional(),
  confirmed: z.array(z.string().max(30)).max(30).optional(),
  isSynthetic: z.literal(true),
});

export const RequestSchema = z.object({
  task: z.enum(["explainFindings", "draftPlanPack", "secondOpinion", "adviserCopilot", "nudgeCopy", "answerQuestion"]),
  language: z.enum(["en", "hi", "ta"]),
  profile: ProfileSchema.optional(),
  text: z.string().max(4000).optional(),
  question: z.string().max(500).optional(),
  nudge: z
    .object({ ruleId: z.enum(["cash_flow", "ef_low", "insurance_gap", "sip_review", "rebalance"]), goalId: z.string().max(40).optional() })
    .optional(),
});
