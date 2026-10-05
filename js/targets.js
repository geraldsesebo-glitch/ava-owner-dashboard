// The "Who you target" screen: the owner picks kinds of company and places from the platform's own known list, sees the choice in plain words,
// and confirms. It uses ONLY the existing owner-only path: public.set_knowledge (slots target_industries / target_geographies), which the platform
// itself restricts to the company owner, validates, versions (each real change is a new version; the old one is kept) and audits.
// Nothing here is set automatically: the only thing that ever saves is the owner's Confirm.
import { loadVocabulary } from "./data.js";
import { SLOTS, buildTree, insideCount, matchCurrent, labelsOf, describeChoice, changeSummary, canConfirm, saveRefusal } from "./targets-logic.js";

let vocabularyCache = null;

export function createTargets(ctx) {
  const { h, icon, state: app } = ctx;
  const tg = () => app.targets;
  const set = (patch) => { Object.assign(tg(), patch); ctx.render(); };
  const current = () => app.data?.targets ?? { ok: false };

  /** Open the screen with today's choice ticked. */
  function open() {
    app.targets = { phase: "loading", notice: null, done: null };
    ctx.go("company", "targets");
  }
  /** Reads the platform list and shows the choice; started by the first drawing of the screen (so a direct link works too). */
  async function begin() {
    if (!vocabularyCache) vocabularyCache = await loadVocabulary();
    if (!vocabularyCache || !vocabularyCache.length) { set({ phase: "error", notice: { tone: "bad", text: "Could not load the platform's list. Check your connection and try again." } }); return; }
    const ind = buildTree(vocabularyCache, "industry"), geo = buildTree(vocabularyCache, "geography");
    const cur = current(), mi = matchCurrent(cur.industries?.values, ind), mg = matchCurrent(cur.geographies?.values, geo);
    set({ phase: "edit", ind, geo, selInd: mi.selected, selGeo: mg.selected, unknown: [...mi.unknown, ...mg.unknown], beforeInd: labelsOf(ind, mi.selected), beforeGeo: labelsOf(geo, mg.selected), query: "" });
  }

  async function save() {
    const t = tg();
    if (t.phase !== "edit") return;                                                          // a second press while saving, or after saving, does nothing
    const kindsAfter = labelsOf(t.ind, t.selInd), placesAfter = labelsOf(t.geo, t.selGeo);
    const ok = canConfirm({ kindsBefore: t.beforeInd, kindsAfter, placesBefore: t.beforeGeo, placesAfter });
    if (!ok.ok) { set({ notice: { tone: "warn", text: ok.reason } }); return; }
    set({ phase: "saving", notice: null });
    const saved = [];
    const jobs = [];
    if (changeSummary(t.beforeInd, kindsAfter, "k").changed) jobs.push({ slot: SLOTS.industry, values: kindsAfter, what: "kinds of company" });
    if (changeSummary(t.beforeGeo, placesAfter, "p").changed) jobs.push({ slot: SLOTS.geography, values: placesAfter, what: "places" });
    for (const j of jobs) {
      const res = await ctx.rpc("set_knowledge", { p_org_id: app.orgId, p_slot_key: j.slot, p_item_key: "", p_value: j.values, p_review_by: null, p_confirm: true });
      if (!res.ok) {
        await ctx.reload(true);
        const note = saved.length ? ` The ${saved.join(" and ")} you chose ${saved.length > 1 ? "were" : "was"} saved; the ${j.what} ${j.what === "places" ? "were" : "were"} not.` : " Nothing was saved.";
        set({ phase: "edit", notice: { tone: "bad", text: saveRefusal(res) + note }, beforeInd: saved.includes("kinds of company") ? kindsAfter : t.beforeInd });
        return;
      }
      saved.push(j.what);
    }
    await ctx.reload(true);
    set({ phase: "done", notice: null, done: describeChoice(kindsAfter, placesAfter) });
  }

  // ---- drawing ------------------------------------------------------------------------------------------------------------------------------
  const note = (n) => (n ? h("div", { class: `notice ${n.tone}`, role: "status", text: n.text }) : null);

  function nowCard() {
    const c = current();
    const line = (label, v) => h("div", { class: "li" }, h("div", { class: "row2" }, h("strong", { text: label }), v ? h("span", { class: "badge good", text: `Version ${v.version_no}` }) : h("span", { class: "badge warn", text: "Not set yet" })),
      h("div", { class: v ? "" : "muted", text: v ? v.values.join(", ") : "Nothing chosen." }));
    return h("div", { class: "card" }, h("h3", { text: "What is set now" }),
      c.ok ? h("div", { class: "cardlist" }, line("Kinds of company", c.industries), line("Places", c.geographies)) : h("p", { class: "muted", text: "Could not read what is set. You can still choose below." }));
  }

  function checklist(tree, selected, onToggle, labelId) {
    const boxes = [];
    const wrap = h("div", { class: "checks", role: "group", "aria-labelledby": labelId }, tree.map((t) => {
      const box = h("input", { type: "checkbox", checked: selected.has(t.term_key), onchange: () => { if (box.checked) selected.add(t.term_key); else selected.delete(t.term_key); onToggle(); } });
      const row = h("label", { class: `check d${Math.min(t.depth, 2)}` }, box, h("span", { text: t.label }));
      row.dataset.text = t.label.toLowerCase();
      boxes.push(row);
      return row;
    }));
    return { wrap, filter: (q) => { const s = q.trim().toLowerCase(); for (const r of boxes) r.hidden = s !== "" && !r.dataset.text.includes(s); } };
  }

  function editor() {
    const t = tg();
    const summary = h("div", { class: "card" }), button = h("button", { class: "btn primary", type: "button", onclick: save }, icon("check", 16), "Confirm who you target");
    const why = h("p", { class: "muted small" });
    const refresh = () => {
      const kinds = labelsOf(t.ind, t.selInd), places = labelsOf(t.geo, t.selGeo);
      const ok = canConfirm({ kindsBefore: t.beforeInd, kindsAfter: kinds, placesBefore: t.beforeGeo, placesAfter: places });
      const inside = [...t.selGeo].map((k) => [t.geo.find((x) => x.term_key === k), insideCount(t.geo, k)]).filter(([, n]) => n > 0).map(([x, n]) => `${x.label} also covers the ${n} places inside it.`)
        .concat([...t.selInd].map((k) => [t.ind.find((x) => x.term_key === k), insideCount(t.ind, k)]).filter(([, n]) => n > 0).map(([x, n]) => `${x.label} also covers the ${n} kinds listed under it.`));
      fill(summary, h("h3", { text: "What you are choosing" }), h("p", { class: "strong", text: describeChoice(kinds, places) }),
        h("p", { class: "muted small", text: changeSummary(t.beforeInd, kinds, "Kinds of company").text }), h("p", { class: "muted small", text: changeSummary(t.beforeGeo, places, "Places").text }),
        inside.length ? h("ul", { class: "plain small" }, inside.map((x) => h("li", { text: x }))) : null,
        (!kinds.length || !places.length) ? h("p", { class: "muted small", text: "Goals can only be confirmed once both a kind of company and a place are set." }) : null,
        h("p", { class: "muted small", text: "Goals you have already confirmed keep the targets they were confirmed under. A goal that is still waiting for OK is checked against these when you confirm it." }));
      button.disabled = !ok.ok || t.phase === "saving"; why.textContent = ok.ok ? "" : ok.reason; if (t.phase === "saving") button.lastChild.textContent = "Saving…";
    };
    const ind = checklist(t.ind, t.selInd, refresh, "kinds-title"), geo = checklist(t.geo, t.selGeo, refresh, "places-title");
    const search = h("input", { type: "search", placeholder: "Find a place", "aria-label": "Find a place", oninput: (e) => { t.query = e.target.value; geo.filter(t.query); } });
    const node = h("div", {},
      nowCard(),
      t.unknown.length ? h("div", { class: "notice warn", text: `Set today but not on the platform's list: ${t.unknown.join(", ")}. It will not be kept unless you pick something from the list.` }) : null,
      h("div", { class: "card" }, h("h3", { id: "kinds-title", text: "Kinds of company" }), h("p", { class: "muted small", text: "Tick every kind of company Ava may search for." }), ind.wrap),
      h("div", { class: "card" }, h("h3", { id: "places-title", text: "Places" }), h("p", { class: "muted small", text: "Tick every place Ava may search in. A country includes all its states." }), h("label", { class: "searchbox inline" }, icon("search", 16), search), geo.wrap),
      summary, note(t.notice), button, why,
      h("p", { class: "muted small", text: "Only the owner of this company can save this. Each change is kept as a new version, so the earlier choice is never lost." }));
    refresh();
    return node;
  }
  const fill = (el, ...kids) => el.replaceChildren(...kids.flat(2).filter((k) => k !== null && k !== undefined && k !== false));

  function render() {
    const t = tg() ?? (app.targets = { phase: "loading", notice: null, done: null });
    if (t.phase === "loading" && !t.begun) { t.begun = true; queueMicrotask(begin); }
    return [
      h("h1", { class: "page-title", text: "Who you target" }),
      h("p", { class: "mainnote", text: "Ava only searches inside what you choose here. A goal has to fit inside it before you can confirm it." }),
      t.phase === "loading" ? h("p", { class: "empty", text: "Loading…" }) : null,
      t.phase === "error" ? [note(t.notice), h("button", { class: "btn", type: "button", onclick: open }, "Try again")] : null,
      t.phase === "edit" || t.phase === "saving" ? editor() : null,
      t.phase === "done" ? h("div", { class: "card" }, h("div", { class: "notice", role: "status", text: "Saved. Who you target is now set." }), h("p", { class: "strong", text: t.done }),
        h("p", { class: "muted small", text: "A goal that was waiting for your OK can now be reviewed again from your goals." }),
        h("button", { class: "btn primary", type: "button", onclick: () => ctx.go("home", "goals") }, "Back to my goals"),
        h("button", { class: "btn", type: "button", onclick: open }, "Change it again")) : null,
    ];
  }

  return { open, render };
}
