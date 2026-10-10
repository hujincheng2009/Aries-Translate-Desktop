// Endpoints and key pages checked against provider documentation on 2026-10-09.
export const openaiProviders = {
    openai: {
        requestPath: 'https://api.openai.com/v1/chat/completions',
        keyUrl: 'https://platform.openai.com/api-keys',
        sourceUrl: 'https://developers.openai.com/api/reference/resources/chat',
    },
    azure: { keyUrl: 'https://portal.azure.com/' },
    openrouter: {
        requestPath: 'https://openrouter.ai/api/v1/chat/completions',
        keyUrl: 'https://openrouter.ai/settings/keys',
        sourceUrl: 'https://openrouter.ai/docs/api-reference/overview',
    },
    chatanywhere: {
        requestPath: 'https://api.chatanywhere.tech/v1/chat/completions',
        overseasRequestPath: 'https://api.chatanywhere.org/v1/chat/completions',
        keyUrl: 'https://chatanywhere.tech',
        sourceUrl: 'https://github.com/chatanywhere/GPT_API_free',
    },
    tuzi: {
        requestPath: 'https://api.tu-zi.com/v1/chat/completions',
        keyUrl: 'https://api.tu-zi.com/token',
        sourceUrl: 'https://api.tu-zi.com/docs/use-cases/getting-started',
    },
};
export const providerVerifiedAt = '2026-10-09';
export function getOpenaiProvider(service) {
    return Object.prototype.hasOwnProperty.call(openaiProviders, service)
        ? openaiProviders[service]
        : openaiProviders.openai;
}
const defaultAddresses = Object.values(openaiProviders).flatMap((provider) =>
    [provider.requestPath, provider.overseasRequestPath].filter(Boolean)
);
// Only runs on explicit provider selection; existing instances are not migrated.
export function selectOpenaiProvider(config, service) {
    const provider = getOpenaiProvider(service);
    const address = config.requestPath ?? '';
    const preserved = Boolean(provider.requestPath && address.trim() && !defaultAddresses.includes(address));
    return {
        config: {
            ...config,
            service,
            requestPath: provider.requestPath && !preserved ? provider.requestPath : address,
        },
        preserved,
    };
}
// Shared by streaming and non-streaming. Azure retains its deployment URL and api-key header.
export function buildOpenaiRequest({ service, requestPath, apiKey, model, stream }, messages, argumentsObject) {
    const isAzure = service === 'azure';
    const url = new URL(/^https?:\/\//.test(requestPath) ? requestPath : `https://${requestPath}`);
    if (!isAzure && !url.pathname.replace(/\/$/, '').endsWith('/chat/completions')) {
        const base = url.pathname.replace(/\/$/, '');
        url.pathname = `${base}${base.endsWith('/v1') ? '' : '/v1'}/chat/completions`;
    }
    return {
        url: url.href,
        headers: {
            'Content-Type': 'application/json',
            ...(isAzure ? { 'api-key': apiKey } : { Authorization: `Bearer ${apiKey}` }),
        },
        body: { ...argumentsObject, stream, messages, ...(!isAzure && { model }) },
    };
}
