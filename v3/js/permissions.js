// "What Ava may do". It uses ONLY the existing owner-only permission function (public.set_ai_authority), which the platform itself restricts to
// the company owner, checks against the plan, and writes to the history. The dashboard never switches anything on by itself: the only thing that ever
// changes a permission is the owner's own "Yes" on the confirm card. Pressing a switch only opens that card. Allowing a search does NOT start one.
import { PERMISSIONS, SEARCH_KEY, FIT_KEY, FIT_NOTE, ASK_KEYS, ASK_NOTE, NO_SEARCH_NOTE, permissionState, rpcArgs, confirmCopy, refusalText } from "./permissions-logic.js";

/** One plain line for each permission (the full wording stays on the confirm card). */
const ONE_LINE = {
  research_prospect: "Check a company's details from outside sources.",
  discover_prospects: "Look for new companies that fit a goal you have confirmed.",
  run_discovery_unattended: "Search without being asked.",
  qualify_prospect: "Read a company's own public website and say how well it fits.",
  engage_prospect: "Write a first email for you to approve. She asks you first, every time.",
  follow_up: "Write follow-ups and replies for you to approve. She asks you first, every time.",
  record_opportunity: "Note a sales opportunity.",
};
const GROUPS = [
  { title: "Finding companies", keys: ["research_prospect", "discover_prospects", "run_discovery_unattended"] },
  { title: "Judging companies", keys: ["qualify_prospect"] },
  { title: "Writing to companies", keys: ["engage_prospect", "follow_up"] },
  { title: "Later", keys: ["record_opportunity"] },
];

export function createPermissions(ctx) {
  const { h, icon, state: app } = ctx;
  const pm = () => app.perm;
  const set = (patch) => { if (!pm()) return; Object.assign(pm(), patch); ctx.render(); };   // the owner may leave the screen while a save is finishing
  const employee = () => (app.data ? app.data.employees.find((e) => e.status === "active") || app.data.employees[0] || null : null);
  const companyName = () => app.companies.find((c) => c.id === app.orgId)?.name ?? "this company";

  function open() { app.perm = { asking: null, working: false, notice: null }; ctx.go("settings", "permissions"); }

  /** Step 1: pressing a switch only opens the confirm card. Nothing is sent yet. */
  function ask(key, on) {
    if (pm().working) return;
    set({ asking: { key, on }, notice: null });
    ctx.openSheet({ kind: "custom", render: askSheet });
  }

  /** Step 2: the owner's "Yes". Sent once; a second press while it is working does nothing. */
  async function confirm() {
    const p = pm(), emp = employee();
    if (!p || !p.asking || p.working || !emp) return;
    const { key, on } = p.asking;
    set({ working: true, notice: null });
    const row = permissionState(app.data.authorities, emp.id, key).row;
    const res = await ctx.rpc("set_ai_authority", rpcArgs(app.orgId, emp.id, key, row, on));
    if (!res.ok) { const r = refusalText(res); ctx.closeSheet(); set({ working: false, asking: null, notice: { tone: "bad", text: r.text, code: r.detail } }); return; }
    await ctx.reload(true);
    const changed = Array.isArray(res.data) ? res.data[0]?.changed !== false : true;
    ctx.closeSheet();
    set({ working: false, asking: null, notice: { tone: "good", text: !changed ? "It was already set that way, so nothing changed." : ASK_KEYS.has(key) ? (on ? `Done. ${emp.name} may now write messages for you to approve. Nothing was written or sent.` : `Done. ${emp.name} can no longer write messages to companies.`) : key === FIT_KEY ? (on ? `Done. ${emp.name} may now judge whether companies fit. No research was started.` : `Done. ${emp.name} can no longer judge whether companies fit.`) : on ? `Done. ${emp.name} may now search for new companies. No search was started.` : `Done. ${emp.name} can no longer search for new companies.` } });
  }

  const note = (n) => (n ? h("div", { class: `notice ${n.tone === "bad" ? "bad" : ""}`, role: "status" }, n.text, n.code ? h("details", { class: "d" }, h("summary", { text: "Details" }), n.code) : null) : null);

  function askSheet(close) {
    const emp = employee(), a = pm()?.asking, copy = emp && a ? confirmCopy(a.key, a.on, emp.name) : null;
    if (!copy) return [h("p", { text: "Nothing to confirm." })];
    const busy = pm().working;
    return [h("h2", { id: "perm-ask-title", text: copy.title }), h("p", { class: "muted", text: copy.body }),
      a.on ? h("div", { class: "notice warn", text: ASK_KEYS.has(a.key) ? ASK_NOTE : a.key === FIT_KEY ? FIT_NOTE : NO_SEARCH_NOTE }) : null,
      h("div", { class: "btnrow" },
        h("button", { class: "btn", type: "button", disabled: busy, onclick: () => { set({ asking: null }); close(); } }, copy.no),
        h("button", { class: `btn ${a.on ? "primary" : "danger"}`, type: "button", disabled: busy, onclick: confirm }, busy ? "Saving…" : copy.yes))];
  }

  function row(emp, perm) {
    const s = permissionState(app.data.authorities, emp.id, perm.key);
    const busy = pm().working, on = s.state !== "off";
    return h("div", { class: "srow" },
      h("div", { class: "l" },
        h("div", { class: "t" }, perm.label, s.state === "asks" ? h("span", { class: "tag warn", text: "Asks you first" }) : null, !perm.switchable ? h("span", { class: "tag soon", text: "Soon" }) : null),
        h("div", { class: "s", text: ONE_LINE[perm.key] ?? perm.detail })),
      h("div", { class: "r" },
        perm.switchable ? [h("span", { class: "state-text", text: on ? "On" : "Off" }), h("button", { class: "switch", type: "button", role: "switch", "aria-checked": String(on), "aria-label": perm.label, disabled: busy, onclick: () => ask(perm.key, !on) })]
          : h("span", { class: "state-text", text: on ? "On" : "Off" })));
  }

  function render() {
    const p = pm() ?? (app.perm = { asking: null, working: false, notice: null }), emp = employee();
    return [
      h("div", { class: "page-h" }, h("h1", { text: "What Ava may do" })),
      h("p", { class: "mainnote", text: `The things ${emp ? emp.name : "your AI employee"} is allowed to do for ${companyName()}. Only you, the owner, can change them. Switching something on never starts anything by itself.` }),
      !emp ? stateBlock0() : [
        note(p.notice),
        GROUPS.map((g) => [h("h2", { class: "label13", text: g.title }), h("div", { class: "card" }, g.keys.map((k) => PERMISSIONS.find((x) => x.key === k)).filter(Boolean).map((perm) => row(emp, perm)))]),
        h("p", { class: "muted small", text: "Every change is saved in your Activity. Anything marked Soon cannot be switched on from here yet." }),
      ],
    ];
  }
  const stateBlock0 = () => h("div", { class: "card empty", text: "There is no AI employee in this company yet." });

  return { open, render, SEARCH_KEY };
}
