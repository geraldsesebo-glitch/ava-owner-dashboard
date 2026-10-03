// Plain-language pieces for the "Add goal" screen. Pure functions (no page, no network), so they can be checked on their own.
// The goal reader (the objective-intake function) and the platform decide everything; this file only turns what they return into plain words.

export const MAX_GOAL_CHARS = 2000;
export const EXAMPLES = ["Find 100 security companies in Nigeria", "Find 40 hotels in Abuja with more than 50 employees"];

/** Polite check of what was typed, before anything is sent. */
export function checkInput(text) {
  const t = typeof text === "string" ? text.trim() : "";
  if (t === "") return { ok: false, message: "Please type your goal first, in your own words. For example: Find 100 security companies in Nigeria." };
  if (t.length < 8) return { ok: false, message: "That is a bit short for Ava to understand. Try a full sentence, such as: Find 50 hotels in Abuja." };
  if (t.length > MAX_GOAL_CHARS) return { ok: false, message: `Please keep the goal under ${MAX_GOAL_CHARS} characters.` };
  return { ok: true, message: "" };
}

const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : []);
const PLURAL = { industries: "kinds of company", geographies: "places" };

/** What Ava understood, as labelled rows. `guessed` marks anything she guessed (provenance "inferred"); an owner-confirmed value is no longer a guess. */
export function understood(state) {
  const o = state?.objective ?? {};
  const c = o.criteria && typeof o.criteria === "object" ? o.criteria : {};
  const f = o.interpretation?.fields && typeof o.interpretation.fields === "object" ? o.interpretation.fields : {};
  const g = (...keys) => keys.some((k) => f[k] === "inferred");
  const rows = [];
  rows.push({ label: "How many companies", value: Number.isInteger(o.quantity) ? String(o.quantity) : "Not clear yet", guessed: g("quantity") });
  const ind = list(c.industries), geo = list(c.geographies), exc = list(c.exclusions);
  rows.push({ label: "Kind of company", value: ind.length ? ind.join(", ") : "Not clear yet", guessed: g("industries") });
  rows.push({ label: "Place", value: geo.length ? geo.join(", ") : "Not clear yet", guessed: g("geographies") });
  const lo = c.employee_min, hi = c.employee_max;
  let size = "No size preference";
  if (Number.isInteger(lo) && Number.isInteger(hi)) size = `Between ${lo} and ${hi} employees`;
  else if (Number.isInteger(lo)) size = `At least ${lo} employees`;
  else if (Number.isInteger(hi)) size = `Up to ${hi} employees`;
  rows.push({ label: "Size", value: size, guessed: g("employee_min", "employee_max") });
  if (exc.length) rows.push({ label: "Leave out", value: exc.join(", "), guessed: g("exclusions") });
  if (typeof c.offering === "string" && c.offering) rows.push({ label: "What they may need", value: c.offering, guessed: g("offering") });
  const notes = list(o.interpretation?.notes).map((n) => n.slice(0, 220));
  const missing = list(state?.missing);
  return { rows, notes, missing, anyGuessed: rows.some((r) => r.guessed) };
}

/** Does the goal fit what the company says it targets? Lines are plain words; `compatible` is null when there is nothing to say. */
export function fitLines(state) {
  const td = state?.target_definition;
  if (!td || td.basis !== "current_definition") return { compatible: null, lines: [] };
  if (td.compatible) return { compatible: true, lines: ["This fits what your company targets."] };
  const lines = ["This goal is outside what your company targets, so it cannot be confirmed as it is."];
  for (const x of Array.isArray(td.findings) ? td.findings : []) {
    if (x.status === "within" || x.status === "inherited") continue;
    const what = PLURAL[x.criterion] ?? "targets";
    const v = String(x.value ?? "").replace(/[\u0000-\u001f]/g, " ").slice(0, 80);
    switch (x.status) {
      case "outside": lines.push(`“${v}” is not among the ${what} your company has chosen. Change the goal, or add it to what your company targets first.`); break;
      case "unrecognized": lines.push(`Ava does not recognise “${v}”, so she cannot check it. Try other words.`); break;
      case "no_definition": lines.push(`Your company has not chosen its ${what} yet, so “${v}” cannot be checked.`); break;
      case "disqualified": lines.push(`“${v}” is on your company's list of companies to rule out.`); break;
      case "unverifiable": lines.push(`“${v}” cannot be checked because your rule-out list contains something Ava does not recognise.`); break;
      default: lines.push(`“${v}” cannot be checked against what your company targets.`);
    }
  }
  return { compatible: false, lines };
}

/** After a goal is confirmed: what Ava still needs before she can start (the platform's own list, in its own words). */
export function blockedLines(state) {
  const b = Array.isArray(state?.blocked_by) ? state.blocked_by : [];
  return b.map((x) => String(x?.question ?? x?.label ?? "Some information about your company").slice(0, 200));
}

export const isConfirmed = (state) => state?.objective?.status === "confirmed";
export const isCancelled = (state) => state?.objective?.status === "cancelled";

/** A refusal from the goal reader or the platform, in plain words. `localHint` is added when the page is the local preview, which the goal reader does not allow. */
export function refusalText(res, { localHint = false } = {}) {
  const status = res?.status, d = res?.data && typeof res.data === "object" ? res.data : {};
  const err = typeof d.error === "string" ? d.error : "";
  if (status === 0) return `Could not reach Ava's goal reader. Check your connection and try again.${localHint ? " (This copy on your own computer is not allowed to talk to it; open the hosted page instead.)" : ""}`;
  if (status === 401) return "Your sign-in ended. Please sign in again.";
  if (status === 403 || err === "not_authorized") return "Only an owner of this company can add or confirm goals.";
  if (err === "quantity_not_allowed") return Number.isInteger(d.max_quantity) ? `That is more companies than Ava can take for one goal right now. The most is ${d.max_quantity}. Please ask for ${d.max_quantity} or fewer.` : "That is more companies than Ava can take for one goal right now. Please ask for fewer.";
  if (err === "too_many_open_objectives") return "There are too many goals waiting for your OK, or too many goals in total. Confirm or cancel some first.";
  if (err === "objective_incomplete") return "Ava still needs to know the kind of company or the place before this goal can be confirmed.";
  if (err === "invalid_objective") return "Part of that goal is not something Ava can accept. Try saying it in other words.";
  if (err === "goal_too_long" || status === 413) return `Please keep the goal under ${MAX_GOAL_CHARS} characters.`;
  if (err === "stale_revision") return "This goal changed since you last looked at it. Please review it again.";
  if (err === "objective_not_editable") return "This goal was already confirmed or cancelled, so it cannot be changed.";
  if (err === "objective_not_found" || status === 404) return "That goal could not be found.";
  if (status >= 400 && status < 500) return "Ava could not accept that request. Nothing was started.";
  return "Something went wrong on our side. Nothing was started. Please try again.";
}
