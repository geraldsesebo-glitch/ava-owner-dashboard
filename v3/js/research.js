// "Research with Ava": Ava reads a company's own public website and says how well it fits what you sell. This file only asks the research helper (ids only: never a model,
// an address, a prompt or a limit) and shows what came back. The platform decides everything: whether Ava is allowed, whether the AI prices are set, the AI limit per company
// ($0.02 and 2 calls a month), and what may be saved. An answer is always shown as "not verified", with the exact words quoted from the company's own page.
import { CHUNK, chunk, toResearch, fitWords, fitTone, outcomeLine, startRefusal, shapeAssessment } from "./research-logic.js";

export function createResearch(ctx) {
  const { h, icon, state: app } = ctx;
  const st = () => (app.res ??= { running: false, stop: false, total: 0, done: 0, lines: [], notice: null, assess: {} });
  const set = (patch) => { Object.assign(st(), patch); ctx.render(); };
  const employee = () => (app.data ? app.data.employees.find((e) => e.status === "active") || app.data.employees[0] || null : null);
  const nameOf = (id) => (app.data?.pipeline ?? []).find((r) => r.subject_id === id)?.name || "A company";

  async function run(ids) {
    const s = st(), emp = employee();
    if (s.running || !emp || ids.length === 0) return;
    set({ running: true, stop: false, total: ids.length, done: 0, lines: [], notice: null });
    for (const part of chunk(ids, CHUNK)) {
      if (st().stop) break;
      const res = await ctx.call("company-research", { org_id: app.orgId, ai_employee_id: emp.id, subject_ids: part });
      if (!res.ok || !Array.isArray(res.data?.results)) { set({ notice: { tone: "bad", text: startRefusal(res) } }); break; }
      const lines = res.data.results.map((o) => ({ id: o.subject_id, tone: o.status === "done" ? "good" : o.status === "needs_website" ? "warn" : "bad", text: outcomeLine(o, nameOf(o.subject_id)) }));
      set({ done: st().done + res.data.results.length, lines: [...st().lines, ...lines] });
      // a company the platform would not allow (no permission, no price, limit reached) stops the whole run: asking again would only be refused again
      if (res.data.results.some((o) => o.status === "refused")) break;
    }
    delete st().assess;
    st().assess = {};
    set({ running: false });
    await ctx.reload(true);
  }

  async function loadAssessment(subjectId) {
    const s = st();
    if (s.assess[subjectId] !== undefined) return;
    s.assess[subjectId] = null;
    const res = await ctx.select(`research_evidence?org_id=eq.${app.orgId}&subject_id=eq.${subjectId}&claim_key=eq.fit_assessment&select=claim_value,source_class,verified_at,created_at&order=created_at.desc&limit=1`);
    s.assess[subjectId] = res.ok && Array.isArray(res.data) ? shapeAssessment(res.data[0]) : null;
    ctx.render();
  }

  const note = (n) => (n ? h("div", { class: `notice ${n.tone}`, role: "status", text: n.text }) : null);
  /** On one company's page only that company's own result is shown (not the whole batch). */
  function progress(onlyId) {
    const s = st();
    const lines = onlyId ? s.lines.filter((l) => l.id === onlyId) : s.lines;
    if (!s.running && lines.length === 0 && !s.notice) return null;
    return h("div", { class: "card" },
      s.running ? h("p", { text: `Ava is reading… ${s.done} of ${s.total} done.` }) : h("p", { text: `Finished: ${s.done} of ${s.total}.` }),
      s.running ? h("button", { class: "btn ghost", type: "button", disabled: s.stop, onclick: () => set({ stop: true }) }, s.stop ? "Stopping after this one…" : "Stop") : null,
      note(s.notice),
      lines.length ? h("ul", { class: "plainlist" }, lines.map((l) => h("li", { class: l.tone, text: l.text }))) : null);
  }

  /** The strip at the top of the Pipeline screen. */
  function strip(rows) {
    const s = st(), ids = toResearch(rows), emp = employee();
    return h("div", { class: "card" },
      h("h3", { text: "Research with Ava" }),
      h("p", { class: "muted small", text: "Ava reads each company's own public website (about three pages) and tells you how well it fits what you sell, with the exact words she relied on. Her answers are never marked as checked: that is for you to do. It costs a small amount of AI money (at most $0.02 per company per month) and nothing is sent to anyone." }),
      h("button", { class: "btn", type: "button", disabled: s.running || ids.length === 0 || !emp, onclick: () => run(ids) }, icon("sparkles", 16), ids.length ? `Research ${ids.length} ${ids.length === 1 ? "company" : "companies"}` : "Nothing to research right now"),
      progress());
  }

  /** The block on one company's page: the button and what Ava found. */
  function detail(r) {
    const s = st(), emp = employee(), a = s.assess[r.subject_id];
    if (r.fit_label && a === undefined) loadAssessment(r.subject_id);
    return h("div", { class: "card" }, h("h3", { text: "Why Ava thinks it fits" }),
      r.needs_website ? h("p", { text: "This company needs a website before Ava can read about it. Add one to your list and import again." }) : null,
      r.fit_label ? h("div", { class: "row2" }, h("strong", { text: fitWords(r.fit_label) }), h("span", {}, r.fit_score != null ? h("span", { class: "tag", text: `${r.fit_score} out of 100` }) : null, " ", h("span", { class: "tag warn", text: "Not verified" }))) : (!r.needs_website ? h("p", { class: "muted", text: "Ava has not read about this company yet." }) : null),
      a ? [
        a.reasons.length ? h("div", { class: "cardlist" }, a.reasons.map((x) => h("div", { class: "li" }, h("div", { text: x.text }), h("blockquote", { class: "quote", text: `“${x.quote}”` }), x.link ? h("a", { class: "textbtn", href: x.link, target: "_blank", rel: "noopener noreferrer", text: "Open the page it came from" }) : null))) : h("p", { class: "muted", text: "No reason passed the check that every quote really is on the page." }),
        a.missing ? h("p", { class: "muted small", text: `Not told by the pages: ${a.missing}` }) : null,
        a.discarded ? h("p", { class: "muted small", text: `${a.discarded} ${a.discarded === 1 ? "reason was" : "reasons were"} thrown away because the quote could not be found on the page.` }) : null,
        h("p", { class: "muted small", text: `Written by Ava's AI helper${a.when ? ` on ${a.when}` : ""}. It is a guess from public pages, not a checked fact.` }),
      ] : null,
      !r.needs_website && !r.opted_out ? h("button", { class: "btn", type: "button", disabled: s.running || !emp, onclick: () => run([r.subject_id]) }, icon("sparkles", 16), r.fit_label ? "Research again" : "Research with Ava") : null,
      r.opted_out ? h("p", { class: "muted small", text: "Marked do-not-contact, so Ava will not research it." }) : null,
      progress(r.subject_id));
  }

  return { strip, detail, run, progress };
}
