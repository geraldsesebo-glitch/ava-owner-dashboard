// Activity: what happened, in plain sentences, grouped by day. A switch chooses "What Ava did" (the lines that matter) or "Every step". Repeats are folded into one line that opens.
import { buildActivity, countItems, limitDays } from "./activity-logic.js";
import { timeAgo } from "./text.js";
import { stateBlock, keepFocus } from "./ui.js";

const FIRST = 40, MORE = 40;

export function createActivity(ctx) {
  const { h, icon, state: app, d } = ctx;
  const ui = { q: "", all: false, shown: FIRST, open: new Set() };
  const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  function line(ev, text) {
    return h("li", { class: "aline" }, h("span", { class: "at", title: new Date(ev.created_at).toLocaleString(), text: time(ev.created_at) }), h("span", { class: "tx", text }));
  }

  function main() {
    const events = app.data.audit.map((ev) => ({ ev, s: d.describe(ev) }));
    const days = buildActivity(events, { all: ui.all, q: ui.q }), total = countItems(days), shown = limitDays(days, ui.shown);
    return h("div", { class: "page" },
      h("div", { class: "page-h" }, h("h1", { text: "Activity" }), h("span", { class: "grow" }),
        h("span", { class: "seg", role: "group", "aria-label": "How much to show" },
          h("button", { type: "button", "aria-pressed": String(!ui.all), onclick: () => { ui.all = false; ui.shown = FIRST; ctx.render(); } }, "What Ava did"),
          h("button", { type: "button", "aria-pressed": String(ui.all), onclick: () => { ui.all = true; ui.shown = FIRST; ctx.render(); } }, "Every step"))),
      h("label", { class: "searchbox wideinput" }, icon("search", 16), h("span", { class: "sr-only", text: "Search activity" }),
        h("input", { type: "search", id: "act-q", placeholder: "Search activity", value: ui.q, oninput: (e) => { ui.q = e.target.value; ui.shown = FIRST; keepFocus(() => document.getElementById("main"), "#act-q", ctx.render)(e); } })),
      app.data.audit.length === 0 ? stateBlock({ icon: "activity", title: "Nothing has happened yet", text: "As soon as you or Ava do something, it shows up here.", inline: true })
        : total === 0 ? stateBlock({ icon: "search", title: "Nothing matches", text: ui.q ? "Try different words, or switch to Every step." : "Switch to Every step to see the small steps too.", action: ui.all ? null : { label: "Show every step", onclick: () => { ui.all = true; ctx.render(); } }, inline: true })
          : [shown.map((day) => h("section", { class: "aday" }, h("h2", { class: "label13", text: day.label }),
            h("div", { class: "card flush" }, h("ul", { class: "alist" }, day.items.map((it) => {
              if (it.kind === "line") return line(it.ev, it.text);
              const key = `${day.key}|${it.type}`, open = ui.open.has(key);
              return h("li", { class: "agroup" },
                h("button", { class: "agroup-h", type: "button", "aria-expanded": String(open), onclick: () => { open ? ui.open.delete(key) : ui.open.add(key); ctx.render(); } },
                  h("span", { class: "at", text: time(it.lines[0].ev.created_at) }), h("span", { class: "tx", text: it.text }), h("span", { class: "tag", text: String(it.lines.length) }), icon(open ? "down" : "chevron", 16)),
                open ? h("ul", { class: "alist inner" }, it.lines.slice(0, 50).map((l) => line(l.ev, l.text)), it.lines.length > 50 ? h("li", { class: "aline" }, h("span", { class: "at" }), h("span", { class: "tx muted", text: `…and ${it.lines.length - 50} more.` })) : null) : null);
            }))))),
          total > ui.shown ? h("div", { class: "btnrow" }, h("button", { class: "btn", type: "button", onclick: () => { ui.shown += MORE; ctx.render(); } }, `Show earlier (${total - ui.shown} more)`)) : null,
          h("p", { class: "muted small foot", text: `Showing the most recent ${app.data.audit.length} recorded steps. The newest was ${timeAgo(app.data.audit[0].created_at)}.` })]);
  }

  return { main };
}
