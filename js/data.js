// Reads. Every call is made with the signed-in person's own session, so the database only ever returns rows of companies they belong to.
import { select } from "./api.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function loadCompanies() {
  return select("organizations?select=id,name,status,status_changed_at&order=created_at.asc");
}

/** Everything one company's screens need. ok=false if ANY read failed (the page then says so instead of showing half a picture). */
export async function loadCompany(orgId) {
  if (!UUID.test(orgId)) return { ok: false };
  const o = `org_id=eq.${orgId}`;
  const [emps, auths, goals, runs, cands, jobs, audit] = await Promise.all([
    select(`ai_employees?${o}&select=id,name,role_key,status&order=created_at.asc`),
    select(`ai_employee_authorities?${o}&select=ai_employee_id,capability_key,enabled,requires_approval`),
    select(`owner_objectives?${o}&select=id,source_goal_text,quantity,status,criteria,created_at,confirmed_at&order=created_at.desc&limit=50`),
    select(`discovery_runs?${o}&select=id,owner_objective_id,status,requested,discovered,already_known,duplicate_in_run,rejected_outside,insufficient_evidence,malformed,provider_key,termination_reason,created_at,updated_at,finished_at&order=created_at.desc&limit=50`),
    select(`discovery_candidates?${o}&select=id,run_id,disposition,reason,identity_tier,candidate,criteria_match,created_at&order=created_at.desc&limit=400`),
    select(`work_items?${o}&select=id,status,updated_at&order=updated_at.desc&limit=30`),
    select(`audit_log?${o}&select=id,event_type,decision,created_at,detail&order=created_at.desc&limit=200`),
  ]);
  const all = [emps, auths, goals, runs, cands, jobs, audit];
  if (all.some((r) => !r.ok || !Array.isArray(r.data))) return { ok: false, status: all.find((r) => !r.ok)?.status };
  return {
    ok: true,
    employees: emps.data, authorities: auths.data, goals: goals.data, runs: runs.data, candidates: cands.data, jobs: jobs.data, audit: audit.data,
    loadedAt: Date.now(),
  };
}

/** What the company has set as its targets today (confirmed versions only). Not fatal: if it cannot be read, the screens say so. */
export async function loadTargets(orgId) {
  if (!UUID.test(orgId)) return { ok: false };
  const k = await select(`organizational_knowledge?org_id=eq.${orgId}&slot_key=in.(target_industries,target_geographies)&select=id,slot_key,status`);
  if (!k.ok || !Array.isArray(k.data)) return { ok: false };
  let versions = [];
  const ids = k.data.map((x) => x.id).filter((x) => UUID.test(x));
  if (ids.length) {
    const v = await select(`organizational_knowledge_versions?knowledge_id=in.(${ids.join(",")})&status=eq.confirmed&select=knowledge_id,version_no,value,confirmed_at`);
    if (!v.ok || !Array.isArray(v.data)) return { ok: false };
    versions = v.data;
  }
  const pick = (slot) => {
    const row = k.data.find((x) => x.slot_key === slot && x.status !== "retired");
    const ver = row && versions.find((x) => x.knowledge_id === row.id);
    return ver && Array.isArray(ver.value) ? { values: ver.value.filter((x) => typeof x === "string"), version_no: ver.version_no, confirmed_at: ver.confirmed_at } : null;
  };
  return { ok: true, industries: pick("target_industries"), geographies: pick("target_geographies") };
}

/** The platform's own known list of kinds of company and places (readable by any signed-in person). */
export async function loadVocabulary() {
  const r = await select("platform_vocabulary_terms?select=kind,term_key,label,parent_key,depth&order=kind,depth,term_key");
  return r.ok && Array.isArray(r.data) ? r.data : null;
}
