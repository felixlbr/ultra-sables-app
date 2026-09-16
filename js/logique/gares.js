// Gares de secours et trains (SPEC § 7.12). Module pur.
import { hhmmVersMinutes } from "./temps.js";

function listeGares(gares) {
  return Array.isArray(gares) ? gares : gares?.gares || [];
}

export function distanceGare(gare, km, horsTraceKm) {
  const distanceKm = Math.abs(gare.km_embranchement - km) + gare.detour_km + (horsTraceKm || 0);
  const sens = gare.km_embranchement >= km ? "devant" : "derriere";
  return { gare, distanceKm, sens, surTraceKm: Math.abs(gare.km_embranchement - km) };
}

// → { gare, distanceKm, sens } (sens : "devant" | "derriere").
export function garePlusProche(gares, km, horsTraceKm) {
  let best = null;
  for (const g of listeGares(gares)) {
    const d = distanceGare(g, km, horsTraceKm);
    if (!best || d.distanceKm < best.distanceKm) best = d;
  }
  return best;
}

// Trajets avec dep ≥ arrivée + marge ; les n premiers. dernier = dernier trajet de la journée (ou null).
export function prochainsTrains(gare, arriveeMin, margeMin, n) {
  const trajets = (gare?.trajets || []).slice().sort((a, b) => hhmmVersMinutes(a.dep) - hhmmVersMinutes(b.dep));
  const seuil = arriveeMin + (margeMin ?? 15);
  const trains = trajets.filter((t) => hhmmVersMinutes(t.dep) >= seuil).slice(0, n ?? 3);
  return {
    trains,
    dernier: trajets.length ? trajets[trajets.length - 1] : null,
    premierDemain: gare?.premier_demain || null,
  };
}

// Un trajet demande-t-il une réservation vélo ? (champ absent = false, anciennes données)
export function reservationVelo(trajet) {
  if (!trajet) return false;
  if (trajet.reservation_velo === true) return true;
  return (trajet.etapes || []).some((e) => e.reservation_velo === true);
}

// Modes non TER d'un trajet, abrégés pour l'affichage : ["TGV"], ["Intercités"]…
export function modesSpeciaux(trajet) {
  const noms = { "TGV INOUI": "TGV", INTERCITES: "Intercités" };
  const vus = [];
  for (const e of trajet?.etapes || []) {
    if (!e.mode || e.mode === "TER") continue;
    const n = noms[e.mode] || e.mode;
    if (!vus.includes(n)) vus.push(n);
  }
  return vus;
}

// Meilleure gare « arrivée plus tôt aux Sables » (fonction pure).
// Entrées : gares (tableau ou gares.json), { km, m, vitesse, margeMin, horsTraceKm, gainMin = 15 }
//   m = minutes course à partir desquelles on roule vers la gare (maintenant, ou 4h00 avant le départ).
// Pour chaque gare : arrivée à la gare Ag = m + distance × 60 / vitesse ; premier trajet avec dep ≥ Ag + marge ;
// arrivée aux Sables = arr de ce trajet (trajets TER et à réservation vélo confondus).
// Sortie : null, ou { gare, distanceKm, sens, arriveeGare, trajet, arriveeSables, arriveeProche, gainMin }
//   pour une autre gare que la plus proche qui arrive aux Sables au moins gainMin plus tôt
//   (ou n'importe quelle gare avec un train si la plus proche n'en a plus : arriveeProche et gainMin null).
//   Si plusieurs conviennent : la plus tôt aux Sables, puis la plus proche.
export function alternativePlusTot(gares, { km, m, vitesse = 28, margeMin = 15, horsTraceKm = 0, gainMin = 15 }) {
  const liste = listeGares(gares);
  const proche = garePlusProche(liste, km, horsTraceKm);
  if (!proche) return null;
  const evaluer = (g) => {
    const d = distanceGare(g, km, horsTraceKm);
    const arriveeGare = m + (d.distanceKm * 60) / vitesse;
    const trajet = prochainsTrains(g, arriveeGare, margeMin, 1).trains[0] || null;
    return { ...d, arriveeGare, trajet, arriveeSables: trajet ? hhmmVersMinutes(trajet.arr) : null };
  };
  const refProche = evaluer(proche.gare);
  let meilleure = null;
  for (const g of liste) {
    if (g === proche.gare) continue;
    const x = evaluer(g);
    if (x.arriveeSables == null) continue;
    if (refProche.arriveeSables != null && x.arriveeSables > refProche.arriveeSables - gainMin) continue;
    if (!meilleure || x.arriveeSables < meilleure.arriveeSables || (x.arriveeSables === meilleure.arriveeSables && x.distanceKm < meilleure.distanceKm)) meilleure = x;
  }
  if (!meilleure) return null;
  return {
    ...meilleure,
    arriveeProche: refProche.arriveeSables,
    gainMin: refProche.arriveeSables == null ? null : refProche.arriveeSables - meilleure.arriveeSables,
  };
}
