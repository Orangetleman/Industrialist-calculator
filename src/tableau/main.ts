// Tableau de bord de l'auteur (S36), page à part `/tableau/` : lire les remarques, les marquer, les ranger par sujet,
// y répondre, publier ou non un sujet, traduire automatiquement (DeepL, par le service), télécharger les corrections.
// Maquettes : public.html (S16, écran 4) et tableau.html (S36). En français seulement (décision S36 Remarques).
// Tout passe par /api/admin/ (cookie de session posé par le service, invisible au JavaScript).

import "../styles.css";
import "./tableau.css";
import {
  aTraduire,
  CHAMPS,
  depuis,
  erreur,
  ETATS_REMARQUE,
  ETATS_SUJET,
  FILTRES_ETAT,
  filtrer,
  lienPage,
  titreDe,
  TYPES,
  type Champ,
  type EtatRemarque,
  type EtatSujet,
  type Filtres,
  type FiltreEtat,
  type Remarque,
  type Sujet,
  type TypeRemarque,
} from "./modele.ts";

const API = "/api/admin";
const racine = document.getElementById("tb")!;
const statut = document.getElementById("tb-status")!;
const ask = document.getElementById("tb-ask") as HTMLDialogElement;

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const date = (ms: number) => new Date(ms).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

class Refus extends Error {
  statut: number;
  constructor(statut: number, code: string) {
    super(code);
    this.statut = statut;
  }
}

async function api<T>(chemin: string, methode = "GET", corps?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(API + chemin, {
      method: methode,
      headers: corps === undefined ? {} : { "Content-Type": "application/json" },
      body: corps === undefined ? undefined : JSON.stringify(corps),
      credentials: "same-origin",
    });
  } catch {
    throw new Refus(0, "reseau");
  }
  const valeur = (await r.json().catch(() => null)) as (T & { erreur?: string }) | null;
  if (!r.ok) throw new Refus(r.status, valeur?.erreur ?? (r.status >= 500 ? "reseau" : `http-${r.status}`));
  return valeur as T;
}

// ---------------------------------------------------------------- état

type Onglet = "boite" | "sujets" | "corrections";
const etat = {
  connecte: false,
  traducteur: false,
  onglet: "boite" as Onglet,
  remarques: [] as Remarque[],
  sujets: [] as Sujet[],
  filtres: { type: "", etat: "a-traiter", langue: "" } as Filtres,
  /** Remarque ouverte (boîte) ou sujet ouvert (sujets). */
  remarque: null as number | null,
  sujet: null as number | null,
  /** Formulaire « Nouveau sujet » ouvert pour cette remarque (ou -1 : sans remarque). */
  nouveau: null as number | null,
  erreurConnexion: "",
  occupe: false,
};
/** Brouillons (réponse d'une remarque, champs d'un sujet), gardés pendant la visite. */
const reponses = new Map<number, string>();
const brouillons = new Map<number, Partial<Record<Champ, string>> & { auto?: Champ[]; tous?: boolean }>();
const nouveauBrouillon: Partial<Record<Champ, string>> & { auto?: Champ[]; publie?: boolean } = {};

function dire(texte: string, mauvais = false): void {
  statut.textContent = texte;
  statut.classList.toggle("bad", mauvais);
  statut.classList.toggle("on", !!texte);
  window.clearTimeout(dire.minuterie);
  if (texte) dire.minuterie = window.setTimeout(() => statut.classList.remove("on"), mauvais ? 8000 : 3500);
}
dire.minuterie = 0;

/** Un échec : la session perdue ramène à l'entrée, le reste s'affiche en bas. */
function echec(e: unknown): void {
  const code = e instanceof Refus ? e.message : "reseau";
  if (e instanceof Refus && e.statut === 401) {
    etat.connecte = false;
    etat.erreurConnexion = erreur("non-connecte");
    rendre();
    return;
  }
  dire(erreur(code), true);
}

async function recharger(): Promise<void> {
  const [remarques, sujets] = await Promise.all([api<Remarque[]>("/remarques"), api<Sujet[]>("/sujets")]);
  etat.remarques = remarques;
  etat.sujets = sujets;
}

// ---------------------------------------------------------------- entrée

function pageConnexion(): string {
  return `<form class="tb-login" id="tb-login">
    <h1>📥 Remarques — Planificateur Industrialist</h1>
    <label>Mot de passe <input type="password" id="tb-mdp" autocomplete="current-password" required></label>
    ${etat.erreurConnexion ? `<div class="tb-err" role="alert">${esc(etat.erreurConnexion)}</div>` : ""}
    <button type="submit" class="primary"${etat.occupe ? " disabled" : ""}>${etat.occupe ? "Entrée…" : "Entrer"}</button>
    <p class="hint">Réservé à l'auteur du site.</p>
  </form>`;
}

