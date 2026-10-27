// Fenêtre « Remarque » (S35, maquettes public.html écran 2 et remarques.html) : écrire, ou envoyer ses corrections,
// et « Mes remarques ». Une <dialog> ouverte en modal : le focus y reste, Échap la ferme et rend le focus au bouton.

import { lang, t, type Key } from "../i18n/i18n.ts";
import { esc, fmtDate } from "./format.ts";
import { icon, withIcons } from "./icons.ts";
import {
  checkOutgoing,
  GAME_DISCORD,
  loadDraft,
  loadMine,
  loadPseudo,
  markChecked,
  markSeen,
  markSent,
  PLAYER_TYPES,
  refreshMine,
  rememberSent,
  saveDraft,
  saveMine,
  savePseudo,
  sendRemark,
  shouldCheck,
  signature,
  TEXT_MAX,
  unseenReplies,
  type MyRemark,
  type Piece,
  type RemarkType,
} from "./remarques.ts";

declare const __SITE_VERSION__: string;
const VERSION = typeof __SITE_VERSION__ === "string" ? __SITE_VERSION__ : "dev";

/** Ce qui part avec la remarque : la page (nom lisible et adresse) et le résumé du plan affiché. */
export type RemarkContext = () => { label: string; hash: string; plan: string | null };
/** Ouverture pour des corrections : le fichier, et le titre de la fenêtre. */
export type FixRequest = { piece: Piece; kind: "fix" | "surveys" };

const AUTHOR = "Orangentleman";

/** « aujourd'hui », « hier », « il y a 3 jours ». */
function ago(ms: number, now = Date.now()): string {
  const day = (x: number) => Math.floor((x - new Date(x).getTimezoneOffset() * 60_000) / 86_400_000);
  const n = day(now) - day(ms);
  return n <= 0 ? t("rm.today") : n === 1 ? t("rm.yesterday") : t("rm.daysAgo", { n });
}

