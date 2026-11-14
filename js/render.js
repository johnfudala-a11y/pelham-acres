// Pelham Acres — isometric canvas renderer. Placeholder art drawn in code;
// later each type can be swapped for an AI-generated sprite via SPRITES.
import { TW, TH, MAP, BUILD, CROPS, ITEMS, LAND, FRUIT, RIVER, RIVER_W } from './data.js';
import { S, now, fieldReady, jobsDone, animalState, rentDue, penAnimal, season, trainState, ownsLand, honeyDue, treeReady, treeMature, fruitGrow, fruitRegrow } from './game.js';
import { setNavGrid, planTo, wander, stepWalker, isWalking, unstick, walkable } from './nav.js';
import { roadTexture, ROAD_TEX, ROAD_STYLE } from './roads.js';
import { drawTrainScene } from './train.js';

export const cam = { x: 0, y: 0, z: 1 };
export const view = { ghost: null, floaters: [], plantCrop: null, guide: null };
// ---------- AI-painted sprites ----------
// k = width as a fraction of the footprint's diamond width; dy = nudge of the bottom edge.
export const SPRITES = {};
const SPRITE_CFG = {
  // every picture fits inside its own ground space (k <= 1), so neighbours never overlap side-to-side
  // iso: painted at the grid's isometric angle, so the picture's bottom corner sits on the footprint's front corner
  // (windmill: body only; its sails are drawn turning on top)
  barn: { k: 1, iso: 1 }, feedMill: { k: 1, iso: 1 }, bakery: { k: 1, iso: 1 }, workshop: { k: 1, iso: 1 }, dairy: { k: 1, iso: 1 }, sugarMill: { k: 1, iso: 1 },
  kitchen: { k: 1, iso: 1 }, loom: { k: 1, iso: 1 }, cafe: { k: 1, iso: 1 },
  cottage: { k: 1, iso: 1 }, farmhouse: { k: 1, iso: 1 }, townhouse: { k: 0.85, iso: 1 }, manor: { k: 1, iso: 1 },
  townHall: { k: 1, iso: 1 }, generalStore: { k: 1, iso: 1 }, schoolhouse: { k: 1, iso: 1 }, clockTower: { k: 0.62, iso: 1 }, bandstand: { k: 1, iso: 1 }, station: { k: 1, iso: 1 },
  flowers: { k: 0.92 }, hedge: { k: 0.85 }, bench: { k: 0.88 }, lamp: { k: 0.4 }, pond: { k: 0.97 }, gazebo: { k: 1, iso: 1 }, fountain: { k: 1, iso: 1 }, windmill: { k: 0.55, iso: 1 },
  ciderPress: { k: 1, iso: 1 }, creamery: { k: 1, iso: 1 }, honeyHouse: { k: 1, iso: 1 }, fishingHut: { k: 1.04, iso: 1 }, glasshouse: { k: 1, iso: 1 }, beehive: { k: 0.62 },
};
const SPRITE_NAMES = [...Object.keys(SPRITE_CFG), 'coop', 'cowshed', 'sheepfold', 'goatYard', 'pigPen', 'goat', 'pig', 'sign-sale',
  ...['apple', 'cherry', 'peach'].flatMap(f => ['tree-' + f, 'tree-' + f + '-bare']), 'tree-sapling', 'tree-blossom', 'tree-spring', 'tree-summer', 'tree-fall', 'tree-winter', 'rock',
  'chicken', 'cow', 'sheep', 'ollie', 'ollie-sleep', 'ollie-belly', 'milo', 'milo-sleep', 'milo-pounce', 'ollie-w1', 'ollie-w2', 'milo-r1', 'milo-r2', 'milo-sit','p-hattie', 'p-joe', 'p-dottie', 'p-tom', 'p-rosa', 'p-finch', 'p-ellis',
  'soil', 'sprout', 'growing', ...Object.keys(CROPS).map(c => 'crop-' + c),
  'tex-grass', 'tex-forest', 'windmill-sails', ...['buttercup', 'violet', 'clover', 'pebbles', 'mushroom', 'dirt', 'dandelion', 'log', 'shrub', 'duck', 'mallard', 'butterfly1', 'butterfly2', 'bird', 'reeds', 'lilypads'].map(n => 'dc-' + n),
  'p-bea', 'p-hank', ...['hattie', 'joe', 'dottie', 'tom', 'rosa', 'finch', 'ellis', 'bea', 'hank'].flatMap(id => ['p-' + id + '-w1', 'p-' + id + '-w2'])];
export function loadSprites() {
  const load = (n, tries) => {
    const im = new Image();
    im.decoding = 'async';
    im.onerror = () => { if (tries < 3) setTimeout(() => load(n, tries + 1), 800 * (tries + 1)); else delete SPRITES[n]; };
    im.src = `sprites/${n}.webp${tries ? '?r=' + tries : ''}`;
    SPRITES[n] = im;
  };
  for (const n of SPRITE_NAMES) load(n, 0);
}
// share of the map pictures that have arrived (for the loading screen)
export function spriteProgress() { let n = 0; for (const k of SPRITE_NAMES) { const s = SPRITES[k]; if (!s || s.complete) n++; } return n / SPRITE_NAMES.length; }
const spr = n => { const s = SPRITES[n]; return s && s.complete && s.naturalWidth ? s : null; };
// draw an image with its bottom-centre at (cx, by), given width; flip mirrors horizontally
function drawSprite(im, cx, by, w, flip, noShadow) {
  const h = w * im.naturalHeight / im.naturalWidth;
  if (!noShadow) {
    ctx.fillStyle = 'rgba(30,40,10,0.22)';
    ctx.beginPath(); ctx.ellipse(cx + w * 0.04, by - 3, w * 0.46, w * 0.16, 0, 0, 7); ctx.fill();
  }
  if (flip) { ctx.save(); ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, by - h, w, h); ctx.restore(); }
  else ctx.drawImage(im, cx - w / 2, by - h, w, h);
  return h;
}
const footW = b => (b.w + b.h) * hw;

let cv, ctx, W = 0, H = 0, dpr = 1;
const hw = TW / 2, hh = TH / 2;
const P = (gx, gy) => [(gx - gy) * hw, (gx + gy) * hh];
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

export function initRender(c) { cv = c; ctx = c.getContext('2d'); resize(); addEventListener('resize', resize); }
export function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  clampCam();
}
export const screenSize = () => ({ W, H });
export function centerOn(gx, gy) { const [px, py] = P(gx, gy); cam.x = -px * cam.z; cam.y = -py * cam.z; clampCam(); }
export function s2w(sx, sy) {
  const x = (sx - W / 2 - cam.x) / cam.z / hw, y = (sy - H / 2 - cam.y) / cam.z / hh;
  return { x: (x + y) / 2, y: (y - x) / 2 };
}
export function w2s(px, py) { return { x: px * cam.z + W / 2 + cam.x, y: py * cam.z + H / 2 + cam.y }; }
export function tileCenterScreen(gx, gy) { const [px, py] = P(gx, gy); return w2s(px, py); }
export function zoomAt(sx, sy, f) {
  const nz = Math.max(0.45, Math.min(2.4, cam.z * f)), k = nz / cam.z;
  cam.x = sx - W / 2 - (sx - W / 2 - cam.x) * k;
  cam.y = sy - H / 2 - (sy - H / 2 - cam.y) * k;
  cam.z = nz; clampCam();
}
export function clampCam() {
  const lx = MAP * hw * cam.z, ly = MAP * TH * cam.z;
  cam.x = Math.max(-lx, Math.min(lx, cam.x));
  cam.y = Math.max(-ly, Math.min(0, cam.y));
}
// a "+3" that floats up and fades; `item` adds its painted picture beside the number
export function floater(gx, gy, text, color = '#fff', item) {
  const [px, py] = P(gx, gy);
  const icon = item ? (item === 'coin' ? 'icon-coin' : CROPS[item] ? 'crop-' + item : 'icon-' + item) : null;
  view.floaters.push({ px, py, text, color, icon, t0: performance.now() });
}