async function connexion(motDePasse: string): Promise<void> {
  etat.occupe = true;
  etat.erreurConnexion = "";
  rendre();
  try {
    await api("/connexion", "POST", { motDePasse });
    await entrer();
  } catch (e) {
    etat.erreurConnexion = erreur(e instanceof Refus ? e.message : "reseau");
    etat.occupe = false;
    rendre("#tb-mdp");
  }
}

async function entrer(): Promise<void> {
  const session = await api<{ traducteur?: boolean }>("/session");
  etat.traducteur = !!session.traducteur;
  await recharger();
  etat.connecte = true;
  etat.occupe = false;
  suivreAdresse();
  rendre();
}

// ---------------------------------------------------------------- en-tête et onglets

function entete(): string {
  const nouvelles = etat.remarques.filter((r) => r.etat === "nouvelle").length;
  const corrections = etat.remarques.filter((r) => r.type === "correction").length;
  const onglet = (k: Onglet, label: string) =>
    `<button type="button" role="tab" id="tb-tab-${k}" aria-selected="${etat.onglet === k}" tabindex="${etat.onglet === k ? 0 : -1}" data-onglet="${k}">${label}</button>`;
  return `<header class="tb-head">
    <h1>📥 Remarques</h1>
    <div class="tb-tabs" role="tablist" aria-label="Parties du tableau de bord">
      ${onglet("boite", `Boîte de réception${nouvelles ? ` <span class="chip">${nouvelles} nouvelle${nouvelles > 1 ? "s" : ""}</span>` : ""}`)}
      ${onglet("sujets", `Sujets (${etat.sujets.length})`)}
      ${onglet("corrections", `Corrections (${corrections})`)}
    </div>
    <span class="tb-right">${etat.traducteur ? "" : `<span class="hint" title="${esc(erreur("traducteur-absent"))}">🌐 traducteur non réglé · </span>`}<button type="button" class="link" data-act="exporter">Exporter tout (JSON)</button> · <button type="button" class="link" data-act="sortir">Se déconnecter</button></span>
  </header>`;
}

// ---------------------------------------------------------------- boîte de réception

function ligneRemarque(r: Remarque): string {
  const sujet = r.sujet ? etat.sujets.find((s) => s.id === r.sujet) : null;
  const h = [
    r.etat === "nouvelle" ? `<span class="new">● nouvelle</span>` : "",
    `n° ${r.id}`,
    TYPES[r.type] ?? r.type,
    r.langue?.toUpperCase() ?? "",
    depuis(r.cree),
    r.etat !== "nouvelle" ? ETATS_REMARQUE[r.etat] : "",
    r.reponse ? "répondue" : "",
    sujet ? `📁 ${esc(titreDe(sujet))}` : "",
  ].filter(Boolean);
  const apercu = r.type === "correction" && !r.texte ? "(fichier de corrections)" : r.texte;
  return `<li><button type="button" class="tb-it${etat.remarque === r.id ? " sel" : ""}" data-remarque="${r.id}" aria-current="${etat.remarque === r.id}">
    <span class="h">${h.map((x) => (x.startsWith("<span") || x.startsWith("📁") ? x : esc(x))).join(" · ")}</span>
    <span class="t">${esc(apercu)}</span></button></li>`;
}

function filtresHtml(): string {
  const f = etat.filtres;
  const opt = (v: string, label: string, sel: string) => `<option value="${v}"${v === sel ? " selected" : ""}>${esc(label)}</option>`;
  return `<div class="tb-filters">
    <select id="f-type" aria-label="Type">${opt("", "Tous les types", f.type)}${Object.entries(TYPES).map(([k, v]) => opt(k, v, f.type)).join("")}</select>
    <select id="f-etat" aria-label="État">${Object.entries(FILTRES_ETAT).map(([k, v]) => opt(k, v, f.etat)).join("")}</select>
    <select id="f-langue" aria-label="Langue">${opt("", "FR + EN", f.langue)}${opt("fr", "FR", f.langue)}${opt("en", "EN", f.langue)}</select>
  </div>`;
}

function selectSujet(r: Remarque): string {
  const options = etat.sujets.map((s) => `<option value="${s.id}"${r.sujet === s.id ? " selected" : ""}>${esc(titreDe(s))} (score ${s.score})</option>`).join("");
  return `<label>Ranger dans un sujet
    <select id="r-sujet"><option value="">— aucun —</option>${options}<option value="nouveau">+ Nouveau sujet…</option></select></label>`;
}

