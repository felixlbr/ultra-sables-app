// Vue Rentrer en train (SPEC § 6.3, § 7.12, § 7.13 ; DESIGN § 5.4, § 5.9).
import { formatHeure, formatDuree, hhmmVersMinutes } from "../logique/temps.js";
import { formatKm, formatNombreKm, heureTexte, NBSP } from "../logique/format.js";
import { heurePlan } from "../logique/plan.js";
import { garePlusProche, prochainsTrains, distanceGare, alternativePlusTot, reservationVelo, modesSpeciaux } from "../logique/gares.js";
import { bandeaux, infoPosition, ligne, titreSection, esc, icone, signal } from "./commun.js";

function correspondances(t) {
  const n = t.correspondances ?? Math.max(0, (t.etapes?.length || 1) - 1);
  if (n === 0) return "direct";
  return n === 1 ? "1 correspondance" : `${n} correspondances`;
}

function via(t) {
  const v = t.via || [];
  if (!v.length) return "";
  if (v.length === 1) return `via ${v[0]}`;
  return `via ${v.slice(0, -1).join(", ")} et ${v[v.length - 1]}`;
}

// Km de départ des calculs de la vue (avant le départ : km 0).
export function kmGares(ctx) {
  return ctx.avantDepart ? 0 : Math.max(0, ctx.km);
}

// Gare affichée : celle choisie par l'alternative « arrivée plus tôt » si elle existe, sinon la plus proche.
export function gareAffichee(ctx, etat) {
  const liste = etat.donnees.gares?.gares || [];
  if (etat.gareChoisie) {
    const g = liste.find((x) => (x.id || x.nom) === etat.gareChoisie);
    if (g) return { ...distanceGare(g, kmGares(ctx), ctx.horsTraceKm || 0), choisie: true };
  }
  return garePlusProche(etat.donnees.gares, kmGares(ctx), ctx.horsTraceKm || 0);
}

function libelleVia(t) {
  const v = via(t);
  const modes = modesSpeciaux(t).join(" et ");
  if (!modes) return v;
  return v ? `${v}, ${modes}` : modes;
}

