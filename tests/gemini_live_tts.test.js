import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    normalizeGeminiLiveConfig,
    DEFAULT_PROMPT_ZH,
    DEFAULT_PROMPT_OTHER,
    DEFAULT_LIVE_TIMEOUTS,
    planGeminiLiveSegments,
    expectedSpeechSeconds,
    speechSeconds,
    judgeGeminiLiveSegment,
    buildGeminiLiveSetup,
    buildGeminiLiveTextMessage,
    decodeGeminiLiveFrame,
    concatGeminiLivePcm,
    redactGeminiLiveError,
    classifyGeminiLiveClose,
    runGeminiLiveAttempt,
    synthesizeGeminiLive,
} from '../src/services/tts/gemini_live/core.js';
import { runTtsFallback, createTtsCooldownStore } from '../src/utils/tts_fallback.js';
const fakeKey = 'FAKE_LIVE_TEST_CREDENTIAL';
const config = normalizeGeminiLiveConfig({ apiKey: fakeKey });
function pcm(seconds = 0.2, amplitude = 3000) {
    const count = Math.round(seconds * 24000);
    const bytes = new Uint8Array(count * 2);
    const view = new DataView(bytes.buffer);
    for (let index = 0; index < count; index++)
        view.setInt16(index * 2, Math.round(amplitude * Math.sin((2 * Math.PI * 440 * index) / 24000)), true);
    return bytes;
}
const frame = (data) => new TextEncoder().encode(JSON.stringify(data)).buffer;
const audioEvent = (bytes = pcm()) => ({
    serverContent: {
        modelTurn: {
            parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: Buffer.from(bytes).toString('base64') } }],
        },
    },
});
const done = { serverContent: { generationComplete: true } };
function mockSockets(scenarios = []) {
    const sockets = [];
    class MockSocket extends EventTarget {
        constructor(url) {
            super();
            this.url = url;
            this.sent = [];
            this.closed = false;
            this.index = sockets.length;
            sockets.push(this);
            queueMicrotask(() => {
                if (!this.closed) this.dispatchEvent(new Event('open'));
            });
        }
        send(value) {
            const message = JSON.parse(value);
            this.sent.push(message);
            const scenario =
                scenarios[this.index] ??
                scenarios.at(-1) ??
                (() => {
                    this.message(audioEvent());
                    this.message(done);
                });
            if (message.setup) {
                if (scenario.setup) scenario.setup(this);
                else this.message({ setupComplete: {} });
            } else scenario.call(this, this, message);
        }
        message(value, format = 'binary') {
            const data =
                format === 'string'
                    ? JSON.stringify(value)
                    : format === 'blob'
                      ? new Blob([JSON.stringify(value)])
                      : frame(value);
            this.dispatchEvent(new MessageEvent('message', { data }));
        }
        serverClose(code, reason) {
            const event = new Event('close');
            Object.assign(event, { code, reason });
            this.dispatchEvent(event);
        }
        close(code) {
            this.closed = true;
            this.closeCode = code;
        }
    }
    return { WebSocketImpl: MockSocket, sockets };
}
const attempt = (mock, options = {}) =>
    runGeminiLiveAttempt({
        url: `wss://example.test/live?key=${fakeKey}`,
        setup: buildGeminiLiveSetup(config, 'other'),
        text: 'hello',
        WebSocketImpl: mock.WebSocketImpl,
        ...options,
    });
const synthesize = (mock, options = {}) =>
    synthesizeGeminiLive({ text: 'hello', config, WebSocketImpl: mock.WebSocketImpl, ...options });
