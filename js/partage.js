// Partage d'un fichier GPX (SPEC § 7.13) : menu de partage iOS, sinon téléchargement.
// À appeler directement dans le gestionnaire de clic (iOS refuse navigator.share hors du geste).

export function telecharger(texte, nom) {
  const blob = new Blob([texte], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 10000);
}

export function partagerFichier(texte, nom) {
  let fichier = null;
  try {
    fichier = new File([texte], nom, { type: "application/gpx+xml" });
  } catch (e) {
    fichier = null;
  }
  if (fichier && navigator.canShare && navigator.share) {
    let possible = false;
    try { possible = navigator.canShare({ files: [fichier] }); } catch (e) { possible = false; }
    if (possible) {
      return navigator.share({ files: [fichier], title: nom }).then(
        () => "partage",
        (err) => {
          if (err && err.name === "AbortError") return "annule";
          telecharger(texte, nom);
          return "telechargement";
        },
      );
    }
  }
  telecharger(texte, nom);
  return Promise.resolve("telechargement");
}
