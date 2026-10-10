import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createTtsCooldownStore,
    nextPacificMidnight,
    runTtsFallback,
    sanitizeTtsFailureMessage,
    TTS_COOLDOWN_STORAGE_KEY,
} from '../src/utils/tts_fallback.js';

function memoryStorage() {
    const values = new Map();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
    };
}

function fixture(overrides = {}) {
    let time = Date.parse('2026-01-15T12:00:00Z');
    const storage = memoryStorage();
    const cooldowns = createTtsCooldownStore({ storage, now: () => time });
    const calls = [];
    const options = {
        text: 'Hello',
        serviceInstanceList: ['gemini@lite', 'gemini@flash', 'azure@backup'],
        language: { mode: 'fixed', language: 'en' },
        getConfig: (key) => ({ instanceName: key, apiKey: `secret-${key}` }),
        getMetadata: async (key) => ({ serviceName: key.split('@')[0], serviceLabel: key }),
        synthesize: async ({ serviceInstanceKey }) => {
            calls.push(serviceInstanceKey);
            return { data: [1, 2, 3], language: 'en' };
        },
        cooldowns,
        now: () => time,
        ...overrides,
    };
    return { options, calls, cooldowns, storage, setTime: (value) => { time = value; } };
}

test('first successful service stops the list and reports no failures', async () => {
    const { options, calls } = fixture();
    const result = await runTtsFallback(options);
    assert.deepEqual(calls, ['gemini@lite']);
    assert.deepEqual(result.failures, []);
    assert.equal(result.serviceInstanceKey, 'gemini@lite');
    assert.deepEqual(result.data, [1, 2, 3]);
});

test('a failed service falls back in order and reports its safe reason', async () => {
    const { options, calls } = fixture();
    options.synthesize = async ({ serviceInstanceKey, config }) => {
        calls.push(serviceInstanceKey);
        if (serviceInstanceKey === 'gemini@lite') throw new Error(`Invalid key ${config.apiKey}`);
        return { data: [4], language: 'en' };
    };
    const result = await runTtsFallback(options);
    assert.deepEqual(calls, ['gemini@lite', 'gemini@flash']);
    assert.equal(result.serviceInstanceKey, 'gemini@flash');
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0].message, /\[REDACTED\]/);
    assert.doesNotMatch(result.failures[0].message, /secret-gemini/);
});

test('all failed services appear in a single error in order', async () => {
    const { options } = fixture({ synthesize: async ({ serviceInstanceKey }) => { throw new Error(`failed ${serviceInstanceKey}`); } });
    await assert.rejects(runTtsFallback(options), (error) => {
        assert.equal(error.failures.length, 3);
        assert.deepEqual(error.failures.map((failure) => failure.serviceInstanceKey), options.serviceInstanceList);
        assert.match(error.message, /gemini@lite/);
        assert.match(error.message, /azure@backup/);
        return true;
    });
});

test('empty text and list fail before any service is called', async () => {
    const { options, calls } = fixture();
    await assert.rejects(runTtsFallback({ ...options, text: ' ' }), /No text selected/);
    await assert.rejects(runTtsFallback({ ...options, serviceInstanceList: [] }), /No TTS service/);
    assert.deepEqual(calls, []);
});

test('language detection is shared by all candidate services', async () => {
    let detections = 0;
    const { options } = fixture({ language: { mode: 'detect', detect: async () => { detections += 1; return 'pl'; } } });
    options.synthesize = async ({ serviceInstanceKey, detectOnce }) => {
        assert.equal(await detectOnce(), 'pl');
        if (serviceInstanceKey === 'gemini@lite') throw new Error('Language not supported');
        return { data: [1], language: 'pl' };
    };
    const result = await runTtsFallback(options);
    assert.equal(detections, 1);
    assert.equal(result.language, 'pl');
});

test('plugin metadata is loaded for each instance rather than reused from the first', async () => {
    const loaded = [];
    const { options } = fixture({ serviceInstanceList: ['plugin.tts@one', 'plugin.tts@two'] });
    options.getMetadata = async (key) => {
        loaded.push(key);
        return { serviceName: 'plugin.tts', serviceLabel: `display-${key}` };
    };
    options.synthesize = async ({ serviceInstanceKey }) => {
        if (serviceInstanceKey.endsWith('one')) throw new Error('No audio');
        return { data: [1], language: 'auto' };
    };
    const result = await runTtsFallback(options);
    assert.deepEqual(loaded, ['plugin.tts@one', 'plugin.tts@two']);
    assert.equal(result.serviceLabel, 'display-plugin.tts@two');
    assert.equal(result.failures[0].serviceLabel, 'display-plugin.tts@one');
});

test('Pacific midnight calculation covers standard time, DST changes and midnight itself', () => {
    const samples = [
        ['2026-01-15T12:00:00Z', '2026-01-16T08:00:00Z'],
        ['2026-03-08T09:00:00Z', '2026-03-09T07:00:00Z'],
        ['2026-11-01T08:00:00Z', '2026-11-02T08:00:00Z'],
        ['2026-01-15T08:00:00Z', '2026-01-16T08:00:00Z'],
    ];
    for (const [now, expected] of samples) assert.equal(nextPacificMidnight(Date.parse(now)), Date.parse(expected), now);
});

