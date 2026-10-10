import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

// tao-0.16.10 window.rs BORDERLESS_RESIZE_INSET: wry turns a left-button press this close to the edge of a frameless
// window into a resize drag (CSS px, scaled by the monitor DPI), so no scrollbar may sit inside it.
const RESIZE_BAND = 5;

const css = fs.readFileSync('src/style.css', 'utf8');

// Body of the first rule whose selector is exactly `selector`.
function rule(selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(`(?:^|\\s|\\})${escaped}\\s*\\{([^}]*)\\}`));
    assert.ok(match, `${selector} rule is missing from src/style.css`);
    return match[1];
}

const px = (body, property) => {
    const match = body.match(new RegExp(`(?:^|[\\s;])${property}:\\s*(-?\\d+(?:\\.\\d+)?)px`));
    assert.ok(match, `${property} must be set in px`);
    return Number(match[1]);
};

test('window-scroll keeps its scrollbar clear of the native resize band on the right and bottom', () => {
    const body = rule('.window-scroll');
    assert.ok(px(body, 'margin-right') >= RESIZE_BAND + 3);
    assert.ok(px(body, 'margin-bottom') >= RESIZE_BAND + 3);
});

test('window-scroll thumb floats 8px clear of the content as a 4px pill that stays grabbable', () => {
    const track = px(rule('.window-scroll::-webkit-scrollbar'), 'width');
    const thumb = rule('.window-scroll::-webkit-scrollbar-thumb');
    const gap = px(thumb, 'border-left');
    assert.match(thumb, /border-left:\s*\d+px solid transparent/);
    assert.match(thumb, /background-clip:\s*padding-box/);
    // 8px gap + 4px pill: whole device pixels at 125%, 150% and 175% as well as 100% and 200%
    assert.equal(gap, 8);
    assert.equal(track - gap, 4);
    // background-clip shrinks each corner radius by the border width, so the rounded left corners need
    // pill radius (2px) + gap; the right corners need the pill radius alone, all with a 2px vertical radius.
    assert.match(thumb, /border-radius:\s*10px 2px 2px 10px \/ 2px/);
});

test('thumb hover and drag only change the colour, so the thumb never grows over its transparent gap', () => {
    // every thumb rule, including :hover / :active states
    const thumbRules = [...css.matchAll(/([^{}]*::-webkit-scrollbar-thumb[^{]*)\{([^}]*)\}/g)];
    assert.ok(
        thumbRules.some(([, selector]) => /:hover/.test(selector)),
        'a hover state is defined'
    );
    // the shorthand resets background-clip to border-box (1.0.9 hover bug: 4px thumb became 12px)
    for (const [, selector, body] of thumbRules)
        assert.doesNotMatch(body, /(?:^|[\s;])background:/, `${selector.trim()} must use background-color`);
    const hover = thumbRules.find(([, selector]) => /:hover/.test(selector))[2];
    const normal = thumbRules.find(([, selector]) => /^\s*\*::-webkit-scrollbar-thumb\s*$/.test(selector))[2];
    const colour = (body) => body.match(/background(?:-color)?:\s*(#[0-9a-f]+)/i)[1].toLowerCase();
    assert.notEqual(colour(hover), colour(normal));
});

test('every full-window scroll container uses window-scroll', () => {
    const translate = fs.readFileSync('src/window/Translate/index.jsx', 'utf8');
    assert.match(translate, /className='window-scroll [^']*overflow-y-auto/);
    const config = fs.readFileSync('src/components/app/ConfigShell.jsx', 'utf8');
    assert.match(config, /<main className='window-scroll [^']*overflow-y-auto/);
    // the old one-off margins that only fixed the translate window must not come back
    assert.doesNotMatch(translate, /className='[^']*\bmr-2\b[^']*overflow-y-auto/);
});

test('settings content keeps its 24px reading gap to the scrollbar', () => {
    const config = fs.readFileSync('src/components/app/ConfigShell.jsx', 'utf8');
    // pr-4 (16px) + the 8px transparent part of the thumb = the 24px left padding
    assert.match(config, /<main className='window-scroll [^']*\bpl-6\b[^']*\bpr-4\b/);
});
