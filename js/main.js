// Démarrage, routeur par hash, état, minuterie 60 s (SPEC § 4).
import { lireSim } from "./sim.js";
import { creerStockage } from "./stockage.js";
import { demanderPosition, positionSimulee } from "./position.js";
import { creerReseau } from "./reseau.js";
import { partagerFichier } from "./partage.js";
import { minutesCourse } from "./logique/temps.js";
import { creerPlan } from "./logique/plan.js";
import { gpxVersGare, nomFichierGare, nomGpxGare, reecrireGpx } from "./logique/gpx.js";
import { calculerContexte } from "./contexte.js";
import { vueTrace } from "./vues/trace.js";
import { vuePause, vueCommerce } from "./vues/pause.js";
import { vueRecherche } from "./vues/recherche.js";
import { vueGares, gareAffichee, kmGares } from "./vues/gares.js";
import { ecranDonneesManquantes, vueCredits } from "./vues/etats.js";

const TOUS_TYPES = ["boulangerie", "supermarche", "eau", "station"];
const VINGT_MIN = 20 * 60000;

const sim = lireSim(location.search);
const t0 = Date.now();
// En simulation, l'horloge avance par minutes entières à partir de sim_now (rendu toutes les 60 s) :
// les quelques secondes de chargement ne décalent pas les arrondis des heures affichées.
const maintenant = () => (sim.now != null ? sim.now + Math.floor((Date.now() - t0) / 60000) * 60000 : Date.now());
const stockage = creerStockage(sim.actif);
const reseau = creerReseau(sim);

const etat = {
  sim, stockage,
  donnees: null, plan: null, pausesParN: new Map(),
  position: { derniere: null, statut: "attente", erreur: null, enCours: false },
  meteo: null, meteoEchec: false, meteoEnCours: false,
  filtres: TOUS_TYPES.slice(),
  gpxBrouter: null, brouterEnCours: false,
  gpxTalmont: null,
  alerteAffichee: null,
  cacheProjection: null,
  dernierCtx: null,
  derniereRoute: null,
  derniereActualisation: null,
};

const contenu = document.getElementById("contenu");