export function initRemarks(ctx: RemarkContext, onFixSent: () => void) {
  const dlg = document.getElementById("remark") as HTMLDialogElement;
  const btn = document.getElementById("remark-btn") as HTMLButtonElement;
  const dot = document.getElementById("remark-dot")!;

  let mine = loadMine();
  let tab: "write" | "mine" = "write";
  let fix: FixRequest | null = null;
  const draft = loadDraft();
  let type: RemarkType = draft?.type && PLAYER_TYPES.includes(draft.type) ? draft.type : "valeur";
  let texte = draft?.texte ?? "";
  let fixText = "";
  let pseudo = loadPseudo();
  /** Langue déclarée de la remarque (S36) : celle du site à l'ouverture, modifiable dans la fenêtre. */
  let remarkLang: "fr" | "en" = lang();
  let status: { kind: "ok" | "err" | "busy"; html: string } | null = null;
  let offline = false;
  let opener: HTMLElement | null = null;
  /** Réponses nouvelles quand l'onglet s'est ouvert : elles restent marquées tant qu'il est ouvert. */
  let fresh = new Set<string>();
  const unseenOf = (list: MyRemark[]) => list.filter((r) => r.reponse && r.repondu && r.repondu !== r.vu).map((r) => r.numero);

  const typeLabel = (r: RemarkType) => t(`rm.type.${r}` as Key);

  function renderDot(): void {
    const n = unseenReplies(mine);
    dot.hidden = n === 0;
    dot.textContent = String(n);
    btn.setAttribute("aria-label", n ? t("rm.btn.aria.new", { n }) : t("rm.btn.aria"));
  }

  function writePane(): string {
    const c = ctx();
    if (status?.kind === "ok") {
      return `<div class="rm-ok" role="status">${status.html}</div>
        <div class="rm-actions"><button type="button" data-rm="again">${esc(t("rm.ok.again"))}</button><button type="button" class="primary" data-rm="close">${esc(t("rm.close"))}</button></div>`;
    }
    const value = fix ? fixText : texte;
    const len = value.trim().length;
    const types = fix
      ? `<div class="rm-piece"><b>${esc(t("rm.piece", { file: fix.piece.fichier }))}</b><div class="hint">${esc(fix.piece.resume)}</div></div>`
      : `<fieldset class="rm-types"><legend class="sr-only">${esc(t("rm.types.aria"))}</legend>${PLAYER_TYPES.map(
          (k) => `<label><input type="radio" name="rm-type" value="${k}"${k === type ? " checked" : ""}> <span>${withIcons(esc(typeLabel(k)))}</span></label>`,
        ).join("")}</fieldset>`;
    const ph = fix ? t("rm.text.ph.fix") : t(`rm.text.ph.${type}` as Key);
    const busy = status?.kind === "busy";
    return `${types}
      <label class="sr-only" for="rm-text">${esc(t("rm.text.aria"))}</label>
      <textarea id="rm-text" maxlength="${TEXT_MAX + 500}" placeholder="${esc(ph)}" aria-describedby="rm-count rm-status">${esc(value)}</textarea>
      <div class="hint rm-count${len > TEXT_MAX ? " over" : ""}" id="rm-count">${esc(t("rm.count", { n: len, max: TEXT_MAX }))}</div>
      <label class="rm-pseudo"><span>${esc(t("rm.pseudo"))}</span><input type="text" id="rm-pseudo" maxlength="40" autocomplete="nickname" placeholder="${esc(t("rm.pseudo.ph"))}" value="${esc(pseudo)}"></label>
      <label class="rm-pseudo"><span>${esc(t("rm.lang"))}</span><select id="rm-lang">${(["fr", "en"] as const).map((l) => `<option value="${l}"${l === remarkLang ? " selected" : ""}>${esc(t(`rm.lang.${l}`))}</option>`).join("")}</select></label>
      <input type="text" class="rm-hp" id="rm-hp" name="siteWeb" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p class="rm-meta">${t(fix ? "rm.meta.fix.html" : "rm.meta.html", { page: esc(c.label) })}</p>
      <div id="rm-status" role="status">${status?.kind === "err" ? `<div class="rm-err">${status.html}</div>` : ""}</div>
      <p class="rm-meta">${t("rm.discord.html", { url: GAME_DISCORD })}</p>
      <div class="rm-actions"><a class="rm-props" href="#propositions" data-rm="props">${withIcons(esc(t("rm.props")))}</a><button type="button" data-rm="close">${esc(t("rm.cancel"))}</button><button type="button" class="primary" data-rm="send"${busy ? " disabled" : ""}>${esc(busy ? t("rm.sending") : t("rm.send"))}</button></div>`;
  }

  function mineItem(r: MyRemark): string {
    const isNew = fresh.has(r.numero) || !!(r.reponse && r.repondu && r.repondu !== r.vu);
    const state = r.disparue ? t("rm.mine.gone") : r.etat ? t(`rm.state.${r.etat}` as Key) + (isNew ? ` · ${t("rm.state.new")}` : "") : "";
    const what = r.type === "correction" && r.resume ? r.resume : r.extrait;
    return `<li class="rm-it${isNew ? " new" : ""}">
      <div class="h"><b>${esc(t("rm.mine.no", { id: String(r.id) }))}</b> · <span>${withIcons(esc(typeLabel(r.type)))} · ${esc(ago(r.cree))}</span>${state ? `<span class="st">${esc(state)}</span>` : ""}</div>
      ${what ? `<div class="tx">${esc(what)}</div>` : ""}
      ${r.reponse ? `<div class="ans"><b>${esc(t("rm.mine.reply", { who: AUTHOR }))}</b> ${esc(r.reponse)}</div>` : r.disparue ? "" : `<div class="hint">${esc(t("rm.mine.noReply"))}</div>`}
      <button type="button" class="link small" data-rm-forget="${esc(r.numero)}" aria-label="${esc(t("rm.mine.forget.aria", { id: String(r.id) }))}">${esc(t("rm.mine.forget"))}</button>
    </li>`;
  }

  function minePane(): string {
    if (!mine.length) return `<p class="hint">${esc(t("rm.mine.empty"))}</p>`;
    return `${offline ? `<p class="rm-err">${esc(t("rm.mine.offline"))}</p>` : ""}<ul class="rm-mine">${mine.map(mineItem).join("")}</ul><p class="hint">${esc(t("rm.mine.hint"))}</p>`;
  }

  function render(focus: "first" | "text" | "tab" | "status" | null = null): void {
    const title = fix ? t(fix.kind === "fix" ? "rm.title.fix" : "rm.title.surveys") : t("rm.title");
    const n = unseenReplies(mine);
    const tabBtn = (k: "write" | "mine", label: string) =>
      `<button type="button" role="tab" id="rm-tab-${k}" aria-controls="rm-pane" aria-selected="${tab === k}" tabindex="${tab === k ? 0 : -1}" data-rm-tab="${k}">${label}</button>`;
    dlg.innerHTML = `<h3 id="rm-title"><span>${withIcons(esc(title))}</span><button type="button" class="rm-x" data-rm="close" aria-label="${esc(t("rm.close"))}" title="${esc(t("rm.close"))}">${icon("close")}</button></h3>
      <div class="rm-tabs" role="tablist" aria-label="${esc(t("rm.tabs.aria"))}">${tabBtn("write", esc(t("rm.tab.write")))}${tabBtn("mine", `${esc(t("rm.tab.mine", { n: mine.length }))}${n ? ` <span class="rm-dot">${n}</span>` : ""}`)}</div>
      <div id="rm-pane" role="tabpanel" aria-labelledby="rm-tab-${tab}">${tab === "write" ? writePane() : minePane()}</div>`;
    if (focus === "tab") dlg.querySelector<HTMLElement>(`#rm-tab-${tab}`)?.focus();
    else if (focus === "text") dlg.querySelector<HTMLElement>("#rm-text")?.focus();
    else if (focus === "status") dlg.querySelector<HTMLElement>(".rm-ok, [data-rm=send]")?.focus();
    else if (focus === "first") (dlg.querySelector<HTMLElement>("input[name=rm-type]:checked") ?? dlg.querySelector<HTMLElement>("#rm-text"))?.focus();
  }

  async function check(): Promise<void> {
    const next = await refreshMine(mine);
    offline = next === null;
    if (next) {
      // L'onglet ouvert pendant la relecture : les réponses arrivées sont vues tout de suite.
      if (tab === "mine" && dlg.open) {
        for (const n of unseenOf(next)) fresh.add(n);
        mine = markSeen(next);
      } else mine = next;
      saveMine(mine);
      markChecked(Date.now());
    }
    renderDot();
    if (dlg.open && tab === "mine") render();
  }

  function errorHtml(code: string): string {
    const over = (fix ? fixText : texte).trim().length - TEXT_MAX;
    const map: Record<string, string> = {
      vide: t("rm.err.vide"),
      long: t("rm.err.long", { n: over, max: TEXT_MAX }),
      "texte-trop-long": t("rm.err.long", { n: Math.max(1, over), max: TEXT_MAX }),
      "trop-de-remarques": t("rm.err.trop"),
      fermees: t("rm.err.fermees"),
      "piece-trop-longue": t("rm.err.piece"),
      "trop-long": t("rm.err.piece"),
      reseau: t("rm.err.reseau"),
    };
    return esc(map[code] ?? t("rm.err.autre", { code }));
  }

  async function send(): Promise<void> {
    const c = ctx();
    const value = fix ? fixText : texte;
    const hp = (dlg.querySelector<HTMLInputElement>("#rm-hp")?.value ?? "").trim();
    const out = { type: fix ? ("correction" as const) : type, texte: value, pseudo, page: `${c.label} (${c.hash})`, plan: c.plan, langue: remarkLang, version: VERSION, piece: fix?.piece, siteWeb: hp };
    const before = checkOutgoing(out);
    if (before) {
      status = { kind: "err", html: errorHtml(before.code === "piece" ? "piece-trop-longue" : before.code) };
      render("text");
      return;
    }
    status = { kind: "busy", html: "" };
    render();
    const res = await sendRemark(out);
    if (!res.ok) {
      status = { kind: "err", html: errorHtml(res.code) };
      render("status");
      return;
    }
    savePseudo(pseudo);
    mine = rememberSent(mine, out, res, Date.now());
    saveMine(mine);
    if (fix) {
      markSent(fix.piece.fichier, { id: res.id, at: Date.now(), sig: signature(fix.piece.contenu) });
      fixText = "";
      onFixSent();
    } else {
      texte = "";
      saveDraft(null);
    }
    status = { kind: "ok", html: withIcons(t("rm.ok.html", { id: String(res.id) })) };
    render("status");
  }

  function open(req: FixRequest | null = null, from: HTMLElement | null = null): void {
    fix = req;
    tab = "write";
    remarkLang = lang();
    status = null;
    opener = from ?? (document.activeElement as HTMLElement | null);
    render();
    if (!dlg.open) dlg.showModal();
    render("first");
  }

  dlg.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement;
    if (el.id === "rm-text") {
      if (fix) fixText = el.value;
      else {
        texte = el.value;
        saveDraft({ type, texte });
      }
      const len = el.value.trim().length;
      const count = dlg.querySelector("#rm-count")!;
      count.textContent = t("rm.count", { n: len, max: TEXT_MAX });
      count.classList.toggle("over", len > TEXT_MAX);
    } else if (el.id === "rm-pseudo") pseudo = el.value;
    else if (el.id === "rm-lang") remarkLang = el.value === "en" ? "en" : "fr";
  });
  dlg.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement;
    if (el.name !== "rm-type") return;
    type = el.value as RemarkType;
    saveDraft({ type, texte });
    dlg.querySelector<HTMLTextAreaElement>("#rm-text")!.placeholder = t(`rm.text.ph.${type}` as Key);
  });
  dlg.addEventListener("click", (e) => {
    const el = e.target as HTMLElement;
    const act = el.closest<HTMLElement>("[data-rm]")?.dataset.rm;
    if (act === "close" || act === "props") return dlg.close();
    if (act === "send") return void send();
    if (act === "again") {
      fix = null;
      status = null;
      return render("first");
    }
    const tb = el.closest<HTMLElement>("[data-rm-tab]")?.dataset.rmTab as "write" | "mine" | undefined;
    if (tb) return selectTab(tb);
    const forget = el.closest<HTMLElement>("[data-rm-forget]")?.dataset.rmForget;
    if (forget) {
      mine = mine.filter((r) => r.numero !== forget);
      saveMine(mine);
      renderDot();
      render("tab");
    }
  });
  // Onglets au clavier : ← → (modèle des onglets ARIA).
  dlg.addEventListener("keydown", (e) => {
    if (!(e.target as HTMLElement).matches("[role=tab]") || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    selectTab(tab === "write" ? "mine" : "write");
  });
  function selectTab(next: "write" | "mine"): void {
    if (next === "write" && status?.kind === "ok") status = null;
    tab = next;
    if (tab === "mine") {
      fresh = new Set(unseenOf(mine));
      mine = markSeen(mine);
      saveMine(mine);
      renderDot();
      void check();
    }
    render("tab");
  }
  dlg.addEventListener("close", () => {
    if (status?.kind !== "busy") status = null;
    opener?.focus();
  });
  // Un clic sur le voile, hors de la fenêtre, la ferme aussi.
  dlg.addEventListener("mousedown", (e) => {
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
  });

  btn.addEventListener("click", () => open(null, btn));
  document.getElementById("remark-foot")?.addEventListener("click", (e) => open(null, e.currentTarget as HTMLElement));

  renderDot();
  if (shouldCheck(mine, Date.now())) void check();

  return {
    open,
    /** Après un changement de langue : bouton et fenêtre ouverte redessinés. */
    refresh(): void {
      renderDot();
      if (dlg.open) render();
    },
  };
}

/** « Envoyées le 25/10 (n° 12). » si ce fichier a déjà été envoyé tel quel, sinon rien. */
export function sentNote(sent: { id: number; at: number; sig: string } | undefined, contenu: unknown): string {
  if (!sent || sent.sig !== signature(contenu)) return "";
  return t("rm.fix.sent", { date: fmtDate(sent.at, { day: "numeric", month: "short" }), id: String(sent.id) });
}
