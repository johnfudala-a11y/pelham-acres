// Pelham Acres — game content. Everything balance-related lives here.

export const TW = 64, TH = 32, MAP = 42;
export const HOME_MAP = 30;   // the original farm; the rest of the map is land you buy (see LAND)

// ---------- Crops ----------
export const CROPS = {
  wheat:      { name: 'Wheat',        time: 20,  cost: 1,  sell: 3,  xp: 1,  lvl: 1,  color: '#E8B84A', icon: '🌾' },
  corn:       { name: 'Corn',         time: 45,  cost: 2,  sell: 5,  xp: 1,  lvl: 1,  color: '#F2D33C', icon: '🌽' },
  carrot:     { name: 'Carrot',       time: 60,  cost: 3,  sell: 7,  xp: 2,  lvl: 1,  color: '#EE7A2A', icon: '🥕' },
  soybean:    { name: 'Soybean',      time: 90,  cost: 4,  sell: 9,  xp: 2,  lvl: 2,  color: '#9BBF4A', icon: '🫘' },
  sugarcane:  { name: 'Sugarcane',    time: 120, cost: 5,  sell: 11, xp: 3,  lvl: 3,  color: '#7FBF6A', icon: '🎋' },
  potato:     { name: 'Potato',       time: 150, cost: 6,  sell: 13, xp: 3,  lvl: 4,  color: '#C9A26B', icon: '🥔' },
  tomato:     { name: 'Tomato',       time: 180, cost: 7,  sell: 15, xp: 4,  lvl: 5,  color: '#E2483A', icon: '🍅' },
  strawberry: { name: 'Strawberry',   time: 240, cost: 9,  sell: 19, xp: 5,  lvl: 6,  color: '#E23B5A', icon: '🍓' },
  pumpkin:    { name: 'Pumpkin',      time: 300, cost: 11, sell: 23, xp: 6,  lvl: 7,  color: '#F28C28', icon: '🎃' },
  cotton:     { name: 'Cotton',       time: 360, cost: 12, sell: 26, xp: 6,  lvl: 8,  color: '#F4F1EA', icon: '🤍' },
  sunflower:  { name: 'Sunflower',    time: 420, cost: 14, sell: 29, xp: 7,  lvl: 9,  color: '#F7C531', icon: '🌻' },
  blueberry:  { name: 'Blueberry',    time: 480, cost: 16, sell: 33, xp: 8,  lvl: 10, color: '#4C5FD0', icon: '🫐' },
  lavender:   { name: 'Lavender',     time: 540, cost: 18, sell: 37, xp: 9,  lvl: 11, color: '#A57FD8', icon: '🪻' },
  coffee:     { name: 'Coffee Beans', time: 600, cost: 20, sell: 41, xp: 10, lvl: 12, color: '#7A4B2A', icon: '🫛' },
  cocoa:      { name: 'Cocoa Pods',   time: 720, cost: 24, sell: 47, xp: 11, lvl: 13, color: '#5B3A22', icon: '🌰' },
};
export const CROP_YIELD = 2;

// ---------- Animals ----------
export const ANIMALS = {
  chicken: { name: 'Chicken', feed: 'chickenFeed', product: 'egg',  time: 60,  cost: 40,  xp: 2, icon: '🐔' },
  cow:     { name: 'Cow',     feed: 'cowFeed',     product: 'milk', time: 120, cost: 120, xp: 3, icon: '🐄' },
  sheep:   { name: 'Sheep',   feed: 'sheepFeed',   product: 'wool', time: 180, cost: 180, xp: 4, icon: '🐑' },
  goat:    { name: 'Goat',    feed: 'goatFeed',    product: 'goatMilk', time: 240, cost: 320, xp: 5, icon: '🐐' },
  pig:     { name: 'Pig',     feed: 'pigFeed',     product: 'truffle',  time: 420, cost: 480, xp: 8, icon: '🐖' },
};

