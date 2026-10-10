import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Execute the production adapters with only the Tauri/network boundary replaced.
const source = readFileSync(new URL('../src/utils/lang_detect.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace('export default async function detect', 'async function detect');
function harness(engine, response, local = 'auto') {
    const calls = [];
    const detect = new Function('fetch', 'Body', 'invoke', 'store', 'uuidv4', `${source}\nreturn detect;`)(
        async () => {
            calls.push('remote');
            if (response instanceof Error) throw response;
            return response;
        },
        { form: (value) => value },
        async () => {
            calls.push('local');
            if (local instanceof Error) throw local;
            return local;
        },
        { get: async () => engine },
        () => 'test-id'
    );
    return { detect, calls };
}

for (const language of ['pl', 'nl', 'sv', 'he']) {
    test(`Google ${language} is preserved rather than reported as English`, async () => {
        const { detect, calls } = harness('google', { ok: true, data: [null, null, language] });
        assert.equal(await detect('Przykładowy tekst'), language);
        assert.deepEqual(calls, ['remote']);
    });
}
test('unknown remote code falls back to local detection', async () => {
    const { detect, calls } = harness('google', { ok: true, data: [null, null, 'xx'] }, 'pl');
    assert.equal(await detect('Przykładowy tekst'), 'pl');
    assert.deepEqual(calls, ['remote', 'local']);
});
for (const response of [{ ok: false }, { ok: true, data: null }, new Error('offline')]) {
    test(`failed response falls back locally: ${JSON.stringify(response)}`, async () => {
        assert.equal(await harness('google', response, 'pl').detect('Przykładowy tekst'), 'pl');
    });
}
test('undetermined text stays automatic rather than English', async () => {
    assert.equal(await harness('google', { ok: false }).detect('unclassified text'), 'auto');
});
test('empty or punctuation-only input does not call an engine', async () => {
    const { detect, calls } = harness('google', { ok: false });
    assert.equal(await detect(' 123 !!! '), 'auto');
    assert.deepEqual(calls, []);
});

for (const [engine, data] of [
    ['baidu', { lan: 'pol' }],
    ['tencent', { translate: { source: 'pl' } }],
    ['niutrans', { language: 'pl' }],
    ['yandex', { lang: 'pl' }],
    ['bing', [{ language: 'pl' }]],
]) {
    test(`${engine} preserves Polish language codes`, async () => {
        assert.equal(await harness(engine, { ok: true, data }).detect('Dzień dobry'), 'pl');
    });
}
test('local mode does not call remote services', async () => {
    const { detect, calls } = harness('local', null, 'pl');
    assert.equal(await detect('Dzień dobry'), 'pl');
    assert.deepEqual(calls, ['local']);
});
test('failure of both engines still allows automatic translation', async () => {
    assert.equal(await harness('google', new Error('offline'), new Error('unavailable')).detect('Dzień dobry'), 'auto');
});
test('existing supported languages and traditional Chinese keep their identities', async () => {
    assert.equal(await harness('google', { ok: true, data: [null, null, 'en'] }).detect('Hello world'), 'en');
    assert.equal(await harness('niutrans', { ok: true, data: { language: 'cht' } }).detect('繁體中文'), 'zh_tw');
});
