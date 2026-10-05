// The owner dashboard, look 3. The frame (left strip, side panel, top bar, phone bar), navigation, loading, Pause Ava / Resume, sign-in.
// Same data and same buttons as the working dashboard in ../owner-dashboard-v2: every action calls the same existing function as before. Behaviour, safety rules and the owner's authority are unchanged.
// Everything shown from the database is put on the page as plain text only (never as markup, never as a link), so nothing a source sends can change the page.
// Branches do not exist in the database yet: "Main branch" is only a label for the one place everything lives today.
import { HELPERS } from "./config.js";
import { signIn, signOut, isSignedIn, onSignedOut, rpc, select, callHelper, ownerFirstName } from "./api.js";
import { loadCompanies, loadCompany, loadTargets, loadKnowledge } from "./data.js";
import { plainReason, runSentence, timeAgo } from "./text.js";
import { icon } from "./icons.js";
import { h, fill, word, stateBlock } from "./ui.js";
import { createDerived } from "./derived.js";
import { byStatus } from "./outreach-logic.js";
import { createAddGoal } from "./addgoal.js";
import { createHome } from "./home.js";
import { createGoalsPage } from "./goalspage.js";
import { createCompanies } from "./companies.js";
import { createOutreachHub } from "./outreachhub.js";
import { createConnectors } from "./connectors.js";
import { createCompanySection } from "./companysection.js";
import { createSettings } from "./settings.js";
import { createActivity } from "./activity.js";

const $ = (id) => document.getElementById(id);
const ORG_KEY = "ava_owner_dashboard_v3_org";
const PREF_KEY = "ava_owner_dashboard_v3_prefs";
const desktop = window.matchMedia("(min-width: 900px)");

const SECTIONS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "companies", label: "Companies", icon: "companies" },
  { id: "outreach", label: "Outreach", icon: "outreach" },
  { id: "connectors", label: "Connectors", icon: "connectors" },
  { id: "company", label: "Company", icon: "company" },
];
const SETTINGS = { id: "settings", label: "Settings", icon: "settings" };
const TABS = ["home", "companies", "outreach", "connectors", "more"];

function loadPrefs() {
  const p = { theme: "auto", size: "default", density: "comfortable" };
  try { const j = JSON.parse(localStorage.getItem(PREF_KEY) || "{}"); if (["auto", "light", "dark"].includes(j.theme)) p.theme = j.theme; if (["small", "default", "large"].includes(j.size)) p.size = j.size; if (["comfortable", "compact"].includes(j.density)) p.density = j.density; } catch { /* private window: defaults */ }
  return p;
}

const state = {
  companies: [], orgId: null, data: null, nav: { section: "home", sub: null, item: null }, busy: false, runMessage: null, sheet: null, prefs: loadPrefs(), loadId: 0, loadError: null, loadedOnce: false,
  addGoal: null, targets: null, perm: null, pt: null, imp: null, ci: null, tpl: null, costs: null, co: null, ap: null, ib: null, res: null,
};
const d = createDerived(state);

/** Screens that keep their own working state only while you are on them (cleared when you leave), and where each one lives. */
const SCREEN_AT = { addGoal: ["home", null], targets: ["company", "targets"], perm: ["settings", "permissions"], pt: ["settings", "providertest"], imp: ["companies", "import"], ci: ["company", "info"], tpl: ["outreach", "templates"], costs: ["settings", "costs"], ap: ["outreach", "approve"], ib: ["outreach", "replies"] };
const FORM_SCREENS = ["targets", "imp", "ci", "tpl", "costs"];

// ---- applying the look preferences ----------------------------------------------------------------------------------------------------------------
function applyPrefs() {
  const root = document.documentElement, p = state.prefs;
  if (p.theme === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", p.theme);
  if (p.size === "default") root.removeAttribute("data-size"); else root.setAttribute("data-size", p.size);
  if (p.density === "comfortable") root.removeAttribute("data-density"); else root.setAttribute("data-density", p.density);
}
function setPref(key, value) {
  state.prefs = { ...state.prefs, [key]: value };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(state.prefs)); } catch { /* fine */ }
  render();
}

