// The Pipeline screen: every company in its stage (Found -> Researched -> Qualified -> Drafted -> Approved -> Contacted -> Replied), with a CSV download.
// Read-only: the stages come from the platform's records, so nothing here can move a company by hand.
import { STAGES, FILTERS, filterRows, groupByStage, originText, toCsv } from "./pipeline-logic.js";
import { fitWords, fitTone } from "./research-logic.js";

export function createPipeline(ctx) {
  const { h, icon, state: app } = ctx;
  const st = () => app.pipe;
  const fresh = () => ({ filter: "all", query: "", stage: "found" });
  const set = (patch) => { Object.assign(st(), patch); ctx.render(); };

  function open() { app.pipe = fresh(); ctx.go("pipeline"); }

  function download() {
    const csv = toCsv(app.data?.pipeline ?? [], app.data?.contacts ?? []);
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = h("a", { href: url, download: `pipeline-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function card(r) {
    return h("button", { class: "pcard", type: "button", onclick: () => ctx.openCompany(r.subject_id) },
      h("span", { class: "t", text: r.name || "(no name)" }),
      h("span", { class: "s", text: [r.place, r.website].filter(Boolean).join(" · ") || "no place or website yet" }),
      h("span", { class: "tags" },
        h("span", { class: `badge ${r.on_owner_list ? "good" : ""}`, text: originText(r) }),
        r.opted_out ? h("span", { class: "badge bad", text: "Do not contact" }) : null,
        r.needs_review ? h("span", { class: "badge warn", text: "Check for duplicate" }) : null,
        !r.website ? h("span", { class: "badge warn", text: "needs a website" }) : null,
        r.fit_label ? h("span", { class: `badge ${fitTone(r.fit_label)}`, text: fitWords(r.fit_label) }) : null));
  }

  function render() {
    const s = st() ?? (app.pipe = fresh());
    const all = app.data?.pipeline ?? [];
    const rows = filterRows(all, s.filter, s.query), groups = groupByStage(rows);
    return [
      h("h1", { class: "page-title", text: "Pipeline" }),
      h("p", { class: "mainnote", text: "Every company, and how far it has got. Ava moves a company along as she does the work; you cannot drag one by hand, so this always matches the real records." }),
      h("div", { class: "pipehead" },
        h("div", { class: "chips", role: "group", "aria-label": "Show" }, FILTERS.map((f) => h("button", { type: "button", "aria-pressed": String(s.filter === f.key), onclick: () => set({ filter: f.key }) }, f.label))),
        h("label", { class: "searchbox inline" }, icon("search", 18), h("span", { class: "sr-only", text: "Search" }), h("input", { type: "search", placeholder: "Search", value: s.query, id: "pipe-q", oninput: (e) => { st().query = e.target.value; ctx.render(); const again = document.getElementById("pipe-q"); if (again) { again.focus(); again.setSelectionRange(e.target.selectionStart, e.target.selectionStart); } } })),
        h("button", { class: "btn ghost", type: "button", disabled: all.length === 0, onclick: download }, icon("pipeline", 18), "Download as CSV")),
      all.length > 0 ? ctx.research.strip(all) : null,
      all.length === 0 ? h("div", { class: "card empty" }, h("p", { text: "No companies yet. Add your own list, or run a search." }), h("button", { class: "btn primary", type: "button", onclick: () => ctx.openImport() }, "Import my list")) : null,
      h("div", { class: "stagechips", role: "group", "aria-label": "Stage" }, STAGES.map((g) => h("button", { type: "button", "aria-pressed": String(s.stage === g.key), onclick: () => set({ stage: g.key }) }, `${g.label} (${groups[g.key].length})`))),
      h("div", { class: "pipe" }, STAGES.map((g) => h("section", { class: "pipecol", "data-on": String(s.stage === g.key), "aria-label": g.label },
        h("h3", {}, g.label, h("span", { class: "count", text: String(groups[g.key].length) })),
        h("p", { class: "muted small", text: g.hint }),
        groups[g.key].length === 0 ? h("p", { class: "muted small", text: "Nothing here." }) : groups[g.key].slice(0, 100).map(card)))),
    ];
  }

  return { open, render };
}
