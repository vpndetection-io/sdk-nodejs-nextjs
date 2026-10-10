// The README's Next 15 setup with no `runtime`, so Next builds it for Edge.
import { createProxy } from 'vpndetection-next';

export const middleware = createProxy({ apiKey: process.env.VPNDETECTION_API_KEY });

export const config = { matcher: ['/whoami'] };
