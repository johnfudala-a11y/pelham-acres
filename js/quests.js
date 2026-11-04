// Pelham Acres — quest tracking.
import { QUESTS, QUEST_BY_ID, MAX_ACTIVE } from './story.js';
import * as G from './game.js';

function Q() { const S = G.S; S.quests = S.quests || { active: {}, done: [] }; S.flags = S.flags || {}; return S.quests; }

// Activate any quests whose requirements are met. Returns the newly started quests.
export function refreshQuests() {
  const st = Q(), started = [];
  for (const q of QUESTS) {
    if (Object.keys(st.active).length >= MAX_ACTIVE) break;
    if (st.done.includes(q.id) || st.active[q.id]) continue;
    if (G.S.level < q.lvl) continue;
    if ((q.after || []).some(id => !st.done.includes(id))) continue;
    const base = {};
    for (const g of q.goals) if (g.type === 'stat') base[g.key] = G.getStat(g.key);
    st.active[q.id] = { base, seen: false };
    started.push(q);
  }
  return started;
}

export function goalProgress(q, g) {
  const a = Q().active[q.id];
  switch (g.type) {
    case 'stat': return Math.min(g.n, G.getStat(g.key) - ((a && a.base[g.key]) || 0));
    case 'have': return Math.min(g.n, G.have(g.id));
    case 'own': return Math.min(g.n, G.count(g.id));
    case 'animals': { let n = 0; for (const o of G.S.objs) if (o.animals && o.t && n < 99) { const pa = G.penAnimal(o); if (pa && pa.name.toLowerCase() === g.id) n += o.animals.length; } return Math.min(g.n, n); }
    case 'level': return Math.min(g.n, G.S.level);
  }
  return 0;
}
export const isComplete = q => q.goals.every(g => goalProgress(q, g) >= g.n);
export const activeQuests = () => Object.keys(Q().active).map(id => QUEST_BY_ID[id]).filter(Boolean);
export const claimable = () => activeQuests().filter(isComplete);
export const questsFor = who => activeQuests().filter(q => q.who === who);
export const hasFlag = f => !!(G.S.flags && G.S.flags[f]);
export const introduced = who => QUESTS.some(q => q.who === who && (Q().active[q.id] || Q().done.includes(q.id)));
export function markSeen(id) { const a = Q().active[id]; if (a) a.seen = true; }
export const unseen = () => activeQuests().filter(q => !Q().active[q.id].seen);

export function claim(id) {
  const q = QUEST_BY_ID[id], st = Q();
  if (!q || !st.active[id] || !isComplete(q)) return null;
  const give = {};
  for (const g of q.goals) if (g.type === 'have') give[g.id] = (give[g.id] || 0) + g.n;
  G.takeAll(give);
  const r = q.reward || {};
  if (r.coins) G.S.coins += r.coins;
  if (r.hg) G.S.hg += r.hg;
  if (r.items) for (const k in r.items) G.S.inv[k] = (G.S.inv[k] || 0) + r.items[k];
  if (q.flag) G.S.flags[q.flag] = true;
  delete st.active[id];
  st.done.push(id);
  if (r.xp) G.addXP(r.xp);
  G.stat('quest');
  return q;
}
