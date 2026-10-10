import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { serviceMeta, serviceAliases, getServiceMeta } from '../src/services/service_meta.js';
import { explainServiceError, redactServiceError } from '../src/utils/service_error.js';
import { createInstance } from 'i18next';
import { filterServiceItems, hasRequiredValue, requiredServiceFields } from '../src/utils/service_form.js';

const languages = ['zh_CN', 'zh_TW', 'en_US'];
const locales = languages.map((lang) => JSON.parse(fs.readFileSync(`src/i18n/locales/${lang}.json`, 'utf8')));
const lookup = (locale, key) => key.split('.').reduce((value, part) => value?.[part], locale.translation);

test('guidance resolves through the application translation namespace', async () => {
    const i18n = createInstance();
    await i18n.init({
        resources: Object.fromEntries(languages.map((language, index) => [language, locales[index]])),
        fallbackLng: 'en_US',
    });
    for (const language of languages) {
        await i18n.changeLanguage(language);
        for (const key of ['services.guide.about', 'services.meta.openai.summary', 'services.recommendations.title']) {
            assert.notEqual(i18n.t(key), key);
        }
    }
});

test('metadata keys match real service directories and translated keys resolve', () => {
    for (const [name, meta] of Object.entries(serviceMeta)) {
        assert.ok(
            ['translate', 'recognize', 'tts', 'collection'].some((type) =>
                fs.existsSync(`src/services/${type}/${name}/Config.jsx`)
            ),
            name
        );
        assert.match(meta.verifiedAt, /^2026-10-08$/);
        for (const entry of [meta, ...Object.values(meta.variants ?? {})]) {
            for (const key of [entry.summaryKey, entry.quotaKey, entry.applyLabelKey].filter(Boolean)) {
                for (const locale of locales) assert.equal(typeof lookup(locale, key), 'string', key);
            }
            for (const url of [entry.applyUrl, entry.docsUrl].filter(Boolean))
                assert.equal(new URL(url).protocol, 'https:');
        }
    }
});

test('export aliases retain the provider and category-specific OCR details', () => {
    for (const [alias, directory] of Object.entries(serviceAliases)) {
        if (directory === 'lingva') continue;
        assert.ok(serviceMeta[directory], alias);
        assert.equal(getServiceMeta(alias)?.provider, serviceMeta[directory].provider);
    }
    assert.equal(getServiceMeta('google_cloud_translate').provider, 'google_cloud');
    assert.equal(getServiceMeta('azure_tts').provider, 'azure');
    assert.match(getServiceMeta('baidu_ocr', 'recognize').applyUrl, /bce.baidu/);
    assert.deepEqual(getServiceMeta('tencent_ocr', 'recognize').tags, ['free_quota']);
    assert.equal(getServiceMeta('bing'), undefined);
});

