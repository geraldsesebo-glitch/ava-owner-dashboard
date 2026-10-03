// Plain-language wording for everything the dashboard shows. Pure functions (no page, no network), so they can be checked on their own.
// Rule: the owner never has to read a code. Where a code has no wording yet, we say so honestly and keep the code only as small "details".

/** A company whose name starts with the word DEMO is the pretend company. */
export function companyKind(name) {
  return typeof name === "string" && /^DEMO(?![A-Za-z0-9])/.test(name) ? "pretend" : "real";
}

const REASONS = {
  source_exhausted: "Ava went through everything the search source had.",
  org_suspended: "The company is paused (Emergency stop is on).",
  organization_suspended: "The company is paused (Emergency stop is on).",
  preflight_organization_suspended: "The company is paused (Emergency stop is on).",
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

/**
 * One audit-log row -> { headline: true/false, text }. headline=false rows are "behind the scenes" steps, hidden unless asked for.
 * Only a few whitelisted fields of `detail` are ever read; the raw detail is never shown.
 */
export function eventSentence(ev) {
  const d = ev?.detail && typeof ev.detail === "object" ? ev.detail : {};
  switch (ev?.event_type) {
    case "ai_employee_provisioned":
      return ev.decision === "deny" ? { headline: true, text: "Someone tried to create an AI employee and was refused." }
        : { headline: true, text: `${typeof d.name === "string" ? d.name : "An AI employee"} was created.` };
    case "organization_status_changed":
      return { headline: true, text: d.to === "suspended" ? "Emergency stop was switched ON. Ava stopped working." : "Emergency stop was switched OFF. Ava can work again." };
    case "owner_objective_proposed":
    case "owner_objective_created":
    case "objective_created":
      return { headline: true, text: "A goal was added." };
    case "owner_objective_confirmed":
      return { headline: true, text: "A goal was confirmed." };
    case "owner_objective_cancelled":
      return { headline: true, text: "A goal was cancelled." };
    case "discovery_run_started":
      return { headline: true, text: "Ava started a search for companies." };
    case "discovery_provider_selected":
      return { headline: false, text: "A search source was chosen for the search." };
    case "discovery_preflight":
      return ev.decision === "deny" || d.ok === false
        ? { headline: true, text: `A search step was stopped before it started. ${plainReason(d.reason).text}` }
        : { headline: false, text: "A search step passed its last safety check." };
    case "discovery_page_ingested":
      return { headline: true, text: "Ava looked through a page of search results." };
    case "discovery_page_failed":
      return { headline: true, text: `A search step failed. ${plainReason(d.reason).text}` };
    case "discovery_orphan_reclaimed":
      return { headline: true, text: "A search step got stuck and was cancelled so it could be tried again." };
    case "discovery_run_finished": {
      const s = typeof d.status === "string" ? d.status : "";
      const r = plainReason(d.reason).text;
      const n = Number.isInteger(d.discovered) ? d.discovered : null;
      const lead = s === "completed" ? "The search finished with everything asked for." : s === "partial" ? "The search finished." : s === "cancelled" ? "The search was cancelled." : "The search stopped.";
      return { headline: true, text: `${lead}${n !== null ? ` New companies found: ${n}.` : ""} ${d.reason ? r : ""}`.trim() };
    }
    case "work_item_transition":
      return { headline: true, text: `A job ${WORK_TO[d.to] ? "is now " + WORK_TO[d.to] : "changed"}.` };
    case "execution_run_completed":
      return { headline: true, text: "A research job finished." };
    case "execution_run_failed":
      return { headline: true, text: ev.decision === "retryable" ? "A research job did not work and can be tried again." : "A research job failed." };
    case "intelligence_sufficiency_decision":
      return { headline: false, text: "Ava checked what she already knew before looking something up." };
    case "evidence_recorded":
      return { headline: false, text: "Ava saved a fact she found." };
    case "entity_identifier_added":
      return { headline: false, text: "Ava saved a way to recognise a company later." };
    case "lifecycle_stages_initialized":
      return { headline: false, text: "The company's pipeline steps were set up." };
    case "connector_authorization_decision":
    case "connector_authorization_consumed":
      return { headline: false, text: "A look-up was approved and used." };
    case "authorization_decision":
      return { headline: false, text: "A permission check was made." };
    case "execution_run_start_decision":
      return { headline: false, text: "A job was allowed to start." };
    case "work_item_claimed":
      return { headline: false, text: "Ava picked up a job." };
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
    return { key: "stopped", title: "Stopped", line: "Emergency stop is ON. Ava will not do anything until you resume." };
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
