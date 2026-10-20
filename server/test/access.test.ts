/* Login in the cloud: the Worker only answers requests that Cloudflare Access let through, checked again in the Worker
 * (the token in Cf-Access-Jwt-Assertion: RS256 against the team's keys, audience, issuer and time). Service tokens for
 * agents give the same kind of token. Without Access settings the Worker only answers on localhost (wrangler dev). */
import {accessCheck, verifyAccessToken, type AccessConfig} from '../src/access';
import {createWorker} from '../src/worker';
import {fakeD1} from './fakeD1';

const TEAM = 'exempel.cloudflareaccess.com';
const AUD = 'aud-tag-0000';
const NOW = 1_800_000_000;

const b64url = (data: ArrayBuffer | Uint8Array | string) =>
  Buffer.from(typeof data === 'string' ? data : new Uint8Array(data as ArrayBuffer)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

let keys: {kid: string; pair: CryptoKeyPair}[];
beforeAll(async () => {
  const gen = () => crypto.subtle.generateKey({name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'}, true, ['sign', 'verify']);
  keys = [{kid: 'k1', pair: await gen()}, {kid: 'k2', pair: await gen()}];
});

const jwks = async (which = ['k1']) => Promise.all(keys.filter(k => which.includes(k.kid))
  .map(async k => ({...(await crypto.subtle.exportKey('jwk', k.pair.publicKey)), kid: k.kid})));

async function token(claims: Record<string, unknown> = {}, {kid = 'k1', alg = 'RS256'} = {}) {
  const header = b64url(JSON.stringify({alg, kid, typ: 'JWT'}));
  const body = b64url(JSON.stringify({aud: [AUD], iss: `https://${TEAM}`, iat: NOW - 10, nbf: NOW - 10, exp: NOW + 600, email: 'agare@exempel.se', ...claims}));
  const key = keys.find(k => k.kid === kid)!.pair.privateKey;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${b64url(sig)}`;
}

const config = (over: Partial<AccessConfig> = {}): AccessConfig => ({teamDomain: TEAM, aud: AUD, fetchKeys: () => jwks(), now: () => NOW, ...over});

describe('verifyAccessToken', () => {
  test('a valid token gives who it is: a person\'s email or a service token\'s common_name', async () => {
    expect(await verifyAccessToken(await token(), config())).toEqual({email: 'agare@exempel.se'});
    expect(await verifyAccessToken(await token({email: undefined, common_name: 'agent-1.access'}), config())).toEqual({serviceToken: 'agent-1.access'});
  });

  test('an audience given as text (not a list) is accepted', async () => {
    expect(await verifyAccessToken(await token({aud: AUD}), config())).toEqual({email: 'agare@exempel.se'});
  });

  test.each([
    ['another audience', {aud: ['other']}, {}],
    ['another issuer', {iss: 'https://evil.cloudflareaccess.com'}, {}],
    ['expired (beyond the 60 s clock tolerance)', {exp: NOW - 120}, {}],
    ['not valid yet', {nbf: NOW + 120}, {}],
    ['signed with an unknown key', {}, {kid: 'k2'}],
    ['another algorithm', {}, {alg: 'HS256'}]
  ])('%s is refused', async (_name, claims, opts) => {
    await expect(verifyAccessToken(await token(claims, opts), config())).rejects.toThrow();
  });

  test('a changed body or a broken token is refused', async () => {
    const [h, , s] = (await token()).split('.');
    const forged = b64url(JSON.stringify({aud: [AUD], iss: `https://${TEAM}`, exp: NOW + 600, email: 'annan@exempel.se'}));
    await expect(verifyAccessToken(`${h}.${forged}.${s}`, config())).rejects.toThrow();
    for (const bad of ['', 'abc', 'a.b', 'a.b.c']) await expect(verifyAccessToken(bad, config())).rejects.toThrow();
  });

  test('a new key (rotation) is fetched when a token has an unknown kid; the keys are cached otherwise', async () => {
    let calls = 0, which = ['k1'];
    const cfg = config({fetchKeys: () => { calls++; return jwks(which); }});
    await verifyAccessToken(await token(), cfg);
    await verifyAccessToken(await token(), cfg);
    expect(calls).toBe(1);
    which = ['k1', 'k2'];
    expect(await verifyAccessToken(await token({}, {kid: 'k2'}), cfg)).toEqual({email: 'agare@exempel.se'});
    expect(calls).toBe(2);
  });
});

describe('accessCheck in the app (the Worker)', () => {
  const env = (over: Record<string, unknown> = {}) => ({DB: fakeD1(), ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ...over});
  const worker = createWorker({now: () => NOW, fetchKeys: () => jwks()});
  const call = (e: ReturnType<typeof env>, url: string, headers: Record<string, string> = {}) =>
    worker.fetch(new Request(url, {headers}), e as never);

  test('with a valid token the API answers', async () => {
    const res = await call(env(), 'https://crm.example/api/v1/health', {'Cf-Access-Jwt-Assertion': await token()});
    expect(res.status).toBe(200);
  });

  test('without a token: 401 "unauthenticated"; with a bad token: 401 "invalid_token"', async () => {
    const e = env();
    const none = await call(e, 'https://crm.example/api/v1/customers');
    expect(none.status).toBe(401);
    expect((await none.json()).error.code).toBe('unauthenticated');
    const bad = await call(e, 'https://crm.example/api/v1/customers', {'Cf-Access-Jwt-Assertion': await token({aud: ['x']})});
    expect(bad.status).toBe(401);
    expect((await bad.json()).error.code).toBe('invalid_token');
  });

  test('without Access settings the Worker refuses every request from the internet (503) but answers on localhost', async () => {
    const e = env({ACCESS_TEAM_DOMAIN: undefined, ACCESS_AUD: undefined});
    const res = await call(e, 'https://crm.example/api/v1/health');
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('access_not_configured');
    expect((await call(e, 'http://localhost:8787/api/v1/health')).status).toBe(200);
    expect((await call(e, 'http://127.0.0.1:8787/api/v1/health')).status).toBe(200);
  });

  test('without Access settings: wrangler dev with a route (loopback CF-Connecting-IP) is answered, an internet client is not', async () => {
    const e = env({ACCESS_TEAM_DOMAIN: undefined, ACCESS_AUD: undefined});
    expect((await call(e, 'https://crm.example/api/v1/health', {'CF-Connecting-IP': '127.0.0.1'})).status).toBe(200);
    expect((await call(e, 'https://crm.example/api/v1/health', {'CF-Connecting-IP': '::1'})).status).toBe(200);
    expect((await call(e, 'https://crm.example/api/v1/health', {'CF-Connecting-IP': '203.0.113.5'})).status).toBe(503);
  });

  test('accessCheck can be used on its own app: the token is checked before the route', async () => {
    const {Hono} = await import('hono');
    const app = new Hono();
    app.use('*', accessCheck(config()));
    app.get('/x', c => c.text('ok'));
    expect((await app.request('/x')).status).toBe(401);
    expect((await app.request('/x', {headers: {'Cf-Access-Jwt-Assertion': await token()}})).status).toBe(200);
  });
});
