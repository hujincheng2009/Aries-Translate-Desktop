import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as providerModule from '../src/services/translate/openai/providers.js';
import { explainServiceError } from '../src/utils/service_error.js';

const {
    buildOpenaiRequest,
    buildReasoningArguments,
    describeOpenaiError,
    openaiProviders,
    parseRequestArguments,
    removeRequestArgument,
    selectOpenaiProvider,
} = providerModule;

const original = {
    service: 'openai',
    requestPath: openaiProviders.openai.requestPath,
    model: 'sample/model',
    apiKey: 'fixture-key',
    stream: false,
};
const providers = Object.keys(openaiProviders);
const compatible = providers.filter((name) => name !== 'azure');
for (const name of compatible) {
    test(`${name}: switches empty and known default URLs, preserves the rest of the instance`, () => {
        for (const address of [
            '',
            '   ',
            undefined,
            ...Object.values(openaiProviders).flatMap((p) => [p.requestPath, p.overseasRequestPath].filter(Boolean)),
        ]) {
            const config = { ...original, requestPath: address };
            const result = selectOpenaiProvider(config, name);
            assert.equal(result.config.requestPath, openaiProviders[name].requestPath);
            assert.equal(result.config.service, name);
            assert.equal(result.config.apiKey, original.apiKey);
            assert.equal(result.config.model, original.model);
            assert.equal(result.preserved, false);
            assert.equal(config.requestPath, address);
        }
    });
    test(`${name}: custom URL and query parameters survive provider selection`, () => {
        const config = { ...original, requestPath: 'https://example.test/my/endpoint?version=custom' };
        const result = selectOpenaiProvider(config, name);
        assert.equal(result.config.requestPath, config.requestPath);
        assert.equal(result.preserved, true);
        assert.equal(config.service, 'openai');
    });
}
test('Azure selection retains both deployment and previous default URLs', () => {
    for (const requestPath of [
        '',
        original.requestPath,
        'https://example.test/openai/deployments/test/chat/completions?api-version=2024-02-01',
    ]) {
        const result = selectOpenaiProvider({ ...original, requestPath }, 'azure');
        assert.equal(result.config.requestPath, requestPath);
        assert.equal(result.preserved, false);
    }
});
test('compatible root URLs gain the completion path without duplicating v1', () => {
    for (const base of [
        'https://example.test',
        'example.test',
        'https://example.test/',
        'https://example.test/v1',
        'https://example.test/v1/',
    ]) {
        const request = buildOpenaiRequest({ ...original, requestPath: base }, [], {});
        assert.equal(request.url, 'https://example.test/v1/chat/completions');
    }
});
test('legacy OpenAI instances using relay addresses keep their URL and service', () => {
    const config = { ...original, requestPath: openaiProviders.chatanywhere.overseasRequestPath };
    const request = buildOpenaiRequest(config, [], {});
    assert.equal(config.service, 'openai');
    assert.equal(request.url, config.requestPath);
    assert.equal(request.headers.Authorization, 'Bearer fixture-key');
});

// Exercise the real translate function, with transport imports replaced by deterministic fixtures.
const code = fs
    .readFileSync('src/services/translate/openai/index.jsx', 'utf8')
    .replace(/^import [\s\S]*?;\r?\n/gm, '')
    .replace(/^export \* .*;\r?\n?/gm, '')
    .replace('export async function translate', 'async function translate');
const providerNames = [
    'buildOpenaiRequest',
    'buildReasoningArguments',
    'describeOpenaiError',
    'formatOpenaiError',
    'parseRequestArguments',
    'requestError',
];
const makeTranslate = (fetch, browserFetch, defaultRequestArguments = '{}') =>
    new Function(
        'fetch',
        'Body',
        'Language',
        'defaultRequestArguments',
        ...providerNames,
        'window',
        code + '\nreturn translate;'
    )(
        fetch,
        { json: (body) => body },
        { en: 'English' },
        defaultRequestArguments,
        ...providerNames.map((name) => providerModule[name]),
        { fetch: browserFetch }
    );
