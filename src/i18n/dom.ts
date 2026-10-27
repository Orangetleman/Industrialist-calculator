// Textes fixes de la page (index.html), traduits sur place (S30) :
//   data-i18n="clé"             le texte de l'élément (il ne doit pas contenir d'autres éléments)
//   data-i18n-html="clé"        son contenu, balises comprises (clés en « .html » du catalogue)
//   data-i18n-attr="title=clé;aria-label=clé;placeholder=clé"   des attributs
//   data-ic="nom"               une icône devant le contenu (S41), remise après chaque traduction
// Le français écrit dans index.html reste ce qu'affiche la page avant le script.

import { t, type Key } from "./i18n.ts";
import { icon, isIcon, noIcons, withIcons } from "../ui/icons.ts";

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function applyStatic(root: ParentNode): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const s = t(el.dataset.i18n as Key);
    if (s.includes("{i:")) el.innerHTML = withIcons(esc(s));
    else el.textContent = s;
  }
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-html]")) el.innerHTML = withIcons(t(el.dataset.i18nHtml as Key));
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-attr]")) {
    for (const pair of el.dataset.i18nAttr!.split(";")) {
      const [attr, key] = pair.split("=").map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, noIcons(t(key as Key)));
    }
  }
  for (const el of root.querySelectorAll<HTMLElement>("[data-ic]")) {
    const n = el.dataset.ic!;
    if (!isIcon(n)) continue;
    const old = el.firstChild;
    if (old instanceof Element && old.matches("svg.ic")) {
      const after = old.nextSibling;
      if (after?.nodeType === Node.TEXT_NODE) after.textContent = after.textContent!.replace(/^ /, "");
      old.remove();
    }
    el.insertAdjacentHTML("afterbegin", icon(n) + (el.textContent?.trim() ? " " : ""));
  }
}
