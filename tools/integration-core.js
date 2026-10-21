'use strict';
/* The part of an integration plugin's run that tools/integration.js (Node) and the Worker (server/src/worker.ts) share:
 * the manifest check, the plugin's ctx, the plan's checks, what the plan changes, and the writing through the REST API.
 * No Node modules: the Worker builds this file in. The API is reached through call(method, path, body, version), with
 * the path after /api/v1 and the answer {status, data, version}: over HTTP in Node, inside the Worker in the cloud.
 * Types: tools/integration-core.d.ts. */

const API_VERSION = 1;
// The job fields a plugin may own. The type OwnedJobField (tools/integration-api.ts) is wider on purpose, so that a
// plugin naming another field gets this check's message about owns; keep its comment in step. Never the user's
// title, amount or link
const OWNED_JOB_FIELDS = ['invoiceNumber', 'invoiceStatus', 'dueDate'];
const ID = /^[a-z0-9_-]+$/;
/** Writes per run in the Worker unless the plugin's settings.json has maxWritesPerRun (the free tier's limits) */
const DEFAULT_MAX_WRITES = 20;
const MAX_ERROR = 300;

function checkManifest(m, id) {
  const errors = [];
  if (!m || typeof m !== 'object') return ['the default export must be the manifest'];
  if (m.id !== id || !ID.test(String(m.id))) errors.push(`id must be "${id}" (the folder's name, a–z, 0–9, - and _)`);
  if (m.apiVersion !== API_VERSION) errors.push(`apiVersion ${m.apiVersion} is not supported (this platform has ${API_VERSION})`);
  if (typeof m.name !== 'string' || !m.name) errors.push('name is missing');
  if (typeof m.run !== 'function') errors.push('run must be a function');
  for (const k of ['env', 'hosts']) if (m[k] !== undefined && !(Array.isArray(m[k]) && m[k].every(x => typeof x === 'string' && x))) errors.push(`${k} must be a list of texts`);
  const owned = m.owns && m.owns.jobs;
  if (owned !== undefined && !(Array.isArray(owned) && owned.every(f => OWNED_JOB_FIELDS.includes(f)))) {
    errors.push(`owns.jobs may only have: ${OWNED_JOB_FIELDS.join(', ')}`);
  }
  return errors;
}

/* ---------- What the plugin gets ---------- */

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

const today = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

/** The plugin's ctx: only its variables, a GET-only fetch to its hosts over https, frozen copies of the customers.
 * fetchImpl gets redirect: 'error' (a redirect could lead outside hosts); where that is not supported (Workers) the
 * caller passes a fetchImpl that refuses redirects itself */
function makeContext({manifest, settings = {}, env, customers, fetchImpl, options = {}}) {
  const names = manifest.env || [];
  const missing = names.filter(n => !env[n]);
  if (missing.length) throw Object.assign(new Error(`Missing environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`), {exitCode: 2});
  // Reading a variable the manifest did not declare (a name like MY_KEY) throws, so a missing env entry is found at once
  const declared = Object.freeze(Object.fromEntries(names.map(n => [n, env[n]])));
  const config = new Proxy(declared, {
    get(target, key) {
      if (typeof key === 'string' && /^[A-Z][A-Z0-9_]*$/.test(key) && !Object.prototype.hasOwnProperty.call(target, key)) {
        throw new Error(`${key} is not among the plugin's env (declare it in the manifest)`);
      }
      return target[key];
    }
  });
  const hosts = manifest.hosts || [];
  return {
    config,
    async fetch(url, init = {}) {
      const u = new URL(url);
      if (u.protocol !== 'https:') throw new Error(`Only https is allowed: ${u.protocol}//${u.host}`);
      if (!hosts.includes(u.hostname)) throw new Error(`${u.hostname} is not among the plugin's hosts (${hosts.join(', ') || 'none'})`);
      if (init.method && init.method.toUpperCase() !== 'GET') throw new Error('Only GET is allowed: a plugin only reads the service');
      const res = await fetchImpl(u.href, {method: 'GET', redirect: 'error', headers: {...(init.headers || {})}});
      return {ok: res.ok, status: res.status, json: () => res.json(), text: () => res.text()};
    },
    customers: deepFreeze(structuredClone(customers)),
    today: today(),
    options: Object.freeze({...options}),
    settings: deepFreeze(structuredClone(settings))
  };
}

/* ---------- The plan ---------- */

