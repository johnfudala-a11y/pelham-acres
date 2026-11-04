// Pelham Acres — game content. Everything balance-related lives here.

export const TW = 64, TH = 32, MAP = 30;

// ---------- Crops ----------
export const CROPS = {
  wheat:      { name: 'Wheat',        time: 20,  cost: 1,  sell: 3,  xp: 1,  lvl: 1,  color: '#E8B84A', icon: '🌾' },
  corn:       { name: 'Corn',         time: 45,  cost: 2,  sell: 5,  xp: 1,  lvl: 1,  color: '#F2D33C', icon: '🌽' },
  carrot:     { name: 'Carrot',       time: 60,  cost: 3,  sell: 7,  xp: 2,  lvl: 2,  color: '#EE7A2A', icon: '🥕' },
  soybean:    { name: 'Soybean',      time: 90,  cost: 4,  sell: 9,  xp: 2,  lvl: 3,  color: '#9BBF4A', icon: '🫘' },
  sugarcane:  { name: 'Sugarcane',    time: 120, cost: 5,  sell: 11, xp: 3,  lvl: 4,  color: '#7FBF6A', icon: '🎋' },
  potato:     { name: 'Potato',       time: 150, cost: 6,  sell: 13, xp: 3,  lvl: 5,  color: '#C9A26B', icon: '🥔' },
  tomato:     { name: 'Tomato',       time: 180, cost: 7,  sell: 15, xp: 4,  lvl: 6,  color: '#E2483A', icon: '🍅' },
  strawberry: { name: 'Strawberry',   time: 240, cost: 9,  sell: 19, xp: 5,  lvl: 7,  color: '#E23B5A', icon: '🍓' },
  pumpkin:    { name: 'Pumpkin',      time: 300, cost: 11, sell: 23, xp: 6,  lvl: 8,  color: '#F28C28', icon: '🎃' },
  cotton:     { name: 'Cotton',       time: 360, cost: 12, sell: 26, xp: 6,  lvl: 9,  color: '#F4F1EA', icon: '🤍' },
  sunflower:  { name: 'Sunflower',    time: 420, cost: 14, sell: 29, xp: 7,  lvl: 10, color: '#F7C531', icon: '🌻' },
  blueberry:  { name: 'Blueberry',    time: 480, cost: 16, sell: 33, xp: 8,  lvl: 11, color: '#4C5FD0', icon: '🫐' },
  lavender:   { name: 'Lavender',     time: 540, cost: 18, sell: 37, xp: 9,  lvl: 12, color: '#A57FD8', icon: '🪻' },
  coffee:     { name: 'Coffee Beans', time: 600, cost: 20, sell: 41, xp: 10, lvl: 13, color: '#7A4B2A', icon: '🫛' },
  cocoa:      { name: 'Cocoa Pods',   time: 720, cost: 24, sell: 47, xp: 11, lvl: 14, color: '#5B3A22', icon: '🌰' },
};
export const CROP_YIELD = 2;

// ---------- Animals ----------
export const ANIMALS = {
  chicken: { name: 'Chicken', feed: 'chickenFeed', product: 'egg',  time: 60,  cost: 40,  xp: 2, icon: '🐔' },
  cow:     { name: 'Cow',     feed: 'cowFeed',     product: 'milk', time: 120, cost: 120, xp: 3, icon: '🐄' },
  sheep:   { name: 'Sheep',   feed: 'sheepFeed',   product: 'wool', time: 180, cost: 180, xp: 4, icon: '🐑' },
};

