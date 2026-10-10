import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    configurePitchPreservingMediaElement,
    formatReadAloudPlaybackRate,
    isCurrentReadAloudPlayback,
    normalizeReadAloudPlaybackRate,
    normalizeReadAloudText,
    toReadAloudSpeechText,
    resolveInitialReadAloudPlaybackRate,
    clampReadAloudTime,
    readAloudTimeFromPosition,
    formatReadAloudTime,
    READ_ALOUD_PLAYBACK_RATES,
    READ_ALOUD_RATE_BUTTON_WIDTH,
    READ_ALOUD_SERVICE_CHIP_MAX_WIDTH,
    resolveReadAloudServiceLabel,
    selectDefaultTtsService,
    shouldHandleReadAloudRequest,
    shouldShowReadAloudStatus,
} from '../src/utils/read_aloud.js';
import {
    detectAudioMimeType,
    getReadAloudProgress,
    playReadAloudVoice,
    replayReadAloudVoice,
    seekReadAloudVoice,
    stopReadAloudVoice,
} from '../src/utils/read_aloud_player.js';
import { PLUGIN_FIELD_DESCRIPTION_CLASS_NAME } from '../src/utils/plugin_config_layout.js';

test('read aloud uses the first configured TTS service instance', () => {
    assert.equal(selectDefaultTtsService(['plugin.azure@primary', 'lingva_tts']), 'plugin.azure@primary');
    assert.equal(selectDefaultTtsService([]), null);
    assert.equal(selectDefaultTtsService(null), null);
});

test('read aloud trims selected text and rejects non-text payloads', () => {
    assert.equal(normalizeReadAloudText('  Zażółć gęślą jaźń  '), 'Zażółć gęślą jaźń');
    assert.equal(normalizeReadAloudText(undefined), '');
});

test('read aloud joins soft lines without damaging words or punctuation', () => {
    const samples = [
        ['the quick\nbrown fox', 'the quick brown fox'],
        ['inter-\nnational', 'inter-national'],
        ['well-\nknown', 'well-known'],
        ['2020 - 2021', '2020 - 2021'],
        ['朗读功能\n会自动', '朗读功能会自动'],
        ['中文\nEnglish', '中文English'],
        ['안녕하세요\n여러분', '안녕하세요 여러분'],
        ['Zażółć\ngęślą', 'Zażółć gęślą'],
        ['  alpha\r\n\t beta  ', 'alpha beta'],
    ];
    for (const [input, expected] of samples) assert.equal(normalizeReadAloudText(input), expected, input);
});

test('read aloud keeps sentence, list, numbered and short-title paragraph boundaries', () => {
    assert.equal(normalizeReadAloudText('Hello.\nWorld'), 'Hello.\nWorld');
    assert.equal(normalizeReadAloudText('Hello!”\nWorld'), 'Hello!”\nWorld');
    assert.equal(
        normalizeReadAloudText('Overview\nThis is a considerably longer body line\nwhich continues'),
        'Overview\nThis is a considerably longer body line which continues'
    );
    assert.equal(normalizeReadAloudText('Intro\n- [ ] First\n1. Second'), 'Intro\n- [ ] First\n1. Second');
    assert.equal(normalizeReadAloudText('Intro\n（一）第一\n二、第二'), 'Intro\n（一）第一\n二、第二');
    assert.equal(
        normalizeReadAloudText(
            'Body line with several words\n\ncontinues here with more body text\nand this continues'
        ),
        'Body line with several words continues here with more body text and this continues'
    );
    assert.equal(normalizeReadAloudText('Title\n\nBody'), 'Title\nBody');
    assert.equal(normalizeReadAloudText('alpha\n\n\nbeta'), 'alpha\nbeta');
});

