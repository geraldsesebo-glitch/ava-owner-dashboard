// Plain-language pieces for the Pipeline. Pure functions (no page, no network). The platform works out each company's stage from the real records (the company_pipeline view);
// this file only groups and words them, and builds the CSV download.

export const STAGES = [
  { key: "found", label: "Found", hint: "On your list or found by a search. Nothing has been checked yet." },
  { key: "researched", label: "Researched", hint: "Ava has read about the company." },
  { key: "qualified", label: "Qualified", hint: "Ava judged it a good fit for what you sell." },
  { key: "drafted", label: "Drafted", hint: "A first email is written and waiting for you." },
  { key: "approved", label: "Approved", hint: "You approved the email." },
  { key: "contacted", label: "Contacted", hint: "The email was sent." },
  { key: "replied", label: "Replied", hint: "The company wrote back." },
];

export const FILTERS = [{ key: "all", label: "All" }, { key: "list", label: "Your list" }, { key: "service", label: "Found by searches" }];

export function filterRows(rows, filter, query = "") {
  const q = String(query).trim().toLowerCase();
  return (Array.isArray(rows) ? rows : []).filter((r) => (filter === "list" ? r.on_owner_list : filter === "service" ? !r.on_owner_list : true)
    && (q === "" || `${r.name ?? ""} ${r.place ?? ""} ${r.website ?? ""}`.toLowerCase().includes(q)));
}

export function groupByStage(rows) {
  const g = Object.fromEntries(STAGES.map((s) => [s.key, []]));
  for (const r of rows) (g[r.stage] ?? g.found).push(r);
  return g;
}

export const originText = (r) => (r.on_owner_list ? "Your list" : "Found by a search");
export const verificationText = (v) => (v === "verified" ? "Verified by you" : v === "unverified" ? "Not verified" : "Not checked yet");

/** Spreadsheet programs run text that starts with = + - @ as a formula, so such cells get a quote in front (safe to open). */
export const safeCell = (v) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows, contacts) {
  const byCo = new Map();
  for (const c of Array.isArray(contacts) ? contacts : []) { if (!byCo.has(c.company_subject_id)) byCo.set(c.company_subject_id, []); byCo.get(c.company_subject_id).push(c); }
  const head = ["Company", "Stage", "Where it came from", "Website", "Place", "Checked?", "Last checked", "Do not contact", "Contact name", "Contact email", "Contact phone", "Contact opted out"];
  const stage = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));
  const lines = [head.map(safeCell).join(",")];
  for (const r of rows) {
    const cs = byCo.get(r.subject_id) ?? [null];
    for (const c of cs) {
      lines.push([r.name, stage[r.stage] ?? r.stage, originText(r), r.website, r.place, verificationText(r.verification), r.last_checked_at ? String(r.last_checked_at).slice(0, 10) : "", r.opted_out ? "yes" : "",
        c?.name, c?.email, c?.phone, c?.opted_out_at ? "yes" : ""].map(safeCell).join(","));
    }
  }
  return lines.join("\r\n") + "\r\n";
}
