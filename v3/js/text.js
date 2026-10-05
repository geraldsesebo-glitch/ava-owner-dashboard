// Plain-language wording for everything the dashboard shows. Pure functions (no page, no network), so they can be checked on their own.
// Rule: the owner never has to read a code. Where a code has no wording yet, we say so honestly and keep the code only as small "details".

/** A company whose name starts with the word DEMO is the pretend company. */
export function companyKind(name) {
  return typeof name === "string" && /^DEMO(?![A-Za-z0-9])/.test(name) ? "pretend" : "real";
}

const REASONS = {
  source_exhausted: "Ava went through everything the search source had.",
  org_suspended: "The company is paused (Ava is paused).",
  organization_suspended: "The company is paused (Ava is paused).",
  preflight_organization_suspended: "The company is paused (Ava is paused).",
  page_attempt_limit_reached: "A safety limit was reached, so the search stopped.",
  page_retry_limit_reached: "A search step kept failing, so the search stopped.",
  safety_ceiling_reached: "A safety limit was reached, so the search stopped.",
  limit_reached: "A safety limit was reached, so the search stopped.",
  time_budget_reached: "This search ran out of time for one go. Press the button again to continue.",
  provider_disabled: "The search route is switched off for this company.",
  no_discovery_provider_enabled: "The search route is switched off for this company.",
  no_discovery_provider_available: "No search source is switched on yet, so nothing was searched.",
  provider_not_registered: "No search source is switched on yet, so nothing was searched.",
  discovery_authority_missing: "Ava has not been allowed to search for companies.",
  discovery_requires_approval_unsupported: "Searching is set to need your approval each time, which is not available yet.",
  discovery_not_ready: "Ava still needs some information about your company before she can search.",
  discovery_capability_not_implemented: "Searching for companies is not available yet.",
  objective_cancelled: "The goal was cancelled.",
  objective_not_confirmed: "The goal has not been confirmed yet.",
  objective_snapshot_invalid: "The goal no longer fits what your company said it targets.",
  actor_not_ai_employee: "Ava is not set up for this company.",
  lifecycle_stage_missing: "The company is missing a setup step.",
  connector_operation_not_registered: "The search route is not set up.",
  organization_not_allowed_here: "This test helper only works for the pretend company.",
  page_in_flight: "A search step was already running. Try again in a moment.",
  lease_expired: "A search step got stuck and was cancelled. It can be tried again.",
  credential_not_configured: "The search source is missing its access key.",
  provider_credential_not_configured: "The search source is missing its access key.",
  provider_key_not_configured: "The search source is missing its access key.",
  unsupported_industry: "The search source cannot search for that kind of company yet.",
  unsupported_place: "The search source cannot search that place yet.",
  unsupported_criteria: "The search source cannot search by something the goal asks for (such as company size).",
  criteria_required: "The goal needs both a kind of company and a place.",
  provider_returned_more_than_asked: "The search source sent more companies than asked for, so the search stopped to protect your credits.",
  provider_billed_more_than_asked: "The search source charged more than expected, so the search stopped to protect your credits.",
  provider_rate_limited: "The search source asked us to slow down. Try again in a minute.",
  provider_unreachable: "The search source could not be reached.",
  malformed_provider_response: "The search source sent an answer that could not be read.",
  provider_entitlement_unavailable: "The search source's plan does not allow this search.",
  unsupported_operation: "The search source cannot do that kind of search.",
  invalid_search_request: "The search could not be understood by the source.",
  execution_run_not_started: "A search step could not start.",
  provider_http_401: "The search source refused the access key.",
  provider_http_403: "The search source refused the access key.",
  connector_timeout: "The search source took too long to answer.",
  iteration_guard: "The search stopped itself as a safety measure.",
  criterion_unsupported: "The search source cannot search by something the goal asks for.",
  already_satisfied: "The goal is already complete.",
  discovery_already_satisfied: "The goal is already complete.",
};

/** { text, code } - code is only for the small "details" line and only when we had no plain wording. */
export function plainReason(code) {
  if (typeof code !== "string" || code === "") return { text: "Stopped.", code: null };
  const c = code.toLowerCase();
  if (REASONS[c]) return { text: REASONS[c], code: null };
  // a reason with the source's own explanation after a colon ("invalid_search_request:<what the source said>"): plain words first, the explanation only as small details
  const base = c.split(":")[0];
  if (c.includes(":") && REASONS[base]) return { text: REASONS[base], code: c.slice(0, 100) };
  if (c.startsWith("criterion_unsupported")) return { text: REASONS.criterion_unsupported, code: null };
  if (c.startsWith("preflight_")) {
    const inner = plainReason(c.slice("preflight_".length));
    return inner.code === null ? inner : { text: "A search was stopped before it started.", code: c };
  }
  return { text: "Stopped for a reason that has no plain wording yet.", code: c.slice(0, 80) };
}

