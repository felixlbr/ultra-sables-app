// Écriture de GPX 1.1 compatibles Garmin (SPEC § 3.7, § 7.13). Module pur.
import { pointAuKm } from "./geo.js";

function echapper(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// points : [[lat, lon, ele?]] → texte GPX.
export function serialiserGpx(nom, points) {
  const lignes = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Ultra Sables" xmlns="http://www.topografix.com/GPX/1/1">',
    ` <metadata><name>${echapper(nom)}</name></metadata>`,
    ` <trk><name>${echapper(nom)}</name><trkseg>`,
  ];
  for (const p of points) {
    const ele = p[2] == null || Number.isNaN(Number(p[2])) ? "" : `<ele>${Math.round(Number(p[2]))}</ele>`;
    lignes.push(`  <trkpt lat="${Number(p[0]).toFixed(5)}" lon="${Number(p[1]).toFixed(5)}">${ele}</trkpt>`);
  }
  lignes.push(" </trkseg></trk>", "</gpx>", "");
  return lignes.join("\n");
}

// Nom court (≤ 15 caractères) lisible sur un compteur.
export function nomGpxGare(gare) {
  const nom = String(gare?.nom || "Gare");
  const candidats = ["Gare " + nom, nom, nom.replace(/^(La|Le|Les|L')\s*/i, "")];
  for (const c of candidats) if (c.length <= 15) return c;
  return nom.slice(0, 15);
}

export function nomFichierGare(gare) {
  const base = String(gare?.id || gare?.nom || "gare")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `gare-${base}.gpx`;
}

// Points (§ 7.13 hors ligne) : point courant, tracé jusqu'à l'embranchement, puis la bretelle sans son premier point.
export function pointsVersGare(tracePoints, gare, km) {
  const kE = gare.km_embranchement;
  const depart = pointAuKm(tracePoints, km);
  const out = [[depart.lat, depart.lon, depart.ele]];
  const entre = tracePoints.filter((p) => (kE >= km ? p[2] > km && p[2] < kE : p[2] < km && p[2] > kE));
  if (kE < km) entre.reverse();
  for (const p of entre) out.push([p[0], p[1], p[3]]);
  const emb = pointAuKm(tracePoints, kE);
  out.push([emb.lat, emb.lon, emb.ele]);
  for (const b of (gare.bretelle || []).slice(1)) out.push([b[0], b[1], b[2]]);
  return out;
}

export function gpxVersGare(tracePoints, gare, km) {
  return serialiserGpx(nomGpxGare(gare), pointsVersGare(tracePoints, gare, km));
}

// Réécrit une réponse GPX BRouter au format § 3.7 ; null si moins de 2 points.
export function reecrireGpx(texte, nom) {
  const pts = [];
  const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>|<trkpt\b([^>]*)\/>/g;
  let x;
  while ((x = re.exec(String(texte)))) {
    const attrs = x[1] ?? x[3] ?? "";
    const lat = /lat="([-\d.]+)"/.exec(attrs), lon = /lon="([-\d.]+)"/.exec(attrs);
    if (!lat || !lon) continue;
    const ele = x[2] ? /<ele>([-\d.]+)<\/ele>/.exec(x[2]) : null;
    pts.push([Number(lat[1]), Number(lon[1]), ele ? Number(ele[1]) : null]);
  }
  if (pts.length < 2) return null;
  return serialiserGpx(nom, pts);
}
