// Fenêtres du partage par lien (PLAN-PARTAGE.md, lot P2 ; maquette partage.html) : « Partager » sous le bouton
// de l'en-tête de Planifier, et « Design partagé » à l'ouverture d'une adresse #d=1.… (ou d'un ancien lien du bac
// à sable). Ce module ne fait que l'affichage : l'état du site se lit et se change par `deps` (main.ts).

import { t } from "../i18n/i18n.ts";
import { comparePrints, decodeDesign, designFromFile, designFromMschCode, designLink, encodeDesign, encodeDesignBytes, isIndus, ShareError, SITE_VERSION, type Design } from "../engine/share/index.ts";
import type { Key } from "../i18n/i18n.ts";
import { hasContrib } from "./print-profile.ts";
import { checkNotes, designFacts, dropAdvice, linkAdvice, miniLayout, shareErrorKey, type CheckState } from "./share-design.ts";
import type { Layout } from "../engine/sandbox/layout.ts";
import { icon } from "./icons.ts";

/** Les cases de « Partager ». */
export type ShareWith = { sandbox: boolean; profile: boolean; contrib: boolean };
/** Ce que le joueur choisit devant un design reçu ("" : rien). */
export type OpenChoice = "" | "read" | "print";

export type ShareDeps = {
  /** Usine figée pour le fichier (P4) : connue, en calcul, ou aucune à figer (`now` et `later` null). */
  factory: () => { now: Layout | null; later: Promise<Layout | null> | null };
  /** Un long travail : écran d'attente par-dessus la page. */
  busy: <T>(text: string, fn: () => Promise<T> | T) => Promise<T>;
  /** Le design affiché, assemblé à l'instant, avec ce qui est coché. */
  build: (w: ShareWith) => Design;
  /** Le joueur a des corrections ou des relevés à partager. */
  contribs: () => boolean;
  sandboxEmpty: () => boolean;
  /**
   * Empreinte (P3) du design affiché : connue tout de suite (`now`, au moins le plan), puis avec la pose quand
   * l'usine est calculée (`later`, null s'il n'y a rien à attendre).
   */
  print: () => { now: string | undefined; later: Promise<string | undefined> | null };
  /** Empreinte d'un design reçu, recalculée ici sans l'afficher (P3) ; `cancel` arrête le calcul. */
  probe: (d: Design) => { print: Promise<string | undefined>; cancel: () => void };
  /** Pastilles du résumé (étapes, machines, objectif) du design affiché. */
  facts: () => string[];
  /** Objectif en mots d'un design (« 60/min Crankshaft »), pour nommer un design qui n'a pas de nom. */
  nameOf: (d: Design) => string;
  /** Nom du design affiché. */
  currentName: () => string;
  /** Ouvre le design reçu (l'enregistre, garde le précédent) ; `data` : le lien déjà encodé. Rend son nom, ou null s'il a été ignoré. */
  open: (d: Design, choice: OpenChoice, legacy: boolean) => Promise<string | null>;
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
  let withSand = true, withProf = true, withContrib = true;
  /** Version allégée proposée quand le lien est trop long. */
  let lighter: { sandbox: boolean; contrib: boolean } | null = null;
  let link = "";
  let run = 0;

  function toast(msg: string, bad = false, ms = 2600): void {
    const e = $("shr-toast");
    e.textContent = msg;
    e.classList.toggle("bad", bad);
    e.hidden = false;
    clearTimeout((toast as { t?: number }).t);
    (toast as { t?: number }).t = window.setTimeout(() => (e.hidden = true), ms);
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
  async function fill(autoCopy: boolean, print = deps.print()): Promise<void> {
    const me = ++run;
    const stamp = (d: Design): Design => (print.now ? { ...d, print: print.now } : d);
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
    const own = deps.contribs();
    $("shr-prof").setAttribute("aria-pressed", String(withProf));
    $("shr-prof").title = t("share.has.profile.title");
    const ct = $("shr-contrib");
    ct.toggleAttribute("disabled", !own);
    ct.setAttribute("aria-pressed", String(withContrib && own));
    ct.title = t(own ? "share.has.contrib.title" : "share.has.contrib.empty");
    $("shr-miss").hidden = !own || withContrib;
    const now = { sandbox: withSand && !empty, profile: withProf, contrib: withContrib && own };
    const make = async (w: ShareWith) => designLink(location.origin, await encodeDesign(stamp(deps.build(w))));
    const built = await make(now);
    const options: { drop: { sandbox: boolean; contrib: boolean }; len: number }[] = [];
    if (!linkAdvice(built.length, null).fits)
      for (const drop of [{ sandbox: true, contrib: false }, { sandbox: false, contrib: true }, { sandbox: true, contrib: true }])
        if ((!drop.sandbox || now.sandbox) && (!drop.contrib || now.contrib)) options.push({ drop, len: (await make({ sandbox: now.sandbox && !drop.sandbox, profile: now.profile, contrib: now.contrib && !drop.contrib })).length });
    if (me !== run) return;
    link = built;
    const n = link.length, a = linkAdvice(n, null), light = dropAdvice(n, options);
    lighter = light?.drop ?? null;
    $("shr-link").textContent = link;
    $("shr-link").title = link;
    $("shr-bar").style.width = `${Math.min(100, (n / 2000) * 100)}%`;
    $("shr-gauge").classList.toggle("over", !a.fits);
    $("shr-len").innerHTML = t(a.fits ? "share.len.ok.html" : "share.len.over.html", { n: nf(n) });
    $("shr-b").hidden = !light;
    if (light) $("shr-b-txt").textContent = [t(light.drop.contrib ? (light.drop.sandbox ? "share.b.both" : "share.b.contrib") : "share.b", { n: nf(light.len) }), light.drop.contrib ? t("share.miss") : ""].filter(Boolean).join(" ");
    void fileSize(me, now, print.now);
    if (autoCopy && a.fits) await copy();
    // L'usine finit de se calculer : le lien prend son empreinte complète (et remplace celui déjà copié).
    void print.later?.then((p) => {
      if (me !== run || box.hidden || !p || p === print.now) return;
      void fill($("shr-copy").classList.contains("done"), { now: p, later: null });
    });
  }

  // ------------------------------------------------------------ fichier .indus (P4)
  const fileName = () => `${deps.currentName().replace(/[\\/:*?"<>|]/g, "_").trim() || "design"}.indus`;
  const boxes = (): ShareWith => ({ sandbox: withSand && !deps.sandboxEmpty(), profile: withProf, contrib: withContrib && deps.contribs() });
  const frz = $<HTMLInputElement>("shr-frz");
  const fileBytes = (w: ShareWith, print: string | undefined, factory: Layout | null) => encodeDesignBytes({ ...deps.build(w), ...(print ? { print } : {}), ...(factory ? { factory } : {}) });
  async function fileSize(me: number, w: ShareWith, print: string | undefined): Promise<void> {
    const f = deps.factory(), none = !f.now && !f.later;
    frz.disabled = none;
    const on = frz.checked && !none;
    $("shr-fhint").textContent = t(none ? "share.f.none" : on ? "share.f.hint.on" : "share.f.hint.off");
    $("shr-dl").innerHTML = `${icon("download")} ${esc(t("share.f.dl", { name: fileName() }))}`;
    $("shr-fsize").textContent = "";
    if (on && !f.now) return; // l'usine se calcule encore : la taille viendra avec elle
    const n = (await fileBytes(w, print, on ? f.now : null)).length;
    if (me === run) $("shr-fsize").textContent = t("share.f.size", { n: nf(Math.max(1, Math.round(n / 1024))) });
  }
  async function download(): Promise<void> {
    const f = deps.factory(), w = boxes(), p = deps.print(), name = fileName();
    const want = frz.checked && !frz.disabled;
    const bytes = await deps.busy(t("share.f.busy"), async () => {
      const factory = want ? (f.now ?? (await f.later)) : null;
      return want && !factory ? null : fileBytes(w, (p.later && want ? await p.later : undefined) ?? p.now, factory);
    });
    if (!bytes) return toast(t("share.f.fail"), true, 6000);
    const u = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/octet-stream" })), a = document.createElement("a");
    a.href = u;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
    toast(t("share.f.done", { name }));
  }
  frz.addEventListener("change", () => void fileSize(run, boxes(), deps.print().now));
  $("shr-dl").addEventListener("click", () => void download());

  function openShare(): void {
    box.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    place();
    withProf = withContrib = true;
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
  $("shr-prof").addEventListener("click", () => {
    withProf = !withProf;
    void fill(false);
  });
  $("shr-contrib").addEventListener("click", () => {
    withContrib = !withContrib;
    void fill(false);
  });
  $("shr-b-go").addEventListener("click", async () => {
    if (lighter?.sandbox) withSand = false;
    if (lighter?.contrib) withContrib = false;
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

  /** La version du site qui a créé le design, si elle est encore servie sous /v/. */
  async function original(d: Design): Promise<void> {
    const p = $("shr-r-orig"), a = p.querySelector("a")!;
    p.hidden = true;
    if (!/^\d+\.\d+\.\d+$/.test(d.site) || d.site === SITE_VERSION || location.pathname.startsWith("/v/")) return;
    try {
      const r = await fetch(`/v/${d.site}/version.json`);
      if (!r.ok || ((await r.json()) as { version?: unknown }).version !== d.site) return;
    } catch {
      return; // cette version n'est pas gardée en ligne
    }
    const { factory: _f, ...rest } = d;
    a.href = `/v/${d.site}/#d=${await encodeDesign(rest)}`;
    a.textContent = t("share.r.orig", { v: d.site });
    p.hidden = false;
  }
  let file = false;
  /** Fenêtre « Design partagé » ; rend le choix du joueur. */
  function ask(d: Design, legacy: boolean): Promise<OpenChoice> {
    const f = designFacts(d);
    $("shr-r-eye").textContent = t(file ? "share.r.eye.file" : "share.r.eye");
    void original(d);
    $("shr-r-name").textContent = d.name || deps.nameOf(d);
    mini(d);
    const facts = !legacy && d.name && d.name !== deps.nameOf(d) ? [deps.nameOf(d)] : []; // l'objectif, s'il n'est pas déjà le nom
    if (f.nodes !== null) facts.push(t("share.nodes", { n: f.nodes }));
    if (f.blocks !== null) facts.push(t("share.blocks", { n: f.blocks }));
    const lec = !legacy && !!d.profile;
    if (lec && d.profile!.player) facts.push(t("share.profile"));
    if (lec && hasContrib(d.profile!)) facts.push(t("share.contrib"));
    if (d.factory) facts.push(t("share.r.frozen"));
    if (lec && d.profile!.partial) facts.push(t("share.contrib.no"));
    $("shr-r-facts").innerHTML = pills(facts);
    $("shr-r-facts").hidden = !facts.length;
    // Anciens liens du bac à sable : rien à recalculer, le montage est tel quel.
    if (legacy) $("shr-r-warn").hidden = $("shr-r-check").hidden = true;
    else notes(d, null);
    $("shr-r-keep").hidden = false;
    $("shr-r-keep-txt").textContent = t(legacy ? "share.r.keep.bac" : lec ? "share.r.keep.lec" : "share.r.keep", { prev: deps.currentName() });
    $("shr-r-no").textContent = t("m.cancel");
    $("shr-r-yes").hidden = lec;
    $("shr-r-ch").hidden = !lec;
    return show();
  }

  /** Avec le profil de l'auteur, la partie du lecteur n'y est pour rien : seul le site a pu changer. */
  const withProfileText = (d: Design, k: Key): Key => (d.profile?.partial && (k === "share.r.diff.plan" || k === "share.r.diff.pose") ? "share.r.diff.part" : d.profile?.player && (k === "share.r.diff.plan" || k === "share.r.diff.pose") ? `${k}.lec` : k);

  /** Alerte et information de la fenêtre, selon la vérification de l'empreinte (P3). */
  function notes(d: Design, verdict: CheckState): void {
    const n = checkNotes(d, SITE_VERSION, verdict);
    $("shr-r-warn").hidden = !n.warn.length;
    $("shr-r-warn-txt").innerHTML = [...n.warn.map((k) => esc(t(withProfileText(d, k)))), ...(n.advice ? [`<b>${esc(t("share.r.advice"))}</b>`] : [])].join("<br>");
    $("shr-r-check").hidden = !n.info;
    $("shr-r-check-txt").textContent = n.info ? t(n.info) : "";
    $("shr-r-check-ic").innerHTML = icon(verdict === "identique" ? "check" : "info");
  }

  function fail(err: unknown): Promise<OpenChoice> {
    $("shr-r-orig").hidden = true;
    $("shr-r-eye").textContent = t(file ? "share.r.eye.file" : "share.r.eye.err");
    $("shr-r-name").textContent = t("share.r.bad");
    ($("shr-r-mini") as unknown as SVGElement).toggleAttribute("hidden", true);
    $("shr-r-facts").hidden = true;
    $("shr-r-warn").hidden = false;
    $("shr-r-warn-txt").textContent = t(shareErrorKey(err instanceof ShareError ? err.code : null));
    $("shr-r-keep").hidden = $("shr-r-check").hidden = true;
    $("shr-r-no").textContent = t("share.r.close");
    $("shr-r-yes").hidden = $("shr-r-ch").hidden = true;
    return show();
  }

  function show(): Promise<OpenChoice> {
    return new Promise((resolve) => {
      const end = (ok: OpenChoice) => {
        for (const id of ["yes", "no", "read", "print"]) $(`shr-r-${id}`).onclick = null;
        dlg.oncancel = null;
        if (dlg.open) dlg.close();
        resolve(ok);
      };
      $("shr-r-yes").onclick = $("shr-r-read").onclick = () => end("read");
      $("shr-r-print").onclick = () => end("print");
      $("shr-r-no").onclick = () => end("");
      dlg.oncancel = (e) => {
        e.preventDefault();
        end("");
      };
      if (!dlg.open) dlg.showModal();
      ($("shr-r-yes").hidden ? ($("shr-r-ch").hidden ? $("shr-r-no") : $("shr-r-read")) : $("shr-r-yes")).focus();
    });
  }

  /** Une adresse #d=… (au chargement ou sur hashchange). Une seule fenêtre à la fois. */
  const receive = (data: string) => receiveWith(data, () => decodeDesign(data));
  /** Un fichier choisi par le joueur : `.indus`, ou un ancien fichier du bac à sable. */
  async function receiveFile(f: File): Promise<void> {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const named = f.name.replace(/\.[^.]+$/, "");
    const open = async (): Promise<Design> => {
      const d = await designFromFile(bytes);
      return d.name ? d : { ...d, name: named };
    };
    if (isIndus(bytes) || bytes[0] !== 0x6d) return receiveWith(`fichier:${f.name}`, open, true);
    if (busy) return;
    busy = f.name;
    file = true;
    try {
      let d: Design;
      try {
        d = await open();
      } catch (e) {
        return void (await fail(e));
      }
      const ok = await ask(d, true);
      const name = ok ? await deps.open(d, ok, true) : null;
      toast(name === null ? t("share.cancelled") : t("share.done", { name }));
      if (name !== null) deps.done(true, true);
    } finally {
      busy = null;
      file = false;
    }
  }
  async function receiveWith(data: string, read: () => Promise<Design>, fromFile = false): Promise<void> {
    if (busy !== null) return;
    busy = data;
    file = fromFile;
    const done = (opened: boolean) => (fromFile && !opened ? undefined : deps.done(false, opened));
    try {
      closeShare();
      let d: Design;
      try {
        d = await read();
      } catch (e) {
        await fail(e);
        return done(false);
      }
      // L'empreinte est recalculée pendant que la fenêtre est ouverte ; ouvrir n'attend pas.
      const asked = ask(d, false);
      const probe = d.print ? deps.probe(d) : null;
      let waiting = true;
      const checked = probe?.print
        .then((p) => comparePrints(d.print, p), () => "sans" as const)
        .then((v): CheckState => (v === "sans" ? "impossible" : v));
      let known = false;
      void checked?.then((v) => {
        known = true;
        if (waiting) notes(d, v);
      });
      const ok = await asked;
      waiting = false;
      const late = !known;
      if (!ok) probe?.cancel();
      const name = ok ? await deps.open(d, ok, false) : null;
      toast(name === null ? t("share.cancelled") : t(ok === "print" ? "share.done.print" : "share.done", { name }));
      done(name !== null);
      // Ouvert avant la fin de la vérification : une différence se dit quand même, dès qu'elle est connue.
      if (name !== null && late)
        void checked?.then((v) => {
          const n = checkNotes(d, SITE_VERSION, v);
          if (n.advice) toast(`${t(withProfileText(d, n.warn.at(-1)!))} ${t("share.r.advice")}`, true, 14_000);
        });
    } finally {
      busy = null;
      file = false;
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
      const name = ok ? await deps.open(d, ok, true) : null;
      toast(name === null ? t("share.cancelled") : t("share.done", { name }));
      deps.done(true, name !== null);
    } finally {
      busy = null;
    }
  }

  return { openShare, closeShare, receive, receiveLegacy, receiveFile, toast };
}
