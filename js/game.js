// Pelham Acres — game state and rules. All timers are wall-clock timestamps,
// so progress continues while the app is closed.
import { CROPS, CROP_YIELD, ANIMALS, RECIPES, BUILD, VALUE, MAP, MATS, DECOR_CHARM_CAP, xpFor } from './data.js';

export let S = null;
export const now = () => Date.now();
export const hooks = { onLevel: null };
const KEY = 'pelhamAcres.save.v1';

// ---------- Grid ----------
let grid = [];
export function rebuildGrid() {
  grid = new Array(MAP * MAP).fill(null);
  for (const o of S.objs) {
    const b = BUILD[o.t];
    for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) grid[(o.y + j) * MAP + o.x + i] = o;
  }
}
export const objAt = (x, y) => (x < 0 || y < 0 || x >= MAP || y >= MAP) ? null : grid[y * MAP + x];
export function canPlace(t, x, y, ignore) {
  const b = BUILD[t];
  if (x < 0 || y < 0 || x + b.w > MAP || y + b.h > MAP) return false;
  for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) {
    const o = grid[(y + j) * MAP + x + i];
    if (o && o !== ignore) return false;
  }
  return true;
}
function initFor(t) {
  switch (BUILD[t].kind) {
    case 'field': return { crop: null, start: 0, end: 0 };
    case 'producer': return { jobs: [] };
    case 'pen': return { animals: [] };
    case 'house': return { last: now() };
    default: return {};
  }
}
export function addObj(t, x, y, noRebuild) {
  const o = { id: S.nextId++, t, x, y, ...initFor(t) };
  S.objs.push(o);
  if (!noRebuild) rebuildGrid();
  return o;
}
export function moveObj(o, x, y) { o.x = x; o.y = y; rebuildGrid(); }
export const count = t => S.objs.reduce((n, o) => n + (o.t === t ? 1 : 0), 0);
export const findObj = t => S.objs.find(o => o.t === t);

// ---------- Inventory ----------
export const storageCap = () => 50 + (S.barnLvl - 1) * 25;
export function storageUsed() { let n = 0; for (const k in S.inv) if (!MATS.has(k)) n += S.inv[k]; return n; }
export const hasSpace = n => storageUsed() + n <= storageCap();
export const have = id => S.inv[id] || 0;
export function addItem(id, n = 1) {
  if (!MATS.has(id) && !hasSpace(n)) return false;
  S.inv[id] = (S.inv[id] || 0) + n;
  return true;
}
export function hasAll(req) { for (const k in req) if (have(k) < req[k]) return false; return true; }
export function takeAll(req) { for (const k in req) { S.inv[k] -= req[k]; if (S.inv[k] <= 0) delete S.inv[k]; } }

// ---------- XP / levels ----------
export function addXP(n) {
  S.xp += n;
  while (S.xp >= xpFor(S.level)) {
    S.xp -= xpFor(S.level);
    S.level++;
    S.hg += 2;
    S.coins += S.level * 15;
    hooks.onLevel && hooks.onLevel(S.level);
  }
}

// ---------- Buying ----------
// Returns null if the player can buy one more of t, else a reason.
export function buyBlock(t) {
  const b = BUILD[t];
  if (S.level < b.lvl) return `Unlocks at level ${b.lvl}`;
  const n = count(t);
  if (n >= b.max(S.level)) return t === 'field' ? 'Level up for more fields' : 'You have the maximum';
  if (S.coins < b.cost(n)) return 'Not enough coins';
  if (b.mats && !hasAll(b.mats)) return 'Need more materials';
  return null;
}
export function pay(t) {
  const b = BUILD[t];
  S.coins -= b.cost(count(t));
  if (b.mats) takeAll(b.mats);
}

// ---------- Fields ----------
export const fieldReady = o => !!o.crop && now() >= o.end;
export function plant(o, c) {
  const cr = CROPS[c];
  if (o.crop) return 'busy';
  if (S.level < cr.lvl) return 'locked';
  if (S.coins < cr.cost) return 'coins';
  S.coins -= cr.cost;
  o.crop = c; o.start = now(); o.end = now() + cr.time * 1000;
  return 'ok';
}
export function harvest(o) {
  if (!fieldReady(o)) return null;
  const c = o.crop;
  if (!addItem(c, CROP_YIELD)) return 'full';
  o.crop = null;
  addXP(CROPS[c].xp);
  return c;
}

