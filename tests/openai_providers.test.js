import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildOpenaiRequest,
    openaiProviders,
    selectOpenaiProvider,
} from '../src/services/translate/openai/providers.js';

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
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/^export \* .*;\r?\n?/gm, '')
    .replace('export async function translate', 'async function translate');
const makeTranslate = (fetch, browserFetch) =>
    new Function(
        'fetch',
        'Body',
        'Language',
        'defaultRequestArguments',
        'buildOpenaiRequest',
        'window',
        code + '\nreturn translate;'
    )(fetch, { json: (body) => body }, { en: 'English' }, '{}', buildOpenaiRequest, { fetch: browserFetch });
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
