// The "Import my list" screen. The owner pastes a list (or picks a small CSV); it is read on THIS computer, checked in plain words, and only sent when the owner presses Import.
// It uses ONLY the existing-pattern owner-only function public.import_owner_companies, which cleans every row, finds duplicates through the platform's own identity check
// (a possible duplicate is flagged, never merged), keeps your facts marked as "supplied by you", and never clears a do-not-contact flag.
import { readList, counts, payload, summary, reasonText, importError, SAMPLE, MAX_ROWS } from "./import-logic.js";

export function createImporter(ctx) {
  const { h, icon, state: app } = ctx;
  const st = () => app.imp;
  const fresh = () => ({ text: "", label: "", parsed: null, stage: "edit", result: null, notice: null });
  const set = (patch) => { Object.assign(st(), patch); ctx.render(); };
  const companyName = () => app.companies.find((c) => c.id === app.orgId)?.name ?? "this company";
  const defaultLabel = () => `My list ${new Date().toISOString().slice(0, 10)}`;

  function open() { app.imp = fresh(); ctx.go("companies", "import"); }

  function check() {
    const s = st(), parsed = readList(s.text);
    if (!parsed.ok) { set({ parsed: null, notice: { tone: "bad", text: parsed.error } }); return; }
    set({ parsed, stage: "preview", notice: null });
  }

  async function send() {
    const s = st();
    if (!s.parsed || s.stage === "working") return;
    set({ stage: "working", notice: null });
    const res = await ctx.rpc("import_owner_companies", { p_org_id: app.orgId, p_label: (s.label || defaultLabel()).slice(0, 80), p_rows: payload(s.parsed) });
    if (!st()) return;
    if (!res.ok) { set({ stage: "preview", notice: { tone: "bad", text: importError(res) } }); return; }
    await ctx.reload(true);
    set({ stage: "done", result: summary(res), notice: null });
  }

  function pickFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 1_000_000) { set({ notice: { tone: "bad", text: "That file is bigger than 1 MB. Please use a smaller list." } }); return; }
    const reader = new FileReader();
    reader.onload = () => set({ text: String(reader.result ?? ""), notice: null });
    reader.onerror = () => set({ notice: { tone: "bad", text: "I could not read that file." } });
    reader.readAsText(file);
  }

  const note = (n) => (n ? h("div", { class: `notice ${n.tone}`, role: "status", text: n.text }) : null);

  function editCard() {
    const s = st();
    return h("div", { class: "card" },
      h("p", { text: `Paste your companies below, or choose a small CSV file (up to ${MAX_ROWS} rows). The first row can be headings. Columns I understand: company name, website, place, contact name, email, phone, and an optional “do not contact” column.` }),
      h("label", { class: "field" }, "Your list",
        h("textarea", { rows: 9, class: "listbox", spellcheck: "false", "aria-label": "Your list", placeholder: SAMPLE, oninput: (e) => { st().text = e.target.value; } }, s.text)),
      h("div", { class: "chips" },
        h("button", { type: "button", onclick: () => set({ text: SAMPLE }) }, "Show me an example"),
        h("label", { class: "chipfile" }, "Choose a file", h("input", { type: "file", accept: ".csv,.tsv,.txt,text/csv,text/plain", class: "sr-only", onchange: pickFile }))),
      h("label", { class: "field" }, "A name for this list (optional)", h("input", { type: "text", class: "pick", maxlength: 80, placeholder: defaultLabel(), value: s.label, oninput: (e) => { st().label = e.target.value; } })),
      h("button", { class: "btn primary", type: "button", onclick: check }, icon("check", 16), "Check my list"),
      h("p", { class: "muted small", text: "Nothing is sent yet. Everything you add is saved as your own information, marked “supplied by you”, and is kept apart from anything bought from a data service." }));
  }

  function flagText(r) { return r.repeatOf ? `Same company as line ${r.repeatOf}; its contact will be added to it.` : r.flags.map((f) => f.text).join(" "); }

  function previewCard() {
    const s = st(), p = s.parsed, c = counts(p), busy = s.stage === "working";
    return [
      h("div", { class: "card" },
        h("h3", { text: "Here is what I found" }),
        h("p", { text: `${c.total} ${c.total === 1 ? "row" : "rows"}${p.headerFound ? " (the first row was headings)" : " (no headings found, so I read the columns in this order: company, website, place, contact, email, phone)"}.` }),
        h("ul", { class: "plain" },
          h("li", { text: `${c.readyish} look new and fine.` }),
          c.repeats ? h("li", { text: `${c.repeats} ${c.repeats === 1 ? "is a duplicate" : "are duplicates"} of an earlier company in this list.` }) : null,
          c.problems ? h("li", { text: `${c.problems} ${c.problems === 1 ? "is a problem row" : "are problem rows"}: no company name, so ${c.problems === 1 ? "it" : "they"} will be skipped.` }) : null,
          h("li", { text: `${c.withContact} come with a contact.` }))),
      h("div", { class: "card" }, h("h3", { text: "The first rows" }),
        h("div", { class: "cardlist" }, p.rows.slice(0, 10).map((r) => h("div", { class: "li" },
          h("div", { class: "row2" }, h("strong", { text: r.data.name || "(no name)" }), h("span", { class: "muted small", text: `line ${r.line}` })),
          h("div", { class: "muted small", text: [r.data.website, r.data.place, r.data.contact_name].filter(Boolean).join(" · ") || "—" }),
          flagText(r) ? h("div", { class: `small ${r.flags.some((f) => f.problem) ? "warnText" : "muted"}`, text: flagText(r) }) : null)),
          p.rows.length > 10 ? h("p", { class: "muted small", text: `…and ${p.rows.length - 10} more.` }) : null)),
      h("div", { class: "card ask", role: "alertdialog" },
        h("h3", { text: `Add these to ${companyName()}?` }),
        h("p", { text: "They are saved as your own list. Companies already known are not duplicated, and anyone marked “do not contact” stays that way." }),
        h("div", { class: "btnrow" }, h("button", { class: "btn primary", type: "button", disabled: busy, onclick: send }, icon("check", 16), busy ? "Importing…" : "Import"),
        h("button", { class: "btn", type: "button", disabled: busy, onclick: () => set({ stage: "edit", parsed: null }) }, "Go back and change the list"))),
    ];
  }

  function doneCard() {
    const r = st().result, problems = r.rows.filter((x) => x.status === "problem" || x.status === "flagged");
    return [
      h("div", { class: "notice", role: "status" }, h("strong", { text: "Done." }), ` ${r.created} new ${r.created === 1 ? "company" : "companies"} added; ${r.matched} already known; ${r.flagged} to check; ${r.skipped} skipped.`),
      problems.length ? h("div", { class: "card" }, h("h3", { text: "Rows to look at" }),
        h("div", { class: "cardlist" }, problems.map((x) => h("div", { class: "li" }, h("strong", { text: x.name || `Row ${x.row}` }), h("div", { class: "muted small", text: `Row ${x.row}: ${reasonText(x.reason)}` }))))) : null,
      h("div", { class: "btnrow" }, h("button", { class: "btn primary", type: "button", onclick: () => ctx.go("companies", "yours") }, icon("companies", 16), "See my companies"), h("button", { class: "btn", type: "button", onclick: () => { app.imp = fresh(); ctx.render(); } }, "Import another list")),
    ];
  }

  function render() {
    const s = st() ?? (app.imp = fresh());
    return [
      h("h1", { class: "page-title", text: "Import your list" }),
      h("p", { class: "mainnote", text: `Add the companies and contacts you already have to ${companyName()}. Only you, the owner, can do this.` }),
      note(s.notice),
      s.stage === "done" ? doneCard() : s.stage === "edit" ? editCard() : previewCard(),
    ];
  }

  return { open, render };
}
