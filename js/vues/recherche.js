// Vue Recherche (SPEC § 6.2, § 7.10 ; DESIGN § 5.3).
import { formatHeure } from "../logique/temps.js";
import { formatKm, formatDecimal, libelleType, nomCommerce, NBSP } from "../logique/format.js";
import { rechercher } from "../logique/recherche.js";
import { bandeaux, infoPosition, ligne, esc, icone, signal } from "./commun.js";

export const TYPES = [["boulangerie", "Boulangerie"], ["supermarche", "Supermarché"], ["eau", "Eau"], ["station", "Station-service"]];

export function vueRecherche(ctx, etat) {
  const filtres = etat.filtres;
  const h = [bandeaux(ctx)];
  h.push(`<header class="tete"><p class="tete-info">${infoPosition(ctx, true)}</p></header>`);
  h.push(`<h1 class="titre-vue">Ravitaillement</h1>`);
  h.push(`<div class="filtres" id="filtres" role="group" aria-label="Types de lieux">`
    + TYPES.map(([t, nom]) => `<button class="filtre" type="button" data-action="filtre" data-type="${t}" aria-pressed="${filtres.includes(t)}"><i>${icone("coche")}</i>${nom}</button>`).join("")
    + `</div>`);
  const autour = !ctx.modePlan && ctx.pos;
  h.push(`<p class="titre-section titre-serre">${autour ? `3${NBSP}km autour et 30${NBSP}km devant` : `30${NBSP}km devant`}</p>`);

  if (!filtres.length) {
    h.push(`<ol id="recherche-liste"></ol><p class="note">Activez au moins un type de lieu.</p><div class="fin-defile"></div>`);
    return h.join("");
  }
  const res = rechercher(etat.donnees.poi, {
    km: ctx.km, lat: autour ? ctx.pos.lat : null, lon: autour ? ctx.pos.lon : null, m: ctx.m, types: filtres, vitesse: ctx.plan.v,
  });
  const lignes = res.lignes.map((l) => {
    const p = l.poi;
    const inconnu = l.statut.etat === "inconnu";
    const lieu = [p.nom && String(p.nom).trim() ? libelleType(p) : null, p.commune].filter(Boolean).join(", ") + (inconnu ? ", horaires ?" : "");
    const metas = [esc(lieu)];
    if (l.sens === "devant") metas.push(p.ecart_m < 100 ? "sur la route" : `détour +${formatDecimal(l.detourKm)}${NBSP}km`);
    const extra = l.statut.etat === "tendu" ? signal(`Ferme à ${formatHeure(l.statut.fermeture)}`) : "";
    const col = l.sens === "devant" ? `+${formatKm(l.devantKm)}` : formatKm(l.distKm);
    return ligne({
      colKm: col, colKmSous: l.sens === "devant" ? "km devant" : "km d'ici", gros: true,
      nom: esc(nomCommerce(p)), metas, extra, droite: `<b>${formatHeure(l.arrivee)}</b>`, droiteSous: "arrivée",
      classe: inconnu ? "inconnu" : "", href: `#/commerce/${encodeURIComponent(p.id)}?depuis=recherche`,
    });
  });
  h.push(`<ol id="recherche-liste">${lignes.join("")}</ol>`);
  if (!lignes.length) h.push(`<p class="note">Rien d'ouvert dans ce périmètre. Essayez d'activer d'autres types.</p>`);
  if (res.masques > 0) {
    const t = res.masques === 1
      ? "1 commerce fermé à l'arrivée n'est pas affiché."
      : `${res.masques} commerces fermés à l'arrivée ne sont pas affichés.`;
    h.push(`<p class="note" id="recherche-note">${t}</p>`);
  }
  h.push(`<div class="fin-defile"></div>`);
  return h.join("");
}
