// SPDX-FileCopyrightText: 2024 integral@member.fsf.org
// SPDX-License-Identifier: GPL-3.0-or-later
// Rewritten for Aries Personal from plugin.page.codeberg.integral.google.

export const GOOGLE_OCR_URL = 'https://vision.googleapis.com/v1/images:annotate';

export const GOOGLE_OCR_LANGUAGE_HINTS = Object.freeze({
    auto: '',
    zh_cn: 'zh',
    zh_tw: 'zh-Hant',
    en: 'en',
    ja: 'ja',
    ko: 'ko',
    fr: 'fr',
    es: 'es',
    ru: 'ru',
    de: 'de',
    it: 'it',
    tr: 'tr',
    pt_pt: 'pt',
    pt_br: 'pt',
    vi: 'vi',
    id: 'id',
    th: 'th',
    ms: 'ms',
    ar: 'ar',
    hi: 'hi',
    mn_cy: 'mn',
    km: 'km',
});

export const GOOGLE_OCR_DETECTION_TYPES = Object.freeze(['TEXT_DETECTION', 'DOCUMENT_TEXT_DETECTION']);

const LANGUAGE_CODES = new Set(Object.values(GOOGLE_OCR_LANGUAGE_HINTS));
const MAX_ERROR_DETAIL_LENGTH = 2000;

function toTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

export function normalizeGoogleOcrConfig(config = {}) {
    const apiKey = toTrimmedString(config?.api_key);
    if (!apiKey) throw new Error('Google Vision API key is required.');
    const detectionType = toTrimmedString(config?.detection_type) || GOOGLE_OCR_DETECTION_TYPES[0];
    if (!GOOGLE_OCR_DETECTION_TYPES.includes(detectionType))
        throw new Error('Google Vision detection type is invalid.');
    return { apiKey, detectionType };
}

export function buildGoogleOcrRequest(imageBase64, languageHint, config = {}) {
    const { apiKey, detectionType } = normalizeGoogleOcrConfig(config);
    const content = toTrimmedString(imageBase64);
    if (!content) throw new Error('Image data is required.');
    if (typeof languageHint !== 'string' || !LANGUAGE_CODES.has(languageHint)) {
        throw new Error('Language not supported by Google Vision.');
    }

    const annotation = {
        image: { content },
        features: [{ type: detectionType }],
    };
    if (languageHint) annotation.imageContext = { languageHints: [languageHint] };

    return {
        url: GOOGLE_OCR_URL,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'x-goog-api-key': apiKey,
        },
        body: { requests: [annotation] },
    };
}

function dataToText(data) {
    if (typeof data === 'string') return data;
    if (data instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(data));
    if (ArrayBuffer.isView(data)) {
        return new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    }
    if (Array.isArray(data)) return new TextDecoder().decode(new Uint8Array(data));
    if (data === null || data === undefined) return '';
    try {
        return JSON.stringify(data);
    } catch {
        return String(data);
    }
}

function errorObject(data) {
    if (typeof data === 'object' && data !== null) return data;
    const text = dataToText(data).trim();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return { message: text };
    }
}

export function redactGoogleOcrError(value, apiKey = '') {
    let result = String(value ?? '');
    if (apiKey) result = result.split(apiKey).join('[REDACTED]');
    result = result.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]');
    return result.slice(0, MAX_ERROR_DETAIL_LENGTH);
}

function formatHttpError(status, detail, apiKey) {
    let message;
    if (status === 400) message = 'Google Vision rejected the request (HTTP 400).';
    else if (status === 401 || status === 403)
        message = `Google Vision rejected the API key or access (HTTP ${status}).`;
    else if (status === 429) message = 'Google Vision quota was reached (HTTP 429).';
    else if (status >= 500) message = `Google Vision is temporarily unavailable (HTTP ${status}).`;
    else message = `Google Vision request failed (HTTP ${status}).`;
    const safeDetail = redactGoogleOcrError(detail, apiKey);
    return new Error(safeDetail ? `${message} ${safeDetail}` : message);
}

export function parseGoogleOcrResponse(status, data, apiKey = '') {
    const body = errorObject(data);
    if (status < 200 || status >= 300) {
        const detail = body?.error?.message ?? body?.message ?? dataToText(data);
        throw formatHttpError(status, detail, apiKey);
    }

    if (
        !Array.isArray(body?.responses) ||
        body.responses.length === 0 ||
        typeof body.responses[0] !== 'object' ||
        body.responses[0] === null
    ) {
        throw new Error('Unable to parse Google Vision response.');
    }

    const result = body.responses[0];
    if (result.error) {
        const detail =
            typeof result.error.message === 'string'
                ? result.error.message
                : 'Google Vision could not recognize this image.';
        throw new Error(redactGoogleOcrError(detail, apiKey));
    }

    const text = result.fullTextAnnotation?.text;
    if (typeof text !== 'string' || text.trim() === '') {
        throw new Error('No text was recognized in the image.');
    }
    return text;
}
