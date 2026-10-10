import assert from 'node:assert/strict';
import test from 'node:test';

import {
    AZURE_OCR_MAX_IMAGE_BYTES,
    buildAzureDocumentReadRequest,
    buildAzureVisionReadRequest,
    getAzurePollDelayMs,
    normalizeAzureOcrConfig,
    normalizeAzureOcrEndpoint,
    parseAzureDocumentResult,
    parseAzureVisionReadResponse,
    resolveAzureOperationLocation,
    runAzureDocumentRead,
} from '../src/services/recognize/azure_ocr/core.js';
import { AZURE_OCR_CHECK_IMAGE_BASE64 } from '../src/services/recognize/azure_ocr/check_image.js';

const ENDPOINT = 'https://pot-ocr.cognitiveservices.azure.com';
const CONFIG = { endpoint: `${ENDPOINT}/`, key: 'ocr-private-key' };

test('Azure OCR accepts only HTTPS Azure resource endpoints', () => {
    assert.equal(normalizeAzureOcrEndpoint(' https://pot-ocr.cognitiveservices.azure.com/ '), ENDPOINT);
    assert.equal(normalizeAzureOcrEndpoint('https://westeurope.api.cognitive.microsoft.com'), 'https://westeurope.api.cognitive.microsoft.com');
    for (const endpoint of [
        'http://pot-ocr.cognitiveservices.azure.com',
        'https://example.com',
        'https://cognitiveservices.azure.com.evil.com',
        'https://pot-ocr.cognitiveservices.azure.com/vision',
        'https://pot-ocr.cognitiveservices.azure.com/?key=1',
        'https://pot-ocr.cognitiveservices.azure.com:8443',
    ]) {
        assert.throws(() => normalizeAzureOcrEndpoint(endpoint), /endpoint must be/, endpoint);
    }
    assert.throws(() => normalizeAzureOcrEndpoint(''), /endpoint is required/);
});

test('Azure OCR defaults to the image engine and rejects unknown engines or missing keys', () => {
    assert.equal(normalizeAzureOcrConfig(CONFIG).engine, 'vision_read');
    assert.equal(normalizeAzureOcrConfig({ ...CONFIG, engine: 'document_read' }).engine, 'document_read');
    assert.throws(() => normalizeAzureOcrConfig({ ...CONFIG, engine: 'layout' }), /engine is invalid/);
    assert.throws(() => normalizeAzureOcrConfig({ endpoint: ENDPOINT }), /key is required/);
});

