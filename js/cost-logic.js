// Plain-language pieces for "What things cost" and the usage line on Home. Pure functions (no page, no network).
// The platform keeps the price list (owner-only to change) and works out every cost itself; this file only words things and builds the one request.
import { PRICE_LINES } from "./config.js";

const num = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);

/** The price the owner typed (dollars, for the line's own unit), or null if it is not a sensible non-negative number. At most 6 decimal places. */
export function parsePrice(text) {
  const t = String(text ?? "").trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d{1,9}(\.\d{1,6})?$/.test(t)) return null;
  return Number(t);
}

/** What the platform stores: dollars per ONE unit (for example per single token), at most 10 decimal places. */
export const perUnit = (display, line) => Number((display / line.scale).toFixed(10));
export const toDisplay = (unitPrice, line) => { const n = num(unitPrice); return Number.isFinite(n) ? Number((n * line.scale).toFixed(6)) : null; };
export const money = (n) => (n === 0 ? "$0.00" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);

/** Each line with the price the platform holds for it today (or null = not set yet). */
export function lineStates(priceRows, lines = PRICE_LINES) {
  const rows = Array.isArray(priceRows) ? priceRows : [];
  return lines.map((line) => {
    const row = rows.find((r) => r && r.provider_key === line.provider && r.item_key === line.item && r.unit_type === line.unit && (r.effective_to ?? null) === null) ?? null;
    return { line, current: row ? toDisplay(row.unit_price, line) : null, since: row?.effective_from ?? null };
  });
}

/** The one request the screen sends (the existing owner-only price function). */
export function rpcArgs(orgId, line, display, now = new Date()) {
  return {
    p_org_id: orgId, p_provider_key: line.provider, p_item_key: line.item, p_unit_type: line.unit,
    p_unit_price: perUnit(display, line), p_currency: "USD", p_effective_from: null,
    p_notes: `Entered by the owner on ${now.toISOString().slice(0, 10)} (${line.label}).`.slice(0, 500),
  };
}

export function refusalText(res) {
  const s = res?.status, m = String(res?.data?.message ?? "");
  if (s === 0) return "Could not reach the project. Check your connection and try again. Nothing was saved.";
  if (s === 401) return "Your sign-in ended. Please sign in again.";
  if (/only an org owner/i.test(m) || s === 403) return "Only an owner of this company can change prices.";
  if (/earlier|latest_start|effective/i.test(m)) return "A price already starts later than now for this item, so this one could not be added.";
  return "Something went wrong, so nothing was saved. Please try again.";
}

export const monthStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * "This month" lines from public.usage_summary rows. Costs come only from the platform (cost_micros); an item with no price set is said to be unpriced, never guessed.
 * Source-neutral: it names no data source.
 */
export function usageLines(rows) {
  const r = Array.isArray(rows) ? rows : [];
  const out = [];
  const conn = r.filter((x) => x.kind === "connector");
  const llm = r.filter((x) => x.kind === "llm");
  const sum = (a, k) => a.reduce((n, x) => n + (Number(x[k]) || 0), 0);
  const costOf = (a) => {
    const priced = a.filter((x) => x.cost_basis !== "unknown" && x.cost_micros !== null && x.cost_micros !== undefined);
    const unpricedEvents = a.filter((x) => x.cost_basis === "unknown").reduce((n, x) => n + (Number(x.events) || 0), 0);
    return { dollars: priced.reduce((n, x) => n + Number(x.cost_micros) / 1e6, 0), hasPriced: priced.length > 0, unpricedEvents };
  };
  const tail = (c) => (c.unpricedEvents > 0 ? (c.hasPriced ? `, ${money(c.dollars)} so far; ${plural(c.unpricedEvents, "call has", "calls have")} no price set` : " (price not set yet)") : c.hasPriced ? `, cost ${money(c.dollars)}` : "");
  if (conn.length) {
    const c = costOf(conn), n = sum(conn, "record_count");
    out.push(`${plural(n, "company", "companies")} from data services${tail(c)}`);
  }
  if (llm.length) {
    const c = costOf(llm), calls = sum(llm, "call_count");
    out.push(`AI model: ${plural(calls, "call", "calls")}, ${(sum(llm, "input_tokens") + sum(llm, "output_tokens")).toLocaleString("en-US")} small pieces of text read and written${tail(c)}`);
  }
  return out;
}