/** Problems that stop the plan from being written (empty = fine); validateCustomer is the logic's */
function checkPlan(plan, manifest, customers, validateCustomer) {
  if (!plan || typeof plan !== 'object') return ['run must return a plan object'];
  const issues = [], ids = new Set(customers.map(c => c.id)), seen = new Set();
  for (const k of ['customers', 'jobs', 'links', 'unmatched', 'notes']) if (plan[k] !== undefined && !Array.isArray(plan[k])) issues.push(`${k} must be a list`);
  // New customers (create only); jobs and links in the same plan may refer to them
  for (const n of Array.isArray(plan.customers) ? plan.customers : []) {
    if (!n || typeof n.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,200}$/.test(n.id)) { issues.push('a new customer has no valid id'); continue; }
    if (ids.has(n.id)) { issues.push(`${seen.has('customer/' + n.id) ? `new customer ${n.id} is in the plan twice` : `customer ${n.id} already exists`}`); continue; }
    if (!n.data || typeof n.data !== 'object' || Array.isArray(n.data)) { issues.push(`new customer ${n.id}: data must be an object`); continue; }
    for (const i of validateCustomer(n.data)) issues.push(`new customer ${n.id}: ${i.path} ${i.message}`);
    // Only the plugin's own field in ext, as for links
    const ext = n.data.ext && typeof n.data.ext === 'object' ? Object.keys(n.data.ext) : [];
    for (const k of ext.filter(k => k !== manifest.id)) issues.push(`new customer ${n.id}: ext.${k} belongs to someone else (only ext.${manifest.id})`);
    ids.add(n.id);
    seen.add('customer/' + n.id);
  }
  const list = k => (Array.isArray(plan[k]) ? plan[k] : []);
  for (const j of list('jobs')) {
    const item = j && j.item;
    if (!j || !ids.has(j.customerId)) { issues.push(`job for an unknown customer: ${j && j.customerId}`); continue; }
    if (!item || typeof item.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,200}$/.test(item.id)) { issues.push(`a job for ${j.customerId} has no valid id`); continue; }
    const key = `${j.customerId}/${item.id}`;
    if (seen.has(key)) issues.push(`job ${item.id} is in the plan twice`);
    seen.add(key);
    for (const i of validateCustomer({jobs: [item]})) issues.push(`job ${item.id}: ${i.path.replace('jobs[0].', '')} ${i.message}`);
  }
  for (const l of list('links')) {
    if (!l || !ids.has(l.customerId)) issues.push(`link for an unknown customer: ${l && l.customerId}`);
    else { try { JSON.stringify(l.data); } catch { issues.push(`the link for ${l.customerId} is not JSON`); } }
  }
  for (const k of ['unmatched', 'notes']) if (list(k).some(x => typeof x !== 'string')) issues.push(`${k} must be texts`);
  return issues;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** What writing the plan would change: new jobs, changed owned fields on existing jobs, and changed links */
function diffPlan(plan, manifest, customers) {
  const byId = new Map(customers.map(c => [c.id, c]));
  const owned = (manifest.owns && manifest.owns.jobs) || [];
  const out = {create: [], update: [], links: []};
  // New customers: only when the plan has them (then they are written first); their jobs and links start from them
  if (Array.isArray(plan.customers)) {
    out.customers = plan.customers.filter(n => !byId.has(n.id));
    for (const n of out.customers) byId.set(n.id, {id: n.id, ...n.data});
  }
  for (const {customerId, item} of plan.jobs || []) {
    const old = (byId.get(customerId).jobs || []).find(x => x && x.id === item.id);
    if (!old) { out.create.push({customerId, item}); continue; }
    const patch = Object.fromEntries(owned.filter(f => item[f] !== undefined && !same(item[f], old[f])).map(f => [f, item[f]]));
    if (Object.keys(patch).length) out.update.push({customerId, itemId: item.id, patch});
  }
  for (const {customerId, data} of plan.links || []) {
    const ext = byId.get(customerId).ext || {};
    if (!same(ext[manifest.id], data)) out.links.push({customerId, data});
  }
  return out;
}

/* ---------- Writing ---------- */

const enc = encodeURIComponent;

// An answer the writing cannot go on from (412 is handled by reading the customer again)
function check(r, method, path) {
  if (r.status >= 400 && r.status !== 412) {
    const e = r.data && r.data.error;
    throw new Error(`The server answered ${r.status} for ${method} /api/v1${path}: ${e ? e.message : 'no message'}`);
  }
  return r;
}

/* Writes one change with the customer's current version. If someone else wrote in between (412), the customer is read
 * again and the change is made on the new version; a job that is already there is not added again. */
async function writeWithVersion(call, customerId, write) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const path = `/customers/${enc(customerId)}`;
    const current = check(await call('GET', path), 'GET', path);
    const r = await write(current.data, current.version);
    if (!r || r.status !== 412) return r;
  }
  throw new Error(`The customer ${customerId} kept changing; run the integration again`);
}

/** Writes the diff through the API: new customers (create only), new jobs with POST (the server's rules run), owned
 * fields on existing jobs with PATCH, and the plugin's link in customer.ext[<id>]. Always with If-Match. At most
 * maxWrites changes (default: all); the rest are counted in remaining and are written by a later run */