// ---------- Products (non-crop items) ----------
export const PRODUCTS = {
  chickenFeed: { name: 'Chicken Feed', icon: '🟡' },
  cowFeed:     { name: 'Cow Feed',     icon: '🟤' },
  sheepFeed:   { name: 'Sheep Feed',   icon: '🟢' },
  egg:         { name: 'Egg',          icon: '🥚' },
  milk:        { name: 'Milk',         icon: '🥛' },
  wool:        { name: 'Wool',         icon: '🐑' },
  bread:       { name: 'Bread',        icon: '🍞' },
  cornbread:   { name: 'Cornbread',    icon: '🧇' },
  cookies:     { name: 'Cookies',      icon: '🍪' },
  carrotCake:  { name: 'Carrot Cake',  icon: '🍰' },
  pumpkinPie:  { name: 'Pumpkin Pie',  icon: '🥧' },
  cream:       { name: 'Cream',        icon: '🍶' },
  butter:      { name: 'Butter',       icon: '🧈' },
  cheese:      { name: 'Cheese',       icon: '🧀' },
  brownSugar:  { name: 'Brown Sugar',  icon: '🍬' },
  syrup:       { name: 'Syrup',        icon: '🍯' },
  sunflowerOil:{ name: 'Sunflower Oil',icon: '🫗' },
  tomatoSauce: { name: 'Tomato Sauce', icon: '🥫' },
  potatoSoup:  { name: 'Potato Soup',  icon: '🍲' },
  strawberryJam:{name: 'Strawberry Jam', icon: '🫙' },
  blueberryJam:{ name: 'Blueberry Jam',icon: '🫙' },
  yarn:        { name: 'Yarn',         icon: '🧶' },
  cottonFabric:{ name: 'Cotton Fabric',icon: '🧵' },
  sweater:     { name: 'Sweater',      icon: '🧥' },
  lavenderSachet:{name:'Lavender Sachet', icon: '👛' },
  coffeeCup:   { name: 'Coffee',       icon: '☕' },
  hotCocoa:    { name: 'Hot Cocoa',    icon: '🍫' },
  mocha:       { name: 'Mocha',        icon: '🥤' },
  pancakes:    { name: 'Pancakes',     icon: '🥞' },
  wood:        { name: 'Wood',         icon: '🪵' },
  stone:       { name: 'Stone',        icon: '🪨' },
};
// Materials don't take barn space.
export const MATS = new Set(['wood', 'stone']);

// ---------- Recipes per production building ----------
export const RECIPES = {
  feedMill: [
    { out: 'chickenFeed', n: 3, in: { wheat: 2, corn: 1 },               time: 20,  lvl: 1 },
    { out: 'cowFeed',     n: 3, in: { soybean: 2, corn: 1 },             time: 40,  lvl: 3 },
    { out: 'sheepFeed',   n: 3, in: { wheat: 2, soybean: 1, carrot: 1 }, time: 50,  lvl: 7 },
  ],
  bakery: [
    { out: 'bread',      in: { wheat: 3 },                                    time: 45,  lvl: 2 },
    { out: 'cornbread',  in: { corn: 2, egg: 2 },                             time: 90,  lvl: 3 },
    { out: 'cookies',    in: { wheat: 2, egg: 1, brownSugar: 1 },             time: 150, lvl: 5 },
    { out: 'carrotCake', in: { carrot: 2, egg: 2, brownSugar: 1 },            time: 180, lvl: 6 },
    { out: 'pumpkinPie', in: { pumpkin: 1, egg: 2, wheat: 2, brownSugar: 1 }, time: 240, lvl: 8 },
  ],
  dairy: [
    { out: 'cream',  in: { milk: 1 }, time: 60,  lvl: 4 },
    { out: 'butter', in: { milk: 2 }, time: 90,  lvl: 5 },
    { out: 'cheese', in: { milk: 3 }, time: 150, lvl: 6 },
  ],
  sugarMill: [
    { out: 'brownSugar',   in: { sugarcane: 1 }, time: 45,  lvl: 5 },
    { out: 'syrup',        in: { sugarcane: 2 }, time: 90,  lvl: 6 },
    { out: 'sunflowerOil', in: { sunflower: 3 }, time: 120, lvl: 10 },
  ],
  kitchen: [
    { out: 'tomatoSauce',   in: { tomato: 3 },                  time: 90,  lvl: 6 },
    { out: 'potatoSoup',    in: { potato: 2, cream: 1 },        time: 120, lvl: 6 },
    { out: 'strawberryJam', in: { strawberry: 3, brownSugar: 1 }, time: 120, lvl: 7 },
    { out: 'blueberryJam',  in: { blueberry: 3, brownSugar: 1 },  time: 150, lvl: 11 },
  ],
  loom: [
    { out: 'yarn',           in: { wool: 2 },                      time: 120, lvl: 9 },
    { out: 'cottonFabric',   in: { cotton: 3 },                    time: 150, lvl: 9 },
    { out: 'sweater',        in: { yarn: 2 },                      time: 240, lvl: 10 },
    { out: 'lavenderSachet', in: { lavender: 2, cottonFabric: 1 }, time: 200, lvl: 12 },
  ],
  cafe: [
    { out: 'coffeeCup', in: { coffee: 2, milk: 1 },           time: 90,  lvl: 13 },
    { out: 'pancakes',  in: { wheat: 2, egg: 2, syrup: 1 },   time: 120, lvl: 13 },
    { out: 'hotCocoa',  in: { cocoa: 2, milk: 1 },            time: 120, lvl: 14 },
    { out: 'mocha',     in: { coffee: 1, cocoa: 1, cream: 1 },time: 150, lvl: 14 },
  ],
};
for (const k in RECIPES) for (const r of RECIPES[k]) { r.n = r.n || 1; r.xp = Math.max(1, Math.round(r.time / 20)); }

