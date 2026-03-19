import type { Socket, Server } from 'node:net';
import type { Duplex } from 'node:stream';
import { URL } from 'node:url';
export interface HttpProxyServerOptions {
    filter(port: number, host: string, socket: Socket | Duplex): Promise<boolean> | boolean;
    /**
     * Optional function to get the MITM proxy socket path for a given host.
     * If returns a socket path, the request will be routed through that MITM proxy.
     * If returns undefined, the request will be handled directly.
     */
    getMitmSocketPath?(host: string): string | undefined;
    /**
     * Optional upstream HTTP proxy to chain through for all outbound connections.
     * When set, traffic is forwarded through this proxy instead of connecting directly.
     */
    upstreamHttpProxy?: URL;
}
export declare function createHttpProxyServer(options: HttpProxyServerOptions): Server;
//# sourceMappingURL=http-proxy.d.ts.map