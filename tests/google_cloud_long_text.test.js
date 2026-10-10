import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { detectAudioMimeType } from '../src/utils/read_aloud_player.js';
import {
    isGoogleCloudLengthError,
    mergeGoogleCloudWav,
    splitGoogleCloudText,
} from '../src/services/tts/google_cloud/synthesis.js';

// Load the real provider entry point, replacing only the desktop HTTP transport and UI-only exports.
// No credentials, network, or real application configuration are used.
const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const LONG_SENTENCE_MESSAGE =
    'This request contains sentences that are too long. Consider splitting up long sentences with sentence ending punctuation e.g. periods. Sentence starting with: "Funda" is too long.';
let transportId = 0;

function fixtureWav(text, rate = 24000, extraChunk = false) {
    const dataOffset = extraChunk ? 54 : 44;
    const result = new Uint8Array(dataOffset + text.length * 2);
    const view = new DataView(result.buffer);
    const ascii = (offset, value) => {
        for (let i = 0; i < value.length; i++) result[offset + i] = value.charCodeAt(i);
    };
    ascii(0, 'RIFF');
    view.setUint32(4, result.length - 8, true);
    ascii(8, 'WAVE');
    ascii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    if (extraChunk) {
        ascii(36, 'JUNK');
        view.setUint32(40, 1, true);
        result[44] = 7;
    }
    ascii(dataOffset - 8, 'data');
    view.setUint32(dataOffset - 4, text.length * 2, true);
    for (let i = 0; i < text.length; i++) view.setUint16(dataOffset + i * 2, text.charCodeAt(i), true);
    return result;
}

async function loadProvider({
    sentenceLimit = 600,
    status = 200,
    message = 'Invalid audio setting',
    mismatchRate = false,
} = {}) {
    const httpUrl = dataModule(`
        // Isolate each transport and provider module instance: ${transportId++}
        export const calls = [];
        export const accepted = [];
        export const Body = { json: payload => ({ payload }) };
        const fixtureWav = ${fixtureWav.toString()};
        export async function fetch(url, options) {
            const payload = options.body.payload;
            calls.push(payload);
            if (${status} !== 200) return { status: ${status}, data: { error: { message: ${JSON.stringify(message)} } } };
            if (new TextEncoder().encode(payload.input.text).length > 5000) return { status: 400, data: { error: { message: 'Either input.text or input.ssml is longer than the limit of 5000 bytes.' } } };
            if (payload.input.text.split(/[.!?。！？]/u).some(sentence => sentence.length > ${sentenceLimit})) return { status: 400, data: { error: { message: ${JSON.stringify(LONG_SENTENCE_MESSAGE)} } } };
            accepted.push(payload);
            if (payload.audioConfig.audioEncoding === 'LINEAR16') {
                const rate = ${mismatchRate} && accepted.length > 1 ? 16000 : 24000;
                return { status: 200, data: { audioContent: Buffer.from(fixtureWav(payload.input.text, rate, true)).toString('base64') } };
            }
            return { status: 200, data: { audioContent: 'SUQz' } };
        }
    `);
    const coreUrl = new URL('../src/services/tts/google_cloud/core.js', import.meta.url).href;
    const languageUrl = dataModule('export const Language = {};');
    const source = fs
        .readFileSync(new URL('../src/services/tts/google_cloud/index.jsx', import.meta.url), 'utf8')
        .replace("'@tauri-apps/api/http'", JSON.stringify(httpUrl))
        .replace("'./core'", JSON.stringify(coreUrl))
        .replace(
            "'./synthesis'",
            JSON.stringify(new URL('../src/services/tts/google_cloud/synthesis.js', import.meta.url).href)
        )
        .replaceAll("'./info'", JSON.stringify(languageUrl))
        .replace(/export \* from '\.\/Config';/, '');
    return { provider: await import(dataModule(source)), http: await import(httpUrl) };
}

