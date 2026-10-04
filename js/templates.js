// The "Message templates" screen: one first-email and one follow-up template, each with blanks like {{company_name}}, versioned and approved by the owner.
// Uses ONLY the existing owner-only company-knowledge function (public.set_knowledge). A template is DATA: it gives Ava no permission, she can only fill in the blanks,
// and nothing is ever sent without the owner's approval of the finished draft (later chapters). Only the blanks in the list can be used (the platform checks again when it drafts).
import { loadKnowledge } from "./data.js";
import { shapeKnowledge, knowledgeError, TEMPLATE_KINDS, BLANKS, templateProblem, fillSample } from "./knowledge-logic.js";

export function createTemplates(ctx) {
  const { h, icon, state: app } = ctx;
  const st = () => app.tpl;
  const fresh = () => ({ loaded: false, failed: false, k: null, drafts: {}, working: null, notice: null, preview: {} });
  const set = (patch) => { Object.assign(st(), patch); ctx.render(); };
  const when = (iso) => (iso ? new Date(iso).toLocaleDateString() : "");

  async function load() {
    const r = await loadKnowledge(app.orgId);
    if (!st()) return;
    set(r.ok ? { loaded: true, failed: false, k: shapeKnowledge(r.rows, r.versions) } : { loaded: true, failed: true });
  }
  function open() { app.tpl = fresh(); ctx.go("templates"); load(); }

  const savedOf = (key) => { const v = st().k?.templates?.[key]?.value; return v && typeof v === "object" ? { name: String(v.name ?? ""), channel: "email", subject: String(v.subject ?? ""), body: String(v.body ?? "") } : null; };
  const currentOf = (kind) => st().drafts[kind.key] ?? savedOf(kind.key) ?? { ...kind.starter };
  const changed = (kind) => { const a = currentOf(kind), b = savedOf(kind.key); return !b || a.name !== b.name || a.subject !== b.subject || a.body !== b.body; };

  async function save(kind) {
    const t = currentOf(kind), problem = templateProblem(t);
    if (problem) { set({ notice: { tone: "bad", text: problem } }); return; }
    if (st().working) return;
    set({ working: kind.key, notice: null });
    const res = await ctx.rpc("set_knowledge", { p_org_id: app.orgId, p_slot_key: "message_templates", p_item_key: kind.key, p_value: { name: t.name.trim(), channel: "email", subject: t.subject.trim(), body: t.body }, p_review_by: null, p_confirm: true });
    if (!res.ok) { set({ working: null, notice: { tone: "bad", text: knowledgeError(res) } }); return; }
    const r = await loadKnowledge(app.orgId);
    const drafts = { ...st().drafts }; delete drafts[kind.key];
    set({ working: null, drafts, k: r.ok ? shapeKnowledge(r.rows, r.versions) : st().k, notice: { tone: "good", text: `Saved and approved: ${kind.title}. Ava may now use this wording to prepare drafts for you.` } });
  }

  const note = (n) => (n ? h("div", { class: `notice ${n.tone}`, role: "status", text: n.text }) : null);

  function card(kind) {
    const s = st(), t = currentOf(kind), info = s.k?.templates?.[kind.key] ?? null, busy = s.working === kind.key;
    const problem = templateProblem(t);
    const edit = (field) => (e) => { const cur = { ...currentOf(kind) }; cur[field] = e.target.value; st().drafts[kind.key] = cur; refresh(kind); };
    let bodyBox;
    const insert = (key) => {
      const cur = { ...currentOf(kind) }, el = bodyBox, pos = el ? el.selectionStart : cur.body.length, ins = `{{${key}}}`;
      cur.body = cur.body.slice(0, pos) + ins + cur.body.slice(el ? el.selectionEnd : pos);
      st().drafts[kind.key] = cur; set({}); const again = document.getElementById(`tpl-body-${kind.key}`); if (again) { again.focus(); again.setSelectionRange(pos + ins.length, pos + ins.length); }
    };
    bodyBox = h("textarea", { id: `tpl-body-${kind.key}`, rows: 9, maxlength: 3000, class: "listbox", "aria-label": `${kind.title} message`, oninput: edit("body") }, t.body);
    return h("div", { class: "card" },
      h("div", { class: "row2" }, h("h3", { text: kind.title }), info ? h("span", { class: "badge good", text: `Approved v${info.version_no}` }) : h("span", { class: "badge warn", text: "Not approved yet" })),
      h("p", { class: "muted small", text: kind.help }),
      h("label", { class: "field" }, "Template name", h("input", { type: "text", class: "pick", maxlength: 100, value: t.name, oninput: edit("name") })),
      h("label", { class: "field" }, "Subject line", h("input", { type: "text", class: "pick", maxlength: 150, value: t.subject, oninput: edit("subject") })),
      h("label", { class: "field" }, "Message", bodyBox),
      h("p", { class: "muted small", text: "Click a blank to put it in the message where the cursor is:" }),
      h("div", { class: "chips" }, BLANKS.map((b) => h("button", { type: "button", title: b.label, onclick: () => insert(b.key) }, `{{${b.key}}}`))),
      h("ul", { class: "plain small" }, BLANKS.map((b) => h("li", { text: `{{${b.key}}} = ${b.label.toLowerCase()}` }))),
      h("div", { class: "card inner" }, h("h4", { text: "How it will look (with made-up example details)" }), h("p", { class: "strong", id: `tpl-ps-${kind.key}`, text: fillSample(t.subject) }), h("p", { class: "prewrap", id: `tpl-pb-${kind.key}`, text: fillSample(t.body) })),
      problem ? h("p", { class: "small warnText", id: `tpl-pr-${kind.key}`, text: problem }) : h("p", { class: "small warnText", id: `tpl-pr-${kind.key}` }),
      info ? h("p", { class: "muted small", text: `Current approved version ${info.version_no}${info.confirmed_at ? `, approved on ${when(info.confirmed_at)}` : ""}. ${info.versions} ${info.versions === 1 ? "version" : "versions"} kept.` }) : null,
      h("button", { class: "btn primary block bigbtn", type: "button", id: `tpl-save-${kind.key}`, disabled: !!s.working || !!problem || !changed(kind), onclick: () => save(kind) }, icon("check", 20), busy ? "Saving…" : "Save and approve this wording"));
  }
  /** Updates the preview, the problem line and the Save button as the owner types, without re-drawing the page (so the cursor stays put). */
  function refresh(kind) {
    const t = currentOf(kind), problem = templateProblem(t);
    const set1 = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set1(`tpl-ps-${kind.key}`, fillSample(t.subject)); set1(`tpl-pb-${kind.key}`, fillSample(t.body)); set1(`tpl-pr-${kind.key}`, problem ?? "");
    const b = document.getElementById(`tpl-save-${kind.key}`); if (b) b.disabled = !!st().working || !!problem || !changed(kind);
  }

  function render() {
    const s = st() ?? (app.tpl = fresh());
    return [
      h("button", { class: "back always", type: "button", onclick: () => ctx.go("home") }, icon("back", 18), "Home"),
      h("h1", { class: "page-title", text: "Message templates" }),
      h("p", { class: "mainnote", text: "The wording Ava may use for a first email and a follow-up. She fills in the blanks and cannot change your words. You approve each version, and you approve every finished draft before anything is sent." }),
      note(s.notice),
      !s.loaded ? h("p", { class: "empty", text: "Loading…" }) : s.failed ? h("div", { class: "notice bad", role: "alert", text: "Could not read your templates just now. Press Back and try again." }) : TEMPLATE_KINDS.map(card),
    ];
  }

  return { open, render };
}
