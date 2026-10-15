import assert from 'node:assert/strict';
import test from 'node:test';

import {
    SELECTION_READ_ALOUD_MAX_CHARS,
    createSelectionAudioCache,
    selectionBubblePosition,
    selectionCacheKey,
    selectionSpeechText,
} from '../src/utils/selection_read_aloud.js';

test('selection text is trimmed and blank selections show no bubble', () => {
    assert.equal(selectionSpeechText('  doctor \n'), 'doctor');
    assert.equal(selectionSpeechText(' \n\t'), '');
    assert.equal(selectionSpeechText(null), '');
});

test('selections longer than the limit show no bubble', () => {
    assert.equal(
        selectionSpeechText('a'.repeat(SELECTION_READ_ALOUD_MAX_CHARS)).length,
        SELECTION_READ_ALOUD_MAX_CHARS
    );
    assert.equal(selectionSpeechText('a'.repeat(SELECTION_READ_ALOUD_MAX_CHARS + 1)), '');
    // Counted in characters, not UTF-16 units.
    assert.notEqual(selectionSpeechText('😀'.repeat(SELECTION_READ_ALOUD_MAX_CHARS)), '');
});

test('bubble sits right of and below the selection end and stays inside the window', () => {
    const viewport = { width: 360, height: 560 };
    assert.deepEqual(selectionBubblePosition({ top: 100, right: 120, bottom: 122 }, viewport), { left: 124, top: 126 });
    assert.equal(selectionBubblePosition({ top: 100, right: 350, bottom: 122 }, viewport).left, 360 - 8 - 32);
    // Near the bottom edge it moves above the selection.
    assert.equal(selectionBubblePosition({ top: 520, right: 120, bottom: 542 }, viewport).top, 520 - 4 - 32);
});

test('cache keys separate language and speech services', () => {
    const a = selectionCacheKey('apple', 'en', ['lingva_tts']);
    assert.equal(a, selectionCacheKey('apple', 'en', ['lingva_tts']));
    assert.notEqual(a, selectionCacheKey('apple', 'zh_cn', ['lingva_tts']));
    assert.notEqual(a, selectionCacheKey('apple', 'en', ['edge_tts']));
    assert.notEqual(a, selectionCacheKey('Apple', 'en', ['lingva_tts']));
});

test('cache keeps the most recently used entries', () => {
    const cache = createSelectionAudioCache(2);
    cache.set('a', 1);
    cache.set('b', 2);
    assert.equal(cache.get('a'), 1);
    cache.set('c', 3);
    assert.equal(cache.get('b'), undefined);
    assert.equal(cache.get('a'), 1);
    assert.equal(cache.get('c'), 3);
    assert.equal(cache.size, 2);
    cache.clear();
    assert.equal(cache.size, 0);
});
