// Adresses du site (partie après « # ») : chaque vue a la sienne, pour que le bouton « Retour »
// (et celui du navigateur) ramène exactement à la vue précédente.
//   #objet                      page d'un objectif (onglet du résultat : le dernier utilisé)
//   #objet/schema/<étape>       onglet du résultat, avec un bloc du schéma sélectionné
//   #objet/pose/<étape>         plan de pose d'une étape
//   #objet/pose/usine-entiere/<étape>  toute l'usine, avec le panneau d'un module ouvert
//   #donnees/batiments/<id>     éditeur de bâtiments, sur un bâtiment
//   #donnees/verifier/<recette|machine>/<id>/<champ>  valeurs à vérifier, sur une valeur (lien des ⚠)
//   #recettes                   page Recettes (liste)
//   #recettes/<objet|machine>/<id>  fiche d'un objet ou d'une machine
//   #recettes/<objet|machine>/<id>/<craft>  la même fiche, un craft mis en évidence (lien du schéma)
// Fonctions pures, testées sans navigateur.

import { t } from "../i18n/i18n.ts";
import type { Goal, ResultTab } from "./state.ts";

// S23 : plus de page d'accueil (l'ancienne adresse #accueil mène à Planifier) ; « Données » devient
// « Contribuer » (#contribuer ; les adresses #donnees… restent lues).
export type Page = "plan" | "usine" | "arbre" | "recettes" | "donnees";
export type DataTab = "verifier" | "batiments";
/** Onglet de Mon usine (S29) : « Ma partie » (#usine) ou « Ma recherche » (#usine/recherche). */
export type UsineTab = "partie" | "recherche";
export type RecipeKind = "objet" | "machine";
/** Valeur à vérifier visée par un lien ⚠ (recette ou machine, et le champ). */
export type VerifyTarget = { scope: "recette" | "machine"; id: string; field?: string };
export type Route = {
  page: Page;
  goal?: Goal;
  tab?: ResultTab;
  step?: string;
  focus?: string;
  dataTab?: DataTab;
  usineTab?: UsineTab;
  machine?: string;
  verify?: VerifyTarget;
  card?: { kind: RecipeKind; id: string; craft?: string };
};

/** Entrée « Toute l'usine » de la liste des étapes du plan de pose. */
export const USINE_STEP = "usine-entiere";

export const PAGES: Page[] = ["plan", "usine", "arbre", "recettes", "donnees"];
export const GOAL_ROUTE: Record<Goal, string> = { objet: "objet", énergie: "energie", recherche: "rp", argent: "argent" };
const ROUTE_GOAL: Record<string, Goal> = { objet: "objet", energie: "énergie", rp: "recherche", argent: "argent" };
/** Titre de la page d'un objectif (« Produire un objet »), dans la langue choisie (S30). */
export const goalTitle = (g: Goal): string => t(`goal.title.${g}`);
const TABS: ResultTab[] = ["liste", "schema", "pose", "details"];
const tabTitle = (tab: ResultTab): string => t(`tab.${tab}`);
const pageTitle = (p: Page): string => t(`page.${p}`);

export function parseRoute(hash: string): Route {
  const parts = hash
    .replace(/^#/, "")
    .split("/")
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
  const [head = "", a, b, c, d] = parts;
  const goal = ROUTE_GOAL[head];
  if (goal) {
    const r: Route = { page: "plan", goal };
    if (a && (TABS as string[]).includes(a)) {
      r.tab = a as ResultTab;
      if (b && (a === "schema" || a === "pose")) r.step = b;
      if (c && a === "pose" && b === USINE_STEP) r.focus = c;
    }
    return r;
  }
  if (head === "contribuer" || head === "donnees") {
    const r: Route = { page: "donnees" };
    if (a === "verifier" || a === "batiments") r.dataTab = a;
    if (a === "batiments" && b) r.machine = b;
    if (a === "verifier" && (b === "recette" || b === "machine") && c) r.verify = { scope: b, id: c, ...(d ? { field: d } : {}) };
    return r;
  }
  if (head === "recettes") {
    const r: Route = { page: "recettes" };
    if ((a === "objet" || a === "machine") && b) r.card = { kind: a, id: b, ...(c ? { craft: c } : {}) };
    return r;
  }
  if (head === "usine") return a === "recherche" ? { page: "usine", usineTab: "recherche" } : { page: "usine" };
  return (PAGES as string[]).includes(head) && head !== "plan" ? { page: head as Page } : { page: "plan" };
}

export function routeHash(r: Route): string {
  const parts: string[] = [];
  if (r.page === "plan") {
    parts.push(GOAL_ROUTE[r.goal ?? "objet"]);
    if (r.tab) {
      parts.push(r.tab);
      if (r.step && (r.tab === "schema" || r.tab === "pose")) parts.push(r.step);
      if (r.focus && r.tab === "pose" && r.step === USINE_STEP) parts.push(r.focus);
    }
  } else if (r.page === "donnees") {
    parts.push("contribuer");
    if (r.dataTab) {
      parts.push(r.dataTab);
      if (r.machine && r.dataTab === "batiments") parts.push(r.machine);
      if (r.verify && r.dataTab === "verifier") parts.push(r.verify.scope, r.verify.id, ...(r.verify.field ? [r.verify.field] : []));
    }
  } else if (r.page === "recettes") {
    parts.push("recettes");
    if (r.card) parts.push(r.card.kind, r.card.id, ...(r.card.craft ? [r.card.craft] : []));
  } else if (r.page === "usine") {
    parts.push("usine");
    if (r.usineTab === "recherche") parts.push("recherche");
  } else parts.push(r.page);
  return `#${parts.map(encodeURIComponent).join("/")}`;
}

/** Nom court d'une vue, pour le bouton « Retour » (« Revenir à : Schéma »). */
export function routeTitle(r: Route): string {
  if (r.page === "plan" && r.tab === "pose" && (r.step === USINE_STEP || !r.step)) return t(r.focus ? "route.module" : "tab.usine");
  if (r.page === "plan") return r.tab ? tabTitle(r.tab) : goalTitle(r.goal ?? "objet");
  if (r.page === "recettes") return r.card ? t(r.card.kind === "objet" ? "route.itemCard" : "route.machineCard") : pageTitle("recettes");
  if (r.page === "donnees") return r.dataTab === "batiments" ? t("route.editor") : r.dataTab === "verifier" ? t("route.verify") : pageTitle("donnees");
  if (r.page === "usine" && r.usineTab === "recherche") return t("page.recherche");
  return pageTitle(r.page);
}

/**
 * Pile des vues visitées dans cet onglet. Nouvelle adresse : empilée ; retour à l'avant-dernière :
 * dépilée (c'était un retour) ; même adresse : rien.
 */
export function nextStack(stack: string[], hash: string, max = 50): string[] {
  if (stack.at(-1) === hash) return stack;
  if (stack.length >= 2 && stack.at(-2) === hash) return stack.slice(0, -1);
  return [...stack, hash].slice(-max);
}
