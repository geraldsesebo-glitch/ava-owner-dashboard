// Sent: every message Ava has sent, as a record, and what is planned next. In test mode every one of them went to your own test inbox. Read-only: nothing here sends.
import { TEST_MODE_NOTE, kindWords, reasonWords } from "./outreach-logic.js";
import { timeAgo } from "./text.js";
import { clip, pager, stateBlock } from "./ui.js";

const PAGE = 25;

export function createOutreach(ctx) {
  const { h, icon, state: app } = ctx;
  const ui = { page: 0, fpage: 0 };
  const nameOf = (id) => (app.data?.pipeline ?? []).find((r) => r.subject_id === id)?.name || "A company";

  function open() { ctx.go("outreach", "sent"); }

  function render() {
    const d = app.data, recs = (d.records ?? []).filter((r) => r.direction === "outbound");
    const sched = (d.followups ?? []).filter((f) => f.status === "scheduled").sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
    const pages = Math.max(1, Math.ceil(recs.length / PAGE)); if (ui.page >= pages) ui.page = pages - 1;
    const fpages = Math.max(1, Math.ceil(sched.length / PAGE)); if (ui.fpage >= fpages) ui.fpage = fpages - 1;
    return h("div", { class: "page" },
      h("div", { class: "page-h" }, h("h1", { text: "Sent" }), h("span", { class: "tag", text: `${recs.length} ${recs.length === 1 ? "message" : "messages"}` })),
      h("div", { class: "notice warn", role: "note", text: TEST_MODE_NOTE }),
      h("h2", { class: "label13", text: "Messages" }),
      recs.length === 0 ? stateBlock({ icon: "outreach", title: "Nothing has been sent yet", text: "Approve a message first, then send it from To approve.", action: { label: "Go to To approve", onclick: () => ctx.openApprove() }, inline: true })
        : h("div", { class: "card flush" },
          h("div", { class: "rowlist" }, recs.slice(ui.page * PAGE, ui.page * PAGE + PAGE).map((r) => {
            const c = r.content ?? {}, ok = r.delivery_status === "sent";
            return h("div", { class: "lrow static" },
              h("span", { class: "l" }, h("span", { class: "t", text: nameOf(r.subject_id) }), h("span", { class: "s", text: clip(String(c.subject ?? ""), 90) }),
                h("span", { class: "s", text: ok ? `${timeAgo(r.occurred_at)} · went to your test inbox only` : `${timeAgo(r.occurred_at)} · ${reasonWords(c.error, "send")}` })),
              h("span", { class: "r" }, h("span", { class: "tag", text: kindWords(c.kind) }), h("span", { class: `tag ${ok ? "good" : "bad"}`, text: ok ? "Sent (test)" : "Failed" })));
          })),
          pager({ page: ui.page, size: PAGE, total: recs.length, onPage: (p) => { ui.page = p; ctx.render(); }, noun: "messages" })),
      h("h2", { class: "label13", text: `Follow-ups planned (${sched.length})` }),
      sched.length === 0 ? h("div", { class: "card" }, h("p", { class: "muted", text: "None. A follow-up is planned a few days after a first email is sent, and cancelled if they reply." }))
        : h("div", { class: "card flush" },
          h("div", { class: "rowlist" }, sched.slice(ui.fpage * PAGE, ui.fpage * PAGE + PAGE).map((f) => h("div", { class: "lrow static" },
            h("span", { class: "l" }, h("span", { class: "t", text: nameOf(f.subject_id) }), h("span", { class: "s", text: `Due ${new Date(f.due_at).toLocaleDateString([], { dateStyle: "medium" })}` })), h("span", { class: "r" }, h("span", { class: "tag", text: "Planned" }))))),
          pager({ page: ui.fpage, size: PAGE, total: sched.length, onPage: (p) => { ui.fpage = p; ctx.render(); }, noun: "follow-ups" })));
  }

  return { open, render };
}
