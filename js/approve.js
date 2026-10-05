// To approve (chapter 5, and the send button of chapter 6). Ava writes a message by filling in YOUR approved template (no AI); it waits here. You approve, edit or reject each one.
// Nothing is sent until you approve the exact text, and then only to your own test inbox, with a label saying it is a test. This screen asks the research/outreach helper for drafts and
// sends (ids only: never a recipient, a text, a model or a limit) and uses only the owner-only functions outreach_approve_draft / outreach_edit_draft / outreach_reject_draft.
import { TEST_MODE_NOTE, kindWords, reasonWords, resultLine, startRefusal, editProblem, draftable, dueFollowups, byStatus, whyLine, safeLink } from "./outreach-logic.js";
import { permissionState } from "./permissions-logic.js";
import { clip, pager, stateBlock } from "./ui.js";

const PAGE = 25;

export function createApprove(ctx) {
  const { h, icon, state: app } = ctx;
  const fresh = () => ({ sel: null, page: 0, open: false, editing: null, edit: { subject: "", body: "" }, rejecting: null, note: "", working: false, notice: null, lines: [], busy: null, sentMore: 0 });
  const st = () => app.ap ?? (app.ap = fresh());
  const set = (patch) => { Object.assign(st(), patch); ctx.render(); };
  const employee = () => (app.data ? app.data.employees.find((e) => e.status === "active") || app.data.employees[0] || null : null);
  const nameOf = (id) => (app.data?.pipeline ?? []).find((r) => r.subject_id === id)?.name || "A company";
  const drafts = () => app.data?.drafts ?? [];
  const contactOf = (d) => (app.data?.contacts ?? []).find((c) => c.id === d.contact_id) ?? null;

  function open() { app.ap = fresh(); ctx.go("outreach", "approve"); }

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
    set({ working: false, editing: null, rejecting: null, note: "", open: false, notice: { tone: "good", text: okText } });
  }
  const approve = (d) => owner("outreach_approve_draft", { p_org_id: app.orgId, p_draft_id: d.id }, "Approved. It has not been sent yet: press “Send approved messages” when you are ready.");
  const reject = (d) => owner("outreach_reject_draft", { p_org_id: app.orgId, p_draft_id: d.id, p_note: st().note || null }, "Rejected. Nothing was sent.");
  function saveEdit(d) {
    const e = st().edit, p = editProblem(e.subject, e.body);
    if (p) { set({ notice: { tone: "bad", text: p } }); return; }
    owner("outreach_edit_draft", { p_org_id: app.orgId, p_draft_id: d.id, p_subject_line: e.subject, p_body: e.body }, "Saved as your version. Approve it when you are happy with it.");
  }

  const note = (n) => (n ? h("div", { class: `notice ${n.tone === "bad" ? "bad" : n.tone === "warn" ? "warn" : ""}`, role: "status", text: n.text }) : null);

  // ---- the draft in full ----
  function detail(d) {
    const s = st(), c = contactOf(d), busy = s.working, isEdit = s.editing === d.id, isReject = s.rejecting === d.id, link = safeLink(d.reason_used?.source_url);
    const quote = typeof d.reason_used?.quote === "string" ? d.reason_used.quote : "";
    const bar = isEdit ? [
      h("button", { class: "btn primary", type: "button", disabled: busy, onclick: () => saveEdit(d) }, icon("check", 16), "Save my version"),
      h("button", { class: "btn", type: "button", disabled: busy, onclick: () => set({ editing: null, notice: null }) }, "Cancel")]
      : isReject ? [
        h("button", { class: "btn danger", type: "button", disabled: busy, onclick: () => reject(d) }, "Yes, reject it"),
        h("button", { class: "btn", type: "button", disabled: busy, onclick: () => set({ rejecting: null }) }, "Keep it")]
        : [d.status === "waiting" ? h("button", { class: "btn primary", type: "button", disabled: busy, onclick: () => approve(d) }, icon("check", 16), "Approve") : null,
          h("button", { class: "btn", type: "button", disabled: busy, onclick: () => set({ editing: d.id, rejecting: null, edit: { subject: d.subject_line, body: d.body }, notice: null }) }, icon("edit", 16), "Edit"),
          h("button", { class: "btn", type: "button", disabled: busy, onclick: () => set({ rejecting: d.id, editing: null, note: "", notice: null }) }, "Reject")];
    return h("article", { class: "draft", "aria-label": `Message for ${nameOf(d.subject_id)}` },
      h("div", { class: "draft-h" },
        h("button", { class: "back phone-only", type: "button", onclick: () => set({ open: false }) }, icon("back", 16), "To approve"),
        h("h2", { text: nameOf(d.subject_id) }),
        h("div", { class: "tags" }, h("span", { class: "tag", text: kindWords(d.kind) }), d.status === "approved" ? h("span", { class: "tag good", text: "Approved" }) : null, d.edited ? h("span", { class: "tag", text: "Edited by you" }) : null)),
      h("div", { class: "draft-b" },
        h("div", { class: "notice warn", role: "note", text: TEST_MODE_NOTE }),
        note(s.notice),
        h("p", { class: "muted small", text: `Would go to ${c?.name || "the contact"}${c?.email ? ` (${c.email})` : ""}. In test mode it goes to your test inbox instead.` }),
        isEdit
          ? [h("label", { class: "field" }, "Subject", h("input", { type: "text", class: "pick", maxlength: 300, value: s.edit.subject, oninput: (e) => { s.edit.subject = e.target.value; } })),
            h("label", { class: "field" }, "Message", h("textarea", { rows: 12, class: "listbox", maxlength: 6000, oninput: (e) => { s.edit.body = e.target.value; } }, s.edit.body))]
          : [h("div", { class: "msg" }, h("div", { class: "msg-subject", text: d.subject_line }), h("div", { class: "msg-body", text: d.body })),
            h("details", { class: "why" }, h("summary", { text: "Why Ava wrote this" }),
              h("p", { class: "muted", text: whyLine(d) }),
              quote ? h("blockquote", { class: "quote", text: `“${clip(quote, 300)}”` }) : null,
              link ? h("a", { class: "textbtn", href: link, target: "_blank", rel: "noopener noreferrer", text: "Open the page her quote came from" }) : null,
              h("p", { class: "muted small", text: "Not verified: Ava’s sentence is copied from the company’s own page, and you decide whether it is right." })),
            d.send_error ? h("div", { class: "notice warn", text: `It could not be sent last time (${reasonWords(d.send_error, "send")}) Approve it again to retry.` }) : null,
            isReject ? h("label", { class: "field" }, "Why? (optional, for your own record)", h("input", { type: "text", class: "pick", maxlength: 300, value: s.note, oninput: (e) => { s.note = e.target.value; } })) : null]),
      h("div", { class: "actionbar" }, bar));
  }

  function row(d, on) {
    return h("button", { class: "lrow", type: "button", "aria-current": String(on), onclick: () => set({ sel: d.id, open: true, editing: null, rejecting: null, notice: null }) },
      h("span", { class: "l" }, h("span", { class: "t", text: nameOf(d.subject_id) }), h("span", { class: "s", text: d.subject_line })),
      h("span", { class: "r" }, h("span", { class: "tag", text: kindWords(d.kind) }), icon("chevron", 16)));
  }

  function render() {
    const s = st(), emp = employee(), d = app.data;
    const allowed = emp ? permissionState(d.authorities, emp.id, "engage_prospect").state !== "off" : false;
    const followAllowed = emp ? permissionState(d.authorities, emp.id, "follow_up").state !== "off" : false;
    const waiting = byStatus(drafts(), "waiting"), approved = byStatus(drafts(), "approved"), sent = byStatus(drafts(), "sent");
    const nReady = ready().length, due = dueFollowups(d.followups).length;
    const pages = Math.max(1, Math.ceil(waiting.length / PAGE)); if (s.page >= pages) s.page = pages - 1;
    const shown = waiting.slice(s.page * PAGE, s.page * PAGE + PAGE);
    const all = [...waiting, ...approved];
    const cur = all.find((x) => x.id === s.sel) ?? (waiting[0] ?? approved[0] ?? null);
    return h("div", { class: `page wide approve${s.open ? " is-open" : ""}` },
      h("div", { class: "page-h" }, h("h1", { text: "To approve" }), h("span", { class: "tag", text: `${waiting.length} waiting` })),
      !emp ? stateBlock({ icon: "bot", title: "No AI employee yet", text: "This company has no AI employee, so there is nothing to approve." }) : [
        !allowed ? h("div", { class: "notice warn" }, "Ava is not allowed to contact companies yet. ", h("button", { class: "textbtn", type: "button", onclick: () => ctx.openPermissions() }, "Allow it in Settings"), ". It asks you first, every time, and does not send anything.") : null,
        h("div", { class: "card flush workbar" },
          h("div", { class: "work" }, h("div", {}, h("strong", { text: "Write first emails" }), h("p", { class: "muted small", text: nReady ? `${nReady} ${nReady === 1 ? "company is" : "companies are"} ready. Your approved template is filled in; no AI is used.` : "A company needs a contact with an email, must not be do-not-contact, and must not have a first email yet." })),
            h("button", { class: "btn", type: "button", disabled: s.working || !allowed || nReady === 0, onclick: writeFirst }, icon("outreach", 16), s.busy === "writing" ? "Writing…" : nReady ? `Write ${nReady}` : "Nothing ready")),
          due > 0 || (d.followups ?? []).some((f) => f.status === "scheduled") ? h("div", { class: "work" }, h("div", {}, h("strong", { text: "Follow-ups" }), h("p", { class: "muted small", text: `${due} ${due === 1 ? "is" : "are"} due now.${followAllowed ? "" : " Allow “Carry on a conversation with a company” in Settings first."}` })),
            h("button", { class: "btn", type: "button", disabled: s.working || !followAllowed || due === 0, onclick: writeFollowups }, s.busy === "followups" ? "Writing…" : "Write the ones due")) : null),
        s.lines.length ? h("div", { class: "card" }, h("ul", { class: "plainlist" }, s.lines.slice(0, 20).map((l) => h("li", { class: l.tone, text: l.text })), s.lines.length > 20 ? h("li", { text: `…and ${s.lines.length - 20} more.` }) : null)) : null,
        !s.open ? note(s.notice) : null,
        all.length === 0 ? stateBlock({ icon: "ok", title: "Nothing to approve", text: "When Ava writes a message for you, it shows up here. You can ask her to write first emails above.", inline: true }) :
          h("div", { class: "split" },
            h("div", { class: "queue card flush" },
              h("div", { class: "qh", text: `Waiting for you (${waiting.length})` }),
              waiting.length === 0 ? h("p", { class: "muted small pad", text: "Nothing is waiting." }) : h("div", { class: "rowlist" }, shown.map((x) => row(x, cur?.id === x.id))),
              waiting.length > PAGE ? pager({ page: s.page, size: PAGE, total: waiting.length, onPage: (p) => set({ page: p }), noun: "messages" }) : null,
              approved.length ? [h("div", { class: "qh", text: `Approved, ready to send (${approved.length})` }), h("div", { class: "rowlist" }, approved.slice(0, 10).map((x) => row(x, cur?.id === x.id))), approved.length > 10 ? h("p", { class: "muted small pad", text: `…and ${approved.length - 10} more.` }) : null,
                h("div", { class: "qfoot" }, h("button", { class: `btn${waiting.length === 0 ? " primary" : ""}`, type: "button", disabled: s.working, onclick: sendApproved }, icon("outreach", 16), s.busy === "sending" ? "Sending…" : "Send approved messages (test mode)"),
                  h("p", { class: "muted small", text: "They go to your test inbox only. Each one is checked again just before it is sent: your approval, do-not-contact marks and the pause." }))] : null),
            cur ? detail(cur) : null),
        sent.length ? h("p", { class: "muted small foot", text: `${sent.length} sent as tests so far. See them under Sent.` }) : null,
      ]);
  }

  return { open, render, helper };
}
