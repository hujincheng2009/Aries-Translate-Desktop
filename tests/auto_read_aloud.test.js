import assert from 'node:assert/strict';
import test from 'node:test';
import {
    AUTO_READ_WAIT,
    INITIAL_AUTO_READ_STATE,
    pickAutoReadCard,
    beginAutoReadRound,
    reportAutoReadCard,
    claimAutoReadCard,
} from '../src/utils/auto_read_aloud.js';

const card = (id, status, text = '') => ({ id, status, text });
for (const [label, cards, expected] of [
    ['first success', [card('a', 'success', 'A'), card('b', 'pending')], 'a'],
    ['earlier failure', [card('a', 'error'), card('b', 'success', 'B')], 'b'],
    ['earlier pending', [card('a', 'pending'), card('b', 'success', 'B')], AUTO_READ_WAIT],
    ['all failures', [card('a', 'error'), card('b', 'error')], null],
    ['skipped earlier card', [card('a', 'skipped'), card('b', 'success', 'B')], 'b'],
    ['empty results', [card('a', 'success', '  '), card('b', 'success', 'B')], 'b'],
    ['dictionary object', [card('a', 'success', {}), card('b', 'success', 'B')], 'b'],
])
    test(label, () => assert.equal(pickAutoReadCard(cards), expected));

test('stale reports cannot affect a later translation round, and reading is claimed once', () => {
    const a = beginAutoReadRound(INITIAL_AUTO_READ_STATE, 'old', [card('a', 'pending')], true);
    const b = beginAutoReadRound(a, 'new', [card('a', 'pending')], true);
    assert.equal(reportAutoReadCard(b, 'old', a.round, 'a', 'success', 'OLD'), b);
    const success = reportAutoReadCard(b, 'new', b.round, 'a', 'success', 'NEW');
    const claimed = claimAutoReadCard(success, 'new', 'a');
    assert.equal(claimed.claimed, true);
    assert.equal(claimAutoReadCard(claimed, 'new', 'a'), claimed);
});

test('manual speech cancels the entire round; service changes do not start another round', () => {
    const initial = beginAutoReadRound(
        INITIAL_AUTO_READ_STATE,
        'text/languages',
        [card('a', 'pending'), card('b', 'pending')],
        true
    );
    const cancelled = { ...initial, cancelled: true };
    const same = beginAutoReadRound(cancelled, initial.context, [card('b', 'pending'), card('a', 'skipped')], true);
    assert.equal(same.round, initial.round);
    assert.equal(same.cancelled, true);
    assert.equal(reportAutoReadCard(same, same.context, same.round, 'b', 'success', 'B'), same);
});

test('disabled rounds never play and toggling on waits for new text', () => {
    const initial = beginAutoReadRound(INITIAL_AUTO_READ_STATE, 'one', [card('a', 'pending')], false);
    const enabled = beginAutoReadRound(initial, 'one', initial.cards, true);
    assert.equal(enabled.cancelled, true);
    assert.equal(claimAutoReadCard(enabled, 'one', 'a'), enabled);
    assert.equal(beginAutoReadRound(enabled, 'two', initial.cards, true).cancelled, false);
});