// ---------- Producers ----------
export const slots = o => 3 + (o.extraSlots || 0);
export function queueJob(o, ri) {
  const r = RECIPES[o.t][ri];
  if (S.level < r.lvl) return 'locked';
  if (o.jobs.length >= slots(o)) return 'slots';
  if (!hasAll(r.in)) return 'missing';
  takeAll(r.in);
  const last = o.jobs.length ? o.jobs[o.jobs.length - 1].end : 0;
  const start = Math.max(last, now());
  o.jobs.push({ out: r.out, n: r.n, xp: r.xp, start, end: start + r.time * 1000 });
  return 'ok';
}
export const jobsDone = o => o.jobs.filter(j => j.end <= now()).length;
export function collectJobs(o) {
  const got = [];
  while (o.jobs.length && o.jobs[0].end <= now()) {
    const j = o.jobs[0];
    if (!addItem(j.out, j.n)) return { got, full: true };
    o.jobs.shift();
    addXP(j.xp);
    got.push(j);
  }
  return { got, full: false };
}

// ---------- Animal pens ----------
export const penAnimal = o => ANIMALS[BUILD[o.t].animal];
export const animalCost = o => Math.round(penAnimal(o).cost * (1 + o.animals.length * 0.5));
export function buyAnimal(o) {
  if (o.animals.length >= BUILD[o.t].cap) return 'full';
  const c = animalCost(o);
  if (S.coins < c) return 'coins';
  S.coins -= c;
  o.animals.push({ end: 0 });
  return 'ok';
}
export const animalState = an => an.end === 0 ? 'hungry' : (an.end <= now() ? 'ready' : 'busy');
export function feedAll(o) {
  const a = penAnimal(o); let fed = 0;
  for (const an of o.animals) {
    if (an.end === 0 && have(a.feed) > 0) { takeAll({ [a.feed]: 1 }); an.end = now() + a.time * 1000; fed++; }
  }
  return fed;
}
export function collectAnimals(o) {
  const a = penAnimal(o); let got = 0, full = false;
  for (const an of o.animals) {
    if (animalState(an) === 'ready') {
      if (!addItem(a.product, 1)) { full = true; break; }
      an.end = 0; got++; addXP(a.xp);
    }
  }
  return { got, full };
}

// ---------- Houses ----------
export const RENT_CAP = 5;
export function rentDue(o) {
  const b = BUILD[o.t];
  return Math.min(RENT_CAP, Math.floor((now() - o.last) / (b.period * 1000)));
}
export function collectRent(o) {
  const p = rentDue(o); if (!p) return 0;
  const b = BUILD[o.t];
  S.coins += p * b.rent;
  o.last = p >= RENT_CAP ? now() : o.last + p * b.period * 1000;
  addXP(p);
  return p * b.rent;
}

// ---------- Obstacles ----------
export const clearCost = o => Math.round(BUILD[o.t].clear * (1 + (S.cleared || 0) * 0.03));
export function clearObstacle(o) {
  const b = BUILD[o.t], c = clearCost(o);
  if (S.coins < c) return { err: 'coins' };
  S.coins -= c;
  S.objs.splice(S.objs.indexOf(o), 1);
  S.cleared = (S.cleared || 0) + 1;
  rebuildGrid();
  addXP(2);
  let drop = null;
  if (Math.random() < 0.8) { const n = Math.random() < 0.4 ? 2 : 1; addItem(b.drop, n); drop = { id: b.drop, n }; }
  return { ok: true, drop };
}

// ---------- Barn ----------
export function barnUpgradeCost() { const l = S.barnLvl; return { coins: 120 * l, wood: 2 + 2 * l, stone: 2 + 2 * l }; }
export function upgradeBarn() {
  const c = barnUpgradeCost();
  if (S.coins < c.coins || !hasAll({ wood: c.wood, stone: c.stone })) return false;
  S.coins -= c.coins; takeAll({ wood: c.wood, stone: c.stone }); S.barnLvl++;
  return true;
}
export function sellPrice(id) { return Math.max(1, Math.round(VALUE[id] * 0.6)); }
export function sell(id, n) {
  n = Math.min(n, have(id)); if (n <= 0) return 0;
  takeAll({ [id]: n });
  const c = sellPrice(id) * n; S.coins += c; return c;
}

// ---------- Charm (boosts order rewards) ----------
export function charm() {
  let civic = 0, decor = 0;
  for (const o of S.objs) {
    const b = BUILD[o.t];
    if (b.kind === 'civic') civic += b.charm;
    else if (b.kind === 'decor') decor += b.charm || 0;
  }
  return civic + Math.min(DECOR_CHARM_CAP, decor);
}