// ---------- color helpers ----------
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = (n >> 8 & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}
function poly(pts, fill, stroke) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
const up = (p, h) => [p[0], p[1] - h];
function diamond(x, y, w, h, inset = 0) {
  const T = P(x, y), R = P(x + w, y), B = P(x + w, y + h), L = P(x, y + h);
  if (!inset) return [T, R, B, L];
  return [[T[0], T[1] + inset], [R[0] - inset * 2, R[1]], [B[0], B[1] - inset], [L[0] + inset * 2, L[1]]];
}
function emoji(ch, x, y, size) {
  ctx.font = `${size}px ${EMOJI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ch, x, y);
}
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; }

// ---------- geometry ----------
function heightOf(o) {
  const b = BUILD[o.t];
  const cfg = SPRITE_CFG[o.t], im = cfg && spr(o.t);
  if (im) return footW(b) * cfg.k * im.naturalHeight / im.naturalWidth - (b.w + b.h) * hh * 0.5;
  if (b.kind === 'obstacle') return o.t === 'tree' ? (spr('tree-summer') ? 68 : 52) : (spr('rock') ? 32 : 22);
  if (b.kind === 'pen') return 36;
  if (b.kind === 'decor') return o.t === 'lamp' ? 40 : o.t === 'windmill' ? 100 : o.t === 'gazebo' ? 50 : o.t === 'fountain' ? 36 : 18;
  if (b.kind === 'field') return o.crop ? 30 : 0;
  if (b.kind === 'path' || b.kind === 'water') return 0;
  if (b.kind === 'orchard') return treeMature(o) ? 66 : 44;
  return (b.hgt || 30) + 18 + (b.w + b.h) * 3;
}
// fields join the depth-sorted pass once crops are painted (ripe crops stand up off the ground)
const isFlat = o => { const k = BUILD[o.t].kind; return k === 'path' || k === 'water' || (k === 'field' && !spr('soil')); };

// ---------- drawing primitives per kind ----------
function drawBox(x, y, w, h, hgt, wall, roof, roofH, icon) {
  const T = P(x, y), R = P(x + w, y), B = P(x + w, y + h), L = P(x, y + h);
  // shadow
  poly([[T[0] + 8, T[1] + 4], [R[0] + 10, R[1] + 4], [B[0] + 8, B[1] + 6], [L[0] + 6, L[1] + 4]], 'rgba(0,0,0,0.13)');
  poly([L, B, up(B, hgt), up(L, hgt)], shade(wall, -28));
  poly([B, R, up(R, hgt), up(B, hgt)], shade(wall, -8));
  const Tu = up(T, hgt), Ru = up(R, hgt), Bu = up(B, hgt), Lu = up(L, hgt);
  const A = [(Tu[0] + Bu[0]) / 2, (Tu[1] + Bu[1]) / 2 - roofH];
  // eaves overhang
  const ex = 4;
  const Le = [Lu[0] - ex, Lu[1] + 2], Re = [Ru[0] + ex, Ru[1] + 2], Be = [Bu[0], Bu[1] + 4], Te = [Tu[0], Tu[1] - 1];
  poly([Te, Re, A], shade(roof, 18)); poly([Le, Te, A], shade(roof, 8));
  poly([Le, Be, A], shade(roof, -14)); poly([Be, Re, A], roof);
  // door on left face
  const mx = (L[0] + B[0]) / 2, my = (L[1] + B[1]) / 2;
  poly([[mx - 6, my - 3], [mx + 6, my + 3], [mx + 6, my + 3 - Math.min(18, hgt * 0.6)], [mx - 6, my - 3 - Math.min(18, hgt * 0.6)]], shade(roof, -30));
  // windows on right face
  const wy = Math.min(hgt * 0.62, hgt - 8);
  for (const f of [0.3, 0.7]) {
    const wx = B[0] + (R[0] - B[0]) * f, wyy = B[1] + (R[1] - B[1]) * f - wy;
    poly([[wx - 4, wyy + 2], [wx + 4, wyy - 2], [wx + 4, wyy - 10], [wx - 4, wyy - 6]], '#FFF3C4');
  }
  if (icon) {
    ctx.fillStyle = 'rgba(255,250,235,0.95)';
    const sx = (L[0] + mx) / 2 - 2, sy = (L[1] + my) / 2 - hgt * 0.62;
    ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.fill();
    emoji(icon, sx, sy + 1, 11);
  }
}

function drawField(o, t) {
  const soil = spr('soil');
  if (soil) {
    const [cx, cy] = P(o.x + 0.5, o.y + 0.5), top = P(o.x, o.y)[1];
    // paint the soil texture flat into this tile's diamond only (no raised edge, no spill onto neighbours)
    const tile = diamond(o.x, o.y, 1, 1, 1.5);
    ctx.save();
    poly(tile, '#7A5230');
    ctx.clip();
    const sw = TW * 1.12, sh = sw * soil.naturalHeight / soil.naturalWidth;
    ctx.drawImage(soil, cx - sw / 2, top - sh * 0.06, sw, sh);
    ctx.restore();
    poly(tile, null, 'rgba(60,35,15,.45)');
    if (!o.crop) return;
    const p = Math.min(1, (t - o.start) / Math.max(1, o.end - o.start));
    const ripe = p >= 1 && spr('crop-' + o.crop);
    // plants stand on the middle of their own plot
    // a breeze ripples across the fields: each plant leans with the wave as it passes
    const lean = Math.sin(t / 900 - (o.x + o.y) * 0.55) * 0.07 + Math.sin(t / 2300 + o.id) * 0.02;
    if (ripe) {
      ctx.save(); ctx.translate(cx, cy + 9); ctx.transform(1, 0, -lean, 1, 0, 0);
      drawSprite(ripe, 0, 0, 46, (o.id & 1) === 1, true);
      ctx.restore();
      if (((t / 900 + o.id) % 3) < 0.25) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(cx + 12, cy - 22, 2.2, 0, 7); ctx.fill(); }
      return;
    }
    const stage = spr(p < 0.4 ? 'sprout' : 'growing');
    if (stage) {
      const w = p < 0.4 ? 26 + p * 15 : 32 + p * 10;
      ctx.save(); ctx.translate(cx, cy + 7); ctx.transform(1, 0, -lean * 0.7, 1, 0, 0); drawSprite(stage, 0, 0, w, (o.id & 1) === 1, true); ctx.restore();
      return;
    }
  }
  const pts = diamond(o.x, o.y, 1, 1, 2);
  poly(pts, '#8A5A2E', 'rgba(60,35,15,.4)');
  const [cx, cy] = P(o.x + 0.5, o.y + 0.5);
  ctx.strokeStyle = 'rgba(60,35,15,.35)'; ctx.lineWidth = 1.5;
  for (const f of [-0.25, 0, 0.25]) {
    const a = P(o.x + 0.15, o.y + 0.5 + f), b = P(o.x + 0.85, o.y + 0.5 + f);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  if (!o.crop) return;
  const cr = CROPS[o.crop];
  const p = Math.min(1, (t - o.start) / Math.max(1, o.end - o.start));
  const ready = p >= 1;
  const spots = [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7], [0.5, 0.5]];
  for (const [fx, fy] of spots) {
    const [sx, sy] = P(o.x + fx, o.y + fy);
    const hgt = 4 + 12 * p;
    ctx.strokeStyle = '#3F7A2A'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - hgt); ctx.stroke();
    ctx.fillStyle = ready ? cr.color : (p > 0.5 ? '#6FA845' : '#7DBB4E');
    ctx.beginPath(); ctx.ellipse(sx, sy - hgt, 3 + 3 * p, 2 + 2.5 * p, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (ready) {
    const bob = Math.sin(t / 300 + o.id) * 2;
    emoji(cr.icon, cx, cy - 26 + bob, 16);
  }
}

// ---------- roads: cobble, gravel and dirt, textured in perspective and joined seamlessly ----------
let roadAt = new Map();
const isRoad = (x, y) => roadAt.has(x * 1000 + y);
let fenceAt = new Set();
function indexRoads() {
  roadAt = new Map(); fenceAt = new Set();
  waterAt = new Set();
  for (const o of S.objs) { if (BUILD[o.t].kind === 'path') roadAt.set(o.x * 1000 + o.y, o.t); else if (o.t === 'fence') fenceAt.add(o.x * 1000 + o.y); else if (o.t === 'water') waterAt.add(o.x * 1000 + o.y); }
}
const roadPat = {};
function roadPattern(t) {
  if (roadPat[t] !== undefined) return roadPat[t];
  const p = ctx.createPattern(roadTexture(t), 'repeat');
  if (p && p.setTransform) { p.setTransform(new DOMMatrix([2 / ROAD_TEX, 0, 0, 2 / ROAD_TEX, 0, 0])); return (roadPat[t] = p); }
  return (roadPat[t] = null);
}
// gentle, stable wobble for ragged road edges (same value for the same spot on the map)
const wob = (u, v) => 0.5 + 0.25 * Math.sin(u * 23.7 + v * 11.3) + 0.15 * Math.sin(u * 61.1 - v * 47.9) + 0.1 * Math.sin(u * 7.3 + v * 19.1);
// the four sides of a tile in grid space: start corner, end corner, inward direction, neighbour offset
const SIDES = [[[0, 0], [1, 0], [0, 1], [0, -1]], [[1, 0], [1, 1], [-1, 0], [1, 0]], [[1, 1], [0, 1], [0, -1], [0, 1]], [[0, 1], [0, 0], [1, 0], [-1, 0]]];
const TUFT_COL = { Spring: ['#6FAE3E', '#8CC152', '#558F31'], Summer: ['#5E9A35', '#7DB246', '#4A7F2A'], Fall: ['#9C9A3E', '#B5A24A', '#7E7E33'], Winter: ['#E8EEF2', '#C9D3D8', '#AEB9BF'] };
function drawPath(o) {
  const st = ROAD_STYLE[o.t] || ROAD_STYLE.path, x = o.x, y = o.y, se = season();
  const open = SIDES.map(sd => !isRoad(x + sd[3][0], y + sd[3][1]));
  // outline: open sides pulled in a little (ragged for gravel and dirt), joined sides pushed out a hair to hide seams
  const pts = [];
  SIDES.forEach((sd, i) => {
    const [a, b, n] = sd, steps = open[i] && st.ragged ? 6 : 1;
    for (let k = 0; k <= steps; k++) {
      const f = k / steps, u = x + a[0] + (b[0] - a[0]) * f, v = y + a[1] + (b[1] - a[1]) * f;
      const off = open[i] ? st.inset + st.ragged * (k === 0 || k === steps ? 0.5 : wob(u, v)) : -0.006;
      pts.push([u + n[0] * off, v + n[1] * off]);
    }
  });
  ctx.save();
  ctx.transform(hw, hh, -hw, hh, 0, 0);          // draw in grid space so the texture lies flat on the ground
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath();
  const pat = roadPattern(o.t);
  if (pat) { ctx.fillStyle = pat; ctx.fill(); ctx.clip(); }
  else { ctx.clip(); ctx.drawImage(roadTexture(o.t), x - (x % 2), y - (y % 2), 2, 2); }
  // a soft rim along open edges so the road sits down into the grass
  SIDES.forEach((sd, i) => {
    if (!open[i]) return;
    const [a, , n] = sd, e0 = [x + a[0] + n[0] * st.inset, y + a[1] + n[1] * st.inset];
    const g = ctx.createLinearGradient(e0[0], e0[1], e0[0] + n[0] * 0.16, e0[1] + n[1] * 0.16);
    g.addColorStop(0, st.rim); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 0.1, y - 0.1, 1.2, 1.2);
  });
  if (se.name === 'Winter') { ctx.fillStyle = 'rgba(240,245,250,.42)'; ctx.fillRect(x - 0.1, y - 0.1, 1.2, 1.2); }
  else if (se.name === 'Fall') { ctx.fillStyle = 'rgba(190,120,40,.08)'; ctx.fillRect(x - 0.1, y - 0.1, 1.2, 1.2); }
  ctx.restore();
  // little grass tufts creeping over the open edges
  const cols = TUFT_COL[se.name] || TUFT_COL.Summer;
  ctx.lineCap = 'round';
  SIDES.forEach((sd, i) => {
    if (!open[i]) return;
    const [a, b, n] = sd, count = Math.round(st.tuft * 2 + hash(o.x * 97 + o.y * 13 + i) * 1.6);
    for (let k = 0; k < count; k++) {
      const f = 0.15 + 0.7 * hash(o.x * 31 + o.y * 17 + i * 7 + k * 5), u = x + a[0] + (b[0] - a[0]) * f + n[0] * st.inset, v = y + a[1] + (b[1] - a[1]) * f + n[1] * st.inset;
      const [px, py] = P(u, v), s = 0.8 + hash(k * 11 + o.x + o.y * 3) * 0.6;
      for (let j = 0; j < 5; j++) {
        const ang = -Math.PI / 2 + (j - 2) * 0.38 + (hash(j + k * 9 + o.x) - 0.5) * 0.3, len = (3.2 + hash(j * 3 + k + o.y) * 2.6) * s;
        ctx.strokeStyle = cols[j % 3]; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(px + (j - 2) * 0.9, py + 1);
        ctx.quadraticCurveTo(px + (j - 2) * 0.9 + Math.cos(ang) * len * 0.4, py + Math.sin(ang) * len * 0.6, px + (j - 2) * 0.9 + Math.cos(ang) * len, py + 1 + Math.sin(ang) * len);
        ctx.stroke();
      }
    }
  });
}

// ---------- the Pelham River: one smooth curve with muddy banks, drifting ripples and lily pads ----------
let waterAt = new Set();
const isWater = (x, y) => waterAt.has(x * 1000 + y);
let riverPath = null;
function drawRiver(pt, vis) {
  if (!waterAt.size) return;
  if (!riverPath) { riverPath = new Path2D(); RIVER.forEach(([x, y], i) => i ? riverPath.lineTo(x, y) : riverPath.moveTo(x, y)); }
  const win = season().name === 'Winter';
  ctx.save();
  ctx.transform(hw, hh, -hw, hh, 0, 0);          // grid space
  ctx.beginPath(); ctx.rect(0, 0, MAP, MAP); ctx.clip();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(70,58,30,.35)'; ctx.lineWidth = RIVER_W + 0.55; ctx.stroke(riverPath);     // damp edge
  ctx.strokeStyle = '#8C7A55'; ctx.lineWidth = RIVER_W + 0.3; ctx.stroke(riverPath);                 // muddy bank
  ctx.strokeStyle = win ? '#A9C6D8' : '#3F82A6'; ctx.lineWidth = RIVER_W - 0.05; ctx.stroke(riverPath); // deep water
  ctx.strokeStyle = win ? '#C4DAE6' : '#5A9FC0'; ctx.lineWidth = RIVER_W - 0.7; ctx.stroke(riverPath);  // lighter middle
  ctx.strokeStyle = win ? 'rgba(255,255,255,.45)' : 'rgba(150,205,228,.55)'; ctx.lineWidth = 0.5; ctx.stroke(riverPath);
  if (!win) {   // ripples drifting downstream
    ctx.setLineDash([0.35, 1.4]); ctx.lineDashOffset = -pt / 900;
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 0.06; ctx.stroke(riverPath);
    ctx.setLineDash([0.2, 2.1]); ctx.lineDashOffset = -pt / 700 + 0.9;
    ctx.save(); ctx.translate(0.45, -0.25); ctx.stroke(riverPath); ctx.restore();
    ctx.save(); ctx.translate(-0.4, 0.3); ctx.lineDashOffset = -pt / 1100 + 0.4; ctx.stroke(riverPath); ctx.restore();
    ctx.setLineDash([]);
  }
  ctx.restore();
  // lily pads here and there on calm water
  const lp = spr('dc-lilypads');
  if (lp && !win) for (const k of waterAt) {
    const x = Math.floor(k / 1000), y = k % 1000; if (hash(x * 17 + y * 131) > 0.2) continue;
    const [cx, cy] = P(x + 0.5, y + 0.5); if (!vis(cx, cy)) continue;
    drawSprite(lp, cx + Math.sin(pt / 2600 + x) * 1.5, cy + 6, 28, hash(x + y) < 0.5, true);
  }
}
// ---------- orchard trees: sapling → blossom → leafy → laden with fruit ----------
function drawOrchard(o, t) {
  const f = BUILD[o.t].fruit, [cx, cy] = P(o.x + 0.5, o.y + 0.5), sway = Math.sin(t / 1100 + o.id) * 0.8;
  let name;
  if (!treeMature(o)) name = (o.ready - t) > fruitGrow(f) * 500 ? 'tree-sapling' : 'tree-blossom';
  else name = treeReady(o) ? 'tree-' + f : 'tree-' + f + '-bare';
  const im = spr(name);
  const w = name === 'tree-sapling' || name === 'tree-blossom' ? 36 : 54;
  if (im) drawSprite(im, cx + sway * 0.4, cy + 9, w, (o.id & 1) === 1);
  else emoji(FRUIT[f].icon, cx, cy - 12, 18);
  if (treeReady(o) && ((t / 900 + o.id) % 3) < 0.25) { ctx.fillStyle = 'rgba(255,255,255,.9)'; star(cx + 10, cy - 38, 3); }
}
// ---------- bees buzzing around a hive ----------
function drawBees(o, t) {
  const [cx, cy] = P(o.x + 0.5, o.y + 0.5);
  for (let i = 0; i < 4; i++) {
    const a = t / (380 + i * 90) + i * 1.7, r = 9 + i * 3;
    const bx = cx + Math.cos(a) * r, by = cy - 20 + Math.sin(a * 1.3) * r * 0.5 - i * 2;
    ctx.fillStyle = '#F2B53A'; ctx.beginPath(); ctx.ellipse(bx, by, 1.7, 1.2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(40,30,10,.8)'; ctx.fillRect(bx - 0.3, by - 1.1, 0.7, 2.2);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(bx - 0.6, by - 1.5, 1, 0.6, -0.5, 0, 7); ctx.fill();
  }
}
// ---------- land for sale: a soft mist over parcels you don't own yet, with a sign on each ----------
function drawLandForSale(pt) {
  if (!S.land || Object.keys(S.land).length < LAND.length) {
    for (const l of LAND) {
      if (ownsLand(l.id)) continue;
      const d = diamond(l.x0, l.y0, l.x1 - l.x0 + 1, l.y1 - l.y0 + 1);
      ctx.save();
      ctx.beginPath(); ctx.moveTo(...d[0]); for (let i = 1; i < 4; i++) ctx.lineTo(...d[i]); ctx.closePath();
      ctx.fillStyle = 'rgba(232,238,242,.42)'; ctx.fill();
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = -pt / 120; ctx.strokeStyle = 'rgba(255,248,230,.85)'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
    }
  }
}
function drawLandSigns(t) {
  const im = spr('sign-sale');
  for (const l of LAND) {
    if (ownsLand(l.id)) continue;
    const sx = l.id === 'orchard' ? 31.5 : l.id === 'pasture' ? 15 : 31.5, sy = l.id === 'orchard' ? 15 : l.id === 'pasture' ? 31.5 : 31.5;
    const [px, py] = P(sx, sy), bob = Math.sin(t / 900 + sx) * 1.5;
    if (im) drawSprite(im, px, py + 6, 58, false);
    ctx.save();
    ctx.font = '700 11px "Fredoka", -apple-system, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const txt = l.name, sub = 'For sale · Lv ' + l.lvl, w = Math.max(ctx.measureText(txt).width, ctx.measureText(sub).width) + 18;
    const y = py - 66 + bob;
    ctx.fillStyle = 'rgba(255,246,226,.96)'; ctx.strokeStyle = '#8A5A2F'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px - w / 2, y - 15, w, 30, 9) : ctx.rect(px - w / 2, y - 15, w, 30); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5A3A1A'; ctx.fillText(txt, px, y - 5);
    ctx.font = '600 9px "Fredoka", -apple-system, system-ui, sans-serif'; ctx.fillStyle = '#8A5A2F'; ctx.fillText(sub, px, y + 7);
    ctx.restore();
  }
}
function drawTree(o, t) {
  const [cx, cy] = P(o.x + 0.5, o.y + 0.5);
  const v = hash(o.id), s = 0.85 + v * 0.35, sway = Math.sin(t / 900 + o.id) * 1.2;
  const tim = spr('tree-' + season().name.toLowerCase());
  if (tim) { drawSprite(tim, cx + sway * 0.5, cy + 10, 62 * (0.9 + v * 0.2) * (season().name === 'Winter' ? 0.8 : 1), v > 0.5); return; }
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(cx + 4, cy + 2, 16 * s, 7 * s, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#6D4C30'; ctx.fillRect(cx - 3, cy - 18 * s, 6, 18 * s);
  const se = season(), si = SEASONS_IDX(se);
  let g1 = se.leaf[0], g2 = se.leaf[1];
  if (si === 2 && v > 0.6) { g1 = '#B8432F'; g2 = '#D8673A'; }          // fall: some trees go red
  if (si === 1 && v < 0.5) { g1 = '#356F2A'; g2 = '#4C9136'; }
  ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(cx + sway, cy - 30 * s, 17 * s, 0, 7); ctx.fill();
  if (si === 3) { // winter: snow-capped evergreen look
    ctx.fillStyle = '#F4F7FA'; ctx.beginPath(); ctx.arc(cx + sway, cy - 36 * s, 12 * s, Math.PI, 0); ctx.fill();
  } else {
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(cx - 5 * s + sway, cy - 35 * s, 9 * s, 0, 7); ctx.fill();
  }
  const dots = si === 0 ? (v > 0.3 ? '#F4B6C8' : null) : si === 1 ? (v > 0.8 ? '#E2483A' : null) : null;
  if (dots) { ctx.fillStyle = dots; for (const [dx, dy] of [[6, -26], [-8, -24], [2, -40], [-2, -30], [9, -35]]) { ctx.beginPath(); ctx.arc(cx + dx * s + sway, cy + dy * s, 2.2, 0, 7); ctx.fill(); } }
}
const SEASONS_IDX = se => ['Spring', 'Summer', 'Fall', 'Winter'].indexOf(se.name);
function drawTrain(o, b, t) { drawTrainScene(ctx, o, b, trainState(o), t, performance.now()); }
// falling snow / leaves / petals, drawn in screen space
function drawWeather(pt) {
  const si = SEASONS_IDX(season());
  if (si === 1) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = si === 3 ? 70 : 18;
  for (let i = 0; i < n; i++) {
    const r1 = hash(i * 7 + 1), r2 = hash(i * 13 + 5), sp = 20 + r2 * 30;
    const y = ((r1 * H + pt / 1000 * sp) % (H + 20)) - 10;
    const x = (r2 * W + Math.sin(pt / 1500 + i) * 30 + pt / 1000 * (si === 3 ? 4 : 15)) % W;
    if (si === 3) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x, y, 1.5 + r1 * 2, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = si === 0 ? 'rgba(244,182,200,.85)' : (i % 2 ? 'rgba(216,103,58,.85)' : 'rgba(233,168,37,.85)'); ctx.save(); ctx.translate(x, y); ctx.rotate(pt / 600 + i); ctx.beginPath(); ctx.ellipse(0, 0, 4, 2, 0, 0, 7); ctx.fill(); ctx.restore(); }
  }
}
function drawRock(o) {
  const [cx, cy] = P(o.x + 0.5, o.y + 0.5), v = hash(o.id + 7), s = 0.8 + v * 0.4;
  const rim = spr('rock'); if (rim) { drawSprite(rim, cx, cy + 10, 58 * s, v > 0.5); return; }
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(cx + 3, cy + 2, 16 * s, 7 * s, 0, 0, 7); ctx.fill();
  poly([[cx - 16 * s, cy], [cx - 10 * s, cy - 14 * s], [cx + 2 * s, cy - 20 * s], [cx + 14 * s, cy - 10 * s], [cx + 16 * s, cy], [cx + 4 * s, cy + 5 * s]], '#9A978F');
  poly([[cx - 10 * s, cy - 14 * s], [cx + 2 * s, cy - 20 * s], [cx + 14 * s, cy - 10 * s], [cx, cy - 8 * s]], '#B9B6AE');
}

// ---------- farm animals: each one wanders, grazes and rests on its own inside its pen ----------
// speed in tiles/s; stride = tiles per step cycle; hop = px lift per step; waddle = body roll per step;
// idle/graze = how long (ms) they stand around or keep their head down; walk = how far they go in one trip.
const HERD_SPEC = {
  chicken: { speed: 0.75, stride: 0.09, hop: 1.6, waddle: 0.14, idle: [500, 1800], graze: [900, 2600], walk: [0.3, 1.0], space: 0.28 },
  goat:    { speed: 0.42, stride: 0.16, hop: 2.2, waddle: 0.06, idle: [900, 2600], graze: [2000, 5000], walk: [0.4, 1.2], space: 0.45 },
  pig:     { speed: 0.22, stride: 0.2,  hop: 0.8, waddle: 0.05, idle: [2000, 5000], graze: [3500, 9000], walk: [0.3, 0.9], space: 0.5 },
  cow:     { speed: 0.2,  stride: 0.3,  hop: 0.7, waddle: 0.03, idle: [2500, 6000], graze: [5000, 12000], walk: [0.4, 1.1], space: 0.6 },
  sheep:   { speed: 0.3,  stride: 0.22, hop: 1.0, waddle: 0.05, idle: [1800, 4500], graze: [3500, 9000], walk: [0.3, 1.0], space: 0.48 },
};
const herd = new Map();
const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
// a free spot inside the pen, away from the shelter in the back corner
const penOK = (b, u, v) => u > 0.18 && v > 0.18 && u < b.w - 0.15 && v < b.h - 0.15 && !(u < 0.88 && v < 0.88);
function penSpot(b, cu, cv, dist) {
  for (let k = 0; k < 20; k++) {
    const ang = Math.random() * Math.PI * 2, d = dist ? rnd(dist[0], dist[1]) : 0;
    const u = dist ? cu + Math.cos(ang) * d : rnd(0.2, b.w - 0.18), v = dist ? cv + Math.sin(ang) * d : rnd(0.2, b.h - 0.18);
    if (penOK(b, u, v)) return [u, v];
  }
  return [rnd(0.95, b.w - 0.2), rnd(0.95, b.h - 0.2)];
}
// the farmer just tended this pen: everyone reacts ('fed' = hop + hearts, then they tuck in; 'collect' = hop + sparkles)
export function penCheer(o, kind) {
  const t = Date.now();
  for (let i = 0; i < o.animals.length; i++) {
    const m = herd.get(o.id + ':' + i); if (!m) continue;
    m.cheer = t + i * 90; m.cheerKind = kind;
    if (kind === 'fed') { m.mode = 'graze'; m.until = t + 3500 + Math.random() * 2500; }   // head down to eat
  }
}
function herdStep(o, b, i, an, sp, t) {
  const key = o.id + ':' + i;
  let m = herd.get(key);
  if (!m) {
    const [u, v] = penSpot(b);
    m = { u, v, tu: u, tv: v, mode: Math.random() < 0.5 ? 'graze' : 'idle', until: t + rnd(0, 3000), face: Math.random() < 0.5 ? 1 : -1, dist: 0, last: t };
    herd.set(key, m);
  }
  const dt = Math.min(0.1, (t - m.last) / 1000); m.last = t;
  const hungry = animalState(an) === 'hungry';
  if (m.mode === 'walk') {
    const du = m.tu - m.u, dv = m.tv - m.v, d = Math.hypot(du, dv), s = Math.min(d, sp.speed * (hungry ? 0.7 : 1) * dt);
    if (d > 0.001) { m.u += du / d * s; m.v += dv / d * s; m.dist += s; }
    if (Math.abs(du - dv) > 0.02) m.face = du - dv > 0 ? 1 : -1; // screen-space direction of travel
    if (d - s < 0.01) {
      // hungry animals don't graze: they stand and wait for feed
      m.mode = !hungry && Math.random() < 0.65 ? 'graze' : 'idle';
      m.until = t + rnd(...sp[m.mode]);
    }
  } else if (t > m.until) {
    if (Math.random() < (hungry ? 0.3 : 0.55)) {
      [m.tu, m.tv] = penSpot(b, m.u, m.v, sp.walk); m.mode = 'walk'; m.dist = 0;
    } else {
      m.mode = !hungry && Math.random() < 0.6 ? 'graze' : 'idle';
      if (m.mode === 'idle' && Math.random() < 0.3) m.face = -m.face; // look around
      m.until = t + rnd(...sp[m.mode]);
    }
  }
  // personal space: nudge away from penmates so they don't stand inside each other
  for (let j = 0; j < o.animals.length; j++) {
    if (j === i) continue;
    const n = herd.get(o.id + ':' + j); if (!n) continue;
    const du = m.u - n.u, dv = m.v - n.v, d = Math.hypot(du, dv);
    if (d < sp.space && d > 0.0001) {
      const push = (sp.space - d) * 0.08, nu = m.u + du / d * push, nv = m.v + dv / d * push;
      if (penOK(b, nu, nv)) { m.u = nu; m.v = nv; }
    }
  }
  return m;
}
function drawPen(o, b, t) {
  drawPenGround(o, b);
  // back fence, then the shelter in the back corner (its front corner on the corner tile's front corner)
  const FT = P(o.x, o.y), FR = P(o.x + b.w, o.y), FL = P(o.x, o.y + b.h);
  drawFenceRun(FL, FT, b.h * 3, true); drawFenceRun(FT, FR, b.w * 3, false);
  const shel = spr(o.t);
  if (shel) { const [sx] = P(o.x + 0.5, o.y + 0.5), sy = P(o.x + 1, o.y + 1)[1]; drawSprite(shel, sx, sy + 3, TW * 1.12, false); }
  else drawBox(o.x + 0.1, o.y + 0.1, 0.9, 0.9, 18, b.wall, b.roof, 12, null);
  const a = penAnimal(o), aim = spr(b.animal), aw = { chicken: 22, cow: 38, sheep: 32, goat: 31, pig: 32 }[b.animal] || 30;
  const sp = HERD_SPEC[b.animal] || HERD_SPEC.sheep;
  const members = o.animals.map((an, i) => ({ an, i, m: herdStep(o, b, i, an, sp, t) }));
  members.sort((p, q) => (p.m.u + p.m.v) - (q.m.u + q.m.v)).forEach(({ an, i, m }) => {
    const [sx, sy] = P(o.x + m.u, o.y + m.v);
    const st = animalState(an);
    if (aim) {
      // pose: stepping only while walking; head-down when grazing/pecking; slow breathing when standing
      let lift = 0, tilt = 0, squash = 0;
      if (m.mode === 'walk') {
        const ph = m.dist / sp.stride;
        lift = Math.abs(Math.sin(ph * Math.PI)) * sp.hop;
        tilt = Math.sin(ph * Math.PI) * sp.waddle;
      } else if (m.mode === 'graze') {
        if (b.animal === 'chicken') {
          const p = ((t + i * 377) % 700) / 700;            // quick pecks with pauses between
          tilt = p < 0.3 ? Math.sin(p / 0.3 * Math.PI) * 0.45 : 0;
        } else {
          tilt = 0.12 + Math.sin(t / 420 + i) * 0.015;       // head down, chewing
        }
      } else {
        squash = Math.sin(t / 900 + i * 2) * 0.012;
        if (b.animal === 'chicken' && ((t + i * 911) % 3000) < 160) tilt = -0.12; // a curious head-flick
      }
      // just fed or collected: a couple of happy hops
      const ck = m.cheer ? (t - m.cheer) / 1300 : 2;
      if (ck < 1) { lift += Math.abs(Math.sin(ck * Math.PI * 3 + i)) * 7 * (1 - ck); tilt = 0; }
      ctx.fillStyle = 'rgba(30,40,10,0.2)'; ctx.beginPath(); ctx.ellipse(sx, sy + 1, aw * 0.4 * (1 - lift * 0.04), aw * 0.13, 0, 0, 7); ctx.fill();
      const ah = aw * aim.naturalHeight / aim.naturalWidth;
      ctx.save(); ctx.translate(sx, sy + 2 - lift); ctx.scale(m.face, 1 - squash);
      ctx.translate(-aw * 0.28, 0); ctx.rotate(tilt); ctx.translate(aw * 0.28, 0); // pivot on the back legs
      ctx.drawImage(aim, -aw / 2, -ah, aw, ah); ctx.restore();
    }
    else emoji(a.icon, sx, sy - 8, 17);
    const headY = sy - (aim ? aw * 0.95 : 22);
    if (st === 'ready') {
      const pi = iconImg(a.product), y = headY + Math.sin(t / 400 + i) * 1.5;
      if (pi) ctx.drawImage(pi, sx + 2, y - 8, 15, 15); else emoji(ITEMS[a.product].icon, sx + 9, y, 10);
    } else if (st === 'hungry') {
      // a little thought bubble with their feed: "I'm hungry!"
      const y = headY - 2 + Math.sin(t / 500 + i) * 1.2, fi = itemImg(a.feed);
      ctx.fillStyle = 'rgba(255,248,232,.95)'; ctx.strokeStyle = 'rgba(138,90,47,.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx + 6, y - 4, 7.5, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(sx + 1, y + 5, 1.8, 0, 7); ctx.fill(); ctx.stroke();
      if (fi) ctx.drawImage(fi, sx + 6 - 5.5, y - 9.5, 11, 11);
    }
    // hearts float up after feeding; sparkles after collecting
    if (m.cheer && t - m.cheer < 1600) {
      const k = (t - m.cheer) / 1600;
      ctx.save(); ctx.globalAlpha = 1 - k;
      if (m.cheerKind === 'fed') {
        ctx.fillStyle = '#E0607A'; ctx.font = '700 10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('♥', sx - 4 + Math.sin(k * 6 + i) * 3, headY - k * 22); ctx.fillText('♥', sx + 6 + Math.cos(k * 5 + i) * 3, headY - 6 - k * 18);
      } else { ctx.fillStyle = '#FFF4C2'; star(sx + 5, headY - k * 16, 3.5 * (1 - k) + 1); star(sx - 5, headY - 4 - k * 12, 2.5 * (1 - k) + 1); }
      ctx.restore();
    }
  });
  // front fence goes in front of the animals
  const T = P(o.x, o.y), R = P(o.x + b.w, o.y), B = P(o.x + b.w, o.y + b.h), L = P(o.x, o.y + b.h);
  drawFenceRun(L, B, b.w * 3, true); drawFenceRun(B, R, b.h * 3, false, true);
}
// Pen yard: packed earth with straw, a darker rim, scattered tufts. Seeded per pen so it doesn't flicker.
function drawPenGround(o, b) {
  poly(diamond(o.x, o.y, b.w, b.h, 0), 'rgba(70,50,20,.35)');
  poly(diamond(o.x, o.y, b.w, b.h, 2), b.animal === 'chicken' ? '#CDB17A' : b.animal === 'cow' ? '#A9C46E' : '#B5CF84');
  ctx.save(); ctx.clip();
  const [tx, ty] = P(o.x, o.y), [bx, by] = P(o.x + b.w, o.y + b.h);
  const g = ctx.createLinearGradient(tx, ty, bx, by);
  g.addColorStop(0, 'rgba(70,50,20,.22)'); g.addColorStop(0.5, 'rgba(70,50,20,0)'); g.addColorStop(1, 'rgba(255,240,200,.12)');
  ctx.fillStyle = g; ctx.fillRect(tx - 200, ty, 400, by - ty);
  // straw, dirt and tufts are built once per pen position, then drawn as 3 shapes
  const key = o.id + ':' + o.x + ',' + o.y;
  let tex = penTex.get(key);
  if (!tex) {
    tex = { straw: new Path2D(), dirt: new Path2D(), tuft: new Path2D() };
    for (let i = 0; i < 70 * b.w * b.h; i++) {
      const u = hash(o.id * 97 + i), v = hash(o.id * 53 + i * 7), [sx, sy] = P(o.x + u * b.w, o.y + v * b.h), k = hash(i * 13 + o.id);
      if (k < 0.45) { tex.straw.moveTo(sx - 2, sy); tex.straw.lineTo(sx + 2, sy - 1 + k * 2); }
      else if (k < 0.75) tex.dirt.rect(sx, sy, 2, 1);
      else { tex.tuft.rect(sx, sy - 2, 1, 3); tex.tuft.rect(sx + 2, sy - 1, 1, 2); }
    }
    penTex.set(key, tex);
  }
  ctx.strokeStyle = 'rgba(232,200,110,.75)'; ctx.lineWidth = 1; ctx.stroke(tex.straw);
  ctx.fillStyle = 'rgba(110,80,40,.28)'; ctx.fill(tex.dirt);
  ctx.fillStyle = 'rgba(70,120,40,.5)'; ctx.fill(tex.tuft);
  ctx.restore();
}
const penTex = new Map();
// A rustic post-and-rail fence from p1 to p2 with n sections: shaded rails, posts with caps.
function drawFenceRun(p1, p2, n, leftFace, gate) {
  const side = leftFace ? '#8A5E33' : '#74492A', top = '#B88A55', post = '#6B4424', cap = '#C69C66';
  const at = k => [p1[0] + (p2[0] - p1[0]) * k / n, p1[1] + (p2[1] - p1[1]) * k / n];
  const gateK = gate ? Math.floor(n / 2) : -1;
  for (const h of [5, 11]) {
    for (let k = 0; k < n; k++) {
      if (k === gateK) continue;
      const [ax, ay] = at(k), [cx, cy] = at(k + 1);
      ctx.fillStyle = side; ctx.beginPath(); ctx.moveTo(ax, ay - h); ctx.lineTo(cx, cy - h); ctx.lineTo(cx, cy - h + 3); ctx.lineTo(ax, ay - h + 3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = top; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay - h); ctx.lineTo(cx, cy - h); ctx.stroke();
    }
  }
  if (gateK >= 0) {
    // a little swing gate, slightly ajar
    const [ax, ay] = at(gateK), [cx, cy] = at(gateK + 1), mx = ax + (cx - ax) * 0.85, my = ay + (cy - ay) * 0.85 + 3;
    ctx.strokeStyle = '#9C6B3C'; ctx.lineWidth = 2.2;
    ctx.beginPath(); for (const h of [4, 8, 12]) { ctx.moveTo(ax, ay - h); ctx.lineTo(mx, my - h); } ctx.moveTo(ax, ay - 4); ctx.lineTo(mx, my - 12); ctx.stroke();
  }
  for (let k = 0; k <= n; k++) {
    const [x, y] = at(k);
    ctx.fillStyle = 'rgba(40,25,10,.22)'; ctx.beginPath(); ctx.ellipse(x + 1, y + 1, 3, 1.3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = post; ctx.fillRect(x - 1.8, y - 15, 3.6, 15);
    ctx.fillStyle = 'rgba(255,220,170,.35)'; ctx.fillRect(x - 1.8, y - 15, 1.2, 15);
    ctx.fillStyle = cap; ctx.beginPath(); ctx.ellipse(x, y - 15, 1.9, 0.9, 0, 0, 7); ctx.fill();
  }
}

// A white picket fence that joins up with the fences next to it (straight runs, corners and T's).
function drawPicketFence(o) {
  const x = o.x, y = o.y, isF = (i, j) => fenceAt.has(i * 1000 + j);
  const xm = isF(x - 1, y), xp = isF(x + 1, y), ym = isF(x, y - 1), yp = isF(x, y + 1), C = [x + 0.5, y + 0.5];
  const segs = [];   // each run goes from far to near, so pickets overlap correctly
  if (!(xm || xp || ym || yp)) segs.push([[x, y + 0.5], [x + 1, y + 0.5]]);
  else {
    const lone = (xm + xp + ym + yp) === 1;
    if (ym || (lone && yp)) segs.push([[x + 0.5, y], C]);
    if (xm || (lone && xp)) segs.push([[x, y + 0.5], C]);
    if (xp || (lone && xm)) segs.push([C, [x + 1, y + 0.5]]);
    if (yp || (lone && ym)) segs.push([C, [x + 0.5, y + 1]]);
  }
  ctx.save(); ctx.lineJoin = 'round';
  // soft shadow along the ground
  ctx.strokeStyle = 'rgba(40,30,15,.2)'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  for (const [A, B] of segs) { const p = P(...A), q = P(...B); ctx.beginPath(); ctx.moveTo(p[0] + 2.5, p[1] + 1.5); ctx.lineTo(q[0] + 2.5, q[1] + 1.5); ctx.stroke(); }
  const OUT = 'rgba(95,80,60,.55)';
  for (const [A, B] of segs) {
    const alongX = A[1] === B[1];                     // runs along x face the lower left, which sits in shade
    const face = alongX ? '#E3DCCD' : '#F7F2E8', edge = alongX ? '#C2B8A5' : '#D6CDBC';
    const p = P(...A), q = P(...B), dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    // two rails behind the pickets
    for (const h of [4.5, 10]) {
      ctx.fillStyle = edge; ctx.strokeStyle = OUT; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(p[0], p[1] - h); ctx.lineTo(q[0], q[1] - h); ctx.lineTo(q[0], q[1] - h + 2); ctx.lineTo(p[0], p[1] - h + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // pickets with pointed tops
    const n = Math.max(2, Math.round(len / 5.4));
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n, bx = p[0] + dx * f, by = p[1] + dy * f, w = 1.55, hgt = 12.5;
      ctx.beginPath();
      ctx.moveTo(bx - ux * w, by - uy * w); ctx.lineTo(bx + ux * w, by + uy * w);
      ctx.lineTo(bx + ux * w, by + uy * w - hgt); ctx.lineTo(bx, by - hgt - 2.6); ctx.lineTo(bx - ux * w, by - uy * w - hgt);
      ctx.closePath(); ctx.fillStyle = face; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.55; ctx.stroke();
      // thin shaded edge for thickness
      ctx.strokeStyle = edge; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(bx + ux * w + 0.5, by + uy * w); ctx.lineTo(bx + ux * w + 0.5, by + uy * w - hgt); ctx.stroke();
    }
  }
  // posts where runs meet or end, with little caps
  const posts = segs.length === 1 && !(xm || xp || ym || yp) ? [[x, y + 0.5], [x + 1, y + 0.5]] : [C];
  for (const g of posts) {
    const [px, py] = P(...g), h = 15;
    ctx.fillStyle = '#D9D1C1'; ctx.fillRect(px - 2.4, py - h, 2.4, h);
    ctx.fillStyle = '#FBF8F1'; ctx.fillRect(px, py - h, 2.4, h);
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.55; ctx.strokeRect(px - 2.4, py - h, 4.8, h);
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.moveTo(px - 3, py - h); ctx.lineTo(px, py - h - 2.4); ctx.lineTo(px + 3, py - h); ctx.lineTo(px, py - h + 1.2); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawDecor(o, b, t) {
  const [cx, cy] = P(o.x + b.w / 2, o.y + b.h / 2);
  switch (o.t) {
    case 'flowers': {
      poly(diamond(o.x, o.y, 1, 1, 6), '#6E4A2A');
      const cols = ['#E2483A', '#F7C531', '#D4537E', '#FFFFFF', '#A57FD8'];
      for (let i = 0; i < 9; i++) { const fx = 0.25 + 0.5 * hash(o.id * 9 + i), fy = 0.25 + 0.5 * hash(o.id * 13 + i); const [sx, sy] = P(o.x + fx, o.y + fy); ctx.fillStyle = '#3F7A2A'; ctx.fillRect(sx - 0.5, sy - 6, 1, 6); ctx.fillStyle = cols[i % 5]; ctx.beginPath(); ctx.arc(sx, sy - 7, 2.6, 0, 7); ctx.fill(); }
      break;
    }
    case 'hedge': drawBoxPlain(o.x + 0.1, o.y + 0.1, 0.8, 0.8, 14, '#3E7D2E'); break;
    case 'bench': drawBoxPlain(o.x + 0.25, o.y + 0.35, 0.5, 0.3, 7, '#8E5B2E'); break;
    case 'fence': drawPicketFence(o); break;
    case 'lamp': {
      ctx.strokeStyle = '#2F3E46'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 34); ctx.stroke();
      const glow = 0.75 + Math.sin(t / 500 + o.id) * 0.2;
      ctx.fillStyle = `rgba(255,214,110,${glow})`; ctx.beginPath(); ctx.arc(cx, cy - 37, 6, 0, 7); ctx.fill();
      break;
    }
    case 'gazebo': {
      poly(diamond(o.x, o.y, 2, 2, 4), '#D9CBB0');
      drawBox(o.x + 0.35, o.y + 0.35, 1.3, 1.3, 16, '#FFFFFF', '#5E8B4A', 22, null);
      break;
    }
    case 'fountain': {
      ctx.fillStyle = '#9A978F'; ctx.beginPath(); ctx.ellipse(cx, cy, 40, 19, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#5DA9D6'; ctx.beginPath(); ctx.ellipse(cx, cy - 2, 33, 14, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#B9B6AE'; ctx.fillRect(cx - 4, cy - 26, 8, 24);
      ctx.fillStyle = '#9A978F'; ctx.beginPath(); ctx.ellipse(cx, cy - 26, 13, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(200,235,255,.9)';
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, k = ((t / 700 + i * 0.13) % 1); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 14 * k, cy - 30 + 26 * k * k - 10 * k, 1.8, 0, 7); ctx.fill(); }
      break;
    }
    case 'windmill': {
      drawBox(o.x + 0.5, o.y + 0.5, 1, 1, 56, '#E9E2D0', '#8E5B2E', 16, null);
      const [hx, hy] = P(o.x + 1, o.y + 1.5); const by = hy - 60, a = t / 1500;
      ctx.strokeStyle = '#6D4C30'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(250,245,230,.95)';
      for (let i = 0; i < 4; i++) {
        const ang = a + i * Math.PI / 2, ex = hx + Math.cos(ang) * 34, ey = by + Math.sin(ang) * 34;
        ctx.beginPath(); ctx.moveTo(hx, by); ctx.lineTo(ex, ey); ctx.stroke();
        const px2 = Math.cos(ang + Math.PI / 2) * 6, py2 = Math.sin(ang + Math.PI / 2) * 6;
        poly([[hx + Math.cos(ang) * 10, by + Math.sin(ang) * 10], [ex, ey], [ex + px2, ey + py2], [hx + Math.cos(ang) * 10 + px2, by + Math.sin(ang) * 10 + py2]], 'rgba(250,245,230,.95)');
      }
      ctx.fillStyle = '#5A4632'; ctx.beginPath(); ctx.arc(hx, by, 4, 0, 7); ctx.fill();
      break;
    }
    case 'pond': {
      ctx.fillStyle = '#7A9E5A'; ctx.beginPath(); ctx.ellipse(cx, cy, 44, 20, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#5DA9D6'; ctx.beginPath(); ctx.ellipse(cx, cy, 38, 16, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(cx - 10, cy - 4, 12, 3, 0, 0, 7); ctx.fill();
      emoji('🦆', cx + Math.sin(t / 2000 + o.id) * 16, cy - 4, 14);
      break;
    }
  }
}
function drawBoxPlain(x, y, w, h, hgt, col) {
  const T = P(x, y), R = P(x + w, y), B = P(x + w, y + h), L = P(x, y + h);
  poly([L, B, up(B, hgt), up(L, hgt)], shade(col, -25));
  poly([B, R, up(R, hgt), up(B, hgt)], shade(col, -8));
  poly([up(T, hgt), up(R, hgt), up(B, hgt), up(L, hgt)], shade(col, 15));
}

function drawCivicExtras(o, b, t) {
  const [cx, cy] = P(o.x + b.w / 2, o.y + b.h / 2);
  const top = cy - (b.hgt + 18 + (b.w + b.h) * 3) - 2;
  if (o.t === 'clockTower') {
    const T = P(o.x, o.y + b.h), B2 = P(o.x + b.w, o.y + b.h);
    const fx = (T[0] + B2[0]) / 2, fy = (T[1] + B2[1]) / 2 - b.hgt * 0.75;
    ctx.fillStyle = '#FFFDF5'; ctx.beginPath(); ctx.arc(fx, fy, 9, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2F3E46'; ctx.lineWidth = 1.5; ctx.stroke();
    const a = (t / 60000) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.sin(a) * 7, fy - Math.cos(a) * 7); ctx.stroke();
  }
  // flag
  ctx.strokeStyle = '#5A4632'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, top - 16); ctx.stroke();
  const wave = Math.sin(t / 300) * 2;
  poly([[cx, top - 16], [cx + 12, top - 13 + wave], [cx, top - 9]], '#E2483A');
}

// ---------- status bubbles ----------
// painted picture for an item id (crop art or item icon), cached
const _bimg = {};
function itemImg(id) {
  const src = id === 'coin' || id === 'crate' || id === 'ribbon' ? 'sprites/icon-' + id + '.webp' : CROPS[id] ? 'sprites/crop-' + id + '.webp' : 'sprites/icon-' + id + '.webp';
  const im = _bimg[src] || (_bimg[src] = Object.assign(new Image(), { src }));
  return im.complete && im.naturalWidth ? im : null;
}
// Status bubble over a building: a parchment thought-bubble with a wooden rim and a painted icon.
//   mode 'ready' = something to collect (gold glow, bounce, count badge); 'busy' = in progress (smaller, progress ring);
//   'need' = waiting on you (red "!" badge)
function bubble(x, y, id, { mode = 'ready', ring = null, count = 0, t = 0, seed = 0 } = {}) {
  const ready = mode === 'ready', r = ready ? 15 : 12.5;
  if (ready) y -= Math.abs(Math.sin(t / 380 + seed)) * 4;          // happy bounce
  ctx.save();
  if (ready) {   // soft gold glow
    const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.1);
    g.addColorStop(0, 'rgba(255,214,90,.55)'); g.addColorStop(1, 'rgba(255,214,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.1, 0, 7); ctx.fill();
  }
  // shadow, tail, body
  ctx.fillStyle = 'rgba(40,25,10,.22)'; ctx.beginPath(); ctx.arc(x + 1, y + 2.5, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#FFF6E2'; ctx.strokeStyle = ready ? '#C9861A' : '#8A5A2F'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(x - 5, y + r - 3); ctx.lineTo(x, y + r + 7); ctx.lineTo(x + 5, y + r - 3); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FFF6E2'; ctx.fillRect(x - 4, y + r - 4, 8, 3);   // join the tail to the body
  if (ring != null) {   // progress ring
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(120,90,40,.18)'; ctx.beginPath(); ctx.arc(x, y, r - 3, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#5E9A35'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, r - 3, -Math.PI / 2, -Math.PI / 2 + ring * Math.PI * 2); ctx.stroke();
  }
  const im = itemImg(id), s = ready ? 22 : 17;
  if (im) { if (!ready) ctx.globalAlpha = 0.85; ctx.drawImage(im, x - s / 2, y - s / 2, s, s); ctx.globalAlpha = 1; }
  else emoji(ITEMS[id]?.icon || '•', x, y + 1, 13);
  if (ready && ((t / 700 + seed) % 3) < 0.35) { ctx.fillStyle = '#FFFFFF'; star(x + r * 0.7, y - r * 0.7, 4); }   // twinkle
  if (count > 1 || mode === 'need') {   // little badge: how many, or "!" when it needs you
    const bx = x + r * 0.78, by = y - r * 0.72, txt = mode === 'need' ? '!' : '×' + count;
    ctx.font = '800 10px "Fredoka", -apple-system, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const bw = Math.max(15, ctx.measureText(txt).width + 8);
    ctx.fillStyle = mode === 'need' ? '#C0472F' : '#5E9A35'; ctx.strokeStyle = '#FFF6E2'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx - bw / 2, by - 7.5, bw, 15, 7.5) : ctx.rect(bx - bw / 2, by - 7.5, bw, 15); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillText(txt, bx, by + 0.5);
  }
  ctx.restore();
}
function drawStatus(o, b, t) {
  const top = P(o.x + b.w / 2, o.y + b.h / 2);
  const y = top[1] - heightOf(o) - 12 + Math.sin(t / 900 + o.id) * 1.5;
  const x = top[0], seed = o.id;
  if (b.kind === 'producer') {
    const done = jobsDone(o);
    if (done) bubble(x, y, o.jobs[0].out, { count: done, t, seed });
    else if (o.jobs.length) { const j = o.jobs[0]; bubble(x, y, j.out, { mode: 'busy', ring: Math.max(0, Math.min(1, (t - j.start) / (j.end - j.start))), t, seed }); }
  } else if (b.kind === 'pen') {
    const a = penAnimal(o), ready = o.animals.filter(an => animalState(an) === 'ready').length;
    if (ready) bubble(x, y, a.product, { count: ready, t, seed });
    else if (o.animals.length && o.animals.every(an => animalState(an) === 'hungry')) bubble(x, y, a.feed, { mode: 'need', t, seed });
  } else if (b.kind === 'house') {
    const due = rentDue(o);
    if (due > 0) bubble(x, y, 'coin', { count: due, t, seed });
  } else if (b.kind === 'hive') {
    const n = honeyDue(o);
    if (n > 0) bubble(x, y + 6, 'honey', { count: n, t, seed });
  } else if (b.kind === 'station') {
    const st = trainState(o);
    if (st.status === 'here') { const all = st.train.crates.every(c => c.filled); bubble(x, y, all ? 'ribbon' : 'crate', { mode: all ? 'ready' : 'need', t, seed }); }
  }
}

// ---------- main draw ----------
let drawList = [];
// ---------- ambient life: chimney smoke, sparkling water, ducks, butterflies, birds ----------
const SMOKE = { ciderPress: [0.24, 0.94], honeyHouse: [0.27, 0.9], cottage: [0.18, 0.86], farmhouse: [0.2, 0.88], townhouse: [0.12, 0.9], manor: [0.22, 0.86], bakery: [0.16, 0.9], kitchen: [0.18, 0.88], cafe: [0.15, 0.88], workshop: [0.2, 0.86], schoolhouse: [0.05, 0.9] };
function spriteBox(o) {   // where an isometric building's picture sits: centre x, bottom y, width, height
  const b = BUILD[o.t], cfg = SPRITE_CFG[o.t], im = cfg && spr(o.t); if (!im) return null;
  const [cx] = P(o.x + b.w / 2, o.y + b.h / 2), by = P(o.x + b.w, o.y + b.h)[1] + 3, w = footW(b) * cfg.k;
  return { cx, by, w, h: w * im.naturalHeight / im.naturalWidth };
}
function drawLife(pt, tall, vis) {
  const night = skyNow().glow > 0.5;
  for (const o of tall) {
    const sm = SMOKE[o.t];
    if (sm) {   // soft puffs curling up from the chimney
      const bx = spriteBox(o); if (!bx) continue;
      const x0 = bx.cx + bx.w * sm[0], y0 = bx.by - bx.h * sm[1];
      for (let i = 0; i < 5; i++) {
        const k = ((pt / 2600 + i / 5 + o.id * 0.37) % 1);
        ctx.fillStyle = `rgba(240,238,232,${0.42 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(x0 + Math.sin(k * 5 + o.id) * 4 + k * 10, y0 - k * 38, 3 + k * 7, 0, 7); ctx.fill();
      }
    }
    if (o.t === 'pond' || o.t === 'fountain') {   // twinkles on the water
      const [cx, cy] = P(o.x + 1, o.y + 1);
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      for (let i = 0; i < 6; i++) {
        const tw = Math.max(0, Math.sin(pt / 380 + i * 2.1 + o.id)); if (tw < 0.6) continue;
        star(cx + (hash(o.id * 9 + i) - 0.5) * 50, cy - 6 + (hash(o.id * 5 + i) - 0.5) * 20 - (o.t === 'fountain' ? 10 : 0), 2.5 * tw);
      }
      if (o.t === 'pond') {   // two ducks paddling in slow circles
        for (let i = 0; i < 2; i++) {
          const im = spr(i ? 'dc-mallard' : 'dc-duck'); if (!im) continue;
          const a = pt / 9000 + i * Math.PI, dx = Math.cos(a) * 18, dy = Math.sin(a) * 7;
          ctx.save(); ctx.translate(cx + dx, cy - 2 + dy + Math.sin(pt / 500 + i) * 0.8);
          if (Math.sin(a) < 0) ctx.scale(-1, 1);   // face the way it's paddling
          ctx.drawImage(im, -9, -11, 18, 18 * im.naturalHeight / im.naturalWidth); ctx.restore();
        }
      }
    }
  }
  if (night) return;
  // butterflies flit around flower beds and the middle of the farm
  const spots = tall.filter(o => o.t === 'flowers').slice(0, 6).map(o => [o.x + 0.5, o.y + 0.5]).concat([[13, 13], [17, 16]]);
  spots.forEach(([gx, gy], i) => {
    const im = spr(i % 2 ? 'dc-butterfly2' : 'dc-butterfly1'); if (!im) return;
    const tt = pt / 1000 + i * 7, fx = gx + Math.sin(tt * 0.7) * 0.9 + Math.sin(tt * 1.9) * 0.3, fy = gy + Math.cos(tt * 0.5) * 0.7;
    const [px, py] = P(fx, fy), flap = 0.35 + Math.abs(Math.sin(pt / 70 + i)) * 0.65;
    ctx.save(); ctx.translate(px, py - 26 - Math.sin(tt * 2.3) * 6); ctx.rotate(Math.sin(tt) * 0.4); ctx.scale(flap, 1);
    ctx.drawImage(im, -6, -5, 12, 12 * im.naturalHeight / im.naturalWidth); ctx.restore();
  });
  // now and then a pair of songbirds crosses the sky
  const cyc = 26000, k = (pt % cyc) / 7000, bim = spr('dc-bird');
  if (k < 1 && bim) {
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const seed = Math.floor(pt / cyc);
    for (let i = 0; i < 2; i++) {
      const x = -60 + k * (W + 120) + i * 30, y = H * (0.15 + hash(seed) * 0.25) + Math.sin(k * 9 + i) * 10 + i * 18;
      const flap = 0.4 + Math.abs(Math.sin(pt / 110 + i * 1.3)) * 0.6;
      ctx.save(); ctx.translate(x, y); ctx.scale(1, flap); ctx.drawImage(bim, -11, -9, 22, 22 * bim.naturalHeight / bim.naturalWidth); ctx.restore();
    }
    ctx.restore();
  }
}
// ---------- time of day & weather (from the device clock) ----------
// keyframes: hour -> colour the scene is multiplied by
const SKY = [[0, [92, 104, 168]], [4.8, [92, 104, 168]], [6.2, [255, 196, 168]], [7.6, [255, 246, 232]], [8.5, [255, 255, 255]],
  [16.8, [255, 255, 255]], [18.2, [255, 222, 172]], [19.4, [236, 168, 160]], [20.6, [124, 118, 176]], [21.4, [92, 104, 168]], [24, [92, 104, 168]]];
