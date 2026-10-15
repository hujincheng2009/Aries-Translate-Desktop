import detect from './lang_detect';
import { DEFAULT_TTS_SERVICE_LIST, normalizeReadAloudText, toReadAloudSpeechText } from './read_aloud';
import { toAudioSource } from './read_aloud_player';
import { createSelectionAudioCache, selectionCacheKey } from './selection_read_aloud';
import { synthesizeWithFallback } from './tts';

// Player for the translate window's read-aloud bubble. It has its own <audio> element and its own cache, so reading a
// few selected words never replaces the card player's audio (which keeps pause, seek and replay). Speed is always 1.0;
// the speech services, voices and volume are the normal read-aloud ones.

let audio = null;
let objectUrl = null;
let generation = 0;
const cache = createSelectionAudioCache();

function release() {
    if (!audio) return;
    audio.onended = null;
    audio.pause();
    audio.removeAttribute('src');
    URL.revokeObjectURL(objectUrl);
    audio = null;
    objectUrl = null;
}

export function stopSelectionReadAloud() {
    generation += 1;
    release();
}

export function clearSelectionReadAloudCache() {
    stopSelectionReadAloud();
    cache.clear();
}

async function synthesize(text, { fallbackLanguage, serviceInstanceList, getConfig, shouldContinue }) {
    const key = selectionCacheKey(text, fallbackLanguage, serviceInstanceList);
    const cached = cache.get(key);
    if (cached) return { data: cached, failures: [] };
    const speech = await synthesizeWithFallback({
        text: toReadAloudSpeechText(normalizeReadAloudText(text)),
        serviceInstanceList,
        getConfig,
        shouldContinue,
        // Dictionary results mix languages, so read the selection in its own language; fall back to the card's.
        language: {
            mode: 'detect',
            detect: async (value) => {
                try {
                    return (await detect(value)) || fallbackLanguage;
                } catch {
                    return fallbackLanguage;
                }
            },
        },
    });
    const data = speech?.data ?? speech;
    if (data == null || (typeof data.length === 'number' && data.length === 0))
        throw new Error('TTS service returned no audio');
    cache.set(key, data);
    return { ...speech, data };
}

// Synthesizes (or takes from the cache) and plays `text`. `onStarted` / `onEnded` only fire for the latest call.
// Returns the synthesis result (with `failures` from services that were skipped), or null when superseded.
export async function speakSelection(
    text,
    { fallbackLanguage, serviceInstanceList, getConfig, volume = 100, onStarted, onEnded }
) {
    stopSelectionReadAloud();
    const session = generation;
    const isCurrent = () => generation === session;
    const speech = await synthesize(text, {
        fallbackLanguage,
        serviceInstanceList: serviceInstanceList?.length ? serviceInstanceList : DEFAULT_TTS_SERVICE_LIST,
        getConfig,
        shouldContinue: isCurrent,
    });
    if (!isCurrent()) return null;
    const source = toAudioSource(speech.data);
    const url = URL.createObjectURL(new Blob([source.buffer], { type: source.mimeType }));
    const element = new Audio();
    element.src = url;
    element.playbackRate = 1;
    element.volume = Math.max(0, Math.min(100, volume)) / 100;
    audio = element;
    objectUrl = url;
    element.onended = () => {
        if (audio !== element) return;
        release();
        onEnded?.();
    };
    try {
        await element.play();
    } catch (reason) {
        if (audio === element) release();
        throw reason;
    }
    if (!isCurrent()) return null;
    onStarted?.();
    return speech;
}
