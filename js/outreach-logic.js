// Plain-language pieces for Approve, Outreach and Inbox (chapters 5 to 7). Pure functions (no page, no network), so they can be checked on their own.
// The platform decides everything (permission, the owner's approval of the exact text, opt-outs, stopped company, test mode, the AI budget, what is due); this file only chooses what to
// show and words the answers.

export const TEST_MODE_NOTE = "TEST MODE. Every message goes only to your own test inbox, with a label saying it is a test. Nobody real is contacted, and nothing on this screen can change that.";

export const KINDS = { intro: "First email", follow_up: "Follow-up", reply: "Reply" };
export const kindWords = (k) => KINDS[k] ?? "Message";

export const CATEGORIES = [
  { key: "interested", label: "Interested", tone: "good", hint: "Wants to talk or hear more." },
  { key: "question", label: "Has a question", tone: "warn", hint: "Asks something before deciding." },
  { key: "not_now", label: "Not now", tone: "warn", hint: "Maybe later: the follow-up comes back in about 30 days." },
  { key: "not_interested", label: "Not interested", tone: "", hint: "A clear no: no follow-up." },
  { key: "unsubscribe", label: "Asked not to be contacted", tone: "bad", hint: "The whole company is marked do-not-contact. This cannot be undone here." },
];
export const categoryWords = (k) => CATEGORIES.find((c) => c.key === k)?.label ?? "Not sorted yet";
export const categoryTone = (k) => CATEGORIES.find((c) => c.key === k)?.tone ?? "";
export const STATUS_WORDS = { waiting: "waiting for you", approved: "approved, not sent yet", sent: "sent (as a test)", rejected: "rejected", failed: "could not be sent" };
export const statusWords = (s) => STATUS_WORDS[s] ?? "unknown";
export const NEEDS_NEXT_STEP = new Set(["interested", "question"]);

const DRAFT = {
  already_drafted: "There is already a message waiting or sent for this company.",
  company_opted_out: "This company is marked do-not-contact, so Ava cannot write to it.",
  no_contact_email: "This company has no contact with an email address. Add one in your list and import again.",
  no_contact_available: "Everyone at this company with an email address has opted out.",
  no_template: "There is no approved message template yet. Write and approve one under Templates.",
  template_problem: "The message template could not be filled in. Check it in Message templates.",
  company_info_missing_name: "Your company name is missing. Add it under Company, in Company information.",
  company_info_missing_offer: "You have not listed what you offer yet. Add a product or service in Company information.",
  org_suspended: "Ava is paused, so she did nothing. Resume her first.",
  company_not_found: "That company could not be found.",
  no_intro_sent: "No first email has been sent to this company yet.",
  already_replied: "They already replied, so no follow-up is needed.",
  not_due: "It is not time for a follow-up yet.",
  reply_not_ready: "Only a reply marked Interested or Has a question gets a next-step draft.",
  reply_not_found: "That reply could not be found.",
};
const SEND = {
  not_approved: "That message is not approved.",
  text_changed_after_approval: "The text was changed after you approved it, so it was not sent. Approve it again.",
  approval_needed_again: "The approval was already used. Approve it again to send.",
  company_opted_out: "This company is marked do-not-contact, so the message was not sent.",
  contact_opted_out: "This person asked not to be contacted, so the message was not sent.",
  org_suspended: "Ava is paused, so nothing was sent.",
  no_email: "This person has no email address.",
  outbound_mode_not_test: "Sending is only allowed in test mode.",
  test_inbox_not_set: "Your test inbox address has not been added yet. This is a step only you can do.",
  email_from_not_set: "The sender address has not been added yet. This is a step only you can do.",
  credential_not_configured: "The email service key has not been added yet. This is a step only you can do.",
  bad_message: "The message could not be sent as written.",
  timeout: "The email service did not answer in time. It will be asked again when you approve it.",
  network_error: "The email service could not be reached. It will be asked again when you approve it.",
};
const SORT = {
  model_no_model_provider_configured: "Needs the AI key",
  ai_prices_not_set: "Enter the AI prices on “What things cost” first.",
  ai_cost_cap_reached: "This company has used its AI money for this month.",
  ai_call_limit_reached: "This company has used its 2 AI calls for this month.",
  ai_cost_unknown: "An earlier AI call has no price. Enter the AI prices on “What things cost”.",
  already_sorted: "This reply is already sorted.",
  no_model_policy: "No AI model is set up for this company yet.",
  model_invalid_output: "The AI’s answer did not pass the safety check, so it was thrown away. Choose by hand.",
};

