// Outreach: To approve (today's Approve screen), Sent (today's Outreach screen), Replies (today's Inbox, with "Simulate a reply"), Templates (the existing template screen).
import { byStatus, repliesView } from "./outreach-logic.js";
import { createApprove } from "./approve.js";
import { createOutreach } from "./outreach.js";
import { createInbox } from "./inbox.js";
import { createTemplates } from "./templates.js";

const SUBS = [{ key: "approve", label: "To approve" }, { key: "sent", label: "Sent" }, { key: "replies", label: "Replies" }, { key: "templates", label: "Templates" }];

export function createOutreachHub(ctx) {
  const { h, icon, state: app } = ctx;
  const approve = createApprove(ctx), sent = createOutreach(ctx), replies = createInbox(ctx), templates = createTemplates(ctx);
  ctx.approve = approve;
  const sub = () => (SUBS.some((s) => s.key === app.nav.sub) ? app.nav.sub : "approve");

  function counts() {
    const d = app.data;
    return { approve: byStatus(d.drafts, "waiting").length, sent: (d.records ?? []).filter((r) => r.direction === "outbound").length, replies: repliesView(d.records, d.assessments, d.pipeline).length };
  }

  function panel() {
    const c = counts(), cur = sub();
    return [
      h("div", { class: "panel-h", text: "Outreach" }),
      h("div", { class: "panel-body" }, SUBS.map((s) => h("button", { class: "pitem", type: "button", "aria-current": String(cur === s.key), onclick: () => ctx.go("outreach", s.key) },
        h("span", { class: "t", text: s.label }), c[s.key] != null ? h("span", { class: "n", text: String(c[s.key]) }) : null))),
    ];
  }

  function main() {
    const cur = sub(), c = counts();
    const chips = h("div", { class: "chiprow phone-only subnav" }, SUBS.map((s) => h("button", { class: "chip", type: "button", "aria-pressed": String(cur === s.key), onclick: () => ctx.go("outreach", s.key) }, c[s.key] != null ? `${s.label} (${c[s.key]})` : s.label)));
    let body;
    if (cur === "approve") body = approve.render();
    else if (cur === "sent") body = sent.render();
    else if (cur === "replies") body = h("div", { class: "page" }, replies.render());
    else body = h("div", { class: "page" }, templates.render());
    return [chips, body];
  }

  return { panel, main };
}
