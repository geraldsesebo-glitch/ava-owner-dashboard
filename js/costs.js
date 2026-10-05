// The "What things cost" screen. It uses ONLY the existing owner-only price function (public.set_price_book_entry). The platform checks the owner, keeps the old price with its dates,
// and works out every cost itself from this list; the dashboard never works out or stores a cost. Nothing is saved until the owner presses "Yes, save this price".
import { lineStates, parsePrice, rpcArgs, refusalText, money } from "./cost-logic.js";

export function createCosts(ctx) {
  const { h, icon, state: app } = ctx;
  const st = () => app.costs;
  const set = (patch) => { Object.assign(st(), patch); ctx.render(); };
  const fresh = () => ({ drafts: {}, asking: null, working: false, notice: null });
  const companyName = () => app.companies.find((c) => c.id === app.orgId)?.name ?? "this company";

  function open() { app.costs = fresh(); ctx.go("settings", "costs"); }

  function ask(state) {
    const text = st().drafts[state.line.id] ?? "";
    const value = parsePrice(text);
    if (value === null) { set({ notice: { tone: "bad", text: text.trim() === "" ? "Type a price first, for example 0 or 0.10." : `“${text.slice(0, 20)}” is not a price I can use. Type a number such as 0 or 0.10 (no letters).` }, asking: null }); return; }
    set({ asking: { id: state.line.id, value }, notice: null });
  }

  async function save() {
    const s = st(), a = s.asking;
    if (!a || s.working) return;
    const state = lineStates(app.data.prices).find((x) => x.line.id === a.id);
    if (!state) return;
    set({ working: true, notice: null });
    const res = await ctx.rpc("set_price_book_entry", rpcArgs(app.orgId, state.line, a.value));
    if (!res.ok) { set({ working: false, asking: null, notice: { tone: "bad", text: refusalText(res) } }); return; }
    await ctx.reload(true);
    const drafts = { ...st().drafts }; delete drafts[a.id];
    set({ working: false, asking: null, drafts, notice: { tone: "good", text: `Saved: ${state.line.label} is now ${money(a.value)} per ${state.line.per}. It applies to searches and AI calls from now on; earlier ones keep “price not set”.` } });
  }

  const note = (n) => (n ? h("div", { class: `notice ${n.tone}`, role: "status", text: n.text }) : null);

  function lineCard(state) {
    const { line } = state, s = st(), busy = s.working;
    const asking = s.asking && s.asking.id === line.id;
    return h("div", { class: "card" },
      h("div", { class: "row2" }, h("strong", { text: line.label }), h("span", { class: `badge ${state.current === null ? "warn" : "good"}`, text: state.current === null ? "Price not set" : `${money(state.current)} per ${line.per}` })),
      h("p", { class: "muted small", text: line.hint }),
      h("label", { class: "field" }, `Price in US dollars, per ${line.per}`,
        h("input", { type: "text", inputmode: "decimal", class: "pick", autocomplete: "off", placeholder: line.suggest ? `for example ${line.suggest}` : "for example 0", value: s.drafts[line.id] ?? "", disabled: busy,
          oninput: (e) => { s.drafts[line.id] = e.target.value; } })),
      asking
        ? h("div", { class: "card ask inner", role: "alertdialog" },
          h("p", { text: `Save ${money(s.asking.value)} per ${line.per} for “${line.label}” in ${companyName()}?` }),
          h("button", { class: "btn primary", type: "button", disabled: busy, onclick: save }, icon("check", 16), busy ? "Saving…" : "Yes, save this price"),
          h("button", { class: "btn", type: "button", disabled: busy, onclick: () => set({ asking: null }) }, "Not now"))
        : h("button", { class: "btn", type: "button", disabled: busy, onclick: () => ask(state) }, state.current === null ? "Set this price" : "Change this price"));
  }

  function render() {
    const s = st() ?? (app.costs = fresh());
    const states = lineStates(app.data?.prices);
    return [
      h("h2", { class: "label13", text: "Prices" }),
      h("p", { class: "mainnote", text: `The prices Ava uses to show what ${companyName()} spends. Only you, the owner, can change them. Nothing here is guessed: until a price is set, the cost shows as “price not set”.` }),
      note(s.notice),
      states.map(lineCard),
      h("p", { class: "muted small", text: "Every price you save is kept with the date it started. Changing a price never rewrites earlier costs." }),
    ];
  }

  return { open, render };
}
