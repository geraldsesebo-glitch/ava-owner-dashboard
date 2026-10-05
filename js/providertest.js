// The "Provider test" screen (Settings). It calls ONE owner-only test function that runs two fixed, capped searches (3 companies each, at most 6 credits).
// The page never chooses the searches, the sizes or the limit; it only says which company is asking and repeats the limit it expects. Nothing is saved.
// A search only ever starts from the owner's own "Yes, run the test" press, and a second press while it is running does nothing.
import { INTRO, CAP_CREDITS, FUNCTION_NAME, requestBody, interpret, overview, copyText } from "./providertest-logic.js";

export function createProviderTest(ctx) {
  const { h, icon, state: app } = ctx;
  const pt = () => app.pt;
  const fresh = () => ({ asking: false, working: false, outcome: null, copied: null });
  const set = (patch) => { Object.assign(pt(), patch); ctx.render(); };
  const companyName = () => app.companies.find((c) => c.id === app.orgId)?.name ?? "this company";

  function open() { app.pt = fresh(); ctx.go("settings", "providertest"); }

  /** Step 1: the button only opens the confirm card. Nothing is sent. */
  function ask() { if (pt().working) return; set({ asking: true, outcome: null, copied: null }); }

  /** Step 2: the owner's "Yes". Sent once. */
  async function run() {
    const p = pt();
    if (!p.asking || p.working || !app.orgId) return;
    set({ working: true, asking: false, outcome: null, copied: null });
    const res = await ctx.call(FUNCTION_NAME, requestBody(app.orgId));
    if (!pt()) return;                                                 // the owner left the screen while it ran; nothing to show
    set({ working: false, outcome: interpret(res) });
  }

  async function copy() {
    const o = pt().outcome;
    if (!o || o.kind !== "ran") return;
    const text = copyText(o.data);
    try { await navigator.clipboard.writeText(text); set({ copied: { ok: true, text } }); }
    catch { set({ copied: { ok: false, text } }); }                    // no clipboard access: show the text so it can be selected by hand
  }

  const searchCard = (v) => h("div", { class: "card" },
    h("div", { class: "row2" }, h("strong", { text: v.label }), h("span", { class: `badge ${v.ok ? "good" : v.ran ? "bad" : ""}`, text: v.ok ? "Worked" : v.ran ? "Did not work" : "Not sent" })),
    h("p", { text: v.headline }),
    v.problem ? h("div", { class: "notice bad", role: "status" }, v.problem.text, v.problem.detail ? h("details", { class: "d" }, h("summary", { text: "Details" }), v.problem.detail) : null) : null,
    v.companies.length ? h("div", { class: "cardlist" }, v.companies.map((c) => h("div", { class: "li" }, h("strong", { text: c.name }), h("div", { class: "muted small", text: c.site }), c.more ? h("div", { class: "muted small", text: c.more }) : null))) : null,
    v.facts.length ? h("ul", { class: "muted small" }, v.facts.map((f) => h("li", { text: f }))) : null);

  function result(outcome) {
    if (outcome.kind !== "ran") return [h("div", { class: `notice ${outcome.kind === "nokey" ? "warn" : "bad"}`, role: "status" }, outcome.text, outcome.detail ? h("details", { class: "d" }, h("summary", { text: "Details" }), outcome.detail) : null)];
    const o = overview(outcome.data), c = pt().copied;
    return [
      h("div", { class: `notice ${o.ok ? "good" : "warn"}`, role: "status" }, h("strong", { text: o.title }), o.stop ? h("div", { text: o.stop }) : null),
      h("div", { class: "card" }, h("p", { text: `${o.sent} ${o.sent === 1 ? "search" : "searches"} sent. ${o.companies} ${o.companies === 1 ? "company" : "companies"} came back.` }), h("p", { text: o.creditsText }), h("p", { class: "muted small", text: "Compare this with your balance on the service’s own website." })),
      ...o.views.map(searchCard),
      h("button", { class: "btn primary", type: "button", onclick: copy }, icon("check", 16), "Copy result"),
      c ? h("div", { class: `notice ${c.ok ? "good" : "warn"}`, role: "status" }, c.ok ? "Copied. You can paste it into the chat." : "Your browser would not copy it automatically. Select the text below and copy it yourself.") : null,
      c && !c.ok ? h("textarea", { class: "copybox", readonly: true, rows: 12, "aria-label": "Result to copy", onfocus: (e) => e.target.select() }, c.text) : null,
    ];
  }

  function askCard() {
    return h("div", { class: "card ask", role: "alertdialog", "aria-labelledby": "pt-ask-title" },
      h("h3", { id: "pt-ask-title", text: "Run the test now?" }),
      h("p", { text: `This sends up to two real searches and uses up to ${CAP_CREDITS} credits from your People Data Labs account. It cannot use more.` }),
      h("button", { class: "btn primary", type: "button", onclick: run }, icon("check", 16), "Yes, run the test"),
      h("button", { class: "btn", type: "button", onclick: () => set({ asking: false }) }, "Not now"));
  }

  function render() {
    const p = pt() ?? (app.pt = fresh());
    return [
      h("h1", { class: "page-title", text: "Provider test" }),
      h("p", { class: "mainnote", text: `A small, limited check of a real company-data service for ${companyName()}. Only you, the owner, can run it.` }),
      h("div", { class: "card" }, INTRO.map((t) => h("p", { text: t }))),
      p.asking ? askCard() : null,
      p.working ? h("div", { class: "notice", role: "status", text: "Running the test… this can take a few seconds." }) : null,
      !p.asking && !p.working ? h("button", { class: "btn primary", type: "button", onclick: ask }, icon("refresh", 16), p.outcome ? "Run the test again" : "Run the test") : null,
      p.outcome ? result(p.outcome) : null,
    ];
  }

  return { open, render };
}
