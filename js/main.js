// Pelham Acres — input, menus, and the game loop.
import { BUILD, CROPS, ITEMS, PRODUCTS, RECIPES, ANIMALS, MATS, SHOP_CATS, VALUE, xpFor, unlocksAt, CROP_YIELD, DECOR_CHARM_CAP, MASTERY, MASTERY_PERKS, NO_ORDER } from './data.js';
import * as G from './game.js';
import { initAudio, sfx, setMusic, setSfx, audioRunning } from './audio.js';
import * as Q from './quests.js';
import { PEOPLE, QUEST_BY_ID } from './story.js';
import * as X from './expedition.js';
import * as E from './extras.js';
import * as C from './cloud.js';
export const APP_VERSION = '0.19';
import { loadSprites } from './render.js';
import { cam, view, initRender, draw, centerOn, s2w, zoomAt, clampCam, hit, floater, screenSize, cats, setCatGrid, catGo, people, setPeople, setErrands } from './render.js';

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
  if (BUILD[id]) return IMG(BUILD_SPR.has(id) ? `sprites/${id}.webp` : `sprites/icon-${id}.webp`, BUILD[id].icon, cls);
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

// ---------- toast / modal ----------
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200); }
function modal(html) { $('#modalCard').innerHTML = paint(html); $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a) { act(a); } else if (e.target.id === 'modal') closeModal(); });

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
  const un = unlocksAt(L);
  sfx.levelUp();
  modal(`<div style="font-size:54px">🎉</div><h2>Level ${L}!</h2><p class="sub">+${L * 15} 🪙 &nbsp; +2 ⏳</p>
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
const req = (id, n) => `<span class="req ${G.have(id) >= n ? 'ok' : 'no'}">${icH(id)} ${G.have(id)}/${n}</span>`;
const reqs = r => Object.entries(r).map(([k, v]) => req(k, v)).join(' ');

// ---------- HUD ----------
function refreshHud() {
  const S = G.S;
  $('#lvl').textContent = S.level;
  const need = xpFor(S.level);
  $('#xpfill').style.width = (S.xp / need * 100) + '%';
  $('#xptext').textContent = `${S.xp}/${need}`;
  $('#coins').textContent = fmtN(S.coins);
  $('#hg').textContent = S.hg;
  const used = G.storageUsed(), cap = G.storageCap();
  $('#store').textContent = `${used}/${cap}`;
  $('#storePill').classList.toggle('full', used >= cap);
  const r = G.readyOrders(); const b = $('#ordBadge'); b.hidden = !r; b.textContent = r;
  const se = G.season();
  $('#seasonPill').innerHTML = `${ui(se.name.toLowerCase(), se.icon)} ${se.name} <small>${fmtT(G.seasonEndsAt() - now()).replace(/ \d+s$/, '')}</small>`;
}

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
    <button class="btn" data-act="confirmPlace">✔ ${move ? 'Move here' : 'Place'}</button><button class="btn alt" data-act="cancelPlace">${repeat ? 'Done' : 'Cancel'}</button>`);
}
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
  if (g.move) { sfx.build(); G.moveObj(g.move, g.x, g.y); cancelPlace(); return; }
  const block = G.buyBlock(g.t);
  if (block) { sfx.error(); toast(block); return; }
  G.pay(g.t);
  sfx.build();
  const o = G.addObj(g.t, g.x, g.y);
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

