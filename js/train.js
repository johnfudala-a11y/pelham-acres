// Pelham Acres — the freight train at the station, drawn as a small shaded 3D model:
// a steam locomotive and open wagons on a ballasted track. Wagons show their cargo once
// you've filled their crate. Everything is projected onto the same isometric grid as the map.
import { TW, TH } from './data.js';
import { roadTexture, ROAD_TEX } from './roads.js';

const hw = TW / 2, hh = TH / 2;
const ZS = hw * Math.SQRT2 * Math.cos(Math.PI / 6);     // screen pixels per tile of height (2:1 isometric camera)
const V = [0.6124, 0.6124, 0.5];                        // toward the camera (world: gx, gy, up)
const L = (() => { const v = [0.5, 0.15, 1], l = Math.hypot(...v); return v.map(c => c / l); })();   // toward the sun
const K = 1.3;                                           // model scale: train units → tiles
let ctx, CV = 0, UC = 0;                                 // CV / UC: grid x of the track's centre line, grid y of its middle

// ---------- tiny vector kit ----------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => mul(a, 1 / Math.hypot(...a));
// train-local (u along the track, v across it, w up) → world, and world → screen
const W3 = (u, v, w) => [CV + v * K, UC + (u - UC) * K, w * K];
const pj = p => [(p[0] - p[1]) * hw, (p[0] + p[1]) * hh - p[2] * ZS];
const NU = [0, 1, 0], NV = [1, 0, 0], NW = [0, 0, 1];

const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const css = c => `rgb(${c.map(v => Math.max(0, Math.min(255, Math.round(v)))).join()})`;
const lit = (col, n, gloss = 0) => {
  const d = Math.max(0, dot(n, L)), k = 0.52 + 0.55 * d;
  const c = (typeof col === 'string' ? rgb(col) : col).map(v => v * k);
  if (gloss) { const h = Math.pow(Math.max(0, dot(unit(add(L, V)), n)), 18) * gloss * 255; return c.map(v => v + h); }
  return c;
};

