// Pelham Acres — input, menus, and the game loop.
import { BUILD, CROPS, ITEMS, RECIPES, ANIMALS, MATS, SHOP_CATS, VALUE, xpFor, unlocksAt, CROP_YIELD, DECOR_CHARM_CAP, MASTERY, MASTERY_PERKS, NO_ORDER } from './data.js';
import * as G from './game.js';
import { initAudio, sfx, setMusic, setSfx, audioRunning } from './audio.js';
import * as Q from './quests.js';
import { PEOPLE, QUEST_BY_ID } from './story.js';
import * as X from './expedition.js';
export const APP_VERSION = '0.12';
import { loadSprites } from './render.js';
import { cam, view, initRender, draw, centerOn, s2w, zoomAt, clampCam, hit, floater, screenSize, cats, setCatGrid, catGo, people, setPeople } from './render.js';

const $ = s => document.querySelector(s);
const now = G.now;
const ic = id => ITEMS[id]?.icon || '❔';
// painted crop picture for menus (falls back to the emoji if the image can't load)
const icH = id => CROPS[id] ? `<img class="cimg" src="sprites/crop-${id}.webp" alt="${CROPS[id].name}" onerror="this.outerHTML='${CROPS[id].icon}'">` : ic(id);
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
function modal(html) { $('#modalCard').innerHTML = html; $('#modal').hidden = false; }
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
    ${un.length ? `<b>New this level</b><div class="unlocks">${un.map(u => `<div>${u.icon} ${u.name}</div>`).join('')}</div>` : '<p>Keep growing Pelham Acres!</p>'}
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
function renderSheet() { if (sheetFn) $('#sheetBody').innerHTML = sheetFn(); }
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
  $('#seasonPill').innerHTML = `${se.icon} ${se.name} <small>${fmtT(G.seasonEndsAt() - now()).replace(/ \d+s$/, '')}</small>`;
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
  setModeBar(`<span style="font-size:22px">${b.icon}</span><span class="msg">${move ? 'Move' : 'Place'} ${b.name} · drag it into position</span>
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
    case 'move': startPlacing(o.t, o); return;
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
      floater(o.x + 0.5, o.y + 0.5, r.drop ? `+${r.drop.n}${ic(r.drop.id)}` : '+2 XP');
      closeSheet(); break;
    }
    case 'deliver': {
      const r = G.deliver(+d.i);
      if (r) { sfx.deliver(); toast(`Delivered! +${fmtN(r.coins)} 🪙 +${r.xp} XP${r.bonus ? ' · bonus ⏳' : ''}`); }
      break;
    }
    case 'skip': G.skipOrder(+d.i); break;
    case 'sell': { const c = G.sell(d.id, +d.n); if (c) { sfx.coin(); toast(`Sold for ${c} 🪙`); } break; }
    case 'upgradeBarn': if (G.upgradeBarn()) { sfx.build(); toast('Barn upgraded! +30 space'); } else { sfx.error(); toast('Need more coins or materials'); } break;
    case 'tab': sfx.tap(); shopTab = d.tab; break;
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
  got.forEach((j, i) => setTimeout(() => floater(o.x + 1, o.y + 1, `+${j.n}${ic(j.out)}`), i * 150));
  if (full) { sfx.error(); toast('Barn is full! Sell or upgrade in the Barn.'); }
  return got.length;
}
function animalSound(o) { const a = BUILD[o.t].animal; (a === 'chicken' ? sfx.cluck : a === 'cow' ? sfx.moo : sfx.baa)(); }
function collectPen(o) {
  const { got, full } = G.collectAnimals(o);
  if (got) { sfx.collect(); floater(o.x + 1, o.y + 1, `+${got}${ic(G.penAnimal(o).product)}`); }
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
    if (Math.random() < 0.6 && G.addItem(id, 1)) { floater(c.x, c.y, `⚡ +1${ic(id)}`); toast(`Milo does zoomies and drops a ${nm(id).toLowerCase()} at your feet!`); }
    else { floater(c.x, c.y, '⚡ zoomies!', '#FFFFFF'); toast('Milo does a lap of the whole farm at top speed.'); }
  }
  G.save(); refreshHud();
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
  return !!r;
}

// ---------- sheet contents ----------
function cropPicker() {
  const se = G.season();
  return `<p class="sub">Pick a crop, then tap or drag across empty fields to plant it. ${se.icon} ${se.name} crops grow 25% faster and pay more in orders.</p><div class="grid">` +
    Object.entries(CROPS).map(([k, c]) => {
      const locked = G.S.level < c.lvl;
      return `<div class="card ${locked ? 'locked' : ''}"><div class="big">${icH(k)}</div><div class="nm">${c.name}${G.inSeason(k) ? ` <span title="In season">${se.icon}</span>` : ''}</div>
        ${locked ? '' : starStr('crop', k)}
        <div class="meta">⏱ ${secs(Math.round(G.cropTime(k)))} · 🪙 ${c.cost} · ×${CROP_YIELD}</div>
        ${locked ? `<div class="meta">🔒 Level ${c.lvl}</div>` : `<button class="btn sm" data-act="pickCrop" data-c="${k}">Plant</button>`}</div>`;
    }).join('') + '</div>';
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
  RECIPES[o.t].forEach((r, i) => {
    const locked = G.S.level < r.lvl;
    html += `<div class="card ${locked ? 'locked' : ''}"><div class="big">${ic(r.out)}</div><div class="nm">${nm(r.out)}${r.n > 1 ? ' ×' + r.n : ''}</div>
      ${locked ? '' : starStr('recipe', r.out)}
      <div class="meta">⏱ ${secs(Math.round(G.recipeTime(o, r)))}${NO_ORDER.has(r.out) ? '' : ` · worth ${VALUE[r.out]}🪙`}</div>
      ${locked ? `<div class="meta">🔒 Level ${r.lvl}</div>` : `<div class="row" style="justify-content:center">${reqs(r.in)}</div>
      <button class="btn sm ${G.hasAll(r.in) && o.jobs.length < n ? '' : 'off'}" data-act="make" data-i="${i}">Make</button>`}</div>`;
  });
  return html + '</div><h3>Upgrade</h3>' + upgradeBlock(o) + '<br><button class="btn alt sm" data-act="move">Move</button>';
}
function penSheet(o) {
  const b = BUILD[o.t], a = G.penAnimal(o), t = now();
  const hungry = o.animals.filter(x => G.animalState(x) === 'hungry').length;
  const ready = o.animals.filter(x => G.animalState(x) === 'ready').length;
  let html = `<p class="sub">${a.name}s eat ${ic(a.feed)} ${nm(a.feed)} and produce ${ic(a.product)} ${nm(a.product)} every ${secs(a.time)}.</p><div class="queue" style="flex-wrap:wrap">`;
  o.animals.forEach(an => {
    const st = G.animalState(an);
    html += `<div class="slot ${st === 'ready' ? 'done' : ''}">${a.icon}<small ${st === 'busy' ? `data-end="${an.end}"` : ''}>${st === 'hungry' ? 'hungry' : st === 'ready' ? 'ready!' : fmtT(an.end - t)}</small></div>`;
  });
  for (let i = o.animals.length; i < G.penCap(o); i++) html += '<div class="slot"><small>empty</small></div>';
  html += `</div><div class="row">
    ${ready ? '<button class="btn" data-act="collectAnimals">Collect</button>' : ''}
    ${hungry ? `<button class="btn" data-act="feedAll">Feed ${hungry} (${req(a.feed, hungry)})</button>` : ''}
    ${o.animals.some(x => G.animalState(x) === 'busy') ? `<button class="btn gold sm" data-act="hg">⏳ Finish all (${G.S.hg})</button>` : ''}
    ${o.animals.length < G.penCap(o) ? `<button class="btn alt" data-act="buyAnimal">Buy ${a.name} · ${G.animalCost(o)}🪙</button>` : ''}
    <span class="spacer"></span><button class="btn alt sm" data-act="move">Move</button></div>`;
  if (!o.animals.length) html += `<p class="sub" style="margin-top:12px">Buy your first ${a.name.toLowerCase()} to get started.</p>`;
  return html + '<h3>Upgrade</h3>' + upgradeBlock(o);
}
function houseSheet(o) {
  const b = BUILD[o.t], due = G.rentDue(o), rent = G.rentOf(o);
  const next = o.last + (due + 1) * b.period * 1000;
  return `<p>Your neighbors pay <b>${rent} 🪙</b> rent every ${secs(b.period)} (holds up to ${G.RENT_CAP} payments).</p>
    ${due ? `<button class="btn" data-act="collectRent">Collect ${due * rent} 🪙</button>` : `<p>Next rent in <b data-end="${next}">${fmtT(next - now())}</b></p>`}
    <h3>Upgrade</h3>${upgradeBlock(o)}<br><button class="btn alt sm" data-act="move">Move</button>`;
}
function infoSheet(o) {
  const b = BUILD[o.t];
  let html = '';
  if (b.kind === 'civic') html += `<p>A proud landmark of ${G.S.town}. Adds <b>+${b.charm} charm</b>.</p>`;
  if (b.kind === 'decor') html += `<p>${b.charm ? `Adds +${b.charm} charm (decorations count up to ${DECOR_CHARM_CAP}).` : 'Purely for looks.'}</p>`;
  if (b.kind === 'path') html += '<p>A tidy cobblestone path.</p>';
  html += `<p class="sub">Town charm: <b>${G.charm()}</b> → orders pay <b>+${G.charm()}%</b> coins.</p><button class="btn alt sm" data-act="move">Move</button>`;
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
function barnSheet() {
  const used = G.storageUsed(), cap = G.storageCap(), up = G.barnUpgradeCost();
  const items = Object.entries(G.S.inv).filter(([, n]) => n > 0).sort((a, b) => (MATS.has(a[0]) - MATS.has(b[0])) || a[0].localeCompare(b[0]));
  let html = `<p class="sub">Stored: <b>${used}/${cap}</b> (wood and stone don't take space)</p><div class="bar"><div style="width:${Math.min(100, used / cap * 100)}%"></div></div>
    <h3>Upgrade barn (+30)</h3><div class="row"><span class="req ${G.S.coins >= up.coins ? 'ok' : 'no'}">🪙 ${up.coins}</span>${req('wood', up.wood)}${req('stone', up.stone)}
    <button class="btn sm" data-act="upgradeBarn">Upgrade</button></div><h3>Your goods</h3>`;
  if (!items.length) return html + '<p class="sub">Empty. Harvest some crops!</p>';
  html += '<div class="inv">' + items.map(([id, n]) => `<div class="invrow"><span class="ic">${icH(id)}</span><div><div class="n">${n}</div><div class="nm">${nm(id)}</div></div><span class="spacer"></span>
    <button class="btn sm alt" data-act="sell" data-id="${id}" data-n="1">Sell ${G.sellPrice(id)}🪙</button></div>`).join('') + '</div>';
  return html;
}
let shopTab = 'Farm';
function shopSheet() {
  let html = `<div class="tabs">${SHOP_CATS.map(c => `<button class="tab ${c === shopTab ? 'on' : ''}" data-act="tab" data-tab="${c}">${c}</button>`).join('')}</div><div class="grid">`;
  for (const k in BUILD) {
    const b = BUILD[k]; if (b.cat !== shopTab) continue;
    const n = G.count(k), mx = b.max(G.S.level), noBp = b.needs && !Q.hasFlag(b.needs), locked = G.S.level < b.lvl || noBp;
    const block = G.buyBlock(k);
    const cost = b.cost(n);
    html += `<div class="card ${locked ? 'locked' : ''}"><div class="big">${b.icon}</div><div class="nm">${b.name}</div>
      <div class="meta">${b.desc && b.kind === 'station' ? b.desc : b.kind === 'house' ? `${b.rent}🪙 / ${secs(b.period)}` : b.kind === 'civic' || b.charm ? `+${b.charm} charm` : b.kind === 'pen' ? `${ANIMALS[b.animal].name}s` : b.kind === 'producer' ? `${RECIPES[k].length} recipes` : b.desc || ''}</div>
      ${locked ? `<div class="meta">${noBp && G.S.level >= b.lvl ? '🗺️ ' + b.needsText : '🔒 Level ' + b.lvl}</div>` : n >= mx ? `<div class="meta">✔ Owned${mx > 1 && mx < Infinity ? ` ${n}/${mx}` : ''}</div>` :
      `<div class="row" style="justify-content:center"><span class="req ${G.S.coins >= cost ? 'ok' : 'no'}">🪙 ${cost}</span>${b.mats ? reqs(b.mats) : ''}</div>
       ${mx < Infinity && mx > 1 ? `<div class="meta">${n}/${mx}</div>` : ''}
       <button class="btn sm ${block ? 'off' : ''}" data-act="buy" data-t="${k}">Buy</button>`}</div>`;
  }
  return html + '</div>';
}
function ordersSheet() {
  G.refreshOrders();
  const t = now();
  return `<p class="sub">Townsfolk need goods. Town charm adds +${G.charm()}% to every reward.</p>` + G.S.orders.map((o, i) => {
    if (o.wait) return `<div class="order"><span class="sub">🚚 New order arriving in <b data-end="${o.wait}">${fmtT(o.wait - t)}</b></span></div>`;
    const ok = G.hasAll(o.items);
    return `<div class="order ${ok ? 'ready' : ''}"><div class="row"><span class="who">${o.who}</span><span class="spacer"></span><span class="rew">🪙 ${fmtN(o.coins)} · ⭐ ${o.xp}</span></div>
      <div class="row" style="margin:8px 0">${reqs(o.items)}</div>
      <div class="row"><button class="btn ${ok ? '' : 'off'}" data-act="deliver" data-i="${i}">Deliver</button><span class="spacer"></span><button class="btn alt sm" data-act="skip" data-i="${i}">Skip</button></div></div>`;
  }).join('');
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
    <h3>Backup</h3><p class="sub">Cloud saves are coming. For now, copy this code to keep a backup, or paste one to restore.</p>
    <textarea id="saveText" placeholder="Save code"></textarea><div class="row" style="margin-top:8px">
    <button class="btn alt sm" data-act="export">Copy save code</button><button class="btn alt sm" data-act="import">Load pasted code</button></div>
    <h3>Danger zone</h3><button class="btn red sm" data-act="reset">Start a new farm</button>
    <p class="sub" style="margin-top:16px">Version ${APP_VERSION}</p>`;
}
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
function renderExp() {
  const reg = X.REGIONS.find(r => r.id === expRegion), L = X.layout(reg);
  $('#exp').style.background = reg.bg;
  $('#expTabs').innerHTML = X.REGIONS.map(r => {
    const un = X.regionUnlocked(r);
    return `<button class="tab ${r.id === expRegion ? 'on' : ''} ${un ? '' : 'lock'}" data-reg="${r.id}">${r.icon} ${r.name}${un ? (X.regionState(r).done ? ' ✅' : '') : ` 🔒${r.lvl}`}</button>`;
  }).join('');
  const body = $('#expBody'), ts = Math.max(40, Math.min(64, Math.floor((body.clientWidth - 28 - (reg.cols - 1) * 4) / reg.cols)));
  const grid = $('#expGrid');
  grid.style.setProperty('--ts', ts + 'px');
  grid.style.gridTemplateColumns = `repeat(${reg.cols}, ${ts}px)`;
  grid.innerHTML = L.tiles.map((t, i) => {
    const T = X.TILE[t];
    if (X.isRevealed(reg, i)) return `<div class="tile rev ${t === 'water' ? 'water' : ''}" data-i="${i}">${t === 'ruin' ? '🏡' : T.icon}${t === 'camp' ? '<span class="milo">🐈</span>' : ''}</div>`;
    if (X.canExplore(reg, i)) return `<div class="tile can" data-i="${i}">⚡${T.cost}</div>`;
    return `<div class="tile fog" data-i="${i}">☁️</div>`;
  }).join('');
  updateEnergy();
  renderExpFoot(reg);
}
function renderExpFoot(reg) {
  const p = X.progress(reg), st = X.regionState(reg);
  const foods = Object.keys(X.FOOD).filter(k => G.have(k) > 0);
  $('#expFoot').innerHTML = `<div class="row"><b>${reg.icon} ${reg.name}</b><span class="sub" style="margin:0">· explored ${p.have}/${p.total}</span><span class="spacer"></span>
      <span class="sub" style="margin:0">${st.done ? 'Fully explored ✅' : `Explore it all: 🪙 ${fmtN(reg.reward.coins)} · ⏳ ${reg.reward.hg} · ${Object.entries(reg.reward.items).map(([k, v]) => ic(k) + ' ' + v).join(' ')}`}</span></div>
    <div class="row" style="margin-top:8px"><b>🧺 Picnic basket</b><span class="sub" style="margin:0">Eat food you've made for energy</span></div>
    <div class="row" style="margin-top:6px">${foods.length ? foods.map(k => `<span class="food">${ic(k)} ${G.have(k)} <button class="btn sm" data-eat="${k}">+${X.FOOD[k]}⚡</button></span>`).join('') : '<span class="sub" style="margin:0">Bake bread or make other foods to pack a picnic.</span>'}</div>`;
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
  ({ chest: sfx.levelUp, rock: sfx.clear, ore: sfx.clear, gemrock: sfx.collect, brush: sfx.clear, berries: sfx.harvest, ruin: sfx.build }[r.type] || sfx.plant).call(sfx);
  const bits = [];
  if (r.coins) bits.push(`+${r.coins}🪙`);
  if (r.hg) bits.push(`+${r.hg}⏳`);
  for (const k in r.loot) bits.push(`+${r.loot[k]}${ic(k)}`);
  if (bits.length) toast(`${X.TILE[r.type].name}: ${bits.join(' ')}`);
  G.save();
  renderExp();
  const nt = $(`#expGrid .tile[data-i="${i}"]`); if (nt) nt.classList.add('pop');
  if (r.story) modal(`<div class="portrait">🏚️</div><h2>${r.story.name}</h2><div class="say">${r.story.text}</div>
      <p><b>${Object.entries(r.story.items).map(([k, v]) => `${ic(k)} ${v} ${nm(k)}`).join(' · ')}</b></p><p class="sub">New blueprint! Find it in the Shop under Decor.</p>
      <button class="btn wide" data-act="closeModal">Amazing!</button>`);
  if (r.finished) setTimeout(() => { sfx.levelUp(); modal(`<div class="portrait">${r.finished.icon}</div><h2>${r.finished.name} explored!</h2>
      <p>Milo is very proud of himself. 🐈</p><p><b>🪙 ${fmtN(r.finished.reward.coins)} · ⏳ ${r.finished.reward.hg} · ${Object.entries(r.finished.reward.items).map(([k, v]) => ic(k) + ' ' + v).join(' ')}</b></p>
      <button class="btn wide" data-act="closeModal">Hooray!</button>`); }, r.story ? 0 : 300);
});

