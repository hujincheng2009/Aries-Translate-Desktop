import { isKnownAudioContainer, isWav, wrapPcmInWav } from '../../../utils/tts_audio.js';
import { classifyGeminiHttpError } from '../../../utils/gemini_error.js';

export const GEMINI_TTS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
export const DEFAULT_GEMINI_TTS_MODEL = 'gemini-3.8-flash-lite-tts';
export const GEMINI_TTS_VOICES = [
    'Zephyr',
    'Puck',
    'Charon',
    'Kore',
    'Fenrir',
    'Leda',
    'Orus',
    'Aoede',
    'Callirrhoe',
    'Autonoe',
    'Enceladus',
    'Iapetus',
    'Umbriel',
    'Algieba',
    'Despina',
    'Erinome',
    'Algenib',
    'Rasalgethi',
    'Laomedeia',
    'Achernar',
    'Alnilam',
    'Schedar',
    'Gacrux',
    'Pulcherrima',
    'Achird',
    'Zubenelgenubi',
    'Vindemiatrix',
    'Sadachbia',
    'Sadaltager',
    'Sulafat',
];

const trim = (value) => (typeof value === 'string' ? value.trim() : '');

export function normalizeGeminiTtsConfig(config = {}) {
    const apiKey = trim(config?.apiKey);
    const model = trim(config?.model);
    const voice = trim(config?.voice) || 'Kore';
    const style = trim(config?.style);
    if (!apiKey) throw new Error('Gemini API Key is required.');
    if (!model) throw new Error('Gemini TTS model is required.');
    if (style.length > 500) throw new Error('Gemini TTS style is too long; shorten it to 500 characters.');
    return { apiKey, model, voice, style };
}

export function buildGeminiTtsRequest(text, config = {}) {
    const transcript = trim(text);
    if (!transcript) throw new Error('Text to synthesize is required.');
    const { apiKey, model, voice, style } = normalizeGeminiTtsConfig(config);
    const content = { type: 'text', text: transcript };
    if (style) content.annotations = [{ type: 'speech_metadata', style }];
    return {
        url: GEMINI_TTS_URL,
        apiKey,
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        payload: {
            model,
            input: [{ type: 'user_input', content: [content] }],
            response_format: { type: 'audio' },
            generation_config: { speech_config: [{ voice }] },
            store: false,
        },
    };
}

export function redactGeminiTtsError(value, apiKey = '') {
    let result = String(value ?? '');
    if (apiKey) result = result.split(apiKey).join('[REDACTED]');
    result = result.replace(/(x-goog-api-key\s*[:=]\s*|\bkey=)[^\s&;,"'{}]+/gi, '$1[REDACTED]');
    return result.slice(0, 2000);
}

export function createGeminiTtsHttpError(status, data, apiKey = '', now = Date.now()) {
    let body = data;
    if (typeof data === 'string') {
        try {
            body = JSON.parse(data);
        } catch {
            body = data;
        }
    }
    const response = Array.isArray(body) ? body[0] : body;
    const remoteError = response?.error ?? response;
    const classified = classifyGeminiHttpError(status, data, now);
    const { code, remoteMessage } = classified;
    const kind = ['auth', 'quota_daily', 'rate_limited'].includes(classified.kind) ? classified.kind : 'other';
    const hint =
        kind === 'auth'
            ? 'API Key is invalid or access is denied.'
            : kind === 'quota_daily'
              ? 'Daily quota exhausted; resets after Pacific midnight.'
              : kind === 'rate_limited'
                ? 'Request rate limit reached.'
                : code === 400
                  ? 'Invalid request; check the model, voice, and style.'
                  : code === 404
                    ? 'Model does not exist or does not support speech.'
                    : code >= 500
                      ? 'Gemini is temporarily unavailable.'
                      : 'Gemini speech request failed.';
    const original =
        kind === 'quota_daily'
            ? remoteMessage.replace(/Please retry in\s+\d+(?:\.\d+)?s(?:\s+or)?/i, '')
            : remoteMessage;
    const detail =
        typeof response === 'object' && response !== null
            ? [remoteError?.status, original].filter(Boolean).join(': ')
            : String(response ?? '');
    const error = new Error(
        `Gemini TTS (HTTP ${Number.isFinite(code) ? code : 'UNKNOWN'}): ${hint} ${redactGeminiTtsError(detail, apiKey)}`.trim()
    );
    error.ttsFailure = { kind };
    if (kind === 'quota_daily') error.ttsFailure.resetAt = classified.resetAt;
    if (kind === 'rate_limited' && classified.retryAfterMs !== undefined)
        error.ttsFailure.retryAfterMs = classified.retryAfterMs;
    return error;
}

function decodeBase64(value) {
    if (typeof value !== 'string') throw new Error('Gemini audio data is invalid.');
    const encoded = value.trim();
    if (
        !encoded ||
        encoded.length % 4 !== 0 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)
    ) {
        throw new Error('Gemini audio data is invalid.');
    }
    try {
        const binary = atob(encoded);
        if (!binary.length) throw new Error('empty');
        return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    } catch {
        throw new Error('Gemini audio data is invalid.');
    }
}

export function extractGeminiTtsAudio(responseData) {
    if (responseData?.status && responseData.status !== 'completed') {
        const suffix = responseData.status === 'incomplete' ? '; the text may be too long' : '';
        throw new Error(`Gemini did not complete synthesis (${responseData.status})${suffix}.`);
    }
    let lastAudio;
    for (const step of responseData?.steps ?? []) {
        if (step?.type !== 'model_output') continue;
        for (const content of step.content ?? []) {
            if (content?.type === 'audio' && content.data) lastAudio = content;
        }
    }
    if (!lastAudio) throw new Error('Gemini returned no audio.');
    return { bytes: decodeBase64(lastAudio.data), mimeType: lastAudio.mime_type ?? '' };
}

export function normalizeGeminiTtsAudio(bytes, mimeType = '') {
    const audio = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (!audio.length) throw new Error('Gemini audio data is invalid.');
    if (isWav(audio)) return audio;
    const mime = trim(mimeType).toLowerCase();
    if (mime.startsWith('audio/l16') || (!mime && !isKnownAudioContainer(audio))) {
        const rate = /(?:^|;)\s*rate\s*=\s*(\d+)/i.exec(mime)?.[1];
        const sampleRate = rate ? Number(rate) : 24000;
        if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
            throw new Error('Gemini audio sample rate is invalid.');
        }
        return wrapPcmInWav(audio, sampleRate);
    }
    return audio;
}
