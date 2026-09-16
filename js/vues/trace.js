// Vue Tracé v2 « cases de roadbook » (DESIGN § 9 ; calculs SPEC § 5, § 7, états § 8).
// Écarts voulus par l'utilisateur au § 9.11 : pas de lien « Gares » dans la ligne de tête ;
// lien discret « Rentrer en train » tout en bas, après les checkpoints (seul accès à la vue Gares depuis le Tracé).
import { formatHeure, minutesCourse } from "../logique/temps.js";
import { formatKm, formatEcartPhrase, nomCommerce, NBSP } from "../logique/format.js";
import { heurePlan, arriveePause, rangPause, kmPlan } from "../logique/plan.js";
import { statut } from "../logique/ouverture.js";
import { capAuKm } from "../logique/geo.js";
import { ventRelatif, provenanceCourte, libelleCategorieVent, provenance } from "../logique/vent.js";
import { valeursHeure, chercherAlerte } from "../logique/meteo.js";
import { leverCoucher } from "../logique/soleil.js";
import { bandeaux, tetePage, barre, panneau, esc, icone, signal } from "./commun.js";
import { blocAvantDepart, blocArrivee } from "./etats.js";

// Heure d'arrivée au commerce conseillé (§ 7.5) : recalculée et prévue.
export function arriveeConseille(ctx, pause) {
  const i = rangPause(ctx.plan, pause.n);
  const c = pause.commerces[0];
  const trajet = ((c.detour_km || 0) * 60) / ctx.plan.v;
  const prevue = arriveePause(ctx.plan, i) + trajet;
  const recalculee = heurePlan(ctx.plan, pause.km) + ctx.eHeures + trajet;
  return { prevue, recalculee, estimee: ctx.modePlan ? prevue : recalculee };
}

export function distancePanneau(ctx, pause) {
  const c = pause.commerces[0];
  return Math.max(0, pause.km - ctx.km) + (c.detour_km || 0) + (ctx.horsTraceKm || 0);
}

function titreCase(texte, visible) {
  return `<h2 class="b-titre${visible ? "" : " masque"}">${texte}</h2>`;
}

// ---------- Case Météo (§ 9.4) ----------
const NOMS_PROVENANCE = { nord: "du nord", "nord-est": "du nord-est", est: "de l'est", "sud-est": "du sud-est", sud: "du sud", "sud-ouest": "du sud-ouest", ouest: "de l'ouest", "nord-ouest": "du nord-ouest" };

function caseMeteo(ctx, etat, soleil) {
  const lignes = [];
  let l1 = `<span class="soleil-i" aria-label="${soleil.lectureLever} ${formatHeure(soleil.lever)}">${icone("lever")}<b id="soleil-lever">${formatHeure(soleil.lever)}</b></span>`
    + `<span class="soleil-i" aria-label="${soleil.lectureCoucher} ${formatHeure(soleil.coucher)}">${icone("coucher")}<b id="soleil-coucher">${formatHeure(soleil.coucher)}</b></span>`;
  const meteo = etat.meteo;
  let val = null, vent = null;
  if (meteo && meteo.reponse) {
    const { course, trace } = etat.donnees;
    const km = ctx.avantDepart ? 0 : ctx.km;
    const h = ctx.m >= 0 ? Math.max(0, Math.min(23, Math.round(ctx.m / 60))) : 4;
    val = valeursHeure(meteo.reponse, course.meteo_points, km, h);
    if (val && val.vitesse != null && val.direction != null) {
      vent = ventRelatif(val.direction, val.vitesse, capAuKm(trace.points, Math.max(km, trace.points[0][2])));
    }
  }
  if (val && val.temperature != null) l1 += `<span class="temp" id="meteo-temperature">${Math.round(val.temperature)}${NBSP}°C</span>`;
  lignes.push(`<p class="meteo-l">${l1}</p>`);

  const horsReseau = etat.sim.reseau === "hors" || (typeof navigator !== "undefined" && navigator.onLine === false);
  if (vent) {
    const mesure = `${provenanceCourte(vent.provenance)} ${Math.round(val.vitesse)}${NBSP}km/h`;
    const cache = ""; // pas d'heure dans la case météo (retour utilisateur) : l'heure est dans « Actualisé à »
    if (vent.rotation == null) {
      lignes.push(`<p class="meteo-l meteo-vent" aria-label="Vent faible, ${NOMS_PROVENANCE[vent.provenance]}, ${Math.round(val.vitesse)} km/h">`
        + `<span class="vent-cat" id="vent-mot">Vent faible</span><span class="vent-mes" id="vent-detail">${mesure}</span>${cache}</p>`);
    } else {
      const cat = libelleCategorieVent(vent.categorie);
      lignes.push(`<p class="meteo-l meteo-vent" aria-label="Vent de ${vent.categorie}, ${NOMS_PROVENANCE[vent.provenance]}, ${Math.round(val.vitesse)} km/h">`
        + `<svg class="ic vent-i" aria-hidden="true" style="transform:rotate(${Math.round(vent.rotation)}deg)"><use href="#i-vent"/></svg>`
        + `<span class="vent-cat" id="vent-mot">${cat}</span><span class="vent-mes" id="vent-detail">${mesure}</span>${cache}</p>`);
    }
  } else if (horsReseau) {
    lignes.push(`<p class="meteo-l meteo-off" id="meteo-absente">${icone("hors-ligne")}<span>Hors ligne, pas de météo</span></p>`);
  } else if (etat.meteoEchec) {
    lignes.push(`<p class="meteo-l meteo-off" id="meteo-absente">${icone("hors-ligne")}<span>Météo indisponible</span></p>`);
  }
  return `<section class="b b-meteo" id="meteo">${titreCase("Météo")}<div class="b-in">${lignes.join("")}</div></section>`;
}

