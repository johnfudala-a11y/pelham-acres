// Pelham Acres — input, menus, and the game loop.
import { BUILD, CROPS, ITEMS, PRODUCTS, RECIPES, ANIMALS, MATS, SHOP_CATS, VALUE, xpFor, unlocksAt, CROP_YIELD, DECOR_CHARM_CAP, MASTERY, MASTERY_PERKS, NO_ORDER } from './data.js';
import * as G from './game.js';
import { initAudio, sfx, setMusic, setSfx, setVolume, audioRunning } from './audio.js';
import * as Q from './quests.js';
import { PEOPLE, QUEST_BY_ID, CHAPTERS } from './story.js';
import * as X from './expedition.js';
import * as E from './extras.js';
import * as C from './cloud.js';
export const APP_VERSION = '0.29';
import { loadSprites, spriteProgress } from './render.js';
import { cam, view, initRender, draw, centerOn, s2w, zoomAt, clampCam, hit, floater, screenSize, cats, setCatGrid, catGo, people, setPeople, setErrands, tileCenterScreen, penCheer } from './render.js';

const $ = s => document.querySelector(s);
const now = G.now;
// ---------- painted art for menus (each falls back to its emoji if the picture can't load) ----------
const em = id => ITEMS[id]?.icon || '❔';                       // plain-text emoji, for toasts and floaters
const IMG = (src, fb, cls = 'ai') => `<img class="${cls}" src="${src}" alt="" draggable="false" onerror="this.replaceWith('${fb}')">`;
const BUILD_SPR = new Set(['barn', 'feedMill', 'bakery', 'workshop', 'dairy', 'sugarMill', 'kitchen', 'loom', 'cafe', 'cottage', 'farmhouse', 'townhouse', 'manor',
  'townHall', 'generalStore', 'schoolhouse', 'clockTower', 'bandstand', 'station', 'flowers', 'hedge', 'bench', 'lamp', 'pond', 'gazebo', 'fountain', 'windmill', 'coop', 'cowshed', 'sheepfold']);
function art(id, cls) {
  if (CROPS[id]) return IMG(`sprites/crop-${id}.webp`, CROPS[id].icon, cls);
  if (PRODUCTS[id]) return IMG(`sprites/icon-${id}.webp`, PRODUCTS[id].icon, cls);
  if (ANIMALS[id]) return IMG(`sprites/${id}.webp`, ANIMALS[id].icon, cls);
  if (BUILD[id]) return IMG(id === 'windmill' ? 'sprites/windmill-full.webp' : BUILD_SPR.has(id) ? `sprites/${id}.webp` : `sprites/icon-${id}.webp`, BUILD[id].icon, cls);
  return ITEMS[id]?.icon || '❔';
}
const ic = id => art(id);
const icH = id => art(id);
const ui = (n, fb) => IMG(`sprites/icon-${n}.webp`, fb, 'ui');
const face = (pid, cls = 'face') => PEOPLE[pid] ? IMG(`sprites/p-${pid}.webp`, PEOPLE[pid].icon, cls) : ui('mail', '✉️');
// order customers who are townsfolk get their portrait
const WHO_PID = { 'Farmer Joe': 'joe', 'Old Tom': 'tom', 'Rosa at the Inn': 'rosa', 'The Mayor': 'hattie', 'Grandma Ellis': 'ellis', 'Dottie': 'dottie', 'Mr. Finch': 'finch' };
// swap the coin / hourglass / star / energy emoji in menu HTML for painted icons
// (fallbacks are empty so the swap never runs inside its own onerror attribute)
const PAINT = [['🪙', ui('coin', '')], ['⏳', ui('hourglass', '')], ['⭐', ui('star', '')], ['⚡', ui('energy', '')]];
const paint = html => PAINT.reduce((h, [e, im]) => h.split(e).join(im), html);
const nm = id => ITEMS[id]?.name || id;
function fmtT(ms) {
  let s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60); s %= 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
const fmtN = n => Math.round(n).toLocaleString();
const secs = s => fmtT(s * 1000);

// ---------- juice: things fly to the HUD, counters roll, confetti ----------
const artSrc = id => CROPS[id] ? `sprites/crop-${id}.webp` : PRODUCTS[id] ? `sprites/icon-${id}.webp` : id === 'coin' ? 'sprites/icon-coin.webp' : null;
// send n little pictures of `id` from map tile (gx, gy) in an arc to a HUD element, then bump it
function flyTo(gx, gy, id, target, n = 1) {
  const src = artSrc(id), tg = $(target); if (!src || !tg) return;
  const from = tileCenterScreen(gx, gy), r = tg.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2;
  for (let i = 0; i < Math.min(n, 6); i++) {
    const im = document.createElement('img'); im.src = src; im.className = 'fly'; document.body.appendChild(im);
    const sx = from.x + (Math.random() - 0.5) * 24, sy = from.y - 20 + (Math.random() - 0.5) * 16, mx = (sx + tx) / 2 + (Math.random() - 0.5) * 80, my = Math.min(sy, ty) - 90 - Math.random() * 40;
    const anim = im.animate([
      { transform: `translate(${sx - 16}px, ${sy - 16}px) scale(.6)`, opacity: 0 },
      { transform: `translate(${sx - 16}px, ${sy - 26}px) scale(1.15)`, opacity: 1, offset: 0.12 },
      { transform: `translate(${mx - 16}px, ${my - 16}px) scale(1)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${tx - 16}px, ${ty - 16}px) scale(.55)`, opacity: 0.9 }], { duration: 720 + i * 70, delay: i * 70, easing: 'cubic-bezier(.45,.05,.55,.95)' });
    anim.onfinish = () => { im.remove(); tg.classList.remove('bump'); void tg.offsetWidth; tg.classList.add('bump'); };
  }
}
// counters roll up to their new value instead of jumping
const rolling = {};
function rollNumber(sel, to) {
  const el = $(sel); if (!el) return;
  const st = rolling[sel] || (rolling[sel] = { v: to, raf: 0 });
  if (st.v === to) { el.textContent = fmtN(to); return; }
  const from = st.v, t0 = performance.now(), dur = Math.min(900, 250 + Math.abs(to - from) * 4);
  cancelAnimationFrame(st.raf);
  const step = now2 => { const k = Math.min(1, (now2 - t0) / dur), e = 1 - (1 - k) ** 3; st.v = Math.round(from + (to - from) * e); el.textContent = fmtN(st.v); if (k < 1) st.raf = requestAnimationFrame(step); else st.v = to; };
  st.raf = requestAnimationFrame(step);
}
function confetti() {
  const box = document.createElement('div'); box.className = 'confetti'; document.body.appendChild(box);
  const cols = ['#E3A12A', '#5E9A35', '#C0472F', '#5B8FD8', '#F4B6C8', '#FFF4DA'];
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('i'); p.style.left = Math.random() * 100 + 'vw'; p.style.background = cols[i % cols.length];
    p.style.animationDelay = Math.random() * 0.4 + 's'; p.style.animationDuration = 1.6 + Math.random() * 1.2 + 's'; p.style.setProperty('--dx', (Math.random() - 0.5) * 200 + 'px');
    box.appendChild(p);
  }
  setTimeout(() => box.remove(), 3400);
}

// ---------- haptics: a light tap you can feel on harvest, collect, build ----------
// Android/Chrome has navigator.vibrate. iPhone/iPad Safari (iOS 18+) gives a light "tick" when a
// switch-style checkbox is toggled, so we quietly toggle a hidden one. Elsewhere it does nothing.
let hapticEl = null, hapticAt = 0;
function haptic(strong) {
  if (G.S && G.S.settings && G.S.settings.haptics === false) return;
  const t = performance.now(); if (t - hapticAt < 70) return; hapticAt = t;   // dragging across a row: not a buzz-fest
  try {
    if (navigator.vibrate) { if (!navigator.userActivation || navigator.userActivation.hasBeenActive) navigator.vibrate(strong ? 22 : 9); return; }
    if (!hapticEl) {
      hapticEl = document.createElement('label'); hapticEl.setAttribute('aria-hidden', 'true');
      hapticEl.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1;
      hapticEl.appendChild(i); document.body.appendChild(hapticEl);
    }
    hapticEl.click();
  } catch (e) { /* no haptics here */ }
}
// ---------- toast / modal ----------
let toastTimer;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(msg) {
  const t = $('#toast'); t.innerHTML = paint(esc(msg));   // coins/hourglasses/stars show as painted icons
  t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function modal(html) { $('#modalCard').innerHTML = paint(html); $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a) { act(a); } else if (e.target.id === 'modal') closeModal(); });

