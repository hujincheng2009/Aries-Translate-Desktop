import assert from 'node:assert/strict';
import test from 'node:test';

import { GOOGLE_OCR_LANGUAGE_HINTS, GOOGLE_OCR_URL, buildGoogleOcrRequest, normalizeGoogleOcrConfig, parseGoogleOcrResponse } from '../src/services/recognize/google_ocr/core.js';
import { GOOGLE_OCR_CHECK_IMAGE_BASE64 } from '../src/services/recognize/google_ocr/check_image.js';

test('Google OCR maps the complete supported Pot language set to Vision hints', () => {
    assert.deepEqual(Object.keys(GOOGLE_OCR_LANGUAGE_HINTS), [
        'auto','zh_cn','zh_tw','en','ja','ko','fr','es','ru','de','it','tr','pt_pt','pt_br','vi','id','th','ms','ar','hi','mn_cy','km',
    ]);
    assert.equal(GOOGLE_OCR_LANGUAGE_HINTS.auto, '');
    assert.equal(GOOGLE_OCR_LANGUAGE_HINTS.zh_cn, 'zh');
    assert.equal(GOOGLE_OCR_LANGUAGE_HINTS.zh_tw, 'zh-Hant');
    assert.equal(GOOGLE_OCR_LANGUAGE_HINTS.pt_br, 'pt');
});

test('Google OCR keeps its API key in a header and omits automatic language hints', () => {
    const request = buildGoogleOcrRequest('aGVsbG8=', GOOGLE_OCR_LANGUAGE_HINTS.auto, { api_key: 'private-key' });
    assert.equal(request.url, GOOGLE_OCR_URL);
    assert.equal(request.url.includes('private-key'), false);
    assert.equal(request.headers['x-goog-api-key'], 'private-key');
    assert.deepEqual(request.body.requests[0].features, [{ type: 'TEXT_DETECTION' }]);
    assert.equal('imageContext' in request.body.requests[0], false);
});

test('Google OCR sends a recognized language hint and rejects incomplete settings', () => {
    const request = buildGoogleOcrRequest('aGVsbG8=', GOOGLE_OCR_LANGUAGE_HINTS.zh_tw, { api_key: 'key' });
    assert.deepEqual(request.body.requests[0].imageContext, { languageHints: ['zh-Hant'] });
    assert.throws(() => normalizeGoogleOcrConfig({}), /API key is required/);
    assert.throws(() => buildGoogleOcrRequest('aGVsbG8=', 'not-supported', { api_key: 'key' }), /Language not supported/);
});

test('Google OCR test fixture is a small PNG image', () => {
    const png = Buffer.from(GOOGLE_OCR_CHECK_IMAGE_BASE64, 'base64');
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(png.readUInt32BE(16) <= 128);
    assert.ok(png.readUInt32BE(20) <= 128);
});

test('Google OCR returns full text from a successful Vision response', () => {
    assert.equal(
        parseGoogleOcrResponse(200, { responses: [{ fullTextAnnotation: { text: 'Pot OCR sample' } }] }),
        'Pot OCR sample'
    );
});

test('Google OCR maps HTTP failures and redacts echoed API keys', () => {
    const apiKey = 'vision-private-key';
    const cases = [
        [400, /HTTP 400/],
        [401, /HTTP 401/],
        [403, /HTTP 403/],
        [429, /quota/],
        [503, /temporarily unavailable/],
    ];
    for (const [status, message] of cases) {
        assert.throws(
            () => parseGoogleOcrResponse(status, { error: { message: `Rejected ${apiKey}` } }, apiKey),
            (error) => {
                assert.match(error.message, message);
                assert.match(error.message, /\[REDACTED\]/);
                assert.doesNotMatch(error.message, /vision-private-key/);
                return true;
            }
        );
    }
});

test('Google OCR distinguishes service errors, no text, and malformed responses', () => {
    assert.throws(
        () => parseGoogleOcrResponse(200, { responses: [{ error: { message: 'Image decode failed' } }] }),
        /Image decode failed/
    );
    assert.throws(() => parseGoogleOcrResponse(200, { responses: [{}] }), /No text was recognized/);
    assert.throws(() => parseGoogleOcrResponse(200, { unexpected: true }), /Unable to parse/);
});

test('Google OCR redacts an API key echoed in a per-image response error', () => {
    const apiKey = 'vision-error-secret';
    assert.throws(
        () => parseGoogleOcrResponse(200, { responses: [{ error: { message: `Denied ${apiKey}` } }] }, apiKey),
        (error) => {
            assert.match(error.message, /\[REDACTED\]/);
            assert.doesNotMatch(error.message, /vision-error-secret/);
            return true;
        }
    );
});

test('Google OCR sends the selected detection type and defaults to TEXT_DETECTION', () => {
    const general = buildGoogleOcrRequest('aGVsbG8=', GOOGLE_OCR_LANGUAGE_HINTS.auto, { api_key: 'key' });
    assert.deepEqual(general.body.requests[0].features, [{ type: 'TEXT_DETECTION' }]);
    const document = buildGoogleOcrRequest('aGVsbG8=', GOOGLE_OCR_LANGUAGE_HINTS.auto, {
        api_key: 'key',
        detection_type: 'DOCUMENT_TEXT_DETECTION',
    });
    assert.deepEqual(document.body.requests[0].features, [{ type: 'DOCUMENT_TEXT_DETECTION' }]);
    assert.equal(normalizeGoogleOcrConfig({ api_key: 'key', detection_type: '' }).detectionType, 'TEXT_DETECTION');
    assert.throws(
        () => buildGoogleOcrRequest('aGVsbG8=', GOOGLE_OCR_LANGUAGE_HINTS.auto, { api_key: 'key', detection_type: 'LABEL_DETECTION' }),
        /detection type is invalid/
    );
});