// ---- navigation -----------------------------------------------------------------------------------------------------------------------------------
function go(section, sub = null, item = null) {
  state.nav = { section, sub, item };
  for (const [key, [sec, sub2]] of Object.entries(SCREEN_AT)) if (!(state.nav.section === sec && state.nav.sub === sub2)) state[key] = null;
  state.sheet = null;
  try { history.replaceState(null, "", `#${[section, sub ?? "", item ?? ""].join("/").replace(/\/+$/, "")}`); } catch { /* fine */ }
  render();
  $("main").scrollTop = 0; $("panel").scrollTop = 0;
}
/** Opens on the place named in the address (#section/sub/item), so a refresh keeps you where you were. Only ids and screen names are ever in it. */
function routeFromAddress() {
  const [section, sub, item] = location.hash.replace(/^#\/?/, "").split("/");
  if ([...SECTIONS, SETTINGS].some((s) => s.id === section)) state.nav = { section, sub: sub || null, item: item || null };
}
const counts = () => ({ approve: state.data ? byStatus(state.data.drafts, "waiting").length : 0 });

// ---- actions (the same functions as before) -----------------------------------------------------------------------------------------------------
async function runSearch(objectiveId) {
  const f = d.facts();
  if (state.busy || d.runBlock(f) || !objectiveId || !f.runnable.some((g) => g.id === objectiveId)) return;
  const helper = d.kind() === "pretend" ? HELPERS.pretend : HELPERS.real;
  const before = f.foundTotal;
  state.busy = true; state.runMessage = null; render();
  const res = await callHelper(helper, { org_id: state.orgId, ai_employee_id: f.employee.id, objective_id: objectiveId });
  await reload(true);
  state.busy = false;
  state.runMessage = state.data ? describeRun(res, d.facts().foundTotal - before) : { tone: "bad", text: "The search may have run, but the page could not reload. Press Refresh in Settings, under Advanced." };
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
  const kindWord = d.kind() === "pretend" ? "pretend " : "";
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
/** Pause Ava / Resume: the same existing owner-only function as the old Emergency stop. */
async function setStop(on) {
  if (state.busy || !d.org()) return;
  state.busy = true; state.sheet = null; render();
  const res = await rpc("set_organization_status", { p_org_id: state.orgId, p_status: on ? "suspended" : "active", p_reason: on ? "owner_emergency_stop" : "owner_resumed" });
  state.busy = false;
  if (!res.ok) { state.loadError = on ? "Could not pause Ava. Please press Pause Ava again, and if it still fails, do not rely on it." : "Could not resume. Please try again."; render(); return; }
  state.loadError = null;
  await reload(true);
  render();
}

// ---- the screens ----------------------------------------------------------------------------------------------------------------------------------
const ctx = {
  h, icon, state, d, render: () => render(), reload: (keep) => reload(keep), go, rpc, select, call: callHelper, setPref, setStop, runSearch, signOutNow: async () => { await signOut(); showSignIn(); },
  refresh: async () => { await reload(true); render(); }, firstName: ownerFirstName, counts,
  openSheet: (sheet) => { state.sheet = sheet; render(); }, closeSheet: () => { state.sheet = null; render(); },
};
const addGoal = createAddGoal(ctx); ctx.addGoal = addGoal;
const companies = createCompanies(ctx);
ctx.openCompany = (id) => companies.select(id);
ctx.openImport = () => go("companies", "import");
ctx.openTargets = () => go("company", "targets");
ctx.openPermissions = () => go("settings", "permissions");
ctx.openApprove = () => go("outreach", "approve");
const mods = {
  home: createHome(ctx), companies, outreach: createOutreachHub(ctx), connectors: createConnectors(ctx), company: createCompanySection(ctx), settings: createSettings(ctx),
};
ctx.goals = createGoalsPage(ctx);
ctx.activity = createActivity(ctx);
mods.home.attach({ goals: ctx.goals, activity: ctx.activity });

// ---- the frame ------------------------------------------------------------------------------------------------------------------------------------
function renderPause() {
  const root = $("pausebar");
  if (!d.org() || !d.isStopped()) { root.hidden = true; fill(root); return; }
  root.hidden = false;
  fill(root, icon("pause", 16), h("span", { text: "Ava is paused. Nothing is running." }),
    h("button", { class: "btn resume sm", type: "button", disabled: state.busy, onclick: () => { state.sheet = { kind: "resume" }; render(); } }, icon("run", 16), "Resume"));
}

function renderStrip() {
  const c = counts();
  const btn = (s) => h("button", { class: "nav-btn", type: "button", title: s.label, "aria-current": state.nav.section === s.id ? "page" : null, onclick: () => go(s.id) },
    icon(s.icon, 20), h("span", { text: s.label }), s.id === "outreach" && c.approve > 0 ? h("span", { class: "count", "aria-label": `${c.approve} waiting`, text: c.approve > 99 ? "99+" : String(c.approve) }) : null);
  fill($("strip"), h("div", { class: "brand", "aria-hidden": "true", text: "A" }), SECTIONS.map(btn), h("div", { class: "strip-foot" }, btn(SETTINGS)));
}

function renderTop() {
  const o = d.org(), stopped = d.isStopped(), st = state.data ? d.status() : null;
  const sel = h("select", { id: "company-select", "aria-label": "Company", disabled: state.companies.length < 2, onchange: async (e) => {
    state.orgId = e.target.value; state.runMessage = null; state.data = null; state.loadError = null;
    for (const k of Object.keys(SCREEN_AT)) state[k] = null;
    state.nav = { section: "home", sub: null, item: null };
    try { localStorage.setItem(ORG_KEY, state.orgId); } catch { /* fine */ }
    render(); await reload(); render();
  } }, state.companies.map((c) => h("option", { value: c.id, text: c.name })));
  if (state.orgId) sel.value = state.orgId;
  const paused = stopped, label = paused ? "Ava is paused" : st?.key === "searching" ? "Ava is searching" : st?.key === "working" ? "Ava is working" : "Ava is resting";
  fill($("top"),
    h("label", { class: "picker" }, icon("company", 16), h("span", { class: "sr-only", text: "Company" }), sel, h("span", { class: "branch", text: "Main branch" })),
    o && d.kind() === "pretend" ? h("span", { class: "pretend-chip", role: "note", title: "Everything here is made up. No real company is involved." }, icon("flask", 14), h("span", { class: "desk-only", text: "Pretend data" })) : null,
    h("span", { class: "grow" }),
    o ? h("span", { class: `status-pill${paused ? " paused" : st?.key === "searching" || st?.key === "working" ? " on" : ""}`, role: "status" }, h("i", { "aria-hidden": "true" }), h("span", { class: "label", text: label }), h("span", { class: "sr-only phone-only", text: label })) : null,
    o && !paused ? h("button", { class: "btn btn-pause", type: "button", disabled: state.busy, onclick: () => { state.sheet = { kind: "pause" }; render(); } }, icon("pause", 16), h("span", {}, "Pause", h("span", { class: "desk-only", text: " Ava" }))) : null);
}

function renderPanel() {
  const m = mods[state.nav.section];
  const body = state.data || state.nav.section === "settings" ? m.panel?.() : null;
  fill($("panel"), body ?? [h("div", { class: "panel-h", text: SECTIONS.concat(SETTINGS).find((s) => s.id === state.nav.section)?.label ?? "" }), h("div", { class: "panel-body" }, h("p", { class: "muted small", text: state.loadError ? "" : "Loading…" }))]);
}

function renderMain() {
  const main = $("main");
  if (!state.data) {
    if (state.loadError || (state.loadedOnce && !state.companies.length)) fill(main, h("div", { class: "page" }, stateBlock({ icon: "bad", tone: "bad", title: "Can’t reach the service", text: state.loadError || "Check your connection, then try again.", action: { label: "Try again", icon: "refresh", onclick: async () => { state.loadError = null; render(); await reload(); render(); } } })));
    else fill(main, h("div", { class: "page" }, h("p", { class: "empty", text: "Loading…" })));
    return;
  }
  const err = state.loadError ? h("div", { class: "notice bad loaderr", role: "alert", text: state.loadError }) : null;
  fill(main, err, mods[state.nav.section].main());
}

function renderTabbar() {
  const c = counts(), moreOn = ["company", "settings"].includes(state.nav.section) || (state.nav.section === "home" && state.nav.sub === "activity");
  fill($("tabbar"), TABS.map((id) => {
    if (id === "more") return h("button", { class: "tab", type: "button", "aria-current": moreOn ? "page" : null, onclick: () => { state.sheet = { kind: "more" }; render(); } }, icon("more", 20), "More");
    const s = SECTIONS.find((x) => x.id === id);
    return h("button", { class: "tab", type: "button", "aria-current": state.nav.section === id ? "page" : null, onclick: () => go(id) }, icon(s.icon, 20), s.label,
      id === "outreach" && c.approve > 0 ? h("span", { class: "count", text: c.approve > 99 ? "99+" : String(c.approve) }) : null);
  }));
}

function renderSheet() {
  const root = $("sheet-root"), sh = state.sheet;
  if (!sh) { fill(root); return; }
  const close = () => { state.sheet = null; render(); };
  let content, wide = false;
  if (sh.kind === "pause") content = [h("h2", { text: "Pause Ava?" }), h("p", { class: "muted", text: "Ava stops all searches and work right away. Nothing is deleted, and you can resume any time." }),
    h("div", { class: "btnrow" }, h("button", { class: "btn", type: "button", onclick: close }, "Cancel"), h("button", { class: "btn danger", type: "button", onclick: () => setStop(true) }, icon("pause", 16), "Pause Ava"))];
  else if (sh.kind === "resume") content = [h("h2", { text: "Let Ava work again?" }), h("p", { class: "muted", text: "This resumes Ava for this company. Nothing starts by itself: searches still only run when you press a button." }),
    h("div", { class: "btnrow" }, h("button", { class: "btn", type: "button", onclick: close }, "Not yet"), h("button", { class: "btn primary", type: "button", onclick: () => setStop(false) }, "Yes, resume"))];
  else if (sh.kind === "more") {
    const row = (ic, label, fn) => h("button", { type: "button", onclick: fn }, icon(ic, 18), label);
    content = [h("h2", { text: "More" }), h("div", { class: "menu" },
      row("company", "Company", () => go("company")), row("activity", "Activity", () => go("home", "activity")), row("settings", "Settings", () => go("settings")),
      row("logout", "Sign out", async () => { await signOut(); showSignIn(); }))];
  } else if (sh.kind === "custom") { content = sh.render(close); wide = !!sh.wide; }
  const sheet = h("div", { class: `sheet${wide ? " wide" : ""}`, role: "dialog", "aria-modal": "true", tabindex: "-1" }, content);
  const overlay = h("div", { class: "overlay", onclick: (e) => { if (e.target === overlay) close(); } }, sheet);
  fill(root, overlay);
  sheet.focus();
}

function render() {
  applyPrefs();
  const app = $("app");
  app.setAttribute("data-section", state.nav.section);
  document.title = "Ava";
  renderPause(); renderStrip(); renderTop(); renderPanel(); renderMain(); renderTabbar(); renderSheet();
}

// ---- loading --------------------------------------------------------------------------------------------------------------------------------------
async function reload(keepMessage = false) {
  const my = ++state.loadId;
  const cos = await loadCompanies();
  if (my !== state.loadId) return;
  state.loadedOnce = true;
  if (!cos.ok || !Array.isArray(cos.data)) { if (isSignedIn()) state.loadError = "Could not load your companies. Check your connection, then try again."; return; }
  state.companies = cos.data;
  if (!state.companies.some((c) => c.id === state.orgId)) {
    let saved = null; try { saved = localStorage.getItem(ORG_KEY); } catch { /* ignore */ }
    state.orgId = state.companies.find((c) => c.id === saved)?.id ?? state.companies[0]?.id ?? null;
  }
  if (!state.orgId) { state.data = null; state.loadError = "You are not a member of any company yet, so there is nothing to show."; return; }
  const [data, targets, knowledge] = await Promise.all([loadCompany(state.orgId), loadTargets(state.orgId), loadKnowledge(state.orgId)]);
  if (my !== state.loadId) return;
  if (!data.ok) { if (isSignedIn()) state.loadError = "Could not load everything. Check your connection, then try again."; return; }
  data.targets = targets; data.knowledge = knowledge;
  state.loadError = null;
  state.data = data;
  if (!keepMessage) state.runMessage = null;
}

// ---- sign in / out ------------------------------------------------------------------------------------------------------------------------------
function showSignIn() {
  $("app").hidden = true; $("sheet-root").replaceChildren(); $("signin").hidden = false;
  Object.assign(state, { data: null, companies: [], orgId: null, sheet: null, loadError: null, runMessage: null, nav: { section: "home", sub: null, item: null }, addGoal: null, targets: null, perm: null, pt: null, imp: null, ci: null, tpl: null, costs: null, co: null, ap: null, ib: null, res: null, loadedOnce: false });
  $("password").value = "";
}
async function showApp() { $("signin").hidden = true; $("app").hidden = false; routeFromAddress(); render(); await reload(); render(); }

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
// background refresh never runs while a form is open or you are typing, so nothing you are typing is disturbed
const typing = () => { const a = document.activeElement; return !!a && ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName) && $("main").contains(a); };
const idle = () => isSignedIn() && !document.hidden && !state.busy && !state.sheet && !typing() && !FORM_SCREENS.some((k) => state[k]) && !(state.addGoal && state.addGoal.phase !== "input");
setInterval(() => { if (idle()) ctx.refresh(); }, 30000);
document.addEventListener("visibilitychange", () => { if (idle()) ctx.refresh(); });

applyPrefs();
if (isSignedIn()) await showApp(); else showSignIn();
