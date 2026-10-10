const MAX_INPUT_BYTES = 4000; // Below Google's 5,000-byte limit; sentence limits can still vary by voice.
const MAX_SPLIT_DEPTH = 10;
const MAX_REQUESTS = 256;
const encoder = new TextEncoder();

function byteLength(text) {
    return encoder.encode(text).length;
}

export function splitGoogleCloudText(text, maxBytes = MAX_INPUT_BYTES) {
    if (!Number.isInteger(maxBytes) || maxBytes < 4) throw new Error('Google Cloud TTS chunk size is invalid.');
    const characters = Array.from(text.trim());
    const chunks = [];
    let start = 0;
    while (start < characters.length) {
        let end = start;
        let bytes = 0;
        let sentenceBreak = start;
        let wordBreak = start;
        while (end < characters.length) {
            const size = byteLength(characters[end]);
            if (bytes + size > maxBytes) break;
            bytes += size;
            const character = characters[end];
            const next = characters[end + 1] ?? '';
            if (/\s|[,，、]/u.test(character)) wordBreak = end + 1;
            if (/[。！？!?;；\n]/u.test(character) || (character === '.' && (!next || /\s|["'”’）)]/u.test(next)))) {
                sentenceBreak = end + 1;
            }
            end += 1;
        }
        const boundary =
            end === characters.length
                ? end
                : sentenceBreak > start + (end - start) / 2
                  ? sentenceBreak
                  : wordBreak > start
                    ? wordBreak
                    : end;
        const chunk = characters.slice(start, boundary).join('').trim();
        if (chunk) chunks.push(chunk);
        start = boundary;
    }
    return chunks;
}

export function isGoogleCloudLengthError(error) {
    const message = String(error?.message ?? error ?? '');
    const status = Number(error?.status);
    if (Number.isFinite(status) ? status !== 400 : !/HTTP\s+400\b/i.test(message)) return false;
    return /sentences?.*too long|input size.*(?:exceed|limit)|(?:input\.text|input\.ssml).*longer.*limit|text.*exceeds.*(?:bytes|limit)/i.test(
        message
    );
}

function wavParts(audio) {
    const bytes = audio instanceof Uint8Array ? audio : new Uint8Array(audio);
    const ascii = (start, size) => String.fromCharCode(...bytes.subarray(start, start + size));
    if (bytes.length < 44 || ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WAVE') {
        throw new Error('Google Cloud TTS returned invalid LINEAR16 WAV audio.');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const end = view.getUint32(4, true) + 8;
    if (end !== bytes.length) throw new Error('Google Cloud TTS returned incomplete WAV audio.');
    let format;
    const data = [];
    for (let position = 12; position + 8 <= end; ) {
        const name = ascii(position, 4);
        const size = view.getUint32(position + 4, true);
        const offset = position + 8;
        if (offset + size > end) throw new Error('Google Cloud TTS returned incomplete WAV audio.');
        if (name === 'fmt ') {
            if (size < 16) throw new Error('Google Cloud TTS returned an invalid WAV format.');
            format = {
                type: view.getUint16(offset, true),
                channels: view.getUint16(offset + 2, true),
                sampleRate: view.getUint32(offset + 4, true),
                byteRate: view.getUint32(offset + 8, true),
                blockAlign: view.getUint16(offset + 12, true),
                bits: view.getUint16(offset + 14, true),
            };
        } else if (name === 'data') data.push(bytes.subarray(offset, offset + size));
        position = offset + size + (size % 2);
    }
    if (
        !format ||
        !data.length ||
        format.type !== 1 ||
        format.bits !== 16 ||
        !format.channels ||
        !format.sampleRate ||
        format.blockAlign !== format.channels * 2 ||
        format.byteRate !== format.sampleRate * format.blockAlign ||
        data.some((part) => part.length % format.blockAlign !== 0)
    ) {
        throw new Error('Google Cloud TTS returned an invalid LINEAR16 WAV format.');
    }
    return { format, data };
}

// Stitch PCM payloads, not MP3/OGG streams or complete WAV files; a single header exposes the full duration.
export function mergeGoogleCloudWav(audio) {
    const parts = audio.map(wavParts);
    const format = parts[0]?.format;
    if (!format) throw new Error('Google Cloud TTS returned no audio.');
    if (parts.some((part) => Object.keys(format).some((key) => part.format[key] !== format[key]))) {
        throw new Error('Google Cloud TTS audio segments have different WAV formats.');
    }
    const data = parts.flatMap((part) => part.data);
    const size = data.reduce((total, part) => total + part.length, 0);
    if (size > 0xffffffff - 36) throw new Error('Google Cloud TTS audio is too large to combine.');
    const result = new Uint8Array(44 + size);
    const view = new DataView(result.buffer);
    const ascii = (offset, value) => {
        for (let i = 0; i < value.length; i++) result[offset + i] = value.charCodeAt(i);
    };
    ascii(0, 'RIFF');
    view.setUint32(4, size + 36, true);
    ascii(8, 'WAVE');
    ascii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, format.channels, true);
    view.setUint32(24, format.sampleRate, true);
    view.setUint32(28, format.byteRate, true);
    view.setUint16(32, format.blockAlign, true);
    view.setUint16(34, 16, true);
    ascii(36, 'data');
    view.setUint32(40, size, true);
    let offset = 44;
    for (const part of data) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
}

export async function synthesizeGoogleCloudText(request, sendRequest, shouldContinue = () => true) {
    const chunks = splitGoogleCloudText(request.payload.input.text);
    const audio = [];
    let usePcm = chunks.length > 1;
    let requests = 0;
    const checkCurrent = () => {
        if (!shouldContinue()) throw new Error('TTS request cancelled');
    };
    const synthesize = async (text, pcm, depth = 0) => {
        checkCurrent();
        if (requests >= MAX_REQUESTS)
            throw new Error('Google Cloud TTS text required too many synthesis segments. Select a smaller passage.');
        requests += 1;
        const part = {
            ...request,
            payload: {
                ...request.payload,
                input: { text },
                audioConfig: { ...request.payload.audioConfig, ...(pcm ? { audioEncoding: 'LINEAR16' } : {}) },
            },
        };
        let bytes;
        try {
            bytes = await sendRequest(part);
        } catch (error) {
            checkCurrent();
            if (!isGoogleCloudLengthError(error) || depth >= MAX_SPLIT_DEPTH) throw error;
            const smaller = splitGoogleCloudText(text, Math.max(4, Math.floor(byteLength(text) / 2)));
            if (smaller.length < 2) throw error;
            usePcm = true;
            for (const chunk of smaller) await synthesize(chunk, true, depth + 1);
            return;
        }
        checkCurrent();
        audio.push(bytes);
    };
    for (const chunk of chunks) await synthesize(chunk, usePcm);
    checkCurrent();
    return usePcm ? mergeGoogleCloudWav(audio) : audio[0];
}