async function applyPlan(diff, manifest, call, {maxWrites = Infinity} = {}) {
  const n = {...(diff.customers ? {customers: 0} : {}), created: 0, updated: 0, linked: 0, remaining: 0};
  let budget = maxWrites;
  const turn = () => { if (budget <= 0) { n.remaining++; return false; } budget--; return true; };
  const send = async (method, path, body, version) => check(await call(method, path, body, version), method, path);
  // New customers first, create only (If-Match "0"): an existing one is never overwritten
  for (const c of diff.customers || []) {
    if (!turn()) continue;
    const r = await send('PUT', `/customers/${enc(c.id)}`, c.data, 0);
    if (r.status !== 412) n.customers++;
  }
  const has = (customer, id) => (customer.jobs || []).some(j => j && j.id === id);
  for (const {customerId, item} of diff.create) {
    if (!turn()) continue;
    await writeWithVersion(call, customerId, async (customer, version) => {
      if (has(customer, item.id)) return null;
      const r = await send('POST', `/customers/${enc(customerId)}/jobs`, item, version);
      if (r.status !== 412) n.created++;
      return r;
    });
  }
  for (const {customerId, itemId, patch} of diff.update) {
    if (!turn()) continue;
    await writeWithVersion(call, customerId, async (customer, version) => {
      if (!has(customer, itemId)) return null;
      const r = await send('PATCH', `/customers/${enc(customerId)}/jobs/${enc(itemId)}`, patch, version);
      if (r.status !== 412) n.updated++;
      return r;
    });
  }
  for (const {customerId, data} of diff.links) {
    if (!turn()) continue;
    await writeWithVersion(call, customerId, async (customer, version) => {
      const r = await send('PATCH', `/customers/${enc(customerId)}`, {ext: {...(customer.ext || {}), [manifest.id]: data}}, version);
      if (r.status !== 412) n.linked++;
      return r;
    });
  }
  return n;
}

/* ---------- One run (the Worker) ---------- */

// The secret values (at least 4 characters), so that they can be kept out of what is shown and stored
const secretsOf = (manifest, env) => (manifest.env || []).map(name => env[name]).filter(v => v && v.length >= 4);
const masker = secrets => text => secrets.reduce((t, s) => t.split(s).join('***'), String(text));

/** One run of a plugin: the customers from the API, the plugin's plan, the checks and the writing (at most
 * settings.maxWritesPerRun changes). Never throws: the result is lastRun, {at, ok, trigger, counts, remaining, notes,
 * unmatched} or {at, ok: false, trigger, error} with the secret values masked and the error cut */
async function runOnce(manifest, {validateCustomer, call, env = {}, settings = {}, trigger, fetchImpl, options = {}, now = () => new Date()}) {
  const at = now().toISOString();
  const mask = masker(secretsOf(manifest, env));
  try {
    const list = await call('GET', '/customers');
    if (list.status !== 200 || !Array.isArray(list.data)) throw new Error(`The server answered ${list.status} for the customers`);
    const customers = list.data;
    const ctx = makeContext({manifest, settings, env, customers, fetchImpl, options});
    // The plan as plain JSON, as tools/integration.js gets it from the plugin's own context
    const plan = JSON.parse(JSON.stringify((await manifest.run(ctx)) ?? null));
    if (secretsOf(manifest, env).some(s => JSON.stringify(plan).includes(s))) throw new Error('The plan holds one of the secret values (a key); nothing is written. Fix the plugin.');
    const issues = checkPlan(plan, manifest, customers, validateCustomer);
    if (issues.length) throw new Error(`The plugin's plan cannot be written: ${issues.join('; ')}`);
    const limit = Number(settings.maxWritesPerRun);
    const n = await applyPlan(diffPlan(plan, manifest, customers), manifest, call, {maxWrites: limit > 0 ? limit : DEFAULT_MAX_WRITES});
    return {lastRun: {at, ok: true, trigger, counts: {customers: n.customers || 0, created: n.created, updated: n.updated, linked: n.linked},
      remaining: n.remaining, notes: plan.notes || [], unmatched: plan.unmatched || []}};
  } catch (e) {
    return {lastRun: {at, ok: false, trigger, error: mask(e && e.message ? e.message : e).slice(0, MAX_ERROR)}};
  }
}

/** Changes one plugin's entry in sync/integrations, next to the other plugins' entries; null from change leaves it
 * as it is. Written with If-Match and tried again when someone else wrote in between. Returns the new entry or null */
async function updateIntegration(call, id, change) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await call('GET', '/sync/integrations');
    const {id: _, ...doc} = current.status === 200 && current.data ? current.data : {};
    const entry = change(doc[id] || {});
    if (entry === null) return null;
    const r = await call('PUT', '/sync/integrations', {...doc, [id]: entry}, current.status === 200 ? current.version : 0);
    if (r.status !== 412) { check(r, 'PUT', '/sync/integrations'); return entry; }
  }
  throw new Error('sync/integrations kept changing');
}

/** Keeps a run's result in the plugin's entry in sync/integrations, next to its other fields (e.g. enabled); a mark
 * that it is running is removed. change can add to the entry */
const recordRun = (call, id, lastRun, change = entry => entry) => updateIntegration(call, id, entry => change({...entry, lastRun, running: undefined}));

module.exports = {API_VERSION, OWNED_JOB_FIELDS, ID, DEFAULT_MAX_WRITES, checkManifest, makeContext, checkPlan, diffPlan, applyPlan, runOnce, updateIntegration, recordRun};