// ---------- Case Alerte ----------
function caseAlerte(ctx, etat) {
  const meteo = etat.meteo;
  if (!meteo || !meteo.reponse) { etat.alerteAffichee = null; return ""; }
  const e = ctx.e ?? 0;
  const h0 = ctx.avantDepart ? 4 : Math.round(ctx.m / 60);
  const positions = [];
  for (let h = h0; h <= h0 + 3; h++) {
    if (h < 0 || h > 23) continue;
    positions.push({ h, km: kmPlan(ctx.plan, h * 60 - e) });
  }
  const al = chercherAlerte(meteo.reponse, etat.donnees.course.meteo_points, positions, null);
  if (!al) { etat.alerteAffichee = null; return ""; }
  const cle = al.type + al.heure;
  const role = etat.alerteAffichee === cle ? "" : ` role="alert"`;
  etat.alerteAffichee = cle;
  return `<div class="b b-alerte" id="alerte"${role}>${icone("danger")}<div><b>${esc(al.titre)}</b><span>${esc(al.phrase)}</span></div></div>`;
}

// ---------- Case Position (§ 9.6) ----------
function casePosition(ctx, coupures) {
  const plan = ctx.modePlan;
  const kmEntier = plan || ctx.zoneDepart;
  const kmTexte = kmEntier ? String(Math.round(ctx.km)) : formatKm(ctx.km);
  const unite = kmEntier ? "km environ" : "km";
  const prevue = heurePlan(ctx.plan, ctx.L);
  let ecart, bas;
  if (plan) {
    ecart = `<span class="pos-ecart" aria-label="écart inconnu"><span id="ecart-valeur">?</span> écart inconnu</span>`;
    bas = `<span id="arrivee-legende">arrivée prévue <b id="arrivee-valeur">${formatHeure(prevue)}</b></span>`;
  } else {
    const ep = formatEcartPhrase(ctx.e);
    ecart = `<span class="pos-ecart" aria-label="${ep.lecture}"><span id="ecart-valeur">${ep.texte}</span></span>`;
    bas = `<span id="arrivee-legende">arrivée <b id="arrivee-valeur">${formatHeure(prevue + ctx.eHeures)}</b></span>`;
  }
  return `<section class="b b-pos${plan ? " estime" : ""}">${titreCase("Position")}<div class="b-in">`
    + `<div class="pos-haut"><span class="pos-km"><b id="km-actuel">${kmTexte}</b>${NBSP}<span id="km-unite">${unite}</span></span>${ecart}</div>`
    + barre(Math.max(0, ctx.km), ctx.L, coupures)
    + `<div class="pos-bas">${bas}</div></div></section>`;
}

// ---------- Case Prochaine pause (§ 9.7) ----------
function casePause(ctx, pause) {
  if (!pause) {
    const dist = Math.max(0, ctx.L - ctx.km) + (ctx.horsTraceKm || 0);
    return `<section class="b b-pause">${titreCase("Arrivée")}<div class="b-in">${panneau({ cartouche: "Arrivée", km: dist, ville: ctx.arriveeNom })}</div></section>`;
  }
  const c = pause.commerces[0];
  const arr = arriveeConseille(ctx, pause);
  const st = statut(c.horaires, arr.estimee);
  let sig = "";
  if (st.etat === "tendu") sig = signal(`Ferme à ${formatHeure(st.fermeture)}`, "pause-statut");
  else if (st.etat === "ferme") sig = signal("Fermé à l'arrivée", "pause-statut");
  const libelle = ctx.modePlan || ctx.avantDepart ? "arrivée prévue" : "arrivée";
  return `<a class="b b-pause" id="lien-pause" href="#/pause/${pause.n}">${titreCase("Prochaine pause")}<div class="b-in">`
    + panneau({ cartouche: `Pause ${pause.n}`, km: distancePanneau(ctx, pause), ville: pause.ville })
    + `<div class="pause-ligne"><span class="pause-nom" id="pause-commerce">${esc(nomCommerce(c))}</span>`
    + `<span class="pause-h">${libelle} <b id="pause-arrivee">${formatHeure(arr.estimee)}</b></span>${icone("droite")}</div>`
    + (sig ? `<p>${sig}</p>` : "")
    + `</div></a>`;
}

