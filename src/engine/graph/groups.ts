// Groupes repliables de l'éditeur (PLAN-GRAPHE.md § 3, lot G5) : sélection multiple → « Grouper ».
// Un groupe replié se montre comme une seule boîte ; ses prises mandataires sont ce que le groupe reçoit
// du reste du graphe (ou qui lui manque) et ce qu'il lui donne (ou qu'il a en trop). Purement visuel :
// l'équilibre et « Recalculer » voient toujours les nœuds. Pur, sans DOM.

import type { GraphBalance } from "./balance.ts";
import type { Graph, GraphCommand, GraphGroup, NodeId } from "./model.ts";
import type { PortRef, Side } from "./edit.ts";

const EPS = 1e-7;

/** Identifiant libre : g1, g2… (au-dessus des groupes et des marques laissées sur les nœuds). */
export function nextGroupId(g: Graph): string {
  let max = 0;
  for (const id of [...(g.groups ?? []).map((x) => x.id), ...g.nodes.map((n) => n.group ?? "")]) {
    const m = /^g(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `g${max + 1}`;
}

/** « Grouper » : au moins deux nœuds (un seul ne vaut pas un groupe) ; null sinon. */
export function groupCommand(g: Graph, nodes: Iterable<NodeId>, name: (n: number) => string): GraphCommand | null {
  const ids = [...new Set(nodes)].filter((id) => g.nodes.some((n) => n.id === id));
  if (ids.length < 2) return null;
  const id = nextGroupId(g);
  return { type: "group", id, name: name(Number(id.slice(1))), nodes: ids };
}

export function membersOf(g: Graph, gid: string): NodeId[] {
  return g.nodes.filter((n) => n.group === gid).map((n) => n.id);
}

/** Groupes qui ont au moins un nœud. */
export function liveGroups(g: Graph): GraphGroup[] {
  return (g.groups ?? []).filter((x) => g.nodes.some((n) => n.group === x.id));
}

/** Nœud → groupe replié qui le cache. */
export function collapsedOwners(g: Graph): Map<NodeId, string> {
  const shut = new Set(liveGroups(g).filter((x) => x.collapsed).map((x) => x.id));
  const out = new Map<NodeId, string>();
  for (const n of g.nodes) if (n.group && shut.has(n.group)) out.set(n.id, n.group);
  return out;
}

/** Prise mandataire : produit, débit voulu (entrée) ou produit (sortie) vers l'extérieur, ce qui passe, liaisons extérieures. */
export type ProxyPort = { item: string; perMin: number; flow: number; links: number };

/**
 * Prises mandataires d'un groupe. Entrée : ce que ses nœuds demandent et que les autres nœuds du groupe ne
 * fournissent pas (débit voulu), et ce qui arrive de l'extérieur. Sortie : ce que ses nœuds produisent et
 * que le groupe ne consomme pas lui-même, et ce qui part vers l'extérieur. Une prise sans besoin ni liaison
 * extérieure n'apparaît pas (tout se fait dedans).
 */
export function groupPorts(g: Graph, bal: GraphBalance, gid: string): { ins: ProxyPort[]; outs: ProxyPort[] } {
  const inside = new Set(membersOf(g, gid));
  const add = (m: Map<string, ProxyPort>, item: string, perMin: number, flow: number, links: number) => {
    const p = m.get(item) ?? { item, perMin: 0, flow: 0, links: 0 };
    p.perMin += perMin;
    p.flow += flow;
    p.links += links;
    m.set(item, p);
  };
  const ins = new Map<string, ProxyPort>();
  const outs = new Map<string, ProxyPort>();
  for (const id of inside) {
    const nb = bal.nodes.get(id);
    if (!nb) continue;
    for (const pb of nb.ins) {
      let fromIn = 0;
      let fromOut = 0;
      let links = 0;
      for (const e of g.edges) {
        if (e.to !== id || e.item !== pb.item) continue;
        const f = bal.edges.get(e.id) ?? 0;
        if (inside.has(e.from)) fromIn += f;
        else {
          fromOut += f;
          links++;
        }
      }
      if (pb.perMin - fromIn > EPS || links) add(ins, pb.item, Math.max(0, pb.perMin - fromIn), fromOut, links);
    }
    for (const pb of nb.outs) {
      let toIn = 0;
      let toOut = 0;
      let links = 0;
      for (const e of g.edges) {
        if (e.from !== id || e.item !== pb.item) continue;
        const f = bal.edges.get(e.id) ?? 0;
        if (inside.has(e.to)) toIn += f;
        else {
          toOut += f;
          links++;
        }
      }
      if (pb.perMin - toIn > EPS || links) add(outs, pb.item, Math.max(0, pb.perMin - toIn), toOut, links);
    }
  }
  return { ins: [...ins.values()], outs: [...outs.values()] };
}

/**
 * Nœud du groupe derrière une prise mandataire (relier, sélecteur filtré) : pour une entrée, celui à qui il
 * manque le plus de ce produit ; pour une sortie, celui qui en a le plus en trop ; à défaut, le premier qui a
 * la prise.
 */
export function proxyMember(g: Graph, bal: GraphBalance, gid: string, item: string, side: Side): PortRef | null {
  let best: { id: NodeId; gap: number } | null = null;
  for (const id of membersOf(g, gid)) {
    const nb = bal.nodes.get(id);
    const pb = (side === "in" ? nb?.ins : nb?.outs)?.find((p) => p.item === item);
    if (!pb) continue;
    const gap = pb.perMin - pb.flow;
    if (!best || gap > best.gap + EPS) best = { id, gap };
  }
  return best ? { node: best.id, item, side } : null;
}
