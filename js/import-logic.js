// Plain-language pieces for "Import my list". Pure functions (no page, no network). The platform does the real cleaning, duplicate checks and saving; this file only
// reads the pasted text / small CSV on the owner's own computer, shows what it found, and builds the rows to send. Nothing leaves the computer until the owner presses Import.

export const MAX_ROWS = 200;
export const MAX_CHARS = 1_000_000;
export const FIELDS = ["name", "website", "place", "contact_name", "email", "phone", "do_not_contact"];
export const DEFAULT_ORDER = ["name", "website", "place", "contact_name", "email", "phone"];
const ALIASES = {
  name: ["company", "company name", "name", "business", "business name", "organisation", "organization", "firm"],
  website: ["website", "web site", "web", "url", "site", "domain", "web address"],
  place: ["place", "city", "location", "town", "area", "state", "region"],
  contact_name: ["contact", "contact name", "contact person", "person", "full name", "contact full name"],
  email: ["email", "e-mail", "email address", "e-mail address", "mail"],
  phone: ["phone", "telephone", "tel", "mobile", "phone number", "cell", "mobile number"],
  do_not_contact: ["do not contact", "dnc", "opt out", "optout", "opted out", "unsubscribe", "do_not_contact"],
};
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9_ ]+/g, " ").replace(/\s+/g, " ").trim();

export const SAMPLE = [
  "company,website,place,contact name,email,phone",
  "Example Guard Services,exampleguard.com,Lagos,Ada Example,ada@example.com,+234 800 000 0000",
  "Sample Patrol Ltd,,Abuja,,,",
].join("\n");

/** Splits comma / tab / semicolon text into rows of cells, honouring "quoted, cells" and doubled quotes. */
export function parseDelimited(text) {
  const t = String(text ?? "").replace(/^﻿/, "");
  const first = t.split(/\r\n|\n|\r/, 1)[0] ?? "";
  let delimiter = ",", best = -1;
  for (const d of [",", "\t", ";"]) { let inq = false, n = 0; for (const ch of first) { if (ch === '"') inq = !inq; else if (!inq && ch === d) n++; } if (n > best) { best = n; delimiter = d; } }
  const rows = []; let row = [], cell = "", inq = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inq) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else inq = false; } else cell += ch; continue; }
    if (ch === '"' && cell === "") inq = true;
    else if (ch === delimiter) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return { rows: rows.filter((r) => r.some((c) => c.trim() !== "")), delimiter };
}

const domainOf = (w) => String(w ?? "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#\s]/)[0];

/** Flags (plain words) for one row; `problem` flags mean the row will not be imported. */
export function rowFlags(d) {
  const f = [];
  if (!d.name) f.push({ code: "name_missing", problem: true, text: "No company name, so this row will be skipped." });
  if (d.website && !/^[^\s]+\.[^\s.]{2,}$/.test(domainOf(d.website))) f.push({ code: "website_odd", problem: false, text: "The website does not look like an address; it will be kept as typed but not used to recognise the company." });
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) f.push({ code: "email_odd", problem: false, text: "The email does not look right; the contact will be saved without it." });
  if (d.phone && !/^\d{7,15}$/.test(d.phone.replace(/\D/g, ""))) f.push({ code: "phone_odd", problem: false, text: "The phone number does not look right; the contact will be saved without it." });
  if (/^[=+@-]/.test(d.name || "")) f.push({ code: "formula", problem: false, text: "The name started with a spreadsheet symbol; the symbol will be removed." });
  return f;
}

/** Reads the owner's text. Returns { ok, error?, rows:[{line,data,flags,repeatOf}], total, headerFound, mapping }. */
export function readList(text) {
  const raw = String(text ?? "");
  if (raw.trim() === "") return { ok: false, error: "Paste your list or choose a file first." };
  if (raw.length > MAX_CHARS) return { ok: false, error: "That is too much text for one go (about 1 MB is the most). Split it into smaller files." };
  const { rows: cells } = parseDelimited(raw);
  if (cells.length === 0) return { ok: false, error: "I could not find any rows in that." };
  const head = cells[0].map(norm);
  const mapping = {};
  head.forEach((h, i) => { for (const f of FIELDS) if (mapping[f] === undefined && ALIASES[f].map(norm).includes(h)) mapping[f] = i; });
  const headerFound = mapping.name !== undefined;
  let body = cells;
  if (headerFound) body = cells.slice(1);
  else { DEFAULT_ORDER.forEach((f, i) => { mapping[f] = i; }); }
  if (body.length === 0) return { ok: false, error: "I found the heading row but no companies under it." };
  if (body.length > MAX_ROWS) return { ok: false, error: `That list has ${body.length} rows. The most for one import is ${MAX_ROWS}; please split it.` };
  const seen = new Map();
  const rows = body.map((r, idx) => {
    const data = {};
    for (const f of FIELDS) data[f] = mapping[f] !== undefined ? String(r[mapping[f]] ?? "").trim() : "";
    const flags = rowFlags(data);
    const key = domainOf(data.website) || data.name.toLowerCase();
    let repeatOf = null;
    if (data.name && key) { if (seen.has(key)) repeatOf = seen.get(key); else seen.set(key, idx + (headerFound ? 2 : 1)); }
    return { line: idx + (headerFound ? 2 : 1), data, flags, repeatOf };
  });
  return { ok: true, rows, total: rows.length, headerFound, mapping };
}

export const counts = (parsed) => ({
  total: parsed.total,
  readyish: parsed.rows.filter((r) => !r.flags.some((f) => f.problem) && !r.repeatOf).length,
  repeats: parsed.rows.filter((r) => r.repeatOf).length,
  problems: parsed.rows.filter((r) => r.flags.some((f) => f.problem)).length,
  withContact: parsed.rows.filter((r) => r.data.contact_name || r.data.email || r.data.phone).length,
});

/** What is sent: the cleaned-by-the-platform fields only. */
export const payload = (parsed) => parsed.rows.map((r) => ({ ...r.data }));

const REASONS = {
  new_company: "New company added.",
  already_known_company: "Already known to Ava; it is now also on your list.",
  same_company_earlier_in_this_file: "The same company as an earlier row; its contact was added to it.",
  may_be_a_duplicate_please_review: "Added, but it may be a duplicate of a company you already have. Please check it.",
  name_missing: "No company name.",
  row_not_readable: "This row could not be read.",
  identity_conflict: "This website already belongs to a different company, so the row was skipped.",
  could_not_save_this_row: "This row could not be saved.",
};
export const reasonText = (code) => REASONS[code] ?? "Skipped.";

export function summary(res) {
  const d = res?.data ?? {};
  return { created: d.created ?? 0, matched: d.matched ?? 0, flagged: d.flagged ?? 0, skipped: d.skipped ?? 0, total: d.total ?? 0, rows: Array.isArray(d.rows) ? d.rows : [] };
}

export function importError(res) {
  const s = res?.status, m = String(res?.data?.message ?? "");
  if (s === 0) return "Could not reach the project. Check your connection and try again. Nothing was imported.";
  if (s === 401) return "Your sign-in ended. Please sign in again.";
  if (/only an org owner/i.test(m) || s === 403) return "Only an owner of this company can import a list.";
  if (/between 1 and 200/i.test(m)) return `An import takes between 1 and ${MAX_ROWS} rows.`;
  return "Something went wrong, so nothing was imported. Please try again.";
}
