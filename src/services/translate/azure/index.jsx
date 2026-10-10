import { Body, fetch } from '@tauri-apps/api/http';

import {
    buildAzureTranslateRequest,
    normalizeAzureTranslateConfig,
    parseAzureTranslateResponse,
    redactAzureTranslateError,
} from './core';

export function validateAzureTranslateConfig(config) {
    normalizeAzureTranslateConfig(config);
    return true;
}

export async function translate(text, from, to, options = {}) {
    const request = buildAzureTranslateRequest(text, from, to, options.config ?? {});
    let response;
    try {
        response = await fetch(request.url, {
            method: 'POST',
            headers: request.headers,
            body: Body.json(request.body),
            responseType: 1,
            timeout: 30,
        });
    } catch (error) {
        const detail = redactAzureTranslateError(error instanceof Error ? error.message : error, request.key);
        throw new Error(detail ? `Azure Translator request failed: ${detail}` : 'Azure Translator request failed. Check your network connection.');
    }

    return parseAzureTranslateResponse(response.status, response.data, request.key);
}

export * from './Config';
export * from './info';
