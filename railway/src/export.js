// =================== Data export for the Unity port (debug only: window.__rt.exportData()) ===================
// Every file is shaped for UnityEngine.JsonUtility: a root object holding arrays, no dictionaries, no top-level arrays.
// Unity side: unity/Assets/Scripts/Data/RailTrackData.cs (+ RailTrackDataLoader). Writer: railway/tools/export_unity.js
function rtExport() {
  const pick = (o, ks) => { const r = {}; ks.forEach(k => { if (o[k] !== undefined) r[k] = o[k]; }); return r; };
  const stations = Object.values(STN_DEFS).map(d => Object.assign(pick(d, ['id', 'name', 'en', 'kind', 'km', 'line', 'style', 'P0', 'P1', 'bz', 'bw', 'bd', 'eastLabel', 'extras', 'real']), {
    tracks: d.tracks.map(t => ({ n: t.n, z: t.z, cls: t.cls, siding: !!t.siding, thru: !!t.thru, platform: hasPlat(d, t) })),
    platforms: d.platforms.map(p => ({ z: p.z, w: p.w })),
    locals: { from: d.locals.from, prefix: d.locals.prefix, no: d.locals.no, gapMin: d.locals.gap[0], gapMax: d.locals.gap[1] },
    endWest: (STN_END[d.id] || ['', ''])[0], endEast: (STN_END[d.id] || ['', ''])[1], eastOf: STN_EAST[d.id] || [],
  }));
  const hlp = { id: 'HLP', name: HLP_REAL.name, en: HLP_REAL.en, line: HLP_REAL.line, tracks: 14, real: HLP_REAL.real,
    longHaul: HLP_LH.map(([no, from]) => ({ no, from })), pushPull: HLP_PP.map(([no, from]) => ({ no, from })),
    platformClass: Array.from({ length: 14 }, (_, i) => platClass(i + 1)) };
  const timetable = {
    places: Object.keys(TT_PLACES).map(code => ({ code, name: TT_PLACES[code] })),
    trains: TT.map(t => pick(t, ['no', 'cls', 'line', 'from', 'to', 'dep', 'arr', 'note'])),
    classes: Object.keys(STN_CLS).map(cls => ({ cls, rev: STN_CLS[cls].rev, kind: STN_CLS[cls].kind, vehMin: STN_CLS[cls].veh[0], vehMax: STN_CLS[cls].veh[1], car: STN_CLS[cls].car })),
  };
  const rolling = {
    models: Object.keys(RS).map(id => ({ id, name: RS[id].name, kind: RS[id].kind, len: RS[id].len, ac: !!RS[id].ac, maker: RS[id].maker || '', livery: Object.assign({ body: '', low: '', line: '', roof: '' }, RS[id].liv) })),
    aliases: Object.keys(RS_ALIAS).map(k => ({ key: k, model: RS_ALIAS[k] })),
    info: RS_INFO.map(r => ({ id: r.id, consist: r.consist, tier: r.tier || '', role: r.role, note: r.note })),
  };
  const progression = {
    xpNeed: Array.from({ length: 40 }, (_, i) => xpNeed(i + 1)),
    rewards: REWARDS.map(r => ({ lv: r.lv, kind: r.k, value: String(r.v) })),
    controllers: CTRLS.map(c => pick(c, ['k', 'name', 'en', 'where', 'desc'])),
    hubs: HUBS.map(h => pick(h, ['id', 'mode', 'code', 'name', 'sub'])),
    tiers: TIER_LIST.map(k => pick(TIERS[k], ['id', 'tier', 'name', 'full', 'desc', 'unlock', 'price'])),
  };
  const difficulty = {
    rush: DIFF.rush.map(([from, to, factor]) => ({ from, to, factor })),
    delay: DIFF.delay, fault: DIFF.fault, rain: DIFF.rain,
    ars: { reactArrMin: DIFF.ars.reactArr[0], reactArrMax: DIFF.ars.reactArr[1], lagDepMin: DIFF.ars.lagDep[0], lagDepMax: DIFF.ars.lagDep[1], pickWrong: DIFF.ars.pickWrong },
    stationRate: STN_RATE, hlpRate: TRATE, worldNetRate: WORLD_NET_RATE,
  };
  const network = {
    unitKm: UNIT_KM, lon0: GEO_LON0, lat0: GEO_LAT0,
    stations: STATIONS.map(d => Object.assign(pick(d, ['id', 'name', 'type', 'pax', 'cargo', 'cost', 'plat']), { x: d.x, z: d.z, railNode: GEO.snap[d.id] != null ? GEO.snap[d.id] : -1 })),
    railNodes: GEO.rn.map(([x, z]) => ({ x, z })), railEdges: GEO.re.map(([a, b]) => ({ a, b })),
    snaps: Object.keys(GEO.snap).map(code => ({ code, node: GEO.snap[code] })),
    thailand: GEO.th.map(ring => ({ pts: ring.map(([x, z]) => ({ x, z })) })),
    neighbours: Object.keys(GEO.nb).map(name => ({ name, rings: GEO.nb[name].map(ring => ({ pts: ring.map(([x, z]) => ({ x, z })) })) })),
  };
  return { 'stations.json': { stations, hualamphong: hlp }, 'timetable.json': timetable, 'rolling_stock.json': rolling, 'progression.json': progression, 'difficulty.json': difficulty, 'network.json': network };
}
