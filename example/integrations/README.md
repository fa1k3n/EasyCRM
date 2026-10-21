# Integration plugins

An integration plugin brings data from another service into the register, for example invoices from your accounting
system. It runs on your computer with Node (not in the page), so the service's key never reaches the browser.

A plugin never writes to the register itself. It reads the service, reads the customers (frozen), and returns a **plan**.
The platform shows the plan, and with `--apply` writes it through the REST API with the same rules as the app.

## Where it lives

```
profile/integrations/<id>/index.ts       the plugin (its default export is the manifest)
profile/integrations/<id>/settings.json  optional settings (e.g. customers to ignore), given to the plugin as ctx.settings
```

`profile/` is your brand folder; it is never saved in git. `example/integrations/example-invoices/` is a complete
example against a made-up service.

## The manifest

Written against `crm-integration-api` (`tools/integration-api.ts`), version 1:

```ts
import type {IntegrationManifest} from 'crm-integration-api';

const plugin: IntegrationManifest = {
  id: 'my-invoices',                 // the folder's name; also the key in customer.ext
  name: 'My invoices',
  apiVersion: 1,
  env: ['MY_INVOICES_KEY'],          // environment variables it needs
  hosts: ['api.my-service.example'], // the only hosts ctx.fetch may call (https, GET)
  owns: {jobs: ['invoiceNumber', 'invoiceStatus', 'dueDate']}, // fields it may change on an existing job
  async run(ctx) {
    // ctx.config.MY_INVOICES_KEY, ctx.fetch(url, {headers}), ctx.customers, ctx.today, ctx.options.since, ctx.settings
    return {jobs: [], links: [], unmatched: [], notes: []};
  }
};
export default plugin;
```

The plan:
- `customers` (optional): `{id, data}` for customers the service has and the register lacks. They are created first
  (never overwritten), with a stable id such as `my-invoices-<the service's customer id>`, and the plan's jobs and
  links may refer to them. Never create one when a name matches several customers: list it in `unmatched` instead.
- `jobs`: `{customerId, item}` where `item` is a job (title, date, amount, invoiceNumber, invoiceStatus, dueDate,
  invoiceUrl) with a **stable id**, e.g. `my-invoices-<the service's invoice id>`. A new id becomes a new job; an existing
  one only gets the fields in `owns.jobs` that differ, so the user's own title, amount or link are kept.
- `links`: `{customerId, data}`, saved in `customer.ext[<id>]`, e.g. the service's id for the customer, so the next run
  finds it without guessing.
- `unmatched`: things in the service you could not connect to a customer; shown, never written.
- `notes`: anything else to tell the user.

Rules a plugin is held to: it only gets its declared variables, `ctx.fetch` only reaches its hosts over https with GET,
the customers are frozen, and a plan that is not valid is refused before anything is written. `owns.jobs` may only
have `invoiceNumber`, `invoiceStatus` and `dueDate`. `ctx.fetch` never follows a redirect, reading a variable that
is not in `env` throws, and a new customer's `ext` may only hold the plugin's own key. Never print `ctx.config`: a plan
that holds a secret value is refused, and secret values in an error message are masked.

`ctx` is the plugin's only way out: it is type-checked without the browser's globals and runs in a context of its own
that has JavaScript's built-ins plus `URL`, `URLSearchParams` and `structuredClone` (`tools/integration-globals.d.ts`),
but no `fetch`, `process`, `require` or `console`. The plan must be plain JSON.

## Running it

```sh
npm run integration -- <id> --url http://127.0.0.1:8787            # dry run: shows the plan, writes nothing
npm run integration -- <id> --url http://127.0.0.1:8787 --apply    # writes the plan
```

Options: `--brand <folder>` (default `profile/`), `--since <YYYY-MM-DD>` (given to the plugin as `ctx.options.since`),
`--env-file <file>`. The key goes in the environment, or in `~/.config/crm/<id>.env` (`KEY=value` lines; make it
readable only by you: `chmod 600`). Against the cloud, the Access service token is read from `~/.config/crm/access.env`
(`CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`).

## Running it in the cloud, on a schedule

When the register runs on Cloudflare (`npm run cloudflare`), the Worker can run a plugin on a schedule, with the same
code as `--apply`. List it in your brand folder's `cloudflare.json`:

```json
"integrations": [{"id": "<id>", "cron": "0 5 * * *"}]
```

`cron` is in UTC. `npm run cloudflare` type-checks the plugin, builds it into the Worker with its `settings.json`,
and adds the schedule as a Cron Trigger. Put each variable the plugin lists in `env` into the Worker once, as a secret
(the tool prints the commands; the value is typed in, never stored in a file):

```sh
npx wrangler secret put <NAME> --config <brand folder>/publish-cloudflare/wrangler.json
```

Each run writes at most `maxWritesPerRun` changes (in `settings.json`, default 20) to stay within the Workers free
tier; the rest are written on the next run. The app's integrations page (the Integrations button in the header) lists every built-in plugin with its schedule
and latest run: when, whether it worked, how much was written and left, the plan's `notes` and `unmatched`, or the
error (with the secret values masked). A plugin whose latest 3 runs in a row failed is shown in red, with an alert
above the customer list. There it can be run now and switched off (it then does not run on its schedule). The same
is in the API: `GET /api/v1/integrations`, `PUT /api/v1/integrations/<id>` with `{"enabled": false}` and
`POST /api/v1/integrations/<id>/run`. The Worker's own log only gets the plugin's id and the
counts. In the Worker the plugin has no `vm` context of its own: the type check (no `fetch` or `process`) and `ctx`
are what keep it to its declared hosts. That is not a hard security boundary; the plugins are your own code.

## Testing

The example's tests are in `tests/integration.test.js`: they run the plugin against a made-up service with a fake
`fetch` and made-up customers. Test your own plugin the same way in your brand folder (`run-tests.js`).
