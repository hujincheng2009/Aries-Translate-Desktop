import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createTranslationFingerprint,
    isCurrentTranslationRequest,
    isOnDemandService,
    shouldInvokeOnExpand,
    shouldPrepareTranslationContext,
} from '../src/utils/on_demand_translation.js';

test('the full service instance participates in the translation fingerprint', () => {
    const first = createTranslationFingerprint(' hello ', 'auto', 'zh_cn', 'openai@first');
    const second = createTranslationFingerprint('hello', 'auto', 'zh_cn', 'openai@second');

    assert.notEqual(first, second);
    assert.equal(first, createTranslationFingerprint('hello', 'auto', 'zh_cn', 'openai@first'));
});

test('services remain automatic unless explicitly configured as on demand', () => {
    assert.equal(isOnDemandService(undefined, 'openai@first'), false);
    assert.equal(isOnDemandService([], 'openai@first'), false);
    assert.equal(isOnDemandService(['openai@first'], 'openai@first'), true);
});

test('expanding an on-demand card invokes once per fingerprint', () => {
    const fingerprint = createTranslationFingerprint('hello', 'auto', 'zh_cn', 'openai@first');

    assert.equal(shouldInvokeOnExpand(true, fingerprint, null), true);
    assert.equal(shouldInvokeOnExpand(true, fingerprint, fingerprint), false);
    assert.equal(shouldInvokeOnExpand(false, fingerprint, null), false);
});

test('unrelated config updates do not evict an on-demand result for the same fingerprint', () => {
    const fingerprint = createTranslationFingerprint('hello', 'auto', 'zh_cn', 'openai@first');

    assert.equal(shouldPrepareTranslationContext(true, fingerprint, fingerprint), false);
    assert.equal(shouldPrepareTranslationContext(true, 'new-context', fingerprint), true);
    assert.equal(shouldPrepareTranslationContext(false, fingerprint, fingerprint), true);
});

test('late results are rejected after either context or request generation changes', () => {
    assert.equal(isCurrentTranslationRequest('context', 'context', 3, 3), true);
    assert.equal(isCurrentTranslationRequest('new-context', 'context', 3, 3), false);
    assert.equal(isCurrentTranslationRequest('context', 'context', 4, 3), false);
});
