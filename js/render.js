// Pelham Acres — isometric canvas renderer. Placeholder art drawn in code;
// later each type can be swapped for an AI-generated sprite via SPRITES.
import { TW, TH, MAP, BUILD, CROPS, ITEMS } from './data.js';
import { S, now, fieldReady, jobsDone, animalState, rentDue, penAnimal, season, trainState } from './game.js';
import { setNavGrid, planTo, wander, stepWalker, isWalking, unstick, walkable } from './nav.js';

export const cam = { x: 0, y: 0, z: 1 };
export const view = { ghost: null, floaters: [], plantCrop: null, guide: null };
// ---------- AI-painted sprites ----------
// k = width as a fraction of the footprint's diamond width; dy = nudge of the bottom edge.
export const SPRITES = {};
const SPRITE_CFG = {
  // every picture fits inside its own ground space (k <= 1), so neighbours never overlap side-to-side
  // iso: painted at the grid's isometric angle, so the picture's bottom corner sits on the footprint's front corner
  barn: { k: 1, iso: 1 }, feedMill: { k: 1, iso: 1 }, bakery: { k: 1, iso: 1 }, workshop: { k: 1, iso: 1 }, dairy: { k: 1, iso: 1 }, sugarMill: { k: 1, iso: 1 },
  kitchen: { k: 1, iso: 1 }, loom: { k: 1, iso: 1 }, cafe: { k: 1, iso: 1 },
  cottage: { k: 1, iso: 1 }, farmhouse: { k: 1, iso: 1 }, townhouse: { k: 0.85, iso: 1 }, manor: { k: 1, iso: 1 },
  townHall: { k: 1, iso: 1 }, generalStore: { k: 1, iso: 1 }, schoolhouse: { k: 1, iso: 1 }, clockTower: { k: 0.62, iso: 1 }, bandstand: { k: 1, iso: 1 }, station: { k: 1, iso: 1 },
  flowers: { k: 0.92 }, hedge: { k: 0.85 }, bench: { k: 0.88 }, lamp: { k: 0.4 }, pond: { k: 0.97 }, gazebo: { k: 1, iso: 1 }, fountain: { k: 1, iso: 1 }, windmill: { k: 0.9, iso: 1 },
};
const SPRITE_NAMES = [...Object.keys(SPRITE_CFG), 'coop', 'cowshed', 'sheepfold', 'tree-spring', 'tree-summer', 'tree-fall', 'tree-winter', 'rock',
  'chicken', 'cow', 'sheep', 'ollie', 'ollie-sleep', 'milo', 'ollie-w1', 'ollie-w2', 'milo-r1', 'milo-r2', 'milo-sit','p-hattie', 'p-joe', 'p-dottie', 'p-tom', 'p-rosa', 'p-finch', 'p-ellis',
  'soil', 'sprout', 'growing', ...Object.keys(CROPS).map(c => 'crop-' + c),
  ...['joe', 'dottie', 'tom', 'rosa', 'finch', 'ellis'].flatMap(id => ['p-' + id + '-w1', 'p-' + id + '-w2'])];
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
export function floater(gx, gy, text, color = '#fff') { const [px, py] = P(gx, gy); view.floaters.push({ px, py, text, color, t0: performance.now() }); }

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
  if (b.kind === 'path') return 0;
  return (b.hgt || 30) + 18 + (b.w + b.h) * 3;
}
// fields join the depth-sorted pass once crops are painted (ripe crops stand up off the ground)
const isFlat = o => { const k = BUILD[o.t].kind; return k === 'path' || (k === 'field' && !spr('soil')); };

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
    if (ripe) {
      const sway = Math.sin(t / 700 + o.id) * 0.6;
      drawSprite(ripe, cx + sway, cy + 9, 46, (o.id & 1) === 1, true);
      if (((t / 900 + o.id) % 3) < 0.25) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(cx + 12, cy - 22, 2.2, 0, 7); ctx.fill(); }
      return;
    }
    const stage = spr(p < 0.4 ? 'sprout' : 'growing');
    if (stage) { const w = p < 0.4 ? 26 + p * 15 : 32 + p * 10; drawSprite(stage, cx, cy + 7, w, (o.id & 1) === 1, true); return; }
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

