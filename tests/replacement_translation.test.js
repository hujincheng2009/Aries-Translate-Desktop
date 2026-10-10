import assert from 'node:assert/strict';
import test from 'node:test';

import {
    normalizeReplacementSourceText,
    resolveReplacementTargetLanguage,
    selectDefaultEnabledService,
} from '../src/utils/replacement_translation.js';

test('replacement translation uses the first enabled service instance', () => {
    const serviceList = ['openai@disabled', 'openai@primary', 'bing'];
    const configMap = {
        'openai@disabled': { enable: false },
        'openai@primary': { enable: true },
        bing: {},
    };

    assert.equal(selectDefaultEnabledService(serviceList, configMap), 'openai@primary');
});

test('replacement translation reports no default when every service is disabled', () => {
    assert.equal(
        selectDefaultEnabledService(['openai', 'bing'], { openai: { enable: false }, bing: { enable: false } }),
        null
    );
});

test('automatic source language uses the second language when source and target match', () => {
    assert.equal(resolveReplacementTargetLanguage('auto', 'zh_cn', 'zh_cn', 'en'), 'en');
    assert.equal(resolveReplacementTargetLanguage('auto', 'zh_cn', 'pl', 'en'), 'zh_cn');
    assert.equal(resolveReplacementTargetLanguage('en', 'zh_cn', 'zh_cn', 'en'), 'zh_cn');
});

test('replacement source preprocessing follows the existing delete-newline setting', () => {
    assert.equal(normalizeReplacementSourceText('  inter-\n national\ntext  ', true), 'international text');
    assert.equal(normalizeReplacementSourceText('  first\nsecond  ', false), 'first\nsecond');
});
