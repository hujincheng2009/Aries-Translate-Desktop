import { Body, fetch } from '@tauri-apps/api/http';

import { buildGoogleOcrRequest, normalizeGoogleOcrConfig, parseGoogleOcrResponse, redactGoogleOcrError } from './core';
import { Language } from './info';

export function validateGoogleOcrConfig(config) {
    normalizeGoogleOcrConfig(config);
    return true;
}

export async function recognize(base64, languageHint, options = {}) {
    const config = options.config ?? {};
    const request = buildGoogleOcrRequest(base64, languageHint, config);
    let response;
    try {
        response = await fetch(request.url, {
            method: 'POST',
            headers: request.headers,
            body: Body.json(request.body),
            responseType: 1,
            timeout: 60,
        });
    } catch (error) {
        const detail = redactGoogleOcrError(error instanceof Error ? error.message : error, request.headers['x-goog-api-key']);
        throw new Error(detail ? `Google Vision request failed: ${detail}` : 'Google Vision request failed. Check your network connection.');
    }

    return parseGoogleOcrResponse(response.status, response.data, request.headers['x-goog-api-key']);
}

export { Language };
export * from './Config';
export * from './info';