export function vueGares(ctx, etat) {
  const { gares, course } = etat.donnees;
  const km = kmGares(ctx);
  const mDepart = ctx.avantDepart ? ctx.plan.D : ctx.m;
  const v = ctx.plan.v;
  const h = [bandeaux(ctx)];
  h.push(`<header class="tete"><a class="retour" href="#/trace">${icone("gauche")}Tracé</a><p class="tete-info">${infoPosition(ctx, false)}</p></header>`);
  h.push(`<h1 class="titre-vue">Rentrer en train</h1>`);
  const g = gareAffichee(ctx, etat);
  if (!g) {
    h.push(`<p class="message">Aucune gare enregistrée.</p>`);
    return h.join("");
  }
  const Ag = mDepart + (g.distanceKm * 60) / v;
  const sens = g.sens === "devant" ? "devant" : "derrière";
  const legendeDist = g.gare.detour_km < 3 ? `${sens}, sur le tracé` : `${sens}, dont ${Math.round(g.gare.detour_km)}${NBSP}km de détour`;
  const retourProche = g.choisie ? `<button class="discret lien-alt" type="button" data-action="gare-proche">${icone("gauche")}Gare la plus proche</button>` : "";
  h.push(`${retourProche}<section class="gare"><span class="legende">${g.choisie ? "Gare pour arriver plus tôt aux Sables" : "Gare la plus proche"}</span><p class="gare-nom" id="gare-nom">${esc(g.gare.nom)}</p>`
    + `<div class="duo"><div><span class="chiffre"><span id="gare-distance">${formatNombreKm(g.distanceKm)}</span><small>${NBSP}km</small></span><span class="legende">${legendeDist}</span></div>`
    + `<div><span class="chiffre" id="gare-arrivee">${formatHeure(Ag)}</span><span class="legende">arrivée à la gare</span></div></div></section>`);

  const pret = etat.gpxBrouter && etat.gpxBrouter.gareId === (g.gare.id || g.gare.nom);
  const legendeGpx = pret ? `Itinéraire vélo calculé à ${formatHeure(etat.gpxBrouter.m)}` : "Suit le tracé puis la route vers la gare";
  h.push(`<div class="pile"><button class="bouton-2" type="button" id="bouton-gpx-gare" data-action="gpx-gare">${icone("partage")}GPX vers la gare</button><span class="legende">${legendeGpx}</span></div>`);

  const dest = gares.destination?.nom || "Les Sables-d'Olonne";
  const res = prochainsTrains(g.gare, Ag, gares.marge_min ?? 15, 3);
  const trains = res.trains.map((t) => ligne({
    colKm: `<span class="train-dep">${heureTexte(t.dep)}</span>`,
    nom: `arrivée ${heureTexte(t.arr)}`,
    metas: [correspondances(t), libelleVia(t)].filter(Boolean).map(esc),
    extra: reservationVelo(t) ? signal("Réservation vélo") : "",
    droite: `<b>${formatDuree(t.duree_min ?? hhmmVersMinutes(t.arr) - hhmmVersMinutes(t.dep))}</b>`, droiteSous: "trajet",
  })).join("");
  const version = /^\d{4}-(\d{2})-(\d{2})$/.exec(gares.gtfs?.version || "");
  const meta = `<p class="note">Horaires théoriques SNCF${version ? ` du ${version[2]}/${version[1]}` : ""}. Vélo non démonté accepté dans les TER, dans la limite des places. Réservation vélo obligatoire dans les TGV et Intercités.</p>`
    + `<p class="lien-bas"><a class="discret" href="${esc(gares.sncf_connect || "https://www.sncf-connect.com/")}" target="_blank" rel="noopener">Vérifier sur SNCF Connect${icone("droite")}</a></p>`;
  let sectionTrains = `<section class="bloc">${titreSection(`Trains avec vélo vers ${esc(dest)}`)}<ol id="trains">${trains}</ol>`;
  if (!g.choisie) {
    const alt = alternativePlusTot(gares, { km, m: mDepart, vitesse: v, margeMin: gares.marge_min ?? 15, horsTraceKm: ctx.horsTraceKm || 0 });
    if (alt) {
      const sensAlt = alt.sens === "devant" ? "devant" : "derrière";
      sectionTrains += `<p class="alternative"><button class="discret lien-alt" type="button" id="gare-alternative" data-action="gare-alternative" data-gare="${esc(alt.gare.id || alt.gare.nom)}">`
        + `Arrivée plus tôt aux Sables${NBSP}: via ${esc(alt.gare.nom)}, ${formatNombreKm(alt.distanceKm)}${NBSP}km ${sensAlt}, arrivée ${formatHeure(alt.arriveeSables)}${icone("droite")}</button></p>`;
    }
  }
  const plusDeTrain = !res.trains.length;
  if (plusDeTrain) {
    const dernier = (g.gare.trajets || []).length
      ? `Dernier départ compatible à ${heureTexte(res.dernier.dep)}, avant votre arrivée à la gare.`
      : "Aucun TER compatible depuis cette gare aujourd'hui.";
    const demain = res.premierDemain ? `<span class="legende">Premier départ demain${NBSP}: ${heureTexte(res.premierDemain.dep)}.</span>` : "";
    const arrivee = heurePlan(ctx.plan, ctx.L) + (ctx.modePlan ? 0 : ctx.eHeures);
    sectionTrains += `<div class="vide" id="plus-de-train"><b>Plus de train aujourd'hui</b><span class="legende">${dernier}</span>${demain}</div>`
      + `<div class="pos pos-train"><div class="duo"><div><span class="chiffre">${formatNombreKm(ctx.L - km)}<small>${NBSP}km</small></span><span class="legende">jusqu'à Talmont par le tracé</span></div>`
      + `<div><span class="chiffre">${formatHeure(arrivee)}</span><span class="legende">arrivée estimée</span></div></div></div>`;
  }
  sectionTrains += meta + `</section>`;
  h.push(sectionTrains);

  if (!plusDeTrain) {
    const st = gares.sables_talmont || { km: 12.8 };
    h.push(`<section class="bloc espace-haut"><div class="pos pos-train"><span class="legende">Des ${esc(dest.replace(/^Les /, ""))} à ${esc(course.arrivee.nom)}</span>`
      + `<span class="chiffre">${formatNombreKm(st.km)}<small>${NBSP}km</small></span></div>`
      + `<div class="pile"><button class="bouton-2" type="button" id="bouton-gpx-talmont" data-action="gpx-talmont">${icone("partage")}GPX Sables → Talmont</button></div></section>`);
  }

  const autres = (gares.gares || [])
    .filter((x) => x !== g.gare)
    .sort((a, b) => a.km_embranchement - b.km_embranchement)
    .map((x) => {
      const d = distanceGare(x, km, ctx.horsTraceKm || 0);
      const s = d.sens === "devant" ? "devant" : "derrière";
      const meta = `${formatKm(d.surTraceKm)}${NBSP}km ${s}, ${x.detour_km < 3 ? "sur le tracé" : `détour ${Math.round(x.detour_km)}${NBSP}km`}`;
      return ligne({ colKm: String(Math.round(x.km_embranchement)), nom: esc(x.nom), metas: [meta], droite: `<b>${formatHeure(mDepart + (d.distanceKm * 60) / v)}</b>`, droiteSous: "arrivée" });
    }).join("");
  if (autres) h.push(`<section class="bloc">${titreSection("Autres gares de secours")}<ol id="autres-gares">${autres}</ol></section>`);
  h.push(`<div class="fin-defile"></div>`);
  return h.join("");
}
