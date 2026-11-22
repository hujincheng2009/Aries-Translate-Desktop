const BITS_PER_SAMPLE = 16;

function startsWith(bytes, offset, signature) {
    return (
        bytes.length >= offset + signature.length && signature.every((value, index) => bytes[offset + index] === value)
    );
}

export function isWav(bytes) {
    return startsWith(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, 8, [0x57, 0x41, 0x56, 0x45]);
}

export function isMp3(bytes) {
    return (
        startsWith(bytes, 0, [0x49, 0x44, 0x33]) ||
        (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    );
}

export function isKnownAudioContainer(bytes) {
    return (
        isWav(bytes) ||
        isMp3(bytes) ||
        startsWith(bytes, 0, [0x4f, 0x67, 0x67, 0x53]) ||
        startsWith(bytes, 0, [0x66, 0x4c, 0x61, 0x43])
    );
}

export function detectAudioMimeType(bytes) {
    if (isWav(bytes)) return 'audio/wav';
    if (startsWith(bytes, 0, [0x4f, 0x67, 0x67, 0x53])) return 'audio/ogg';
    if (startsWith(bytes, 0, [0x66, 0x4c, 0x61, 0x43])) return 'audio/flac';
    if (startsWith(bytes, 0, [0x1a, 0x45, 0xdf, 0xa3])) return 'audio/webm';
    if (startsWith(bytes, 4, [0x66, 0x74, 0x79, 0x70])) return 'audio/mp4';
    if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) return 'audio/aac';
    if (isMp3(bytes)) return 'audio/mpeg';
    return '';
}

function writeAscii(bytes, offset, value) {
    for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index);
}

export function wrapPcmInWav(pcmBytes, sampleRate = 24000, channels = 1) {
    const pcm = pcmBytes instanceof Uint8Array ? pcmBytes : new Uint8Array(pcmBytes);
    const wav = new Uint8Array(44 + pcm.byteLength);
    const view = new DataView(wav.buffer);
    const blockAlign = channels * (BITS_PER_SAMPLE / 8);

    writeAscii(wav, 0, 'RIFF');
    view.setUint32(4, 36 + pcm.byteLength, true);
    writeAscii(wav, 8, 'WAVE');
    writeAscii(wav, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, BITS_PER_SAMPLE, true);
    writeAscii(wav, 36, 'data');
    view.setUint32(40, pcm.byteLength, true);
    wav.set(pcm, 44);
    return Array.from(wav);
}
