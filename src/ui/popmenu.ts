// Menu déroulant maison (B3, repris par l'éditeur de bâtiments en S52) : une liste flottante qui survole la page
// sous (ou au-dessus de) son bouton, jamais insérée dans la page ; fermée au clic ailleurs ou par Échap.
// Les options sont des boutons `[data-opt]` ; flèches haut et bas pour passer de l'une à l'autre.

let pop: HTMLElement | null = null, popAnchor: HTMLElement | null = null;

export const popEl = () => pop;
export const popAnchorEl = () => popAnchor;

export function closePop(): void {
  pop?.remove();
  popAnchor?.setAttribute("aria-expanded", "false");
  pop = popAnchor = null;
}

export function openPopMenu(host: HTMLElement, anchorEl: HTMLElement, html: string, onPick: (el: HTMLElement) => void, cls = "pop-menu"): void {
  closePop();
  const el = document.createElement("div");
  el.className = cls;
  el.setAttribute("role", "listbox");
  el.innerHTML = html;
  host.append(el);
  const r = anchorEl.getBoundingClientRect(), below = innerHeight - r.bottom - 8, above = r.top - 8, up = el.offsetHeight > below && above > below;
  el.style.minWidth = `${Math.min(r.width, innerWidth - 16)}px`;
  el.style.maxHeight = `${Math.max(120, up ? above : below)}px`;
  el.style.left = `${Math.max(8, Math.min(r.left, innerWidth - el.offsetWidth - 8))}px`;
  el.style.top = up ? `${Math.max(8, r.top - Math.min(el.offsetHeight, above) - 4)}px` : `${r.bottom + 4}px`;
  pop = el;
  popAnchor = anchorEl;
  anchorEl.setAttribute("aria-expanded", "true");
  el.addEventListener("click", (e) => { const o = (e.target as HTMLElement).closest<HTMLElement>("[data-opt]"); if (o) { const keep = o; closePop(); onPick(keep); } });
  el.addEventListener("keydown", (e) => {
    const opts = [...el.querySelectorAll<HTMLElement>("[data-opt]")], i = opts.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); opts[(i + (e.key === "ArrowDown" ? 1 : opts.length - 1)) % opts.length]?.focus(); }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); const a = popAnchor; closePop(); a?.focus(); }
  });
  (el.querySelector<HTMLElement>("[aria-selected=true]") ?? el.querySelector<HTMLElement>("[data-opt]"))?.focus();
}

if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", (e) => { if (pop && !pop.contains(e.target as Node) && !popAnchor?.contains(e.target as Node)) closePop(); }, true);
}
