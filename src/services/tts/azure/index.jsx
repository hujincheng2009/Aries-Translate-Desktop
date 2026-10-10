import { Body, fetch } from '@tauri-apps/api/http';

import {
    buildAzureSsml,
    getAzureSpeechUrl,
    getAzureVoicesUrl,
    normalizeAzureConfig,
    resolveAzureVoice,
} from './core';
import { Language } from './info';

const AZURE_KEY_HEADER = 'Ocp-Apim-Subscription-Key';
const OUTPUT_FORMAT = 'audio-24khz-96kbitrate-mono-mp3';
const REQUEST_TIMEOUT_SECONDS = 60;
const VOICE_CACHE_TTL_MS = 30 * 60 * 1000;

const voiceCache = new Map();
const voiceRequests = new Map();

export function validateAzureConfig(config) {
    normalizeAzureConfig(config);
    return true;
}

function getVoiceCacheKey({ region, endpoint }) {
    return endpoint || region;
}

function getHttpError(status, action) {
    if (status === 400) return new Error(`Azure rejected the ${action} request (HTTP 400). Check the selected voice and language.`);
    if (status === 401 || status === 403) return new Error(`Azure rejected the key or region (HTTP ${status}).`);
    if (status === 404) return new Error(`Azure endpoint was not found (HTTP 404). Check the region or resource endpoint.`);
    if (status === 429) return new Error('Azure Speech is busy or the request quota was reached (HTTP 429). Try again shortly.');
    if (status >= 500) return new Error(`Azure Speech is temporarily unavailable (HTTP ${status}).`);
    return new Error(`Azure ${action} request failed (HTTP ${status}).`);
}

function isEmptyData(data) {
    return data === null || data === undefined || (typeof data.length === 'number' && data.length === 0);
}

async function requestVoices(normalizedConfig) {
    let response;
    try {
        response = await fetch(getAzureVoicesUrl(normalizedConfig), {
            method: 'GET',
            headers: { [AZURE_KEY_HEADER]: normalizedConfig.key },
            responseType: 1,
            timeout: REQUEST_TIMEOUT_SECONDS,
        });
    } catch {
        throw new Error('Could not connect to Azure Speech to load voices. Check your network and endpoint.');
    }

    if (!response.ok) throw getHttpError(response.status, 'voice list');
    if (!Array.isArray(response.data)) throw new Error('Azure returned an invalid voice list.');

    return response.data.filter((voice) => typeof voice?.ShortName === 'string' && typeof voice?.Locale === 'string');
}

export async function getAzureVoices(config, options = {}) {
    const normalizedConfig = normalizeAzureConfig(config);
    const cacheKey = getVoiceCacheKey(normalizedConfig);
    const cached = voiceCache.get(cacheKey);

    if (!options.refresh && cached && cached.expiresAt > Date.now()) return cached.voices;
    if (!options.refresh && voiceRequests.has(cacheKey)) return voiceRequests.get(cacheKey);

    const request = requestVoices(normalizedConfig)
        .then((voices) => {
            voiceCache.set(cacheKey, { expiresAt: Date.now() + VOICE_CACHE_TTL_MS, voices });
            return voices;
        })
        .finally(() => voiceRequests.delete(cacheKey));

    voiceRequests.set(cacheKey, request);
    return request;
}

async function requestSynthesis(config, ssml) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        let response;
        try {
            response = await fetch(getAzureSpeechUrl(config), {
                method: 'POST',
                headers: {
                    [AZURE_KEY_HEADER]: config.key,
                    'Content-Type': 'application/ssml+xml',
                    'X-Microsoft-OutputFormat': OUTPUT_FORMAT,
                    'User-Agent': 'Aries',
                },
                body: Body.text(ssml),
                responseType: 3,
                timeout: REQUEST_TIMEOUT_SECONDS,
            });
        } catch {
            throw new Error('Could not connect to Azure Speech. Check your network and endpoint.');
        }

        if (response.status === 429 && attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 700));
            continue;
        }
        if (!response.ok) throw getHttpError(response.status, 'speech synthesis');
        if (isEmptyData(response.data)) throw new Error('Azure Speech returned no audio.');
        return response.data;
    }

    throw new Error('Azure Speech is busy or the request quota was reached (HTTP 429). Try again shortly.');
}

export async function tts(text, lang, options = {}) {
    const normalizedConfig = normalizeAzureConfig(options.config);
    const locale = Object.values(Language).includes(lang) && lang !== Language.auto ? lang : '';
    if (!locale) throw new Error('Language not supported by Azure Speech.');

    const normalizedText = typeof text === 'string' ? text.trim() : '';
    if (!normalizedText) throw new Error('No text to synthesize.');

    const voices = await getAzureVoices(normalizedConfig);
    const voice = resolveAzureVoice(voices, locale, options.config ?? {});
    const ssml = buildAzureSsml(normalizedText, locale, voice.ShortName);

    return requestSynthesis(normalizedConfig, ssml);
}

export * from './Config';
export * from './info';
