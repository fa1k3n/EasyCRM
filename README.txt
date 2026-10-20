Customer register – a small CRM as a claude.ai artifact
=======================================================

A customer register for a small business: customers and potential customers, a contact log
with a reminder after 60/90 days, jobs and invoices, the customers' events, bookings and
follow-ups. The app runs as an artifact on claude.ai, with the artifact's built-in database.

The company's name, logo, colours, fonts, senders and customer types come from a file,
brand.json, which is merged with the code when publishing. The language is chosen there too:
"language": "en" (English) or "sv" (Swedish). The repo only holds a made-up example. Your own
brand (and any extensions, e.g. one with ready-made mail texts) goes in the folder profile/ in
your copy of the repo. It is ignored by git and never ends up on GitHub.

Licence: MIT (see LICENSE).

Getting started
---------------
Needs Node 24 (https://nodejs.org) and git, on Windows, macOS or Linux.

1. Clone the repo and install the npm packages (TypeScript, jest and playwright) in its folder:
     npm ci
2. Create your brand folder from the example (in the repo's folder):
     cp -r example profile
3. Fill in profile/brand.json (the fields are explained in the file) and replace logo.svg with
   your logo (png, svg, jpg or webp, at most 1 MB).
4. Preview with made-up customers (uses profile/ automatically):
     npm run preview
   and open the path that is printed.
5. Assemble the publish folder profile/publish (checks brand.json, runs all tests):
     npm run deploy
   (With  npm run deploy -- --brand <folder>  you can use another brand folder.)
6. Ask Claude (Claude Code) to publish profile/publish as an artifact:
   - index.html as the page and the other files (app.js, app.css, logic.js, brand.js and the
     logo) next to it.
   - The database: the capability db with the rule path "", read "admin", write "admin", so
     that only you can reach the customers.
   - For a new version: publish to the same artifact, read the published version first, and
     read the files back afterwards to compare them with the publish folder.

profile/ is not saved in git and has no version history: back it up yourself, e.g. together
with the database.

Running it on your own computer (localhost)
-------------------------------------------
The same app can also run on your computer, with its own database (SQLite) instead of the
claude.ai one:
     npm run serve
builds the app and the REST API and starts them on http://127.0.0.1:8787/ (open it in the
browser; stop with Ctrl+C). It uses profile/ and keeps the customers in
profile/data/crm.sqlite. Only your own computer can reach it. Options:
     npm run serve -- --port 8080 --db <file> --brand <folder>
The same app and API can also run on Cloudflare (Workers + D1), see server/README.md.
The registers (claude.ai, localhost, Cloudflare) are separate. Data is moved between them as one
JSON file with tools/data.js (pack, push, pull, unpack). The API and the moving of data are
described in server/README.md.

Optional in the brand folder:
- extensions/: extensions to the app: sections of your own on the customer card, badges in
  the customer list and ready-made mail texts. How to write, test, build and publish an
  extension is described in example/extensions/README.md, with the example "Next step" in
  example/extensions/next-step/. If you do not want the example: delete the folder.
- integrations/: integration plugins that bring data from other services (e.g. invoices) into
  the register, run with  npm run integration -- <id> --url <server>  (a dry run unless
  --apply). See example/integrations/README.md and the example example-invoices.
- run-tests.js: tests of your own, run by deploy as  node run-tests.js --repo <repo>.

Contents
--------
app/                           The app in React + TSX + Tailwind (built with npm run build, tried
                               with npm run preview and published with npm run deploy). The
                               extension API is in app/src/extensions/api.ts; the texts are in
                               app/src/i18n/ (sv.ts, en.ts)
crm/logic/            Pure logic in TypeScript, one module per area: dates, contact
                               status (60/90 days), filters, sorting, events, calendar items,
                               brand, colours and the logic's texts (i18n.ts). types.ts
                               describes the data model, index.ts is the API.
crm/logic.js          Built from logic/ (never edit it by hand). Used by the app.
crm/tsconfig.json     TypeScript settings
crm/tests/            Unit tests of the logic (run with jest)
server/                        The REST API (Hono): the local server with SQLite and the Cloudflare
                               Worker with D1, the same rules as the app, MCP for agents;
                               documented in server/README.md
example/                       Example brand (brand.json and logo) and the example extension
                               (extensions/, with README.md on how to write extensions)
tests/                         Tests of the TypeScript build, the React app's build, the
                               preview and deploy (jest)
tools/build-app.js             Builds the React app (app/) with Vite into app.js, app.css and
                               the page index.html (part of npm run build)
tools/build.js                 Builds logic/ into logic.js with TypeScript 6.0.3 from npm
                               (npm run build; --project <folder> builds another folder with a
                               tsconfig.json)
package.json                   The npm project: exact versions of the tools and packages
                               (typescript, jest, playwright, react, vite, tailwind and more)
tools/preview.js               Previews the app locally with made-up customers (npm run preview)
tools/build-server.js          Builds the REST API (server/) with Vite into server/dist/node.mjs
                               (part of npm run build)
tools/serve.js                 The app and the REST API on localhost (npm run serve)
tools/data.js                  Moves data between a backup folder, a JSON file and the REST API
tools/cloudflare.js            Assembles the app and the API for Cloudflare (npm run cloudflare)
tools/integration.js           Runs an integration plugin (npm run integration); its contract is
                               tools/integration-api.ts
tools/deploy.js                Checks a brand (brand.json), runs the tests and assembles the
                               publish folder (index.html, app.js, app.css, logic.js, brand.js
                               and images)
.github/workflows/ci.yml       GitHub Actions: all tests on every push

Running the tests
-----------------
     npm ci        (once, and when package-lock.json has changed)
     npm test

First logic/, the React app and the REST API are built and type-checked, then all tests run
with jest: the logic's tests (in jsdom), the React app's component tests, the REST API's tests
and the tools' tests. The tests have a fixed "today" (2026-10-15), so the result does not depend on the day they run.
