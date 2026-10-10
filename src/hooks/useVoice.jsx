import { useCallback } from 'react';
import { normalizeReadAloudVolume } from '../utils/read_aloud';

let audioContext = null;
let source = null;
let playbackGeneration = 0;
let volumePercent = 100;
let gainNode = null;

export function setVoiceVolume(percent) {
    volumePercent = normalizeReadAloudVolume(percent);
    if (gainNode) gainNode.gain.value = volumePercent / 100;
}

function getAudioContext() {
    if (!audioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
    }
    return audioContext;
}

function stopCurrentSource() {
    if (!source) return;

    const currentSource = source;
    source = null;
    currentSource.onended = null;
    try {
        currentSource.stop();
    } catch {
        // The source may already have ended between the state check and stop.
    }
    currentSource.disconnect();
    gainNode?.disconnect();
    gainNode = null;
}

function base64ToBytes(value) {
    const encoded = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
    const binary = window.atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

function toAudioArrayBuffer(data) {
    let bytes;
    if (typeof data === 'string') {
        bytes = base64ToBytes(data);
    } else if (data instanceof ArrayBuffer) {
        bytes = new Uint8Array(data);
    } else if (ArrayBuffer.isView(data)) {
        bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (Array.isArray(data)) {
        bytes = new Uint8Array(data);
    } else if (Array.isArray(data?.data)) {
        bytes = new Uint8Array(data.data);
    } else {
        throw new Error('Unsupported audio data');
    }

    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export function stopVoice() {
    playbackGeneration += 1;
    stopCurrentSource();
}

export function isVoicePlaying() {
    return source !== null;
}

export async function pauseVoice() {
    if (!source || !audioContext || audioContext.state !== 'running') return false;

    await audioContext.suspend();
    return source !== null && audioContext.state === 'suspended';
}

export async function resumeVoice() {
    if (!source || !audioContext || audioContext.state !== 'suspended') return false;

    await audioContext.resume();
    return source !== null && audioContext.state === 'running';
}

export async function playVoice(data, options = {}) {
    const generation = ++playbackGeneration;
    stopCurrentSource();

    const context = getAudioContext();
    if (context.state === 'suspended') {
        await context.resume();
    }
    const buffer = await context.decodeAudioData(toAudioArrayBuffer(data));
    if (generation !== playbackGeneration) return false;

    const currentSource = context.createBufferSource();
    currentSource.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = volumePercent / 100;
    currentSource.connect(gain);
    gain.connect(context.destination);
    gainNode = gain;
    source = currentSource;
    currentSource.onended = () => {
        if (source !== currentSource) return;
        currentSource.disconnect();
        gain.disconnect();
        if (gainNode === gain) gainNode = null;
        source = null;
        options.onEnded?.();
    };
    currentSource.start();
    options.onStarted?.();
    return true;
}

export const useVoice = () => {
    const playOrStop = useCallback((data) => {
        if (isVoicePlaying()) {
            stopVoice();
        } else {
            void playVoice(data).catch(() => {});
        }
    }, []);

    return playOrStop;
};
