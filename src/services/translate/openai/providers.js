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
export const reasoningLevels = ['default', 'none', 'low', 'medium', 'high'];
// 'default' sends nothing. OpenRouter ignores top-level reasoning_effort and uses its unified reasoning object.
export function buildReasoningArguments(service, reasoning) {
    if (!reasoning || reasoning === 'default' || !reasoningLevels.includes(reasoning)) return {};
    return service === 'openrouter' ? { reasoning: { effort: reasoning } } : { reasoning_effort: reasoning };
}

// Blank means no extra arguments. Invalid JSON is reported against the Request Arguments field before any request.
export function parseRequestArguments(text) {
    if (typeof text !== 'string' || !text.trim()) return {};
    let value;
    try {
        value = JSON.parse(text);
    } catch (error) {
        throw requestError(`Request Arguments is not valid JSON: ${error.message}`, {
            code: 'invalid_json',
            fieldKey: 'requestArguments',
            detail: error.message,
        });
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw requestError('Request Arguments must be a JSON object', {
            code: 'invalid_json',
            fieldKey: 'requestArguments',
            detail: 'not an object',
        });
    }
    return value;
}

// The suggested fix for a rejected parameter, in the same compact form as the default arguments.
export function removeRequestArgument(argumentsObject, param) {
    const rest = { ...argumentsObject };
    delete rest[param];
    return JSON.stringify(rest);
}

// Shown as-is in the translate window, so toString() returns the message without an "Error:" prefix.
export function requestError(message, fields = {}) {
    const error = new Error(message);
    Object.assign(error, fields);
    error.toString = () => message;
    return error;
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Locate the rejected parameter of a 400/422 and whether it came from Request Arguments or the reasoning setting.
// Without a `param` field, only keys this request actually sent are matched against the message.
export function describeOpenaiError(status, bodyText, { userArguments = {}, reasoningArguments = {} } = {}) {
    let parsed;
    try {
        parsed = JSON.parse(bodyText);
    } catch {
        parsed = undefined;
    }
    const error = parsed?.error ?? parsed;
    const message = String(
        (typeof error === 'string' ? error : error?.message ?? parsed?.message ?? parsed?.detail) ?? bodyText ?? ''
    ).trim();
    const result = { status, message, param: null, fieldKey: null };
    if (status !== 400 && status !== 422) return result;
    const sent = [...new Set([...Object.keys(userArguments), ...Object.keys(reasoningArguments)])];
    let param = typeof error?.param === 'string' && error.param ? error.param.split(/[.[]/)[0] : null;
    if (!param || !sent.includes(param)) {
        param =
            sent.find((key) => new RegExp(`(^|[^\\w])${escapeRegExp(key)}([^\\w]|$)`, 'i').test(message)) ??
            param ??
            null;
    }
    if (param && Object.prototype.hasOwnProperty.call(userArguments, param)) {
        result.fieldKey = 'requestArguments';
    } else if (
        (param && Object.prototype.hasOwnProperty.call(reasoningArguments, param)) ||
        (!param && Object.keys(reasoningArguments).length && /reasoning|effort/i.test(message))
    ) {
        result.fieldKey = 'reasoning';
        param = param ?? Object.keys(reasoningArguments)[0];
    }
    result.param = param;
    return result;
}

export function formatOpenaiError({ status, message, param }, bodyText) {
    const summary = `HTTP ${status}: ${message || 'request failed'}${param ? ` (parameter: ${param})` : ''}`;
    return `${summary}\nHttp Status: ${status}\n${bodyText ?? ''}`.trim();
}

// Shared by streaming and non-streaming. Azure retains its deployment URL and api-key header.
// Reasoning arguments go first so the same key written in Request Arguments wins.
export function buildOpenaiRequest(
    { service, requestPath, apiKey, model, stream },
    messages,
    argumentsObject,
    reasoningArguments = {}
) {
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
        body: { ...reasoningArguments, ...argumentsObject, stream, messages, ...(!isAzure && { model }) },
    };
}
