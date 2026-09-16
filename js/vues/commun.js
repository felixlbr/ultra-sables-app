// Fragments HTML partagés par les vues.
import { formatHeure, minutesCourse } from "../logique/temps.js";
import { formatKm, formatNombreKm, formatDistance, NBSP } from "../logique/format.js";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function icone(id, style) {
  return `<svg class="ic" aria-hidden="true"${style ? ` style="${style}"` : ""}><use href="#i-${id}"/></svg>`;
}

export function signal(texte, id) {
  return `<span class="statut"${id ? ` id="${id}"` : ""}>${icone("danger")}${esc(texte)}</span>`;
}

// Bandeaux d'état, dans l'ordre : GPS, hors tracé, hors ligne (§ 8).
// options.horsLigne = false : pas de bandeau hors ligne (vue Tracé v2 : l'état est dans la case météo) ;
// options.classe : classe ajoutée (« b » pour une case de la vue Tracé v2).
export function bandeaux(ctx, options = {}) {
  const h = [];
  const cls = options.classe ? " " + options.classe : "";
  if (ctx.gpsEchec === "refus") {
    h.push(`<div class="bandeau${cls}" id="bandeau-gps" role="status">${icone("position-off")}<span><b>Position indisponible.</b> Autoriser la localisation${NBSP}: Réglages, Confidentialité et sécurité, Service de localisation, Sites Safari.</span></div>`);
  } else if (ctx.gpsEchec === "delai") {
    h.push(`<div class="bandeau${cls}" id="bandeau-gps" role="status">${icone("position-off")}<span><b>Position introuvable.</b> Réessayez avec Actualiser, à découvert.</span></div>`);
  }
  if (ctx.horsTrace) {
    h.push(`<div class="bandeau${cls}" id="bandeau-hors-trace" role="status">${icone("position")}<span><b>Hors tracé</b>, à ${formatDistance(ctx.proj.distM / 1000)} de la route. Km et heures comptés depuis le point le plus proche.</span></div>`);
  }
  if (ctx.horsLigne && options.horsLigne !== false) {
    const meteo = ctx.meteo ? `Météo de ${formatHeure(minutesCourse(ctx.meteo.recupere_le))}.` : "Pas de météo enregistrée.";
    h.push(`<div class="bandeau${cls}" id="bandeau-hors-ligne" role="status">${icone("hors-ligne")}<span><b>Hors ligne.</b> ${meteo} Horaires et trains enregistrés.</span></div>`);
  }
  return h.join("");
}

// En-tête « Position à 9h26 » ou « Selon le plan à 10h12 ».
export function infoPosition(ctx, suffixeKm) {
  if (ctx.pos && !ctx.modePlan) {
    const heure = formatHeure(minutesCourse(ctx.pos.t));
    const km = suffixeKm ? `, km ${ctx.zoneDepart ? Math.round(ctx.km) + " environ" : formatKm(ctx.km)}` : "";
    return `Position à <b>${heure}</b>${km}`;
  }
  const km = suffixeKm ? `, km ${Math.round(ctx.km)} environ` : "";
  return `Selon le plan à <b>${formatHeure(ctx.m)}</b>${km}`;
}

export function barre(km, L, coupures) {
  const pc = (x) => Math.max(0, Math.min(100, (x / L) * 100)).toFixed(2);
  const i = coupures.map((k) => `<i style="left:${pc(k)}%"></i>`).join("");
  return `<div class="barre" id="barre" role="img" aria-label="${formatKm(km)} km parcourus sur ${formatKm(L)}"><b style="width:${pc(km)}%"></b>${i}</div>`;
}

// Panneau de direction : distance en km (une décimale sous 100).
export function panneau({ cartouche, km, ville }) {
  return `<div class="panneau"><span class="cartouche" id="panneau-cartouche">${esc(cartouche)}</span>`
    + `<span class="panneau-ville" id="panneau-ville">${esc(ville)}</span>`
    + `<span class="panneau-km"><span id="panneau-km">${formatNombreKm(km)}</span><small>${NBSP}km</small></span></div>`;
}

// Ligne de liste « roadbook ».
export function ligne({ colKm, colKmSous, gros, nom, metas = [], extra = "", droite, droiteSous, classe = "", href, tag = "li" }) {
  const col = `<span class="col-km${gros ? " gros" : ""}">${colKm}${colKmSous ? `<span>${colKmSous}</span>` : ""}</span>`;
  const centre = `<span><span class="l-nom">${nom}</span>${metas.map((x) => `<span class="l-meta">${x}</span>`).join("")}${extra}</span>`;
  const dr = droite == null && droiteSous == null ? "<span></span>" : `<span class="l-h">${droite ?? ""}${droiteSous != null ? `<span>${droiteSous}</span>` : ""}</span>`;
  const cls = `ligne${classe ? " " + classe : ""}`;
  if (href) return `<li><a class="${cls}" href="${esc(href)}">${col}${centre}${dr}</a></li>`;
  return `<${tag} class="${cls}">${col}${centre}${dr}</${tag}>`;
}

export function titreSection(texte) {
  return `<h2 class="titre-section">${texte}</h2>`;
}

export function adresseCourte(c) {
  if (!c.adresse) return c.commune || "";
  return String(c.adresse).replace(/,\s*\d{5}\s.*$/, "");
}

export const JOURS = [["lu", "Lundi"], ["ma", "Mardi"], ["me", "Mercredi"], ["je", "Jeudi"], ["ve", "Vendredi"], ["sa", "Samedi"], ["di", "Dimanche"]];
