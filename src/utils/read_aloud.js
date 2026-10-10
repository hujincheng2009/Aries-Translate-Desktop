export const DEFAULT_TTS_SERVICE_LIST = ['lingva_tts'];
export const READ_ALOUD_PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];
export const READ_ALOUD_PLAYBACK_RATE_STORAGE_KEY = 'pot-personal.read-aloud.playback-rate';
export const READ_ALOUD_PLAYBACK_RATE_CONFIG_KEY = 'read_aloud_playback_rate';
export const READ_ALOUD_VOLUME_CONFIG_KEY = 'read_aloud_volume';

export function normalizeReadAloudVolume(value) {
    if (value === null || value === '' || typeof value === 'boolean') return 100;
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(Math.min(100, Math.max(0, number))) : 100;
}
export const READ_ALOUD_SERVICE_CHIP_MAX_WIDTH = 176;
export const READ_ALOUD_RATE_BUTTON_WIDTH = 48;

export function resolveReadAloudServiceLabel({ instanceName, pluginDisplay, serviceName }) {
    return instanceName?.trim() || pluginDisplay?.trim() || serviceName;
}

export function selectDefaultTtsService(serviceInstanceList) {
    if (!Array.isArray(serviceInstanceList) || serviceInstanceList.length === 0) return null;
    return serviceInstanceList[0];
}

export function normalizeReadAloudText(text) {
    if (typeof text !== 'string') return '';
    const prepared = text.replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
    const lines = prepared.split('\n').map((line) => line.trim());
    const nonempty = lines.filter(Boolean);
    if (!nonempty.length) return '';
    const widths = nonempty.map(displayWidth);
    const result = [nonempty[0]];
    let previous = nonempty[0];
    let blank = false;
    let nextIndex = 1;
    for (const line of lines.slice(lines.indexOf(nonempty[0]) + 1)) {
        if (!line) {
            blank = true;
            continue;
        }
        const otherWidths = widths.filter((_, index) => index !== nextIndex - 1).sort((a, b) => a - b);
        const median =
            otherWidths.length % 2
                ? otherWidths[Math.floor(otherWidths.length / 2)]
                : (otherWidths[otherWidths.length / 2 - 1] + otherWidths[otherWidths.length / 2]) / 2;
        const shortLine = nonempty.length < 3 ? blank : displayWidth(previous) < median * 0.6;
        const paragraph =
            isListStart(line) ||
            isStructuralLine(line) ||
            isStructuralLine(previous) ||
            endsSentence(previous) ||
            (shortLine && !/[,，、\-–—]$/.test(previous));
        if (paragraph) {
            result.push('\n', line);
        } else {
            const left = previous.at(-1);
            const right = line[0];
            const hyphenated = /\p{L}-$/u.test(previous) && /^\p{L}/u.test(line);
            const noSpace = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303f\uff00-\uffef]/u.test(
                left + right
            );
            result.push(hyphenated || noSpace ? '' : ' ', line);
        }
        previous = line;
        blank = false;
        nextIndex += 1;
    }
    return result.join('').replace(/ +/g, ' ').trim();
}

function displayWidth(line) {
    return [...line].reduce(
        (width, character) =>
            width +
            (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(character) ? 2 : 1),
        0
    );
}

const sentenceEnd = /[。！？…；：.!?;:]["'”’）」』》)]*$/u;
function endsSentence(line) {
    return sentenceEnd.test(line);
}

function isListStart(line) {
    return /^(?:[-*+•·▪◦]\s+|\d+[.)、]\s*|\(\d+\)\s*|（[一二三四五六七八九十]+）\s*|[一二三四五六七八九十]+、\s*)/u.test(
        line
    );
}

function isStructuralLine(line) {
    return /^(?:#{1,6}\s+|>+\s*|\|\s*|(?:-{3,}|\*{3,}|_{3,})$)/.test(line);
}

function stripSpeechMarkers(line) {
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) return '';
    let value = line.replace(/^>+\s*/, '').replace(/^#{1,6}\s+/, '');
    value = value.replace(/^[-*+•·▪◦]\s+/, '').replace(/^\[(?: |x|X)\]\s*/, '');
    value = value
        .replace(/^(\d+)[.)、]\s*/, '$1 ')
        .replace(/^\((\d+)\)\s*/, '$1 ')
        .replace(/^（([一二三四五六七八九十]+)）\s*/, '$1 ')
        .replace(/^([一二三四五六七八九十]+)、\s*/, '$1 ');
    value = value
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(
            /\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|(?<!\*)\*([^*\n]+)\*(?!\*)/g,
            (_, bold, underline, strike, italic) => bold ?? underline ?? strike ?? italic
        )
        .replace(/`([^`]+)`/g, '$1');
    if (value.includes('|')) {
        value = value.replace(/^\|\s*/, '').replace(/\s*\|$/, '');
        value = value.replace(
            /\s*\|\s*/g,
            /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value) ? '，' : ', '
        );
    }
    return value.trim();
}

export function toReadAloudSpeechText(normalizedText) {
    if (typeof normalizedText !== 'string') return '';
    const lines = normalizedText.split('\n').map(stripSpeechMarkers).filter(Boolean);
    return lines
        .reduce((speech, line, index) => {
            if (!index) return line;
            const previous = lines[index - 1];
            if (endsSentence(previous)) {
                const adjacentCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(
                    previous.at(-1) + line[0]
                );
                return speech + (adjacentCjk ? '' : ' ') + line;
            }
            return (
                speech +
                (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(previous.at(-1)) ? '。' : '. ') +
                line
            );
        }, '')
        .trim();
}

export function resolveInitialReadAloudPlaybackRate(configValue, oldStorageValue) {
    return normalizeReadAloudPlaybackRate(configValue == null ? oldStorageValue : configValue);
}

export function clampReadAloudTime(seconds, duration) {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    return Math.min(duration, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
}

export function readAloudTimeFromPosition(clientX, left, width, duration) {
    if (!Number.isFinite(width) || width <= 0) return 0;
    return clampReadAloudTime(((clientX - left) / width) * duration, duration);
}

export function formatReadAloudTime(seconds) {
    const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function normalizeReadAloudPlaybackRate(playbackRate) {
    const rate = Number(playbackRate);
    return READ_ALOUD_PLAYBACK_RATES.includes(rate) ? rate : 1;
}

export function formatReadAloudPlaybackRate(playbackRate) {
    const rate = normalizeReadAloudPlaybackRate(playbackRate);
    return `${Number.isInteger(rate) ? rate.toFixed(1) : rate}×`;
}

export function configurePitchPreservingMediaElement(audioElement, playbackRate) {
    const rate = normalizeReadAloudPlaybackRate(playbackRate);
    audioElement.preservesPitch = true;
    if ('webkitPreservesPitch' in audioElement) audioElement.webkitPreservesPitch = true;
    if ('mozPreservesPitch' in audioElement) audioElement.mozPreservesPitch = true;
    if ('defaultPlaybackRate' in audioElement) audioElement.defaultPlaybackRate = rate;
    audioElement.playbackRate = rate;
    return rate;
}

export function shouldHandleReadAloudRequest(lastRequestId, incomingRequestId) {
    return Number.isSafeInteger(incomingRequestId) && incomingRequestId > lastRequestId;
}

export function shouldShowReadAloudStatus(status) {
    return status === 'loading' || status === 'error';
}

export function isCurrentReadAloudPlayback(currentRequestId, currentPlaybackSession, requestId, playbackSession) {
    return currentRequestId === requestId && currentPlaybackSession === playbackSession;
}
