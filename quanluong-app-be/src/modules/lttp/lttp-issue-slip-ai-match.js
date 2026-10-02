import { normalizeCommodityName } from "../kitchen-books/kitchen-books-menu-ai-map.js";

const ALIAS_RATIO = 0.8;
const SIM_AUTO = 0.55;
const SIM_CANDIDATE = 0.35;
const SCORE_MARGIN = 0.25;
const LLM_CONF = 0.7;

function bigramDice(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (s) => {
    const m = new Map();
    for (let i = 0; i < s.length - 1; i += 1) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) || 0) + 1);
    }
    return m;
  };
  const left = grams(a);
  const right = grams(b);
  let inter = 0;
  let sizeA = 0;
  let sizeB = 0;
  for (const n of left.values()) sizeA += n;
  for (const n of right.values()) sizeB += n;
  for (const [g, n] of left) inter += Math.min(n, right.get(g) || 0);
  return (2 * inter) / (sizeA + sizeB);
}

function nameSimilarity(raw, commodity) {
  const needle = normalizeCommodityName(raw);
  const name = normalizeCommodityName(commodity?.name);
  const code = normalizeCommodityName(commodity?.code);
  if (!needle) return 0;
  const scores = [name ? bigramDice(needle, name) : 0];
  if (code) scores.push(bigramDice(needle, code));
  if (name && (name.includes(needle) || needle.includes(name))) scores.push(0.85);
  return Math.max(...scores);
}

function pickAlias(aliases, rawName) {
  const rawNorm = normalizeCommodityName(rawName);
  const hits = (aliases || []).filter((row) => row.rawNorm === rawNorm && row.hitCount > 0);
  const total = hits.reduce((sum, row) => sum + row.hitCount, 0);
  if (!rawNorm || total <= 0) return null;
  const best = hits.reduce((a, b) => (a.hitCount >= b.hitCount ? a : b));
  const ratio = best.hitCount / total;
  if (ratio < ALIAS_RATIO) return null;
  return {
    commodityId: best.commodityId,
    source: "alias",
    confidence: ratio,
    needsConfirm: false,
    needsLlm: false,
    choices: [],
  };
}

function scorePool(rawName, commodities, habitByCid, now) {
  const maxFreq = Math.max(1, ...commodities.map((c) => habitByCid.get(c.id)?.orderCount || 0));
  return commodities.map((commodity) => {
    const habit = habitByCid.get(commodity.id) || null;
    const sim = nameSimilarity(rawName, commodity);
    const freq = habit ? habit.orderCount / maxFreq : 0;
    const days = habit?.lastOrderedAt
      ? Math.max(0, (now - new Date(habit.lastOrderedAt)) / 86_400_000)
      : 0;
    const recency = habit ? Math.exp(-days / 60) : 0;
    return {
      commodity,
      habit,
      sim,
      score: 0.5 * sim + 0.3 * freq + 0.2 * recency,
    };
  });
}

function habitIndex(habits) {
  const habitByCid = new Map();
  for (const habit of habits || []) {
    const prev = habitByCid.get(habit.commodityId);
    if (!prev || habit.orderCount > prev.orderCount) habitByCid.set(habit.commodityId, habit);
  }
  return habitByCid;
}

function toChoice(row) {
  const count = row.habit?.orderCount ?? 0;
  const unit = row.habit?.measureUnit || row.commodity.measureUnit || "";
  const samples = Array.isArray(row.habit?.qtySamples) ? row.habit.qtySamples : [];
  const typical = samples.length ? samples[Math.floor(samples.length / 2)] : null;
  const stat = count
    ? `${count} lan, ${unit}${typical != null ? `, SL thuong ${typical}` : ""}`
    : "chua co trong don vi";
  return {
    commodityId: row.commodity.id,
    name: row.commodity.name,
    code: row.commodity.code || null,
    stat,
    score: row.score,
  };
}

function decideMatch({ rawName, commodities, habits, aliases, now = new Date() }) {
  const alias = pickAlias(aliases, rawName);
  if (alias && (commodities || []).some((c) => c.id === alias.commodityId)) return alias;

  const habitByCid = habitIndex(habits);
  const ordered = (commodities || []).filter((c) => habitByCid.has(c.id));
  let ranked = scorePool(rawName, ordered.length ? ordered : commodities || [], habitByCid, now)
    .filter((row) => row.sim >= SIM_CANDIDATE)
    .sort((a, b) => b.score - a.score);
  if (ordered.length && ranked.length === 0) {
    ranked = scorePool(rawName, commodities || [], habitByCid, now)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return {
      commodityId: null,
      source: "none",
      confidence: ranked[0]?.score ?? 0,
      needsConfirm: true,
      needsLlm: false,
      choices: ranked.filter((row) => row.sim > 0).map(toChoice),
    };
  }

  const top = ranked.slice(0, 5);
  if (!top.length) {
    return {
      commodityId: null,
      source: "none",
      confidence: 0,
      needsConfirm: true,
      needsLlm: false,
      choices: [],
    };
  }
  const second = top[1]?.score ?? 0;
  if (top[0].sim >= SIM_AUTO && top[0].score - second >= SCORE_MARGIN) {
    return {
      commodityId: top[0].commodity.id,
      source: "score",
      confidence: top[0].score,
      needsConfirm: false,
      needsLlm: false,
      choices: [],
    };
  }
  return {
    commodityId: null,
    source: "none",
    confidence: top[0].score,
    needsConfirm: false,
    needsLlm: true,
    choices: top.map(toChoice),
  };
}

function applyLlmPick(decision, pick) {
  const sku = Number(pick?.sku);
  const conf = Number(pick?.conf);
  const allowed = new Set((decision.choices || []).map((c) => c.commodityId));
  if (allowed.has(sku) && conf >= LLM_CONF) {
    return {
      ...decision,
      commodityId: sku,
      source: "llm",
      confidence: conf,
      needsConfirm: false,
      needsLlm: false,
    };
  }
  return {
    ...decision,
    commodityId: null,
    source: "none",
    needsConfirm: true,
    needsLlm: false,
    choices: (decision.choices || []).slice(0, 3),
  };
}

export {
  ALIAS_RATIO,
  LLM_CONF,
  SCORE_MARGIN,
  SIM_AUTO,
  applyLlmPick,
  decideMatch,
  nameSimilarity,
  pickAlias,
};
