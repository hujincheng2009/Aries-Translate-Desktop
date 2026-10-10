import { Body, fetch } from '@tauri-apps/api/http';

import {
    buildGoogleCloudTranslateRequest,
    normalizeGoogleCloudTranslateConfig,
    parseGoogleCloudTranslateResponse,
    redactGoogleCloudTranslateError,
} from './core';

export function validateGoogleCloudTranslateConfig(config) {
    normalizeGoogleCloudTranslateConfig(config);
    return true;
}

export async function translate(text, from, to, options = {}) {
    const config = options.config ?? {};
    const request = buildGoogleCloudTranslateRequest(text, from, to, config);
    const apiKey = request.headers['x-goog-api-key'];
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
        const detail = redactGoogleCloudTranslateError(error instanceof Error ? error.message : error, apiKey);
        throw new Error(
            detail
                ? `Google Cloud Translation request failed: ${detail}`
                : 'Google Cloud Translation request failed. Check your network connection.'
        );
    }

    return parseGoogleCloudTranslateResponse(response.status, response.data, apiKey);
}

export * from './Config';
export * from './info';