// a friendship heart went up: a thank-you gift, and a lasting perk at 3 and 5 hearts
const heartRow = (pid, size = '') => { const h = G.hearts(pid); return `<span class="hearts ${size}">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= h ? 'on' : ''}">♥</i>`).join('')}</span>`; };
G.hooks.onHeart = (pid, h, gift) => setTimeout(() => {
  const p = PEOPLE[pid]; if (!p) return;
  sfx.levelUp();
  const pk = h === 3 ? G.PERKS[pid].text[0] : h === 5 ? G.PERKS[pid].text[1] : null;
  const lines = { 1: "You're a good neighbor, you know that?", 2: "I've been telling everyone about you.", 3: "You've become a real friend to me.", 4: "I don't know what this town did without you.", 5: "You're family now. Don't argue." };
  const show = () => modal(`${talkHead(pid)}${heartRow(pid, 'big')}<h2 style="margin-top:6px">${h} ${h === 1 ? 'heart' : 'hearts'} with ${p.name}!</h2>
    <div class="say">${lines[h]}</div>
    <div class="rewardrow"><span class="sub" style="margin:0">Thank-you gift</span>${rewardLine(gift)}</div>
    ${pk ? `<div class="perkbox">${ui('ribbon', '')}<div><b>New perk:</b> ${pk}</div></div>` : `<p class="sub">Next perk at ${h < 3 ? 3 : 5} hearts: ${G.PERKS[pid].text[h < 3 ? 0 : 1]}</p>`}
    <button class="btn wide" data-act="closeModal">Aw, thank you!</button>`);
  if ($('#modal').hidden) show(); else levelQueue.push(() => show());
}, 700);
const levelQueue = [];
G.hooks.onLevel = L => { levelQueue.push(L); };
G.hooks.onMastery = (kind, id, s) => {
  setTimeout(() => { sfx.collect(); toast(`${'★'.repeat(s)} ${nm(id)} mastery! ${MASTERY_PERKS[s - 1]} · +${s * 40}🪙 +1⏳`); }, 400);
};
const starStr = (kind, id) => { const s = G.stars(kind, id); return `<span class="stars">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</span>`; };
function masteryLine(kind, id) {
  const s = G.stars(kind, id), n = G.masteryCount(kind, id), th = MASTERY[kind];
  return s >= 3 ? 'Mastered!' : `${n}/${th[s]} to next ★`;
}
function upgradeBlock(o) {
  if (!G.canUpgrade(o)) return '';
  const lv = G.blvl(o), c = G.nextUpgradeCost(o), b = BUILD[o.t];
  const what = b.kind === 'producer' ? '+1 slot, 8% faster' : b.kind === 'pen' ? '+1 animal space, 8% faster' : '+25% rent';
  if (!c) return `<div class="upg"><b>Level ${lv}</b> <span class="sub">· fully upgraded ✨</span></div>`;
  const mats = ['wood', 'stone', 'planks', 'nails', 'iron', 'gem'].filter(k => c[k]).map(k => req(k, c[k])).join(' ');
  return `<div class="upg"><div class="row"><b>Level ${lv}</b><span class="sub">→ ${lv + 1}: ${what}</span></div>
    <div class="row" style="margin-top:6px"><span class="req ${G.S.coins >= c.coins ? 'ok' : 'no'}">🪙 ${fmtN(c.coins)}</span>${mats}
    <button class="btn sm gold" data-act="upgrade">Upgrade</button></div></div>`;
}
function showLevelUps() {
  if (!levelQueue.length || !$('#modal').hidden) return;
  const L = levelQueue.shift();
  if (typeof L === 'function') { L(); return; }   // a queued pop-up (e.g. a friendship heart)
  const un = unlocksAt(L);
  sfx.levelUp(); confetti(); haptic(true);
  modal(`<div class="bigart">${IMG('sprites/icon-medal.webp', '🎉', 'bigimg')}<div class="medalnum">${L}</div></div><h2>Level ${L}!</h2><p class="sub">+${L * 15} 🪙 &nbsp; +2 ⏳</p>
    ${un.length ? `<b>New this level</b><div class="unlocks">${un.map(u => `<div>${u.id && (BUILD[u.id] || ITEMS[u.id]) ? art(u.id) : u.icon} ${u.name}</div>`).join('')}</div>` : '<p>Keep growing Pelham Acres!</p>'}
    <button class="btn wide" data-act="closeModal">Hooray!</button>`);
  refreshHud();
}

// ---------- sheet (side / bottom panel) ----------
let sheetFn = null, sheetObj = null;
function openSheet(title, fn, obj = null) {
  if (!sheetFn) sfx.open(); else sfx.tap();
  sheetFn = fn; sheetObj = obj;
  $('#sheetTitle').textContent = title;
  renderSheet();
  $('#sheet').classList.add('open'); $('#sheet').setAttribute('aria-hidden', 'false'); document.body.classList.add('sheet-open');
}
function renderSheet() {
  if (!sheetFn) return;
  const body = $('#sheetBody'), y = body.scrollTop;
  body.innerHTML = paint(sheetFn());
  body.scrollTop = y; // keep your place when the panel refreshes
}
function closeSheet() { sheetFn = null; sheetObj = null; $('#sheet').classList.remove('open'); $('#sheet').setAttribute('aria-hidden', 'true'); document.body.classList.remove('sheet-open'); }
$('#sheetClose').addEventListener('click', () => { sfx.close(); closeSheet(); });
$('#sheetBody').addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a) act(a); });
// volume sliders: change as you drag, save (and play a sample for effects) when you let go
$('#sheetBody').addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.vol; if (!k) return;
  const st = G.S.settings; st.vol = st.vol || {}; st.vol[k] = +e.target.value / 100; setVolume(k, st.vol[k]);
});
$('#sheetBody').addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.vol; if (!k) return;
  if (k === 'sfx') sfx.collect();
  G.save();
});
function liveUpdate() {
  let rerender = false;
  document.querySelectorAll('#sheetBody [data-end]').forEach(el => {
    const r = +el.dataset.end - now();
    if (r <= 0) rerender = true; else el.textContent = fmtT(r);
  });
  document.querySelectorAll('#sheetBody [data-bar]').forEach(el => {
    const s = +el.dataset.s, e = +el.dataset.e;
    el.style.width = Math.max(0, Math.min(100, (now() - s) / (e - s) * 100)) + '%';
  });
  if (rerender) renderSheet();
}
// Move button with the one-hour cooldown shown as a live countdown
function moveBtn(o) {
  const r = G.moveReadyAt(o);
  if (r > now()) return `<button class="btn alt sm off" data-act="move">↔ Move again in <span data-end="${r}">${fmtT(r - now())}</span></button>`;
  return `<button class="btn alt sm" data-act="move">↔ Move</button>${G.moveLimited(o) ? ' <span class="sub" style="margin:0">once an hour</span>' : ''}`;
}
// a "have/need" chip; when you're short, tapping it shows where to get more
const req = (id, n) => G.have(id) >= n ? `<span class="req ok">${icH(id)} ${G.have(id)}/${n}</span>`
  : `<span class="req no tappable" data-act="where" data-id="${id}" title="Where do I get this?">${icH(id)} ${G.have(id)}/${n}<i class="q">?</i></span>`;
const reqs = r => Object.entries(r).map(([k, v]) => req(k, v)).join(' ');

// ---------- HUD ----------
// only touch the page when the content actually changed: rebuilding it every half-second reloads
// the little icons and makes the pills and the hint banner twitch
function setHTML(el, html) { if (el && el._html !== html) { el.innerHTML = html; el._html = html; } }
function refreshHud() {
  const S = G.S;
  $('#lvl').textContent = S.level;
  const need = xpFor(S.level);
  $('#xpfill').style.width = (S.xp / need * 100) + '%';
  $('#xptext').textContent = `${S.xp}/${need}`;
  rollNumber('#coins', S.coins);
  $('#hg').textContent = S.hg;
  const used = G.storageUsed(), cap = G.storageCap();
  $('#store').textContent = `${used}/${cap}`;
  $('#storePill').classList.toggle('full', used >= cap);
  const r = G.readyOrders(); const b = $('#ordBadge'); b.hidden = !r; b.textContent = r;
  const se = G.season();
  setHTML($('#seasonPill'), `${ui(se.name.toLowerCase(), se.icon)} ${se.name} <small>${fmtT(G.seasonEndsAt() - now()).replace(/ \d+s$/, '')}</small>`);
}

// ---------- top bar: tap an icon for a little description box ----------
function hudTipHtml(k) {
  const S = G.S, se = G.season();
  switch (k) {
    case 'lvlPill': {
      const need = xpFor(S.level), un = unlocksAt(S.level + 1);
      return `<h4>Level ${S.level}</h4><div class="cbar"><div style="width:${S.xp / need * 100}%"></div></div>
        <p><b>${fmtN(S.xp)} / ${fmtN(need)} XP</b> · ${fmtN(need - S.xp)} more to level ${S.level + 1}.</p>
        <p class="sub">Earn XP by harvesting, making goods, collecting from animals, delivering orders and finishing stories.</p>
        ${un.length ? `<b>Level ${S.level + 1} unlocks</b><div class="tipchips">${un.slice(0, 6).map(u => `<span class="chip">${u.id && (BUILD[u.id] || ITEMS[u.id]) ? art(u.id) : u.icon} ${u.name}</span>`).join('')}</div>` : ''}`;
    }
    case 'coinPill': return `<h4>${ui('coin', '')} ${fmtN(S.coins)} coins</h4>
        <p>Spend coins on buildings, crops, animals and upgrades.</p>
        <p class="sub">Earn them by delivering orders, collecting rent, loading the freight train and selling extras from the Barn. Town charm adds <b>+${G.charm()}%</b> to every order.</p>`;
    case 'hgPill': return `<h4>${ui('hourglass', '')} ${S.hg} hourglass${S.hg === 1 ? '' : 'es'}</h4>
        <p>Use an hourglass to finish something instantly: tap a growing field or a busy building and choose <b>Finish now</b>.</p>
        <p class="sub">You earn them by leveling up, every 5th delivery, mastery stars, stories, friendships and the Seasonal Fair. Never sold, never needed.</p>`;
    case 'storePill': {
      const used = G.storageUsed(), cap = G.storageCap();
      return `<h4>${ui('crate', '')} Barn space</h4><div class="cbar"><div style="width:${Math.min(100, used / cap * 100)}%"></div></div>
        <p><b>${used} of ${cap}</b> spaces used${used >= cap ? ' · <b>full!</b>' : ''}.</p>
        <p class="sub">Crops and goods take space; wood, stone, tools and building supplies don't. Sell extras or upgrade the barn for +30 space.</p>
        <button class="btn sm" data-tip="barn">Open the Barn</button>`;
    }
    case 'seasonPill': {
      const left = fmtT(G.seasonEndsAt() - now()).replace(/ \d+s$/, '');
      return `<h4>${ui(se.name.toLowerCase(), se.icon)} ${se.name}</h4>
        <p>Each season lasts one day. <b>${left}</b> until the next one.</p>
        <b>In season now</b><div class="tipchips">${se.crops.filter(c => CROPS[c]).map(c => `<span class="chip">${art(c)} ${CROPS[c].name}</span>`).join('')}</div>
        <p class="sub">In-season crops grow 25% faster, pay more in orders, and count toward the ${E.fairName()}.</p>
        ${S.level >= 6 ? '<button class="btn sm" data-tip="fair">See the Fair</button>' : ''}`;
    }
  }
  return '';
}
let tipFor = null;
function showHudTip(el) {
  const tip = $('#hudTip');
  if (tipFor === el.id && !tip.hidden) { tip.hidden = true; tipFor = null; return; }
  sfx.tap(); tipFor = el.id;
  tip.innerHTML = paint(hudTipHtml(el.id));
  const r = el.getBoundingClientRect();
  tip.hidden = false;
  const w = tip.offsetWidth, x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  tip.style.left = x + 'px'; tip.style.top = (r.bottom + 10) + 'px';
  tip.style.setProperty('--ax', (r.left + r.width / 2 - x) + 'px');   // where the little pointer sits
}
for (const id of ['lvlPill', 'coinPill', 'hgPill', 'storePill', 'seasonPill']) $('#' + id).addEventListener('click', e => { e.stopPropagation(); showHudTip(e.currentTarget); });
$('#hudTip').addEventListener('click', e => {
  const b = e.target.closest('[data-tip]'); if (!b) return;
  $('#hudTip').hidden = true; tipFor = null;
  if (b.dataset.tip === 'barn') { openSheet('Barn', barnSheet); $('#sheetTitle').dataset.k = 'barn'; }
  else { questTab = 'fair'; openSheet('Quests', questsSheet); $('#sheetTitle').dataset.k = 'quests'; }
});
// While a description box is open, the next tap anywhere outside it only closes it: the tap is swallowed,
// so it doesn't also plant, open a building, press a button or switch to another box.
let swallowTap = false;
addEventListener('pointerdown', e => {
  const tip = $('#hudTip');
  if (tip.hidden || e.target.closest('#hudTip')) return;
  tip.hidden = true; tipFor = null;
  swallowTap = true;
  e.stopPropagation(); e.preventDefault();
}, true);
for (const ev of ['pointermove', 'pointerup', 'click']) addEventListener(ev, e => {
  if (!swallowTap) return;
  e.stopPropagation(); e.preventDefault();
  if (ev === 'click') swallowTap = false;
}, true);
// (a touch that never produces a click, e.g. a drag, mustn't leave the next real tap swallowed)
addEventListener('pointerup', () => { if (swallowTap) setTimeout(() => { swallowTap = false; }, 350); }, true);

// ---------- mode bar (planting / placing) ----------
function setModeBar(html) { const m = $('#modebar'); if (!html) { m.hidden = true; m.innerHTML = ''; return; } m.innerHTML = html; m.hidden = false; }
$('#modebar').addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a) act(a); });

function startPlant(crop) {
  view.plantCrop = crop;
  const c = CROPS[crop];
  setModeBar(`<span style="font-size:24px">${c.icon}</span><span class="msg">Planting ${c.name} · tap or drag over empty fields</span><button class="btn" data-act="endPlant">Done</button>`);
}
function endPlant() { view.plantCrop = null; setModeBar(null); }
function tryPlant(o) {
  const r = G.plant(o, view.plantCrop);
  if (r === 'ok') { sfx.plant(); floater(o.x + 0.5, o.y + 0.5, `-${CROPS[view.plantCrop].cost}🪙`, '#FFE9A8'); return true; }
  if (r === 'coins') { sfx.error(); toast('Not enough coins to plant'); endPlant(); }
  return false;
}

function startPlacing(t, move = null) {
  closeSheet(); endPlant();
  const b = BUILD[t];
  let x, y;
  if (move) { x = move.x; y = move.y; }
  else {
    const { W, H } = screenSize(); const c = s2w(W / 2, H / 2);
    x = Math.floor(c.x - b.w / 2 + 0.5); y = Math.floor(c.y - b.h / 2 + 0.5);
    const spot = nearestFree(t, x, y); if (spot) { x = spot.x; y = spot.y; }
  }
  const proto = move ? { ...move } : { t, id: -1, crop: null, jobs: [], animals: [], last: now() };
  view.ghost = { t, x, y, move, proto, ok: false };
  updateGhost();
  const repeat = !move && ['field', 'path', 'decor'].includes(b.kind);
  setModeBar(`<span style="font-size:22px">${b.icon}</span><span class="msg">${move ? 'Move' : 'Place'} ${b.name} · drag it into position${move && G.moveLimited(move) ? '<br><small>Once moved, it can move again in 1 hour</small>' : ''}</span>
    ${canFlip(t) ? '<button class="btn alt" data-act="flip" aria-label="Flip">⇋ Flip</button>' : ''}
    <button class="btn" data-act="confirmPlace">✔ ${move ? 'Move here' : 'Place'}</button><button class="btn alt" data-act="cancelPlace">${repeat ? 'Done' : 'Cancel'}</button>`);
}
// mirror image: only for square buildings (a mirrored 2×3 would no longer match its squares), never the windmill
function canFlip(t) { const b = BUILD[t]; return b.w === b.h && t !== 'windmill' && !['field', 'path', 'obstacle', 'pen'].includes(b.kind); }
function nearestFree(t, x0, y0) {
  for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    if (G.canPlace(t, x0 + dx, y0 + dy)) return { x: x0 + dx, y: y0 + dy };
  }
  return null;
}
function updateGhost() { const g = view.ghost; if (g) g.ok = G.canPlace(g.t, g.x, g.y, g.move); }
function confirmPlace() {
  const g = view.ghost; if (!g) return;
  if (!g.ok) {
    sfx.error();
    const why = G.placeProblem(g.t, g.x, g.y, g.move);
    toast(why === 'crowded' ? 'Too close to another building. Leave one square of space between buildings.' : why === 'edge' ? "That's off the edge of your land" : "Can't place there. Something's in the way.");
    return;
  }
  if (g.move) {
    sfx.thunk(); haptic(true);
    G.moveObj(g.move, g.x, g.y);
    if (g.proto.flip) g.move.flip = true; else delete g.move.flip;
    landFx(g.move); cancelPlace(); G.save(); return;
  }
  const block = G.buyBlock(g.t);
  if (block) { sfx.error(); toast(block); return; }
  G.pay(g.t);
  sfx.build(); setTimeout(() => sfx.thunk(), 60); haptic(true);
  const o = G.addObj(g.t, g.x, g.y);
  if (g.proto.flip) o.flip = true;
  o.builtAt = Date.now(); landFx(o);
  floater(o.x + BUILD[g.t].w / 2, o.y + BUILD[g.t].h / 2, '✨ Built!', '#FFFFFF');
  G.addXP(BUILD[g.t].kind === 'path' ? 0 : 1);
  refreshHud();
  const b = BUILD[g.t];
  if (['field', 'path', 'decor'].includes(b.kind) && !G.buyBlock(g.t)) {
    const spot = nearestFree(g.t, g.x + 1, g.y); if (spot) { g.x = spot.x; g.y = spot.y; updateGhost(); return; }
  }
  cancelPlace();
}
function cancelPlace() { view.ghost = null; setModeBar(null); }
// a moved building lands with a little squash and a puff of dust
function landFx(o) {
  Object.defineProperty(o, '_squish', { value: performance.now(), writable: true, configurable: true, enumerable: false });
  Object.defineProperty(o, '_landed', { value: Date.now(), writable: true, configurable: true, enumerable: false });
}

// ---------- actions (buttons with data-act) ----------
function act(el) {
  const d = el.dataset, o = sheetObj;
  switch (d.act) {
    case 'closeModal': closeModal(); setTimeout(showLevelUps, 200); break;
    case 'collectAll': collectAll(); return;
    case 'where': goTo(guideForItem(d.id, 'Make'), nm(d.id)); return;
    case 'showme': { const q = QUEST_BY_ID[d.q]; goTo(q && guideFor(q, q.goals[+d.g]), q && q.goals[+d.g].label); return; }
    case 'claimChapter': {
      const c = Q.claimChapter(d.id); if (!c) break;
      sfx.fanfare(); confetti(); haptic(true);
      modal(`<div class="chapterhead">Chapter ${c.n} complete</div><h2>${c.title}</h2>${talkHead(c.who)}<div class="say">${c.end}</div>
        <div class="rewardrow"><span class="sub" style="margin:0">Chapter reward</span>${rewardLine(c.reward)}</div><button class="btn wide" data-act="closeModal">On to the next chapter!</button>`);
      G.save(); refreshHud(); return;
    }
    case 'cloudSend': case 'cloudVerify': case 'cloudBack': case 'cloudSave': case 'cloudLoad': case 'cloudOut': cloudAct(d.act); return;
    case 'cloudUseCloud': if (pendingCloud) { G.setState(pendingCloud); pendingCloud = null; afterLoad(); closeModal(); closeSheet(); toast('Cloud farm loaded ☁️'); } return;
    case 'cloudKeepLocal': pendingCloud = null; closeModal(); C.upload(true).then(() => toast('This farm is now the cloud copy ☁️')).catch(e => toast('Cloud: ' + e.message)); return;
    case 'claimQuest': claimQuest(d.id); return;
    case 'claimDaily': {
      const r = Q.claimDaily();
      if (r) { sfx.deliver(); toast(`${PEOPLE[r.who].name}: "Thank you, dear!" +${fmtN(r.coins)} 🪙 +${r.hg} ⏳`); } else { sfx.error(); toast("You don't have everything yet"); }
      break;
    }
    case 'fillCrate': {
      const r = G.fillCrate(o, +d.i);
      if (r === 'ok') { sfx.deliver(); } else { sfx.error(); toast(r === 'missing' ? "You don't have enough yet" : 'The train already left'); }
      break;
    }
    case 'sendTrain': {
      const b = G.sendTrain(o);
      if (b) { sfx.levelUp(); toast(`Toot toot! Bonus: +${fmtN(b.coins)} 🪙 +${b.hg} ⏳ +${b.planks} planks +${b.nails} nails`); }
      break;
    }
    case 'showQuest': questIntro(QUEST_BY_ID[d.id]); return;
    case 'endPlant': endPlant(); break;
    case 'confirmPlace': confirmPlace(); break;
    case 'cancelPlace': cancelPlace(); break;
    case 'pickCrop': {
      const f = o; closeSheet(); startPlant(d.c);
      if (f && !f.crop) tryPlant(f);
      break;
    }
    case 'hgField': case 'hg': if (G.useHourglass(o)) { sfx.hourglass(); toast('⏳ Time skipped!'); } else { sfx.error(); toast('No hourglasses left'); } break;
    case 'make': {
      const r = G.queueJob(o, +d.i);
      if (r === 'ok') sfx.make(); else sfx.error();
      if (r === 'slots') toast('All slots are busy'); else if (r === 'missing') toast('Missing ingredients'); else if (r === 'locked') toast('Recipe not unlocked yet');
      break;
    }
    case 'collectJobs': collectProducer(o); break;
    case 'buyAnimal': { const r = G.buyAnimal(o); if (r === 'ok') { sfx.coin(); animalSound(o); } else sfx.error(); if (r === 'coins') toast('Not enough coins'); else if (r === 'full') toast('This pen is full'); break; }
    case 'feedAll': { const n = feedPen(o); if (!n) { sfx.error(); toast(`No ${nm(G.penAnimal(o).feed).toLowerCase()} left. Make some at the Feed Mill.`); } break; }
    case 'tendPen': tendPen(o); break;
    case 'makeFeed': goTo(guideForItem(G.penAnimal(o).feed, 'Make'), nm(G.penAnimal(o).feed)); return;
    case 'collectAnimals': collectPen(o); break;
    case 'collectRent': collectHouse(o); break;
    case 'move': {
      const ready = G.moveReadyAt(o);
      if (ready > now()) { sfx.error(); toast(`You can move this again in ${fmtT(ready - now())}`); return; }
      startPlacing(o.t, o); return;
    }
    case 'upgrade': {
      const r = G.upgradeBuilding(o);
      if (r === 'ok') { sfx.build(); toast(`${BUILD[o.t].name} upgraded to level ${G.blvl(o)}!`); floater(o.x + 1, o.y + 1, `⬆ Lv ${G.blvl(o)}`, '#FFE9A8'); }
      else { sfx.error(); toast(r === 'max' ? 'Already fully upgraded' : 'Need more coins or materials. Make planks and nails at the Workshop.'); }
      break;
    }
    case 'fertilize': {
      const r = G.fertilize(o);
      if (r === 'ok') { sfx.hourglass(); floater(o.x + 0.5, o.y + 0.5, '🧴 growing fast!'); }
      else { sfx.error(); toast(r === 'none' ? 'No fertilizer. Make some at the Workshop.' : 'Nothing growing here'); }
      break;
    }
    case 'clear': case 'clearTool': {
      const r = G.clearObstacle(o, d.act === 'clearTool');
      if (r.err) { sfx.error(); toast(r.err === 'tool' ? `No ${nm(G.toolFor(o))}. Make one at the Workshop.` : 'Not enough coins'); break; }
      sfx.clear();
      floater(o.x + 0.5, o.y + 0.5, r.drop ? `+${r.drop.n}${em(r.drop.id)}` : '+1 XP');
      foundKeepsake(E.rollKeepsake('clear'));
      closeSheet(); break;
    }
    case 'deliver': {
      const items = { ...(G.S.orders[+d.i]?.items || {}) }, who = G.S.orders[+d.i]?.who;
      const r = G.deliver(+d.i);
      if (r) {
        { const T = todayLog(); if (who && !T.people.includes(who)) T.people.push(who); }
        sfx.deliver(); haptic(true);
        const fair = E.fairCount(items);
        toast(`${r.rushed ? 'Rush delivery! ' : 'Delivered! '}+${fmtN(r.coins)} 🪙 +${r.xp} XP${r.bonus ? ' · bonus ⏳' : ''}${fair ? ` · +${fair} toward the ${E.fairName()}` : ''}`);
        foundKeepsake(E.rollKeepsake('deliver'));
      }
      break;
    }
    case 'qtab': sfx.tap(); questTab = d.tab; $('#sheetBody').scrollTop = 0; break;
    case 'fund': {
      const p = E.PROJECTS.find(x => x.id === d.id), r = E.fundStage(p);
      if (!r) { sfx.error(); toast('Not enough yet'); break; }
      sfx.build();
      if (r === 'done') { sfx.levelUp(); modal(`<div class="bigart">${IMG(`sprites/${p.art}.webp`, '🏗️', 'bigimg')}</div><h2>${p.name}: complete!</h2>
        ${talkHead(p.who)}<div class="say">You did it! The whole town turned out to celebrate. Pelham Acres has never looked better.</div>
        <div class="rewardrow">${rewardLine({ hg: p.reward.hg, xp: p.reward.xp })}<span class="chip">+${p.reward.charm} charm, forever</span></div>
        <button class="btn wide" data-act="closeModal">Wonderful!</button>`); }
      else toast(`Stage ${E.projectStage(p)} of ${p.stages.length} done! The townsfolk cheer.`);
      break;
    }
    case 'claimFair': { const pr = E.claimFair(); if (pr) { sfx.levelUp(); toast(`Fair prize! +${fmtN(pr.coins)} 🪙 +${pr.hg} ⏳ +${pr.xp} XP`); } break; }
    case 'claimSet': { const s = E.KEEPSAKE_SETS.find(x => x.id === d.id), r = E.claimSet(s); if (r) { sfx.levelUp(); toast(`${s.name} complete! +${fmtN(r.coins)} 🪙 +${r.hg} ⏳`); } break; }
    case 'skip': G.skipOrder(+d.i); break;
    case 'sell': { const c = G.sell(d.id, +d.n); if (c) { sfx.coin(); toast(`Sold for ${c} 🪙`); } break; }
    case 'upgradeBarn': if (G.upgradeBarn()) { sfx.build(); toast('Barn upgraded! +30 space'); } else { sfx.error(); toast('Need more coins or materials'); } break;
    case 'tab': sfx.tap(); shopTab = d.tab; $('#sheetBody').scrollTop = 0; break;
    case 'btab': sfx.tap(); barnTab = d.tab; $('#sheetBody').scrollTop = 0; break;
    case 'buy': { const blk = G.buyBlock(d.t); if (blk) { sfx.error(); toast(blk); break; } sfx.tap(); startPlacing(d.t); return; }
    case 'export': { const ta = $('#saveText'); ta.value = G.exportSave(); ta.select(); try { navigator.clipboard.writeText(ta.value); toast('Save copied'); } catch (e) {} return; }
    case 'import': {
      try { G.importSave($('#saveText').value); afterLoad(); toast('Save loaded'); closeSheet(); } catch (e) { toast("That save code didn't work"); }
      return;
    }
    case 'reset':
      modal(`<h2>Start over?</h2><p>This erases your farm on this device. It can't be undone.</p>
        <div class="row" style="justify-content:center"><button class="btn red" data-act="resetYes">Erase and restart</button><button class="btn alt" data-act="closeModal">Keep my farm</button></div>`);
      return;
    case 'resetYes': G.resetGame(); G.S.tut = 0; afterLoad(); closeModal(); closeSheet(); toast('A fresh start in Pelham Acres'); return;
    case 'tutNext': tutAdvance(); return;
    case 'tutDone': tutDone(); return;
    case 'tutReplay': tutReplay(); return;
    case 'flip': { const g = view.ghost; if (g) { g.proto.flip = !g.proto.flip; sfx.tap(); haptic(); } return; }
    case 'toggle':
      G.S.settings[d.k] = d.k === 'hints' || d.k === 'haptics' ? G.S.settings[d.k] === false : !G.S.settings[d.k];
      if (d.k === 'music') setMusic(G.S.settings.music); else if (d.k === 'sfx') setSfx(G.S.settings.sfx); else if (d.k === 'haptics') haptic(); else applyGuide();
      sfx.tap(); refreshSoundBtn(); break;
  }
  G.save(); refreshHud(); renderSheet();
  setTimeout(showLevelUps, 300);
}

// ---------- object interactions ----------
function collectProducer(o) {
  const { got, full } = G.collectJobs(o);
  if (got.length) { sfx.collect(); haptic(); }
  got.forEach((j, i) => setTimeout(() => { floater(o.x + 1, o.y + 1, `+${j.n}`, '#fff', j.out); flyTo(o.x + 1, o.y + 1, j.out, '[data-tb=barn]', j.n); }, i * 150));
  if (full) { sfx.error(); toast('Barn is full! Sell or upgrade in the Barn.'); }
  return got.length;
}
function animalSound(o) { const a = BUILD[o.t].animal; (a === 'chicken' ? sfx.cluck : a === 'cow' ? sfx.moo : sfx.baa)(); }
function collectPen(o) {
  const { got, full } = G.collectAnimals(o);
  if (got) { const pr = G.penAnimal(o).product; sfx.collect(); haptic(); floater(o.x + 1, o.y + 1, `+${got}`, '#fff', pr); flyTo(o.x + 1, o.y + 1, pr, '[data-tb=barn]', got); penCheer(o, 'collect'); }
  if (o.animals.length) animalSound(o);
  if (full) { sfx.error(); toast('Barn is full! Sell or upgrade in the Barn.'); }
  return got;
}
function feedPen(o) {
  const a = G.penAnimal(o), fed = G.feedAll(o);
  if (fed) {
    sfx.plant(); setTimeout(() => animalSound(o), 250);
    flyFrom('[data-tb=barn]', o.x + 1, o.y + 1, a.feed, fed);
    setTimeout(() => { floater(o.x + 1, o.y + 0.6, `Fed ${fed}`, '#E8F7D8', a.feed); penCheer(o, 'fed'); }, 650);
  }
  return fed;
}
// One tap on a pen tends it: collect everything ready, then feed everyone hungry.
// Returns true if anything happened (then the panel stays closed so you can tap the next pen).
function tendPen(o) {
  const a = G.penAnimal(o), got = collectPen(o), fed = feedPen(o);
  const stillHungry = o.animals.filter(x => G.animalState(x) === 'hungry').length;
  if (stillHungry && !fed) { sfx.error(); toast(`Your ${a.name.toLowerCase()}s are hungry, but you're out of ${nm(a.feed).toLowerCase()}. Make some at the Feed Mill.`); }
  else if (stillHungry) toast(`Fed ${fed}. ${stillHungry} still hungry: you need more ${nm(a.feed).toLowerCase()}.`);
  if (got || fed) G.save();
  return !!(got || fed);
}
// the reverse of flyTo: little pictures leave a HUD button and land on a map tile
function flyFrom(source, gx, gy, id, n = 1) {
  const src = artSrc(id), sEl = $(source); if (!src || !sEl) return;
  const r = sEl.getBoundingClientRect(), sx = r.left + r.width / 2, sy = r.top + r.height / 2, to = tileCenterScreen(gx, gy);
  for (let i = 0; i < Math.min(n, 5); i++) {
    const im = document.createElement('img'); im.src = src; im.className = 'fly'; document.body.appendChild(im);
    const tx = to.x + (Math.random() - 0.5) * 30, ty = to.y - 10, mx = (sx + tx) / 2 + (Math.random() - 0.5) * 60, my = Math.min(sy, ty) - 80;
    im.animate([
      { transform: `translate(${sx - 16}px, ${sy - 16}px) scale(.5)`, opacity: 0 },
      { transform: `translate(${sx - 16}px, ${sy - 30}px) scale(1)`, opacity: 1, offset: 0.15 },
      { transform: `translate(${mx - 16}px, ${my - 16}px) scale(1)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${tx - 16}px, ${ty - 16}px) scale(.6)`, opacity: 0 }], { duration: 650 + i * 60, delay: i * 60, easing: 'cubic-bezier(.45,.05,.55,.95)' })
      .onfinish = () => im.remove();
  }
}
function collectHouse(o) {
  const c = G.collectRent(o);
  if (c) { sfx.coin(); haptic(); floater(o.x + 1, o.y + 1, `+${c}`, '#FFE9A8', 'coin'); flyTo(o.x + 1, o.y + 1, 'coin', '#coins', 4); }
  return c;
}

