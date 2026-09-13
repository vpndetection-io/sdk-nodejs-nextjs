import { bindSelectors, createCore } from 'vpndetection/middleware';
import type { IpSelector, Lookup, MiddlewareOptions } from 'vpndetection/middleware';

import { NextResponse } from 'next/server.js';
import type { NextRequest } from 'next/server.js';

export type { BlockCondition, IpSelector, Lookup, NumericBound } from 'vpndetection/middleware';

/**
 * The header the answer is forwarded on, so a Server Component or Route
 * Handler can read what the proxy already looked up.
 */
export const LOOKUP_HEADER = 'x-vpndetection';

/** What `readLookup` gives back. The detail objects are carried through as served. */
export interface ForwardedLookup {
    ip?: string;
    isVpn?: boolean;
    blocked: boolean;
    error?: string;
    result?: Record<string, unknown>;
}

export interface Options extends MiddlewareOptions<NextRequest> {
    /**
     * How a blocked request is answered. Defaults to `403` with a short JSON
     * body. Return a `NextResponse`.
     */
    onBlocked?: (request: NextRequest, lookup: Lookup) => NextResponse | Promise<NextResponse>;
    /**
     * Forward the answer to your app on {@link LOOKUP_HEADER}, so a Server
     * Component or Route Handler can read it with `readLookup`. Defaults to
     * true. The proxy runs in its own context, so a header is the only way the
     * answer reaches the rest of your app.
     */
    forward?: boolean;
}

/**
 * A ready-made `proxy` export.
 *
 * ```ts
 * // proxy.ts
 * export const proxy = createProxy({ apiKey: process.env.VPNDETECTION_API_KEY });
 * ```
 *
 * If your proxy already does other work, use {@link createGuard} instead and
 * call it from your own function.
 */
export function createProxy(options: Options = {}) {
    const guard = createGuard(options);
    const onBlocked = options.onBlocked ?? refuse;

    return async function proxy(request: NextRequest): Promise<NextResponse> {
        const lookup = await guard(request);
        if (lookup?.blocked) {
            return onBlocked(request, lookup);
        }
        return guard.forward(request, lookup);
    };
}

/**
 * Classify the visitor, for a proxy that does other work too.
 *
 * ```ts
 * const guard = createGuard({ apiKey: process.env.VPNDETECTION_API_KEY });
 *
 * export async function proxy(request: NextRequest) {
 *     const lookup = await guard(request);
 *     if (lookup?.result?.isVpn) {
 *         return NextResponse.redirect(new URL('/no-vpn', request.url));
 *     }
 *     return guard.forward(request, lookup);
 * }
 * ```
 */
export function createGuard(options: Options = {}) {
    const core = createCore<NextRequest>(options, defaultIpSelector);
    const forwarding = options.forward !== false;

    const guard = async (request: NextRequest): Promise<Lookup | undefined> =>
        core.evaluate(request);

    /**
     * Continue to your app, carrying the answer on {@link LOOKUP_HEADER}.
     *
     * **Any copy the caller sent is deleted first**, which is the entire basis
     * of trusting it downstream: without that overwrite a visitor could set the
     * header themselves and tell your app whatever they liked about their own
     * address.
     */
    guard.forward = (request: NextRequest, lookup: Lookup | undefined): NextResponse => {
        const headers = new Headers(request.headers);
        headers.delete(LOOKUP_HEADER);
        if (forwarding && lookup !== undefined) {
            headers.set(LOOKUP_HEADER, JSON.stringify(toForwarded(lookup)));
        }
        return NextResponse.next({ request: { headers: headers } });
    };

    return guard;
}

/**
 * Read what the proxy found, from a Server Component or Route Handler.
 *
 * ```ts
 * import { headers } from 'next/headers';
 * const lookup = readLookup(await headers());
 * ```
 *
 * Answers `undefined` when the proxy did not run for this route, when `skip`
 * claimed the request, or when `forward` was turned off.
 */
export function readLookup(source: Headers | { get(name: string): string | null }):
    ForwardedLookup | undefined {
    const raw = source.get(LOOKUP_HEADER);
    if (raw === null || raw === '') {
        return undefined;
    }
    try {
        return JSON.parse(raw) as ForwardedLookup;
    } catch {
        return undefined;
    }
}

const view = (request: NextRequest) => ({
    header: (name: string) => request.headers.get(name) ?? undefined,
    frameworkIp: () => firstForwarded(request),
});

// Each of these is annotated rather than inferred: the inferred shape reaches
// through `next`'s own types into its transitive ones, which TypeScript refuses
// to name in a declaration file a consumer would have to resolve.
const selectors = bindSelectors<NextRequest>(view);

/**
 * The left-most `X-Forwarded-For` entry.
 *
 * **Next has no socket peer to offer.** `NextRequest.ip` was removed in Next
 * 15, and a proxy runs ahead of the server, so a forwarded header is the only
 * address available - which makes this the one adapter whose default is a
 * header rather than a connection.
 *
 * That is safe exactly when the platform in front of you OVERWRITES the header
 * (Vercel does, and so does any ingress you control that is configured to).
 * Behind something that APPENDS, the left-most entry is whatever the visitor
 * sent: use `headerIpSelector` for your platform's own header, or
 * `xffIpSelector({ depth })` to count from the right.
 */
export const defaultIpSelector: IpSelector<NextRequest> = selectors.defaultIpSelector;

/**
 * An address from `X-Forwarded-For`, left-most by default. `depth: 1` is the
 * address your nearest proxy saw, for a known number of trusted hops.
 */
export const xffIpSelector: (options?: { depth?: number }) => IpSelector<NextRequest>
    = selectors.xffIpSelector;

/**
 * An address from a single-value header your platform writes -
 * `headerIpSelector('CF-Connecting-IP')` behind Cloudflare,
 * `headerIpSelector('True-Client-IP')` behind Akamai.
 */
export const headerIpSelector: (name: string) => IpSelector<NextRequest>
    = selectors.headerIpSelector;

function firstForwarded(request: NextRequest): string | undefined {
    const chain = request.headers.get('x-forwarded-for');
    if (chain === null) {
        return undefined;
    }
    const first = chain.split(',')[0]?.trim();
    return first === '' ? undefined : first;
}

// Deliberately compact. This rides on a request header, which has a size limit
// every proxy in front of you enforces, so it carries the decision and the
// served body rather than a second copy of the idiomatic view.
function toForwarded(lookup: Lookup): ForwardedLookup {
    return {
        ...(lookup.ip === undefined ? {} : { ip: lookup.ip }),
        ...(lookup.result === undefined ? {} : {
            isVpn: lookup.result.isVpn,
            result: lookup.result.raw as unknown as Record<string, unknown>,
        }),
        ...(lookup.error === undefined ? {} : { error: lookup.error.kind }),
        blocked: lookup.blocked,
    };
}

function refuse(): NextResponse {
    return NextResponse.json({ error: 'access denied' }, { status: 403 });
}