function drawPath(o) { poly(diamond(o.x, o.y, 1, 1, 1), '#CFC6B4', 'rgba(90,80,60,.35)'); const [cx, cy] = P(o.x + 0.5, o.y + 0.5); ctx.fillStyle = 'rgba(120,110,90,.35)'; for (const [dx, dy] of [[-8, 0], [6, -3], [2, 5]]) { ctx.beginPath(); ctx.ellipse(cx + dx, cy + dy, 5, 2.5, 0, 0, 7); ctx.fill(); } }

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
function drawTrain(o, b, t) {
  const st = trainState(o);
  if (st.status !== 'here') return;
  // a little freight train parked along the front of the station
  const cars = ['#2F3E46', '#B8432F', '#3A6EA5', '#6B8E23', '#C9A27A'];
  for (let i = 0; i < cars.length; i++) {
    const gx = o.x + b.w + 0.15, gy = o.y - 0.6 + i * 0.75;
    const filled = i === 0 || (st.train.crates[i - 1] && st.train.crates[i - 1].filled);
    drawBoxPlain(gx, gy, 0.55, 0.6, i === 0 ? 16 : 11, filled ? cars[i] : '#9A978F');
    if (i === 0) { const [sx, sy] = P(gx + 0.3, gy + 0.2); ctx.fillStyle = `rgba(240,240,240,${0.5 + 0.3 * Math.sin(t / 300)})`; ctx.beginPath(); ctx.arc(sx, sy - 24 - (t / 40 % 10), 4, 0, 7); ctx.fill(); }
  }
}
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
  const a = penAnimal(o), aim = spr(b.animal), aw = { chicken: 22, cow: 38, sheep: 32 }[b.animal];
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
      ctx.fillStyle = 'rgba(30,40,10,0.2)'; ctx.beginPath(); ctx.ellipse(sx, sy + 1, aw * 0.4 * (1 - lift * 0.04), aw * 0.13, 0, 0, 7); ctx.fill();
      const ah = aw * aim.naturalHeight / aim.naturalWidth;
      ctx.save(); ctx.translate(sx, sy + 2 - lift); ctx.scale(m.face, 1 - squash);
      ctx.translate(-aw * 0.28, 0); ctx.rotate(tilt); ctx.translate(aw * 0.28, 0); // pivot on the back legs
      ctx.drawImage(aim, -aw / 2, -ah, aw, ah); ctx.restore();
    }
    else emoji(a.icon, sx, sy - 8, 17);
    if (st === 'ready') {
      const pi = iconImg(a.product), y = sy - (aim ? aw * 0.95 : 22) + Math.sin(t / 400 + i) * 1.5;
      if (pi) ctx.drawImage(pi, sx + 2, y - 8, 15, 15); else emoji(ITEMS[a.product].icon, sx + 9, y, 10);
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
    case 'fence': {
      const a = P(o.x, o.y + 0.5), c = P(o.x + 1, o.y + 0.5); ctx.strokeStyle = '#F2EBDD'; ctx.lineWidth = 2.5;
      for (const hgt of [5, 11]) { ctx.beginPath(); ctx.moveTo(a[0], a[1] - hgt); ctx.lineTo(c[0], c[1] - hgt); ctx.stroke(); }
      for (let k = 0; k <= 3; k++) { const x = a[0] + (c[0] - a[0]) * k / 3, y = a[1] + (c[1] - a[1]) * k / 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 15); ctx.stroke(); }
      break;
    }
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
function bubble(x, y, icon, ring) {
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.arc(x + 1, y + 2, 12, 0, 7); ctx.fill();
  ctx.fillStyle = '#FFFBF0'; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill();
  if (ring != null) {
    ctx.strokeStyle = '#E3D4B8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#6BA43A'; ctx.beginPath(); ctx.arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + ring * Math.PI * 2); ctx.stroke();
  }
  emoji(icon, x, y + 1, 13);
}
function drawStatus(o, b, t) {
  const top = P(o.x + b.w / 2, o.y + b.h / 2);
  const y = top[1] - heightOf(o) - 8 + Math.sin(t / 400 + o.id) * 2;
  const x = top[0];
  if (b.kind === 'producer') {
    const done = jobsDone(o);
    if (done) bubble(x, y, ITEMS[o.jobs[0].out].icon);
    else if (o.jobs.length) { const j = o.jobs[0]; bubble(x, y, ITEMS[j.out].icon, Math.max(0, Math.min(1, (t - j.start) / (j.end - j.start)))); }
  } else if (b.kind === 'pen') {
    const a = penAnimal(o);
    if (o.animals.some(an => animalState(an) === 'ready')) bubble(x, y, ITEMS[a.product].icon);
    else if (o.animals.length && o.animals.every(an => animalState(an) === 'hungry')) bubble(x, y, ITEMS[a.feed].icon);
  } else if (b.kind === 'house') {
    if (rentDue(o) > 0) bubble(x, y, '🪙');
  } else if (b.kind === 'station') {
    const st = trainState(o);
    if (st.status === 'here') bubble(x, y, st.train.crates.every(c => c.filled) ? '✅' : '📦');
  }
}

