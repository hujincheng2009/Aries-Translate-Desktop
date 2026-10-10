import assert from 'node:assert/strict';
import test from 'node:test';

import {
    resolveBuiltinTtsLanguage,
    resolveDetectedBuiltinTtsLanguage,
    resolveDetectedPluginTtsLanguage,
    resolvePluginTtsLanguage,
} from '../src/utils/tts_language.js';

test('an automatic-language TTS plugin sends Polish text without running Pot language detection', async () => {
    let detectionCalls = 0;
    const pluginInfo = { language: { auto: 'auto' } };

    const resolved = await resolveDetectedPluginTtsLanguage(pluginInfo, 'Zażółć gęślą jaźń', async () => {
        detectionCalls += 1;
        return 'en';
    });

    assert.equal(detectionCalls, 0);
    assert.deepEqual(resolved, {
        language: 'auto',
        requestLanguage: 'auto',
    });
});

test('an automatic-language TTS plugin overrides Pot source and target language labels', () => {
    const pluginInfo = { language: { auto: 'auto' } };

    assert.equal(resolvePluginTtsLanguage(pluginInfo, 'en'), 'auto');
    assert.equal(resolvePluginTtsLanguage(pluginInfo, 'zh_cn'), 'auto');
    assert.equal(resolvePluginTtsLanguage(pluginInfo, 'pl'), 'auto');
});

test('language-specific TTS plugins keep the existing validation behavior', async () => {
    let detectionCalls = 0;
    const pluginInfo = { language: { en: 'en', zh_cn: 'zh' } };

    const resolved = await resolveDetectedPluginTtsLanguage(pluginInfo, 'Hello', async () => {
        detectionCalls += 1;
        return 'en';
    });

    assert.equal(detectionCalls, 1);
    assert.deepEqual(resolved, {
        language: 'en',
        requestLanguage: 'en',
    });
});

test('built-in automatic-language TTS skips Pot language detection', async () => {
    let detectionCalls = 0;
    const service = { info: { languageMode: 'auto' }, Language: { auto: 'auto' } };

    const resolved = await resolveDetectedBuiltinTtsLanguage(service, 'Zażółć gęślą jaźń', async () => {
        detectionCalls += 1;
        return 'en';
    });

    assert.equal(detectionCalls, 0);
    assert.deepEqual(resolved, { language: 'auto', requestLanguage: 'auto' });
});

test('built-in language-specific TTS uses detection and reports unsupported languages', async () => {
    let detectionCalls = 0;
    const service = { info: {}, Language: { en: 'en-US', zh_cn: 'cmn-CN' } };
    const resolved = await resolveDetectedBuiltinTtsLanguage(service, 'Hello', async () => {
        detectionCalls += 1;
        return 'en';
    });

    assert.equal(detectionCalls, 1);
    assert.deepEqual(resolved, { language: 'en', requestLanguage: 'en-US' });
    assert.equal(resolveBuiltinTtsLanguage(service, 'zh_cn'), 'cmn-CN');
    await assert.rejects(
        resolveDetectedBuiltinTtsLanguage(service, 'Hallo', async () => 'de'),
        /Language not supported/
    );
});

test('an Azure-style auto language key does not enable built-in automatic mode', async () => {
    let detectionCalls = 0;
    const azureLikeService = { info: {}, Language: { auto: 'auto', en: 'en-US', pl: 'pl-PL' } };
    const resolved = await resolveDetectedBuiltinTtsLanguage(azureLikeService, 'Zażółć', async () => {
        detectionCalls += 1;
        return 'pl';
    });

    assert.equal(detectionCalls, 1);
    assert.deepEqual(resolved, { language: 'pl', requestLanguage: 'pl-PL' });
    assert.throws(() => resolveBuiltinTtsLanguage(azureLikeService, 'auto'), /Language not supported/);
});