// ---------- Orchard trees: plant once, then pick fruit again and again ----------
// grow = minutes until the first crop; regrow = minutes between pickings; yield = fruit per picking
export const FRUIT = {
  apple:  { name: 'Apple',  tree: 'appleTree',  grow: 45, regrow: 30, yield: 3, sell: 30, xp: 6,  icon: '🍎' },
  cherry: { name: 'Cherry', tree: 'cherryTree', grow: 60, regrow: 40, yield: 3, sell: 42, xp: 8,  icon: '🍒' },
  peach:  { name: 'Peach',  tree: 'peachTree',  grow: 75, regrow: 50, yield: 3, sell: 55, xp: 10, icon: '🍑' },
};
// ---------- Fishing: what bites at the Fishing Hut (weights add up to 100) ----------
export const FISH = {
  perch:      { name: 'Perch',       w: 46, window: 0.95, icon: '🐟' },
  trout:      { name: 'Trout',       w: 32, window: 0.8,  icon: '🐟' },
  catfish:    { name: 'Catfish',     w: 19, window: 0.7,  icon: '🐟' },
  goldenCarp: { name: 'Golden Carp', w: 3,  window: 0.5,  icon: '✨', lvl: 18 },
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
  planks:      { name: 'Planks',       icon: '🟫' },
  nails:       { name: 'Nails',        icon: '📌' },
  axe:         { name: 'Axe',          icon: '🪓' },
  pickaxe:     { name: 'Pickaxe',      icon: '⛏️' },
  fertilizer:  { name: 'Fertilizer',   icon: '🧴' },
  veggieStew:  { name: 'Veggie Stew',  icon: '🥘' },
  iceCream:    { name: 'Ice Cream',    icon: '🍨' },
  caramel:     { name: 'Caramel',      icon: '🍮' },
  muffins:     { name: 'Blueberry Muffins', icon: '🧁' },
  lavenderLatte:{ name: 'Lavender Latte', icon: '🍵' },
  iron:        { name: 'Iron Ore',     icon: '🔩' },
  gem:         { name: 'Gemstone',     icon: '💎' },
  // ---- Over the Ridge ----
  goatFeed:    { name: 'Goat Feed',    icon: '🌾' },
  pigFeed:     { name: 'Pig Feed',     icon: '🪣' },
  goatMilk:    { name: 'Goat Milk',    icon: '🥛' },
  truffle:     { name: 'Truffle',      icon: '🍄' },
  honey:       { name: 'Honey',        icon: '🍯' },
  goatCheese:  { name: 'Goat Cheese',  icon: '🧀' },
  goatSoap:    { name: 'Goat Milk Soap', icon: '🧼' },
  appleCider:  { name: 'Apple Cider',  icon: '🧃' },
  peachNectar: { name: 'Peach Nectar', icon: '🍹' },
  beeswaxCandle:{ name: 'Beeswax Candles', icon: '🕯️' },
  honeyButter: { name: 'Honey Butter', icon: '🧈' },
  applePie:    { name: 'Apple Pie',    icon: '🥧' },
  cherryPie:   { name: 'Cherry Pie',   icon: '🥧' },
  peachCobbler:{ name: 'Peach Cobbler',icon: '🍑' },
  honeyCake:   { name: 'Honey Cake',   icon: '🍰' },
  fishChowder: { name: 'Fish Chowder', icon: '🍲' },
  truffleRisotto:{ name: 'Truffle Risotto', icon: '🍚' },
  bait:        { name: 'Worm Bait',    icon: '🪱' },
};
for (const k in FRUIT) PRODUCTS[k] = { name: FRUIT[k].name, icon: FRUIT[k].icon };
for (const k in FISH) PRODUCTS[k] = { name: FISH[k].name, icon: FISH[k].icon };
// Materials and tools are kept in the toolshed, so they don't take barn space.
export const MATS = new Set(['wood', 'stone', 'planks', 'nails', 'axe', 'pickaxe', 'iron', 'gem']);

// ---------- Upgrades & mastery ----------
export const MAX_BLVL = 5;
export function upgradeCost(b, lvl) {
  const base = Math.max(60, b.cost(0));
  return { coins: Math.round(base * 0.6 * lvl + 50 * lvl), planks: lvl >= 2 ? lvl * 2 : 0, nails: lvl >= 3 ? lvl * 2 : 0, wood: 3 * lvl, stone: 2 * lvl,
           iron: lvl >= 3 ? lvl - 2 : 0, gem: lvl >= 4 ? 1 : 0 };
}
export const UPGRADE_MATS = ['wood', 'stone', 'planks', 'nails', 'iron', 'gem'];
// Crop mastery: harvests needed per star. Recipe mastery: batches made per star.
export const MASTERY = { crop: [25, 100, 300], recipe: [12, 50, 150] };
export const MASTERY_PERKS = ['10% faster', '+20% chance of a bonus', '20% faster in total'];