// ---------- Placeable things ----------
// kind: field | storage | pen | producer | house | civic | decor | path | obstacle
const one = () => 1, inf = () => Infinity;
export const BUILD = {
  field:     { name: 'Field', cat: 'Farm', kind: 'field', w: 1, h: 1, lvl: 1, cost: n => 10 + n * 5, max: L => 6 + L * 2, icon: '🟫', desc: 'Plant crops here.' },
  barn:      { name: 'Barn', kind: 'storage', w: 2, h: 2, lvl: 999, cost: () => 0, max: one, wall: '#B8432F', roof: '#6E2A20', hgt: 36, icon: '📦', desc: 'Stores your crops and goods.' },

  coop:      { name: 'Chicken Coop',  cat: 'Animals', kind: 'pen', animal: 'chicken', cap: 5, w: 2, h: 2, lvl: 2, cost: () => 60,  max: one, ground: '#CDB37A', wall: '#D9A066', roof: '#8E5B2E', icon: '🐔', desc: 'Chickens eat Chicken Feed and lay eggs.' },
  cowshed:   { name: 'Cow Pasture',   cat: 'Animals', kind: 'pen', animal: 'cow',     cap: 5, w: 2, h: 2, lvl: 4, cost: () => 220, max: one, ground: '#A9CF6E', wall: '#E9E2D0', roof: '#5A4632', icon: '🐄', desc: 'Cows eat Cow Feed and give milk.' },
  sheepfold: { name: 'Sheep Meadow',  cat: 'Animals', kind: 'pen', animal: 'sheep',   cap: 5, w: 2, h: 2, lvl: 8, cost: () => 450, max: one, ground: '#B8D98A', wall: '#C9B48F', roof: '#4E6B3A', icon: '🐑', desc: 'Sheep eat Sheep Feed and grow wool.' },

  feedMill:  { name: 'Feed Mill',        cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 1,  cost: () => 50,   max: one, wall: '#E3C16F', roof: '#6B8E23', hgt: 32, icon: '⚙️' },
  bakery:    { name: 'Bakery',           cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 2,  cost: () => 90,   max: one, wall: '#F3D9B1', roof: '#B5523B', hgt: 30, icon: '🍞' },
  dairy:     { name: 'Dairy',            cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 4,  cost: () => 260,  max: one, wall: '#F7F4EC', roof: '#3A6EA5', hgt: 30, icon: '🧀' },
  sugarMill: { name: 'Sugar Mill',       cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 5,  cost: () => 320,  max: one, wall: '#E8E2D0', roof: '#9C6B3A', hgt: 34, icon: '🍬' },
  kitchen:   { name: 'Preserve Kitchen', cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 6,  cost: () => 450,  max: one, wall: '#F6E7C8', roof: '#5E8B4A', hgt: 30, icon: '🫙' },
  loom:      { name: 'Weaving Loom',     cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 9,  cost: () => 750,  max: one, wall: '#E9D8F4', roof: '#6C4A8E', hgt: 32, icon: '🧶' },
  cafe:      { name: 'Corner Café',      cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 13, cost: () => 1300, max: one, wall: '#F2E0D0', roof: '#3B2A20', hgt: 32, icon: '☕' },

  cottage:   { name: 'Cottage',     cat: 'Town', kind: 'house', rent: 8,   period: 60,  w: 2, h: 2, lvl: 3,  cost: () => 120,  max: () => 4, wall: '#F4E3C1', roof: '#B04A3A', hgt: 28, icon: '🏠' },
  farmhouse: { name: 'Farmhouse',   cat: 'Town', kind: 'house', rent: 20,  period: 90,  w: 2, h: 2, lvl: 6,  cost: () => 350,  max: () => 3, wall: '#E9D3A8', roof: '#46626F', hgt: 34, icon: '🏡' },
  townhouse: { name: 'Townhouse',   cat: 'Town', kind: 'house', rent: 50,  period: 120, w: 2, h: 2, lvl: 10, cost: () => 900,  max: () => 3, wall: '#D8B4A0', roof: '#2F3E46', hgt: 46, icon: '🏘️' },
  manor:     { name: 'Manor House', cat: 'Town', kind: 'house', rent: 140, period: 180, w: 3, h: 3, lvl: 14, cost: () => 2500, max: one,      wall: '#F1EDE2', roof: '#4E3B31', hgt: 50, icon: '🏰' },
  townHall:     { name: 'Town Hall',     cat: 'Town', kind: 'civic', charm: 10, w: 3, h: 3, lvl: 5,  cost: () => 400,  mats: { wood: 8, stone: 8 },   max: one, wall: '#EDE3CF', roof: '#7A2E2E', hgt: 52, icon: '🏛️' },
  generalStore: { name: 'General Store', cat: 'Town', kind: 'civic', charm: 6,  w: 2, h: 2, lvl: 7,  cost: () => 600,  mats: { wood: 12, stone: 4 },  max: one, wall: '#CFE3D4', roof: '#2E6B4F', hgt: 34, icon: '🏪' },
  schoolhouse:  { name: 'Schoolhouse',   cat: 'Town', kind: 'civic', charm: 8,  w: 3, h: 2, lvl: 9,  cost: () => 900,  mats: { wood: 16, stone: 10 }, max: one, wall: '#C94C3C', roof: '#3E3A36', hgt: 38, icon: '🏫' },
  clockTower:   { name: 'Clock Tower',   cat: 'Town', kind: 'civic', charm: 10, w: 2, h: 2, lvl: 11, cost: () => 1200, mats: { stone: 24 },           max: one, wall: '#D9CBB0', roof: '#4B4F5A', hgt: 84, icon: '🕰️' },
  bandstand:    { name: 'Bandstand',     cat: 'Town', kind: 'civic', charm: 8,  w: 2, h: 2, lvl: 12, cost: () => 1500, mats: { wood: 24 },            max: one, wall: '#FFFFFF', roof: '#2F6E8E', hgt: 22, icon: '🎶' },

  path:    { name: 'Cobble Path', cat: 'Decor', kind: 'path',  w: 1, h: 1, lvl: 1, cost: () => 2,   max: inf, icon: '⬜' },
  fence:   { name: 'Fence',       cat: 'Decor', kind: 'decor', w: 1, h: 1, lvl: 1, cost: () => 5,   max: inf, charm: 0, icon: '🚧' },
  flowers: { name: 'Flower Bed',  cat: 'Decor', kind: 'decor', w: 1, h: 1, lvl: 2, cost: () => 15,  max: inf, charm: 1, icon: '🌷' },
  hedge:   { name: 'Hedge',       cat: 'Decor', kind: 'decor', w: 1, h: 1, lvl: 3, cost: () => 20,  max: inf, charm: 1, icon: '🌿' },
  bench:   { name: 'Bench',       cat: 'Decor', kind: 'decor', w: 1, h: 1, lvl: 4, cost: () => 30,  max: inf, charm: 1, icon: '🪑' },
  lamp:    { name: 'Lamp Post',   cat: 'Decor', kind: 'decor', w: 1, h: 1, lvl: 5, cost: () => 35,  max: inf, charm: 1, icon: '🏮' },
  pond:    { name: 'Duck Pond',   cat: 'Decor', kind: 'decor', w: 2, h: 2, lvl: 6, cost: () => 150, max: inf, charm: 4, icon: '🦆' },

  tree: { name: 'Tree', kind: 'obstacle', w: 1, h: 1, clear: 20, drop: 'wood',  icon: '🌳' },
  rock: { name: 'Rock', kind: 'obstacle', w: 1, h: 1, clear: 35, drop: 'stone', icon: '🪨' },
};
for (const k in BUILD) BUILD[k].id = k;
export const SHOP_CATS = ['Farm', 'Animals', 'Production', 'Town', 'Decor'];
export const DECOR_CHARM_CAP = 30;

