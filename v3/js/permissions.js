// The "What Ava may do" screen. It uses ONLY the existing owner-only permission function (public.set_ai_authority), which the platform itself restricts to
// the company owner, checks against the plan, and writes to the history. The dashboard never switches anything on by itself: the only thing that ever
// changes a permission is the owner's own "Yes" on the confirm card. Allowing a search does NOT start one.
import { PERMISSIONS, SEARCH_KEY, FIT_KEY, FIT_NOTE, ASK_KEYS, ASK_NOTE, NO_SEARCH_NOTE, permissionState, stateText, stateTone, rpcArgs, confirmCopy, refusalText } from "./permissions-logic.js";

export function createPermissions(ctx) {
  const { h, icon, state: app } = ctx;
  const pm = () => app.perm;
  const set = (patch) => { if (!pm()) return; Object.assign(pm(), patch); ctx.render(); };   // the owner may leave the screen while a save is finishing
  const employee = () => (app.data ? app.data.employees.find((e) => e.status === "active") || app.data.employees[0] || null : null);
  const companyName = () => app.companies.find((c) => c.id === app.orgId)?.name ?? "this company";

  function open() { app.perm = { asking: null, working: false, notice: null }; ctx.go("permissions"); }

  /** Step 1: pressing a switch only opens the confirm card. Nothing is sent yet. */
  function ask(key, on) { if (pm().working) return; set({ asking: { key, on }, notice: null }); }

  /** Step 2: the owner's "Yes". Sent once; a second press while it is working does nothing. */
  async function confirm() {
    const p = pm(), emp = employee();
    if (!p.asking || p.working || !emp) return;
    const { key, on } = p.asking;
    set({ working: true, notice: null });
    const row = permissionState(app.data.authorities, emp.id, key).row;
    const res = await ctx.rpc("set_ai_authority", rpcArgs(app.orgId, emp.id, key, row, on));
    if (!res.ok) { const r = refusalText(res); set({ working: false, asking: null, notice: { tone: "bad", text: r.text, code: r.detail } }); return; }
    await ctx.reload(true);
    const changed = Array.isArray(res.data) ? res.data[0]?.changed !== false : true;
    set({ working: false, asking: null, notice: { tone: "good", text: !changed ? "It was already set that way, so nothing changed." : ASK_KEYS.has(key) ? (on ? `Done. ${emp.name} may now write messages for you to approve. Nothing was written or sent.` : `Done. ${emp.name} can no longer write messages to companies.`) : key === FIT_KEY ? (on ? `Done. ${emp.name} may now judge whether companies fit. No research was started.` : `Done. ${emp.name} can no longer judge whether companies fit.`) : on ? `Done. ${emp.name} may now search for new companies. No search was started.` : `Done. ${emp.name} can no longer search for new companies.` } });
  }

  const note = (n) => (n ? h("div", { class: `notice ${n.tone}`, role: "status" }, n.text, n.code ? h("details", { class: "d" }, h("summary", { text: "Details" }), n.code) : null) : null);

  function row(emp, perm) {
    const s = permissionState(app.data.authorities, emp.id, perm.key);
    const busy = pm().working;
    return h("div", { class: "li permrow" },
      h("div", { class: "row2" }, h("strong", { text: perm.label }), h("span", { class: `badge ${stateTone(s.state)}`, text: stateText(s.state) })),
      h("div", { class: "muted small", text: perm.detail }),
      perm.switchable ? h("button", { class: `btn ${s.state === "off" ? "primary" : "ghost"} block`, type: "button", disabled: busy, onclick: () => ask(perm.key, s.state === "off") }, s.state === "off" ? "Switch on" : "Switch off") : null);
  }

  function askCard(emp) {
    const a = pm().asking, copy = a && confirmCopy(a.key, a.on, emp.name);
    if (!copy) return null;
    const busy = pm().working;
    return h("div", { class: "card ask", role: "alertdialog", "aria-labelledby": "perm-ask-title" },
      h("h3", { id: "perm-ask-title", text: copy.title }), h("p", { text: copy.body }),
      a.on ? h("div", { class: "notice warn", text: ASK_KEYS.has(a.key) ? ASK_NOTE : a.key === FIT_KEY ? FIT_NOTE : NO_SEARCH_NOTE }) : null,
      h("button", { class: "btn primary block bigbtn", type: "button", disabled: busy, onclick: confirm }, icon("check", 20), busy ? "Saving…" : copy.yes),
      h("button", { class: "btn ghost block", type: "button", disabled: busy, onclick: () => set({ asking: null }) }, copy.no));
  }

  function render() {
    const p = pm() ?? (app.perm = { asking: null, working: false, notice: null }), emp = employee();
    return [
      h("button", { class: "back always", type: "button", onclick: () => ctx.go("home") }, icon("back", 18), "Home"),
      h("h1", { class: "page-title", text: "What Ava may do" }),
      h("p", { class: "mainnote", text: `These are the things ${emp ? emp.name : "your AI employee"} is allowed to do for ${companyName()}. Only you, the owner, can change them.` }),
      !emp ? h("div", { class: "card empty", text: "There is no AI employee in this company yet." }) : [
        h("div", { class: "card" }, h("div", { class: "notice", role: "note", text: NO_SEARCH_NOTE })),
        note(p.notice),
        askCard(emp),
        h("div", { class: "card" }, h("h3", { text: emp.name }), h("div", { class: "cardlist" }, PERMISSIONS.map((perm) => row(emp, perm)))),
        h("p", { class: "muted small", text: "Every change is saved in your History. Anything marked “Not available yet” cannot be switched on from here." }),
      ],
    ];
  }

  return { open, render, SEARCH_KEY };
}