test('speech text removes only the specified markup and retains visible markup', () => {
    const source = '## 概览\n- [ ] 梳理布局\n- [x] **优化**窗口';
    const normalized = normalizeReadAloudText(source);
    assert.equal(normalized, source);
    assert.equal(toReadAloudSpeechText(normalized), '概览。梳理布局。优化窗口');
    const samples = [
        ['1. Item\n2) Next', '1 Item. 2 Next'],
        ['(1) Item\n（ 一 ） Another', '1 Item. （ 一 ） Another'],
        ['一、第一\n二、第二', '一 第一。二 第二'],
        ['> `useConfig`', 'useConfig'],
        ['[文档](https://example.com)', '文档'],
        ['**bold** __under__ *italic* ~~strike~~', 'bold under italic strike'],
        ['---\nHello', 'Hello'],
        ['| 名称 | 说明 |', '名称，说明'],
        ['| Name | Meaning |', 'Name, Meaning'],
        [
            '2020 - 2021 well-known a*b snake_case https://example.com',
            '2020 - 2021 well-known a*b snake_case https://example.com',
        ],
    ];
    for (const [input, expected] of samples) assert.equal(toReadAloudSpeechText(input), expected, input);
    assert.equal(toReadAloudSpeechText('第一句。\n第二句'), '第一句。第二句');
    assert.equal(toReadAloudSpeechText('First.\nSecond'), 'First. Second');
    assert.equal(toReadAloudSpeechText('Title\nBody'), 'Title. Body');
    assert.equal(toReadAloudSpeechText(normalizeReadAloudText('Body text\n---\n## Next')), 'Body text. Next');
});

test('read aloud playback rate migrates and progress calculations reject unknown duration', () => {
    assert.equal(resolveInitialReadAloudPlaybackRate(null, '1.5'), 1.5);
    assert.equal(resolveInitialReadAloudPlaybackRate('2', '1.5'), 2);
    assert.equal(resolveInitialReadAloudPlaybackRate('bad', '1.5'), 1);
    assert.equal(clampReadAloudTime(70, 45), 45);
    assert.equal(clampReadAloudTime(-5, 45), 0);
    assert.equal(clampReadAloudTime(10, Number.NaN), 0);
    assert.equal(readAloudTimeFromPosition(150, 100, 100, 40), 20);
    assert.equal(readAloudTimeFromPosition(150, 100, 0, 40), 0);
    assert.equal(formatReadAloudTime(72.8), '1:12');
});

test('read aloud only accepts supported playback-rate presets', () => {
    assert.deepEqual(READ_ALOUD_PLAYBACK_RATES, [0.75, 1, 1.25, 1.5, 2]);
    assert.equal(normalizeReadAloudPlaybackRate('1.5'), 1.5);
    assert.equal(normalizeReadAloudPlaybackRate(3), 1);
    assert.equal(normalizeReadAloudPlaybackRate(undefined), 1);
    assert.equal(formatReadAloudPlaybackRate(1), '1.0×');
    assert.equal(formatReadAloudPlaybackRate(0.75), '0.75×');
});

test('read-aloud speed changes preserve the original voice pitch', () => {
    const audioElement = {
        playbackRate: 1,
        preservesPitch: false,
        webkitPreservesPitch: false,
    };

    configurePitchPreservingMediaElement(audioElement, 2);

    assert.equal(audioElement.playbackRate, 2);
    assert.equal(audioElement.preservesPitch, true);
    assert.equal(audioElement.webkitPreservesPitch, true);
});

test('the read-aloud player applies pitch preservation to the real media element', async () => {
    const OriginalAudio = globalThis.Audio;
    let currentAudio;

    globalThis.Audio = class FakeAudio {
        constructor() {
            currentAudio = this;
            this.defaultPlaybackRate = 1;
            this.ended = false;
            this.mozPreservesPitch = false;
            this.paused = true;
            this.playbackRate = 1;
            this.preservesPitch = false;
            this.webkitPreservesPitch = false;
        }

        pause() {
            this.paused = true;
        }

        async play() {
            this.paused = false;
        }

        removeAttribute(name) {
            if (name === 'src') this.src = '';
        }
    };

    try {
        await playReadAloudVoice([1, 2, 3], { playbackRate: 2 });
        assert.equal(currentAudio.playbackRate, 2);
        assert.equal(currentAudio.preservesPitch, true);
        assert.equal(currentAudio.webkitPreservesPitch, true);
    } finally {
        stopReadAloudVoice();
        globalThis.Audio = OriginalAudio;
    }
});

