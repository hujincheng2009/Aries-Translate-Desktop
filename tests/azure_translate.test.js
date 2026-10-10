import assert from 'node:assert/strict';
import test from 'node:test';

import {
    AZURE_TRANSLATE_MAX_CHARACTERS,
    buildAzureTranslateRequest,
    normalizeAzureTranslateConfig,
    parseAzureTranslateResponse,
    redactAzureTranslateError,
} from '../src/services/translate/azure/core.js';

test('Azure Translator builds a v3.0 URL with the target and optional source, never the key', () => {
    const request = buildAzureTranslateRequest('Hello', 'en', 'zh-Hans', { key: 'azure-private-key' });
    const url = new URL(request.url);
    assert.equal(url.origin + url.pathname, 'https://api.cognitive.microsofttranslator.com/translate');
    assert.equal(url.searchParams.get('api-version'), '3.0');
    assert.equal(url.searchParams.get('to'), 'zh-Hans');
    assert.equal(url.searchParams.get('from'), 'en');
    assert.equal(request.url.includes('azure-private-key'), false);
    assert.deepEqual(request.body, [{ Text: 'Hello' }]);

    const automatic = new URL(buildAzureTranslateRequest('Bonjour', 'auto', 'en', { key: 'key' }).url);
    assert.equal(automatic.searchParams.has('from'), false);
});

test('Azure Translator sends the region header only when a region is set', () => {
    const regional = buildAzureTranslateRequest('Hi', 'en', 'de', { key: 'key', region: ' WestEurope ' });
    assert.equal(regional.headers['Ocp-Apim-Subscription-Key'], 'key');
    assert.equal(regional.headers['Ocp-Apim-Subscription-Region'], 'westeurope');
    const global = buildAzureTranslateRequest('Hi', 'en', 'de', { key: 'key', region: '' });
    assert.equal('Ocp-Apim-Subscription-Region' in global.headers, false);
    assert.throws(() => normalizeAzureTranslateConfig({ key: 'key', region: 'west europe' }), /valid Azure Translator region/);
});

test('Azure Translator rejects empty, oversized, or target-less requests before network use', () => {
    assert.throws(() => normalizeAzureTranslateConfig({}), /key is required/);
    assert.throws(() => buildAzureTranslateRequest(' ', 'en', 'de', { key: 'key' }), /Text to translate/);
    assert.throws(
        () => buildAzureTranslateRequest('a'.repeat(AZURE_TRANSLATE_MAX_CHARACTERS + 1), 'en', 'de', { key: 'key' }),
        /too long/
    );
    assert.equal(buildAzureTranslateRequest('a'.repeat(AZURE_TRANSLATE_MAX_CHARACTERS), 'en', 'de', { key: 'key' }).body.length, 1);
    assert.throws(() => buildAzureTranslateRequest('Hi', 'en', 'auto', { key: 'key' }), /target language/);
});

test('Azure Translator returns the first translation and reports malformed responses', () => {
    assert.equal(
        parseAzureTranslateResponse(200, [{ detectedLanguage: { language: 'en', score: 1 }, translations: [{ text: '你好', to: 'zh-Hans' }] }]),
        '你好'
    );
    assert.equal(parseAzureTranslateResponse(200, JSON.stringify([{ translations: [{ text: 'Hallo' }] }])), 'Hallo');
    assert.throws(() => parseAzureTranslateResponse(200, []), /Unable to parse/);
    assert.throws(() => parseAzureTranslateResponse(200, [{}]), /Unable to parse/);
});

test('Azure Translator maps HTTP failures and redacts the key', () => {
    const key = 'translator-secret-key';
    const cases = [
        [400, /HTTP 400/],
        [401, /region matches the resource/],
        [403, /free quota may be used up/],
        [429, /too many requests/],
        [503, /temporarily unavailable/],
    ];
    for (const [status, message] of cases) {
        assert.throws(
            () => parseAzureTranslateResponse(status, { error: { code: status * 1000, message: `Bad ${key}` } }, key),
            (error) => {
                assert.match(error.message, message);
                assert.doesNotMatch(error.message, /translator-secret-key/);
                return true;
            }
        );
    }
    assert.equal(redactAzureTranslateError('Ocp-Apim-Subscription-Key: abc123'), 'Ocp-Apim-Subscription-Key: [REDACTED]');
});