test('Google Cloud retries the exact Funda sentence-too-long HTTP 400 and returns all audio', async () => {
    const { provider, http } = await loadProvider();
    const text = `Funda ${'x '.repeat(297)}x`; // 601 characters; removing one word is enough for the mock to accept it.
    assert.ok(
        (await provider.tts(text.slice(0, -2), 'pl', { config: { credential: 'test-only-key', voice: 'chirp3_kore' } }))
            .length > 0
    );
    http.calls.length = 0;
    http.accepted.length = 0;
    const audio = await provider
        .tts(text, 'pl', { config: { credential: 'test-only-key', voice: 'chirp3_kore' } })
        .catch((error) => assert.fail(error.message));
    assert.ok(audio.length > 0);
    assert.equal(detectAudioMimeType(audio), 'audio/wav');
    assert.ok(http.calls.length > 1, 'rejected long sentence must be split and synthesized');
    assert.ok(http.accepted.every((call) => call.input.text.length <= 600));
    assert.equal(
        http.accepted
            .map((call) => call.input.text)
            .join(' ')
            .replace(/\s+/g, ' '),
        text
    );
    assert.ok(http.accepted.every((call) => call.voice.name === 'pl-PL-Chirp3-HD-Kore'));
    const view = new DataView(audio.buffer, audio.byteOffset, audio.byteLength);
    const expected = http.accepted.map((call) => call.input.text).join('');
    assert.equal(view.getUint32(40, true), expected.length * 2);
    assert.equal(audio.length, 44 + expected.length * 2);
    assert.equal(
        Array.from({ length: expected.length }, (_, index) =>
            String.fromCharCode(view.getUint16(44 + index * 2, true))
        ).join(''),
        expected
    );
});

test('Google Cloud splits UTF-8 multibyte text without losing Unicode code points', async () => {
    const { provider, http } = await loadProvider({ sentenceLimit: Number.MAX_SAFE_INTEGER });
    const text = '界😀'.repeat(1500);
    const config = { credential: 'test-only-key', voice: 'chirp3_kore', audioEncoding: 'OGG_OPUS', speakingRate: 1.25 };
    const audio = await provider.tts(text, 'zh_cn', { config });
    assert.ok(http.calls.length > 1);
    assert.equal(http.accepted.map((call) => call.input.text).join(''), text);
    for (const call of http.calls) {
        assert.ok(new TextEncoder().encode(call.input.text).length <= 4000);
        assert.equal(Buffer.from(call.input.text).toString(), call.input.text);
        assert.equal(call.audioConfig.audioEncoding, 'LINEAR16');
        assert.equal(call.audioConfig.speakingRate, 1.25);
    }
    assert.equal(config.audioEncoding, 'OGG_OPUS');
    assert.equal(new DataView(audio.buffer).getUint32(40, true), text.length * 2);
});

test('Google Cloud keeps short text format and makes one request', async () => {
    const { provider, http } = await loadProvider();
    const audio = await provider.tts('Hello.', 'en', { config: { credential: 'test-only-key' } });
    assert.deepEqual(audio, [73, 68, 51]);
    assert.equal(http.calls.length, 1);
    assert.equal(http.calls[0].audioConfig.audioEncoding, 'MP3');
});

for (const status of [400, 401, 403, 429, 500]) {
    test(`Google Cloud does not split or retry unrelated HTTP ${status} failures`, async () => {
        const { provider, http } = await loadProvider({ status });
        await assert.rejects(provider.tts('Hello.', 'en', { config: { credential: 'test-only-key' } }), (error) => {
            assert.equal(error.status, status);
            return true;
        });
        assert.equal(http.calls.length, 1);
    });
}

test('Google Cloud stops requesting remaining chunks after cancellation', async () => {
    const { provider, http } = await loadProvider({ sentenceLimit: Number.MAX_SAFE_INTEGER });
    await assert.rejects(
        provider.tts('a '.repeat(6000), 'en', {
            config: { credential: 'test-only-key' },
            shouldContinue: () => http.accepted.length < 1,
        }),
        /cancelled/
    );
    assert.equal(http.calls.length, 1);
});

