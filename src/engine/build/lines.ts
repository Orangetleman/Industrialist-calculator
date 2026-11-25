// Lignes de tuyaux d'une ressource dont le débit dépasse un seul tuyau : chaque sortie (une machine productrice) a son
// tuyau, qui sert un nombre entier de machines ; ce qui reste passe au tuyau suivant. Pur, sans DOM.
//   - avec Overflow Gate : la ligne est servie d'abord, seul le surplus passe au tuyau suivant ;
//   - sans : un embranchement partage à parts égales (BAS-05), donc la branche servie d'abord demande au plus la moitié ;
//     elle se remplit et le reste passe (supposé partout : une branche pleine renvoie son flux à l'autre).
// `simulate` vérifie un résultat pas à pas, avec ce partage.

/** Un module client : `n` machines qui demandent `p` par seconde chacune. */
export type Client = { key: string; n: number; p: number };
/** Une ligne : le tuyau d'une sortie, les machines qu'il sert (aucune : tout passe au suivant). */
/** `source` -1 : la ligne ne reçoit que le surplus de la précédente. */
export type Line = { source: number; client: string | null; machines: number; demand: number };
/** Des lignes reliées l'une à la suivante (surplus) ; la dernière prend tout. */
export type Chain = Line[];
export type LinesPlan = { chains: Chain[]; sources: number; /** Machines productrices à ajouter au plan. */ extra: number; gates: number; splits: number };

const EPS = 1e-6;

/** Avec Overflow Gate : `sources` sorties de `s` par seconde, tuyau limité à `cap`. null : une machine dépasse le tuyau. */
export function linesWithGate(clients: Client[], sources: number, s: number, cap: number): LinesPlan | null {
  if (s > cap + EPS || clients.some((c) => c.p > cap + EPS)) return null;
  const left = clients.map((c) => ({ ...c }));
  const chains: Chain[] = [];
  let chain: Chain = [];
  let carry = 0;
  let used = 0;
  const close = () => {
    if (chain.length) chains.push(chain);
    chain = [];
    carry = 0;
  };
  while (left.some((c) => c.n > 0)) {
    const c = left.find((q) => q.n > 0)!;
    // Le surplus suffit à une machine de plus (client suivant) : une ligne sans nouvelle sortie.
    const alone = carry >= c.p - EPS;
    const inc = carry + (alone ? 0 : s);
    if (inc > cap + EPS) return null;
    const m = Math.min(c.n, Math.floor(inc / c.p + EPS));
    chain.push({ source: alone ? -1 : used++, client: m ? c.key : null, machines: m, demand: m * c.p });
    c.n -= m;
    carry = inc - m * c.p;
    if (carry < EPS || !left.some((q) => q.n > 0)) close();
    else if (c.n === 0) {
      // Fin d'un client : le surplus n'est gardé que s'il manque des sorties.
      const need = left.reduce((t, q) => t + q.n * q.p, 0);
      if (need <= (sources - used) * s + EPS && fits(left, sources - used, s, cap)) close();
    }
  }
  close();
  return count(chains, used, sources, true);
}

/** Les clients restants tiennent-ils dans `k` sorties sans report ? */
function fits(left: Client[], k: number, s: number, cap: number): boolean {
  const r = linesWithGate(left.filter((c) => c.n > 0).map((c) => ({ ...c })), k, s, cap);
  return !!r && r.sources <= k;
}

/** Sans Overflow Gate : groupes d'une ou deux sorties ; une sortie de plus quand rien ne tient. */
export function linesWithoutGate(clients: Client[], sources: number, s: number, cap: number): LinesPlan | null {
  if (clients.some((c) => c.p > Math.min(s, cap) + EPS)) return null;
  const chains: Chain[] = [];
  let used = 0;
  for (const c of clients) {
    // Une sortie seule, ou deux : la petite branche demande au plus la moitié de sa sortie.
    const one = Math.floor(Math.min(s, cap) / c.p + EPS);
    const m1 = Math.floor(s / 2 / c.p + EPS);
    const m2 = Math.floor(Math.min(cap, 2 * s - m1 * c.p) / c.p + EPS);
    const two = m1 && m1 + m2 > 2 * one ? m1 + m2 : 0;
    // Le moins de sorties : a groupes d'une, b groupes de deux.
    let best: { a: number; b: number } | null = null;
    for (let b = 0; b * 2 <= 2 * Math.ceil(c.n / Math.max(1, one)); b++) {
      if (b && !two) break;
      const a = Math.ceil(Math.max(0, c.n - b * two) / one);
      if (!best || a + 2 * b < best.a + 2 * best.b) best = { a, b };
    }
    let n = c.n;
    const line = (m: number): Line => ({ source: used++, client: c.key, machines: m, demand: m * c.p });
    for (let i = 0; i < best!.b; i++) {
      const k = Math.min(n, two);
      const small = Math.min(m1, k - 1);
      if (small < 1) {
        chains.push([line(k)]);
        n -= k;
        continue;
      }
      chains.push([line(small), line(k - small)]);
      n -= k;
    }
    while (n > 0) {
      const k = Math.min(n, one);
      chains.push([line(k)]);
      n -= k;
    }
  }
  return count(chains, used, sources, false);
}

