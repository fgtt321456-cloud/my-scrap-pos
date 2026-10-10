
// =================== Co-op: room (presence, ping) + db (leasing, rescue, relay) ===================
const CO = { db: null, room: null, user: null, me: null, connected: false, peers: [], names: {}, fleets: {}, leases: [], rescues: [], relays: [], pend: {}, fleetSig: '', presSig: '', acc: 0, flushAcc: 0, writable: true };
const coopReady = () => !!(CO.db && CO.me && CO.writable);
const coopBadge = () => CO.rescues.filter(r => r.status === 'open' && r.requester !== CO.me && Date.now() - r.createdAt < 30 * 60000).length + CO.relays.filter(r => r.status === 'open').length;
async function coopInit() {
  coopRender();
  if (!window.claude || typeof window.claude.use !== 'function') return;
  try {
    const [db, room, user] = await Promise.all([claude.use('db'), claude.use('room'), claude.use('user')]);
    CO.db = db; CO.room = room; CO.user = user;
    CO.me = user ? await user.id() : null;
    if (user && (await user.can('data.write')) === false) CO.writable = false;
    if (room) {
      room.onPeers(ch => { CO.peers = ch.peers.filter(p => p.kind === 'viewer'); renderPeers(); coopRender(); }, () => {});
      room.onConnection(c => { CO.connected = c; coopRender(); }, () => {});
      room.on('ping', m => { const d = m.data || {}; if (!EMOTES[d.e]) return; const sid = SMAP[d.sid] ? d.sid : null; nameOf(m.by).then(n => showEmote(d.e, sid, m.isMe ? 'คุณ' : n)); }, () => {});
      room.on('rescue', m => { if (m.isMe) return; nameOf(m.by).then(n => toast(`${n} ขอความช่วยเหลือ: รถขัดข้องกลางทาง`)); }, () => {});
      coopPresence();
    }
    if (db && CO.me) {
      db.collection('fleets').onSnapshot(s => { CO.fleets = {}; s.docs.forEach(d => { if (d.id !== CO.me) CO.fleets[d.id] = d.data(); }); coopRender(); }, () => {});
      db.collection('leases').onSnapshot(s => { CO.leases = s.docs.map(d => Object.assign({ id: d.id }, d.data())); coopApplyLeases(); coopRender(); }, () => {});
      db.collection('rescues').onSnapshot(s => { CO.rescues = s.docs.map(d => Object.assign({ id: d.id }, d.data())); coopApplyRescues(); coopRender(); }, () => {});
      db.collection('relays').onSnapshot(s => { CO.relays = s.docs.map(d => Object.assign({ id: d.id }, d.data())); coopApplyRelays(); coopRender(); }, () => {});
      coopPublishFleet();
    }
  } catch (e) { /* co-op stays off; single-player continues */ }
  coopRender();
}
async function nameOf(id) { if (!id || !CO.user) return 'เพื่อน'; try { const p = await CO.user.profiles([id]); return (p[id] && p[id].name) || 'เพื่อน'; } catch (e) { return 'เพื่อน'; } }
async function renderPeers() {
  const el = $('#peers'); if (!CO.room) { el.innerHTML = ''; return; }
  const ids = [...new Set(CO.peers.map(p => p.by).filter(Boolean))];
  let ps = {}; try { if (CO.user && ids.length) ps = await CO.user.profiles(ids); } catch (e) {}
  const seen = new Set(), list = [];
  for (const p of CO.peers) { const k = p.by || p.peer; if (seen.has(k)) continue; seen.add(k); list.push(p); }
  el.innerHTML = '';
  list.slice(0, 5).forEach(p => {
    const pr = p.by && ps[p.by], img = document.createElement('img');
    img.src = pr ? pr.avatarUrl : ''; img.alt = ''; img.className = 'peer' + (p.isMe ? ' me' : '');
    const pres = p.presence || {};
    img.title = `${p.isMe ? 'คุณ' : (pr && pr.name) || 'เพื่อน'}${pres.mode ? ' · ' + (pres.mode === 'term' ? 'หัวลำโพง' : 'เครือข่าย') : ''}${pres.day ? ' · วันที่ ' + pres.day : ''}${pres.rep !== undefined ? ' · ชื่อเสียง ' + pres.rep : ''}`;
    if (!img.src) { const s = document.createElement('span'); s.className = img.className; s.textContent = p.isMe ? 'คุณ' : '?'; s.title = img.title; el.appendChild(s); } else el.appendChild(img);
  });
  if (list.length > 5) { const s = document.createElement('span'); s.className = 'peer more'; s.textContent = '+' + (list.length - 5); el.appendChild(s); }
  CO.names = Object.fromEntries(ids.map(id => [id, (ps[id] && ps[id].name) || 'เพื่อน']));
}
function coopPresence() {
  if (!CO.room) return;
  const p = { v: 1, mode: MODE, day: state.day, rep: Math.round(state.rep), trains: state.trains.length, tier: TIER_LIST.filter(k => state.tiers[k]).length };
  const sig = JSON.stringify(p); if (sig === CO.presSig) return; CO.presSig = sig;
  CO.room.presence(p).catch(() => {});
}
function coopSendPing(kind, sid) {
  if (CO.room && CO.connected) CO.room.emit('ping', { e: kind, sid }).catch(() => showEmote(kind, sid, 'คุณ'));
  else { showEmote(kind, sid, 'คุณ'); if (!CO.room) toast('ยังไม่ได้เชื่อมต่อ Co-op จึงเห็นสัญญาณนี้เฉพาะคุณ'); }
}
// ----- fleet leasing -----
function coopPublishFleet() {
  if (!coopReady()) return;
  const trains = state.trains.filter(t => t.leasable && !t.leased && !t.leasedOut && !t.depot && !t.rescue).map(t => ({ id: t.id, tier: t.tier, kind: t.kind, name: t.name, cars: t.cars }));
  const sig = JSON.stringify(trains); if (sig === CO.fleetSig) return; CO.fleetSig = sig;
  CO.db.doc('fleets/' + CO.me).set({ trains, updatedAt: Date.now() }).catch(e => { if (e && e.code === 'invalid_argument') CO.writable = false; });
}
async function coopLease(ownerId, t) {
  if (!coopReady()) return;
  const lineId = $('#leaseLine') && $('#leaseLine').value, line = lineById(lineId);
  if (!line) { toast('เลือกสายที่จะนำรถเช่าไปวิ่งก่อน'); return; }
  if (state.trains.filter(x => x.leased).length >= 2) { toast('เช่ารถได้พร้อมกันสูงสุด 2 ขบวน'); return; }
  if (CO.leases.some(l => l.status === 'active' && l.owner === ownerId && l.trainId === t.id)) { toast('รถคันนี้ถูกเช่าอยู่แล้ว'); return; }
  if (state.trains.filter(x => x.line === line.id && !offLine(x)).length >= maxTrainsOn(line)) { toast('สายนี้รับขบวนเพิ่มไม่ได้'); return; }
  const until = Date.now() + 15 * 60000;
  try {
    const ref = await CO.db.collection('leases').add({ owner: ownerId, lessee: CO.me, trainId: t.id, tier: t.tier, kind: t.kind, name: t.name, until, share: 0.3, owed: 0, status: 'active', createdAt: Date.now() });
    const tr = buyTrain(line.id, t.tier, t.kind, true, { name: t.name + ' (เช่า)', leased: { leaseId: ref.id, owner: ownerId, until, owed: 0, sent: 0 } });
    if (tr) { tr.cars = t.cars || 2; makeTrain(tr); log(`เช่า ${t.name} จากเพื่อน 15 นาที แบ่งรายได้ 30%`, 'good'); refreshStatic(); }
  } catch (e) { toast('ส่งคำขอเช่าไม่สำเร็จ ลองใหม่อีกครั้ง'); }
}
function coopApplyLeases() {
  if (!CO.me) return;
  for (const l of CO.leases) {
    if (l.owner !== CO.me) continue;
    const tr = state.trains.find(t => t.id === l.trainId), active = l.status === 'active' && Date.now() < l.until;
    if (tr && active && !tr.leasedOut) { tr.leasedOut = { leaseId: l.id, until: l.until }; tr.plat = null; if (RT.trains[tr.id]) RT.trains[tr.id].group.visible = false; log(`${tr.name} ถูกเพื่อนเช่าไปวิ่ง 15 นาที`); }
    const paid = state.coopPaid['lease:' + l.id] || 0, owed = Math.floor(l.owed || 0);
    if (owed > paid) { earn(owed - paid, 'coop'); state.coopPaid['lease:' + l.id] = owed; log(`รายได้แบ่งจากการให้เช่า ${l.name} +${baht(owed - paid)}`, 'good'); }
  }
}
// ----- emergency rescue -----
async function coopRequestRescue(tr) {
  if (!coopReady() || tr.rescueReq) return;
  const line = lineById(tr.line), near = line ? SMAP[tr.dir > 0 ? line.b : line.a].name : '';
  try {
    const ref = await CO.db.collection('rescues').add({ requester: CO.me, trainName: tr.name, tier: tr.tier, near, reward: 8000, status: 'open', rescuer: null, createdAt: Date.now() });
    tr.rescueReq = ref.id; log(`ขอความช่วยเหลือให้ ${tr.name} ใกล้${near}`, 'bad');
    if (CO.room) CO.room.emit('rescue', { id: ref.id }).catch(() => {});
    toast('ส่งคำขอแล้ว เพื่อนที่มีหัวรถจักรว่างจะตอบรับได้');
  } catch (e) { toast('ส่งคำขอไม่สำเร็จ'); }
}
async function coopAcceptRescue(id) {
  if (!coopReady()) return;
  const helper = state.trains.find(t => !offLine(t) && !t.leased && !TIERS[t.tier].pp && !t.broken);
  if (!helper) { toast('ต้องมีหัวรถจักร AD24C หรือ QSY ที่ว่างอยู่จึงไปช่วยได้'); return; }
  const ref = CO.db.doc('rescues/' + id);
  try {
    const lease = await ref.acquire({ holder: CO.me, ttlMs: 5000 });
    if (!lease.acquired) { toast('มีเพื่อนกำลังรับเรื่องนี้อยู่'); return; }
    const snap = await ref.get(); const d = snap.exists && snap.data();
    if (!d || d.status !== 'open') { toast('มีคนไปช่วยแล้ว'); return; }
    await ref.update({ status: 'accepted', rescuer: CO.me, helper: helper.name, acceptedAt: Date.now() });
    helper.rescue = { t: 25 }; helper.plat = null; if (RT.trains[helper.id]) RT.trains[helper.id].group.visible = false;
    earn(d.reward, 'coop'); state.coopPaid['rescue:' + id] = 1;
    log(`ส่ง ${helper.name} ไปลากรถเพื่อน (${d.trainName}) ได้ค่าตอบแทน ${baht(d.reward)}`, 'good'); toast(`ไปช่วยเพื่อนแล้ว +${baht(d.reward)}`);
  } catch (e) { toast('ตอบรับไม่สำเร็จ'); }
}
function coopApplyRescues() {
  for (const r of CO.rescues) {
    if (r.requester !== CO.me || r.status !== 'accepted' || state.coopPaid['rescue:' + r.id]) continue;
    state.coopPaid['rescue:' + r.id] = 1;
    const tr = state.trains.find(t => t.rescueReq === r.id);
    if (tr) { tr.rescueReq = null; if (tr.broken) { tr.broken = false; tr.repair = 0; tr.cond = Math.max(tr.cond, 55); } }
    pay(r.reward, 'depot');
    nameOf(r.rescuer).then(n => { log(`${n} ส่ง ${r.helper || 'หัวรถจักร'} มาลากจูง ${r.trainName} จ่าย ${baht(r.reward)}`, 'good'); toast(`${n} มาช่วยลากรถแล้ว`); });
  }
}
// ----- relay contracts -----
const RELAY_PAIRS = [['LCB', 'BKK'], ['LKB', 'KOR'], ['LCB', 'UBN'], ['BPC', 'CMI'], ['HDY', 'SGK'], ['LKB', 'NKI'], ['KOR', 'BKK'], ['SLA', 'BKK']];
async function coopBroker() {
  if (!coopReady()) return;
  if (CO.relays.filter(r => r.status === 'open' || r.status === 'active').length >= 3) { toast('มีสัญญาส่งไม้ต่อเปิดอยู่ครบ 3 ฉบับแล้ว'); return; }
  const [from, to] = RELAY_PAIRS[Math.floor(Math.random() * RELAY_PAIRS.length)];
  const amount = Math.round((300 + Math.random() * 400) / 10) * 10, reward = Math.round(amount * 70 * repMul() / 1000) * 1000;
  try { await CO.db.collection('relays').add({ from, to, amount, reward, deadline: Date.now() + 20 * 60000, shipper: null, receiver: null, shipped: 0, received: 0, status: 'open', createdAt: Date.now(), by: CO.me }); toast('นายหน้า AI ออกสัญญาส่งไม้ต่อฉบับใหม่'); }
  catch (e) { toast('สร้างสัญญาไม่สำเร็จ'); }
}
async function coopJoinRelay(id, role) {
  if (!coopReady()) return;
  const ref = CO.db.doc('relays/' + id);
  try {
    const lease = await ref.acquire({ holder: CO.me, ttlMs: 5000 });
    if (!lease.acquired) { toast('มีคนกำลังรับบทบาทนี้อยู่'); return; }
    const s = await ref.get(), d = s.exists && s.data(); if (!d) return;
    if (d[role]) { toast('บทบาทนี้มีคนรับแล้ว'); return; }
    if (d[role === 'shipper' ? 'receiver' : 'shipper'] === CO.me) { toast('ต้องให้เพื่อนอีกคนรับอีกบทบาท'); return; }
    const patch = { [role]: CO.me }; if (d[role === 'shipper' ? 'receiver' : 'shipper']) patch.status = 'active';
    await ref.update(patch);
    toast(role === 'shipper' ? `คุณเป็นผู้ส่ง: ขนสินค้าออกจาก${SMAP[d.from].name}` : `คุณเป็นผู้รับ: เคลียร์รางและรับสินค้าที่${SMAP[d.to].name}`);
  } catch (e) { toast('รับบทบาทไม่สำเร็จ'); }
}
function coopOnDeliver(origin, at, kind, load) {
  if (!CO.me || kind !== 'C') return;
  for (const r of CO.relays) {
    if (r.status !== 'active' || Date.now() > r.deadline) continue;
    if (r.shipper === CO.me && origin === r.from) CO.pend[r.id] = Object.assign(CO.pend[r.id] || {}, { shipped: Math.min(r.amount, (CO.pend[r.id] && CO.pend[r.id].shipped !== undefined ? CO.pend[r.id].shipped : r.shipped) + load) });
    if (r.receiver === CO.me && at === r.to) { const base = CO.pend[r.id] && CO.pend[r.id].received !== undefined ? CO.pend[r.id].received : r.received; CO.pend[r.id] = Object.assign(CO.pend[r.id] || {}, { received: Math.min(r.amount, r.shipped, base + load) }); }
  }
}
function coopApplyRelays() {
  for (const r of CO.relays) {
    const mine = r.shipper === CO.me || r.receiver === CO.me;
    if (r.status === 'done' && mine && !state.coopPaid['relay:' + r.id]) { state.coopPaid['relay:' + r.id] = 1; earn(r.reward, 'coop'); state.rep = Math.min(100, state.rep + 3); log(`สัญญาส่งไม้ต่อ ${SMAP[r.from].name} → ${SMAP[r.to].name} สำเร็จ +${baht(r.reward)}`, 'good'); toast(`ส่งไม้ต่อสำเร็จ! +${baht(r.reward)}`); sfxCoin(); }
    if (r.status === 'failed' && mine && !state.coopPaid['relay:' + r.id]) { state.coopPaid['relay:' + r.id] = 1; state.rep = Math.max(0, state.rep - 3); log(`สัญญาส่งไม้ต่อ ${SMAP[r.from].name} → ${SMAP[r.to].name} หมดเวลา`, 'bad'); }
  }
}
async function coopFlush() {
  if (!coopReady()) return;
  for (const r of CO.relays) {
    const p = CO.pend[r.id], ref = CO.db.doc('relays/' + r.id);
    try {
      if (p && r.status === 'active') {
        const patch = {};
        if (p.shipped !== undefined && r.shipper === CO.me && p.shipped > r.shipped) patch.shipped = p.shipped;
        if (p.received !== undefined && r.receiver === CO.me && p.received > r.received) { patch.received = p.received; if (p.received >= r.amount && Date.now() <= r.deadline) patch.status = 'done'; }
        if (Object.keys(patch).length) await ref.update(patch);
        delete CO.pend[r.id];
      }
      if ((r.status === 'open' || r.status === 'active') && Date.now() > r.deadline && (r.shipper === CO.me || r.receiver === CO.me || r.by === CO.me)) await ref.update({ status: 'failed' });
    } catch (e) {}
  }
  for (const tr of state.trains.filter(t => t.leased)) {
    const L = tr.leased, ref = CO.db.doc('leases/' + L.leaseId);
    try {
      if (Math.floor(L.owed) > (L.sent || 0)) { await ref.update({ owed: Math.floor(L.owed) }); L.sent = Math.floor(L.owed); }
      if (Date.now() > L.until) { await ref.update({ status: 'ended', owed: Math.floor(L.owed) }); state.trains = state.trains.filter(t => t !== tr); removeTrainMesh(tr.id); log(`คืน ${tr.name} ให้เจ้าของแล้ว (แบ่งรายได้ ${baht(L.owed)})`); RT.staticDirty = true; }
    } catch (e) {}
  }
}
function coopTick(dt) {
  CO.acc += dt; CO.flushAcc += dt;
  if (CO.acc > 3) { CO.acc = 0; coopPresence(); coopPublishFleet(); }
  for (const tr of state.trains) if (tr.leasedOut && Date.now() > tr.leasedOut.until + 3000) { tr.leasedOut = null; placeOnLine(tr); if (RT.trains[tr.id]) RT.trains[tr.id].group.visible = true; log(`${tr.name} กลับจากการให้เช่า`); }
  if (CO.flushAcc > 6) { CO.flushAcc = 0; coopFlush(); }
}
// ----- co-op drawer -----
function coopRender() {
  const body = $('#coopBody'); if (!body || (drawerTab !== 'coop' && body.dataset.ready)) { if (body) body.dataset.stale = '1'; return; }
  body.dataset.ready = '1';
  if (!window.claude || typeof window.claude.use !== 'function' || (!CO.db && !CO.room)) {
    body.innerHTML = `<div class="box"><b>ยังไม่ได้เชื่อมต่อ Co-op</b><p class="info">เปิดเกมนี้ผ่าน claude.ai และแชร์ลิงก์ให้เพื่อน (สิทธิ์ Contributor ขึ้นไป) เพื่อเล่นร่วมกัน: เห็นกันแบบเรียลไทม์ ส่งสัญญาณ เช่ารถ ช่วยลากรถเสีย และรับสัญญาส่งไม้ต่อ</p></div>`;
    return;
  }
  const others = CO.peers.filter(p => !p.isMe);
  const fl = Object.entries(CO.fleets).flatMap(([uid, f]) => (f.trains || []).map(t => ({ uid, t })));
  const leasedByOthers = new Set(CO.leases.filter(l => l.status === 'active' && Date.now() < l.until).map(l => l.owner + ':' + l.trainId));
  const lineOpts = state.lines.map(l => `<option value="${l.id}">${esc(lineName(l))}</option>`).join('');
  const rescues = CO.rescues.filter(r => Date.now() - r.createdAt < 30 * 60000).sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  const relays = CO.relays.filter(r => r.status !== 'failed' || Date.now() - r.deadline < 5 * 60000).sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  const nm = id => id === CO.me ? 'คุณ' : esc(CO.names[id] || 'เพื่อน');
  body.innerHTML = `
    <div class="box coop-status"><span class="dot ${CO.connected ? 'on' : ''}"></span><span>${CO.connected ? `ออนไลน์ · มีผู้เล่นอื่น ${others.length} คน` : 'กำลังเชื่อมต่อ…'}</span>${!CO.writable ? '<span class="pill warn">สิทธิ์ดูอย่างเดียว</span>' : ''}</div>
    <h3>สัญญาส่งไม้ต่อ (Relay)</h3>
    <p class="info">คนหนึ่งขนสินค้าออกจากต้นทาง อีกคนรับรถและเคลียร์รางที่ปลายทางให้ทันเวลา รับโบนัสทั้งคู่</p>
    <div class="acts"><button class="primary" id="brokerBtn" ${coopReady() ? '' : 'disabled'}>เรียกนายหน้า AI</button></div>
    <div class="clist">${relays.map(r => {
      const left = Math.max(0, Math.round((r.deadline - Date.now()) / 60000));
      return `<article class="card"><header><span class="chip">ส่งไม้ต่อ</span><b>${esc(SMAP[r.from] ? SMAP[r.from].name : r.from)} → ${esc(SMAP[r.to] ? SMAP[r.to].name : r.to)}</b><span class="pill ${r.status === 'done' ? 'good' : r.status === 'failed' ? 'bad' : 'warn'}">${r.status === 'done' ? 'สำเร็จ' : r.status === 'failed' ? 'หมดเวลา' : `เหลือ ${left} นาที`}</span></header>
        <div class="meta"><span>สินค้า ${fmt(r.amount)} ตัน</span><span class="num reward">${baht(r.reward)} ต่อคน</span></div>
        <div class="meter"><div class="lbl"><span>ส่งออก (${r.shipper ? nm(r.shipper) : 'ว่าง'})</span><b>${fmt(r.shipped)} / ${fmt(r.amount)}</b></div><div class="bar cargo"><i style="width:${r.shipped / r.amount * 100}%"></i></div></div>
        <div class="meter"><div class="lbl"><span>รับเข้า (${r.receiver ? nm(r.receiver) : 'ว่าง'})</span><b>${fmt(r.received)} / ${fmt(r.amount)}</b></div><div class="bar"><i style="width:${r.received / r.amount * 100}%"></i></div></div>
        ${r.status === 'open' ? `<div class="acts">${!r.shipper ? `<button data-relay="${r.id}" data-role="shipper">รับเป็นผู้ส่ง</button>` : ''}${!r.receiver ? `<button data-relay="${r.id}" data-role="receiver">รับเป็นผู้รับ</button>` : ''}</div>` : ''}
      </article>`; }).join('') || '<p class="info">ยังไม่มีสัญญา กด "เรียกนายหน้า AI"</p>'}</div>
    <h3>กู้ภัยร่วม</h3>
    <div class="clist">${rescues.map(r => `<article class="card"><header><span class="chip">กู้ภัย</span><b>${esc(r.trainName)}</b><span class="pill ${r.status === 'open' ? 'bad' : 'good'}">${r.status === 'open' ? 'รอความช่วยเหลือ' : 'มีคนไปช่วยแล้ว'}</span></header>
      <div class="meta"><span>ของ ${nm(r.requester)}</span><span>ใกล้${esc(r.near || '')}</span><span class="num reward">${baht(r.reward)}</span></div>
      ${r.status === 'open' && r.requester !== CO.me ? `<div class="acts"><button class="primary" data-rescue="${r.id}">ส่งหัวรถจักรไปช่วย</button></div>` : ''}</article>`).join('') || '<p class="info">ไม่มีรถเพื่อนขัดข้อง ถ้ารถคุณเสีย กด "ขอเพื่อนช่วยลาก" ที่การ์ดขบวน</p>'}</div>
    <h3>เช่าหัวรถจักรจากเพื่อน</h3>
    <p class="info">เช่า 15 นาที แบ่งรายได้ 30% ให้เจ้าของ เพื่อนออฟไลน์อยู่ก็เช่าได้ เปิดรถของคุณให้เช่าที่การ์ดขบวน</p>
    <div class="form"><label for="leaseLine">นำมาวิ่งสาย</label><select id="leaseLine">${lineOpts || '<option value="">ยังไม่มีเส้นทาง</option>'}</select></div>
    <div class="clist">${fl.map(({ uid, t }) => { const busy = leasedByOthers.has(uid + ':' + t.id); return `<article class="card"><header><i class="tier" style="--c:${TIERS[t.tier] ? TIERS[t.tier].color : '#999'}"></i><b>${esc(t.name)}</b><span class="pill ${busy ? 'mute' : 'good'}">${busy ? 'ถูกเช่าอยู่' : 'ว่าง'}</span></header>
      <div class="meta"><span>${TIERS[t.tier] ? TIERS[t.tier].full : esc(t.tier)}</span><span>${t.kind === 'P' ? 'ผู้โดยสาร' : 'สินค้า'}</span><span>ของ ${nm(uid)}</span></div>
      <div class="acts"><button data-lease="${esc(uid)}|${esc(t.id)}" ${busy || !coopReady() ? 'disabled' : ''}>ขอเช่า 15 นาที</button></div></article>`; }).join('') || '<p class="info">ยังไม่มีเพื่อนเปิดรถให้เช่า</p>'}</div>`;
  body.dataset.stale = '';
}
$('#coopBody').addEventListener('click', e => {
  const t = e.target;
  if (t.closest('#brokerBtn')) { coopBroker(); return; }
  const rl = t.closest('[data-relay]'); if (rl) { coopJoinRelay(rl.dataset.relay, rl.dataset.role); return; }
  const rs = t.closest('[data-rescue]'); if (rs) { coopAcceptRescue(rs.dataset.rescue); return; }
  const ls = t.closest('[data-lease]'); if (ls) { const [uid, tid] = ls.dataset.lease.split('|'); const f = CO.fleets[uid]; const tr = f && (f.trains || []).find(x => x.id === tid); if (tr) coopLease(uid, tr); }
});
setInterval(() => { if (drawerTab === 'coop' && $('#panel').classList.contains('open')) coopRender(); }, 4000);
