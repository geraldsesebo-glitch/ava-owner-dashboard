// The "Company information" screen: what the company does, what it sells, who it wants, and the short note Ava judges websites against.
// It uses ONLY the existing owner-only company-knowledge functions (public.set_knowledge / retire_knowledge). Each save is a new version; "Save and approve" is the owner's
// confirmation (older versions are kept by the platform). Company information is data: it never gives Ava any permission.
import { loadKnowledge } from "./data.js";
import { shapeKnowledge, knowledgeError, newItemKey } from "./knowledge-logic.js";

export function createCompanyInfo(ctx) {
  const { h, icon, state: app } = ctx;
  const st = () => app.ci;
  const fresh = () => ({ loaded: false, failed: false, k: null, drafts: {}, adding: null, working: null, notice: null });
  const set = (patch) => { Object.assign(st(), patch); ctx.render(); };
  const when = (iso) => (iso ? new Date(iso).toLocaleDateString() : "");

  async function load() {
    const r = await loadKnowledge(app.orgId);
    if (!st()) return;
    set(r.ok ? { loaded: true, failed: false, k: shapeKnowledge(r.rows, r.versions) } : { loaded: true, failed: true });
  }
  function open() { app.ci = fresh(); ctx.go("companyinfo"); load(); }

  async function save(slot, item, value, label) {
    if (st().working) return;
    set({ working: slot + (item || ""), notice: null });
    const res = await ctx.rpc("set_knowledge", { p_org_id: app.orgId, p_slot_key: slot, p_item_key: item || null, p_value: value, p_review_by: null, p_confirm: true });
    if (!res.ok) { set({ working: null, notice: { tone: "bad", text: knowledgeError(res) } }); return; }
    const r = await loadKnowledge(app.orgId);
    const drafts = { ...st().drafts }; delete drafts[slot + (item || "")];
    set({ working: null, drafts, adding: null, k: r.ok ? shapeKnowledge(r.rows, r.versions) : st().k, notice: { tone: "good", text: `Saved and approved: ${label}.` } });
  }
  async function remove(info, label) {
    if (st().working) return;
    set({ working: "offering" + info.item_key, notice: null });
    const res = await ctx.rpc("retire_knowledge", { p_org_id: app.orgId, p_slot_key: "offering", p_item_key: info.item_key });
    if (!res.ok) { set({ working: null, notice: { tone: "bad", text: knowledgeError(res) } }); return; }
    const r = await loadKnowledge(app.orgId);
    set({ working: null, k: r.ok ? shapeKnowledge(r.rows, r.versions) : st().k, notice: { tone: "good", text: `Removed: ${label}. Its history is kept.` } });
  }

  const note = (n) => (n ? h("div", { class: `notice ${n.tone}`, role: "status", text: n.text }) : null);
  const stamp = (info) => (info ? h("p", { class: "muted small", text: `Approved version ${info.version_no}${info.confirmed_at ? ` on ${when(info.confirmed_at)}` : ""}.` }) : h("p", { class: "muted small", text: "Not filled in yet." }));

  /** One text field (single value). `toValue` turns the box text into what is saved; `fromValue` turns the saved value into box text. */
  function textCard(slot, title, help, { rows = 0, max, fromValue = (v) => (typeof v === "string" ? v : ""), toValue = (t) => t.trim() } = {}) {
    const s = st(), info = s.k?.single?.[slot] ?? null, saved = info ? fromValue(info.value) : "";
    const cur = s.drafts[slot] ?? saved;
    const empty = toValue(cur) === "" || (Array.isArray(toValue(cur)) && toValue(cur).length === 0);
    const unchanged = cur === saved;
    const input = rows
      ? h("textarea", { rows, maxlength: max, class: "listbox", "aria-label": title, oninput: (e) => { st().drafts[slot] = e.target.value; refreshSave(slot); } }, cur)
      : h("input", { type: "text", maxlength: max, class: "pick", "aria-label": title, value: cur, oninput: (e) => { st().drafts[slot] = e.target.value; refreshSave(slot); } });
    return h("div", { class: "card" }, h("h3", { text: title }), h("p", { class: "muted small", text: help }), input, stamp(info),
      h("button", { class: "btn primary block", type: "button", "data-save": slot, disabled: !!s.working || empty || unchanged, onclick: () => save(slot, null, toValue(st().drafts[slot] ?? saved), title) }, icon("check", 20), s.working === slot ? "Saving…" : "Save and approve"));
  }
  /** Keeps the Save button in step with what is typed, without re-drawing the page (so the cursor stays put). */
  function refreshSave(slot) {
    const b = document.querySelector(`[data-save="${slot}"]`);
    if (!b) return;
    const spec = SPECS[slot], info = st().k?.single?.[slot] ?? null, saved = info ? spec.fromValue(info.value) : "", cur = st().drafts[slot] ?? saved;
    const v = spec.toValue(cur);
    b.disabled = !!st().working || cur === saved || v === "" || (Array.isArray(v) && v.length === 0);
  }

  const SPECS = {
    company_name: { title: "Company name", help: "Your company's name as customers know it.", max: 200, fromValue: (v) => (typeof v === "string" ? v : ""), toValue: (t) => t.trim() },
    company_description: { title: "What your company does", help: "A few sentences, the way you would explain it to a new customer.", rows: 4, max: 2000, fromValue: (v) => (typeof v === "string" ? v : ""), toValue: (t) => t.trim() },
    sales_note: { title: "What we sell and who we want", help: "In plain words: what you sell, and what kind of company you would most like as a customer. Ava reads each company's website and judges it against this note and against “Who you target”.", rows: 5, max: 1000, fromValue: (v) => (typeof v === "string" ? v : ""), toValue: (t) => t.trim() },
    target_company_sizes: { title: "Company sizes you sell to", help: "Separate with commas, for example: 10-50, 51-200. Optional.", max: 400,
      fromValue: (v) => (Array.isArray(v) ? v.join(", ") : ""), toValue: (t) => t.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 10).map((x) => x.slice(0, 50)) },
  };

  function offeringsCard() {
    const s = st(), items = s.k?.offerings ?? [], add = s.adding;
    return h("div", { class: "card" }, h("h3", { text: "Products and services" }), h("p", { class: "muted small", text: "Add each product or service separately." }),
      items.length === 0 ? h("p", { class: "muted", text: "None added yet." }) : h("div", { class: "cardlist" }, items.map((it) => h("div", { class: "li" },
        h("div", { class: "row2" }, h("strong", { text: String(it.value?.name ?? "") }), h("button", { class: "textbtn", type: "button", disabled: !!s.working, onclick: () => remove(it, String(it.value?.name ?? "this item")) }, "Remove")),
        h("div", { class: "muted small", text: String(it.value?.description ?? "") })))),
      add
        ? h("div", { class: "card inner" },
          h("label", { class: "field" }, "Name", h("input", { type: "text", class: "pick", maxlength: 200, value: add.name, oninput: (e) => { add.name = e.target.value; } })),
          h("label", { class: "field" }, "What it is, in a sentence or two", h("textarea", { rows: 3, maxlength: 2000, class: "listbox", oninput: (e) => { add.description = e.target.value; } }, add.description)),
          h("button", { class: "btn primary block", type: "button", disabled: !!s.working, onclick: () => {
            const name = add.name.trim(), description = add.description.trim();
            if (!name || !description) { set({ notice: { tone: "bad", text: "Give the product or service a name and a short description." } }); return; }
            save("offering", newItemKey(name, items.map((x) => x.item_key)), { name, description }, name);
          } }, icon("check", 20), "Save and approve"),
          h("button", { class: "btn ghost block", type: "button", onclick: () => set({ adding: null }) }, "Cancel"))
        : h("button", { class: "btn ghost block", type: "button", onclick: () => set({ adding: { name: "", description: "" } }) }, icon("plus", 18), "Add a product or service"));
  }

  function render() {
    const s = st() ?? (app.ci = fresh());
    return [
      h("button", { class: "back always", type: "button", onclick: () => ctx.go("home") }, icon("back", 18), "Home"),
      h("h1", { class: "page-title", text: "Company information" }),
      h("p", { class: "mainnote", text: "What Ava knows about your company. Only you, the owner, can change it. Each save is kept as a new approved version." }),
      note(s.notice),
      !s.loaded ? h("p", { class: "empty", text: "Loading…" }) : s.failed ? h("div", { class: "notice bad", role: "alert", text: "Could not read your company information just now. Press Back and try again." }) : [
        textCard("company_name", SPECS.company_name.title, SPECS.company_name.help, SPECS.company_name),
        textCard("company_description", SPECS.company_description.title, SPECS.company_description.help, SPECS.company_description),
        offeringsCard(),
        textCard("target_company_sizes", SPECS.target_company_sizes.title, SPECS.target_company_sizes.help, SPECS.target_company_sizes),
        textCard("sales_note", SPECS.sales_note.title, SPECS.sales_note.help, SPECS.sales_note),
        h("div", { class: "card" }, h("h3", { text: "Who you target" }), h("p", { class: "muted small", text: "The kinds of company and places Ava may search." }), h("button", { class: "btn ghost block", type: "button", onclick: () => ctx.openTargets() }, "Open “Who you target”")),
      ],
    ];
  }

  return { open, render };
}
