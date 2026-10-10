import { configurePitchPreservingMediaElement, normalizeReadAloudVolume } from './read_aloud.js';

let audioElement = null;
let audioObjectUrl = null;
let playbackGeneration = 0;
let volumePercent = 100;

export function setReadAloudVolume(percent) {
    volumePercent = normalizeReadAloudVolume(percent);
    if (audioElement) audioElement.volume = volumePercent / 100;
}

function base64ToBytes(value) {
    const encoded = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
    const binary = globalThis.atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

function hasBytes(bytes, offset, expected) {
    return expected.every((value, index) => bytes[offset + index] === value);
}

export function detectAudioMimeType(bytes) {
    if (hasBytes(bytes, 0, [0x49, 0x44, 0x33])) return 'audio/mpeg';
    if (hasBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && hasBytes(bytes, 8, [0x57, 0x41, 0x56, 0x45])) {
        return 'audio/wav';
    }
    if (hasBytes(bytes, 0, [0x4f, 0x67, 0x67, 0x53])) return 'audio/ogg';
    if (hasBytes(bytes, 0, [0x66, 0x4c, 0x61, 0x43])) return 'audio/flac';
    if (hasBytes(bytes, 0, [0x1a, 0x45, 0xdf, 0xa3])) return 'audio/webm';
    if (hasBytes(bytes, 4, [0x66, 0x74, 0x79, 0x70])) return 'audio/mp4';
    if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) return 'audio/aac';
    if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'audio/mpeg';
    return '';
}

function getDataUrlMimeType(data) {
    if (typeof data !== 'string') return '';
    return /^data:([^;,]+)/i.exec(data)?.[1] ?? '';
}

function toAudioSource(data) {
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

    return {
        buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        mimeType: getDataUrlMimeType(data) || detectAudioMimeType(bytes),
    };
}

function releaseAudio(currentAudio, currentObjectUrl) {
    currentAudio.onended = null;
    currentAudio.onloadedmetadata = null;
    currentAudio.pause();
    currentAudio.removeAttribute('src');
    URL.revokeObjectURL(currentObjectUrl);

    if (audioElement === currentAudio) audioElement = null;
    if (audioObjectUrl === currentObjectUrl) audioObjectUrl = null;
}

function releaseCurrentAudio() {
    if (!audioElement || !audioObjectUrl) return;
    releaseAudio(audioElement, audioObjectUrl);
}

export function stopReadAloudVoice() {
    playbackGeneration += 1;
    releaseCurrentAudio();
}

export function pauseReadAloudVoice() {
    if (!audioElement || audioElement.paused || audioElement.ended) return false;
    audioElement.pause();
    return true;
}

export async function resumeReadAloudVoice() {
    const currentAudio = audioElement;
    if (!currentAudio || !currentAudio.paused || currentAudio.ended) return false;

    await currentAudio.play();
    return audioElement === currentAudio && !currentAudio.paused;
}

export function setReadAloudPlaybackRate(playbackRate) {
    if (!audioElement) return false;
    configurePitchPreservingMediaElement(audioElement, playbackRate);
    return true;
}

export function getReadAloudProgress() {
    return {
        currentTime: audioElement?.currentTime ?? 0,
        duration: audioElement?.duration ?? 0,
    };
}

export async function seekReadAloudVoice(seconds) {
    const currentAudio = audioElement;
    if (!currentAudio || !Number.isFinite(currentAudio.duration) || currentAudio.duration <= 0) return false;
    const wasFinished = currentAudio.ended;
    currentAudio.currentTime = Math.min(currentAudio.duration, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
    if (wasFinished) {
        await currentAudio.play();
    }
    return audioElement === currentAudio;
}

export async function replayReadAloudVoice(options = {}) {
    const currentAudio = audioElement;
    if (!currentAudio) return false;
    currentAudio.currentTime = 0;
    currentAudio.onended = () => {
        if (audioElement === currentAudio) options.onEnded?.();
    };
    await currentAudio.play();
    if (audioElement !== currentAudio) return false;
    options.onStarted?.();
    return true;
}

export async function playReadAloudVoice(data, options = {}) {
    const generation = ++playbackGeneration;
    releaseCurrentAudio();

    const audioSource = toAudioSource(data);
    const currentObjectUrl = URL.createObjectURL(new Blob([audioSource.buffer], { type: audioSource.mimeType }));
    const currentAudio = new Audio();
    currentAudio.preload = 'auto';
    currentAudio.volume = volumePercent / 100;
    currentAudio.src = currentObjectUrl;
    configurePitchPreservingMediaElement(currentAudio, options.playbackRate);

    audioElement = currentAudio;
    audioObjectUrl = currentObjectUrl;
    currentAudio.onloadedmetadata = () => {
        if (audioElement === currentAudio) options.onProgress?.();
    };
    currentAudio.onended = () => {
        if (audioElement !== currentAudio) return;
        options.onProgress?.();
        options.onEnded?.();
    };

    try {
        await currentAudio.play();
        if (generation !== playbackGeneration || audioElement !== currentAudio) return false;
        options.onStarted?.();
        return true;
    } catch (reason) {
        if (audioElement === currentAudio) releaseAudio(currentAudio, currentObjectUrl);
        throw reason;
    }
}