/** One short plain sentence for a reason code. Never shows the code itself. */
export function reasonWords(code, area = "draft") {
  const c = String(code ?? "");
  if (/^authorization_/.test(c)) {
    if (/not_authorized/.test(c)) return area === "sort" ? "Ava is not allowed to judge yet. Switch on “Judge whether a company is a good fit” in What Ava may do." : "Ava is not allowed to contact companies yet. Switch the permission on in What Ava may do.";
    if (/subject_restricted/.test(c)) return "This company is marked do-not-contact.";
    if (/org_suspended/.test(c)) return "Ava is paused, so she did nothing.";
    return "Ava was not allowed to do that.";
  }
  if (/^connector_/.test(c)) return "The email sender was not allowed to run. Nothing was sent.";
  const tables = area === "sort" ? [SORT] : area === "send" ? [SEND, DRAFT] : [DRAFT, SEND];
  for (const t of tables) if (Object.prototype.hasOwnProperty.call(t, c)) return t[c];
  return "Something went wrong, so nothing was changed.";
}

/** One line for one result from the outreach helper. */
export function resultLine(item, name, area = "draft") {
  const who = name || "This company";
  if (!item || typeof item !== "object") return `${who}: no answer.`;
  if (item.status === "done") {
    if (area === "send") return `${who}: sent to your test inbox.`;
    if (area === "sort") return `${who}: sorted as “${categoryWords(item.detail?.category)}”.`;
    return `${who}: a draft is waiting for you${item.detail?.used_research ? " (it uses her research)" : ""}.`;
  }
  return `${who}: ${reasonWords(item.reason, area)}`;
}

export function startRefusal(res) {
  const s = res?.status;
  if (s === 0) return "Could not reach the helper. Nothing was changed.";
  if (s === 401) return "Your sign-in ended. Please sign in again.";
  if (s === 403) return "Only an owner of this company can ask Ava to do this.";
  if (s === 404) return "The helper is not installed on this project.";
  return "That could not start. Nothing was changed.";
}

/** A plain problem with an edited message, or null. Mirrors the platform's check. */
export function editProblem(subject, body) {
  const s = String(subject ?? "").trim(), b = String(body ?? "").trim();
  if (!s) return "Write a subject line.";
  if (s.length > 300) return "The subject line is too long (300 letters at most).";
  if (!b) return "Write the message.";
  if (b.length > 6000) return "The message is too long (6,000 letters at most).";
  if (/\{\{|\}\}/.test(s + b)) return "Take out the curly brackets {{ }}: every blank is filled in already.";
  return null;
}

const usable = (c) => !!c && !!c.email && !c.opted_out_at;
/** Companies Ava can write a first email for: a contact with an email, not do-not-contact, nothing written or sent yet. */
export function draftable(pipeline, contacts, drafts) {
  const busy = new Set((drafts ?? []).filter((d) => d.kind === "intro" && ["waiting", "approved", "sent"].includes(d.status)).map((d) => d.subject_id));
  const withContact = new Set((contacts ?? []).filter(usable).map((c) => c.company_subject_id));
  return (pipeline ?? []).filter((r) => !r.opted_out && withContact.has(r.subject_id) && !busy.has(r.subject_id)).map((r) => r.subject_id);
}

export const dueFollowups = (followups, now = Date.now()) => (followups ?? []).filter((f) => f.status === "scheduled" && Date.parse(f.due_at) <= now);

export const byStatus = (drafts, status) => (drafts ?? []).filter((d) => d.status === status);

/** Where a draft's text came from, in one honest line. */
export function whyLine(d) {
  const r = d?.reason_used;
  if (d?.kind === "reply") return "A short, neutral reply written by the platform. Check it before you approve.";
  if (r && typeof r === "object" && typeof r.quote === "string") return "Uses her research: a sentence from the company’s own website (shown in the message).";
  return "Written from your template alone. Ava has no research on this company yet, and none is needed.";
}
export const safeLink = (u) => { try { const x = new URL(String(u)); return x.protocol === "http:" || x.protocol === "https:" ? x.toString() : null; } catch { return null; } };

/** The latest category for each reply (the platform keeps every one; the latest counts). */
export function latestCategory(assessments) {
  const m = new Map();
  for (const a of [...(assessments ?? [])].sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at))) m.set(a.record_id, a);
  return m;
}
/** Replies, newest first, each with its company name, text and category. */
export function repliesView(records, assessments, pipeline) {
  const cat = latestCategory(assessments), name = new Map((pipeline ?? []).map((p) => [p.subject_id, p.name]));
  return (records ?? []).filter((r) => r.direction === "inbound").map((r) => {
    const a = cat.get(r.id);
    return { id: r.id, subject_id: r.subject_id, company: name.get(r.subject_id) || "A company", text: typeof r.content?.text === "string" ? r.content.text : "", at: r.occurred_at, simulated: r.content?.simulated === true, category: a?.category ?? null, source: a?.source ?? null };
  });
}
/** Companies the owner can simulate a reply from: something was actually sent to them. */
export function replyTargets(records, pipeline) {
  const sent = new Set((records ?? []).filter((r) => r.direction === "outbound" && r.delivery_status === "sent").map((r) => r.subject_id));
  return (pipeline ?? []).filter((p) => sent.has(p.subject_id));
}
export const SIM_EXAMPLES = [
  "Yes, we are interested. Can you tell me more?",
  "Not right now, maybe later in the year.",
  "What areas do you cover?",
  "No thank you.",
  "Please unsubscribe me and do not contact us again.",
];
