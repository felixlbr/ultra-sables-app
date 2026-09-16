// Géolocalisation à la demande (SPEC § 4.3) : getCurrentPosition seulement, jamais watchPosition.
import { pointAuKm, capAuKm, destination, projeter } from "./logique/geo.js";

export function demanderPosition() {
  return new Promise((resoudre) => {
    if (!("geolocation" in navigator)) {
      resoudre({ ok: false, erreur: "refus" });
      return;
    }
    try {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const { latitude, longitude, accuracy } = p.coords;
          if (accuracy > 1000) {
            resoudre({ ok: false, erreur: "delai" });
            return;
          }
          resoudre({ ok: true, pos: { lat: latitude, lon: longitude, precision: accuracy, t: Date.now() } });
        },
        (err) => {
          resoudre({ ok: false, erreur: err && err.code === 1 ? "refus" : "delai" });
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
      );
    } catch (e) {
      resoudre({ ok: false, erreur: "delai" });
    }
  });
}

// Position simulée (SPEC § 11) ; t = heure simulée.
export function positionSimulee(sim, tracePoints, maintenantMs) {
  if (sim.gps) return { ok: false, erreur: sim.gps };
  let base = null;
  if (sim.pos) base = { lat: sim.pos.lat, lon: sim.pos.lon };
  else if (sim.km != null) {
    const p = pointAuKm(tracePoints, sim.km);
    base = { lat: p.lat, lon: p.lon };
  }
  if (!base) return null;
  if (sim.decalM) {
    const km = sim.km != null ? sim.km : projeter(tracePoints, base.lat, base.lon, null).km;
    const cap = capAuKm(tracePoints, km);
    const q = destination(base.lat, base.lon, cap + 90, sim.decalM);
    base = { lat: q.lat, lon: q.lon };
  }
  return { ok: true, pos: { lat: base.lat, lon: base.lon, precision: 10, t: maintenantMs } };
}
