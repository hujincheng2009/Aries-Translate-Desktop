import { Body, fetch } from '@tauri-apps/api/http';

import {
    buildGoogleCloudAuthHeaders,
    buildGoogleCloudRequest,
    getGoogleCloudVoicesUrl,
    needsGoogleCloudVoiceList,
    normalizeGoogleCloudConfig,
    parseGoogleCloudResponse,
    parseGoogleCloudVoicesResponse,
    redactGoogleCloudError,
} from './core';
import { Language } from './info';
import { synthesizeGoogleCloudText } from './synthesis';

const VOICE_CACHE_TTL_MS = 30 * 60 * 1000;

const voiceCache = new Map();
const voiceRequests = new Map();

export function validateGoogleCloudConfig(config) {
    normalizeGoogleCloudConfig(config);
    return true;
}

async function requestVoices(normalized, url) {
    let response;
    try {
        response = await fetch(url, {
            method: 'GET',
            headers: buildGoogleCloudAuthHeaders(normalized),
            responseType: 1,
            timeout: 60,
        });
    } catch (error) {
        const detail = redactGoogleCloudError(error instanceof Error ? error.message : error, normalized.credential);
        throw new Error(
            detail
                ? `Google Cloud TTS voice list request failed: ${detail}`
                : 'Google Cloud TTS voice list request failed. Check your network connection.'
        );
    }
    return parseGoogleCloudVoicesResponse(response.status, response.data, normalized.credential);
}

export async function getGoogleCloudVoices(config, options = {}) {
    const normalized = normalizeGoogleCloudConfig(config);
    const url = getGoogleCloudVoicesUrl(normalized.requestUrl);
    const cacheKey = `${normalized.authType}|${url}`;
    const cached = voiceCache.get(cacheKey);

    if (!options.refresh && cached && cached.expiresAt > Date.now()) return cached.voices;
    if (!options.refresh && voiceRequests.has(cacheKey)) return voiceRequests.get(cacheKey);

    const request = requestVoices(normalized, url)
        .then((voices) => {
            voiceCache.set(cacheKey, { expiresAt: Date.now() + VOICE_CACHE_TTL_MS, voices });
            return voices;
        })
        .finally(() => voiceRequests.delete(cacheKey));

    voiceRequests.set(cacheKey, request);
    return request;
}

async function requestSpeech(request) {
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
        const detail = redactGoogleCloudError(error instanceof Error ? error.message : error, request.credential);
        throw new Error(
            detail
                ? `Google Cloud TTS request failed: ${detail}`
                : 'Google Cloud TTS request failed. Check your network connection.'
        );
    }

    return parseGoogleCloudResponse(response.status, response.data, request.credential);
}

export async function tts(text, language, options = {}) {
    const config = options.config ?? {};
    if (options.shouldContinue && !options.shouldContinue()) throw new Error('TTS request cancelled');
    const voices = needsGoogleCloudVoiceList(language, config) ? await getGoogleCloudVoices(config) : undefined;
    const request = buildGoogleCloudRequest(text, language, config, voices);
    return synthesizeGoogleCloudText(request, requestSpeech, options.shouldContinue);
}

export { Language };
export * from './Config';
export * from './info';
