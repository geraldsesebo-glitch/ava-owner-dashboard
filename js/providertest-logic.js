// Plain-language pieces for the "Provider test" screen. Pure functions (no page, no network), so they can be checked on their own.
// The test function decides everything (who may run it, the 6-credit limit, the two fixed searches); this file only words things and builds the one request.
// The result it receives is already cleaned by the function (no key, no sign-in, no secrets). Everything below still treats it as untrusted text.

export const CAP_CREDITS = 6;
export const FUNCTION_NAME = "pdl-search-probe";

export const INTRO = [
  "This runs two tiny test searches with People Data Labs, a company-data service, to see whether it can give Ava real security companies in Nigeria.",
  "The first search asks for 3 companies in Nigeria. The second asks for 3 companies in Lagos.",
  `At most ${CAP_CREDITS} credits can be used, and that limit is built into the test itself, so it cannot be raised from this page. If the first search is refused, the second is not sent.`,
  "Nothing is saved, no company is added to Ava’s list, and no one is contacted. Ava’s real searching stays switched off.",
];

export const requestBody = (orgId) => ({ org_id: orgId, confirm_cap: CAP_CREDITS });

const asText = (v, max = 160) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const asInt = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : null);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Why the test stopped, in plain words. */
export function stopText(reason) {
  switch (reason) {
    case "pdl_api_key_not_configured": return "The access key for the data service has not been stored yet, so nothing was sent and no credits were used.";
    case "search_failed": return "A search was refused or failed, so the test stopped there. The second search was not sent unless it had already run.";
    case "provider_returned_more_than_asked": return "The service sent back more companies than the 3 that were asked for, so the test stopped straight away. Extra companies were thrown away.";
    case "provider_billed_more_than_asked": return "The service charged more credits than expected, so the test stopped straight away.";
    case "search_cap_reached":
    case "record_cap_would_be_exceeded":
    case "credit_cap_would_be_exceeded": return `The test stopped before it could go past the ${CAP_CREDITS}-credit limit.`;
    default: return reason ? "The test stopped early." : null;
  }
}

/** What went wrong with one search, in plain words (the service's own words are shown only in a small "Details" line). */
export function searchProblem(s) {
  if (!s || !s.error) return null;
  const st = s.http_status;
  let text;
  if (s.error.type === "network_error" || st === null) text = "The data service could not be reached.";
  else if (st === 401) text = "The data service did not accept the access key.";
  else if (st === 402) text = "The data service says there are no credits left, or this kind of search is not part of the current plan.";
  else if (st === 403) text = "This kind of search is not allowed on the current plan.";
  else if (st === 429) text = "The data service asked us to slow down. Try again in a minute.";
  else text = "The data service reported a problem.";
  const detail = [st ? `status ${st}` : null, asText(s.error.type, 60), asText(s.error.message, 160)].filter(Boolean).join(" · ");
  return { text, detail: detail || null };
}

/** The screen's answer to the button press. `res` is { ok, status, data } from the call. Returns what to show, never raw codes. */
export function interpret(res) {
  const st = res?.status, d = res?.data ?? null, code = asText(d?.error, 60);
  if (st === 0) return { kind: "network", text: "Could not reach the project. Check your connection and try again. No credits were used." };
  if (st === 401) return { kind: "signin", text: "Your sign-in ended. Please sign in again. No credits were used." };
  if (st === 403) return { kind: "refused", text: "Only an owner of this company can run this test. No credits were used." };
  if (st === 503 && code === "pdl_api_key_not_configured") return { kind: "nokey", text: "The access key for the data service has not been stored yet, so nothing was sent and no credits were used." };
  if (st === 400 && code === "cap_mismatch") return { kind: "refused", text: "This page is out of date and does not match the test’s credit limit. Refresh the page and try again. No credits were used." };
  if (!res?.ok || !d || d.test !== "pdl_company_search" || !Array.isArray(d.searches)) return { kind: "error", text: "The test did not finish properly. Please try again later. If a search had already gone through, a few credits may have been used.", detail: code || (st ? `status ${st}` : null) };
  return { kind: "ran", data: d };
}