for (const service of [...providers, 'legacy-custom']) {
    for (const stream of [false, true]) {
        test(`real translation ${service}, stream=${stream}: URL, authentication, model and result`, async () => {
            let captured;
            const url =
                service === 'azure'
                    ? 'https://example.test/openai/deployments/sample/chat/completions?api-version=2024-02-01'
                    : openaiProviders[service]?.requestPath ?? 'https://example.test/v1/chat/completions';
            const transport = async (address, options) => {
                captured = { address, options };
                if (!stream) return { ok: true, data: { choices: [{ message: { content: ' translated text ' } }] } };
                let sent = false;
                return {
                    ok: true,
                    body: {
                        getReader: () => ({
                            read: async () =>
                                sent
                                    ? { done: true }
                                    : ((sent = true),
                                      {
                                          done: false,
                                          value: new TextEncoder().encode(
                                              'data: {"choices":[{"delta":{"content":"translated text"}}]}\n\ndata: [DONE]\n\n'
                                          ),
                                      }),
                            cancel: async () => {},
                            releaseLock: () => {},
                        }),
                    },
                };
            };
            const translate = makeTranslate(transport, transport);
            const updates = [];
            const result = await translate('hello', 'English', 'Chinese', {
                config: {
                    ...original,
                    service,
                    stream,
                    requestPath: url,
                    promptList: [{ role: 'user', content: '$text $from $to' }],
                    requestArguments: '{"temperature":0.2}',
                },
                detect: 'en',
                setResult: (v) => updates.push(v),
            });
            assert.equal(result, 'translated text');
            assert.equal(captured.address, url);
            assert.equal(
                captured.options.headers[service === 'azure' ? 'api-key' : 'Authorization'],
                service === 'azure' ? 'fixture-key' : 'Bearer fixture-key'
            );
            assert.equal(captured.options.headers[service === 'azure' ? 'Authorization' : 'api-key'], undefined);
            const body = stream ? JSON.parse(captured.options.body) : captured.options.body;
            assert.equal(body.model, service === 'azure' ? undefined : 'sample/model');
            assert.equal(body.temperature, 0.2);
            assert.equal(body.stream, stream);
            assert.equal(body.messages[0].content, 'hello English Chinese');
            if (stream) assert.equal(updates.at(-1), 'translated text');
        });
    }
}
test('provider names, feedback and key links have translations in all three languages', () => {
    for (const lang of ['zh_CN', 'zh_TW', 'en_US']) {
        const locale = JSON.parse(fs.readFileSync(`src/i18n/locales/${lang}.json`, 'utf8')).translation;
        const values = locale.services.translate.openai;
        for (const service of providers) {
            assert.equal(typeof values[service], 'string');
            assert.equal(typeof values.provider_hint[service], 'string');
        }
        for (const key of ['get_key', 'address_preserved', 'use_default_address'])
            assert.equal(typeof values[key], 'string');
        assert.ok(locale.services.recommendations.title);
        assert.doesNotMatch(locale.services.recommendations.title, /\{\{count\}\}/);
        assert.ok(locale.services.recommendations.hint);
        assert.ok(locale.services.recommendations.current);
        assert.equal(locale.services.guide.verified, undefined);
        assert.equal(locale.services.recommendations.tags.china, undefined);
        assert.equal(locale.services.recommendations.tags.pricing, undefined);
    }
});