// ---------- primitives ----------
function poly2(pts, fill, edge) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = edge || fill; ctx.lineWidth = edge ? 0.6 : 0.45; ctx.stroke();
}
// a flat face given in train-local points with its outward normal; skipped when facing away
function face(pts, n, col, o = {}) {
  if (!o.always && dot(n, V) <= 0.001) return false;
  poly2(pts.map(p => pj(W3(...p))), css(lit(col, n, o.gloss)), o.edge);
  return true;
}
const EDGE = 'rgba(30,22,14,.38)';
// a box (only the three faces the camera can see)
function box(u0, u1, v0, v1, w0, w1, col, o = {}) {
  face([[u0, v1, w0], [u1, v1, w0], [u1, v1, w1], [u0, v1, w1]], NV, col, o);             // long side
  face([[u1, v0, w0], [u1, v1, w0], [u1, v1, w1], [u1, v0, w1]], NU, col, o);             // front end
  if (!o.noTop) face([[u0, v0, w1], [u1, v0, w1], [u1, v1, w1], [u0, v1, w1]], NW, o.top || col, o);
}
// a line drawn on the model (rivets, planks, rods)
function line3(a, b, col, w = 0.7) { const p = pj(W3(...a)), q = pj(W3(...b)); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
function hull(P) {
  const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
// a smooth-shaded cylinder from local point a to b; returns the visible end cap's centre and basis for decorating
function cyl(a, b, r, col, o = {}) {
  const A = W3(...a), B = W3(...b), d = unit(sub(B, A));
  let e1 = Math.abs(d[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1]; e1 = unit(sub(e1, mul(d, dot(e1, d)))); const e2 = cross(d, e1);
  const NS = 30, ra = [], rb = [], pA = pj(A), pB = pj(B), stops = [];
  let sx = pB[0] - pA[0], sy = pB[1] - pA[1]; const sl = Math.hypot(sx, sy);
  const nx = sl < 1e-3 ? 1 : -sy / sl, ny = sl < 1e-3 ? 0 : sx / sl;
  for (let i = 0; i < NS; i++) {
    const th = i / NS * Math.PI * 2, n = add(mul(e1, Math.cos(th)), mul(e2, Math.sin(th)));
    const qa = pj(add(A, mul(n, r))), qb = pj(add(B, mul(n, r))); ra.push(qa); rb.push(qb);
    if (dot(n, V) > -0.02) stops.push([(qa[0] - pA[0]) * nx + (qa[1] - pA[1]) * ny, lit(col, n, o.gloss)]);
  }
  stops.sort((p, q) => p[0] - q[0]);
  const s0 = stops[0][0], s1 = stops[stops.length - 1][0], g = ctx.createLinearGradient(pA[0] + nx * s0, pA[1] + ny * s0, pA[0] + nx * s1, pA[1] + ny * s1);
  for (const [s, c] of stops) g.addColorStop(s1 > s0 ? (s - s0) / (s1 - s0) : 0, css(c));
  const h = hull(ra.concat(rb));
  ctx.beginPath(); ctx.moveTo(h[0][0], h[0][1]); for (let i = 1; i < h.length; i++) ctx.lineTo(h[i][0], h[i][1]); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); if (!o.noEdge) { ctx.strokeStyle = EDGE; ctx.lineWidth = 0.5; ctx.stroke(); }
  // the end cap facing us
  const front = dot(d, V) >= 0, ring = front ? rb : ra, cn = front ? d : mul(d, -1);
  if (Math.abs(dot(d, V)) > 0.01) poly2(ring, css(lit(o.cap || col, cn)), o.noEdge ? null : EDGE);
  return { c: front ? B : A, e1, e2, n: cn };
}
// a point on a cap, for spokes and doors
const capPt = (cap, r, th) => pj(add(cap.c, add(mul(cap.e1, r * Math.cos(th)), mul(cap.e2, r * Math.sin(th)))));
function disc(cap, r, fill, edge) { const pts = []; for (let i = 0; i < 20; i++) pts.push(capPt(cap, r, i / 20 * Math.PI * 2)); poly2(pts, fill, edge); }

// ---------- parts ----------
function wheel(u, w, r, rot, rim, hub) {
  const cap = cyl([u, 0.15, w], [u, 0.175, w], r, '#26262A', { cap: '#2E2E33' });
  disc(cap, r * 0.84, css(lit(rim, NV)));
  ctx.strokeStyle = css(lit('#2A1A14', NV)); ctx.lineWidth = Math.max(0.5, r * 9);
  const c = pj(cap.c);
  for (let k = 0; k < 8; k++) { const q = capPt(cap, r * 0.8, rot + k * Math.PI / 4); ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
  disc(cap, r * 0.26, css(lit(hub || '#C9A24A', NV)));
  return cap;
}
function crate(u0, u1, v0, v1, w0, w1) {
  box(u0, u1, v0, v1, w0, w1, '#B98A55', { edge: EDGE, top: '#C99A63' });
  const k = '#7D5630';
  for (const f of [0.33, 0.66]) line3([u0 + (u1 - u0) * f, v1, w0], [u0 + (u1 - u0) * f, v1, w1], css(lit(k, NV)), 0.6);
  line3([u0, v1, w0], [u1, v1, w1], css(lit(k, NV)), 0.7);
  line3([u1, v0, w0], [u1, v1, w1], css(lit(k, NU)), 0.6);
}
function barrel(u, v, w0, w1, r) {
  cyl([u, v, w0], [u, v, w1], r, '#9C6A3C', { cap: '#7E5330' });
  for (const f of [0.22, 0.78]) cyl([u, v, w0 + (w1 - w0) * f - 0.006], [u, v, w0 + (w1 - w0) * f + 0.006], r * 1.03, '#55565C', { noEdge: true });
}
// a burlap grain sack, slumped, with a tied neck
function sack(u, v, w, r) {
  const p = pj(W3(u, v, w)), R = r * ZS * K, x = p[0], y = p[1];
  const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.5, R * 0.1, x, y, R * 1.2);
  g.addColorStop(0, '#E2C893'); g.addColorStop(0.6, '#BF9B62'); g.addColorStop(1, '#8A6A3C');
  ctx.fillStyle = g; ctx.strokeStyle = 'rgba(60,40,20,.55)'; ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(x - R * 0.95, y + R * 0.15);
  ctx.bezierCurveTo(x - R * 1.05, y - R * 0.55, x - R * 0.45, y - R * 0.85, x - R * 0.12, y - R * 0.8);
  ctx.lineTo(x + R * 0.12, y - R * 0.8);
  ctx.bezierCurveTo(x + R * 0.5, y - R * 0.85, x + R * 1.05, y - R * 0.5, x + R * 0.95, y + R * 0.15);
  ctx.bezierCurveTo(x + R * 0.8, y + R * 0.55, x - R * 0.8, y + R * 0.55, x - R * 0.95, y + R * 0.15);
  ctx.fill(); ctx.stroke();
  // neck and tie
  ctx.fillStyle = '#C9A46A'; ctx.beginPath(); ctx.ellipse(x, y - R * 0.95, R * 0.2, R * 0.22, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#6B4A26'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - R * 0.17, y - R * 0.8); ctx.lineTo(x + R * 0.17, y - R * 0.8); ctx.stroke();
  // a seam and a stencilled stripe
  ctx.strokeStyle = 'rgba(90,60,30,.35)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(x - R * 0.2, y - R * 0.6); ctx.quadraticCurveTo(x - R * 0.3, y, x - R * 0.15, y + R * 0.4); ctx.stroke();
  ctx.strokeStyle = 'rgba(150,50,40,.55)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(x - R * 0.6, y - R * 0.1); ctx.quadraticCurveTo(x, y + R * 0.05, x + R * 0.6, y - R * 0.1); ctx.stroke();
}
// an open freight wagon; with cargo once its crate is filled
function wagon(u0, len, col, full, kind, rot) {
  const u1 = u0 + len, wt = 0.31, wb = 0.12, t = 0.022, V0 = -0.18, V1 = 0.18;
  box(u0 + 0.03, u1 - 0.03, -0.14, 0.14, 0.07, wb, '#2C2C31');                     // underframe
  for (const uw of [u0 + 0.12, u1 - 0.12]) wheel(uw, 0.062, 0.062, rot, '#3B3B40', '#8E8E95');
  // interior: floor and the two far walls' inner faces
  face([[u0 + t, V0 + t, wb + 0.01], [u1 - t, V0 + t, wb + 0.01], [u1 - t, V1 - t, wb + 0.01], [u0 + t, V1 - t, wb + 0.01]], NW, '#5A3E26');
  face([[u0 + t, V0 + t, wb], [u1 - t, V0 + t, wb], [u1 - t, V0 + t, wt], [u0 + t, V0 + t, wt]], NV, col, { always: true });
  face([[u0 + t, V0 + t, wb], [u0 + t, V1 - t, wb], [u0 + t, V1 - t, wt], [u0 + t, V0 + t, wt]], NU, col, { always: true });
  if (full) {
    if (kind === 0) { crate(u0 + 0.05, u0 + 0.27, -0.13, 0.1, wb, 0.3); crate(u0 + 0.3, u1 - 0.05, -0.12, 0.12, wb, 0.27); crate(u0 + 0.08, u0 + 0.25, -0.1, 0.08, 0.3, 0.42); }
    else if (kind === 1) { barrel(u0 + 0.15, -0.05, wb, 0.33, 0.075); barrel(u0 + 0.36, 0.06, wb, 0.33, 0.075); barrel(u1 - 0.12, -0.04, wb, 0.33, 0.075); }
    else { sack(u0 + 0.14, -0.06, 0.2, 0.085); sack(u0 + 0.38, -0.05, 0.2, 0.085); sack(u0 + 0.26, 0.08, 0.21, 0.085); sack(u0 + 0.27, -0.02, 0.3, 0.08); }
  }
  // near walls, rim and planking
  face([[u0, V1, wb], [u1, V1, wb], [u1, V1, wt], [u0, V1, wt]], NV, col, { edge: EDGE });
  face([[u1, V0, wb], [u1, V1, wb], [u1, V1, wt], [u1, V0, wt]], NU, col, { edge: EDGE });
  const rim = '#4A3A2C';
  box(u0, u1, V0, V0 + t, wt, wt + 0.012, rim); box(u0, u0 + t, V0, V1, wt, wt + 0.012, rim);
  box(u0, u1, V1 - t, V1, wt, wt + 0.012, rim); box(u1 - t, u1, V0, V1, wt, wt + 0.012, rim);
  const dk = css(lit(rgb(col).map(c => c * 0.6), NV));
  for (let k = 1; k < 4; k++) { const u = u0 + len * k / 4; line3([u, V1, wb], [u, V1, wt], dk, 0.8); }
  line3([u0, V1, (wb + wt) / 2], [u1, V1, (wb + wt) / 2], css(lit(rgb(col).map(c => c * 0.78), NV)), 0.5);
  for (const f of [0.12, 0.88]) for (const ww of [wb + 0.03, wt - 0.03]) { const p = pj(W3(u0 + len * f, V1 + 0.002, ww)); ctx.fillStyle = 'rgba(30,20,10,.55)'; ctx.fillRect(p[0] - 0.5, p[1] - 0.5, 1, 1); }
}
function loco(u0, len, rot, pt, moving) {
  const u1 = u0 + len, G = '#2F6B4A', BLK = '#26272C', BR = '#D3A84A', RED = '#A8382A';
  box(u0, u1 - 0.05, -0.15, 0.15, 0.07, 0.13, BLK);                                   // frame
  // cowcatcher: a slanted grille in front
  face([[u1, -0.15, 0.1], [u1 + 0.1, -0.06, 0.015], [u1 + 0.1, 0.06, 0.015], [u1, 0.15, 0.1]], unit([0, 0.7, 0.7]), '#8E2F24', { edge: EDGE });
  face([[u1 - 0.02, 0.15, 0.015], [u1 + 0.1, 0.06, 0.015], [u1, 0.15, 0.1]], unit([0.7, 0.7, 0]), '#7A281F', { edge: EDGE });
  for (let k = 1; k < 5; k++) { const f = k / 5; line3([u1, -0.15 + 0.3 * f, 0.1], [u1 + 0.1, -0.06 + 0.12 * f, 0.015], 'rgba(40,15,10,.6)', 0.5); }
  box(u1 - 0.06, u1, -0.18, 0.18, 0.08, 0.14, RED, { edge: EDGE });                   // buffer beam
  for (const v of [-0.12, 0.12]) cyl([u1, v, 0.11], [u1 + 0.035, v, 0.11], 0.022, '#3A3A40', { cap: '#8F9097' });
  // wheels and the connecting rod
  const drv = [u0 + 0.17, u0 + 0.37, u0 + 0.57], caps = drv.map(u => wheel(u, 0.088, 0.088, rot, RED, BR));
  wheel(u1 - 0.12, 0.05, 0.05, rot * 1.7, RED, BR);
  const pins = caps.map(c => capPt(c, 0.045, rot));
  ctx.strokeStyle = '#C8CBD2'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(pins[0][0], pins[0][1]); ctx.lineTo(pins[2][0], pins[2][1]); ctx.stroke();
  ctx.strokeStyle = '#7E8189'; ctx.lineWidth = 0.6; ctx.stroke();
  // running board
  box(u0 + 0.28, u1 - 0.06, -0.18, 0.18, 0.15, 0.172, BLK, { top: '#3A3B42' });
  // cab
  const cw0 = 0.15, cw1 = 0.47, cu1 = u0 + 0.3;
  box(u0, cu1, -0.17, 0.17, cw0, cw1, G, { edge: EDGE, noTop: true });
  face([[u0 + 0.06, 0.1701, 0.31], [u0 + 0.24, 0.1701, 0.31], [u0 + 0.24, 0.1701, 0.42], [u0 + 0.06, 0.1701, 0.42]], NV, '#3B2A1E');
  face([[u0 + 0.075, 0.1702, 0.32], [u0 + 0.225, 0.1702, 0.32], [u0 + 0.225, 0.1702, 0.41], [u0 + 0.075, 0.1702, 0.41]], NV, '#F3D27A', { gloss: 0.6 });
  line3([u0, 0.1702, 0.21], [cu1, 0.1702, 0.21], BR, 0.9);                            // brass lining
  for (const v of [-0.1, 0.1]) face([[cu1 + 0.001, v - 0.045, 0.42], [cu1 + 0.001, v + 0.045, 0.42], [cu1 + 0.001, v + 0.045, 0.46], [cu1 + 0.001, v - 0.045, 0.46]], NU, '#F3D27A');
  // curved cab roof
  const arc = [], RN = 8; for (let k = 0; k <= RN; k++) { const a = Math.PI * (1 - k / RN); arc.push([0.21 * Math.cos(a), cw1 + 0.06 * Math.sin(a), Math.cos(a), Math.sin(a)]); }
  const ru0 = u0 - 0.03, ru1 = cu1 + 0.03;
  for (let k = 0; k < RN; k++) {
    const [va, wa, na, ma] = arc[k], [vb, wb2, nb, mb] = arc[k + 1];
    face([[ru0, va, wa], [ru1, va, wa], [ru1, vb, wb2], [ru0, vb, wb2]], unit([(na + nb) / 2, 0, (ma + mb) / 2]), '#33373F');
  }
  poly2(arc.map(([v, w]) => pj(W3(ru1, v, w))), css(lit('#3B4049', NU)), EDGE);
  // boiler with brass bands, smokebox with its round door
  cyl([cu1, 0, 0.29], [u1 - 0.15, 0, 0.29], 0.12, G, { gloss: 0.35 });
  for (const f of [0.08, 0.5, 0.92]) { const u = cu1 + (u1 - 0.15 - cu1) * f; cyl([u - 0.008, 0, 0.29], [u + 0.008, 0, 0.29], 0.124, BR, { noEdge: true, gloss: 0.8 }); }
  const sb = cyl([u1 - 0.15, 0, 0.29], [u1 - 0.05, 0, 0.29], 0.126, BLK, { cap: '#303138', gloss: 0.3 });
  disc(sb, 0.085, css(lit('#3A3B43', NU)), 'rgba(0,0,0,.45)');
  disc(sb, 0.014, BR);
  // dome, sand box, whistle, chimney, headlamp
  cyl([u0 + 0.55, 0, 0.38], [u0 + 0.55, 0, 0.455], 0.048, BR, { gloss: 0.9, cap: '#E2BC62' });
  cyl([u0 + 0.55, 0, 0.455], [u0 + 0.55, 0, 0.47], 0.03, BR, { gloss: 0.9, cap: '#E9C873' });
  cyl([u0 + 0.42, 0, 0.39], [u0 + 0.42, 0, 0.43], 0.038, G, { cap: '#3A7A57' });
  cyl([cu1 + 0.03, 0, 0.4], [cu1 + 0.03, 0, 0.47], 0.012, BR, { gloss: 1 });
  const cu = u1 - 0.1;
  cyl([cu, 0, 0.39], [cu, 0, 0.53], 0.036, BLK, { cap: '#111' });
  cyl([cu, 0, 0.53], [cu, 0, 0.575], 0.054, BLK, { cap: '#0C0C0E', gloss: 0.3 });
  const lamp = cyl([u1 - 0.09, 0, 0.445], [u1 - 0.03, 0, 0.445], 0.03, BLK, { cap: '#FFE69A' });
  const lp = pj(lamp.c), lg = ctx.createRadialGradient(lp[0], lp[1], 0, lp[0], lp[1], 9);
  lg.addColorStop(0, 'rgba(255,236,160,.55)'); lg.addColorStop(1, 'rgba(255,236,160,0)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lp[0], lp[1], 9, 0, 7); ctx.fill();
  // steam rising from the chimney, drifting back over the train
  const top = pj(W3(cu, 0, 0.6)), back = [hw * 0.5, -hh * 0.5], n = moving ? 9 : 6, period = moving ? 900 : 2600;
  for (let i = 0; i < n; i++) {
    const k = ((pt / period + i / n) % 1), r = 2.5 + k * (moving ? 11 : 8);
    const x = top[0] + back[0] * k * (moving ? 6 : 2.2) + Math.sin(pt / 700 + i * 2.1) * 2 * k, y = top[1] - k * (moving ? 22 : 30) + back[1] * k * (moving ? 6 : 2.2);
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.75 * (1 - k)})`); g.addColorStop(1, 'rgba(236,236,240,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
}

// ---------- the track ----------
let gravel = null;
function track(U0, U1) {
  // ballast bed: the gravel road texture laid flat, with soft shoulders
  if (!gravel) { gravel = ctx.createPattern(roadTexture('gravel'), 'repeat'); if (gravel && gravel.setTransform) gravel.setTransform(new DOMMatrix([2 / ROAD_TEX, 0, 0, 2 / ROAD_TEX, 0, 0])); }
  ctx.save(); ctx.transform(hw, hh, -hw, hh, 0, 0);
  const x0 = CV - 0.36 * K, x1 = CV + 0.36 * K, g0 = W3(U0, 0, 0)[1], g1 = W3(U1, 0, 0)[1];
  ctx.fillStyle = 'rgba(40,32,20,.22)'; ctx.fillRect(x0 - 0.04, g0 - 0.04, x1 - x0 + 0.08, g1 - g0 + 0.08);
  ctx.beginPath(); ctx.rect(x0, g0, x1 - x0, g1 - g0);
  ctx.fillStyle = gravel || '#A99D86'; ctx.fill(); ctx.clip();
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, 'rgba(60,48,30,.38)'); g.addColorStop(0.18, 'rgba(60,48,30,0)'); g.addColorStop(0.82, 'rgba(60,48,30,0)'); g.addColorStop(1, 'rgba(60,48,30,.3)');
  ctx.fillStyle = g; ctx.fillRect(x0, g0, x1 - x0, g1 - g0);
  ctx.restore();
  // wooden ties
  for (let u = U0 + 0.06; u < U1 - 0.06; u += 0.17) box(u, u + 0.06, -0.24, 0.24, 0, 0.02, '#6E4A2E', { top: '#7E5636' });
  // rails, the far one first
  for (const v of [-0.14, 0.14]) {
    box(U0, U1, v - 0.014, v + 0.014, 0.02, 0.052, '#5D5F66', { top: '#B9BCC4' });
    line3([U0, v, 0.0525], [U1, v, 0.0525], 'rgba(235,238,245,.65)', 0.5);
  }
  // a buffer stop at the far end
  box(U0 - 0.02, U0 + 0.05, -0.2, 0.2, 0, 0.16, '#7A4B2A', { edge: EDGE });
  box(U0 + 0.05, U0 + 0.09, -0.16, 0.16, 0.08, 0.14, '#C0392B', { edge: EDGE });
}

const WAGON_COL = ['#B8432F', '#3A6EA5', '#5E8A2E', '#C98A2E'];
// o: the station, b: its BUILD entry, st: trainState(o), t: game clock (ms), pt: frame clock (ms)
export function drawTrainScene(c, o, b, st, t, pt) {
  ctx = c; CV = o.x + b.w + 0.55; UC = o.y + b.h / 2;
  const U0 = UC - 2.35 / K, U1 = UC + 2.4 / K;      // the track: about 4¾ tiles long
  ctx.save(); ctx.lineJoin = 'round';
  track(U0, U1);
  if (st.status === 'here') {
    const tr = st.train, lenL = 0.86, lenW = 0.54, gap = 0.06, n = 4;
    const total = lenL + n * (lenW + gap), start = UC - total / 2 + 0.08;
    // pulling in: slides up the track and eases to a stop
    const k = Math.min(1, Math.max(0, (t - tr.arrive) / 3800)), du = -3.2 * Math.pow(1 - k, 3);
    const rot = du / 0.088, moving = k < 1;
    ctx.save();
    ctx.beginPath();                                   // keep the train on its own stretch of track while it rolls in
    const clip = [W3(U0 + 0.02, -0.6, 0), W3(U1 + 0.5, -0.6, 0), W3(U1 + 0.5, 0.6, 0), W3(U0 + 0.02, 0.6, 0)].map(pj);
    ctx.moveTo(clip[0][0], clip[0][1] - 80); ctx.lineTo(clip[1][0], clip[1][1] - 80); ctx.lineTo(clip[2][0], clip[2][1] + 10); ctx.lineTo(clip[3][0], clip[3][1] + 10); ctx.closePath();
    if (moving) ctx.clip();
    // shadow beneath the train
    const s0 = start + du, s1 = start + total + du;
    poly2([W3(s0, -0.12, 0), W3(s1, -0.12, 0), W3(s1, 0.3, 0), W3(s0, 0.3, 0)].map(pj), 'rgba(30,25,15,.22)', 'rgba(0,0,0,0)');
    for (let i = 0; i < n; i++) {
      const u = start + du + i * (lenW + gap), full = !!(tr.crates[n - 1 - i] && tr.crates[n - 1 - i].filled);
      wagon(u, lenW, WAGON_COL[(n - 1 - i) % WAGON_COL.length], full, (n - 1 - i) % 3, rot);
      box(u + lenW, u + lenW + gap, -0.025, 0.025, 0.085, 0.105, '#2A2A2F');      // coupling
    }
    loco(start + du + n * (lenW + gap), lenL, rot, pt, moving);
    ctx.restore();
  }
  ctx.restore();
}