function recordLine(r) {
  const name = asText(r?.name, 120) || "(no name)";
  const site = asText(r?.website, 120);
  const bits = [asText(r?.location?.name, 120), asText(r?.size, 30) ? `${asText(r.size, 30)} people` : null, asInt(r?.founded) ? `founded ${asInt(r.founded)}` : null].filter(Boolean);
  return { name, site: site || "no website shown", more: bits.join(" · ") };
}

/** One search, for the screen and for copying. */
export function searchView(s) {
  const sum = s?.summary ?? {};
  const returned = asInt(s?.returned) ?? 0;
  const total = asInt(s?.total);
  return {
    label: asText(s?.label, 40) || "Search",
    ran: s?.ran === true,
    ok: s?.ok === true,
    credits: asInt(s?.credits_spent),
    returned,
    total,
    headline: s?.ran !== true ? "Not sent." : s?.ok !== true ? "This search was refused or failed." : `${plural(returned, "company", "companies")} came back${total !== null ? `, out of about ${total} the service knows of` : ""}.`,
    companies: (Array.isArray(s?.records) ? s.records : []).slice(0, 3).map(recordLine),
    facts: s?.ok === true ? [
      `${asInt(sum.with_website) ?? 0} of ${returned} show a website`,
      `${asInt(sum.with_industry) ?? 0} of ${returned} show their kind of business`,
      `${asInt(sum.with_size) ?? 0} of ${returned} show a size`,
      `${asInt(sum.with_place_text) ?? 0} of ${returned} show a place`,
      s.key === "lagos" ? `${asInt(sum.in_lagos) ?? 0} of ${returned} are in Lagos` : null,
      (asInt(sum.hidden_values) ?? 0) > 0 ? `${asInt(sum.hidden_values)} details are hidden by the current plan` : null,
      s.paging?.token_present ? "more pages can be fetched later" : "no further pages offered",
    ].filter(Boolean) : [],
    problem: searchProblem(s),
  };
}

export function overview(d) {
  const t = d?.totals ?? {};
  const credits = asInt(t.credits_by_header);
  const views = (Array.isArray(d?.searches) ? d.searches : []).map(searchView);
  return {
    ok: d?.ok === true,
    title: d?.ok === true ? "The test finished." : "The test stopped early.",
    stop: stopText(asText(d?.stopped_reason, 60)),
    sent: asInt(t.upstream_calls) ?? 0,
    companies: asInt(t.records) ?? 0,
    credits,
    creditsText: credits === null ? (asInt(t.records) ? "The service did not say how many credits were used. Check your balance on the service’s own website." : "No companies came back, so no credits should have been used.") : `${plural(credits, "credit", "credits")} used (the limit is ${CAP_CREDITS}).`,
    views,
  };
}

/** The text the "Copy result" button puts on the clipboard. Built ONLY from the cleaned fields above, so it cannot contain a key, a sign-in or any secret. */
export function copyText(d) {
  const o = overview(d);
  const out = ["Provider test (People Data Labs company search)", o.title, o.stop || "", `Searches sent: ${o.sent}. Companies returned: ${o.companies}. ${o.creditsText}`, ""];
  for (const v of o.views) {
    out.push(`${v.label}: ${v.headline}`);
    for (const c of v.companies) out.push(`  - ${c.name} | ${c.site}${c.more ? ` | ${c.more}` : ""}`);
    for (const f of v.facts) out.push(`  * ${f}`);
    if (v.problem) out.push(`  ! ${v.problem.text}${v.problem.detail ? ` (${v.problem.detail})` : ""}`);
  }
  // only headers about limits and credits are ever copied, whatever else arrives
  const limitLike = (k) => /credit|rate-?limit|quota|usage|remaining|reset|totallimit/i.test(k) && !/key|token|auth|secret|cookie/i.test(k);
  const rates = (Array.isArray(d?.searches) ? d.searches : []).map((s) => Object.entries(s?.headers && typeof s.headers === "object" ? s.headers : {}).filter(([k]) => limitLike(k))).find((x) => x.length);
  if (rates) { out.push("", "Limits reported by the service:"); for (const [k, val] of rates.slice(0, 8)) out.push(`  ${asText(k, 60)}: ${asText(String(val), 60)}`); }
  const lens = (Array.isArray(d?.searches) ? d.searches : []).map((s) => asInt(s?.paging?.token_length)).filter((x) => x !== null);
  if (lens.length) out.push("", `Paging marker length: ${lens.join(", ")} characters`);
  return out.filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n").trim();
}