const COMPANY_WORD = (n) => (n === 1 ? "company" : "companies");

/** One sentence about a search run. `found` = companies this goal has found so far (counted by the page); `run` is a discovery_runs row. */
export function runSentence(run, goalQuantity, found) {
  if (!run) return { text: "No search has been run for this goal yet.", tone: "neutral", code: null };
  const want = goalQuantity ?? run.requested ?? 0;
  const got = typeof found === "number" ? found : (run.discovered ?? 0);
  const reason = run.termination_reason;
  switch (run.status) {
    case "running":
      return { text: "A search is partway through. Press “Run a search now” to continue.", tone: "wait", code: null };
    case "completed":
      return { text: `Finished: found all ${want} ${COMPANY_WORD(want)} you asked for.`, tone: "good", code: null };
    case "partial": {
      if (reason === "source_exhausted") return { text: `Finished: Ava looked through everything the source had and found ${got} of ${want}.`, tone: "good", code: null };
      const r = plainReason(reason);
      return { text: `Stopped after finding ${got} of ${want}. ${r.text}`, tone: "warn", code: r.code };
    }
    case "blocked": {
      const r = plainReason(reason);
      return { text: `Not searching. ${r.text}`, tone: "warn", code: r.code };
    }
    case "cancelled":
      return { text: "This search was cancelled.", tone: "neutral", code: null };
    case "failed": {
      const r = plainReason(reason);
      return { text: `The search stopped. ${r.text}`, tone: "bad", code: r.code };
    }
    default:
      return { text: "The search is in a state we have no wording for yet.", tone: "neutral", code: null };
  }
}

const SET_ASIDE = {
  outside_geography: "Outside the place you asked for.",
  outside_industry: "Not the kind of company you asked for.",
  outside_size: "Not the size you asked for.",
  outside_exclusions: "On your list of companies to leave out.",
  geography_insufficient: "Not enough information about where it is.",
  industry_insufficient: "Not enough information about what it does.",
  size_insufficient: "Not enough information about its size.",
  exclusions_insufficient: "Could not check it against your leave-out list.",
  no_strong_identifier: "No website or other way to tell it apart from other companies.",
  identity_conflict: "Looks like a company Ava already knows, but the details disagree.",
  name_missing: "The entry had no company name.",
  not_an_object: "The entry was unreadable.",
  processing_error: "The entry could not be processed.",
  same_company_in_run: "The same company appeared twice in this search.",
  already_in_pool: "Ava already knew this company.",
  new_candidate: "New company that fits what you asked for.",
  possible_duplicate_flagged: "New, but it may be a duplicate of one Ava knows. Worth a look.",
};

/** A found company that came without a website: still a valid company (it is told apart by the source's own id), but worth saying so. Only for real entries with a name. */
export function noWebsite(candidate) {
  const c = candidate && typeof candidate === "object" ? candidate : {};
  return typeof c.name === "string" && c.name.trim() !== "" && !(typeof c.domain === "string" && c.domain.trim() !== "");
}

/** How many companies the search source handed back for one search. It names no source and invents no cost: the price list (empty today) is what turns this into money. */
export function returnedNote(run) {
  const n = run?.provider_records_inspected;
  if (!Number.isInteger(n) || n <= 0) return "";
  return `The source returned ${n} ${n === 1 ? "company" : "companies"} for this search.`;
}

export function dispositionLabel(disposition) {
  switch (disposition) {
    case "discovered": return "New";
    case "already_known": return "Already known";
    case "duplicate_in_run": return "Seen twice";
    case "rejected_outside": return "Set aside";
    case "insufficient_evidence": return "Set aside";
    case "malformed": return "Set aside";
    default: return "Other";
  }
}

export function candidateReason(candidate) {
  const r = candidate?.reason;
  return SET_ASIDE[r] ?? "No plain wording for this reason yet.";
}

const AXIS_NAME = { industry: "kind of company", geography: "place", size: "size", exclusions: "leave-out list" };

