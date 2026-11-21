// Which heading each assumption is listed under (the assumptions page and the data-sources page share it).
export const GROUPS: [string, string][] = [
  ["ef.", "assump.g.reserve"],
  ["return.", "assump.g.goals"],
  ["inflation.", "assump.g.goals"],
  ["fee.", "assump.g.goals"],
  ["tax.", "assump.g.goals"],
  ["debt.", "assump.g.debt"],
  ["savings.", "assump.g.debt"],
  ["insurance.", "assump.g.insurance"],
  ["concentration.", "assump.g.portfolio"],
  ["alloc.", "assump.g.portfolio"],
  ["drag.", "assump.g.examples"],
  ["fall.", "assump.g.examples"],
  ["score.", "assump.g.summary"],
];
export const groupOf = (id: string) => GROUPS.find(([p]) => id.startsWith(p))?.[1] ?? "assump.g.other";
