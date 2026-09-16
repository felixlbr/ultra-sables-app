// Formats d'affichage (DESIGN § 6). Espace insécable U+00A0 entre nombre et unité (DESIGN § 3.3).
// Module pur.

export const NBSP = " ";
export const MOINS = "−";

function virgule(x, dec) {
  let s = x.toFixed(dec);
  if (/^-0(\.0+)?$/.test(s)) s = s.slice(1);
  return s.replace(".", ",").replace("-", MOINS);
}

// 131.44 → "131,4"
export function formatKm(km) {
  return virgule(km, 1);
}

// Entier arrondi, avec signe moins U+2212.
export function formatEntier(x) {
  return virgule(Math.round(x), 0);
}

// Écart en minutes → { valeur, unite, legende }.
export function formatEcart(e) {
  if (e == null || Number.isNaN(e)) return { valeur: "?", unite: "", legende: "écart inconnu" };
  if (Math.abs(e) < 3) return { valeur: "0", unite: "min", legende: "à l'heure" };
  const r = Math.round(e);
  if (e > 0) return { valeur: "+" + r, unite: "min", legende: "de retard" };
  return { valeur: MOINS + Math.abs(r), unite: "min", legende: "d'avance" };
}

// Nombre de km : une décimale sous 100, entier au-delà.
export function formatNombreKm(km) {
  const v = Math.max(0, km);
  return v < 99.95 ? virgule(v, 1) : String(Math.round(v));
}

// 12.63 → "12,6 km" ; 144.2 → "144 km" ; 0.16 → "150 m" (arrondi à 50 m sous 1 km).
export function formatDistance(km) {
  const v = Math.max(0, km);
  if (v < 1) {
    const m = Math.round((v * 1000) / 50) * 50;
    if (m < 1000) return m + NBSP + "m";
    return "1,0" + NBSP + "km";
  }
  return formatNombreKm(v) + NBSP + "km";
}

// Une décimale avec virgule (détours, pluie).
export function formatDecimal(x) {
  return virgule(x, 1);
}

// Libellés de type (SPEC § 7.10.8).
const LIBELLES = {
  bakery: "Boulangerie", pastry: "Boulangerie",
  supermarket: "Supermarché", convenience: "Supérette", general: "Supérette",
  drinking_water: "Point d'eau", water_point: "Point d'eau", fontaine: "Fontaine", water_tap: "Robinet",
  "robinet-cimetiere": "Robinet de cimetière", cimetiere: "Cimetière, robinet non vérifié",
  fuel: "Station-service",
};
const PAR_TYPE = { boulangerie: "Boulangerie", supermarche: "Supermarché", eau: "Point d'eau", station: "Station-service" };

export function libelleType(c) {
  return LIBELLES[c?.sous_type] || PAR_TYPE[c?.type] || "Commerce";
}

export function nomCommerce(c) {
  return c?.nom && String(c.nom).trim() ? c.nom : libelleType(c);
}

// Créneaux [["06:30","13:00"],…] → "6h30–13h00 et 15h00–19h30".
export function formatCreneau(c) {
  return heureTexte(c[0]) + "–" + heureTexte(c[1]);
}
export function heureTexte(hhmm) {
  const x = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  if (!x) return String(hhmm);
  return Number(x[1]) + "h" + x[2];
}
export function formatCreneaux(creneaux) {
  return creneaux.map(formatCreneau).join(" et ");
}

// Écart en phrase (DESIGN § 9.6, toutes les vues) : e arrondi à la minute, positif = retard.
// |e| ≤ 2 → « à l'heure » ; 3 à 59 → « 24 min de retard » / « 8 min d'avance » (jamais de signe) ;
// ≥ 60 → « 1h05 de retard » / « 1h05 d'avance ». lecture = texte complet pour aria-label (« 24 minutes de retard »).
// formatEcart (SPEC § 11.1) reste inchangé.
export const SEUIL_A_L_HEURE_MIN = 2;
export function formatEcartPhrase(e) {
  if (e == null || Number.isNaN(e)) return { texte: "écart inconnu", lecture: "écart inconnu", minutes: null, sens: "inconnu" };
  const r = Math.round(e);
  if (Math.abs(r) <= SEUIL_A_L_HEURE_MIN) return { texte: "à l'heure", lecture: "à l'heure", minutes: 0, sens: "a-l-heure" };
  const m = Math.abs(r);
  const suffixe = r > 0 ? "de retard" : "d'avance";
  let texte, lecture;
  if (m < 60) {
    texte = `${m}${NBSP}min ${suffixe}`;
    lecture = `${m} minute${m > 1 ? "s" : ""} ${suffixe}`;
  } else {
    const h = Math.floor(m / 60), mn = m % 60;
    texte = `${h}h${String(mn).padStart(2, "0")} ${suffixe}`;
    lecture = `${h} heure${h > 1 ? "s" : ""}${mn ? ` ${mn} minute${mn > 1 ? "s" : ""}` : ""} ${suffixe}`;
  }
  return { texte, lecture, minutes: m, sens: r > 0 ? "retard" : "avance" };
}
