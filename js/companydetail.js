// One company, shown beside the list: why Ava thinks it fits (quote and source, Not verified), where it came from, its contacts, messages, and the owner-only controls (mark checked / do-not-contact).
// Uses ONLY the owner-only functions public.set_company_verification and public.mark_opt_out. There is deliberately no button here that clears a do-not-contact mark.
import { STAGES, originText, verificationText } from "./pipeline-logic.js";
import { kindWords, statusWords } from "./outreach-logic.js";

export function createCompanyDetail(ctx) {
  const { h, icon, state: app } = ctx;
  const fresh = (id) => ({ id, asking: null, working: false, notice: null });
  const st = (id) => { if (!app.co || app.co.id !== id) app.co = fresh(id); return app.co; };
  const set = (id, patch) => { Object.assign(st(id), patch); ctx.render(); };

  const row = (id) => (app.data?.pipeline ?? []).find((r) => r.subject_id === id) ?? null;
  const contacts = (id) => (app.data?.contacts ?? []).filter((c) => c.company_subject_id === id);

  async function run(id, fn, args, okText) {
    if (st(id).working) return;
    set(id, { working: true, asking: null, notice: null });
    const res = await ctx.rpc(fn, args);
    if (!res.ok) { set(id, { working: false, notice: { tone: "bad", text: res.status === 0 ? "Could not reach the project. Nothing was changed." : "Only an owner of this company can do that, or something went wrong. Nothing was changed." } }); return; }
    await ctx.reload(true);
    set(id, { working: false, notice: { tone: "good", text: okText } });
  }

  const note = (n) => (n ? h("div", { class: `notice ${n.tone === "bad" ? "bad" : ""}`, role: "status", text: n.text }) : null);

  function body(id) {
    const r = row(id), s = st(id);
    if (!r) return h("p", { class: "empty", text: "That company could not be found." });
    const cs = contacts(id), stage = STAGES.find((x) => x.key === r.stage) ?? STAGES[0], busy = s.working;
    const drafts = (app.data.drafts ?? []).filter((d) => d.subject_id === id);
    const verifyBtn = (value, label) => h("button", { type: "button", "aria-pressed": String(r.verification === value), disabled: busy || !r.on_owner_list, onclick: () => run(id, "set_company_verification", { p_org_id: app.orgId, p_subject_id: id, p_status: value }, `Saved: ${label}.`) }, label);
    return h("div", {},
      note(s.notice),
      ctx.research.detail(r),
      h("div", { class: "card" }, h("h3", { text: "About this company" }),
        h("dl", { class: "kv" },
          h("dt", { text: "Where it is" }), h("dd", { text: `${stage.label}: ${stage.hint}` }),
          h("dt", { text: "Came from" }), h("dd", { text: originText(r) }),
          h("dt", { text: "Website" }), h("dd", {}, r.website ? r.website : h("span", { class: "tag warn", text: "Needs a website" })),
          h("dt", { text: "Place" }), h("dd", { text: r.place || "not given" }),
          h("dt", { text: "Checked?" }), h("dd", { text: `${verificationText(r.verification)}${r.last_checked_at ? ` · last checked ${String(r.last_checked_at).slice(0, 10)}` : ""}` }))),
      drafts.length ? h("div", { class: "card" }, h("h3", { text: "Messages" }),
        h("ul", { class: "plainlist" }, drafts.slice(0, 5).map((x) => h("li", { text: `${kindWords(x.kind)} · ${statusWords(x.status)} · “${x.subject_line}”` }))),
        drafts.length > 5 ? h("p", { class: "muted small", text: `…and ${drafts.length - 5} more.` }) : null,
        h("button", { class: "textbtn", type: "button", onclick: () => ctx.openApprove() }, "Go to Outreach")) : null,
      r.on_owner_list ? h("div", { class: "card" }, h("h3", { text: "Have you checked these details yourself?" }),
        h("p", { class: "muted small", text: "Details from your list start as “not checked yet”. Mark them when you have checked. An import never marks anything checked for you." }),
        h("div", { class: "chips", role: "group", "aria-label": "Checked" }, verifyBtn("unknown", "Not checked yet"), verifyBtn("unverified", "Looked at, not sure"), verifyBtn("verified", "Checked by me"))) : null,
      h("div", { class: "card" }, h("h3", { text: `Contacts (${cs.length})` }),
        cs.length === 0 ? h("p", { class: "muted", text: "No contact people yet." }) : h("div", { class: "cardlist" }, cs.map((c) => h("div", { class: "li" },
          h("div", { class: "row2" }, h("strong", { text: c.name || "(no name)" }), c.opted_out_at ? h("span", { class: "tag bad", text: "Do not contact" }) : null),
          h("div", { class: "muted small", text: [c.email, c.phone].filter(Boolean).join(" · ") || "no email or phone" }),
          !c.opted_out_at ? h("button", { class: "textbtn", type: "button", disabled: busy, onclick: () => set(id, { asking: { kind: "contact", id: c.id, name: c.name || "this contact" } }) }, "Mark do-not-contact") : null)))),
      h("div", { class: "card" }, h("h3", { text: "Do not contact" }),
        r.opted_out ? h("p", { text: "This whole company is marked do-not-contact. Ava is not allowed to write to it." })
          : h("button", { class: "btn", type: "button", disabled: busy, onclick: () => set(id, { asking: { kind: "company", id, name: r.name } }) }, "Mark the whole company do-not-contact"),
        h("p", { class: "muted small", text: "There is no button to undo this in this version, and a later import can never undo it." })),
      s.asking ? h("div", { class: "card ask", role: "alertdialog" },
        h("h3", { text: `Mark ${s.asking.name} as do-not-contact?` }),
        h("p", { text: "Ava will never write to them, and no import can change that." }),
        h("div", { class: "btnrow" },
          h("button", { class: "btn danger", type: "button", disabled: busy, onclick: () => run(id, "mark_opt_out", s.asking.kind === "contact" ? { p_org_id: app.orgId, p_contact_id: s.asking.id, p_subject_id: null } : { p_org_id: app.orgId, p_contact_id: null, p_subject_id: s.asking.id }, "Marked do-not-contact.") }, "Yes, mark it"),
          h("button", { class: "btn", type: "button", disabled: busy, onclick: () => set(id, { asking: null }) }, "Not now"))) : null);
  }

  return { body };
}
