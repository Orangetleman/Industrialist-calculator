// Adresses du site (partie après « # ») : chaque vue a la sienne, pour que le bouton « Retour »
// (et celui du navigateur) ramène exactement à la vue précédente.
//   #objet                      page d'un objectif (onglet du résultat : le dernier utilisé)
//   #objet/schema/<étape>       onglet du résultat, avec un bloc du schéma sélectionné
//   #objet/pose/<étape>         plan de pose d'une étape
//   #donnees/batiments/<id>     éditeur de bâtiments, sur un bâtiment
// Fonctions pures, testées sans navigateur.

import type { Goal, ResultTab } from "./state.ts";

export type Page = "accueil" | "plan" | "usine" | "arbre" | "donnees";
export type DataTab = "verifier" | "batiments";
export type Route = { page: Page; goal?: Goal; tab?: ResultTab; step?: string; dataTab?: DataTab; machine?: string };

export const PAGES: Page[] = ["accueil", "plan", "usine", "arbre", "donnees"];
export const GOAL_ROUTE: Record<Goal, string> = { objet: "objet", énergie: "energie", recherche: "rp", argent: "argent" };
const ROUTE_GOAL: Record<string, Goal> = { objet: "objet", energie: "énergie", rp: "recherche", argent: "argent" };
export const GOAL_TITLE: Record<Goal, string> = { objet: "Produire un objet", énergie: "Produire de l'énergie", recherche: "Gagner des points de recherche", argent: "Gagner de l'argent" };
const TABS: ResultTab[] = ["liste", "schema", "pose", "details"];
const TAB_TITLE: Record<ResultTab, string> = { liste: "Liste de construction", schema: "Schéma", pose: "Plan de pose", details: "Détails" };
const PAGE_TITLE: Record<Page, string> = { accueil: "Accueil", plan: "Planifier", usine: "Mon usine", arbre: "Arbre de recherche", donnees: "Données" };

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
  const [head = "", a, b] = parts;
  const goal = ROUTE_GOAL[head];
  if (goal) {
    const r: Route = { page: "plan", goal };
    if (a && (TABS as string[]).includes(a)) {
      r.tab = a as ResultTab;
      if (b && (a === "schema" || a === "pose")) r.step = b;
    }
    return r;
  }
  if (head === "donnees") {
    const r: Route = { page: "donnees" };
    if (a === "verifier" || a === "batiments") r.dataTab = a;
    if (a === "batiments" && b) r.machine = b;
    return r;
  }
  return { page: (PAGES as string[]).includes(head) && head !== "plan" ? (head as Page) : "accueil" };
}

export function routeHash(r: Route): string {
  const parts: string[] = [];
  if (r.page === "plan") {
    parts.push(GOAL_ROUTE[r.goal ?? "objet"]);
    if (r.tab) {
      parts.push(r.tab);
      if (r.step && (r.tab === "schema" || r.tab === "pose")) parts.push(r.step);
    }
  } else if (r.page === "donnees") {
    parts.push("donnees");
    if (r.dataTab) {
      parts.push(r.dataTab);
      if (r.machine && r.dataTab === "batiments") parts.push(r.machine);
    }
  } else parts.push(r.page);
  return `#${parts.map(encodeURIComponent).join("/")}`;
}

/** Nom court d'une vue, pour le bouton « Retour » (« Revenir à : Schéma »). */
export function routeTitle(r: Route): string {
  if (r.page === "plan") return r.tab ? TAB_TITLE[r.tab] : GOAL_TITLE[r.goal ?? "objet"];
  if (r.page === "donnees") return r.dataTab === "batiments" ? "Éditeur de bâtiments" : r.dataTab === "verifier" ? "Valeurs à vérifier" : "Données";
  return PAGE_TITLE[r.page];
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
