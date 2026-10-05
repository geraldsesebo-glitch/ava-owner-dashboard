// Companies. LIST is the default view (25 rows a page, search, filters, tick boxes with a selection bar); a Board (stages as columns, a few cards each plus "Show more") is the second view.
// Opening a company shows its details beside the list (not a new page). Import your list is its own page. Nothing here changes a company: the stage always comes from the real records.
import { STAGES, toCsv } from "./pipeline-logic.js";
import { toResearch } from "./research-logic.js";
import { dispositionLabel, candidateReason, fitSentence, noWebsite, timeAgo } from "./text.js";
import { clip, pager, stateBlock, keepFocus } from "./ui.js";
import { createResearch } from "./research.js";
import { createImporter } from "./importer.js";
import { createCompanyDetail } from "./companydetail.js";

const PAGE = 25, BOARD_FIRST = 5;
const FIT_OPTIONS = [["", "Any fit"], ["strong", "Strong fit"], ["maybe", "Maybe a fit"], ["weak", "Not a good fit"], ["unclear", "Not enough to tell"], ["none", "Not judged yet"]];
const FIT_TEXT = { strong: "Strong fit", maybe: "Maybe a fit", weak: "Not a good fit", unclear: "Not enough to tell" };
const FIT_TONE = { strong: "good", maybe: "warn" };

