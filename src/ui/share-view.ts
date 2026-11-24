// Fenêtres du partage par lien (PLAN-PARTAGE.md, lot P2 ; maquette partage.html) : « Partager » sous le bouton
// de l'en-tête de Planifier, et « Design partagé » à l'ouverture d'une adresse #d=1.… (ou d'un ancien lien du bac
// à sable). Ce module ne fait que l'affichage : l'état du site se lit et se change par `deps` (main.ts).

import { t } from "../i18n/i18n.ts";
import { decodeDesign, designFromMschCode, designLink, encodeDesign, ShareError, SITE_VERSION, type Design } from "../engine/share/index.ts";
import { designFacts, linkAdvice, miniLayout, shareErrorKey } from "./share-design.ts";
import { icon } from "./icons.ts";

export type ShareDeps = {
  /** Le design affiché, assemblé à l'instant (bac à sable seulement si `withSandbox`). */
  build: (withSandbox: boolean) => Design;
  sandboxEmpty: () => boolean;
  /** Pastilles du résumé (étapes, machines, objectif) du design affiché. */
  facts: () => string[];
  /** Objectif en mots d'un design (« 60/min Crankshaft »), pour nommer un design qui n'a pas de nom. */
  nameOf: (d: Design) => string;
  /** Nom du design affiché. */
  currentName: () => string;
  /** Ouvre le design reçu (l'enregistre, garde le précédent) ; `data` : le lien déjà encodé. Rend son nom. */
  open: (d: Design, data: string, legacy: boolean) => Promise<string>;
  /** Le choix est fait (ou la fenêtre fermée) : l'adresse perd son #d=…. */
  done: (legacy: boolean, opened: boolean) => void;
  /** Ancien lien que le partage ne lit pas (code d'avant le .msch) : le bac à sable s'en charge comme avant. */
  legacyFallback: (code: string) => void;
};

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const nf = (n: number) => n.toLocaleString(document.documentElement.lang === "en" ? "en-US" : "fr-FR");
const pills = (xs: string[]) => xs.map((x) => `<span class="pill">${esc(x)}</span>`).join("");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function initShare(deps: ShareDeps) {
  const box = $("share"), btn = $("share-open");
  let withSand = true;
  let link = "";
  let run = 0;

  function toast(msg: string, bad = false): void {
    const e = $("shr-toast");
    e.textContent = msg;
    e.classList.toggle("bad", bad);
    e.hidden = false;
    clearTimeout((toast as { t?: number }).t);
    (toast as { t?: number }).t = window.setTimeout(() => (e.hidden = true), 2600);
  }

  function setCopy(done: boolean): void {
    const b = $("shr-copy");
    b.classList.toggle("done", done);
    b.innerHTML = done ? `${icon("check")} ${esc(t("share.copied"))}` : `${icon("clip")} ${esc(t("share.copy"))}`;
  }

  async function copy(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(link);
      setCopy(true);
      return true;
    } catch {
      // Presse-papiers refusé (permission, navigateur intégré) : copie de la sélection, l'ancienne méthode.
      const r = document.createRange();
      r.selectNodeContents($("shr-link"));
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(r);
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      if (ok) {
        getSelection()?.removeAllRanges();
        setCopy(true);
        return true;
      }
      // Rien n'a marché : le lien reste sélectionné, prêt pour Ctrl+C.
      setCopy(false);
      toast(t("share.copy.fail"), true);
      return false;
    }
  }

  function place(): void {
    const r = btn.getBoundingClientRect();
    const w = box.offsetWidth || 470;
    box.style.top = `${Math.round(r.bottom + 8)}px`;
    box.style.left = `${Math.round(Math.max(12, Math.min(r.right - w, innerWidth - w - 12)))}px`;
  }

  /** Construit le lien et le copie s'il passe sur Discord (comme la maquette). */
  async function fill(autoCopy: boolean): Promise<void> {
    const me = ++run;
    const empty = deps.sandboxEmpty();
    const sand = $("shr-sand");
    sand.toggleAttribute("disabled", empty);
    sand.setAttribute("aria-pressed", String(withSand && !empty));
    sand.title = empty ? t("share.has.sandbox.empty") : "";
    $("shr-name").textContent = deps.currentName();
    $("shr-facts").innerHTML = pills(deps.facts());
    $("shr-link").textContent = t("share.wait");
    $("shr-len").textContent = "";
    $("shr-b").hidden = true;
    setCopy(false);
    const data = await encodeDesign(deps.build(withSand && !empty));
    const withoutData = withSand && !empty ? await encodeDesign(deps.build(false)) : null;
    if (me !== run) return;
    link = designLink(location.origin, data);
    const without = withoutData === null ? null : designLink(location.origin, withoutData).length;
    const n = link.length, a = linkAdvice(n, without);
    $("shr-link").textContent = link;
    $("shr-link").title = link;
    $("shr-bar").style.width = `${Math.min(100, (n / 2000) * 100)}%`;
    $("shr-gauge").classList.toggle("over", !a.fits);
    $("shr-len").innerHTML = t(a.fits ? "share.len.ok.html" : "share.len.over.html", { n: nf(n) });
    $("shr-b").hidden = !a.sandboxOnly;
    if (a.sandboxOnly) $("shr-b-txt").textContent = t("share.b", { n: nf(without!) });
    if (autoCopy && a.fits) await copy();
  }

  function openShare(): void {
    box.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    place();
    void fill(true);
  }
  function closeShare(): void {
    if (box.hidden) return;
    box.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    run++;
  }

  btn.title = t("share.btn.title");
  btn.addEventListener("click", () => (box.hidden ? openShare() : closeShare()));
  $("shr-close").addEventListener("click", closeShare);
  $("shr-copy").addEventListener("click", () => void copy().then((ok) => ok && toast(t("share.copied"))));
  $("shr-sand").addEventListener("click", () => {
    withSand = !withSand;
    void fill(false);
  });
  $("shr-b-go").addEventListener("click", async () => {
    withSand = false;
    await fill(false);
    if (await copy()) toast(t("share.copied"));
  });
  document.addEventListener("pointerdown", (e) => {
    if (!box.hidden && !(e.target as Element).closest("#share, #share-open")) closeShare();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !box.hidden) closeShare();
  });
  addEventListener("resize", () => !box.hidden && place());

  // ------------------------------------------------------------ réception d'un lien

  const dlg = $<HTMLDialogElement>("shr-recv");
  let busy: string | null = null;

  function mini(d: Design): void {
    const svg = $("shr-r-mini") as unknown as SVGSVGElement;
    const w = 480, h = 120, nw = 40, nh = 14;
    const pts = miniLayout(d, w - nw, h - nh, 10);
    svg.toggleAttribute("hidden", !pts.length);
    if (!pts.length) return;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    const at = new Map((d.graph?.graph.nodes ?? []).map((n, i) => [n.id, pts[i]!]));
    const edges = (d.graph?.graph.edges ?? []).map((e) => {
      const p = at.get(e.from), q = at.get(e.to);
      if (!p || !q) return "";
      const x1 = p.x + nw, y1 = p.y + nh / 2, x2 = q.x, y2 = q.y + nh / 2, m = (x1 + x2) / 2;
      return `<path d="M${x1} ${y1}C${m} ${y1} ${m} ${y2} ${x2} ${y2}"/>`;
    });
    svg.innerHTML = edges.join("") + pts.map((p) => `<rect x="${p.x}" y="${p.y}" width="${nw}" height="${nh}" rx="3"/>`).join("");
  }

  /** Fenêtre « Design partagé » ; rend true si le joueur choisit d'ouvrir. */
  function ask(d: Design, legacy: boolean): Promise<boolean> {
    const f = designFacts(d);
    $("shr-r-eye").textContent = t("share.r.eye");
    $("shr-r-name").textContent = d.name || deps.nameOf(d);
    mini(d);
    const facts = !legacy && d.name && d.name !== deps.nameOf(d) ? [deps.nameOf(d)] : []; // l'objectif, s'il n'est pas déjà le nom
    if (f.nodes !== null) facts.push(t("share.nodes", { n: f.nodes }));
    if (f.blocks !== null) facts.push(t("share.blocks", { n: f.blocks }));
    $("shr-r-facts").innerHTML = pills(facts);
    $("shr-r-facts").hidden = !facts.length;
    // Version du site : les anciens liens du bac à sable n'en ont pas (rien à recalculer, le montage est tel quel).
    $("shr-r-warn").hidden = legacy || d.site === SITE_VERSION;
    $("shr-r-warn-txt").textContent = t("share.r.older");
    $("shr-r-keep").hidden = false;
    $("shr-r-keep-txt").textContent = t(legacy ? "share.r.keep.bac" : "share.r.keep", { prev: deps.currentName() });
    $("shr-r-no").textContent = t("m.cancel");
    $("shr-r-yes").hidden = false;
    return show();
  }

  function fail(err: unknown): Promise<boolean> {
    $("shr-r-eye").textContent = t("share.r.eye.err");
    $("shr-r-name").textContent = t("share.r.bad");
    ($("shr-r-mini") as unknown as SVGElement).toggleAttribute("hidden", true);
    $("shr-r-facts").hidden = true;
    $("shr-r-warn").hidden = false;
    $("shr-r-warn-txt").textContent = t(shareErrorKey(err instanceof ShareError ? err.code : null));
    $("shr-r-keep").hidden = true;
    $("shr-r-no").textContent = t("share.r.close");
    $("shr-r-yes").hidden = true;
    return show();
  }

  function show(): Promise<boolean> {
    return new Promise((resolve) => {
      const end = (ok: boolean) => {
        $("shr-r-yes").onclick = $("shr-r-no").onclick = null;
        dlg.oncancel = null;
        if (dlg.open) dlg.close();
        resolve(ok);
      };
      $("shr-r-yes").onclick = () => end(true);
      $("shr-r-no").onclick = () => end(false);
      dlg.oncancel = (e) => {
        e.preventDefault();
        end(false);
      };
      if (!dlg.open) dlg.showModal();
      ($("shr-r-yes").hidden ? $("shr-r-no") : $("shr-r-yes")).focus();
    });
  }

  /** Une adresse #d=… (au chargement ou sur hashchange). Une seule fenêtre à la fois. */
  async function receive(data: string): Promise<void> {
    if (busy === data) return;
    busy = data;
    try {
      closeShare();
      let d: Design;
      try {
        d = await decodeDesign(data);
      } catch (e) {
        await fail(e);
        return deps.done(false, false);
      }
      const ok = await ask(d, false);
      if (ok) toast(t("share.done", { name: await deps.open(d, data, false) }));
      else toast(t("share.cancelled"));
      deps.done(false, ok);
    } finally {
      busy = null;
    }
  }

  /** Ancien lien du bac à sable (#bac/<code>) : lu à vie, sans jamais parler de son format. */
  async function receiveLegacy(code: string): Promise<void> {
    if (busy === code) return;
    busy = code;
    try {
      let d: Design;
      try {
        d = await designFromMschCode(code);
      } catch {
        return deps.legacyFallback(code);
      }
      const ok = await ask(d, true);
      if (ok) toast(t("share.done", { name: await deps.open(d, "", true) }));
      else toast(t("share.cancelled"));
      deps.done(true, ok);
    } finally {
      busy = null;
    }
  }

  return { openShare, closeShare, receive, receiveLegacy, toast };
}
