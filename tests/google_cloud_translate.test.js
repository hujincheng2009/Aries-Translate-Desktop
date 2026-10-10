import assert from 'node:assert/strict';
import test from 'node:test';

import {
    GOOGLE_CLOUD_TRANSLATE_URL,
    buildGoogleCloudTranslateRequest,
    normalizeGoogleCloudTranslateConfig,
    parseGoogleCloudTranslateResponse,
    redactGoogleCloudTranslateError,
} from '../src/services/translate/google_cloud/core.js';

test('Google Cloud Translation keeps the key in a header and sends plain text to the NMT model', () => {
    const request = buildGoogleCloudTranslateRequest('<b>Tom & Jerry</b>', 'en', 'zh-CN', { apiKey: ' private-key ' });
    assert.equal(request.url, GOOGLE_CLOUD_TRANSLATE_URL);
    assert.equal(request.url.includes('private-key'), false);
    assert.equal(request.headers['x-goog-api-key'], 'private-key');
    assert.deepEqual(request.body, { q: '<b>Tom & Jerry</b>', target: 'zh-CN', format: 'text', source: 'en' });
    assert.equal('model' in request.body, false);
});

test('Google Cloud Translation lets the API detect an automatic source language', () => {
    const request = buildGoogleCloudTranslateRequest('Bonjour', 'auto', 'en', { apiKey: 'key' });
    assert.equal('source' in request.body, false);
    assert.equal(request.body.target, 'en');
});

test('Google Cloud Translation rejects incomplete requests before network use', () => {
    assert.throws(() => normalizeGoogleCloudTranslateConfig({}), /API key is required/);
    assert.throws(() => buildGoogleCloudTranslateRequest(' ', 'en', 'de', { apiKey: 'key' }), /Text to translate/);
    assert.throws(() => buildGoogleCloudTranslateRequest('Hi', 'en', 'auto', { apiKey: 'key' }), /target language/);
});

test('Google Cloud Translation returns the translated text and reports malformed responses', () => {
    assert.equal(
        parseGoogleCloudTranslateResponse(200, { data: { translations: [{ translatedText: '你好', detectedSourceLanguage: 'en' }] } }),
        '你好'
    );
    assert.equal(parseGoogleCloudTranslateResponse(200, JSON.stringify({ data: { translations: [{ translatedText: 'Hallo' }] } })), 'Hallo');
    assert.throws(() => parseGoogleCloudTranslateResponse(200, { data: {} }), /Unable to parse/);
});

test('Google Cloud Translation maps HTTP failures and redacts the API key', () => {
    const apiKey = 'translate-private-key';
    const cases = [
        [400, /HTTP 400/],
        [403, /Cloud Translation API and billing/],
        [429, /quota or rate limit/],
        [503, /temporarily unavailable/],
    ];
    for (const [status, message] of cases) {
        assert.throws(
            () => parseGoogleCloudTranslateResponse(status, { error: { message: `Rejected ${apiKey} ?key=${apiKey}` } }, apiKey),
            (error) => {
                assert.match(error.message, message);
                assert.doesNotMatch(error.message, /translate-private-key/);
                return true;
            }
        );
    }
    assert.equal(redactGoogleCloudTranslateError('url?key=abc123&x=1'), 'url?key=[REDACTED]&x=1');
    assert.equal(redactGoogleCloudTranslateError('"x-goog-api-key": "abc123"'), '"x-goog-api-key": "[REDACTED]"');
});
