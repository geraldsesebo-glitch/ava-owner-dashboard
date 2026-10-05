// What each Connectors tag says. A tag is claimed ONLY from something the platform has recorded; with no record, the tag says what is NOT yet proven.
// Pure functions (no page, no network), so they can be checked on their own.
//   Company search : Connected   = a search through a real data service has succeeded (it handed back companies)
//                    Test mode   = only the practice (pretend) source has been used
//                    Not connected = no search has been recorded yet
//   AI model       : Connected   = a successful AI call is recorded (a fit judgement, a sorted reply, or AI usage in the ledger)
//                    Key needed  = no successful AI call is recorded yet
//   Email          : Test mode   = a test message has been sent successfully (recorded)
//                    Key needed  = no successful test send is recorded yet
//   Your own list / company websites : Available   (nothing to connect)       Anything not built : Soon

const PROVIDER_NAMES = { "pdl-company-search": "People Data Labs" };
const isMock = (key) => /mock/i.test(String(key ?? ""));
const num = (v) => Number(v) || 0;

/** A search through a real service that handed back companies (the platform's own counts on the run). */
export function realSearchSucceeded(runs) {
  return (Array.isArray(runs) ? runs : []).find((r) => r && typeof r.provider_key === "string" && r.provider_key !== "" && !isMock(r.provider_key) && (num(r.discovered) > 0 || num(r.provider_records_inspected) > 0)) ?? null;
}
export const providerName = (key) => PROVIDER_NAMES[key] ?? "a company data service";

export function searchStatus(runs) {
  const real = realSearchSucceeded(runs);
  if (real) return { status: "Connected", provider: providerName(real.provider_key) };
  if ((Array.isArray(runs) ? runs : []).some((r) => r && isMock(r.provider_key))) return { status: "Test mode", provider: null };
  return { status: "Not connected", provider: null };
}

/** A successful AI call is recorded: a fit judgement saved from a company's website, a reply sorted by Ava, or AI calls in this month's ledger. */
export function aiStatus({ pipeline, assessments, usage }) {
  const judged = (Array.isArray(pipeline) ? pipeline : []).some((r) => r && r.fit_label);
  const sorted = (Array.isArray(assessments) ? assessments : []).some((a) => a && a.source === "ai");
  const billed = (Array.isArray(usage) ? usage : []).some((u) => u && u.kind === "llm" && num(u.call_count) > 0);
  return { status: judged || sorted || billed ? "Connected" : "Key needed" };
}

/** A successful test send is recorded: a message record marked sent or delivered, or a draft the platform marked sent. */
export function emailStatus({ records, drafts }) {
  const sent = (Array.isArray(records) ? records : []).some((r) => r && r.direction === "outbound" && (r.delivery_status === "sent" || r.delivery_status === "delivered"));
  const draftSent = (Array.isArray(drafts) ? drafts : []).some((d) => d && d.status === "sent");
  return { status: sent || draftSent ? "Test mode" : "Key needed" };
}
