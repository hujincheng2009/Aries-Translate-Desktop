import { Body, fetch } from '@tauri-apps/api/http';

import {
    buildGeminiTtsRequest,
    createGeminiTtsHttpError,
    extractGeminiTtsAudio,
    normalizeGeminiTtsAudio,
    normalizeGeminiTtsConfig,
    redactGeminiTtsError,
} from './core';
import { Language } from './info';

export function validateGeminiTtsConfig(config) {
    normalizeGeminiTtsConfig(config);
    return true;
}

export async function tts(text, _language, options = {}) {
    const request = buildGeminiTtsRequest(text, options.config ?? {});
    let response;
    try {
        response = await fetch(request.url, {
            method: 'POST',
            headers: request.headers,
            body: Body.json(request.payload),
            responseType: 1,
            timeout: 120,
        });
    } catch (error) {
        const detail = redactGeminiTtsError(error instanceof Error ? error.message : error, request.apiKey);
        throw new Error(detail ? `Gemini TTS network request failed: ${detail}` : 'Gemini TTS network request failed. Check your connection.');
    }
    if (!response.ok) throw createGeminiTtsHttpError(response.status, response.data, request.apiKey);
    try {
        const { bytes, mimeType } = extractGeminiTtsAudio(response.data);
        return normalizeGeminiTtsAudio(bytes, mimeType);
    } catch (error) {
        throw new Error(redactGeminiTtsError(error instanceof Error ? error.message : error, request.apiKey));
    }
}

export { Language };
export * from './Config';
export * from './info';