// ---------- Case Prochains checkpoints (§ 9.8) ----------
function caseCheckpoints(ctx, etat) {
  const lignes = [];
  for (const x of ctx.etats) {
    if (x.etat === "passee") continue;
    const p = etat.pausesParN.get(x.n);
    const i = rangPause(ctx.plan, x.n);
    const heure = ctx.modePlan ? arriveePause(ctx.plan, i) : heurePlan(ctx.plan, p.km) + ctx.eHeures;
    lignes.push(`<li class="ck"><span class="ck-km">${Math.round(p.km)}</span><span class="ck-nom">${esc(p.ville)}</span><span class="ck-h">${formatHeure(heure)}</span></li>`);
  }
  const prevueL = heurePlan(ctx.plan, ctx.L);
  const hL = ctx.modePlan ? prevueL : prevueL + ctx.eHeures;
  lignes.push(`<li class="ck arrivee"><span class="ck-km">${formatKm(ctx.L)}</span><span class="ck-nom">${esc(ctx.arriveeNom)}</span><span class="ck-h">${formatHeure(hL)}</span></li>`);
  return `<section class="b b-check">${titreCase("Prochains checkpoints", true)}<ol id="liste-heures">${lignes.join("")}</ol></section>`;
}

// ---------- Bas de vue ----------
function basDeVue() {
  return `<p class="lien-train"><a class="discret" id="lien-gares" href="#/gares">${icone("train")}Rentrer en train</a></p>`
    + `<p class="lien-train"><a class="discret" id="lien-credits" href="#/credits">Crédits</a></p>`
    + `<div class="fin-defile"></div>`;
}

export function vueTrace(ctx, etat) {
  const { course, pauses, trace } = etat.donnees;
  ctx.arriveeNom = course.arrivee.nom;
  const coupures = pauses.pauses.map((p) => p.km);
  const h = [`<h1 class="masque">Tracé prévu</h1>`];
  const etats = bandeaux(ctx, { horsLigne: false, classe: "b" });

  if (ctx.avantDepart) {
    const lever = leverCoucher(trace.points[0][0], trace.points[0][1], ctx.jour.dateISO).lever;
    const coucher = leverCoucher(course.arrivee.lat, course.arrivee.lon, ctx.jour.dateISO).coucher;
    h.push(tetePage(ctx));
    h.push(etats);
    h.push(caseMeteo(ctx, etat, { lever, coucher, lectureLever: "Lever du soleil à Saint-Quentin-en-Yvelines", lectureCoucher: "Coucher du soleil à Talmont-Saint-Hilaire" }));
    h.push(caseAlerte(ctx, etat));
    h.push(`<section class="b">${titreCase("Départ")}${blocAvantDepart(ctx, etat.donnees)}</section>`);
    const p1 = etat.pausesParN.get(ctx.etats[0]?.n) || pauses.pauses[0];
    const ctxDepart = { ...ctx, km: 0, horsTraceKm: 0 };
    h.push(casePause(ctxDepart, p1));
    h.push(caseCheckpoints(ctxDepart, etat));
    h.push(basDeVue());
    return h.join("");
  }

  const soleil = { lever: ctx.soleil.lever, coucher: ctx.soleil.coucher, lectureLever: "Lever du soleil", lectureCoucher: "Coucher du soleil" };

  if (ctx.arrive) {
    h.push(tetePage(ctx));
    h.push(etats);
    h.push(caseMeteo(ctx, etat, soleil));
    h.push(`<section class="b">${titreCase("Arrivée")}${blocArrivee(ctx, etat.donnees)}</section>`);
    h.push(basDeVue());
    return h.join("");
  }

  h.push(tetePage(ctx));
    h.push(etats);
  h.push(caseMeteo(ctx, etat, soleil));
  h.push(caseAlerte(ctx, etat));
  h.push(casePosition(ctx, coupures));
  h.push(casePause(ctx, ctx.pauseSuivante));
  h.push(caseCheckpoints(ctx, etat));
  h.push(basDeVue());
  return h.join("");
}