// ---------- freight train ----------
function stationSheet(o) {
  const st = G.trainState(o);
  if (st.status === 'away') return `<div style="font-size:48px;text-align:center">🛤️</div><p>The train is out on its route.</p>
    <p>Next train arrives in <b data-end="${st.arrive}">${fmtT(st.arrive - now())}</b></p><p class="sub">Trains stay for 45 minutes. Stock up on goods while you wait!</p>
    <br><button class="btn alt sm" data-act="move">Move</button>`;
  const tr = st.train, all = tr.crates.every(c => c.filled), bonus = G.trainBonus(tr);
  return `<p>🚂 Departs in <b data-end="${tr.depart}">${fmtT(tr.depart - now())}</b></p>
    <p class="sub">Fill crates for coins and XP. Fill all ${tr.crates.length} and send the train off for a bonus: 🪙 ${fmtN(bonus.coins)} · ⏳ ${bonus.hg} · ${ic('planks')} ${bonus.planks} · ${ic('nails')} ${bonus.nails}</p>
    <div class="grid">${tr.crates.map((c, i) => `<div class="card" style="${c.filled ? 'background:#EEF7E2;border-color:#9CCB6E' : ''}">
      <div class="big">${c.filled ? '✅' : ic(c.id)}</div><div class="nm">${c.q}× ${nm(c.id)}</div>
      <div class="meta">🪙 ${fmtN(c.coins)} · ⭐ ${c.xp}</div>
      ${c.filled ? '<div class="meta">Loaded</div>' : `${req(c.id, c.q)}<button class="btn sm ${G.have(c.id) >= c.q ? '' : 'off'}" data-act="fillCrate" data-i="${i}">Load</button>`}</div>`).join('')}</div>
    <br>${all ? '<button class="btn gold wide" data-act="sendTrain">🚂 Send it off! Collect bonus</button>' : ''}
    <br><button class="btn alt sm" data-act="move">Move</button>`;
}

