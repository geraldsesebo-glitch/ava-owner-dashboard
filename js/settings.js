// Settings: one page with a short list on the left. Only settings that really work are shown as working; anything not built is marked "Soon" instead of faked.
//   General (company name, branch label, appearance, text size, density: the last three are kept in THIS browser only)
//   What Ava may do (switches; each one opens the owner's confirm card first), Usage and costs (this month + the price editor),
//   Team / Billing (Soon), Privacy and security (what is true today), Advanced (Provider test, Refresh).
import { createPermissions } from "./permissions.js";
import { createCosts } from "./costs.js";
import { createProviderTest } from "./providertest.js";
import { usageLines } from "./cost-logic.js";
import { stateBlock } from "./ui.js";

const SUBS = [
  { key: "general", label: "General", icon: "sliders" },
  { key: "permissions", label: "What Ava may do", icon: "shield" },
  { key: "costs", label: "Usage and costs", icon: "wallet" },
  { key: "team", label: "Team", icon: "user", soon: true },
  { key: "billing", label: "Billing", icon: "card", soon: true },
  { key: "privacy", label: "Privacy and security", icon: "lock" },
  { key: "advanced", label: "Advanced", icon: "flask" },
];

export function createSettings(ctx) {
  const { h, icon, state: app } = ctx;
  const permissions = createPermissions(ctx); ctx.permissions = permissions;
  const costs = createCosts(ctx);
  const providerTest = createProviderTest({ ...ctx, call: ctx.call });
  ctx.openPermissions = () => ctx.go("settings", "permissions");
  const desktop = () => window.matchMedia("(min-width: 900px)").matches;
  /** On a computer the first item is open; on a phone the list comes first. */
  const sub = () => (SUBS.some((s) => s.key === app.nav.sub) || app.nav.sub === "providertest" ? app.nav.sub : desktop() ? "general" : null);
  const orgName = () => app.companies.find((c) => c.id === app.orgId)?.name ?? "";

  function panel() {
    const cur = sub() === "providertest" ? "advanced" : sub();
    return [
      h("div", { class: "panel-h", text: "Settings" }),
      h("div", { class: "panel-body" }, SUBS.map((s) => h("button", { class: "pitem", type: "button", "aria-current": String(cur === s.key), onclick: () => ctx.go("settings", s.key) },
        h("span", { class: "t", text: s.label }), s.soon ? h("span", { class: "tag soon", text: "Soon" }) : null))),
      h("div", { class: "pfoot" }, h("button", { class: "plink", type: "button", onclick: ctx.signOutNow }, icon("logout", 16), "Sign out")),
    ];
  }

  const seg = (label, value, options, onPick) => h("div", { class: "srow" }, h("div", { class: "l" }, h("div", { class: "t", text: label })),
    h("div", { class: "r" }, h("div", { class: "seg", role: "group", "aria-label": label }, options.map(([v, t]) => h("button", { type: "button", "aria-pressed": String(value === v), onclick: () => onPick(v) }, t)))));

  function general() {
    const p = app.prefs;
    const themeBtn = (v, label) => h("button", { class: `theme-card ${v}`, type: "button", "aria-pressed": String(p.theme === v), onclick: () => ctx.setPref("theme", v) },
      h("span", { class: "mini", "aria-hidden": "true" }, h("i", { class: "m-strip" }), h("i", { class: "m-panel" }), h("i", { class: "m-line a" }), h("i", { class: "m-line b" }), h("i", { class: "m-btn" })), h("span", { class: "tl", text: label }));
    return [
      h("div", { class: "page-h" }, h("h1", { text: "General" })),
      h("div", { class: "card" },
        h("div", { class: "srow" }, h("div", { class: "l" }, h("div", { class: "t", text: "Company name" }), h("div", { class: "s", text: "To change the name, use Company information under Company." })), h("div", { class: "r" }, h("strong", { text: orgName() }))),
        h("div", { class: "srow" }, h("div", { class: "l" }, h("div", { class: "t", text: "Branch" }), h("div", { class: "s", text: "Branches are coming later. Everything here belongs to the Main branch." })), h("div", { class: "r" }, h("span", { class: "tag", text: "Main branch" })))),
      h("h2", { class: "label13", text: "Appearance" }),
      h("div", { class: "card" },
        h("div", { class: "themes", role: "group", "aria-label": "Appearance" }, themeBtn("auto", "Auto"), themeBtn("light", "Light"), themeBtn("dark", "Dark")),
        h("p", { class: "muted small", text: "Auto follows your device. These three choices are remembered in this browser only." }),
        seg("Text size", p.size, [["small", "Small"], ["default", "Default"], ["large", "Large"]], (v) => ctx.setPref("size", v)),
        seg("Row spacing", p.density, [["comfortable", "Comfortable"], ["compact", "Compact"]], (v) => ctx.setPref("density", v))),
    ];
  }

  function usage() {
    const lines = usageLines(app.data.usage);
    return [
      h("div", { class: "page-h" }, h("h1", { text: "Usage and costs" })),
      h("div", { class: "card" }, h("h3", { text: "This month so far" }),
        lines.length ? h("ul", { class: "plain" }, lines.map((u) => h("li", { text: u }))) : h("p", { class: "muted", text: "Nothing spent yet." }),
        h("p", { class: "muted small", text: "Worked out by the platform from its own records and your prices below. This page never guesses a cost." })),
      costs.render(),
    ];
  }

  function soon(title, text) {
    return [h("div", { class: "page-h" }, h("h1", { text: title }), h("span", { class: "tag soon", text: "Soon" })), stateBlock({ icon: "clock", title: `${title} is not built yet`, text, inline: true })];
  }

  function privacy() {
    const li = (t) => h("li", { text: t });
    return [
      h("div", { class: "page-h" }, h("h1", { text: "Privacy and security" })),
      h("div", { class: "card" }, h("h3", { text: "What is true today" }),
        h("ul", { class: "plain" },
          li("Only people who belong to a company can see its information. The database checks this on every request."),
          li("Every message goes only to your own test inbox, with a label saying it is a test. Nobody real is contacted."),
          li("Contact details are never sent to an outside AI model."),
          li("Nothing is sent until you approve the exact text, and a do-not-contact mark can never be undone by an import."),
          li("You can pause Ava at any time from the top of every page. Nothing is deleted when you do."))),
      h("div", { class: "card" }, h("div", { class: "srow" }, h("div", { class: "l" }, h("div", { class: "t", text: "Sign out" }), h("div", { class: "s", text: "Ends your sign-in on this device." })), h("div", { class: "r" }, h("button", { class: "btn", type: "button", onclick: ctx.signOutNow }, icon("logout", 16), "Sign out")))),
      h("div", { class: "card" }, h("div", { class: "srow" }, h("div", { class: "l" }, h("div", { class: "t" }, "Two-step sign-in", h("span", { class: "tag soon", text: "Soon" })), h("div", { class: "s", text: "Not built yet." })))),
    ];
  }

  function advanced() {
    return [
      h("div", { class: "page-h" }, h("h1", { text: "Advanced" })),
      h("div", { class: "card" },
        h("div", { class: "srow" }, h("div", { class: "l" }, h("div", { class: "t", text: "Provider test" }), h("div", { class: "s", text: "One capped test of the company data service: two fixed searches, 3 companies each. Saves nothing." })), h("div", { class: "r" }, h("button", { class: "btn", type: "button", onclick: () => providerTest.open() }, icon("flask", 16), "Open"))),
        h("div", { class: "srow" }, h("div", { class: "l" }, h("div", { class: "t", text: "Refresh" }), h("div", { class: "s", text: "Reads everything again from the platform. This page also refreshes itself every 30 seconds." })), h("div", { class: "r" }, h("button", { class: "btn", type: "button", onclick: () => ctx.refresh() }, icon("refresh", 16), "Refresh now")))),
    ];
  }

  function main() {
    const cur = sub();
    if (cur === null) {   // phone: the list comes first
      return h("div", { class: "page" }, h("div", { class: "page-h" }, h("h1", { text: "Settings" })),
        h("div", { class: "card flush" }, h("div", { class: "rowlist" }, SUBS.map((s) => h("button", { class: "lrow", type: "button", onclick: () => ctx.go("settings", s.key) },
          h("span", { class: "l" }, h("span", { class: "t", text: s.label })), h("span", { class: "r" }, s.soon ? h("span", { class: "tag soon", text: "Soon" }) : null, icon("chevron", 16)))))),
        h("div", { class: "btnrow" }, h("button", { class: "btn", type: "button", onclick: ctx.signOutNow }, icon("logout", 16), "Sign out")));
    }
    const crumb = h("button", { class: "crumb phone-only", type: "button", onclick: () => ctx.go("settings", "list") }, icon("back", 16), "Settings");
    let body;
    if (cur === "general") body = general();
    else if (cur === "permissions") body = permissions.render();
    else if (cur === "costs") body = usage();
    else if (cur === "team") body = soon("Team", "Here you will invite people and choose what each one may do. For now only the owner can use this dashboard.");
    else if (cur === "billing") body = soon("Billing", "Here you will see your plan and invoices. Nothing is billed from this page yet.");
    else if (cur === "privacy") body = privacy();
    else if (cur === "providertest") body = [h("button", { class: "crumb", type: "button", onclick: () => ctx.go("settings", "advanced") }, icon("back", 16), "Advanced"), providerTest.render()];
    else body = advanced();
    return h("div", { class: "page" }, crumb, body);
  }

  return { panel, main };
}
