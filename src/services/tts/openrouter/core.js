import { detectAudioMimeType, wrapPcmInWav } from '../../../utils/tts_audio.js';

export const OPENROUTER_TTS_URL = 'https://openrouter.ai/api/v1/audio/speech';
export const OPENROUTER_DEFAULT_FORMATS = ['mp3', 'pcm'];
const PLAYABLE_FORMATS = [...OPENROUTER_DEFAULT_FORMATS, 'mp4'];

const DEFAULT_SPEED = 1;
const PCM_FORMAT = 'pcm';
const MP3_FORMAT = 'mp3';
const MAX_ERROR_DETAIL_LENGTH = 2000;

function toTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

export function buildOpenRouterSpeechModelUrl(model) {
    const id = toTrimmedString(model);
    if (!/^[\w-]+\/[\w-][\w.:-]*$/.test(id)) throw new Error('Enter an OpenRouter model ID (provider/model).');
    return `${OPENROUTER_TTS_URL}/models/${id.split('/').map(encodeURIComponent).join('/')}`;
}

export function readOpenRouterSpeechModel(data) {
    const parameters = Array.isArray(data?.output_modalities)
        ? data.output_modalities.find((modality) => modality?.type === 'speech')?.supported_parameters
        : undefined;
    const values = (parameter) => {
        const entries = parameters?.[parameter]?.values;
        return Array.isArray(entries) ? [...new Set(entries.map(toTrimmedString).filter(Boolean))] : [];
    };
    return {
        voices: values('voice'),
        formats: values('response_format').filter((format) => PLAYABLE_FORMATS.includes(format)),
    };
}

function isHeygenVoice(model) {
    return model.toLowerCase().startsWith('heygen/heygen-voice-');
}

export function selectOpenRouterResponseFormat(model) {
    const normalizedModel = toTrimmedString(model).toLowerCase();
    const isGeminiTts = normalizedModel.startsWith('google/gemini-') && normalizedModel.includes('tts');
    const isDeepgramFluxTts = normalizedModel.startsWith('deepgram/flux-tts');
    return isGeminiTts || isDeepgramFluxTts || isHeygenVoice(normalizedModel) ? PCM_FORMAT : MP3_FORMAT;
}

export function assertModelEndpointCompatibility(model) {
    const normalizedModel = toTrimmedString(model).toLowerCase();
    const isOpenAiChatAudioModel = /^openai\/gpt-audio(?:-mini)?(?:$|[-:])/.test(normalizedModel);
    if (isOpenAiChatAudioModel) {
        throw new Error('This OpenAI audio model is not compatible with the OpenRouter TTS speech endpoint.');
    }
}

function normalizeSpeed(value) {
    if (value === undefined || value === null || value === '') return DEFAULT_SPEED;
    const speed = Number(value);
    if (!Number.isFinite(speed) || speed < 0.25 || speed > 4) {
        throw new Error('OpenRouter speech speed must be between 0.25 and 4.');
    }
    return speed;
}

export function normalizeOpenRouterConfig(config = {}) {
    const apiKey = toTrimmedString(config?.apiKey);
    const model = toTrimmedString(config?.model);
    if (!apiKey) throw new Error('OpenRouter API key is required.');
    if (!model) throw new Error('OpenRouter model is required.');
    assertModelEndpointCompatibility(model);
    const responseFormat = toTrimmedString(config?.responseFormat).toLowerCase();
    if (responseFormat && !PLAYABLE_FORMATS.includes(responseFormat)) {
        throw new Error('Invalid OpenRouter audio format.');
    }
    return {
        apiKey,
        model,
        voice: toTrimmedString(config?.voice),
        speed: normalizeSpeed(config?.speed),
        responseFormat: responseFormat || selectOpenRouterResponseFormat(model),
    };
}

