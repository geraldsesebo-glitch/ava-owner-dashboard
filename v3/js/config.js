// Browser-safe configuration ONLY. This file is public.
//
// Allowed here: the Supabase project address and the public (anon) key. Nothing else may ever be put in this folder:
// no service key, no provider key, no password, no token, no email address. The page signs the owner in with their own
// password and every read or action is then checked by the database against that person's own membership.
export const SUPABASE_URL = "https://mlkknzwrzjqxydgsbqtu.supabase.co";
export const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sa2tuendyempxeHlkZ3NicXR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyODEzNzksImV4cCI6MjEwMjg1NzM3OX0.EKkai3aWhNr0YDENjeHq0XXBOSExVshBKcDH3ukhiM0";

/** Where the "Run a search now" button sends the request, by kind of company. A company whose name starts with DEMO is the pretend company. */
export const HELPERS = {
  // The pretend helper. It serves only a company named DEMO and only the pretend source (refused by the helper itself otherwise).
  pretend: "discovery-runner-mock",
  // The real search runner. It names NO data source: which source a company uses is decided only by the platform's routing table (a company with no routing row is refused).
  real: "discovery-runner",
};

/**
 * During the first real runs only SMALL goals can be searched from this page (a goal asking for more than this many companies is shown but its search button stays off).
 * This is a convenience guard on top of the real protection, which lives in the search source's own code (a hard cap per search).
 */
export const REAL_RUN_MAX_GOAL = 15;

/** The cheap AI model used by default (the platform's routing policy names the same one). Its prices are entered by the owner on the "What things cost" screen. */
export const AI_MODEL = "claude-haiku-4-5-20251001";

/**
 * The things Ava can spend money on, shown on "What things cost". This is DATA (a provider's key and what it charges per), so adding a source later is one more entry here.
 * `scale` = how many units the owner's number covers (1 company, or 1,000,000 tokens). `suggest` is only a hint shown beside the box; nothing is saved until the owner confirms.
 */
export const PRICE_LINES = [
  { id: "records", label: "A company record from the data service", provider: "pdl-company-search", item: "discovery_research.search_companies", unit: "record", per: "company", scale: 1, hint: "What the data service charges for each company it hands back. On the free plan this is $0.00." },
  { id: "ai_in", label: "AI model: what it reads", provider: "anthropic", item: AI_MODEL, unit: "input_token", per: "1 million tokens", scale: 1000000, suggest: "1.00", hint: "Tokens are small pieces of text. The model maker's published price for this small model is about $1.00 per million (please check it on their site)." },
  { id: "ai_out", label: "AI model: what it writes", provider: "anthropic", item: AI_MODEL, unit: "output_token", per: "1 million tokens", scale: 1000000, suggest: "5.00", hint: "The published price is about $5.00 per million (please check it on their site)." },
];
