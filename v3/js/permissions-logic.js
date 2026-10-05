// Plain-language pieces for the "What Ava may do" screen. Pure functions (no page, no network), so they can be checked on their own.
// The platform decides everything (owner-only, plan limits, history); this file only words things and builds the one request the screen sends.

/** Everything the platform knows how to permit, in plain words, in reading order. Only "Search for new companies" can be switched here. */
export const PERMISSIONS = [
  { key: "research_prospect", label: "Look up facts about a company", detail: "Ava can check a company's details from outside sources.", switchable: false },
  { key: "discover_prospects", label: "Search for new companies", detail: "Ava can look for new companies that fit a goal you have confirmed.", switchable: true },
  { key: "run_discovery_unattended", label: "Search on her own, without being asked", detail: "Not available yet.", switchable: false },
  { key: "qualify_prospect", label: "Judge whether a company is a good fit", detail: "Ava can read a company's own public website and say how well it fits what you sell. It uses a little AI money (at most $0.02 per company per month). It contacts nobody.", switchable: true },
  { key: "engage_prospect", label: "Contact a company", detail: "Ava can write a first email for you to approve, and send it once you have approved the exact text. For now every message goes only to your own test inbox. She asks you first, every time.", switchable: true },
  { key: "follow_up", label: "Carry on a conversation with a company", detail: "Ava can write a follow-up, or a reply to an interested company, for you to approve. For now every message goes only to your own test inbox. She asks you first, every time.", switchable: true },
  { key: "record_opportunity", label: "Record a sales opportunity", detail: "Not available yet.", switchable: false },
];
export const SEARCH_KEY = "discover_prospects";
export const FIT_KEY = "qualify_prospect";
export const FIT_NOTE = "Allowing this does NOT start any research. Research only runs when you press a Research button. Ava reads only the company's own public website, uses the cheap AI model, never sends it contact details, and nothing is sent to anyone.";
export const ASK_KEYS = new Set(["engage_prospect", "follow_up"]);
export const ASK_NOTE = "Allowing this does NOT send anything. Ava can only write a message and wait. You approve each message, and only then is it sent, and in test mode only to your own test inbox. You can switch it off at any time.";
const plainAllowed = (key) => key === SEARCH_KEY || key === FIT_KEY;

/** The one thing to say, clearly, about the search permission. */
export const NO_SEARCH_NOTE = "Allowing Ava to search does NOT start any search. A search only runs when you press “Run a search now”, and no real data source is switched on yet, so nothing real can be searched. This only gives Ava the right to search later.";

const plainObj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

/** allowed | asks (allowed, but asks the owner each time) | off (no row, or switched off). */
export function permissionState(authorities, employeeId, key) {
  const row = (Array.isArray(authorities) ? authorities : []).find((a) => a && a.ai_employee_id === employeeId && a.capability_key === key) ?? null;
  if (!row || row.enabled !== true) return { state: "off", row };
  return { state: row.requires_approval === true ? "asks" : "allowed", row };
}
export const stateText = (s) => (s === "allowed" ? "Allowed" : s === "asks" ? "Allowed, asks you first" : "Off");
export const stateTone = (s) => (s === "allowed" ? "good" : s === "asks" ? "warn" : "");

/**
 * The one request the screen sends (the existing owner-only function). It hands back whatever limits and notes already exist so nothing else on that
 * permission is wiped. Searching is never set to "asks first" (the platform does not support that for searching), so switching it on sets it to plain allowed.
 */
export function rpcArgs(orgId, employeeId, key, row, on) {
  return {
    p_org_id: orgId, p_ai_employee_id: employeeId, p_capability_key: key, p_enabled: on === true,
    p_requires_approval: ASK_KEYS.has(key) && on ? true : plainAllowed(key) && on ? false : row?.requires_approval === true,
    p_limits: plainObj(row?.limits), p_context: plainObj(row?.context),
  };
}

export function confirmCopy(key, on, who) {
  if (key === FIT_KEY) {
    return on
      ? { title: `Allow ${who} to judge whether companies fit?`, body: "This gives her the right to read a company's own public website and say how well it fits what you sell. It does not start any research and contacts nobody.", yes: "Yes, allow it", no: "Not now" }
      : { title: `Stop ${who} from judging fit?`, body: "She will not be able to research companies until you allow it again. Answers already saved are kept.", yes: "Yes, switch it off", no: "Keep it on" };
  }
  if (ASK_KEYS.has(key)) {
    const what = key === "engage_prospect" ? "contact companies" : "carry on conversations with companies";
    return on
      ? { title: `Allow ${who} to ${what}?`, body: "This gives her the right to write messages for you to approve. She asks you first, every time. It does not send anything, and for now every message goes only to your own test inbox.", yes: "Yes, allow it", no: "Not now" }
      : { title: `Stop ${who} from writing to companies?`, body: "She will not be able to write or send anything until you allow it again. Messages already waiting stay where they are.", yes: "Yes, switch it off", no: "Keep it on" };
  }
  if (key !== SEARCH_KEY) return null;
  return on
    ? { title: `Allow ${who} to search for new companies?`, body: "This gives her the right to search for new companies for goals you have confirmed. It does not start a search.", yes: "Yes, allow it", no: "Not now" }
    : { title: `Stop ${who} from searching for new companies?`, body: "She will not be able to search until you allow it again. Searches already finished are not affected.", yes: "Yes, switch it off", no: "Keep it on" };
}

/** The platform said no, or something failed. Plain words, never a code. `detail` carries the platform's own reason for the small "Details" line. */
export function refusalText(res) {
  const status = res?.status, msg = String(res?.data?.message ?? "");
  if (status === 0) return { text: "Could not reach the project. Check your connection and try again. Nothing was changed.", detail: null };
  if (status === 401) return { text: "Your sign-in ended. Please sign in again.", detail: null };
  if (/only an org owner/i.test(msg) || status === 403) return { text: "Only an owner of this company can change what Ava may do.", detail: null };
  const plan = /not permitted by the current plan \(([^)]*)\)/i.exec(msg);
  if (plan) return { text: "Your current plan does not allow Ava to do this, so nothing was changed.", detail: plan[1].slice(0, 80) };
  if (/unknown AI employee/i.test(msg)) return { text: "Ava could not be found in this company. Nothing was changed.", detail: null };
  if (/unknown capability/i.test(msg)) return { text: "That permission does not exist. Nothing was changed.", detail: null };
  return { text: "Something went wrong, so nothing was changed. Please try again.", detail: null };
}
