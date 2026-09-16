// Réseau (SPEC § 4.5) : toutes les requêtes externes passent par fetchDelai.
// En simulation « sim_reseau=hors », toute requête externe échoue immédiatement.

export const DELAIS = { meteo: 10000, brouter: 20000, vigilance: 8000, overpass: 25000 };

export function creerReseau(sim) {
  async function fetchDelai(url, ms) {
    if (sim && sim.reseau === "hors") throw new Error("hors ligne (simulation)");
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const minuteur = setTimeout(() => ctrl && ctrl.abort(), ms);
    try {
      const rep = await fetch(url, { signal: ctrl ? ctrl.signal : undefined, cache: "no-store", credentials: "omit" });
      if (!rep.ok) throw new Error("HTTP " + rep.status);
      return rep;
    } finally {
      clearTimeout(minuteur);
    }
  }

  function urlMeteo(course) {
    const pts = course.meteo_points || [];
    const lat = pts.map((p) => p.lat).join(",");
    const lon = pts.map((p) => p.lon).join(",");
    return "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon
      + "&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,precipitation_probability,weather_code"
      + "&wind_speed_unit=kmh&timezone=Europe%2FParis&start_date=2026-09-18&end_date=2026-09-18";
  }

  async function meteo(course) {
    const rep = await fetchDelai(urlMeteo(course), DELAIS.meteo);
    const json = await rep.json();
    const tableau = Array.isArray(json) ? json : [json];
    if (!tableau.length || !tableau[0].hourly) throw new Error("réponse météo inattendue");
    return tableau;
  }

  async function brouter(lat, lon, glat, glon) {
    const url = "https://brouter.de/brouter?lonlats=" + lon.toFixed(5) + "," + lat.toFixed(5) + "|" + glon.toFixed(5) + "," + glat.toFixed(5)
      + "&profile=fastbike&alternativeidx=0&format=gpx";
    const rep = await fetchDelai(url, DELAIS.brouter);
    return rep.text();
  }

  return { fetchDelai, urlMeteo, meteo, brouter };
}
