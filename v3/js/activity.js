// STUB (replaced later in this build)
import { stateBlock } from "./ui.js";
export function createActivity(ctx) {
  return { panel: () => null, main: () => ctx.h("div", { class: "page" }, stateBlock({ icon: "info", title: "Coming next", text: "This screen is being built." })) };
}
