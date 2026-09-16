// États de la vue Tracé : avant le départ, après l'arrivée, données manquantes ; crédits.
import { formatHeure, formatDuree, minutesCourse, hhmmVersMinutes } from "../logique/temps.js";
import { formatKm, formatEcartPhrase, NBSP } from "../logique/format.js";
import { heurePlan } from "../logique/plan.js";
import { barre, esc, tetePage } from "./commun.js";
import { VERSION } from "../version.js";

// Page Crédits (#/credits), en cases sur le fond de page.
export function vueCredits(ctx) {
  return tetePage(ctx, { href: "#/trace", texte: "Tracé" })
    + `<h1 class="titre-vue titre-page">Crédits</h1>`
    + `<section class="b" id="credits"><h2 class="b-titre">Police</h2><div class="b-in credits-in">`
    + `<p>Luciole © Laurent Bourcellier &amp; Jonathan Perez (CC BY 4.0).</p></div></section>`
    + `<section class="b"><h2 class="b-titre">Données</h2><div class="b-in credits-in">`
    + `<p>Commerces, points d'eau et tracé : © contributeurs OpenStreetMap (ODbL).</p>`
    + `<p>Trains : SNCF, horaires théoriques (open data).</p>`
    + `<p>Météo : Open-Meteo (CC BY 4.0).</p>`
    + `<p>Itinéraires vélo vers les gares : BRouter.</p>`
    + `<p>Lever et coucher du soleil : calcul NOAA.</p></div></section>`
    + `<section class="b"><h2 class="b-titre">Application</h2><div class="b-in credits-in"><p id="version">Version ${esc(VERSION)}</p></div></section>`
    + `<div class="fin-defile"></div>`;
}

export function ecranDonneesManquantes() {
  return `<p class="message">Ouvrez l'app une fois avec du réseau pour enregistrer le parcours.</p>`;
}

function texteDepart(m, D) {
  const reste = D - m;
  if (reste < 60) return `Départ dans ${Math.max(1, Math.ceil(reste))}${NBSP}min`;
  if (reste < 1440) {
    const r = Math.ceil(reste);
    const mn = r % 60;
    return `Départ dans ${Math.floor(r / 60)}${NBSP}h${mn ? ` ${mn}${NBSP}min` : ""}`;
  }
  return "Départ vendredi";
}

export function blocAvantDepart(ctx, donnees) {
  const { course, pauses } = donnees;
  const L = course.km_total;
  const D = hhmmVersMinutes(course.depart_heure);
  const coupures = pauses.pauses.map((p) => p.km);
  return `<section class="etat" id="etat-avant-depart">`
    + `<p class="etat-titre">${texteDepart(ctx.m, ctx.plan.D)}</p>`
    + `<span class="chiffre-xl">${formatHeure(Number.isNaN(D) ? ctx.plan.D : D)}</span>`
    + `<span class="legende">${esc(course.depart_nom)}, ${formatKm(L)}${NBSP}km jusqu'à ${esc(course.arrivee.nom)}</span>`
    + barre(0, L, coupures)
    + `<div class="duo"><div><span class="chiffre">${pauses.pauses.length}</span><span class="legende">pauses de ${course.pause_min}${NBSP}min</span></div>`
    + `<div><span class="chiffre" id="arrivee-valeur">${formatHeure(heurePlan(ctx.plan, L))}</span><span class="legende" id="arrivee-legende">arrivée prévue</span></div></div>`
    + `</section>`;
}

export function blocArrivee(ctx, donnees) {
  const { course, pauses } = donnees;
  const L = course.km_total;
  const mArr = minutesCourse(ctx.tArrivee);
  const e = formatEcartPhrase(mArr - heurePlan(ctx.plan, L));
  return `<section class="etat" id="etat-arrivee">`
    + `<p class="etat-titre">Arrivée à ${esc(course.arrivee.nom)}</p>`
    + `<span class="chiffre-xl">${formatHeure(mArr)}</span>`
    + barre(L, L, pauses.pauses.map((p) => p.km))
    + `<div class="duo"><div><span class="etat-titre" aria-label="${e.lecture} sur le plan">${e.texte}</span><span class="legende">sur le plan</span></div>`
    + `<div><span class="etat-titre">${formatDuree(mArr - ctx.plan.D)}</span><span class="legende">depuis le départ</span></div></div>`
    + `</section>`;
}
