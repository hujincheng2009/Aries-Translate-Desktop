import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyGeminiHttpError } from '../src/utils/gemini_error.js';
import { createCooldownStore } from '../src/utils/cooldown_store.js';
import {
    normalizeGeminiFreeConfig,
    buildGeminiFreeRequest,
    extractGeminiText,
    createGeminiSseParser,
    cleanGeminiText,
    runGeminiFreeTranslate,
    createGeminiFreeCooldowns,
    createGeminiJsonStore,
    createGeminiModelState,
    geminiFreeError,
    formatGeminiFreeError,
} from '../src/services/translate/gemini_free/core.js';
const fakeKey = 'FAKE_TEST_CREDENTIAL';
const config = normalizeGeminiFreeConfig({ apiKey: fakeKey });
const now = Date.parse('2026-09-30T12:00:00Z');
const storage = () => {
    const values = new Map();
    return { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
};
function harness(callModel, options = {}) {
    const memory = createGeminiJsonStore('thinking', storage());
    const state = createGeminiJsonStore('state', storage());
    const cooldowns = createGeminiFreeCooldowns({ storage: storage(), now: () => now });
    const args = {
        models: ['first', 'second'],
        thinking: 'lowest',
        callModel,
        cooldowns,
        thinkingMemory: memory,
        modelState: createGeminiModelState(state, 'fingerprint', () => now),
        keyFingerprint: 'fingerprint',
        now: () => now,
        ...options,
    };
    return { args, memory, state, cooldowns, run: () => runGeminiFreeTranslate(args) };
}
test('config validates and normalizes custom model order and URL', () => {
    const result = normalizeGeminiFreeConfig({
        apiKey: ` ${fakeKey} `,
        models: ' first, second\nfirst, ',
        requestPath: ' example.test/v1beta/models/gemini-pro/// ',
        thinking: 'wrong',
    });
    assert.deepEqual(result.models, ['first', 'second']);
    assert.equal(result.requestPath, 'https://example.test/v1beta');
    assert.equal(result.thinking, 'lowest');
    for (const value of [{ apiKey: '' }, { models: [] }, { userPrompt: 'missing' }])
        assert.throws(() => normalizeGeminiFreeConfig({ ...config, ...value }));
});
test('request uses headers, substitutes variables once, omits deprecated settings', () => {
    const request = buildGeminiFreeRequest({
        config: { ...config, userPrompt: '$text $from $to $detect' },
        model: 'a/b',
        text: 'literal $to',
        from: 'English',
        to: 'Chinese',
        detect: 'Polish',
        thinkingLevel: 'minimal',
        stream: true,
    });
    assert.match(request.url, /a%2Fb:streamGenerateContent\?alt=sse$/);
    assert.ok(!request.url.includes(fakeKey));
    assert.equal(request.headers['x-goog-api-key'], fakeKey);
    assert.equal(request.body.contents[0].parts[0].text, 'literal $to English Chinese Polish');
    assert.ok(request.body.systemInstruction);
    for (const key of ['safetySettings', 'temperature', 'topP', 'topK', 'candidateCount', 'thinkingBudget'])
        assert.ok(!JSON.stringify(request.body).includes(key));
    assert.ok(!buildGeminiFreeRequest({ config, model: 'first', thinkingLevel: null }).body.generationConfig);
    assert.ok(
        !buildGeminiFreeRequest({ config: { ...config, systemPrompt: '' }, model: 'first' }).body.systemInstruction
    );
});
test('text and SSE parsing handle thoughts, signatures, chunk splits and final line', () => {
    assert.equal(
        extractGeminiText({
            candidates: [
                {
                    content: {
                        parts: [
                            { text: 'secret', thought: true },
                            { text: 'hello' },
                            { thoughtSignature: 'signature' },
                            { text: ' world' },
                        ],
                    },
                },
            ],
        }).text,
        'hello world'
    );
    assert.equal(extractGeminiText({ promptFeedback: { blockReason: 'SAFETY' } }).blockReason, 'SAFETY');
    const parser = createGeminiSseParser();
    assert.deepEqual(parser.push('data: {"a":'), []);
    assert.deepEqual(parser.push('1}\r\n\r\ndata: {"b":2}\nignore\ndata: {"c":3}'), [{ a: 1 }, { b: 2 }]);
    assert.deepEqual(parser.end(), [{ c: 3 }]);
    assert.throws(() => createGeminiSseParser().push('data: invalid\n'));
    for (const [input, output] of [
        [' "hello" ', 'hello'],
        ['“hello”', 'hello'],
        ['"hello', '"hello'],
        ['hello”', 'hello”'],
    ])
        assert.equal(cleanGeminiText(input), output);
});
test('HTTP classifications and quota precedence', () => {
    const daily = {
        error: {
            status: 'RESOURCE_EXHAUSTED',
            message: 'limit: 20 Please retry in 34.074824224s.',
            details: [
                {
                    '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
                    violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }],
                },
                { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '34s' },
            ],
        },
    };
    const result = classifyGeminiHttpError(429, JSON.stringify(daily), now);
    assert.equal(result.kind, 'quota_daily');
    assert.ok(!('retryAfterMs' in result));
    assert.ok(result.resetAt > now);
    assert.equal(
        classifyGeminiHttpError(429, { error: { details: [{ '@type': 'google.rpc.RetryInfo', retryDelay: '19s' }] } })
            .retryAfterMs,
        19000
    );
    assert.equal(classifyGeminiHttpError(429, { error: { message: 'limit: 0' } }).limitZero, true);
    assert.equal(classifyGeminiHttpError(429, { error: { message: 'limit: 0.5' } }).limitZero, false);
    for (const [status, body, kind] of [
        [400, { details: [{ reason: 'API_KEY_INVALID' }] }, 'auth'],
        [401, {}, 'auth'],
        [402, {}, 'billing'],
        [403, {}, 'auth'],
        [400, { status: 'FAILED_PRECONDITION' }, 'region'],
        [404, {}, 'not_found'],
        [503, {}, 'unavailable'],
        [500, {}, 'unavailable'],
        [504, {}, 'unavailable'],
        [400, { message: 'Thinking level MINIMAL is not supported for this model.' }, 'thinking_unsupported'],
        [400, {}, 'invalid_request'],
        [418, {}, 'other'],
    ])
        assert.equal(classifyGeminiHttpError(status, [{ error: body }]).kind, kind);
});
test('success uses only first model and records state', async () => {
    const calls = [];
    const h = harness(async ({ model }) => {
        calls.push(model);
        return { text: ' "你好" ' };
    });
    assert.equal((await h.run()).text, '你好');
    assert.deepEqual(calls, ['first']);
    assert.equal(h.state.get('fingerprint|first').lastSuccessAt, now);
});
for (const kind of [
    'auth',
    'billing',
    'region',
    'network',
    'blocked',
    'quota_daily',
    'rate_limited',
    'not_found',
    'unavailable',
    'timeout',
    'invalid_request',
    'empty',
    'other',
]) {
    test(`failure ${kind} follows stop and cooldown policy`, async () => {
        const calls = [];
        const h = harness(async ({ model }) => {
            calls.push(model);
            if (model === 'first') throw geminiFreeError(kind, 'fake failure');
            return { text: 'ok' };
        });
        const stop = ['auth', 'billing', 'region', 'network', 'blocked'].includes(kind);
        if (stop) await assert.rejects(h.run(), (error) => error.failures.length === 1);
        else assert.equal((await h.run()).model, 'second');
        assert.equal(calls.length, stop ? 1 : 2);
        assert.equal(h.state.get('fingerprint|first').lastFailureKind, kind);
        assert.equal(
            Boolean(h.cooldowns.read()['fingerprint|first']),
            ['quota_daily', 'rate_limited', 'not_found'].includes(kind)
        );
    });
}
test('cooldowns skip models; all cooled models are attempted in order', async () => {
    const calls = [];
    const h = harness(async ({ model }) => {
        calls.push(model);
        return { text: 'ok' };
    });
    h.cooldowns.record('fingerprint|first', { kind: 'rate_limited' });
    assert.equal((await h.run()).model, 'second');
    h.cooldowns.record('fingerprint|second', { kind: 'rate_limited' });
    assert.equal((await h.run()).model, 'first');
    assert.deepEqual(calls, ['second', 'first']);
});
test('lowest retries same model and remembers low without counting initial error', async () => {
    const calls = [];
    const h = harness(async ({ model, thinkingLevel }) => {
        calls.push([model, thinkingLevel]);
        if (thinkingLevel === 'minimal') throw geminiFreeError('thinking_unsupported', 'unsupported');
        return { text: 'ok' };
    });
    assert.deepEqual((await h.run()).failures, []);
    await h.run();
    assert.deepEqual(calls, [
        ['first', 'minimal'],
        ['first', 'low'],
        ['first', 'low'],
    ]);
});
test('explicit thinking levels do not retry unsupported settings', async () => {
    const h = harness(
        async () => {
            throw geminiFreeError('thinking_unsupported', 'unsupported');
        },
        { thinking: 'low' }
    );
    await assert.rejects(
        h.run(),
        (error) => error.failures.length === 2 && error.failures.every((value) => value.kind === 'invalid_request')
    );
});
test('default thinking omits level, blocked and empty responses follow policy', async () => {
    const h = harness(
        async ({ thinkingLevel }) => {
            assert.equal(thinkingLevel, null);
            return { blockReason: 'SAFETY', text: '' };
        },
        { thinking: 'default' }
    );
    await assert.rejects(h.run(), (error) => error.failures[0].kind === 'blocked');
    const h2 = harness(async ({ model }) =>
        model === 'first' ? { text: '', finishReason: 'MAX_TOKENS' } : { text: 'ok', finishReason: 'MAX_TOKENS' }
    );
    assert.equal((await h2.run()).failures[0].kind, 'empty');
});
test('partial stream errors stop without switching; cancellation writes no failure', async () => {
    const calls = [];
    const h = harness(async ({ model, onText }) => {
        calls.push(model);
        onText('partial');
        throw geminiFreeError('timeout', 'timeout');
    });
    await assert.rejects(h.run(), (error) => /Partial translation/.test(error.message));
    assert.deepEqual(calls, ['first']);
    const cancel = harness(async () => assert.fail('should not call'), { shouldContinue: () => false });
    await assert.rejects(cancel.run(), (error) => error.cancelled && !error.failures);
    assert.deepEqual(cancel.state.read(), {});
    assert.deepEqual(cancel.cooldowns.read(), {});
    let current = true;
    const during = harness(
        async () => {
            current = false;
            throw geminiFreeError('quota_daily', 'quota');
        },
        { shouldContinue: () => current }
    );
    await assert.rejects(during.run(), (error) => error.cancelled);
    assert.deepEqual(during.cooldowns.read(), {});
    assert.deepEqual(during.state.read(), {});
});
test('zero quota maps to daily; reports sanitize credentials and display reset', async () => {
    const h = harness(async () => {
        throw geminiFreeError('rate_limited', 'limit: 0', { limitZero: true });
    });
    await assert.rejects(h.run(), (error) => error.failures.every((value) => value.kind === 'quota_daily'));
    const message = formatGeminiFreeError(
        [
            { model: 'first', kind: 'quota_daily', resetAt: now + 3600000 },
            {
                model: 'second',
                kind: 'auth',
                apiKey: fakeKey,
                message: `${fakeKey} key=SECOND_FAKE x-goog-api-key:THIRD_FAKE`,
            },
        ],
        { now }
    );
    assert.match(message, /resets at/);
    assert.ok(!message.includes(fakeKey));
    assert.ok(!message.includes('SECOND_FAKE'));
    assert.ok(!message.includes('THIRD_FAKE'));
});
test('store clears only fingerprint prefix, expires not-found and falls back to memory', () => {
    let clock = now;
    const target = storage();
    const h = createGeminiFreeCooldowns({ storage: target, now: () => clock });
    h.record('hash1|first', { kind: 'not_found' });
    h.record('hash1|second', { kind: 'quota_daily' });
    h.record('hash2|first', { kind: 'not_found' });
    h.clearWhere((key) => key.startsWith('hash1|'));
    assert.deepEqual(Object.keys(h.read()), ['hash2|first']);
    clock += 86400000;
    assert.deepEqual(h.read(), {});
    const unavailable = () => {
        throw new Error('unavailable');
    };
    const memory = createGeminiFreeCooldowns({ storage: unavailable, now: () => now });
    memory.record('hash|first', { kind: 'rate_limited' });
    assert.ok(memory.read()['hash|first']);
    memory.clear('hash|first');
    assert.deepEqual(memory.read(), {});
    const state = createGeminiJsonStore('state', unavailable);
    createGeminiModelState(state, 'hash', () => now).recordSuccess('first');
    assert.equal(state.get('hash|first').lastSuccessAt, now);
    assert.ok(!JSON.stringify(state.read()).includes(fakeKey));
    target.setItem(
        'generic',
        JSON.stringify({
            expired: { until: now - 1, kind: 'rate_limited' },
            invalid: { until: now + 1, kind: 'other' },
        })
    );
    assert.deepEqual(
        createCooldownStore({
            storageKey: 'generic',
            kinds: ['rate_limited'],
            resolveUntil: () => null,
            storage: target,
            now: () => now,
        }).read(),
        {}
    );
});