// ---------- Ollie & Milo ----------
const PET_COOLDOWN = 90000;
function petCat(c) {
  const S = G.S; S.pets = S.pets || {};
  if (c.gift) return napGift(c);
  const ready = now() - (S.pets[c.id] || 0) > PET_COOLDOWN;
  haptic();
  if (c.id === 'ollie') {
    sfx.meow(true);
    if (!ready) { floater(c.x, c.y, '😴 too comfy', '#FFFFFF'); toast('Ollie is too comfy to move right now.'); return; }
    S.pets.ollie = now();
    S.coins += 3;
    G.stat('pet'); G.stat('pet:ollie');
    c.react = { until: performance.now() + 3200, dur: 3200 }; c.nap = false; c.path = null;   // rolls over, belly up
    setTimeout(() => sfx.purr(), 500);
    floater(c.x, c.y, '💛 purrr  +3🪙', '#FFE9A8');
    toast('Ollie rolls over for belly rubs. What a big, happy boy.');
  } else {
    // a playful pounce at your hand, then off on a lap of the farm
    c.react = { until: performance.now() + 1500, dur: 1500 }; c.path = null;
    c.zoomUntil = performance.now() + 1500 + 4500; c.pause = 0;
    setTimeout(() => catGo(c, true), 1500);
    sfx.zoomies();
    if (!ready) { floater(c.x, c.y, '⚡ zoom!', '#FFFFFF'); toast('Milo is far too busy chasing a butterfly 🦋'); return; }
    S.pets.milo = now();
    G.stat('pet'); G.stat('pet:milo');
    const finds = Object.keys(CROPS).filter(k => CROPS[k].lvl <= S.level).concat(['wood', 'wood', 'stone']);
    const id = finds[Math.floor(Math.random() * finds.length)];
    if (Math.random() < 0.6 && G.addItem(id, 1)) { floater(c.x, c.y, `⚡ +1${em(id)}`); toast(`Milo does zoomies and drops a ${nm(id).toLowerCase()} at your feet!`); }
    else { floater(c.x, c.y, '⚡ zoomies!', '#FFFFFF'); toast('Milo does a lap of the whole farm at top speed.'); }
  }
  setTimeout(() => foundKeepsake(E.rollKeepsake('pet')), 1200);
  G.save(); refreshHud();
}
// Once a day one of the cats curls up somewhere on the farm (a crop row, the bench, beside a building)
// with a sparkle over him. Find him and tap him for a little gift.
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const bootAt = performance.now();
function napSpots() {
  const out = [], inTown = (x, y) => x >= 8 && y >= 8 && x <= 22 && y <= 22;
  for (const o of G.S.objs) {
    const b = BUILD[o.t];
    if (o.t === 'field') out.push({ x: o.x, y: o.y, where: o.crop ? `in the ${nm(o.crop).toLowerCase()} field` : 'in a field' });
    else if (o.t === 'bench') out.push({ x: o.x, y: o.y, where: 'on the bench' });
    else if (o.t === 'flowers') out.push({ x: o.x, y: o.y, where: 'in the flower bed' });
    else if (SHELTERED.includes(b.kind)) {
      // the sunny patch just in front of a building
      for (const [x, y] of [[o.x + b.w, o.y + b.h - 1], [o.x + b.w - 1, o.y + b.h]]) if (!G.objAt(x, y)) out.push({ x, y, where: `by the ${b.name}` });
    }
  }
  return out.filter(s => inTown(s.x, s.y));
}
const SHELTERED = ['producer', 'house', 'storage', 'pen', 'civic'];
function planNap() {
  const S = G.S, h = new Date().getHours();
  if (S.napDay === dayKey() || cats.some(c => c.napAt) || h < 8 || h >= 21 || performance.now() - bootAt < 45000 || inTutorial()) return;
  const spots = napSpots(); if (!spots.length) return;
  const c = cats[new Date().getDate() % 2], s = spots[Math.floor(Math.random() * spots.length)];
  c.napAt = { x: s.x + 0.5, y: s.y + 0.5, where: s.where }; c.path = null; c.napTried = false; c.react = null; c.gift = false;
}
function napGift(c) {
  const S = G.S, L = S.level;
  sfx.meow(c.fat); setTimeout(() => sfx.collect(), 300); haptic();
  const coins = 10 + L * 4; S.coins += coins;
  const finds = Object.keys(CROPS).filter(k => CROPS[k].lvl <= L).concat(['wood', 'stone', 'planks']);
  const id = finds[Math.floor(Math.random() * finds.length)], n = 1 + (Math.random() < 0.5 ? 1 : 0);
  const gotItem = G.addItem(id, n), hg = Math.random() < 0.12;
  if (hg) S.hg += 1;
  floater(c.x, c.y, `+${coins}`, '#FFE9A8', 'coin');
  if (gotItem) setTimeout(() => floater(c.x, c.y - 0.3, `+${n}`, '#fff', id), 350);
  const where = c.napAt.where;
  c.napAt = null; c.gift = false; c.nap = false; c.path = null; c.pause = performance.now() + 1500;
  c.react = { until: performance.now() + 2200, dur: 2200 };
  S.napDay = dayKey(); G.stat('napGift');
  modal(`<div class="bigart">${IMG(`sprites/${c.fat ? 'ollie-sleep' : 'milo-sleep'}.webp`, '🐈', 'bigimg')}</div><h2>You found ${c.name}!</h2>
    <p>${c.name} was napping ${esc(where)}. He stretches, yawns, and nudges a little something toward you.</p>
    <div class="rewardrow"><span class="chips"><span class="chip">🪙 ${coins}</span>${gotItem ? `<span class="chip">${art(id)} ${n}</span>` : ''}${hg ? `<span class="chip">⏳ 1</span>` : ''}</span></div>
    <p class="sub">One of the cats naps somewhere new every day. Look for the sparkle.</p>
    <button class="btn wide" data-act="closeModal">Good kitty</button>`);
  setTimeout(() => foundKeepsake(E.rollKeepsake('pet')), 1500);
  G.save(); refreshHud();
}
// a keepsake turned up: a little celebration, and it goes into the Scrapbook
const ksArt = (id, cls = 'ai') => IMG(`sprites/ks-${id}.webp`, '🎁', cls);
function foundKeepsake(id) {
  if (!id) return;
  const set = E.KEEPSAKE_SETS.find(s => s.items.includes(id)), have = set.items.filter(E.hasKeepsake).length;
  sfx.collect();
  if (!$('#modal').hidden) { toast(`Keepsake found: ${E.KEEPSAKE_NAMES[id]}! (${have}/4 ${set.name})`); return; }
  modal(`<div class="bigart">${ksArt(id, 'bigimg')}</div><h2>A keepsake!</h2>
    <p>You found a <b>${E.KEEPSAKE_NAMES[id]}</b>.</p>
    <p class="sub">${set.name}: ${have} of 4 · find them all for a reward. See your Scrapbook in Quests.</p>
    <button class="btn wide" data-act="closeModal">Into the scrapbook it goes</button>`);
  G.save();
}

function tapObject(o) {
  if (o.cat) return petCat(o.cat);
  if (o.person) return talkTo(o.person);
  const b = BUILD[o.t];
  if (b.kind !== 'field') Object.defineProperty(o, '_squish', { value: performance.now(), writable: true, configurable: true, enumerable: false }); // (not saved)
  switch (b.kind) {
    case 'field':
      if (!o.crop) return openSheet('Plant a crop', () => cropPicker(), o);
      if (G.fieldReady(o)) return harvestField(o);
      return openSheet(`${CROPS[o.crop].name} growing`, () => fieldInfo(o), o);
    case 'producer': collectProducer(o); return openSheet(b.name, () => producerSheet(o), o);
    case 'pen': if (o.animals.length && tendPen(o)) return; return openSheet(b.name, () => penSheet(o), o);
    case 'house': if (collectHouse(o)) { G.save(); return; } return openSheet(b.name, () => houseSheet(o), o);
    case 'storage': return openSheet('Barn', () => barnSheet(), o);
    case 'station': sfx.tap(); return openSheet('Train Station', () => stationSheet(o), o);
    case 'obstacle': return openSheet(`Clear ${b.name.toLowerCase()}`, () => obstacleSheet(o), o);
    default: return openSheet(b.name, () => infoSheet(o), o);
  }
}
function harvestField(o) {
  const c = o.crop, r = G.harvest(o);
  if (r === 'full') { sfx.error(); toast('Barn is full! Sell or upgrade in the Barn.'); return false; }
  if (r) { sfx.harvest(); haptic(); }
  if (r) { floater(o.x + 0.5, o.y + 0.5, `+${r.n}`, r.n > CROP_YIELD ? '#FFE9A8' : '#fff', c); flyTo(o.x + 0.5, o.y + 0.5, c, '[data-tb=barn]', 2); }
  if (r) { const k = E.rollKeepsake('harvest'); if (k) setTimeout(() => foundKeepsake(k), 500); }
  return !!r;
}