// ---------- Recipes per production building ----------
export const RECIPES = {
  feedMill: [
    { out: 'chickenFeed', n: 3, in: { wheat: 2, corn: 1 },               time: 20,  lvl: 1 },
    { out: 'cowFeed',     n: 3, in: { soybean: 2, corn: 1 },             time: 40,  lvl: 3 },
    { out: 'sheepFeed',   n: 3, in: { wheat: 2, soybean: 1, carrot: 1 }, time: 50,  lvl: 6 },
    { out: 'goatFeed',    n: 3, in: { wheat: 1, corn: 2, carrot: 1 },    time: 60,  lvl: 15 },
    { out: 'pigFeed',     n: 3, in: { potato: 2, corn: 1, soybean: 1 },  time: 75,  lvl: 17 },
  ],
  bakery: [
    { out: 'bread',      in: { wheat: 3 },                                    time: 45,  lvl: 2 },
    { out: 'cornbread',  in: { corn: 2, egg: 2 },                             time: 90,  lvl: 2 },
    { out: 'cookies',    in: { wheat: 2, egg: 1, brownSugar: 1 },             time: 150, lvl: 4 },
    { out: 'carrotCake', in: { carrot: 2, egg: 2, brownSugar: 1 },            time: 180, lvl: 5 },
    { out: 'pumpkinPie', in: { pumpkin: 1, egg: 2, wheat: 2, brownSugar: 1 }, time: 240, lvl: 7 },
    { out: 'muffins',    in: { wheat: 2, egg: 1, blueberry: 2 },              time: 200, lvl: 10 },
    { out: 'applePie',   in: { apple: 3, wheat: 2, butter: 1 },               time: 260, lvl: 15 },
    { out: 'honeyCake',  in: { honey: 2, egg: 2, wheat: 2 },                  time: 280, lvl: 17 },
    { out: 'cherryPie',  in: { cherry: 3, wheat: 2, brownSugar: 1 },          time: 300, lvl: 18 },
    { out: 'peachCobbler', in: { peach: 3, wheat: 1, honey: 1, butter: 1 },   time: 320, lvl: 20 },
  ],
  dairy: [
    { out: 'cream',  in: { milk: 1 }, time: 60,  lvl: 4 },
    { out: 'butter', in: { milk: 2 }, time: 90,  lvl: 4 },
    { out: 'cheese', in: { milk: 3 }, time: 150, lvl: 5 },
    { out: 'iceCream', in: { cream: 1, strawberry: 2, brownSugar: 1 }, time: 160, lvl: 7 },
  ],
  sugarMill: [
    { out: 'brownSugar',   in: { sugarcane: 1 }, time: 45,  lvl: 4 },
    { out: 'syrup',        in: { sugarcane: 2 }, time: 90,  lvl: 5 },
    { out: 'caramel',      in: { brownSugar: 2, butter: 1 }, time: 120, lvl: 6 },
    { out: 'sunflowerOil', in: { sunflower: 3 }, time: 120, lvl: 9 },
  ],
  kitchen: [
    { out: 'tomatoSauce',   in: { tomato: 3 },                    time: 90,  lvl: 5 },
    { out: 'potatoSoup',    in: { potato: 2, cream: 1 },          time: 120, lvl: 5 },
    { out: 'veggieStew',    in: { carrot: 2, potato: 2, tomato: 1 }, time: 150, lvl: 6 },
    { out: 'strawberryJam', in: { strawberry: 3, brownSugar: 1 }, time: 120, lvl: 6 },
    { out: 'blueberryJam',  in: { blueberry: 3, brownSugar: 1 },  time: 150, lvl: 10 },
    { out: 'fishChowder',   in: { perch: 1, trout: 1, potato: 1, cream: 1 }, time: 200, lvl: 16 },
    { out: 'truffleRisotto', in: { truffle: 1, goatCheese: 1, wheat: 2 }, time: 260, lvl: 19 },
  ],
  loom: [
    { out: 'yarn',           in: { wool: 2 },                      time: 120, lvl: 7 },
    { out: 'cottonFabric',   in: { cotton: 3 },                    time: 150, lvl: 8 },
    { out: 'sweater',        in: { yarn: 2 },                      time: 240, lvl: 8 },
    { out: 'lavenderSachet', in: { lavender: 2, cottonFabric: 1 }, time: 200, lvl: 11 },
  ],
  cafe: [
    { out: 'coffeeCup', in: { coffee: 2, milk: 1 },            time: 90,  lvl: 12 },
    { out: 'pancakes',  in: { wheat: 2, egg: 2, syrup: 1 },    time: 120, lvl: 12 },
    { out: 'hotCocoa',  in: { cocoa: 2, milk: 1 },             time: 120, lvl: 13 },
    { out: 'mocha',     in: { coffee: 1, cocoa: 1, cream: 1 }, time: 150, lvl: 13 },
    { out: 'lavenderLatte', in: { coffee: 1, milk: 1, lavender: 1 }, time: 120, lvl: 12 },
  ],
  workshop: [
    { out: 'axe',        n: 2, in: { wood: 1, stone: 1 }, time: 30, lvl: 3 },
    { out: 'pickaxe',    n: 2, in: { wood: 1, stone: 1 }, time: 30, lvl: 3 },
    { out: 'fertilizer', n: 2, in: { wheat: 2, carrot: 2 }, time: 45, lvl: 3 },
    { out: 'nails',      n: 2, in: { stone: 2 },      time: 60, lvl: 4 },
    { out: 'planks',     n: 2, in: { wood: 3 },       time: 60, lvl: 4 },
    { out: 'bait',       n: 4, in: { carrot: 1, wheat: 1 }, time: 40, lvl: 16 },
  ],
  ciderPress: [
    { out: 'appleCider',  in: { apple: 3 },                   time: 180, lvl: 15 },
    { out: 'peachNectar', in: { peach: 3, honey: 1 },         time: 220, lvl: 20 },
  ],
  creamery: [
    { out: 'goatCheese', in: { goatMilk: 2 },                          time: 200, lvl: 16 },
    { out: 'goatSoap',   in: { goatMilk: 1, lavender: 1, sunflowerOil: 1 }, time: 240, lvl: 16 },
  ],
  honeyHouse: [
    { out: 'honeyButter',   in: { honey: 1, butter: 1 },        time: 150, lvl: 17 },
    { out: 'beeswaxCandle', in: { honey: 2, cottonFabric: 1 },  time: 240, lvl: 17 },
  ],
};
// Items that orders never ask for (tools and building supplies)
export const NO_ORDER = new Set(['chickenFeed', 'cowFeed', 'sheepFeed', 'goatFeed', 'pigFeed', 'bait', 'goldenCarp', 'axe', 'pickaxe', 'fertilizer', 'nails', 'planks']);
for (const k in RECIPES) for (const r of RECIPES[k]) { r.n = r.n || 1; r.xp = Math.max(1, Math.round(r.time / 20)); }

