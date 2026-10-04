// Reads. Every call is made with the signed-in person's own session, so the database only ever returns rows of companies they belong to.
import { select, rpc } from "./api.js";
import { monthStart } from "./cost-logic.js";

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
    select(`ai_employee_authorities?${o}&select=ai_employee_id,capability_key,enabled,requires_approval,limits,context`),
    select(`owner_objectives?${o}&select=id,source_goal_text,quantity,status,criteria,created_at,confirmed_at&order=created_at.desc&limit=50`),
    select(`discovery_runs?${o}&select=id,owner_objective_id,status,requested,discovered,provider_records_inspected,already_known,duplicate_in_run,rejected_outside,insufficient_evidence,malformed,provider_key,termination_reason,created_at,updated_at,finished_at&order=created_at.desc&limit=50`),
    select(`discovery_candidates?${o}&select=id,run_id,disposition,reason,identity_tier,candidate,criteria_match,created_at&order=created_at.desc&limit=400`),
    select(`work_items?${o}&select=id,status,updated_at,context&order=updated_at.desc&limit=100`),
    select(`audit_log?${o}&select=id,event_type,decision,capability_key,execution_id,created_at,detail&order=created_at.desc&limit=200`),
  ]);
  // which job each logged run belonged to: only used to put a company name in a history line, so a failed read just makes those lines plainer
  const execs = await select(`executions?${o}&select=id,work_item_id&order=created_at.desc&limit=300`);
  // the owner's own list, contacts, prices and this month's usage: not essential, so a failed read just leaves them empty (the screens then say so)
  const [pipe, contacts, prices, usage] = await Promise.all([
    select(`company_pipeline?${o}&select=subject_id,name,lifecycle_stage_key,needs_review,created_at,on_owner_list,origin,verification,last_checked_at,website,place,contact_count,opted_out,stage&order=created_at.desc&limit=500`),
    select(`company_contacts?${o}&select=id,company_subject_id,name,email,phone,origin,opted_out_at,created_at&order=created_at.asc&limit=1000`),
    select(`provider_price_book?${o}&effective_to=is.null&select=provider_key,item_key,unit_type,unit_price,currency,effective_from`),
    rpc("usage_summary", { p_org_id: orgId, p_work_item_id: null, p_since: monthStart(), p_until: null }),
  ]);
  const all = [emps, auths, goals, runs, cands, jobs, audit];
  if (all.some((r) => !r.ok || !Array.isArray(r.data))) return { ok: false, status: all.find((r) => !r.ok)?.status };
  return {
    ok: true,
    employees: emps.data, authorities: auths.data, goals: goals.data, runs: runs.data, candidates: cands.data, jobs: jobs.data, audit: audit.data, executions: execs.ok && Array.isArray(execs.data) ? execs.data : [],
    pipeline: pipe.ok && Array.isArray(pipe.data) ? pipe.data : [], contacts: contacts.ok && Array.isArray(contacts.data) ? contacts.data : [],
    prices: prices.ok && Array.isArray(prices.data) ? prices.data : [], usage: usage.ok && Array.isArray(usage.data) ? usage.data : [],
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

/** The company's own information and templates: every knowledge item with its versions (confirmed and draft). Read when a screen that needs it is opened. */
export async function loadKnowledge(orgId) {
  if (!UUID.test(orgId)) return { ok: false };
  const k = await select(`organizational_knowledge?org_id=eq.${orgId}&slot_key=in.(company_name,company_description,offering,target_company_sizes,sales_note,message_templates)&select=id,slot_key,item_key,status&limit=200`);
  if (!k.ok || !Array.isArray(k.data)) return { ok: false };
  const ids = k.data.map((x) => x.id).filter((x) => UUID.test(x));
  let versions = [];
  if (ids.length) {
    const v = await select(`organizational_knowledge_versions?knowledge_id=in.(${ids.join(",")})&status=in.(confirmed,draft)&select=knowledge_id,version_no,value,status,confirmed_at,created_at&order=version_no.desc&limit=1000`);
    if (!v.ok || !Array.isArray(v.data)) return { ok: false };
    versions = v.data;
  }
  return { ok: true, rows: k.data, versions };
}
