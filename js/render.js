// Pelham Acres — isometric canvas renderer. Placeholder art drawn in code;
// later each type can be swapped for an AI-generated sprite via SPRITES.
import { TW, TH, MAP, BUILD, CROPS, ITEMS } from './data.js';
import { S, now, fieldReady, jobsDone, animalState, rentDue, penAnimal, season, trainState } from './game.js';

export const cam = { x: 0, y: 0, z: 1 };
export const view = { ghost: null, floaters: [], plantCrop: null };
export const SPRITES = {}; // type -> HTMLImageElement (filled in later with AI art)

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
  if (b.kind === 'obstacle') return o.t === 'tree' ? 52 : 22;
  if (b.kind === 'pen') return 36;
  if (b.kind === 'decor') return o.t === 'lamp' ? 40 : 18;
  if (b.kind === 'field' || b.kind === 'path') return 0;
  return (b.hgt || 30) + 18 + (b.w + b.h) * 3;
}
const isFlat = o => { const k = BUILD[o.t].kind; return k === 'field' || k === 'path'; };

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
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(cx + 3, cy + 2, 16 * s, 7 * s, 0, 0, 7); ctx.fill();
  poly([[cx - 16 * s, cy], [cx - 10 * s, cy - 14 * s], [cx + 2 * s, cy - 20 * s], [cx + 14 * s, cy - 10 * s], [cx + 16 * s, cy], [cx + 4 * s, cy + 5 * s]], '#9A978F');
  poly([[cx - 10 * s, cy - 14 * s], [cx + 2 * s, cy - 20 * s], [cx + 14 * s, cy - 10 * s], [cx, cy - 8 * s]], '#B9B6AE');
}

function drawPen(o, b, t) {
  const pts = diamond(o.x, o.y, b.w, b.h, 1);
  poly(pts, b.ground, 'rgba(80,60,30,.3)');
  // little shelter in the back corner
  drawBox(o.x + 0.1, o.y + 0.1, 0.9, 0.9, 18, b.wall, b.roof, 12, null);
  const a = penAnimal(o);
  o.animals.forEach((an, i) => {
    const r1 = hash(o.id * 31 + i), r2 = hash(o.id * 17 + i * 3);
    const fx = 0.35 + 0.55 * ((r1 + Math.sin(t / 2600 + i * 2) * 0.12 + 1) % 1);
    const fy = 0.45 + 0.45 * ((r2 + Math.cos(t / 3100 + i) * 0.12 + 1) % 1);
    const [sx, sy] = P(o.x + fx * b.w, o.y + fy * b.h);
    const st = animalState(an);
    emoji(a.icon, sx, sy - 8 + (st === 'busy' ? Math.sin(t / 250 + i) : 0), 17);
    if (st === 'ready') emoji(ITEMS[a.product].icon, sx + 9, sy - 20, 10);
  });
  // fence
  const T = P(o.x, o.y), R = P(o.x + b.w, o.y), B = P(o.x + b.w, o.y + b.h), L = P(o.x, o.y + b.h);
  ctx.strokeStyle = '#8B6A43'; ctx.lineWidth = 2;
  for (const [p1, p2] of [[L, B], [B, R]]) {
    for (const hgt of [5, 10]) { ctx.beginPath(); ctx.moveTo(p1[0], p1[1] - hgt); ctx.lineTo(p2[0], p2[1] - hgt); ctx.stroke(); }
    for (let k = 0; k <= 4; k++) { const x = p1[0] + (p2[0] - p1[0]) * k / 4, y = p1[1] + (p2[1] - p1[1]) * k / 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 13); ctx.stroke(); }
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
export function draw() {
  const t = now(), pt = performance.now();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const se = season();
  ctx.fillStyle = se.bg; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (W / 2 + cam.x), dpr * (H / 2 + cam.y));
  ctx.imageSmoothingQuality = 'high';

  const margin = 80, z = cam.z;
  const vis = (px, py) => { const sx = px * z + W / 2 + cam.x, sy = py * z + H / 2 + cam.y; return sx > -margin * z && sx < W + margin * z && sy > -margin * z * 2 && sy < H + margin * z * 2; };

  // ground
  poly(diamond(0, 0, MAP, MAP), null, null);
  ctx.save();
  for (let gy = 0; gy < MAP; gy++) for (let gx = 0; gx < MAP; gx++) {
    const [cx, cy] = P(gx + 0.5, gy + 0.5);
    if (!vis(cx, cy)) continue;
    const v = hash(gx * 97 + gy * 13);
    poly(diamond(gx, gy, 1, 1), se.ground[(gx + gy) % 2], v < 0.5 ? null : 'rgba(0,0,0,0.025)');
  }
  ctx.restore();
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
  drawWeather(pt);
}

function drawObj(o, t) {
  const b = BUILD[o.t];
  const sp = SPRITES[o.t];
  if (sp && sp.complete && sp.naturalWidth) {
    const [bx, by] = P(o.x + b.w, o.y + b.h);
    const L = P(o.x, o.y + b.h), R = P(o.x + b.w, o.y);
    const w = R[0] - L[0], h = w * sp.naturalHeight / sp.naturalWidth;
    ctx.drawImage(sp, L[0], by - h, w, h);
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
      if ((o.lvl || 1) > 1) {
        const [lx, ly] = P(o.x + b.w, o.y + b.h);
        ctx.fillStyle = '#E9A825'; ctx.beginPath(); ctx.arc(lx - 8, ly - 10, 8, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.lvl, lx - 8, ly - 9.5);
      }
  }
}
function drawGhostFootprint(g) {
  const b = BUILD[g.t];
  poly(diamond(g.x, g.y, b.w, b.h), g.ok ? 'rgba(120,230,90,.45)' : 'rgba(240,80,60,.45)', g.ok ? '#3B6D11' : '#A32D2D');
}

