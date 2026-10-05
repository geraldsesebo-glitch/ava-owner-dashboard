// Connectors: cards in four groups (Data sources, Channels, Automation, AI), each with a status tag and one button.
// A tag is claimed only from what the platform has recorded (a real search that succeeded, a successful AI call, a successful test send); with no record the tag says what is not yet proven. Anything not built says "Soon".
// The Connect dialog is VISUAL ONLY: it shows what Ava would be allowed to do and says to add the key in Supabase secrets for now. This page never asks for, stores or sends a key.
import { searchStatus, aiStatus, emailStatus } from "./connectors-logic.js";

export function createConnectors(ctx) {
  const { h, icon, state: app, d } = ctx;

  /** Every card, with a tag claimed only from what the platform has recorded (see connectors-logic.js). Anything not built says Soon. */
  function cards() {
    const data = app.data, kind = d.kind();
    const search = searchStatus(data.runs), ai = aiStatus({ pipeline: data.pipeline, assessments: data.assessments, usage: data.usage }), email = emailStatus({ records: data.records, drafts: data.drafts });
    const searchName = search.provider ? `Company search: ${search.provider}` : "Company search";
    return [
      { group: "Data sources", items: [
        { id: "search", icon: "db", name: searchName, text: "Finds new companies that fit a goal you have confirmed.", status: search.status,
          why: search.status === "Connected" ? "A real search has succeeded and handed back companies." : search.status === "Test mode" ? "Only the practice source with made-up companies has been used." : "No search has been recorded yet.",
          allow: ["Search for new companies for goals you have confirmed", "Read the names, places and websites the service returns"], secret: "the data service key", note: kind === "pretend" ? "This pretend company uses a practice source with made-up companies." : null },
        { id: "web", icon: "globe", name: "Company websites", text: "Ava reads a company’s own public website to judge how well it fits.", status: "Available", allow: ["Read up to three pages of a company’s OWN website", "Quote the exact words she relied on, with a link"], secret: null, note: "Nothing to connect: this uses public pages only. It needs the AI model below." },
        { id: "list", icon: "upload", name: "Your own list", text: "Companies and contacts you add yourself.", status: "Available", allow: ["Add the companies and contacts you paste or upload", "Never clear a do-not-contact mark"], secret: null, note: "Use Import your list under Companies.", go: ["companies", "import"] },
        { id: "maps", icon: "globe", name: "Map listings", text: "Find companies from map listings.", status: "Soon" },
      ] },
      { group: "Channels", items: [
        { id: "email", icon: "mail", name: "Email", text: "Sends the messages you have approved.", status: email.status,
          why: email.status === "Test mode" ? "A test message has been sent successfully. Test mode is set by the platform and cannot be turned off from this page." : "No successful test send is recorded yet.",
          allow: ["Send a message only after you approved its exact text", "In test mode, deliver only to your own test inbox, labelled as a test"], secret: "RESEND_API_KEY, EMAIL_FROM and TEST_INBOX_ADDRESS" },
        { id: "whatsapp", icon: "mail", name: "WhatsApp", text: "Message companies on WhatsApp.", status: "Soon" },
        { id: "sms", icon: "mail", name: "SMS", text: "Send text messages.", status: "Soon" },
        { id: "phone", icon: "mail", name: "Phone calls", text: "Make and log phone calls.", status: "Soon" },
      ] },
      { group: "Automation", items: [
        { id: "n8n", icon: "flow", name: "n8n", text: "Run Ava’s steps on a schedule or from other tools.", status: "Soon" },
      ] },
      { group: "AI", items: [
        { id: "ai", icon: "bot", name: "AI model", text: "A small, low-cost model that reads websites and sorts replies.", status: ai.status,
          why: ai.status === "Connected" ? "A successful AI call is recorded." : "No successful AI call is recorded yet.",
          allow: ["Read a company’s public website and write up to three reasons, each with an exact quote", "Sort a reply into a kind (contact details are removed first)", "Stay within $0.02 and 2 calls per company per month"], secret: "ANTHROPIC_API_KEY", note: "The AI prices are not secrets: you set them under Settings, Usage and costs." },
      ] },
    ];
  }

  const tone = { Connected: "good", "Test mode": "warn", "Key needed": "warn", Available: "", "Not connected": "", Soon: "soon" };

  function connectSheet(c) {
    return (close) => [
      h("h2", { text: c.status === "Connected" || c.status === "Test mode" ? c.name : `Connect ${c.name}` }),
      h("div", { class: "row2" }, h("span", { class: `tag ${tone[c.status]}`, text: c.status }), h("span", { class: "tag", text: "Nothing is stored on this page" })),
      c.why ? h("p", { text: c.why }) : null,
      c.note ? h("p", { class: "muted", text: c.note }) : null,
      c.allow ? [h("h3", { class: "label13", text: "What Ava would be allowed to do" }), h("ul", { class: "plain" }, c.allow.map((t) => h("li", { text: t })))] : null,
      c.secret ? [h("h3", { class: "label13", text: "How to connect, for now" }), h("p", { text: `Add ${c.secret} in your Supabase secrets. This page never asks for a key, never stores one, and never shows one.` })] : null,
      h("div", { class: "btnrow" }, c.go ? h("button", { class: "btn", type: "button", onclick: () => { close(); ctx.go(...c.go); } }, "Open") : null, h("button", { class: "btn", type: "button", onclick: close }, "Close"))];
  }

  function card(c) {
    const soon = c.status === "Soon", has = c.status === "Connected" || c.status === "Test mode" || !c.secret;
    return h("div", { class: "ccard", id: `conn-${c.id}` },
      h("div", { class: "ctop" }, h("span", { class: "cicon" }, icon(c.icon, 18)), h("span", { class: `tag ${tone[c.status]}`, text: c.status })),
      h("h3", { text: c.name }), h("p", { class: "muted", text: c.text }),
      h("button", { class: "btn sm", type: "button", disabled: soon, onclick: () => ctx.openSheet({ kind: "custom", render: connectSheet(c), wide: true }) }, soon ? "Soon" : has ? "Open" : "Connect"));
  }

  function panel() {
    return [h("div", { class: "panel-h", text: "Connectors" }),
      h("div", { class: "panel-body" }, cards().map((g) => h("button", { class: "pitem", type: "button", onclick: () => document.getElementById(`grp-${g.group.replace(/\W/g, "")}`)?.scrollIntoView({ behavior: "smooth", block: "start" }) },
        h("span", { class: "t", text: g.group }), h("span", { class: "n", text: String(g.items.length) }))))];
  }

  function main() {
    return h("div", { class: "page" },
      h("div", { class: "page-h" }, h("h1", { text: "Connectors" })),
      h("p", { class: "mainnote", text: "The services Ava can use. A tag shows what is true today. Connecting is not done on this page yet: the Connect window explains what to add in your Supabase secrets." }),
      cards().map((g) => [h("h2", { class: "label13", id: `grp-${g.group.replace(/\W/g, "")}`, text: g.group }), h("div", { class: "cgrid" }, g.items.map(card))]));
  }

  return { panel, main };
}
