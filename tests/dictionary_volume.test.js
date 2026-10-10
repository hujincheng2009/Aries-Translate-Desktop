import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('dictionary pronunciation uses shared volume and applies changes through a live GainNode', async () => {
    const original = globalThis.window;
    const gains = [];
    const sources = [];
    globalThis.window = {
        AudioContext: class {
            state = 'running';
            destination = {};
            async decodeAudioData() {
                return {};
            }
            createGain() {
                const gain = {
                    gain: { value: 1 },
                    connect(target) {
                        this.target = target;
                    },
                    disconnect() {
                        this.disconnected = true;
                    },
                };
                gains.push(gain);
                return gain;
            }
            createBufferSource() {
                const source = {
                    connect(target) {
                        this.target = target;
                    },
                    disconnect() {},
                    start() {},
                    stop() {},
                };
                sources.push(source);
                return source;
            }
        },
    };
    const source = (await readFile(new URL('../src/hooks/useVoice.jsx', import.meta.url), 'utf8'))
        .replace("import { useCallback } from 'react';", 'const useCallback = fn => fn;')
        .replace("'../utils/read_aloud'", JSON.stringify(new URL('../src/utils/read_aloud.js', import.meta.url).href));
    const voice = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    try {
        voice.setVoiceVolume(35);
        await voice.playVoice([1, 2, 3]);
        assert.equal(gains[0].gain.value, 0.35);
        assert.equal(sources[0].target, gains[0]);
        voice.setVoiceVolume(0);
        assert.equal(gains[0].gain.value, 0);
        await voice.playVoice([1, 2, 3]);
        assert.equal(gains[1].gain.value, 0);
        assert.equal(gains[0].disconnected, true);
        voice.setVoiceVolume(80);
        assert.equal(gains[1].gain.value, 0.8);
    } finally {
        voice.stopVoice();
        globalThis.window = original;
    }
});