/** Le choix : sans pont ni pièce de plus si les sorties suffisent ; sinon l'Overflow Gate ; sinon des machines de plus. */
export function planLines(clients: Client[], sources: number, s: number, cap: number, gate: boolean): (LinesPlan & { gate: boolean }) | null {
  const plain = linesWithoutGate(clients, sources, s, cap);
  if (plain && (!gate || !plain.extra)) return { ...plain, gate: false };
  const g = gate ? linesWithGate(clients, sources, s, cap) : null;
  if (g && (!plain || g.extra < plain.extra)) return { ...g, gate: true };
  return plain ? { ...plain, gate: false } : null;
}

function count(chains: Chain[], used: number, sources: number, gate: boolean): LinesPlan {
  const links = chains.reduce((t, c) => t + c.length - 1, 0);
  return { chains, sources: used, extra: Math.max(0, used - sources), gates: gate ? links : 0, splits: gate ? 0 : links };
}

/** Débit servi à chaque ligne (chaîne par chaîne), simulé pas à pas : partage et fusion à parts égales, tampons finis. */
export function simulate(chains: Chain[], s: number, cap: number, gate: boolean, seconds = 600): number[][] {
  const dt = 0.05;
  return chains.map((ch) => {
    const N = ch.length;
    const pipe = new Array<number>(N).fill(0); // contenu du tuyau de chaque ligne
    const tap = new Array<number>(N).fill(0); // contenu du tronçon qui va aux machines
    const bridge = new Array<number>(N).fill(0); // contenu du pont vers la ligne suivante
    const K = cap; // une seconde de tuyau plein
    const got = new Array<number>(N).fill(0);
    const steps = Math.round(seconds / dt);
    for (let t = 0; t < steps; t++) {
      for (let i = 0; i < N; i++) {
        // Machines, puis embranchement, puis fusion : la place libérée remonte.
        const eat = Math.min(tap[i]!, ch[i]!.demand * dt);
        tap[i]! -= eat;
        if (t > steps / 2) got[i]! += eat;
      }
      for (let i = N - 1; i >= 0; i--) {
        const go = Math.min(pipe[i]!, cap * dt);
        const roomTap = ch[i]!.machines ? K - tap[i]! : 0;
        const roomBr = i < N - 1 ? K - bridge[i]! : 0;
        let a: number;
        let b: number;
        if (gate) {
          a = Math.min(go, roomTap);
          b = Math.min(go - a, roomBr);
        } else {
          a = Math.min(go / 2, roomTap);
          b = Math.min(go - a, roomBr);
          a = Math.min(go - b, roomTap);
          if (b > go / 2 && roomTap > a) b = Math.max(go / 2, b);
        }
        pipe[i]! -= a + b;
        tap[i]! += a;
        bridge[i]! += b;
        // Fusion : la sortie et le pont d'avant se partagent la place à parts égales.
        const room = Math.max(0, Math.min(K - pipe[i]!, cap * dt));
        const fromS = ch[i]!.source < 0 ? 0 : s * dt;
        const fromB = i ? Math.min(bridge[i - 1]!, cap * dt) : 0;
        let x = Math.min(fromS, room / 2);
        const y = Math.min(fromB, room - x);
        x = Math.min(fromS, room - y);
        pipe[i]! += x + y;
        if (i) bridge[i - 1]! -= y;
      }
    }
    return got.map((g) => g / (seconds / 2));
  });
}

/** Chaque ligne reçoit-elle tout ce qu'elle demande ? (à 1 % près) */
export const served = (chains: Chain[], s: number, cap: number, gate: boolean): boolean => simulate(chains, s, cap, gate).every((c, i) => c.every((v, j) => v >= chains[i]![j]!.demand * 0.99));
