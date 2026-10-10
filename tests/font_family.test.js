import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFontFamily, DEFAULT_SANS_FONT_STACK } from '../src/utils/font_family.js';

test('default font uses an explicit multilingual sans-serif stack', () => {
    assert.equal(
        buildFontFamily('default', 'default'),
        '"Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", "Noto Sans SC", Arial, sans-serif'
    );
    assert.equal(DEFAULT_SANS_FONT_STACK.at(-1), 'sans-serif');
});

test('custom fonts remain first and generic sans-serif is never quoted', () => {
    const family = buildFontFamily('Noto Sans SC', 'Segoe UI');
    assert.equal(family, '"Noto Sans SC", "Segoe UI", sans-serif');
    assert.doesNotMatch(family, /"sans-serif"/);
});

test('duplicate and blank custom font names are removed', () => {
    assert.equal(buildFontFamily('Segoe UI', 'Segoe UI'), '"Segoe UI", sans-serif');
    assert.equal(buildFontFamily('', 'default'), buildFontFamily('default', 'default'));
});
