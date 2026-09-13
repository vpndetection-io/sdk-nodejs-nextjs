// The adapter, driven with real NextRequest/NextResponse objects.
//
// Next has no socket peer to offer - `NextRequest.ip` was removed in Next 15 -
// so every address here arrives on a header. That is not a shortcut in the
// test: it is the only thing the runtime exposes, which is why this adapter's
// default selector is a header rather than a connection.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NextRequest, NextResponse } from 'next/server.js';
import { VPNDetection } from 'vpndetection';

import {
    LOOKUP_HEADER, createGuard, createProxy, defaultIpSelector, headerIpSelector, readLookup,
    xffIpSelector,
} from '../dist/index.js';

const PUBLIC_IP = '45.83.91.1';

function stubClient(body = { is_vpn: true, vpn: { provider: 'nordvpn' } }) {
    const asked = [];
    const client = new VPNDetection({
        cache: false,
        retries: 0,
        fetch: async (input) => {
            const url = new URL(typeof input === 'string' ? input : input.url);
            const ip = decodeURIComponent(url.pathname.slice(1));
            asked.push(ip);
            return new Response(JSON.stringify({ ip: ip, ...body }), {
                status: 200, headers: { 'content-type': 'application/json' },
            });
        },
    });
    return { client: client, asked: asked };
}

function request(headers = {}, url = 'https://example.test/') {
    return new NextRequest(new Request(url, { headers: headers }));
}

const fixedIp = () => PUBLIC_IP;

test('continues and forwards the answer to the app', async () => {
    const { client: client, asked: asked } = stubClient();
    const proxy = createProxy({ client: client, ipSelector: fixedIp });

    const response = await proxy(request());
    assert.equal(response.status, 200);

    const forwarded = readLookup(overriddenHeaders(response));
    assert.equal(forwarded.ip, PUBLIC_IP);
    assert.equal(forwarded.isVpn, true);
    assert.equal(forwarded.blocked, false);
    assert.deepEqual(asked, [PUBLIC_IP]);
});

// NextResponse.next({ request: { headers } }) does not put the headers on the
// response; it records them for the server to replay onto the onward request.
// Reading them back is the only way to assert what the app will actually see.
function overriddenHeaders(response) {
    const overridden = {};
    for (const [name, value] of response.headers) {
        const match = name.match(/^x-middleware-request-(.+)$/);
        if (match) {
            overridden[match[1]] = value;
        }
    }
    return { get: (name) => overridden[name.toLowerCase()] ?? null };
}

test('blocks with 403 when the condition matches, and passes when it does not', async () => {
    const vpn = stubClient({ is_vpn: true, vpn: { provider: 'nordvpn' } });
    const blocking = createProxy({
        client: vpn.client, ipSelector: fixedIp, blockCondition: { isVpn: true },
    });
    const denied = await blocking(request());
    assert.equal(denied.status, 403);
    assert.deepEqual(await denied.json(), { error: 'access denied' });

    const clean = stubClient({ is_vpn: false, vpn: {} });
    const allowing = createProxy({
        client: clean.client, ipSelector: fixedIp, blockCondition: { isVpn: true },
    });
    assert.equal((await allowing(request())).status, 200);
});

test('onBlocked replaces the refusal entirely', async () => {
    const { client: client } = stubClient();
    const proxy = createProxy({
        client: client,
        ipSelector: fixedIp,
        blockCondition: { isVpn: true },
        onBlocked: (req, lookup) => NextResponse.redirect(
            new URL(`/no-vpn?p=${lookup.result.vpn.provider}`, req.url),
        ),
    });
    const response = await proxy(request());
    assert.equal(response.status, 307);
    assert.match(response.headers.get('location'), /\/no-vpn\?p=nordvpn$/);
});

// The whole basis of trusting the header downstream. Without the delete, a
// visitor sets it themselves and tells the app whatever they like.
test('a forged lookup header from the caller is deleted before ours is set', async () => {
    const { client: client } = stubClient();
    const proxy = createProxy({ client: client, ipSelector: fixedIp });

    const forged = JSON.stringify({ ip: '8.8.8.8', isVpn: false, blocked: false });
    const response = await proxy(request({ [LOOKUP_HEADER]: forged }));

    const forwarded = readLookup(overriddenHeaders(response));
    assert.equal(forwarded.ip, PUBLIC_IP, 'the forgery survived into the app');
    assert.equal(forwarded.isVpn, true);
});

