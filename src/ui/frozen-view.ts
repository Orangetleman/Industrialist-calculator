// L'usine figée d'un fichier .indus (PLAN-PARTAGE.md, P4) : dessinée telle quelle, sans rien recalculer. Pur.

import { dims, geo, type Layout, type SbCatalog } from "../engine/sandbox/index.ts";
import { blockMarkup, compactBatch, PORT_COL, type DrawCtx } from "./sandbox-draw.ts";

const PX = 16;
/** Au-delà, les bâtiments se dessinent en quelques tracés (comme le bac à sable dézoomé). */
const MANY = 6000;

/** `unknown` : bâtiments que le site ne connaît plus (comptés, pas dessinés). */
export function frozenSvg(L: Layout, c: Pick<DrawCtx, "cat" | "img" | "itemName">): { svg: string; width: number; height: number; unknown: number } {
  const cat: SbCatalog = c.cat;
  const blocks = L.blocks.filter((b) => cat.blocks.has(b.id));
  const ctx: DrawCtx = { ...c, status: false, compact: blocks.length > MANY };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of blocks) {
    const [w, h] = dims(cat.blocks.get(b.id)!, b.r);
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + w);
    y1 = Math.max(y1, b.y + h);
  }
  if (!blocks.length) x0 = y0 = x1 = y1 = 0;
  const W = (x1 - x0 + 2) * PX, H = (y1 - y0 + 2) * PX;
  const byU = new Map(blocks.map((b) => [b.u, b]));
  // Grande usine : tuyaux en quelques tracés, mais les machines gardent image et nom (sinon des rectangles gris).
  const pipes = ctx.compact ? blocks.filter((b) => cat.blocks.get(b.id)!.pipe) : [];
  const rest = ctx.compact ? blocks.filter((b) => !cat.blocks.get(b.id)!.pipe) : blocks;
  const body = (pipes.length ? compactBatch(ctx, pipes, () => undefined) : "") + rest.map((b) => blockMarkup({ ...ctx, compact: rest.length > MANY }, b)).join("");
  const wires = L.wires
    .map((w) => {
      const A = byU.get(w.a), B = byU.get(w.b);
      const pa = A && geo(cat.blocks.get(A.id)!, A)?.ports[w.ia], pb = B && geo(cat.blocks.get(B.id)!, B)?.ports[w.ib];
      return pa && pb ? `<line x1="${pa.px}" y1="${pa.py}" x2="${pb.px}" y2="${pb.py}" stroke="${PORT_COL[w.t]}" stroke-width=".08" stroke-opacity=".85"/>` : "";
    })
    .join("");
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" class="u-frozen" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><g transform="scale(${PX}) translate(${1 - x0} ${1 - y0})">${body}${wires}</g></svg>`,
    width: W,
    height: H,
    unknown: L.blocks.length - blocks.length,
  };
}