function formulaireNouveau(r: Remarque | null): string {
  const v = nouveauBrouillon;
  const auto = new Set(v.auto ?? []);
  const champ = (c: Champ, label: string) =>
    `<label>${label}${auto.has(c) ? ` <small class="hint">· traduction automatique</small>` : ""}<input type="text" data-nouveau="${c}" maxlength="300" value="${esc(v[c] ?? "")}"></label>`;
  return `<div class="panel tb-new" role="group" aria-labelledby="tb-new-t">
    <b id="tb-new-t">Nouveau sujet${r ? ` (avec la remarque n° ${r.id})` : ""}</b>
    <div class="two">${champ("titre", "Titre (français)")}${champ("titre_en", "Titre (anglais)")}</div>
    <div class="acts"><button type="button" class="small" data-act="traduire-nouveau"${etat.occupe ? " disabled" : ""}>🌐 Traduire automatiquement</button><span class="hint">remplit le champ vide depuis celui que tu as écrit ; tu corriges ensuite si besoin</span></div>
    <div class="acts"><button type="button" class="primary" data-act="creer-sujet">Créer le sujet</button>
      <label class="inline"><input type="checkbox" id="n-publie"${v.publie ? " checked" : ""}> Publier tout de suite</label>
      <button type="button" data-act="annuler-nouveau">Annuler</button></div>
  </div>`;
}

function detailRemarque(r: Remarque): string {
  const seg = (Object.keys(ETATS_REMARQUE) as EtatRemarque[])
    .map((k) => `<button type="button" aria-pressed="${r.etat === k}" data-etat-remarque="${k}">${ETATS_REMARQUE[k]}</button>`)
    .join("");
  const lien = lienPage(r.page);
  const ctx = [
    `Pseudo : <b>${esc(r.pseudo ?? "—")}</b>`,
    r.page ? `Page : ${lien ? `<a href="${esc(lien)}" target="_blank" rel="noopener">${esc(r.page)} ▸</a>` : esc(r.page)}` : "",
    r.plan ? `Plan : ${esc(r.plan)}` : "",
    r.langue ? `Langue : ${r.langue.toUpperCase()}` : "",
    r.version ? `version ${esc(r.version)}` : "",
    `reçue le ${date(r.cree)}`,
  ].filter(Boolean);
  const traduire =
    r.texte && r.langue !== "fr"
      ? `<div class="acts">${r.traduction ? `<p class="tb-trad"><b>En français :</b> ${esc(r.traduction)} <i class="hint">(traduction automatique)</i></p>` : `<button type="button" class="small" data-act="traduire-remarque"${etat.occupe ? " disabled" : ""}>🌐 Traduire en français</button>`}</div>`
      : "";
  const piece = r.aPiece
    ? `<div class="tb-corr"><b>📎 Fichier joint</b> <button type="button" class="small primary" data-telecharger="${r.id}">⬇ Télécharger le JSON</button> <span class="hint">à intégrer par « Importer… », comme aujourd'hui</span></div>`
    : "";
  const reponse = reponses.get(r.id) ?? r.reponse ?? "";
  return `<div class="tb-det" id="tb-det">
    <button type="button" class="link tb-back" data-act="liste">← Liste</button>
    <div class="acts"><h2 tabindex="-1" id="tb-det-t">n° ${r.id} · ${esc(TYPES[r.type] ?? r.type)}</h2><span class="seg" role="group" aria-label="État de la remarque">${seg}</span></div>
    <div class="quote" lang="${r.langue ?? "fr"}">${esc(r.texte || "(sans texte)")}</div>
    ${traduire}
    <div class="ctx">${ctx.map((x) => `<span>${x}</span>`).join("")}</div>
    ${piece}
    ${selectSujet(r)}
    ${etat.nouveau === r.id ? formulaireNouveau(r) : ""}
    <label>Répondre au joueur (il le lit dans « Mes remarques »)
      <textarea id="r-reponse" maxlength="2000" lang="${r.langue ?? "fr"}">${esc(reponse)}</textarea></label>
    <div class="acts">
      <button type="button" class="primary" data-act="repondre">Enregistrer la réponse</button>
      ${r.sujet === null && etat.nouveau !== r.id ? `<button type="button" data-act="repondre-et-sujet">Enregistrer et créer un sujet…</button>` : ""}
      <span class="hint">${r.repondu ? `Réponse envoyée le ${date(r.repondu)}` : "Pas encore de réponse"}</span>
      <button type="button" class="tb-del" data-act="supprimer-remarque">Supprimer (abus)…</button>
    </div>
  </div>`;
}

function boite(): string {
  const liste = filtrer(etat.remarques, etat.filtres);
  const r = etat.remarques.find((x) => x.id === etat.remarque) ?? null;
  return `<div class="tb${r ? " a-choix" : ""}" role="tabpanel" aria-labelledby="tb-tab-boite">
    <div class="tb-list">${filtresHtml()}
      ${liste.length ? `<ul class="tb-ul">${liste.map(ligneRemarque).join("")}</ul>` : `<p class="hint tb-vide">Aucune remarque ici.</p>`}</div>
    ${r ? detailRemarque(r) : `<div class="tb-det tb-rien"><p class="hint">Choisis une remarque dans la liste.</p></div>`}
  </div>`;
}

// ---------------------------------------------------------------- sujets

