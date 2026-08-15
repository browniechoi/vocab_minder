import type { PlanTier } from "@/lib/app-types";

export const PLAN_LIMITS: Record<PlanTier, number> = {
  free: 500,
  pro: 5000,
};
