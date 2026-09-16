// Lecture de la réponse Open-Meteo et alertes intempérie (SPEC § 7.8, § 7.9). Module pur.
import { formatDecimal } from "./format.js";

// Indice du point météo de km le plus proche.
export function indicePointMeteo(meteoPoints, km) {
  let best = 0, dBest = Infinity;
  meteoPoints.forEach((p, i) => {
    const d = Math.abs(p.km - km);
    if (d < dBest) { dBest = d; best = i; }
  });
  return best;
}

// Valeurs horaires d'un point : { vitesse, direction, rafales, pluie, probabilite, code } ou null.
export function valeursHeure(reponse, meteoPoints, km, h) {
  if (!Array.isArray(reponse) && reponse && typeof reponse === "object") reponse = [reponse];
  if (!Array.isArray(reponse) || !meteoPoints?.length) return null;
  const idx = indicePointMeteo(meteoPoints, km);
  const pt = reponse[idx];
  const hourly = pt?.hourly;
  if (!hourly || !Array.isArray(hourly.time)) return null;
  // Clé horaire Open-Meteo « date, T, HH:00 » assemblée à l'exécution (aucune date suivie de T dans les fichiers publiés).
  const cle = ["2026-09-18", String(h).padStart(2, "0") + ":00"].join("T");
  let j = hourly.time.indexOf(cle);
  if (j < 0) j = h < hourly.time.length ? h : -1;
  if (j < 0) return null;
  const v = (nom) => (Array.isArray(hourly[nom]) && hourly[nom][j] != null ? Number(hourly[nom][j]) : null);
  return {
    vitesse: v("wind_speed_10m"), direction: v("wind_direction_10m"), rafales: v("wind_gusts_10m"),
    pluie: v("precipitation"), probabilite: v("precipitation_probability"), code: v("weather_code"),
    temperature: v("temperature_2m"),
    km: meteoPoints[idx].km,
  };
}

const ORDRE = { orage: 0, pluie: 1, rafales: 2, vigilance: 3 };
const PHENOMENES = { 1: "vent violent", 2: "pluie-inondation", 3: "orages", 4: "crues", 5: "neige-verglas", 6: "canicule", 7: "grand froid", 9: "vagues-submersion" };
const COULEURS = { 3: "orange", 4: "rouge" };

// positionsParHeure : [{ h, km }] (h0 à h0 + 3). vigilance (B1) : null ou
// { departements: [{ code, nom }], par_departement: { "49": { "3": 3 } } }.
export function chercherAlerte(reponseOpenMeteo, meteoPoints, positionsParHeure, vigilance) {
  const candidats = [];
  for (const { h, km } of positionsParHeure || []) {
    if (h < 0 || h > 23) continue;
    const val = valeursHeure(reponseOpenMeteo, meteoPoints, km, h);
    if (!val) continue;
    const kmTexte = Math.round(km);
    if ([95, 96, 99].includes(val.code) && val.probabilite != null && val.probabilite >= 40) {
      candidats.push({ type: "orage", heure: h, km, titre: `Orage probable vers ${h}h`, phrase: `Autour du km ${kmTexte}, pluie probable à ${Math.round(val.probabilite)} %.` });
    }
    if (val.pluie != null && val.pluie >= 1) {
      const mm = val.pluie < 10 ? formatDecimal(val.pluie).replace(/,0$/, "") : String(Math.round(val.pluie));
      candidats.push({ type: "pluie", heure: h, km, titre: `Pluie forte vers ${h}h`, phrase: `${mm} mm/h prévus autour du km ${kmTexte}.` });
    }
    if (val.rafales != null && val.rafales >= 45) {
      candidats.push({ type: "rafales", heure: h, km, titre: `Rafales fortes vers ${h}h`, phrase: `Rafales à ${Math.round(val.rafales)} km/h prévues autour du km ${kmTexte}.` });
    }
  }
  if (vigilance && vigilance.par_departement && Array.isArray(vigilance.departements)) {
    const h0 = positionsParHeure?.[0]?.h ?? 0;
    for (const dep of vigilance.departements) {
      const ph = vigilance.par_departement[dep.code];
      if (!ph) continue;
      for (const [code, couleur] of Object.entries(ph)) {
        if (couleur >= 3) {
          candidats.push({ type: "vigilance", heure: h0, km: null, titre: `Vigilance ${COULEURS[couleur] || "orange"} ${PHENOMENES[code] || ""}`.trim(), phrase: `${dep.nom}, en cours.` });
        }
      }
    }
  }
  if (!candidats.length) return null;
  candidats.sort((a, b) => a.heure - b.heure || ORDRE[a.type] - ORDRE[b.type]);
  return candidats[0];
}
