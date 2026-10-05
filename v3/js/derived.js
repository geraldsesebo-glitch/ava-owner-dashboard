// Facts worked out from what the page has already loaded (nothing new is fetched here, and nothing here decides who may do what: the database does).
import { HELPERS, REAL_RUN_MAX_GOAL } from "./config.js";
import { companyKind, eventSentence, makeResolver, homeStatus } from "./text.js";
import { STAGES } from "./pipeline-logic.js";
import { byStatus } from "./outreach-logic.js";
import { permissionState } from "./permissions-logic.js";
import { lineStates } from "./cost-logic.js";

const STALE_RUN_MS = 10 * 60 * 1000;
const ASIDE = ["rejected_outside", "insufficient_evidence", "malformed", "duplicate_in_run"];

export function createDerived(state) {
  const org = () => state.companies.find((c) => c.id === state.orgId) || null;
  const kind = () => companyKind(org()?.name);
  const isStopped = () => org()?.status === "suspended";
  const candOf = (c) => (c.candidate && typeof c.candidate === "object" ? c.candidate : {});

  let factsCache = null;
  function facts() {
    const d = state.data;
    if (factsCache && factsCache.src === d) return factsCache.value;
    const employee = d.employees.find((e) => e.status === "active") || d.employees[0] || null;
    const foundByRun = new Map();
    for (const c of d.candidates) if (c.disposition === "discovered") foundByRun.set(c.run_id, (foundByRun.get(c.run_id) || 0) + 1);
    const runsByGoal = new Map();
    for (const r of d.runs) { if (!runsByGoal.has(r.owner_objective_id)) runsByGoal.set(r.owner_objective_id, []); runsByGoal.get(r.owner_objective_id).push(r); }
    const goals = d.goals.filter((g) => g.status !== "cancelled").map((g) => {   // a cancelled goal is withdrawn: it leaves the list (the activity page keeps the line)
      const runs = runsByGoal.get(g.id) || [];
      return { ...g, runs, latestRun: runs[0] || null, found: runs.reduce((n, r) => n + (foundByRun.get(r.id) || 0), 0) };
    });
    const latestRun = d.runs[0] || null;
    const value = {
      employee, goals, latestRun, confirmed: goals.filter((g) => g.status === "confirmed"),
      // the goals the search buttons may run: for a real company only small ones during the first real runs (see REAL_RUN_MAX_GOAL)
      runnable: goals.filter((g) => g.status === "confirmed" && (kind() === "pretend" || g.quantity <= REAL_RUN_MAX_GOAL)),
      runningStale: !!latestRun && latestRun.status === "running" && Date.now() - Date.parse(latestRun.updated_at) > STALE_RUN_MS,
      activeJobs: d.jobs.filter((j) => j.status === "active").length,
      canSearch: !!employee && d.authorities.some((x) => x.ai_employee_id === employee.id && x.capability_key === "discover_prospects" && x.enabled === true && x.requires_approval !== true),
      foundTotal: [...foundByRun.values()].reduce((a, b) => a + b, 0),
    };
    factsCache = { src: d, value };
    return value;
  }

  /** Why the Run button is off (or null when it can be pressed). Same wording and rules as before. */
  function runBlock(f) {
    const o = org();
    if (!o) return "No company is selected.";
    if (o.status === "suspended") return "Ava is paused. Resume Ava first.";
    if (!f.employee) return "There is no AI employee in this company yet.";
    if (f.employee.status !== "active") return "The AI employee is switched off.";
    if (kind() === "pretend" ? !HELPERS.pretend : !HELPERS.real) return "Searching is not switched on for this company yet, so nothing can be searched. This will change later.";
    if (f.confirmed.length === 0) return "There is no confirmed goal to search for yet.";
    if (f.runnable.length === 0) return `For the first real searches only small goals (up to ${REAL_RUN_MAX_GOAL} companies) can be searched. Add or confirm a small goal first.`;
    if (!f.canSearch) return "Ava has not been allowed to search for new companies yet. You can allow it under “What Ava may do” in Settings.";
    return null;
  }

  const status = () => {
    const f = facts();
    return homeStatus({ org: org(), employee: f.employee, latestRun: f.latestRun, runningStale: f.runningStale, activeJobs: f.activeJobs });
  };

  // ---- goals: Active and Finished ----
  const isFinished = (g) => g.status === "confirmed" && g.quantity > 0 && g.found >= g.quantity;
  const goalGroups = () => { const gs = facts().goals; return { active: gs.filter((g) => !isFinished(g)), finished: gs.filter(isFinished) }; };

  // ---- activity ----
  const describe = (ev) => {
    const d = state.data;
    if (d && d.resolver === undefined) d.resolver = makeResolver({ jobs: d.jobs, executions: d.executions, goals: d.goals, runs: d.runs, companies: d.pipeline });
    return eventSentence(ev, d?.resolver);
  };

  // ---- companies: one list of rows from the owner's list, Ava's finds, and what was set aside ----
  const stageLabel = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));
  let rowsCache = null;
  function companyRows() {
    const d = state.data;
    if (rowsCache && rowsCache.src === d) return rowsCache.rows;
    const contactsBy = new Map();
    for (const c of d.contacts ?? []) { if (!contactsBy.has(c.company_subject_id)) contactsBy.set(c.company_subject_id, []); contactsBy.get(c.company_subject_id).push(c); }
    const waiting = new Set(byStatus(d.drafts, "waiting").map((x) => x.subject_id));
    const rows = d.pipeline.map((r) => {
      const cs = contactsBy.get(r.subject_id) ?? [];
      return {
        key: r.subject_id, kind: "company", subject_id: r.subject_id, name: r.name || "(no name)", place: r.place || "", stage: r.stage, stageLabel: stageLabel[r.stage] ?? "Found",
        fit: r.fit_label || "", fitScore: r.fit_score, website: r.website || "", needsWebsite: !!r.needs_website || !r.website, contact: cs[0]?.name || (cs[0] ? "(no name)" : ""), contactCount: cs.length,
        source: r.on_owner_list ? "Your list" : "Found by Ava", yours: !!r.on_owner_list, optedOut: !!r.opted_out, needsReview: !!r.needs_review, ready: waiting.has(r.subject_id) || r.stage === "drafted", row: r, created: r.created_at,
      };
    });
    const known = new Set(rows.map((r) => r.name.toLowerCase()));
    const aside = d.candidates.filter((c) => ASIDE.includes(c.disposition) && candOf(c).name).map((c) => ({
      key: c.id, kind: "aside", name: String(candOf(c).name), place: String(candOf(c).geography_label ?? ""), stage: "aside", stageLabel: "Set aside", fit: "", website: typeof candOf(c).domain === "string" ? candOf(c).domain : "",
      needsWebsite: !candOf(c).domain, contact: "", contactCount: 0, source: "Found by Ava", yours: false, optedOut: false, ready: false, cand: c, created: c.created_at,
    })).filter((r) => !known.has(r.name.toLowerCase()));
    const all = [...rows, ...aside];
    rowsCache = { src: d, rows: all };
    return all;
  }
  const VIEWS = [
    { key: "all", label: "All", test: (r) => r.kind === "company" },
    { key: "yours", label: "Your list", test: (r) => r.kind === "company" && r.yours },
    { key: "found", label: "Found by Ava", test: (r) => r.kind === "company" && !r.yours },
    { key: "aside", label: "Set aside", test: (r) => r.kind === "aside" },
    { key: "needsweb", label: "Needs a website", test: (r) => r.kind === "company" && r.needsWebsite, smart: true },
    { key: "ready", label: "Ready to approve", test: (r) => r.kind === "company" && r.ready, smart: true },
  ];
  const viewRows = (key) => { const v = VIEWS.find((x) => x.key === key) ?? VIEWS[0]; return companyRows().filter(v.test); };
  const viewCounts = () => Object.fromEntries(VIEWS.map((v) => [v.key, companyRows().filter(v.test).length]));

  // ---- the "To finish setting up" list: only what is not done yet ----
  function setupItems() {
    const d = state.data, f = facts(), items = [];
    const t = d.targets;
    if (f.runningStale && f.latestRun) { const g = f.goals.find((x) => x.id === f.latestRun.owner_objective_id); if (g) items.push({ key: "stale", label: "A search did not finish", why: "Open the goal and press Try again.", go: ["home", "goals", g.id] }); }
    if (t?.ok && !(t.industries && t.geographies)) items.push({ key: "targets", label: "Choose who you target", why: "Goals cannot be confirmed until you do.", go: ["company", "targets"] });
    const k = d.knowledge;
    if (k?.ok) {
      const has = (slot) => k.rows.some((r) => r.slot_key === slot && k.versions.some((v) => v.knowledge_id === r.id && v.status === "confirmed"));
      if (!has("sales_note")) items.push({ key: "note", label: "Say what you sell and who you want", why: "Ava judges each website against it.", go: ["company", "info"] });
      if (!has("message_templates")) items.push({ key: "tpl", label: "Approve your message templates", why: "Ava can only fill in wording you approved.", go: ["outreach", "templates"] });
    }
    if (f.employee && !f.canSearch) items.push({ key: "search", label: "Allow Ava to search for companies", why: "Nothing starts until you press a button.", go: ["settings", "permissions"] });
    if (lineStates(d.prices).some((x) => x.current === null)) items.push({ key: "prices", label: "Set what things cost", why: "Until then any AI cost shows as price not set.", go: ["settings", "costs"] });
    if (!d.pipeline.some((r) => r.on_owner_list) && d.pipeline.length === 0) items.push({ key: "import", label: "Add your own list of companies", why: "Paste names or choose a file.", go: ["companies", "import"] });
    return items;
  }

  return { org, kind, isStopped, facts, runBlock, status, isFinished, goalGroups, describe, candOf, companyRows, VIEWS, viewRows, viewCounts, setupItems, permissionState };
}
