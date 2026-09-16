// Détail d'une pause (#/pause/<n>) ou d'un commerce (#/commerce/<id>) (SPEC § 6.1, DESIGN § 5.2).
import { formatHeure } from "../logique/temps.js";
import { formatKm, formatDistance, formatCreneaux, formatCreneau, libelleType, nomCommerce, NBSP } from "../logique/format.js";
import { statut } from "../logique/ouverture.js";
import { haversineM } from "../logique/geo.js";
import { rechercher } from "../logique/recherche.js";
import { bandeaux, tetePage, panneau, ligne, esc, icone, signal } from "./commun.js";
import { arriveeConseille, distancePanneau } from "./trace.js";

// Détail en cases (DESIGN § 9, retour utilisateur) : retour et « Actualisé à » sur le fond de page.
function tete(ctx, retourHref, retourTexte) {
  return tetePage(ctx, { href: retourHref, texte: retourTexte }) + bandeaux(ctx, { classe: "b" });
}

function soustitre(c) {
  const lieu = c.adresse || c.commune || "";
  return lieu ? `${libelleType(c)}, ${lieu}` : libelleType(c);
}

// Chiffre de droite : fermeture du jour ou statut.
function blocFermeture(st, arrivee) {
  switch (st.etat) {
    case "ouvert":
      if (st.fermeture == null) return `<div><span class="chiffre">24h/24</span><span class="legende">ouvert</span></div>`;
      return `<div><span class="chiffre">${formatHeure(st.fermeture)}</span><span class="legende">fermeture</span></div>`;
    case "tendu":
      return `<div><span class="chiffre">${formatHeure(st.fermeture)}</span><span class="legende">fermeture</span></div>`;
    case "ferme":
      return `<div><span class="chiffre">Fermé</span><span class="legende">à ${formatHeure(arrivee)}</span></div>`;
    case "inconnu":
      return `<div><span class="chiffre">?</span><span class="legende">horaires inconnus</span></div>`;
    default:
      return "";
  }
}

function boutons(c) {
  const ll = `${c.lat},${c.lon}`;
  return `<section class="b"><h2 class="b-titre masque">Itinéraire</h2><div class="b-in">`
    + `<a class="bouton" href="https://www.google.com/maps/dir/?api=1&amp;destination=${ll}&amp;travelmode=bicycling" target="_blank" rel="noopener">${icone("itineraire")}Itinéraire Google Maps</a>`
    + `</div></section>`;
}

// Horaires du jour de course seulement (retour utilisateur du 16/09) : pas de tableau de la semaine.
function tableHoraires(h, ctx) {
  let corps;
  const libelle = ctx.jour && ctx.jour.dateISO === "2026-09-18" ? "Aujourd'hui" : "Vendredi 18 septembre";
  if (h == null) {
    corps = `<p class="note" id="horaires">Lieu sans horaires.</p>`;
  } else if (h.vendredi == null) {
    corps = `<table class="horaires" id="horaires"><tbody><tr class="jour-j"><td>${libelle}</td><td>Horaires inconnus</td></tr></tbody></table>`;
  } else {
    const texte = !h.vendredi.length ? "Fermé" : h.vendredi.map(formatCreneau).join("<br>");
    corps = `<table class="horaires" id="horaires"><tbody><tr class="jour-j"><td>${libelle}</td><td>${texte}</td></tr></tbody></table>`;
  }
  const note = h && h.note ? `<p class="note">${esc(h.note)}</p>` : "";
  return `<h3 class="sous-titre">Horaires du jour</h3>${corps}${note}`;
}

function metaVendredi(c) {
  const h = c.horaires;
  if (h == null) return esc(libelleType(c));
  if (h.vendredi == null) return `${esc(libelleType(c))}, horaires inconnus`;
  if (!h.vendredi.length) return `${esc(libelleType(c))}, fermé le vendredi`;
  return `${esc(libelleType(c))}, ${h.vendredi.map((x) => `<span class="plage">${formatCreneau(x)}</span>`).join(", ")}`;
}

function autresCommerces(ctx, pause, arriveeConseilleMin) {
  const alts = pause.commerces.slice(1);
  if (!alts.length) {
    return `<section class="b">${`<h2 class="b-titre">Autres commerces à ${esc(pause.ville)}</h2>`}<div class="b-in"><p class="note-case" id="autres-commerces">Pas d'autre commerce connu à ${esc(pause.ville)}.</p></div></section>`;
  }
  const lignes = alts.map((c) => {
    const d = c.distance_conseille_m ?? haversineM(pause.commerces[0].lat, pause.commerces[0].lon, c.lat, c.lon);
    const arrivee = arriveeConseilleMin + ((d * 1.3) / 1000) * 60 / ctx.plan.v;
    const st = statut(c.horaires, arrivee);
    let droite = null, sous = null, classe = "", extra = "";
    if (st.etat === "ouvert") { droite = `<b class="ouvert">Ouvert</b>`; sous = `à ${formatHeure(arrivee)}`; }
    else if (st.etat === "tendu") { extra = signal(`Ferme à ${formatHeure(st.fermeture)}`); }
    else if (st.etat === "ferme") { droite = `<b class="ouvert">Fermé</b>`; sous = `à ${formatHeure(arrivee)}`; classe = "ferme"; }
    else if (st.etat === "inconnu") { droite = `<b class="ouvert">?</b>`; sous = "horaires"; classe = "inconnu"; }
    return ligne({
      colKm: formatDistance(d / 1000), nom: esc(nomCommerce(c)), metas: [metaVendredi(c)],
      extra, droite, droiteSous: sous, classe, href: `#/commerce/${encodeURIComponent(c.id)}?depuis=pause-${pause.n}`,
    });
  }).join("");
  return `<section class="b"><h2 class="b-titre">Autres commerces à ${esc(pause.ville)}</h2><ol id="autres-commerces">${lignes}</ol></section>`;
}

