/// Compatibility layer between PocketBase Mithril
import m from "mithril";

export function pbMithrilFetch(url: RequestInfo | URL, config?: RequestInit) {
    const headers = new Headers(config?.headers);
    let convertedHeader: { [key: string]: string } = {};

    for (const pair of headers.entries()) {
        convertedHeader[pair[0]] = pair[1];
    }

    return m.request(url.toString(), {
        headers: convertedHeader,
        method: config?.method
    }).then((res) => {
        return Response.json(res as Object);
    });
}