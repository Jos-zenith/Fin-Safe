// An ILLUSTRATIVE unit-economics calculator. Every default is a made-up number chosen to make the arithmetic visible.
// None is data, none is a forecast, and the page that shows it says so. Change the inputs to see how the answer moves.
export interface UnitInputs {
  /** What an hour of adviser time costs the firm, in rupees. */
  adviserCostPerHour: number;
  /** Minutes an adviser spends reviewing one AI draft. */
  minutesPerReview: number;
  /** Share of drafts (0-100) that need real rework and a second pass. */
  reworkPercent: number;
  /** Extra minutes for a reworked draft. */
  reworkMinutes: number;
  /** AI and hosting cost per plan, in rupees. */
  aiCostPerPlan: number;
  /** Reviewed plans per client per year. */
  plansPerClientPerYear: number;
  /** Price the client (or the firm's client) pays per year, in rupees. */
  pricePerClientPerYear: number;
  /** Fixed cost per client per year (support, compliance, onboarding), in rupees. */
  otherCostPerClientPerYear: number;
  /** Hours an adviser can bill to reviews per working day. */
  reviewHoursPerDay: number;
}

export const DEFAULT_INPUTS: UnitInputs = {
  adviserCostPerHour: 1000,
  minutesPerReview: 15,
  reworkPercent: 20,
  reworkMinutes: 15,
  aiCostPerPlan: 20,
  plansPerClientPerYear: 2,
  pricePerClientPerYear: 3000,
  otherCostPerClientPerYear: 500,
  reviewHoursPerDay: 5,
};

export interface UnitOutputs {
  expectedMinutesPerPlan: number;
  costPerReviewedPlan: number;
  plansPerAdviserDay: number;
  costPerClientPerYear: number;
  marginPerClientPerYear: number;
  marginPercent: number | null;
  breakEvenPricePerClient: number;
  clientsPerAdviser: number;
}

const WORKING_DAYS = 220;

/** Pure arithmetic; no hidden assumptions beyond the stated 220 working days a year. */
export function unitEconomics(i: UnitInputs): UnitOutputs {
  const expectedMinutesPerPlan = i.minutesPerReview + (i.reworkPercent / 100) * i.reworkMinutes;
  const costPerReviewedPlan = (expectedMinutesPerPlan / 60) * i.adviserCostPerHour + i.aiCostPerPlan;
  const costPerClientPerYear = costPerReviewedPlan * i.plansPerClientPerYear + i.otherCostPerClientPerYear;
  const marginPerClientPerYear = i.pricePerClientPerYear - costPerClientPerYear;
  const plansPerAdviserDay = expectedMinutesPerPlan > 0 ? (i.reviewHoursPerDay * 60) / expectedMinutesPerPlan : 0;
  const plansPerAdviserYear = plansPerAdviserDay * WORKING_DAYS;
  return {
    expectedMinutesPerPlan,
    costPerReviewedPlan,
    plansPerAdviserDay,
    costPerClientPerYear,
    marginPerClientPerYear,
    marginPercent: i.pricePerClientPerYear > 0 ? (marginPerClientPerYear / i.pricePerClientPerYear) * 100 : null,
    breakEvenPricePerClient: costPerClientPerYear,
    clientsPerAdviser: i.plansPerClientPerYear > 0 ? plansPerAdviserYear / i.plansPerClientPerYear : 0,
  };
}
