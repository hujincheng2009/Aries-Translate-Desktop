import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { accents, accentFromKey, applyAccent, normalizeAccent } from '../src/utils/accent.js';

const css = fs.readFileSync('src/styles/tokens.css', 'utf8');
const rules = [...css.matchAll(/([^{}]+)\{([^}]+)\}/g)].map((match) => ({
    selector: match[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(),
    values: Object.fromEntries([...match[2].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])),
}));
function tokens(accent, dark) {
    const result = {};
    for (const rule of rules) {
        if (
            rule.selector === ':root' ||
            (dark && rule.selector === '.dark') ||
            rule.selector === `html[data-accent='${accent}']` ||
            (dark && rule.selector === `html.dark[data-accent='${accent}']`)
        )
            Object.assign(result, rule.values);
    }
    const rgb = (key) => {
        const alias = result[key].match(/^var\(--(.+)\)$/);
        return alias ? rgb(alias[1]) : result[key].split(/\s+/).map(Number);
    };
    return { rgb, result };
}
const luminance = (rgb) =>
    rgb
        .map((v) => {
            const x = v / 255;
            return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
    const x = luminance(a),
        y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const hexRgb = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
for (const accent of accents)
    for (const dark of [false, true]) {
        test(`CSS palette ${accent.value}/${dark ? 'dark' : 'light'}: buttons and text stay readable; sidebar unchanged`, () => {
            const theme = tokens(accent.value, dark);
            assert.ok(contrast(theme.rgb('primary'), theme.rgb('primary-foreground')) >= 4.5, 'button text');
            assert.ok(contrast(theme.rgb('primary-text'), theme.rgb('background')) >= 4.5, 'text on background');
            assert.ok(contrast(theme.rgb('primary-text'), theme.rgb('card')) >= 4.5, 'text on card');
            const neutral = tokens('neutral', dark);
            for (const key of [
                'sidebar',
                'sidebar-accent',
                'sidebar-foreground',
                'sidebar-accent-foreground',
                'sidebar-border',
                'radius',
            ])
                assert.equal(theme.result[key], neutral.result[key], key);
            if (accent.primary) {
                assert.deepEqual(theme.rgb('primary'), hexRgb(accent.primary));
                assert.deepEqual(theme.rgb('primary-foreground'), hexRgb(accent.foreground));
                assert.deepEqual(theme.rgb('primary-vivid'), hexRgb(accent.vivid ?? accent.primary));
            }
            if (accent.value === 'aries')
                assert.deepEqual(theme.rgb('switch-thumb-on'), dark ? [20, 20, 20] : [255, 255, 255]);
            if (accent.value !== 'neutral') assert.deepEqual(theme.rgb('ring'), theme.rgb('primary-vivid'));
        });
    }
test('unknown or missing saved accent falls back without rewriting configuration', () => {
    for (const unknown of [null, undefined, '', 'brand', '__proto__', {}, 0]) {
        assert.equal(normalizeAccent(unknown), 'neutral');
        const root = { dataset: {} };
        applyAccent(unknown, root);
        assert.equal(root.dataset.accent, 'neutral');
    }
});
test('accent radio keys cycle left/right and support Home/End without handling unrelated keys', () => {
    assert.equal(accentFromKey('neutral', 'ArrowLeft'), 'violet');
    assert.equal(accentFromKey('violet', 'ArrowRight'), 'neutral');
    assert.equal(accentFromKey('aries', 'ArrowRight'), 'blue');
    assert.equal(accentFromKey('blue', 'ArrowLeft'), 'aries');
    assert.equal(accentFromKey('blue', 'Home'), 'neutral');
    assert.equal(accentFromKey('blue', 'End'), 'violet');
    assert.equal(accentFromKey('blue', 'Tab'), null);
});
test('all palette names and setting labels are translated in three languages', () => {
    for (const lang of ['zh_CN', 'zh_TW', 'en_US']) {
        const general = JSON.parse(fs.readFileSync(`src/i18n/locales/${lang}.json`, 'utf8')).translation.config.general;
        assert.equal(typeof general.app_accent, 'string');
        assert.equal(typeof general.app_accent_desc, 'string');
        for (const accent of accents) assert.equal(typeof general.accents[accent.value], 'string');
    }
});