// ---------- Service worker ----------
function enregistrerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const avaitControleur = !!navigator.serviceWorker.controller;
  let recharge = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!avaitControleur || recharge) return;
    recharge = true;
    location.reload();
  });
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// ---------- Routeur ----------
function lireRoute() {
  const brut = decodeURI(location.hash || "").replace(/^#\/?/, "");
  const [chemin, qs] = brut.split("?");
  const parties = (chemin || "").split("/").filter(Boolean);
  const params = new URLSearchParams(qs || "");
  switch (parties[0]) {
    case "pause": return { vue: "pause", n: Number(parties[1]) };
    case "commerce": return { vue: "commerce", id: decodeURIComponent(parties.slice(1).join("/")), depuis: params.get("depuis") };
    case "recherche": return { vue: "recherche" };
    case "gares": return { vue: "gares" };
    case "credits": return { vue: "credits" };
    default: return { vue: "trace" };
  }
}

// ---------- Rendu ----------
function rendre() {
  if (!etat.donnees) return;
  const now = maintenant();
  const ctx = calculerContexte(etat, now);
  etat.dernierCtx = ctx;
  document.documentElement.dataset.theme = ctx.theme;
  const route = lireRoute();
  document.body.dataset.vue = route.vue;
  let html;
  switch (route.vue) {
    case "pause": html = vuePause(ctx, etat, route.n); break;
    case "commerce": html = vueCommerce(ctx, etat, route.id, route.depuis); break;
    case "recherche": html = vueRecherche(ctx, etat); break;
    case "gares": html = vueGares(ctx, etat); break;
    case "credits": html = vueCredits(ctx, etat); break;
    default: html = vueTrace(ctx, etat);
  }
  contenu.innerHTML = html;
  const ongletActif = route.vue === "trace" || route.vue === "pause" ? "trace"
    : route.vue === "recherche" || (route.vue === "commerce" && route.depuis === "recherche") ? "recherche"
    : route.vue === "commerce" ? "trace" : null;
  for (const nom of ["trace", "recherche"]) {
    const a = document.getElementById("onglet-" + nom);
    if (nom === ongletActif) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
  majBoutonActualiser();
  document.body.dataset.pret = "1";
}

function majBoutonActualiser() {
  const b = document.getElementById("actualiser");
  const l = document.getElementById("actualiser-libelle");
  if (etat.position.enCours) {
    b.setAttribute("aria-busy", "true");
    l.textContent = "Localisation…";
  } else {
    b.removeAttribute("aria-busy");
    l.textContent = "Actualiser";
  }
}

// ---------- Données ----------
async function chargerJson(nom) {
  const rep = await fetch(sim.donnees + nom);
  if (!rep.ok) throw new Error(nom + " : HTTP " + rep.status);
  return rep.json();
}

async function chargerDonnees() {
  const [course, trace, pauses, poi, gares] = await Promise.all(
    ["course.json", "trace.json", "pauses.json", "poi.json", "gares.json"].map(chargerJson),
  );
  if (!course || !trace?.points?.length || !Array.isArray(pauses?.pauses)) throw new Error("données incomplètes");
  pauses.pauses.sort((a, b) => a.km - b.km);
  etat.donnees = { course, trace, pauses, poi: poi || { poi: [] }, gares: gares || { gares: [] } };
  etat.plan = creerPlan(course, pauses.pauses);
  for (const p of pauses.pauses) etat.pausesParN.set(p.n, p);
}

// ---------- GPS ----------
async function actualiserPosition() {
  if (sim.actif) {
    const r = positionSimulee(sim, etat.donnees.trace.points, maintenant());
    if (!r) return;
    appliquerPosition(r);
    return;
  }
  etat.position.enCours = true;
  majBoutonActualiser();
  const r = await demanderPosition();
  etat.position.enCours = false;
  appliquerPosition(r);
}

function appliquerPosition(r) {
  if (r.ok) {
    etat.position = { ...etat.position, derniere: r.pos, statut: "ok", erreur: null };
    stockage.ecrire("us.position", r.pos);
  } else {
    etat.position = { ...etat.position, statut: "echec", erreur: r.erreur };
  }
}

// ---------- Météo (P1) ----------
async function actualiserMeteo(force) {
  if (sim.meteo) return;
  if (etat.meteoEnCours) return;
  if (!force && etat.meteo && maintenant() - etat.meteo.recupere_le < VINGT_MIN) return;
  etat.meteoEnCours = true;
  try {
    const reponse = await reseau.meteo(etat.donnees.course);
    etat.meteo = { recupere_le: sim.now != null ? maintenant() : Date.now(), reponse };
    etat.meteoEchec = false;
    stockage.ecrire("us.meteo", etat.meteo);
  } catch (e) {
    etat.meteoEchec = true;
  } finally {
    etat.meteoEnCours = false;
  }
}

async function chargerMeteoSimulee() {
  try {
    const rep = await fetch(sim.meteo);
    if (!rep.ok) throw new Error("HTTP " + rep.status);
    const json = await rep.json();
    etat.meteo = { recupere_le: maintenant(), reponse: Array.isArray(json) ? json : [json] };
  } catch (e) {
    etat.meteo = null;
  }
}

// ---------- BRouter (P1) : GPX en ligne préparé à l'ouverture de la vue Gares ----------
async function preparerBrouter() {
  const ctx = etat.dernierCtx;
  if (!ctx || ctx.modePlan || !ctx.pos || etat.brouterEnCours) return;
  const g = gareAffichee(ctx, etat);
  if (!g) return;
  etat.brouterEnCours = true;
  try {
    const brut = await reseau.brouter(ctx.pos.lat, ctx.pos.lon, g.gare.lat, g.gare.lon);
    const texte = reecrireGpx(brut, nomGpxGare(g.gare));
    if (texte) {
      etat.gpxBrouter = { gareId: g.gare.id || g.gare.nom, texte, m: minutesCourse(maintenant()) };
      if (lireRoute().vue === "gares") rendre();
    }
  } catch (e) {
    // silencieux : le GPX hors ligne reste disponible
  } finally {
    etat.brouterEnCours = false;
  }
}

async function preparerGpxTalmont() {
  if (etat.gpxTalmont) return;
  const chemin = etat.donnees.gares?.sables_talmont?.gpx || "gpx/sables-talmont.gpx";
  try {
    const rep = await fetch(chemin);
    if (rep.ok) etat.gpxTalmont = await rep.text();
  } catch (e) {
    // indisponible
  }
}

// ---------- Actions ----------
function partagerGpxGare() {
  const ctx = etat.dernierCtx;
  if (!ctx) return;
  const g = gareAffichee(ctx, etat);
  if (!g) return;
  const pret = etat.gpxBrouter && etat.gpxBrouter.gareId === (g.gare.id || g.gare.nom);
  const texte = pret ? etat.gpxBrouter.texte : gpxVersGare(etat.donnees.trace.points, g.gare, kmGares(ctx));
  partagerFichier(texte, nomFichierGare(g.gare));
}

function partagerGpxTalmont() {
  if (etat.gpxTalmont) {
    partagerFichier(etat.gpxTalmont, "sables-talmont.gpx");
    return;
  }
  preparerGpxTalmont().then(() => {
    if (etat.gpxTalmont) partagerFichier(etat.gpxTalmont, "sables-talmont.gpx");
  });
}

function basculerFiltre(type) {
  const s = new Set(etat.filtres);
  if (s.has(type)) s.delete(type); else s.add(type);
  etat.filtres = TOUS_TYPES.filter((t) => s.has(t));
  stockage.ecrire("us.filtres", etat.filtres);
  rendre();
}

async function actualiser() {
  if (etat.position.enCours || !etat.donnees) return;
  etat.derniereActualisation = maintenant();
  const surGares = lireRoute().vue === "gares";
  const promesseGps = actualiserPosition();
  const promesseMeteo = actualiserMeteo(false);
  await promesseGps;
  rendre();
  await promesseMeteo;
  rendre();
  if (surGares) preparerBrouter();
}

document.addEventListener("click", (ev) => {
  const cible = ev.target.closest("[data-action], #actualiser");
  if (!cible) return;
  if (cible.id === "actualiser") { actualiser(); return; }
  switch (cible.dataset.action) {
    case "filtre": basculerFiltre(cible.dataset.type); break;
    case "gpx-gare": partagerGpxGare(); break;
    case "gpx-talmont": partagerGpxTalmont(); break;
    case "gare-alternative": etat.gareChoisie = cible.dataset.gare; etat.gpxBrouter = null; rendre(); contenu.scrollTop = 0; preparerBrouter(); break;
    case "gare-proche": etat.gareChoisie = null; etat.gpxBrouter = null; rendre(); contenu.scrollTop = 0; preparerBrouter(); break;
    default: break;
  }
});

window.addEventListener("hashchange", () => {
  const route = lireRoute();
  if (route.vue !== "gares") etat.gareChoisie = null;
  rendre();
  contenu.scrollTop = 0;
  if (route.vue === "gares" && etat.derniereRoute !== "gares") {
    preparerBrouter();
    preparerGpxTalmont();
  }
  etat.derniereRoute = route.vue;
});

// Retour au premier plan (app rouverte depuis l'écran d'accueil) : iOS ne recharge pas la page,
// donc on redemande la position une fois, comme à l'ouverture. Jamais de suivi continu.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || sim.actif) return;
  if (maintenant() - (etat.derniereActualisation ?? 0) < 60000) return;
  actualiser();
});

