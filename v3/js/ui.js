// Small building blocks shared by every screen. Everything from the database is put on the page as plain text only (never as markup, never as a link).
import { icon } from "./icons.js";

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const kid of kids.flat(3)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(typeof kid === "object" ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
export const fill = (el, ...kids) => el.replaceChildren(...kids.flat(3).filter((k) => k !== null && k !== undefined && k !== false));
export const clip = (s, n = 120) => (typeof s === "string" ? (s.length > n ? s.slice(0, n - 1) + "…" : s) : "");
export const word = (n, one, many) => (n === 1 ? one : many);
/** The page forbids inline style attributes (safety rule), so the bar fill is set through the browser's style object. */
export function bar(pct) {
  const s = document.createElement("span");
  s.style.transform = `scaleX(${Math.max(0, Math.min(1, pct))})`;
  return h("div", { class: "bar", role: "img", "aria-label": `${Math.round(Math.max(0, Math.min(1, pct)) * 100)} percent` }, s);
}

/** A small tag. tone: "" | good | warn | bad | soon */
export const tag = (text, tone = "") => h("span", { class: `tag ${tone}`.trim(), text });

/** One sentence and one next step. tone: "" (calm) | warn (amber, needs attention) | bad (red, cannot reach). */
export function stateBlock({ icon: ic = "info", tone = "", title, text, action = null, inline = false }) {
  return h("div", { class: `state ${tone}${inline ? " inline" : ""}`.trim(), role: tone === "bad" ? "alert" : "status" },
    icon(ic, 28), title ? h("h3", { text: title }) : null, h("p", { text }),
    action ? h("button", { class: `btn${action.primary ? " primary" : ""}`, type: "button", onclick: action.onclick }, action.icon ? icon(action.icon, 16) : null, action.label) : null);
}

/** Paging for long lists: never one endless list. */
export function pager({ page, size, total, onPage, noun = "companies" }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : page * size + 1, to = Math.min(total, (page + 1) * size);
  return h("div", { class: "pager" },
    h("span", { text: total === 0 ? `No ${noun}` : `${from}–${to} of ${total}` }),
    pages > 1 ? h("div", { class: "btnrow" },
      h("button", { class: "btn sm", type: "button", disabled: page <= 0, onclick: () => onPage(page - 1), "aria-label": "Previous page" }, icon("back", 16), "Previous"),
      h("span", { text: `Page ${page + 1} of ${pages}` }),
      h("button", { class: "btn sm", type: "button", disabled: page >= pages - 1, onclick: () => onPage(page + 1), "aria-label": "Next page" }, "Next", icon("chevron", 16))) : null);
}

/** A switch. Pressing it only calls onToggle; the caller decides what that means (the owner's switches always open a confirm card first). */
export function toggle({ on, label, disabled = false, onToggle }) {
  return h("button", { class: "switch", type: "button", role: "switch", "aria-checked": String(!!on), "aria-label": label, disabled, onclick: () => onToggle(!on) });
}

/** Keeps focus and caret in a search box that is redrawn with the page. */
export function keepFocus(root, selector, render) {
  return (e) => {
    const pos = e.target.selectionStart;
    render();
    const again = root().querySelector(selector);
    if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch { /* not a text box */ } }
  };
}
