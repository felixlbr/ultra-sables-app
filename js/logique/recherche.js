// Recherche dans le corridor (SPEC § 7.10). Module pur.
import { haversineM } from "./geo.js";
import { statut } from "./ouverture.js";

export const PORTEE_DEVANT_KM = 30;
export const RAYON_M = 3000;

// poi : tableau de Commerce (ou l'objet poi.json).
// → { lignes: [{ poi, sens, distKm, detourKm, arrivee, statut }], masques }
export function rechercher(poi, { km, lat, lon, m, types, vitesse }) {
  const liste = Array.isArray(poi) ? poi : poi?.poi || [];
  const v = vitesse || 28;
  const actifs = types == null ? null : new Set(types);
  const avecPosition = lat != null && lon != null && !Number.isNaN(lat) && !Number.isNaN(lon);
  const lignes = [];
  let masques = 0;
  for (const p of liste) {
    if (actifs && !actifs.has(p.type)) continue;
    let sens = null, distKm = null, detourKm = null, devantKm = null;
    const avant = p.km - km;
    if (avant > 0 && avant <= PORTEE_DEVANT_KM && p.ecart_m <= RAYON_M) {
      sens = "devant";
      devantKm = avant;
      distKm = avant + (p.ecart_m * 1.3) / 1000;
      detourKm = (2 * p.ecart_m * 1.3) / 1000;
    } else if (avecPosition) {
      const d = haversineM(lat, lon, p.lat, p.lon);
      if (d <= RAYON_M) {
        sens = "autour";
        distKm = (d * 1.3) / 1000;
        detourKm = null;
      }
    }
    if (!sens) continue;
    const arrivee = m + (distKm * 60) / v;
    const st = statut(p.horaires, arrivee);
    if (st.etat === "ferme") { masques++; continue; }
    lignes.push({ poi: p, sens, distKm, devantKm, detourKm, arrivee, statut: st });
  }
  lignes.sort((a, b) => a.distKm - b.distKm);
  return { lignes, masques };
}