const localHour = () => { if (view.debugHour != null) return view.debugHour; const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
export function skyNow() {
  const h = localHour(); let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= h) i++;
  const [h0, c0] = SKY[i], [h1, c1] = SKY[i + 1], k = (h - h0) / (h1 - h0 || 1);
  const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
  const glow = Math.max(0, Math.min(1, (215 - (c[0] + c[1] + c[2]) / 3) / 80));   // how dark it is -> how much lights show
  // weather: some mornings are rainy or misty (same for everyone on a given day)
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5), r = hash(day * 7919 + 3);
  const winter = season().name === 'Winter';
  const rain = view.debugRain ?? (!winter && r < 0.18 && h >= 6 && h < 11.5);
  const mist = !rain && r >= 0.18 && r < 0.36 && h >= 5 && h < 9.5;
  return { h, c, glow, rain, mist };
}
// ---------- fireflies ----------
// Like the real thing: each one drifts slowly and lazily a little above the grass, staying near trees,
// hedges, fields and water. It's dark most of the time, then gives a short flash (a quick brighten, a slower
// fade) every few seconds while swooping upward in a little "J" and leaving a faint streak. The flash lights a
// small pool on the ground beneath it, and now and then a neighbour answers. They come out at dusk, are
// busiest in mid-summer around 9–11 pm, and thin out after midnight.
let flies = [], lastFlyT = 0;
function flyHome() {
  const spots = S.objs.filter(o => ['tree', 'hedge', 'field', 'pond', 'flowers'].includes(o.t) && o.x >= 8 && o.y >= 8 && o.x <= 21 && o.y <= 21);
  const o = spots.length ? spots[Math.floor(Math.random() * spots.length)] : { x: 8 + Math.random() * 14, y: 8 + Math.random() * 14 };
  return { x: o.x + 0.5, y: o.y + 0.5 };
}
function newFly() {
  const h = flyHome();
  return { hx: h.x, hy: h.y, x: h.x + (Math.random() - 0.5), y: h.y + (Math.random() - 0.5), z: 8 + Math.random() * 22,
    dir: Math.random() * 7, turn: 0, speed: 0.12 + Math.random() * 0.12,
    period: 2.6 + Math.random() * 3.6, next: Math.random() * 6, flash: -1, trail: [], life: 40 + Math.random() * 80 };
}
function fireflyCount(h, glow) {
  const se = season().name, base = se === 'Summer' ? 46 : se === 'Spring' ? 20 : 24;   // fall: a few late stragglers
  const hrs = h >= 19 ? h - 19 : h + 5;                    // hours since 7 pm
  const shape = hrs < 2 ? hrs / 2 : hrs < 5 ? 1 : Math.max(0.15, 1 - (hrs - 5) / 4);   // dusk rise, late-evening peak, thin after midnight
  return Math.round(base * shape * Math.min(1, (glow - 0.35) / 0.3));
}
function drawFireflies(pt, sky, glow) {
  const dt = lastFlyT ? Math.min(0.1, (pt - lastFlyT) / 1000) : 0; lastFlyT = pt;
  const want = glow > 0.35 ? fireflyCount(sky.h, glow) : 0;
  while (flies.length < want) flies.push(newFly());
  if (flies.length > want) flies.length = want;
  for (let i = 0; i < flies.length; i++) {
    const f = flies[i];
    // lazy wandering: the heading drifts smoothly; a gentle pull keeps it near home
    f.turn += (Math.random() - 0.5) * 3 * dt; f.turn *= 0.96; f.dir += f.turn * dt * 3;
    const hx = f.hx - f.x, hy = f.hy - f.y, far = Math.hypot(hx, hy);
    if (far > 1.6) { let d = Math.atan2(hy, hx) - f.dir; d = Math.atan2(Math.sin(d), Math.cos(d)); f.dir += Math.sign(d) * dt * 1.2; }
    f.x += Math.cos(f.dir) * f.speed * dt; f.y += Math.sin(f.dir) * f.speed * dt;
    // bob slowly between grass height and head height; climb during a flash (the "J")
    f.z += (Math.sin(pt / 1700 + i * 2.1) * 4 - (f.z - 16) * 0.3) * dt;
    f.z = Math.max(5, Math.min(55, f.z));
    f.next -= dt; f.life -= dt;
    if (f.next <= 0 && f.flash < 0) { f.flash = 0; f.next = f.period * (0.8 + Math.random() * 0.5); }
    if (f.flash >= 0) {
      f.flash += dt; f.z += 26 * dt;
      // a neighbour sometimes answers a moment later
      if (f.flash < dt * 1.5 && Math.random() < 0.25) { const n = flies[(i + 1 + Math.floor(Math.random() * 4)) % flies.length]; if (n && n.flash < 0 && n.next > 0.6) n.next = 0.35 + Math.random() * 0.4; }
      if (f.flash > 0.75) f.flash = -1;
    }
    if (f.life <= 0 && f.flash < 0) { flies[i] = newFly(); continue; }
    // brightness: quick rise (0.12s), short hold, slower fade
    const k = f.flash < 0 ? 0 : f.flash < 0.12 ? f.flash / 0.12 : f.flash < 0.22 ? 1 : Math.max(0, 1 - (f.flash - 0.22) / 0.5) ** 1.6;
    const [gx, gy] = P(f.x, f.y), px = gx, py = gy - f.z;
    if (f.flash >= 0) { f.trail.push([px, py]); if (f.trail.length > 7) f.trail.shift(); } else f.trail.length = 0;
    const a = glow;
    if (k > 0.02) {
      // a small pool of green light on the grass below
      const pr = 10 + (30 - Math.min(30, f.z)) * 0.3;
      ctx.save(); ctx.translate(gx, gy); ctx.scale(1, 0.5);
      const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, pr * 1.6); pg.addColorStop(0, `rgba(170,230,70,${0.16 * k * a})`); pg.addColorStop(1, 'rgba(170,230,70,0)');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, pr * 1.6, 0, 7); ctx.fill(); ctx.restore();
      // the faint streak of the swoop
      for (let j = 0; j < f.trail.length - 1; j++) {
        const [tx, ty] = f.trail[j], ta = (j + 1) / f.trail.length;
        ctx.fillStyle = `rgba(200,255,90,${0.22 * ta * k * a})`; ctx.beginPath(); ctx.arc(tx, ty, 1.1 + ta, 0, 7); ctx.fill();
      }
      // soft halo, then the bright yellow-green lantern
      const hg = ctx.createRadialGradient(px, py, 0, px, py, 24);
      hg.addColorStop(0, `rgba(225,255,110,${0.9 * k * a})`); hg.addColorStop(0.18, `rgba(200,250,80,${0.45 * k * a})`); hg.addColorStop(0.5, `rgba(170,235,50,${0.12 * k * a})`); hg.addColorStop(1, 'rgba(160,230,40,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(px, py, 24, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(252,255,215,${Math.min(1, 1.2 * k) * a})`; ctx.beginPath(); ctx.arc(px, py, 2.3, 0, 7); ctx.fill();
    } else {
      // between flashes there's just the faintest ember
      ctx.fillStyle = `rgba(190,240,90,${0.12 * a})`; ctx.beginPath(); ctx.arc(px, py, 1, 0, 7); ctx.fill();
    }
  }
}
function drawLighting(pt, tall) {
  const sky = skyNow(); let { c, glow } = sky;
  if (sky.rain) c = c.map((v, i) => Math.round(v * [0.74, 0.78, 0.86][i]));
  ctx.save();
  if (c[0] < 254 || c[1] < 254 || c[2] < 254) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${c})`; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (W / 2 + cam.x), dpr * (H / 2 + cam.y));
  }
  if (glow > 0.12) {
    // warm light from lamp posts and windows
    ctx.globalCompositeOperation = 'lighter';
    for (const o of tall) {
      const b = BUILD[o.t]; let gx, gy, r, a;
      if (o.t === 'lamp') { [gx, gy] = P(o.x + 0.5, o.y + 0.5); gy -= 36; r = 46; a = 0.5; }
      else if (['house', 'producer', 'civic', 'station', 'storage', 'fishing'].includes(b.kind)) { [gx, gy] = P(o.x + b.w / 2 + 0.3, o.y + b.h / 2 + 0.3); gy -= 14; r = footW(b) * 0.42; a = 0.28; }
      else continue;
      const flick = 0.92 + Math.sin(pt / 170 + o.id * 3) * 0.05;
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
      gr.addColorStop(0, `rgba(255,190,90,${a * glow * flick})`); gr.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, r, 0, 7); ctx.fill();
    }
    if (season().name !== 'Winter') drawFireflies(pt, sky, glow);
  }
  ctx.restore();
  if (sky.rain || sky.mist) {
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (sky.rain) {
      ctx.fillStyle = 'rgba(70,85,105,.12)'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(225,235,250,.75)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i < 160; i++) {
        const x = (hash(i * 13) * (W + 100) + pt * 0.18) % (W + 100) - 50, y = (hash(i * 29 + 7) * (H + 60) + pt * (0.9 + hash(i) * 0.4)) % (H + 60) - 30;
        ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 22);
      }
      ctx.stroke();
    } else {
      for (let i = 0; i < 5; i++) {
        const y = H * (0.25 + i * 0.15), x = ((pt / 90 + i * 400) % (W + 600)) - 300;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 340); gr.addColorStop(0, 'rgba(250,250,245,.22)'); gr.addColorStop(1, 'rgba(250,250,245,0)');
        ctx.fillStyle = gr; ctx.fillRect(x - 340, y - 340, 680, 680);
      }
      ctx.fillStyle = 'rgba(245,245,240,.12)'; ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }
}
// repeating painted textures, scaled in world space
const _pats = {};
function pat(name, scale) {
  if (_pats[name]) return _pats[name];
  const im = spr(name); if (!im) return null;
  const p = ctx.createPattern(im, 'repeat');
  if (p.setTransform) p.setTransform(new DOMMatrix().scale(scale));
  return (_pats[name] = p);
}
// little painted details scattered on empty ground: wildflowers, clover, pebbles, mushrooms...
const DECALS = ['buttercup', 'violet', 'clover', 'pebbles', 'mushroom', 'dirt', 'dandelion', 'log', 'shrub'];
const WINTER_OK = new Set(['pebbles', 'log', 'shrub', 'dirt']);
let gridAt = () => null;
function drawDecals(vis, se) {
  // cattails along the riverbank
  const rd = spr('dc-reeds');
  if (rd && se.name !== 'Winter') for (const k of waterAt) {
    const wx = Math.floor(k / 1000), wy = k % 1000;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const gx = wx + dx, gy = wy + dy; if (isWater(gx, gy) || gridAt(gx, gy) || hash(gx * 53 + gy * 19) > 0.45) continue;
      const [cx, cy] = P(gx + 0.5 - dx * 0.3, gy + 0.5 - dy * 0.3); if (!vis(cx, cy)) continue;
      drawSprite(rd, cx, cy + 6, 26 + hash(gx + gy) * 10, hash(gy * 7 + gx) < 0.5, true);
    }
  }
  for (let gy = 1; gy < MAP - 1; gy++) for (let gx = 1; gx < MAP - 1; gx++) {
    const h = hash(gx * 131 + gy * 977); if (h > 0.13) continue;
    const name = DECALS[Math.floor(hash(gx * 7 + gy * 3 + 5) * DECALS.length)];
    if (se.name === 'Winter' && !WINTER_OK.has(name)) continue;
    if (gridAt(gx, gy)) continue;
    if (isWater(gx + 1, gy) || isWater(gx - 1, gy) || isWater(gx, gy + 1) || isWater(gx, gy - 1)) continue;   // the bank gets reeds instead
    const ox = hash(gx + gy * 31) * 0.5 + 0.25, oy = hash(gx * 17 + gy) * 0.5 + 0.25;
    const [cx, cy] = P(gx + ox, gy + oy); if (!vis(cx, cy)) continue;
    const im = spr('dc-' + name); if (!im) continue;
    const w = (name === 'log' || name === 'shrub' ? 30 : name === 'dirt' ? 34 : 20) * (0.8 + h * 2);
    drawSprite(im, cx, cy + 4, w, h < 0.06, true);
  }
}
let _ground = null;
function groundPaths() {
  if (_ground) return _ground;
  const even = new Path2D(), odd = new Path2D(), lines = new Path2D();
  for (let gy = 0; gy < MAP; gy++) for (let gx = 0; gx < MAP; gx++) {
    const d = diamond(gx, gy, 1, 1), path = (gx + gy) % 2 ? odd : even;
    for (const p of [path].concat(hash(gx * 97 + gy * 13) < 0.5 ? [] : [lines])) {
      p.moveTo(d[0][0], d[0][1]); for (let i = 1; i < 4; i++) p.lineTo(d[i][0], d[i][1]); p.closePath();
    }
  }
  return (_ground = { even, odd, lines });
}
export function draw() {
  const t = now(), pt = performance.now();
  indexRoads();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const se = season();
  ctx.fillStyle = se.bg; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (W / 2 + cam.x), dpr * (H / 2 + cam.y));
  ctx.imageSmoothingQuality = 'high';
  // world-space rectangle covering the whole screen (for the forest beyond the farm)
  const wx0 = (-W / 2 - cam.x) / cam.z, wy0 = (-H / 2 - cam.y) / cam.z, ww = W / cam.z, wh = H / cam.z;
  const forest = pat('tex-forest', 2.2);
  if (forest) {
    ctx.fillStyle = forest; ctx.fillRect(wx0, wy0, ww, wh);
    ctx.fillStyle = se.name === 'Winter' ? 'rgba(235,242,248,.5)' : se.name === 'Fall' ? 'rgba(170,110,40,.28)' : 'rgba(20,40,10,.18)';
    ctx.fillRect(wx0, wy0, ww, wh);
  }

  const margin = 80, z = cam.z;
  const vis = (px, py) => { const sx = px * z + W / 2 + cam.x, sy = py * z + H / 2 + cam.y; return sx > -margin * z && sx < W + margin * z && sy > -margin * z * 2 && sy < H + margin * z * 2; };

  // ground: the checkerboard is two pre-built shapes (2 fills instead of 900 tiles every frame)
  const GP = groundPaths(), grass = pat('tex-grass', 0.55);
  if (grass) {
    // painted meadow over the whole farm, tinted for the season
    const map = new Path2D(); const d = diamond(0, 0, MAP, MAP); map.moveTo(...d[0]); for (let i = 1; i < 4; i++) map.lineTo(...d[i]); map.closePath();
    ctx.fillStyle = grass; ctx.fill(map);
    const tint = { Spring: 'rgba(190,240,140,.14)', Summer: 'rgba(255,240,170,.06)', Fall: 'rgba(205,150,60,.26)', Winter: 'rgba(240,246,252,.62)' }[se.name];
    if (tint) { ctx.fillStyle = tint; ctx.fill(map); }
    // soft shadow where the farm meets the forest
    ctx.save(); ctx.clip(map); ctx.strokeStyle = 'rgba(20,35,10,.28)'; ctx.lineWidth = 26; ctx.stroke(map); ctx.lineWidth = 10; ctx.stroke(map); ctx.restore();
    drawDecals(vis, se);
    // the tile grid only shows while you're placing something or planting
    if (view.ghost || view.plantCrop) { ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1; ctx.stroke(GP.even); ctx.stroke(GP.odd); }
  } else {
    ctx.fillStyle = se.ground[0]; ctx.fill(GP.even);
    ctx.fillStyle = se.ground[1]; ctx.fill(GP.odd);
    ctx.strokeStyle = 'rgba(0,0,0,0.025)'; ctx.lineWidth = 1; ctx.stroke(GP.lines);
  }
  // map edge
  ctx.strokeStyle = 'rgba(40,70,25,.5)'; ctx.lineWidth = 3; poly(diamond(0, 0, MAP, MAP), null, null); ctx.stroke();

  const g = view.ghost;
  const hidden = g && g.move;
  const flat = [], tall = [];
  for (const o of S.objs) {
    if (o === hidden) continue;
    const b = BUILD[o.t];
    const [cx, cy] = P(o.x + b.w / 2, o.y + b.h / 2);
    if (!vis(cx, cy - heightOf(o) / 2)) continue;
    (isFlat(o) ? flat : tall).push(o);
  }
  tall.sort((a, b) => {
    const A = BUILD[a.t], B = BUILD[b.t];
    return (a.x + A.w / 2 + a.y + A.h / 2) - (b.x + B.w / 2 + b.y + B.h / 2) || a.x - b.x;
  });
  updateCats(pt);
  drawRiver(pt, vis);
  for (const o of flat) { const k = BUILD[o.t].kind; if (k === 'water') continue; k === 'field' ? drawField(o, t) : drawPath(o); }
  if (g) drawGhostFootprint(g);
  // draw tall objects, cats, and townsfolk in depth order
  updatePeople(pt);
  const catQ = [...cats, ...people.filter(p => p.visible)].sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const drawW = w => w.person ? drawPerson(w, pt) : drawCat(w, pt);
  let ci = 0;
  for (const o of tall) {
    const B = BUILD[o.t], d = o.x + B.w / 2 + o.y + B.h / 2;
    while (ci < catQ.length && catQ[ci].x + catQ[ci].y < d) drawW(catQ[ci++]);
    drawObj(o, t);
  }
  while (ci < catQ.length) drawW(catQ[ci++]);
  if (g) {
    // the building "held up" while you place it: floats a little above its squares and bobs gently;
    // dimmer when it can't go there
    const lift = 7 + Math.sin(pt / 260) * 2.5;
    ctx.save(); ctx.translate(0, -lift); ctx.globalAlpha = g.ok ? 0.85 : 0.5;
    drawObj({ ...g.proto, x: g.x, y: g.y }, t);
    ctx.restore();
  }
  drawLandForSale(pt);
  drawLandSigns(pt);
  drawLife(pt, tall, vis);
  drawLighting(pt, tall);
  for (const o of tall) drawStatus(o, BUILD[o.t], t);
  drawList = [...flat, ...tall];

  // floaters
  view.floaters = view.floaters.filter(f => pt - f.t0 < 1300);
  ctx.save();
  for (const f of view.floaters) {
    const k = (pt - f.t0) / 1300;
    ctx.globalAlpha = 1 - k * k;
    const pop = k < 0.15 ? 0.7 + k / 0.15 * 0.45 : k < 0.3 ? 1.15 - (k - 0.15) / 0.15 * 0.15 : 1;   // a little pop as it appears
    ctx.save(); ctx.translate(f.px, f.py - 30 - k * 36); ctx.scale(pop, pop);
    ctx.font = `800 16px "Fredoka", -apple-system, system-ui, sans-serif, ${EMOJI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const im = f.icon && (ICONS[f.icon] || (ICONS[f.icon] = Object.assign(new Image(), { src: 'sprites/' + f.icon + '.webp' })));
    const hasIm = im && im.complete && im.naturalWidth, tw = ctx.measureText(f.text).width, off = hasIm ? -10 : 0;
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(60,35,15,.75)'; ctx.lineJoin = 'round';
    ctx.strokeText(f.text, off, 0); ctx.fillStyle = f.color; ctx.fillText(f.text, off, 0);
    if (hasIm) ctx.drawImage(im, off + tw / 2 + 1, -11, 22, 22);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  drawGuide(pt);
  drawWeather(pt);
}
// bouncing arrow pointing at whatever the current hint is about
function drawGuide(pt) {
  const g = view.guide; if (!g) return;
  let gx, gy, lift;
  if (g.walker) { gx = g.walker.x; gy = g.walker.y; lift = g.walker.person ? 62 : 36; }
  else if (g.obj) { const b = BUILD[g.obj.t]; if (!S.objs.includes(g.obj)) return; gx = g.obj.x + b.w / 2; gy = g.obj.y + b.h / 2; lift = heightOf(g.obj) + 22; }
  else return;
  const [px, py] = P(gx, gy), y = py - lift - Math.abs(Math.sin(pt / 280)) * 10;
  ctx.save();
  ctx.fillStyle = '#FFD24A'; ctx.strokeStyle = '#7A4E0A'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(px, y + 14); ctx.lineTo(px - 12, y); ctx.lineTo(px - 5, y); ctx.lineTo(px - 5, y - 14); ctx.lineTo(px + 5, y - 14); ctx.lineTo(px + 5, y); ctx.lineTo(px + 12, y); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawObj(o, t) {
  const b = BUILD[o.t];
  const cfg = SPRITE_CFG[o.t], sp = cfg && spr(o.t);
  if (sp) {
    const [cx] = P(o.x + b.w / 2, o.y + b.h / 2), by = P(o.x + b.w, o.y + b.h)[1];
    const lot = b.kind !== 'decor' && b.kind !== 'hive';
    if (lot) drawLot(o, b);
    const land = landSquash(o);
    if (land) { ctx.save(); ctx.translate(cx, by); ctx.scale(1 + land, 1 - land); ctx.translate(-cx, -by); }
    if (cfg.iso) {
      // contact shadow along the footprint, then the building with its front corner on the footprint's front corner
      poly(diamond(o.x, o.y, b.w, b.h), 'rgba(40,30,10,.18)');
      const sw = footW(b) * cfg.k * squishOf(o), sh = drawSprite(sp, cx, by + 3 + (cfg.dy || 0), sw, !!o.flip, true);
      if (o.t === 'windmill') drawSails(cx - sw / 2 + sw * 0.27, by + 3 - sh + sh * 0.31, footW(b) * 0.62, t);
      if (land) ctx.restore();
      buildFx(o, b, cx, by, sh);
    } else { drawSprite(sp, cx, by + 4 + (cfg.dy || 0), footW(b) * cfg.k, !!o.flip, lot); if (land) ctx.restore(); }
    if (b.kind === 'hive') drawBees(o, t);
    landDust(o, b, cx, by);
    if (b.kind === 'station') drawTrain(o, b, t);
    if ((o.lvl || 1) > 1) drawLevelBadge(o, b);
    return;
  }
  switch (b.kind) {
    case 'field': return drawField(o, t);
    case 'path': return drawPath(o);
    case 'water': return;
    case 'hive': { const [cx, cy] = P(o.x + 0.5, o.y + 0.5); emoji('🐝', cx, cy - 10, 18); return; }
    case 'fishing': drawBox(o.x, o.y, b.w, b.h, b.hgt || 28, b.wall, b.roof, 16, b.icon); return;
    case 'orchard': return drawOrchard(o, t);
    case 'obstacle': return o.t === 'tree' ? drawTree(o, t) : drawRock(o);
    case 'pen': return drawPen(o, b, t);
    case 'decor': return drawDecor(o, b, t);
    default:
      drawBox(o.x, o.y, b.w, b.h, b.hgt || 30, b.wall, b.roof, 18 + (b.w + b.h) * 3, b.icon);
      if (b.kind === 'civic') drawCivicExtras(o, b, t);
      if (b.kind === 'station') drawTrain(o, b, t);
      if ((o.lvl || 1) > 1) drawLevelBadge(o, b);
  }
}
// windmill sails: turn slowly on the hub, in a plane facing down-left (toward the viewer's left)
function drawSails(hx, hy, size, t) {
  const im = spr('windmill-sails'); if (!im) return;
  ctx.save(); ctx.translate(hx, hy);
  ctx.transform(0.62, 0.28, 0, 1, 0, 0);          // foreshorten into the isometric plane
  ctx.rotate(t / 2600);
  const h = size * im.naturalHeight / im.naturalWidth;
  ctx.drawImage(im, -size / 2, -h / 2, size, h);
  ctx.restore();
}
// a gentle squish when you tap a building
export function squishOf(o) {
  const s = o._squish; if (!s) return 1;
  const k = (performance.now() - s) / 380; if (k >= 1) { o._squish = 0; return 1; }
  return 1 + Math.sin(k * Math.PI) * 0.06 * (1 - k);
}
// set down (built or moved): a quick squash-and-stretch as it lands
function landSquash(o) {
  const t0 = o._landed; if (!t0) return 0;
  const k = (Date.now() - t0) / 520; if (k >= 1) { o._landed = 0; return 0; }
  return Math.sin(k * Math.PI * 2.2) * 0.09 * (1 - k) * (1 - k);
}
// ...with a low ring of dust at its feet (moves only; new buildings get the fuller buildFx)
function landDust(o, b, cx, by) {
  const t0 = o._landed; if (!t0 || o.builtAt && Date.now() - o.builtAt < 1400) return;
  const k = (Date.now() - t0) / 520; if (k >= 1) return;
  ctx.save(); ctx.fillStyle = '#E8DCC2';
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, r = 14 + k * footW(b) * 0.5;
    ctx.globalAlpha = (1 - k) * 0.5; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, by - 4 + Math.sin(a) * r * 0.45, 4 + k * 8, 0, 7); ctx.fill();
  }
  ctx.restore();
}
// just built: rises from the ground with a dust puff and sparkles (o.builtAt set when placed)
function buildFx(o, b, cx, by, sh) {
  const k = o.builtAt ? (Date.now() - o.builtAt) / 1400 : 2; if (k >= 1) return;
  ctx.save();
  for (let i = 0; i < 10; i++) {   // dust puffs rolling outward
    const a = i / 10 * Math.PI * 2, r = 20 + k * footW(b) * 0.55, py = by - 4 + Math.sin(a) * r * 0.45;
    ctx.globalAlpha = (1 - k) * 0.55; ctx.fillStyle = '#E8DCC2';
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, py, 6 + k * 10, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1 - k; ctx.fillStyle = '#FFF4C2';
  for (let i = 0; i < 8; i++) { const a = hash(o.id * 13 + i) * 7, r = 10 + hash(i + o.id) * footW(b) * 0.4; star(cx + Math.cos(a) * r, by - sh * (0.3 + hash(i * 5) * 0.6) - k * 20, 3 + (1 - k) * 3); }
  ctx.restore();
}
function star(x, y, r) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.4 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
// A packed-earth lot exactly on the building's grid squares, so it reads as standing on its tiles.
function drawLot(o, b) {
  poly(diamond(o.x, o.y, b.w, b.h, 1), 'rgba(122,96,54,.55)');
  poly(diamond(o.x, o.y, b.w, b.h, 3), '#CDB98E');
  ctx.save(); ctx.clip();
  // soft shade toward the back corners, gravel speckles
  const [tx, ty] = P(o.x, o.y), [bx, byy] = P(o.x + b.w, o.y + b.h);
  const g = ctx.createLinearGradient(tx, ty, bx, byy);
  g.addColorStop(0, 'rgba(90,70,40,.28)'); g.addColorStop(0.6, 'rgba(90,70,40,0)');
  ctx.fillStyle = g; ctx.fillRect(Math.min(tx, bx) - 200, ty, 400 + Math.abs(bx - tx), byy - ty);
  ctx.fillStyle = 'rgba(110,88,52,.35)';
  for (let i = 0; i < 6 * b.w * b.h; i++) {
    const u = ((o.x * 7 + i * 13) % 17) / 17, v = ((o.y * 11 + i * 7) % 19) / 19;
    const [sx, sy] = P(o.x + u * b.w, o.y + v * b.h);
    ctx.fillRect(sx, sy, 2, 1);
  }
  ctx.restore();
}
function drawLevelBadge(o, b) {
  const [lx, ly] = P(o.x + b.w, o.y + b.h);
  ctx.fillStyle = '#E9A825'; ctx.beginPath(); ctx.arc(lx - 8, ly - 10, 8, 0, 7); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.lvl, lx - 8, ly - 9.5);
}
function drawGhostFootprint(g) {
  const b = BUILD[g.t];
  poly(diamond(g.x, g.y, b.w, b.h), g.ok ? 'rgba(120,230,90,.45)' : 'rgba(240,80,60,.45)', g.ok ? '#3B6D11' : '#A32D2D');
  // a soft glowing edge that breathes, so the spot reads clearly under the floating building
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
  ctx.save(); ctx.lineWidth = 2 + pulse * 2.5; ctx.strokeStyle = g.ok ? `rgba(220,255,190,${0.5 + pulse * 0.4})` : `rgba(255,200,190,${0.5 + pulse * 0.4})`;
  poly(diamond(g.x, g.y, b.w, b.h), null, null); ctx.stroke(); ctx.restore();
}

