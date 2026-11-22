import { Body, ResponseType, fetch } from '@tauri-apps/api/http';

import {
    buildOpenRouterSpeechModelUrl,
    buildOpenRouterSpeechRequest,
    createOpenRouterHttpError,
    normalizeOpenRouterAudio,
    normalizeOpenRouterConfig,
    readOpenRouterSpeechModel,
    redactOpenRouterError,
} from './core';
import { Language } from './info';

export function validateOpenRouterConfig(config) {
    normalizeOpenRouterConfig(config);
    return true;
}

export async function fetchOpenRouterSpeechModel(model) {
    const response = await fetch(buildOpenRouterSpeechModelUrl(model), {
        method: 'GET',
        responseType: ResponseType.Text,
        timeout: 15,
    });
    if (!response.ok) throw createOpenRouterHttpError(response.status, response.data);
    return readOpenRouterSpeechModel(JSON.parse(response.data));
}

export async function tts(text, _language, options = {}) {
    const request = buildOpenRouterSpeechRequest(text, options.config ?? {});
    let response;
    try {
        response = await fetch(request.url, {
            method: 'POST',
            headers: request.headers,
            body: Body.json(request.payload),
            responseType: ResponseType.Binary,
            timeout: 120,
        });
    } catch (error) {
        const detail = redactOpenRouterError(error instanceof Error ? error.message : error, request.apiKey);
        throw new Error(
            detail
                ? `OpenRouter speech request failed: ${detail}`
                : 'OpenRouter speech request failed. Check your network connection.'
        );
    }

    if (!response.ok) throw createOpenRouterHttpError(response.status, response.data, request.apiKey);
    return normalizeOpenRouterAudio(
        response.data,
        request.payload.response_format,
        response.headers,
        request.payload.model
    );
}

export { Language };
export * from './Config';
export * from './info';
