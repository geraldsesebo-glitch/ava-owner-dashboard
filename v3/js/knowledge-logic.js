// Plain-language pieces for "Company information" and "Message templates". Pure functions (no page, no network).
// They use the platform's existing owner-only company-knowledge functions: each save is a new VERSION, the owner's "Save and approve" confirms it, older versions are kept.

export const KNOWLEDGE_SLOTS = ["company_name", "company_description", "offering", "target_company_sizes", "sales_note", "message_templates"];

/** The blanks a template may contain (the platform checks the same list again when a draft is made). */
export const BLANKS = [
  { key: "company_name", label: "Their company name", sample: "Example Guard Services" },
  { key: "contact_first_name", label: "Their first name", sample: "Ada" },
  { key: "our_company", label: "Your company name", sample: "Your Company" },
  { key: "our_offer", label: "What you offer", sample: "guarding and patrol services" },
  { key: "reason", label: "Why you are writing to them", sample: "I saw that you protect offices in Lagos." },
];
const BLANK_KEYS = BLANKS.map((b) => b.key);

export const TEMPLATE_KINDS = [
  { key: "intro_email", title: "First email", help: "The first message Ava may draft for a company. You approve every draft before anything is sent.",
    starter: { name: "First email", channel: "email", subject: "A quick question for {{company_name}}", body: "Hello {{contact_first_name}},\n\nI am writing from {{our_company}}. We offer {{our_offer}}. {{reason}}\n\nWould you be open to a short conversation this week?\n\nKind regards,\n{{our_company}}" } },
  { key: "follow_up_email", title: "Follow-up email", help: "Used if there is no reply after the first email. You approve every draft.",
    starter: { name: "Follow-up email", channel: "email", subject: "Following up, {{company_name}}", body: "Hello {{contact_first_name}},\n\nI wanted to follow up on my earlier note from {{our_company}} about {{our_offer}}. If now is not a good time, just tell me and I will not trouble you again.\n\nKind regards,\n{{our_company}}" } },
];

/** A plain-words problem with a template's text, or null. Mirrors the platform's check. */
export function blanksProblem(text) {
  const t = String(text ?? "");
  const re = /\{\{\s*([A-Za-z0-9_]*)\s*\}\}/g;
  for (let m = re.exec(t); m; m = re.exec(t)) if (!BLANK_KEYS.includes(m[1])) return `“{{${m[1]}}}” is not a blank Ava knows. Use only the blanks listed under the box.`;
  if (/\{\{|\}\}/.test(t.replace(/\{\{[^{}]*\}\}/g, ""))) return "A blank has a missing curly bracket. Each blank looks like {{company_name}}.";
  return null;
}

export const fillSample = (text) => String(text ?? "").replace(/\{\{\s*([A-Za-z0-9_]*)\s*\}\}/g, (m, k) => BLANKS.find((b) => b.key === k)?.sample ?? m);

export function templateProblem(t) {
  if (!t.name.trim()) return "Give the template a name.";
  if (!t.subject.trim()) return "Write a subject line.";
  if (t.subject.length > 150) return "The subject line is too long (150 letters at most).";
  if (!t.body.trim()) return "Write the message.";
  if (t.body.length > 3000) return "The message is too long (3,000 letters at most).";
  return blanksProblem(t.subject) || blanksProblem(t.body);
}

/** Turns the loaded rows into what the screens need. `rows` = organizational_knowledge, `versions` = its versions (confirmed and draft). */
export function shapeKnowledge(rows, versions) {
  const ks = Array.isArray(rows) ? rows : [], vs = Array.isArray(versions) ? versions : [];
  const latest = (kid, status) => vs.filter((v) => v.knowledge_id === kid && v.status === status).sort((a, b) => b.version_no - a.version_no)[0] ?? null;
  const out = { single: {}, offerings: [], templates: {} };
  for (const k of ks) {
    if (k.status === "retired") continue;
    const conf = latest(k.id, "confirmed");
    if (!conf) continue;
    const info = { id: k.id, item_key: k.item_key, value: conf.value, version_no: conf.version_no, confirmed_at: conf.confirmed_at, versions: vs.filter((v) => v.knowledge_id === k.id).length };
    if (k.slot_key === "offering") out.offerings.push(info);
    else if (k.slot_key === "message_templates") out.templates[k.item_key] = info;
    else out.single[k.slot_key] = info;
  }
  out.offerings.sort((a, b) => String(a.value?.name).localeCompare(String(b.value?.name)));
  return out;
}

export function knowledgeError(res) {
  const s = res?.status, m = String(res?.data?.message ?? "");
  if (s === 0) return "Could not reach the project. Check your connection and try again. Nothing was saved.";
  if (s === 401) return "Your sign-in ended. Please sign in again.";
  if (/only an org owner/i.test(m) || s === 403) return "Only an owner of this company can change this.";
  if (/invalid value/i.test(m)) return "That is not an allowed value (it may be empty or too long). Nothing was saved.";
  return "Something went wrong, so nothing was saved. Please try again.";
}

/** A short unique item key for a new product or service, in the form the platform accepts. */
export function newItemKey(name, existing) {
  const base = String(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "item";
  let k = base, i = 2;
  while (existing.includes(k)) { k = `${base.slice(0, 36)}-${i++}`; }
  return k;
}
