import { Body, fetch } from '@tauri-apps/api/http';

import {
    buildAzureVisionReadRequest,
    normalizeAzureOcrConfig,
    parseAzureVisionReadResponse,
    redactAzureOcrError,
    runAzureDocumentRead,
} from './core';
import { Language } from './info';

const REQUEST_TIMEOUT_SECONDS = 30;

export function validateAzureOcrConfig(config) {
    normalizeAzureOcrConfig(config);
    return true;
}

async function send({ method, url, headers, json, bytes }, key) {
    try {
        const response = await fetch(url, {
            method,
            headers,
            body: json ? Body.json(json) : bytes ? Body.bytes(bytes) : undefined,
            responseType: 1,
            timeout: REQUEST_TIMEOUT_SECONDS,
        });
        return { status: response.status, data: response.data, headers: response.headers };
    } catch (error) {
        const detail = redactAzureOcrError(error instanceof Error ? error.message : error, key);
        throw new Error(detail ? `Azure OCR request failed: ${detail}` : 'Azure OCR request failed. Check your network connection.');
    }
}

export async function recognize(base64, _language, options = {}) {
    const config = options.config ?? {};
    const { engine, key } = normalizeAzureOcrConfig(config);

    if (engine === 'document_read') {
        return runAzureDocumentRead(base64, config, { request: (request) => send(request, key) });
    }

    const request = buildAzureVisionReadRequest(base64, config);
    const response = await send({ method: 'POST', url: request.url, headers: request.headers, bytes: request.bytes }, key);
    return parseAzureVisionReadResponse(response.status, response.data, key);
}

export { Language };
export * from './Config';
export * from './info';
