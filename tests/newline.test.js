import assert from 'node:assert/strict';
import test from 'node:test';

import { deleteAllNewlines, deleteNewlinesOnClick, deleteWrappedNewlines } from '../src/utils/newline.js';

test('wrapped lines are joined, sentence ends keep their break', () => {
    const pdf = [
        'Machine translation has improved a lot in recent',
        'years, but long documents are still hard.',
        'Each paragraph should stay a paragraph so the',
        'result is easy to read.',
    ].join('\n');
    assert.equal(
        deleteWrappedNewlines(pdf),
        'Machine translation has improved a lot in recent years, but long documents are still hard.\n' +
            'Each paragraph should stay a paragraph so the result is easy to read.'
    );
});

test('Chinese lines are joined without a space and keep breaks after 。', () => {
    assert.equal(
        deleteWrappedNewlines('今天的天气很好，我们一起\n去公园散步吧。\n明天再说。'),
        '今天的天气很好，我们一起去公园散步吧。\n明天再说。'
    );
});

test('a word broken with a hyphen at a line end is joined, keeping the hyphen', () => {
    // Keeping it is safer: "well-\nknown" must stay "well-known".
    assert.equal(deleteWrappedNewlines('a well-\nknown standard'), 'a well-known standard');
});

test('lists, headings and blank lines keep their breaks', () => {
    assert.equal(deleteWrappedNewlines('Steps\n\n1. Open the file\n2. Save it'), 'Steps\n1. Open the file\n2. Save it');
    assert.equal(deleteWrappedNewlines('# Title\nBody text'), '# Title\nBody text');
});

test('extra spaces and Windows line breaks are cleaned', () => {
    assert.equal(deleteWrappedNewlines('  one   two\r\nthree  '), 'one two three');
});

test('delete all joins everything, keeping a dash between spaced words', () => {
    assert.equal(deleteAllNewlines('First.\nSecond -\nthird inter-\nnational'), 'First. Second - third inter-national');
    assert.equal(deleteAllNewlines(undefined), '');
});

test('the toolbar button joins everything on a second click', () => {
    const once = deleteNewlinesOnClick('Hello\nworld.\nNext line.');
    assert.equal(once, 'Hello world.\nNext line.');
    assert.equal(deleteNewlinesOnClick(once), 'Hello world. Next line.');
});