// ---------- Orders ----------
export const orderSlots = () => Math.min(8, 3 + Math.floor(S.level / 3));
function obtainable() {
  const set = new Set();
  for (const c in CROPS) if (CROPS[c].lvl <= S.level) set.add(c);
  for (const o of S.objs) {
    const b = BUILD[o.t];
    if (b.kind === 'producer') for (const r of RECIPES[o.t]) if (r.lvl <= S.level && !/Feed$/.test(r.out)) set.add(r.out);
    if (b.kind === 'pen' && o.animals.length) set.add(penAnimal(o).product);
  }
  return [...set];
}
export function genOrder() {
  const pool = obtainable();
  const maxK = Math.min(3, 1 + Math.floor(S.level / 2), pool.length);
  const k = 1 + Math.floor(Math.random() * maxK);
  const items = {}; let val = 0;
  for (let i = 0; i < k; i++) {
    const id = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const isCrop = !!CROPS[id];
    const q = isCrop ? 2 + Math.floor(Math.random() * 5) : 1 + Math.floor(Math.random() * (VALUE[id] < 40 ? 3 : 2));
    items[id] = q; val += VALUE[id] * q;
  }
  const names = ['Mrs. Abernathy', 'Farmer Joe', 'The Pelham Diner', 'Old Tom', 'Rosa at the Inn', 'The Mayor', 'Grandma Ellis', 'Pastor Lyle', 'The Hendersons', 'Coach Brady', 'Dottie', 'Mr. Finch'];
  return {
    who: names[Math.floor(Math.random() * names.length)],
    items,
    coins: Math.round(val * 1.5 * (1 + charm() / 100)),
    xp: Math.max(2, Math.round(val / 3)),
  };
}
export function refreshOrders() {
  const t = now();
  for (let i = 0; i < S.orders.length; i++) if (S.orders[i].wait && S.orders[i].wait <= t) S.orders[i] = genOrder();
  while (S.orders.length < orderSlots()) S.orders.push(genOrder());
}
export function deliver(i) {
  const o = S.orders[i];
  if (!o || o.wait || !hasAll(o.items)) return null;
  takeAll(o.items);
  S.coins += o.coins;
  addXP(o.xp);
  S.orders[i] = { wait: now() + 15000 };
  S.delivered = (S.delivered || 0) + 1;
  let bonus = false;
  if (S.delivered % 5 === 0) { S.hg += 1; bonus = true; }
  return { ...o, bonus };
}
export function skipOrder(i) { S.orders[i] = { wait: now() + 30000 }; }
export const readyOrders = () => S.orders.filter(o => !o.wait && hasAll(o.items)).length;

// ---------- Hourglass (earned speed-up; never sold) ----------
export function useHourglass(o) {
  if (S.hg < 1) return false;
  const t = now(), b = BUILD[o.t];
  if (b.kind === 'field' && o.crop && o.end > t) { o.end = t; }
  else if (b.kind === 'producer') {
    const i = o.jobs.findIndex(j => j.end > t); if (i < 0) return false;
    const d = o.jobs[i].end - Math.max(t, o.jobs[i].start);
    for (let k = i; k < o.jobs.length; k++) { o.jobs[k].end -= d; if (k > i) o.jobs[k].start -= d; }
    o.jobs[i].start = Math.min(o.jobs[i].start, t);
  } else if (b.kind === 'pen') {
    const busy = o.animals.filter(a => a.end > t); if (!busy.length) return false;
    busy.forEach(a => a.end = t);
  } else return false;
  S.hg--;
  return true;
}

// ---------- Save / load ----------
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function newGame() {
  S = { v: 1, town: 'Pelham Acres', coins: 150, xp: 0, level: 1, hg: 3, inv: { wheat: 4, corn: 2 }, barnLvl: 1,
        objs: [], nextId: 1, orders: [], cleared: 0, delivered: 0, created: now(), saved: now(),
        settings: { music: true, sfx: true } };
  addObj('barn', 11, 10, true);
  addObj('feedMill', 15, 10, true);
  for (let x = 11; x < 14; x++) for (let y = 14; y < 16; y++) addObj('field', x, y, true);
  rebuildGrid();
  const r = rng(1789);
  const lo = 8, hi = 21;
  for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
    if (objAt(x, y)) continue;
    const inside = x >= lo && x <= hi && y >= lo && y <= hi;
    const p = r();
    if (inside) {
      const nearStart = x >= 10 && x <= 18 && y >= 9 && y <= 17;
      if (!nearStart && p < 0.06) addObj(r() < 0.75 ? 'tree' : 'rock', x, y, true);
    } else if (p < 0.62) addObj(r() < 0.72 ? 'tree' : 'rock', x, y, true);
    if ((x + y) % 30 === 0) rebuildGrid();
  }
  rebuildGrid();
  refreshOrders();
  return S;
}
export function save() {
  if (!S) return;
  S.saved = now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ }
}
export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.v === 1) { S = s; S.settings = S.settings || { music: true, sfx: true }; rebuildGrid(); return true; }
  } catch (e) { /* corrupt save */ }
  return false;
}
export function exportSave() { return btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }
export function importSave(str) {
  const s = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
  if (!s || s.v !== 1 || !Array.isArray(s.objs)) throw new Error('bad save');
  S = s; rebuildGrid(); save();
}
export function resetGame() { try { localStorage.removeItem(KEY); } catch (e) {} newGame(); save(); }
