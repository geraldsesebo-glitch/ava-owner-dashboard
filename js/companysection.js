// Company: Company information (what we sell and who we want, with a summary of who you target) and Who you target (the existing screens). Rules is a "Soon" item.
import { createCompanyInfo } from "./companyinfo.js";
import { createTargets } from "./targets.js";
import { stateBlock } from "./ui.js";

const SUBS = [{ key: "info", label: "Company information" }, { key: "targets", label: "Who you target" }, { key: "rules", label: "Rules", soon: true }];

export function createCompanySection(ctx) {
  const { h, state: app } = ctx;
  const info = createCompanyInfo(ctx), targets = createTargets(ctx);
  ctx.targetsScreen = targets;
  ctx.openTargets = () => ctx.go("company", "targets");
  const sub = () => (SUBS.some((s) => s.key === app.nav.sub) ? app.nav.sub : "info");

  function panel() {
    const cur = sub();
    return [
      h("div", { class: "panel-h", text: "Company" }),
      h("div", { class: "panel-body" }, SUBS.map((s) => h("button", { class: "pitem", type: "button", "aria-current": String(cur === s.key), onclick: () => ctx.go("company", s.key) },
        h("span", { class: "t", text: s.label }), s.soon ? h("span", { class: "tag soon", text: "Soon" }) : null))),
    ];
  }

  function main() {
    const cur = sub();
    const chips = h("div", { class: "chiprow phone-only subnav" }, SUBS.map((s) => h("button", { class: "chip", type: "button", "aria-pressed": String(cur === s.key), onclick: () => ctx.go("company", s.key) }, s.label, s.soon ? " (Soon)" : "")));
    let body;
    if (cur === "info") body = info.render();
    else if (cur === "targets") body = targets.render();
    else body = [h("div", { class: "page-h" }, h("h1", { text: "Rules" }), h("span", { class: "tag soon", text: "Soon" })), stateBlock({ icon: "shield", title: "Rules are not built yet", text: "Here you will say which companies Ava must never contact or search for. Until then, you can mark a company do-not-contact from its details.", inline: true })];
    return [chips, h("div", { class: "page" }, body)];
  }

  return { panel, main };
}
