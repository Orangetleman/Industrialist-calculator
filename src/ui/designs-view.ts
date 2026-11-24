// Explorateur « Mes designs » du volet gauche (PLAN-PARTAGE.md, lot P2 bis ; maquette partage.html) : façon VS Code
// (clic choisit, double clic ouvre, F2 renomme, Suppr jette, Entrée ouvre, glisser range) et fenêtre « Conflit de
// noms » façon Explorateur Windows. Affichage seulement : l'arbre est dans designs-model.ts, les designs dans main.ts.

import { lang, t } from "../i18n/i18n.ts";
import { addDir, BIN, destroy, find, free, home, inBin, isDir, move, ROOT, rename, sizeOf, sorted, taken, within, type Ask, type Choice, type Conflict, type DesignNode, type DirNode, type Moved, type Node, type Tree } from "./designs-model.ts";
import { esc } from "./format.ts";
import { icon } from "./icons.ts";
import { openPopMenu } from "./popmenu.ts";

export type DesignsDeps = {
  tree: () => Tree;
  /** Écrit l'arbre ; faux (et le dit) si le stockage est plein. */
  save: () => boolean;
  /** Le design a-t-il un travail pas enregistré ? */
  dirty: (n: DesignNode) => boolean;
  open: (id: number) => Promise<void>;
  create: (dir: DirNode) => Promise<number | null>;
  store: (id: number) => Promise<void>;
  revert: (id: number) => Promise<void>;
  copy: (id: number) => Promise<void>;
  share: (id: number) => Promise<void>;
  /** Garde le travail du design affiché avant qu'il parte à la corbeille ; faux : impossible, on n'y touche pas. */
  keep: () => Promise<boolean>;
  /** Après tout changement : si le design affiché n'est plus dans l'arbre, un vide s'ouvre. */
  settle: () => Promise<void>;
  confirm: (text: string, ok: string) => Promise<boolean>;
  toast: (msg: string, bad?: boolean) => void;
  /** Nom du dernier design imprimé sur la partie (null : aucun), et retour à la partie d'avant. */
  printed: () => string | null;
  unprint: () => Promise<void>;
  /** Choisir un fichier .indus à ouvrir. */
  openFile: () => void;
};