// Reasoning effort, request-argument parsing and located 400 errors.
const legacyDefault = '{"temperature":0.1,"top_p":0.99,"frequency_penalty":0,"presence_penalty":0}';
const prompt = [{ role: 'user', content: '$text' }];
test('default request arguments are unchanged and reasoning defaults to sending nothing', () => {
    const config = fs.readFileSync('src/services/translate/openai/Config.jsx', 'utf8');
    for (const key of ['temperature: 0.1', 'top_p: 0.99', 'frequency_penalty: 0', 'presence_penalty: 0'])
        assert.ok(config.includes(key), key);
    assert.match(config, /reasoning: 'default'/);
    for (const service of providers) {
        assert.deepEqual(buildReasoningArguments(service, 'default'), {});
        assert.deepEqual(buildReasoningArguments(service, undefined), {});
        assert.deepEqual(buildReasoningArguments(service, 'bogus'), {});
    }
    const withoutReasoning = buildOpenaiRequest(original, [], JSON.parse(legacyDefault));
    const withDefault = buildOpenaiRequest(
        original,
        [],
        JSON.parse(legacyDefault),
        buildReasoningArguments('openai', 'default')
    );
    assert.deepEqual(withDefault.body, withoutReasoning.body);
});
test('reasoning effort uses each provider spelling, and Request Arguments win on the same key', () => {
    for (const level of ['none', 'low', 'medium', 'high']) {
        for (const service of ['openai', 'azure', 'chatanywhere', 'tuzi', 'legacy-custom'])
            assert.deepEqual(buildReasoningArguments(service, level), { reasoning_effort: level });
        assert.deepEqual(buildReasoningArguments('openrouter', level), { reasoning: { effort: level } });
    }
    const request = buildOpenaiRequest(original, [], { reasoning_effort: 'high' }, { reasoning_effort: 'low' });
    assert.equal(request.body.reasoning_effort, 'high');
});
test('request arguments: blank means none, invalid JSON is located at the field', () => {
    assert.deepEqual(parseRequestArguments(''), {});
    assert.deepEqual(parseRequestArguments('  '), {});
    assert.deepEqual(parseRequestArguments(legacyDefault), JSON.parse(legacyDefault));
    for (const text of ['{temperature: 1}', '[1]', '"x"']) {
        assert.throws(
            () => parseRequestArguments(text),
            (error) => error.code === 'invalid_json' && error.fieldKey === 'requestArguments'
        );
    }
    assert.equal(
        removeRequestArgument(JSON.parse(legacyDefault), 'temperature'),
        '{"top_p":0.99,"frequency_penalty":0,"presence_penalty":0}'
    );
});
test('400 errors locate the rejected parameter and its source', () => {
    const userArguments = JSON.parse(legacyDefault);
    const reasoningArguments = { reasoning_effort: 'none' };
    const context = { userArguments, reasoningArguments };
    const byParam = describeOpenaiError(
        400,
        JSON.stringify({ error: { message: 'Unsupported value', param: 'temperature' } }),
        context
    );
    assert.deepEqual(
        [byParam.param, byParam.fieldKey, byParam.message],
        ['temperature', 'requestArguments', 'Unsupported value']
    );
    const byText = describeOpenaiError(
        400,
        JSON.stringify({
            type: 'error',
            error: { type: 'invalid_request_error', message: '`top_p` and `temperature` cannot both be specified' },
        }),
        context
    );
    assert.equal(byText.fieldKey, 'requestArguments');
    assert.ok(['temperature', 'top_p'].includes(byText.param));
    const reasoning = describeOpenaiError(
        400,
        JSON.stringify({ error: { message: "Unsupported value: 'none' for reasoning_effort" } }),
        context
    );
    assert.deepEqual([reasoning.param, reasoning.fieldKey], ['reasoning_effort', 'reasoning']);
    const effort = describeOpenaiError(400, JSON.stringify({ error: { message: 'effort level not supported' } }), {
        userArguments: {},
        reasoningArguments,
    });
    assert.deepEqual([effort.param, effort.fieldKey], ['reasoning_effort', 'reasoning']);
    // A key written in Request Arguments is attributed there even when reasoning sent the same key.
    const both = describeOpenaiError(400, JSON.stringify({ error: { param: 'reasoning_effort', message: 'bad' } }), {
        userArguments: { reasoning_effort: 'x' },
        reasoningArguments,
    });
    assert.equal(both.fieldKey, 'requestArguments');
    // Keys that were not sent are never matched from the message text.
    const unknown = describeOpenaiError(
        400,
        JSON.stringify({ error: { message: 'max_tokens is too large' } }),
        context
    );
    assert.deepEqual([unknown.param, unknown.fieldKey], [null, null]);
    assert.equal(describeOpenaiError(400, 'plain text with temperature', context).param, 'temperature');
    assert.equal(describeOpenaiError(401, JSON.stringify({ error: { param: 'temperature' } }), context).fieldKey, null);
});
for (const stream of [false, true]) {
    test(`stream=${stream}: a 400 keeps the response body and the located parameter`, async () => {
        const body = JSON.stringify({
            error: { message: 'Unsupported parameter: frequency_penalty', param: 'frequency_penalty' },
        });
        const transport = async () =>
            stream
                ? { ok: false, status: 400, text: async () => body }
                : { ok: false, status: 400, data: JSON.parse(body) };
        const translate = makeTranslate(transport, transport);
        await assert.rejects(
            translate('hello', 'English', 'Chinese', {
                config: { ...original, stream, promptList: prompt, requestArguments: legacyDefault },
                detect: 'en',
                setResult: () => {},
            }),
            (error) => {
                assert.equal(error.status, 400);
                assert.equal(error.param, 'frequency_penalty');
                assert.equal(error.fieldKey, 'requestArguments');
                assert.match(
                    String(error),
                    /^HTTP 400: Unsupported parameter: frequency_penalty \(parameter: frequency_penalty\)/
                );
                assert.match(String(error), /Http Status: 400/);
                assert.ok(String(error).includes(body));
                assert.doesNotMatch(String(error), /undefined/);
                return true;
            }
        );
    });
}
test('invalid Request Arguments fail before any request is sent', async () => {
    let sent = false;
    const transport = async () => ((sent = true), { ok: true, data: {} });
    await assert.rejects(
        makeTranslate(transport, transport)('hello', 'English', 'Chinese', {
            config: { ...original, promptList: prompt, requestArguments: '{oops' },
            detect: 'en',
        }),
        (error) => error.code === 'invalid_json'
    );
    assert.equal(sent, false);
});
test('reasoning setting reaches the request body only when chosen', async () => {
    const bodies = [];
    const transport = async (_url, options) => (
        bodies.push(options.body), { ok: true, data: { choices: [{ message: { content: 'ok' } }] } }
    );
    const translate = makeTranslate(transport, transport);
    for (const [service, reasoning] of [
        ['openai', 'default'],
        ['openai', 'low'],
        ['openrouter', 'none'],
    ]) {
        await translate('hello', 'English', 'Chinese', {
            config: { ...original, service, reasoning, promptList: prompt, requestArguments: '{}' },
            detect: 'en',
        });
    }
    assert.equal('reasoning_effort' in bodies[0] || 'reasoning' in bodies[0], false);
    assert.equal(bodies[1].reasoning_effort, 'low');
    assert.deepEqual(bodies[2].reasoning, { effort: 'none' });
});
test('located errors classify as bad_request with field and advice in all three languages', () => {
    const locales = ['zh_CN', 'zh_TW', 'en_US'].map(
        (lang) => JSON.parse(fs.readFileSync(`src/i18n/locales/${lang}.json`, 'utf8')).translation
    );
    const lookup = (locale, key) => key.split('.').reduce((value, part) => value?.[part], locale);
    const cases = [
        [
            { status: 400, message: 'x', param: 'temperature', fieldKey: 'requestArguments' },
            'requestArguments',
            'bad_request_arguments_advice',
        ],
        [
            { status: 400, message: 'x', param: 'reasoning_effort', fieldKey: 'reasoning' },
            'reasoning',
            'bad_request_reasoning_advice',
        ],
        // "invalid ... max_tokens" must not be read as an authentication failure.
        [
            { status: 400, message: 'invalid_request_error: max_tokens too large', param: null, fieldKey: null },
            null,
            'bad_request_advice',
        ],
        [
            { code: 'invalid_json', message: 'bad', fieldKey: 'requestArguments', detail: 'Unexpected token' },
            'requestArguments',
            'invalid_json_advice',
        ],
    ];
    for (const [error, fieldKey, advice] of cases) {
        const result = explainServiceError(error, 'openai');
        assert.equal(result.kind, 'bad_request');
        assert.equal(result.fieldKey, fieldKey);
        assert.equal(result.adviceKey, `services.errors.${advice}`);
        for (const locale of locales) {
            assert.equal(typeof lookup(locale, result.messageKey), 'string');
            assert.equal(typeof lookup(locale, result.adviceKey), 'string');
        }
    }
    assert.equal(explainServiceError('invalid_request_error: unsupported parameter', 'openai').kind, 'bad_request');
    // Other services keep their text rules: Google reports a bad key as HTTP 400.
    assert.equal(
        explainServiceError({ status: 400, message: 'HTTP 401 invalid key' }, 'google_cloud').kind,
        'unauthorized'
    );
    assert.equal(explainServiceError({ status: 402, message: 'x', fieldKey: null }, 'openai').kind, 'balance');
    assert.equal(explainServiceError('limit 4000 characters', 'openai').kind, 'other');
    for (const locale of locales) {
        const values = locale.services.translate.openai;
        for (const key of [
            'reasoning',
            'reasoning_default',
            'reasoning_none',
            'reasoning_low',
            'reasoning_medium',
            'reasoning_high',
            'reasoning_hint',
            'reasoning_overridden',
            'reasoning_rejected',
            'use_model_default',
            'request_arguments',
            'request_arguments_hint',
            'request_arguments_invalid',
            'param_rejected',
            'default_params_note',
            'preview_after_fix',
            'apply_suggestion',
        ])
            assert.equal(typeof values[key], 'string', key);
        assert.match(values.param_rejected, /\{\{param\}\}/);
        assert.match(values.request_arguments_invalid, /\{\{error\}\}/);
    }
});
