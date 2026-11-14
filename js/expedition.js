// Pelham Acres — the expedition map. Explore fog-covered regions with energy
// (which refills over time or by eating food you've made — never bought).
import * as G from './game.js';

export const ENERGY = { max: 30, regenMs: 120000 };
export const FOOD = { veggieStew: 12, muffins: 9, iceCream: 6, bread: 4, cornbread: 6, cookies: 8, cheese: 5, potatoSoup: 10, carrotCake: 12, strawberryJam: 6, pumpkinPie: 15, pancakes: 12, blueberryJam: 8, coffeeCup: 8, hotCocoa: 10, mocha: 12,
  applePie: 16, honeyCake: 16, cherryPie: 18, peachCobbler: 20, fishChowder: 18, truffleRisotto: 24, appleCider: 8, peachNectar: 10, goatCheese: 7 };

export const REGIONS = [
  { id: 'woods', name: 'Whispering Woods', icon: '🌲', lvl: 5, flag: 'expedition', seed: 101, cols: 9, rows: 13, bg: '#4E7A3A',
    mix: { grass: 30, brush: 38, rock: 10, berries: 9, chest: 6, stream: 4 },
    ruin: { name: "Great-Aunt May's Old Shed", text: "Under the ivy you find your great-aunt's old garden shed, and inside, rolled-up plans for a lovely gazebo.", bp: 'gazebo', items: { planks: 6, nails: 4 } },
    reward: { coins: 600, hg: 3, items: { iron: 2 } } },
  { id: 'hills', name: 'Copper Hills', icon: '⛰️', lvl: 8, seed: 202, cols: 9, rows: 13, bg: '#8A7A55',
    mix: { grass: 20, brush: 15, rock: 32, ore: 12, chest: 7, berries: 6, stream: 3 },
    ruin: { name: 'The Old Copper Mine', text: "Lanterns still hang in the abandoned mine. Deep inside, a mine cart holds glittering stones, and the plans for a town fountain.", bp: 'fountain', items: { iron: 5, gem: 2 } },
    reward: { coins: 1200, hg: 4, items: { gem: 3 } } },
  { id: 'lake', name: 'Lantern Lake', icon: '🏞️', lvl: 11, seed: 303, cols: 9, rows: 13, bg: '#4F7F8C',
    mix: { grass: 26, brush: 18, rock: 12, water: 16, ore: 6, gemrock: 6, chest: 9, berries: 7 },
    ruin: { name: 'The Lantern Keeper\'s Cottage', text: "A tiny lakeside cottage with a weathervane on top. The keeper left a note: 'Build a windmill, and the valley will always have bread.'", bp: 'windmill', items: { gem: 3, iron: 3 } },
    reward: { coins: 2000, hg: 6, items: { gem: 5 } } },
  { id: 'ridge', name: 'Misty Ridge', icon: '🏔️', lvl: 18, flag: 'ridgeMap', seed: 404, cols: 9, rows: 15, bg: '#6E7F86',
    mix: { grass: 18, brush: 16, rock: 26, ore: 10, gemrock: 9, chest: 10, berries: 6, stream: 5 },
    ruin: { name: "Great-Aunt May's Mountain Cabin", text: "A snug log cabin above the clouds, tidy as if she left yesterday. On the table, weighed down with a jar of pressed flowers: plans for a grand glasshouse, and a note. 'Build it where everyone can share it.'", bp: 'glasshouse', items: { gem: 4, iron: 4 } },
    reward: { coins: 4000, hg: 8, items: { gem: 6, iron: 4 } } },
];

export const TILE = {
  camp:    { icon: '⛺', name: 'Camp', cost: 0 },
  grass:   { icon: '🌿', name: 'Meadow', cost: 1 },
  brush:   { icon: '🌳', name: 'Thicket', cost: 2 },
  rock:    { icon: '🪨', name: 'Boulders', cost: 3 },
  ore:     { icon: '⛏️', name: 'Ore vein', cost: 3 },
  gemrock: { icon: '💎', name: 'Crystal rocks', cost: 4 },
  berries: { icon: '🫐', name: 'Wild berries', cost: 1 },
  chest:   { icon: '🧰', name: 'Buried chest', cost: 2 },
  stream:  { icon: '💧', name: 'Stream', cost: 1 },
  water:   { icon: '🌊', name: 'Lake', cost: 0, blocked: true },
  ruin:    { icon: '🏚️', name: 'Ruins', cost: 4 },
};

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Map layout is generated from the region's seed, so only "revealed" flags are saved.
const cache = {};
export function layout(reg) {
  if (cache[reg.id]) return cache[reg.id];
  const r = rng(reg.seed), tiles = [];
  const entries = Object.entries(reg.mix), tot = entries.reduce((s, [, w]) => s + w, 0);
  for (let i = 0; i < reg.cols * reg.rows; i++) {
    let x = r() * tot, t = 'grass';
    for (const [k, w] of entries) { x -= w; if (x <= 0) { t = k; break; } }
    tiles.push(t);
  }
  const camp = (reg.rows - 1) * reg.cols + Math.floor(reg.cols / 2);
  tiles[camp] = 'camp';
  for (const n of neighbors(reg, camp)) if (tiles[n] === 'water') tiles[n] = 'grass';
  tiles[Math.floor(reg.cols / 2) + reg.cols * 1] = 'ruin'; // ruins near the far end
  return (cache[reg.id] = { tiles, camp });
}
export function neighbors(reg, i) {
  const x = i % reg.cols, y = Math.floor(i / reg.cols), out = [];
  if (x > 0) out.push(i - 1); if (x < reg.cols - 1) out.push(i + 1);
  if (y > 0) out.push(i - reg.cols); if (y < reg.rows - 1) out.push(i + reg.cols);
  return out;
}

