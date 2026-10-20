/* Login in the cloud with Cloudflare Access. Access stands in front of the whole domain and lets in the owner (and
 * agents with a service token); it adds a signed token, Cf-Access-Jwt-Assertion, to every request it lets through.
 * The Worker checks that token again (in case a request reaches it another way): RS256 against the team's public keys
 * (https://<team>/cdn-cgi/access/certs), the application's audience tag, the issuer and the time. Revoking a service
 * token or a person is done in Cloudflare. */
import type {MiddlewareHandler} from 'hono';
import {ApiError, errorResponse} from './errors';

export interface AccessConfig {
  /** the team's domain, e.g. example.cloudflareaccess.com */
  teamDomain: string;
  /** the Access application's audience (AUD) tag */
  aud: string;
  /** the team's public keys (default: fetched from the team's certs address) */
  fetchKeys?: () => Promise<(JsonWebKey & {kid?: string})[]>;
  /** seconds since 1970 (for the tests) */
  now?: () => number;
}

/** Who a valid token belongs to: a person (email) or a service token (its common name) */
export type Identity = {email: string} | {serviceToken: string};

const SKEW = 60;
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0));
const decodeJson = (s: string) => JSON.parse(new TextDecoder().decode(fromB64url(s))) as Record<string, unknown>;

// The keys per configuration, kept until a token names a key that is not among them (the team rotated its keys)
const keyCache = new WeakMap<AccessConfig, Map<string, CryptoKey>>();

async function loadKeys(config: AccessConfig): Promise<Map<string, CryptoKey>> {
  const fetchKeys = config.fetchKeys ?? (async () => {
    const res = await fetch(`https://${config.teamDomain}/cdn-cgi/access/certs`);
    if (!res.ok) throw new Error('could not fetch the Access keys');
    return ((await res.json()) as {keys: (JsonWebKey & {kid?: string})[]}).keys;
  });
  const map = new Map<string, CryptoKey>();
  for (const jwk of await fetchKeys()) {
    if (!jwk.kid || jwk.kty !== 'RSA') continue;
    map.set(jwk.kid, await crypto.subtle.importKey('jwk', jwk, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']));
  }
  keyCache.set(config, map);
  return map;
}

/** Checks an Access token; throws if it is not valid for this team and application */
export async function verifyAccessToken(token: string, config: AccessConfig): Promise<Identity> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some(p => !p)) throw new Error('malformed token');
  const header = decodeJson(parts[0]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('unexpected algorithm');
  let key = keyCache.get(config)?.get(header.kid);
  if (!key) key = (await loadKeys(config)).get(header.kid);
  if (!key) throw new Error('unknown key');
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromB64url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new Error('bad signature');
  const claims = decodeJson(parts[1]);
  const now = config.now ? config.now() : Math.floor(Date.now() / 1000);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(config.aud)) throw new Error('wrong audience');
  if (claims.iss !== `https://${config.teamDomain}`) throw new Error('wrong issuer');
  if (typeof claims.exp !== 'number' || claims.exp < now - SKEW) throw new Error('expired');
  if (typeof claims.nbf === 'number' && claims.nbf > now + SKEW) throw new Error('not valid yet');
  if (typeof claims.email === 'string' && claims.email) return {email: claims.email};
  if (typeof claims.common_name === 'string' && claims.common_name) return {serviceToken: claims.common_name};
  throw new Error('no identity');
}

/** Middleware: 401 without a valid Access token. Never logs the token or who it is */
export function accessCheck(config: AccessConfig): MiddlewareHandler {
  return async (c, next) => {
    const token = c.req.header('Cf-Access-Jwt-Assertion');
    if (!token) return errorResponse(c, new ApiError(401, 'unauthenticated', 'Sign in through Cloudflare Access'));
    try {
      await verifyAccessToken(token, config);
    } catch {
      return errorResponse(c, new ApiError(401, 'invalid_token', 'The Access token is not valid'));
    }
    await next();
  };
}
