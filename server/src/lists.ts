/* /api/v1/customers/{id}/{comms|jobs|events|bookings}: the elements of a customer's lists, addressed by their id.
 * A POST with an id that is already in the list replaces that element, so a retry never adds a duplicate. The
 * customer's version is the ETag and If-Match of every request here.
 * The rules are the logic's own patches (addItemPatch, replaceItemPatch, removeItemPatch, sentPatch, markEventPatch),
 * the same as the app uses: a change in comms or jobs works out lastContact again, a new mail sets lastMail, a new job
 * lastJob, and a mail posted with ?event=<event id>&mark=offer|eventfu marks the event as offered or followed up. */
import {Hono} from 'hono';
import type {Context} from 'hono';
import {addItemPatch, LISTS, type ListName, removeItemPatch, replaceItemPatch} from '../../crm/logic/card';
import {markEventPatch, sentPatch} from '../../crm/logic/mail';
import {validateCustomer} from '../../crm/logic/validate';
import type {Env} from './app';
import {modifyCustomer} from './customers';
import type {Db, JsonObject} from './db';
import {bodyObject, checkId, ifMatch, invalid, notFound} from './docs';


function listName(name: string): ListName {
  if (!(LISTS as string[]).includes(name)) throw notFound();
  return name as ListName;
}

const itemsOf = (data: JsonObject, list: ListName): JsonObject[] => (Array.isArray(data[list]) ? data[list] as JsonObject[] : []);
const hasId = (id: string) => (x: JsonObject) => typeof x === 'object' && x !== null && x.id === id;

// The element is checked as element number `index` of the list, so the paths in the error are the real ones
function validateItem(list: ListName, item: JsonObject, index: number) {
  const issues = validateCustomer({[list]: [item]});
  if (issues.length) throw invalid(issues.map(i => ({...i, path: i.path.replace(`${list}[0]`, `${list}[${index}]`)})));
}

type Mark = {eventId: string; kind: 'offer' | 'eventfu'};

// ?event=&mark= on a new mail: both or neither, a known mark, only on comms
function eventMark(c: Context<Env>, list: ListName): Mark | null {
  const eventId = c.req.query('event'), mark = c.req.query('mark');
  if (eventId === undefined && mark === undefined) return null;
  if (list !== 'comms') throw invalid([{path: 'mark', message: 'event and mark only work on comms'}]);
  if (!eventId || (mark !== 'offer' && mark !== 'eventfu')) throw invalid([{path: 'mark', message: 'needs both event=<event id> and mark=offer or mark=eventfu'}]);
  return {eventId, kind: mark};
}

// The customer with a new or replaced element, by the logic's patches
function withItem(data: JsonObject, list: ListName, item: JsonObject & {id: string}, replaced: boolean, mark: Mark | null): JsonObject {
  const customer = data as Customer;
  if (mark && !(customer.events || []).some(e => e.id === mark.eventId)) throw invalid([{path: 'event', message: 'the customer has no event with this id'}]);
  if (!replaced) return {...data, ...(mark ? sentPatch(customer, mark.eventId, mark.kind, item as Comm) : addItemPatch(customer, list, item))};
  return {...data, ...replaceItemPatch(customer, list, item), ...(mark ? markEventPatch(customer, mark.eventId, mark.kind, item.date as string) : {})};
}

export function listRoutes(db: Db) {
  const r = new Hono<Env>();

  r.get('/:id/:list', async c => {
    const list = listName(c.req.param('list'));
    const row = await db.get('customers', checkId(c.req.param('id')));
    if (!row) throw notFound();
    c.header('ETag', `"${row.version}"`);
    return c.json(itemsOf(row.data, list));
  });

  r.post('/:id/:list', async c => {
    const list = listName(c.req.param('list'));
    const id = checkId(c.req.param('id'));
    const body = bodyObject(c);
    const item = {...body, id: typeof body.id === 'string' && body.id ? checkId(body.id) : crypto.randomUUID()};
    const mark = eventMark(c, list);
    let replaced = false;
    const row = await modifyCustomer(db, id, ifMatch(c), data => {
      const items = itemsOf(data, list);
      const at = items.findIndex(hasId(item.id));
      replaced = at !== -1;
      validateItem(list, item, replaced ? at : items.length);
      return withItem(data, list, item, replaced, mark);
    });
    c.header('ETag', `"${row.version}"`);
    return c.json(item, replaced ? 200 : 201);
  });

  r.patch('/:id/:list/:itemId', async c => {
    const list = listName(c.req.param('list'));
    const itemId = checkId(c.req.param('itemId'));
    const {id: _ignored, ...patch} = bodyObject(c);
    let item: JsonObject = {};
    const row = await modifyCustomer(db, checkId(c.req.param('id')), ifMatch(c), data => {
      const items = itemsOf(data, list);
      const at = items.findIndex(hasId(itemId));
      if (at === -1) throw notFound();
      item = {...items[at], ...patch, id: itemId};
      validateItem(list, item, at);
      return {...data, ...replaceItemPatch(data as Customer, list, item)};
    });
    c.header('ETag', `"${row.version}"`);
    return c.json(item);
  });

  r.delete('/:id/:list/:itemId', async c => {
    const list = listName(c.req.param('list'));
    const itemId = checkId(c.req.param('itemId'));
    await modifyCustomer(db, checkId(c.req.param('id')), ifMatch(c), data => {
      const items = itemsOf(data, list);
      if (!items.some(hasId(itemId))) throw notFound();
      return {...data, ...removeItemPatch(data as Customer, list, itemId)};
    });
    return c.body(null, 204);
  });

  return r;
}
