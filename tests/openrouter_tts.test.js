import assert from 'node:assert/strict';
import test from 'node:test';

import {
    OPENROUTER_TTS_URL,
    buildOpenRouterSpeechRequest,
    createOpenRouterHttpError,
    normalizeOpenRouterAudio,
    normalizeOpenRouterConfig,
    selectOpenRouterResponseFormat,
} from '../src/services/tts/openrouter/core.js';

test('OpenRouter TTS builds a fixed speech request with optional voice and speed', () => {
    const request = buildOpenRouterSpeechRequest(' Hello ', {
        apiKey: 'openrouter-private-key',
        model: 'example/model',
        voice: 'sample-voice',
        speed: '1.25',
    });
    assert.equal(request.url, OPENROUTER_TTS_URL);
    assert.equal(request.url.includes('openrouter-private-key'), false);
    assert.equal(request.headers.Authorization, 'Bearer openrouter-private-key');
    assert.deepEqual(request.payload, {
        model: 'example/model',
        input: 'Hello',
        response_format: 'mp3',
        speed: 1.25,
        voice: 'sample-voice',
    });
});

test('OpenRouter TTS requests PCM for Gemini and Deepgram Flux speech models', () => {
    assert.equal(selectOpenRouterResponseFormat('google/gemini-3-flash-tts-preview'), 'pcm');
    assert.equal(selectOpenRouterResponseFormat('deepgram/flux-tts:free'), 'pcm');
    assert.equal(selectOpenRouterResponseFormat('provider/standard-tts'), 'mp3');
});

test('OpenRouter TTS rejects incompatible OpenAI chat-audio models and invalid configuration', () => {
    assert.throws(() => normalizeOpenRouterConfig({ apiKey: 'key', model: 'openai/gpt-audio-mini' }), /not compatible/);
    assert.throws(() => normalizeOpenRouterConfig({ model: 'example/model' }), /API key is required/);
    assert.throws(() => normalizeOpenRouterConfig({ apiKey: 'key', model: 'example/model', speed: '0' }), /speed/);
    assert.throws(() => buildOpenRouterSpeechRequest(' ', { apiKey: 'key', model: 'example/model' }), /Text to synthesize/);
});

test('OpenRouter PCM audio is wrapped as 24 kHz mono 16-bit WAV for playback', () => {
    const pcm = [0, 0, 255, 127, 0, 128, 0, 0];
    const wav = Buffer.from(normalizeOpenRouterAudio(pcm, 'pcm', { 'content-type': 'audio/pcm' }));
    assert.equal(wav.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(wav.subarray(8, 12).toString('ascii'), 'WAVE');
    assert.equal(wav.readUInt16LE(22), 1);
    assert.equal(wav.readUInt32LE(24), 24000);
    assert.equal(wav.readUInt16LE(34), 16);
    assert.deepEqual([...wav.subarray(44)], pcm);
});

test('OpenRouter leaves MP3 and already wrapped WAV audio unchanged and rejects empty audio', () => {
    const mp3 = [73, 68, 51];
    const wav = [82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69];
    assert.deepEqual(normalizeOpenRouterAudio(mp3, 'pcm'), mp3);
    assert.deepEqual(normalizeOpenRouterAudio(wav, 'pcm'), wav);
    assert.throws(() => normalizeOpenRouterAudio([], 'mp3'), /no audio/);
});

test('OpenRouter HTTP errors redact both the configured key and Bearer values', () => {
    const key = 'openrouter-error-secret';
    const response = Buffer.from(JSON.stringify({ error: { message: `Bad ${key}; Bearer ${key}` } }));
    const error = createOpenRouterHttpError(401, response, key);
    assert.match(error.message, /HTTP 401/);
    assert.match(error.message, /\[REDACTED\]/);
    assert.doesNotMatch(error.message, /openrouter-error-secret/);
});