// ---------- sheet contents ----------
function cropPicker() {
  const se = G.season();
  const all = Object.entries(CROPS), open = all.filter(([, c]) => G.S.level >= c.lvl), locked = all.filter(([, c]) => G.S.level < c.lvl);
  // in-season crops first: they grow faster and pay more
  open.sort((a, b) => G.inSeason(b[0]) - G.inSeason(a[0]));
  return `<p class="sub">Pick a crop, then tap or drag across empty fields to plant it. ${se.icon} ${se.name} crops grow 25% faster and pay more in orders.</p><div class="grid">` +
    open.map(([k, c]) => `<div class="card buy">${G.inSeason(k) ? `<span class="ribbon season">${se.icon} In season</span>` : ''}
        <div class="big">${art(k)}</div><div class="nm">${c.name}</div>${starStr('crop', k)}
        <div class="meta">⏱ ${secs(Math.round(G.cropTime(k)))} · 🪙 ${c.cost} · ×${CROP_YIELD} · have ${G.have(k)}</div>
        <button class="btn sm" data-act="pickCrop" data-c="${k}">Plant</button></div>`).join('') + '</div>' +
    (locked.length ? `<h3 class="soon">Coming later</h3><div class="soonlist">${locked.map(([k, c]) =>
      `<div class="soonrow">${art(k, 'si')}<span class="nm">${c.name}</span><span class="spacer"></span><span class="lk">Level ${c.lvl}</span></div>`).join('')}</div>` : '');
}
function fieldInfo(o) {
  return `<p>${CROPS[o.crop].icon} Ready in <b data-end="${o.end}">${fmtT(o.end - now())}</b></p>
    <div class="bar"><div data-bar data-s="${o.start}" data-e="${o.end}"></div></div>
    <p class="sub">${CROPS[o.crop].name} mastery ${starStr('crop', o.crop)} · ${masteryLine('crop', o.crop)}</p>
    <div class="row"><button class="btn" data-act="fertilize">🧴 Fertilize (${G.have('fertilizer')})</button>
    <button class="btn gold" data-act="hgField">⏳ Finish now (${G.S.hg})</button></div>`;
}
function producerSheet(o) {
  const t = now(), n = G.slots(o);
  let q = '<div class="queue">';
  for (let i = 0; i < n; i++) {
    const j = o.jobs[i];
    if (!j) { q += '<div class="slot"><small>empty</small></div>'; continue; }
    if (j.end <= t) q += `<div class="slot done">${ic(j.out)}<small>ready</small></div>`;
    else if (j.start <= t) q += `<div class="slot">${ic(j.out)}<small data-end="${j.end}">${fmtT(j.end - t)}</small><div class="bar" style="width:80%"><div data-bar data-s="${j.start}" data-e="${j.end}"></div></div></div>`;
    else q += `<div class="slot">${ic(j.out)}<small>queued</small></div>`;
  }
  q += '</div>';
  const done = G.jobsDone(o);
  const running = o.jobs.some(j => j.end > t);
  let html = q + `<div class="row">${done ? '<button class="btn" data-act="collectJobs">Collect</button>' : ''}
    ${running ? `<button class="btn gold sm" data-act="hg">⏳ Finish current (${G.S.hg})</button>` : ''}</div><h3>Recipes</h3><div class="grid">`;
  const soon = [];
  RECIPES[o.t].forEach((r, i) => {
    if (G.S.level < r.lvl) { soon.push(r); return; }
    const can = G.hasAll(r.in) && o.jobs.length < n;
    html += `<div class="card ${can ? 'buy' : 'short'}"><div class="big">${art(r.out)}</div><div class="nm">${nm(r.out)}${r.n > 1 ? ' ×' + r.n : ''}</div>
      ${starStr('recipe', r.out)}
      <div class="meta">⏱ ${secs(Math.round(G.recipeTime(o, r)))}${NO_ORDER.has(r.out) ? '' : ` · worth ${VALUE[r.out]}🪙`} · have ${G.have(r.out)}</div>
      <div class="row reqs">${reqs(r.in)}</div>
      <button class="btn sm ${can ? '' : 'off'}" data-act="make" data-i="${i}">Make</button></div>`;
  });
  html += '</div>';
  if (soon.length) html += `<h3 class="soon">Coming later</h3><div class="soonlist">${soon.map(r =>
    `<div class="soonrow">${art(r.out, 'si')}<span class="nm">${nm(r.out)}</span><span class="spacer"></span><span class="lk">Level ${r.lvl}</span></div>`).join('')}</div>`;
  return html + '<h3>Upgrade</h3>' + upgradeBlock(o) + '<br>' + moveBtn(o);
}
function penSheet(o) {
  const b = BUILD[o.t], a = G.penAnimal(o), t = now();
  const hungry = o.animals.filter(x => G.animalState(x) === 'hungry').length;
  const ready = o.animals.filter(x => G.animalState(x) === 'ready').length;
  const feedHave = G.have(a.feed), busy = o.animals.some(x => G.animalState(x) === 'busy');
  // the feed → product loop at a glance, with how much feed is in the barn
  let html = `<div class="penloop"><div class="pl">${art(a.feed, 'plart')}<b>${feedHave}</b><small>${nm(a.feed)} in barn</small></div>
      <div class="arrow">→</div><div class="pl">${art(b.animal, 'plart')}<small>every ${secs(Math.round(G.animalTime(o, a)))}</small></div>
      <div class="arrow">→</div><div class="pl">${art(a.product, 'plart')}<b>${G.have(a.product)}</b><small>${nm(a.product)} in barn</small></div></div>`;
  if (hungry > feedHave) html += `<div class="lowfeed">${ui('lock', '')}<div class="grow"><b>Not enough ${nm(a.feed).toLowerCase()}</b> for everyone (${hungry} hungry, ${feedHave} in the barn).</div><button class="btn sm" data-act="makeFeed">Make more</button></div>`;
  // one card per animal
  html += '<div class="animals">' + o.animals.map((an, i) => {
    const st = G.animalState(an), total = G.animalTime(o, a) * 1000, start = an.end - total;
    return `<div class="acard ${st}">${art(b.animal, 'aart')}<div class="aname">${a.name} ${i + 1}</div>
      ${st === 'ready' ? `<div class="astate">${art(a.product, 'ai')} Ready!</div>` : st === 'hungry' ? `<div class="astate">${art(a.feed, 'ai')} Hungry</div>`
        : `<div class="astate">Making ${nm(a.product).toLowerCase()} · <span data-end="${an.end}">${fmtT(an.end - t)}</span></div><div class="bar"><div data-bar data-s="${start}" data-e="${an.end}"></div></div>`}</div>`;
  }).join('') + Array.from({ length: G.penCap(o) - o.animals.length }, () => `<div class="acard empty"><span>+</span><div class="aname">Empty spot</div></div>`).join('') + '</div>';
  html += `<div class="row">
    ${ready || (hungry && feedHave) ? `<button class="btn gold" data-act="tendPen">${ready ? `Collect ${ready}` : ''}${ready && hungry && feedHave ? ' & ' : ''}${hungry && feedHave ? `Feed ${Math.min(hungry, feedHave)}` : ''}</button>` : ''}
    ${busy ? `<button class="btn alt sm" data-act="hg">⏳ Finish all (${G.S.hg})</button>` : ''}
    ${o.animals.length < G.penCap(o) ? `<button class="btn alt" data-act="buyAnimal">Buy a ${a.name.toLowerCase()} · ${G.animalCost(o)}🪙</button>` : ''}
    <span class="spacer"></span>${moveBtn(o)}</div>
    <p class="sub" style="margin-top:8px">Tip: just tap the pen on the farm to collect and feed in one go.</p>`;
  if (!o.animals.length) html += `<p class="sub" style="margin-top:12px">Buy your first ${a.name.toLowerCase()} to get started.</p>`;
  return html + '<h3>Upgrade</h3>' + upgradeBlock(o);
}
function houseSheet(o) {
  const b = BUILD[o.t], due = G.rentDue(o), rent = G.rentOf(o);
  const next = o.last + (due + 1) * b.period * 1000;
  return `<p>Your neighbors pay <b>${rent} 🪙</b> rent every ${secs(b.period)} (holds up to ${G.RENT_CAP} payments).</p>
    ${due ? `<button class="btn" data-act="collectRent">Collect ${due * rent} 🪙</button>` : `<p>Next rent in <b data-end="${next}">${fmtT(next - now())}</b></p>`}
    <h3>Upgrade</h3>${upgradeBlock(o)}<br>${moveBtn(o)}`;
}
function infoSheet(o) {
  const b = BUILD[o.t];
  let html = '';
  if (b.kind === 'civic') html += `<p>A proud landmark of ${G.S.town}. Adds <b>+${b.charm} charm</b>.</p>`;
  if (b.kind === 'decor') html += `<p>${b.charm ? `Adds +${b.charm} charm (decorations count up to ${DECOR_CHARM_CAP}).` : 'Purely for looks.'}</p>`;
  if (b.kind === 'path') html += '<p>A tidy cobblestone path.</p>';
  html += `<p class="sub">Town charm: <b>${G.charm()}</b> → orders pay <b>+${G.charm()}%</b> coins.</p>${moveBtn(o)}`;
  return html;
}
function obstacleSheet(o) {
  const b = BUILD[o.t], c = G.clearCost(o);
  const tool = G.toolFor(o), nt = G.have(tool);
  return `<p>Clearing this ${b.name.toLowerCase()} makes room to build. You'll probably find some ${ic(b.drop)} ${nm(b.drop)}.</p>
    <div class="row"><button class="btn ${nt ? '' : 'off'}" data-act="clearTool">Use ${ic(tool)} ${nm(tool)} (${nt})</button>
    <button class="btn alt ${G.S.coins >= c ? '' : 'off'}" data-act="clear">Pay ${c} 🪙</button></div>
    <p class="sub">${nm(tool)}s are made at the Workshop from wood and stone.</p>`;
}
let barnTab = 'all';
function barnSheet() {
  const used = G.storageUsed(), cap = G.storageCap(), up = G.barnUpgradeCost(), full = used >= cap;
  // what the townsfolk are asking for right now, so you know what to keep
  const wanted = new Set();
  for (const o of G.S.orders) if (!o.wait) for (const k in o.items) wanted.add(k);
  for (const q of Q.activeQuests()) for (const g of q.goals) if (g.id && ITEMS[g.id]) wanted.add(g.id);
  const cat = id => CROPS[id] ? 'crops' : MATS.has(id) || NO_ORDER.has(id) ? 'supplies' : 'goods';
  const all = Object.entries(G.S.inv).filter(([, n]) => n > 0);
  const counts = { all: all.length, crops: 0, goods: 0, supplies: 0 }; all.forEach(([id]) => counts[cat(id)]++);
  const items = all.filter(([id]) => barnTab === 'all' || cat(id) === barnTab)
    .sort((a, b) => wanted.has(b[0]) - wanted.has(a[0]) || b[1] - a[1] || nm(a[0]).localeCompare(nm(b[0])));
  const TABS = [['all', 'All', 'barn'], ['crops', 'Crops', 'wheat'], ['goods', 'Goods', 'bread'], ['supplies', 'Supplies', 'planks']];
  let html = `<div class="storebar ${full ? 'full' : ''}"><div class="row"><b>Barn space</b><span class="spacer"></span><b>${used} / ${cap}</b></div>
    <div class="bar"><div style="width:${Math.min(100, used / cap * 100)}%"></div></div>
    <div class="sub" style="margin:4px 0 0">${full ? 'Full! Sell extras or upgrade below.' : 'Wood, stone, tools and building supplies are kept in the toolshed and take no space.'}</div></div>
    <div class="tabs">${TABS.map(([k, label, icon]) => `<button class="tab ${barnTab === k ? 'on' : ''}" data-act="btab" data-tab="${k}">${art(icon, 'ti')}<span>${label}</span><i class="tcount soft">${counts[k]}</i></button>`).join('')}</div>`;
  if (!items.length) html += '<p class="sub">Nothing here yet. Harvest some crops!</p>';
  else html += '<div class="inv">' + items.map(([id, n]) => `<div class="invrow ${wanted.has(id) ? 'wanted' : ''}">${art(id, 'iv')}<div class="grow"><div class="n">${n}× ${nm(id)}</div>
    <div class="nm">${wanted.has(id) ? '<b class="tag">Wanted in town</b>' : `sells for ${G.sellPrice(id)}🪙`}</div></div>
    <button class="btn sm alt" data-act="sell" data-id="${id}" data-n="1">Sell 1</button></div>`).join('') + '</div>';
  html += `<h3>Upgrade barn (+30 space)</h3><div class="row"><span class="req ${G.S.coins >= up.coins ? 'ok' : 'no'}">🪙 ${fmtN(up.coins)}</span>${req('wood', up.wood)}${req('stone', up.stone)}
    <button class="btn sm" data-act="upgradeBarn">Upgrade</button></div>`;
  return html;
}
let shopTab = 'Farm';
// Shop status of one item: 'buy' (can build right now), 'short' (unlocked, missing coins/materials), 'owned' (at its limit), 'locked'
function shopInfo(k) {
  const b = BUILD[k], n = G.count(k), mx = b.max(G.S.level), noBp = b.needs && !Q.hasFlag(b.needs);
  const locked = G.S.level < b.lvl || noBp;
  const st = locked ? 'locked' : n >= mx ? 'owned' : G.buyBlock(k) ? 'short' : 'buy';
  return { b, n, mx, noBp, st, isNew: !locked && n === 0 };
}
const SHOP_ICON = { Farm: 'field', Animals: 'coop', Production: 'bakery', Town: 'cottage', Decor: 'flowers' };
function shopSheet() {
  const keys = Object.keys(BUILD).filter(k => BUILD[k].cat);
  const tabs = SHOP_CATS.map(c => {
    const ready = keys.filter(k => BUILD[k].cat === c && shopInfo(k).st === 'buy').length;
    return `<button class="tab ${c === shopTab ? 'on' : ''}" data-act="tab" data-tab="${c}">${art(SHOP_ICON[c], 'ti')}<span>${c}</span>${ready ? `<i class="tcount">${ready}</i>` : ''}</button>`;
  }).join('');
  const order = { buy: 0, short: 1, owned: 2, locked: 3 };
  const list = keys.filter(k => BUILD[k].cat === shopTab).map(k => ({ k, ...shopInfo(k) }))
    .sort((a, c) => order[a.st] - order[c.st] || (a.st === 'locked' ? a.b.lvl - c.b.lvl : 0));
  const what = b => b.kind === 'station' ? b.desc : b.kind === 'house' ? `${b.rent}🪙 every ${secs(b.period)}` : b.kind === 'civic' || b.charm ? `+${b.charm} charm` :
    b.kind === 'pen' ? `${ANIMALS[b.animal].name}s · ${em(ANIMALS[b.animal].product)}` : b.kind === 'producer' ? `${RECIPES[b.id].length} recipes` : b.desc || '';
  const card = ({ k, b, n, mx, st, isNew }) => {
    const cost = b.cost(n);
    return `<div class="card ${st}">${isNew && st !== 'owned' ? '<span class="ribbon">New</span>' : ''}
      <div class="big">${art(k)}</div><div class="nm">${b.name}</div><div class="meta">${what(b)}</div>
      ${st === 'owned' ? `<div class="meta okline">✔ Built${mx > 1 && mx < Infinity ? ` ${n}/${mx}` : ''}</div>` :
      `<div class="row reqs"><span class="req ${G.S.coins >= cost ? 'ok' : 'no'}">🪙 ${fmtN(cost)}</span>${b.mats ? reqs(b.mats) : ''}</div>
       ${mx < Infinity && mx > 1 ? `<div class="meta">${n}/${mx} built</div>` : ''}
       <button class="btn sm ${st === 'buy' ? '' : 'off'}" data-act="buy" data-t="${k}">Build</button>`}</div>`;
  };
  const open = list.filter(x => x.st !== 'locked'), locked = list.filter(x => x.st === 'locked');
  let html = `<div class="tabs">${tabs}</div>`;
  html += open.length ? `<div class="grid">${open.map(card).join('')}</div>` : '<p class="sub">Nothing here yet. Keep leveling up!</p>';
  if (locked.length) html += `<h3 class="soon">Coming later</h3><div class="soonlist">${locked.map(({ k, b, noBp }) =>
    `<div class="soonrow">${art(k, 'si')}<span class="nm">${b.name}</span><span class="spacer"></span><span class="lk">${noBp && G.S.level >= b.lvl ? '🗺️ ' + b.needsText : 'Level ' + b.lvl}</span></div>`).join('')}</div>`;
  return html;
}
function ordersSheet() {
  G.refreshOrders();
  const t = now();
  const isRush = o => o.rush && o.rush > t;
  const list = G.S.orders.map((o, i) => ({ o, i, ok: !o.wait && G.hasAll(o.items) }))
    .sort((a, b) => (b.ok - a.ok) || (isRush(b.o) - isRush(a.o)) || (!!a.o.wait - !!b.o.wait));
  const ready = list.filter(x => x.ok).length;
  return `<p class="sub">${ready ? `<b>${ready} order${ready > 1 ? 's' : ''} ready to deliver!</b> ` : ''}Filling a neighbor's order builds your friendship. Tap a red item to see where to get it.</p><div class="orders">` + list.map(({ o, i, ok }) => {
    if (o.wait) return `<div class="order waiting">${ui('mail', '✉️')}<span class="sub" style="margin:0">A new order arrives in <b data-end="${o.wait}">${fmtT(o.wait - t)}</b></span></div>`;
    const pid = G.orderPid(o), rush = isRush(o);
    const coins = rush ? Math.round(o.coins * 1.5) : o.coins;
    return `<div class="order ${ok ? 'ready' : ''} ${rush ? 'rush' : ''}"><div class="ohead">${pid ? face(pid, 'oface') : ui('mail', '✉️').replace('class="ui"', 'class="oface plain"')}
        <div class="grow"><div class="who">${o.who} ${pid ? heartRow(pid) : ''}</div>
        ${o.why ? `<div class="why">${o.why}</div>` : ''}</div>
        ${ok ? '<span class="stamp">Ready</span>' : ''}</div>
      ${rush ? `<div class="rushbar">${ui('hourglass', '')} <b>Rush order:</b> +50% coins${pid ? ' and extra friendship' : ''} if delivered in <b data-end="${o.rush}">${fmtT(o.rush - t)}</b></div>` : ''}
      <div class="row reqs">${reqs(o.items)}</div>
      <div class="row"><span class="rew">🪙 ${fmtN(coins)} &nbsp; ⭐ ${o.xp}${pid ? ` &nbsp; <span class="heartplus">+${rush ? 2 : 1} ♥</span>` : ''}</span><span class="spacer"></span>
        <button class="btn alt sm" data-act="skip" data-i="${i}">Skip</button><button class="btn ${ok ? '' : 'off'}" data-act="deliver" data-i="${i}">Deliver</button></div></div>`;
  }).join('') + '</div>';
}
// one settings row: label on the left, a slider or an on/off switch on the right
const volOf = k => { const v = G.S.settings.vol; return v && typeof v[k] === 'number' ? v[k] : 1; };
const slideRow = (k, label, icon, on) => `<div class="setrow">${ui(icon, '')}<span class="setlbl">${label}</span>
  <input type="range" class="slider ${on ? '' : 'dim'}" min="0" max="100" step="5" value="${Math.round(volOf(k) * 100)}" data-vol="${k}" aria-label="${label} volume"></div>`;
