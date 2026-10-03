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
  // The real search runner is NOT switched on yet (no deploy, no source). null = the button stays off for real companies and calls nothing.
  real: null,
};
