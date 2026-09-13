// The published package, driving a real proxy, against staging.
//
// The unit suite stubs the transport, so it proves the wiring and nothing about
// the artifact a stranger installs: a `files` list shipping no `dist`, an
// export map a consumer cannot resolve, or a release that never landed all pass
// it. It also cannot prove that the API key reaches the wire, because a stub
// answers the same either way.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NextRequest } from 'next/server.js';
import { createProxy, readLookup } from 'vpndetection-next';

import { MAX_RUNG, RUNGS, keyFor, skipFor } from '../lib/tiers.mjs';

const BASE_URL = 'https://api-staging.vpndetection.io';

// A known VPN address on staging, which serves real data. Sent as the client
// address through a selector rather than by spoofing a header, so the test is
// about the lookup rather than about trust-proxy configuration.
const VPN_IP = '45.83.91.1';

function serve(options) {
    const proxy = createProxy({ baseUrl: BASE_URL, ipSelector: () => VPN_IP, ...options });
    return async () => {
        const response = await proxy(new NextRequest(new Request('https://example.test/')));
        const forwarded = readLookup(overriddenHeaders(response)) ?? {};
        return {
            status: response.status,
            body: {
                ip: forwarded.ip ?? null,
                error: forwarded.error ?? null,
                members: Object.keys(forwarded.result ?? {}).sort(),
            },
        };
    };
}

// NextResponse.next({ request: { headers } }) records the onward headers rather
// than setting them on the response, so this is what the app would actually see.
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

for (const rung of RUNGS) {
    test(`${rung.tier}: the proxy enriches a request`, { skip: skipFor(rung) }, async () => {
        const call = serve({ apiKey: keyFor(rung) || undefined });
        const res = await call();
        assert.equal(res.status, 200, 'enrichment alone must never refuse a request');
        assert.equal(res.body.error, null, `lookup failed: ${res.body.error}`);
        assert.equal(res.body.ip, VPN_IP);
        assert.ok(res.body.members.includes('is_vpn'), 'is_vpn is on every plan');
    });
}

test('the key reaches the wire', { skip: skipFor(MAX_RUNG) }, async () => {
    const withKey = serve({ apiKey: keyFor(MAX_RUNG) });
    const withoutKey = serve({ apiKey: undefined });

    const paid = (await withKey()).body.members;
    const anonymous = (await withoutKey()).body.members;

    // Not a field COUNT, which a pricing change would turn red: the max tier
    // serving no more than an anonymous caller is what a dropped key looks like.
    assert.ok(
        paid.length > anonymous.length,
        `max served ${paid.join(',')} and unauthenticated served ${anonymous.join(',')},`
        + ' so the key did not reach the request',
    );
    for (const member of anonymous) {
        assert.ok(paid.includes(member), `max is missing ${member}, which unauthenticated served`);
    }
});

test('a condition blocks a real answer', { skip: skipFor(MAX_RUNG) }, async () => {
    const call = serve({ apiKey: keyFor(MAX_RUNG), blockCondition: { isVpn: true } });
    assert.equal((await call()).status, 403);
});

test('a clean address is not blocked', { skip: skipFor(MAX_RUNG) }, async () => {
    const call = serve({
        apiKey: keyFor(MAX_RUNG),
        ipSelector: () => '1.1.1.1',
        blockCondition: { isVpn: true },
    });
    assert.equal((await call()).status, 200);
});

test('an unreachable API fails open', async () => {
    // A reserved-for-documentation host that resolves to nothing routable, so
    // this exercises a transport failure rather than an error response.
    const call = serve({
        baseUrl: 'https://api.invalid.vpndetection.example',
        blockCondition: { isVpn: true },
        timeoutMs: 2000,
    });
    const res = await call();
    assert.equal(res.status, 200, 'an outage of ours must not take the customer down');
    assert.ok(res.body.error !== null, 'and the reason must be on the request');
});
