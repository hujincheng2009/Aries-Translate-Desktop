import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildGeminiTtsRequest, createGeminiTtsHttpError, extractGeminiTtsAudio,
    normalizeGeminiTtsAudio, normalizeGeminiTtsConfig, redactGeminiTtsError,
} from '../src/services/tts/gemini/core.js';

const baseConfig = { apiKey: 'fake-test-key', model: 'gemini-3.8-flash-lite-tts' };
const audioBlock = (data, mime_type = 'audio/wav') => ({ type: 'audio', data, mime_type });
const step = (...content) => ({ type: 'model_output', content });

test('Gemini request sends the transcript verbatim through Interactions with header-only key and no storage', () => {
    const request = buildGeminiTtsRequest(' Hello <sigh> ', baseConfig);
    assert.equal(request.url.includes(baseConfig.apiKey), false);
    assert.equal(request.headers['x-goog-api-key'], baseConfig.apiKey);
    assert.equal(request.payload.model, baseConfig.model);
    assert.equal(request.payload.store, false);
    assert.deepEqual(request.payload.response_format, { type: 'audio' });
    assert.deepEqual(request.payload.generation_config.speech_config, [{ voice: 'Kore' }]);
    assert.deepEqual(request.payload.input, [{ type: 'user_input', content: [{ type: 'text', text: 'Hello <sigh>' }] }]);
    assert.equal(JSON.stringify(request.payload).includes(baseConfig.apiKey), false);
});

test('Gemini request includes optional style and custom voice ID', () => {
    const request = buildGeminiTtsRequest('Speak', { ...baseConfig, voice: ' voice_example ', style: ' speaking slowly ' });
    assert.deepEqual(request.payload.generation_config.speech_config, [{ voice: 'voice_example' }]);
    assert.deepEqual(request.payload.input[0].content[0].annotations, [{ type: 'speech_metadata', style: 'speaking slowly' }]);
    assert.equal(normalizeGeminiTtsConfig({ ...baseConfig, voice: ' ' }).voice, 'Kore');
});

test('Gemini rejects empty text, key, model, and oversized style before a request', () => {
    assert.throws(() => buildGeminiTtsRequest(' ', baseConfig), /Text to synthesize/);
    assert.throws(() => buildGeminiTtsRequest('a', { model: 'model' }), /API Key/);
    assert.throws(() => buildGeminiTtsRequest('a', { apiKey: 'key' }), /model/);
    assert.throws(() => buildGeminiTtsRequest('a', { ...baseConfig, style: 'x'.repeat(501) }), /style is too long/);
});

test('Gemini extracts the last model audio block', () => {
    const result = extractGeminiTtsAudio({ status: 'completed', steps: [
        step(audioBlock('AQI=')), { type: 'tool_output', content: [audioBlock('BAU=')] }, step(audioBlock('AwQ=', 'audio/l16')),
    ] });
    assert.deepEqual([...result.bytes], [3, 4]);
    assert.equal(result.mimeType, 'audio/l16');
});

test('Gemini rejects failed, incomplete, absent, and corrupt audio responses', () => {
    assert.throws(() => extractGeminiTtsAudio({ status: 'failed' }), /failed/);
    assert.throws(() => extractGeminiTtsAudio({ status: 'incomplete' }), /too long/);
    assert.throws(() => extractGeminiTtsAudio({}), /no audio/);
    assert.throws(() => extractGeminiTtsAudio({ steps: [step({ type: 'text', text: 'hi' })] }), /no audio/);
    assert.throws(() => extractGeminiTtsAudio({ steps: [step(audioBlock('!invalid!'))] }), /invalid/);
});

test('Gemini keeps WAV and MP3 but wraps raw PCM at the indicated sample rate', () => {
    const wav = Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]);
    const mp3 = Uint8Array.from([73, 68, 51, 0]);
    assert.equal(normalizeGeminiTtsAudio(wav, 'audio/l16'), wav);
    assert.equal(normalizeGeminiTtsAudio(mp3, 'audio/mpeg'), mp3);
    for (const [mime, rate] of [['audio/l16', 24000], ['audio/l16; rate=16000', 16000], ['', 24000]]) {
        const result = Buffer.from(normalizeGeminiTtsAudio([0, 0, 255, 127], mime));
        assert.equal(result.subarray(0, 4).toString('ascii'), 'RIFF');
        assert.equal(result.readUInt16LE(22), 1);
        assert.equal(result.readUInt32LE(24), rate);
        assert.equal(result.readUInt16LE(34), 16);
        assert.deepEqual([...result.subarray(44)], [0, 0, 255, 127]);
    }
});

test('Gemini HTTP errors explain common statuses and redact secrets', () => {
    for (const [status, phrase] of [[400, 'model'], [401, 'API Key'], [403, 'access'], [404, 'Model'], [429, 'rate limit'], [500, 'unavailable']]) {
        assert.match(createGeminiTtsHttpError(status, {}).message, new RegExp(phrase, 'i'));
    }
    const error = createGeminiTtsHttpError(403, { error: { status: 'PERMISSION_DENIED', message: 'key=fake-test-key x-goog-api-key: another-secret fake-test-key' } }, baseConfig.apiKey);
    assert.doesNotMatch(error.message, /fake-test-key|another-secret/);
    assert.match(error.message, /PERMISSION_DENIED/);
    assert.doesNotMatch(redactGeminiTtsError('key=abc& x-goog-api-key: def'), /abc|def/);
});

test('Gemini reads array-wrapped errors and classifies an invalid API Key as auth', () => {
    const response = [{ error: {
        code: 400,
        message: 'API key not valid. Please pass a valid API key.',
        status: 'INVALID_ARGUMENT',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com' }],
    } }];
    const failure = createGeminiTtsHttpError(400, response);
    assert.equal(failure.ttsFailure.kind, 'auth');
    assert.match(failure.message, /API key not valid/i);
    assert.match(failure.message, /INVALID_ARGUMENT/);
});

test('Gemini daily quota uses Pacific midnight and ignores misleading retry seconds', () => {
    const now = Date.parse('2026-03-08T09:00:00Z');
    const response = { error: {
        message: 'Rate limit exceeded for model gemini-3.8-flash-lite-tts (limit: 10 requests per day on Free Tier). Please retry in 19s or upgrade your tier at https://ai.dev/rate-limit.',
        details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProject' }] }],
    } };
    const failure = createGeminiTtsHttpError(429, response, '', now);
    assert.equal(failure.ttsFailure.kind, 'quota_daily');
    assert.equal(failure.ttsFailure.resetAt, Date.parse('2026-03-09T07:01:00Z'));
    assert.equal(failure.ttsFailure.retryAfterMs, undefined);
    assert.doesNotMatch(failure.message, /retry in 19s/i);
    assert.match(failure.message, /per day/i);
    assert.equal(createGeminiTtsHttpError(429, { error: { message: '10 requests per day' } }, '', now).ttsFailure.kind, 'quota_daily');
});

test('Gemini rate limits parse RetryInfo delay and preserve redaction', () => {
    const failure = createGeminiTtsHttpError(429, { error: {
        message: 'Please retry in 50s; key=private-key',
        details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '1.5s' }],
    } }, 'private-key');
    assert.equal(failure.ttsFailure.kind, 'rate_limited');
    assert.equal(failure.ttsFailure.retryAfterMs, 1500);
    assert.doesNotMatch(failure.message, /private-key/);
    assert.equal(createGeminiTtsHttpError(429, { error: { message: 'Please retry in 19s' } }).ttsFailure.retryAfterMs, 19000);
});
