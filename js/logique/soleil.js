// Lever et coucher du soleil (SPEC § 7.7), soleil à −0,833°.
// Formules du « NOAA Solar Calculator » (NOAA Global Monitoring Laboratory, d'après Jean Meeus,
// « Astronomical Algorithms » ; domaine public), dans l'esprit de SunCalc (Vladimir Agafonkin, BSD-2-Clause).
// Le port direct de SunCalc donnait un passage au méridien décalé d'environ 1,5 min (constante J0) :
// la version NOAA tient les ±2 min demandés. Module pur.
import { decalageParisMin } from "./temps.js";

const rad = Math.PI / 180;
const deg = 180 / Math.PI;

function soleilAuJourJulien(jd) {
  const T = (jd - 2451545) / 36525;
  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T)
    + Math.sin(3 * M * rad) * 0.000289;
  const vraieLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = vraieLong - 0.00569 - 0.00478 * Math.sin(omega * rad);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * rad);
  const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad));
  const y = Math.tan((eps / 2) * rad) ** 2;
  const eqTemps = 4 * deg * (
    y * Math.sin(2 * L0 * rad)
    - 2 * e * Math.sin(M * rad)
    + 4 * e * y * Math.sin(M * rad) * Math.cos(2 * L0 * rad)
    - 0.5 * y * y * Math.sin(4 * L0 * rad)
    - 1.25 * e * e * Math.sin(2 * M * rad)
  );
  return { decl, eqTemps };
}

// → minutes UTC depuis minuit UTC de la date, pour le lever (signe −1) ou le coucher (+1).
function evenement(lat, lon, jdMinuit, signe) {
  let t = 720 - 4 * lon; // première estimation : midi solaire moyen
  for (let i = 0; i < 3; i++) {
    const { decl, eqTemps } = soleilAuJourJulien(jdMinuit + t / 1440);
    const cosH = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
    const H = Math.acos(Math.max(-1, Math.min(1, cosH))) * deg;
    t = 720 - 4 * (lon + signe * H) - eqTemps;
  }
  return t;
}

// → { lever, coucher } en minutes depuis minuit (heure de Paris) de dateISO.
export function leverCoucher(lat, lon, dateISO) {
  const [y, mo, d] = dateISO.split("-").map(Number);
  const jdMinuit = Date.UTC(y, mo - 1, d) / 86400000 + 2440587.5;
  const decal = decalageParisMin(dateISO);
  return {
    lever: evenement(lat, lon, jdMinuit, 1) + decal,
    coucher: evenement(lat, lon, jdMinuit, -1) + decal,
  };
}

export function theme(minutesDuJour, lever, coucher) {
  return minutesDuJour >= lever && minutesDuJour < coucher ? "jour" : "nuit";
}