test('Google Cloud rejects mismatched WAV segments instead of returning incomplete audio', async () => {
    const { provider } = await loadProvider({ sentenceLimit: Number.MAX_SAFE_INTEGER, mismatchRate: true });
    await assert.rejects(
        provider.tts('a '.repeat(2500), 'en', { config: { credential: 'test-only-key' } }),
        /different WAV formats/
    );
});

test('Google Cloud bounds splitting when even one-character text is rejected', async () => {
    const { provider, http } = await loadProvider({ status: 400, message: LONG_SENTENCE_MESSAGE });
    await assert.rejects(provider.tts('x', 'en', { config: { credential: 'test-only-key' } }), /too long/);
    assert.equal(http.calls.length, 1);
});

test('Google Cloud synthesizes a full long passage after adaptive splits, including its final words', async () => {
    const { provider, http } = await loadProvider();
    const text = `Funda ${Array.from({ length: 1200 }, (_, index) => `word${index}`).join(' ')} final-word`;
    const audio = await provider.tts(text, 'pl', { config: { credential: 'test-only-key', voice: 'chirp3_kore' } });
    assert.equal(http.accepted.map((call) => call.input.text).join(' '), text);
    const expected = http.accepted.map((call) => call.input.text).join('');
    const view = new DataView(audio.buffer);
    assert.equal(view.getUint32(4, true), audio.length - 8);
    assert.equal(view.getUint32(40, true), expected.length * 2);
    assert.equal(
        Array.from({ length: 10 }, (_, index) =>
            String.fromCharCode(view.getUint16(audio.length - 20 + index * 2, true))
        ).join(''),
        'final-word'
    );
});

test('Google Cloud rejects quota errors even when their detail mentions sentence length', async () => {
    const { provider, http } = await loadProvider({ status: 429, message: LONG_SENTENCE_MESSAGE });
    await assert.rejects(
        provider.tts('Hello.', 'en', { config: { credential: 'test-only-key' } }),
        (error) => error.status === 429
    );
    assert.equal(http.calls.length, 1);
});

test('Google Cloud identifies sentence and byte-limit errors only for HTTP 400', () => {
    assert.equal(isGoogleCloudLengthError({ status: 400, message: LONG_SENTENCE_MESSAGE }), true);
    assert.equal(
        isGoogleCloudLengthError({
            status: 400,
            message: 'Either input.text or input.ssml is longer than the limit of 5000 bytes.',
        }),
        true
    );
    assert.equal(isGoogleCloudLengthError({ status: 400, message: 'Input size exceeds the maximum limit.' }), true);
    assert.equal(isGoogleCloudLengthError({ status: 403, message: LONG_SENTENCE_MESSAGE }), false);
    assert.equal(isGoogleCloudLengthError({ status: 400, message: 'Unsupported sample rate.' }), false);
});

test('Google Cloud byte splitting prefers natural boundaries and keeps all non-whitespace characters', () => {
    const cases = [
        'Hello world. Next sentence. '.repeat(150),
        'Zażółć gęślą jaźń, jeszcze tekst; '.repeat(120),
        '中文句子。下一句😀'.repeat(100),
        'x'.repeat(7000),
        '😀'.repeat(1600),
    ];
    for (const text of cases) {
        const chunks = splitGoogleCloudText(text);
        assert.equal(chunks.join('').replace(/\s/g, ''), text.replace(/\s/g, ''));
        assert.ok(chunks.every((chunk) => new TextEncoder().encode(chunk).length <= 4000));
        assert.ok(chunks.every((chunk) => Buffer.from(chunk).toString() === chunk));
    }
    assert.throws(() => splitGoogleCloudText('Hello', 0), /invalid/);
});

test('Google Cloud merges WAV data around padded metadata chunks and rejects truncated packets', () => {
    const first = fixtureWav('First part.', 24000, true);
    const second = fixtureWav('Last part.', 24000, false);
    const combined = mergeGoogleCloudWav([first, second]);
    assert.equal(new DataView(combined.buffer).getUint32(40, true), 42);
    assert.throws(() => mergeGoogleCloudWav([first.slice(0, -2)]), /incomplete WAV/);
    assert.throws(() => mergeGoogleCloudWav([[73, 68, 51]]), /invalid LINEAR16 WAV/);
});
