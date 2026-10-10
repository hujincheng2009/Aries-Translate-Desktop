import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAnkiNames } from '../src/utils/anki_names.js';

test('existing legacy deck keeps its card model', () => {
    assert.deepEqual(resolveAnkiNames(['Default', 'Pot', 'Aries']), { deckName: 'Pot', modelName: 'Pot Card 2' });
});
test('new users create Aries deck and model', () => {
    assert.deepEqual(resolveAnkiNames(['Default']), { deckName: 'Aries', modelName: 'Aries Card' });
});
