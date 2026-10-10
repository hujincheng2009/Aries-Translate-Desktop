export const GOOGLE_CLOUD_TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2';

const AUTO_LANGUAGE = 'auto';
const MAX_ERROR_DETAIL_LENGTH = 2000;

function toTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

export function normalizeGoogleCloudTranslateConfig(config = {}) {
    const apiKey = toTrimmedString(config?.apiKey);
    if (!apiKey) throw new Error('Google Cloud Translation API key is required.');
    return { apiKey };
}

// Basic (v2) with the default NMT model: `model` is never sent, because Translation LLM has no free quota.
export function buildGoogleCloudTranslateRequest(text, from, to, config = {}) {
    const { apiKey } = normalizeGoogleCloudTranslateConfig(config);
    if (typeof text !== 'string' || text.trim() === '') throw new Error('Text to translate is required.');
    const target = toTrimmedString(to);
    if (!target || target === AUTO_LANGUAGE) throw new Error('Google Cloud Translation needs a target language.');

    const body = { q: text, target, format: 'text' };
    const source = toTrimmedString(from);
    if (source && source !== AUTO_LANGUAGE) body.source = source;

    return {
        url: GOOGLE_CLOUD_TRANSLATE_URL,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'x-goog-api-key': apiKey,
        },
        body,
    };
}

export function redactGoogleCloudTranslateError(value, apiKey = '') {
    let result = String(value ?? '');
    if (apiKey) result = result.split(apiKey).join('[REDACTED]');
    result = result.replace(/(x-goog-api-key["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, '$1[REDACTED]');
    result = result.replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED]');
    return result.slice(0, MAX_ERROR_DETAIL_LENGTH);
}

function dataToText(data) {
    if (typeof data === 'string') return data;
    if (data instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(data));
    if (ArrayBuffer.isView(data)) return new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    if (Array.isArray(data)) return new TextDecoder().decode(new Uint8Array(data));
    if (data === null || data === undefined) return '';
    try {
        return JSON.stringify(data);
    } catch {
        return String(data);
    }
}

function parseBody(data) {
    if (typeof data === 'object' && data !== null && !ArrayBuffer.isView(data) && !(data instanceof ArrayBuffer)) return data;
    const text = dataToText(data).trim();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return { message: text };
    }
}

function formatHttpError(status, detail, apiKey) {
    let message;
    if (status === 400) message = 'Google Cloud Translation rejected the request (HTTP 400). Check the languages and text length.';
    else if (status === 401 || status === 403) {
        message = `Google Cloud Translation rejected the API key or access (HTTP ${status}). Check that the key is valid, the Cloud Translation API and billing are enabled, and the key is allowed to call this API.`;
    } else if (status === 429) message = 'Google Cloud Translation quota or rate limit was reached (HTTP 429).';
    else if (status >= 500) message = `Google Cloud Translation is temporarily unavailable (HTTP ${status}).`;
    else message = `Google Cloud Translation request failed (HTTP ${status}).`;
    const safeDetail = redactGoogleCloudTranslateError(detail, apiKey);
    return new Error(safeDetail ? `${message} ${safeDetail}` : message);
}

export function parseGoogleCloudTranslateResponse(status, data, apiKey = '') {
    const body = parseBody(data);
    if (status < 200 || status >= 300) {
        throw formatHttpError(status, body?.error?.message ?? body?.message ?? '', apiKey);
    }
    const translatedText = body?.data?.translations?.[0]?.translatedText;
    if (typeof translatedText !== 'string') throw new Error('Unable to parse the Google Cloud Translation response.');
    return translatedText;
}
