// Home: a calm page. A greeting, one big box to tell Ava what to find, four shortcuts, and what is left to set up. Nothing else.
// The left panel lists the goals (Active and Finished) with a link to all of them, and an Activity link at the bottom.
import { clip, word } from "./ui.js";
import { goalStatusLabel } from "./text.js";

const PANEL_ACTIVE = 8, PANEL_FINISHED = 3, PHONE_GOALS = 3;

export function createHome(ctx) {
  const { h, icon, state: app, d } = ctx;
  let sub = {};
  const attach = (m) => { sub = m; };

  function greeting() {
    const hr = new Date().getHours(), part = hr < 5 ? "Good evening" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
    const name = ctx.firstName();
    return name ? `${part}, ${name}` : part;
  }

  const goalMeta = (g) => (g.status === "awaiting_confirmation" ? "Waiting for your OK" : `${g.found} of ${g.quantity} found`);

  function panel() {
    if (!app.data) return null;
    const { active, finished } = d.goalGroups(), on = app.nav.item, inGoals = app.nav.sub === "goals";
    const item = (g) => h("button", { class: "pitem two", type: "button", "aria-current": String(inGoals && on === g.id), onclick: () => ctx.go("home", "goals", g.id) },
      h("span", { class: "t", text: g.source_goal_text }), h("span", { class: "s", text: goalMeta(g) }));
    return [
      h("div", { class: "panel-h", text: "Goals" }),
      h("div", { class: "panel-body" },
        h("div", { class: "psec", text: `Active (${active.length})` }),
        active.length === 0 ? h("p", { class: "muted small pad", text: "No active goals." }) : active.slice(0, PANEL_ACTIVE).map(item),
        finished.length ? [h("div", { class: "psec", text: `Finished (${finished.length})` }), finished.slice(0, PANEL_FINISHED).map(item)] : null,
        h("button", { class: "plink", type: "button", "aria-current": inGoals && !on ? "true" : null, onclick: () => ctx.go("home", "goals") }, icon("goals", 16), `See all goals (${active.length + finished.length})`)),
      h("div", { class: "pfoot" }, h("button", { class: "plink", type: "button", "aria-current": app.nav.sub === "activity" ? "true" : null, onclick: () => ctx.go("home", "activity") }, icon("activity", 16), "Activity")),
    ];
  }

  function chips() {
    const c = (label, ic, fn) => h("button", { type: "button", onclick: fn }, icon(ic, 16), label);
    return h("div", { class: "chips shortcuts" },
      c("Import my list", "upload", () => ctx.go("companies", "import")),
      c("Who you target", "goals", () => ctx.go("company", "targets")),
      c("Message templates", "mail", () => ctx.go("outreach", "templates")),
      c("Connect a service", "connectors", () => ctx.go("connectors")));
  }

  function setupList() {
    const items = d.setupItems();
    if (items.length === 0) return null;
    return h("section", { class: "setup" },
      h("h2", { class: "label13", text: "To finish setting up" }),
      h("div", { class: "card flush" }, h("div", { class: "rowlist" }, items.map((it) =>
        h("button", { class: "lrow", type: "button", onclick: () => ctx.go(...it.go) },
          h("span", { class: "l" }, h("span", { class: "t", text: it.label }), h("span", { class: "s", text: it.why })),
          h("span", { class: "r" }, h("span", { class: "tag warn", text: "To do" }), icon("chevron", 16)))))));
  }

  function phoneGoals() {
    const gs = d.facts().goals, shown = gs.slice(0, PHONE_GOALS);
    if (shown.length === 0) return null;
    return h("section", { class: "phone-only" },
      h("div", { class: "row2 gap" }, h("h2", { class: "label13", text: "Your goals" }), gs.length > PHONE_GOALS ? h("button", { class: "textbtn", type: "button", onclick: () => ctx.go("home", "goals") }, `See all goals (${gs.length})`) : null),
      h("div", { class: "card flush" }, h("div", { class: "rowlist" }, shown.map((g) => h("button", { class: "lrow", type: "button", onclick: () => ctx.go("home", "goals", g.id) },
        h("span", { class: "l" }, h("span", { class: "t", text: g.source_goal_text }), h("span", { class: "s", text: goalMeta(g) })), h("span", { class: "r" }, icon("chevron", 16)))))));
  }

  function main() {
    if (app.nav.sub === "goals") return sub.goals.main();
    if (app.nav.sub === "activity") return sub.activity.main();
    return h("div", { class: "page home" },
      h("h1", { class: "greet", text: greeting() }),
      ctx.addGoal.render(),
      chips(),
      phoneGoals(),
      setupList());
  }

  return { panel, main, attach };
}
