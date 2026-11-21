// Small FICTIONAL lookup used for sector / fund-overlap maths. Not real funds.
export interface SampleFund {
  sectors: Record<string, number>; // % of the fund, sums to 100
  top: Record<string, number>; // underlying name -> % weight
}

export const SAMPLE_FUNDS: Record<string, SampleFund> = {
  "Sample Equity Fund A": {
    sectors: { Financials: 55, IT: 20, Energy: 10, Consumer: 15 },
    top: { "Sample Bank P": 12, "Sample Bank Q": 10, "Sample Tech R": 9, "Sample Energy S": 8, "Sample Bank T": 8, "Sample Tech U": 6, "Sample Consumer V": 5, "Sample Finance W": 5 },
  },
  "Sample Equity Fund B": {
    sectors: { Financials: 50, IT: 25, Energy: 12, Consumer: 13 },
    top: { "Sample Bank P": 11, "Sample Bank Q": 11, "Sample Tech R": 8, "Sample Energy S": 7, "Sample Bank T": 9, "Sample Tech U": 7, "Sample Finance W": 6, "Sample Auto X": 4 },
  },
  "Sample Index Fund C": {
    sectors: { Financials: 40, IT: 20, Energy: 15, Consumer: 15, Healthcare: 10 },
    top: { "Sample Bank P": 9, "Sample Tech R": 7, "Sample Energy S": 6, "Sample Bank Q": 6, "Sample Health Y": 4 },
  },
  "Sample Debt Fund A": { sectors: { Debt: 100 }, top: {} },
  "Sample Gold Fund A": { sectors: { Gold: 100 }, top: {} },
  "Sample Stock Tip A": { sectors: { IT: 100 }, top: { "Sample Stock Tip A": 100 } },
  "Sample Stock Tip B": { sectors: { Consumer: 100 }, top: { "Sample Stock Tip B": 100 } },
  "Sample Stock Tip C": { sectors: { Energy: 100 }, top: { "Sample Stock Tip C": 100 } },
  "Sample Equity Fund D": {
    sectors: { Financials: 30, IT: 20, Healthcare: 20, Industrials: 30 },
    top: { "Sample Health Y": 8, "Sample Industry Z": 8 },
  },
};

export const UNKNOWN_SECTOR = "Other";
