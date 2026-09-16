// Stockage local protégé (SPEC § 4.4). En simulation : mémoire seulement, rien n'est lu ni écrit.

export function creerStockage(simulation) {
  const memoire = new Map();
  if (simulation) {
    return {
      lire: (cle) => (memoire.has(cle) ? structuredCloneSur(memoire.get(cle)) : null),
      ecrire: (cle, valeur) => { memoire.set(cle, structuredCloneSur(valeur)); },
      supprimer: (cle) => { memoire.delete(cle); },
    };
  }
  return {
    lire(cle) {
      try {
        const brut = window.localStorage.getItem(cle);
        return brut == null ? null : JSON.parse(brut);
      } catch (e) {
        return memoire.has(cle) ? memoire.get(cle) : null;
      }
    },
    ecrire(cle, valeur) {
      memoire.set(cle, valeur);
      try {
        window.localStorage.setItem(cle, JSON.stringify(valeur));
      } catch (e) {
        // stockage plein ou interdit : la valeur reste en mémoire
      }
    },
    supprimer(cle) {
      memoire.delete(cle);
      try { window.localStorage.removeItem(cle); } catch (e) { /* rien */ }
    },
  };
}

function structuredCloneSur(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v));
}