function ligneSujet(s: Sujet): string {
  return `<li><button type="button" class="tb-s" data-sujet="${s.id}">
    <span class="n" aria-label="score">${s.score}</span>
    <span class="t"><b>${esc(titreDe(s))}</b> · ${ETATS_SUJET[s.etat]} · ${s.reponse || s.reponse_en ? "réponse écrite" : "pas de réponse"}${s.auto.length ? " · 🌐 à relire" : ""}<br>
      <small class="hint">${s.demandes} remarque${s.demandes > 1 ? "s" : ""} + ${s.pour} ▲ − ${s.contre} ▼</small></span>
    <span class="pub">${s.publie ? "✓ Publié" : "Non publié"}</span></button></li>`;
}

function valeursSujet(s: Sujet): Partial<Record<Champ, string>> & { auto?: Champ[]; tous?: boolean } {
  if (!brouillons.has(s.id)) brouillons.set(s.id, { ...Object.fromEntries(CHAMPS.map((c) => [c, s[c] ?? ""])), auto: [...s.auto] });
  return brouillons.get(s.id)!;
}

function detailSujet(s: Sujet): string {
  const v = valeursSujet(s);
  const auto = new Set(v.auto ?? []);
  const lesRemarques = etat.remarques.filter((r) => r.sujet === s.id);
  const sansReponse = lesRemarques.filter((r) => !r.reponse).length;
  const champ = (c: Champ, label: string, long = false) => {
    const marque = auto.has(c) ? ` <small class="hint">· traduction automatique, pas encore relue</small>` : "";
    const lang = c.endsWith("_en") ? "en" : "fr";
    return long
      ? `<label>${label}${marque}<textarea data-champ="${c}" maxlength="2000" lang="${lang}">${esc(v[c] ?? "")}</textarea></label>`
      : `<label>${label}${marque}<input type="text" data-champ="${c}" maxlength="300" lang="${lang}" value="${esc(v[c] ?? "")}"></label>`;
  };
  const seg = (Object.keys(ETATS_SUJET) as EtatSujet[]).map((k) => `<button type="button" aria-pressed="${s.etat === k}" data-etat-sujet="${k}">${ETATS_SUJET[k]}</button>`).join("");
  return `<div class="tb-det tb-sujet" role="tabpanel" aria-labelledby="tb-tab-sujets">
    <button type="button" class="link" data-act="sujets">← Sujets</button>
    <div class="acts"><span class="count">${s.score}</span><span>score · ${s.demandes + s.pour} joueur${s.demandes + s.pour > 1 ? "s l'ont" : " l'a"} demandé<br><small class="hint">${s.demandes} remarque${s.demandes > 1 ? "s" : ""} + ${s.pour} ▲ − ${s.contre} ▼</small></span>
      <label class="inline tb-pub"><input type="checkbox" id="s-publie"${s.publie ? " checked" : ""}> Publié dans Propositions</label></div>
    <h2 tabindex="-1" id="tb-det-t" class="sr-only">Sujet : ${esc(titreDe(s))}</h2>
    <div class="acts"><button type="button" class="small" data-act="traduire-sujet"${etat.occupe ? " disabled" : ""}>🌐 Traduire automatiquement</button><span class="hint">remplit les champs vides depuis l'autre langue ; corrige ensuite si besoin</span></div>
    <div class="two">
      ${champ("titre", "Titre (français)")}${champ("titre_en", "Titre (anglais)")}
      ${champ("description", "Description publique (français)", true)}${champ("description_en", "Description publique (anglais)", true)}
    </div>
    <div class="acts"><b class="lbl">État</b> <span class="seg" role="group" aria-label="État du sujet">${seg}</span></div>
    <div class="two">${champ("reponse", "Ta réponse publique (français)", true)}${champ("reponse_en", "Ta réponse publique (anglais)", true)}</div>
    ${sansReponse ? `<label class="inline"><input type="checkbox" id="s-tous"${v.tous ? " checked" : ""}> Envoyer aussi cette réponse aux ${sansReponse} joueur${sansReponse > 1 ? "s" : ""} du sujet sans réponse (dans leur langue)</label>` : ""}
    <div class="acts"><button type="button" class="primary" data-act="enregistrer-sujet">Enregistrer</button>
      <span class="hint">${s.maj ? `Mis à jour le ${date(s.maj)}` : ""}</span>
      <button type="button" class="tb-del" data-act="supprimer-sujet">Supprimer le sujet…</button></div>
    <h3 class="tb-cap">Remarques rangées ici (${lesRemarques.length})</h3>
    ${
      lesRemarques.length
        ? `<ul class="tb-ul">${lesRemarques
            .map(
              (r) => `<li class="subrem"><b>n° ${r.id}</b> ${r.langue?.toUpperCase() ?? ""} ${r.pseudo ? `· ${esc(r.pseudo)}` : ""} · « ${esc(r.texte.slice(0, 120))}${r.texte.length > 120 ? "…" : ""} »
              <span class="x"><button type="button" class="link" data-ouvrir="${r.id}">Ouvrir</button> · <button type="button" class="link" data-retirer="${r.id}">Retirer du sujet</button></span></li>`,
            )
            .join("")}</ul>`
        : `<p class="hint">Aucune remarque : range-en depuis la boîte de réception.</p>`
    }
    <p class="hint">Supprimer un sujet ne supprime pas ses remarques : elles redeviennent « non rangées ». Ses votes sont perdus.</p>
  </div>`;
}

