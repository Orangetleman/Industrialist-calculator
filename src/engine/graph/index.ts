// Modèle de l'éditeur de graphe (PLAN-GRAPHE.md, lot G1) : pur TypeScript, sans DOM.
export * from "./model.ts";
export { recipePorts, mainOutput, type GraphWorld, type Ports } from "./ports.ts";
export { balanceGraph, wholeOf, type GraphBalance, type NodeBalance, type PortBalance, type ItemGap, type GraphTotals } from "./balance.ts";
export * from "./edit.ts";
export { planToGraph, type PlanGraph } from "./from-plan.ts";
export { graphToRequest, solveFromGraph, compareWithPlan, applyComparison, type GraphRequest, type GraphSolve, type GraphComparison, type NodeChange } from "./solve-from-graph.ts";
export { writeGraphFile, readGraphFile, GRAPH_FORMAT, GRAPH_VERSION, type FileWarning } from "./file.ts";
export { exportPollywrath, invertPollywrathMap, type PollywrathExport, type PollywrathSave, type PollywrathMapFile } from "./pollywrath-export.ts";
export { groupCommand, groupPorts, proxyMember, collapsedOwners, liveGroups, membersOf, nextGroupId, type ProxyPort } from "./groups.ts";
export { pollywrathToGraph, type PollywrathGraph } from "./pollywrath-graph.ts";