export function initDesigns(el: HTMLElement, deps: DesignsDeps) {
  let sel: number | null = null, renaming: number | null = null, drag: number | null = null, menuRow: number | null = null;
  let last = { id: -1, at: 0 };
  let html = "";
  const T = () => deps.tree();
  const dirName = (d: DirNode) => (d.id === ROOT ? t("dsg.title") : d.id === BIN ? t("dsg.bin") : d.name);
  const target = (): DirNode => {
    const f = sel === null ? null : find(T(), sel);
    const d = isDir(f?.node) ? f!.node : f?.parent;
    return d && d.id !== BIN && !inBin(T(), d.id) ? d : T().root;
  };

  // ------------------------------------------------------------ liste

  function row(n: Node, depth: number): string {
    const dir = n.type === "dir", bin = n.id === BIN, on = n.id === T().active, name = dir ? dirName(n) : n.name;
    const dirty = n.type === "des" && deps.dirty(n);
    const body =
      renaming === n.id
        ? `<input class="dsg-in" value="${esc(n.name)}" aria-label="${esc(t("dsg.rename"))}" maxlength="120" spellcheck="false">`
        : `<span class="nm" title="${esc(name)}">${esc(name)}</span>${bin && T().bin.kids.length ? `<span class="dsg-n">${T().bin.kids.length}</span>` : ""}${!dir && n.lec ? `<span class="dsg-lec" title="${esc(t("dsg.lec.title"))}">${esc(t("dsg.lec"))}</span>` : ""}${dirty ? `<span class="dsg-dot" title="${esc(t("dsg.dirty.title"))}" aria-label="${esc(t("dsg.dirty"))}"></span>` : ""}<button type="button" class="dsg-more" tabindex="-1" data-more title="${esc(t("dsg.more"))}" aria-label="${esc(t("dsg.more"))}">⋯</button>`;
    return (
      `<div class="dsg${!dir && n.lec ? " lec" : ""}${on ? " on" : ""}${n.id === sel ? " sel" : ""}" role="treeitem" id="dsg-${n.id}" data-id="${n.id}" aria-level="${depth}"${dir ? ` aria-expanded="${!!n.open}"` : ""} aria-selected="${n.id === sel}"${bin || renaming === n.id ? "" : ` draggable="true"`} style="padding-left:${6 + (depth - 1) * 14}px">` +
      `<span class="tw">${dir ? icon(n.open ? "more" : "next") : ""}</span>${icon(bin ? "trash" : dir ? "folder" : "list")}${body}</div>` +
      (renaming === n.id ? `<p class="dsg-err" role="alert" hidden></p>` : "") +
      (dir && n.open ? sorted(n.kids).map((k) => row(k, depth + 1)).join("") : "")
    );
  }

  function render(force = false): void {
    if (!force && (renaming !== null || drag !== null)) return; // ne pas casser la saisie ou le glisser en cours
    const tr = T();
    if (sel !== null && !find(tr, sel)) sel = tr.active;
    const next =
      `<div class="dsg-bar"><button type="button" class="link small" data-new="des">${esc(t("dsg.new.design"))}</button><button type="button" class="link small" data-new="dir">${esc(t("dsg.new.dir"))}</button><button type="button" class="link small" id="dsg-save" data-new="save">${esc(t("dsg.save"))}</button><button type="button" class="link small" data-new="file" title="${esc(t("dsg.file.title"))}">${esc(t("dsg.file"))}</button></div>` +
      `<div class="dsg-tree" role="tree" tabindex="0" aria-label="${esc(t("dsg.title"))}"${sel !== null ? ` aria-activedescendant="dsg-${sel}"` : ""}>${sorted(tr.root.kids).map((k) => row(k, 1)).join("")}${row(tr.bin, 1)}</div>` +
      (deps.printed() === null ? "" : `<button type="button" class="link dsg-undo" data-new="undo" title="${esc(deps.printed()!)}">${esc(t("prn.undo"))}</button>`);
    if (next === html && el.firstChild) return;
    const focus = !!document.activeElement?.closest(".dsg-tree") && el.contains(document.activeElement);
    html = next;
    el.innerHTML = next;
    const inp = el.querySelector<HTMLInputElement>(".dsg-in");
    if (inp) bindRename(inp);
    else if (focus) el.querySelector<HTMLElement>(".dsg-tree")?.focus({ preventScroll: true });
  }
  const refresh = () => {
    html = "";
    render(true);
  };
  const focusTree = () => el.querySelector<HTMLElement>(".dsg-tree")?.focus({ preventScroll: true });

  function bindRename(inp: HTMLInputElement): void {
    const id = renaming!, f = find(T(), id);
    if (!f?.parent) return;
    const par = f.parent, err = el.querySelector<HTMLElement>(".dsg-err")!;
    const bad = () => !!taken(par, inp.value, f.node);
    const check = () => {
      inp.setAttribute("aria-invalid", String(bad()));
      err.hidden = !bad();
      err.textContent = bad() ? t("dsg.taken", { name: inp.value.trim(), dir: dirName(par) }) : "";
    };
    let over = false;
    const end = (ok: boolean) => {
      if (over) return;
      if (ok && inp.value.trim() && bad()) return check(); // nom pris : on reste dans le champ
      over = true;
      renaming = null;
      if (ok && inp.value.trim() && inp.value.trim() !== f.node.name) {
        rename(T(), id, inp.value);
        deps.save();
      }
      refresh();
      focusTree();
    };
    inp.addEventListener("input", check);
    inp.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") end(true);
      if (e.key === "Escape") end(false);
    });
    inp.addEventListener("blur", () => end(!bad()));
    inp.focus();
    inp.select();
  }

  // ------------------------------------------------------------ actions

  const act = {
    async open(id: number): Promise<void> {
      if (inBin(T(), id)) return deps.toast(t("dsg.bin.open"), true);
      if (id !== T().active) await deps.open(id);
      refresh();
    },
    startRename(id: number): void {
      if (id === BIN || id === ROOT || inBin(T(), id)) return;
      renaming = id;
      refresh();
    },
    async bin(id: number): Promise<void> {
      const f = find(T(), id);
      if (!f?.parent || id === BIN || inBin(T(), id)) return;
      await act.move(id, BIN);
    },
    async move(id: number, dirId: number): Promise<void> {
      const f = find(T(), id);
      if (!f) return;
      const a = T().active, name = f.node.name;
      // Le design affiché part à la corbeille (lui ou son dossier) : son travail y part avec lui.
      if (dirId === BIN && a !== null && within(f.node, a) && !(await deps.keep())) return;
      const from = f.parent ? dirName(f.parent) : "";
      const r = await move(T(), id, dirId, asker("move", from));
      if (!r) return refresh();
      await deps.settle();
      deps.save();
      refresh();
      deps.toast(report(r, name, dirId));
    },
    async restore(id: number): Promise<void> {
      const f = find(T(), id);
      if (f) await act.move(id, home(T(), f.node).id);
    },
    async destroy(id: number): Promise<void> {
      const f = find(T(), id);
      if (!f || !(await deps.confirm(t("dsg.destroy.ask", { name: f.node.name }), t("dsg.destroy.ok")))) return;
      destroy(T(), id);
      deps.save();
      refresh();
    },
    async empty(): Promise<void> {
      const n = T().bin.kids.length;
      if (!n || !(await deps.confirm(t("dsg.empty.ask", { n }), t("dsg.destroy.ok")))) return;
      T().bin.kids = [];
      deps.save();
      refresh();
    },
    newDir(dir: DirNode): void {
      const n = addDir(T(), dir, t("dsg.newdir"));
      deps.save();
      sel = n.id;
      act.startRename(n.id);
    },
    async newDesign(dir: DirNode): Promise<void> {
      const id = await deps.create(dir);
      if (id !== null) sel = id;
      refresh();
    },
  };
  const report = (r: Moved, name: string, dirId: number): string => {
    if (r.cancelled) return t("dsg.moved.cancel");
    if (r.skipped) return t("dsg.moved.skip", { done: r.done, n: r.skipped });
    const d = find(T(), dirId)?.node;
    return dirId === BIN ? t("dsg.binned", { name }) : t("dsg.moved", { dir: isDir(d) ? dirName(d) : "" });
  };

  function menu(id: number, anchor: HTMLElement): void {
    const f = find(T(), id);
    if (!f) return;
    const n = f.node, trashed = inBin(T(), id), items: [string, string][] = [];
    if (n.type === "des" && !trashed) {
      items.push(["open", t("dsg.open")], ["share", t("dsg.share")]);
      if (deps.dirty(n)) items.push(["store", t("dsg.store")]);
      if (deps.dirty(n) && n.d) items.push(["revert", t("dsg.revert")]);
      items.push(["copy", t("dsg.copy")]);
    }
    if (n.type === "dir" && n.id !== BIN && !trashed) items.push(["des", t("dsg.here.design")], ["dir", t("dsg.here.dir")]);
    if (n.id !== BIN && !trashed) items.push(["rename", t("dsg.rename.key")], ["bin", t("dsg.tobin")]);
    if (f.parent?.id === BIN) items.push(["restore", t("dsg.restore")], ["destroy", t("dsg.destroy")]);
    if (n.id === BIN && T().bin.kids.length) items.push(["empty", t("dsg.empty")]);
    if (!items.length) return;
    menuRow = id;
    openPopMenu(document.body, anchor, items.map(([k, label]) => `<button type="button" data-opt="${k}">${esc(label)}</button>`).join(""), (o) => void pick(o.dataset.opt!), "pop-menu dsg-menu");
  }
  async function pick(k: string): Promise<void> {
    const id = menuRow!, n = find(T(), id)?.node;
    if (!n) return;
    if (k === "open") await act.open(id);
    else if (k === "share") await deps.share(id);
    else if (k === "store") await deps.store(id);
    else if (k === "revert") await deps.revert(id);
    else if (k === "copy") await deps.copy(id);
    else if (k === "des" && isDir(n)) await act.newDesign(n);
    else if (k === "dir" && isDir(n)) return act.newDir(n);
    else if (k === "rename") return act.startRename(id);
    else if (k === "bin") await act.bin(id);
    else if (k === "restore") await act.restore(id);
    else if (k === "destroy") await act.destroy(id);
    else if (k === "empty") await act.empty();
    refresh();
  }

  // ------------------------------------------------------------ souris et clavier

  const idOf = (e: Event): number | null => {
    const r = (e.target as Element).closest<HTMLElement>(".dsg");
    return r ? Number(r.dataset.id) : null;
  };
  el.addEventListener("click", (e) => {
    const target0 = e.target as HTMLElement;
    if (target0.matches("input")) return;
    const b = target0.closest<HTMLElement>("[data-new]")?.dataset.new;
    if (b === "des") return void act.newDesign(target());
    if (b === "dir") return act.newDir(target());
    if (b === "file") return deps.openFile();
    if (b === "undo") return void deps.unprint().then(refresh);
    if (b === "save") return void (T().active !== null && deps.store(T().active!).then(refresh));
    const id = idOf(e);
    if (id === null) return;
    const n = find(T(), id)?.node;
    if (!n) return;
    if (target0.closest("[data-more]")) {
      sel = id;
      refresh();
      const btn = el.querySelector<HTMLElement>(`#dsg-${id} [data-more]`);
      return btn ? menu(id, btn) : undefined;
    }
    // Le double clic est compté à la main : la liste se redessine entre les deux clics.
    const now = Date.now(), dbl = last.id === id && now - last.at < 400;
    last = { id, at: now };
    sel = id;
    if (n.type === "dir") {
      n.open = !n.open;
      deps.save();
    }
    refresh();
    focusTree();
    if (n.type === "des" && dbl) void act.open(id);
  });
  el.addEventListener("contextmenu", (e) => {
    const id = idOf(e);
    if (id === null || (e.target as Element).matches("input")) return;
    e.preventDefault();
    sel = id;
    refresh();
    const r = el.querySelector<HTMLElement>(`#dsg-${id}`);
    if (r) menu(id, r);
  });
  el.addEventListener("keydown", (e) => {
    if (!(e.target as Element).classList.contains("dsg-tree")) return;
    const rows = [...el.querySelectorAll<HTMLElement>(".dsg")].map((r) => Number(r.dataset.id));
    const i = sel === null ? -1 : rows.indexOf(sel), f = sel === null ? null : find(T(), sel), n = f?.node;
    const choose = (id: number | undefined) => {
      if (id === undefined) return;
      sel = id;
      refresh();
      el.querySelector(`#dsg-${id}`)?.scrollIntoView({ block: "nearest" });
    };
    const setOpen = (d: DirNode, v: boolean) => {
      if (v) d.open = true;
      else delete d.open;
      deps.save();
      refresh();
    };
    if (e.key === "ArrowDown") choose(rows[Math.min(rows.length - 1, i + 1)]);
    else if (e.key === "ArrowUp") choose(rows[Math.max(0, i - 1)]);
    else if (e.key === "ArrowRight" && isDir(n)) n.open ? choose(rows[i + 1]) : setOpen(n, true);
    else if (e.key === "ArrowLeft" && n) isDir(n) && n.open ? setOpen(n, false) : f!.parent && f!.parent.id !== ROOT && choose(f!.parent.id);
    else if (e.key === "F2" && n) act.startRename(n.id);
    else if (e.key === "Delete" && n) void act.bin(n.id);
    else if (e.key === "Enter" && n) isDir(n) ? setOpen(n, !n.open) : void act.open(n.id);
    else if ((e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) && n) menu(n.id, el.querySelector<HTMLElement>(`#dsg-${n.id}`)!);
    else return;
    e.preventDefault();
    e.stopPropagation();
  });
  const clearDrop = () => [el, ...el.querySelectorAll(".drop")].forEach((x) => x.classList.remove("drop"));
  /** Dossier sous la souris : celui de la ligne, ou le dossier du design survolé ; ailleurs, la racine. */
  const dropDir = (e: DragEvent): { dir: DirNode; el: Element } | null => {
    if (drag === null || !find(T(), drag)) return null;
    const id = idOf(e), f = id === null ? null : find(T(), id);
    const dir = isDir(f?.node) ? f!.node : (f?.parent ?? T().root);
    const d = find(T(), drag)!;
    if (d.parent === dir || within(d.node, dir.id) || (dir.id !== BIN && inBin(T(), dir.id))) return null;
    return { dir, el: el.querySelector(`#dsg-${dir.id}`) ?? el };
  };
  el.addEventListener("dragstart", (e) => {
    drag = idOf(e);
    if (drag !== null && e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(drag));
    }
  });
  el.addEventListener("dragover", (e) => {
    clearDrop();
    const d = dropDir(e);
    if (!d) return;
    e.preventDefault();
    d.el.classList.add("drop");
  });
  el.addEventListener("dragleave", clearDrop);
  el.addEventListener("drop", (e) => {
    const d = dropDir(e), id = drag;
    drag = null;
    clearDrop();
    if (!d || id === null) return;
    e.preventDefault();
    void act.move(id, d.dir.id);
  });
  el.addEventListener("dragend", () => {
    drag = null;
    clearDrop();
    refresh();
  });

  // ------------------------------------------------------------ conflit de noms

  const dlg = document.createElement("dialog");
  dlg.className = "shr-recv dsg-cf";
  dlg.setAttribute("aria-labelledby", "dsg-cf-t");
  document.body.append(dlg);
  const when = (ms: number) => (ms ? new Date(ms).toLocaleString(lang() === "en" ? "en-GB" : "fr-FR", { dateStyle: "short", timeStyle: "short" }) : "?");
  const ko = (n: DesignNode) => (sizeOf(n) / 1024).toLocaleString(lang() === "en" ? "en-GB" : "fr-FR", { maximumFractionDigits: 1 });

  /** Question pour un conflit : `verb` (déplacer, ouvrir un lien) et l'origine, dits dans le titre. */
  function asker(verb: "move" | "link", from: string): Ask {
    return (c) =>
      new Promise((resolve) => {
        const dir = dirName(c.dir), one = c.kind === "designs";
        let done = false;
        const end = (choice: Choice) => {
          if (done) return;
          done = true;
          const all = dlg.querySelector<HTMLInputElement>("#dsg-all")?.checked ?? false;
          dlg.oncancel = dlg.onclick = null;
          dlg.close();
          resolve({ choice, all });
        };
        const opt = (k: string, ic: Parameters<typeof icon>[0], b: string, s: string) => `<button type="button" data-c="${k}">${icon(ic)}<span><b>${esc(b)}</b><small>${esc(s)}</small></span></button>`;
        const list = [
          one ? opt("replace", "check", t("dsg.cf.replace"), t("dsg.cf.replace.why")) : "",
          c.kind === "dossiers" ? opt("merge", "folder", t("dsg.cf.merge"), t("dsg.cf.merge.why")) : "",
          opt("skip", "next", t(c.node.type === "dir" ? "dsg.cf.skip.dir" : "dsg.cf.skip.des"), t("dsg.cf.skip.why")),
          one ? "" : opt("keep", "clip", t("dsg.cf.keep"), t("dsg.cf.keep.why")),
          one ? opt("compare", "swap", t("dsg.cf.compare"), t("dsg.cf.compare.why")) : "",
        ].join("");
        dlg.innerHTML = `<div class="in"><span class="eyebrow">${esc(t("dsg.cf.eye"))}</span><h3 id="dsg-cf-t">${esc(t(verb === "link" ? "dsg.cf.title.link" : "dsg.cf.title", { from, dir }))}</h3><p>${esc(t(c.clash.type === "dir" ? "dsg.cf.has.dir" : "dsg.cf.has.des", { dir, name: c.clash.name }))}</p>
          <div class="dsg-opts">${list}</div>${c.left > 1 ? `<label class="dsg-all"><input type="checkbox" id="dsg-all"> ${esc(t("dsg.cf.all", { n: c.left - 1 }))}</label>` : ""}
          <div class="row dialog-actions"><button type="button" data-c="cancel">${esc(t("m.cancel"))}</button></div></div>`;
        dlg.oncancel = (e) => {
          e.preventDefault();
          end("cancel");
        };
        dlg.onclick = (e) => {
          const k = (e.target as Element).closest<HTMLElement>("[data-c]")?.dataset.c;
          if (k === "compare") compare(c, from, dir, end);
          else if (k) end(k as Choice);
        };
        dlg.showModal();
        dlg.querySelector<HTMLElement>("[data-c]")?.focus();
      });
  }

  /** « Comparer » : deux fiches à cocher ; les deux cochées, les deux gardées (l'arrivant numéroté). */
  function compare(c: Conflict, from: string, dir: string, end: (k: Choice) => void): void {
    const a = c.node as DesignNode, b = c.clash as DesignNode;
    const card = (x: DesignNode, o: DesignNode, side: "a" | "b") =>
      `<label class="dsg-cmp"><input type="checkbox" id="dsg-${side}" checked><span><small>${esc(side === "a" ? t("dsg.cmp.from", { from }) : t("dsg.cmp.in", { dir }))}</small><b>${esc(x.name)}</b><span>${esc(t("dsg.cmp.at", { d: when(x.at) }))}${x.at > o.at ? ` <em>${esc(t("dsg.cmp.newer"))}</em>` : ""}</span><span>${x.mach === undefined ? "" : `${esc(t("share.machines", { n: x.mach }))} · `}${esc(t("dsg.cmp.size", { n: ko(x) }))}${sizeOf(x) > sizeOf(o) ? ` <em>${esc(t("dsg.cmp.bigger"))}</em>` : ""}</span></span></label>`;
    const all = dlg.querySelector<HTMLInputElement>("#dsg-all");
    dlg.querySelector(".dsg-opts")!.innerHTML = `<p class="hint">${esc(t("dsg.cmp.hint"))}</p><div class="dsg-cmps">${card(a, b, "a")}${card(b, a, "b")}</div><p class="hint" id="dsg-cmp-h"></p>`;
    if (all) all.closest("label")!.remove(); // comparer tranche ce design seulement
    dlg.querySelector(".dialog-actions")!.innerHTML = `<button type="button" data-c="cancel">${esc(t("m.cancel"))}</button><button type="button" class="primary" id="dsg-go">${esc(t("dsg.cmp.go"))}</button>`;
    const A = dlg.querySelector<HTMLInputElement>("#dsg-a")!, B = dlg.querySelector<HTMLInputElement>("#dsg-b")!, go = dlg.querySelector<HTMLButtonElement>("#dsg-go")!;
    const upd = () => {
      go.disabled = !A.checked && !B.checked;
      dlg.querySelector("#dsg-cmp-h")!.textContent = A.checked && B.checked ? t("dsg.cmp.both", { name: free(c.dir, a.name, a) }) : A.checked ? t("dsg.cmp.a") : B.checked ? t("dsg.cmp.b") : t("dsg.cmp.none");
    };
    A.onchange = B.onchange = upd;
    upd();
    go.onclick = () => end(A.checked && B.checked ? "keep" : A.checked ? "replace" : "skip");
    go.focus();
  }

  return { render, refresh, asker, select: (id: number) => { sel = id; refresh(); } };
}