// ---------- actions (buttons with data-act) ----------
function act(el) {
  const d = el.dataset, o = sheetObj;
  switch (d.act) {
    case 'closeModal': closeModal(); setTimeout(showLevelUps, 200); break;
    case 'collectAll': collectAll(); return;
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
    case 'feedAll': { const n = G.feedAll(o); if (n) { sfx.plant(); animalSound(o); } else { sfx.error(); toast(`No ${nm(G.penAnimal(o).feed)} — make some at the Feed Mill`); } break; }
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
      const items = { ...(G.S.orders[+d.i]?.items || {}) };
      const r = G.deliver(+d.i);
      if (r) {
        sfx.deliver();
        const fair = E.fairCount(items);
        toast(`Delivered! +${fmtN(r.coins)} 🪙 +${r.xp} XP${r.bonus ? ' · bonus ⏳' : ''}${fair ? ` · +${fair} toward the ${E.fairName()}` : ''}`);
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
    case 'resetYes': G.resetGame(); afterLoad(); closeModal(); closeSheet(); toast('A fresh start in Pelham Acres'); return;
    case 'toggle':
      G.S.settings[d.k] = d.k === 'hints' ? G.S.settings.hints === false : !G.S.settings[d.k];
      if (d.k === 'music') setMusic(G.S.settings.music); else if (d.k === 'sfx') setSfx(G.S.settings.sfx); else applyGuide();
      sfx.tap(); refreshSoundBtn(); break;
  }
  G.save(); refreshHud(); renderSheet();
  setTimeout(showLevelUps, 300);
}

// ---------- object interactions ----------
function collectProducer(o) {
  const { got, full } = G.collectJobs(o);
  if (got.length) sfx.collect();
  got.forEach((j, i) => setTimeout(() => floater(o.x + 1, o.y + 1, `+${j.n}${em(j.out)}`), i * 150));
  if (full) { sfx.error(); toast('Barn is full! Sell or upgrade in the Barn.'); }
  return got.length;
}
function animalSound(o) { const a = BUILD[o.t].animal; (a === 'chicken' ? sfx.cluck : a === 'cow' ? sfx.moo : sfx.baa)(); }
function collectPen(o) {
  const { got, full } = G.collectAnimals(o);
  if (got) { sfx.collect(); floater(o.x + 1, o.y + 1, `+${got}${em(G.penAnimal(o).product)}`); }
  if (o.animals.length) animalSound(o);
  if (full) { sfx.error(); toast('Barn is full! Sell or upgrade in the Barn.'); }
  return got;
}
function collectHouse(o) {
  const c = G.collectRent(o);
  if (c) { sfx.coin(); floater(o.x + 1, o.y + 1, `+${c}🪙`, '#FFE9A8'); }
  return c;
}

// ---------- Ollie & Milo ----------
const PET_COOLDOWN = 90000;
function petCat(c) {
  const S = G.S; S.pets = S.pets || {};
  const ready = now() - (S.pets[c.id] || 0) > PET_COOLDOWN;
  if (c.id === 'ollie') {
    sfx.meow(true);
    if (!ready) { floater(c.x, c.y, '😴 too comfy', '#FFFFFF'); toast('Ollie is too comfy to move right now.'); return; }
    S.pets.ollie = now();
    S.coins += 3;
    G.stat('pet'); G.stat('pet:ollie');
    setTimeout(() => sfx.purr(), 500);
    floater(c.x, c.y, '💛 purrr  +3🪙', '#FFE9A8');
    toast('Ollie rolls over for belly rubs. What a big, happy boy.');
  } else {
    c.zoomUntil = performance.now() + 4500; c.pause = 0; catGo(c, true);
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
  switch (b.kind) {
    case 'field':
      if (!o.crop) return openSheet('Plant a crop', () => cropPicker(), o);
      if (G.fieldReady(o)) return harvestField(o);
      return openSheet(`${CROPS[o.crop].name} growing`, () => fieldInfo(o), o);
    case 'producer': collectProducer(o); return openSheet(b.name, () => producerSheet(o), o);
    case 'pen': collectPen(o); return openSheet(b.name, () => penSheet(o), o);
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
  if (r) sfx.harvest();
  if (r) floater(o.x + 0.5, o.y + 0.5, `+${r.n}${CROPS[c].icon}`, r.n > CROP_YIELD ? '#FFE9A8' : '#fff');
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
  let html = `<p class="sub">${a.name}s eat ${ic(a.feed)} ${nm(a.feed)} and produce ${ic(a.product)} ${nm(a.product)} every ${secs(Math.round(G.animalTime(o, a)))}.</p><div class="queue" style="flex-wrap:wrap">`;
  o.animals.forEach(an => {
    const st = G.animalState(an);
    html += `<div class="slot ${st === 'ready' ? 'done' : ''} ${st === 'hungry' ? 'hungry' : ''}">${art(st === 'ready' ? a.product : b.animal)}<small ${st === 'busy' ? `data-end="${an.end}"` : ''}>${st === 'hungry' ? 'hungry' : st === 'ready' ? 'ready!' : fmtT(an.end - t)}</small></div>`;
  });
  for (let i = o.animals.length; i < G.penCap(o); i++) html += '<div class="slot"><small>empty</small></div>';
  html += `</div><div class="row">
    ${ready ? '<button class="btn" data-act="collectAnimals">Collect</button>' : ''}
    ${hungry ? `<button class="btn" data-act="feedAll">Feed ${hungry} (${req(a.feed, hungry)})</button>` : ''}
    ${o.animals.some(x => G.animalState(x) === 'busy') ? `<button class="btn gold sm" data-act="hg">⏳ Finish all (${G.S.hg})</button>` : ''}
    ${o.animals.length < G.penCap(o) ? `<button class="btn alt" data-act="buyAnimal">Buy ${a.name} · ${G.animalCost(o)}🪙</button>` : ''}
    <span class="spacer"></span>${moveBtn(o)}</div>`;
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
  const list = G.S.orders.map((o, i) => ({ o, i, ok: !o.wait && G.hasAll(o.items) }))
    .sort((a, b) => (b.ok - a.ok) || (!!a.o.wait - !!b.o.wait));
  const ready = list.filter(x => x.ok).length;
  return `<p class="sub">${ready ? `<b>${ready} order${ready > 1 ? 's' : ''} ready to deliver!</b> ` : ''}Town charm adds +${G.charm()}% to every reward.</p><div class="orders">` + list.map(({ o, i, ok }) => {
    if (o.wait) return `<div class="order waiting">${ui('mail', '✉️')}<span class="sub" style="margin:0">A new order arrives in <b data-end="${o.wait}">${fmtT(o.wait - t)}</b></span></div>`;
    const pid = WHO_PID[o.who];
    return `<div class="order ${ok ? 'ready' : ''}"><div class="ohead">${pid ? face(pid, 'oface') : ui('mail', '✉️').replace('class="ui"', 'class="oface plain"')}
        <div class="grow"><div class="who">${o.who}</div><div class="rew">🪙 ${fmtN(o.coins)} &nbsp; ⭐ ${o.xp}</div></div>
        ${ok ? '<span class="stamp">Ready</span>' : ''}</div>
      <div class="row reqs">${reqs(o.items)}</div>
      <div class="row"><button class="btn ${ok ? '' : 'off'}" data-act="deliver" data-i="${i}">Deliver</button><span class="spacer"></span><button class="btn alt sm" data-act="skip" data-i="${i}">Skip</button></div></div>`;
  }).join('') + '</div>';
}
function menuSheet() {
  const S = G.S, st = S.settings;
  return `<p><b>${S.town}</b> · Level ${S.level} · ${S.delivered || 0} orders delivered · ${S.cleared || 0} spots cleared</p>
    <p class="sub">Town charm: ${G.charm()}. No ads, no purchases — ever. Hourglasses are earned by leveling up and by every 5th delivery.</p>
    <h3>Help</h3><div class="row"><button class="btn alt sm" data-act="toggle" data-k="hints">Hints and arrows: ${st.hints === false ? 'Off' : 'On'}</button></div>
    <h3>Sound</h3><div class="row"><button class="btn alt sm" data-act="toggle" data-k="music">Music: ${st.music ? 'On' : 'Off'}</button>
    <button class="btn alt sm" data-act="toggle" data-k="sfx">Sound effects: ${st.sfx ? 'On' : 'Off'}</button></div>
    <p class="sub">No sound? Turn the volume up and tap the map once. You can also tap 🔊 in the top corner.</p>
    <h3>Mastery</h3>${masteryList()}
    ${cloudHtml()}
    <h3>Backup code</h3><p class="sub">You can also copy this code to keep a backup, or paste one to restore.</p>
    <textarea id="saveText" placeholder="Save code"></textarea><div class="row" style="margin-top:8px">
    <button class="btn alt sm" data-act="export">Copy save code</button><button class="btn alt sm" data-act="import">Load pasted code</button></div>
    <h3>Danger zone</h3><button class="btn red sm" data-act="reset">Start a new farm</button>
    <p class="sub" style="margin-top:16px">Version ${APP_VERSION}</p>`;
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
  if (cloudStep === 'code') return `<h3>Cloud save</h3><p class="sub">We emailed a 6-digit code to <b>${cloudEmailVal}</b>. Type it here:</p>
    <div class="row"><input id="cloudCode" class="field" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456">
    <button class="btn ${cloudBusy ? 'off' : ''}" data-act="cloudVerify">Sign in</button><button class="btn alt sm" data-act="cloudBack">Back</button></div>`;
  return `<h3>Cloud save</h3><p class="sub">Sign in with your email to keep your farm safe and play it on any device. No password: we email you a code.</p>
    <div class="row"><input id="cloudEmail" class="field" type="email" autocomplete="email" placeholder="you@example.com" value="${cloudEmailVal}">
    <button class="btn ${cloudBusy ? 'off' : ''}" data-act="cloudSend">Email me a code</button></div>`;
}
async function cloudAct(a) {
  if (cloudBusy) return;
  try {
    cloudBusy = true;
    if (a === 'cloudSend') {
      const v = ($('#cloudEmail')?.value || '').trim();
      if (!/^\S+@\S+\.\S+$/.test(v)) { toast('Please type your email address'); return; }
      cloudEmailVal = v; await C.sendCode(v); cloudStep = 'code'; toast('Code sent! Check your email.');
    } else if (a === 'cloudVerify') {
      const code = ($('#cloudCode')?.value || '').trim();
      if (code.length < 6) { toast('Type the code from the email'); return; }
      await C.verifyCode(cloudEmailVal, code); cloudStep = 'email';
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
      <p><b>${Object.entries(r.story.items).map(([k, v]) => `${ic(k)} ${v} ${nm(k)}`).join(' · ')}</b></p><p class="sub">New blueprint! Find it in the Shop under Decor.</p>
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
  return q.goals.map(g => {
    const p = Q.goalProgress(q, g), done = p >= g.n;
    return `<div class="goal ${done ? 'done' : ''}">${goalIcon(g)}<span class="gl">${g.label}</span>
      <div class="bar"><div style="width:${p / g.n * 100}%"></div></div><b class="gn">${done ? '✔' : `${p}/${g.n}`}</b></div>`;
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
  const TABS = [['requests', 'Requests', 'icon-scroll', Q.claimable().length], ['projects', 'Projects', 'icon-hammer', projReady],
    ['fair', 'Fair', 'icon-ribbon', E.fairClaimable() ? 1 : 0], ['album', 'Scrapbook', 'icon-quill', setsReady]];
  const tabs = `<div class="tabs">${TABS.map(([k, label, im, n]) => `<button class="tab ${questTab === k ? 'on' : ''}" data-act="qtab" data-tab="${k}">${IMG(`sprites/${im}.webp`, '', 'ti')}<span>${label}</span>${n ? `<i class="tcount">${n}</i>` : ''}</button>`).join('')}</div>`;
  return tabs + (questTab === 'projects' ? projectsHtml() : questTab === 'fair' ? fairHtml() : questTab === 'album' ? albumHtml() : requestsHtml());
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
  if (!list.length) return dailyHtml() + '<p class="sub">No requests right now. Keep farming! New ones arrive as you level up.</p>';
  return dailyHtml() + list.map(q => {
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
  const b = $('#questBadge'), n = Q.claimable().length + Q.unseen().length + E.extrasNotice();
  b.hidden = !n; b.textContent = n;
  if ($('#modal').hidden && !levelQueue.length) { const u = Q.unseen()[0]; if (u) questIntro(u); }
  applyGuide();
}

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
    return { text: 'All fields are busy. Buy another field in the Shop', tb: 'shop' };
  }
  const b = makerOf(item);
  if (!b) return { text: `${verb} ${nm(item)}` };
  const o = G.findObj(b);
  if (!o) return { text: `Build a ${BUILD[b].name} from the Shop (${BUILD[b].cat} tab)`, tb: 'shop' };
  if (BUILD[b].kind === 'pen') return { text: o.animals.length ? `Feed your ${G.penAnimal(o).name.toLowerCase()}s and collect ${nm(item).toLowerCase()}` : `Tap the ${BUILD[b].name} and buy an animal`, obj: o };
  return { text: `${verb} ${nm(item)} at the ${BUILD[b].name}`, obj: o };
}
function guideFor(q, g) {
  if (g.type === 'have') return guideForItem(g.id, 'Make');
  if (g.type === 'own') return G.count(g.id) ? null : { text: `Buy a ${BUILD[g.id].name} in the Shop (${BUILD[g.id].cat} tab)`, tb: 'shop' };
  if (g.type === 'animals') { const pen = Object.keys(BUILD).find(b => BUILD[b].animal === g.id); const o = G.findObj(pen); return o ? { text: `Tap the ${BUILD[pen].name} and buy more ${g.id}s`, obj: o } : { text: `Build a ${BUILD[pen].name} from the Shop`, tb: 'shop' }; }
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
function computeGuide() {
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
  if (!g || view.ghost || view.plantCrop) { h.hidden = true; }
  else { h.hidden = false; h.innerHTML = ui('bulb', '💡') + ' '; h.append(g.text); }
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
  ({ shop: () => openSheet('Shop', shopSheet), quests: () => openSheet('Quests', questsSheet), orders: () => openSheet('Orders', ordersSheet), barn: () => openSheet('Barn', barnSheet),
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
  if (gest.mode === 'ghost') { const g = view.ghost; g.x = tl.x - gest.ox; g.y = tl.y - gest.oy; updateGhost(); }
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
function afterLoad() { G.refreshOrders(); cam.z = innerWidth < 600 ? 0.8 : 1; centerOn(14, 13); refreshHud(); }
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
  modal(`<div style="font-size:54px">🌾</div><h2>Welcome to Pelham Acres</h2>
    <p>Grow crops, raise animals, make goods, and turn this little farm into a thriving country town.</p>
    <p class="sub">Tap a ready field to harvest, or drag across several. Tap empty fields to plant. Pinch to zoom, drag to look around.</p>
    <p class="sub">🐈 Ollie and Milo, the farm cats, live here too. Give them a tap now and then.</p>
    <button class="btn wide" data-act="closeModal">Let's farm!</button>`);
} else {
  const away = now() - (G.S.saved || now());
  if (away > 120000) setTimeout(() => showAway(away), 700);
}
// signed-in players: check whether the cloud has a newer farm (e.g. played on another device)
if (C.cloudEnabled() && C.signedIn()) setTimeout(() => cloudCheck(false).catch(() => {}), 1500);
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
    else if (k === 'pen') { const r = G.collectAnimals(o); items += r.got; if (r.full) { full = true; break; } }
    else if (k === 'house') coins += G.collectRent(o);
  }
  if (items || coins) sfx.collect();
  closeModal();
  toast(`Collected ${items} item${items === 1 ? '' : 's'}${coins ? ` and ${fmtN(coins)} 🪙` : ''}${full ? ' · the barn is full!' : ''}`);
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
setInterval(() => { refreshHud(); liveUpdate(); if ($('#exp').hidden) questTick(); else updateEnergy(); }, 500);
setInterval(() => G.save(), 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });
addEventListener('pagehide', () => G.save());

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