function E() {
  const S = G.S;
  S.exp = S.exp || { energy: ENERGY.max, eT: G.now(), regions: {} };
  return S.exp;
}
export function regionState(reg) {
  const ex = E();
  if (!ex.regions[reg.id]) {
    const L = layout(reg), rev = new Array(reg.cols * reg.rows).fill(0);
    rev[L.camp] = 1;
    ex.regions[reg.id] = { rev: rev.join(''), done: false };
  }
  return ex.regions[reg.id];
}
export const isRevealed = (reg, i) => regionState(reg).rev[i] === '1';
export function canExplore(reg, i) {
  const L = layout(reg);
  if (isRevealed(reg, i) || TILE[L.tiles[i]].blocked) return false;
  return neighbors(reg, i).some(n => isRevealed(reg, n) && !TILE[L.tiles[n]].blocked);
}
export const regionUnlocked = reg => G.S.level >= reg.lvl && (!reg.flag || (G.S.flags && G.S.flags[reg.flag])) && (reg.id === 'woods' || G.S.flags?.expedition);
export function progress(reg) {
  const L = layout(reg), st = regionState(reg);
  let have = 0, total = 0;
  L.tiles.forEach((t, i) => { if (!TILE[t].blocked) { total++; if (st.rev[i] === '1') have++; } });
  return { have, total };
}

// ---------- energy ----------
export function energy() {
  const ex = E(), t = G.now();
  if (ex.energy < ENERGY.max) {
    const gained = Math.floor((t - ex.eT) / ENERGY.regenMs);
    if (gained > 0) { ex.energy = Math.min(ENERGY.max, ex.energy + gained); ex.eT += gained * ENERGY.regenMs; }
  } else ex.eT = t;
  return ex.energy;
}
export const nextEnergyAt = () => E().eT + ENERGY.regenMs;
export function eat(id) {
  if (!FOOD[id] || G.have(id) < 1) return 0;
  energy();
  G.takeAll({ [id]: 1 });
  const ex = E(); ex.energy = Math.min(ENERGY.max * 2, ex.energy + FOOD[id]);
  return FOOD[id];
}

// ---------- exploring ----------
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export function explore(reg, i) {
  if (!canExplore(reg, i)) return { err: 'far' };
  const L = layout(reg), type = L.tiles[i], cost = TILE[type].cost;
  if (energy() < cost) return { err: 'energy', cost };
  const ex = E();
  if (ex.energy >= ENERGY.max) ex.eT = G.now();
  ex.energy -= cost;
  const st = regionState(reg);
  st.rev = st.rev.slice(0, i) + '1' + st.rev.slice(i + 1);
  // reveal adjoining lake water for free so the shoreline shows
  for (const n of neighbors(reg, i)) if (L.tiles[n] === 'water') st.rev = st.rev.slice(0, n) + '1' + st.rev.slice(n + 1);

  const loot = {}; let coins = 0, hg = 0, story = null;
  const add = (k, n) => { if (n > 0) loot[k] = (loot[k] || 0) + n; };
  const hills = reg.id !== 'woods';
  switch (type) {
    case 'grass': if (Math.random() < 0.35) coins += R(5, 15); break;
    case 'brush': add('wood', R(1, 2)); break;
    case 'rock': add('stone', R(1, 2)); if (hills && Math.random() < 0.4) add('iron', 1); break;
    case 'ore': add('iron', R(1, 2)); add('stone', R(0, 1)); break;
    case 'gemrock': add('gem', 1); add('stone', 1); break;
    case 'berries': add(Math.random() < 0.5 ? 'strawberry' : 'blueberry', R(2, 3)); break;
    case 'stream': if (Math.random() < 0.5) add('stone', 1); coins += R(3, 10); break;
    case 'chest': coins += R(40, 120) * (hills ? 2 : 1); if (Math.random() < 0.35) hg += 1; if (Math.random() < 0.45) add(hills ? 'gem' : 'iron', 1); break;
    case 'ruin': G.stat('ruin'); story = reg.ruin; for (const k in reg.ruin.items) add(k, reg.ruin.items[k]); G.S.flags = G.S.flags || {}; G.S.flags['bp_' + reg.ruin.bp] = true; break;
  }
  G.S.coins += coins; G.S.hg += hg;
  for (const k in loot) G.S.inv[k] = (G.S.inv[k] || 0) + loot[k];   // expedition finds always fit (they're carried home)
  G.addXP(cost + 1);
  G.stat('explore'); G.stat('explore:' + reg.id);

  // whole region uncovered?
  let finished = null;
  const p = progress(reg);
  if (!st.done && p.have >= p.total) {
    st.done = true;
    const rw = reg.reward;
    G.S.coins += rw.coins; G.S.hg += rw.hg;
    for (const k in rw.items) G.S.inv[k] = (G.S.inv[k] || 0) + rw.items[k];
    G.stat('regionDone');
    finished = reg;
  }
  return { ok: true, type, loot, coins, hg, story, finished };
}
