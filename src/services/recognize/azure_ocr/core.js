export const AZURE_OCR_ENGINES = Object.freeze(['vision_read', 'document_read']);
export const AZURE_OCR_MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const AZURE_VISION_READ_API_VERSION = '2024-02-01';
export const AZURE_DOCUMENT_READ_API_VERSION = '2024-11-30';

const KEY_HEADER = 'Ocp-Apim-Subscription-Key';
const ALLOWED_HOST_SUFFIXES = ['.cognitiveservices.azure.com', '.api.cognitive.microsoft.com'];
const DEFAULT_POLL_DELAY_MS = 1000;
const MIN_POLL_DELAY_MS = 500;
const MAX_POLL_DELAY_MS = 5000;
const DOCUMENT_TIMEOUT_MS = 30000;
const MAX_ERROR_DETAIL_LENGTH = 2000;

function toTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

export function normalizeAzureOcrEndpoint(value) {
    const rawEndpoint = toTrimmedString(value);
    if (!rawEndpoint) throw new Error('Azure OCR endpoint is required.');
    let parsed;
    try {
        parsed = new URL(rawEndpoint);
    } catch {
        throw new Error('Enter a valid Azure resource endpoint.');
    }
    const host = parsed.hostname.toLowerCase();
    if (
        parsed.protocol !== 'https:' ||
        !ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length) ||
        (parsed.port !== '' && parsed.port !== '443') ||
        (parsed.pathname !== '' && parsed.pathname !== '/') ||
        parsed.search ||
        parsed.hash ||
        parsed.username ||
        parsed.password
    ) {
        throw new Error(
            'The endpoint must be the HTTPS address from the resource\'s "Keys and Endpoint" page, such as https://<name>.cognitiveservices.azure.com.'
        );
    }
    return parsed.origin;
}

export function normalizeAzureOcrConfig(config = {}) {
    const engine = toTrimmedString(config?.engine) || AZURE_OCR_ENGINES[0];
    if (!AZURE_OCR_ENGINES.includes(engine)) throw new Error('Azure OCR engine is invalid.');
    const endpoint = normalizeAzureOcrEndpoint(config?.endpoint);
    const key = toTrimmedString(config?.key);
    if (!key) throw new Error('Azure OCR key is required.');
    return { engine, endpoint, key };
}

export function decodeAzureOcrImage(imageBase64) {
    const content = toTrimmedString(imageBase64).replace(/^data:[^,]*,/, '').replace(/\s/g, '');
    if (!content) throw new Error('Image data is required.');
    let binary;
    try {
        binary = atob(content);
    } catch {
        throw new Error('Image data is not valid Base64.');
    }
    if (binary.length > AZURE_OCR_MAX_IMAGE_BYTES) {
        throw new Error('The image is larger than 4 MB, the limit of the Azure free tier. Select a smaller screenshot area.');
    }
    return { content, bytes: Uint8Array.from(binary, (character) => character.charCodeAt(0)) };
}

export function buildAzureVisionReadRequest(imageBase64, config = {}) {
    const { endpoint, key } = normalizeAzureOcrConfig(config);
    const { bytes } = decodeAzureOcrImage(imageBase64);
    return {
        url: `${endpoint}/computervision/imageanalysis:analyze?api-version=${AZURE_VISION_READ_API_VERSION}&features=read`,
        headers: { [KEY_HEADER]: key, 'Content-Type': 'application/octet-stream' },
        bytes,
        key,
    };
}

export function buildAzureDocumentReadRequest(imageBase64, config = {}) {
    const { endpoint, key } = normalizeAzureOcrConfig(config);
    const { content } = decodeAzureOcrImage(imageBase64);
    return {
        url: `${endpoint}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=${AZURE_DOCUMENT_READ_API_VERSION}`,
        headers: { [KEY_HEADER]: key, 'Content-Type': 'application/json' },
        body: { base64Source: content },
        key,
        endpoint,
    };
}