// ---------- Placeable things ----------
// kind: field | storage | pen | producer | house | civic | decor | path | obstacle
const one = () => 1, inf = () => Infinity;
export const BUILD = {
  field:     { name: 'Field', cat: 'Farm', kind: 'field', w: 1, h: 1, lvl: 1, cost: n => 10 + n * 5, max: L => 6 + L * 2, icon: '🟫', desc: 'Plant crops here.' },
  barn:      { name: 'Barn', kind: 'storage', w: 2, h: 2, lvl: 999, cost: () => 0, max: one, wall: '#B8432F', roof: '#6E2A20', hgt: 36, icon: '📦', desc: 'Stores your crops and goods.' },

  coop:      { name: 'Chicken Coop',  cat: 'Animals', kind: 'pen', animal: 'chicken', cap: 5, w: 2, h: 2, lvl: 1, cost: () => 40,  max: one, ground: '#CDB37A', wall: '#D9A066', roof: '#8E5B2E', icon: '🐔', desc: 'Chickens eat Chicken Feed and lay eggs.' },
  cowshed:   { name: 'Cow Pasture',   cat: 'Animals', kind: 'pen', animal: 'cow',     cap: 5, w: 2, h: 2, lvl: 3, cost: () => 180, max: one, ground: '#A9CF6E', wall: '#E9E2D0', roof: '#5A4632', icon: '🐄', desc: 'Cows eat Cow Feed and give milk.' },
  sheepfold: { name: 'Sheep Meadow',  cat: 'Animals', kind: 'pen', animal: 'sheep',   cap: 5, w: 2, h: 2, lvl: 6, cost: () => 400, max: one, ground: '#B8D98A', wall: '#C9B48F', roof: '#4E6B3A', icon: '🐑', desc: 'Sheep eat Sheep Feed and grow wool.' },
  goatYard:  { name: 'Goat Yard',     cat: 'Animals', kind: 'pen', animal: 'goat',    cap: 5, w: 2, h: 2, lvl: 15, cost: () => 900,  mats: { planks: 8, nails: 4 }, max: one, ground: '#C8C27A', wall: '#C9A27A', roof: '#5A4632', icon: '🐐', desc: 'Goats eat Goat Feed and give goat milk.' },
  pigPen:    { name: 'Pig Pen',       cat: 'Animals', kind: 'pen', animal: 'pig',     cap: 5, w: 2, h: 2, lvl: 17, cost: () => 1400, mats: { planks: 10, nails: 6 }, max: one, ground: '#9C7A52', wall: '#B98A55', roof: '#6E4A2E', icon: '🐖', desc: 'Pigs eat Pig Feed and snuffle up truffles.' },
  beehive:   { name: 'Beehive',       cat: 'Animals', kind: 'hive', w: 1, h: 1, lvl: 16, cost: n => 500 + n * 150, max: () => 6, icon: '🐝', desc: 'Makes honey on its own; fields nearby grow 15% faster.' },

  feedMill:  { name: 'Feed Mill',        cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 1,  cost: () => 50,   max: one, wall: '#E3C16F', roof: '#6B8E23', hgt: 32, icon: '⚙️' },
  bakery:    { name: 'Bakery',           cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 2,  cost: () => 80,   max: one, wall: '#F3D9B1', roof: '#B5523B', hgt: 30, icon: '🍞' },
  workshop:  { name: 'Workshop',         cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 3,  cost: () => 150,  max: one, wall: '#C9A27A', roof: '#4F4A44', hgt: 30, icon: '🔨' },
  dairy:     { name: 'Dairy',            cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 4,  cost: () => 240,  max: one, wall: '#F7F4EC', roof: '#3A6EA5', hgt: 30, icon: '🧀' },
  sugarMill: { name: 'Sugar Mill',       cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 4,  cost: () => 280,  max: one, wall: '#E8E2D0', roof: '#9C6B3A', hgt: 34, icon: '🍬' },
  kitchen:   { name: 'Preserve Kitchen', cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 5,  cost: () => 400,  max: one, wall: '#F6E7C8', roof: '#5E8B4A', hgt: 30, icon: '🫙' },
  loom:      { name: 'Weaving Loom',     cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 7,  cost: () => 700,  max: one, wall: '#E9D8F4', roof: '#6C4A8E', hgt: 32, icon: '🧶' },
  cafe:      { name: 'Corner Café',      cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 12, cost: () => 1200, max: one, wall: '#F2E0D0', roof: '#3B2A20', hgt: 32, icon: '☕' },
  ciderPress:{ name: 'Cider Mill',       cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 15, cost: () => 2200, mats: { planks: 12, nails: 8 },  max: one, wall: '#B5523B', roof: '#5A4632', hgt: 34, icon: '🍎' },
  creamery:  { name: 'Creamery',         cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 16, cost: () => 2800, mats: { stone: 16, nails: 8 },   max: one, wall: '#F7F4EC', roof: '#7FA37A', hgt: 32, icon: '🧀' },
  honeyHouse:{ name: 'Honey House',      cat: 'Production', kind: 'producer', w: 2, h: 2, lvl: 17, cost: () => 3200, mats: { planks: 14, iron: 3 },   max: one, wall: '#E8B84A', roof: '#7A4E2A', hgt: 30, icon: '🍯' },
  fishingHut:{ name: 'Fishing Hut',      cat: 'Production', kind: 'fishing',  w: 2, h: 2, lvl: 16, cost: () => 1800, mats: { planks: 10, nails: 6 }, max: one, wall: '#8EA3B5', roof: '#A8442E', hgt: 28, icon: '🎣', desc: 'Must sit beside the river. Cast a line with worm bait.' },
  appleTree: { name: 'Apple Tree',  cat: 'Farm', kind: 'orchard', fruit: 'apple',  w: 1, h: 1, lvl: 15, cost: n => 300 + n * 60,  max: () => 12, icon: '🍎', desc: 'Plant once, pick apples again and again.' },
  cherryTree:{ name: 'Cherry Tree', cat: 'Farm', kind: 'orchard', fruit: 'cherry', w: 1, h: 1, lvl: 18, cost: n => 500 + n * 90,  max: () => 10, icon: '🍒', desc: 'Plant once, pick cherries again and again.' },
  peachTree: { name: 'Peach Tree',  cat: 'Farm', kind: 'orchard', fruit: 'peach',  w: 1, h: 1, lvl: 20, cost: n => 700 + n * 120, max: () => 8,  icon: '🍑', desc: 'Plant once, pick peaches again and again.' },

  cottage:   { name: 'Cottage',     cat: 'Town', kind: 'house', rent: 8,   period: 60,  w: 2, h: 2, lvl: 2,  cost: () => 100,  max: () => 4, wall: '#F4E3C1', roof: '#B04A3A', hgt: 28, icon: '🏠' },
  farmhouse: { name: 'Farmhouse',   cat: 'Town', kind: 'house', rent: 20,  period: 90,  w: 2, h: 2, lvl: 5,  cost: () => 320,  max: () => 3, wall: '#E9D3A8', roof: '#46626F', hgt: 34, icon: '🏡' },
  townhouse: { name: 'Townhouse',   cat: 'Town', kind: 'house', rent: 50,  period: 120, w: 2, h: 2, lvl: 9,  cost: () => 850,  max: () => 3, wall: '#D8B4A0', roof: '#2F3E46', hgt: 46, icon: '🏘️' },
  manor:     { name: 'Manor House', cat: 'Town', kind: 'house', rent: 140, period: 180, w: 3, h: 3, lvl: 13, cost: () => 2400, max: one,      wall: '#F1EDE2', roof: '#4E3B31', hgt: 50, icon: '🏰' },
  townHall:     { name: 'Town Hall',     cat: 'Town', kind: 'civic', charm: 10, w: 3, h: 3, lvl: 4,  cost: () => 350,  mats: { wood: 8, stone: 8 },   max: one, wall: '#EDE3CF', roof: '#7A2E2E', hgt: 52, icon: '🏛️' },
  generalStore: { name: 'General Store', cat: 'Town', kind: 'civic', charm: 6,  w: 2, h: 2, lvl: 6,  cost: () => 550,  mats: { planks: 6, nails: 4 },  max: one, wall: '#CFE3D4', roof: '#2E6B4F', hgt: 34, icon: '🏪' },
  schoolhouse:  { name: 'Schoolhouse',   cat: 'Town', kind: 'civic', charm: 8,  w: 3, h: 2, lvl: 8,  cost: () => 850,  mats: { planks: 10, nails: 8 }, max: one, wall: '#C94C3C', roof: '#3E3A36', hgt: 38, icon: '🏫' },
  clockTower:   { name: 'Clock Tower',   cat: 'Town', kind: 'civic', charm: 10, w: 2, h: 2, lvl: 10, cost: () => 1100, mats: { stone: 24, nails: 10, iron: 4 }, max: one, wall: '#D9CBB0', roof: '#4B4F5A', hgt: 84, icon: '🕰️' },
  bandstand:    { name: 'Bandstand',     cat: 'Town', kind: 'civic', charm: 8,  w: 2, h: 2, lvl: 11, cost: () => 1400, mats: { planks: 16 },            max: one, wall: '#FFFFFF', roof: '#2F6E8E', hgt: 22, icon: '🎶' },
  glasshouse:   { name: "May's Glasshouse", cat: 'Town', kind: 'civic', charm: 15, w: 3, h: 3, lvl: 20, cost: () => 6000, mats: { planks: 20, iron: 8, gem: 4 }, max: one, wall: '#EAF2EE', roof: '#9FC3B8', hgt: 54, icon: '🌿',
                  needs: 'bp_glasshouse', needsText: 'Plans found at Misty Ridge', desc: 'Great-Aunt May\'s dream. +15 charm, and every crop grows 10% faster.' },

  station:      { name: 'Train Station', cat: 'Town', kind: 'station', w: 3, h: 2, lvl: 5, cost: () => 400, mats: { planks: 4, nails: 2 }, max: one, wall: '#B9573F', roof: '#3D4A57', hgt: 34, icon: '🚂', desc: 'Freight trains bring big contracts.' },

  path:    { name: 'Cobble Path', cat: 'Decor', kind: 'path',  w: 1, h: 1, lvl: 1, cost: () => 2,   max: inf, icon: '⬜' },
  gravel:  { name: 'Gravel Road', cat: 'Decor', kind: 'path',  w: 1, h: 1, lvl: 1, cost: () => 1,   max: inf, icon: '🪨', desc: 'A crunchy gravel road.' },
  dirt:    { name: 'Dirt Road',   cat: 'Decor', kind: 'path',  w: 1, h: 1, lvl: 1, cost: () => 1,   max: inf, icon: '🟫', desc: 'A packed dirt farm road.' },
  fence:   { name: 'Fence',       cat: 'Decor', kind: 'decor', w: 1, h: 1, lvl: 1, cost: () => 5,   max: inf, charm: 0, icon: '🚧' },
  flowers: { name: 'Flower Bed',  cat: 'Decor', kind: 'decor', w: 1, h: 1, lvl: 2, cost: () => 15,  max: inf, charm: 1, icon: '🌷' },
  hedge:   { name: 'Hedge',       cat: 'Decor', kind: 'decor', w: 1, h: 1, lvl: 3, cost: () => 20,  max: inf, charm: 1, icon: '🌿' },
  bench:   { name: 'Bench',       cat: 'Decor', kind: 'decor', w: 1, h: 1, lvl: 4, cost: () => 30,  max: inf, charm: 1, icon: '🪑' },
  lamp:    { name: 'Lamp Post',   cat: 'Decor', kind: 'decor', w: 1, h: 1, lvl: 5, cost: () => 35,  max: inf, charm: 1, icon: '🏮' },
  pond:    { name: 'Duck Pond',   cat: 'Decor', kind: 'decor', w: 2, h: 2, lvl: 6, cost: () => 150, max: inf, charm: 4, icon: '🦆' },
  gazebo:  { name: 'Garden Gazebo', cat: 'Decor', kind: 'decor', w: 2, h: 2, lvl: 5,  cost: () => 300, mats: { planks: 6 },          max: one, charm: 6, icon: '⛲', needs: 'bp_gazebo',   needsText: 'Blueprint found in the Whispering Woods', wall: '#FFFFFF', roof: '#5E8B4A', hgt: 20 },
  fountain:{ name: 'Town Fountain', cat: 'Decor', kind: 'decor', w: 2, h: 2, lvl: 8,  cost: () => 500, mats: { stone: 12, gem: 1 }, max: one, charm: 8, icon: '⛲', needs: 'bp_fountain', needsText: 'Blueprint found in the Copper Hills' },
  windmill:{ name: 'Old Windmill',  cat: 'Decor', kind: 'decor', w: 2, h: 2, lvl: 11, cost: () => 700, mats: { planks: 10, iron: 3 }, max: one, charm: 8, icon: '🌬️', needs: 'bp_windmill', needsText: 'Blueprint found at Lantern Lake', wall: '#E9E2D0', roof: '#8E5B2E', hgt: 56 },

  tree: { name: 'Tree', kind: 'obstacle', w: 1, h: 1, clear: 20, drop: 'wood',  icon: '🌳' },
  rock: { name: 'Rock', kind: 'obstacle', w: 1, h: 1, clear: 35, drop: 'stone', icon: '🪨' },
  water: { name: 'River', kind: 'water', w: 1, h: 1, icon: '🌊' },
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
for (const k in FRUIT) VALUE[k] = FRUIT[k].sell;
VALUE.wood = 6; VALUE.stone = 8; VALUE.iron = 25; VALUE.gem = 60;
VALUE.honey = 40; VALUE.truffle = 110; VALUE.perch = 34; VALUE.trout = 52; VALUE.catfish = 78; VALUE.goldenCarp = 400;
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

// ---------- Seasons (each lasts one real day, cycling) ----------
export const SEASON_MS = 24 * 3600 * 1000;
export const SEASONS = [
  { name: 'Spring', icon: '🌸', crops: ['wheat', 'carrot', 'strawberry', 'lavender', 'honey'],
    ground: ['#93C75C', '#8EC257'], bg: '#64934A', leaf: ['#4E8F35', '#6BB247'], accent: '#F4B6C8' },
  { name: 'Summer', icon: '☀️', crops: ['corn', 'tomato', 'sunflower', 'blueberry', 'sugarcane', 'cherry', 'peach'],
    ground: ['#8BBD52', '#86B84F'], bg: '#5E8C3E', leaf: ['#3E7D2E', '#58A03C'], accent: '#E2483A' },
  { name: 'Fall', icon: '🍂', crops: ['pumpkin', 'potato', 'soybean', 'cotton', 'apple'],
    ground: ['#A9B75E', '#A3B158'], bg: '#7A8A45', leaf: ['#C8642A', '#E39A35'], accent: '#B8432F' },
  { name: 'Winter', icon: '❄️', crops: ['cocoa', 'coffee', 'carrot', 'potato'],
    ground: ['#E9EFF3', '#E1E9EE'], bg: '#BFCBD3', leaf: ['#3E6B4A', '#F4F7FA'], accent: '#FFFFFF' },
];
export const IN_SEASON_SPEED = 0.75;   // in-season crops grow 25% faster
export const IN_SEASON_BONUS = 1.2;    // and pay 20% more in orders

// ---------- Freight train ----------
export const TRAIN = { stay: 45 * 60000, away: 15 * 60000, crates: 6 };

// ---------- Land for sale: the map beyond the original farm, bought a parcel at a time ----------
// x0..x1 / y0..y1 are inclusive grid squares.
export const LAND = [
  { id: 'orchard', name: 'Orchard Hill', x0: 30, x1: 41, y0: 0, y1: 29, lvl: 15, coins: 6000, mats: { planks: 10, nails: 6 },
    blurb: 'A sunny south-facing slope east of the farm. Great-Aunt May always said fruit trees would love it.' },
  { id: 'riverside', name: 'Riverside', x0: 30, x1: 41, y0: 30, y1: 41, lvl: 16, coins: 9000, mats: { planks: 12, stone: 12 },
    blurb: 'Where the Pelham River bends past the farm. Cool water, tall reeds and fish rising in the evening.' },
  { id: 'pasture', name: 'North Pasture', x0: 0, x1: 29, y0: 30, y1: 41, lvl: 17, coins: 12000, mats: { planks: 14, nails: 10, iron: 2 },
    blurb: 'Rolling grazing land past the old stone wall: room for goats, pigs and anything else you dream up.' },
];
// The Pelham River: a smooth curve through Riverside, entering at the east edge and leaving at the south edge.
const RIVER_CTRL = [[43.5, 30.6], [40.5, 32.4], [38, 32.8], [35.8, 35.2], [34.6, 37.6], [32.4, 39.2], [31.6, 43.5]];
export const RIVER_W = 2.3;   // width in squares
export const RIVER = (() => {   // Catmull-Rom through the control points
  const out = [], P = RIVER_CTRL;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < 12; k++) {
      const t = k / 12, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(P[P.length - 1]);
  return out;
})();
export function riverDist(x, y) {
  let best = 1e9;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, ay] = RIVER[i], [bx, by] = RIVER[i + 1], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}