const switchRow = (k, label, icon, on, note) => `<div class="setrow">${ui(icon, '')}<span class="setlbl">${label}${note ? `<small>${note}</small>` : ''}</span>
  <button class="switch ${on ? 'on' : ''}" data-act="toggle" data-k="${k}" role="switch" aria-checked="${on}"><i></i></button></div>`;
function saveStatus() {
  if (C.cloudEnabled() && C.signedIn()) {
    const t = C.lastSync();
    return `<div class="savestat ok">${ui('lock', '')}<div><b>Saved to the cloud${t ? ` ${fmtT(now() - t)} ago` : ''} ✓</b><small>Signed in as ${esc(C.userEmail())}</small></div></div>`;
  }
  return `<div class="savestat">${ui('barn', '')}<div><b>Saved on this device ✓</b><small>Sign in below to keep your farm safe in the cloud.</small></div></div>`;
}
function menuSheet() {
  const S = G.S, st = S.settings;
  return `<div class="parch">
    <p style="margin:0"><b>${S.town}</b> · Level ${S.level} · ${S.delivered || 0} order${S.delivered === 1 ? '' : 's'} delivered · ${S.cleared || 0} spot${S.cleared === 1 ? '' : 's'} cleared</p>
    <p class="sub" style="margin:4px 0 0">Town charm: ${G.charm()}. No ads, no purchases, ever.</p></div>
    <h3>Settings</h3>
    <div class="setbox">
      ${switchRow('music', 'Music', 'sound', st.music)}
      ${slideRow('music', 'Music volume', 'sound', st.music)}
      ${switchRow('sfx', 'Sound effects', 'sound', st.sfx)}
      ${slideRow('sfx', 'Effects volume', 'sound', st.sfx)}
      ${slideRow('amb', 'Birdsong and crickets', 'blossom', st.sfx)}
      ${switchRow('haptics', 'Vibration', 'heart', st.haptics !== false, 'A light tap you can feel, where your device supports it')}
      ${switchRow('hints', 'Hints and arrows', 'bulb', st.hints !== false)}
    </div>
    <div class="row" style="margin-top:8px"><button class="btn alt sm" data-act="tutReplay">${ui('scroll', '')} Replay Hattie's tour</button></div>
    <p class="sub">No sound? Turn the iPad's volume up and tap the map once.</p>
    <h3>Your farm is saved</h3>${saveStatus()}
    ${cloudHtml()}
    <h3>Mastery</h3>${masteryList()}
    <h3>Backup code</h3><p class="sub">You can also copy this code to keep a backup, or paste one to restore.</p>
    <textarea id="saveText" placeholder="Save code"></textarea><div class="row" style="margin-top:8px">
    <button class="btn alt sm" data-act="export">Copy save code</button><button class="btn alt sm" data-act="import">Load pasted code</button></div>
    <h3>Danger zone</h3><button class="btn red sm" data-act="reset">Start a new farm</button>
    <div class="credits"><b>Pelham Acres</b> · version ${APP_VERSION}<br>
      Starring Ollie and Milo, the best farm cats in the valley.<br>
      <small>Paintings and music made with AI tools. Code by Claude.</small></div>`;
}
// ---------- cloud saves ----------
let cloudStep = 'email', cloudEmailVal = '', cloudBusy = false;
function cloudHtml() {
  if (!C.cloudEnabled()) return `<h3>Cloud save</h3><p class="sub">Coming very soon: sign in to keep your farm safe and play on any device.</p>`;
  if (C.signedIn()) {
    const ago = C.lastSync() ? fmtT(now() - C.lastSync()) + ' ago' : 'not yet';
    return `<h3>Cloud save</h3><div class="storebar"><div class="row">${ui('lock', '')}<b class="grow">Signed in as ${C.userEmail()}</b></div>
      <div class="sub" style="margin:4px 0 0">Your farm saves to the cloud automatically. Last cloud save: ${ago}.</div></div>
      <div class="row"><button class="btn sm" data-act="cloudSave">Save now</button><button class="btn alt sm" data-act="cloudLoad">Load cloud farm</button>
      <span class="spacer"></span><button class="btn alt sm" data-act="cloudOut">Sign out</button></div>`;
  }
  if (cloudStep === 'code') return `<h3>Cloud save</h3><p>We emailed a sign-in link to <b>${cloudEmailVal}</b>.</p>
    <p class="sub"><b>Playing in Safari?</b> Just tap "Sign in" in the email.<br>
    <b>Playing from your Home Screen icon?</b> In the email, press and hold "Sign in", choose <b>Copy Link</b>, then paste it here:</p>
    <div class="row"><input id="cloudCode" class="field" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Paste the link here">
    <button class="btn ${cloudBusy ? 'off' : ''}" data-act="cloudVerify">Sign in</button><button class="btn alt sm" data-act="cloudBack">Back</button></div>`;
  return `<h3>Cloud save</h3><p class="sub">Sign in with your email to keep your farm safe and play it on any device. No password: we email you a sign-in link.</p>
    <div class="row"><input id="cloudEmail" class="field" type="email" autocomplete="email" placeholder="you@example.com" value="${cloudEmailVal}">
    <button class="btn ${cloudBusy ? 'off' : ''}" data-act="cloudSend">Email me a link</button></div>`;
}
async function cloudAct(a) {
  if (cloudBusy) return;
  try {
    cloudBusy = true;
    if (a === 'cloudSend') {
      const v = ($('#cloudEmail')?.value || '').trim();
      if (!/^\S+@\S+\.\S+$/.test(v)) { toast('Please type your email address'); return; }
      cloudEmailVal = v; await C.sendCode(v); cloudStep = 'code'; toast('Sign-in link sent! Check your email.');
    } else if (a === 'cloudVerify') {
      const code = ($('#cloudCode')?.value || '').trim();
      if (code.length < 6) { toast('Paste the sign-in link from the email'); return; }
      await C.verifyInput(cloudEmailVal, code); cloudStep = 'email';
      toast('Signed in!'); await cloudCheck(true);
    } else if (a === 'cloudBack') cloudStep = 'email';
    else if (a === 'cloudSave') { await C.upload(true); toast('Farm saved to the cloud ☁️'); }
    else if (a === 'cloudLoad') await cloudCheck(true, true);
    else if (a === 'cloudOut') { await C.upload(true).catch(() => {}); C.signOut(); toast('Signed out. Your farm stays on this device too.'); }
  } catch (e) { sfx.error(); toast(`Cloud: ${e.message}`); }
  finally { cloudBusy = false; renderSheet(); }
}
// Compare this device's farm with the cloud copy; offer a choice if the cloud one is newer (or when asked).
async function cloudCheck(afterSignIn, ask) {
  if (!C.cloudEnabled() || !C.signedIn()) return;
  const cloud = await C.fetchCloud();
  if (!cloud) { await C.upload(true); if (afterSignIn) toast('Your farm is now saved in the cloud ☁️'); return; }
  const local = G.S, newer = (cloud.saved || 0) > (local.saved || 0) + 60000;
  if (!newer && !ask) { await C.upload(true); return; }
  modal(`<div class="bigart">${ui('barn', '').replace('class="ui"', 'class="bigimg"')}</div><h2>Which farm?</h2>
    <p class="sub">There's a farm saved in the cloud and one on this device.</p>
    <div class="awaylist"><div><b>Cloud:</b>&nbsp;${C.describe(cloud)}</div><div><b>This device:</b>&nbsp;${C.describe(local)}</div></div>
    <button class="btn gold wide" data-act="cloudUseCloud">Play the cloud farm</button><div style="height:8px"></div>
    <button class="btn alt wide" data-act="cloudKeepLocal">Keep this device's farm</button>`);
  pendingCloud = cloud;
}
let pendingCloud = null;
setInterval(() => { C.upload(false).catch(() => {}); }, 60000);
document.addEventListener('visibilitychange', () => { if (document.hidden) C.upload(false, true).catch(() => {}); });

// ---------- expedition ----------
let expRegion = 'woods';
function openExpedition() {
  closeSheet(); endPlant(); if (view.ghost) cancelPlace();
  const first = X.REGIONS.find(r => r.id === expRegion && X.regionUnlocked(r)) || X.REGIONS.find(X.regionUnlocked);
  if (!first) return;
  expRegion = first.id;
  $('#exp').hidden = false; sfx.open();
  renderExp();
  scrollToFrontier();
}
// scroll so the edge of what you've explored is in view
function scrollToFrontier() {
  const el = $('#expGrid .tile.can') || $('#expGrid .tile.rev');
  if (el) { const body = $('#expBody'); body.scrollTop = Math.max(0, el.offsetTop - body.clientHeight / 2); }
}
function closeExpedition() { $('#exp').hidden = true; sfx.close(); G.save(); refreshHud(); }
// painted expedition art: one picture per kind of square, plus region badges
const exArt = (n, fb, cls = 'ex') => IMG(`sprites/ex-${n}.webp`, fb, cls);
const REGION_ART = { woods: 'pine', hills: 'hills', lake: 'lantern' };
const regionArt = (r, cls) => exArt(REGION_ART[r.id] || 'pine', r.icon, cls);
function renderExp() {
  const reg = X.REGIONS.find(r => r.id === expRegion), L = X.layout(reg);
  $('#exp').style.background = reg.bg;
  $('#expTabs').innerHTML = X.REGIONS.map(r => {
    const un = X.regionUnlocked(r);
    return `<button class="tab ${r.id === expRegion ? 'on' : ''} ${un ? '' : 'lock'}" data-reg="${r.id}">${regionArt(r, 'ti')}<span>${r.name}</span>${un ? (X.regionState(r).done ? ' ✔' : '') : `<i class="tcount soft">Lv ${r.lvl}</i>`}</button>`;
  }).join('');
  const body = $('#expBody'), ts = Math.max(40, Math.min(64, Math.floor((body.clientWidth - 28 - (reg.cols - 1) * 4) / reg.cols)));
  const grid = $('#expGrid');
  grid.style.setProperty('--ts', ts + 'px');
  grid.style.gridTemplateColumns = `repeat(${reg.cols}, ${ts}px)`;
  grid.innerHTML = L.tiles.map((t, i) => {
    const T = X.TILE[t];
    if (X.isRevealed(reg, i)) return `<div class="tile rev ${t === 'water' ? 'water' : ''} t-${t}" data-i="${i}">${exArt(t, T.icon)}${t === 'camp' ? IMG('sprites/milo-sit.webp', '🐈', 'milo') : ''}</div>`;
    if (X.canExplore(reg, i)) return `<div class="tile can" data-i="${i}">${exArt('paws', '', 'paws')}<span class="cost">⚡${T.cost}</span></div>`;
    return `<div class="tile fog" data-i="${i}">${exArt('fog', '☁️', 'fogimg')}</div>`;
  }).join('');
  grid.innerHTML = paint(grid.innerHTML);
  updateEnergy();
  renderExpFoot(reg);
}
function renderExpFoot(reg) {
  const p = X.progress(reg), st = X.regionState(reg);
  const foods = Object.keys(X.FOOD).filter(k => G.have(k) > 0);
  $('#expFoot').innerHTML = paint(`<div class="row"><b>${regionArt(reg, 'ai')} ${reg.name}</b><span class="sub" style="margin:0">· explored ${p.have}/${p.total}</span><span class="spacer"></span>
      <span class="sub" style="margin:0">${st.done ? 'Fully explored ✅' : `Explore it all: 🪙 ${fmtN(reg.reward.coins)} · ⏳ ${reg.reward.hg} · ${Object.entries(reg.reward.items).map(([k, v]) => ic(k) + ' ' + v).join(' ')}`}</span></div>
    <div class="row" style="margin-top:8px"><b>🧺 Picnic basket</b><span class="sub" style="margin:0">Eat food you've made for energy</span></div>
    <div class="row" style="margin-top:6px">${foods.length ? foods.map(k => `<span class="food">${ic(k)} ${G.have(k)} <button class="btn sm" data-eat="${k}">+${X.FOOD[k]}⚡</button></span>`).join('') : '<span class="sub" style="margin:0">Bake bread or make other foods to pack a picnic.</span>'}</div>`);
}
function updateEnergy() {
  const e = X.energy();
  $('#enVal').textContent = e;
  $('#enFill').style.width = Math.min(100, e / X.ENERGY.max * 100) + '%';
  $('#enNext').textContent = e >= X.ENERGY.max ? 'full' : `+1 in ${fmtT(X.nextEnergyAt() - now())}`;
}
$('#expClose').addEventListener('click', closeExpedition);
$('#expTabs').addEventListener('click', e => {
  const b = e.target.closest('[data-reg]'); if (!b) return;
  const reg = X.REGIONS.find(r => r.id === b.dataset.reg);
  if (!X.regionUnlocked(reg)) { sfx.error(); toast(G.S.level < reg.lvl ? `Reach level ${reg.lvl} to explore ${reg.name}` : 'Find the old map first'); return; }
  expRegion = reg.id; sfx.tap(); renderExp(); scrollToFrontier();
});
$('#expFoot').addEventListener('click', e => {
  const b = e.target.closest('[data-eat]'); if (!b) return;
  const n = X.eat(b.dataset.eat);
  if (n) { sfx.collect(); toast(`Yum! +${n} ⚡`); G.save(); renderExp(); }
});
$('#expGrid').addEventListener('click', e => {
  const el = e.target.closest('.tile'); if (!el) return;
  const reg = X.REGIONS.find(r => r.id === expRegion), i = +el.dataset.i;
  if (!el.classList.contains('can')) { if (el.classList.contains('fog')) { sfx.error(); toast('Explore next to the tiles you have uncovered'); } return; }
  const r = X.explore(reg, i);
  if (r.err === 'energy') { sfx.error(); toast(`Need ${r.cost} ⚡ energy. Eat something from your picnic basket, or wait for it to refill.`); return; }
  if (!r.ok) return;
  setTimeout(() => foundKeepsake(E.rollKeepsake('explore')), 900);
  ({ chest: sfx.levelUp, rock: sfx.clear, ore: sfx.clear, gemrock: sfx.collect, brush: sfx.clear, berries: sfx.harvest, ruin: sfx.build }[r.type] || sfx.plant).call(sfx);
  const bits = [];
  if (r.coins) bits.push(`+${r.coins}🪙`);
  if (r.hg) bits.push(`+${r.hg}⏳`);
  for (const k in r.loot) bits.push(`+${r.loot[k]}${em(k)}`);
  if (bits.length) toast(`${X.TILE[r.type].name}: ${bits.join(' ')}`);
  G.save();
  renderExp();
  const nt = $(`#expGrid .tile[data-i="${i}"]`); if (nt) nt.classList.add('pop');
  if (r.story) modal(`<div class="bigart">${exArt('ruin', '🏚️', 'bigimg')}</div><h2>${r.story.name}</h2><div class="say">${r.story.text}</div>
      <p><b>${Object.entries(r.story.items).map(([k, v]) => `${ic(k)} ${v} ${nm(k)}`).join(' · ')}</b></p><p class="sub">New blueprint! Find it in Build, under Decor.</p>
      <button class="btn wide" data-act="closeModal">Amazing!</button>`);
  if (r.finished) setTimeout(() => { sfx.levelUp(); modal(`<div class="bigart">${regionArt(r.finished, 'bigimg')}</div><h2>${r.finished.name} explored!</h2>
      <p>Milo is very proud of himself. ${IMG('sprites/milo-sit.webp', '🐈', 'ai')}</p><p><b>🪙 ${fmtN(r.finished.reward.coins)} · ⏳ ${r.finished.reward.hg} · ${Object.entries(r.finished.reward.items).map(([k, v]) => ic(k) + ' ' + v).join(' ')}</b></p>
      <button class="btn wide" data-act="closeModal">Hooray!</button>`); }, r.story ? 0 : 300);
});

