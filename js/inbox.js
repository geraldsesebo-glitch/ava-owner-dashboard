// The Inbox (chapter 7). In test mode no real reply can arrive, so this screen has a "Simulate a reply" box: you type what a contact might say. The platform records it, closes the door at once
// if it sounds like "please stop" (by rule, no AI), and cancels the follow-up. Each reply can be sorted by Ava (the cheap AI model, behind the same $0.02 / 2-call limit per company) or by
// you, by hand. Nothing here sends anything. A next-step draft for an interested reply goes to the Approve screen.
// Uses only the owner-only functions simulate_reply and set_reply_category, and the outreach helper (ids only).
import { CATEGORIES, categoryWords, categoryTone, NEEDS_NEXT_STEP, SIM_EXAMPLES, repliesView, replyTargets, resultLine, reasonWords, startRefusal } from "./outreach-logic.js";
import { timeAgo } from "./text.js";
import { pager, stateBlock } from "./ui.js";

const PAGE = 10;

export function createInbox(ctx) {
  const { h, icon, state: app } = ctx;
  const fresh = () => ({ page: 0, company: "", text: "", working: false, notice: null, aiNote: null, lines: [] });
  const st = () => app.ib ?? (app.ib = fresh());
  const set = (patch) => { Object.assign(st(), patch); ctx.render(); };
  const employee = () => (app.data ? app.data.employees.find((e) => e.status === "active") || app.data.employees[0] || null : null);

  function open() { app.ib = fresh(); ctx.go("outreach", "replies"); }

  async function simulate() {
    const s = st();
    if (s.working) return;
    if (!s.company) { set({ notice: { tone: "bad", text: "Choose which company the reply is from." } }); return; }
    if (!s.text.trim()) { set({ notice: { tone: "bad", text: "Type what the reply says." } }); return; }
    set({ working: true, notice: null });
    const res = await ctx.rpc("simulate_reply", { p_org_id: app.orgId, p_subject_id: s.company, p_text: s.text });
    if (!res.ok) { set({ working: false, notice: { tone: "bad", text: res.status === 0 ? "Could not reach the project. Nothing was changed." : "Only an owner of this company can do that, or something went wrong. Nothing was changed." } }); return; }
    const r = res.data;
    if (r?.ok === false) { set({ working: false, notice: { tone: "bad", text: r.reason === "nothing_sent_yet" ? "Nothing has been sent to that company yet, so there is nothing to reply to." : r.reason === "bad_text" ? "The reply must be between 1 and 4,000 letters." : "That could not be recorded." } }); return; }
    await ctx.reload(true);
    set({ working: false, text: "", notice: { tone: "good", text: r?.category === "unsubscribe" ? "Recorded. It sounded like “please stop”, so this company is now marked do-not-contact and anything waiting for it was cancelled." : "Recorded. The follow-up for this company was cancelled because they replied. Now choose what kind of reply it is." } });
  }

  async function choose(rec, category) {
    if (st().working) return;
    set({ working: true, notice: null });
    const res = await ctx.rpc("set_reply_category", { p_org_id: app.orgId, p_record_id: rec.id, p_category: category });
    if (!res.ok || res.data?.ok === false) { set({ working: false, notice: { tone: "bad", text: "That could not be saved, so nothing was changed." } }); return; }
    await ctx.reload(true);
    set({ working: false, aiNote: null, notice: { tone: "good", text: category === "unsubscribe" ? "Saved. This company is now do-not-contact." : `Saved: ${categoryWords(category)}.` } });
  }

  async function call(action, extra) {
    const emp = employee();
    if (!emp) return null;
    const res = await ctx.call("outreach-run", { org_id: app.orgId, ai_employee_id: emp.id, action, ...extra });
    if (!res.ok || !Array.isArray(res.data?.results)) { set({ working: false, notice: { tone: "bad", text: startRefusal(res) } }); return null; }
    return res.data.results;
  }
  async function sortWithAva(rec) {
    if (st().working) return;
    set({ working: true, notice: null, aiNote: null });
    const results = await call("classify", { record_ids: [rec.id] });
    if (!results) return;
    const r = results[0];
    await ctx.reload(true);
    if (r?.status === "done") { set({ working: false, notice: { tone: "good", text: resultLine(r, rec.company, "sort") } }); return; }
    set({ working: false, aiNote: { id: rec.id, needsKey: r?.reason === "model_no_model_provider_configured", text: r?.reason === "model_no_model_provider_configured" ? "Needs the AI key" : reasonWords(r?.reason, "sort") } });
  }
  async function writeNext(rec) {
    if (st().working) return;
    set({ working: true, notice: null });
    const results = await call("draft_replies", { replies: [{ subject_id: rec.subject_id, record_id: rec.id }] });
    if (!results) return;
    await ctx.reload(true);
    const r = results[0];
    set({ working: false, notice: { tone: r?.status === "done" ? "good" : "warn", text: r?.status === "done" ? "A reply is written and waiting for you in To approve." : reasonWords(r?.reason, "draft") } });
  }

  const note = (n) => (n ? h("div", { class: `notice ${n.tone}`, role: "status", text: n.text }) : null);

  function replyCard(rec) {
    const s = st(), busy = s.working, hasDraft = (app.data.drafts ?? []).some((d) => d.reply_to_record_id === rec.id && ["waiting", "approved", "sent"].includes(d.status));
    const ai = s.aiNote && s.aiNote.id === rec.id ? s.aiNote : null;
    return h("div", { class: "card" },
      h("div", { class: "row2" }, h("strong", { text: rec.company }), rec.simulated ? h("span", { class: "badge", text: "Simulated" }) : null, h("span", { class: `badge ${categoryTone(rec.category)}`, text: categoryWords(rec.category) }), rec.category ? h("span", { class: "muted small", text: rec.source === "rule" ? "(by a rule)" : rec.source === "ai" ? "(by Ava)" : "(by you)" }) : null),
      h("blockquote", { class: "quote", text: rec.text }),
      h("p", { class: "muted small", text: timeAgo(rec.at) }),
      rec.category === "unsubscribe" ? h("p", { class: "muted small", text: "This company is do-not-contact. Ava will not write to it again." }) : null,
      ai ? h("div", { class: "notice warn", role: "status" }, ai.needsKey ? [h("strong", { text: "Needs the AI key. " }), "Ava cannot sort this herself yet. Choose the kind of reply by hand below; everything else works the same."] : ai.text) : null,
      h("div", { class: "chips", role: "group", "aria-label": "What kind of reply is this?" }, CATEGORIES.map((c) => h("button", { type: "button", "aria-pressed": String(rec.category === c.key), disabled: busy, title: c.hint, onclick: () => choose(rec, c.key) }, c.label))),
      !rec.category ? h("button", { class: "btn", type: "button", disabled: busy, onclick: () => sortWithAva(rec) }, icon("sparkles", 16), "Ask Ava to sort it") : null,
      NEEDS_NEXT_STEP.has(rec.category) ? (hasDraft ? h("p", { class: "muted small", text: "A reply for this is waiting in To approve." }) : h("button", { class: "btn", type: "button", disabled: busy, onclick: () => writeNext(rec) }, icon("outreach", 16), "Write a reply for me to approve")) : null);
  }

  function render() { return renderBody().flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false); }
  function renderBody() {
    const s = st(), d = app.data;
    const targets = replyTargets(d.records, d.pipeline), replies = repliesView(d.records, d.assessments, d.pipeline);
    return [
      h("div", { class: "page-h" }, h("h1", { text: "Replies" }), h("span", { class: "tag", text: `${replies.length}` })),
      h("p", { class: "mainnote", text: "Replies arrive here. In test mode no real reply can arrive, so you can type one yourself below to see what Ava would do." }),
      note(s.notice),
      h("div", { class: "card" }, h("h3", { text: "Simulate a reply" }),
        h("p", { class: "muted small", text: "Pretend a company wrote back. Nothing is sent to anyone. If the words sound like “please stop”, the company is marked do-not-contact straight away." }),
        targets.length === 0 ? h("p", { class: "muted", text: "No message has been sent yet, so there is nobody to reply. Approve and send a first email first (To approve)." }) : [
          h("label", { class: "field" }, "Which company is the reply from?", h("select", { class: "pick", onchange: (e) => { s.company = e.target.value; } }, h("option", { value: "", text: "Choose a company" }), targets.map((t) => h("option", { value: t.subject_id, text: t.name, selected: s.company === t.subject_id })))),
          h("label", { class: "field" }, "What does the reply say?", h("textarea", { rows: 4, class: "listbox", maxlength: 4000, oninput: (e) => { s.text = e.target.value; } }, s.text)),
          h("div", { class: "chips", role: "group", "aria-label": "Examples" }, SIM_EXAMPLES.map((x) => h("button", { type: "button", onclick: () => set({ text: x }) }, x.length > 30 ? `${x.slice(0, 28)}…` : x))),
          h("button", { class: "btn primary", type: "button", disabled: s.working, onclick: simulate }, icon("inbox", 16), s.working ? "Saving…" : "Add this reply")]),
      h("h2", { class: "label13" }, `Replies (${replies.length})`),
      replies.length === 0 ? stateBlock({ icon: "inbox", title: "No replies yet", text: "When a company writes back, it shows up here. You can add a pretend one above.", inline: true }) : [replies.slice(s.page * PAGE, s.page * PAGE + PAGE).map(replyCard), pager({ page: s.page, size: PAGE, total: replies.length, onPage: (p) => set({ page: p }), noun: "replies" })],
    ];
  }

  return { open, render };
}
