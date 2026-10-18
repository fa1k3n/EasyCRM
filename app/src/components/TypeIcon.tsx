import {icons} from 'lucide-react';
import type {ReactNode} from 'react';
import {logic} from '../logic';

/* The app's own icon set from the first version (16×16, drawn with currentColor). The names are the ones brand.json
 * has always used (logic().OWN_ICONS). */
const s = {stroke: 'currentColor', strokeWidth: 1.5} as const;
const OWN: Record<string, ReactNode> = {
  person: <><path d="M8 8.2a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4Z" {...s} /><path d="M2.8 14c.6-2.6 2.7-4.1 5.2-4.1s4.6 1.5 5.2 4.1" {...s} strokeLinecap="round" /></>,
  kamera: <><rect x="1.5" y="4.5" width="13" height="9" rx="2" {...s} /><path d="M5.5 4.5 6.6 2.8h2.8l1.1 1.7" {...s} strokeLinejoin="round" /><circle cx="8" cy="9" r="2.4" {...s} /></>,
  film: <><rect x="1.5" y="4" width="9.5" height="8" rx="1.8" {...s} /><path d="m11 7 3.5-2v6L11 9" {...s} strokeLinejoin="round" /></>,
  sandning: <><circle cx="8" cy="8" r="1.8" fill="currentColor" /><path d="M5 5a4.2 4.2 0 0 0 0 6M11 5a4.2 4.2 0 0 1 0 6M2.9 2.9a7.2 7.2 0 0 0 0 10.2M13.1 2.9a7.2 7.2 0 0 1 0 10.2" {...s} strokeLinecap="round" /></>,
  pokal: <><path d="M4.5 2.5h7v3a3.5 3.5 0 0 1-7 0v-3Z" {...s} strokeLinejoin="round" /><path d="M4.5 3.5H2.5v1a2 2 0 0 0 2 2M11.5 3.5h2v1a2 2 0 0 1-2 2M8 9v2.5M5.5 13.5h5" {...s} strokeLinecap="round" /></>,
  pratbubbla: <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2v-7Z" {...s} strokeLinejoin="round" />,
  portfolj: <><rect x="1.5" y="4.5" width="13" height="9" rx="1.8" {...s} /><path d="M5.5 4.5v-2h5v2M1.5 8.5h13" {...s} /></>,
  stjarna: <path d="m8 1.8 1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6L8 1.8Z" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />,
  kalender: <><rect x="1.5" y="3" width="13" height="11" rx="2" {...s} /><path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" {...s} strokeLinecap="round" /></>,
  prick: <circle cx="8" cy="8" r="4" fill="currentColor" />
};

// "calendar-days" → "CalendarDays", the key in lucide's icon map
const pascal = (name: string) => name.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');

/* A customer type's icon in the type's colour, with its name for screen readers (and as a tooltip). The icon is the
 * brand's own svg (the one exception to "no HTML from data": it comes from the owner's brand.json and validateBrand
 * only lets drawing elements through), an icon of the own set, a lucide icon, or the dot if the name is unknown.
 * decorative: the type's name is already written next to it, so the icon has no text of its own. */
export default function TypeIcon({id, size = 17, decorative = false}: {id: string; size?: number; decorative?: boolean}) {
  const L = logic();
  const label = L.SERVICE_TYPES[id] || id;
  const spec = L.typeIcon(id);
  const Lucide = spec.kind === 'lucide' ? icons[pascal(spec.name) as keyof typeof icons] : undefined;
  const box = {width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true} as const;
  return (
    <span title={decorative ? undefined : label} className="inline-flex flex-none" style={{color: `var(--t-${id})`}}>
      {spec.kind === 'svg' ? <svg {...box} dangerouslySetInnerHTML={{__html: spec.svg}} />
        : Lucide ? <Lucide size={size} strokeWidth={2} aria-hidden="true" />
        : <svg {...box}>{OWN[spec.kind === 'own' ? spec.name : 'prick'] ?? OWN.prick}</svg>}
      {!decorative && <span className="sr-only">{label}</span>}
    </span>
  );
}