/** "Why it fits" from the stored match: only axes that actually mattered are mentioned. */
export function fitSentence(axes) {
  if (!axes || typeof axes !== "object") return "";
  const ok = [], thin = [], bad = [];
  for (const k of ["industry", "geography", "size", "exclusions"]) {
    const v = axes[k];
    if (v === "matched" || v === "within" || v === "inherited") ok.push(AXIS_NAME[k]);
    else if (v === "outside") bad.push(AXIS_NAME[k]);
    else if (v === "insufficient" || v === "unverified" || v === "partial") thin.push(AXIS_NAME[k]);
  }
  const parts = [];
  if (ok.length) parts.push(`Matches your ${join(ok)}.`);
  if (bad.length) parts.push(`Does not match your ${join(bad)}.`);
  if (thin.length) parts.push(`Not enough information to check the ${join(thin)}.`);
  return parts.join(" ");
}

function join(list) {
  if (list.length <= 1) return list.join("");
  return list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
}

const CAPABILITIES = {
  research_prospect: "Look up a company",
  discover_prospects: "Search for new companies",
  run_discovery_unattended: "Search on her own, without being asked",
  engage_prospect: "Contact a company",
};
export function capabilityLabel(key) {
  return CAPABILITIES[key] ?? "Another ability";
}

const OBJECTIVE_STATUS = {
  awaiting_confirmation: "Waiting for your OK",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};
export function goalStatusLabel(status) {
  return OBJECTIVE_STATUS[status] ?? "Unknown";
}

export function goalCriteriaLine(criteria) {
  const c = criteria && typeof criteria === "object" ? criteria : {};
  const bits = [];
  if (Array.isArray(c.industries) && c.industries.length) bits.push(c.industries.join(", "));
  if (Array.isArray(c.geographies) && c.geographies.length) bits.push(`in ${c.geographies.join(", ")}`);
  if (typeof c.employee_min === "number" || typeof c.employee_max === "number") {
    const lo = typeof c.employee_min === "number" ? `${c.employee_min}+` : "";
    const hi = typeof c.employee_max === "number" ? `up to ${c.employee_max}` : "";
    bits.push(`${[lo, hi].filter(Boolean).join(" ")} employees`);
  }
  return bits.join(" ");
}

// ---- history ------------------------------------------------------------------------------------------------------------------------------
const WORK_TO = { completed: "finished", failed: "failed", active: "started", queued: "waiting to start", paused: "paused", needs_human: "waiting for you", cancelled: "cancelled" };
const WORK_FROM = { completed: "finished", failed: "failed", active: "running", queued: "waiting to start", paused: "paused", needs_human: "waiting for you", cancelled: "cancelled" };
const CLOSED_BECAUSE = { company_not_found: "the data service had no record of the company" };
const CATEGORY_WORDS = { interested: "Interested", not_now: "Not now", not_interested: "Not interested", question: "Has a question", unsubscribe: "Asked not to be contacted" };
const SLOT_LABEL = { target_industries: "the kinds of company you target", target_geographies: "the places you target" };

/** A name that came from the database: plain text only, no control characters, never long. Returns "" if there is nothing usable. */
function tidy(v, max = 60) {
  if (typeof v !== "string") return "";
  const t = v.replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}
const quoted = (s) => (s ? `“${s}”` : "");
const isId = (v) => typeof v === "string" && v.length > 0 && v.length <= 64;

/**
 * Helps a history line say WHICH job or goal it is about. It only looks names up in what the page has already loaded; nothing new is fetched
 * for a line, and anything it cannot find simply gets a plainer sentence ("a research job"). All lookups are by id, none by guessing.
 *   jobs:       work items         { id, context: { company_name } }
 *   executions: job runs           { id, work_item_id }
 *   goals:      the company's goals { id, source_goal_text, quantity }
 *   runs:       searches           { id, owner_objective_id }
 */
