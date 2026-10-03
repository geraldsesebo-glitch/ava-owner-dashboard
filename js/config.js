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