// Exercise the actual network adapter with injected transport boundaries, without React/Tauri or credentials.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const adapterMocks = { tauriFetch: null };
globalThis.__geminiFreeAdapterMocks = adapterMocks;
let adapterSource = await readFile(new URL('../src/services/translate/gemini_free/index.jsx', import.meta.url), 'utf8');
adapterSource = adapterSource
    .replace(
        /import \{ fetch as tauriFetch, Body \} from '@tauri-apps\/api\/http';/,
        `const tauriFetch = (...args) => globalThis.__geminiFreeAdapterMocks.tauriFetch(...args); const Body = { json: (value) => value };`
    )
    .replace(
        /import SHA256 from 'crypto-js\/sha256';/,
        `const SHA256 = (value) => ({ toString: () => globalThis.__geminiFreeAdapterMocks.hash(value) });`
    )
    .replace(/import i18next from 'i18next';/, `const i18next = { t: () => undefined };`)
    .replace(
        /import \{ Language \} from '.\/info';/,
        `const Language = { auto: 'Auto', zh_cn: 'Simplified Chinese', en: 'English' };`
    )
    .replace(
        /from '([^']+\.js)'/g,
        (_, relative) =>
            `from '${new URL(relative, new URL('../src/services/translate/gemini_free/index.jsx', import.meta.url)).href}'`
    )
    .replace(/export \* from '[^']+';/g, '');