// ---------- house cats: Ollie & Milo ----------
// Ollie: fat orange tabby, slow, loves naps. Milo: skinny, hyper, mostly white with orange patches.
export const cats = [
  { id: 'ollie', name: 'Ollie', cat: true, x: 13.5, y: 12.5, path: null, speed: 0.35, range: 3, pause: 0, nap: false, face: 1, fat: true, zoomUntil: 0 },
  { id: 'milo',  name: 'Milo',  cat: true, x: 16.5, y: 13.5, path: null, speed: 2.2,  range: 7, pause: 0, nap: false, face: -1, fat: false, zoomUntil: 0 },
];
let lastCatT = 0;
let catFavorite = () => null; // optional: returns a favorite spot {x,y} for a cat
export function setCatGrid(fn, fav) { setNavGrid(fn); gridAt = fn; if (fav) catFavorite = fav; }
export function catGo(c, far) {
  const fav = !far && catFavorite(c);
  if (fav && Math.random() < 0.7 && planTo(c, Math.floor(fav.x), Math.floor(fav.y), true)) return;
  if (wander(c, c.x, c.y, far ? c.range * 1.6 : c.range)) return;
  // nowhere nearby to go: head back toward the barnyard
  wander(c, 15, 13, 3);
}
function updateCats(pt) {
  const dt = lastCatT ? Math.min(0.1, (pt - lastCatT) / 1000) : 0; lastCatT = pt;
  for (const c of cats) {
    unstick(c);
    if (c.react && pt < c.react.until) continue;          // showing off after a pet: stay put
    // the daily nap: walk to the chosen spot, then sleep there (with a little gift) until tapped
    if (c.napAt) {
      const at = Math.hypot(c.x - c.napAt.x, c.y - c.napAt.y) < 0.6;
      if (c.gift) { c.nap = true; continue; }
      if (at && !c.path) { c.gift = true; c.nap = true; continue; }
      if (!c.path && !c.napTried) { c.napTried = true; if (!planTo(c, Math.floor(c.napAt.x), Math.floor(c.napAt.y), true)) { c.x = c.napAt.x; c.y = c.napAt.y; } }
      const st = stepWalker(c, dt, c.speed);
      if (st !== 'moving') { c.path = null; if (!at) { c.x = c.napAt.x; c.y = c.napAt.y; } }
      continue;
    }
    if (pt < c.pause) continue;
    const st = stepWalker(c, dt, c.speed * (pt < c.zoomUntil ? 2.2 : 1));
    if (st === 'moving') { c.nap = false; continue; }
    if (st === 'blocked') { catGo(c, pt < c.zoomUntil); continue; }
    // arrived: rest a while (Ollie often naps), then pick somewhere new
    if (c.fat) { c.nap = Math.random() < 0.55; c.pause = pt + (c.nap ? 9000 + Math.random() * 14000 : 2500 + Math.random() * 5000); }
    else { c.nap = false; c.pause = pt + (pt < c.zoomUntil ? 80 : 400 + Math.random() * 2200); }
    catGo(c, pt < c.zoomUntil);
  }
}
// floating Zzz, and over a daily-nap cat a glowing gift bubble saying "tap me"
function napExtras(c, px, py, pt) {
  const zy = ((pt / 1200) % 1);
  ctx.save();
  ctx.globalAlpha = 1 - zy; ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = 'rgba(60,40,20,.5)'; ctx.lineWidth = 2; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  ctx.strokeText('z', px + 12 + zy * 6, py - 26 - zy * 14); ctx.fillText('z', px + 12 + zy * 6, py - 26 - zy * 14);
  ctx.restore();
  if (c.gift) bubble(px - 2, py - 50, 'sparkle', { mode: 'ready', t: pt, seed: c.fat ? 0 : 2 });
}
// little hearts drifting up from a happy cat
function catHearts(px, py, k, id) {
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const kk = (k * 1.6 + i * 0.22) % 1, a = 1 - kk;
    const x = px + Math.sin(kk * 6 + i * 2 + (id === 'milo' ? 1 : 0)) * 10 + (i - 1.5) * 6, y = py - 30 - kk * 34;
    ctx.globalAlpha = a; ctx.fillStyle = i % 2 ? '#F28BA0' : '#E8506E';
    const s = 4 + (1 - kk) * 2;
    ctx.beginPath(); ctx.moveTo(x, y + s); ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.4, x, y - s * 0.5);
    ctx.bezierCurveTo(x + s * 0.6, y - s * 1.4, x + s * 1.6, y - s * 0.2, x, y + s); ctx.fill();
  }
  ctx.restore();
}
function drawCat(c, pt) {
  const [px, py] = P(c.x, c.y);
  const moving = isWalking(c, pt);
  const cim = spr(c.fat ? (c.nap ? 'ollie-sleep' : 'ollie') : 'milo');
  const reacting = c.react && pt < c.react.until;
  if (cim && (reacting || (c.nap && !c.fat))) {
    // special poses: Ollie rolls over for belly rubs, Milo pounces; Milo curls up for his daily nap
    const k = reacting ? (c.react.until - pt) / c.react.dur : 0;
    let im = null, w = 34, lift = 0, rock = 0;
    if (reacting && c.fat) { im = spr('ollie-belly'); w = 42; rock = Math.sin(pt / 160) * 0.06; }
    else if (reacting) { im = spr('milo-pounce'); w = 26; lift = Math.abs(Math.sin(pt / 140)) * 6; }
    else { im = spr('milo-sleep'); w = 28; }
    im = im || cim;
    if (rock) { ctx.save(); ctx.translate(px, py + 3); ctx.rotate(rock); ctx.translate(-px, -(py + 3)); }
    drawSprite(im, px, py + 3 - lift, w + (c.nap ? Math.sin(pt / 700) * 0.6 : 0), c.face < 0);
    if (rock) ctx.restore();
    if (reacting) catHearts(px, py, 1 - k, c.id);
    if (c.nap) napExtras(c, px, py, pt);
    return;
  }
  if (cim) {
    // Painted animation frames: Ollie waddles (two slow alternating steps), Milo gallops
    // (stretch / gather, fast) and sits up when he stops. Falls back to the still pose.
    let im = cim, w = c.fat ? (c.nap ? 38 : 34) : 32, lift = 0;
    if (c.fat && !c.nap && moving) {
      const a = spr('ollie-w1'), b = spr('ollie-w2');
      if (a && b) { const ph = pt / 280; im = Math.floor(ph) % 2 ? b : a; w = 36; lift = Math.abs(Math.sin(ph * Math.PI)) * 1.2; }
      else lift = Math.abs(Math.sin(pt / 160)) * 1.5;
    } else if (!c.fat && moving) {
      const a = spr('milo-r1'), b = spr('milo-r2');
      const fast = pt < c.zoomUntil, ph = pt / (fast ? 75 : 105);
      if (a && b) {
        const leap = Math.floor(ph) % 2 === 0;
        im = leap ? a : b; w = leap ? 40 : 30;
        lift = leap ? Math.sin((ph % 1) * Math.PI) * 5 : 0; // airborne on the stretch, grounded on the gather
      } else lift = Math.abs(Math.sin(pt / 70)) * 4;
    } else if (!c.fat) {
      const s = spr('milo-sit');
      if (s) { im = s; w = 20; }
    }
    const breathe = c.nap ? Math.sin(pt / 700) * 0.6 : (!moving ? Math.sin(pt / 900 + c.x) * 0.3 : 0);
    drawSprite(im, px, py + 3 - lift, w + breathe, c.face < 0);
    if (c.nap) napExtras(c, px, py, pt);
    return;
  }
  ctx.save(); ctx.translate(px, py);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, 0, c.fat ? 13 : 10, c.fat ? 5 : 3.5, 0, 0, 7); ctx.fill();
  ctx.scale(c.face, 1);
  const ORANGE = '#E8892F', DARK = '#B9611A', WHITE = '#FBF8F2', PINK = '#F2A7A0';
  if (c.fat) {
    if (c.nap) {
      // curled-up loaf
      ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.ellipse(0, -7, 13, 8, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = DARK; ctx.lineWidth = 2;
      for (const sx of [-6, -1, 4]) { ctx.beginPath(); ctx.moveTo(sx, -14); ctx.quadraticCurveTo(sx + 2, -9, sx, -4); ctx.stroke(); }
      ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(9, -9, 6, 0, 7); ctx.fill();
      tri(6, -14, 8, -19, 11, -14, ORANGE); tri(10, -14, 13, -18, 14, -12, ORANGE);
      ctx.strokeStyle = '#4A2A10'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(8, -9); ctx.lineTo(10, -9); ctx.moveTo(11.5, -9.5); ctx.lineTo(13, -9.5); ctx.stroke();
      ctx.strokeStyle = ORANGE; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-11, -4); ctx.quadraticCurveTo(0, 2, 8, -2); ctx.stroke();
      ctx.restore();
      const zy = ((pt / 1200) % 1);
      ctx.globalAlpha = 1 - zy; ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('z', px + 10 * c.face + zy * 6, py - 22 - zy * 14); ctx.globalAlpha = 1;
      return;
    }
    const bob = moving ? Math.abs(Math.sin(pt / 160)) * 1.5 : 0;
    // legs
    ctx.fillStyle = ORANGE;
    for (const lx of [-7, -2, 4, 8]) ctx.fillRect(lx - 1.5, -5, 3, 5 - (moving ? Math.sin(pt / 160 + lx) * 1.5 : 0));
    // tail
    ctx.strokeStyle = ORANGE; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-11, -10); ctx.quadraticCurveTo(-18, -14, -16, -22 + Math.sin(pt / 700) * 2); ctx.stroke();
    // round body with stripes and white belly
    ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.ellipse(0, -11 - bob, 13, 9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#F6D7B0'; ctx.beginPath(); ctx.ellipse(1, -6 - bob, 8, 3.5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = DARK; ctx.lineWidth = 2;
    for (const sx of [-7, -2, 3]) { ctx.beginPath(); ctx.moveTo(sx, -19 - bob); ctx.quadraticCurveTo(sx + 2, -15 - bob, sx, -11 - bob); ctx.stroke(); }
    // head
    const hy = -18 - bob;
    tri(7, hy - 4, 9, hy - 11, 13, hy - 5, ORANGE); tri(12, hy - 5, 16, hy - 10, 17, hy - 3, ORANGE);
    ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(12, hy, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#F6D7B0'; ctx.beginPath(); ctx.ellipse(14, hy + 3, 3.5, 2.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#3A2410'; ctx.beginPath(); ctx.arc(11, hy - 1, 1.3, 0, 7); ctx.arc(15.5, hy - 1.5, 1.3, 0, 7); ctx.fill();
    ctx.fillStyle = PINK; ctx.beginPath(); ctx.arc(14.5, hy + 1.6, 1, 0, 7); ctx.fill();
  } else {
    const hop = moving ? Math.abs(Math.sin(pt / 70)) * 3 : 0;
    // thin legs
    ctx.fillStyle = WHITE;
    for (const lx of [-6, -3, 4, 7]) ctx.fillRect(lx - 1, -6 - hop, 2, 6 + (moving ? Math.sin(pt / 70 + lx) * 2 : 0));
    // long whippy tail
    ctx.strokeStyle = ORANGE; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    const wag = Math.sin(pt / (moving ? 90 : 220)) * 5;
    ctx.beginPath(); ctx.moveTo(-9, -11 - hop); ctx.bezierCurveTo(-16, -14 - hop, -14 + wag, -24 - hop, -20 + wag, -28 - hop); ctx.stroke();
    // slim white body with orange patches
    ctx.fillStyle = WHITE; ctx.beginPath(); ctx.ellipse(0, -11 - hop, 10, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.ellipse(-4, -13 - hop, 4, 2.6, 0.3, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(3, -14.5 - hop, 2.5, 1.6, 0, 0, 7); ctx.fill();
    // head
    const hy = -17 - hop;
    tri(7, hy - 3, 8, hy - 11, 12, hy - 4, ORANGE); tri(11, hy - 4, 15, hy - 10, 15, hy - 2, WHITE);
    ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(11, hy, 5.5, 0, 7); ctx.fill();
    ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.ellipse(9, hy - 3, 3, 2, -0.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#2E4A2A'; ctx.beginPath(); ctx.arc(10.5, hy - 0.5, 1.4, 0, 7); ctx.arc(14, hy - 1, 1.4, 0, 7); ctx.fill();
    ctx.fillStyle = PINK; ctx.beginPath(); ctx.arc(14.5, hy + 1.8, 0.9, 0, 7); ctx.fill();
  }
  ctx.restore();
}
// ---------- townsfolk ----------
export const people = [];
export function setPeople(defs) {
  for (const id in defs) {
    if (people.some(p => p.id === id)) continue;
    const d = defs[id], [hx, hy] = d.home;
    people.push({ id, person: true, def: d, home: [hx + 0.5, hy + 0.5], x: hx + 0.5, y: hy + 0.5, path: null, speed: 0.55, pause: 0, face: 1, visible: false, badge: null });
  }
}
// ---------- errands: townsfolk walk to the places tied to their jobs and work there a while ----------
let errandsFor = () => [];
export function setErrands(fn) { errandsFor = fn; }
const ICONS = {};
function iconImg(n) {
  let im = ICONS[n];
  if (!im) { im = ICONS[n] = new Image(); im.src = 'sprites/icon-' + n + '.webp'; }
  return im.complete && im.naturalWidth ? im : null;
}
// Plan a route to a free tile beside the target's footprint (front sides first, since they're visible).
function planBeside(p, t) {
  const w = t.w || 1, h = t.h || 1, spots = [];
  for (let i = 0; i < w; i++) spots.push([t.x + i, t.y + h, 0]);
  for (let j = 0; j < h; j++) spots.push([t.x + w, t.y + j, 0]);
  for (let i = 0; i < w; i++) spots.push([t.x + i, t.y - 1, 1]);
  for (let j = 0; j < h; j++) spots.push([t.x - 1, t.y + j, 1]);
  spots.sort((a, b) => a[2] - b[2] || Math.random() - 0.5);
  for (const [x, y] of spots) if (walkable(p, x, y) && planTo(p, x, y)) return true;
  return false;
}
function personGo(p) {
  p.task = null;
  const list = errandsFor(p.id) || [];
  if (list.length && Math.random() < 0.85) {
    const opts = list.filter(e => e.key !== p.lastKey).sort(() => Math.random() - 0.5);
    for (const e of opts.slice(0, 6)) {
      if (planBeside(p, e)) { p.task = e; p.lastKey = e.key; return; }
    }
  }
  // nothing to do right now: a stroll somewhere around their own part of town
  if (wander(p, p.home[0], p.home[1], 6)) return;
  if (wander(p, p.x, p.y, 7)) return;
  wander(p, 15, 13, 5);
}
function updatePeople(pt) {
  const dt = lastPeopleT ? Math.min(0.1, (pt - lastPeopleT) / 1000) : 0; lastPeopleT = pt;
  for (const p of people) {
    if (!p.visible) continue;
    unstick(p);
    if (pt < p.pause) { if (!p.doing && Math.random() < 0.003) p.face = -p.face; continue; } // glance around while standing
    if (p.doing) { p.doing = null; personGo(p); continue; } // finished the job: off to the next errand
    const st = stepWalker(p, dt, p.speed);
    if (st === 'moving') continue;
    if (st === 'blocked') { personGo(p); continue; }
    if (p.task) {
      // arrived: turn toward the building and get to work for a while
      const t = p.task, cx = t.x + (t.w || 1) / 2, cy = t.y + (t.h || 1) / 2;
      const sdx = (cx - cy) - (p.x - p.y);
      if (Math.abs(sdx) > 0.05) p.face = sdx > 0 ? 1 : -1;
      p.doing = t; p.doStart = pt; p.task = null;
      p.pause = pt + 7000 + Math.random() * 9000;
    } else {
      p.pause = pt + 1500 + Math.random() * 3000;
      personGo(p);
    }
  }
}
let lastPeopleT = 0;
function drawPerson(p, pt) {
  const [px, py] = P(p.x, p.y), d = p.def;
  const moving = isWalking(p, pt);
  const step = moving ? Math.sin(pt / 140) * 2.5 : 0;
  const pim = spr('p-' + p.id);
  if (pim) {
    // Walk cycle: stride-left → passing → stride-right → passing, using painted walking frames.
    // The body rises slightly on the passing frames and dips on the strides, like a real gait.
    // When standing still they breathe gently instead.
    const w1 = spr('p-' + p.id + '-w1'), w2 = spr('p-' + p.id + '-w2');
    const frames = w1 && w2;
    const ph = pt / 165 + p.home[0] * 3.1;
    const beat = Math.floor(ph) % 4;                         // which of the 4 walk frames
    const frac = ph - Math.floor(ph);
    let img = pim, bounce, tilt, squash, stepUp;
    if (moving && frames) {
      img = beat === 0 ? w1 : beat === 2 ? w2 : pim;
      const passing = beat === 1 || beat === 3;
      stepUp = passing ? Math.sin(frac * Math.PI) : 0;
      bounce = stepUp * 2.5;
      tilt = (beat < 2 ? 1 : -1) * 0.025;
      squash = passing ? 0 : 0.02 * Math.sin(frac * Math.PI);
    } else {
      const sw = Math.sin(ph); stepUp = moving ? Math.abs(sw) : 0;
      bounce = stepUp * 4;
      tilt = moving ? sw * 0.09 : Math.sin(pt / 1400 + p.home[1]) * 0.015;
      squash = moving ? (1 - stepUp) * 0.05 : Math.sin(pt / 800 + p.home[0]) * 0.012;
    }
    if (p.doing && !moving) {
      // busy at a job: lean in and out rhythmically (kneading, hammering, tending)
      const s = Math.sin((pt - (p.doStart || 0)) / 260);
      tilt = (p.face < 0 ? -1 : 1) * 0.07 * (0.5 + 0.5 * s);
      squash = 0.025 * Math.max(0, s);
    }
    const h = 50, w = h * img.naturalWidth / img.naturalHeight;
    ctx.fillStyle = 'rgba(30,40,10,0.22)';
    ctx.beginPath(); ctx.ellipse(px, py + 3, w * 0.42 * (1 - stepUp * 0.15), w * 0.14, 0, 0, 7); ctx.fill();
    ctx.save();
    ctx.translate(px, py + 4 - bounce);
    ctx.rotate(tilt);
    ctx.scale((p.face < 0 ? -1 : 1) * (1 + squash * 0.6), 1 - squash);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
    drawBadge(p, px, py, pt);
    return;
  }
  ctx.save(); ctx.translate(px, py);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 3.5, 0, 0, 7); ctx.fill();
  ctx.scale(p.face, 1);
  // legs
  ctx.fillStyle = '#3B3330'; ctx.fillRect(-4, -9 + Math.max(0, step), 3, 9 - Math.max(0, step)); ctx.fillRect(1, -9 + Math.max(0, -step), 3, 9 - Math.max(0, -step));
  // body / coat
  ctx.fillStyle = d.coat; ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(6, -8); ctx.lineTo(5, -22); ctx.quadraticCurveTo(0, -25, -5, -22); ctx.closePath(); ctx.fill();
  // arms
  ctx.strokeStyle = d.coat; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-5, -20); ctx.lineTo(-7, -12 - step * 0.6); ctx.moveTo(5, -20); ctx.lineTo(7, -12 + step * 0.6); ctx.stroke();
  // head
  ctx.fillStyle = d.skin; ctx.beginPath(); ctx.arc(0, -29, 5.5, 0, 7); ctx.fill();
  ctx.fillStyle = d.hair; ctx.beginPath(); ctx.arc(-0.5, -30.5, 5.6, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
  ctx.fillStyle = '#2B1B12'; ctx.beginPath(); ctx.arc(2.5, -29, 0.9, 0, 7); ctx.fill();
  if (d.hat) {
    ctx.fillStyle = d.hat; ctx.beginPath(); ctx.ellipse(0, -33, 8, 2.2, 0, 0, 7); ctx.fill();
    ctx.fillRect(-4.5, -39, 9, 6);
  }
  ctx.restore();
  drawBadge(p, px, py, pt);
}
function drawBadge(p, px, py, pt) {
  if (p.badge) {
    const y = py - 60 + Math.sin(pt / 300) * 2;
    ctx.fillStyle = p.badge === '✓' ? '#6BA43A' : '#E9A825';
    ctx.beginPath(); ctx.arc(px, y, 9, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.badge, px, y + 0.5);
    return;
  }
  // what they're busy with: a little thought bubble with a painted icon
  const ic = p.doing && pt < p.pause && iconImg(p.doing.icon);
  if (ic) {
    const age = pt - (p.doStart || 0), left = p.pause - pt;
    const a = Math.min(1, age / 400, left / 400);
    const y = py - 64 + Math.sin(pt / 450) * 1.5;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,250,236,.95)'; ctx.strokeStyle = '#8B5A2B'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(px + 4, y, 12, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(px - 3, y + 15, 2.5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.drawImage(ic, px + 4 - 9, y - 9, 18, 18);
    ctx.restore();
  }
}

function tri(x1, y1, x2, y2, x3, y3, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill(); }
export function catPos(c) { return { x: c.x, y: c.y }; }

// ---------- hit testing ----------
export function hit(sx, sy) {
  const wx = (sx - W / 2 - cam.x) / cam.z, wy = (sy - H / 2 - cam.y) / cam.z;
  for (const p of people) { if (!p.visible) continue; const [px, py] = P(p.x, p.y); if (Math.abs(wx - px) < 14 && wy < py + 4 && wy > py - 60) return { person: p }; }
  for (const c of cats) { const [px, py] = P(c.x, c.y); if (Math.abs(wx - px) < 20 && wy < py + 4 && wy > py - 30) return { cat: c }; }
  const tile = s2w(sx, sy), tx = Math.floor(tile.x), ty = Math.floor(tile.y);
  for (let i = drawList.length - 1; i >= 0; i--) {
    const o = drawList[i], b = BUILD[o.t];
    if (isFlat(o)) continue;
    const inFoot = tx >= o.x && tx < o.x + b.w && ty >= o.y && ty < o.y + b.h;
    if (inFoot) return o;
    if (b.w === 1 && b.h === 1) {
      // single-square things (trees, hives, lamps): only their own canopy counts, so a dense orchard row
      // doesn't swallow taps meant for the tree behind
      const [cx, cy] = P(o.x + 0.5, o.y + 0.5);
      if (Math.abs(wx - cx) < 14 && wy < cy - 14 && wy > cy - heightOf(o)) return o;
      continue;
    }
    const left = P(o.x, o.y + b.h)[0], right = P(o.x + b.w, o.y)[0];
    const top = P(o.x, o.y)[1] - heightOf(o), bottom = P(o.x + b.w / 2, o.y + b.h / 2)[1] + 2;
    const shrink = b.kind === 'obstacle' ? 10 : 4;
    if (wx > left + shrink && wx < right - shrink && wy > top && wy < bottom) return o;
  }
  for (const o of drawList) { const b = BUILD[o.t]; if (isFlat(o) && tx >= o.x && tx < o.x + b.w && ty >= o.y && ty < o.y + b.h) return o; }
  return null;
}
