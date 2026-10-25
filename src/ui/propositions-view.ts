// Page « Propositions » (S36, maquettes public.html écran 3 et tableau.html écran 5) : sujets publiés par l'auteur,
// votes ▲ / ▼ comme sur Reddit, texte dans la langue du visiteur, traduction automatique signalée.

import { lang, t, type Key } from "../i18n/i18n.ts";
import { esc, fmtDate } from "./format.ts";
import {
  askedBy,
  filterSubjects,
  loadSubjects,
  loadVotes,
  nextVote,
  rememberVote,
  sendVote,
  shown,
  SUBJECT_STATES,
  withVote,
  type Shown,
  type Sort,
  type Subject,
  type SubjectState,
} from "./propositions.ts";

const AUTHOR = "Orangentleman";

export function initPropositions(root: HTMLElement, openFeedback: (from: HTMLElement) => void) {
  let list: Subject[] | null = null;
  let failed = false;
  let q = "";
  let state: SubjectState | "" = "";
  let sort: Sort = "score";
  /** Sujets dont l'original est montré (« Voir l'original »). */
  const originals = new Set<string>();
  /** Message d'un vote refusé, sous le sujet concerné. */
  let voteError: { id: number; html: string } | null = null;
  const busy = new Set<number>();

  function text(s: Subject, sh: Shown | null, field: string, tag: "span" | "p" = "span"): string {
    if (!sh) return "";
    const key = `${s.id}:${field}`;
    const other = sh.other ? ` <small class="hint">${esc(t(`pr.other.${sh.other}` as Key))}</small>` : "";
    const auto = sh.auto
      ? ` <small class="pr-auto"><i>${esc(t("pr.auto"))}</i>${sh.original ? ` · <button type="button" class="link small" data-pr-orig="${key}" aria-expanded="${originals.has(key)}">${esc(t(originals.has(key) ? "pr.original.hide" : "pr.original"))}</button>` : ""}</small>`
      : "";
    const orig = sh.auto && sh.original && originals.has(key) ? `<span class="pr-orig" lang="${lang() === "en" ? "fr" : "en"}">${esc(sh.original)}</span>` : "";
    return `<${tag} class="pr-${field}">${esc(sh.text)}${other}${auto}${orig}</${tag}>`;
  }

  function article(s: Subject): string {
    const l = lang();
    const title = shown(s, "titre", l);
    const titleText = title?.text ?? "";
    const desc = shown(s, "description", l);
    const reply = shown(s, "reponse", l);
    const mine = s.monVote === 1 ? t("pr.mine.up") : s.monVote === -1 ? t("pr.mine.down") : "";
    const meta = [
      mine,
      `${t("pr.asked", { n: askedBy(s) })} (${t("pr.asked.detail", { remarks: s.demandes, up: s.pour })})`,
      s.contre ? t("pr.down.n", { n: s.contre }) : "",
      s.maj ? t("pr.updated", { date: fmtDate(s.maj, { day: "numeric", month: "short", year: "numeric" }) }) : "",
    ].filter(Boolean);
    const dis = busy.has(s.id) ? " disabled" : "";
    return `<article class="pr" aria-labelledby="pr-t-${s.id}">
      <div class="pr-vote">
        <button type="button" data-pr-vote="1" data-pr-id="${s.id}" aria-pressed="${s.monVote === 1}" aria-label="${esc(t("pr.up", { title: titleText }))}"${dis}>▲</button>
        <span class="n" aria-label="${esc(t("pr.score"))} ${s.score}">${s.score}</span>
        <button type="button" data-pr-vote="-1" data-pr-id="${s.id}" aria-pressed="${s.monVote === -1}" aria-label="${esc(t("pr.down", { title: titleText }))}"${dis}>▼</button>
      </div>
      <div class="pr-body">
        <h3 id="pr-t-${s.id}">${text(s, title, "titre")} <span class="st ${s.etat}">${esc(t(`pr.state.${s.etat}` as Key))}</span></h3>
        ${text(s, desc, "description", "p")}
        ${reply ? `<div class="rep"><b>${esc(t("pr.reply", { who: AUTHOR }))}</b> ${text(s, reply, "reponse")}</div>` : ""}
        <div class="meta" role="status">${esc(meta.join(" · "))}</div>
        ${voteError?.id === s.id ? `<div class="rm-err" role="alert">${voteError.html}</div>` : ""}
      </div>
    </article>`;
  }

  function listHtml(): string {
    if (failed) return `<div class="rm-err" role="alert">${esc(t("pr.offline"))} <button type="button" data-pr="retry">${esc(t("pr.retry"))}</button></div>`;
    if (!list) return `<p class="hint">${esc(t("pr.loading"))}</p>`;
    if (!list.length) return `<div class="pr-empty">${esc(t("pr.empty"))}</div>`;
    const shownList = filterSubjects(list, q, state, sort);
    if (!shownList.length) return `<p class="hint">${esc(t("pr.none"))}</p>`;
    return shownList.map(article).join("");
  }

  function render(): void {
    const out = root.querySelector<HTMLElement>("#pr-list");
    if (!out) return;
    out.innerHTML = listHtml();
    const stateSel = root.querySelector<HTMLSelectElement>("#pr-state")!;
    stateSel.innerHTML = [`<option value="">${esc(t("pr.state.all"))}</option>`, ...SUBJECT_STATES.map((k) => `<option value="${k}">${esc(t(`pr.state.${k}` as Key))}</option>`)].join("");
    stateSel.value = state;
    const sortSel = root.querySelector<HTMLSelectElement>("#pr-sort")!;
    sortSel.innerHTML = (["score", "recent"] as const).map((k) => `<option value="${k}">${esc(t(`pr.sort.${k}`))}</option>`).join("");
    sortSel.value = sort;
  }

  async function load(): Promise<void> {
    const res = await loadSubjects();
    failed = !res.ok;
    if (res.ok) {
      // Le service reconnaît le vote de ce navigateur ; la mémoire locale garde le même.
      const local = loadVotes();
      for (const s of res.list) if ((local[s.id] ?? 0) !== s.monVote) rememberVote(s.id, s.monVote);
      list = res.list;
    }
    render();
  }

  async function vote(id: number, clicked: 1 | -1): Promise<void> {
    const s = list?.find((x) => x.id === id);
    if (!s || busy.has(id)) return;
    const v = nextVote(s.monVote, clicked);
    const before = s;
    list = list!.map((x) => (x.id === id ? withVote(x, v) : x));
    busy.add(id);
    voteError = null;
    render();
    const res = await sendVote(id, v);
    busy.delete(id);
    if (res.ok) {
      list = list!.map((x) => (x.id === id ? { ...x, pour: res.pour, contre: res.contre, score: res.score, demandes: res.demandes, monVote: res.monVote } : x));
      rememberVote(id, res.monVote);
    } else {
      list = list!.map((x) => (x.id === id ? before : x));
      const map: Record<string, string> = { "deja-compte": t("pr.err.deja"), "trop-de-votes": t("pr.err.trop"), reseau: t("pr.err.reseau") };
      voteError = { id, html: esc(map[res.code] ?? t("pr.err.autre", { code: res.code })) };
    }
    render();
    root.querySelector<HTMLElement>(`[data-pr-id="${id}"][data-pr-vote="${clicked}"]`)?.focus();
  }

  root.addEventListener("click", (e) => {
    const el = e.target as HTMLElement;
    const btn = el.closest<HTMLElement>("[data-pr-vote]");
    if (btn) return void vote(Number(btn.dataset.prId), Number(btn.dataset.prVote) as 1 | -1);
    const orig = el.closest<HTMLElement>("[data-pr-orig]")?.dataset.prOrig;
    if (orig) {
      if (originals.has(orig)) originals.delete(orig);
      else originals.add(orig);
      render();
      root.querySelector<HTMLElement>(`[data-pr-orig="${orig}"]`)?.focus();
      return;
    }
    const act = el.closest<HTMLElement>("[data-pr]")?.dataset.pr;
    if (act === "retry") {
      failed = false;
      list = null;
      render();
      void load();
    } else if (act === "feedback") openFeedback(el.closest<HTMLElement>("[data-pr]")!);
  });
  root.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement;
    if (el.id !== "pr-q") return;
    q = el.value;
    const out = root.querySelector<HTMLElement>("#pr-list");
    if (out) out.innerHTML = listHtml();
  });
  root.addEventListener("change", (e) => {
    const el = e.target as HTMLSelectElement;
    if (el.id === "pr-state") state = el.value as SubjectState | "";
    else if (el.id === "pr-sort") sort = el.value as Sort;
    else return;
    render();
  });

  return {
    /** La page s'affiche : relit les sujets à chaque visite (le service est petit, la liste aussi). */
    show(): void {
      render();
      void load();
    },
    /** Après un changement de langue. */
    refresh(): void {
      render();
    },
  };
}
