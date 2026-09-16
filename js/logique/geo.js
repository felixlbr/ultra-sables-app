// Géométrie : distances, caps, interpolation et projection sur le tracé (SPEC § 7.1, § 7.2).
// Module pur : ni DOM, ni réseau, ni stockage.

const R = 6371008.8;
const RAD = Math.PI / 180;

export function haversineM(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * RAD, p2 = lat2 * RAD;
  const dp = (lat2 - lat1) * RAD, dl = (lon2 - lon1) * RAD;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Azimut initial du grand cercle, en degrés [0, 360).
export function capDeg(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * RAD, p2 = lat2 * RAD, dl = (lon2 - lon1) * RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  const c = Math.atan2(y, x) / RAD;
  return ((c % 360) + 360) % 360;
}

// Point situé à distM mètres dans la direction capD (utile pour la simulation).
export function destination(lat, lon, capD, distM) {
  const d = distM / R, b = capD * RAD, p1 = lat * RAD, l1 = lon * RAD;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { lat: p2 / RAD, lon: l2 / RAD };
}

// Indice i tel que points[i][2] <= km <= points[i+1][2] (borné).
function indiceSegment(points, km) {
  let lo = 0, hi = points.length - 1;
  if (km <= points[0][2]) return 0;
  if (km >= points[hi][2]) return Math.max(0, hi - 1);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][2] <= km) lo = mid; else hi = mid;
  }
  return lo;
}

// Interpolation linéaire entre les deux points encadrants. Borné aux extrémités.
export function pointAuKm(points, km) {
  const n = points.length;
  if (n === 0) return null;
  if (n === 1 || km <= points[0][2]) {
    const p = points[0];
    return { lat: p[0], lon: p[1], km: p[2], ele: p[3] ?? null };
  }
  if (km >= points[n - 1][2]) {
    const p = points[n - 1];
    return { lat: p[0], lon: p[1], km: p[2], ele: p[3] ?? null };
  }
  const i = indiceSegment(points, km);
  const a = points[i], b = points[i + 1];
  const t = b[2] === a[2] ? 0 : (km - a[2]) / (b[2] - a[2]);
  const ele = a[3] == null || b[3] == null ? (a[3] ?? b[3] ?? null) : a[3] + t * (b[3] - a[3]);
  return { lat: a[0] + t * (b[0] - a[0]), lon: a[1] + t * (b[1] - a[1]), km, ele };
}

// Cap du tracé au km k : du point au km k vers le point au km min(k + 1, L) ; si k > L − 1 : de L − 1 à L.
export function capAuKm(points, km) {
  const debut = points[0][2];
  const L = points[points.length - 1][2];
  let k = Math.max(debut, Math.min(km, L));
  let k1 = Math.min(k + 1, L);
  if (k > L - 1) { k = Math.max(debut, L - 1); k1 = L; }
  const a = pointAuKm(points, k), b = pointAuKm(points, k1);
  return capDeg(a.lat, a.lon, b.lat, b.lon);
}

// Projection de la position sur le tracé (§ 7.2).
// Sortie : { km, distM, segment, t, zoneDepart }. En zone floutée, km = max(0, km_debut − 1,25 × d / 1000).
export function projeter(points, lat, lon, kmRef) {
  const r = kmRef == null || Number.isNaN(kmRef) ? null : kmRef;
  const cos0 = Math.cos(lat * RAD);
  const fx = 111320 * cos0, fy = 110574;
  const n = points.length;
  const segs = [];
  let dmin = Infinity;
  if (n === 1) {
    const x = (points[0][1] - lon) * fx, y = (points[0][0] - lat) * fy;
    const d = Math.hypot(x, y);
    segs.push({ d, km: points[0][2], segment: 0, t: 0 });
    dmin = d;
  }
  let ax = (points[0][1] - lon) * fx, ay = (points[0][0] - lat) * fy;
  for (let i = 0; i < n - 1; i++) {
    const b = points[i + 1];
    const bx = (b[1] - lon) * fx, by = (b[0] - lat) * fy;
    const vx = bx - ax, vy = by - ay;
    const l2 = vx * vx + vy * vy;
    let t = l2 === 0 ? 0 : ((-ax) * vx + (-ay) * vy) / l2;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const px = ax + t * vx, py = ay + t * vy;
    const d = Math.hypot(px, py);
    const kmA = points[i][2];
    segs.push({ d, km: kmA + t * (b[2] - kmA), segment: i, t });
    if (d < dmin) dmin = d;
    ax = bx; ay = by;
  }
  // Candidats : d ≤ dmin + 200 m. Les segments candidats contigus forment un même passage du tracé :
  // on n'en garde que le plus proche, sinon les segments voisins (à quelques dizaines de mètres)
  // décaleraient le km vers la référence alors qu'il n'y a qu'un seul passage.
  const passages = [];
  let courant = null;
  for (const s of segs) {
    if (s.d > dmin + 200) { courant = null; continue; }
    if (courant === null) { courant = s; passages.push(s); continue; }
    if (s.d < courant.d) { passages[passages.length - 1] = s; courant = s; }
  }
  let choix = null;
  for (const s of passages) {
    if (choix === null) { choix = s; continue; }
    if (r === null) {
      if (s.d < choix.d) choix = s;
    } else {
      const ds = Math.abs(s.km - r), dc = Math.abs(choix.km - r);
      if (ds < dc || (ds === dc && s.d < choix.d)) choix = s;
    }
  }
  const zoneDepart = choix.segment === 0 && choix.t === 0 && choix.d > 100 && choix.d <= 12000 && (r === null || r < 20);
  const km = zoneDepart ? Math.max(0, points[0][2] - 1.25 * choix.d / 1000) : choix.km;
  return { km, distM: choix.d, segment: choix.segment, t: choix.t, zoneDepart };
}
