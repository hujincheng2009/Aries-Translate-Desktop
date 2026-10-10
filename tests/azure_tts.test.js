import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildAzureSsml,
    getAzureSpeechUrl,
    getAzureVoicesUrl,
    normalizeAzureConfig,
    resolveAzureSettingsLocale,
    resolveAzureVoice,
    supportsAzureLocale,
} from '../src/services/tts/azure/core.js';

test('Azure Speech URLs stay on the selected Microsoft endpoints and never contain the key', () => {
    const regional = normalizeAzureConfig({ key: 'test-key', region: ' WestEurope ' });
    assert.equal(regional.region, 'westeurope');
    assert.equal(getAzureSpeechUrl(regional), 'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
    assert.equal(getAzureVoicesUrl(regional), 'https://westeurope.tts.speech.microsoft.com/cognitiveservices/voices/list');
    assert.equal(getAzureSpeechUrl(regional).includes(regional.key), false);

    const resource = normalizeAzureConfig({
        key: 'test-key',
        region: 'westeurope',
        endpoint: 'https://my-speech.cognitiveservices.azure.com/',
    });
    assert.equal(getAzureSpeechUrl(resource), 'https://my-speech.cognitiveservices.azure.com/cognitiveservices/v1');
    assert.equal(getAzureVoicesUrl(resource), 'https://my-speech.cognitiveservices.azure.com/tts/cognitiveservices/voices/list');
});

test('Azure configuration rejects missing credentials and endpoints outside Azure Speech', () => {
    assert.throws(() => normalizeAzureConfig({ region: 'westeurope' }), /key is required/);
    assert.throws(() => normalizeAzureConfig({ key: 'test-key' }), /region is required/);
    assert.throws(() => normalizeAzureConfig({ key: 'test-key', region: 'west.europe' }), /valid Azure Speech region/);

    for (const endpoint of [
        'http://my-speech.cognitiveservices.azure.com',
        'https://cognitiveservices.azure.com.evil.example',
        'https://my-speech.cognitiveservices.azure.com/other-path',
        'https://my-speech.cognitiveservices.azure.com?redirect=other',
        'https://my-speech.cognitiveservices.azure.com:444',
    ]) {
        assert.throws(
            () => normalizeAzureConfig({ key: 'test-key', region: 'westeurope', endpoint }),
            /HTTPS Azure Cognitive Services endpoint/
        );
    }
});

test('Azure SSML escapes text and voice attributes without altering Unicode', () => {
    assert.equal(
        buildAzureSsml('你好 & <Pot> "test"', 'zh-CN', 'zh-CN-"Voice"'),
        '<speak version="1.0" xml:lang="zh-CN"><voice name="zh-CN-&quot;Voice&quot;" xml:lang="zh-CN">你好 &amp; &lt;Pot&gt; "test"</voice></speak>'
    );
});

test('Azure voice selection prefers an exact locale and honors supported overrides', () => {
    const voices = [
        {
            ShortName: 'en-US-AvaMultilingualNeural',
            Locale: 'en-US',
            SecondaryLocaleList: ['pl-PL'],
            VoiceType: 'Neural',
            Status: 'GA',
            Gender: 'Female',
        },
        {
            ShortName: 'pl-PL-ZofiaNeural',
            Locale: 'pl-PL',
            VoiceType: 'Neural',
            Status: 'GA',
            Gender: 'Female',
        },
    ];

    assert.equal(supportsAzureLocale(voices[0], 'pl-PL'), true);
    assert.equal(resolveAzureVoice(voices, 'pl-PL').ShortName, 'pl-PL-ZofiaNeural');
    assert.equal(
        resolveAzureVoice(voices, 'pl-PL', { voiceOverrides: { 'pl-PL': 'en-US-AvaMultilingualNeural' } }).ShortName,
        'en-US-AvaMultilingualNeural'
    );
    assert.throws(
        () => resolveAzureVoice(voices, 'pl-PL', { voiceOverrides: { 'pl-PL': 'en-US-UnknownNeural' } }),
        /unavailable for pl-PL/
    );
    assert.throws(() => resolveAzureVoice(voices, 'zh-CN'), /no voice for zh-CN/);
});

test('Azure settings reopen on the saved locale, then on a locale that has a voice override', () => {
    const locales = ['zh-CN', 'en-US', 'pl-PL'];

    assert.equal(resolveAzureSettingsLocale(null, locales, 'en-US'), 'en-US');
    assert.equal(resolveAzureSettingsLocale({}, locales, 'en-US'), 'en-US');
    assert.equal(
        resolveAzureSettingsLocale({ voiceOverrides: { 'pl-PL': 'pl-PL-ZofiaNeural' } }, locales, 'en-US'),
        'pl-PL'
    );
    assert.equal(
        resolveAzureSettingsLocale(
            { settingsLocale: 'en-US', voiceOverrides: { 'zh-CN': 'zh-CN-XiaoyuMultilingualNeural' } },
            locales,
            'en-US'
        ),
        'en-US'
    );
    assert.equal(resolveAzureSettingsLocale({ settingsLocale: 'xx-XX' }, locales, 'en-US'), 'en-US');
});
