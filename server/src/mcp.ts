/* The MCP layer: a thin MCP server at /api/v1/mcp for agents outside claude.ai. Stateless JSON-RPC over HTTP (the
 * "streamable HTTP" transport, always answered with JSON, no server-sent stream). Every tool calls the REST API itself,
 * so agents get the same validation, versions (If-Match) and rules as any other client. The endpoint is behind the same
 * protections as the rest of the API (localhost only locally, Cloudflare Access in the cloud). */
import {Hono} from 'hono';
import {LISTS} from '../../crm/logic/card';
import {filterCustomers} from '../../crm/logic/list';
import {SYNC_DOCS} from './collections';
import type {Env} from './app';

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const INSTRUCTIONS = 'A small CRM. Customers have contact logs (comms), jobs, events and bookings. Read a customer with get_customer and ' +
  'send its version with every change, so a change made by someone else in between is never overwritten. Use add_list_item ' +
  'to log mails, calls and jobs: the server then works out the latest contact. Never send mail; only store drafts.';

type Json = Record<string, unknown>;
/** Calls the REST API: (method, path under /api/v1, body?, If-Match version?) → status and body */
export type ApiCall = (method: string, path: string, body?: unknown, version?: number) => Promise<{status: number; body: unknown; version?: number}>;

class RpcError extends Error { constructor(readonly code: number, message: string) { super(message); } }

const str = {type: 'string'};
const obj = (properties: Json, required: string[] = []) => ({type: 'object', properties, required});
const version = {type: 'integer', description: 'the version from get_customer; the change is refused if the customer changed since'};

const TOOLS: {name: string; description: string; inputSchema: Json}[] = [
  {name: 'list_customers', description: 'Lists the customers in short form (id, company, name, status, types, email, city, lastContact). Optional search text and status filter.',
    inputSchema: obj({query: str, status: {type: 'string', enum: ['kund', 'kontaktad', 'potentiell']}})},
  {name: 'get_customer', description: 'One customer with all its fields, and its version.', inputSchema: obj({id: str}, ['id'])},
  {name: 'create_customer', description: 'Creates a customer (status "kund"; "kontaktad" = contact made but no job yet; "potentiell" = a prospect) and returns it with its new id.',
    inputSchema: obj({data: {type: 'object'}}, ['data'])},
  {name: 'update_customer', description: 'Merges the fields in patch into the customer (top level). Send the version from get_customer.',
    inputSchema: obj({id: str, patch: {type: 'object'}, version}, ['id', 'patch'])},
  {name: 'add_list_item', description: 'Adds an element to a list of the customer (comms, jobs, events or bookings); the same item id again replaces it. ' +
    'A mail logged with event and mark ("offer" or "eventfu") also marks that event as offered or followed up.',
    inputSchema: obj({customerId: str, list: {type: 'string', enum: LISTS}, item: {type: 'object'}, event: str, mark: {type: 'string', enum: ['offer', 'eventfu']}, version}, ['customerId', 'list', 'item'])},
  {name: 'update_list_item', description: 'Merges the fields in patch into one element of a list of the customer.',
    inputSchema: obj({customerId: str, list: {type: 'string', enum: LISTS}, itemId: str, patch: {type: 'object'}, version}, ['customerId', 'list', 'itemId', 'patch'])},
  {name: 'remove_list_item', description: 'Removes one element from a list of the customer.',
    inputSchema: obj({customerId: str, list: {type: 'string', enum: LISTS}, itemId: str, version}, ['customerId', 'list', 'itemId'])},
  {name: 'get_calendar', description: 'Everything that belongs in the synced calendar (bookings, follow-ups, 90-day deadlines, event follow-ups, invoices due) and the conflicts of upcoming events.',
    inputSchema: obj({})},
  {name: 'skip_company', description: 'Remembers a removed suggestion so it is not suggested again. key: the web domain, or the company name if there is none.',
    inputSchema: obj({key: str, company: str, website: str}, ['key'])},
  {name: 'get_sync', description: 'Reads a sync document: busy (busy times from the calendar), calendar, gmail or integrations (the integration plugins\' latest runs in the cloud).',
    inputSchema: obj({doc: {type: 'string', enum: SYNC_DOCS}}, ['doc'])},
  {name: 'put_sync', description: 'Writes a whole sync document: busy ({items: [{date, time, endTime, title, eventId}]}), calendar or gmail (integrations is the Worker\'s).',
    inputSchema: obj({doc: {type: 'string', enum: SYNC_DOCS}, data: {type: 'object'}}, ['doc', 'data'])},
  {name: 'run_integration', description: 'Runs an integration plugin now (only in the cloud, where the plugins are built in) and returns its run: ok, counts, notes or the error.',
    inputSchema: obj({id: str}, ['id'])}
];

const enc = encodeURIComponent;

function need(args: Json, schema: Json) {
  for (const k of (schema.required as string[])) {
    const v = args[k];
    if (v === undefined || v === null || v === '') throw new RpcError(-32602, `Missing argument: ${k}`);
  }
}