export function redactAzureOcrError(value, key = '') {
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

function errorDetail(body) {
    const messages = [body?.error?.message, body?.error?.innererror?.message, body?.message].filter(
        (message) => typeof message === 'string' && message
    );
    return [...new Set(messages)].join(' ');
}

function formatHttpError(status, detail, key) {
    let message;
    if (status === 400) message = 'Azure OCR rejected the request (HTTP 400). Check the image format and size.';
    else if (status === 401) message = 'Azure OCR rejected the key (HTTP 401). The key and endpoint must belong to the same resource.';
    else if (status === 403) message = 'Azure OCR denied the request (HTTP 403). The free quota may be used up, or the resource lacks access.';
    else if (status === 404) {
        message =
            'Azure OCR could not find the endpoint or API version (HTTP 404). For image OCR, check that the resource region supports Image Analysis 4.0.';
    } else if (status === 429) message = 'Azure OCR is receiving too many requests (HTTP 429). The free image OCR tier allows 20 per minute.';
    else if (status >= 500) message = `Azure OCR is temporarily unavailable (HTTP ${status}).`;
    else message = `Azure OCR request failed (HTTP ${status}).`;
    const safeDetail = redactAzureOcrError(detail, key);
    return new Error(safeDetail ? `${message} ${safeDetail}` : message);
}

function throwIfFailed(status, body, key) {
    if (status < 200 || status >= 300) throw formatHttpError(status, errorDetail(body), key);
}

export function parseAzureVisionReadResponse(status, data, key = '') {
    const body = parseBody(data);
    throwIfFailed(status, body, key);
    const blocks = body?.readResult?.blocks;
    if (!Array.isArray(blocks)) throw new Error('Unable to parse the Azure image OCR response.');
    const text = blocks
        .map((block) => (Array.isArray(block?.lines) ? block.lines.map((line) => line?.text ?? '').filter(Boolean).join('\n') : ''))
        .filter(Boolean)
        .join('\n');
    if (!text.trim()) throw new Error('No text was recognized in the image.');
    return text;
}

export function getAzureHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return '';
    const wanted = name.toLowerCase();
    const entry = Object.entries(headers).find(([header]) => header.toLowerCase() === wanted);
    if (!entry) return '';
    return Array.isArray(entry[1]) ? String(entry[1][0] ?? '') : String(entry[1] ?? '');
}

export function resolveAzureOperationLocation(headers, endpoint) {
    const location = getAzureHeader(headers, 'Operation-Location').trim();
    if (!location) throw new Error('Azure document OCR did not return a result address.');
    let parsed;
    try {
        parsed = new URL(location);
    } catch {
        throw new Error('Azure document OCR returned an invalid result address.');
    }
    // The key is only ever sent back to the configured resource.
    if (parsed.protocol !== 'https:' || parsed.host.toLowerCase() !== new URL(endpoint).host.toLowerCase()) {
        throw new Error('Azure document OCR returned a result address outside the configured endpoint.');
    }
    return parsed.toString();
}

export function getAzurePollDelayMs(headers) {
    const seconds = Number(getAzureHeader(headers, 'Retry-After'));
    if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_POLL_DELAY_MS;
    return Math.min(MAX_POLL_DELAY_MS, Math.max(MIN_POLL_DELAY_MS, seconds * 1000));
}

export function parseAzureDocumentResult(status, data, key = '') {
    const body = parseBody(data);
    throwIfFailed(status, body, key);
    const state = String(body?.status ?? '').toLowerCase();
    if (state === 'succeeded') {
        const content = body?.analyzeResult?.content;
        if (typeof content !== 'string' || !content.trim()) throw new Error('No text was recognized in the image.');
        return { done: true, text: content };
    }
    if (state === 'failed') {
        throw new Error(redactAzureOcrError(errorDetail(body) || 'Azure document OCR failed.', key));
    }
    if (state === 'notstarted' || state === 'running') return { done: false };
    throw new Error('Unable to parse the Azure document OCR response.');
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// `request` performs one HTTP call and resolves to { status, data, headers }; injected so the flow can be tested offline.
export async function runAzureDocumentRead(imageBase64, config, { request, sleep = wait, now = Date.now, timeoutMs = DOCUMENT_TIMEOUT_MS } = {}) {
    const submit = buildAzureDocumentReadRequest(imageBase64, config);
    const accepted = await request({ method: 'POST', url: submit.url, headers: submit.headers, json: submit.body });
    if (accepted.status !== 202) {
        throwIfFailed(accepted.status, parseBody(accepted.data), submit.key);
        throw new Error(`Azure document OCR did not accept the request (HTTP ${accepted.status}).`);
    }
    const resultUrl = resolveAzureOperationLocation(accepted.headers, submit.endpoint);
    const deadline = now() + timeoutMs;
    let delay = getAzurePollDelayMs(accepted.headers);

    for (;;) {
        if (now() + delay > deadline) throw new Error('Azure document OCR timed out after 30 seconds.');
        await sleep(delay);
        const polled = await request({ method: 'GET', url: resultUrl, headers: { [KEY_HEADER]: submit.key } });
        const result = parseAzureDocumentResult(polled.status, polled.data, submit.key);
        if (result.done) return result.text;
        delay = getAzurePollDelayMs(polled.headers);
    }
}