function corpsDetail(ctx, c, { arrivee, legendeArrivee }) {
  const st = statut(c.horaires, arrivee);
  return `<section class="b b-detail"><h2 class="b-titre masque">Arrivée et horaires du jour</h2><div class="b-in"><div class="duo">`
    + `<div><span class="chiffre">${formatHeure(arrivee)}</span><span class="legende">${legendeArrivee}</span></div>`
    + blocFermeture(st, arrivee)
    + `</div>${st.etat === "tendu" ? `<p class="signal-detail">${signal(`Ferme à ${formatHeure(st.fermeture)}`)}</p>` : ""}`
    + tableHoraires(c.horaires, ctx) + `</div></section>` + boutons(c);
}

export function vuePause(ctx, etat, n) {
  const pause = etat.pausesParN.get(n);
  if (!pause) {
    return tete(ctx, "#/trace", "Tracé") + `<p class="message">Pause introuvable.</p>`;
  }
  const c = pause.commerces[0];
  const arr = arriveeConseille(ctx, pause);
  const kmCtx = ctx.avantDepart ? { ...ctx, km: 0, horsTraceKm: 0 } : ctx;
  const legende = ctx.modePlan || ctx.avantDepart ? "arrivée prévue" : `arrivée, prévue ${formatHeure(arr.prevue)}`;
  return tete(ctx, "#/trace", "Tracé")
    + `<section class="b b-pause b-entete"><div class="b-in"><p class="legende">km ${Math.round(pause.km)} sur le tracé</p>`
    + panneau({ cartouche: `Pause ${pause.n}`, km: distancePanneau(kmCtx, pause), ville: pause.ville })
    + `<h1 class="titre-vue">${esc(nomCommerce(c))}</h1><span class="legende">${esc(soustitre(c))}</span></div></section>`
    + corpsDetail(ctx, c, { arrivee: arr.estimee, legendeArrivee: legende })
    + autresCommerces(ctx, pause, arr.estimee)
    + `<div class="fin-defile"></div>`;
}

function trouverCommerce(etat, id) {
  for (const p of etat.donnees.pauses.pauses) {
    const idx = p.commerces.findIndex((c) => c.id === id);
    if (idx >= 0) return { c: p.commerces[idx], pause: p, rang: idx };
  }
  const c = (etat.donnees.poi.poi || []).find((x) => x.id === id);
  return c ? { c, pause: null, rang: -1 } : null;
}

export function vueCommerce(ctx, etat, id, depuis) {
  const t = trouverCommerce(etat, id);
  const depuisPause = /^pause-(\d+)$/.exec(depuis || "");
  if (!t) return tete(ctx, "#/trace", "Tracé") + `<p class="message">Commerce introuvable.</p>`;
  const { c } = t;
  let retourHref = "#/recherche", retourTexte = "Recherche", info = "", arrivee, legende = "arrivée";

  const pauseCtx = depuisPause ? etat.pausesParN.get(Number(depuisPause[1])) : (depuis ? null : t.pause);
  if (pauseCtx && pauseCtx.commerces.some((x) => x.id === c.id)) {
    retourHref = `#/pause/${pauseCtx.n}`;
    retourTexte = `Pause ${pauseCtx.n}`;
    const arr = arriveeConseille(ctx, pauseCtx);
    const conseille = pauseCtx.commerces[0];
    if (conseille.id === c.id) {
      arrivee = arr.estimee;
      info = `km ${Math.round(pauseCtx.km)} sur le tracé`;
    } else {
      const d = c.distance_conseille_m ?? haversineM(conseille.lat, conseille.lon, c.lat, c.lon);
      arrivee = arr.estimee + ((d * 1.3) / 1000) * 60 / ctx.plan.v;
      info = `${formatDistance(d / 1000)} du commerce conseillé`;
    }
  } else {
    const lat = ctx.modePlan ? null : ctx.pos?.lat, lon = ctx.modePlan ? null : ctx.pos?.lon;
    const res = rechercher([c], { km: ctx.km, lat, lon, m: ctx.m, types: null, vitesse: ctx.plan.v });
    const l = res.lignes[0];
    let sens, distKm, devant;
    if (l) { sens = l.sens; distKm = l.distKm; devant = l.devantKm; }
    else if (lat != null && c.km <= ctx.km) { sens = "autour"; distKm = (haversineM(lat, lon, c.lat, c.lon) * 1.3) / 1000; }
    else { sens = "devant"; devant = c.km - ctx.km; distKm = Math.abs(devant) + (c.ecart_m * 1.3) / 1000; }
    arrivee = ctx.m + (distKm * 60) / ctx.plan.v;
    if (sens === "devant") info = `${devant >= 0 ? "+" : "−"}${formatKm(Math.abs(devant))}${NBSP}km devant`;
    else info = `${formatKm(distKm)}${NBSP}km d'ici`;
  }
  return tete(ctx, retourHref, retourTexte)
    + `<section class="b b-entete"><div class="b-in"><p class="legende">${info}</p>`
    + `<h1 class="titre-vue">${esc(nomCommerce(c))}</h1><span class="legende">${esc(soustitre(c))}</span></div></section>`
    + corpsDetail(ctx, c, { arrivee, legendeArrivee: legende })
    + `<div class="fin-defile"></div>`;
}