function sujets(): string {
  const s = etat.sujets.find((x) => x.id === etat.sujet);
  if (s) return detailSujet(s);
  return `<div class="tb-pane" role="tabpanel" aria-labelledby="tb-tab-sujets">
    <div class="acts"><button type="button" data-act="nouveau-sujet">+ Nouveau sujet</button><span class="hint">Les plus demandés d'abord ; un clic ouvre le sujet.</span></div>
    ${etat.nouveau === -1 ? formulaireNouveau(null) : ""}
    ${etat.sujets.length ? `<ul class="tb-ul tb-subj">${etat.sujets.map(ligneSujet).join("")}</ul>` : `<p class="hint">Aucun sujet pour l'instant.</p>`}
  </div>`;
}

// ---------------------------------------------------------------- corrections

function corrections(): string {
  const liste = etat.remarques.filter((r) => r.type === "correction");
  return `<div class="tb-pane" role="tabpanel" aria-labelledby="tb-tab-corrections">
    ${
      liste.length
        ? liste
            .map(
              (r) => `<div class="tb-corr"><b>n° ${r.id}</b> · ${r.langue?.toUpperCase() ?? ""} · ${depuis(r.cree)} · ${esc(r.pseudo ?? "sans pseudo")} · ${ETATS_REMARQUE[r.etat]}
              ${r.texte ? `<div>${esc(r.texte)}</div>` : ""}
              <div class="acts"><button type="button" class="primary small" data-telecharger="${r.id}"${r.aPiece ? "" : " disabled"}>⬇ Télécharger le JSON</button><button type="button" class="small" data-ouvrir="${r.id}">Ouvrir la remarque</button><span class="hint">à intégrer par « Importer… », comme aujourd'hui</span></div></div>`,
            )
            .join("")
        : `<p class="hint">Aucune correction reçue.</p>`
    }
  </div>`;
}

// ---------------------------------------------------------------- rendu

function rendre(focus?: string): void {
  const actif = document.activeElement as HTMLElement | null;
  const garde = focus ?? (actif?.id ? `#${actif.id}` : actif?.dataset.remarque ? `[data-remarque="${actif.dataset.remarque}"]` : null);
  if (!etat.connecte) racine.innerHTML = pageConnexion();
  else racine.innerHTML = entete() + (etat.onglet === "boite" ? boite() : etat.onglet === "sujets" ? sujets() : corrections());
  if (garde) racine.querySelector<HTMLElement>(garde)?.focus();
}

// ---------------------------------------------------------------- actions

function remarque(id: number | null): Remarque | undefined {
  return etat.remarques.find((r) => r.id === id);
}

async function ouvrirRemarque(id: number): Promise<void> {
  etat.onglet = "boite";
  etat.remarque = id;
  etat.nouveau = null;
  const r = remarque(id);
  if (r && !filtrer([r], etat.filtres).length) etat.filtres = { type: "", etat: "toutes", langue: "" };
  history.replaceState(null, "", `#${id}`);
  rendre("#tb-det-t");
  // Ouvrir une remarque nouvelle la marque « Lue » (le joueur le voit dans « Mes remarques »).
  if (r?.etat === "nouvelle") await changerRemarque(id, { etat: "lue" });
}

async function changerRemarque(id: number, corps: Record<string, unknown>): Promise<boolean> {
  try {
    const nouvelle = await api<Remarque>(`/remarques/${id}`, "POST", corps);
    etat.remarques = etat.remarques.map((r) => (r.id === id ? { ...r, ...nouvelle, aPiece: r.aPiece } : r));
    if ("sujet" in corps) etat.sujets = await api<Sujet[]>("/sujets");
    rendre();
    return true;
  } catch (e) {
    echec(e);
    return false;
  }
}

async function repondre(id: number): Promise<boolean> {
  const texte = reponses.get(id) ?? remarque(id)?.reponse ?? "";
  const ok = await changerRemarque(id, { reponse: texte });
  if (ok) {
    reponses.delete(id);
    dire(texte.trim() ? "Réponse enregistrée : le joueur la verra dans « Mes remarques »." : "Réponse effacée.");
  }
  return ok;
}

function ouvrirNouveau(r: Remarque | null): void {
  for (const c of CHAMPS) delete nouveauBrouillon[c];
  nouveauBrouillon.auto = [];
  nouveauBrouillon.publie = false;
  if (r?.texte) {
    // Titre proposé : le début de la remarque, dans sa langue.
    const debut = r.texte.split(/[.!?\n]/)[0]!.trim().slice(0, 80);
    nouveauBrouillon[r.langue === "en" ? "titre_en" : "titre"] = debut;
  }
  etat.nouveau = r ? r.id : -1;
  rendre('[data-nouveau="titre"]');
}

