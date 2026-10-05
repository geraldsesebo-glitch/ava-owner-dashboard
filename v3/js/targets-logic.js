// Plain-language pieces for the "Who you target" screen. Pure functions (no page, no network), so they can be checked on their own.
// The platform decides everything (who may set it, what is a valid value, versions); this file only turns its known list into a tidy checklist and
// its answers into plain words.

export const SLOTS = { industry: "target_industries", geography: "target_geographies" };

/** The platform's known list of one kind, in reading order: each group first, then what sits inside it (indented). */
export function buildTree(terms, kind) {
  const all = (Array.isArray(terms) ? terms : []).filter((t) => t && t.kind === kind && typeof t.term_key === "string" && typeof t.label === "string");
  const kids = new Map();
  for (const t of all) { const p = t.parent_key ?? ""; if (!kids.has(p)) kids.set(p, []); kids.get(p).push(t); }
  const byLabel = (a, b) => a.label.localeCompare(b.label);
  const out = [];
  const walk = (parent, depth) => { for (const t of (kids.get(parent) ?? []).sort(byLabel)) { out.push({ term_key: t.term_key, label: t.label, parent_key: t.parent_key ?? null, depth }); walk(t.term_key, depth + 1); } };
  walk("", 0);
  return out;
}

/** How many choices sit inside this one (a country covers its states, and so on). */
export function insideCount(tree, termKey) {
  let n = 0;
  const walk = (k) => { for (const t of tree) if (t.parent_key === k) { n++; walk(t.term_key); } };
  walk(termKey);
  return n;
}

/** Match what is set today (names stored as text) to the known list. Anything not on the list is returned separately, never silently kept or lost. */
export function matchCurrent(values, tree) {
  const selected = new Set(), unknown = [];
  for (const v of Array.isArray(values) ? values : []) {
    if (typeof v !== "string") continue;
    const hit = tree.find((t) => t.label.toLowerCase() === v.trim().toLowerCase());
    if (hit) selected.add(hit.term_key); else unknown.push(v.slice(0, 80));
  }
  return { selected, unknown };
}

export function labelsOf(tree, selected) { return tree.filter((t) => selected.has(t.term_key)).map((t) => t.label); }

const listText = (xs) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);

/** One sentence: what Ava will be allowed to search for. */
export function describeChoice(kinds, places) {
  if (!kinds.length && !places.length) return "Nothing is chosen yet.";
  if (!kinds.length) return `Places: ${listText(places)}. You have not chosen any kinds of company yet.`;
  if (!places.length) return `Kinds of company: ${listText(kinds)}. You have not chosen any places yet.`;
  return `Ava may search for ${listText(kinds)} companies in ${listText(places)}.`;
}

/** What is different from what is set today, in words. */
export function changeSummary(before, after, noun) {
  const b = new Set(before.map((x) => x.toLowerCase())), a = new Set(after.map((x) => x.toLowerCase()));
  const added = after.filter((x) => !b.has(x.toLowerCase())), removed = before.filter((x) => !a.has(x.toLowerCase()));
  if (!added.length && !removed.length) return { changed: false, text: `${noun}: no change.` };
  const bits = [];
  if (added.length) bits.push(`adding ${listText(added)}`);
  if (removed.length) bits.push(`taking out ${listText(removed)}`);
  return { changed: true, text: `${noun}: ${bits.join(" and ")}.` };
}

/** Can the owner press Confirm? At least one list changed, and a list that is being changed must not end up empty. */
export function canConfirm({ kindsBefore, kindsAfter, placesBefore, placesAfter }) {
  const k = changeSummary(kindsBefore, kindsAfter, "k").changed, p = changeSummary(placesBefore, placesAfter, "p").changed;
  if (!k && !p) return { ok: false, reason: "Nothing has changed yet." };
  if (k && kindsAfter.length === 0) return { ok: false, reason: "Choose at least one kind of company, or leave that list as it is." };
  if (p && placesAfter.length === 0) return { ok: false, reason: "Choose at least one place, or leave that list as it is." };
  return { ok: true, reason: "" };
}

/** The platform refused to save. Plain words, never a code. */
export function saveRefusal(res) {
  const status = res?.status, msg = String(res?.data?.message ?? "");
  if (status === 0) return "Could not reach the project. Check your connection and try again. Nothing was saved.";
  if (status === 401) return "Your sign-in ended. Please sign in again.";
  if (/only an org owner/i.test(msg) || status === 403) return "Only an owner of this company can change who it targets.";
  if (/invalid value|a value is required/i.test(msg)) return "That choice was not accepted. Please pick from the list and try again.";
  if (/unknown knowledge slot/i.test(msg)) return "Ava could not find that setting. Nothing was saved.";
  return "Something went wrong, so this was not saved. Please try again.";
}
