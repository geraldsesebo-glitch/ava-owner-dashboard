// Goals: one goal's page (title, status, progress, the one main button, details, searches so far) and the "All goals" list.
import { REAL_RUN_MAX_GOAL } from "./config.js";
import { goalCriteriaLine, goalStatusLabel, runSentence, returnedNote, timeAgo } from "./text.js";
import { clip, bar, pager, word, stateBlock, keepFocus } from "./ui.js";

const PAGE = 25, RUNS_SHOWN = 5;

export function createGoalsPage(ctx) {
  const { h, icon, state: app, d } = ctx;
  const ui = { page: 0, q: "", runsMore: 0 };
  const tone = (g) => (d.isFinished(g) ? "good" : g.status === "awaiting_confirmation" ? "warn" : g.status === "confirmed" ? "good" : "");
  const statusText = (g) => (d.isFinished(g) ? "Finished" : goalStatusLabel(g.status));

  const msg = (m) => (!m ? null : h("div", { class: `notice ${m.tone}`, role: "status" }, m.text, m.code ? h("details", { class: "d" }, h("summary", { text: "Details" }), m.code) : null));

  function allGoals() {
    const gs = d.facts().goals.filter((g) => ui.q.trim() === "" || g.source_goal_text.toLowerCase().includes(ui.q.trim().toLowerCase()));
    const pages = Math.max(1, Math.ceil(gs.length / PAGE)); if (ui.page >= pages) ui.page = pages - 1;
    const shown = gs.slice(ui.page * PAGE, ui.page * PAGE + PAGE);
    const lastRun = (g) => (g.latestRun ? timeAgo(g.latestRun.created_at) : "No search yet");
    return h("div", { class: "page" },
      h("div", { class: "page-h" }, h("h1", { text: "All goals" }), h("span", { class: "grow" }), h("button", { class: "btn", type: "button", onclick: () => ctx.addGoal.open() }, icon("plus", 16), "New goal")),
      d.facts().goals.length === 0 ? stateBlock({ icon: "goals", title: "No goals yet", text: "Tell Ava what to find and she will show you what she understood first.", action: { label: "Tell Ava what to find", primary: true, onclick: () => ctx.addGoal.open() } })
        : h("div", { class: "card flush" },
          h("div", { class: "toolbar" }, h("label", { class: "searchbox" }, icon("search", 16), h("span", { class: "sr-only", text: "Search goals" }),
            h("input", { type: "search", id: "goal-q", placeholder: "Search goals", value: ui.q, oninput: (e) => { ui.q = e.target.value; ui.page = 0; keepFocus(() => document.getElementById("main"), "#goal-q", ctx.render)(e); } }))),
          h("div", { class: "tablewrap" }, h("table", { class: "tbl" },
            h("thead", {}, h("tr", {}, ["Goal", "Status", "Found", "Last search", "Branch"].map((t) => h("th", { scope: "col", text: t })))),
            h("tbody", {}, shown.map((g) => h("tr", { tabindex: "0", onclick: () => ctx.go("home", "goals", g.id), onkeydown: (e) => { if (e.key === "Enter") ctx.go("home", "goals", g.id); } },
              h("td", { class: "name", title: g.source_goal_text, text: clip(g.source_goal_text, 70) }), h("td", {}, h("span", { class: `tag ${tone(g)}`, text: statusText(g) })),
              h("td", { text: g.status === "awaiting_confirmation" ? "–" : `${g.found} of ${g.quantity}` }), h("td", { class: "muted", text: lastRun(g) }), h("td", { class: "muted", text: "Main" })))))),
          gs.length === 0 ? h("p", { class: "empty", text: "No goal matches that." }) : null,
          pager({ page: ui.page, size: PAGE, total: gs.length, onPage: (p) => { ui.page = p; ctx.render(); }, noun: "goals" })));
  }

  function oneGoal(g) {
    const f = d.facts(), block = d.runBlock(f), sent = runSentence(g.latestRun, g.quantity, g.found);
    const canRun = !block && !app.busy && f.runnable.some((x) => x.id === g.id);
    if (ui.runsFor !== g.id) { ui.runsFor = g.id; ui.runsMore = 0; }
    const shown = g.runs.slice(0, RUNS_SHOWN + ui.runsMore);
    const crit = goalCriteriaLine(g.criteria);
    return h("div", { class: "page" },
      h("button", { class: "crumb", type: "button", onclick: () => ctx.go("home", "goals") }, icon("back", 16), "All goals"),
      h("div", { class: "page-h" }, h("h1", { text: clip(g.source_goal_text, 160) }), h("span", { class: `tag ${tone(g)}`, text: statusText(g) })),
      h("div", { class: "card" },
        h("div", { class: "row2" }, h("strong", { text: g.status === "awaiting_confirmation" ? "Not started" : `Found ${g.found} of ${g.quantity}` }),
          g.status === "confirmed" ? h("button", { class: "btn primary hero-action", type: "button", disabled: !canRun, onclick: () => ctx.runSearch(g.id) }, icon("run", 16), app.busy ? "Searching…" : "Run a search for this goal") : null,
          g.status === "awaiting_confirmation" ? h("button", { class: "btn primary hero-action", type: "button", onclick: () => ctx.addGoal.review(g.id) }, icon("check", 16), "Review and confirm") : null),
        g.status === "confirmed" ? bar(g.quantity > 0 ? g.found / g.quantity : 0) : null,
        g.status === "confirmed" ? h("p", { class: "muted", text: sent.text }) : h("p", { class: "muted", text: "Nothing starts until you confirm this goal." }),
        g.status === "confirmed" && sent.code ? h("details", { class: "d" }, h("summary", { text: "Details" }), sent.code) : null,
        msg(app.runMessage),
        f.runningStale && f.latestRun && f.latestRun.owner_objective_id === g.id ? h("div", { class: "notice warn", role: "status" }, h("div", { text: "This search did not finish. Nothing was lost; the companies found so far are kept." }), h("button", { class: "btn sm", type: "button", disabled: !canRun, onclick: () => ctx.runSearch(g.id) }, icon("refresh", 16), "Try again")) : null,
        g.status === "confirmed" && block ? h("p", { class: "muted small", text: block }) : null,
        g.status === "confirmed" && !block && !f.runnable.some((x) => x.id === g.id) ? h("p", { class: "muted small", text: `This goal asks for more than ${REAL_RUN_MAX_GOAL} companies. For the first real searches only small goals can be searched from here.` }) : null),
      h("h2", { class: "label13", text: "Details" }),
      h("div", { class: "card" }, h("dl", { class: "kv first" },
        crit ? [h("dt", { text: "Looking for" }), h("dd", { text: crit })] : null,
        h("dt", { text: "How many" }), h("dd", { text: String(g.quantity) }),
        h("dt", { text: "Branch" }), h("dd", { text: "Main" }),
        f.employee ? [h("dt", { text: "Ava" }), h("dd", { text: f.employee.name })] : null,
        g.latestRun ? [h("dt", { text: "Last search" }), h("dd", { text: timeAgo(g.latestRun.created_at) })] : null,
        h("dt", { text: "Added" }), h("dd", { text: timeAgo(g.created_at) }))),
      h("h2", { class: "label13", text: g.runs.length ? `Searches so far (${g.runs.length})` : "Searches so far" }),
      g.runs.length === 0 ? h("div", { class: "card" }, h("p", { class: "muted", text: "No search has been run for this goal yet." }))
        : h("div", { class: "card" }, h("div", { class: "cardlist" }, shown.map((r) => {
          const s = runSentence(r, g.quantity, app.data.candidates.filter((c) => c.run_id === r.id && c.disposition === "discovered").length);
          return h("div", { class: "li" }, h("div", { text: s.text }), returnedNote(r) ? h("div", { class: "muted small", text: returnedNote(r) }) : null, h("div", { class: "when", text: timeAgo(r.created_at) }));
        })),
        g.runs.length > shown.length ? h("button", { class: "btn sm", type: "button", onclick: () => { ui.runsMore += 10; ctx.render(); } }, `Show more (${g.runs.length - shown.length} left)`) : null));
  }

  function main() {
    const id = app.nav.item;
    if (id) { const g = d.facts().goals.find((x) => x.id === id); if (g) return oneGoal(g); return h("div", { class: "page" }, stateBlock({ icon: "goals", title: "That goal is not here", text: "It may have been cancelled.", action: { label: "See all goals", onclick: () => ctx.go("home", "goals") } })); }
    return allGoals();
  }
  return { main };
}