export function buildOpenRouterSpeechRequest(text, config = {}) {
    const input = toTrimmedString(text);
    if (!input) throw new Error('Text to synthesize is required.');
    const normalized = normalizeOpenRouterConfig(config);
    const payload = {
        model: normalized.model,
        input,
        response_format: normalized.responseFormat,
        speed: normalized.speed,
    };
    if (normalized.voice) payload.voice = normalized.voice;

    return {
        url: OPENROUTER_TTS_URL,
        apiKey: normalized.apiKey,
        headers: {
            Authorization: `Bearer ${normalized.apiKey}`,
            'Content-Type': 'application/json',
        },
        payload,
    };
}

function bytesToText(bytes) {
    try {
        return new TextDecoder().decode(bytes);
    } catch {
        return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    }
}

export function responseDataToText(data) {
    if (typeof data === 'string') return data;
    if (data instanceof ArrayBuffer) return bytesToText(new Uint8Array(data));
    if (ArrayBuffer.isView(data)) return bytesToText(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    if (Array.isArray(data)) return bytesToText(new Uint8Array(data));
    if (data === null || data === undefined) return '';
    try {
        return JSON.stringify(data);
    } catch {
        return String(data);
    }
}

export function redactOpenRouterError(value, apiKey = '') {
    let result = String(value ?? '');
    if (apiKey) result = result.split(apiKey).join('[REDACTED]');
    result = result.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]');
    return result.slice(0, MAX_ERROR_DETAIL_LENGTH);
}

export function createOpenRouterHttpError(status, data, apiKey = '') {
    const raw = responseDataToText(data).trim();
    let detail = raw;
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            detail = parsed?.error?.message ?? parsed?.message ?? raw;
        } catch {
            // Keep a short, redacted provider message even when it is not JSON.
        }
    }
    const safeDetail = redactOpenRouterError(detail, apiKey);
    const statusNumber = Number.isFinite(Number(status)) ? Number(status) : 'UNKNOWN';
    const prefix =
        statusNumber === 401 || statusNumber === 403
            ? `OpenRouter rejected the API key or request (HTTP ${statusNumber}).`
            : statusNumber === 429
              ? 'OpenRouter request quota was reached (HTTP 429).'
              : Number(statusNumber) >= 500
                ? `OpenRouter is temporarily unavailable (HTTP ${statusNumber}).`
                : `OpenRouter speech request failed (HTTP ${statusNumber}).`;
    return new Error(safeDetail ? `${prefix} ${safeDetail}` : prefix);
}

function toAudioBytes(data) {
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    if (Array.isArray(data)) return new Uint8Array(data);
    if (Array.isArray(data?.data)) return new Uint8Array(data.data);
    return null;
}

function isEmptyAudioData(data) {
    if (data === null || data === undefined) return true;
    if (typeof data === 'string' || Array.isArray(data)) return data.length === 0;
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) return data.byteLength === 0;
    return Array.isArray(data?.data) && data.data.length === 0;
}

function responseContentType(headers = {}) {
    for (const [name, value] of Object.entries(headers)) {
        if (name.toLowerCase() === 'content-type') return String(value).toLowerCase();
    }
    return '';
}

export { wrapPcmInWav } from '../../../utils/tts_audio.js';

export function normalizeOpenRouterAudio(data, responseFormat, headers = {}, model = '') {
    if (isEmptyAudioData(data)) throw new Error('OpenRouter returned no audio.');
    const contentType = responseContentType(headers);
    const mime = contentType.split(';', 1)[0].trim();
    if (mime !== 'audio/pcm' && (responseFormat !== PCM_FORMAT || mime.startsWith('audio/') || mime === 'video/mp4'))
        return data;
    const bytes = toAudioBytes(data);
    if (!bytes || (mime !== 'audio/pcm' && detectAudioMimeType(bytes))) return data;
    const rate = Number(/;\s*rate\s*=\s*(\d+)\s*(?=;|$)/.exec(contentType)?.[1]);
    const channels = Number(/;\s*channels\s*=\s*(\d+)\s*(?=;|$)/.exec(contentType)?.[1]);
    const defaultRate = isHeygenVoice(model) ? 44100 : 24000;
    return wrapPcmInWav(
        bytes,
        rate > 0 && rate <= 192000 ? rate : defaultRate,
        channels > 0 && channels <= 8 ? channels : 1
    );
}
