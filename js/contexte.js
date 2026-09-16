// Calcul, à chaque rendu, de tout ce que les vues affichent (heure, position, km, écart, pauses, thème).
import { minutesCourse, jourParis } from "./logique/temps.js";
import { haversineM, pointAuKm, projeter } from "./logique/geo.js";
import { kmPlan, calculerEcart, etatPauses } from "./logique/plan.js";
import { leverCoucher, theme } from "./logique/soleil.js";

const DEUX_HEURES = 2 * 3600000;
const TRENTE_MIN = 30 * 60000;

// Position utilisée pour les calculs (§ 4.3).
export function positionUtilisee(etat, now) {
  const p = etat.position.derniere;
  if (!p) return null;
  const age = now - p.t;
  if (etat.position.statut === "ok") return p;
  if (etat.position.statut === "echec") return age < TRENTE_MIN ? p : null;
  return age < DEUX_HEURES ? p : null;
}

// Projection mise en cache par position (la référence km_ref est enregistrée à chaque nouvelle position).
function projection(etat, pos, now, m) {
  const cache = etat.cacheProjection;
  if (cache && cache.lat === pos.lat && cache.lon === pos.lon && cache.t === pos.t) return cache.resultat;
  const { trace } = etat.donnees;
  let ref = null;
  const kr = etat.stockage.lire("us.km_ref");
  if (kr && typeof kr.km === "number" && now - kr.t < DEUX_HEURES) ref = kr.km;
  else if (m >= etat.plan.D) ref = kmPlan(etat.plan, m);
  const resultat = projeter(trace.points, pos.lat, pos.lon, ref);
  etat.stockage.ecrire("us.km_ref", { km: resultat.km, t: now });
  etat.cacheProjection = { lat: pos.lat, lon: pos.lon, t: pos.t, resultat };
  return resultat;
}

export function calculerContexte(etat, now) {
  const { course, trace, pauses } = etat.donnees;
  const plan = etat.plan;
  const m = minutesCourse(now);
  const L = course.km_total;
  const pos = positionUtilisee(etat, now);
  const ctx = {
    now, m, plan, L, pos,
    modePlan: !pos,
    avantDepart: m < plan.D,
    gpsEchec: etat.position.statut === "echec" ? etat.position.erreur : null,
    horsLigne: etat.sim.reseau === "hors" || (typeof navigator !== "undefined" && navigator.onLine === false) || etat.meteoEchec === true,
    meteo: etat.meteo,
  };

  if (pos) {
    const proj = projection(etat, pos, now, m);
    ctx.proj = proj;
    ctx.km = proj.km;
    ctx.zoneDepart = proj.zoneDepart;
    ctx.horsTrace = !proj.zoneDepart && proj.distM > 1000;
    ctx.horsTraceKm = ctx.horsTrace ? (proj.distM * 1.3) / 1000 : 0;
    const dist = {};
    for (const p of pauses.pauses) {
      const c = p.commerces[0];
      dist[p.n] = haversineM(pos.lat, pos.lon, c.lat, c.lon);
    }
    ctx.etats = etatPauses(plan, { km: ctx.km, m, distConseilleM: dist });
    let enPause = null;
    const enCours = ctx.etats.find((x) => x.etat === "en-cours");
    if (enCours && m >= plan.D) {
      const vues = etat.stockage.lire("us.pause_vue") || {};
      let t = vues[String(enCours.n)];
      if (t == null) {
        t = now;
        vues[String(enCours.n)] = t;
        etat.stockage.ecrire("us.pause_vue", vues);
      }
      enPause = { n: enCours.n, premiereVue: minutesCourse(t) };
    }
    ctx.enPause = enPause;
    ctx.e = calculerEcart(plan, { km: ctx.km, m, enPause });
    // Arrivée (§ 7.2) : enregistrée la première fois.
    const arr = course.arrivee;
    if (m >= plan.D && (ctx.km >= L - 0.3 || (arr && haversineM(pos.lat, pos.lon, arr.lat, arr.lon) <= 200))) {
      if (etat.stockage.lire("us.arrivee") == null) etat.stockage.ecrire("us.arrivee", now);
    }
  } else {
    ctx.km = kmPlan(plan, m);
    ctx.zoneDepart = false;
    ctx.horsTrace = false;
    ctx.horsTraceKm = 0;
    ctx.etats = plan.k.map((ki, i) => ({ n: plan.n[i], etat: ki > ctx.km ? "a-venir" : "passee" }));
    ctx.enPause = null;
    ctx.e = null;
  }
  ctx.eHeures = ctx.avantDepart ? 0 : (ctx.e ?? 0);

  const tArr = etat.stockage.lire("us.arrivee");
  ctx.arrive = !ctx.avantDepart && typeof tArr === "number" && minutesCourse(tArr) >= plan.D;
  ctx.tArrivee = ctx.arrive ? tArr : null;

  const suivante = ctx.etats.find((x) => x.etat === "a-venir");
  ctx.pauseSuivante = suivante ? etat.pausesParN.get(suivante.n) : null;

  // Thème (§ 7.7) : dernière position GPS même ancienne, sinon position du plan, sinon premier point publié.
  const jour = jourParis(m);
  let ref;
  if (etat.position.derniere) ref = etat.position.derniere;
  else if (m >= plan.D) ref = pointAuKm(trace.points, kmPlan(plan, m));
  else ref = { lat: trace.points[0][0], lon: trace.points[0][1] };
  ctx.soleil = leverCoucher(ref.lat, ref.lon, jour.dateISO);
  ctx.theme = theme(jour.minutesDuJour, ctx.soleil.lever, ctx.soleil.coucher);
  ctx.jour = jour;
  return ctx;
}
