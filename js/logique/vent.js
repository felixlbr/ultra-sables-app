// Vent relatif au sens de marche (SPEC § 7.8). Module pur.

const SECTEURS = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"];

export function provenance(directionDeg) {
  const d = ((directionDeg % 360) + 360) % 360;
  return SECTEURS[Math.floor(((d + 22.5) % 360) / 45)];
}

// "du nord", "de l'est", "de l'ouest", "du sud-ouest"…
export function articleProvenance(p) {
  return /^[aeiou]/.test(p) ? "de l'" + p : "du " + p;
}

// → { mot, cote, rotation, provenance }. rotation null et cote null pour « Vent faible ».
export function ventRelatif(directionDeg, vitesseKmh, capDeg) {
  const prov = provenance(directionDeg);
  // Seuil sur la vitesse arrondie, comme l'affichage : jamais « Vent faible, 8 km/h ».
  if (Math.round(vitesseKmh) < 8) return { mot: "Vent faible", cote: null, rotation: null, provenance: prov, angle: null, categorie: categorieVent(directionDeg, capDeg) };
  const a = ((((directionDeg - capDeg + 540) % 360) + 360) % 360) - 180;
  const rotation = (((directionDeg + 180 - capDeg) % 360) + 360) % 360;
  let mot, cote = null;
  if (Math.abs(a) <= 45) mot = "De face";
  else if (Math.abs(a) > 135) mot = "De dos";
  else {
    mot = "De côté";
    cote = a > 0 ? "par la droite" : "par la gauche";
  }
  return { mot, cote, rotation, provenance: prov, angle: a, categorie: categorieVent(directionDeg, capDeg) };
}

// Abréviation de la provenance : N, NE, E, SE, S, SO, O, NO.
const COURTES = { nord: "N", "nord-est": "NE", est: "E", "sud-est": "SE", sud: "S", "sud-ouest": "SO", ouest: "O", "nord-ouest": "NO" };
export function provenanceCourte(p) {
  return COURTES[p] || p;
}

// Vent relatif en 5 catégories (demande de l'agent principal du 16/09, seuils ajustables par le designer).
// Angle = écart absolu entre la provenance du vent et le cap du tracé, dans [0, 180].
export const SEUILS_VENT_DEG = { face: 22.5, troisQuartsFace: 67.5, cote: 112.5, troisQuartsDos: 157.5 };
export const CATEGORIES_VENT = ["face", "trois-quarts face", "côté", "trois-quarts dos", "dos"];

export function angleVent(directionDeg, capDeg) {
  const a = ((((directionDeg - capDeg + 540) % 360) + 360) % 360) - 180;
  return Math.abs(a);
}

// → "face" | "trois-quarts face" | "côté" | "trois-quarts dos" | "dos" (bornes hautes incluses).
export function categorieVent(directionDeg, capDeg, seuils = SEUILS_VENT_DEG) {
  const x = angleVent(directionDeg, capDeg);
  if (x <= seuils.face) return "face";
  if (x <= seuils.troisQuartsFace) return "trois-quarts face";
  if (x <= seuils.cote) return "côté";
  if (x <= seuils.troisQuartsDos) return "trois-quarts dos";
  return "dos";
}

// Libellé affiché de la catégorie (DESIGN § 9.10) : « Face », « Trois-quarts face », « Côté », « Trois-quarts dos », « Dos ».
export function libelleCategorieVent(categorie) {
  return categorie ? categorie.charAt(0).toUpperCase() + categorie.slice(1) : "";
}
