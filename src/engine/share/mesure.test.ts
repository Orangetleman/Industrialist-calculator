// Mesure des tailles de lien sur de vrais designs (PLAN-PARTAGE.md § 2, lot P1). Hors de `npm test` :
//   $env:MESURE = "1"; npx vitest run src/engine/share/mesure.test.ts
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deflate, toBase64url } from "./bytes.ts";
import { designBody, encodeDesign, encodeDesignBytes, SITE_VERSION, type Design } from "./codec.ts";
import { editedGraph, editOf, factoryLayout, planFor, settingsWith } from "../../../tests/share-designs.ts";

const ORIGIN = "https://industrialist.myprisme.fr/#d=";

describe.runIf(process.env.MESURE === "1")("tailles de lien", () => {
  it("petit / moyen / gros", async () => {
    const cases: [string, string, number][] = [["petit", "gearbox", 120], ["moyen", "crankshaft", 600], ["gros", "crankshaft", 3600]];
    const rows: string[] = [];
    for (const [label, item, rate] of cases) {
      const plan = planFor(item, rate);
      const g = editedGraph(plan);
      const settings = settingsWith({ item, rate, rateUnit: "min", entered: ["objet"] });
      const graphOnly: Design = { site: SITE_VERSION, name: `${item} ${rate}/min`, settings, graph: editOf(`objet|${item}|rate|${rate}`, g, g) };
      const layout = factoryLayout(plan, { w: 220, h: 160 });
      const withSandbox: Design = { ...graphOnly, sandbox: layout };
      const file: Design = { ...withSandbox, factory: layout };
      const json = JSON.stringify(withSandbox);
      const jsonLink = toBase64url(await deflate(new TextEncoder().encode(json))).length;
      const link = async (d: Design) => (ORIGIN + (await encodeDesign(d))).length;
      rows.push(
        `| ${label} : ${item} ${rate}/min, ${g.nodes.length} nœuds, ${g.edges.length} arêtes, ${layout.blocks.length} blocs, ${layout.wires.length} câbles | ${json.length} o | ${jsonLink} car. | ${await link(graphOnly)} car. | ${await link(withSandbox)} car. | ${(await encodeDesignBytes(file)).length} o (brut ${designBody(file).length} o) |`,
      );
    }
    const table = ["| Design | JSON brut | JSON + deflate | Lien sans bac à sable | Lien avec bac à sable | Fichier .indus avec usine figée |", "|---|---|---|---|---|---|", ...rows].join("\n");
    console.log(table);
    if (process.env.MESURE_OUT) writeFileSync(process.env.MESURE_OUT, table + "\n");
    expect(rows).toHaveLength(3);
  }, 3_600_000);
});