test('the read-aloud player labels ID3 audio as a supported MP3 source', async () => {
    const OriginalAudio = globalThis.Audio;
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    let audioBlob;

    URL.createObjectURL = (blob) => {
        audioBlob = blob;
        return 'blob:read-aloud-test';
    };
    URL.revokeObjectURL = () => {};
    globalThis.Audio = class FakeAudio {
        constructor() {
            this.ended = false;
            this.paused = true;
        }

        pause() {
            this.paused = true;
        }

        async play() {
            if (audioBlob.type !== 'audio/mpeg') {
                throw new Error('Failed to load because no supported source was found.');
            }
            this.paused = false;
        }

        removeAttribute(name) {
            if (name === 'src') this.src = '';
        }
    };

    try {
        await playReadAloudVoice([0x49, 0x44, 0x33, 0x04, 0x00, 0x00], { playbackRate: 1.5 });
        assert.equal(audioBlob.type, 'audio/mpeg');
    } finally {
        stopReadAloudVoice();
        globalThis.Audio = OriginalAudio;
        URL.createObjectURL = originalCreateObjectUrl;
        URL.revokeObjectURL = originalRevokeObjectUrl;
    }
});

test('finished audio is retained for replay and seeking, then released on stop', async () => {
    const OriginalAudio = globalThis.Audio;
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const revoked = [];
    let audio;
    URL.createObjectURL = () => 'blob:retained-audio';
    URL.revokeObjectURL = (url) => revoked.push(url);
    globalThis.Audio = class FakeAudio {
        constructor() {
            audio = this;
            this.currentTime = 0;
            this.duration = 45;
            this.paused = true;
            this.ended = false;
        }
        pause() {
            this.paused = true;
        }
        async play() {
            this.paused = false;
            this.ended = false;
        }
        removeAttribute() {
            this.src = '';
        }
    };
    try {
        await playReadAloudVoice([1, 2, 3]);
        audio.currentTime = 45;
        audio.ended = true;
        audio.paused = true;
        audio.onended();
        assert.deepEqual(revoked, []);
        assert.deepEqual(getReadAloudProgress(), { currentTime: 45, duration: 45 });
        await seekReadAloudVoice(12);
        assert.equal(audio.currentTime, 12);
        assert.equal(audio.paused, false);
        await replayReadAloudVoice();
        assert.equal(audio.currentTime, 0);
        stopReadAloudVoice();
        assert.deepEqual(revoked, ['blob:retained-audio']);
    } finally {
        stopReadAloudVoice();
        globalThis.Audio = OriginalAudio;
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
    }
});

test('read-aloud audio headers map to media MIME types', () => {
    assert.equal(detectAudioMimeType(new Uint8Array([0x49, 0x44, 0x33])), 'audio/mpeg');
    assert.equal(
        detectAudioMimeType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])),
        'audio/wav'
    );
    assert.equal(detectAudioMimeType(new Uint8Array([0x4f, 0x67, 0x67, 0x53])), 'audio/ogg');
    assert.equal(detectAudioMimeType(new Uint8Array([0x66, 0x4c, 0x61, 0x43])), 'audio/flac');
});

test('Tauri CSP permits Blob-backed read-aloud media', async () => {
    const tauriConfig = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));

    assert.match(tauriConfig.tauri.security.csp, /media-src[^;]*\bblob:/);
    assert.match(tauriConfig.tauri.security.devCsp, /media-src[^;]*\bblob:/);
});

test('only a newer read-aloud request can replace the current request', () => {
    assert.equal(shouldHandleReadAloudRequest(4, 5), true);
    assert.equal(shouldHandleReadAloudRequest(5, 5), false);
    assert.equal(shouldHandleReadAloudRequest(5, 4), false);
    assert.equal(shouldHandleReadAloudRequest(5, Number.NaN), false);
});