export function createCompanies(ctx) {
  const { h, icon, state: app, d } = ctx;
  const research = createResearch(ctx); ctx.research = research;
  const importer = createImporter(ctx); ctx.importer = importer;
  const detail = createCompanyDetail(ctx); ctx.detail = detail;
  const ui = { view: "all", layout: "list", q: "", stage: "", fit: "", source: "", needsWeb: false, page: 0, sel: new Set(), selected: null, more: {}, boardStage: "found", filters: false };

  const viewKey = () => { const s = app.nav.sub; if (s && d.VIEWS.some((v) => v.key === s)) ui.view = s; return ui.view; };

  function select(id) { ui.selected = id; ctx.go("companies", ui.view); }
  function closeDrawer() { ui.selected = null; ctx.render(); }
  const reset = () => { ui.page = 0; };

  // ---- the rows after search and filters ----
  function rows() {
    const q = ui.q.trim().toLowerCase();
    return d.viewRows(viewKey()).filter((r) => (!q || `${r.name} ${r.place} ${r.website} ${r.contact}`.toLowerCase().includes(q))
      && (!ui.stage || r.stage === ui.stage)
      && (!ui.fit || (ui.fit === "none" ? !r.fit : r.fit === ui.fit))
      && (!ui.source || (ui.source === "yours" ? r.yours : !r.yours && r.kind === "company"))
      && (!ui.needsWeb || r.needsWebsite));
  }
  const filtering = () => !!(ui.q || ui.stage || ui.fit || ui.source || ui.needsWeb);
  const clearFilters = () => { Object.assign(ui, { q: "", stage: "", fit: "", source: "", needsWeb: false, page: 0 }); ctx.render(); };

  // ---- panel ----
  function panel() {
    const counts = d.viewCounts(), cur = viewKey(), on = app.nav.sub !== "import";
    const item = (v) => h("button", { class: "pitem", type: "button", "aria-current": String(on && cur === v.key), onclick: () => { ui.page = 0; ui.sel.clear(); ctx.go("companies", v.key); } }, h("span", { class: "t", text: v.label }), h("span", { class: "n", text: String(counts[v.key]) }));
    return [
      h("div", { class: "panel-h", text: "Companies" }),
      h("div", { class: "panel-body" }, d.VIEWS.filter((v) => !v.smart).map(item), h("div", { class: "psec", text: "Smart views" }), d.VIEWS.filter((v) => v.smart).map(item)),
      h("div", { class: "pfoot" }, h("button", { class: "plink", type: "button", "aria-current": app.nav.sub === "import" ? "true" : null, onclick: () => ctx.go("companies", "import") }, icon("upload", 16), "Import your list")),
    ];
  }

  // ---- small pieces ----
  const fitTag = (r) => (r.fit ? h("span", { class: `tag ${FIT_TONE[r.fit] ?? ""}`, text: FIT_TEXT[r.fit] ?? "Judged" }) : h("span", { class: "muted", text: "–" }));
  const stageTag = (r) => h("span", { class: "tag", text: r.stageLabel });
  const websiteCell = (r) => (r.optedOut ? h("span", { class: "tag bad", text: "Do not contact" }) : r.website ? h("span", { class: "muted", text: clip(r.website, 40) }) : h("span", { class: "tag warn", text: "Needs a website" }));

  function download(list) {
    const subjectIds = new Set(list.filter((r) => r.kind === "company").map((r) => r.subject_id));
    const csv = toCsv(app.data.pipeline.filter((p) => subjectIds.has(p.subject_id)), app.data.contacts ?? []);
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = h("a", { href: url, download: `companies-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ---- toolbar ----
  function toolbar(list) {
    const sel = (value, opts, set, label) => h("select", { "aria-label": label, class: "pick", onchange: (e) => { set(e.target.value); reset(); ctx.render(); } }, opts.map(([v, t]) => h("option", { value: v, text: t, selected: v === value })));
    return h("div", { class: "toolbar" },
      h("label", { class: "searchbox" }, icon("search", 16), h("span", { class: "sr-only", text: "Search companies" }),
        h("input", { type: "search", id: "co-q", placeholder: "Search companies", value: ui.q, oninput: (e) => { ui.q = e.target.value; reset(); keepFocus(() => document.getElementById("main"), "#co-q", ctx.render)(e); } })),
      h("span", { class: "desk-only toolgroup" },
        sel(ui.stage, [["", "Any stage"], ...STAGES.map((s) => [s.key, s.label])], (v) => { ui.stage = v; }, "Stage"),
        sel(ui.fit, FIT_OPTIONS, (v) => { ui.fit = v; }, "Fit"),
        sel(ui.source, [["", "Any source"], ["yours", "Your list"], ["found", "Found by Ava"]], (v) => { ui.source = v; }, "Source"),
        h("label", { class: "tog" }, h("input", { type: "checkbox", checked: ui.needsWeb, onchange: (e) => { ui.needsWeb = e.target.checked; reset(); ctx.render(); } }), "Needs a website")),
      filtering() ? h("button", { class: "textbtn desk-only", type: "button", onclick: clearFilters }, "Clear filters") : null);
  }

  // ---- list ----
  function listView(list) {
    const pages = Math.max(1, Math.ceil(list.length / PAGE)); if (ui.page >= pages) ui.page = pages - 1;
    const shown = list.slice(ui.page * PAGE, ui.page * PAGE + PAGE);
    const allOn = shown.length > 0 && shown.every((r) => ui.sel.has(r.key));
    const selected = list.filter((r) => ui.sel.has(r.key));
    const toDo = toResearch(selected.filter((r) => r.kind === "company").map((r) => r.row));
    const row = (r) => h("tr", { tabindex: "0", "aria-selected": String(ui.selected === r.key), onclick: () => select(r.key), onkeydown: (e) => { if (e.key === "Enter") select(r.key); } },
      h("td", { class: "tick", onclick: (e) => e.stopPropagation() }, h("input", { type: "checkbox", "aria-label": `Select ${r.name}`, checked: ui.sel.has(r.key), onchange: (e) => { e.target.checked ? ui.sel.add(r.key) : ui.sel.delete(r.key); ctx.render(); } })),
      h("td", { class: "name", title: r.name, text: clip(r.name, 60) }), h("td", { class: "muted c-place", text: clip(r.place, 30) || "–" }), h("td", {}, stageTag(r)), h("td", {}, fitTag(r)), h("td", { class: "c-website" }, websiteCell(r)),
      h("td", { class: "muted c-contact", text: r.contact ? `${clip(r.contact, 24)}${r.contactCount > 1 ? ` +${r.contactCount - 1}` : ""}` : "No contact" }), h("td", { class: "muted c-source", text: r.source }));
    return h("div", { class: "card flush" },
      toolbar(list),
      selected.length ? h("div", { class: "selbar", role: "status" }, h("span", { class: "grow", text: `${selected.length} selected` }),
        h("button", { class: "btn sm", type: "button", disabled: toDo.length === 0 || app.busy, title: toDo.length === 0 ? "Nothing to research in this selection" : "", onclick: () => research.run(toDo) }, icon("sparkles", 16), `Research with Ava${toDo.length ? ` (${toDo.length})` : ""}`),
        h("button", { class: "btn sm", type: "button", onclick: () => download(selected) }, icon("download", 16), "Download"),
        h("button", { class: "btn sm", type: "button", onclick: () => { ui.sel.clear(); ctx.render(); } }, "Clear")) : null,
      list.length === 0 ? emptyFor() :
        h("div", { class: "tablewrap desk-only" }, h("table", { class: "tbl" },
          h("thead", {}, h("tr", {}, h("th", { class: "tick" }, h("input", { type: "checkbox", "aria-label": "Select all on this page", checked: allOn, onchange: (e) => { for (const r of shown) e.target.checked ? ui.sel.add(r.key) : ui.sel.delete(r.key); ctx.render(); } })),
            [["Company", ""], ["Place", "c-place"], ["Stage", ""], ["Fit", ""], ["Website", "c-website"], ["Contact", "c-contact"], ["Source", "c-source"]].map(([t, c]) => h("th", { scope: "col", class: c, text: t })))),
          h("tbody", {}, shown.map(row)))),
      list.length ? h("div", { class: "rowlist phone-only" }, shown.map((r) => h("button", { class: "lrow", type: "button", onclick: () => select(r.key) },
        h("span", { class: "l" }, h("span", { class: "t", text: r.name }), h("span", { class: "s", text: [r.place, r.stageLabel, r.contact ? null : "No contact"].filter(Boolean).join(" · ") })),
        h("span", { class: "r" }, r.optedOut ? h("span", { class: "tag bad", text: "Do not contact" }) : r.fit ? fitTag(r) : r.needsWebsite ? h("span", { class: "tag warn", text: "No website" }) : null, icon("chevron", 16))))) : null,
      list.length ? pager({ page: ui.page, size: PAGE, total: list.length, onPage: (p) => { ui.page = p; ctx.render(); document.getElementById("main").scrollTop = 0; } }) : null);
  }

  function emptyFor() {
    if (d.companyRows().length === 0) return stateBlock({ icon: "companies", title: "No companies yet", text: "Add your own list, or tell Ava what to find on Home.", action: { label: "Import your list", primary: true, icon: "upload", onclick: () => ctx.go("companies", "import") } });
    if (filtering()) return stateBlock({ icon: "search", title: "Nothing matches", text: "Try clearing the search or the filters.", action: { label: "Clear filters", onclick: clearFilters }, inline: true });
    return stateBlock({ icon: "companies", title: "Nothing here", text: viewKey() === "ready" ? "When Ava has written a message for you to approve, the company shows up here." : "Companies will show up here as they are added or found.", inline: true });
  }

  // ---- board ----
  function boardView(list) {
    const company = list.filter((r) => r.kind === "company");
    const by = Object.fromEntries(STAGES.map((s) => [s.key, company.filter((r) => r.stage === s.key)]));
    const card = (r) => h("button", { class: "bcard", type: "button", "aria-pressed": String(ui.selected === r.key), onclick: () => select(r.key) },
      h("span", { class: "t", text: r.name }), h("span", { class: "s", text: r.place || r.website || "no place or website yet" }),
      h("span", { class: "tags" }, r.optedOut ? h("span", { class: "tag bad", text: "Do not contact" }) : null, r.fit ? fitTag(r) : null, r.needsWebsite ? h("span", { class: "tag warn", text: "Needs a website" }) : null));
    const col = (s) => {
      const items = by[s.key], n = BOARD_FIRST + (ui.more[s.key] ?? 0), shown = items.slice(0, n);
      return h("section", { class: "bcol", "data-on": String(ui.boardStage === s.key), "aria-label": s.label },
        h("h3", {}, s.label, h("span", { class: "muted", text: String(items.length) })),
        items.length === 0 ? h("p", { class: "muted small", text: "Nothing here." }) : shown.map(card),
        items.length > n ? h("button", { class: "btn sm block", type: "button", onclick: () => { ui.more[s.key] = (ui.more[s.key] ?? 0) + 10; ctx.render(); } }, `Show more (${items.length - n})`) : null);
    };
    return h("div", {},
      toolbar(list),
      h("div", { class: "chiprow phone-only stagechips" }, STAGES.map((s) => h("button", { class: "chip", type: "button", "aria-pressed": String(ui.boardStage === s.key), onclick: () => { ui.boardStage = s.key; ctx.render(); } }, `${s.label} (${by[s.key].length})`))),
      company.length === 0 ? emptyFor() : h("div", { class: "board" }, STAGES.map(col)));
  }

  // ---- details beside the list ----
  function asideDetail(r) {
    const c = r.cand, cand = d.candOf(c), why = [candidateReason(c), fitSentence(c.criteria_match)].filter(Boolean).join(" ");
    return h("div", {},
      h("div", { class: "card" }, h("h3", { text: "Why this was set aside" }), h("p", { text: why || "Ava set this one aside." }),
        h("dl", { class: "kv" }, cand.geography_label ? [h("dt", { text: "Place" }), h("dd", { text: cand.geography_label })] : null,
          cand.industry_label ? [h("dt", { text: "Kind of company" }), h("dd", { text: cand.industry_label })] : null,
          Number.isInteger(cand.employee_count) ? [h("dt", { text: "Size" }), h("dd", { text: `${cand.employee_count} employees` })] : null,
          typeof cand.domain === "string" && cand.domain ? [h("dt", { text: "Website" }), h("dd", { text: clip(cand.domain, 80) })] : noWebsite(cand) ? [h("dt", { text: "Website" }), h("dd", {}, h("span", { class: "tag warn", text: "No website" }))] : null,
          h("dt", { text: "Found" }), h("dd", { text: timeAgo(c.created_at) }))));
  }
  function drawer() {
    const r = d.companyRows().find((x) => x.key === ui.selected);
    if (!r) return null;
    return h("aside", { class: "drawer", "aria-label": `Details for ${r.name}` },
      h("div", { class: "drawer-h" },
        h("div", { class: "grow" }, h("h2", { text: r.name }), h("div", { class: "tags" }, stageTag(r), h("span", { class: "tag", text: r.source }), r.optedOut ? h("span", { class: "tag bad", text: "Do not contact" }) : null, r.kind === "aside" ? h("span", { class: "tag", text: dispositionLabel(r.cand.disposition) }) : null)),
        h("button", { class: "iconbtn", type: "button", "aria-label": "Close details", onclick: closeDrawer }, icon("close", 18))),
      h("div", { class: "drawer-b" }, r.kind === "aside" ? asideDetail(r) : detail.body(r.subject_id)));
  }

  // ---- the page ----
  function main() {
    if (app.nav.sub === "import") return h("div", { class: "page" }, h("button", { class: "crumb", type: "button", onclick: () => ctx.go("companies", ui.view) }, icon("back", 16), "Companies"), importer.render());
    const cur = viewKey(), v = d.VIEWS.find((x) => x.key === cur), list = rows();
    if (ui.selected && !d.companyRows().some((x) => x.key === ui.selected)) ui.selected = null;
    const chipView = h("div", { class: "chiprow phone-only" }, d.VIEWS.map((x) => h("button", { class: "chip", type: "button", "aria-pressed": String(cur === x.key), onclick: () => { ui.page = 0; ctx.go("companies", x.key); } }, `${x.label} (${d.viewCounts()[x.key]})`)));
    const fitChips = h("div", { class: "chiprow phone-only" }, FIT_OPTIONS.slice(1).map(([k, t]) => h("button", { class: "chip", type: "button", "aria-pressed": String(ui.fit === k), onclick: () => { ui.fit = ui.fit === k ? "" : k; reset(); ctx.render(); } }, t)));
    const open = !!ui.selected && !!d.companyRows().find((x) => x.key === ui.selected);
    return h("div", { class: `page wide cosplit${open ? " has-drawer" : ""}` },
      h("div", { class: "co-main" },
        h("div", { class: "page-h" }, h("h1", { text: "Companies" }), h("span", { class: "tag", text: `${v.label} · ${list.length}` }), h("span", { class: "grow" }),
          h("span", { class: "seg", role: "group", "aria-label": "View" },
            h("button", { type: "button", "aria-pressed": String(ui.layout === "list"), onclick: () => { ui.layout = "list"; ctx.render(); } }, icon("list", 16), "List"),
            h("button", { type: "button", "aria-pressed": String(ui.layout === "board"), onclick: () => { ui.layout = "board"; ctx.render(); } }, icon("board", 16), "Board")),
          h("button", { class: "btn desk-only", type: "button", title: "Import your list", onclick: () => ctx.go("companies", "import") }, icon("upload", 16), h("span", { class: "lbl", text: "Import your list" })),
          h("button", { class: "btn desk-only", type: "button", title: "Download as CSV", disabled: list.filter((r) => r.kind === "company").length === 0, onclick: () => download(list) }, icon("download", 16), h("span", { class: "lbl", text: "Download as CSV" }))),
        chipView, fitChips, ui.selected && research.single() ? null : research.progress(),
        ui.layout === "board" ? boardView(list) : listView(list)),
      open ? drawer() : null);
  }

  return { panel, main, select };
}
