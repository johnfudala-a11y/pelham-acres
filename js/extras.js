// Pelham Acres — longer-term goals: Town Projects, the Seasonal Fair, and the Scrapbook of keepsakes.
import * as G from './game.js';
import { SEASONS, SEASON_MS } from './data.js';

// ---------- Town Projects: big community builds funded with coins and goods ----------
// Each has three stages; finishing all three gives a lasting charm bonus plus hourglasses and XP.
export const PROJECTS = [
  { id: 'pond', name: 'Restore the Mill Pond', who: 'tom', lvl: 9, art: 'ex-water',
    blurb: 'The old mill pond has silted up. Dredge it, fix the sluice and the ducks will come back.',
    stages: [{ coins: 1200, items: { planks: 8, stone: 12 } }, { coins: 2000, items: { bread: 8, cheese: 5 } }, { coins: 3200, items: { nails: 10, iron: 3, gem: 1 } }],
    reward: { charm: 8, hg: 5, xp: 300 } },
  { id: 'fair', name: 'Build the Fairground', who: 'hattie', lvl: 12, art: 'icon-ribbon',
    blurb: 'Every proper country town needs a fairground: pens for the livestock show, a pie tent and a bandstand lawn.',
    stages: [{ coins: 2500, items: { planks: 16, nails: 10 } }, { coins: 4000, items: { pumpkinPie: 5, iceCream: 5, carrotCake: 4 } }, { coins: 6500, items: { sweater: 3, caramel: 5, gem: 2 } }],
    reward: { charm: 12, hg: 8, xp: 600 } },
  { id: 'library', name: 'Open the Pelham Library', who: 'finch', lvl: 14, art: 'icon-journal',
    blurb: 'Mr. Finch has been quietly collecting books for years. Let\'s give them a home.',
    stages: [{ coins: 5000, items: { planks: 24, nails: 16, iron: 5 } }, { coins: 7500, items: { cottonFabric: 8, lavenderSachet: 5, coffeeCup: 6 } }, { coins: 10000, items: { gem: 4, mocha: 6, muffins: 6 } }],
    reward: { charm: 15, hg: 10, xp: 1000 } },
];
const P = () => (G.S.projects = G.S.projects || {});
export const projectStage = p => P()[p.id] || 0;                      // stages finished (0..3)
export const projectDone = p => projectStage(p) >= p.stages.length;
export const projectOpen = p => G.S.level >= p.lvl;
export function canFundStage(p) {
  const st = p.stages[projectStage(p)]; if (!st) return false;
  return G.S.coins >= st.coins && G.hasAll(st.items);
}
export function fundStage(p) {
  if (!projectOpen(p) || projectDone(p) || !canFundStage(p)) return null;
  const st = p.stages[projectStage(p)];
  G.S.coins -= st.coins; G.takeAll(st.items);
  P()[p.id] = projectStage(p) + 1;
  G.addXP(Math.round(p.reward.xp / 3));
  G.stat('projectStage');
  if (projectDone(p)) { G.S.hg += p.reward.hg; G.S.projectCharm = projectCharm(); G.stat('project'); return 'done'; }
  return 'stage';
}
// lasting charm from finished projects (added to the town's charm)
export const projectCharm = () => PROJECTS.reduce((n, p) => n + (projectDone(p) ? p.reward.charm : 0), 0);