async function traduireChamps(valeurs: Partial<Record<Champ, string>> & { auto?: Champ[] }): Promise<boolean> {
  const travaux = aTraduire(valeurs);
  if (!travaux.length) {
    dire("Rien à traduire : remplis un champ, et laisse vide celui de l'autre langue.");
    return false;
  }
  etat.occupe = true;
  rendre();
  try {
    for (const { vers, depuis: sources, vides } of travaux) {
      const { textes } = await api<{ textes: string[] }>("/traduire", "POST", { textes: sources.map((c) => valeurs[c]!.trim()), vers });
      vides.forEach((c, i) => (valeurs[c] = textes[i]!));
      valeurs.auto = [...new Set([...(valeurs.auto ?? []), ...vides])];
    }
    dire("Traduit automatiquement : relis et corrige si besoin.");
    return true;
  } catch (e) {
    echec(e);
    return false;
  } finally {
    etat.occupe = false;
    rendre();
  }
}

async function creerSujet(): Promise<void> {
  const r = etat.nouveau !== null && etat.nouveau > 0 ? remarque(etat.nouveau) : undefined;
  try {
    const s = await api<Sujet>("/sujets", "POST", {
      titre: nouveauBrouillon.titre ?? "",
      titre_en: nouveauBrouillon.titre_en ?? "",
      auto: nouveauBrouillon.auto ?? [],
      publie: !!nouveauBrouillon.publie,
      ...(r ? { remarque: r.id } : {}),
    });
    await recharger();
    etat.nouveau = null;
    dire(`Sujet « ${titreDe(s)} » créé${r ? `, avec la remarque n° ${r.id}` : ""}${nouveauBrouillon.publie ? " et publié" : ""}.`);
    if (r) rendre("#r-sujet");
    else {
      etat.sujet = s.id;
      rendre("#tb-det-t");
    }
  } catch (e) {
    echec(e);
  }
}

async function enregistrerSujet(s: Sujet): Promise<void> {
  const v = valeursSujet(s);
  const corps: Record<string, unknown> = { auto: v.auto ?? [] };
  for (const c of CHAMPS) corps[c] = v[c] ?? "";
  try {
    await api<Sujet>(`/sujets/${s.id}`, "POST", corps);
    let message = "Sujet enregistré.";
    if (v.tous && (v.reponse?.trim() || v.reponse_en?.trim())) {
      const { repondu } = await api<{ repondu: number[] }>(`/sujets/${s.id}/repondre`, "POST", { reponse: v.reponse ?? "", reponse_en: v.reponse_en ?? "" });
      message += ` Réponse envoyée à ${repondu.length} joueur${repondu.length > 1 ? "s" : ""}.`;
    }
    brouillons.delete(s.id);
    await recharger();
    dire(message);
    rendre();
  } catch (e) {
    echec(e);
  }
}

async function changerSujet(id: number, corps: Record<string, unknown>, message: string): Promise<void> {
  try {
    const s = await api<Sujet>(`/sujets/${id}`, "POST", corps);
    etat.sujets = etat.sujets.map((x) => (x.id === id ? s : x));
    dire(message);
    rendre();
  } catch (e) {
    echec(e);
  }
}

/** Confirmation (suppression définitive). */
function confirmer(titre: string, texte: string, bouton: string): Promise<boolean> {
  return new Promise((ok) => {
    const retour = document.activeElement as HTMLElement | null;
    ask.innerHTML = `<form method="dialog"><h3 id="tb-ask-title">${esc(titre)}</h3><p class="hint">${esc(texte)}</p>
      <div class="acts tb-ask-acts"><button value="non" autofocus>Annuler</button><button value="oui" class="primary">${esc(bouton)}</button></div></form>`;
    ask.addEventListener(
      "close",
      () => {
        ok(ask.returnValue === "oui");
        retour?.focus();
      },
      { once: true },
    );
    ask.returnValue = "";
    ask.showModal();
  });
}

async function telecharger(id: number): Promise<void> {
  try {
    const r = await api<Remarque & { piece: string | null }>(`/remarques/${id}`);
    if (!r.piece) return dire("Cette remarque n'a pas de fichier joint.", true);
    const piece = JSON.parse(r.piece) as { fichier?: string; contenu?: unknown };
    const nom = `n${id}-${(piece.fichier ?? "corrections.json").replace(/[^\w.-]/g, "_")}`;
    enregistrerFichier(nom, piece.contenu ?? piece);
  } catch (e) {
    echec(e);
  }
}