export function makeResolver({ jobs, executions, goals, runs, companies } = {}) {
  const arr = (x) => (Array.isArray(x) ? x : []);
  const jobById = new Map(arr(jobs).filter((j) => j && isId(j.id)).map((j) => [j.id, j]));
  const jobOfRun = new Map(arr(executions).filter((e) => e && isId(e.id) && isId(e.work_item_id)).map((e) => [e.id, e.work_item_id]));
  const goalById = new Map(arr(goals).filter((g) => g && isId(g.id)).map((g) => [g.id, g]));
  const goalOfSearch = new Map(arr(runs).filter((r) => r && isId(r.id) && isId(r.owner_objective_id)).map((r) => [r.id, r.owner_objective_id]));
  const coById = new Map(arr(companies).filter((c) => c && isId(c.subject_id)).map((c) => [c.subject_id, c]));
  const company = (workItemId) => {
    const j = isId(workItemId) ? jobById.get(workItemId) : null;
    const c = j && j.context && typeof j.context === "object" ? j.context : null;
    return c ? tidy(c.company_name) : "";
  };
  return {
    /** The company a job is about, or "". */
    jobCompany: company,
    /** A company's name from its id (the owner's pipeline), or "". */
    subjectName: (subjectId) => (isId(subjectId) ? tidy(coById.get(subjectId)?.name) : ""),
    /** The job a logged run belonged to -> its company, or "". */
    runCompany: (executionId) => (isId(executionId) ? company(jobOfRun.get(executionId)) : ""),
    jobReason: (workItemId) => {
      const j = isId(workItemId) ? jobById.get(workItemId) : null;
      const r = j && j.context && typeof j.context === "object" ? j.context.closed_reason : null;
      return typeof r === "string" && CLOSED_BECAUSE[r] ? CLOSED_BECAUSE[r] : "";
    },
    /** A goal in the owner's own words, shortened, or "". */
    goalText: (objectiveId) => { const g = isId(objectiveId) ? goalById.get(objectiveId) : null; return g ? tidy(g.source_goal_text, 70) : ""; },
    goalOfSearch: (runId) => (isId(runId) ? goalOfSearch.get(runId) ?? null : null),
  };
}
const NONE = makeResolver();

/**
 * One audit-log row -> { headline: true/false, text }. headline=false rows are "behind the scenes" steps, hidden unless asked for.
 * Only a few whitelisted fields of `detail` are ever read; the raw detail is never shown. `r` (optional) is a resolver from makeResolver;
 * with it the sentence names the company or goal, without it the sentence is simply a little plainer.
 */
