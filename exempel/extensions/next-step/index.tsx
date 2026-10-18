/* Example extension: "Nästa steg" (next step). It adds a section to the customer card where you note the next thing
 * to do with the customer and by when, and a badge on the customer's row in the list while a next step is noted.
 * It shows the whole extension API, version 1: a manifest, a customer section that reads the customer and saves in
 * its own field (customer.ext["next-step"]), and a list badge. See ../README.md for how to write, build and publish
 * an extension. */
import {useState} from 'react';
import type {CustomerSectionProps, ExtensionManifest, ReadonlyCustomer} from 'crm-extension-api';

/** What this extension saves for a customer (any JSON works; this is its own choice) */
interface NextStepData { text: string; date: string }

const ID = 'next-step';
const field = 'min-w-0 rounded-md border border-line bg-bg px-2.5 py-2';

/* The section on the customer card. `data` is what was saved last time; `save` writes only this extension's field. */
export function NextStep({data, save, canWrite}: CustomerSectionProps<NextStepData>) {
  const [text, setText] = useState(data?.text ?? '');
  const [date, setDate] = useState(data?.date ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  if (!canWrite) return <p>{data?.text || '–'}{data?.date ? ` (${data.date})` : ''}</p>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    try {
      await save({text: text.trim(), date});
      setStatus('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  };
  return (
    <form onSubmit={submit} className="grid grid-cols-[1fr_auto] gap-2">
      <input aria-label="Nästa steg" placeholder="t.ex. Ring om offerten" value={text} onChange={e => setText(e.target.value)} className={`${field} col-span-2`} />
      <input type="date" aria-label="Senast" value={date} onChange={e => setDate(e.target.value)} className={field} />
      <button type="submit" disabled={status === 'saving'} className="rounded-full bg-accent px-4 py-1.5 font-bold text-accent-ink disabled:opacity-60">Spara</button>
      {status === 'saved' && <p className="col-span-2 text-[13px] text-ok">Sparat</p>}
      {status === 'error' && <p role="alert" className="col-span-2 text-[13px] text-tally">Kunde inte spara: {error}</p>}
    </form>
  );
}

/* The badge on the list row: shown while a next step is noted, with its date if there is one. */
function badge(c: ReadonlyCustomer) {
  const d = c.ext?.[ID] as NextStepData | undefined;
  if (!d?.text) return null;
  return {text: d.date ? `Nästa steg ${d.date}` : 'Nästa steg', title: d.text};
}

const manifest: ExtensionManifest = {
  id: ID,
  apiVersion: 1,
  name: 'Nästa steg',
  customerSections: [{id: 'next-step', title: 'Nästa steg', Component: NextStep}],
  listBadges: [badge]
};
export default manifest;
