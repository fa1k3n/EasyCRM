/* The globals an integration plugin has besides JavaScript's own (ES2022): URL, URLSearchParams and structuredClone.
 * Nothing else: no fetch, no process, no require. The plugin reaches the service only through ctx.fetch. */
declare class URLSearchParams {
  constructor(init?: string | Record<string, string>);
  get(name: string): string | null;
  set(name: string, value: string): void;
  append(name: string, value: string): void;
  has(name: string): boolean;
  toString(): string;
}
declare class URL {
  constructor(url: string, base?: string);
  href: string; protocol: string; host: string; hostname: string; pathname: string; search: string; hash: string;
  readonly searchParams: URLSearchParams;
  toString(): string;
}
declare function structuredClone<T>(value: T): T;