// ---------- quests & townsfolk ----------
function rewardLine(r) {
  const parts = [];
  if (r.coins) parts.push(`🪙 ${fmtN(r.coins)}`);
  if (r.xp) parts.push(`⭐ ${r.xp}`);
  if (r.hg) parts.push(`⏳ ${r.hg}`);
  if (r.items) for (const k in r.items) parts.push(`${ic(k)} ${r.items[k]}`);
  return parts.join(' · ');
}
function goalsHtml(q) {
  return q.goals.map(g => {
    const p = Q.goalProgress(q, g), done = p >= g.n;
    const icon = g.id ? (ITEMS[g.id] ? ic(g.id) : BUILD[g.id] ? BUILD[g.id].icon : ANIMALS[g.id] ? ANIMALS[g.id].icon : '•') : (g.key && g.key.includes(':') ? (ITEMS[g.key.split(':')[1]] ? ic(g.key.split(':')[1]) : g.key.startsWith('pet') ? '🐈' : '•') : '•');
    return `<div class="goal ${done ? 'done' : ''}">${done ? '✅' : icon} <span>${g.label}</span><span class="spacer"></span>
      <div class="bar"><div style="width:${p / g.n * 100}%"></div></div><b>${p}/${g.n}</b></div>`;
  }).join('');
}
function dailyHtml() {
  const d = Q.daily(); if (!d) return '';
  const p = PEOPLE[d.who], ok = G.hasAll(d.items);
  if (d.done) return `<div class="quest"><div class="qh"><span class="face">${p.icon}</span><div><div class="qt">⭐ Daily favor done!</div><div class="sub" style="margin:0">${p.name} is grateful. A new favor comes tomorrow.</div></div></div></div>`;
  return `<div class="quest ${ok ? 'ready' : ''}" style="border-color:#F0D27A;background:#FFF9E6"><div class="qh"><span class="face">${p.icon}</span><div><div class="qt">⭐ Daily favor</div><div class="sub" style="margin:0">${p.name} needs a hand today</div></div></div>
    <div class="row" style="margin:8px 0">${reqs(d.items)}</div>
    <div class="row"><span class="sub" style="margin:0">Reward: 🪙 ${fmtN(d.coins)} · ⭐ ${d.xp} · ⏳ ${d.hg}</span><span class="spacer"></span>
    <button class="btn ${ok ? '' : 'off'}" data-act="claimDaily">Give</button></div></div>`;
}
function questsSheet() {
  Q.refreshQuests();
  const list = Q.activeQuests();
  if (!list.length) return dailyHtml() + '<p class="sub">No quests right now. Keep farming! New requests arrive as you level up.</p>';
  return dailyHtml() + list.map(q => {
    const p = PEOPLE[q.who], ready = Q.isComplete(q);
    return `<div class="quest ${ready ? 'ready' : ''}"><div class="qh"><span class="face">${p.icon}</span><div><div class="qt">${q.title}</div><div class="sub" style="margin:0">${p.name}</div></div></div>
      ${goalsHtml(q)}<div class="row" style="margin-top:8px"><span class="sub" style="margin:0">Reward: ${rewardLine(q.reward)}</span><span class="spacer"></span>
      ${ready ? `<button class="btn" data-act="claimQuest" data-id="${q.id}">Claim</button>` : `<button class="btn alt sm" data-act="showQuest" data-id="${q.id}">Details</button>`}</div></div>`;
  }).join('');
}
function questIntro(q) {
  const p = PEOPLE[q.who];
  Q.markSeen(q.id);
  sfx.open();
  modal(`<div class="portrait">${p.icon}</div><b>${p.name}</b><div class="sub">${q.title}</div>
    <div class="say">${q.intro}</div><div style="text-align:left">${goalsHtml(q)}</div>
    <p class="sub" style="margin-top:10px">Reward: ${rewardLine(q.reward)}</p>
    <button class="btn wide" data-act="closeModal">I'm on it!</button>`);
}
function claimQuest(id) {
  const q = Q.claim(id);
  if (!q) { sfx.error(); toast('Not finished yet'); return; }
  const p = PEOPLE[q.who];
  sfx.deliver();
  closeSheet();
  modal(`<div class="portrait">${p.icon}</div><b>${p.name}</b><div class="sub">✅ ${q.title}</div>
    <div class="say">${q.outro}</div><p><b>${rewardLine(q.reward)}</b></p>
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
  modal(`<div class="portrait">${def.icon}</div><b>${def.name}</b><div class="sub">${def.blurb}</div>
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
  const b = $('#questBadge'), n = Q.claimable().length + Q.unseen().length;
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
  else { h.hidden = false; h.textContent = `💡 ${g.text}`; }
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
  if (G.S.level < 5 && !Q.hasFlag('expedition')) return `<div style="font-size:48px;text-align:center">🌲</div><p>The woods beyond the farm are thick and wild, and nobody in town has a map.</p>
    <p class="sub">Exploring unlocks around level 5. Keep an eye on Milo...</p>`;
  if (!Q.hasFlag('expedition')) return `<div style="font-size:48px;text-align:center">🌲</div><p>The woods beyond the farm are thick and wild, and nobody in town has a map.</p>
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
const loaded = G.load();
if (!loaded) { G.newGame(); G.save(); }
afterLoad();
initAudio(G.S.settings);
function refreshSoundBtn() {
  const st = G.S.settings, on = (st.music || st.sfx);
  const b = $('#soundBtn'); b.textContent = on ? '🔊' : '🔇'; b.classList.toggle('off', !on);
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
  if (away > 60000) setTimeout(() => toast(`Welcome back! You were away ${fmtT(away)} — your farm kept working.`), 600);
}

function frame() { draw(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
setInterval(() => { refreshHud(); liveUpdate(); if ($('#exp').hidden) questTick(); else updateEnergy(); }, 500);
setInterval(() => G.save(), 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });
addEventListener('pagehide', () => G.save());

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