function enregistrerFichier(nom: string, contenu: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(contenu, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nom });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** `/tableau/#14` (lien du message Discord) ouvre la remarque n° 14. */
function suivreAdresse(): void {
  const n = Number(location.hash.slice(1));
  if (Number.isSafeInteger(n) && n > 0 && remarque(n)) {
    etat.onglet = "boite";
    etat.remarque = n;
    const r = remarque(n)!;
    if (!filtrer([r], etat.filtres).length) etat.filtres = { type: "", etat: "toutes", langue: "" };
    if (r.etat === "nouvelle") void changerRemarque(n, { etat: "lue" });
  }
}

// ---------------------------------------------------------------- événements

racine.addEventListener("submit", (e) => {
  if ((e.target as HTMLElement).id !== "tb-login") return;
  e.preventDefault();
  void connexion((racine.querySelector<HTMLInputElement>("#tb-mdp")?.value ?? "").trim());
});

racine.addEventListener("click", async (e) => {
  const el = e.target as HTMLElement;
  const onglet = el.closest<HTMLElement>("[data-onglet]")?.dataset.onglet as Onglet | undefined;
  if (onglet) {
    etat.onglet = onglet;
    etat.nouveau = null;
    if (onglet !== "boite") history.replaceState(null, "", location.pathname);
    return rendre(`#tb-tab-${onglet}`);
  }
  const idR = el.closest<HTMLElement>("[data-remarque]")?.dataset.remarque;
  if (idR) return void ouvrirRemarque(Number(idR));
  const idO = el.closest<HTMLElement>("[data-ouvrir]")?.dataset.ouvrir;
  if (idO) return void ouvrirRemarque(Number(idO));
  const idS = el.closest<HTMLElement>("[data-sujet]")?.dataset.sujet;
  if (idS) {
    etat.sujet = Number(idS);
    etat.nouveau = null;
    return rendre("#tb-det-t");
  }
  const idT = el.closest<HTMLElement>("[data-telecharger]")?.dataset.telecharger;
  if (idT) return void telecharger(Number(idT));
  const idRet = el.closest<HTMLElement>("[data-retirer]")?.dataset.retirer;
  if (idRet) {
    await changerRemarque(Number(idRet), { sujet: null });
    return dire(`Remarque n° ${idRet} retirée du sujet.`);
  }
  const etatR = el.closest<HTMLElement>("[data-etat-remarque]")?.dataset.etatRemarque;
  if (etatR && etat.remarque !== null) {
    await changerRemarque(etat.remarque, { etat: etatR });
    return void racine.querySelector<HTMLElement>(`[data-etat-remarque="${etatR}"]`)?.focus();
  }
  const etatS = el.closest<HTMLElement>("[data-etat-sujet]")?.dataset.etatSujet;
  if (etatS && etat.sujet !== null) {
    await changerSujet(etat.sujet, { etat: etatS }, `État : ${ETATS_SUJET[etatS as EtatSujet]}.`);
    return void racine.querySelector<HTMLElement>(`[data-etat-sujet="${etatS}"]`)?.focus();
  }
  const act = el.closest<HTMLElement>("[data-act]")?.dataset.act;
  if (!act) return;
  const r = remarque(etat.remarque);
  const s = etat.sujets.find((x) => x.id === etat.sujet);
  switch (act) {
    case "sortir":
      await api("/deconnexion", "POST").catch(() => undefined);
      etat.connecte = false;
      etat.erreurConnexion = "";
      return rendre("#tb-mdp");
    case "exporter":
      try {
        enregistrerFichier(`remarques-${new Date().toISOString().slice(0, 10)}.json`, await api("/export"));
      } catch (err) {
        echec(err);
      }
      return;
    case "liste":
      etat.remarque = null;
      history.replaceState(null, "", location.pathname);
      return rendre(".tb-it");
    case "sujets":
      etat.sujet = null;
      return rendre(`[data-sujet="${s?.id}"]`);
    case "repondre":
      if (r) await repondre(r.id);
      return;
    case "repondre-et-sujet":
      if (r && (await repondre(r.id))) ouvrirNouveau(r);
      return;
    case "nouveau-sujet":
      return ouvrirNouveau(null);
    case "annuler-nouveau":
      etat.nouveau = null;
      return rendre(etat.onglet === "boite" ? "#r-sujet" : '[data-act="nouveau-sujet"]');
    case "traduire-nouveau":
      await traduireChamps(nouveauBrouillon);
      return;
    case "creer-sujet":
      return void creerSujet();
    case "traduire-sujet":
      if (s) await traduireChamps(valeursSujet(s));
      return;
    case "enregistrer-sujet":
      if (s) await enregistrerSujet(s);
      return;
    case "traduire-remarque":
      if (!r) return;
      etat.occupe = true;
      rendre();
      try {
        const { traduction } = await api<{ traduction: string }>(`/remarques/${r.id}/traduire`, "POST", { vers: "fr" });
        etat.remarques = etat.remarques.map((x) => (x.id === r.id ? { ...x, traduction } : x));
      } catch (err) {
        echec(err);
      } finally {
        etat.occupe = false;
        rendre();
      }
      return;
    case "supprimer-remarque":
      if (!r || !(await confirmer(`Supprimer la remarque n° ${r.id} ?`, "Elle disparaît de la base et de « Mes remarques » du joueur (« Supprimée par l'auteur »). On ne peut pas revenir en arrière.", "Supprimer")))
        return;
      try {
        await api(`/remarques/${r.id}`, "DELETE");
        etat.remarque = null;
        await recharger();
        dire(`Remarque n° ${r.id} supprimée.`);
        rendre(".tb-it");
      } catch (err) {
        echec(err);
      }
      return;
    case "supprimer-sujet":
      if (!s || !(await confirmer(`Supprimer le sujet « ${titreDe(s)} » ?`, "Ses remarques redeviennent « non rangées » ; ses votes sont perdus. On ne peut pas revenir en arrière.", "Supprimer")))
        return;
      try {
        await api(`/sujets/${s.id}`, "DELETE");
        etat.sujet = null;
        await recharger();
        dire("Sujet supprimé.");
        rendre();
      } catch (err) {
        echec(err);
      }
      return;
  }
});

