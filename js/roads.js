// Pelham Acres — painted ground textures for roads (cobble, gravel, dirt), built once in code.
// Each texture is a seamless square covering 2×2 map tiles; the renderer maps it onto the
// isometric grid, so stones get the right perspective and neighbouring tiles join with no seams.
export const ROAD_TEX = 512;          // texture size in pixels (2 tiles across)
const N = ROAD_TEX;
const cache = {};

// small seeded random so every player sees the same stones
function rng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a = 0, b = 255) => v < a ? a : v > b ? b : v;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };

// seamless value noise (period p cells across the texture), summed over a few octaves
function noiseField(seed, periods, weights) {
  const R = rng(seed), layers = periods.map(p => { const g = new Float32Array(p * p); for (let i = 0; i < g.length; i++) g[i] = R(); return { p, g }; });
  const out = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0;
    layers.forEach(({ p, g }, li) => {
      const fx = x / N * p, fy = y / N * p, x0 = Math.floor(fx), y0 = Math.floor(fy);
      let tx = fx - x0, ty = fy - y0; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const a = g[(y0 % p) * p + x0 % p], b = g[(y0 % p) * p + (x0 + 1) % p], c = g[((y0 + 1) % p) * p + x0 % p], d = g[((y0 + 1) % p) * p + (x0 + 1) % p];
      v += ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty) * weights[li];
    });
    out[y * N + x] = v;
  }
  return out;
}
function canvas() { const c = document.createElement('canvas'); c.width = c.height = N; return c; }

// Cobblestones: rounded, uneven stones (a wrapped Voronoi pattern) lit from the upper left,
// with sandy mortar and a little moss in the cracks.
function makeCobble() {
  const G = 12, cs = N / G, R = rng(1907), seeds = [], cols = [];
  const pal = ['#ACA394', '#9E978B', '#B6AC9A', '#928C82', '#A99D88', '#BFB5A2', '#A39A8E', '#9A9180'].map(hex);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    // a running-bond feel: odd rows shifted half a stone
    seeds.push([(i + 0.5 + (j & 1) * 0.5 + (R() - 0.5) * 0.45) * cs, (j + 0.5 + (R() - 0.5) * 0.35) * cs]);
    const c = pal[Math.floor(R() * pal.length)], k = 0.9 + R() * 0.2; cols.push(c.map(v => v * k));
  }
  const moss = noiseField(77, [4, 9, 23], [0.5, 0.33, 0.17]), grain = noiseField(31, [64, 128], [0.6, 0.4]);
  const c = canvas(), x2 = c.getContext('2d'), img = x2.createImageData(N, N), d = img.data;
  const L = [-0.7071, -0.7071], mortar = hex('#6F6452'), mossC = hex('#56703A');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const ci = Math.floor(x / cs), cj = Math.floor(y / cs);
    let d1 = 1e9, d2 = 1e9, s1 = 0, s2 = 0, p1x = 0, p1y = 0, p2x = 0, p2y = 0;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const ii = (ci + di + G) % G, jj = (cj + dj + G) % G, s = seeds[jj * G + ii];
      // wrap the seed so the pattern tiles
      const sx = s[0] + Math.floor((ci + di) / G) * N, sy = s[1] + Math.floor((cj + dj) / G) * N;
      const dx = x - sx, dy = y - sy, dd = dx * dx + dy * dy;
      if (dd < d1) { d2 = d1; s2 = s1; p2x = p1x; p2y = p1y; d1 = dd; s1 = jj * G + ii; p1x = sx; p1y = sy; }
      else if (dd < d2) { d2 = dd; s2 = jj * G + ii; p2x = sx; p2y = sy; }
    }
    const sep = Math.hypot(p2x - p1x, p2y - p1y) || 1;
    const edge = (d2 - d1) / (2 * sep);                 // distance to the crack between stones
    const r1 = Math.sqrt(d1) || 1, nx = (x - p1x) / r1, ny = (y - p1y) / r1;
    const stone = sstep(2.2, 4.2, edge);                // 0 in the mortar, 1 on the stone
    const bevel = 1 - sstep(3, 15, edge);               // rounded shoulders near the edge
    const lit = (nx * L[0] + ny * L[1]) * bevel;        // shoulders facing the light are bright
    const dome = 1 - Math.min(1, r1 / (cs * 0.75)) * 0.12;
    const g = (grain[y * N + x] - 0.5) * 26;
    const sc = cols[s1];
    let r = sc[0] * dome + lit * 42 + g, gg = sc[1] * dome + lit * 40 + g, b = sc[2] * dome + lit * 36 + g;
    // ambient occlusion right at the stone's foot
    const ao = 0.78 + 0.22 * sstep(2, 7, edge); r *= ao; gg *= ao; b *= ao;
    // mortar: sandy, mossy where the noise says so
    const m = sstep(0.52, 0.7, moss[y * N + x]);
    const mr = mortar[0] * (1 - m) + mossC[0] * m + g * 0.6, mg = mortar[1] * (1 - m) + mossC[1] * m + g * 0.6, mb = mortar[2] * (1 - m) + mossC[2] * m + g * 0.6;
    const i4 = (y * N + x) * 4;
    d[i4] = clamp(mr + (r - mr) * stone); d[i4 + 1] = clamp(mg + (gg - mg) * stone); d[i4 + 2] = clamp(mb + (b - mb) * stone); d[i4 + 3] = 255;
  }
  x2.putImageData(img, 0, 0);
  return c;
}

