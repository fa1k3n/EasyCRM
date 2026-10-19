# Extensions

An extension adds your own parts to the customer register (the React app): a **section on the customer card** and/or
a **badge on the customer rows** in the list, and optionally **ready mail texts** for offers and follow-ups. It is
built together with the app when you publish, so it is type-checked like the rest of the app.

The example in `next-step/` ("Nästa steg") lets you note the next thing to do with a customer, and shows a badge in
the list while one is noted. Copy it as a starting point. If you do not want it in your app, delete the folder.

## Where extensions live

In your brand folder (`profile/`, made from `exempel/`):

```
profile/
  brand.json
  logo.svg
  extensions/
    next-step/
      index.tsx          the extension (its default export is the manifest)
      index.test.tsx     its tests (optional, recommended)
    my-badge.ts          a one-file extension works too
```

Every `.ts`/`.tsx` file directly in `extensions/`, and every subfolder's `index.ts`/`index.tsx`, is one extension.

## The manifest

```tsx
import type {ExtensionManifest} from 'crm-extension-api';

const manifest: ExtensionManifest = {
  id: 'next-step',          // a–z, 0–9, - and _; also the key of your data on the customer. Never change it later.
  apiVersion: 1,            // the API version the extension is written for
  name: 'Nästa steg',
  customerSections: [{id: 'next-step', title: 'Nästa steg', Component: NextStep}],
  listBadges: [badge],
  // mail: {buildOffer, buildEventFollowUp}   ready mail texts, see below
};
export default manifest;
```

`crm-extension-api` is the app's `app/src/extensions/api.ts`. It has all the types used below.

### A section on the customer card

`Component` is a React component that gets:

| Prop | What |
| --- | --- |
| `customer` | The customer, **read-only** (frozen: changing it throws). |
| `data` | What your extension saved for this customer last time, or `undefined`. |
| `save(data)` | Saves `data` (plain JSON) in `customer.ext[<your id>]`. Returns a promise that rejects if the data is not JSON, the user may only read, or the write fails. Show that error. |
| `canWrite` | `false` when the signed-in user may only read. |

An extension can only write its own field. Everything else on the customer is written by the app.

### A badge on the list rows

A function that gets the (read-only) customer and returns `{text, title?}` for a badge, or `null` for none. It runs
for every row on every update, so keep it quick.

### Mail texts

`mail` gives the texts for an offer before a customer's event and a follow-up after it:
`buildOffer(customer, event, helpers)` and `buildEventFollowUp(customer, event, helpers)`. Each returns
`{subject, body, note, tags?, hint?}`. The app shows the text, lets the user change it, and logs the mail when the user
says it is sent. Mail is never sent by the app. Without a mail extension, offers and follow-ups are logged without text.

`helpers` (`MailHelpers` in `crm-extension-api`) has what a mail text usually needs, so the extension does not depend
on the app's globals: `fmtDate(iso)` ("27/10 2026"), `dayMonth(iso)` ("27 oktober"), `signature(customer)` (the
signature of the sender the customer's types give in brand.json) and `customerTypes(customer)` (the type ids).

```ts
mail: {
  buildOffer: (c, e, h) => ({subject: `Before ${e.title}`, body: `Hi,\n\nSee you ${h.dayMonth(e.date!)}!\n\n${h.signature(c)}`, note: `Offer before ${e.title}`}),
  buildEventFollowUp: (c, e, h) => ({subject: `After ${e.title}`, body: `Hi,\n\nHow did it go?\n\n${h.signature(c)}`, note: `Follow-up after ${e.title}`})
}
```

## Styles

Use Tailwind classes. The app's colours are available as `bg-surface`, `text-muted`, `border-line`, `bg-accent`,
`text-accent-ink`, `text-ok`, `text-tally` and so on, and follow the brand in light and dark mode.

## Errors never break the app

- An extension with another `apiVersion`, a bad id or a wrong manifest is not loaded. A message at the top of the page
  says why, and the rest of the app works.
- A section that throws shows an error in its place. A badge that throws is left out.
- A type or syntax error stops the build, so a broken extension is never published.

## Test

An extension is tested like any React component: render the section with a made-up customer and a fake `save`, and
call the badge with made-up customers. See `next-step/index.test.tsx`. Never use real customer data in tests.

## Build, preview and publish

```
npm run preview                      the app with your extensions and made-up customers
npm run deploy                       checks brand.json, type-checks and builds your extensions, runs the tests,
                                     and writes the publish folder (profile/publicera)
```

Then publish the publish folder as before.

## Versions

The API version is `apiVersion: 1`. A change that would break existing extensions gets a new version; the app then
refuses extensions written for the old one, with a clear message, until they are updated.