export const landAt = (x, y) => LAND.find(l => x >= l.x0 && x <= l.x1 && y >= l.y0 && y <= l.y1) || null;

// XP needed to go from level L to L+1 (×1.2: every level takes 20% more than the original curve)
export const XP_SCALE = globalThis.PA_XP_SCALE ?? 1.2; // (overridable only by the balance simulator)
export const xpFor = L => Math.round((10 * Math.pow(L, 1.6) + 12) * XP_SCALE);

// What unlocks at a level (for the level-up screen and shop).
export function unlocksAt(L) {
  const out = [];
  for (const k in CROPS) if (CROPS[k].lvl === L) out.push({ id: k, icon: CROPS[k].icon, name: CROPS[k].name + ' (crop)' });
  for (const l of LAND) if (l.lvl === L) out.push({ id: 'landDeed', icon: '📜', name: l.name + ' (land for sale)' });
  for (const k in BUILD) if (BUILD[k].lvl === L && BUILD[k].cat) out.push({ id: k, icon: BUILD[k].icon, name: BUILD[k].name });
  for (const b in RECIPES) for (const r of RECIPES[b]) if (r.lvl === L && BUILD[b].lvl !== L) out.push({ id: r.out, icon: ITEMS[r.out].icon, name: ITEMS[r.out].name + ' recipe' });
  return out;
}