window.addEventListener("online", () => rendre());
window.addEventListener("offline", () => rendre());

// ---------- Démarrage ----------
async function demarrer() {
  enregistrerServiceWorker();
  etat.derniereActualisation = maintenant();
  try {
    await chargerDonnees();
  } catch (e) {
    contenu.innerHTML = ecranDonneesManquantes();
    document.body.dataset.pret = "1";
    return;
  }
  const filtres = sim.filtres ?? stockage.lire("us.filtres");
  if (Array.isArray(filtres)) etat.filtres = TOUS_TYPES.filter((t) => filtres.includes(t));

  if (sim.actif) {
    if (sim.pause) {
      const vues = stockage.lire("us.pause_vue") || {};
      vues[String(sim.pause.n)] = sim.pause.t;
      stockage.ecrire("us.pause_vue", vues);
    }
    await actualiserPosition();
    if (sim.meteo) await chargerMeteoSimulee();
    if (sim.reseau === "hors") await actualiserMeteo(true);
    else if (!sim.meteo) actualiserMeteo(true).then(rendre);
    etat.derniereRoute = lireRoute().vue;
    rendre();
    if (etat.derniereRoute === "gares") { preparerBrouter(); preparerGpxTalmont(); }
  } else {
    const pos = stockage.lire("us.position");
    if (pos && typeof pos.lat === "number" && typeof pos.t === "number") etat.position.derniere = pos;
    const meteo = stockage.lire("us.meteo");
    if (meteo && meteo.reponse && typeof meteo.recupere_le === "number") etat.meteo = meteo;
    etat.derniereRoute = lireRoute().vue;
    rendre();
    const promesseMeteo = actualiserMeteo(false).then(rendre);
    await actualiserPosition();
    rendre();
    await promesseMeteo;
    if (etat.derniereRoute === "gares") { preparerBrouter(); preparerGpxTalmont(); }
  }
  setInterval(rendre, 60000);
}

demarrer();
