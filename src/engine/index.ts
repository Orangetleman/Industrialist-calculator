// API publique du moteur (pur TypeScript, sans DOM).
export * from "./types.ts";
export { buildGameData, applyOverrides, itemName, type GameData, type RawFiles } from "./data.ts";
export { isNodeUnlocked, missingNodes, machineAccess, unlockUpTo, inconsistentNodes, nodeDepths, dependentsOf, rpCost, orderByDepth, type Progress, type MachineAccess, type ReqItem } from "./unlock.ts";
export { treeGrowthSeconds, formulaSeconds, type TreeGrowthResult } from "./pollution.ts";
export { evalRecipe, ratePerMachine, machineArea, type Criterion, type Candidate, type CandidateStatus, type LeafReason } from "./choose.ts";
export { solve, type Plan, type PlayerState, type SolveRequest, type Step, type Flow, type Edge, type Surplus, type Unresolved, type VerifyEntry, type Warning, type Economy } from "./solve.ts";