export function eventSentence(ev, r = NONE) {
  const d = ev?.detail && typeof ev.detail === "object" ? ev.detail : {};
  const forCompany = (name, fallback) => (name ? ` for ${quoted(name)}` : fallback ?? "");
  const goalWords = (id) => { const g = r.goalText(id); return g ? ` ${quoted(g)}` : ""; };
  const runCo = r.runCompany(ev?.execution_id) || r.jobCompany(d.work_item_id);
  const searching = ev?.capability_key === "discover_prospects";   // a step of a company search, not a research job on one company
  switch (ev?.event_type) {
    case "ai_employee_provisioned":
      return ev.decision === "deny" ? { headline: true, text: "Someone tried to create an AI employee and was refused." }
        : { headline: true, text: `${typeof d.name === "string" && tidy(d.name, 40) ? tidy(d.name, 40) : "An AI employee"} was created.` };
    case "organization_status_changed":
      return { headline: true, text: d.to === "suspended" ? "Ava was paused. Nothing is running." : "Ava was resumed and can work again." };
    case "owner_objective_proposed":
    case "owner_objective_created":
    case "objective_created": {
      const q = Number.isInteger(d.quantity) && d.quantity > 0 ? ` (${d.quantity} companies)` : "";
      const g = goalWords(d.objective_id);
      return { headline: true, text: g ? `A goal was added:${g}.` : `A goal was added${q}.` };
    }
    case "owner_objective_confirmed": {
      const g = goalWords(d.objective_id);
      return { headline: true, text: g ? `You confirmed the goal:${g}.` : "A goal was confirmed." };
    }
    case "owner_objective_cancelled": {
      const g = goalWords(d.objective_id);
      return { headline: true, text: g ? `You cancelled the goal:${g}.` : "A goal was cancelled." };
    }
    case "discovery_run_started": {
      const g = goalWords(d.objective_id);
      const n = Number.isInteger(d.requested) && d.requested > 0 ? ` Asked for ${d.requested} companies.` : "";
      return { headline: true, text: g ? `Ava started a search for the goal${g}.${n}` : `Ava started a search for companies.${n}` };
    }
    case "discovery_provider_selected":
      return { headline: false, text: typeof d.provider === "string" && /mock/i.test(d.provider) ? "The practice (pretend) search source was chosen for the search." : "A search source was chosen for the search." };
    case "discovery_preflight": {
      const pg = Number.isInteger(d.page_no) && d.page_no > 0 ? ` for page ${d.page_no}` : "";
      return ev.decision === "deny" || d.ok === false
        ? { headline: true, text: `A search step${pg} was stopped before it started. ${plainReason(d.reason).text}` }
        : { headline: false, text: `A search step${pg} passed its last safety check.` };
    }
    case "discovery_page_ingested": {
      const parts = [];
      const add = (n, w) => { if (Number.isInteger(n) && n > 0) parts.push(`${n} ${w}`); };
      add(d.discovered, "new");
      add(d.already_known, "already known");
      add(d.duplicate_in_run, "repeated in this search");
      add(d.rejected_outside, "outside what you target");
      add(d.insufficient_evidence, "without enough information");
      add(d.malformed, "unreadable");
      const pg = Number.isInteger(d.page_no) && d.page_no > 0 ? `page ${d.page_no}` : "a page";
      const seen = Number.isInteger(d.records) ? `${d.records} ${d.records === 1 ? "company" : "companies"} on ${pg}` : pg;
      return { headline: true, text: `Ava looked through ${seen}${parts.length ? `: ${parts.join(", ")}` : ""}.` };
    }
    case "discovery_page_failed":
      return { headline: true, text: `A search step failed. ${plainReason(d.reason).text}` };
    case "discovery_orphan_reclaimed":
      return { headline: true, text: "A search step got stuck and was cancelled so it could be tried again." };
    case "discovery_run_finished": {
      const s = typeof d.status === "string" ? d.status : "";
      const rr = plainReason(d.reason).text;
      const n = Number.isInteger(d.discovered) ? d.discovered : null;
      const lead = s === "completed" ? "The search finished with everything asked for." : s === "partial" ? "The search finished." : s === "cancelled" ? "The search was cancelled." : "The search stopped.";
      const g = goalWords(r.goalOfSearch(d.run_id));
      return { headline: true, text: `${lead}${g ? ` Goal:${g}.` : ""}${n !== null ? ` New companies found: ${n}.` : ""} ${d.reason ? rr : ""}`.trim() };
    }
    case "work_item_transition": {
      const co = r.jobCompany(d.work_item_id), now = WORK_TO[d.new_status], was = WORK_FROM[d.old_status];
      const why = d.new_status === "failed" ? r.jobReason(d.work_item_id) : "";
      const what = now ? (was && was !== now ? `changed from ${was} to ${now}` : `is now ${now}`) : "changed";
      return { headline: true, text: `The research job${forCompany(co)} ${what}.${why ? ` Reason: ${why}.` : ""}` };
    }
    case "work_item_claimed":
      return { headline: false, text: `Ava picked up the research job${forCompany(r.jobCompany(d.work_item_id))}.` };
    case "execution_run_completed": {
      const at = Number.isInteger(d.attempt_number) && d.attempt_number > 1 ? ` (attempt ${d.attempt_number})` : "";
      return { headline: true, text: searching ? `A search step finished${at}.` : `The research job${forCompany(runCo)} finished${at}.` };
    }
    case "execution_run_failed": {
      const at = Number.isInteger(d.attempt_number) && d.attempt_number > 1 ? ` (attempt ${d.attempt_number})` : "";
      const how = ev.decision === "retryable" ? "did not work and can be tried again" : "failed";
      return { headline: true, text: searching ? `A search step ${how}${at}.${d.reason ? ` ${plainReason(d.reason).text}` : ""}` : `The research job${forCompany(runCo)} ${how}${at}.` };
    }
    case "execution_run_start_decision":
      return { headline: false, text: searching ? "A search step was allowed to start." : `The research job${forCompany(runCo)} was allowed to start.` };
    case "intelligence_sufficiency_decision":
      return { headline: false, text: `Ava checked what she already knew${forCompany(runCo)} before looking something up.` };
    case "evidence_recorded":
      return { headline: false, text: `Ava saved a fact she found${forCompany(runCo)}.` };
    case "entity_identifier_added":
      return { headline: false, text: `Ava saved a way to recognise a company later${d.identifier_type === "domain" ? " (its website address)" : ""}.` };
    case "entity_profile_created": {
      const n = tidy(d.canonical_name);
      return { headline: false, text: n ? `Ava added ${quoted(n)} to the companies she knows.` : "Ava added a company to the companies she knows." };
    }
    case "outreach_draft_created": {
      const n = r.subjectName(d.subject_id), what = d.kind === "follow_up" ? "a follow-up" : d.kind === "reply" ? "a reply" : "a first email";
      return { headline: true, text: `Ava wrote ${what}${forCompany(n)}. It is waiting for you to approve.` };
    }
    case "outreach_draft_edited":
      return { headline: true, text: `You changed a message${forCompany(r.subjectName(d.subject_id))}.` };
    case "outreach_draft_approved":
      return { headline: true, text: `You approved a message${forCompany(r.subjectName(d.subject_id))}. It had not been sent yet.` };
    case "outreach_draft_rejected":
      return { headline: true, text: `A message${forCompany(r.subjectName(d.subject_id))} was rejected. Nothing was sent.` };
    case "outreach_sent":
      return { headline: true, text: `A TEST message${forCompany(r.subjectName(d.subject_id))} was sent to your test inbox. Nobody real was contacted.` };
    case "outreach_send_failed":
      return { headline: true, text: `A TEST message${forCompany(r.subjectName(d.subject_id))} could not be sent. It is back on the Approve screen.` };
    case "reply_recorded":
      return { headline: true, text: `${d.simulated === true ? "A simulated reply" : "A reply"}${forCompany(r.subjectName(d.subject_id))} was recorded.` };
    case "reply_categorized": {
      const how = d.source === "ai" ? "Ava sorted" : d.source === "rule" ? "A rule sorted" : "You sorted";
      return { headline: true, text: `${how} a reply${forCompany(r.subjectName(d.subject_id))} as “${CATEGORY_WORDS[d.category] ?? "another kind"}”.` };
    }
    case "opt_out_from_reply":
      return { headline: true, text: `${r.subjectName(d.subject_id) ? quoted(r.subjectName(d.subject_id)) : "A company"} asked not to be contacted. It is now marked do-not-contact and anything waiting for it was cancelled.` };
    case "opt_out_marked":
      return { headline: true, text: "You marked a company or a person as do-not-contact." };
    case "company_research_completed":
      return { headline: true, text: `Ava read a company's website and judged how well it fits${forCompany(r.subjectName(d.subject_id))}: ${d.label ?? "done"}. Not verified.` };
    case "approval_decision":
      return { headline: false, text: ev.decision === "approved" ? "A request was approved by you." : "A request was turned down by you." };
    case "ai_authority_set":
      return { headline: true, text: `Permission for Ava “${capabilityLabel(ev.capability_key)}” was switched ${d.enabled === true ? "on" : "off"}.` };
    case "knowledge_version_confirmed":
    case "knowledge_version_created": {
      const what = SLOT_LABEL[d.slot_key] ?? "a company setting";
      const confirmed = ev.event_type === "knowledge_version_confirmed";
      const v = Number.isInteger(d.version_no) && d.version_no > 0 ? ` (version ${d.version_no})` : "";
      return { headline: confirmed, text: confirmed ? `You confirmed ${what}${v}.` : `A new draft of ${what} was saved${v}.` };
    }
    case "lifecycle_stages_initialized":
      return { headline: false, text: "The company's pipeline steps were set up." };
    case "connector_authorization_decision":
    case "connector_authorization_consumed":
      return { headline: false, text: `A look-up${forCompany(runCo)} was approved and used.` };
    case "authorization_decision":
      return { headline: false, text: `A permission check was made${forCompany(runCo)}.` };
    case "ai_employee_token_mint_requested":
      return { headline: false, text: ev.decision === "deny" ? "A request to start Ava working was refused." : "Ava was started on a task under your sign-in." };
    default:
      return { headline: false, text: "Another behind-the-scenes step." };
  }
}

// ---- time ---------------------------------------------------------------------------------------------------------------------------------
export function timeAgo(iso, nowMs = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((nowMs - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(t).toLocaleDateString();
}

/** The big status on Home: one of stopped | searching | waiting | working | resting, with a plain line. */
export function homeStatus({ org, employee, latestRun, runningStale, activeJobs }) {
  if (org && org.status === "suspended") {
    return { key: "stopped", title: "Stopped", line: "Ava is paused. Nothing is running until you resume." };
  }
  if (!employee) return { key: "resting", title: "No AI employee yet", line: "There is no AI employee in this company." };
  if (employee.status !== "active") return { key: "stopped", title: "Ava is switched off", line: `${employee.name} is not active.` };
  if (latestRun && latestRun.status === "running") {
    return runningStale
      ? { key: "waiting", title: "A search stopped partway", line: "Press “Run a search now” to carry on." }
      : { key: "searching", title: "Searching now", line: "A search is in progress." };
  }
  if (activeJobs > 0) return { key: "working", title: "Working", line: `${activeJobs} job${activeJobs === 1 ? " is" : "s are"} in progress.` };
  return { key: "resting", title: "Resting", line: `${employee.name} is ready and waiting for the next search.` };
}
