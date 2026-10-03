// The owner dashboard, new look (green / black / white, light and dark). Same data and same buttons as the working dashboard in ../owner-dashboard.
// Everything shown from the database is put on the page as plain text only (never as markup, never as a link), so nothing a source sends can change the page.
// Branches do not exist in the database yet: "Main" is only a label for the one place everything lives today. Nothing about branches is invented here.
import { HELPERS } from "./config.js";
import { signIn, signOut, isSignedIn, onSignedOut, rpc, callHelper } from "./api.js";
import { loadCompanies, loadCompany, loadTargets } from "./data.js";
import { companyKind, plainReason, runSentence, dispositionLabel, candidateReason, fitSentence, capabilityLabel, goalStatusLabel, goalCriteriaLine, eventSentence, makeResolver, noWebsite, creditsNote, timeAgo, homeStatus } from "./text.js";
import { icon } from "./icons.js";
import { createAddGoal } from "./addgoal.js";
import { createTargets } from "./targets.js";
import { createPermissions } from "./permissions.js";
import { createProviderTest } from "./providertest.js";

const $ = (id) => document.getElementById(id);
const STALE_RUN_MS = 10 * 60 * 1000;
const ORG_KEY = "ava_owner_dashboard_v2_org";
const THEME_KEY = "ava_owner_dashboard_v2_theme";
const desktop = window.matchMedia("(min-width: 900px)");

const SECTIONS = [
  { id: "home", label: "Home", icon: "home", built: true },
  { id: "goals", label: "Goals", icon: "goals", built: true },
  { id: "companies", label: "Companies", icon: "companies", built: true },
  { id: "outreach", label: "Outreach", icon: "outreach", built: false },
  { id: "inbox", label: "Inbox", icon: "inbox", built: false },
  { id: "pipeline", label: "Pipeline", icon: "pipeline", built: false },
  { id: "history", label: "History", icon: "history", built: true },
  { id: "addgoal", label: "Add goal", icon: "plus", built: true, hidden: true },
  { id: "targets", label: "Who you target", icon: "goals", built: true, hidden: true },
  { id: "permissions", label: "What Ava may do", icon: "goals", built: true, hidden: true },
  { id: "providertest", label: "Provider test", icon: "goals", built: true, hidden: true },
];
const SOON = {
  outreach: "Ava will write first messages to the companies she found, and wait for your OK before anything is sent.",
  inbox: "Replies from companies will arrive here, with Ava’s suggested answer ready for you to approve.",
  pipeline: "See every company move from “found” to “talking” to “customer”.",
};
const TABS = ["home", "goals", "companies", "history", "more"];

const state = { companies: [], orgId: null, data: null, section: "home", itemId: null, filter: "found", historyAll: false, query: "", busy: false, runMessage: null, sheet: null, theme: loadTheme(), loadId: 0, loadError: null, addGoal: null, targets: null, perm: null, pt: null };
// the Add goal screen (uses only the existing goal reader and its confirm step)
const addGoal = createAddGoal({ h, icon, state, render: () => render(), reload: (keep) => reload(keep), go: (s, i) => go(s, i), call: callHelper, openTargets: () => targets.open() });
// the "Who you target" screen (uses only the existing owner-only set_knowledge path)
const targets = createTargets({ h, icon, state, render: () => render(), reload: (keep) => reload(keep), go: (s, i) => go(s, i), rpc });
// the "What Ava may do" screen (uses only the existing owner-only set_ai_authority path)
const permissions = createPermissions({ h, icon, state, render: () => render(), reload: (keep) => reload(keep), go: (s, i) => go(s, i), rpc });
// the "Provider test" screen (one owner-only test function with a fixed, capped test; nothing is saved)
const providerTest = createProviderTest({ h, icon, state, render: () => render(), go: (s, i) => go(s, i), call: callHelper });

