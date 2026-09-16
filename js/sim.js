// Paramètres de simulation (SPEC § 11). Dès qu'un paramètre sim_ est présent : pas de GPS réel ni de localStorage.
import { parisVersMs } from "./logique/temps.js";

const TYPES = ["boulangerie", "supermarche", "eau", "station"];

function nombre(x) {
  if (x == null || x === "") return null;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Dossier de données : chemin relatif uniquement (jamais d'URL externe ni de chemin absolu).
function dossierDonnees(v) {
  if (!v) return "data/";
  const s = String(v).trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith("/") || s.startsWith("\\")) return "data/";
  return s.endsWith("/") ? s : s + "/";
}

export function lireSim(search) {
  const q = new URLSearchParams(search || "");
  let actif = false;
  for (const k of q.keys()) if (k.startsWith("sim_")) actif = true;
  const sim = {
    actif,
    now: null, km: null, pos: null, decalM: null, gps: null, reseau: null, meteo: null, pause: null, filtres: null,
    donnees: dossierDonnees(q.get("donnees")),
  };
  if (!actif) return sim;
  if (q.has("sim_now")) {
    const t = parisVersMs(q.get("sim_now"));
    if (Number.isFinite(t)) sim.now = t;
  }
  sim.km = nombre(q.get("sim_km"));
  if (q.has("sim_pos")) {
    const [la, lo] = String(q.get("sim_pos")).split(",").map(nombre);
    if (la != null && lo != null) sim.pos = { lat: la, lon: lo };
  }
  sim.decalM = nombre(q.get("sim_decal_m"));
  const gps = q.get("sim_gps");
  if (gps === "refus" || gps === "delai") sim.gps = gps;
  if (q.get("sim_reseau") === "hors") sim.reseau = "hors";
  const meteo = q.get("sim_meteo");
  if (meteo && !/^[a-z][a-z0-9+.-]*:/i.test(meteo) && !meteo.startsWith("//")) sim.meteo = meteo;
  const pause = /^(\d+)@(\d{1,2}):(\d{2})$/.exec(q.get("sim_pause") || "");
  if (pause) {
    const hh = pause[2].padStart(2, "0");
    sim.pause = { n: Number(pause[1]), t: parisVersMs(["2026-09-18", `${hh}:${pause[3]}`].join("T")) };
  }
  if (q.has("sim_filtres")) {
    sim.filtres = String(q.get("sim_filtres")).split(",").map((s) => s.trim()).filter((s) => TYPES.includes(s));
  }
  return sim;
}
