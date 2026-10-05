// Plain-language pieces for "Research with Ava" (chapter 3). Pure functions (no page, no network), so they can be checked on their own.
// The platform decides everything (permission, price check, per-company AI limits, what may be stored); this file only chooses which companies to send and words the answers.

/** The research helper takes at most this many companies in one call; the screen asks again for the next ones. */
export const CHUNK = 3;

export const chunk = (ids, n = CHUNK) => { const out = []; for (let i = 0; i < ids.length; i += n) out.push(ids.slice(i, i + n)); return out; };

/** Companies worth sending: not yet judged, have a website, and are not marked do-not-contact. */
export const needsResearch = (r) => !!r && !r.fit_label && !r.needs_website && !r.opted_out;
export const toResearch = (rows) => (Array.isArray(rows) ? rows : []).filter(needsResearch).map((r) => r.subject_id);

export const FIT_WORDS = { strong: "Strong fit", maybe: "Maybe a fit", weak: "Not a good fit", unclear: "Not enough to tell" };
export const fitWords = (label) => FIT_WORDS[label] ?? "Not judged yet";
export const fitTone = (label) => (label === "strong" ? "good" : label === "maybe" ? "warn" : label === "weak" ? "bad" : "");

/** A link is only ever shown as a link if it is a plain web address. */
export const safeLink = (u) => { try { const x = new URL(String(u)); return x.protocol === "http:" || x.protocol === "https:" ? x.toString() : null; } catch { return null; } };

const REASONS = {
  ai_prices_not_set: "The AI prices are not set yet. Enter them on “What things cost” first.",
  ai_cost_unknown: "An earlier AI call has no price, so the spending limit cannot be checked. Enter the AI prices on “What things cost”.",
  ai_cost_cap_reached: "This company has already used its AI money for this month ($0.02), so Ava stopped.",
  ai_call_limit_reached: "This company has already used its 2 AI calls for this month, so Ava stopped.",
  no_target_defined: "Ava needs to know what you sell and who you want. Fill in “What we sell and who we want” on Company information first.",
  no_model_policy: "No AI model is set up for this company yet.",
  company_not_found: "That company could not be found.",
  no_website: "This company has no website to read.",
};
const MODEL = {
  no_model_provider_configured: "The AI key has not been added yet, so nothing was asked. This is a step only the owner can do.",
  budget_exceeded: "Ava reached this company's limit on AI calls and stopped.",
  invalid_output: "The AI's answer did not pass the safety check, so it was thrown away.",
  provider_failed: "The AI service did not answer. Nothing was saved.",
  no_approved_model: "No approved AI model is available for this job.",
  no_model_policy: "No AI model is set up for this company yet.",
};
const SITE = {
  site_unreachable: "The website could not be opened.",
  blocked_by_robots: "The website asks robots not to read it, so Ava did not.",
  no_readable_text: "The website had no text Ava could read.",
  address_not_allowed: "That website address was not allowed, so Ava did not open it.",
};

/** One short plain sentence for a reason code from the helper or the platform. Never shows the code itself. */
export function reasonWords(code) {
  const c = String(code ?? "");
  if (REASONS[c]) return REASONS[c];
  if (/^authorization_/.test(c)) return "Ava is not allowed to judge fit yet. Switch on “Judge whether a company is a good fit” in What Ava may do.";
  const m = /^model_(.+)$/.exec(c);
  if (m && MODEL[m[1]]) return MODEL[m[1]];
  const w = /^connector_(.+)$/.exec(c);
  const site = w ? w[1] : c;
  if (SITE[site]) return SITE[site];
  if (/^connector_/.test(c)) return "Ava was not allowed to read that website.";
  return "Something went wrong, so nothing was saved for this company.";
}

/** One line for one company's outcome. */
export function outcomeLine(o, name) {
  const who = name || "This company";
  if (!o || typeof o !== "object") return `${who}: no answer.`;
  if (o.status === "done") return `${who}: ${fitWords(o.label).toLowerCase()}${o.reasons ? `, with ${o.reasons} ${o.reasons === 1 ? "reason" : "reasons"} from its website` : ", with no reason that passed the check"}.`;
  if (o.status === "needs_website") return `${who}: needs a website before Ava can read about it.`;
  return `${who}: ${reasonWords(o.reason)}`;
}

/** The one note shown when a whole run could not even start (the helper itself said no). */
export function startRefusal(res) {
  const s = res?.status;
  if (s === 0) return "Could not reach the research helper. Nothing was changed.";
  if (s === 401) return "Your sign-in ended. Please sign in again.";
  if (s === 403) return "Only an owner of this company can ask Ava to research.";
  if (s === 404) return "The research helper is not installed on this project.";
  return "The research could not start. Nothing was spent.";
}

/** The latest stored assessment for one company, as plain data for the screen (always labelled as not verified). */
export function shapeAssessment(row) {
  const v = row && typeof row === "object" ? row.claim_value : null;
  if (!v || typeof v !== "object") return null;
  const reasons = (Array.isArray(v.reasons) ? v.reasons : []).filter((r) => r && typeof r.text === "string" && typeof r.quote === "string").slice(0, 3)
    .map((r) => ({ text: r.text, quote: r.quote, link: safeLink(r.source_url) }));
  return {
    label: v.label, score: Number.isFinite(Number(v.score)) ? Number(v.score) : null, reasons, missing: typeof v.missing === "string" ? v.missing : null,
    discarded: Number(v.discarded_reasons) || 0, verified: !!row.verified_at, when: row.created_at ? String(row.created_at).slice(0, 10) : null,
  };
}
