// =================== Real Thailand geography: Natural Earth 1:10m borders and railways, projected (1 unit = UNIT_KM km) ===================
const GEO_LON0 = 100.5170, GEO_LAT0 = 13.7392, GEO_KX = 111.32 * Math.cos(13.5 * Math.PI / 180), GEO_KZ = 110.57, GEO_UNIT = 6;
const geoP = (lon, lat) => ({ x: (lon - GEO_LON0) * GEO_KX / GEO_UNIT, z: -(lat - GEO_LAT0) * GEO_KZ / GEO_UNIT });
const RAILG = (() => {
  const N = GEO.rn, adj = N.map(() => []);
  for (const [a, b] of GEO.re) { const d = Math.hypot(N[a][0] - N[b][0], N[a][1] - N[b][1]); adj[a].push([b, d]); adj[b].push([a, d]); }
  return { N, adj };
})();
const RAIL_CACHE = {};
/** Shortest path along the real rail network between two stations, as a polyline in map units. */
function railPath(a, b) {
  const k = a + '|' + b; if (RAIL_CACHE[k] !== undefined) return RAIL_CACHE[k];
  const s = GEO.snap[a], t = GEO.snap[b]; if (s == null || t == null) return (RAIL_CACHE[k] = null);
  const { N, adj } = RAILG, n = N.length, D = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  D[s] = 0;
  for (;;) {
    let u = -1, best = Infinity; for (let i = 0; i < n; i++) if (!done[i] && D[i] < best) { best = D[i]; u = i; }
    if (u < 0 || u === t) break; done[u] = 1;
    for (const [v, w] of adj[u]) if (D[u] + w < D[v]) { D[v] = D[u] + w; prev[v] = u; }
  }
  if (!isFinite(D[t])) return (RAIL_CACHE[k] = null);
  const ids = []; for (let u = t; u >= 0; u = prev[u]) ids.push(u); ids.reverse();
  const raw = [{ x: GEO.st[a][0], z: GEO.st[a][1] }].concat(ids.map(i => ({ x: N[i][0], z: N[i][1] })), [{ x: GEO.st[b][0], z: GEO.st[b][1] }]);
  const pts = [raw[0]]; for (const p of raw.slice(1)) { const q = pts[pts.length - 1]; if (Math.hypot(p.x - q.x, p.z - q.z) > 0.05) pts.push(p); }
  return (RAIL_CACHE[k] = pts);
}
const GEO_PATHS = (() => {
  const poly = rings => { const p = new Path2D(); rings.forEach(r => r.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])))); return p; };
  const rail = new Path2D(); GEO.re.forEach(([a, b]) => { rail.moveTo(GEO.rn[a][0], GEO.rn[a][1]); rail.lineTo(GEO.rn[b][0], GEO.rn[b][1]); });
  return { th: poly(GEO.th), nb: Object.values(GEO.nb).map(poly), rail };
})();
const GEO_LABELS = [
  ['อ่าวไทย', 101.4, 10.6, 'sea'], ['ทะเลอันดามัน', 97.4, 9.0, 'sea'], ['เมียนมา', 97.0, 17.4, 'nb'], ['ลาว', 103.3, 19.2, 'nb'],
  ['กัมพูชา', 104.3, 12.7, 'nb'], ['มาเลเซีย', 101.7, 5.15, 'nb'],
].map(([t, lon, lat, k]) => Object.assign({ t, k }, geoP(lon, lat)));
/** SVG path string of Thailand (for the station picker). */
const geoSvg = rings => rings.map(r => 'M' + r.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L') + 'Z').join('');
