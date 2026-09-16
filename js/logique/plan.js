// Plan horaire, écart et états des pauses (SPEC § 7.3, § 7.4, § 7.5). Module pur.
import { hhmmVersMinutes } from "./temps.js";

export function creerPlan(course, pauses) {
  const liste = (Array.isArray(pauses) ? pauses : pauses?.pauses || [])
    .map((p) => ({ n: p.n, km: p.km }))
    .sort((a, b) => a.km - b.km);
  const D = hhmmVersMinutes(course?.depart_heure ?? "04:00");
  return {
    D: Number.isNaN(D) ? 240 : D,
    v: course?.vitesse_kmh ?? 28,
    p: course?.pause_min ?? 20,
    L: course?.km_total,
    k: liste.map((x) => x.km),
    n: liste.map((x) => x.n),
  };
}

// T_plan(k) = D + k × 60 / v + p × n(k), n(k) = nombre de pauses avec ki < k.
export function heurePlan(plan, km) {
  let n = 0;
  for (const ki of plan.k) if (ki < km) n++;
  return plan.D + (km * 60) / plan.v + plan.p * n;
}

// Ta(i), i de 1 à 5 (rang dans l'ordre des km).
export function arriveePause(plan, i) {
  const ki = plan.k[i - 1];
  return plan.D + (ki * 60) / plan.v + plan.p * (i - 1);
}

export function departPause(plan, i) {
  return arriveePause(plan, i) + plan.p;
}

// K_plan(m).
export function kmPlan(plan, m) {
  if (m <= plan.D) return 0;
  let kmDebut = 0, tDebut = plan.D;
  for (let i = 1; i <= plan.k.length; i++) {
    const Ta = arriveePause(plan, i);
    if (m < Ta) return kmDebut + ((m - tDebut) * plan.v) / 60;
    if (m <= Ta + plan.p) return plan.k[i - 1];
    kmDebut = plan.k[i - 1];
    tDebut = Ta + plan.p;
  }
  const km = kmDebut + ((m - tDebut) * plan.v) / 60;
  return Math.min(km, plan.L);
}

// Écart en minutes. enPause = { n, premiereVue } | null. km null → null (mode plan).
export function calculerEcart(plan, { km, m, enPause }) {
  if (m < plan.D) return 0;
  if (enPause) {
    const i = rangPause(plan, enPause.n);
    const F = enPause.premiereVue ?? m;
    return Math.max(F - arriveePause(plan, i), m - departPause(plan, i));
  }
  if (km == null || Number.isNaN(km)) return null;
  return m - heurePlan(plan, km);
}

// Rang (1..5) d'une pause d'après son numéro n.
export function rangPause(plan, n) {
  const i = plan.n.indexOf(n);
  return i >= 0 ? i + 1 : n;
}

function distancePour(distConseilleM, n, i) {
  if (distConseilleM == null) return null;
  if (typeof distConseilleM === "number") return distConseilleM;
  if (typeof distConseilleM === "function") return distConseilleM(n);
  if (Array.isArray(distConseilleM)) return distConseilleM[i] ?? null;
  return distConseilleM[n] ?? distConseilleM[String(n)] ?? null;
}

// États : passée si km > ki + 0,5 ; en cours si ki − 0,3 ≤ km ≤ ki + 0,5 et distance au conseillé ≤ 300 m ; à venir sinon.
export function etatPauses(plan, { km, m, distConseilleM }) {
  return plan.k.map((ki, idx) => {
    const n = plan.n[idx];
    let etat = "a-venir";
    if (km > ki + 0.5) etat = "passee";
    else if (km >= ki - 0.3) {
      const d = distancePour(distConseilleM, n, idx);
      if (d != null && d <= 300) etat = "en-cours";
    }
    return { n, etat };
  });
}
