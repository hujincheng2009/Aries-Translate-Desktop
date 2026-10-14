import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
    HIDE_DELAY_OPTIONS,
    SELECTION_ACTIONS,
    SELECTION_DEFAULTS,
    addToBlacklist,
    clampOffset,
    moveItem,
    normalizeActions,
    normalizeExe,
    normalizeOrder,
    toggleAction,
} from '../src/utils/selection_assistant.js';

test('enabled actions keep known unique entries and never end up empty', () => {
    assert.deepEqual(normalizeActions(['copy', 'bogus', 'translate', 'copy']), ['copy', 'translate']);
    assert.deepEqual(normalizeActions([]), SELECTION_ACTIONS);
    assert.deepEqual(normalizeActions(null), SELECTION_ACTIONS);
});

test('order lists every action once, saved order first', () => {
    assert.deepEqual(normalizeOrder(['copy', 'copy', 'x'], ['read_aloud']), [
        'copy',
        'read_aloud',
        'translate',
        'replace_translate',
    ]);
    assert.deepEqual(normalizeOrder(undefined, undefined), SELECTION_ACTIONS);
});

test('unchecking keeps the order of the remaining buttons; the last one cannot be removed', () => {
    const order = ['copy', 'translate', 'read_aloud', 'replace_translate'];
    assert.deepEqual(toggleAction(order, SELECTION_ACTIONS, 'translate', false), [
        'copy',
        'read_aloud',
        'replace_translate',
    ]);
    assert.deepEqual(toggleAction(order, ['copy'], 'read_aloud', true), ['copy', 'read_aloud']);
    assert.equal(toggleAction(order, ['copy'], 'copy', false), null);
});

test('moveItem reorders and ignores out-of-range moves', () => {
    assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
    assert.deepEqual(moveItem(['a', 'b'], 0, 5), ['a', 'b']);
});

test('exe names are taken from paths and get .exe when missing', () => {
    assert.equal(normalizeExe('  "C:\\Program Files\\Adobe\\Photoshop.exe" '), 'Photoshop.exe');
    assert.equal(normalizeExe('notepad'), 'notepad.exe');
    assert.equal(normalizeExe('   '), '');
    assert.deepEqual(addToBlacklist(['Photoshop.exe'], 'photoshop.EXE'), ['Photoshop.exe']);
    assert.deepEqual(addToBlacklist(undefined, 'code'), ['code.exe']);
});

test('offsets are clamped whole pixels; blanks keep the previous value', () => {
    assert.equal(clampOffset('12.6', 0), 13);
    assert.equal(clampOffset('-999', 0), -200);
    assert.equal(clampOffset('', 16), 16);
    assert.equal(clampOffset('abc', 16), 16);
});

test('Rust and JS agree on the action list and defaults', () => {
    const rust = fs.readFileSync('src-tauri/src/selection_assistant/mod.rs', 'utf8');
    const list = rust.match(/pub const ACTIONS: \[&str; 4\] = \[([^\]]+)\]/)[1];
    assert.deepEqual(
        [...list.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]),
        SELECTION_ACTIONS
    );
    assert.match(rust, /offset_x: 12,\s+offset_y: 16/);
    assert.match(rust, /hide_delay_secs: 3/);
    assert.match(rust, /button_style: "icon"\.into\(\)/);
    assert.equal(SELECTION_DEFAULTS.selection_assistant_button_style, 'icon');
    assert.ok(HIDE_DELAY_OPTIONS.includes(0));
});