test('a forged header is deleted even when nothing was looked up', async () => {
    const { client: client } = stubClient();
    const proxy = createProxy({
        client: client, ipSelector: fixedIp, skip: () => true,
    });
    const forged = JSON.stringify({ ip: '8.8.8.8', isVpn: false, blocked: false });
    const response = await proxy(request({ [LOOKUP_HEADER]: forged }));
    assert.equal(readLookup(overriddenHeaders(response)), undefined,
        'a skipped request must not carry a caller-supplied answer');
});

test('forward: false leaves the header off entirely', async () => {
    const { client: client } = stubClient();
    const proxy = createProxy({ client: client, ipSelector: fixedIp, forward: false });
    const response = await proxy(request());
    assert.equal(readLookup(overriddenHeaders(response)), undefined);
});

test('createGuard composes with a proxy that does other work', async () => {
    const { client: client } = stubClient();
    const guard = createGuard({ client: client, ipSelector: fixedIp });

    const req = request();
    const lookup = await guard(req);
    assert.equal(lookup.result.isVpn, true);
    assert.equal(lookup.blocked, false);

    const response = guard.forward(req, lookup);
    assert.equal(readLookup(overriddenHeaders(response)).isVpn, true);
});

test('skip claims the request and costs no lookup', async () => {
    const { client: client, asked: asked } = stubClient();
    const proxy = createProxy({
        client: client, ipSelector: fixedIp, blockCondition: { isVpn: true },
        skip: (req) => req.nextUrl.pathname === '/',
    });
    assert.equal((await proxy(request())).status, 200);
    assert.deepEqual(asked, []);
});

test('a failing lookup lets the visitor through', async () => {
    const failing = new VPNDetection({
        retries: 0,
        fetch: async () => new Response('{"error":"boom"}', { status: 500 }),
    });
    const proxy = createProxy({
        client: failing, ipSelector: fixedIp, blockCondition: { isVpn: true },
    });
    const response = await proxy(request());
    assert.equal(response.status, 200);
    assert.equal(readLookup(overriddenHeaders(response)).error, 'server_error');
});

test('selectors read what they say they read', () => {
    const chained = request({ 'x-forwarded-for': `${PUBLIC_IP}, 70.41.3.18, 150.172.238.178` });
    assert.equal(defaultIpSelector(chained), PUBLIC_IP);
    assert.equal(xffIpSelector()(chained), PUBLIC_IP);
    assert.equal(xffIpSelector({ depth: 1 })(chained), '150.172.238.178');

    const cf = request({ 'cf-connecting-ip': '45.83.91.9' });
    assert.equal(headerIpSelector('CF-Connecting-IP')(cf), '45.83.91.9');
    assert.equal(defaultIpSelector(request({})), undefined,
        'Next has no socket peer, so with no forwarded header there is no address');
});

test('no resolvable address fails open rather than blocking everyone', async () => {
    const { client: client } = stubClient();
    const warnings = [];
    const proxy = createProxy({
        client: client, blockCondition: { isVpn: true }, onWarn: (m) => warnings.push(m),
    });
    const response = await proxy(request({}));
    assert.equal(response.status, 200);
    assert.match(warnings[0], /could not resolve a client address/);
});

test('the deadline bounds the request rather than the visitor waiting on us', async () => {
    const hung = new VPNDetection({ retries: 0, fetch: () => new Promise(() => {}) });
    const proxy = createProxy({
        client: hung, ipSelector: fixedIp, timeoutMs: 150, blockCondition: { isVpn: true },
    });
    const started = Date.now();
    const response = await proxy(request());
    assert.equal(response.status, 200);
    assert.equal(readLookup(overriddenHeaders(response)).error, 'network');
    assert.ok(Date.now() - started < 3000, 'the visitor was held past the budget');
});

test('a condition that constrains nothing is refused at construction', () => {
    assert.throws(() => createProxy({ blockCondition: { isVpn: false } }), /constrains nothing/);
    assert.throws(() => createGuard({ blockCondition: {} }), /constrains nothing/);
});