// ---------- Seasonal Fair: deliver in-season goods during the season to fill the ribbon track ----------
export const FAIR_TIERS = [10, 25, 50];
const localT = t => t - new Date(t).getTimezoneOffset() * 60000;
const seasonKey = () => Math.floor(localT(G.now()) / SEASON_MS);
export function fair() {
  const S = G.S, k = seasonKey();
  if (!S.fair || S.fair.key !== k) S.fair = { key: k, n: 0, got: 0 };
  return S.fair;
}
export const fairName = () => ({ Spring: 'Spring Blossom Fair', Summer: 'Summer Harvest Fair', Fall: 'Autumn Pumpkin Fair', Winter: 'Winter Lantern Fair' })[G.season().name] || 'Seasonal Fair';
// called after an order is delivered: count the in-season units in it
export function fairCount(items) {
  if (G.S.level < 6) return 0;
  let n = 0; for (const k in items) if (G.inSeason(k)) n += items[k];
  if (n) fair().n += n;
  return n;
}
export const fairPrize = tier => ({ coins: 45 * G.S.level * (tier + 1), hg: tier + 1, xp: 15 * (tier + 1) * Math.max(1, G.S.level - 4) });
export const fairClaimable = () => { const f = fair(); return f.got < FAIR_TIERS.length && f.n >= FAIR_TIERS[f.got]; };
export function claimFair() {
  if (!fairClaimable()) return null;
  const f = fair(), pr = fairPrize(f.got);
  G.S.coins += pr.coins; G.S.hg += pr.hg; G.addXP(pr.xp); f.got++;
  G.stat('fairPrize');
  return pr;
}

// ---------- Scrapbook: keepsakes found now and then while farming, petting the cats and exploring ----------
export const KEEPSAKE_SETS = [
  { id: 'meadow', name: 'Meadow Finds', items: ['clover', 'flower', 'feather', 'acorn'], reward: { coins: 500, hg: 3 }, hint: 'Found while harvesting crops' },
  { id: 'cats', name: "Ollie & Milo's Treasures", items: ['mouse', 'collar', 'sock', 'photo'], reward: { coins: 600, hg: 3 }, hint: 'The cats bring these when you pet them' },
  { id: 'oldtown', name: 'Old Pelham', items: ['watch', 'oldcoin', 'postcard', 'horseshoe'], reward: { coins: 900, hg: 4 }, hint: 'Turned up by clearing land and filling orders' },
  { id: 'wild', name: 'Wild Wonders', items: ['nest', 'honeycomb', 'arrowhead', 'shell'], reward: { coins: 1200, hg: 5 }, hint: 'Discovered out on expeditions' },
];
export const KEEPSAKE_NAMES = { clover: 'Four-Leaf Clover', flower: 'Pressed Wildflower', feather: 'Speckled Feather', acorn: 'Shiny Acorn',
  mouse: 'Felt Toy Mouse', collar: 'Belled Collar', sock: 'Knitted Cat Toy', photo: 'Portrait of Ollie',
  watch: 'Silver Pocket Watch', oldcoin: 'Old Crown Coin', postcard: 'Vintage Postcard', horseshoe: 'Lucky Horseshoe',
  nest: "Bird's Nest", honeycomb: 'Wild Honeycomb', arrowhead: 'Stone Arrowhead', shell: 'Spiral Seashell' };
const SOURCE = { harvest: ['meadow', 0.025], pet: ['cats', 0.12], clear: ['oldtown', 0.08], deliver: ['oldtown', 0.04], explore: ['wild', 0.08] };
const K = () => (G.S.keepsakes = G.S.keepsakes || { have: [], sets: [] });
export const hasKeepsake = id => K().have.includes(id);
// roll for a keepsake from this activity; returns the keepsake id if one was found
export function rollKeepsake(source) {
  const s = SOURCE[source]; if (!s || G.S.level < 3) return null;
  const set = KEEPSAKE_SETS.find(x => x.id === s[0]);
  const missing = set.items.filter(i => !hasKeepsake(i));
  if (!missing.length || Math.random() > s[1]) return null;
  const id = missing[Math.floor(Math.random() * missing.length)];
  K().have.push(id); G.stat('keepsake');
  return id;
}
export const setComplete = set => set.items.every(hasKeepsake);
export const setClaimed = set => K().sets.includes(set.id);
export function claimSet(set) {
  if (!setComplete(set) || setClaimed(set)) return null;
  K().sets.push(set.id); G.S.coins += set.reward.coins; G.S.hg += set.reward.hg;
  return set.reward;
}
export const albumCount = () => K().have.length;
export const extrasNotice = () => PROJECTS.filter(p => projectOpen(p) && !projectDone(p) && canFundStage(p)).length
  + (fairClaimable() ? 1 : 0) + KEEPSAKE_SETS.filter(s => setComplete(s) && !setClaimed(s)).length;