// ---------- freight train ----------
function stationSheet(o) {
  const st = G.trainState(o);
  if (st.status === 'away') return `<div style="font-size:48px;text-align:center">🛤️</div><p>The train is out on its route.</p>
    <p>Next train arrives in <b data-end="${st.arrive}">${fmtT(st.arrive - now())}</b></p><p class="sub">Trains stay for 45 minutes. Stock up on goods while you wait!</p>
    <br>${moveBtn(o)}`;
  const tr = st.train, all = tr.crates.every(c => c.filled), bonus = G.trainBonus(tr);
  return `<p>🚂 Departs in <b data-end="${tr.depart}">${fmtT(tr.depart - now())}</b></p>
    <p class="sub">Fill crates for coins and XP. Fill all ${tr.crates.length} and send the train off for a bonus: 🪙 ${fmtN(bonus.coins)} · ⏳ ${bonus.hg} · ${ic('planks')} ${bonus.planks} · ${ic('nails')} ${bonus.nails}</p>
    <div class="grid">${tr.crates.map((c, i) => `<div class="card" style="${c.filled ? 'background:#EEF7E2;border-color:#9CCB6E' : ''}">
      <div class="big">${c.filled ? '✅' : ic(c.id)}</div><div class="nm">${c.q}× ${nm(c.id)}</div>
      <div class="meta">🪙 ${fmtN(c.coins)} · ⭐ ${c.xp}</div>
      ${c.filled ? '<div class="meta">Loaded</div>' : `${req(c.id, c.q)}<button class="btn sm ${G.have(c.id) >= c.q ? '' : 'off'}" data-act="fillCrate" data-i="${i}">Load</button>`}</div>`).join('')}</div>
    <br>${all ? '<button class="btn gold wide" data-act="sendTrain">🚂 Send it off! Collect bonus</button>' : ''}
    <br>${moveBtn(o)}`;
}

// ---------- quests & townsfolk ----------
// reward as little chips: coins, XP, hourglasses, items
function rewardLine(r) {
  const parts = [];
  if (r.coins) parts.push(`<span class="chip">🪙 ${fmtN(r.coins)}</span>`);
  if (r.xp) parts.push(`<span class="chip">⭐ ${r.xp}</span>`);
  if (r.hg) parts.push(`<span class="chip">⏳ ${r.hg}</span>`);
  if (r.items) for (const k in r.items) parts.push(`<span class="chip">${art(k)} ${r.items[k]}</span>`);
  return `<span class="chips">${parts.join('')}</span>`;
}
function goalIcon(g) {
  const id = g.id || (g.key && g.key.includes(':') ? g.key.split(':')[1] : null);
  if (id && (ITEMS[id] || BUILD[id] || ANIMALS[id])) return art(id, 'gi');
  if (g.key && g.key.startsWith('pet')) return IMG(`sprites/${g.key.includes('milo') ? 'milo' : 'ollie'}.webp`, '🐈', 'gi');
  return ui('scroll', '•').replace('class="ui"', 'class="gi"');
}
function goalsHtml(q) {
  return q.goals.map((g, i) => {
    const p = Q.goalProgress(q, g), done = p >= g.n;
    return `<div class="goal ${done ? 'done' : ''}">${goalIcon(g)}<span class="gl">${g.label}</span>
      <div class="bar"><div style="width:${p / g.n * 100}%"></div></div><b class="gn">${done ? '✔' : `${p}/${g.n}`}</b>
      ${done ? '<span></span>' : `<button class="showme" data-act="showme" data-q="${q.id}" data-g="${i}" title="Show me where">Show me</button>`}</div>`;
  }).join('');
}
// first sentence or so of what they said, as a teaser on the card
const teaser = s => { const t = String(s || '').replace(/<[^>]+>/g, ''); const m = t.match(/^.{20,110}?[.!?](\s|$)/); return m ? m[0].trim() : t.slice(0, 100) + (t.length > 100 ? '…' : ''); };
function dailyHtml() {
  const d = Q.daily(); if (!d) return '';
  const p = PEOPLE[d.who], ok = G.hasAll(d.items);
  if (d.done) return `<div class="quest daily done"><div class="qh">${face(d.who)}<div class="grow"><div class="qkind">Daily favor</div><div class="qt">All done for today</div>
    <div class="qwho">${p.name} is grateful. A new favor comes tomorrow.</div></div></div></div>`;
  return `<div class="quest daily ${ok ? 'ready' : ''}"><span class="pin"></span><div class="qh">${face(d.who)}<div class="grow"><div class="qkind">Daily favor</div><div class="qt">${p.name} needs a hand</div></div></div>
    <div class="row reqs">${reqs(d.items)}</div>
    <div class="qfoot">${rewardLine({ coins: d.coins, xp: d.xp, hg: d.hg })}<span class="spacer"></span>
    <button class="btn ${ok ? 'gold' : 'off'}" data-act="claimDaily">Give</button></div></div>`;
}
let questTab = 'requests';
function questsSheet() {
  Q.refreshQuests();
  const projReady = E.PROJECTS.filter(p => E.projectOpen(p) && !E.projectDone(p) && E.canFundStage(p)).length;
  const setsReady = E.KEEPSAKE_SETS.filter(s => E.setComplete(s) && !E.setClaimed(s)).length;
  const chReady = CHAPTERS.filter(Q.chapterReady).length;
  const TABS = [['requests', 'Story', 'icon-scroll', Q.claimable().length + chReady], ['neighbors', 'Neighbors', 'icon-heart', 0], ['projects', 'Projects', 'icon-hammer', projReady],
    ['fair', 'Fair', 'icon-ribbon', E.fairClaimable() ? 1 : 0], ['album', 'Scrapbook', 'icon-quill', setsReady]];
  const tabs = `<div class="tabs">${TABS.map(([k, label, im, n]) => `<button class="tab ${questTab === k ? 'on' : ''}" data-act="qtab" data-tab="${k}">${IMG(`sprites/${im}.webp`, '', 'ti')}<span>${label}</span>${n ? `<i class="tcount">${n}</i>` : ''}</button>`).join('')}</div>`;
  return tabs + (questTab === 'projects' ? projectsHtml() : questTab === 'fair' ? fairHtml() : questTab === 'album' ? albumHtml() : questTab === 'neighbors' ? neighborsHtml() : requestsHtml());
}
// where you are in the story: chapter title, progress, and the chapter reward when it's done
function chapterHtml() {
  const ready = CHAPTERS.find(Q.chapterReady);
  const c = ready || Q.currentChapter(), done = Q.chapterDone(c), all = c.quests.length;
  if (Q.chapterClaimed(c) && !ready) return `<div class="chapter done"><div class="chapterhead">The story so far</div><b>All chapters complete!</b> More of Pelham Acres' story is on the way.</div>`;
  return `<div class="chapter ${ready ? 'ready' : ''}"><div class="row"><div class="grow"><div class="chapterhead">Chapter ${c.n}</div><div class="ctitle">${c.title}</div></div>
      ${face(c.who, 'oface')}</div>
    <div class="cbar"><div style="width:${done / all * 100}%"></div></div>
    <div class="row"><span class="sub" style="margin:0">${done} of ${all} stories finished · reward</span>${rewardLine(c.reward)}
    ${ready ? `<span class="spacer"></span><button class="btn gold" data-act="claimChapter" data-id="${c.id}">Finish chapter</button>` : ''}</div></div>`;
}
// everyone you've met, how close you are, and what each friendship unlocks
function neighborsHtml() {
  const met = Object.keys(PEOPLE).filter(Q.introduced);
  if (!met.length) return '<p class="sub">You haven\'t met anyone yet. Keep farming!</p>';
  return `<p class="sub">Help your neighbors (their orders, daily favors and stories) to grow your friendship. Every heart brings a thank-you gift; 3 and 5 hearts unlock a lasting perk.</p>` +
    met.map(pid => {
      const p = PEOPLE[pid], h = G.hearts(pid), pts = G.friendPoints(pid), next = G.HEART_AT[h], prev = h ? G.HEART_AT[h - 1] : 0;
      const pk = G.PERKS[pid];
      return `<div class="quest neighbor"><div class="qh">${face(pid)}<div class="grow"><div class="qt">${p.name}</div>${heartRow(pid, 'mid')}
        <div class="qwho">${p.blurb}</div></div></div>
        ${h < 5 ? `<div class="cbar thin"><div style="width:${(pts - prev) / (next - prev) * 100}%"></div></div><div class="sub" style="margin:4px 0 0">${next - pts} more to the next heart</div>` : '<div class="sub" style="margin:6px 0 0"><b>Best friends!</b></div>'}
        <div class="perks"><span class="${h >= 3 ? 'on' : ''}">3♥ ${pk.text[0]}</span><span class="${h >= 5 ? 'on' : ''}">5♥ ${pk.text[1]}</span></div></div>`;
    }).join('');
}
function projectsHtml() {
  return `<p class="sub">Big jobs the whole town pitches in on. Each takes three stages of coins and goods, and a finished project adds charm forever (better order rewards).</p>` +
    E.PROJECTS.map(p => {
      const st = E.projectStage(p), done = E.projectDone(p), open = E.projectOpen(p), stage = p.stages[st];
      const pips = p.stages.map((_, i) => `<span class="pip ${i < st ? 'on' : ''}"></span>`).join('');
      if (!open) return `<div class="soonrow">${IMG(`sprites/${p.art}.webp`, '', 'si')}<span class="nm">${p.name}</span><span class="spacer"></span><span class="lk">Level ${p.lvl}</span></div>`;
      return `<div class="quest project ${done ? 'done' : E.canFundStage(p) ? 'ready' : ''}">
        <div class="qh">${IMG(`sprites/${p.art}.webp`, '🏗️', 'face plain')}<div class="grow"><div class="qkind">Town project</div><div class="qt">${p.name}</div>
        <div class="pips">${pips}<span class="qwho">${done ? 'Complete!' : `Stage ${st + 1} of ${p.stages.length}`} · led by ${PEOPLE[p.who].name}</span></div></div></div>
        <div class="said">“${p.blurb}”</div>
        ${done ? `<div class="qfoot"><span class="chip">+${p.reward.charm} charm</span><span class="spacer"></span><b class="okline">✔ Finished</b></div>` : `
        <div class="row reqs"><span class="req ${G.S.coins >= stage.coins ? 'ok' : 'no'}">🪙 ${fmtN(stage.coins)}</span>${reqs(stage.items)}</div>
        <div class="qfoot"><span class="sub" style="margin:0">On completion:</span>${rewardLine({ hg: p.reward.hg, xp: p.reward.xp })}<span class="chip">+${p.reward.charm} charm</span><span class="spacer"></span>
        <button class="btn ${E.canFundStage(p) ? 'gold' : 'off'}" data-act="fund" data-id="${p.id}">Fund stage ${st + 1}</button></div>`}</div>`;
    }).join('');
}
function fairHtml() {
  if (G.S.level < 6) return `<div class="bigart">${ui('ribbon', '🎀').replace('class="ui"', 'class="bigimg"')}</div><p>Each season Pelham Acres holds a fair. Deliver in-season goods to win prizes.</p><p class="sub">The fair opens at level 6.</p>`;
  const f = E.fair(), se = G.season(), max = E.FAIR_TIERS[E.FAIR_TIERS.length - 1];
  const tiers = E.FAIR_TIERS.map((n, i) => {
    const pr = E.fairPrize(i), got = i < f.got, ready = !got && f.n >= n;
    return `<div class="tier ${got ? 'got' : ready ? 'ready' : ''}" style="left:${n / max * 100}%">${IMG('sprites/icon-ribbon.webp', '🎀', 'tr')}<b>${n}</b></div>`;
  }).join('');
  const claim = E.fairClaimable() ? `<div class="tierclaim">${rewardLine(E.fairPrize(f.got))}<button class="btn gold sm" data-act="claimFair">Claim prize ${f.got + 1}</button></div>` : '';
  return `<div class="fairhead">${ui(se.name.toLowerCase(), se.icon).replace('class="ui"', 'class="bigimg sm"')}<div><div class="qkind">This season</div><h3 style="margin:2px 0">${E.fairName()}</h3>
      <div class="sub" style="margin:0">Ends in ${fmtT(G.seasonEndsAt() - now()).replace(/ \d+s$/, '')}</div></div></div>
    <p>Deliver <b>in-season</b> goods in orders to fill the ribbon track. In season now: ${se.crops.map(c => `<span class="chip">${art(c)} ${CROPS[c].name}</span>`).join(' ')}</p>
    <div class="track"><div class="fill" style="width:${Math.min(100, f.n / max * 100)}%"></div>${tiers}</div>${claim}
    <p class="sub" style="text-align:center">${f.n} in-season goods delivered${f.got >= E.FAIR_TIERS.length ? ' · all prizes won this season!' : ''}</p>
    <div class="tierlist">${E.FAIR_TIERS.map((n, i) => `<div class="row"><b style="width:60px">Prize ${i + 1}</b><span class="sub" style="margin:0;width:70px">${n} goods</span>${rewardLine(E.fairPrize(i))}${i < f.got ? ' ✔' : ''}</div>`).join('')}</div>`;
}
function albumHtml() {
  return `<p class="sub">Little treasures turn up as you farm, pet the cats and explore. ${E.albumCount()} of 16 found.</p>` + E.KEEPSAKE_SETS.map(s => {
    const n = s.items.filter(E.hasKeepsake).length, done = E.setComplete(s), claimed = E.setClaimed(s);
    return `<div class="quest album ${done && !claimed ? 'ready' : ''}"><div class="row"><div class="grow"><div class="qt">${s.name}</div><div class="qwho">${s.hint}</div></div><b>${n}/4</b></div>
      <div class="kslots">${s.items.map(id => E.hasKeepsake(id) ? `<div class="ks got">${ksArt(id, 'ksimg')}<small>${E.KEEPSAKE_NAMES[id]}</small></div>` : `<div class="ks"><span>?</span><small>Not found yet</small></div>`).join('')}</div>
      <div class="qfoot">${rewardLine(s.reward)}<span class="spacer"></span>${claimed ? '<b class="okline">✔ Claimed</b>' : `<button class="btn ${done ? 'gold' : 'off'}" data-act="claimSet" data-id="${s.id}">Claim</button>`}</div></div>`;
  }).join('');
}
function requestsHtml() {
  const list = Q.activeQuests().slice().sort((a, b) => Q.isComplete(b) - Q.isComplete(a));
  if (!list.length) return chapterHtml() + dailyHtml() + '<p class="sub">No requests right now. Keep farming! New ones arrive as you level up.</p>';
  return chapterHtml() + dailyHtml() + list.map(q => {
    const p = PEOPLE[q.who], ready = Q.isComplete(q), fresh = !G.S.quests.active[q.id]?.seen;
    return `<div class="quest ${ready ? 'ready' : ''}">${fresh ? '<span class="ribbon">New</span>' : ''}
      <div class="qh">${face(q.who)}<div class="grow"><div class="qt">${q.title}</div><div class="qwho">${p.name}</div></div></div>
      <div class="said" data-act="showQuest" data-id="${q.id}">“${teaser(q.intro)}”</div>
      ${goalsHtml(q)}
      <div class="qfoot">${rewardLine(q.reward)}<span class="spacer"></span>
      ${ready ? `<button class="btn gold" data-act="claimQuest" data-id="${q.id}">Claim reward</button>` : `<button class="btn alt sm" data-act="showQuest" data-id="${q.id}">Read</button>`}</div></div>`;
  }).join('');
}
// a conversation card: big framed portrait, name plate, their words
const talkHead = (pid, sub) => `<div class="talkhead">${face(pid, 'portrait-img')}<div class="nameplate">${PEOPLE[pid].name}</div>${sub ? `<div class="sub" style="margin:6px 0 0">${sub}</div>` : ''}</div>`;
function questIntro(q) {
  Q.markSeen(q.id);
  sfx.open();
  modal(`${talkHead(q.who, q.title)}
    <div class="say">${q.intro}</div><div class="goals">${goalsHtml(q)}</div>
    <div class="rewardrow"><span class="sub" style="margin:0">Reward</span>${rewardLine(q.reward)}</div>
    <button class="btn wide" data-act="closeModal">I'm on it!</button>`);
}
function claimQuest(id) {
  const q = Q.claim(id);
  if (!q) { sfx.error(); toast('Not finished yet'); return; }
  const p = PEOPLE[q.who];
  sfx.deliver();
  closeSheet();
  modal(`${talkHead(q.who, `✔ ${q.title}`)}
    <div class="say">${q.outro}</div><div class="rewardrow"><span class="sub" style="margin:0">You got</span>${rewardLine(q.reward)}</div>
    ${q.flag === 'expedition' ? '<p class="sub">🗺️ The Explore button now shows the old map!</p>' : ''}
    ${q.flag === 'ollieBench' ? '<p class="sub">🪑 Ollie will nap on your bench now.</p>' : ''}
    <button class="btn wide" data-act="closeModal">Wonderful!</button>`);
  G.save(); refreshHud();
}
function talkTo(person) {
  const def = PEOPLE[person.id];
  const ready = Q.questsFor(person.id).find(Q.isComplete);
  if (ready) return claimQuest(ready.id);
  const act = Q.questsFor(person.id)[0];
  if (act) return questIntro(act);
  sfx.tap();
  const lines = ['Lovely day for it, isn\'t it?', 'The town looks better every day, thanks to you.', `Have you met Ollie? Biggest cat I've ever seen.`, 'Milo zoomed past me three times this morning!', 'Keep up the good work, farmer!'];
  modal(`${talkHead(person.id, def.blurb)}
    <div class="say">${lines[Math.floor(Math.random() * lines.length)]}</div><button class="btn wide" data-act="closeModal">Bye for now</button>`);
}
function questTick() {
  const started = Q.refreshQuests();
  if (started.length) G.save();
  for (const p of people) {
    p.visible = Q.introduced(p.id);
    const mine = Q.questsFor(p.id);
    p.badge = mine.some(Q.isComplete) ? '✓' : mine.some(q => !G.S.quests.active[q.id].seen) ? '!' : null;
  }
  const b = $('#questBadge'), n = Q.claimable().length + Q.unseen().length + E.extrasNotice() + CHAPTERS.filter(Q.chapterReady).length;
  b.hidden = !n; b.textContent = n;
  if ($('#modal').hidden && !levelQueue.length && !inTutorial()) { const u = Q.unseen()[0]; if (u) questIntro(u); }
  tutTick();
  applyGuide();
}