adapterMocks.hash = (value) => createHash('sha256').update(value).digest('hex');
const adapter = await import(`data:text/javascript;base64,${Buffer.from(adapterSource).toString('base64')}`);
const responseBody = (text) => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] });
test('network adapter uses Tauri JSON timeout, detects language and returns cleaned text', async () => {
    adapterMocks.tauriFetch = async (url, options) => {
        assert.ok(!url.includes(fakeKey));
        assert.equal(options.timeout, 30);
        assert.equal(options.headers['x-goog-api-key'], fakeKey);
        assert.equal(options.body.contents[0].parts[0].text, 'hello English Chinese English');
        return { ok: true, data: responseBody('“你好”') };
    };
    assert.equal(
        await adapter.translate('hello', 'English', 'Chinese', {
            config: { ...config, stream: false, userPrompt: '$text $from $to $detect' },
            detect: 'en',
        }),
        '你好'
    );
});
test('single-model adapter test bypasses cooldowns and retries lowest thinking once', async () => {
    const calls = [];
    adapterMocks.tauriFetch = async (_, options) => {
        const level = options.body.generationConfig.thinkingConfig.thinkingLevel;
        calls.push(level);
        if (level === 'minimal')
            return {
                ok: false,
                status: 400,
                data: { error: { message: 'Thinking level MINIMAL is not supported for this model.' } },
            };
        return { ok: true, data: responseBody('你好') };
    };
    const model = 'adapter-lowest-model';
    adapter.geminiFreeCooldowns.record(`${adapter.geminiFreeFingerprint(fakeKey)}|${model}`, { kind: 'not_found' });
    assert.equal((await adapter.testModel(config, model)).text, '你好');
    assert.deepEqual(calls, ['minimal', 'low']);
    calls.length = 0;
    await adapter.testModel(config, model);
    assert.deepEqual(calls, ['low']);
});
test('adapter redacts raw credentials and stops after one authentication failure', async () => {
    let calls = 0;
    adapterMocks.tauriFetch = async () => {
        calls++;
        return { ok: false, status: 403, data: { error: { message: `Denied ${fakeKey}` } } };
    };
    await assert.rejects(
        adapter.translate('hello', 'English', 'Chinese', { config: { ...config, stream: false } }),
        (error) => !error.message.includes(fakeKey) && error.failures[0].kind === 'auth'
    );
    assert.equal(calls, 1);
});
test('stream adapter decodes split Unicode and signature-only terminal events', async () => {
    const original = globalThis.window;
    const bytes = new TextEncoder().encode(
        `data: ${JSON.stringify(responseBody('你好'))}\n\ndata: {"candidates":[{"content":{"parts":[{"thoughtSignature":"opaque"}]},"finishReason":"STOP"}]}\n\n`
    );
    globalThis.window = {
        fetch: async (_, options) => {
            assert.equal(options.headers['x-goog-api-key'], fakeKey);
            return new Response(
                new ReadableStream({
                    start(controller) {
                        controller.enqueue(bytes.slice(0, 58));
                        controller.enqueue(bytes.slice(58));
                        controller.close();
                    },
                })
            );
        },
    };
    const values = [];
    try {
        assert.equal(
            await adapter.translate('hello', 'English', 'Chinese', {
                config: { ...config, models: ['adapter-stream-model'] },
                setResult: (value) => values.push(value),
            }),
            '你好'
        );
        assert.equal(values.at(-1), '你好');
        assert.ok(values.includes('你好_'));
    } finally {
        globalThis.window = original;
    }
});
test('stream adapter first-text timeout aborts and falls back; malformed SSE is other', async () => {
    const originalWindow = globalThis.window;
    const originalTimer = globalThis.setTimeout;
    globalThis.setTimeout = (callback, milliseconds, ...args) =>
        originalTimer(callback, milliseconds === 30000 ? 5 : milliseconds, ...args);
    const calls = [];
    globalThis.window = {
        fetch: async (url, options) => {
            calls.push(url);
            if (url.includes('timeout-model'))
                return new Response(
                    new ReadableStream({
                        start(controller) {
                            options.signal.addEventListener('abort', () => controller.error(new Error('aborted')));
                        },
                    })
                );
            return new Response(`data: ${JSON.stringify(responseBody('ok'))}\n\n`);
        },
    };
    try {
        assert.equal(
            await adapter.translate('hello', 'English', 'Chinese', {
                config: { ...config, models: ['timeout-model', 'success-model'] },
            }),
            'ok'
        );
        assert.equal(calls.length, 2);
    } finally {
        globalThis.window = originalWindow;
        globalThis.setTimeout = originalTimer;
    }
    globalThis.window = { fetch: async () => new Response('data: bad json\n') };
    try {
        await assert.rejects(
            adapter.translate('hello', 'English', 'Chinese', { config: { ...config, models: ['malformed-model'] } }),
            (error) => error.failures[0].kind === 'other'
        );
    } finally {
        globalThis.window = originalWindow;
    }
});
test('stream adapter partial failure preserves output and stops switching', async () => {
    const original = globalThis.window;
    let calls = 0;
    globalThis.window = {
        fetch: async () => {
            calls++;
            return new Response(
                `data: ${JSON.stringify(responseBody('partial'))}\n\ndata: {"error":{"code":503,"message":"overloaded"}}\n\n`
            );
        },
    };
    const values = [];
    try {
        await assert.rejects(
            adapter.translate('hello', 'English', 'Chinese', {
                config: { ...config, models: ['partial-model', 'next-model'] },
                setResult: (value) => values.push(value),
            }),
            (error) => error.failures[0].partial
        );
        assert.deepEqual(values, ['partial_']);
        assert.equal(calls, 1);
    } finally {
        globalThis.window = original;
    }
});
