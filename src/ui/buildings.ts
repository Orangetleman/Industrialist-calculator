// Éditeur de bâtiments (onglet « Bâtiments ») : relever l'empreinte et les ports d'un bâtiment
// directement sur une grille, en s'aidant d'une capture d'écran posée en fond.
// La capture reste dans le navigateur (jamais envoyée) ; les relevés sont gardés localement
// et s'exportent au format de data/ports.json.

import type { GameData } from "../engine/data.ts";
import type { Port, PortsEntry, PortsFile } from "../engine/extension-types.ts";
import { applyTool, bodyPoint, CELL, checkEntry, exportSurveys, marginToPort, parseSurveys, portCenter, surveySource, type Tool } from "./buildings-model.ts";
import { esc } from "./format.ts";

const KEY = "ind-calc:v1:batiments";

type Bg = { url: string; scale: number; x: number; y: number; rot: number; opacity: number; natW: number; natH: number };

export function initBuildings(root: HTMLElement, data: GameData, repo: PortsFile): void {
  let local: Record<string, PortsEntry> = load();
  let selectedId: string | null = null;
  let entry: PortsEntry | null = null;
  let tool: Tool = "objet";
  let direction: Port["direction"] = "entrée";
  let selectedPort: number | null = null;
  let filter = "";
  let bg: Bg | null = null;

  const machines = [...data.machines.values()].sort((a, b) => Number(a.kind === "building") - Number(b.kind === "building") || a.name.localeCompare(b.name));
  const surveyed = (id: string) => (local[id] ? "local" : repo.machines[id] ? "repo" : null);

  root.innerHTML = `
    <div class="bld">
      <aside class="bld-list panel">
        <label class="sr-only" for="bld-search">Chercher un bâtiment</label>
        <input id="bld-search" type="search" placeholder="Chercher un bâtiment…" autocomplete="off">
        <ul id="bld-items"></ul>
        <div class="actions">
          <button type="button" id="bld-export">Exporter mes relevés</button>
          <label class="button">Importer…<input type="file" id="bld-import" accept="application/json,.json" hidden></label>
        </div>
        <p class="hint" id="bld-io"></p>
      </aside>
      <div class="bld-main" id="bld-main"></div>
    </div>`;
  const $ = (sel: string) => root.querySelector(sel) as HTMLElement;

  function load(): Record<string, PortsEntry> {
    try {
      const r = parseSurveys(JSON.parse(localStorage.getItem(KEY) ?? "null"));
      return r ?? {};
    } catch {
      return {};
    }
  }
  function save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({ machines: local }));
    } catch {
      // stockage indisponible : le relevé vaut pour la session
    }
  }

  function renderList(): void {
    const q = filter.trim().toLowerCase();
    $("#bld-items").innerHTML = machines
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .slice(0, 120)
      .map((m) => {
        const s = surveyed(m.id);
        return `<li><button type="button" data-bld="${esc(m.id)}" class="${m.id === selectedId ? "on" : ""}">${esc(m.name)}${
          s ? `<span class="bld-badge ${s}" title="${s === "local" ? "relevé dans ce navigateur" : "relevé intégré aux données"}">${s === "local" ? "à envoyer" : "relevé"}</span>` : ""
        }</button></li>`;
      })
      .join("");
  }

  function select(id: string): void {
    selectedId = id;
    const m = data.machines.get(id)!;
    const base = local[id] ?? repo.machines[id];
    entry = base
      ? structuredClone(base)
      : { footprint: m.size ? { w: m.size.w, h: m.size.l } : { w: 2, h: 2 }, rotations: null, ports: [], source: surveySource() };
    selectedPort = null;
    renderList();
    renderEditor();
  }

  function svg(): string {
    const e = entry!;
    const w = e.footprint!.w;
    const h = e.footprint!.h;
    const W = (w + 2) * CELL;
    const H = (h + 2) * CELL;
    let s = `<svg id="bld-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grille du bâtiment : marge pour les ports, corps pour la prise électrique">`;
    if (bg) {
      const cx = bg.natW / 2;
      const cy = bg.natH / 2;
      s += `<g opacity="${bg.opacity}" transform="translate(${bg.x * CELL} ${bg.y * CELL}) scale(${bg.scale}) rotate(${bg.rot} ${cx} ${cy})"><image href="${bg.url}" width="${bg.natW}" height="${bg.natH}"/></g>`;
    }
    for (let gx = 0; gx < w + 2; gx++) {
      for (let gy = 0; gy < h + 2; gy++) {
        const inBody = gx >= 1 && gx <= w && gy >= 1 && gy <= h;
        const corner = (gx === 0 || gx === w + 1) && (gy === 0 || gy === h + 1);
        s += `<rect x="${gx * CELL}" y="${gy * CELL}" width="${CELL}" height="${CELL}" class="${inBody ? "bld-body" : corner ? "bld-corner" : "bld-margin"}"/>`;
      }
    }
    s += `<rect x="${CELL}" y="${CELL}" width="${w * CELL}" height="${h * CELL}" class="bld-outline"/>`;
    e.ports.forEach((p, i) => {
      const [x, y] = portCenter(w, h, p);
      const sel = i === selectedPort ? " sel" : "";
      if (p.side === "dessus") {
        s += `<g class="bld-port ${p.type}${sel}" data-port="${i}"><rect x="${x - 11}" y="${y - 11}" width="22" height="22" rx="3"/><text x="${x}" y="${y + 5}" text-anchor="middle">${p.type === "énergie" ? "⚡" : "◆"}</text></g>`;
        return;
      }
      const inward = { haut: "▼", bas: "▲", gauche: "▶", droite: "◀" }[p.side];
      const outward = { haut: "▲", bas: "▼", gauche: "◀", droite: "▶" }[p.side];
      const arrow = p.direction === "sortie" ? outward : inward;
      s += `<g class="bld-port ${p.type} ${p.direction === "sortie" ? "out" : "in"}${sel}" data-port="${i}"><rect x="${x - 13}" y="${y - 13}" width="26" height="26" rx="4"/><text x="${x}" y="${y + 6}" text-anchor="middle">${arrow}</text>${
        (p.stub ?? 1) !== 1 ? `<text x="${x + 10}" y="${y - 8}" class="bld-stub">${p.stub}</text>` : ""
      }</g>`;
    });
    return `${s}</svg>`;
  }

  function portForm(): string {
    if (selectedPort === null || !entry!.ports[selectedPort]) return `<p class="hint">Clique dans la marge grise pour poser une entrée ou une sortie, et sur le corps pour poser la prise électrique. Clique sur un port pour le modifier.</p>`;
    const p = entry!.ports[selectedPort]!;
    const where = p.side === "dessus" ? `dessus, case ${(p.cell as number[]).join(", ")}` : `${p.side}, case ${p.cell}`;
    return `<div class="bld-portform">
      <b>${esc(p.type)} · ${esc(where)}</b>
      ${p.type !== "énergie" ? `<label>Sens <select data-pf="direction"><option${p.direction === "entrée" ? " selected" : ""}>entrée</option><option${p.direction === "sortie" ? " selected" : ""}>sortie</option><option${p.direction === "les deux" ? " selected" : ""}>les deux</option></select></label>` : ""}
      <label>Info-bulle du jeu <input data-pf="tip" value="${esc(p.tip ?? "")}" placeholder="ex. Input for Coal or coke Fuel"></label>
      ${p.side !== "dessus" ? `<label>Plot (cases hors du bâtiment) <input data-pf="stub" type="number" min="0" max="4" step="1" value="${p.stub ?? 1}"></label>` : ""}
      <label>Ce que le jeu affiche <input data-pf="shown" value="${esc(p.shown ?? "")}" placeholder="ex. flèche violette vers le bas"></label>
      <button type="button" class="link" data-pf-del>Supprimer ce port</button>
    </div>`;
  }

  function renderEditor(): void {
    const main = $("#bld-main");
    if (!entry || !selectedId) {
      main.innerHTML = `<div class="panel"><h3>Éditeur de bâtiments</h3><p>Choisis un bâtiment dans la liste. Tu poses ses entrées, ses sorties et sa prise électrique sur une grille, en t'aidant d'une capture d'écran en vue de dessus. Les relevés sont gardés dans ce navigateur ; « Exporter mes relevés » produit un fichier à m'envoyer (ou à mettre dans <code>data/ports.json</code>).</p><p class="hint">1 case = 1 Short Pipe. Pose le bâtiment sans le faire pivoter.</p></div>`;
      return;
    }
    const m = data.machines.get(selectedId)!;
    const e = entry;
    const problems = checkEntry(e);
    main.innerHTML = `<div class="panel bld-editor">
      <div class="bld-head"><h3>${esc(m.name)}</h3><span class="hint">Taille wiki : ${m.size ? `${m.size.w}×${m.size.l}` : "—"} · ${surveyed(selectedId) === "repo" && !local[selectedId] ? "relevé intégré aux données" : surveyed(selectedId) === "local" ? "relevé local, à envoyer" : "pas encore relevé"}</span></div>
      <div class="bld-row">
        <label>Largeur (cases) <input type="number" min="1" max="200" id="bld-w" value="${e.footprint!.w}"></label>
        <label>Hauteur (cases) <input type="number" min="1" max="200" id="bld-h" value="${e.footprint!.h}"></label>
        <button type="button" id="bld-swap" title="Échanger largeur et hauteur">⇄</button>
        <label>Rotations <select id="bld-rot"><option value="">?</option>${[1, 2, 4].map((r) => `<option${e.rotations === r ? " selected" : ""}>${r}</option>`).join("")}</select></label>
      </div>
      <div class="bld-tools" role="toolbar" aria-label="Outils">
        ${(["objet", "fluide", "énergie", "logique", "gomme"] as Tool[]).map((t) => `<button type="button" data-tool="${t}" aria-pressed="${t === tool}">${{ objet: "Port objet", fluide: "Port fluide", énergie: "Prise ⚡", logique: "Logique", gomme: "Gomme" }[t]}</button>`).join("")}
        <span class="bld-sep"></span>
        ${(["entrée", "sortie"] as const).map((d) => `<button type="button" data-dir="${d}" aria-pressed="${d === direction}">${d}</button>`).join("")}
      </div>
      <div class="bld-canvas">${svg()}</div>
      ${portForm()}
      <details class="bld-bg"${bg ? " open" : ""}><summary>Capture d'écran en fond (reste dans ton navigateur)</summary>
        <div class="bld-row">
          <label class="button">Choisir une capture…<input type="file" id="bld-bgfile" accept="image/*" hidden></label>
          ${bg ? `<label>Échelle <input type="range" id="bld-bgs" min="0.02" max="4" step="0.005" value="${bg.scale}"></label>
          <label>Position X <input type="range" id="bld-bgx" min="-30" max="${e.footprint!.w + 30}" step="0.05" value="${bg.x}"></label>
          <label>Position Y <input type="range" id="bld-bgy" min="-30" max="${e.footprint!.h + 30}" step="0.05" value="${bg.y}"></label>
          <label>Opacité <input type="range" id="bld-bgo" min="0.1" max="1" step="0.05" value="${bg.opacity}"></label>
          <button type="button" id="bld-bgr">Pivoter 90°</button>` : ""}
        </div>
        <p class="hint">Astuce : règle l'échelle pour qu'un Short Pipe de la capture fasse exactement une case, puis cale le bâtiment sur le rectangle bleu.</p>
      </details>
      <label class="bld-notes">Remarques <textarea id="bld-notes" rows="2" placeholder="ex. la sortie déborde d'une case">${esc(e.notes ?? "")}</textarea></label>
      ${problems.length ? `<ul class="bld-problems">${problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : `<p class="ok-text">Relevé complet.</p>`}
      <div class="actions"><button type="button" class="primary" id="bld-save">Enregistrer le relevé</button>${local[selectedId] ? `<button type="button" class="link" id="bld-forget">Oublier mon relevé local</button>` : ""}</div>
    </div>`;
  }

  // ---------------------------------------------------------------- événements
  root.addEventListener("input", (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === "bld-search") {
      filter = t.value;
      renderList();
      return;
    }
    if (!entry) return;
    if (t.id === "bld-w" || t.id === "bld-h") {
      const v = Math.max(1, Math.min(200, Math.round(Number(t.value)) || 1));
      entry.footprint = { w: t.id === "bld-w" ? v : entry.footprint!.w, h: t.id === "bld-h" ? v : entry.footprint!.h };
      refreshCanvas();
    } else if (t.id === "bld-notes") entry.notes = t.value || undefined;
    else if (bg && ["bld-bgs", "bld-bgx", "bld-bgy", "bld-bgo"].includes(t.id)) {
      const v = Number(t.value);
      if (t.id === "bld-bgs") bg.scale = v;
      if (t.id === "bld-bgx") bg.x = v;
      if (t.id === "bld-bgy") bg.y = v;
      if (t.id === "bld-bgo") bg.opacity = v;
      refreshCanvas();
    } else if (t.dataset.pf && selectedPort !== null) {
      const p = entry.ports[selectedPort]!;
      if (t.dataset.pf === "tip") p.tip = t.value || undefined;
      if (t.dataset.pf === "shown") p.shown = t.value || undefined;
      if (t.dataset.pf === "stub") p.stub = Math.max(0, Math.round(Number(t.value)) || 0);
      refreshCanvas();
    }
  });
  root.addEventListener("change", async (ev) => {
    const t = ev.target as HTMLInputElement & HTMLSelectElement;
    if (!entry && t.id !== "bld-import") return;
    if (t.id === "bld-rot") entry!.rotations = t.value ? Number(t.value) : null;
    else if (t.dataset.pf === "direction" && selectedPort !== null) {
      entry!.ports[selectedPort]!.direction = t.value as Port["direction"];
      refreshCanvas();
    } else if (t.id === "bld-bgfile" && t.files?.[0]) {
      const url = URL.createObjectURL(t.files[0]);
      const img = new Image();
      img.src = url;
      await img.decode();
      if (bg) URL.revokeObjectURL(bg.url);
      const W = (entry!.footprint!.w + 2) * CELL;
      bg = { url, natW: img.naturalWidth, natH: img.naturalHeight, scale: W / img.naturalWidth, x: 0, y: 0, rot: 0, opacity: 0.6 };
      renderEditor();
    } else if (t.id === "bld-import" && t.files?.[0]) {
      try {
        const parsed = parseSurveys(JSON.parse(await t.files[0].text()));
        if (!parsed) throw new Error("format inattendu");
        local = { ...local, ...parsed };
        save();
        $("#bld-io").textContent = `${Object.keys(parsed).length} relevé(s) importé(s).`;
        renderList();
        if (selectedId) select(selectedId);
      } catch (err) {
        $("#bld-io").textContent = `Import impossible : ${(err as Error).message}`;
      }
      t.value = "";
    }
  });
  root.addEventListener("click", (ev) => {
    const target = ev.target as Element;
    const item = target.closest<HTMLElement>("[data-bld]");
    if (item) return select(item.dataset.bld!);
    const toolBtn = target.closest<HTMLElement>("[data-tool]");
    if (toolBtn) {
      tool = toolBtn.dataset.tool as Tool;
      return renderEditor();
    }
    const dirBtn = target.closest<HTMLElement>("[data-dir]");
    if (dirBtn) {
      direction = dirBtn.dataset.dir as Port["direction"];
      return renderEditor();
    }
    if (!entry || !selectedId) {
      if (target.closest("#bld-export")) exportFile();
      return;
    }
    if (target.closest("#bld-export")) return exportFile();
    if (target.closest("#bld-swap")) {
      const f = entry.footprint!;
      entry.footprint = { w: f.h, h: f.w };
      return renderEditor();
    }
    if (target.closest("#bld-bgr") && bg) {
      bg.rot = (bg.rot + 90) % 360;
      return refreshCanvas();
    }
    if (target.closest("[data-pf-del]") && selectedPort !== null) {
      entry.ports.splice(selectedPort, 1);
      selectedPort = null;
      return renderEditor();
    }
    if (target.closest("#bld-save")) {
      entry.source = surveySource();
      local[selectedId] = structuredClone(entry);
      save();
      renderList();
      return renderEditor();
    }
    if (target.closest("#bld-forget")) {
      delete local[selectedId];
      save();
      return select(selectedId);
    }
    const svgEl = target.closest("#bld-svg") as SVGSVGElement | null;
    if (!svgEl) return;
    const portEl = target.closest<SVGGElement>("[data-port]");
    if (portEl && tool !== "gomme") {
      selectedPort = Number(portEl.dataset.port);
      return renderEditor();
    }
    const pt = svgEl.createSVGPoint();
    pt.x = (ev as MouseEvent).clientX;
    pt.y = (ev as MouseEvent).clientY;
    const local2 = pt.matrixTransform(svgEl.getScreenCTM()!.inverse());
    const { w, h } = entry.footprint!;
    const gx = Math.floor(local2.x / CELL);
    const gy = Math.floor(local2.y / CELL);
    const inBody = gx >= 1 && gx <= w && gy >= 1 && gy <= h;
    let place: Pick<Port, "side" | "cell"> | null = null;
    if (inBody && (tool === "énergie" || tool === "logique" || tool === "gomme")) {
      const p = bodyPoint(w, h, local2.x, local2.y);
      if (p) place = { side: "dessus", cell: p };
    } else if (!inBody && tool !== "énergie") {
      place = marginToPort(w, h, gx, gy);
    }
    if (!place) return;
    entry.ports = applyTool(entry.ports, tool, place, direction);
    selectedPort = tool === "gomme" ? null : entry.ports.length - 1;
    renderEditor();
  });

  function refreshCanvas(): void {
    const c = root.querySelector(".bld-canvas");
    if (c) c.innerHTML = svg();
    const problems = root.querySelector(".bld-problems, .ok-text");
    if (problems && entry) {
      const list = checkEntry(entry);
      problems.outerHTML = list.length ? `<ul class="bld-problems">${list.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : `<p class="ok-text">Relevé complet.</p>`;
    }
  }

  function exportFile(): void {
    const n = Object.keys(local).length;
    if (!n) {
      $("#bld-io").textContent = "Aucun relevé local à exporter : enregistre d'abord un relevé.";
      return;
    }
    const blob = new Blob([JSON.stringify(exportSurveys(local), null, 1) + "\n"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `releves-batiments-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    $("#bld-io").textContent = `${n} relevé(s) exporté(s). Envoie ce fichier pour l'intégrer aux données.`;
  }

  renderList();
  renderEditor();
}
