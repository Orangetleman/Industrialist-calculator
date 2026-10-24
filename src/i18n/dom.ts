// Textes fixes de la page (index.html), traduits sur place (S30) :
//   data-i18n="clé"             le texte de l'élément (il ne doit pas contenir d'autres éléments)
//   data-i18n-html="clé"        son contenu, balises comprises (clés en « .html » du catalogue)
//   data-i18n-attr="title=clé;aria-label=clé;placeholder=clé"   des attributs
// Le français écrit dans index.html reste ce qu'affiche la page avant le script.

import { t, type Key } from "./i18n.ts";

export function applyStatic(root: ParentNode): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n]")) el.textContent = t(el.dataset.i18n as Key);
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-html]")) el.innerHTML = t(el.dataset.i18nHtml as Key);
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-attr]")) {
    for (const pair of el.dataset.i18nAttr!.split(";")) {
      const [attr, key] = pair.split("=").map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key as Key));
    }
  }
}