// ---------- house cats: Ollie & Milo ----------
// Ollie: fat orange tabby, slow, loves naps. Milo: skinny, hyper, mostly white with orange patches.
export const cats = [
  { id: 'ollie', name: 'Ollie', x: 13.5, y: 12.5, tx: 13.5, ty: 12.5, speed: 0.35, range: 3, pause: 0, nap: false, face: 1, fat: true, zoomUntil: 0 },
  { id: 'milo',  name: 'Milo',  x: 16.5, y: 13.5, tx: 16.5, ty: 13.5, speed: 2.2,  range: 7, pause: 0, nap: false, face: -1, fat: false, zoomUntil: 0 },
];
let lastCatT = 0;
function catSpotOk(x, y) {
  if (x < 8 || y < 8 || x > 22 || y > 22) return false; // stay around the farmyard
  const o = objAtTile(Math.floor(x), Math.floor(y));
  return !o || o.t === 'field' || o.t === 'path';
}
let objAtTile = () => null;
let catFavorite = () => null; // optional: returns a favorite spot {x,y} for a cat
export function setCatGrid(fn, fav) { objAtTile = fn; if (fav) catFavorite = fav; }
export function catGo(c, far) {
  const fav = !far && catFavorite(c);
  if (fav && Math.random() < 0.7) { c.tx = fav.x; c.ty = fav.y; return; }
  const r = far ? c.range * 1.6 : c.range;
  for (let i = 0; i < 25; i++) {
    const x = c.x + (Math.random() * 2 - 1) * r, y = c.y + (Math.random() * 2 - 1) * r;
    if (catSpotOk(x, y)) { c.tx = x; c.ty = y; return; }
  }
  // stuck somewhere odd: head back toward the barnyard
  c.tx = 14 + Math.random() * 3; c.ty = 12 + Math.random() * 3;
}
function updateCats(pt) {
  const dt = lastCatT ? Math.min(0.1, (pt - lastCatT) / 1000) : 0; lastCatT = pt;
  for (const c of cats) {
    if (pt < c.pause) continue;
    const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
    if (d < 0.05) {
      if (c.fat) { c.nap = Math.random() < 0.55; c.pause = pt + (c.nap ? 9000 + Math.random() * 14000 : 2500 + Math.random() * 5000); }
      else { c.nap = false; c.pause = pt + (pt < c.zoomUntil ? 80 : 400 + Math.random() * 2200); }
      catGo(c, pt < c.zoomUntil);
      continue;
    }
    c.nap = false;
    const sp = c.speed * (pt < c.zoomUntil ? 2.2 : 1);
    const st = Math.min(d, sp * dt);
    c.x += dx / d * st; c.y += dy / d * st;
    if (Math.abs(dx - dy) > 0.01) c.face = dx - dy > 0 ? 1 : -1;
  }
}
function drawCat(c, pt) {
  const [px, py] = P(c.x, c.y);
  const moving = pt >= c.pause && Math.hypot(c.tx - c.x, c.ty - c.y) > 0.05;
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
    people.push({ id, person: true, def: d, home: [hx + 0.5, hy + 0.5], x: hx + 0.5, y: hy + 0.5, tx: hx + 0.5, ty: hy + 0.5, speed: 0.55, pause: 0, face: 1, visible: false, badge: null });
  }
}
function personGo(p) {
  for (let i = 0; i < 20; i++) {
    const x = p.home[0] + (Math.random() * 2 - 1) * 4, y = p.home[1] + (Math.random() * 2 - 1) * 4;
    if (catSpotOk(x, y)) { p.tx = x; p.ty = y; return; }
  }
  p.tx = 14.5 + Math.random() * 2; p.ty = 12.5 + Math.random() * 2;
}
function updatePeople(pt) {
  const dt = lastPeopleT ? Math.min(0.1, (pt - lastPeopleT) / 1000) : 0; lastPeopleT = pt;
  for (const p of people) {
    if (!p.visible || pt < p.pause) continue;
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
    if (d < 0.05) { p.pause = pt + 2000 + Math.random() * 6000; personGo(p); continue; }
    const st = Math.min(d, p.speed * dt);
    p.x += dx / d * st; p.y += dy / d * st;
    if (Math.abs(dx - dy) > 0.01) p.face = dx - dy > 0 ? 1 : -1;
  }
}
let lastPeopleT = 0;
function drawPerson(p, pt) {
  const [px, py] = P(p.x, p.y), d = p.def;
  const moving = pt >= p.pause && Math.hypot(p.tx - p.x, p.ty - p.y) > 0.05;
  const step = moving ? Math.sin(pt / 140) * 2.5 : 0;
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
  if (p.badge) {
    const y = py - 52 + Math.sin(pt / 300) * 2;
    ctx.fillStyle = p.badge === '✓' ? '#6BA43A' : '#E9A825';
    ctx.beginPath(); ctx.arc(px, y, 9, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.badge, px, y + 0.5);
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