// ---------- main draw ----------
let drawList = [];
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
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const se = season();
  ctx.fillStyle = se.bg; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (W / 2 + cam.x), dpr * (H / 2 + cam.y));
  ctx.imageSmoothingQuality = 'high';

  const margin = 80, z = cam.z;
  const vis = (px, py) => { const sx = px * z + W / 2 + cam.x, sy = py * z + H / 2 + cam.y; return sx > -margin * z && sx < W + margin * z && sy > -margin * z * 2 && sy < H + margin * z * 2; };

  // ground: the checkerboard is two pre-built shapes (2 fills instead of 900 tiles every frame)
  const GP = groundPaths();
  ctx.fillStyle = se.ground[0]; ctx.fill(GP.even);
  ctx.fillStyle = se.ground[1]; ctx.fill(GP.odd);
  ctx.strokeStyle = 'rgba(0,0,0,0.025)'; ctx.lineWidth = 1; ctx.stroke(GP.lines);
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
  for (const o of flat) BUILD[o.t].kind === 'field' ? drawField(o, t) : drawPath(o);
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
  if (g) { ctx.globalAlpha = 0.75; drawObj({ ...g.proto, x: g.x, y: g.y }, t); ctx.globalAlpha = 1; }
  for (const o of tall) drawStatus(o, BUILD[o.t], t);
  drawList = [...flat, ...tall];

  // floaters
  view.floaters = view.floaters.filter(f => pt - f.t0 < 1300);
  ctx.save();
  for (const f of view.floaters) {
    const k = (pt - f.t0) / 1300;
    ctx.globalAlpha = 1 - k * k;
    ctx.font = `bold 15px -apple-system,system-ui,sans-serif, ${EMOJI}`; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,25,10,.7)';
    ctx.strokeText(f.text, f.px, f.py - 30 - k * 36); ctx.fillStyle = f.color; ctx.fillText(f.text, f.px, f.py - 30 - k * 36);
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
    const lot = b.kind !== 'decor';
    if (lot) drawLot(o, b);
    if (cfg.iso) {
      // contact shadow along the footprint, then the building with its front corner on the footprint's front corner
      poly(diamond(o.x, o.y, b.w, b.h), 'rgba(40,30,10,.18)');
      drawSprite(sp, cx, by + 3 + (cfg.dy || 0), footW(b) * cfg.k, false, true);
    } else drawSprite(sp, cx, by + 4 + (cfg.dy || 0), footW(b) * cfg.k, false, lot);
    if (b.kind === 'station') drawTrain(o, b, t);
    if ((o.lvl || 1) > 1) drawLevelBadge(o, b);
    return;
  }
  switch (b.kind) {
    case 'field': return drawField(o, t);
    case 'path': return drawPath(o);
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
}

// ---------- house cats: Ollie & Milo ----------
// Ollie: fat orange tabby, slow, loves naps. Milo: skinny, hyper, mostly white with orange patches.
export const cats = [
  { id: 'ollie', name: 'Ollie', cat: true, x: 13.5, y: 12.5, path: null, speed: 0.35, range: 3, pause: 0, nap: false, face: 1, fat: true, zoomUntil: 0 },
  { id: 'milo',  name: 'Milo',  cat: true, x: 16.5, y: 13.5, path: null, speed: 2.2,  range: 7, pause: 0, nap: false, face: -1, fat: false, zoomUntil: 0 },
];
let lastCatT = 0;
let catFavorite = () => null; // optional: returns a favorite spot {x,y} for a cat
export function setCatGrid(fn, fav) { setNavGrid(fn); if (fav) catFavorite = fav; }
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
function drawCat(c, pt) {
  const [px, py] = P(c.x, c.y);
  const moving = isWalking(c, pt);
  const cim = spr(c.fat ? (c.nap ? 'ollie-sleep' : 'ollie') : 'milo');
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
    if (c.nap) {
      const zy = ((pt / 1200) % 1);
      ctx.globalAlpha = 1 - zy; ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = 'rgba(60,40,20,.5)'; ctx.lineWidth = 2; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.strokeText('z', px + 12 + zy * 6, py - 26 - zy * 14); ctx.fillText('z', px + 12 + zy * 6, py - 26 - zy * 14); ctx.globalAlpha = 1;
    }
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
    const left = P(o.x, o.y + b.h)[0], right = P(o.x + b.w, o.y)[0];
    const top = P(o.x, o.y)[1] - heightOf(o), bottom = P(o.x + b.w / 2, o.y + b.h / 2)[1] + 2;
    const shrink = b.kind === 'obstacle' ? 10 : 4;
    if (wx > left + shrink && wx < right - shrink && wy > top && wy < bottom) return o;
  }
  for (const o of drawList) { const b = BUILD[o.t]; if (isFlat(o) && tx >= o.x && tx < o.x + b.w && ty >= o.y && ty < o.y + b.h) return o; }
  return null;
}