type Result = Awaited<ReturnType<ApiCall>>;
type Handler = (args: Json, api: ApiCall) => Promise<{r: Result; data?: unknown}>;
const id = (args: Json, key: string) => enc(String(args[key]));
const versionOf = (args: Json) => (typeof args.version === 'number' ? args.version : undefined);
const listOf = (args: Json) => {
  if (!(LISTS as string[]).includes(args.list as string)) throw new RpcError(-32602, 'list must be comms, jobs, events or bookings');
  return args.list as string;
};
const withVersion = (r: Result) => ({r, data: {version: r.version, customer: r.body}});
// The status filter is the list's segments: kund = "kunder", kontaktad = "kontaktade", potentiell = "potentiella"
const SEGMENT: Record<string, string> = {kund: 'kunder', kontaktad: 'kontaktade', potentiell: 'potentiella'};

/* What each tool does with the REST API; data is what the agent gets (default: the API's answer) */
const HANDLERS: Record<string, Handler> = {
  async list_customers(args, api) {
    const r = await api('GET', '/customers');
    if (!Array.isArray(r.body)) return {r};
    // The same search and filter as the app's list (the logic's filterCustomers)
    const found = filterCustomers(r.body as Customer[], {q: String(args.query ?? ''), seg: SEGMENT[args.status as string]});
    return {r, data: found.map(c => ({id: c.id, company: c.company, name: c.name, status: c.status, types: c.types, email: c.email, city: c.city, lastContact: c.lastContact}))};
  },
  get_customer: async (args, api) => withVersion(await api('GET', `/customers/${id(args, 'id')}`)),
  create_customer: async (args, api) => withVersion(await api('POST', '/customers', args.data)),
  update_customer: async (args, api) => withVersion(await api('PATCH', `/customers/${id(args, 'id')}`, args.patch, versionOf(args))),
  async add_list_item(args, api) {
    const query = args.event || args.mark ? `?event=${id(args, 'event')}&mark=${id(args, 'mark')}` : '';
    return {r: await api('POST', `/customers/${id(args, 'customerId')}/${listOf(args)}${query}`, args.item, versionOf(args))};
  },
  update_list_item: async (args, api) =>
    ({r: await api('PATCH', `/customers/${id(args, 'customerId')}/${listOf(args)}/${id(args, 'itemId')}`, args.patch, versionOf(args))}),
  remove_list_item: async (args, api) =>
    ({r: await api('DELETE', `/customers/${id(args, 'customerId')}/${listOf(args)}/${id(args, 'itemId')}`, undefined, versionOf(args)), data: {removed: true}}),
  get_calendar: async (_args, api) => ({r: await api('GET', '/calendar')}),
  skip_company: async (args, api) => ({r: await api('PUT', `/skipped/${id(args, 'key')}`, {company: args.company ?? '', website: args.website ?? ''})}),
  get_sync: async (args, api) => ({r: await api('GET', `/sync/${id(args, 'doc')}`)}),
  put_sync: async (args, api) => ({r: await api('PUT', `/sync/${id(args, 'doc')}`, args.data)}),
  run_integration: async (args, api) => ({r: await api('POST', `/integrations/${id(args, 'id')}/run`, {})})
};

async function runTool(name: string, args: Json, api: ApiCall): Promise<{data: unknown; isError: boolean}> {
  const def = TOOLS.find(x => x.name === name);
  if (!def) throw new RpcError(-32602, `Unknown tool: ${name}`);
  need(args, def.inputSchema);
  const {r, data} = await HANDLERS[name](args, api);
  return r.status >= 400 ? {data: {status: r.status, ...(r.body as Json)}, isError: true} : {data: data === undefined ? r.body : data, isError: false};
}

export function mcpRoutes(api: ApiCall) {
  const r = new Hono<Env>();
  r.get('/', c => c.body(null, 405, {Allow: 'POST'}));
  r.post('/', async c => {
    const msg = c.get('body') as Json;
    const reply = (body: Json) => c.json({jsonrpc: '2.0', id: msg?.id ?? null, ...body});
    if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      return reply({error: {code: -32600, message: 'Invalid request'}});
    }
    // A notification (no id) gets no answer
    if (msg.id === undefined) return c.body(null, 202);
    const params = (msg.params && typeof msg.params === 'object' ? msg.params : {}) as Json;
    try {
      switch (msg.method) {
        case 'initialize': {
          const asked = String(params.protocolVersion ?? '');
          return reply({result: {
            protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
            capabilities: {tools: {}}, serverInfo: {name: 'crm', version: '1.0.0'}, instructions: INSTRUCTIONS
          }});
        }
        case 'ping': return reply({result: {}});
        case 'tools/list': return reply({result: {tools: TOOLS}});
        case 'tools/call': {
          const args = (params.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Json;
          const {data, isError} = await runTool(String(params.name ?? ''), args, api);
          return reply({result: {content: [{type: 'text', text: JSON.stringify(data)}], ...(isError ? {isError: true} : {})}});
        }
        default: return reply({error: {code: -32601, message: `Unknown method: ${msg.method}`}});
      }
    } catch (e) {
      if (e instanceof RpcError) return reply({error: {code: e.code, message: e.message}});
      throw e;
    }
  });
  return r;
}
