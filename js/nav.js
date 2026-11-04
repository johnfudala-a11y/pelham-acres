// Pelham Acres — walking routes for the cats and townsfolk.
// Walkers move tile-to-tile along A* paths, so they go around trees, rocks,
// buildings, fences and decorations instead of through them.
import { MAP } from './data.js';

let objAt = () => null;
export const setNavGrid = fn => { objAt = fn; };

const LO = 7, HI = 23; // walkers stay around the farmyard and town

// Can this walker stand on tile (x, y)?
export function walkable(w, x, y) {
  if (x < LO || y < LO || x > HI || y > HI) return false;
  const o = objAt(x, y);
  if (!o || o.t === 'path') return true;
  // cats are nimble: they can trot across fields and hop onto benches and flower beds
  if (w.cat) return o.t === 'field' || o.t === 'bench' || o.t === 'flowers';
  return false;
}

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
const octile = (ax, ay, bx, by) => { const dx = Math.abs(ax - bx), dy = Math.abs(ay - by); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };

// A* over tiles. Returns [[x,y], ...] (excluding the start) or null if unreachable.
export function findPath(w, sx, sy, tx, ty) {
  if (!walkable(w, tx, ty)) return null;
  if (sx === tx && sy === ty) return [];
  const key = (x, y) => y * MAP + x;
  const g = new Map([[key(sx, sy), 0]]), prev = new Map(), closed = new Set();
  const open = [[octile(sx, sy, tx, ty), sx, sy]];
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, x, y] = open.splice(bi, 1)[0];
    const k = key(x, y);
    if (closed.has(k)) continue;
    closed.add(k);
    if (x === tx && y === ty) {
      const out = [];
      for (let c = k; c !== key(sx, sy); c = prev.get(c)) out.push([c % MAP, Math.floor(c / MAP)]);
      return out.reverse();
    }
    for (const [dx, dy, cost] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!walkable(w, nx, ny)) continue;
      // no squeezing diagonally between two obstacles
      if (dx && dy && (!walkable(w, x + dx, y) || !walkable(w, x, y + dy))) continue;
      const nk = key(nx, ny), ng = g.get(k) + cost;
      if (ng < (g.has(nk) ? g.get(nk) : Infinity)) {
        g.set(nk, ng); prev.set(nk, k);
        open.push([ng + octile(nx, ny, tx, ty), nx, ny]);
      }
    }
  }
  return null;
}

// Plan a route to tile (tx, ty). Waypoints get a little jitter so walkers don't march on rails.
export function planTo(w, tx, ty, exact) {
  const p = findPath(w, Math.floor(w.x), Math.floor(w.y), tx, ty);
  if (!p) return false;
  w.path = p.map(([x, y], i) => {
    const last = i === p.length - 1, j = exact && last ? 0 : 0.28;
    return { x: x + 0.5 + (Math.random() - 0.5) * j, y: y + 0.5 + (Math.random() - 0.5) * j };
  });
  return true;
}

// Pick a random reachable spot within r tiles of (cx, cy).
export function wander(w, cx, cy, r) {
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(cx + (Math.random() * 2 - 1) * r), y = Math.floor(cy + (Math.random() * 2 - 1) * r);
    if (walkable(w, x, y) && planTo(w, x, y)) return true;
  }
  return false;
}

// Advance along the path. Returns 'moving', 'arrived' or 'blocked' (something was built in the way).
export function stepWalker(w, dt, speed) {
  if (!w.path || !w.path.length) return 'arrived';
  const n = w.path[0];
  if (!walkable(w, Math.floor(n.x), Math.floor(n.y))) { w.path = null; return 'blocked'; }
  const dx = n.x - w.x, dy = n.y - w.y, d = Math.hypot(dx, dy), st = Math.min(d, speed * dt);
  if (d > 0) { w.x += dx / d * st; w.y += dy / d * st; }
  if (Math.abs(dx - dy) > 0.01) w.face = dx - dy > 0 ? 1 : -1;
  if (d - st < 0.02) w.path.shift();
  return w.path.length ? 'moving' : 'arrived';
}
export const isWalking = (w, pt) => pt >= w.pause && !!(w.path && w.path.length);

// If a building was placed on top of a walker, pop them out to the nearest open tile.
export function unstick(w) {
  const tx = Math.floor(w.x), ty = Math.floor(w.y);
  if (walkable(w, tx, ty)) return;
  for (let r = 1; r < 10; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !walkable(w, tx + dx, ty + dy)) continue;
    w.x = tx + dx + 0.5; w.y = ty + dy + 0.5; w.path = null;
    return;
  }
}