// soft base with grain, used under gravel and dirt
function baseLayer(seed, a, b, periods, weights, grainAmt) {
  const n = noiseField(seed, periods, weights), gr = noiseField(seed + 5, [128, 256], [0.5, 0.5]);
  const c = canvas(), x2 = c.getContext('2d'), img = x2.createImageData(N, N), d = img.data, A = hex(a), B = hex(b);
  for (let i = 0; i < N * N; i++) {
    const t = sstep(0.25, 0.75, n[i]), g = (gr[i] - 0.5) * grainAmt;
    d[i * 4] = clamp(A[0] + (B[0] - A[0]) * t + g); d[i * 4 + 1] = clamp(A[1] + (B[1] - A[1]) * t + g); d[i * 4 + 2] = clamp(A[2] + (B[2] - A[2]) * t + g); d[i * 4 + 3] = 255;
  }
  x2.putImageData(img, 0, 0);
  return c;
}
// draw a little lit pebble everywhere it shows on the wrapped texture
function pebble(x2, x, y, rx, ry, rot, col) {
  for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
    const px = x + ox, py = y + oy;
    if (px < -12 || py < -12 || px > N + 12 || py > N + 12) continue;
    x2.save(); x2.translate(px, py); x2.rotate(rot);
    x2.fillStyle = 'rgba(40,30,15,.38)'; x2.beginPath(); x2.ellipse(rx * 0.25, ry * 0.35, rx * 1.05, ry * 1.05, 0, 0, 7); x2.fill();
    const gr = x2.createRadialGradient(-rx * 0.35, -ry * 0.4, 0, 0, 0, Math.max(rx, ry) * 1.1);
    gr.addColorStop(0, `rgb(${col.map(v => clamp(v + 46)).join()})`); gr.addColorStop(0.55, `rgb(${col.join()})`); gr.addColorStop(1, `rgb(${col.map(v => clamp(v - 34)).join()})`);
    x2.fillStyle = gr; x2.beginPath(); x2.ellipse(0, 0, rx, ry, 0, 0, 7); x2.fill();
    x2.restore();
  }
}
// Gravel: a pale bed packed with small rounded pebbles of mixed greys and tans.
function makeGravel() {
  const c = baseLayer(411, '#A99D86', '#BDB29C', [5, 13, 31], [0.45, 0.35, 0.2], 30), x2 = c.getContext('2d'), R = rng(5150);
  const pal = ['#C9C0AF', '#B0A796', '#8F887C', '#D6CEBE', '#A2917A', '#7F786E', '#BBAE95', '#9C9A93'].map(hex);
  for (let i = 0; i < 2600; i++) {
    const s = 1.6 + R() * R() * 5.2;
    pebble(x2, R() * N, R() * N, s, s * (0.65 + R() * 0.3), R() * 3.14, pal[Math.floor(R() * pal.length)].map(v => v * (0.92 + R() * 0.14)));
  }
  return c;
}
// Dirt: warm packed earth with darker damp patches, crumbs and the odd stone.
function makeDirt() {
  const c = baseLayer(902, '#8A6440', '#A87D52', [3, 7, 17, 41], [0.38, 0.3, 0.2, 0.12], 34), x2 = c.getContext('2d'), R = rng(2718);
  // worn, lighter tracks where feet and wheels pass
  const wear = noiseField(1234, [2, 6], [0.7, 0.3]), img = x2.getImageData(0, 0, N, N), d = img.data;
  for (let i = 0; i < N * N; i++) { const k = sstep(0.55, 0.8, wear[i]) * 16; d[i * 4] += k; d[i * 4 + 1] += k * 0.85; d[i * 4 + 2] += k * 0.6; }
  x2.putImageData(img, 0, 0);
  for (let i = 0; i < 1600; i++) {   // crumbs: tiny dark and light flecks
    const x = R() * N, y = R() * N, s = 0.8 + R() * 1.8;
    x2.fillStyle = R() < 0.55 ? 'rgba(70,45,22,.45)' : 'rgba(200,165,120,.4)';
    x2.beginPath(); x2.ellipse(x, y, s, s * 0.7, R() * 3, 0, 7); x2.fill();
  }
  const pal = ['#9E8E78', '#8A7A66', '#B3A48C', '#7B6D5C'].map(hex);
  for (let i = 0; i < 70; i++) { const s = 2 + R() * 3.2; pebble(x2, R() * N, R() * N, s, s * 0.72, R() * 3, pal[Math.floor(R() * pal.length)]); }
  return c;
}

const MAKERS = { path: makeCobble, gravel: makeGravel, dirt: makeDirt };
export function roadTexture(type) {
  if (!cache[type]) cache[type] = (MAKERS[type] || makeCobble)();
  return cache[type];
}
// per-road look for edges: how ragged the border is, and the tone of its rim
export const ROAD_STYLE = {
  path:   { ragged: 0.0,  inset: 0.025, rim: 'rgba(70,58,40,.55)', tuft: 0.5 },
  gravel: { ragged: 0.05, inset: 0.05,  rim: 'rgba(95,85,65,.45)', tuft: 0.9 },
  dirt:   { ragged: 0.07, inset: 0.05,  rim: 'rgba(80,55,30,.5)',  tuft: 1.1 },
};
