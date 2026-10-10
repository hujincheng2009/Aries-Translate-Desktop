import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOcrSourceLanguage } from '../src/utils/ocr_language.js';

test('explicit OCR language is used only when enabled and source is automatic', () => {
    const hint = { text: 'Dzień dobry', language: 'pl' };
    assert.equal(resolveOcrSourceLanguage('auto', hint.text, hint, true), 'pl');
    assert.equal(resolveOcrSourceLanguage('auto', hint.text, hint, false), 'auto');
    assert.equal(resolveOcrSourceLanguage('de', hint.text, hint, true), 'de');
});
test('OCR hint cannot leak into edited or unrelated text or guess an automatic OCR language', () => {
    assert.equal(resolveOcrSourceLanguage('auto', 'Hello', { text: 'Dzień dobry', language: 'pl' }, true), 'auto');
    assert.equal(resolveOcrSourceLanguage('auto', 'Hello', { text: 'Hello', language: 'auto' }, true), 'auto');
    assert.equal(resolveOcrSourceLanguage('auto', 'Hello', null, true), 'auto');
});
