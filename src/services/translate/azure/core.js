export const AZURE_TRANSLATE_URL = 'https://api.cognitive.microsofttranslator.com/translate';
export const AZURE_TRANSLATE_MAX_CHARACTERS = 50000;

const AUTO_LANGUAGE = 'auto';
const KEY_HEADER = 'Ocp-Apim-Subscription-Key';
const REGION_HEADER = 'Ocp-Apim-Subscription-Region';
const MAX_ERROR_DETAIL_LENGTH = 2000;

function toTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

export function normalizeAzureTranslateConfig(config = {}) {
    const key = toTrimmedString(config?.key);
    if (!key) throw new Error('Azure Translator key is required.');
    const region = toTrimmedString(config?.region).toLowerCase();
    if (region && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(region)) {
        throw new Error('Enter a valid Azure Translator region, such as westeurope, or leave it empty for a Global resource.');
    }
    return { key, region };
}

// Translator v3.0 GA only: no preview API version and no LLM option, since neither has a free quota.
export function buildAzureTranslateRequest(text, from, to, config = {}) {
    const { key, region } = normalizeAzureTranslateConfig(config);
    if (typeof text !== 'string' || text.trim() === '') throw new Error('Text to translate is required.');
    if (text.length > AZURE_TRANSLATE_MAX_CHARACTERS) {
        throw new Error(`Text is too long for Azure Translator (at most ${AZURE_TRANSLATE_MAX_CHARACTERS} characters per request).`);
    }
    const target = toTrimmedString(to);
    if (!target || target === AUTO_LANGUAGE) throw new Error('Azure Translator needs a target language.');

    const url = new URL(AZURE_TRANSLATE_URL);
    url.searchParams.set('api-version', '3.0');
    url.searchParams.set('to', target);
    const source = toTrimmedString(from);
    if (source && source !== AUTO_LANGUAGE) url.searchParams.set('from', source);

    const headers = { 'Content-Type': 'application/json; charset=UTF-8', [KEY_HEADER]: key };
    if (region) headers[REGION_HEADER] = region;

    return { url: url.toString(), headers, body: [{ Text: text }], key };
}

export function redactAzureTranslateError(value, key = '') {
    let result = String(value ?? '');
    if (key) result = result.split(key).join('[REDACTED]');
    result = result.replace(/(Ocp-Apim-Subscription-Key["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, '$1[REDACTED]');
    return result.slice(0, MAX_ERROR_DETAIL_LENGTH);
}

function dataToText(data) {
    if (typeof data === 'string') return data;
    if (data instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(data));
    if (ArrayBuffer.isView(data)) return new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
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

function formatHttpError(status, detail, key) {
    let message;
    if (status === 400) message = 'Azure Translator rejected the request (HTTP 400). Check the languages and text.';
    else if (status === 401) {
        message =
            'Azure Translator rejected the key (HTTP 401). Check the key, and that the region matches the resource (leave the region empty for a Global resource).';
    } else if (status === 403) message = 'Azure Translator denied the request (HTTP 403). The free quota may be used up, or the resource lacks access.';
    else if (status === 429) message = 'Azure Translator is receiving too many requests or characters (HTTP 429). Try again shortly.';
    else if (status >= 500) message = `Azure Translator is temporarily unavailable (HTTP ${status}).`;
    else message = `Azure Translator request failed (HTTP ${status}).`;
    const safeDetail = redactAzureTranslateError(detail, key);
    return new Error(safeDetail ? `${message} ${safeDetail}` : message);
}

export function parseAzureTranslateResponse(status, data, key = '') {
    const body = parseBody(data);
    if (status < 200 || status >= 300) {
        throw formatHttpError(status, body?.error?.message ?? body?.message ?? '', key);
    }
    const text = Array.isArray(body) ? body[0]?.translations?.[0]?.text : undefined;
    if (typeof text !== 'string') throw new Error('Unable to parse the Azure Translator response.');
    return text;
}
