# The CRM's REST API

One API with one code base: a local server on Node with SQLite, and the same code on Cloudflare Workers with D1.
The React app uses it through its data layer (`app/src/data/restStore.ts`) whenever it is not running on claude.ai:
it polls `GET /customers` every 10 seconds with `If-None-Match`, and at once after its own writes.

## Run it locally

`npm run serve` builds the app and the API and starts both on http://127.0.0.1:8787/ (the app on `/`, the API on
`/api/v1/`). On its own, without the app:

```sh
npm run build
node server/dist/node.mjs [--port 8787] [--db <file>] [--brand <folder with brand.json>] [--static <folder>]
```

Without `--brand` the server uses `profile/` when it exists, otherwise the built-in example brand. The brand decides
the language of the texts the server makes (e.g. the calendar titles); a `brand.json` that is not valid stops the start.
Without `--db` the database is `<brand folder>/data/crm.sqlite` (created when missing). Back it up together with
`profile/`.

The local server has no login. It therefore:
- listens on 127.0.0.1 only,
- answers only when the `Host` header is `localhost` or `127.0.0.1` (protects against DNS rebinding),
- never sends CORS headers, and requires `Content-Type: application/json` on every write, so another web page cannot
  read from it or write to it.

## Conventions

- All paths are under `/api/v1/`. Breaking changes get `/api/v2/`; new optional fields are not breaking.
- Request and response bodies are JSON, at most 1 MB per request.
- Errors always look like this, with a matching HTTP status:
  ```json
  {"error": {"code": "validation", "message": "…", "details": [{"path": "types[0]", "message": "…"}]}}
  ```
  | Status | `code` |
  | --- | --- |
  | 400 | `invalid_json`, `validation` (with `details`), `invalid_id`, `invalid_if_match` |
  | 403 | `forbidden_host` |
  | 404 | `not_found` |
  | 412 | `version_conflict` (If-Match did not match; read the document again and retry) |
  | 413 | `too_large` (a body over 1 MB or a stored document over 256 kB) |
  | 415 | `unsupported_media_type` |
  | 500 | `internal` (no details; the server log has only the kind of error and the path, never customer data) |

## Endpoints

| Path | Method | What |
| --- | --- | --- |
| `/api/v1/health` | GET | `{"api": "v1", "schema": <schema version>}` |
| `/api/v1/customers` | GET | All customers, each with its `id`. `ETag` changes with every write in the database; send it back as `If-None-Match` to get `304` when nothing changed |
| `/api/v1/customers` | POST | Creates a customer with a new id: `201`, `Location`, the document. `jobs` and `comms` start empty and `lastContact` as `null` whatever the body says; `createdAt` and `updatedAt` are set |
| `/api/v1/customers/{id}` | GET | One customer; `ETag` is its version |
| `/api/v1/customers/{id}` | PUT | Replaces the whole customer, or creates it with this id (`201`); keeps `createdAt` unless the body has one |
| `/api/v1/customers/{id}` | PATCH | Merges the body's fields into the customer on the top level (a field set to `null` becomes `null`) |
| `/api/v1/customers/{id}` | DELETE | Removes the customer: `204` |
| `/api/v1/customers/{id}/{list}` | GET | The list (`comms`, `jobs`, `events` or `bookings`); `ETag` is the customer's version |
| `/api/v1/customers/{id}/{list}` | POST | Adds an element (`201`), or replaces the element with the same `id` (`200`), so a retry never adds a duplicate. Without an `id` the server gives one |
| `/api/v1/customers/{id}/{list}/{itemId}` | PATCH | Merges the body's fields into the element |
| `/api/v1/customers/{id}/{list}/{itemId}` | DELETE | Removes the element: `204` |
| `/api/v1/skipped` | GET | The removed suggestions, each with its key as `id` |
| `/api/v1/skipped/{key}` | GET, PUT, DELETE | One removed suggestion (`company`, `website`, `at`; `at` is set when missing). The key is the web domain or the company name (URL-encoded) |
| `/api/v1/calendar` | GET | `{"items": [...], "conflicts": [{"customerId", "eventId", "conflicts": [...]}]}`: everything that belongs in the synced calendar (bookings, follow-ups, the 90-day deadlines, event follow-ups, invoices due), and for every upcoming event what is already booked during it (bookings and `sync/busy`) |
| `/api/v1/export` | GET | Everything as one file: `{"format": "crm-export", "version": 1, "exportedAt", "collections": {"customers": {"<id>": {…}}, "skipped": {…}, "sync": {…}}}` |
| `/api/v1/import` | POST | Writes such a file (up to 32 MB): every document exactly as in the file, all in one transaction or nothing; nothing is removed. Every customer is validated first. Answers `{"dryRun", "create": {collection: [ids]}, "update": {…}, "unchanged": n}`; with `?dryRun=1` nothing is written |
| `/api/v1/sync/{busy\|calendar\|gmail\|integrations}` | GET, PUT | The documents the agents sync; `busy.items` is the busy times. `integrations` is written by the Worker after each scheduled run of an integration plugin: `{"<plugin id>": {"enabled", "failures", "lastRun": {"at", "ok", "trigger", "counts", "remaining", "notes", "unmatched", "error"}}}` (and `running` and `manualAt`, which the Worker uses to keep two runs apart and to space manual runs; written by the platform, not by plugins). A document that has never been written gives `404` |
| `/api/v1/integrations` | GET | Only on Cloudflare, with integration plugins built in (`404` elsewhere): `[{"id", "name", "cron", "enabled", "failures", "lastRun"}]`. `failures` is the number of failed runs in a row |
| `/api/v1/integrations/{id}` | PUT | `{"enabled": true\|false}`: a plugin that is off does not run on its schedule |
| `/api/v1/integrations/{id}/run` | POST | Runs the plugin now, with the same code as the schedule, and answers with the run. `409` when it is off or already running, `429` when it was run by hand less than a minute ago |

