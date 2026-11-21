// Non-financial settings live here. Financial figures are derived from the assumption registry
// (src/config/assumptions.ts), which is the single source of truth, so UI code can still read them.
import { av } from "./assumptions";

export const TO_VERIFY = "TO_VERIFY" as const;

export const CONSTANTS = {
  status: TO_VERIFY,
  emergencyMonths: { stable: av("ef.months.stable"), irregular: av("ef.months.irregular") },
  returns: { low: av("return.low"), base: av("return.base"), high: av("return.high") },
  highCostDebtRatePct: av("debt.highcost_threshold"),
  dtiHighPct: av("debt.dti_high"),
  savingsRateLowPct: av("savings.rate_low"),
  savingsRateTargetPct: av("savings.rate_target"),
  goldRangePct: { low: av("alloc.gold.low"), high: av("alloc.gold.high") },
  concentration: { sectorPct: av("concentration.sector_pct"), holdingPct: av("concentration.holding_pct"), overlapPct: av("concentration.overlap_pct") },
  drag: {
    corpus: av("drag.corpus"),
    years: av("drag.years"),
    returnPct: av("drag.return"),
    regularExpensePct: av("drag.expense_regular"),
    directExpensePct: av("drag.expense_direct"),
  },
  fallPct: av("fall.drop_pct"),
  idleMinutes: 30,
  rememberHours: 24,
} as const;