// ---- small helpers ------------------------------------------------------------------------------------------------------------------------
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const kid of kids.flat(2)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(typeof kid === "object" ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const fill = (el, ...kids) => el.replaceChildren(...kids.flat(2).filter((k) => k !== null && k !== undefined && k !== false));
const clip = (s, n = 120) => (typeof s === "string" ? (s.length > n ? s.slice(0, n - 1) + "…" : s) : "");
const word = (n, one, many) => (n === 1 ? one : many);
/** The page forbids inline style attributes (safety rule), so the bar fill is set through the browser's style object. */
function bar(pct) { const s = document.createElement("span"); s.style.transform = `scaleX(${Math.max(0, Math.min(1, pct))})`; return h("div", { class: "bar", role: "img", "aria-label": `${Math.round(pct * 100)} percent` }, s); }
function loadTheme() { try { const t = localStorage.getItem(THEME_KEY); return t === "light" || t === "dark" ? t : "auto"; } catch { return "auto"; } }
function applyTheme() {
  if (state.theme === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", state.theme);
  try { if (state.theme === "auto") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, state.theme); } catch { /* private window: fine */ }
}

// ---- derived facts (same rules as the working dashboard) --------------------------------------------------------------------------------------
const org = () => state.companies.find((c) => c.id === state.orgId) || null;
const kind = () => companyKind(org()?.name);
const isStopped = () => org()?.status === "suspended";
function facts() {
  const d = state.data;
  const employee = d.employees.find((e) => e.status === "active") || d.employees[0] || null;
  const foundByRun = new Map();
  for (const c of d.candidates) if (c.disposition === "discovered") foundByRun.set(c.run_id, (foundByRun.get(c.run_id) || 0) + 1);
  const runsByGoal = new Map();
  for (const r of d.runs) { if (!runsByGoal.has(r.owner_objective_id)) runsByGoal.set(r.owner_objective_id, []); runsByGoal.get(r.owner_objective_id).push(r); }
  const goals = d.goals.filter((g) => g.status !== "cancelled").map((g) => {   // a cancelled goal is withdrawn: it leaves the list (the History keeps the line)
    const runs = runsByGoal.get(g.id) || [];
    return { ...g, runs, latestRun: runs[0] || null, found: runs.reduce((n, r) => n + (foundByRun.get(r.id) || 0), 0) };
  });
  const latestRun = d.runs[0] || null;
  return {
    employee, goals, latestRun, confirmed: goals.filter((g) => g.status === "confirmed"),
    runningStale: !!latestRun && latestRun.status === "running" && Date.now() - Date.parse(latestRun.updated_at) > STALE_RUN_MS,
    activeJobs: d.jobs.filter((j) => j.status === "active").length,
    canSearch: !!employee && d.authorities.some((x) => x.ai_employee_id === employee.id && x.capability_key === "discover_prospects" && x.enabled === true && x.requires_approval !== true),
    foundTotal: [...foundByRun.values()].reduce((a, b) => a + b, 0),
  };
}
/** Why the Run button is off (or null when it can be pressed). Same wording and rules as the working dashboard. */
function runBlock(f) {
  const o = org();
  if (!o) return "No company is selected.";
  if (o.status === "suspended") return "Emergency stop is on. Resume Ava first.";
  if (!f.employee) return "There is no AI employee in this company yet.";
  if (f.employee.status !== "active") return "The AI employee is switched off.";
  if (kind() === "pretend" ? !HELPERS.pretend : !HELPERS.real) return "Searching is not switched on for this company yet, so nothing can be searched. This will change later.";
  if (f.confirmed.length === 0) return "There is no confirmed goal to search for yet.";
  if (!f.canSearch) return "Ava has not been allowed to search for new companies yet. You can allow it under \u201cWhat Ava may do\u201d (Settings).";
  return null;
}
// each line can name its company or goal, using only what is already loaded (see makeResolver)
const describe = (ev) => { const d = state.data; if (d && d.resolver === undefined) d.resolver = makeResolver({ jobs: d.jobs, executions: d.executions, goals: d.goals, runs: d.runs }); return eventSentence(ev, d?.resolver); };
const headlineEvents = () => state.data.audit.map((ev) => ({ ev, s: describe(ev) })).filter((x) => x.s.headline);
function companyGroups() {
  const d = state.data, latest = d.runs[0]?.id;
  return {
    found: d.candidates.filter((c) => c.disposition === "discovered"),
    aside: d.candidates.filter((c) => c.run_id === latest && ["rejected_outside", "insufficient_evidence", "malformed", "duplicate_in_run"].includes(c.disposition)),
    known: d.candidates.filter((c) => c.run_id === latest && c.disposition === "already_known"),
  };
}
const candOf = (c) => (c.candidate && typeof c.candidate === "object" ? c.candidate : {});
const matches = (text) => state.query.trim() === "" || text.toLowerCase().includes(state.query.trim().toLowerCase());
function itemsFor(section) {
  if (!state.data) return [];
  if (section === "goals") return facts().goals.filter((g) => matches(g.source_goal_text));
  if (section === "companies") return companyGroups()[state.filter].filter((c) => matches(`${candOf(c).name ?? ""} ${candOf(c).geography_label ?? ""} ${candOf(c).industry_label ?? ""}`));
  if (section === "history") return state.data.audit.map((ev) => ({ id: ev.id, ev, s: describe(ev) })).filter((x) => (state.historyAll || x.s.headline) && matches(x.s.text));
  return [];
}
function currentItem() {
  const list = itemsFor(state.section);
  return list.find((i) => i.id === state.itemId) || (desktop.matches ? list[0] || null : null);
}

// ---- navigation ---------------------------------------------------------------------------------------------------------------------------
function go(section, itemId = null) { if (section !== "addgoal") state.addGoal = null; if (section !== "targets") state.targets = null; if (section !== "permissions") state.perm = null; if (section !== "providertest") state.pt = null; state.section = section; state.itemId = itemId; state.query = ""; state.sheet = null; render(); $("main").scrollTop = 0; $("list").scrollTop = 0; }
function pane() {
  const sec = SECTIONS.find((s) => s.id === state.section);
  if (state.section === "home" || state.section === "addgoal" || state.section === "targets" || state.section === "permissions" || state.section === "providertest" || !sec.built) return "main";
  return state.itemId ? "main" : "list";
}

// ---- pieces -------------------------------------------------------------------------------------------------------------------------------
function renderStrip() {
  fill($("strip"), h("div", { class: "brand", "aria-hidden": "true", text: "A" }),
    SECTIONS.filter((s) => !s.hidden).map((s) => h("button", { class: "strip-btn", type: "button", title: s.built ? s.label : `${s.label} – coming soon`, "aria-current": state.section === s.id || (s.id === "goals" && state.section === "addgoal") ? "page" : null, onclick: () => go(s.id) },
      icon(s.icon, 24), h("span", { text: s.label }), s.built ? null : h("span", { class: "dotsoon", title: "Coming soon" }))),
    h("div", { class: "strip-foot" }, h("button", { class: "strip-btn", type: "button", title: "Settings", onclick: () => { state.sheet = { kind: "settings" }; render(); } }, icon("gear", 24), h("span", { text: "Settings" }))));
}

function renderTop() {
  const stopped = isStopped();
  const sel = h("select", { id: "company-select", "aria-label": "Company", onchange: async (e) => {
    state.orgId = e.target.value; state.runMessage = null; state.itemId = null; state.filter = "found"; state.data = null; state.loadError = null;
    try { localStorage.setItem(ORG_KEY, state.orgId); } catch { /* fine */ }
    render(); await reload(); render();
  } }, state.companies.map((c) => h("option", { value: c.id, text: c.name })));
  if (state.orgId) sel.value = state.orgId;
  fill($("top"),
    h("div", { class: "top-row" },
      h("div", { class: "brand", "aria-hidden": "true", text: "A" }),
      h("label", { class: "branch" }, icon("companies", 20), h("span", { class: "sr-only", text: "Company" }), sel, state.companies.length > 1 ? h("span", { class: "caret", "aria-hidden": "true", text: "▾" }) : null),
      !org() ? null : stopped
        ? h("button", { class: "btn resume", type: "button", disabled: state.busy, onclick: () => { state.sheet = { kind: "resume" }; render(); } }, icon("run", 20), "Resume")
        : h("button", { class: "btn stop", type: "button", disabled: state.busy, onclick: () => setStop(true) }, icon("stop", 20), h("span", { text: "Emergency stop" }))),
    kind() === "pretend" && org() ? h("div", { class: "pretend", role: "note" }, h("strong", { text: "PRETEND DATA" }), " – everything here is made up.", h("span", { class: "wide-only", text: " No real company is involved." })) : null,
    stopped ? h("div", { class: "stopped", role: "alert" }, "EMERGENCY STOP IS ON. Ava will not do anything until you resume.") : null);
}

function listHead(title, { search = false, chips = null } = {}) {
  return h("div", { class: "list-head" }, h("h2", {}, title),
    search ? h("label", { class: "searchbox" }, icon("search", 18), h("span", { class: "sr-only", text: "Search" }),
      h("input", { type: "search", placeholder: "Search", value: state.query, oninput: (e) => { state.query = e.target.value; const pos = e.target.selectionStart; render(); const again = $("list").querySelector("input"); if (again) { again.focus(); again.setSelectionRange(pos, pos); } } })) : null,
    chips);
}
const soonBadge = () => h("span", { class: "badge soon", text: "Coming soon" });

function renderList() {
  const s = ["addgoal", "targets", "permissions", "providertest"].includes(state.section) ? "goals" : state.section, sec = SECTIONS.find((x) => x.id === s);
  if (!state.data) { fill($("list"), listHead(sec.label), h("div", { class: "list-body" }, h("p", { class: "empty", text: "Loading…" }))); return; }
  if (s === "home") {
    const f = facts(), ev = headlineEvents().slice(0, 6);
    fill($("list"), listHead("Your company"), h("div", { class: "list-body" },
      h("div", { class: "item", "aria-current": "true" }, h("span", { class: "row" }, h("span", { class: "t", text: "Main branch" }),
        f.employee ? h("span", { class: `badge ${isStopped() ? "bad" : f.employee.status === "active" ? "good" : "bad"}`, text: isStopped() ? "Stopped" : f.employee.status === "active" ? "Active" : "Switched off" }) : null),
        h("span", { class: "s", text: f.employee ? `${f.employee.name} · ${f.goals.length} ${word(f.goals.length, "goal", "goals")}` : "No AI employee yet" }),
        h("span", { class: "s", text: "Branches are coming later. Everything here belongs to Main." })),
      h("p", { class: "list-label", text: "Latest activity" }),
      ev.length === 0 ? h("p", { class: "empty", text: "Nothing has happened yet." }) : ev.map(({ ev: e, s: t }) => h("button", { class: "item", type: "button", onclick: () => go("history", e.id) }, h("span", { class: "t", text: t.text }), h("span", { class: "s", text: timeAgo(e.created_at) })))));
    return;
  }
  if (!sec.built) {
    fill($("list"), listHead(sec.label), h("div", { class: "list-body" }, h("div", { class: "item soon" }, h("span", { class: "row" }, h("span", { class: "t", text: sec.label }), soonBadge()), h("span", { class: "s", text: "Not built yet." }))));
    return;
  }
  const items = itemsFor(s);
  let chips = null, head = sec.label;
  if (s === "companies") {
    const g = companyGroups(), labels = { found: "Found", aside: "Set aside", known: "Already known" };
    chips = h("div", { class: "chips", role: "group", "aria-label": "Show" }, Object.keys(labels).map((k) => h("button", { type: "button", "aria-pressed": String(state.filter === k), onclick: () => { state.filter = k; state.itemId = null; render(); } }, `${labels[k]} (${g[k].length})`)));
  }
  if (s === "history") {
    chips = h("div", { class: "chips", role: "group", "aria-label": "Show" },
      h("button", { type: "button", "aria-pressed": String(!state.historyAll), onclick: () => { state.historyAll = false; state.itemId = null; render(); } }, "What Ava did"),
      h("button", { type: "button", "aria-pressed": String(state.historyAll), onclick: () => { state.historyAll = true; state.itemId = null; render(); } }, "Every step"));
  }
  const cur = currentItem();
  const rows = items.length === 0 ? h("p", { class: "empty", text: s === "goals" ? "No goals yet." : s === "companies" ? (state.filter === "found" ? "No companies found yet." : "Nothing here.") : "Nothing has happened yet." }) : items.slice(0, 200).map((i) => {
    const on = String(cur?.id === i.id);
    if (s === "goals") return h("button", { class: "item", type: "button", "aria-current": on, onclick: () => go(s, i.id) },
      h("span", { class: "row" }, h("span", { class: "t", text: clip(i.source_goal_text, 80) }), h("span", { class: `badge ${i.status === "confirmed" ? "good" : i.status === "cancelled" ? "" : "warn"}`, text: goalStatusLabel(i.status) })),
      h("span", { class: "s", text: `${i.found} of ${i.quantity} found` }));
    if (s === "companies") { const c = candOf(i); return h("button", { class: "item", type: "button", "aria-current": on, onclick: () => go(s, i.id) },
      h("span", { class: "row" }, h("span", { class: "t", text: clip(c.name, 70) || "(no name)" }), h("span", { class: `badge ${i.disposition === "discovered" ? "good" : i.disposition === "already_known" ? "wait" : "warn"}`, text: dispositionLabel(i.disposition) })),
      h("span", { class: "s", text: [c.geography_label, c.industry_label, noWebsite(c) ? "no website" : null].filter((x) => typeof x === "string" && x).join(" · ") || candidateReason(i) })); }
    return h("button", { class: "item", type: "button", "aria-current": on, onclick: () => go(s, i.id) }, h("span", { class: "t", text: i.s.text }), h("span", { class: "s", text: timeAgo(i.ev.created_at) }));
  });
  fill($("list"), listHead(head, { search: s !== "goals" || items.length > 6, chips }), h("div", { class: "list-body" },
    s === "goals" ? h("button", { class: "item addrow", type: "button", onclick: () => addGoal.open() }, h("span", { class: "row" }, h("span", { class: "t", text: "+ Add goal" }))) : null, rows));
}

// ---- actions ------------------------------------------------------------------------------------------------------------------------------
function openSoon(name) { state.sheet = { kind: "soon", name }; render(); }
async function runSearch(objectiveId) {
  const f = facts();
  if (state.busy || runBlock(f) || !objectiveId) return;
  const helper = kind() === "pretend" ? HELPERS.pretend : HELPERS.real;
  const before = f.foundTotal;
  state.busy = true; state.runMessage = null; render();
  const res = await callHelper(helper, { org_id: state.orgId, ai_employee_id: f.employee.id, objective_id: objectiveId });
  await reload(true);
  state.busy = false;
  state.runMessage = state.data ? describeRun(res, facts().foundTotal - before) : { tone: "bad", text: "The search may have run, but the page could not reload. Press Refresh in Settings." };
  render();
}
function describeRun(res, newFound) {
  const err = res.data && typeof res.data.error === "string" ? res.data.error : null;
  if (res.status === 0) return { tone: "bad", text: "Could not reach the search helper. Check your connection and try again." };
  if (err === "organization_not_allowed_here") return { tone: "bad", text: plainReason(err).text };
  if (res.status === 403) return { tone: "bad", text: "Only the owner of this company can start a search." };
  if (res.status === 404) return { tone: "warn", text: "The search helper for this company is not switched on yet. Nothing was searched." };
  if (res.status === 503 && err) return { tone: "warn", text: plainReason(err).text };
  if (!res.ok || res.data?.status === "error") return { tone: "bad", text: "The search helper had a problem. Nothing was lost - you can try again." };
  const body = res.data || {};
  const first = Array.isArray(body.runs) ? body.runs[0] : null;
  const kindWord = kind() === "pretend" ? "pretend " : "";
  const refused = first?.outcome?.status === "refused" ? first.outcome.blockers?.[0] : null;
  const stopReason = first?.outcome?.reason || body.reason || body.blocked?.[0]?.reason || null;
  if (refused) { const r = plainReason(refused); return { tone: "warn", text: `Ava did not search. ${r.text}`, code: r.code }; }
  if (newFound > 0) {
    const run = state.data.runs[0];
    const tail = run && run.status !== "running" ? runSentence(run, null, null).text : "";
    return { tone: "good", text: `Found ${newFound} new ${kindWord}${word(newFound, "company", "companies")}. ${tail}`.trim() };
  }
  if (body.status === "blocked" || first?.outcome?.status === "stopped") { const r = plainReason(stopReason); return { tone: "warn", text: `Ava did not search. ${r.text}`, code: r.code }; }
  if (body.status === "budget_reached") return { tone: "wait", text: "Part of the search is done. Press the button again to continue." };
  return { tone: "neutral", text: "Nothing new this time. Everything the source offered was already found or set aside." };
}
async function setStop(on) {
  if (state.busy || !org()) return;
  state.busy = true; state.sheet = null; render();
  const res = await rpc("set_organization_status", { p_org_id: state.orgId, p_status: on ? "suspended" : "active", p_reason: on ? "owner_emergency_stop" : "owner_resumed" });
  state.busy = false;
  if (!res.ok) { state.loadError = on ? "Could not switch the Emergency stop on. Please press it again, and if it still fails, do not rely on it." : "Could not resume. Please try again."; render(); return; }
  state.loadError = null;
  await reload(true);
  render();
}
function setTheme(t) { state.theme = t; render(); }

// ---- screens ------------------------------------------------------------------------------------------------------------------------------
function messageBox(m) {
  if (!m) return null;
  return h("div", { class: `notice ${m.tone}`, role: "status" }, m.text, m.code ? h("details", { class: "d" }, h("summary", { text: "Details" }), m.code) : null);
}
function tile(label, ic, onclick, { soon = false, danger = false, disabled = false } = {}) {
  return h("button", { class: `tile${danger ? " danger" : ""}`, type: "button", disabled, onclick }, h("span", { class: "ic" }, icon(ic, 28)), h("span", { text: label }), soon ? h("span", { class: "flag", text: "Soon" }) : null);
}
function targetsCard() {
  const t = state.data.targets;
  const both = t?.ok && t.industries && t.geographies;
  return h("div", { class: "card" },
    h("div", { class: "row2" }, h("h3", { text: "Who you target" }), t?.ok ? h("span", { class: `badge ${both ? "good" : "warn"}`, text: both ? "Set" : "Not set yet" }) : null),
    t?.ok
      ? h("p", { class: "muted", text: both ? `Kinds of company: ${t.industries.values.join(", ")}. Places: ${t.geographies.values.join(", ")}.` : "Goals cannot be confirmed until you choose the kinds of company and the places Ava may search." })
      : h("p", { class: "muted", text: "Could not read this just now." }),
    h("button", { class: both ? "btn ghost block" : "btn primary block", type: "button", onclick: () => targets.open() }, both ? "Change who you target" : "Choose who you target"));
}
function goalCard(g) {
  return h("button", { class: "card item", type: "button", onclick: () => go("goals", g.id) },
    h("span", { class: "row2" }, h("span", { class: "t", text: clip(g.source_goal_text, 120) }), h("span", { class: `badge ${g.status === "confirmed" ? "good" : g.status === "cancelled" ? "" : "warn"}`, text: goalStatusLabel(g.status) })),
    bar(g.quantity > 0 ? g.found / g.quantity : 0), h("span", { class: "s", text: `Found ${g.found} of ${g.quantity}` }));
}

function renderHome() {
  const f = facts(), o = org(), stopped = isStopped(), block = runBlock(f), pick = f.confirmed.length > 1;
  const st = homeStatus({ org: o, employee: f.employee, latestRun: f.latestRun, runningStale: f.runningStale, activeJobs: f.activeJobs });
  const abilities = state.data.authorities.filter((a) => a.enabled && f.employee && a.ai_employee_id === f.employee.id).map((a) => capabilityLabel(a.capability_key));
  const lastEv = headlineEvents()[0];
  const target = () => (pick ? $("goal-pick").value : f.confirmed[0]?.id);
  const newCos = companyGroups().found.slice(0, 4);
  return [
    h("div", { class: "card hero" },
      h("div", { class: "label" }, icon("branch", 16), `Main branch${f.employee ? ` · ${f.employee.name}` : ""}`),
      h("div", { class: "big", text: state.busy ? "Searching…" : st.title }), h("div", { class: "sub", text: state.busy ? "A search is in progress. This can take up to a minute." : st.line }),
      h("button", { class: "pill-btn pill", type: "button", disabled: !!block || state.busy, onclick: () => runSearch(target()) }, icon("plus", 18), "Run search")),
    lastEv ? h("div", { class: "latest" }, icon("check", 18), h("span", { class: "txt", text: lastEv.s.text }), h("button", { type: "button", onclick: () => go("history", lastEv.ev.id) }, "History ›")) : null,
    pick ? h("div", { class: "card" }, h("label", { class: "small muted", for: "goal-pick", text: "Search for which goal?" }), h("select", { id: "goal-pick", class: "pick" }, f.confirmed.map((g) => h("option", { value: g.id, text: clip(g.source_goal_text, 70) })))) : null,
    h("div", { class: "card" }, h("div", { class: "tiles" },
      tile("Run search", "run", () => runSearch(target()), { disabled: !!block || state.busy }),
      tile("Add goal", "plus", () => addGoal.open(), { disabled: state.busy }),
      tile("Approve", "check", () => openSoon("Approve"), { soon: true }),
      tile(stopped ? "Resume" : "Emergency stop", stopped ? "run" : "stop", stopped ? () => { state.sheet = { kind: "resume" }; render(); } : () => setStop(true), { danger: !stopped, disabled: state.busy })),
      block ? h("p", { class: "muted small", text: block }) : null),
    messageBox(state.runMessage),
    h("div", { class: "row2" }, h("h3", { text: "Your goals" }), f.goals.length > 3 ? h("button", { class: "textbtn", type: "button", onclick: () => go("goals") }, `See all ${f.goals.length} ›`) : null),
    f.goals.length === 0 ? h("div", { class: "card empty" }, h("p", { text: "No goals yet." }), h("button", { class: "btn primary", type: "button", onclick: () => addGoal.open() }, "Add your first goal")) : f.goals.slice(0, 3).map(goalCard),
    targetsCard(),
    h("h3", { text: "New companies" }),
    h("div", { class: "card" }, newCos.length === 0 ? h("p", { class: "muted", text: "None found yet." }) : h("div", { class: "cardlist" }, newCos.map((c) => h("button", { class: "li linkrow", type: "button", onclick: () => { state.filter = "found"; go("companies", c.id); } },
      h("div", { class: "row2" }, h("strong", { text: clip(candOf(c).name, 70) || "(no name)" }), h("span", { class: "badge good", text: "New" })),
      h("div", { class: "muted small", text: [candOf(c).geography_label, candOf(c).industry_label].filter((x) => typeof x === "string" && x).join(" · ") }))))),
    h("h3", { text: "Your AI employee" }),
    f.employee ? h("div", { class: "card" }, h("div", { class: "row2" }, h("h3", { text: f.employee.name }), h("span", { class: `badge ${f.employee.status === "active" ? "good" : "bad"}`, text: f.employee.status === "active" ? "Active" : "Switched off" })),
      h("p", { class: "muted", text: abilities.length ? `Allowed to: ${abilities.join("; ")}.` : "Not allowed to do anything yet." }), h("button", { class: "btn ghost block", type: "button", onclick: () => permissions.open() }, "What Ava may do")) : h("div", { class: "card empty", text: "No AI employee in this company yet." }),
    h("div", { class: "card" }, h("div", { class: "row2" }, h("h3", { text: "Needs your approval" }), soonBadge()), h("p", { class: "muted small", text: "When Ava wants to send a message or take a bigger step, it will wait for you here." })),
    h("p", { class: "foot", text: state.data.loadedAt ? `Updated ${new Date(state.data.loadedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.` : "" }),
  ];
}

function renderGoalDetail(g) {
  const f = facts(), block = runBlock(f), sent = runSentence(g.latestRun, g.quantity, g.found);
  return [
    h("h1", { class: "page-title" }, clip(g.source_goal_text, 160), h("span", { class: `badge ${g.status === "confirmed" ? "good" : g.status === "cancelled" ? "" : "warn"}`, text: goalStatusLabel(g.status) })),
    h("div", { class: "card" }, h("p", { text: `Found ${g.found} of ${g.quantity}` }), bar(g.quantity > 0 ? g.found / g.quantity : 0),
      g.status === "confirmed" ? h("p", { class: "muted", text: sent.text }) : null,
      g.status === "confirmed" && sent.code ? h("details", { class: "d" }, h("summary", { text: "Details" }), sent.code) : null,
      g.latestRun ? h("p", { class: "when", text: `Last search ${timeAgo(g.latestRun.created_at)}` }) : null,
      h("dl", { class: "kv" }, goalCriteriaLine(g.criteria) ? [h("dt", { text: "Looking for" }), h("dd", { text: goalCriteriaLine(g.criteria) })] : null, h("dt", { text: "Branch" }), h("dd", { text: "Main" }), f.employee ? [h("dt", { text: "Ava" }), h("dd", { text: f.employee.name })] : null),
      messageBox(state.runMessage),
      g.status === "confirmed" ? h("button", { class: "btn primary block bigbtn", type: "button", disabled: !!block || state.busy, onclick: () => runSearch(g.id) }, icon("run", 20), state.busy ? "Searching…" : "Run a search for this goal") : null,
      g.status === "confirmed" && block ? h("p", { class: "muted small", text: block }) : null,
      g.status === "awaiting_confirmation" ? h("button", { class: "btn primary block bigbtn", type: "button", onclick: () => addGoal.review(g.id) }, icon("check", 20), "Review and confirm") : null),
    g.runs.length ? h("div", { class: "card" }, h("h3", { text: `${g.runs.length} ${word(g.runs.length, "search", "searches")} so far` }),
      h("div", { class: "cardlist" }, g.runs.slice(0, 10).map((r) => { const s = runSentence(r, g.quantity, state.data.candidates.filter((c) => c.run_id === r.id && c.disposition === "discovered").length); return h("div", { class: "li" }, h("div", { text: s.text }), creditsNote(r) ? h("div", { class: "muted small", text: creditsNote(r) }) : null, h("div", { class: "when", text: timeAgo(r.created_at) })); }))) : null,
  ];
}
function renderCompanyDetail(c) {
  const cand = candOf(c), f = facts();
  const goal = f.goals.find((g) => g.runs.some((r) => r.id === c.run_id));
  const why = c.disposition === "discovered" ? [fitSentence(c.criteria_match), candidateReason(c)].filter(Boolean).join(" ") : [candidateReason(c), fitSentence(c.criteria_match)].filter(Boolean).join(" ");
  return [
    h("h1", { class: "page-title" }, clip(cand.name, 100) || "(no name)", h("span", { class: `badge ${c.disposition === "discovered" ? "good" : c.disposition === "already_known" ? "wait" : "warn"}`, text: dispositionLabel(c.disposition) })),
    h("div", { class: "card" }, h("h3", { text: "Why Ava thinks this" }), h("p", { text: why }),
      h("dl", { class: "kv" },
        cand.geography_label ? [h("dt", { text: "Place" }), h("dd", { text: cand.geography_label })] : null,
        cand.industry_label ? [h("dt", { text: "Kind of company" }), h("dd", { text: cand.industry_label })] : null,
        Number.isInteger(cand.employee_count) ? [h("dt", { text: "Size" }), h("dd", { text: `${cand.employee_count} employees` })] : null,
        typeof cand.domain === "string" && cand.domain ? [h("dt", { text: "Website" }), h("dd", { text: clip(cand.domain, 80) })] : noWebsite(cand) ? [h("dt", { text: "Website" }), h("dd", {}, h("span", { class: "badge warn", text: "No website" }), " The data service has no website for this company, so Ava tells it apart by the service's own record instead.")] : null,
        f.employee ? [h("dt", { text: "Found by" }), h("dd", { text: f.employee.name })] : null,
        goal ? [h("dt", { text: "For the goal" }), h("dd", { text: clip(goal.source_goal_text, 120) })] : null,
        h("dt", { text: "Found" }), h("dd", { text: timeAgo(c.created_at) }), h("dt", { text: "Branch" }), h("dd", { text: "Main" }))),
    h("div", { class: "card" }, h("div", { class: "row2" }, h("h3", { text: "Next steps" }), soonBadge()), h("p", { class: "muted small", text: "Research this company, write a first message, and follow it through the pipeline." })),
  ];
}
function renderHistoryDetail(i) {
  return [
    h("h1", { class: "page-title", text: "What happened" }),
    h("div", { class: "card" }, h("p", { text: i.s.text }), h("p", { class: "when", text: timeAgo(i.ev.created_at) }),
      h("dl", { class: "kv" }, h("dt", { text: "When" }), h("dd", { text: new Date(i.ev.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) }), h("dt", { text: "Where" }), h("dd", { text: "Main branch" }))),
  ];
}
function renderSoon(sec) {
  return [
    h("h1", { class: "page-title" }, sec.label, soonBadge()),
    h("div", { class: "soonbox" }, icon(sec.icon, 40), h("h3", { text: "This part is not built yet" }), h("p", { text: SOON[sec.id] })),
  ];
}

function renderMain() {
  const s = state.section, sec = SECTIONS.find((x) => x.id === s);
  const err = state.loadError ? h("div", { class: "notice bad loaderr", role: "alert", text: state.loadError }) : null;
  if (!state.data) { fill($("main"), err, h("p", { class: "empty", text: state.loadError ? "" : "Loading…" })); return; }
  if (s === "addgoal") { fill($("main"), err, addGoal.render()); return; }
  if (s === "targets") { fill($("main"), err, targets.render()); return; }
  if (s === "permissions") { fill($("main"), err, permissions.render()); return; }
  if (s === "providertest") { fill($("main"), err, providerTest.render()); return; }
  let body;
  if (s === "home") body = renderHome();
  else if (!sec.built) body = renderSoon(sec);
  else {
    const it = currentItem();
    body = it ? (s === "goals" ? renderGoalDetail(it) : s === "companies" ? renderCompanyDetail(it) : renderHistoryDetail(it)) : [s === "goals" ? h("div", { class: "empty" }, h("p", { text: "No goals yet." }), h("button", { class: "btn primary", type: "button", onclick: () => addGoal.open() }, "Add your first goal")) : h("p", { class: "empty", text: "Pick something from the list." })];
  }
  fill($("main"), err, s === "home" ? null : h("button", { class: "back", type: "button", onclick: () => { state.itemId = null; render(); } }, icon("back", 18), sec.label), s === "home" ? h("h1", { class: "page-title", text: org()?.name ?? "Home" }) : null, body);
}

function renderTabbar() {
  const moreOn = ["outreach", "inbox", "pipeline"].includes(state.section);
  fill($("tabbar"), TABS.map((id) => {
    if (id === "more") return h("button", { class: "tab", type: "button", "aria-current": moreOn ? "page" : null, onclick: () => { state.sheet = { kind: "more" }; render(); } }, icon("more", 24), "More");
    const s = SECTIONS.find((x) => x.id === id);
    return h("button", { class: "tab", type: "button", "aria-current": state.section === id || (id === "goals" && state.section === "addgoal") ? "page" : null, onclick: () => go(id) }, icon(s.icon, 24), s.label);
  }));
}

function renderSheet() {
  const root = $("sheet-root"), sh = state.sheet;
  if (!sh) { fill(root); return; }
  const close = () => { state.sheet = null; render(); };
  const seg = (label, on, fn, ic) => h("button", { type: "button", "aria-pressed": String(on), onclick: fn }, ic ? icon(ic, 16) : null, label);
  const settings = [
    h("h3", { text: "Appearance" }),
    h("div", { class: "seg" }, seg("Auto", state.theme === "auto", () => setTheme("auto"), "auto"), seg("Light", state.theme === "light", () => setTheme("light"), "sun"), seg("Dark", state.theme === "dark", () => setTheme("dark"), "moon")),
    h("h3", { text: "This page" }),
    h("button", { class: "rowbtn", type: "button", onclick: () => { state.sheet = null; permissions.open(); } }, icon("check", 22), "What Ava may do"),
    h("button", { class: "rowbtn", type: "button", onclick: () => { state.sheet = null; targets.open(); } }, icon("goals", 22), "Who you target"),
    h("button", { class: "rowbtn", type: "button", onclick: () => { state.sheet = null; providerTest.open(); } }, icon("refresh", 22), "Provider test"),
    h("button", { class: "rowbtn", type: "button", onclick: async () => { state.sheet = null; render(); await reload(true); render(); } }, icon("refresh", 22), "Refresh now"),
    h("button", { class: "rowbtn", type: "button", onclick: async () => { await signOut(); showSignIn(); } }, icon("logout", 22), "Sign out"),
  ];
  let content;
  if (sh.kind === "soon") content = [h("h2", { text: sh.name }), soonBadge(), h("p", { class: "muted", text: "This part is not built yet. It is shown here so you can see where it will live." }), h("button", { class: "btn primary block", type: "button", onclick: close }, "OK")];
  else if (sh.kind === "resume") content = [h("h2", { text: "Let Ava work again?" }), h("p", { class: "muted", text: "This switches the Emergency stop off for this company." }), h("button", { class: "btn primary block", type: "button", onclick: () => setStop(false) }, "Yes, resume"), h("button", { class: "btn ghost block", type: "button", onclick: close }, "Not yet")];
  else if (sh.kind === "settings") content = [h("h2", { text: "Settings" }), settings];
  else content = [h("h2", { text: "More" }), h("div", { class: "menu" }, ["outreach", "inbox", "pipeline"].map((id) => { const s = SECTIONS.find((x) => x.id === id); return h("button", { type: "button", onclick: () => go(id) }, icon(s.icon, 24), s.label, soonBadge()); })), settings];
  const sheet = h("div", { class: "sheet", role: "dialog", "aria-modal": "true", tabindex: "-1" }, content);
  const overlay = h("div", { class: "overlay", onclick: (e) => { if (e.target === overlay) close(); } }, sheet);
  fill(root, overlay);
  sheet.focus();
}

function render() {
  applyTheme();
  const app = $("app");
  app.setAttribute("data-pane", pane());
  app.setAttribute("data-section", state.section);
  renderStrip(); renderTop(); renderList(); renderMain(); renderTabbar(); renderSheet();
}

// ---- loading ------------------------------------------------------------------------------------------------------------------------------
async function reload(keepMessage = false) {
  const my = ++state.loadId;
  const cos = await loadCompanies();
  if (my !== state.loadId) return;
  if (!cos.ok || !Array.isArray(cos.data)) { if (isSignedIn()) state.loadError = "Could not load your companies. Check your connection and press Refresh in Settings."; return; }
  state.companies = cos.data;
  if (!state.companies.some((c) => c.id === state.orgId)) {
    let saved = null; try { saved = localStorage.getItem(ORG_KEY); } catch { /* ignore */ }
    state.orgId = state.companies.find((c) => c.id === saved)?.id ?? state.companies[0]?.id ?? null;
  }
  if (!state.orgId) { state.data = null; state.loadError = "You are not a member of any company yet, so there is nothing to show."; return; }
  const d = await loadCompany(state.orgId);
  if (my !== state.loadId) return;
  if (!d.ok) { if (isSignedIn()) state.loadError = "Could not load everything. Check your connection and press Refresh in Settings."; return; }
  d.targets = await loadTargets(state.orgId);
  if (my !== state.loadId) return;
  state.loadError = null;
  state.data = d;
  if (!keepMessage) state.runMessage = null;
}
async function refreshNow() { await reload(true); render(); }

// ---- sign in / out ------------------------------------------------------------------------------------------------------------------------
function showSignIn() { $("app").hidden = true; $("sheet-root").replaceChildren(); $("signin").hidden = false; Object.assign(state, { data: null, companies: [], orgId: null, sheet: null, loadError: null, runMessage: null, itemId: null, section: "home", addGoal: null, targets: null, perm: null, pt: null }); $("password").value = ""; }
async function showApp() { $("signin").hidden = true; $("app").hidden = false; render(); await reload(); render(); }

$("signin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("signin-error"); err.hidden = true;
  const email = $("email").value.trim(), password = $("password").value;
  if (!email || !password) { err.textContent = "Enter both your email and your password."; err.hidden = false; return; }
  $("signin-btn").disabled = true;
  const r = await signIn(email, password);
  $("signin-btn").disabled = false;
  $("password").value = "";
  if (!r.ok) { err.textContent = r.network ? "Could not reach the server. Check your connection and try again." : "That email and password did not work."; err.hidden = false; return; }
  await showApp();
});
onSignedOut(showSignIn);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.sheet) { state.sheet = null; render(); } });
desktop.addEventListener("change", () => { if (state.data) render(); });
setInterval(() => { if (isSignedIn() && !document.hidden && !state.busy && !state.sheet) refreshNow(); }, 30000);
document.addEventListener("visibilitychange", () => { if (isSignedIn() && !document.hidden && !state.busy && !state.sheet) refreshNow(); });

applyTheme();
if (isSignedIn()) await showApp(); else showSignIn();
