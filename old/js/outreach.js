// The Outreach screen (chapter 6): every message Ava has sent, as a record, and what is scheduled. In test mode every one of them went to your own test inbox. Read-only: nothing here sends.
import { TEST_MODE_NOTE, kindWords, byStatus, reasonWords } from "./outreach-logic.js";
import { timeAgo } from "./text.js";

export function createOutreach(ctx) {
  const { h, icon, state: app } = ctx;
  const nameOf = (id) => (app.data?.pipeline ?? []).find((r) => r.subject_id === id)?.name || "A company";

  function open() { ctx.go("outreach"); }

  function render() { return renderBody().flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false); }
  function renderBody() {
    const d = app.data, recs = (d.records ?? []).filter((r) => r.direction === "outbound").slice(0, 60);
    const sched = (d.followups ?? []).filter((f) => f.status === "scheduled").sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
    const waiting = byStatus(d.drafts, "waiting").length, approved = byStatus(d.drafts, "approved").length;
    return [
      h("h1", { class: "page-title", text: "Outreach" }),
      h("div", { class: "notice warn", role: "note", text: TEST_MODE_NOTE }),
      h("div", { class: "card" }, h("div", { class: "kv2" },
        h("div", {}, h("div", { class: "big2", text: String(waiting) }), h("div", { class: "muted small", text: "waiting for you" })),
        h("div", {}, h("div", { class: "big2", text: String(approved) }), h("div", { class: "muted small", text: "approved, not sent yet" })),
        h("div", {}, h("div", { class: "big2", text: String(recs.filter((r) => r.delivery_status === "sent").length) }), h("div", { class: "muted small", text: "sent as tests" }))),
        h("button", { class: "btn primary", type: "button", onclick: () => ctx.openApprove() }, icon("check", 18), "Go to Approve")),
      h("h2", { class: "sectitle" }, "Messages"),
      recs.length === 0 ? h("p", { class: "muted", text: "Nothing has been sent yet." }) : h("div", { class: "card" }, h("ul", { class: "plainlist" }, recs.map((r) => {
        const c = r.content ?? {};
        return h("li", { class: r.delivery_status === "sent" ? "good" : "bad" },
          h("div", { class: "row2" }, h("strong", { text: nameOf(r.subject_id) }), h("span", { class: "badge", text: kindWords(c.kind) }), h("span", { class: `badge ${r.delivery_status === "sent" ? "good" : "bad"}`, text: r.delivery_status === "sent" ? "Sent (test)" : "Failed" })),
          h("div", { text: String(c.subject ?? "") }),
          h("div", { class: "muted small", text: r.delivery_status === "sent" ? `${timeAgo(r.occurred_at)} · went to your test inbox only` : `${timeAgo(r.occurred_at)} · ${reasonWords(c.error, "send")}` }));
      }))),
      h("h2", { class: "sectitle" }, `Follow-ups planned (${sched.length})`),
      sched.length === 0 ? h("p", { class: "muted", text: "None. A follow-up is planned a few days after a first email is sent, and cancelled if they reply." }) : h("div", { class: "card" }, h("ul", { class: "plainlist" }, sched.map((f) => h("li", { text: `${nameOf(f.subject_id)} · due ${new Date(f.due_at).toLocaleDateString([], { dateStyle: "medium" })}` })))),
    ];
  }

  return { open, render };
}
