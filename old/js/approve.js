// The Approve screen (chapter 5, and the send button of chapter 6). Ava writes a message by filling in YOUR approved template (no AI); it waits here. You approve, edit or reject each one.
// Nothing is sent until you approve the exact text, and then only to your own test inbox, with a label saying it is a test. This screen asks the research/outreach helper for drafts and
// sends (ids only: never a recipient, a text, a model or a limit) and uses only the owner-only functions outreach_approve_draft / outreach_edit_draft / outreach_reject_draft.
import { TEST_MODE_NOTE, kindWords, reasonWords, resultLine, startRefusal, editProblem, draftable, dueFollowups, byStatus, whyLine, safeLink } from "./outreach-logic.js";
import { permissionState } from "./permissions-logic.js";

export function createApprove(ctx) {
  const { h, icon, state: app } = ctx;
  const fresh = () => ({ editing: null, edit: { subject: "", body: "" }, rejecting: null, note: "", working: false, notice: null, lines: [], busy: null });
  const st = () => app.ap ?? (app.ap = fresh());
  const set = (patch) => { Object.assign(st(), patch); ctx.render(); };
  const employee = () => (app.data ? app.data.employees.find((e) => e.status === "active") || app.data.employees[0] || null : null);
  const nameOf = (id) => (app.data?.pipeline ?? []).find((r) => r.subject_id === id)?.name || "A company";
  const drafts = () => app.data?.drafts ?? [];
  const contactOf = (d) => (app.data?.contacts ?? []).find((c) => c.id === d.contact_id) ?? null;

  function open() { app.ap = fresh(); ctx.go("approve"); }

  /** Asks the helper to do one thing; the platform chooses everything that matters. Returns the results, or null (and a notice) if it could not start. */
  async function helper(action, extra = {}) {
    const emp = employee();
    if (!emp) return null;
    const res = await ctx.call("outreach-run", { org_id: app.orgId, ai_employee_id: emp.id, action, ...extra });
    if (!res.ok || !Array.isArray(res.data?.results)) { set({ working: false, busy: null, notice: { tone: "bad", text: startRefusal(res) } }); return null; }
    return res.data.results;
  }
  async function runAction(label, action, extra, area, lineExtra) {
    if (st().working) return;
    set({ working: true, busy: label, notice: null, lines: [] });
    const results = await helper(action, extra);
    if (!results) return;
    const lines = results.map((r) => ({ tone: r.status === "done" ? "good" : r.status === "refused" ? "warn" : "bad", text: resultLine(r, lineExtra?.(r) ?? nameOf(r.id), area) }));
    await ctx.reload(true);
    set({ working: false, busy: null, lines: lines.length ? lines : [{ tone: "", text: "There was nothing to do right now." }] });
  }

  const ready = () => draftable(app.data?.pipeline, app.data?.contacts, drafts());
  async function writeFirst() {
    const ids = ready();
    if (st().working || ids.length === 0) return;
    set({ working: true, busy: "writing", notice: null, lines: [] });
    const all = [];
    for (let i = 0; i < ids.length; i += 10) {
      const results = await helper("draft_intro", { subject_ids: ids.slice(i, i + 10) });
      if (!results) return;
      all.push(...results);
      if (results.some((r) => r.status === "refused" && /^authorization_/.test(r.reason ?? ""))) break;   // not allowed: asking again would only be refused again
    }
    await ctx.reload(true);
    set({ working: false, busy: null, lines: all.map((r) => ({ tone: r.status === "done" ? "good" : r.status === "refused" ? "warn" : "bad", text: resultLine(r, nameOf(r.id), "draft") })) });
  }
  const writeFollowups = () => runAction("followups", "draft_followups", {}, "draft");
  const sendApproved = () => runAction("sending", "send", {}, "send", (r) => nameOf(drafts().find((d) => d.id === r.id)?.subject_id));

  async function owner(fn, args, okText) {
    if (st().working) return;
    set({ working: true, notice: null });
    const res = await ctx.rpc(fn, args);
    if (!res.ok) { set({ working: false, notice: { tone: "bad", text: res.status === 0 ? "Could not reach the project. Nothing was changed." : "Only an owner of this company can do that, or something went wrong. Nothing was changed." } }); return; }
    const r = res.data;
    if (r && r.ok === false) {
      const why = r.reason === "opted_out" ? "This person or company is now marked do-not-contact, so it cannot be approved." : r.reason === "approval_used" ? "The earlier approval was already used. Ask Ava to write it again." : r.reason === "blank_left_in_text" ? "Take out the curly brackets {{ }}." : "That could not be done, so nothing was changed.";
      set({ working: false, notice: { tone: "bad", text: why } }); return;
    }
    await ctx.reload(true);
    set({ working: false, editing: null, rejecting: null, note: "", notice: { tone: "good", text: okText } });
  }
  const approve = (d) => owner("outreach_approve_draft", { p_org_id: app.orgId, p_draft_id: d.id }, "Approved. It has not been sent yet: press “Send approved messages” when you are ready.");
  const reject = (d) => owner("outreach_reject_draft", { p_org_id: app.orgId, p_draft_id: d.id, p_note: st().note || null }, "Rejected. Nothing was sent.");
  function saveEdit(d) {
    const e = st().edit, p = editProblem(e.subject, e.body);
    if (p) { set({ notice: { tone: "bad", text: p } }); return; }
    owner("outreach_edit_draft", { p_org_id: app.orgId, p_draft_id: d.id, p_subject_line: e.subject, p_body: e.body }, "Saved as your version. Approve it when you are happy with it.");
  }

  const note = (n) => (n ? h("div", { class: `notice ${n.tone}`, role: "status", text: n.text }) : null);

  function card(d) {
    const s = st(), c = contactOf(d), busy = s.working, isEdit = s.editing === d.id, isReject = s.rejecting === d.id, link = safeLink(d.reason_used?.source_url);
    return h("div", { class: "card draft" },
      h("div", { class: "row2" }, h("strong", { text: nameOf(d.subject_id) }), h("span", { class: "badge", text: kindWords(d.kind) }), d.status === "approved" ? h("span", { class: "badge good", text: "Approved" }) : null, d.edited ? h("span", { class: "badge", text: "Edited by you" }) : null),
      h("p", { class: "muted small", text: `Would go to ${c?.name || "the contact"}${c?.email ? ` (${c.email})` : ""}. In test mode it goes to your test inbox instead.` }),
      isEdit
        ? [h("label", { class: "field" }, "Subject", h("input", { type: "text", class: "pick", maxlength: 300, value: s.edit.subject, oninput: (e) => { s.edit.subject = e.target.value; } })),
          h("label", { class: "field" }, "Message", h("textarea", { rows: 12, class: "listbox", maxlength: 6000, oninput: (e) => { s.edit.body = e.target.value; } }, s.edit.body)),
          h("button", { class: "btn primary block", type: "button", disabled: busy, onclick: () => saveEdit(d) }, icon("check", 18), "Save my version"),
          h("button", { class: "btn ghost block", type: "button", disabled: busy, onclick: () => set({ editing: null, notice: null }) }, "Cancel")]
        : [h("div", { class: "msg" }, h("div", { class: "msg-subject", text: d.subject_line }), h("div", { class: "msg-body", text: d.body })),
          h("p", { class: "muted small", text: whyLine(d) }),
          link ? h("a", { class: "textbtn", href: link, target: "_blank", rel: "noopener noreferrer", text: "Open the page her quote came from" }) : null,
          d.send_error ? h("div", { class: "notice warn", text: `It could not be sent last time (${reasonWords(d.send_error, "send")}) Approve it again to retry.` }) : null,
          isReject
            ? [h("label", { class: "field" }, "Why? (optional, for your own record)", h("input", { type: "text", class: "pick", maxlength: 300, value: s.note, oninput: (e) => { s.note = e.target.value; } })),
              h("button", { class: "btn primary block", type: "button", disabled: busy, onclick: () => reject(d) }, "Yes, reject it"),
              h("button", { class: "btn ghost block", type: "button", disabled: busy, onclick: () => set({ rejecting: null }) }, "Keep it")]
            : [d.status === "waiting" ? h("button", { class: "btn primary block bigbtn", type: "button", disabled: busy, onclick: () => approve(d) }, icon("check", 20), "Approve") : null,
              h("div", { class: "btnrow" },
                h("button", { class: "btn ghost", type: "button", disabled: busy, onclick: () => set({ editing: d.id, rejecting: null, edit: { subject: d.subject_line, body: d.body }, notice: null }) }, "Edit"),
                h("button", { class: "btn ghost", type: "button", disabled: busy, onclick: () => set({ rejecting: d.id, editing: null, note: "", notice: null }) }, "Reject"))]]);
  }

  function render() { return renderBody().flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false); }
  function renderBody() {
    const s = st(), emp = employee(), d = app.data;
    const allowed = emp ? permissionState(d.authorities, emp.id, "engage_prospect").state !== "off" : false;
    const followAllowed = emp ? permissionState(d.authorities, emp.id, "follow_up").state !== "off" : false;
    const waiting = byStatus(drafts(), "waiting"), approved = byStatus(drafts(), "approved"), sent = byStatus(drafts(), "sent").slice(0, 5);
    const nReady = ready().length, due = dueFollowups(d.followups).length;
    return [
      h("button", { class: "back always", type: "button", onclick: () => ctx.go("home") }, icon("back", 18), "Home"),
      h("h1", { class: "page-title", text: "Approve" }),
      h("div", { class: "notice warn", role: "note", text: TEST_MODE_NOTE }),
      note(s.notice),
      !emp ? h("div", { class: "card empty", text: "There is no AI employee in this company yet." }) : [
        !allowed ? h("div", { class: "card" }, h("h3", { text: "Ava is not allowed to contact companies yet" }), h("p", { class: "muted", text: "Switch on “Contact a company” in What Ava may do. It asks you first, every time. Switching it on does not send anything." }), h("button", { class: "btn primary", type: "button", onclick: () => ctx.openPermissions() }, "What Ava may do")) : null,
        h("div", { class: "card" }, h("h3", { text: "Write first emails" }),
          h("p", { class: "muted small", text: "Ava fills in your approved “First email” template for each company that has a contact with an email address. No AI is used, so it costs nothing. If she has researched the company, she adds a sentence from its own website." }),
          h("button", { class: "btn primary", type: "button", disabled: s.working || !allowed || nReady === 0, onclick: writeFirst }, icon("outreach", 18), s.busy === "writing" ? "Writing…" : nReady ? `Write ${nReady} first ${nReady === 1 ? "email" : "emails"}` : "No company is ready for a first email"),
          h("p", { class: "muted small", text: "A company needs a contact with an email address, must not be do-not-contact, and must not have a first email already." })),
        due > 0 || (d.followups ?? []).some((f) => f.status === "scheduled") ? h("div", { class: "card" }, h("h3", { text: "Follow-ups" }),
          h("p", { class: "muted small", text: `${due} ${due === 1 ? "follow-up is" : "follow-ups are"} due now. A follow-up is written from your “Follow-up email” template, only if nobody replied, and you approve it like any other message.` }),
          h("button", { class: "btn ghost", type: "button", disabled: s.working || !followAllowed || due === 0, onclick: writeFollowups }, s.busy === "followups" ? "Writing…" : "Write the follow-ups that are due"),
          !followAllowed ? h("p", { class: "muted small", text: "Switch on “Carry on a conversation with a company” in What Ava may do first." }) : null) : null,
        s.lines.length ? h("div", { class: "card" }, h("ul", { class: "plainlist" }, s.lines.map((l) => h("li", { class: l.tone, text: l.text })))) : null,
        h("h2", { class: "sectitle" }, `Waiting for you (${waiting.length})`),
        waiting.length === 0 ? h("p", { class: "muted", text: "Nothing is waiting. Write some first emails above." }) : waiting.map(card),
        h("h2", { class: "sectitle" }, `Approved, ready to send (${approved.length})`),
        approved.length === 0 ? h("p", { class: "muted", text: "Nothing is approved yet." }) : [approved.map(card), h("button", { class: "btn primary block bigbtn", type: "button", disabled: s.working, onclick: sendApproved }, icon("outreach", 20), s.busy === "sending" ? "Sending…" : "Send approved messages (test mode)"), h("p", { class: "muted small", text: "They go to your test inbox only. Each one is checked again just before it is sent: your approval, do-not-contact marks and the emergency stop." })],
        sent.length ? [h("h2", { class: "sectitle" }, "Recently sent (as tests)"), h("div", { class: "card" }, h("ul", { class: "plainlist" }, sent.map((x) => h("li", { text: `${nameOf(x.subject_id)} · ${kindWords(x.kind)} · “${x.subject_line}”` }))))] : null,
      ],
    ];
  }

  return { open, render, helper };
}
