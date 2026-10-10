import { Body, fetch } from '@tauri-apps/api/http';

import {
    buildOpenRouterSpeechRequest,
    createOpenRouterHttpError,
    normalizeOpenRouterAudio,
    normalizeOpenRouterConfig,
    redactOpenRouterError,
} from './core';
import { Language } from './info';

export function validateOpenRouterConfig(config) {
    normalizeOpenRouterConfig(config);
    return true;
}

export async function tts(text, _language, options = {}) {
    const request = buildOpenRouterSpeechRequest(text, options.config ?? {});
    let response;
    try {
        response = await fetch(request.url, {
            method: 'POST',
            headers: request.headers,
            body: Body.json(request.payload),
            responseType: 3,
            timeout: 120,
        });
    } catch (error) {
        const detail = redactOpenRouterError(error instanceof Error ? error.message : error, request.apiKey);
        throw new Error(detail ? `OpenRouter speech request failed: ${detail}` : 'OpenRouter speech request failed. Check your network connection.');
    }

    if (!response.ok) throw createOpenRouterHttpError(response.status, response.data, request.apiKey);
    return normalizeOpenRouterAudio(response.data, request.payload.response_format, response.headers);
}

export { Language };
export * from './Config';
export * from './info';