// ---------- first-play tour: Mayor Hattie walks you through the basics by doing them ----------
// G.S.tut is the step number while the tour runs (missing on older farms = never shown).
const TUT_END = 99;
const inTutorial = () => G.S.tut != null && G.S.tut < TUT_END;
const harvestTotal = () => Object.entries(G.S.stats || {}).reduce((s, [k, v]) => s + (k.startsWith('harvest:') ? v : 0), 0);
const sheetTitle = () => !$('#sheet').classList.contains('open') ? '' : $('#sheetTitle').textContent;
let tutLast = '';
// what Hattie says right now, what to point at, and whether this step is finished
function tutStep() {
  const S = G.S, step = S.tut;
  const fields = S.objs.filter(o => o.t === 'field');
  if (step === 0) return { say: "Welcome to Pelham Acres! I'm Mayor Hattie. Let me show you around the farm. It only takes a minute.", btn: ['tutNext', 'Show me around'] };
  if (step === 1) {
    const planted = fields.some(o => o.crop);
    if (planted && !view.plantCrop) return { done: true };
    if (view.plantCrop) return { say: 'Now drag your finger across the empty fields to plant them all. Tap <b>Done</b> when you\'re finished.' };
    if (sheetTitle() === 'Plant a crop') return { say: 'Pick <b>Wheat</b>. It grows fast, and everyone in town needs it.' };
    return { say: "Let's grow something! Tap one of the empty fields.", obj: fields.find(o => !o.crop) };
  }
  if (step === 2) {
    if (harvestTotal() > (S.tutBase || 0)) return { done: true };
    const ripe = fields.find(o => o.crop && G.fieldReady(o));
    if (ripe) return { say: 'Your crop is ripe! Tap it, or drag across all the fields to harvest them in one go.', obj: ripe };
    return { say: "I asked the sun to hurry this first batch along. It'll be ready in a few seconds…", obj: fields.find(o => o.crop) };
  }
  if (step === 3) {
    const mill = G.findObj('feedMill');
    if (!mill || mill.jobs.length || G.getStat('make:chickenFeed') > (S.tutBase || 0)) return { done: true };
    if (sheetTitle() === BUILD.feedMill.name) return { say: 'Tap <b>Chicken Feed</b> to start a batch. It uses wheat and corn from your barn.' };
    return { say: 'Your harvest goes into the barn. Now let\'s turn it into something useful. Tap the <b>Feed Mill</b>.', obj: mill };
  }
  if (step === 4) {
    if ((S.delivered || 0) > (S.tutBase || 0)) return { done: true };
    const can = G.readyOrders() > 0;
    if (sheetTitle() === 'Orders') return can ? { say: 'Find an order with every item ticked green, then tap <b>Deliver</b>.' }
      : { say: "You can't fill an order just yet. That's alright! Grow a little more and come back to them later.", btn: ['tutNext', 'Got it'] };
    return { say: 'Townsfolk post orders for things they need. Tap <b>Orders</b>. Every delivery pays coins and makes you a friend.', tb: 'orders' };
  }
  return { say: "That's the farm in a nutshell! Whenever you're not sure what to do next, read the hint at the bottom of the screen. The yellow arrow points the way. See you in town!", btn: ['tutDone', 'Thanks, Hattie!'] };
}
function tutAdvance() {
  const S = G.S;
  S.tut++;
  if (S.tut === 2) {
    // the very first crop grows in seconds, so the tour doesn't stall
    for (const o of S.objs) if (o.t === 'field' && o.crop && o.end - now() > 12000) { o.start = now(); o.end = now() + 12000; }
    S.tutBase = harvestTotal();
  } else if (S.tut === 3) S.tutBase = G.getStat('make:chickenFeed');
  else if (S.tut === 4) {
    S.tutBase = S.delivered || 0;
    // make sure there's an order a brand-new farmer can actually fill: Hattie wants some of that first wheat
    const w = G.have('wheat');
    if (!G.readyOrders() && w > 0) S.orders[0] = { who: 'The Mayor', pid: 'hattie', why: 'is baking you a welcome-to-town pie', items: { wheat: Math.min(3, w) }, rush: 0, coins: 25, xp: 5 };
  }
  sfx.collect(); haptic();
  G.save(); tutTick();
}
function tutTick() {
  const el = $('#coach');
  if (!inTutorial()) { if (!el.hidden) { el.hidden = true; tutLast = ''; } return; }
  let st = tutStep();
  if (st.done) { tutAdvance(); return; }
  const n = G.S.tut, total = 5;
  const html = `${IMG('sprites/p-hattie.webp', '👩‍🦳', 'coachface')}<div class="coachbody">
    <div class="coachname">Mayor Hattie <span class="coachstep">${n ? `${Math.min(n, total)} of ${total}` : ''}</span></div>
    <div class="coachsay">${st.say}</div>
    <div class="coachbtns">${st.btn ? `<button class="btn sm" data-act="${st.btn[0]}">${st.btn[1]}</button>` : ''}
    ${n < 5 ? '<button class="linkbtn" data-act="tutDone">Skip the tour</button>' : ''}</div></div>`;
  if (html !== tutLast) {
    el.innerHTML = html; tutLast = html; el.hidden = false;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  }
  tutGuide = st.obj ? { text: '', obj: st.obj } : st.tb ? { text: '', tb: st.tb } : null;
}
let tutGuide = null;
function tutDone() {
  G.S.tut = TUT_END; tutGuide = null; tutTick(); sfx.close(); G.save(); applyGuide();
}
function tutReplay() {
  closeSheet(); G.S.tut = 0; G.S.tutBase = 0; tutTick(); applyGuide();
}
$('#coach').addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a) act(a); });

// ---------- guidance: an arrow + hint for the next step of your quests ----------
function makerOf(item) {
  for (const b in RECIPES) if (RECIPES[b].some(r => r.out === item)) return b;
  for (const b in BUILD) if (BUILD[b].kind === 'pen' && ANIMALS[BUILD[b].animal].product === item) return b;
  return null;
}
function nearestObstacle() {
  let best = null, bd = 1e9;
  for (const o of G.S.objs) if (BUILD[o.t].kind === 'obstacle') { const d = Math.hypot(o.x - 14, o.y - 13); if (d < bd) { bd = d; best = o; } }
  return best;
}
function guideForItem(item, verb) {
  if (CROPS[item]) {
    const ready = G.S.objs.find(o => o.t === 'field' && o.crop === item && G.fieldReady(o));
    if (ready) return { text: `Tap the ripe ${nm(item).toLowerCase()} to harvest it`, obj: ready };
    const growing = G.S.objs.find(o => o.t === 'field' && o.crop === item);
    const empty = G.S.objs.find(o => o.t === 'field' && !o.crop);
    if (empty) return { text: `Tap an empty field and plant ${nm(item).toLowerCase()}`, obj: empty };
    if (growing) return { text: `Your ${nm(item).toLowerCase()} is growing. Check back soon!`, obj: growing };
    return { text: 'All fields are busy. Add another field from Build', tb: 'shop' };
  }
  const b = makerOf(item);
  if (!b) return { text: `${verb} ${nm(item)}` };
  const o = G.findObj(b);
  if (!o) return { text: `Build a ${BUILD[b].name} (tap Build, ${BUILD[b].cat} tab)`, tb: 'shop' };
  if (BUILD[b].kind === 'pen') return { text: o.animals.length ? `Feed your ${G.penAnimal(o).name.toLowerCase()}s and collect ${nm(item).toLowerCase()}` : `Tap the ${BUILD[b].name} and buy an animal`, obj: o };
  return { text: `${verb} ${nm(item)} at the ${BUILD[b].name}`, obj: o };
}
function guideFor(q, g) {
  if (g.type === 'have') return guideForItem(g.id, 'Make');
  if (g.type === 'own') return G.count(g.id) ? null : { text: `Build a ${BUILD[g.id].name} (tap Build, ${BUILD[g.id].cat} tab)`, tb: 'shop' };
  if (g.type === 'animals') { const pen = Object.keys(BUILD).find(b => BUILD[b].animal === g.id); const o = G.findObj(pen); return o ? { text: `Tap the ${BUILD[pen].name} and buy more ${g.id}s`, obj: o } : { text: `Build a ${BUILD[pen].name} (tap Build, Animals tab)`, tb: 'shop' }; }
  if (g.type !== 'stat') return { text: g.label };
  const [k, arg] = g.key.split(':');
  switch (k) {
    case 'harvest': return guideForItem(arg, 'Grow');
    case 'make': return guideForItem(arg, 'Make');
    case 'deliver': return { text: 'Open Orders and deliver goods to the townsfolk', tb: 'orders' };
    case 'crate': { const o = G.findObj('station'); return o ? { text: 'Load crates onto the freight train', obj: o } : { text: 'Build the Train Station', tb: 'shop' }; }
    case 'rent': { const o = G.S.objs.find(x => BUILD[x.t].kind === 'house'); return o ? { text: 'Tap houses to collect rent when coins appear', obj: o } : { text: 'Build a Cottage', tb: 'shop' }; }
    case 'clear': { const o = nearestObstacle(); return o ? { text: 'Tap a tree or rock to clear it', obj: o } : null; }
    case 'upgrade': return { text: 'Open any building and tap Upgrade' };
    case 'star': return { text: 'Keep harvesting the same crop to earn a mastery star' };
    case 'pet': { const c = cats.find(c => c.id === arg); return { text: `Find ${c.name} and give him a pet`, walker: c }; }
    case 'explore': case 'ruin': return { text: 'Tap Explore to head out with Milo', tb: 'explore' };
  }
  return { text: g.label };
}
// "Show me" / "where do I get this?": close the panel, point the hint arrow at the right place and look there
function goTo(g, label) {
  if (!g) { toast(`${label || 'That'} is already done!`); return; }
  closeSheet(); closeModal();
  view.pinGuide = { ...g, until: now() + 90000 };
  const tgt = g.obj ? { x: g.obj.x + BUILD[g.obj.t].w / 2, y: g.obj.y + BUILD[g.obj.t].h / 2 } : g.walker ? { x: g.walker.x, y: g.walker.y } : null;
  if (tgt) centerOn(tgt.x, tgt.y);
  sfx.tap(); applyGuide();
  toast(g.text);
}
function computeGuide() {
  if (inTutorial()) return tutGuide;
  if (view.pinGuide && view.pinGuide.until > now()) return view.pinGuide;
  view.pinGuide = null;
  if (G.S.settings.hints === false) return null;
  const ready = Q.claimable()[0];
  if (ready) { const p = people.find(x => x.id === ready.who); return { text: `${PEOPLE[ready.who].name} has a reward for you. Tap them!`, walker: p }; }
  for (const q of Q.activeQuests()) for (const g of q.goals) if (Q.goalProgress(q, g) < g.n) { const r = guideFor(q, g); if (r) return { ...r, quest: q }; }
  return null;
}
function applyGuide() {
  const g = computeGuide();
  view.guide = g && (g.obj || g.walker) ? g : null;
  const h = $('#hint');
  if (!g || view.ghost || view.plantCrop || inTutorial()) { h.hidden = true; }
  else { h.hidden = false; setHTML(h, ui('bulb', '💡') + ' ' + esc(g.text)); }
  document.querySelectorAll('.tb').forEach(b => b.classList.toggle('pulse', !!g && g.tb === b.dataset.tb));
}
$('#hint').addEventListener('click', () => { sfx.tap(); openSheet('Quests', questsSheet); $('#sheetTitle').dataset.k = 'quests'; });

function masteryList() {
  const rows = [];
  for (const k in CROPS) if (CROPS[k].lvl <= G.S.level) rows.push(['crop', k]);
  for (const b in RECIPES) if (G.count(b)) for (const r of RECIPES[b]) if (r.lvl <= G.S.level) rows.push(['recipe', r.out]);
  return `<p class="sub">Every ★: ${MASTERY_PERKS.map((p, i) => `${i + 1}★ ${p}`).join(' · ')}</p><div class="inv">` +
    rows.map(([kind, id]) => `<div class="invrow"><span class="ic">${ic(id)}</span><div><div class="n">${nm(id)}</div><div class="nm">${starStr(kind, id)} ${masteryLine(kind, id)}</div></div></div>`).join('') + '</div>';
}
function exploreSheet() {
  if (G.S.level < 5 && !Q.hasFlag('expedition')) return `<div class="bigart">${exArt('pine', '🌲', 'bigimg')}</div><p>The woods beyond the farm are thick and wild, and nobody in town has a map.</p>
    <p class="sub">Exploring unlocks around level 5. Keep an eye on Milo...</p>`;
  if (!Q.hasFlag('expedition')) return `<div class="bigart">${exArt('pine', '🌲', 'bigimg')}</div><p>The woods beyond the farm are thick and wild, and nobody in town has a map.</p>
    <p class="sub">Grandma Ellis says Milo keeps disappearing past the tree line. Maybe he knows something. (Unlocks through the quest "Where Does Milo Go?")</p>`;
  return `<div style="font-size:48px;text-align:center">🗺️</div><p>Beyond the tree line lie the hills and hollows around Pelham Acres.
    The expedition map — with fog to uncover, rare materials, and hidden treasures — arrives in the next update.</p>
    <p class="sub">Until then, clear trees and rocks around your farm to find wood and stone.</p>`;
}

document.querySelectorAll('[data-tb]').forEach(btn => btn.addEventListener('click', () => {
  endPlant(); if (view.ghost) cancelPlace();
  const k = btn.dataset.tb;
  if (k === 'explore' && Q.hasFlag('expedition')) { openExpedition(); return; }
  if (sheetFn && $('#sheetTitle').dataset.k === k) { closeSheet(); $('#sheetTitle').dataset.k = ''; return; }
  ({ shop: () => openSheet('Build', shopSheet), quests: () => openSheet('Quests', questsSheet), orders: () => openSheet('Orders', ordersSheet), barn: () => openSheet('Barn', barnSheet),
     explore: () => openSheet('Explore', exploreSheet), menu: () => openSheet('Menu', menuSheet) })[k]();
  $('#sheetTitle').dataset.k = k;
}));

// ---------- touch / mouse input ----------
const cv = $('#game');
const pts = new Map();
let gest = null;
const tileAt = (sx, sy) => { const w = s2w(sx, sy); return { x: Math.floor(w.x), y: Math.floor(w.y) }; };

cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId);
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.size === 2) {
    const [a, b] = [...pts.values()];
    gest = { mode: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    return;
  }
  if (pts.size > 2) return;
  const tl = tileAt(e.clientX, e.clientY), o = G.objAt(tl.x, tl.y), g = view.ghost;
  gest = { mode: 'pan', sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: false, last: `${tl.x},${tl.y}` };
  if (g) {
    const b = BUILD[g.t];
    if (tl.x >= g.x && tl.x < g.x + b.w && tl.y >= g.y && tl.y < g.y + b.h) { gest.mode = 'ghost'; gest.ox = tl.x - g.x; gest.oy = tl.y - g.y; }
  } else if (view.plantCrop && o && o.t === 'field' && !o.crop) {
    gest.mode = 'plant'; tryPlant(o); refreshHud();
  } else if (o && o.t === 'field' && G.fieldReady(o)) {
    gest.mode = 'harvest'; harvestField(o); refreshHud();
  }
});
cv.addEventListener('pointermove', e => {
  if (!pts.has(e.pointerId)) return;
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!gest) return;
  if (gest.mode === 'pinch' && pts.size >= 2) {
    const [a, b] = [...pts.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    cam.x += mx - gest.mx; cam.y += my - gest.my;
    zoomAt(mx, my, d / gest.d);
    gest.d = d; gest.mx = mx; gest.my = my;
    return;
  }
  const dx = e.clientX - gest.lx, dy = e.clientY - gest.ly;
  if (Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy) > 8) gest.moved = true;
  gest.lx = e.clientX; gest.ly = e.clientY;
  const tl = tileAt(e.clientX, e.clientY), key = `${tl.x},${tl.y}`;
  if (gest.mode === 'pan') { if (gest.moved) { cam.x += dx; cam.y += dy; clampCam(); } return; }
  if (key === gest.last) return;
  gest.last = key;
  const o = G.objAt(tl.x, tl.y);
  if (gest.mode === 'ghost') {
    const g = view.ghost, nx = tl.x - gest.ox, ny = tl.y - gest.oy;
    if (nx !== g.x || ny !== g.y) {   // snapped onto a new square: a soft tick, and a buzz when it turns from red to green
      const was = g.ok; g.x = nx; g.y = ny; updateGhost(); sfx.tick();
      if (g.ok && !was) haptic();
    }
  }
  else if (gest.mode === 'plant' && o && o.t === 'field' && !o.crop && view.plantCrop) { tryPlant(o); refreshHud(); }
  else if (gest.mode === 'harvest' && o && o.t === 'field' && G.fieldReady(o)) { if (!harvestField(o)) gest.mode = 'done'; refreshHud(); }
});
function endPointer(e) {
  if (!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if (!gest) return;
  if (gest.mode === 'pinch') { if (pts.size === 0) gest = null; else gest = { mode: 'none' }; return; }
  if (gest.mode === 'pan' && !gest.moved && performance.now() - gest.t < 600 && e.type === 'pointerup') onTap(e.clientX, e.clientY);
  if (gest.mode === 'plant' || gest.mode === 'harvest') G.save();
  gest = null;
  setTimeout(showLevelUps, 300);
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

function onTap(sx, sy) {
  if (view.ghost) return;
  const o = hit(sx, sy);
  if (view.plantCrop) {
    if (o && o.t === 'field' && !o.crop) { tryPlant(o); refreshHud(); return; }
    endPlant();
  }
  if (!o) { closeSheet(); return; }
  tapObject(o);
  G.save(); refreshHud();
}

// ---------- boot ----------
function afterLoad() { lastCoins = null; G.refreshOrders(); cam.z = innerWidth < 600 ? 0.8 : 1; centerOn(14, 13); refreshHud(); }
initRender(cv);
loadSprites();
setCatGrid(G.objAt, c => {
  if (c.id !== 'ollie' || !Q.hasFlag('ollieBench')) return null;
  const b = G.findObj('bench'); return b ? { x: b.x + 0.5, y: b.y + 0.55 } : null;
});
setPeople(PEOPLE);
// Each townsperson's day: the kinds of places they work at, and the icon shown while they're busy there.
const ROUTINES = {
  hattie: { townHall: 'scroll', fountain: 'heart', gazebo: 'blossom', bandstand: 'ribbon', clockTower: 'hourglass', cottage: 'mail', farmhouse: 'mail', townhouse: 'mail', generalStore: 'basket', schoolhouse: 'journal' },
  joe:    { field: 'fertilizer', coop: 'egg', cowshed: 'milk', sheepfold: 'wool', feedMill: 'chickenFeed', barn: 'crate' },
  dottie: { bakery: 'bread', dairy: 'butter', sugarMill: 'brownSugar', coop: 'egg', kitchen: 'strawberryJam', cafe: 'cookies' },
  tom:    { workshop: 'gear', tree: 'axe', rock: 'pickaxe', fence: 'planks', station: 'nails', bench: 'nails', schoolhouse: 'planks' },
  rosa:   { cafe: 'coffeeCup', kitchen: 'tomatoSauce', cottage: 'mail', farmhouse: 'mail', townhouse: 'mail', pond: 'heart', flowers: 'blossom', generalStore: 'basket' },
  finch:  { generalStore: 'coin', station: 'crate', barn: 'journal', townHall: 'scroll', loom: 'cottonFabric', bakery: 'bread' },
  ellis:  { bench: 'heart', flowers: 'blossom', pond: 'heart', hedge: 'blossom', coop: 'chickenFeed', loom: 'yarn', gazebo: 'blossom' },
};
setErrands(id => {
  const r = ROUTINES[id]; if (!r) return [];
  const byType = {};
  for (const o of G.S.objs) if (r[o.t]) (byType[o.t] ||= []).push(o);
  const out = [];
  for (const t in byType) {
    const list = byType[t], b = BUILD[t];
    // a few of the many fields/trees, so big farms don't crowd out everything else
    for (const o of list.sort(() => Math.random() - 0.5).slice(0, 2)) out.push({ key: t + o.x + ',' + o.y, x: o.x, y: o.y, w: b.w, h: b.h, icon: r[t] });
  }
  if (id === 'ellis') { const c = cats[Math.floor(Math.random() * 2)]; out.push({ key: 'cat', x: Math.floor(c.x), y: Math.floor(c.y), w: 1, h: 1, icon: 'heart' }); }
  return out;
});
const loaded = G.load();
if (!loaded) { G.newGame(); G.save(); }
afterLoad();
initAudio(G.S.settings);
function refreshSoundBtn() {
  const st = G.S.settings, on = (st.music || st.sfx);
  const b = $('#soundBtn'); b.innerHTML = on ? ui('sound', '🔊') : ui('mute', '🔇'); b.classList.toggle('off', !on);
}
$('#soundBtn').addEventListener('click', () => {
  const st = G.S.settings, on = !(st.music || st.sfx);
  st.music = on; st.sfx = on; setMusic(on); setSfx(on);
  refreshSoundBtn(); G.save();
  if (on) { sfx.collect(); toast('Sound on 🎵'); } else toast('Sound off');
});
refreshSoundBtn();
if (!loaded) {
  G.S.tut = 0; G.save();   // brand-new farm: Mayor Hattie's tour starts
} else {
  const away = now() - (G.S.saved || now());
  if (away > 120000) setTimeout(() => showAway(away), 700);
}
// signed-in players: check whether the cloud has a newer farm (e.g. played on another device)
if (C.cloudEnabled() && location.hash.length > 1) {
  // arrived from the email's sign-in link
  C.consumeRedirect().then(u => { if (u) { toast(`Signed in as ${u.email} ☁️`); return cloudCheck(true); } })
    .catch(e => toast(`Sign-in link: ${e.message}. Try sending a new one from Menu → Cloud save.`));
} else if (C.cloudEnabled() && C.signedIn()) setTimeout(() => cloudCheck(false).catch(() => {}), 1500);
// ---------- "Today on the farm": a little summary at sunset ----------
function todayLog() {
  const S = G.S, d = dayKey();
  if (!S.today || S.today.day !== d) S.today = { day: d, harvest: 0, make: 0, deliver: 0, build: 0, fed: 0, coins: 0, people: [] };
  return S.today;
}
G.hooks.onStat = (k, n = 1) => {
  const T = todayLog();
  if (k.startsWith('harvest:')) T.harvest += n;
  else if (k.startsWith('make:')) T.make += n;
  else if (k === 'deliver') T.deliver++;
  else if (k === 'build') T.build++;
  else if (k === 'feed') T.fed += n;
};
var lastCoins = null;   // var: afterLoad() resets it during boot, before this line has run
function trackCoins() {   // coins earned today = every rise in the purse (spending doesn't count against it)
  const c = G.S.coins;
  if (lastCoins != null && c > lastCoins) todayLog().coins += c - lastCoins;
  lastCoins = c;
}
const hourNow = () => view.debugHour != null ? view.debugHour : new Date().getHours() + new Date().getMinutes() / 60;
function sunsetCheck() {
  const S = G.S, h = hourNow(), T = todayLog();
  if (h < 19.5 || S.recapDay === T.day || inTutorial() || !$('#modal').hidden || levelQueue.length || view.ghost || sheetFn) return;
  if (T.harvest + T.make + T.deliver + T.build + T.fed < 3) return;   // barely played today: no need
  S.recapDay = T.day; G.save();
  showRecap(T);
}
function showRecap(T) {
  const line = (ic, txt) => `<div>${ic}<span>${txt}</span></div>`, pl = (n, w) => `${fmtN(n)} ${w}${n === 1 ? '' : 's'}`;
  const rows = [];
  if (T.harvest) rows.push(line(ui('field', '🌾'), `Harvested <b>${pl(T.harvest, 'crop')}</b>`));
  if (T.make) rows.push(line(ui('gear', '⚙️'), `Made <b>${pl(T.make, 'good')}</b> in your workshops and pens`));
  if (T.fed) rows.push(line(ui('heart', '❤️'), `Fed <b>${pl(T.fed, 'hungry animal')}</b>`));
  if (T.deliver) rows.push(line(ui('mail', '✉️'), `Delivered <b>${pl(T.deliver, 'order')}</b>${T.people.length ? ` to ${esc(listJoin(T.people.slice(0, 4)))}${T.people.length > 4 ? ' and more' : ''}` : ''}`));
  if (T.build) rows.push(line(ui('hammer', '🔨'), `Built <b>${pl(T.build, 'new thing')}</b>`));
  if (T.coins) rows.push(line(ui('coin', ''), `Earned <b>${fmtN(T.coins)} coins</b>`));
  const close = ['Ollie has already claimed the warmest spot by the stove.', 'Milo is finally, finally sitting still.', 'The crickets are tuning up for the evening.', 'The lamps are coming on all over town.'];
  sfx.open();
  modal(`<div class="recapart"><img src="icons/share.jpg" alt=""></div><h2>Today on the farm</h2>
    <div class="awaylist recap">${rows.join('')}</div>
    <p class="sub">${close[new Date().getDate() % close.length]} Pelham Acres had a good day.</p>
    <button class="btn wide" data-act="closeModal">Goodnight, Pelham Acres</button>`);
}
const listJoin = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

// ---------- "While you were away" ----------
// Everything that finished while the game was closed, with one button to gather the simple pickups.
function readyReport() {
  const t = now(), r = { items: {}, rent: 0, n: 0, train: false, orders: G.readyOrders() };
  const add = (id, n) => { r.items[id] = (r.items[id] || 0) + n; r.n += n; };
  for (const o of G.S.objs) {
    const b = BUILD[o.t];
    if (b.kind === 'field' && o.crop && o.end <= t) add(o.crop, CROP_YIELD);
    else if (b.kind === 'producer') for (const j of o.jobs) { if (j.end <= t) add(j.out, j.n); }
    else if (b.kind === 'pen') { const a = G.penAnimal(o); for (const an of o.animals) if (G.animalState(an) === 'ready') add(a.product, 1); }
    else if (b.kind === 'house') r.rent += G.rentDue(o) * G.rentOf(o);
    else if (b.kind === 'station' && G.trainState(o).status === 'here') r.train = true;
  }
  r.energyFull = Q.hasFlag('expedition') && X.energy() >= X.ENERGY.max;
  return r;
}
function showAway(ms) {
  if (!$('#modal').hidden) return;
  const r = readyReport();
  if (!r.n && !r.rent && !r.train && !r.orders) { toast(`Welcome back! You were away ${fmtT(ms)}.`); return; }
  const chips = Object.entries(r.items).map(([k, n]) => `<span class="chip">${art(k)} ${n}</span>`).join('') + (r.rent ? `<span class="chip">🪙 ${fmtN(r.rent)} rent</span>` : '');
  const lines = [];
  if (r.orders) lines.push(`${ui('mail', '')} ${r.orders} order${r.orders > 1 ? 's are' : ' is'} ready to deliver`);
  if (r.train) lines.push(`${ui('train', '')} The freight train is waiting at the station`);
  if (r.energyFull) lines.push(`${ui('energy', '')} Your exploring energy is full`);
  sfx.open();
  modal(`<div class="bigart">${IMG('sprites/ollie-sleep.webp', '🐈', 'bigimg')}</div><h2>Welcome back!</h2>
    <p class="sub">You were away ${fmtT(ms)}. Ollie kept an eye on things.</p>
    ${chips ? `<b>Ready to collect</b><div class="rewardrow">${`<span class="chips">${chips}</span>`}</div>` : ''}
    ${lines.length ? `<div class="awaylist">${lines.map(l => `<div>${l}</div>`).join('')}</div>` : ''}
    ${r.n || r.rent ? '<button class="btn gold wide" data-act="collectAll">Collect everything</button><div style="height:8px"></div>' : ''}
    <button class="btn alt wide" data-act="closeModal">I'll look around</button>`);
}
// gather every ready crop, good, animal product and rent payment in one go
function collectAll() {
  let items = 0, coins = 0, full = false;
  for (const o of G.S.objs) {
    const k = BUILD[o.t].kind;
    if (k === 'field' && o.crop && o.end <= now()) { const r = G.harvest(o); if (r === 'full') { full = true; break; } if (r) items += r.n; }
    else if (k === 'producer') { const r = G.collectJobs(o); items += r.got.reduce((s, j) => s + j.n, 0); if (r.full) { full = true; break; } }
    else if (k === 'pen') { const r = G.collectAnimals(o); items += r.got; G.feedAll(o); if (r.full) { full = true; break; } }
    else if (k === 'house') coins += G.collectRent(o);
  }
  if (items || coins) sfx.collect();
  closeModal();
  toast(`Collected ${items} item${items === 1 ? '' : 's'}${coins ? ` and ${fmtN(coins)} 🪙` : ''} and fed your animals${full ? ' · the barn is full!' : ''}`);
  G.save(); refreshHud(); setTimeout(showLevelUps, 400);
}
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = now();
  else if (hiddenAt && now() - hiddenAt > 120000) setTimeout(() => showAway(now() - hiddenAt), 400);
});

// Battery saver: full 60fps while you're touching/panning (and for 4s after), 30fps when just watching,
// and no farm drawing at all while the full-screen expedition map covers it.
let lastInput = 0, lastDraw = 0;
for (const ev of ['pointerdown', 'pointermove', 'wheel', 'keydown']) addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true });
function frame(ts) {
  requestAnimationFrame(frame);
  if (!$('#exp').hidden) return;
  const busy = ts - lastInput < 4000;
  if (!busy && ts - lastDraw < 30) return;
  lastDraw = ts;
  draw();
}
requestAnimationFrame(frame);
// started fine: stand down the start-up safety net
window.__booted = true; { const bf = document.getElementById('bootFail'); if (bf) bf.hidden = true; }
// loading screen: fill the bar as the pictures arrive, then fade away (at most ~5s, at least a moment to see it)
{
  const sp = $('#splash'), bar = $('#splashBar'), msg = $('#splashMsg'), t0 = performance.now();
  const lines = ['Waking up Ollie…', 'Milo is doing zoomies…', 'Watering the wheat…', 'Ringing the town bell…', 'Feeding the chickens…'];
  let li = 0;
  const msgT = setInterval(() => { li = (li + 1) % lines.length; msg.textContent = lines[li]; }, 900);
  const step = () => {
    const p = spriteProgress(), el = performance.now() - t0;
    bar.style.width = Math.max(8, Math.round(p * 100)) + '%';
    if ((p >= 0.97 && el > 600) || el > 5000) {
      bar.style.width = '100%'; clearInterval(msgT);
      setTimeout(() => { sp.classList.add('gone'); setTimeout(() => sp.remove(), 700); }, 200);
      return;
    }
    setTimeout(step, 120);
  };
  if (sp) step();
}
setInterval(() => { refreshHud(); liveUpdate(); trackCoins(); if ($('#exp').hidden) questTick(); else updateEnergy(); }, 500);
setInterval(() => { if (!$('#exp').hidden) return; planNap(); sunsetCheck(); }, 5000);
setInterval(() => G.save(), 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });
addEventListener('pagehide', () => G.save());

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
