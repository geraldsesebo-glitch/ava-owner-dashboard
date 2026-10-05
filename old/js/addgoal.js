// The "Add goal" screen. It uses ONLY the existing goal reader (the objective-intake function) and its steps:
//   interpret -> the goal is saved as "waiting for your OK" and nothing starts
//   confirm   -> only the owner's Confirm makes it a real goal      cancel -> drops it      get -> look at one again
// Every rule (limits, "fits what the company targets", owner-only, confirmed-once) is the platform's. This screen only shows the result in plain words.
import { MAX_GOAL_CHARS, EXAMPLES, checkInput, understood, fitLines, blockedLines, isConfirmed, isCancelled, refusalText } from "./goals.js";

const FN = "objective-intake";
const fresh = () => ({ phase: "input", text: "", state: null, notice: null, working: false, method: null });

export function createAddGoal(ctx) {
  const { h, icon, state: app } = ctx;
  const ag = () => app.addGoal;
  const localHint = () => ["localhost", "127.0.0.1"].includes(location.hostname);
  const set = (patch) => { Object.assign(ag(), patch); ctx.render(); };
  const call = (body) => ctx.call(FN, { org_id: app.orgId, ...body });

  /** Start a new goal. */
  function open() { app.addGoal = fresh(); ctx.go("addgoal"); }

  /** Look at a goal that is already waiting for OK (from the Goals list). */
  async function review(objectiveId) {
    app.addGoal = { ...fresh(), phase: "loading", working: true }; ctx.go("addgoal");
    const res = await call({ action: "get", objective_id: objectiveId });
    if (!res.ok || !res.data?.state?.objective) { set({ phase: "input", working: false, notice: { tone: "bad", text: refusalText(res, { localHint: localHint() }) } }); return; }
    land(res.data.state, res.data);
  }

  function land(st, data) {
    if (isConfirmed(st)) return set({ phase: "done", state: st, working: false, notice: null });
    if (isCancelled(st)) return set({ phase: "input", state: null, working: false, notice: { tone: "warn", text: "That goal was cancelled." } });
    set({ phase: "review", state: st, working: false, method: data?.interpretation_method ?? st.objective?.interpretation?.method ?? null, notice: null });
  }

  async function check() {
    if (ag().working) return;
    const v = checkInput(ag().text);
    if (!v.ok) { set({ notice: { tone: "warn", text: v.message } }); return; }
    set({ working: true, notice: null, phase: "reading" });
    const res = await call({ action: "interpret", goal_text: ag().text.trim() });
    if (!res.ok) { set({ working: false, phase: "input", notice: { tone: "bad", text: refusalText(res, { localHint: localHint() }) } }); return; }
    const d = res.data ?? {};
    if (d.status === "unsupported") { set({ working: false, phase: "input", notice: { tone: "warn", text: `${typeof d.message === "string" ? d.message : "Ava could not turn that into a goal."} Nothing was saved.` } }); return; }
    if (d.status === "needs_input") { set({ working: false, phase: "input", notice: { tone: "warn", text: "I need to know how many companies you want. Nothing has been saved yet. Add a number and check again." } }); return; }
    if (d.status === "awaiting_confirmation" && d.state?.objective) { await ctx.reload(true); land(d.state, d); return; }
    set({ working: false, phase: "input", notice: { tone: "bad", text: "Ava's answer was not what we expected. Nothing was started." } });
  }

  async function confirm() {
    const a = ag();
    if (a.phase !== "review" || a.working || !a.state?.objective) return;       // a second press while it is working, or after it is done, does nothing
    set({ working: true, phase: "confirming", notice: null });
    const res = await call({ action: "confirm", objective_id: a.state.objective.id, revision: a.state.objective.revision });
    const d = res.data ?? {};
    if (res.status === 422 && d.status === "outside_target_definition" && d.state?.objective) { set({ working: false, phase: "review", state: d.state, notice: { tone: "bad", text: "Not confirmed. Nothing was started." } }); return; }
    if (res.ok && isConfirmed(d.state)) { await ctx.reload(true); set({ working: false, phase: "done", state: d.state, notice: null }); return; }
    if (res.status === 409 && d.error === "stale_revision") { const g = await call({ action: "get", objective_id: a.state.objective.id }); if (g.ok && g.data?.state) { land(g.data.state, g.data); set({ notice: { tone: "warn", text: refusalText(res) } }); return; } }
    set({ working: false, phase: "review", notice: { tone: "bad", text: refusalText(res, { localHint: localHint() }) } });
  }

  /** Cancel drops the proposal. keepText = "Change my words": come back to the typing box with the same words. */
  async function cancel(keepText) {
    const a = ag();
    if (a.working || !a.state?.objective) return;
    set({ working: true });
    const res = await call({ action: "cancel", objective_id: a.state.objective.id });
    if (!res.ok) { set({ working: false, notice: { tone: "bad", text: refusalText(res, { localHint: localHint() }) } }); return; }
    await ctx.reload(true);
    app.addGoal = { ...fresh(), text: keepText ? a.text || a.state.objective.source_goal_text || "" : "", notice: keepText ? null : { tone: "neutral", text: "Cancelled. Nothing was started." } };
    ctx.render();
  }

  // ---- drawing ------------------------------------------------------------------------------------------------------------------------------
  const note = (n) => (n ? h("div", { class: `notice ${n.tone}`, role: "status", text: n.text }) : null);

  function inputCard() {
    const a = ag(), busy = a.working;
    const box = h("textarea", { id: "goal-text", rows: "3", maxlength: String(MAX_GOAL_CHARS), placeholder: "For example: Find 100 security companies in Nigeria", disabled: busy, "aria-describedby": "goal-help", oninput: (e) => { a.text = e.target.value; } });
    box.value = a.text;
    return h("div", { class: "card" },
      h("label", { class: "field", for: "goal-text", text: "Tell Ava what you want, in plain words" }), box,
      h("p", { id: "goal-help", class: "muted small", text: "Say how many companies, what kind, and where. Nothing starts until you confirm." }),
      h("div", { class: "chips" }, EXAMPLES.map((x) => h("button", { type: "button", disabled: busy, onclick: () => { a.text = x; box.value = x; box.focus(); } }, x))),
      note(a.notice),
      h("button", { class: "btn primary block bigbtn", type: "button", disabled: busy, onclick: check }, icon("check", 20), busy ? "Reading your goal…" : "Check my goal"));
  }

  function reviewCard() {
    const a = ag(), st = a.state, u = understood(st), fit = fitLines(st);
    const blocked = u.missing.length > 0 || fit.compatible === false;
    const confirming = a.phase === "confirming";
    return h("div", {},
      h("div", { class: "card" },
        h("h3", { text: "Here is what Ava understood" }),
        h("p", { class: "muted small", text: `Your words: “${String(st.objective.source_goal_text ?? "").slice(0, 300)}”` }),
        h("dl", { class: "kv" }, u.rows.map((r) => [h("dt", { text: r.label }), h("dd", {}, r.value, r.guessed ? h("span", { class: "badge warn guess", text: "Ava guessed this – please check" }) : null)])),
        u.anyGuessed ? h("div", { class: "notice warn", text: "Ava guessed some of this. Check the marked lines before you confirm. When you confirm, they become your goal." }) : null,
        u.notes.length ? h("div", { class: "card inner" }, h("strong", { text: "Notes from Ava" }), h("ul", { class: "plain" }, u.notes.map((n) => h("li", { text: n })))) : null,
        u.missing.length ? h("div", { class: "notice warn", text: "Ava still needs to know the kind of company or the place. Change your words and check again." }) : null,
        fit.compatible === true ? h("div", { class: "notice", text: fit.lines[0] }) : null,
        fit.compatible === false ? h("div", { class: "notice bad" }, fit.lines.map((l) => h("p", { text: l }))) : null,
        fit.compatible === false && ctx.openTargets ? h("button", { class: "btn ghost block", type: "button", onclick: ctx.openTargets }, "Set who you target") : null,
        note(a.notice)),
      h("div", { class: "card" },
        h("p", { class: "strong", text: "Nothing has started. Ava will only begin once you confirm and the goal is ready." }),
        h("button", { class: "btn primary block bigbtn", type: "button", disabled: blocked || a.working, onclick: confirm }, icon("check", 20), confirming ? "Confirming…" : "Confirm goal"),
        h("button", { class: "btn ghost block", type: "button", disabled: a.working, onclick: () => cancel(false) }, "Cancel goal"),
        h("button", { class: "textbtn", type: "button", disabled: a.working, onclick: () => cancel(true) }, "Change my words"),
        h("p", { class: "muted small", text: "If you leave this page now, the goal stays in your Goals list as “Waiting for your OK”, and you can come back to it." })));
  }

  function doneCard() {
    const a = ag(), st = a.state, b = blockedLines(st);
    return h("div", { class: "card" },
      h("div", { class: "notice", role: "status", text: "Goal confirmed. It is now in your Goals list." }),
      h("p", { class: "strong", text: `Find ${st.objective.quantity} companies` }),
      b.length ? h("div", { class: "notice warn" }, h("p", { text: "Ava still needs this before she can start. Nothing will begin until it is done:" }), h("ul", { class: "plain" }, b.map((x) => h("li", { text: x })))) : null,
      h("button", { class: "btn primary block bigbtn", type: "button", onclick: () => ctx.go("goals", st.objective.id) }, "See my goal"),
      h("button", { class: "btn ghost block", type: "button", onclick: open }, "Add another goal"));
  }

  function render() {
    const a = ag() ?? (app.addGoal = fresh());
    return [
      h("button", { class: "back always", type: "button", onclick: () => ctx.go("goals") }, icon("back", 18), "Goals"),
      h("h1", { class: "page-title", text: "Add a goal" }),
      a.phase === "loading" ? h("p", { class: "empty", text: "Loading…" }) : null,
      a.phase === "done" ? doneCard() : a.phase === "review" || a.phase === "confirming" ? reviewCard() : a.phase === "loading" ? null : inputCard(),
    ];
  }

  return { open, review, render };
}