test('daily and rate cooldowns expire; auth and other errors never cool down', () => {
    const { cooldowns, storage, setTime } = fixture();
    const start = Date.parse('2026-01-15T12:00:00Z');
    assert.equal(cooldowns.record('daily', { kind: 'quota_daily' }), Date.parse('2026-01-16T08:01:00Z'));
    assert.equal(cooldowns.record('rate', { kind: 'rate_limited', retryAfterMs: 19_000 }), start + 19_000);
    assert.equal(cooldowns.record('default', { kind: 'rate_limited' }), start + 60_000);
    assert.equal(cooldowns.record('auth', { kind: 'auth' }), undefined);
    assert.equal(cooldowns.record('other', { kind: 'other' }), undefined);
    assert.deepEqual(Object.keys(JSON.parse(storage.getItem(TTS_COOLDOWN_STORAGE_KEY))).sort(), ['daily', 'default', 'rate']);
    setTime(start + 60_000);
    assert.deepEqual(Object.keys(cooldowns.read()), ['daily']);
});

test('cooling services are skipped, all-cooling retries, and saving config clears one entry', async () => {
    const { options, calls, cooldowns, setTime } = fixture();
    cooldowns.record('gemini@lite', { kind: 'rate_limited', retryAfterMs: 19_000 });
    let result = await runTtsFallback(options);
    assert.deepEqual(calls, ['gemini@flash']);
    assert.deepEqual(result.failures, []);
    cooldowns.clear('gemini@lite');
    calls.length = 0;
    await runTtsFallback(options);
    assert.deepEqual(calls, ['gemini@lite']);
    cooldowns.record('gemini@lite', { kind: 'rate_limited', retryAfterMs: 19_000 });
    cooldowns.record('gemini@flash', { kind: 'rate_limited', retryAfterMs: 19_000 });
    cooldowns.record('azure@backup', { kind: 'rate_limited', retryAfterMs: 19_000 });
    calls.length = 0;
    await runTtsFallback(options);
    assert.deepEqual(calls, ['gemini@lite']);
    setTime(Date.parse('2026-01-15T12:00:20Z'));
    assert.deepEqual(cooldowns.read(), {});
    calls.length = 0;
    await runTtsFallback(options);
    assert.deepEqual(calls, ['gemini@lite']);
});

test('classified failures create cooldown and are omitted from subsequent notices', async () => {
    const { options, calls, cooldowns } = fixture();
    options.synthesize = async ({ serviceInstanceKey }) => {
        calls.push(serviceInstanceKey);
        if (serviceInstanceKey === 'gemini@lite') {
            const error = new Error('Daily quota exceeded');
            error.ttsFailure = { kind: 'quota_daily' };
            throw error;
        }
        return { data: [1], language: 'en' };
    };
    const first = await runTtsFallback(options);
    assert.equal(first.failures[0].kind, 'quota_daily');
    assert.equal(first.failures[0].cooldownUntil, cooldowns.read()['gemini@lite'].until);
    calls.length = 0;
    const second = await runTtsFallback(options);
    assert.deepEqual(calls, ['gemini@flash']);
    assert.deepEqual(second.failures, []);
});

test('all cooled and still failing services are reported in their original order', async () => {
    const { options, cooldowns } = fixture();
    for (const key of options.serviceInstanceList) cooldowns.record(key, { kind: 'rate_limited', retryAfterMs: 60_000 });
    options.synthesize = async () => { throw new Error('Network unavailable'); };
    await assert.rejects(runTtsFallback(options), (error) => {
        assert.deepEqual(error.failures.map((failure) => failure.serviceInstanceKey), options.serviceInstanceList);
        return true;
    });
});

test('storage failures fall back to memory, and error messages redact credentials', () => {
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    const cooldowns = createTtsCooldownStore({ storage: broken, now: () => 1000 });
    cooldowns.record('one', { kind: 'rate_limited', retryAfterMs: 10_000 });
    assert.equal(cooldowns.read().one.until, 11_000);
    assert.equal(sanitizeTtsFailureMessage(new Error('Bearer abc123 key=xyz987'), { apiKey: 'abc123' }),
        'Bearer [REDACTED] key=[REDACTED]');
});

test('separate window stores share cooldowns through localStorage', () => {
    const storage = memoryStorage();
    const now = () => 1000;
    const translate = createTtsCooldownStore({ storage, now });
    const readAloud = createTtsCooldownStore({ storage, now });
    translate.record('gemini@lite', { kind: 'rate_limited', retryAfterMs: 19_000 });
    assert.equal(readAloud.read()['gemini@lite'].until, 20_000);
    readAloud.clear('gemini@lite');
    assert.deepEqual(translate.read(), {});
});