test('Azure image OCR sends the decoded bytes with the key only in a header', () => {
    const request = buildAzureVisionReadRequest(AZURE_OCR_CHECK_IMAGE_BASE64, CONFIG);
    assert.equal(request.url, `${ENDPOINT}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=read`);
    assert.equal(request.url.includes('ocr-private-key'), false);
    assert.equal(request.headers['Ocp-Apim-Subscription-Key'], 'ocr-private-key');
    assert.equal(request.headers['Content-Type'], 'application/octet-stream');
    assert.deepEqual([...request.bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.deepEqual([...request.bytes], [...Buffer.from(AZURE_OCR_CHECK_IMAGE_BASE64, 'base64')]);
});

test('Azure OCR refuses images over the 4 MB free-tier limit before network use', () => {
    const oversized = Buffer.alloc(AZURE_OCR_MAX_IMAGE_BYTES + 1).toString('base64');
    assert.throws(() => buildAzureVisionReadRequest(oversized, CONFIG), /larger than 4 MB/);
    assert.throws(() => buildAzureDocumentReadRequest(oversized, CONFIG), /larger than 4 MB/);
    assert.throws(() => buildAzureVisionReadRequest('', CONFIG), /Image data is required/);
});

test('Azure test image is a PNG that meets the 50x50 minimum', () => {
    const png = Buffer.from(AZURE_OCR_CHECK_IMAGE_BASE64, 'base64');
    assert.ok(png.readUInt32BE(16) >= 50);
    assert.ok(png.readUInt32BE(20) >= 50);
});

test('Azure image OCR joins lines and blocks and reports empty results', () => {
    const body = {
        readResult: {
            blocks: [{ lines: [{ text: 'Pot OCR' }, { text: 'second line' }] }, { lines: [{ text: '第二块' }] }],
        },
    };
    assert.equal(parseAzureVisionReadResponse(200, body), 'Pot OCR\nsecond line\n第二块');
    assert.throws(() => parseAzureVisionReadResponse(200, { readResult: { blocks: [] } }), /No text was recognized/);
    assert.throws(() => parseAzureVisionReadResponse(200, {}), /Unable to parse/);
});

test('Azure document OCR submits base64Source to prebuilt-read', () => {
    const request = buildAzureDocumentReadRequest(AZURE_OCR_CHECK_IMAGE_BASE64, CONFIG);
    assert.equal(request.url, `${ENDPOINT}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-11-30`);
    assert.deepEqual(request.body, { base64Source: AZURE_OCR_CHECK_IMAGE_BASE64 });
    assert.equal(request.headers['Content-Type'], 'application/json');
});

test('Azure document OCR only follows result addresses on the configured endpoint', () => {
    const good = `${ENDPOINT}/documentintelligence/documentModels/prebuilt-read/analyzeResults/abc?api-version=2024-11-30`;
    assert.equal(resolveAzureOperationLocation({ 'operation-location': good }, ENDPOINT), good);
    assert.throws(
        () => resolveAzureOperationLocation({ 'Operation-Location': 'https://attacker.example.com/result' }, ENDPOINT),
        /outside the configured endpoint/
    );
    assert.throws(
        () => resolveAzureOperationLocation({ 'Operation-Location': good.replace('https:', 'http:') }, ENDPOINT),
        /outside the configured endpoint/
    );
    assert.throws(() => resolveAzureOperationLocation({}, ENDPOINT), /did not return a result address/);
});

test('Azure document OCR poll delay honors Retry-After within bounds', () => {
    assert.equal(getAzurePollDelayMs({}), 1000);
    assert.equal(getAzurePollDelayMs({ 'retry-after': '2' }), 2000);
    assert.equal(getAzurePollDelayMs({ 'Retry-After': '0.1' }), 500);
    assert.equal(getAzurePollDelayMs({ 'Retry-After': '60' }), 5000);
    assert.equal(getAzurePollDelayMs({ 'Retry-After': 'soon' }), 1000);
});

test('Azure document OCR result parsing covers running, success, and failure', () => {
    assert.deepEqual(parseAzureDocumentResult(200, { status: 'running' }), { done: false });
    assert.deepEqual(parseAzureDocumentResult(200, { status: 'succeeded', analyzeResult: { content: 'Pot OCR' } }), {
        done: true,
        text: 'Pot OCR',
    });
    assert.throws(
        () => parseAzureDocumentResult(200, { status: 'failed', error: { message: 'Bad image ocr-private-key' } }, 'ocr-private-key'),
        (error) => {
            assert.match(error.message, /Bad image/);
            assert.doesNotMatch(error.message, /ocr-private-key/);
            return true;
        }
    );
    assert.throws(() => parseAzureDocumentResult(200, { status: 'succeeded', analyzeResult: { content: ' ' } }), /No text/);
});

function fakeClock() {
    let time = 0;
    return { now: () => time, sleep: async (ms) => (time += ms) };
}

test('Azure document OCR submits, polls, and returns the text without real waiting', async () => {
    const clock = fakeClock();
    const calls = [];
    const location = `${ENDPOINT}/documentintelligence/documentModels/prebuilt-read/analyzeResults/1`;
    const responses = [
        { status: 202, data: '', headers: { 'operation-location': location, 'retry-after': '1' } },
        { status: 200, data: { status: 'running' }, headers: {} },
        { status: 200, data: { status: 'succeeded', analyzeResult: { content: 'Pot OCR' } }, headers: {} },
    ];
    const text = await runAzureDocumentRead(AZURE_OCR_CHECK_IMAGE_BASE64, { ...CONFIG, engine: 'document_read' }, {
        request: async (request) => {
            calls.push(request);
            return responses.shift();
        },
        ...clock,
    });
    assert.equal(text, 'Pot OCR');
    assert.deepEqual(calls.map((call) => call.method), ['POST', 'GET', 'GET']);
    assert.equal(calls[1].url, location);
    assert.deepEqual(calls[1].headers, { 'Ocp-Apim-Subscription-Key': 'ocr-private-key' });
    assert.equal(clock.now(), 2000);
});

test('Azure document OCR times out and surfaces submit errors', async () => {
    const clock = fakeClock();
    const location = `${ENDPOINT}/documentintelligence/documentModels/prebuilt-read/analyzeResults/2`;
    await assert.rejects(
        runAzureDocumentRead(AZURE_OCR_CHECK_IMAGE_BASE64, CONFIG, {
            request: async (request) =>
                request.method === 'POST'
                    ? { status: 202, data: '', headers: { 'operation-location': location } }
                    : { status: 200, data: { status: 'running' }, headers: {} },
            ...clock,
        }),
        /timed out/
    );
    await assert.rejects(
        runAzureDocumentRead(AZURE_OCR_CHECK_IMAGE_BASE64, CONFIG, {
            request: async () => ({ status: 403, data: { error: { message: 'Quota exceeded' } }, headers: {} }),
            ...fakeClock(),
        }),
        /free quota may be used up.*Quota exceeded/
    );
});
