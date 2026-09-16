// Statut d'ouverture à l'arrivée (SPEC § 7.11). Module pur.
import { hhmmVersMinutes } from "./temps.js";

export const MARGE_TENDUE_MIN = 15;

export function statut(horaires, A) {
  if (horaires == null) return { etat: "sans-horaires", fermeture: null, ouverture: null };
  if (horaires.vendredi == null) return { etat: "inconnu", fermeture: null, ouverture: null };
  const creneaux = horaires.vendredi
    .map((c) => [hhmmVersMinutes(c[0]), hhmmVersMinutes(c[1])])
    .filter(([o, f]) => !Number.isNaN(o) && !Number.isNaN(f));
  for (const [o, f] of creneaux) {
    if (o <= A && A < f) {
      if (f - A < MARGE_TENDUE_MIN) return { etat: "tendu", fermeture: f, ouverture: null };
      return { etat: "ouvert", fermeture: horaires.h24 ? null : f, ouverture: null };
    }
  }
  let ouverture = null;
  for (const [o] of creneaux) if (o > A && (ouverture === null || o < ouverture)) ouverture = o;
  return { etat: "ferme", fermeture: null, ouverture };
}