test('Live config trims and defaults, rejects empty credentials/model and invalid attempts', () => {
    const result = normalizeGeminiLiveConfig({
        apiKey: ` ${fakeKey} `,
        model: ' model ',
        voice: ' ',
        promptZh: '',
        promptOther: ' ',
        attempts: 9,
        instanceName: ' name ',
    });
    assert.equal(result.apiKey, fakeKey);
    assert.equal(result.model, 'model');
    assert.equal(result.voice, 'Kore');
    assert.equal(result.attempts, 3);
    assert.equal(result.instanceName, 'name');
    assert.equal(result.promptZh, DEFAULT_PROMPT_ZH);
    assert.equal(result.promptOther, DEFAULT_PROMPT_OTHER);
    for (const attempts of [1, 2, 3])
        assert.equal(normalizeGeminiLiveConfig({ ...config, attempts }).attempts, attempts);
    for (const attempts of [0, 4, 1.5, '2', null])
        assert.equal(normalizeGeminiLiveConfig({ ...config, attempts }).attempts, 3);
    assert.throws(() => normalizeGeminiLiveConfig({ ...config, apiKey: '' }));
    assert.throws(() => normalizeGeminiLiveConfig({ ...config, model: '' }));
});
test('Live defaults exactly match the approved diagnostic echo prompts', () => {
    const script = readFileSync(new URL('../scripts/gemini_live_probe.mjs', import.meta.url), 'utf8').replace(
        /\r\n/g,
        '\n'
    );
    for (const [name, expected] of [
        ['ECHO_PROMPT_ZH', DEFAULT_PROMPT_ZH],
        ['ECHO_PROMPT_EN', DEFAULT_PROMPT_OTHER],
    ])
        assert.equal(script.match(new RegExp(`const ${name} = \x60([\\s\\S]*?)\x60;`))[1], expected);
});
test('segment planning rejects kana without cooldown but permits the common long-vowel mark', () => {
    for (const text of ['こんにちは', 'カタカナ', 'mixed あ'])
        assert.throws(
            () => planGeminiLiveSegments(text),
            (error) => error.languageUnsupported && !error.ttsFailure
        );
    assert.equal(planGeminiLiveSegments('ー')[0].text, 'ー');
    assert.throws(() => planGeminiLiveSegments(' '));
});
test('sentence planning preserves English spaces/newlines and decimal points', () => {
    const input = 'First sentence. Second costs 2.4 euros!\nNext line?';
    const result = planGeminiLiveSegments(input);
    assert.equal(result[0].text, input);
    assert.equal(result[0].promptKey, 'other');
    const chinese = planGeminiLiveSegments('你好，  世界。下一句！')[0];
    assert.equal(chinese.original, '你好，  世界。下一句！');
    assert.equal(chinese.text, '你好， 世界。 下一句！');
    assert.equal(chinese.promptKey, 'zh');
});
test('planner packs sentences, splits clauses and hard-cuts Unicode without splitting surrogates', () => {
    const sentence = 'a'.repeat(99) + '.';
    const result = planGeminiLiveSegments(`${sentence} ${sentence} ${sentence}`);
    assert.ok(result.length > 1);
    assert.ok(result.every((segment) => Array.from(segment.original).length <= 200));
    const clauses = planGeminiLiveSegments('甲'.repeat(120) + '，' + '乙'.repeat(120));
    assert.equal(clauses.length, 2);
    assert.equal(clauses[0].original.length, 121);
    const hard = planGeminiLiveSegments('😀'.repeat(401));
    assert.deepEqual(
        hard.map((segment) => Array.from(segment.original).length),
        [200, 200, 1]
    );
    assert.equal(hard.map((segment) => segment.original).join(''), '😀'.repeat(401));
});
test('Live setup and user payload use approved fields without unsupported settings', () => {
    const setup = buildGeminiLiveSetup(config, 'zh');
    assert.equal(setup.setup.model, 'models/gemini-3.8-live');
    assert.equal(setup.setup.systemInstruction.parts[0].text, DEFAULT_PROMPT_ZH);
    assert.deepEqual(setup.setup.generationConfig.responseModalities, ['AUDIO']);
    assert.equal(setup.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Kore');
    assert.deepEqual(setup.setup.outputAudioTranscription, {});
    for (const field of ['thinkingConfig', 'temperature', 'languageCode', 'proactivity'])
        assert.ok(!JSON.stringify(setup).includes(field));
    assert.equal(buildGeminiLiveSetup({ ...config, model: 'models/custom' }, 'other').setup.model, 'models/custom');
    assert.deepEqual(buildGeminiLiveTextMessage('hello'), {
        clientContent: { turns: [{ role: 'user', parts: [{ text: 'hello' }] }], turnComplete: true },
    });
});
test('frame decoder accepts binary, Blob, string and typed-array views', async () => {
    const value = { setupComplete: {}, text: '你好' };
    const bytes = frame(value);
    for (const data of [bytes, new Uint8Array(bytes), new Blob([bytes]), JSON.stringify(value)])
        assert.deepEqual(await decodeGeminiLiveFrame(data), value);
    await assert.rejects(decodeGeminiLiveFrame('bad json'));
    await assert.rejects(decodeGeminiLiveFrame(123));
});
test('speech measurement ignores silence and measures sine PCM within 100 ms', () => {
    assert.equal(speechSeconds(pcm(1, 0)), 0);
    assert.ok(Math.abs(speechSeconds(pcm(1.23)) - 1.23) < 0.1);
    assert.equal(expectedSpeechSeconds('你好 hello world'), 2 * 0.22 + 2 * 0.35);
    assert.equal(expectedSpeechSeconds('! ,'), 0);
    const backing = concatGeminiLivePcm([pcm(0.1, 0), pcm(0.2)]);
    assert.ok(Math.abs(speechSeconds(backing.subarray(4800)) - 0.2) < 0.01);
});
test('read-completion judge handles silence, interruption, short text and 50% threshold', () => {
    assert.equal(judgeGeminiLiveSegment({ pcm: new Uint8Array(), original: 'hello' }).reason, 'silent');
    assert.equal(judgeGeminiLiveSegment({ pcm: pcm(1), original: 'hello', interrupted: true }).reason, 'interrupted');
    assert.equal(judgeGeminiLiveSegment({ pcm: pcm(0.02, 0), original: 'hello' }).ok, true);
    assert.equal(judgeGeminiLiveSegment({ pcm: pcm(0.5), original: 'one two three four' }).reason, 'incomplete');
    assert.equal(judgeGeminiLiveSegment({ pcm: pcm(0.7), original: 'one two three four' }).ok, true);
    assert.equal(judgeGeminiLiveSegment({ pcm: pcm(2), original: 'one two three four' }).ok, true);
});
test('attempt finishes at generationComplete and closes without waiting for delayed turnComplete', async () => {
    const mock = mockSockets([
        function () {
            this.message(audioEvent());
            this.message(done);
        },
    ]);
    const start = performance.now();
    const result = await attempt(mock);
    assert.ok(performance.now() - start < 1000);
    assert.equal(result.pcm.length, pcm().length);
    assert.equal(mock.sockets[0].binaryType, 'arraybuffer');
    assert.equal(mock.sockets[0].closeCode, 1000);
    assert.ok(result.timings.setupMs >= 0);
    assert.ok(result.timings.firstAudioMs >= 0);
    // The delayed turnComplete is irrelevant after all listeners have been removed.
    mock.sockets[0].message({ serverContent: { turnComplete: true } });
});
test('attempt serializes delayed Blob decoding before completion and a queued close', async () => {
    class DelayedBlob extends Blob {
        async text() {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return super.text();
        }
    }
    const bytes = pcm();
    const mock = mockSockets([
        function () {
            this.dispatchEvent(
                new MessageEvent('message', { data: new DelayedBlob([JSON.stringify(audioEvent(bytes))]) })
            );
            this.message(done);
            this.serverClose(1006, 'closed');
        },
    ]);
    assert.deepEqual((await attempt(mock)).pcm, bytes);
});
test('silent first attempt retries with a new connection and succeeds', async () => {
    const mock = mockSockets([
        function () {
            this.message(done);
        },
        function () {
            this.message(audioEvent());
            this.message(done);
        },
    ]);
    const wav = await synthesize(mock);
    assert.equal(mock.sockets.length, 2);
    assert.equal(new TextDecoder().decode(new Uint8Array(wav.slice(0, 4))), 'RIFF');
});
test('failure exhaustion reports exact silence, incomplete and other counts', async () => {
    const mock = mockSockets([
        function () {
            this.message(done);
        },
        function () {
            this.message(audioEvent(pcm(0.1)));
            this.message(done);
        },
        function () {
            this.serverClose(1011, 'Internal error');
        },
    ]);
    await assert.rejects(
        synthesize(mock, { text: 'one two three four' }),
        (error) =>
            error.ttsFailure.kind === 'other' &&
            /3 attempts, 1 silent, 1 incomplete, 1 other/.test(error.message) &&
            /temporarily unavailable/.test(error.message)
    );
    assert.equal(mock.sockets.length, 3);
});
test('all-silent retries stop at configured maximum', async () => {
    const mock = mockSockets([
        function () {
            this.message(done);
        },
    ]);
    await assert.rejects(synthesize(mock, { config: { ...config, attempts: 2 } }), /2 attempts, 2 silent/);
    assert.equal(mock.sockets.length, 2);
});
for (const [code, message, expected, cooldown] of [
    [1007, 'API key not valid', 'auth'],
    [1008, 'unregistered callers', 'auth'],
    [1008, 'reported leaked', 'auth'],
    [1008, 'denied access', 'auth'],
    [1008, 'model not found', 'other'],
    [1008, 'not supported for bidiGenerateContent', 'other'],
    [1011, 'quota exhausted', 'rate_limited', 60000],
    [1007, 'invalid argument', 'other'],
]) {
    test(`close ${code} ${message} stops retry and maps fallback category`, async () => {
        const mock = mockSockets([
            function () {
                this.serverClose(code, message);
            },
        ]);
        await assert.rejects(
            synthesize(mock),
            (error) => error.ttsFailure.kind === expected && error.ttsFailure.retryAfterMs === cooldown
        );
        assert.equal(mock.sockets.length, 1);
    });
}
test('other close codes and connection constructor failures are retried', async () => {
    assert.equal(classifyGeminiLiveClose(1006, '').kind, 'network');
    assert.equal(classifyGeminiLiveClose(1011, 'unavailable').kind, 'server');
    let calls = 0;
    class Broken {
        constructor() {
            calls++;
            throw new Error(`wss://bad?key=${fakeKey}`);
        }
    }
    await assert.rejects(
        synthesizeGeminiLive({ text: 'hello', config, WebSocketImpl: Broken }),
        (error) => !error.message.includes(fakeKey) && !error.message.includes('wss://')
    );
    assert.equal(calls, 3);
});
test('interrupted turns retry immediately even without generationComplete', async () => {
    const mock = mockSockets([
        function () {
            this.message(audioEvent());
            this.message({ serverContent: { interrupted: true, turnComplete: true } });
        },
        function () {
            this.message(audioEvent());
            this.message(done);
        },
    ]);
    await synthesize(mock);
    assert.equal(mock.sockets.length, 2);
});
test('goAway before generation ends retries, goAway after completion is harmless', async () => {
    const mock = mockSockets([
        function () {
            this.message({ goAway: { timeLeft: '0s' } });
        },
        function () {
            this.message(audioEvent());
            this.message({ ...done, goAway: {} });
        },
    ]);
    await synthesize(mock);
    assert.equal(mock.sockets.length, 2);
});
test('bad JSON and unexpected PCM format stop with safe invalid-response errors', async () => {
    for (const scenario of [
        function () {
            this.dispatchEvent(new MessageEvent('message', { data: 'bad' }));
        },
        function () {
            this.message({
                serverContent: {
                    modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=16000', data: '' } }] },
                },
            });
        },
        function () {
            this.message({
                serverContent: {
                    modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'bad!' } }] },
                },
            });
        },
    ]) {
        const mock = mockSockets([scenario]);
        await assert.rejects(synthesize(mock), (error) => error.ttsFailure.kind === 'other');
        assert.equal(mock.sockets.length, 1);
    }
});
function monitoredClock() {
    const timers = new Set();
    return {
        timers,
        now: () => Date.now(),
        setTimeout(callback, delay) {
            const timer = setTimeout(() => {
                timers.delete(timer);
                callback();
            }, delay);
            timers.add(timer);
            return timer;
        },
        clearTimeout(timer) {
            clearTimeout(timer);
            timers.delete(timer);
        },
    };
}
for (const phase of ['setup', 'idle', 'total']) {
    test(`${phase} timeout retries, closes sockets and clears every timer`, async () => {
        const clock = monitoredClock();
        const scenario = function () {};
        if (phase === 'setup') scenario.setup = () => {};
        const mock = mockSockets([scenario]);
        const timeouts = {
            setupMs: phase === 'setup' ? 10 : 100,
            idleMs: phase === 'idle' ? 10 : 100,
            totalMs: phase === 'total' ? 10 : 100,
        };
        await assert.rejects(
            synthesize(mock, { config: { ...config, attempts: 2 }, clock, timeouts }),
            (error) => /2 attempts/.test(error.message) && /timed out/.test(error.message)
        );
        assert.equal(mock.sockets.length, 2);
        assert.ok(mock.sockets.every((socket) => socket.closed));
        assert.equal(clock.timers.size, 0);
    });
}
test('success also releases timers and multiple segments concatenate PCM in order', async () => {
    const first = pcm(0.1, 2000),
        second = pcm(0.2, 4000),
        clock = monitoredClock();
    const mock = mockSockets([
        function () {
            this.message(audioEvent(first));
            this.message(done);
        },
        function () {
            this.message(audioEvent(second));
            this.message(done);
        },
    ]);
    const wav = new Uint8Array(await synthesize(mock, { text: 'x'.repeat(200) + 'y'.repeat(200), clock }));
    const view = new DataView(wav.buffer);
    assert.equal(view.getUint32(24, true), 24000);
    assert.equal(view.getUint32(40, true), first.length + second.length);
    assert.deepEqual(wav.subarray(44), concatGeminiLivePcm([first, second]));
    assert.equal(mock.sockets.length, 2);
    assert.equal(clock.timers.size, 0);
    assert.ok(mock.sockets[0].closed && mock.sockets[1].closed);
    assert.equal(mock.sockets[0].sent[1].clientContent.turns[0].parts[0].text, 'x'.repeat(200));
});
test('a later failed segment produces no partial WAV', async () => {
    const mock = mockSockets([
        function () {
            this.message(audioEvent());
            this.message(done);
        },
        function () {
            this.message(done);
        },
    ]);
    await assert.rejects(
        synthesize(mock, { text: 'x'.repeat(400), config: { ...config, attempts: 1 } }),
        /segment 2\/2/
    );
    assert.equal(mock.sockets.length, 2);
});
test('errors redact raw and URL-encoded keys, tokens, WebSocket URLs and truncate', async () => {
    const message = `API key not valid ${fakeKey} wss://example.test/live?key=${fakeKey} key=FAKE_OTHER access_token=FAKE_TOKEN`;
    const redacted = redactGeminiLiveError(message, fakeKey);
    for (const value of [fakeKey, 'wss://', 'FAKE_OTHER', 'FAKE_TOKEN']) assert.ok(!redacted.includes(value));
    assert.equal(redactGeminiLiveError('x'.repeat(2000)).length, 1000);
    const mock = mockSockets([
        function () {
            this.serverClose(1007, message);
        },
    ]);
    await assert.rejects(
        attempt(mock),
        (error) => !error.message.includes(fakeKey) && !error.message.includes('wss://')
    );
    const mock2 = mockSockets([
        function () {
            this.serverClose(1007, message);
        },
    ]);
    await assert.rejects(
        synthesize(mock2),
        (error) => !error.message.includes(fakeKey) && !error.message.includes('wss://')
    );
});
test('Japanese rejection reaches existing fallback without starting a Live connection', async () => {
    const mock = mockSockets();
    const result = await runTtsFallback({
        text: 'こんにちは',
        serviceInstanceList: ['live', 'backup'],
        language: { mode: 'fixed', language: 'auto' },
        getConfig: async () => config,
        getMetadata: async (key) => ({ serviceLabel: key }),
        synthesize: async ({ serviceInstanceKey }) => ({
            data: serviceInstanceKey === 'live' ? await synthesize(mock, { text: 'こんにちは' }) : [1],
        }),
    });
    assert.equal(result.serviceInstanceKey, 'backup');
    assert.equal(mock.sockets.length, 0);
    assert.equal(result.failures[0].kind, 'other');
});
test('Live quota integrates with existing fallback cooldown unchanged', async () => {
    const mock = mockSockets([
        function () {
            this.serverClose(1011, 'quota exceeded');
        },
    ]);
    const cooldowns = createTtsCooldownStore({
        storage: () => {
            throw new Error('unavailable');
        },
    });
    const result = await runTtsFallback({
        text: 'hello',
        serviceInstanceList: ['live', 'backup'],
        language: { mode: 'fixed', language: 'auto' },
        getConfig: async () => config,
        getMetadata: async (key) => ({ serviceLabel: key }),
        cooldowns,
        synthesize: async ({ serviceInstanceKey }) => ({
            data: serviceInstanceKey === 'live' ? await synthesize(mock) : [1],
        }),
    });
    assert.equal(result.serviceInstanceKey, 'backup');
    assert.equal(result.failures[0].kind, 'rate_limited');
    assert.equal(cooldowns.read().live.kind, 'rate_limited');
});
test('missing i18n still interpolates English error counts', async () => {
    const mock = mockSockets([
        function () {
            this.message(done);
        },
    ]);
    await assert.rejects(
        synthesize(mock, { t: () => undefined, config: { ...config, attempts: 1 } }),
        (error) => !error.message.includes('{{') && /1 attempts, 1 silent/.test(error.message)
    );
});
