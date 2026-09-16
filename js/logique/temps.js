// Temps de course (SPEC § 7) : minutes depuis le 18/09/2026 00:00, heure de Paris.
// Module pur : l'heure est toujours passée en paramètre.

export const ORIGINE_MS = Date.UTC(2026, 8, 17, 22, 0);

export function minutesCourse(dateMs) {
  return (dateMs - ORIGINE_MS) / 60000;
}

export function msDepuisMinutes(m) {
  return ORIGINE_MS + m * 60000;
}

function deux(n) {
  return n < 10 ? "0" + n : String(n);
}

// 566 → "9h26" ; 1293.01 → "21h33". Arrondi à la minute avant le découpage.
export function formatHeure(m) {
  const r = Math.round(m);
  const j = ((r % 1440) + 1440) % 1440;
  return Math.floor(j / 60) + "h" + deux(j % 60);
}

// Durée en minutes → "3h15" (ou "45 min" sous une heure).
export function formatDuree(min) {
  const r = Math.max(0, Math.round(min));
  if (r < 60) return r + " min";
  return Math.floor(r / 60) + "h" + deux(r % 60);
}

// "HH:MM" (y compris "24:00" et "25:30") → minutes.
export function hhmmVersMinutes(s) {
  if (typeof s !== "string") return NaN;
  const x = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!x) return NaN;
  return Number(x[1]) * 60 + Number(x[2]);
}

// Décalage de Paris (minutes) pour une date "AAAA-MM-JJ" : heure d'été du dernier dimanche de mars
// au dernier dimanche d'octobre (approximation à la journée, suffisante pour le soleil).
export function decalageParisMin(dateISO) {
  const [y, mo, d] = dateISO.split("-").map(Number);
  const dernierDimanche = (mois) => {
    const fin = new Date(Date.UTC(y, mois, 0));
    return fin.getUTCDate() - fin.getUTCDay();
  };
  const t = Date.UTC(y, mo - 1, d);
  const debut = Date.UTC(y, 2, dernierDimanche(3));
  const fin = Date.UTC(y, 9, dernierDimanche(10));
  return t >= debut && t < fin ? 120 : 60;
}

// Date et heure de Paris au format ISO local (date, T, heure:minute ; ex. sim_now) → ms.
export function parisVersMs(texte) {
  const x = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(texte).trim());
  if (!x) return NaN;
  const dateISO = `${x[1]}-${x[2]}-${x[3]}`;
  const utc = Date.UTC(Number(x[1]), Number(x[2]) - 1, Number(x[3]), Number(x[4]), Number(x[5]), Number(x[6] || 0));
  return utc - decalageParisMin(dateISO) * 60000;
}

// Jour de Paris pour des minutes course : { dateISO, minutesDuJour, decalageJours }.
export function jourParis(m) {
  const j = Math.floor(m / 1440);
  const d = new Date(Date.UTC(2026, 8, 18 + j));
  const dateISO = d.toISOString().slice(0, 10);
  return { dateISO, minutesDuJour: m - j * 1440, decalageJours: j };
}