// ---------- Items (lookup for names/icons) ----------
export const ITEMS = {};
for (const k in CROPS) ITEMS[k] = { name: CROPS[k].name, icon: CROPS[k].icon };
for (const k in PRODUCTS) ITEMS[k] = PRODUCTS[k];

// ---------- Derived values (used for orders and selling) ----------
export const VALUE = {};
for (const k in CROPS) VALUE[k] = CROPS[k].sell;
VALUE.wood = 6; VALUE.stone = 8;
{
  const all = [];
  for (const b in RECIPES) for (const r of RECIPES[b]) all.push(r);
  for (let pass = 0; pass < 8; pass++) {
    for (const r of all) {
      if (VALUE[r.out]) continue;
      if (!Object.keys(r.in).every(i => VALUE[i])) continue;
      const inV = Object.entries(r.in).reduce((s, [i, q]) => s + VALUE[i] * q, 0);
      VALUE[r.out] = Math.max(1, Math.round((inV + r.time * 0.12) * 1.25 / r.n));
    }
    for (const a of Object.values(ANIMALS)) {
      if (VALUE[a.product] || !VALUE[a.feed]) continue;
      VALUE[a.product] = Math.round((VALUE[a.feed] + a.time * 0.1) * 1.3);
    }
  }
}

export const xpFor = L => Math.round(15 * Math.pow(L, 1.6) + 15);

// What unlocks at a level (for the level-up screen and shop).
export function unlocksAt(L) {
  const out = [];
  for (const k in CROPS) if (CROPS[k].lvl === L) out.push({ icon: CROPS[k].icon, name: CROPS[k].name + ' (crop)' });
  for (const k in BUILD) if (BUILD[k].lvl === L && BUILD[k].cat) out.push({ icon: BUILD[k].icon, name: BUILD[k].name });
  for (const b in RECIPES) for (const r of RECIPES[b]) if (r.lvl === L && BUILD[b].lvl !== L) out.push({ icon: ITEMS[r.out].icon, name: ITEMS[r.out].name + ' recipe' });
  return out;
}
