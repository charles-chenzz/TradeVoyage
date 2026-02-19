import { HttpsProxyAgent } from 'https-proxy-agent';

let cachedAgent: HttpsProxyAgent | null | undefined;

function getProxyUrl(): string | undefined {
    return (
        process.env.HTTPS_PROXY ||
        process.env.https_proxy ||
        process.env.HTTP_PROXY ||
        process.env.http_proxy ||
        process.env.ALL_PROXY ||
        process.env.all_proxy
    );
}

export function getProxyAgent(): HttpsProxyAgent | undefined {
    if (cachedAgent !== undefined) {
        return cachedAgent || undefined;
    }

    const proxyUrl = getProxyUrl();
    if (!proxyUrl) {
        cachedAgent = null;
        return undefined;
    }

    cachedAgent = new HttpsProxyAgent(proxyUrl);
    return cachedAgent;
}