test('superseding playback invalidates late async results', () => {
    assert.equal(isCurrentReadAloudPlayback(5, 8, 5, 8), true);
    assert.equal(isCurrentReadAloudPlayback(5, 9, 5, 8), false);
    assert.equal(isCurrentReadAloudPlayback(6, 8, 5, 8), false);
});

test('the read-aloud footer only shows actionable loading and error states', () => {
    assert.equal(shouldShowReadAloudStatus('loading'), true);
    assert.equal(shouldShowReadAloudStatus('error'), true);
    assert.equal(shouldShowReadAloudStatus('playing'), false);
    assert.equal(shouldShowReadAloudStatus('paused'), false);
    assert.equal(shouldShowReadAloudStatus('finished'), false);
});

test('read-aloud restores its existing window before delivering a new request', async () => {
    const source = await readFile(new URL('../src-tauri/src/read_aloud.rs', import.meta.url), 'utf8');
    const requestFunction = source.slice(
        source.indexOf('pub fn request_read_aloud()'),
        source.indexOf('#[tauri::command]')
    );
    const unminimizeIndex = requestFunction.indexOf('.unminimize()');
    const showIndex = requestFunction.indexOf('.show()');
    const focusIndex = requestFunction.indexOf('.set_focus()');
    const emitIndex = requestFunction.indexOf('.emit(');

    assert.ok(unminimizeIndex >= 0, 'the minimized window must be restored');
    assert.ok(showIndex > unminimizeIndex, 'the restored window must be shown');
    assert.ok(focusIndex > showIndex, 'the shown window must receive focus');
    assert.ok(emitIndex > focusIndex, 'the request must be emitted after the window is visible');
});

test('read-aloud appears in the taskbar while translation keeps its existing behavior', async () => {
    const windows = await readFile(new URL('../src-tauri/src/window.rs', import.meta.url), 'utf8');
    const readAloud = windows.slice(
        windows.indexOf('pub fn read_aloud_window()'),
        windows.indexOf('pub fn config_window()')
    );
    const translate = windows.slice(
        windows.indexOf('fn translate_window()'),
        windows.indexOf('fn screenshot_window()')
    );
    assert.doesNotMatch(readAloud, /set_skip_taskbar\(true\)/);
    assert.match(translate, /set_skip_taskbar\(true\)/);
    const component = await readFile(new URL('../src/window/ReadAloud/index.jsx', import.meta.url), 'utf8');
    assert.match(component, /appWindow\.setTitle\(`Aries \$\{t\('read_aloud\.title'\)\}`\)/);
});

test('read-aloud uses a configured instance name or the human-readable plugin name', () => {
    assert.equal(
        resolveReadAloudServiceLabel({
            instanceName: 'My narrator',
            pluginDisplay: 'OpenAI-Compatible TTS (Development)',
            serviceName: 'plugin.com.pot-app.openai_compatible_tts.dev',
        }),
        'My narrator'
    );
    assert.equal(
        resolveReadAloudServiceLabel({
            instanceName: '',
            pluginDisplay: 'OpenAI-Compatible TTS (Development)',
            serviceName: 'plugin.com.pot-app.openai_compatible_tts.dev',
        }),
        'OpenAI-Compatible TTS (Development)'
    );
});

test('read-aloud footer controls stay balanced in the compact window', () => {
    assert.equal(READ_ALOUD_SERVICE_CHIP_MAX_WIDTH, 176);
    assert.equal(READ_ALOUD_RATE_BUTTON_WIDTH, 48);
});

test('plugin field hints wrap inside the right-aligned input column', () => {
    assert.match(PLUGIN_FIELD_DESCRIPTION_CLASS_NAME, /\btext-right\b/);
    assert.match(PLUGIN_FIELD_DESCRIPTION_CLASS_NAME, /\bbreak-all\b/);
    assert.doesNotMatch(PLUGIN_FIELD_DESCRIPTION_CLASS_NAME, /\bwhitespace-nowrap\b/);
});