Every write checks the data with the logic's `validateCustomer` (known fields must have the right type, e.g. `status`
`kund`/`kontaktad`/`potentiell` (`kontaktad`: contact made but no job yet), `types` a list of texts, dates `YYYY-MM-DD`; unknown fields and `ext` are kept; `null` counts as
missing), sets `updatedAt` and raises the version. An `id` in the body is ignored: the id is the one in the path.
A change to a list element is checked as part of the customer and also updates the customer's `updatedAt` and version;
`If-Match` on the list paths is the customer's version.

## MCP for agents

`/api/v1/mcp` is an MCP server (the streamable HTTP transport, stateless, answered with JSON) for agents outside
claude.ai. Its tools call the API above, so they follow the same validation, versions and rules:
`list_customers`, `get_customer`, `create_customer`, `update_customer`, `add_list_item`, `update_list_item`,
`remove_list_item`, `get_calendar`, `skip_company`, `get_sync`, `put_sync`, `run_integration` (only on Cloudflare). A tool the API refuses returns an error result
with the API's status and error. Connect an MCP client to `http://127.0.0.1:8787/api/v1/mcp` locally, or to
`https://<your domain>/api/v1/mcp` in the cloud with the agent's Access service token
(`CF-Access-Client-Id`/`CF-Access-Client-Secret` headers).

## Rules the server runs

The server runs the same logic as the app, so a client using the list paths does not need to know these rules:
- A change in `comms` or `jobs` works out `lastContact` again: the newest contact or job up to today.
- A new mail (`kind` `mail_ut` or `mail_in`) sets `lastMail`; a new job sets `lastJob`.
- `POST /customers/{id}/comms?event=<event id>&mark=offer` logs a mail as the offer for that event and sets the
  event's `offeredAt` to the mail's date; `mark=eventfu` sets `followUpSentAt` (the follow-up after the event).
- `GET /calendar` works out the calendar items and the conflicts.

`PUT` and `PATCH` on a whole customer store what they are given; they do not run these rules.

**Versions:** with `If-Match: "<version>"` a PUT, PATCH or DELETE is only made if the stored version is that one,
otherwise `412`. `If-Match: "0"` on a PUT only creates. Agents should always send it; the app does not (the last write
wins, as in the artifact database).

## Cloudflare (Workers + D1)

The same API runs as a Worker with a D1 database, and the app is served from the same domain by Workers Static Assets.

> **Cloudflare Access is required.** Without the `access` settings below the Worker refuses every request from the
> internet (`503 access_not_configured`); it only answers `wrangler dev` on your own computer.

Once:
1. A Cloudflare account; log in with `npx wrangler login`.
2. Create the database in the EU: `npx wrangler d1 create crm --jurisdiction eu`.
3. Write `profile/cloudflare.json` (the brand folder is never in git):
   `{"name": "<the Worker's name>", "databaseName": "crm", "databaseId": "<the id wrangler printed>"}`
   Optional: `"accountId"`, and `"routes"` for your own domain, e.g. `[{"pattern": "crm.example.com", "custom_domain": true}]`.
4. Cloudflare Access (Zero Trust): add a self-hosted application for the whole domain (the app and `/api/`), with a
   policy that lets in only you. Add its settings to `cloudflare.json`:
   `"access": {"teamDomain": "<team>.cloudflareaccess.com", "aud": "<the application's AUD tag>"}`.
5. Agents: one Access **service token** per agent, allowed by a "Service Auth" policy on the same application. The agent
   sends `CF-Access-Client-Id` and `CF-Access-Client-Secret` with every request; revoke a token in Cloudflare to shut
   that agent out. Keep the secrets out of the repo and the page.

The Worker checks the token Access adds (`Cf-Access-Jwt-Assertion`: signature against the team's keys, audience,
issuer, time) on every API request: `401 unauthenticated` without one, `401 invalid_token` for a bad one.

Every time:
```sh
npm run cloudflare          # builds and writes profile/publish-cloudflare (www/, worker.mjs, wrangler.json)
npx wrangler deploy --config profile/publish-cloudflare/wrangler.json
```
`npx wrangler dev --config profile/publish-cloudflare/wrangler.json` tries it locally first (with a local D1; Access is
not checked there when `access` is missing, since the request comes from your own computer).
The schema is created by the Worker itself the first time it is called. `brand.json` is the Worker's variable `BRAND`.

## Moving data

`tools/data.js` moves the register between claude.ai and this API with the export format:
- `node tools/data.js pack <backup folder> --out <file>`: a backup folder from the artifact database (one folder per
  collection, one `<id>.json` per document) into one file.
- `node tools/data.js push <file> --url http://127.0.0.1:8787 [--dry-run]`: into the API (try `--dry-run` first).
- `node tools/data.js pull --url http://127.0.0.1:8787 --out <file>`: out of the API.
- `node tools/data.js unpack <file> --out-dir <empty folder>`: back into a backup folder, to restore on claude.ai.

Against the cloud, put an Access service token in the environment variables `CF_ACCESS_CLIENT_ID` and
`CF_ACCESS_CLIENT_SECRET`; `pull` then also works as the cloud's backup:
`node tools/data.js pull --url https://<your domain> --out backup/<date>/cloud.json`.

## Storage

Documents are stored as JSON in collections (`customers`, `skipped`, `sync`), the same format as the claude.ai
artifact database, so data can be moved between the two. Every document has a `version` that grows with every write.
The schema is a list of numbered migrations in `src/schema.ts`, the same SQL for SQLite and D1; never change one that
has been released, add a new one.
