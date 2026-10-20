/* The MCP layer: a thin MCP server (JSON-RPC over HTTP, answered with JSON) at /api/v1/mcp whose tools call the REST API,
 * so agents get the same validation, versions and rules. All data is made up. */
import {json, testApi} from './helpers';

let t: ReturnType<typeof testApi>;
beforeEach(() => { t = testApi(); });
afterEach(() => t.close());

let nextId = 1;
async function rpc(method: string, params?: unknown) {
  const res = await t.app.request('/api/v1/mcp', json('POST', {jsonrpc: '2.0', id: nextId++, method, ...(params === undefined ? {} : {params})},
    {Accept: 'application/json, text/event-stream'}));
  expect(res.status).toBe(200);
  return res.json();
}
async function tool(name: string, args: object = {}) {
  const r = await rpc('tools/call', {name, arguments: args});
  const result = r.result as {content: {type: string; text: string}[]; isError?: boolean};
  return {isError: !!result.isError, data: JSON.parse(result.content[0].text)};
}

describe('the protocol', () => {
  test('initialize answers with the protocol version, the tools capability and the server', async () => {
    const r = await rpc('initialize', {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'test', version: '1'}});
    expect(r.result).toMatchObject({protocolVersion: '2025-06-18', capabilities: {tools: {}}, serverInfo: {name: 'crm'}});
    expect(typeof r.result.instructions).toBe('string');
  });

  test('a notification gets 202 without a body', async () => {
    const res = await t.app.request('/api/v1/mcp', json('POST', {jsonrpc: '2.0', method: 'notifications/initialized'}));
    expect(res.status).toBe(202);
    expect(await res.text()).toBe('');
  });

  test('ping, an unknown method and a broken request', async () => {
    expect((await rpc('ping')).result).toEqual({});
    expect((await rpc('nothing')).error.code).toBe(-32601);
    const bad = await t.app.request('/api/v1/mcp', json('POST', {hello: 1}));
    expect((await bad.json()).error.code).toBe(-32600);
  });

  test('GET is not offered (no server-sent stream): 405', async () => {
    expect((await t.app.request('/api/v1/mcp')).status).toBe(405);
  });

  test('tools/list describes every tool with an input schema', async () => {
    const tools = (await rpc('tools/list')).result.tools as {name: string; description: string; inputSchema: {type: string}}[];
    expect(tools.map(x => x.name)).toEqual(expect.arrayContaining([
      'list_customers', 'get_customer', 'create_customer', 'update_customer', 'add_list_item', 'update_list_item',
      'remove_list_item', 'get_calendar', 'skip_company', 'get_sync', 'put_sync'
    ]));
    for (const x of tools) { expect(x.description.length).toBeGreaterThan(10); expect(x.inputSchema.type).toBe('object'); }
  });
});

describe('the tools', () => {
  test('an agent lists and updates a made-up customer, with the version', async () => {
    await t.app.request('/api/v1/customers/c1', json('PUT', {company: 'Exempelbolaget AB', status: 'kund', lastContact: '2026-01-01'}));
    const list = await tool('list_customers');
    expect(list.data).toEqual([expect.objectContaining({id: 'c1', company: 'Exempelbolaget AB', status: 'kund', lastContact: '2026-01-01'})]);
    const got = await tool('get_customer', {id: 'c1'});
    expect(got.data).toMatchObject({version: 1, customer: {id: 'c1', company: 'Exempelbolaget AB'}});
    const upd = await tool('update_customer', {id: 'c1', version: 1, patch: {city: 'Exempelstad'}});
    expect(upd.isError).toBe(false);
    expect(upd.data).toMatchObject({version: 2, customer: {city: 'Exempelstad'}});
  });

  test('a stale version is an error result with the API\'s code, and nothing changes', async () => {
    await t.app.request('/api/v1/customers/c1', json('PUT', {company: 'A'}));
    const r = await tool('update_customer', {id: 'c1', version: 5, patch: {city: 'X'}});
    expect(r.isError).toBe(true);
    expect(r.data).toMatchObject({status: 412, error: {code: 'version_conflict'}});
    expect((await (await t.app.request('/api/v1/customers/c1')).json()).city).toBeUndefined();
  });

  test('list_customers can search and filter on status', async () => {
    for (const [id, c] of Object.entries({a: {company: 'Alfa Exempel', status: 'kund'}, b: {company: 'Beta Exempel', status: 'potentiell'}})) {
      await t.app.request(`/api/v1/customers/${id}`, json('PUT', c));
    }
    expect((await tool('list_customers', {query: 'beta'})).data.map((c: {id: string}) => c.id)).toEqual(['b']);
    expect((await tool('list_customers', {status: 'kund'})).data.map((c: {id: string}) => c.id)).toEqual(['a']);
  });

  test('add_list_item runs the server\'s rules: an offer mail marks the event and sets the latest contact', async () => {
    await t.app.request('/api/v1/customers/c1', json('PUT', {company: 'A', status: 'kund', events: [{id: 'e1', title: 'Mässa', date: '2026-11-10'}]}));
    const r = await tool('add_list_item', {customerId: 'c1', list: 'comms', item: {id: 'm1', kind: 'mail_ut', date: '2026-10-10', subject: 'Erbjudande'}, event: 'e1', mark: 'offer'});
    expect(r.isError).toBe(false);
    const c = (await tool('get_customer', {id: 'c1'})).data.customer;
    expect(c.events[0].offeredAt).toBe('2026-10-10');
    expect(c.lastContact).toBe('2026-10-10');
    expect((await tool('update_list_item', {customerId: 'c1', list: 'comms', itemId: 'm1', patch: {subject: 'Ny'}})).data.subject).toBe('Ny');
    expect((await tool('remove_list_item', {customerId: 'c1', list: 'comms', itemId: 'm1'})).isError).toBe(false);
  });

  test('create_customer, skip_company, get_calendar, put_sync and get_sync', async () => {
    const created = await tool('create_customer', {data: {company: 'Ny Exempel AB', status: 'potentiell'}});
    expect(created.data.customer.company).toBe('Ny Exempel AB');
    expect((await tool('skip_company', {key: 'exempel.se', company: 'Exempel', website: 'https://exempel.se'})).isError).toBe(false);
    expect((await tool('get_calendar')).data).toMatchObject({items: [], conflicts: []});
    expect((await tool('get_sync', {doc: 'busy'})).isError).toBe(true);
    expect((await tool('put_sync', {doc: 'busy', data: {items: []}})).isError).toBe(false);
    expect((await tool('get_sync', {doc: 'busy'})).data).toMatchObject({items: []});
  });

  test('invalid data comes back as an error result with the validation details', async () => {
    const r = await tool('create_customer', {data: {status: 'gammal'}});
    expect(r.isError).toBe(true);
    expect(r.data.error.details[0].path).toBe('status');
  });

  test('an unknown tool or missing arguments is a JSON-RPC error (-32602)', async () => {
    expect((await rpc('tools/call', {name: 'nothing', arguments: {}})).error.code).toBe(-32602);
    expect((await rpc('tools/call', {name: 'get_customer', arguments: {}})).error.code).toBe(-32602);
  });
});

test('the MCP endpoint is behind the same protections as the rest of the API (another Host is refused)', async () => {
  const res = await t.app.request('http://evil.example/api/v1/mcp', json('POST', {jsonrpc: '2.0', id: 1, method: 'ping'}));
  expect(res.status).toBe(403);
});