racine.addEventListener("input", (e) => {
  const el = e.target as HTMLInputElement | HTMLTextAreaElement;
  if (el.id === "r-reponse" && etat.remarque !== null) reponses.set(etat.remarque, el.value);
  const c = el.dataset.champ as Champ | undefined;
  const s = etat.sujets.find((x) => x.id === etat.sujet);
  if (c && s) {
    const v = valeursSujet(s);
    v[c] = el.value;
    // Un champ retouché à la main n'est plus « traduction automatique ».
    v.auto = (v.auto ?? []).filter((x) => x !== c);
  }
  const n = el.dataset.nouveau as Champ | undefined;
  if (n) {
    nouveauBrouillon[n] = el.value;
    nouveauBrouillon.auto = (nouveauBrouillon.auto ?? []).filter((x) => x !== n);
  }
});

racine.addEventListener("change", async (e) => {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  if (el.id === "f-type") etat.filtres.type = el.value as TypeRemarque | "";
  else if (el.id === "f-etat") etat.filtres.etat = el.value as FiltreEtat;
  else if (el.id === "f-langue") etat.filtres.langue = el.value as "fr" | "en" | "";
  else if (el.id === "r-sujet" && etat.remarque !== null) {
    if (el.value === "nouveau") return ouvrirNouveau(remarque(etat.remarque) ?? null);
    const id = etat.remarque;
    if (await changerRemarque(id, { sujet: el.value ? Number(el.value) : null })) {
      const s = etat.sujets.find((x) => x.id === Number(el.value));
      dire(s ? `Rangée dans « ${titreDe(s)} ».` : "Retirée de son sujet.");
    }
    return rendre("#r-sujet");
  } else if (el.id === "n-publie") {
    nouveauBrouillon.publie = (el as HTMLInputElement).checked;
    return;
  } else if (el.id === "s-tous" && etat.sujet !== null) {
    const s = etat.sujets.find((x) => x.id === etat.sujet);
    if (s) valeursSujet(s).tous = (el as HTMLInputElement).checked;
    return;
  } else if (el.id === "s-publie" && etat.sujet !== null) {
    const publie = (el as HTMLInputElement).checked;
    return changerSujet(etat.sujet, { publie }, publie ? "Publié dans Propositions." : "Retiré de Propositions.");
  } else return;
  rendre(`#${el.id}`);
});

racine.addEventListener("keydown", (e) => {
  const el = e.target as HTMLElement;
  // Onglets au clavier : ← → (modèle des onglets ARIA).
  if (el.matches("[role=tab]") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    e.preventDefault();
    const ordre: Onglet[] = ["boite", "sujets", "corrections"];
    const i = ordre.indexOf(etat.onglet);
    etat.onglet = ordre[(i + (e.key === "ArrowRight" ? 1 : 2)) % 3]!;
    etat.nouveau = null;
    return rendre(`#tb-tab-${etat.onglet}`);
  }
  // Échap : de la remarque ouverte à la liste (au téléphone, la liste revient).
  if (e.key === "Escape" && !ask.open) {
    if (etat.onglet === "boite" && etat.remarque !== null) {
      const id = etat.remarque;
      if (window.matchMedia("(max-width: 760px)").matches) {
        etat.remarque = null;
        history.replaceState(null, "", location.pathname);
      }
      rendre(`[data-remarque="${id}"]`);
    } else if (etat.onglet === "sujets" && etat.sujet !== null) {
      const id = etat.sujet;
      etat.sujet = null;
      rendre(`[data-sujet="${id}"]`);
    }
  }
});

window.addEventListener("hashchange", () => {
  if (!etat.connecte) return;
  suivreAdresse();
  rendre();
});

// Au chargement : une session encore valable (cookie) entre directement.
entrer().catch((e: unknown) => {
  etat.connecte = false;
  etat.erreurConnexion = e instanceof Refus && e.statut !== 401 ? erreur(e.message) : "";
  rendre("#tb-mdp");
});