test('all bundled provider guides keep three languages, official sources and GFM tables without verification dates', () => {
    for (const provider of ['google_cloud', 'gemini', 'azure']) {
        for (const lang of languages) {
            const content = fs.readFileSync(`src/services/guides/${provider}.${lang}.md`, 'utf8');
            assert.doesNotMatch(content, /核对日期|核對日期|Verified:|2026-10-08/);
            assert.match(content, /价格以官方页面为准|價格以官方頁面為準|Official prices take precedence/);
            assert.match(content, /\|\s*-+\s*\|/);
            assert.ok((content.match(/^## /gm) ?? []).length >= 6);
            assert.match(content, /https:\/\//);
            assert.doesNotMatch(content, /pot-app\.com|邀请码|referral/);
        }
    }
});

test('recommendation order, endpoints and translations are complete', () => {
    assert.deepEqual(
        serviceMeta.openai.recommendations.map((item) => item.id),
        ['openrouter', 'chatanywhere', 'tuzi']
    );
    for (const item of serviceMeta.openai.recommendations) {
        for (const locale of locales) assert.equal(typeof lookup(locale, item.reasonKey), 'string');
        for (const tag of item.tags) {
            for (const locale of locales)
                assert.equal(typeof lookup(locale, `services.recommendations.tags.${tag}`), 'string');
        }
        assert.match(item.verifiedAt, /^2026-10-09$/);
        for (const endpoint of item.endpoints) {
            const url = new URL(endpoint.url);
            assert.equal(url.protocol, 'https:');
            assert.ok(url.pathname.endsWith('/chat/completions'));
            assert.equal(url.search, '');
        }
    }
    assert.equal(serviceMeta.openai.recommendations[1].endpoints.length, 2);
    assert.deepEqual(
        serviceMeta.openai.recommendations.map((item) => item.tags),
        [
            ['reputable', 'free_models'],
            ['daily_quota', 'privacy'],
            ['very_cheap', 'privacy'],
        ]
    );
    assert.equal(serviceMeta.openai.recommendations[0].privacyWarning, undefined);
    assert.equal(serviceMeta.openai.recommendations[1].privacyWarning, true);
    assert.equal(serviceMeta.openai.recommendations[2].privacyWarning, true);
});

for (const [error, kind] of [
    ['HTTP 401 invalid key', 'unauthorized'],
    [{ status: 403, message: 'Permission denied' }, 'forbidden'],
    [{ response: { status: 404 }, message: 'missing model' }, 'not_found'],
    ['429 RESOURCE_EXHAUSTED', 'rate_limit'],
    ['insufficient_quota', 'balance'],
    ['余额不足', 'balance'],
    ['User location is not supported', 'region'],
    ['地区不支持', 'region'],
    ['ETIMEDOUT', 'timeout'],
    ['Failed to fetch', 'network'],
    ['API key is required', 'required'],
    ['unexpected response', 'other'],
    ['HTTP 401; check resource region', 'unauthorized'],
]) {
    test(`service error diagnosis: ${kind} (${JSON.stringify(error)})`, () => {
        const result = explainServiceError(error, 'google_cloud');
        assert.equal(result.kind, kind);
        for (const locale of locales) {
            assert.equal(typeof lookup(locale, result.messageKey), 'string');
            assert.equal(typeof lookup(locale, result.adviceKey), 'string');
        }
    });
}

test('service errors hide raw and URL-encoded credentials before truncation', () => {
    const secret = 'example/+fake-secret';
    const result = redactServiceError(
        `${secret} ${encodeURIComponent(secret)} Bearer bearer-secret; key=other-secret&next=1`,
        { credential: secret }
    );
    assert.doesNotMatch(result, /fake-secret|bearer-secret|other-secret/);
    assert.match(result, /REDACTED/);
    assert.ok(redactServiceError('x'.repeat(9000)).length <= 4000);
    assert.doesNotMatch(
        redactServiceError('appid-value client-secret', { app_id: 'appid-value', client_secret: 'client-secret' }),
        /appid-value|client-secret/
    );
});

test('all old upstream service documentation links are gone', () => {
    for (const category of ['translate', 'recognize', 'tts', 'collection']) {
        for (const name of fs.readdirSync(`src/services/${category}`)) {
            const file = `src/services/${category}/${name}/Config.jsx`;
            if (fs.existsSync(file)) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /pot-app\.com\/docs/);
        }
    }
});

test('tag and text filters combine and search translated summaries', () => {
    const items = [
        { key: 'google_cloud_translate', name: 'Google Cloud' },
        { key: 'ollama', name: 'Ollama' },
        { key: 'bing', name: 'Bing' },
    ];
    const translate = (key) => lookup(locales[0], key);
    assert.deepEqual(
        filterServiceItems(items, { tag: 'local', query: '本地', translate }).map((item) => item.key),
        ['ollama']
    );
    assert.deepEqual(
        filterServiceItems(items, { tag: 'free_quota', query: 'GOOGLE' }).map((item) => item.key),
        ['google_cloud_translate']
    );
    assert.deepEqual(filterServiceItems(items, { tag: 'local', query: 'bing' }), []);
    assert.equal(filterServiceItems(items, { query: '  ' }).length, 3);
});

test('required-value validation rejects whitespace and empty model lists without rejecting zero', () => {
    for (const value of [undefined, null, false, '', '  ', [], [' ', '']]) assert.equal(hasRequiredValue(value), false);
    for (const value of [0, 8765, ' key ', ['model'], [' ', 'model']]) assert.equal(hasRequiredValue(value), true);
});

test('required fields preserve Global Translator and service-specific credential rules', () => {
    assert.ok(!requiredServiceFields('azure_translate', 'translate').includes('region'));
    assert.ok(requiredServiceFields('azure_tts', 'tts').includes('region'));
    assert.ok(requiredServiceFields('google_cloud_tts', 'tts').includes('credential'));
    assert.ok(!requiredServiceFields('gemini_live_tts', 'tts').includes('promptZh'));
    assert.ok(!requiredServiceFields('gemini_free', 'translate').includes('systemPrompt'));
    assert.deepEqual(requiredServiceFields('baidu_img_ocr', 'recognize'), ['appid', 'secret']);
    assert.deepEqual(requiredServiceFields('bing', 'translate'), []);
});
