import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeReadAloudVolume } from '../src/utils/read_aloud.js';
import { setReadAloudVolume, playReadAloudVoice, stopReadAloudVoice } from '../src/utils/read_aloud_player.js';

test('volume normalization handles missing, invalid, fractional and out-of-range values', () => {
    for (const [input, expected] of [
        [-5, 0],
        [0, 0],
        [37, 37],
        [100, 100],
        [150, 100],
        ['abc', 100],
        [null, 100],
        [undefined, 100],
        [NaN, 100],
        [Infinity, 100],
        [37.6, 38],
        ['35', 35],
        ['', 100],
        [false, 100],
    ]) {
        assert.equal(normalizeReadAloudVolume(input), expected);
    }
});

test('volume changes immediately affect current audio and are inherited by subsequent audio', async () => {
    const original = globalThis.Audio;
    const instances = [];
    globalThis.Audio = class {
        constructor() {
            instances.push(this);
        }
        async play() {}
        pause() {}
        removeAttribute() {}
    };
    try {
        setReadAloudVolume(35);
        await playReadAloudVoice([1, 2, 3]);
        assert.equal(instances[0].volume, 0.35);
        setReadAloudVolume(0);
        assert.equal(instances[0].volume, 0);
        await playReadAloudVoice([1, 2, 3]);
        assert.equal(instances[1].volume, 0);
        setReadAloudVolume(65);
        assert.equal(instances[1].volume, 0.65);
        await playReadAloudVoice([1, 2, 3]);
        assert.equal(instances[2].volume, 0.65);
    } finally {
        stopReadAloudVoice();
        setReadAloudVolume(100);
        globalThis.Audio = original;
    }
});
