/* The status "kontaktad" through the REST API and the MCP layer. All data is made up. */
import {json, testApi} from './helpers';

let t: ReturnType<typeof testApi>;
beforeEach(() => { t = testApi(); });
afterEach(() => t.close());

async function tool(name: string, args: object = {}) {
  const res = await t.app.request('/api/v1/mcp', json('POST', {jsonrpc: '2.0', id: 1, method: 'tools/call', params: {name, arguments: args}},
    {Accept: 'application/json, text/event-stream'}));
  const r = await res.json();
  return JSON.parse(r.result.content[0].text);
}

test('PUT and POST accept kontaktad; an unknown status gives 400', async () => {
  expect((await t.app.request('/api/v1/customers/c1', json('PUT', {company: 'Exempelbolaget AB', status: 'kontaktad'}))).status).toBe(201);
  expect((await t.app.request('/api/v1/customers', json('POST', {company: 'Exempel Två AB', status: 'kontaktad'}))).status).toBe(201);
  expect((await t.app.request('/api/v1/customers/c3', json('PUT', {company: 'Exempel Tre AB', status: 'varm'}))).status).toBe(400);
});

test('MCP list_customers filters on kontaktad, and kund no longer includes it', async () => {
  await t.app.request('/api/v1/customers/c1', json('PUT', {company: 'Exempel Kontaktad AB', status: 'kontaktad'}));
  await t.app.request('/api/v1/customers/c2', json('PUT', {company: 'Exempel Kund AB', status: 'kund'}));
  await t.app.request('/api/v1/customers/c3', json('PUT', {company: 'Exempel Prospekt AB', status: 'potentiell'}));
  expect((await tool('list_customers', {status: 'kontaktad'})).map((c: {id: string}) => c.id)).toEqual(['c1']);
  expect((await tool('list_customers', {status: 'kund'})).map((c: {id: string}) => c.id)).toEqual(['c2']);
});

test('the tool schema offers the three statuses', async () => {
  const res = await t.app.request('/api/v1/mcp', json('POST', {jsonrpc: '2.0', id: 1, method: 'tools/list'}, {Accept: 'application/json, text/event-stream'}));
  const tools = (await res.json()).result.tools as {name: string; inputSchema: {properties: {status?: {enum: string[]}}}}[];
  expect(tools.find(x => x.name === 'list_customers')!.inputSchema.properties.status!.enum).toEqual(['kund', 'kontaktad', 'potentiell']);
});
