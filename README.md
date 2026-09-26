# [<img src="https://s3.vpndetection.io/vpndetection-public/brand/mark.svg" alt="VPNDetection" height="28"/>](https://vpndetection.io/) VPNDetection Next.js Middleware

[![npm](https://img.shields.io/npm/v/vpndetection-next.svg)](https://www.npmjs.com/package/vpndetection-next)
[![license](https://img.shields.io/npm/l/vpndetection-next.svg)](LICENSE)

The official [Next.js](https://nextjs.org) proxy middleware for the [VPNDetection](https://vpndetection.io) API.

It classifies the visitor behind each request — VPN, residential proxy, Tor, hosting, CDN, relay — and forwards the answer to your app, where Server Components and Route Handlers can read it. Blocking is opt-in.

## Getting Started

```bash
npm install vpndetection-next
```

Requires Node.js 22 or newer and Next.js 15 or newer.

You need an API key. Create one in the [console](https://app.vpndetection.io); the free tier's allowance is counted per source address, and a deployment is a single source address, so a key is what makes this usable in production rather than optional.

Next 16 renamed the file convention from `middleware.ts` to `proxy.ts`, and the export from `middleware` to `proxy`. Both work on 16 — `middleware.ts` logs a deprecation — so use whichever your version supports.

```ts
// proxy.ts  (middleware.ts on Next 15)
import { createProxy } from 'vpndetection-next';

export const proxy = createProxy({ apiKey: process.env.VPNDETECTION_API_KEY });

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
```

Then read the answer anywhere downstream:

```tsx
// app/page.tsx
import { headers } from 'next/headers';
import { readLookup } from 'vpndetection-next';

export default async function Page() {
    const lookup = readLookup(await headers());
    return <main>{lookup?.isVpn ? 'Hello, VPN user' : 'Hello'}</main>;
}
```

By default nothing is blocked. Your own code decides what the answer means — which is usually what you want, because whether a VPN visitor is a problem depends entirely on what they are doing.

**Set a `matcher`.** Without one the proxy runs on every request including static assets, which costs a lookup each.

## Blocking

Pass a `blockCondition` and a matching request is answered with `403` and never reaches your app.

```ts
export const proxy = createProxy({
    apiKey: process.env.VPNDETECTION_API_KEY,
    blockCondition: { isVpn: true },
});
```

A condition is written in the shape of a result, and only the members you name are considered. That lets it reach the evidence, not just the flags:

```ts
blockCondition: { isVpn: true, vpn: { provider: 'nordvpn' } }         // one provider
blockCondition: { isResproxy: true, resproxy: { hits: { gte: 5 } } }  // a numeric threshold
blockCondition: { vpn: { confidence: ['high', 'medium'] } }           // any of these
blockCondition: [{ isTor: true }, { isResproxy: true }]               // a list is OR
```

Values are matched by equality, strings without regard to case. An array means any-of. `{ gte, gt, lte, lt }` compares numbers, and every bound you give must hold, so two of them are a range. Members you set to `false` or `null` are ignored, so a condition states the signals you act on; one that constrains nothing would match every request, and is refused when the proxy is created rather than silently blocking all your traffic.

Replace the refusal with `onBlocked` — a redirect is usually friendlier than a 403:

```ts
onBlocked: (request) => NextResponse.redirect(new URL('/no-vpn', request.url)),
```

## Doing other work in the same proxy

Most apps already have a proxy. Use `createGuard` and call it from yours:

```ts
import { NextResponse } from 'next/server';
import { createGuard } from 'vpndetection-next';

const guard = createGuard({ apiKey: process.env.VPNDETECTION_API_KEY });

export async function proxy(request: NextRequest) {
    const lookup = await guard(request);
    if (lookup?.result?.isTor) {
        return NextResponse.redirect(new URL('/verify', request.url));
    }
    return guard.forward(request, lookup);
}
```

`guard.forward` continues to your app carrying the answer. Return it rather than a bare `NextResponse.next()`, or nothing downstream can read the lookup.

## Where the client address comes from

This is the setting that decides whether any of the above works, and Next makes it more your problem than most frameworks do.

**Next has no socket peer to offer.** `NextRequest.ip` was removed in Next 15, and a proxy runs ahead of the server, so a forwarded header is the only address available — this is the one place where the default is a header rather than a connection.

The default reads the left-most `X-Forwarded-For` entry. That is correct when the platform in front of you **overwrites** the header, which Vercel does and any ingress you control can be configured to. Behind something that **appends**, the left-most entry is whatever the visitor sent, and detection silently does nothing.

For a platform that writes its own header, name it:

```ts
import { headerIpSelector } from 'vpndetection-next';

createProxy({
    apiKey: process.env.VPNDETECTION_API_KEY,
    ipSelector: headerIpSelector('CF-Connecting-IP'),  // or True-Client-IP, or your own
});
```

If you know how many proxies sit in front, count from the right: `xffIpSelector({ depth: 1 })` is the address your nearest proxy saw. Anything else, pass your own function — it receives the `NextRequest` and returns an address.

If the address resolves to a private one, or to nothing at all, the proxy says so once on `console.warn`. That is expected running locally and is the signal to fix your configuration anywhere else.

## The forwarded header

The answer travels to your app on `x-vpndetection`, because a proxy runs in its own context and a request header is the only thing that crosses into it.

**Any copy the caller sent is deleted before ours is written.** That overwrite is the entire basis of trusting it downstream — without it a visitor could set the header themselves and tell your app whatever they liked about their own address. It is the same rule an ingress follows for a real-IP header, and it holds even when the request was skipped.

Turn it off with `forward: false` if you only ever block and never read the answer.

## When a lookup fails

The request is let through, and the reason is on `lookup.error`. Our outage should not become yours, so a network failure, an exhausted quota or a rejected key all fail open. Pass `failClosed: true` to block instead.

## Cost and latency

Answers are cached for an hour per proxy instance, so a returning visitor costs nothing, and private addresses never leave the process. A cache miss is one request to our API, bounded at 2500 ms by default and not retried — on a request path, failing open quickly beats holding a visitor while we try again.

```ts
createProxy({ apiKey: KEY, timeoutMs: 1000, retries: 1, cache: { max: 50000, ttlMs: 600000 } })
```

A serverless deployment gets less from the cache than a long-running one, because the instance holding it is short-lived. Narrow the `matcher`, or `skip` what you do not care about:

```ts
skip: (request) => request.nextUrl.pathname.startsWith('/api/health'),
```

Beyond a few million distinct visitors a day, stop calling the API per request: [download the dataset](https://vpndetection.io/databases) and look addresses up locally instead.

## Absent is not false

Only `ip` and `isVpn` come back on every plan. A field your plan does not include is absent, which means "not in your plan" rather than "checked, and no".

```ts
lookup.result?.is_hosting ?? false   // when you only want the flag
```

A `blockCondition` naming a member your plan does not serve can never match, so the proxy warns once instead of failing silently. Set `onMissingField: 'throw'` to make it an error.

## Other Libraries

There are official VPNDetection client libraries available for many languages including PHP, Python, Go, Java, Ruby, and many popular frameworks such as Django, Rails, and Laravel. See our GitHub at https://github.com/vpndetection-io for more.

## About VPNDetection

VPN Detection API: Accurate anonymity detection identifying VPNs, residential proxies, hosting servers, Tor nodes, CDNs, relays and more.

[<img src="https://s3.vpndetection.io/vpndetection-public/brand/mark.svg" alt="VPNDetection" width="96"/>](https://vpndetection.io/)

## License

This project is licensed under the [MIT License](LICENSE).
