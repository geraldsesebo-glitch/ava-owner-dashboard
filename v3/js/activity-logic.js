// Plain-sentence activity, grouped by day, with repeats folded into one line that opens. Pure functions (no page, no network), so they can be checked on their own.
// The sentence for each line comes from eventSentence in text.js; nothing here invents a fact, and no line is left vague.

const VAGUE = "Another behind-the-scenes step.";
const humanise = (t) => String(t ?? "").replace(/[^a-z0-9_]/gi, "").replace(/_/g, " ").trim();

/** The sentence for one line. A line the wording table does not know still names what happened (never "another step"). */
export function lineText(ev, s) {
  if (s && s.text && s.text !== VAGUE) return s.text;
  const t = humanise(ev?.event_type);
  return t ? `Behind the scenes: ${t}.` : "Behind the scenes: a step was recorded.";
}

const FOLD = {
  knowledge_version_confirmed: (n) => `You confirmed ${n} company settings`,
  knowledge_version_created: (n) => `${n} drafts of company settings were saved`,
  outreach_draft_created: (n) => `Ava wrote ${n} messages for you to approve`,
  outreach_draft_approved: (n) => `You approved ${n} messages`,
  outreach_draft_rejected: (n) => `${n} messages were rejected`,
  outreach_sent: (n) => `${n} TEST messages were sent to your test inbox`,
  discovery_page_ingested: (n) => `Ava looked through ${n} pages of search results`,
  discovery_run_started: (n) => `Ava started ${n} searches`,
  discovery_run_finished: (n) => `${n} searches finished`,
  company_research_completed: (n) => `Ava read ${n} company websites and judged how well they fit`,
  evidence_recorded: (n) => `Ava saved ${n} facts she found`,
  entity_identifier_added: (n) => `Ava saved ${n} ways to recognise companies later`,
  entity_profile_created: (n) => `Ava added ${n} companies to the ones she knows`,
  owner_objective_confirmed: (n) => `You confirmed ${n} goals`,
  owner_objective_proposed: (n) => `${n} goals were added`,
  reply_recorded: (n) => `${n} replies were recorded`,
  reply_categorized: (n) => `${n} replies were sorted`,
  ai_authority_set: (n) => `${n} permissions for Ava were changed`,
  work_item_transition: (n) => `${n} research jobs changed state`,
  execution_run_completed: (n) => `${n} steps finished`,
  authorization_decision: (n) => `${n} permission checks were made`,
};
export function foldText(type, n, firstText) {
  const f = FOLD[type];
  return f ? f(n) : `${n} similar steps. The latest: ${String(firstText ?? "").replace(/\.$/, "")}`;
}

const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export function dayLabel(key, now = new Date()) {
  const today = dayKey(now.toISOString()), y = new Date(now); y.setDate(y.getDate() - 1);
  if (key === today) return "Today";
  if (key === dayKey(y.toISOString())) return "Yesterday";
  const [yy, mm, dd] = key.split("-").map(Number);
  return new Date(yy, mm - 1, dd).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
}

/**
 * events: [{ ev, s }] newest first (s = { headline, text }). Options: all (show every step), q (search words).
 * Returns days newest first: [{ key, label, items: [ { kind: "line", ev, text } | { kind: "group", type, text, lines: [ { ev, text } ] } ] }].
 */
export function buildActivity(events, { all = false, q = "" } = {}) {
  const needle = String(q).trim().toLowerCase();
  const days = new Map();
  for (const { ev, s } of events) {
    if (!ev?.created_at || !Number.isFinite(Date.parse(ev.created_at))) continue;
    if (!all && !s?.headline) continue;
    const text = lineText(ev, s);
    if (needle && !text.toLowerCase().includes(needle)) continue;
    const key = dayKey(ev.created_at);
    if (!days.has(key)) days.set(key, new Map());
    const byType = days.get(key), type = String(ev.event_type ?? "other");
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push({ ev, text });
  }
  return [...days.keys()].sort().reverse().map((key) => {
    const entries = [...days.get(key).entries()].map(([type, lines]) => ({ type, lines, at: Date.parse(lines[0].ev.created_at) })).sort((a, b) => b.at - a.at);
    return {
      key, label: dayLabel(key),
      items: entries.map(({ type, lines }) => lines.length >= 2 ? { kind: "group", type, text: foldText(type, lines.length, lines[0].text), lines } : { kind: "line", ev: lines[0].ev, text: lines[0].text }),
    };
  });
}

/** How many lines (a folded group counts as one) are in all days, to page long histories. */
export const countItems = (days) => days.reduce((n, d) => n + d.items.length, 0);
export function limitDays(days, max) {
  let left = max; const out = [];
  for (const d of days) { if (left <= 0) break; out.push({ ...d, items: d.items.slice(0, left) }); left -= d.items.length; }
  return out;
}
